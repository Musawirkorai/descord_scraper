const router = require('express').Router();
const Channel = require('../models/Channel');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/channels?serverId=
router.get('/', requireAuth, async (req, res) => {
  try {
    const { serverId, scrapeEnabled } = req.query;
    const filter = {};
    if (serverId) filter.serverId = serverId;
    if (scrapeEnabled !== undefined) filter.scrapeEnabled = scrapeEnabled === 'true';
    const channels = await Channel.find(filter).sort({ name: 1 });
    res.json(channels);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/channels/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const channel = await Channel.findOne({ discordId: req.params.id });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json(channel);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/channels/:id - toggle scraping
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { scrapeEnabled } = req.body;
    const channel = await Channel.findOneAndUpdate(
      { discordId: req.params.id },
      { scrapeEnabled },
      { new: true }
    );
    res.json(channel);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
