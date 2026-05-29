const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// POST /api/auth/register (admin only via env flag)
router.post('/register', async (req, res) => {
  try {
    if (process.env.ALLOW_REGISTRATION !== 'true') return res.status(403).json({ error: 'Registration disabled' });
    const { username, email, password, role } = req.body;
    const user = await User.create({ username, email, passwordHash: password, role: role || 'viewer' });
    res.status(201).json({ id: user._id, username: user.username, email: user.email, role: user.role });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => res.json(req.user));

module.exports = router;
