/**
 * Subnet Intelligence Scheduler
 * ─────────────────────────────
 * Runs once per day at 08:00 UTC.
 * Picks the next 4 subnets in the rotation, scrapes + analyzes them,
 * stores reports in SubnetReport collection.
 * After all subnets complete one cycle, resets to index 0 (cycle 2 begins).
 */

const cron = require("node-cron");
const Channel = require("../models/Channel");
const SubnetReport = require("../models/SubnetReport");
const SubnetSchedule = require("../models/SubnetSchedule");
const { analyzeSubnet } = require("./subnetIntelService");
const { backfillChannel } = require("./scraperService");
const logger = require("../utils/logger");

const SUBNETS_PER_DAY = 4;

// ─────────────────────────────────────────────────────────────────────────────
// Sort channels by subnet number extracted from channel name
// e.g. "11--trajectory-rl--λ" → 11, "general" → 999 (no number → end)
// ─────────────────────────────────────────────────────────────────────────────
function extractSubnetNumber(channelName) {
  const match = channelName.match(/^(\d+)/);
  return match ? parseInt(match[1]) : 9999;
}

async function getSortedSubnetChannels(serverId) {
  const channels = await Channel.find({
    serverId,
    scrapeEnabled: true,
    type: "text",
  });

  return channels
    .map(ch => ({
      ...ch.toObject(),
      subnetNumber: extractSubnetNumber(ch.name),
    }))
    .filter(ch => ch.subnetNumber !== undefined)// only numbered subnet channels
    .sort((a, b) => a.subnetNumber - b.subnetNumber);
}

// ─────────────────────────────────────────────────────────────────────────────
// Get or create the schedule state
// ─────────────────────────────────────────────────────────────────────────────
async function getSchedule() {
  let schedule = await SubnetSchedule.findOne();
  if (!schedule) {
    schedule = await SubnetSchedule.create({
      currentIndex: 0,
      cycleNumber: 1,
      subnetsPerDay: SUBNETS_PER_DAY,
    });
  }
  return schedule;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DAILY JOB
// ─────────────────────────────────────────────────────────────────────────────
async function runDailySubnetAnalysis(discordClient, serverId, manualSubnets = null) {
  const schedule = await getSchedule();

  // Prevent double-run
  if (schedule.isRunning) {
    logger.warn("Subnet scheduler: already running, skipping.");
    return { skipped: true, reason: "already running" };
  }

  await SubnetSchedule.findByIdAndUpdate(schedule._id, { isRunning: true, lastRunDate: new Date() });

  try {
    const allSubnets = await getSortedSubnetChannels(serverId);
    if (allSubnets.length === 0) {
      logger.warn("No subnet channels found — make sure scrapeEnabled=true on subnet channels.");
      return { processed: 0 };
    }

    const total = allSubnets.length;
    let startIndex = schedule.currentIndex % total;
    let cycleNumber = schedule.cycleNumber;

    // If manual subnets provided (from UI), use those instead
    const toProcess = manualSubnets
      ? allSubnets.filter(ch => manualSubnets.includes(ch.subnetNumber))
      : allSubnets.slice(startIndex, startIndex + SUBNETS_PER_DAY);

    logger.info(`📊 Daily subnet analysis: processing ${toProcess.length} subnets (index ${startIndex}–${startIndex + toProcess.length - 1} of ${total})`);

    const results = [];
    const reportDate = new Date();
    reportDate.setHours(0, 0, 0, 0);

    for (const ch of toProcess) {
      try {
        logger.info(`  → Subnet ${ch.subnetNumber}: #${ch.name}`);

        // First backfill last 7 days to make sure we have fresh data
        if (discordClient) {
          try {
            await backfillChannel(discordClient, ch.discordId, { limit: 500 });
          } catch (e) {
            logger.warn(`  Backfill failed for ${ch.name}: ${e.message} — using existing data`);
          }
        }

        // Run the AI analysis
        const report = await analyzeSubnet(ch.discordId, ch.name, ch.subnetNumber, 7);

        if (report) {
          // Save report — upsert so re-running same day updates it
          await SubnetReport.findOneAndUpdate(
            {
              channelId: ch.discordId,
              reportDate,
            },
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
            { upsert: true, new: true }
          );

          results.push({ subnetNumber: ch.subnetNumber, name: ch.name, status: "ok" });
          logger.info(`  ✅ Subnet ${ch.subnetNumber} complete — score: ${report.investabilityScore}/10`);
        } else {
          results.push({ subnetNumber: ch.subnetNumber, name: ch.name, status: "no_data" });
        }

        // Rate limit — wait 3s between subnets
        await new Promise(r => setTimeout(r, 3000));

      } catch (err) {
        logger.error(`  ❌ Subnet ${ch.subnetNumber} failed: ${err.message}`);
        results.push({ subnetNumber: ch.subnetNumber, name: ch.name, status: "failed", error: err.message });

        await SubnetReport.findOneAndUpdate(
          { channelId: ch.discordId, reportDate },
          { subnetNumber: ch.subnetNumber, channelId: ch.discordId, channelName: ch.name, reportDate, status: "failed", error: err.message, cycleNumber },
          { upsert: true }
        );
      }
    }

    // Advance the schedule index
    if (!manualSubnets) {
      let nextIndex = startIndex + SUBNETS_PER_DAY;
      let nextCycle = cycleNumber;

      if (nextIndex >= total) {
        nextIndex = 0;
        nextCycle += 1;
        logger.info(`🔄 Completed full cycle ${cycleNumber} of ${total} subnets. Starting cycle ${nextCycle}.`);
      }

      await SubnetSchedule.findByIdAndUpdate(schedule._id, {
        currentIndex: nextIndex,
        cycleNumber:  nextCycle,
        isRunning:    false,
      });
    } else {
      await SubnetSchedule.findByIdAndUpdate(schedule._id, { isRunning: false });
    }

    logger.info(`📊 Daily subnet run complete: ${results.filter(r => r.status === "ok").length}/${toProcess.length} succeeded`);
    return { processed: results.length, results };

  } catch (err) {
    logger.error("Subnet scheduler fatal error:", err.message);
    await SubnetSchedule.findByIdAndUpdate(schedule._id, { isRunning: false });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON — runs every day at 08:00 UTC
// ─────────────────────────────────────────────────────────────────────────────
function startScheduler(discordClient, serverId) {
  if (!serverId) {
    logger.warn("Subnet scheduler: DISCORD_GUILD_ID not set — scheduler disabled.");
    return;
  }

  logger.info("⏰ Subnet scheduler started — runs daily at 08:00 UTC");

  cron.schedule("0 8 * * *", async () => {
    logger.info("⏰ Scheduled subnet analysis triggered");
    try {
      await runDailySubnetAnalysis(discordClient, serverId);
    } catch (err) {
      logger.error("Scheduled run failed:", err.message);
    }
  }, { timezone: "UTC" });
}

module.exports = { startScheduler, runDailySubnetAnalysis, getSortedSubnetChannels };
