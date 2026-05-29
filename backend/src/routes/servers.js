const router = require('express').Router();
const Server = require('../models/Server');
const Channel = require('../models/Channel');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/servers
router.get('/', requireAuth, async (req, res) => {
  try {
    const servers = await Server.find().sort({ name: 1 });
    res.json(servers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/servers/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const server = await Server.findOne({ discordId: req.params.id });
    if (!server) return res.status(404).json({ error: 'Server not found' });
    const channelCount = await Channel.countDocuments({ serverId: req.params.id });
    res.json({ ...server.toObject(), channelCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/servers/:id
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { scrapeEnabled } = req.body;
    const server = await Server.findOneAndUpdate(
      { discordId: req.params.id },
      { scrapeEnabled },
      { new: true }
    );
    res.json(server);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
