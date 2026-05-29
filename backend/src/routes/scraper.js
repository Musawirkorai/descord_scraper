const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { backfillChannel, backfillServer } = require('../services/scraperService');
const { fetchRepoIssues, fetchRepoComments } = require('../services/githubScraper');
const logger = require('../utils/logger');

// Active jobs tracker
const activeJobs = new Map();

// POST /api/scraper/backfill/channel
router.post('/backfill/channel', requireAuth, requireAdmin, async (req, res) => {
  const { channelId, before, after, limit } = req.body;
  if (!channelId) return res.status(400).json({ error: 'channelId required' });

  const jobId = `backfill_${channelId}_${Date.now()}`;
  activeJobs.set(jobId, { status: 'running', channelId, startedAt: new Date() });

  res.json({ jobId, message: 'Backfill started' });

  // Run async
  const discordClient = require('../bot/index');
  backfillChannel(discordClient, channelId, { before, after, limit })
    .then(count => {
      activeJobs.set(jobId, { status: 'completed', channelId, count, completedAt: new Date() });
      logger.info(`Job ${jobId} completed: ${count} messages`);
    })
    .catch(err => {
      activeJobs.set(jobId, { status: 'failed', channelId, error: err.message });
      logger.error(`Job ${jobId} failed:`, err);
    });
});

// POST /api/scraper/backfill/server
router.post('/backfill/server', requireAuth, requireAdmin, async (req, res) => {
  const { serverId } = req.body;
  if (!serverId) return res.status(400).json({ error: 'serverId required' });

  const jobId = `backfill_server_${serverId}_${Date.now()}`;
  activeJobs.set(jobId, { status: 'running', serverId, startedAt: new Date() });

  res.json({ jobId, message: 'Server backfill started' });

  const discordClient = require('../bot/index');
  backfillServer(discordClient, serverId)
    .then(results => activeJobs.set(jobId, { status: 'completed', serverId, results }))
    .catch(err => activeJobs.set(jobId, { status: 'failed', serverId, error: err.message }));
});

// POST /api/scraper/github
router.post('/github', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { owner, repo, includeComments } = req.body;
    if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });

    const issues = await fetchRepoIssues(owner, repo);
    let comments = [];
    if (includeComments) comments = await fetchRepoComments(owner, repo);

    res.json({ saved: issues.length + comments.length, issues: issues.length, comments: comments.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/scraper/jobs
router.get('/jobs', requireAuth, (req, res) => {
  res.json([...activeJobs.entries()].map(([id, job]) => ({ id, ...job })));
});

// GET /api/scraper/jobs/:id
router.get('/jobs/:id', requireAuth, (req, res) => {
  const job = activeJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ id: req.params.id, ...job });
});

module.exports = router;
