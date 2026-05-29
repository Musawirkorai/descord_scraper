const axios = require('axios');
const { saveExternalMessage } = require('./messageService');
const logger = require('../utils/logger');

const GH_API = 'https://api.github.com';

async function fetchRepoIssues(owner, repo, options = {}) {
  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const params = { state: 'all', per_page: 100, page: options.page || 1, ...options };
  const res = await axios.get(`${GH_API}/repos/${owner}/${repo}/issues`, { headers, params });

  const saved = [];
  for (const issue of res.data) {
    const msg = await saveExternalMessage({
      externalId: `gh_issue_${issue.id}`,
      serverId: `github_${owner}`,
      channelId: `${owner}/${repo}`,
      authorId: issue.user.login,
      authorUsername: issue.user.login,
      content: `[#${issue.number}] ${issue.title}\n\n${issue.body || ''}`,
      discordCreatedAt: new Date(issue.created_at),
      source: 'github',
      metadata: { type: 'issue', url: issue.html_url, labels: issue.labels.map(l => l.name), state: issue.state },
    });
    saved.push(msg);
  }

  logger.info(`GitHub: saved ${saved.length} issues from ${owner}/${repo}`);
  return saved;
}

async function fetchRepoComments(owner, repo) {
  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await axios.get(`${GH_API}/repos/${owner}/${repo}/issues/comments`, { headers, params: { per_page: 100 } });

  const saved = [];
  for (const comment of res.data) {
    const msg = await saveExternalMessage({
      externalId: `gh_comment_${comment.id}`,
      serverId: `github_${owner}`,
      channelId: `${owner}/${repo}`,
      authorId: comment.user.login,
      authorUsername: comment.user.login,
      content: comment.body || '',
      discordCreatedAt: new Date(comment.created_at),
      source: 'github',
      metadata: { type: 'comment', url: comment.html_url },
    });
    saved.push(msg);
  }

  return saved;
}

module.exports = { fetchRepoIssues, fetchRepoComments };
