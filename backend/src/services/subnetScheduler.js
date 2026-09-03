/**
 * Subnet Intelligence Scheduler
 * ─────────────────────────────
 * Runs once per day at 08:00 UTC.
 * Picks the next 3 subnets in the rotation, scrapes + analyzes them,
 * stores reports in SubnetReport collection.
 * After all subnets complete one cycle, resets to index 0 (cycle 2 begins).
 */

const cron = require("node-cron");
const Channel = require("../models/Channel");
const SubnetReport = require("../models/SubnetReport");
const SubnetSchedule = require("../models/SubnetSchedule");
const SubnetConfig = require("../models/SubnetConfig");
const Message = require("../models/Message");
const { analyzeSubnet } = require("./subnetIntelService");
const { backfillChannel } = require("./scraperService");
const { scrapeRepo } = require("./githubScraper");
const logger = require("../utils/logger");

const SUBNETS_PER_DAY = 3;

// Rolling window of chat to analyze: only the past ~1 month of messages is
// considered. Anything older than this is ignored, so a report always reflects
// the most recent month, never the full channel history.
const ANALYSIS_WINDOW_DAYS = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Sort channels by subnet number extracted from channel name
// e.g. "11--trajectory-rl--λ" → 11, "general" → 999 (no number → end)
// ─────────────────────────────────────────────────────────────────────────────
function extractSubnetNumber(channelName) {
  const match = channelName.match(/^(\d+)/);
  const num = match ? parseInt(match[1]) : 9999;
  return num === 0 ? 9999 : num; // ← treat 0 as invalid
}

async function getSortedSubnetChannels(serverId) {
  const channels = await Channel.find({
    serverId,
    scrapeEnabled: true,
    type: "text",
  });
  return channels
    .map((ch) => ({
      ...ch.toObject(),
      subnetNumber: extractSubnetNumber(ch.name),
    }))
    .filter((ch) => ch.subnetNumber > 0 && ch.subnetNumber !== 9999)
    .sort((a, b) => a.subnetNumber - b.subnetNumber);
}

// ─────────────────────────────────────────────────────────────────────────────
// Get or create the schedule state
// Pass resetToSubnet to force the rotation to start from a specific subnet number
// e.g. resetToSubnet = 9 → scheduler starts from SN9 on next run
// ─────────────────────────────────────────────────────────────────────────────
async function getSchedule(allSubnets = null, resetToSubnet = null) {
  let schedule = await SubnetSchedule.findOne();

  if (!schedule) {
    schedule = await SubnetSchedule.create({
      currentIndex: 0,
      cycleNumber: 1,
      subnetsPerDay: SUBNETS_PER_DAY,
    });
  }

  // If a resetToSubnet is requested, point the rotation at that subnet number.
  // If that exact subnet has no channel, fall through to the next available one.
  if (resetToSubnet !== null && allSubnets) {
    let targetIndex = allSubnets.findIndex(
      (ch) => ch.subnetNumber === resetToSubnet
    );
    if (targetIndex === -1) {
      targetIndex = allSubnets.findIndex((ch) => ch.subnetNumber >= resetToSubnet);
    }
    if (targetIndex !== -1) {
      const resolved = allSubnets[targetIndex].subnetNumber;
      await SubnetSchedule.findByIdAndUpdate(schedule._id, {
        nextSubnetNumber: resolved,
        currentIndex: targetIndex,
      });
      schedule.nextSubnetNumber = resolved;
      schedule.currentIndex = targetIndex;
      logger.info(`🔧 Schedule reset: next run starts from subnet ${resolved} (requested ${resetToSubnet}, index ${targetIndex})`);
    } else {
      logger.warn(`⚠️  No subnet >= ${resetToSubnet} found in channel list — ignoring reset`);
    }
  }

  return schedule;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pause helper — decides whether the automatic rotation should be held.
// Auto-resumes (clears the pause) once resumeAt has passed. Returns true if the
// run should be skipped. The rotation pointer is never touched, so resuming
// continues from exactly where it stopped.
// ─────────────────────────────────────────────────────────────────────────────
async function isRotationPaused(schedule) {
  if (!schedule?.isPaused) return false;

  // Auto-resume if a resumeAt was set and that time has arrived.
  if (schedule.resumeAt && new Date() >= new Date(schedule.resumeAt)) {
    await SubnetSchedule.findByIdAndUpdate(schedule._id, {
      isPaused: false,
      pausedAt: null,
      resumeAt: null,
      pauseReason: null,
    });
    logger.info("▶️  Subnet analysis auto-resumed — scheduled hold has expired.");
    return false;
  }

  const until = schedule.resumeAt
    ? `until ${new Date(schedule.resumeAt).toISOString()}`
    : "indefinitely (resume manually)";
  logger.info(`⏸️  Subnet analysis is paused ${until} — skipping automatic run.`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DAILY JOB
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object}   discordClient  - Discord.js client
 * @param {string}   serverId       - Discord guild ID
 * @param {number[]|null} manualSubnets - e.g. [9, 10, 11] to override rotation
 * @param {number|null}   resetToSubnet - Force rotation to restart from this subnet number
 */
async function runDailySubnetAnalysis(
  discordClient,
  serverId,
  manualSubnets = null,
  resetToSubnet = null,
) {
  // Load all subnets first so getSchedule can resolve resetToSubnet index
  const allSubnets = await getSortedSubnetChannels(serverId);
  if (allSubnets.length === 0) {
    logger.warn("No subnet channels found — make sure scrapeEnabled=true on subnet channels.");
    return { processed: 0 };
  }

  const schedule = await getSchedule(allSubnets, resetToSubnet);

  // Honor a pause/hold for automatic rotation runs only. Manual runs (explicit
  // subnet list) are an intentional user action and bypass the pause.
  const isAutomaticRun = !manualSubnets || manualSubnets.length === 0;
  if (isAutomaticRun && (await isRotationPaused(schedule))) {
    return { skipped: true, reason: "paused" };
  }

  // Prevent double-run
  if (schedule.isRunning) {
    logger.warn("Subnet scheduler: already running, skipping.");
    return { skipped: true, reason: "already running" };
  }

  await SubnetSchedule.findByIdAndUpdate(schedule._id, {
    isRunning: true,
    lastRunDate: new Date(),
  });

  try {
    const total = allSubnets.length;
    let cycleNumber = schedule.cycleNumber;

    // ── Resolve the start position by SUBNET NUMBER (robust against index drift) ──
    // If nextSubnetNumber is set, start at the first subnet whose number is >= it.
    // Otherwise fall back to the legacy stored index (fresh schedules).
    let startIndex;
    if (schedule.nextSubnetNumber != null) {
      startIndex = allSubnets.findIndex(
        (ch) => ch.subnetNumber >= schedule.nextSubnetNumber
      );
      if (startIndex === -1) startIndex = 0; // requested subnet past the end → wrap to start
    } else {
      startIndex = schedule.currentIndex % total;
    }

    const results = [];
    const reportDate = new Date();
    reportDate.setHours(0, 0, 0, 0);

    // Backfill + analyze a single subnet. Returns "ok" | "no_data" | "failed".
    async function processSubnet(ch) {
      try {
        logger.info(`  → Subnet ${ch.subnetNumber}: #${ch.name}`);

        // Backfill last 7 days of messages
        if (discordClient) {
          try {
            await backfillChannel(discordClient, ch.discordId, { limit: 500 });
          } catch (e) {
            logger.warn(`  Backfill failed for ${ch.name}: ${e.message} — using existing data`);
          }
        }

        // Scrape this subnet's configured GitHub repos so the analysis step has
        // fresh activity to read. Non-fatal — a repo failure still leaves a
        // complete Discord report.
        try {
          const cfg = await SubnetConfig.findOne({ subnetNumber: ch.subnetNumber })
            .select("githubRepos")
            .lean();
          const repos = cfg?.githubRepos || [];
          for (const repo of repos) {
            try {
              await scrapeRepo(repo, { sinceDays: ANALYSIS_WINDOW_DAYS });
            } catch (e) {
              logger.warn(`  GitHub scrape failed for ${repo} (SN${ch.subnetNumber}): ${e.message}`);
            }
          }
          if (repos.length) {
            logger.info(`  → Scraped ${repos.length} GitHub repo(s) for SN${ch.subnetNumber}`);
          }
        } catch (e) {
          logger.warn(`  GitHub repo lookup failed for SN${ch.subnetNumber}: ${e.message}`);
        }

        // Run AI analysis over the past ~1 month of messages only.
        const report = await analyzeSubnet(ch.discordId, ch.name, ch.subnetNumber, ANALYSIS_WINDOW_DAYS);

        if (report) {
          await SubnetReport.findOneAndUpdate(
            { channelId: ch.discordId, reportDate },
            {
              subnetNumber: ch.subnetNumber,
              channelId:    ch.discordId,
              channelName:  ch.name,
              reportDate,
              report,
              cycleNumber,
              dayInCycle:   Math.floor(startIndex / SUBNETS_PER_DAY) + 1,
              status:       "completed",
            },
            { upsert: true, new: true },
          );

          logger.info(`  ✅ Subnet ${ch.subnetNumber} complete — score: ${report.investabilityScore}/10`);
          return { subnetNumber: ch.subnetNumber, name: ch.name, status: "ok" };
        }

        // No report → BOTH sources were empty (no usable chat AND no GitHub data).
        // A quiet Discord channel alone no longer lands here — analyzeSubnet still
        // builds a GitHub-only report in that case.
        logger.info(
          `  ⏭️  Subnet ${ch.subnetNumber} skipped (no Discord messages and no GitHub data) — trying next`,
        );
        return { subnetNumber: ch.subnetNumber, name: ch.name, status: "no_data" };

      } catch (err) {
        logger.error(`  ❌ Subnet ${ch.subnetNumber} failed: ${err.message}`);
        await SubnetReport.findOneAndUpdate(
          { channelId: ch.discordId, reportDate },
          {
            subnetNumber: ch.subnetNumber,
            channelId:    ch.discordId,
            channelName:  ch.name,
            reportDate,
            status:       "failed",
            error:        err.message,
            cycleNumber,
          },
          { upsert: true },
        );
        return { subnetNumber: ch.subnetNumber, name: ch.name, status: "failed", error: err.message };
      }
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // ── MANUAL run — process exactly the requested subnets, no skipping ────────
    if (manualSubnets && manualSubnets.length > 0) {
      const toProcess = manualSubnets
        .map((sn) => allSubnets.find((ch) => ch.subnetNumber === sn))
        .filter(Boolean);

      if (toProcess.length === 0) {
        logger.warn(`⚠️  None of the requested subnets [${manualSubnets}] were found in the channel list.`);
        await SubnetSchedule.findByIdAndUpdate(schedule._id, { isRunning: false });
        return { processed: 0 };
      }

      logger.info(`🎯 Manual subnet run: [${toProcess.map((ch) => ch.subnetNumber).join(", ")}]`);

      for (let i = 0; i < toProcess.length; i++) {
        results.push(await processSubnet(toProcess[i]));
        if (i < toProcess.length - 1) await sleep(3000);
      }

      // Manual run — don't touch the rotation pointer
      await SubnetSchedule.findByIdAndUpdate(schedule._id, { isRunning: false });

      logger.info(`📊 Run complete: ${results.filter((r) => r.status === "ok").length}/${toProcess.length} succeeded`);
      return { processed: results.length, results };
    }

    // ── SCHEDULED rotation — keep going until SUBNETS_PER_DAY *succeed*, ───────
    //    skipping empty / failed subnets. Examine at most one full pass.
    logger.info(
      `📊 Daily subnet analysis: aiming for ${SUBNETS_PER_DAY} report(s), starting at subnet ${allSubnets[startIndex].subnetNumber}`
    );

    let successCount = 0;
    let examined = 0;
    let idx = startIndex;
    let lastExaminedIndex = startIndex;

    while (successCount < SUBNETS_PER_DAY && examined < total) {
      const ch = allSubnets[idx];
      const r = await processSubnet(ch);
      results.push(r);
      if (r.status === "ok") successCount++;

      lastExaminedIndex = idx;
      examined++;
      idx = (idx + 1) % total; // wrap so a run near the end can still find 3

      if (successCount < SUBNETS_PER_DAY && examined < total) await sleep(3000);
    }

    // ── Advance pointer to the subnet AFTER the last one we examined ──────────
    let nextCycle = cycleNumber;
    let nextIndex = lastExaminedIndex + 1;
    if (nextIndex >= total) {
      nextIndex = 0;
      nextCycle += 1;
      logger.info(`🔄 Completed full cycle ${cycleNumber} of ${total} subnets. Starting cycle ${nextCycle}.`);
    }
    const nextSubnetNumber = allSubnets[nextIndex].subnetNumber;

    await SubnetSchedule.findByIdAndUpdate(schedule._id, {
      nextSubnetNumber,
      currentIndex: nextIndex,
      cycleNumber:  nextCycle,
      isRunning:    false,
    });

    logger.info(
      `📊 Run complete: ${successCount}/${SUBNETS_PER_DAY} reports (examined ${examined} subnet(s)). Next run starts at subnet ${nextSubnetNumber}.`
    );
    return { processed: results.length, results };

  } catch (err) {
    logger.error("Subnet scheduler fatal error:", err.message);
    await SubnetSchedule.findByIdAndUpdate(schedule._id, { isRunning: false });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RETENTION CLEANUP — keep reports for ~2 months, then delete older ones.
// We keep two months so each new report can be compared against the prior period
// (month-over-month: did last period's "raiseTo9" goals get delivered?).
//
// Safety: we NEVER delete a subnet's single most-recent report, even if it is
// older than the cutoff. Some subnets sit far apart in the rotation, and the
// month-over-month step (subnetIntelService) needs that latest prior report as
// its comparison baseline. So we only prune old reports that already have a
// newer report for the same subnet.
// ─────────────────────────────────────────────────────────────────────────────
const RETENTION_MONTHS = 2;

async function cleanupOldReports() {
  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
    cutoff.setHours(0, 0, 0, 0);

    // Most-recent report _id per subnet — these are always preserved.
    const latest = await SubnetReport.aggregate([
      { $sort: { reportDate: -1 } },
      { $group: { _id: "$subnetNumber", latestId: { $first: "$_id" } } },
    ]);
    const keepIds = latest.map((d) => d.latestId);

    const res = await SubnetReport.deleteMany({
      reportDate: { $lt: cutoff },
      _id: { $nin: keepIds },
    });

    if (res.deletedCount > 0) {
      logger.info(
        `🧹 Retention cleanup: deleted ${res.deletedCount} report(s) older than ${RETENTION_MONTHS} months (before ${cutoff.toISOString().split("T")[0]}), keeping each subnet's latest.`,
      );
    } else {
      logger.info(
        `🧹 Retention cleanup: nothing older than ${RETENTION_MONTHS} months to delete.`,
      );
    }
    return res.deletedCount;
  } catch (err) {
    logger.error("Retention cleanup failed:", err.message);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE RETENTION — keep scraped messages for ~2 months, then delete older ones.
// Mirrors the report retention above (same RETENTION_MONTHS window). Reports only
// ever analyze a rolling ANALYSIS_WINDOW_DAYS (30-day) window, so any message past
// the 2-month cutoff is never read again — deleting it is safe and keeps the
// Message collection from growing without bound. Unlike reports there is nothing to
// preserve per channel, so this is a plain age filter on discordCreatedAt (the time
// the message was actually posted on Discord).
// ─────────────────────────────────────────────────────────────────────────────
async function cleanupOldMessages() {
  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
    cutoff.setHours(0, 0, 0, 0);

    const res = await Message.deleteMany({
      discordCreatedAt: { $lt: cutoff },
    });

    if (res.deletedCount > 0) {
      logger.info(
        `🧹 Message retention: deleted ${res.deletedCount} message(s) older than ${RETENTION_MONTHS} months (before ${cutoff.toISOString().split("T")[0]}).`,
      );
    } else {
      logger.info(
        `🧹 Message retention: nothing older than ${RETENTION_MONTHS} months to delete.`,
      );
    }
    return res.deletedCount;
  } catch (err) {
    logger.error("Message retention cleanup failed:", err.message);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup catch-up: if today's batch hasn't run yet (server was down at midnight,
// just rebooted, or first launch), run it once shortly after boot so a day is
// never missed. Guarded by lastRunDate so restarts during the day don't re-run.
// Disable with SUBNET_RUN_ON_STARTUP=false.
// ─────────────────────────────────────────────────────────────────────────────
async function runCatchUpIfNeeded(discordClient, serverId) {
  try {
    const schedule = await SubnetSchedule.findOne();
    const now = new Date();
    const lastRun = schedule?.lastRunDate ? new Date(schedule.lastRunDate) : null;
    const ranToday =
      lastRun &&
      lastRun.getFullYear() === now.getFullYear() &&
      lastRun.getMonth() === now.getMonth() &&
      lastRun.getDate() === now.getDate();

    if (ranToday) {
      logger.info("✅ Subnet analysis already ran today — skipping startup catch-up.");
      return;
    }

    logger.info("⏳ No subnet analysis yet today — running startup catch-up...");
    await runDailySubnetAnalysis(discordClient, serverId);
  } catch (err) {
    logger.error("Startup catch-up failed:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON — runs every day at midnight (00:00) so fresh reports are ready for the
// new day. Timezone defaults to UTC; set SUBNET_SCHEDULE_TZ (e.g. "Asia/Karachi")
// in .env to run at your own local midnight.
// ─────────────────────────────────────────────────────────────────────────────
function startScheduler(discordClient, serverId) {
  if (!serverId) {
    logger.warn("Subnet scheduler: DISCORD_GUILD_ID not set — scheduler disabled.");
    return;
  }

  const timezone = process.env.SUBNET_SCHEDULE_TZ || "UTC";
  logger.info(`⏰ Subnet scheduler started — runs daily at 00:00 ${timezone}`);

  cron.schedule(
    "0 0 * * *",
    async () => {
      logger.info("⏰ Scheduled subnet analysis triggered");
      try {
        await runDailySubnetAnalysis(discordClient, serverId);
      } catch (err) {
        logger.error("Scheduled run failed:", err.message);
      }
      // Prune reports older than the retention window after each daily run.
      await cleanupOldReports();
      // Prune messages older than the retention window too.
      await cleanupOldMessages();
    },
    { timezone },
  );

  // Run today's batch on startup if it hasn't happened yet (unless disabled).
  if (process.env.SUBNET_RUN_ON_STARTUP !== "false") {
    setTimeout(() => runCatchUpIfNeeded(discordClient, serverId), 15000);
  }

  // Prune old reports on startup too, so retention holds even if the server is
  // rarely up at the scheduled cron time.
  setTimeout(() => cleanupOldReports(), 30000);
  // Same for old messages — trail slightly so the two deletes don't hit Mongo at once.
  setTimeout(() => cleanupOldMessages(), 35000);
}

module.exports = {
  startScheduler,
  runDailySubnetAnalysis,
  getSortedSubnetChannels,
  cleanupOldReports,
  cleanupOldMessages,
  SUBNETS_PER_DAY,
};