const router = require('express').Router();
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');

// GET /api/messages?serverId&channelId&keyword&from&to&source&page&limit
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      serverId, channelId, keyword, source,
      from, to, sentiment,
      page = 1, limit = 50,
      sort = '-discordCreatedAt',
    } = req.query;

    const filter = {};
    if (serverId) filter.serverId = serverId;
    if (channelId) filter.channelId = channelId;
    if (source) filter.source = source;
    if (sentiment) filter.sentiment = sentiment;
    if (from || to) {
      filter.discordCreatedAt = {};
      if (from) filter.discordCreatedAt.$gte = new Date(from);
      if (to) filter.discordCreatedAt.$lte = new Date(to);
    }
    if (keyword) {
      filter.$text = { $search: keyword };
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [messages, total] = await Promise.all([
      Message.find(filter).sort(sort).skip(skip).limit(limitNum),
      Message.countDocuments(filter),
    ]);

    res.json({
      messages,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/messages/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { serverId, channelId, from, to } = req.query;
    const match = {};
    if (serverId) match.serverId = serverId;
    if (channelId) match.channelId = channelId;
    if (from || to) {
      match.discordCreatedAt = {};
      if (from) match.discordCreatedAt.$gte = new Date(from);
      if (to) match.discordCreatedAt.$lte = new Date(to);
    }

    const [bySource, byDay] = await Promise.all([
      Message.aggregate([{ $match: match }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
      Message.aggregate([
        { $match: match },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$discordCreatedAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),
    ]);

    res.json({ bySource, byDay });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/messages/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const msg = await Message.findOne({ discordId: req.params.id });
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    res.json(msg);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
