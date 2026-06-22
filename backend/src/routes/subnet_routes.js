const router = require("express").Router();
const { requireAuth, requireAdmin } = require("../middleware/auth");
const SubnetReport = require("../models/SubnetReport");
const SubnetSchedule = require("../models/SubnetSchedule");
const Channel = require("../models/Channel");
const { runDailySubnetAnalysis, getSortedSubnetChannels } = require("../services/subnetScheduler");
const { answerSubnetQuestion } = require("../services/subnetIntelService");

// GET /api/subnets/today
// Returns the 4 most recently generated reports (today's batch)
router.get("/today", requireAuth, async (req, res) => {
  try {
    // Get start of today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Try today's reports first
    let reports = await SubnetReport.find({
      status: "completed",
      generatedAt: { $gte: todayStart },
    })
      .sort({ generatedAt: -1 })
      .limit(4)
      .lean();

    // If none today, fall back to last 4 generated ever
    if (reports.length === 0) {
      reports = await SubnetReport.find({ status: "completed" })
        .sort({ generatedAt: -1 })
        .limit(4)
        .lean();
    }

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
    }).sort({ reportDate: -1 }).limit(20);
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
          subnetNumber: 1, channelName: 1, reportDate: 1,
          "report.subnetName": 1, "report.investabilityScore": 1,
          "report.scoreLabel": 1, "report.investabilityBreakdown": 1,
          "report.overallSentiment": 1, "report.oneLiner": 1,
          "report.briefDescription": 1, "report.messageCount": 1,
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
router.get("/schedule", requireAuth, async (req, res) => {
  try {
    const schedule = await SubnetSchedule.findOne();
    const serverId = process.env.DISCORD_GUILD_ID;
    if (!serverId) return res.json({ schedule, channels: [] });

    const channels = await getSortedSubnetChannels(serverId);
    const total = channels.length;
    const idx = schedule ? schedule.currentIndex % Math.max(total, 1) : 0;
    const upcoming = channels.slice(idx, idx + 4).map(c => ({
      subnetNumber: c.subnetNumber, name: c.name,
    }));

    res.json({
      schedule, total,
      currentIndex: idx,
      progressPercent: total > 0 ? Math.round((idx / total) * 100) : 0,
      upcoming,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subnets/run — trigger manual analysis
router.post("/run", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { subnetNumbers } = req.body;
    const serverId = process.env.DISCORD_GUILD_ID;
    if (!serverId) return res.status(400).json({ error: "DISCORD_GUILD_ID not set" });

    res.json({ message: "Analysis started", subnetNumbers: subnetNumbers || "next 4 in rotation" });

    const discordClient = require("../bot/index");
    runDailySubnetAnalysis(discordClient, serverId, subnetNumbers || null)
      .catch(e => console.error("Run failed:", e.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subnets/chat/:subnetNumber — ask a custom question about a subnet
router.post("/chat/:subnetNumber", requireAuth, async (req, res) => {
  try {
    const { question, days = 30 } = req.body;
    if (!question) return res.status(400).json({ error: "question is required" });

    const subnetNumber = parseInt(req.params.subnetNumber);

    // Find the channel for this subnet
    const serverId = process.env.DISCORD_GUILD_ID;
    const channels = await getSortedSubnetChannels(serverId);
    const channel = channels.find(c => c.subnetNumber === subnetNumber);
    if (!channel) return res.status(404).json({ error: `No channel found for subnet ${subnetNumber}` });

    // Get latest report for subnet name context
    const latestReport = await SubnetReport.findOne({
      subnetNumber, status: "completed"
    }).sort({ generatedAt: -1 });
    const subnetName = latestReport?.report?.subnetName || channel.name;

    const result = await answerSubnetQuestion(channel.discordId, subnetName, question, days);
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
    const Channel  = require("../models/Channel");
    const Message  = require("../models/Message");
    const schedule = await SubnetSchedule.findOne();

    const channels = await Channel.find().sort({ name: 1 });
    const channelStats = await Promise.all(
      channels.map(async ch => ({
        name:          ch.name,
        discordId:     ch.discordId,
        scrapeEnabled: ch.scrapeEnabled,
        messageCount:  await Message.countDocuments({ channelId: ch.discordId }),
      }))
    );

    const recentReports = await SubnetReport.find({ status: "completed" })
      .sort({ generatedAt: -1 })
      .limit(10)
      .select("subnetNumber channelName status generatedAt report.investabilityScore");

    res.json({
      schedule: {
        isRunning:    schedule?.isRunning,
        currentIndex: schedule?.currentIndex,
        cycleNumber:  schedule?.cycleNumber,
        lastRunDate:  schedule?.lastRunDate,
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
      { upsert: true }
    );
    res.json({ message: "Lock released successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;