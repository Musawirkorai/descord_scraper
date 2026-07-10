const router = require("express").Router();
const { requireAuth, requireAdmin } = require("../middleware/auth");
const SubnetReport = require("../models/SubnetReport");
const SubnetSchedule = require("../models/SubnetSchedule");
const Channel = require("../models/Channel");
const {
  runDailySubnetAnalysis,
  getSortedSubnetChannels,
  SUBNETS_PER_DAY,
} = require("../services/subnetScheduler");
const { answerSubnetQuestion } = require("../services/subnetIntelService");

// Manual "Run now" is allowed at most once every 7 days.
const MANUAL_RUN_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// GET /api/subnets/today
// Returns the latest batch keyed by reportDate — BOTH successful reports and
// any that failed (e.g. rate limit / error), so the UI can surface subnets whose
// report couldn't be produced instead of silently dropping them.
router.get("/today", requireAuth, async (req, res) => {
  try {
    // Determine the batch day: today if anything ran today, otherwise the most
    // recent day that produced any report.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let batchStart = todayStart;
    const hasToday = await SubnetReport.exists({
      reportDate: { $gte: todayStart },
    });
    if (!hasToday) {
      const latest = await SubnetReport.findOne()
        .sort({ reportDate: -1 })
        .select("reportDate")
        .lean();
      if (latest?.reportDate) {
        batchStart = new Date(latest.reportDate);
        batchStart.setHours(0, 0, 0, 0);
      }
    }
    const batchEnd = new Date(batchStart);
    batchEnd.setHours(23, 59, 59, 999);

    // Completed first (sorted by subnet), then failed ones after — each subnet
    // has at most one doc per day (upsert keyed on channelId + reportDate).
    const reports = await SubnetReport.find({
      reportDate: { $gte: batchStart, $lte: batchEnd },
      status: { $in: ["completed", "failed"] },
    })
      .sort({ status: 1, subnetNumber: 1 }) // "completed" < "failed" alphabetically
      .lean();

    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subnets/reports — all latest reports per subnet
router.get("/reports", requireAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const reports = await SubnetReport.aggregate([
      { $match: { status: "completed" } },
      { $sort: { subnetNumber: 1, generatedAt: -1 } },
      { $group: { _id: "$subnetNumber", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: { subnetNumber: 1 } },
      { $limit: parseInt(limit) },
    ]);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subnets/reports/:subnetNumber — history for one subnet
router.get("/reports/:subnetNumber", requireAuth, async (req, res) => {
  try {
    const reports = await SubnetReport.find({
      subnetNumber: parseInt(req.params.subnetNumber),
      status: "completed",
    })
      .sort({ reportDate: -1 })
      .limit(20);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subnets/leaderboard
router.get("/leaderboard", requireAuth, async (req, res) => {
  try {
    const reports = await SubnetReport.aggregate([
      { $match: { status: "completed" } },
      { $sort: { subnetNumber: 1, generatedAt: -1 } },
      { $group: { _id: "$subnetNumber", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: { "report.investabilityScore": -1 } },
      {
        $project: {
          subnetNumber: 1,
          channelName: 1,
          reportDate: 1,
          "report.subnetName": 1,
          "report.investabilityScore": 1,
          "report.scoreLabel": 1,
          "report.investabilityBreakdown": 1,
          "report.overallSentiment": 1,
          "report.oneLiner": 1,
          "report.briefDescription": 1,
          "report.messageCount": 1,
          "report.bottomLine": 1,
        },
      },
    ]);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subnets/schedule
// GET /api/subnets/schedule
router.get("/schedule", requireAuth, async (req, res) => {
  try {
    const serverId = process.env.DISCORD_GUILD_ID;
    const schedule = await SubnetSchedule.findOne();

    // ── Get REAL channel count dynamically
    const { getSortedSubnetChannels } = require("../services/subnetScheduler");
    const allSubnets = await getSortedSubnetChannels(serverId);
    const total = allSubnets.length;

    if (!schedule) {
      return res.json({
        currentIndex: 0,
        total,
        progressPercent: 0,
        subnetsPerDay: SUBNETS_PER_DAY,
        schedule: { cycleNumber: 1 },
        upcoming: allSubnets.slice(0, SUBNETS_PER_DAY).map((ch) => ({
          subnetNumber: ch.subnetNumber,
          name: ch.name,
        })),
      });
    }
    const currentIndex = schedule.currentIndex % total;
    const progressPercent =
      total > 0 ? Math.round((currentIndex / total) * 100) : 0;

    // When the manual "Run now" button becomes usable again (7 days after the
    // last manual run). null if it has never been run manually.
    const manualRunAvailableAt = schedule.lastManualRunAt
      ? new Date(
          new Date(schedule.lastManualRunAt).getTime() + MANUAL_RUN_COOLDOWN_MS,
        )
      : null;

    // Next SUBNETS_PER_DAY in rotation (the subnets the next run will target)
    const upcoming = allSubnets
      .slice(currentIndex, currentIndex + SUBNETS_PER_DAY)
      .map((ch) => ({ subnetNumber: ch.subnetNumber, name: ch.name }));

    res.json({
      currentIndex,
      total, // ← always real count from DB
      progressPercent,
      subnetsPerDay: SUBNETS_PER_DAY,
      schedule: {
        cycleNumber: schedule.cycleNumber,
      },
      isRunning: schedule.isRunning,
      lastRunDate: schedule.lastRunDate,
      isPaused: schedule.isPaused,
      pausedAt: schedule.pausedAt,
      resumeAt: schedule.resumeAt,
      pauseReason: schedule.pauseReason,
      // Manual "Run now" weekly cooldown — lets the UI disable the button and
      // tell the user when it becomes available again.
      lastManualRunAt: schedule.lastManualRunAt || null,
      manualRunAvailableAt: manualRunAvailableAt
        ? manualRunAvailableAt.toISOString()
        : null,
      manualRunLocked: manualRunAvailableAt
        ? Date.now() < manualRunAvailableAt.getTime()
        : false,
      upcoming,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subnets/pause — hold the automatic daily rotation.
// Body: { days?: number, reason?: string }
//   days   → auto-resume after N days (omit for an indefinite hold)
//   reason → optional note shown in the schedule status
// The rotation pointer is left untouched, so resuming continues from where it
// stopped. Manual runs still work while paused.
router.post("/pause", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { days, reason } = req.body || {};

    let resumeAt = null;
    if (days != null) {
      const n = Number(days);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ error: "days must be a positive number" });
      }
      resumeAt = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
    }

    const schedule = await SubnetSchedule.findOneAndUpdate(
      {},
      {
        isPaused: true,
        pausedAt: new Date(),
        resumeAt,
        pauseReason: reason || null,
      },
      { upsert: true, new: true },
    );

    res.json({
      message: resumeAt
        ? `Analysis paused — will auto-resume on ${resumeAt.toISOString()}`
        : "Analysis paused indefinitely — resume manually when ready",
      isPaused: schedule.isPaused,
      pausedAt: schedule.pausedAt,
      resumeAt: schedule.resumeAt,
      pauseReason: schedule.pauseReason,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subnets/resume — lift the pause and continue the rotation from
// where it stopped on the next scheduled (or manual) run.
router.post("/resume", requireAuth, requireAdmin, async (req, res) => {
  try {
    const schedule = await SubnetSchedule.findOneAndUpdate(
      {},
      {
        isPaused: false,
        pausedAt: null,
        resumeAt: null,
        pauseReason: null,
      },
      { upsert: true, new: true },
    );

    res.json({
      message: "Analysis resumed — the next run continues from where it stopped",
      isPaused: schedule.isPaused,
      nextSubnetNumber: schedule.nextSubnetNumber,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subnets/run — trigger manual analysis.
// Rate-limited to once every 7 days: after a manual run the button is locked
// until the next week so it can't be spammed.
router.post("/run", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { subnetNumbers } = req.body;
    const serverId = process.env.DISCORD_GUILD_ID;
    if (!serverId)
      return res.status(400).json({ error: "DISCORD_GUILD_ID not set" });

    // ── Weekly cooldown check ────────────────────────────────────────────────
    const schedule = await SubnetSchedule.findOne();
    const lastManual = schedule?.lastManualRunAt
      ? new Date(schedule.lastManualRunAt)
      : null;

    if (lastManual) {
      const availableAt = new Date(lastManual.getTime() + MANUAL_RUN_COOLDOWN_MS);
      if (Date.now() < availableAt.getTime()) {
        const msLeft = availableAt.getTime() - Date.now();
        const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
        return res.status(429).json({
          error: "manual_run_cooldown",
          message: `Manual run is limited to once per week. You can run it again in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (on ${availableAt.toISOString().split("T")[0]}).`,
          lastManualRunAt: lastManual.toISOString(),
          availableAt: availableAt.toISOString(),
        });
      }
    }

    // Record this manual run and start the cooldown window.
    await SubnetSchedule.findOneAndUpdate(
      {},
      { lastManualRunAt: new Date() },
      { upsert: true },
    );

    const availableAt = new Date(Date.now() + MANUAL_RUN_COOLDOWN_MS);
    res.json({
      message: "Analysis started",
      subnetNumbers: subnetNumbers || "next 3 in rotation",
      note: `Manual run started. This can be used again on ${availableAt.toISOString().split("T")[0]} (once per week).`,
      availableAt: availableAt.toISOString(),
    });

    const discordClient = require("../bot/index");
    runDailySubnetAnalysis(
      discordClient,
      serverId,
      subnetNumbers || null,
    ).catch((e) => console.error("Run failed:", e.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subnets/chat/:subnetNumber — ask a custom question about a subnet
router.post("/chat/:subnetNumber", requireAuth, async (req, res) => {
  try {
    const { question, days = 30 } = req.body;
    if (!question)
      return res.status(400).json({ error: "question is required" });

    const subnetNumber = parseInt(req.params.subnetNumber);

    // Find the channel for this subnet
    const serverId = process.env.DISCORD_GUILD_ID;
    const channels = await getSortedSubnetChannels(serverId);
    const channel = channels.find((c) => c.subnetNumber === subnetNumber);
    if (!channel)
      return res
        .status(404)
        .json({ error: `No channel found for subnet ${subnetNumber}` });

    // Get latest report for subnet name context
    const latestReport = await SubnetReport.findOne({
      subnetNumber,
      status: "completed",
    }).sort({ generatedAt: -1 });
    const subnetName = latestReport?.report?.subnetName || channel.name;

    // Feed month-over-month progress (if computed) into the chat so questions like
    // "what improved since last month?" answer from the comparison. No sender
    // names/timestamps are included — only the already-sanitized progress fields.
    let progressContext = "";
    const mom = latestReport?.report?.monthOverMonth;
    if (mom?.hasPrevious) {
      const lines = [];
      if (mom.summary) lines.push(`Summary: ${mom.summary}`);
      if (mom.previousScore != null && mom.currentScore != null) {
        lines.push(
          `Investability score: ${mom.previousScore} → ${mom.currentScore} (${mom.direction})`,
        );
      }
      (mom.improvements || []).forEach((im) =>
        lines.push(
          `- [${im.status}] ${im.item}${im.evidence ? ` — ${im.evidence}` : ""}`,
        ),
      );
      (mom.newProgress || []).forEach((p) => lines.push(`- New progress: ${p}`));
      (mom.regressions || []).forEach((p) => lines.push(`- Regression: ${p}`));
      progressContext = lines.join("\n");
    }

    const result = await answerSubnetQuestion(
      channel.discordId,
      subnetName,
      question,
      days,
      progressContext,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subnets/reset-lock  — run once then remove
router.get("/reset-lock", requireAuth, async (req, res) => {
  await SubnetSchedule.findOneAndUpdate({}, { isRunning: false });
  res.json({ message: "Lock released" });
});

// GET /api/subnets/system-status — permanent debug/health check
router.get("/system-status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const Channel = require("../models/Channel");
    const Message = require("../models/Message");
    const schedule = await SubnetSchedule.findOne();

    const channels = await Channel.find().sort({ name: 1 });
    const channelStats = await Promise.all(
      channels.map(async (ch) => ({
        name: ch.name,
        discordId: ch.discordId,
        scrapeEnabled: ch.scrapeEnabled,
        messageCount: await Message.countDocuments({ channelId: ch.discordId }),
      })),
    );

    const recentReports = await SubnetReport.find({ status: "completed" })
      .sort({ generatedAt: -1 })
      .limit(10)
      .select(
        "subnetNumber channelName status generatedAt report.investabilityScore",
      );

    res.json({
      schedule: {
        isRunning: schedule?.isRunning,
        currentIndex: schedule?.currentIndex,
        cycleNumber: schedule?.cycleNumber,
        lastRunDate: schedule?.lastRunDate,
      },
      channels: channelStats,
      recentReports,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subnets/reset-lock — permanent lock release
router.post("/reset-lock", requireAuth, requireAdmin, async (req, res) => {
  try {
    await SubnetSchedule.findOneAndUpdate(
      {},
      { isRunning: false },
      { upsert: true },
    );
    res.json({ message: "Lock released successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
