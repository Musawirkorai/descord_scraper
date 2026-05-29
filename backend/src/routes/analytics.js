const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { generateDailySummary, analyzeTrends, analyzeSentiment, customAnalysis } = require('../services/aiService');
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

module.exports = router;
