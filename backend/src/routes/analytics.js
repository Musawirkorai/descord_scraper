const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { generateDailySummary, analyzeTrends, analyzeSentiment, customAnalysis, analyzeMultipleChannels } = require('../services/aiService');
const AiResult = require('../models/AiResult');

// POST /api/analytics/summary
router.post('/summary', requireAuth, async (req, res) => {
  try {
    const { scope, targetId, targetName, date } = req.body;
    const result = await generateDailySummary(scope, targetId, targetName, date ? new Date(date) : new Date());
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/analytics/trends
router.post('/trends', requireAuth, async (req, res) => {
  try {
    const { scope, targetId, targetName, days } = req.body;
    const result = await analyzeTrends(scope, targetId, targetName, days || 7);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/analytics/sentiment
router.post('/sentiment', requireAuth, async (req, res) => {
  try {
    const { scope, targetId, from, to } = req.body;
    const result = await analyzeSentiment(scope, targetId, new Date(from), new Date(to));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/analytics/ask
router.post('/ask', requireAuth, async (req, res) => {
  try {
    const { scope, targetId, question, days } = req.body;
    const result = await customAnalysis(scope, targetId, question, days || 7);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/history?scope&targetId&type
router.get('/history', requireAuth, async (req, res) => {
  try {
    const { scope, targetId, type, limit = 20 } = req.query;
    const filter = {};
    if (scope) filter.scope = scope;
    if (targetId) filter.targetId = targetId;
    if (type) filter.type = type;
    const results = await AiResult.find(filter).sort({ generatedAt: -1 }).limit(parseInt(limit));
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Added this route to analytics.js (after the existing /ask route, before module.exports)
// Also update the require at the top to include analyzeMultipleChannels:
// const { generateDailySummary, analyzeTrends, analyzeSentiment, customAnalysis, analyzeMultipleChannels } = require('../services/aiService');

// POST /api/analytics/multi
// Body: { targets: [{ scope, targetId, targetName }], analysisType: 'summary'|'trends'|'ask', days: number, question: string }
router.post('/multi', requireAuth, async (req, res) => {
  try {
    const { targets, analysisType = 'summary', days = 7, question = '' } = req.body;
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: 'targets array is required' });
    }
    if (targets.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 channels per request' });
    }
    const result = await analyzeMultipleChannels(targets, analysisType, days, question);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add these two routes to routes/analytics.js
// They power the full history page with timeline + topic tracking

// GET /api/analytics/history/timeline
// Groups analyses by month so frontend can show month-by-month progression
router.get("/history/timeline", requireAuth, async (req, res) => {
  try {
    const { targetId, scope, limit = 100 } = req.query;
    const filter = {};
    if (scope) filter.scope = scope;
    if (targetId) filter.targetId = targetId;

    const results = await AiResult.find(filter)
      .sort({ generatedAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Group by month
    const byMonth = {};
    for (const r of results) {
      const month = new Date(r.generatedAt).toISOString().substring(0, 7); // "2025-06"
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(r);
    }

    // Build timeline array sorted newest first
    const timeline = Object.entries(byMonth)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, items]) => ({
        month,
        label: new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        count: items.length,
        items: items.map(r => ({
          _id: r._id,
          type: r.type,
          targetName: r.targetName,
          generatedAt: r.generatedAt,
          sentiment: r.result?.sentiment || r.result?.overallSentiment || null,
          keyTopics: r.result?.keyTopics || [],
          trendingTopics: (r.result?.trendingTopics || []).map(t => t.topic || t),
          emergingSignals: r.result?.emergingSignals || [],
          highlights: r.result?.highlights || [],
          summary: r.result?.summary || null,
          messageCount: r.result?.messageCount || 0,
          channels: r.result?.channels || [],
        }))
      }));

    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/history/topics
// Extracts all unique topics across all analyses — for topic tracking over time
router.get("/history/topics", requireAuth, async (req, res) => {
  try {
    const { targetId, scope } = req.query;
    const filter = {};
    if (scope) filter.scope = scope;
    if (targetId) filter.targetId = targetId;

    const results = await AiResult.find(filter)
      .sort({ generatedAt: 1 })
      .lean();

    // Build topic frequency map over time
    const topicMap = {}; // topic -> [{ month, count }]

    for (const r of results) {
      const month = new Date(r.generatedAt).toISOString().substring(0, 7);
      const topics = [
        ...(r.result?.keyTopics || []),
        ...(r.result?.trendingTopics || []).map(t => t.topic || t),
        ...(r.result?.crossChannelThemes || []),
      ].filter(Boolean);

      for (const topic of topics) {
        const key = topic.toLowerCase().trim();
        if (!topicMap[key]) topicMap[key] = { label: topic, months: {} };
        topicMap[key].months[month] = (topicMap[key].months[month] || 0) + 1;
      }
    }

    // Convert to array sorted by total frequency
    const topics = Object.values(topicMap)
      .map(t => ({
        label: t.label,
        totalCount: Object.values(t.months).reduce((a, b) => a + b, 0),
        monthlyData: Object.entries(t.months)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, count]) => ({ month, count })),
      }))
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 50); // top 50 topics

    res.json(topics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
