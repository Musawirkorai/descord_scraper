/**
 * GitHub Scraper
 * ──────────────
 * Pulls a repo's activity (issues, PRs, comments, commits) and stores each item
 * as a Message document with source:'github', so the same analysis pipeline that
 * reads Discord messages can read GitHub activity too.
 *
 * Storage mapping (mirrors the Discord shape):
 *   channelId = "owner/repo"   serverId = "github_owner"   source = "github"
 *
 */

const axios = require("axios");
const { saveExternalMessage } = require("./messageService");
const logger = require("../utils/logger");

const GH_API = "https://api.github.com";
const PER_PAGE = 100; // GitHub max page size
const MAX_PAGES = 20; // hard safety cap (≤ 2000 items) per endpoint
const PAGE_DELAY_MS = 350; // gap between pages (primary rate-limit safety)
const DEFAULT_LOOKBACK_DAYS = 30; // only look at the recent activity window

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Warn only once if no token is configured (60 req/hr vs 5000 with a token)
let warnedNoToken = false;
function authHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  } else if (!warnedNoToken) {
    warnedNoToken = true;
    logger.warn(
      "GITHUB_TOKEN not set — GitHub API is limited to 60 requests/hour. Set a token in .env.",
    );
  }
  return headers;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core GET with rate-limit awareness + retries.
// Handles primary (x-ratelimit-remaining) and secondary (403/429 + Retry-After)
// rate limits, and retries transient 5xx. Returns the axios response.
// ─────────────────────────────────────────────────────────────────────────────
async function ghGet(path, params = {}, attempt = 1) {
  const MAX_ATTEMPTS = 4;
  const res = await axios.get(`${GH_API}${path}`, {
    headers: authHeaders(),
    params,
    timeout: 20000,
    validateStatus: () => true, // we handle status codes ourselves
  });

  // Success — proactively back off if we're about to exhaust the quota.
  if (res.status >= 200 && res.status < 300) {
    const remaining = Number(res.headers["x-ratelimit-remaining"]);
    const reset = Number(res.headers["x-ratelimit-reset"]);
    if (remaining === 0 && reset) {
      const waitMs = Math.max(0, reset * 1000 - Date.now()) + 1000;
      logger.warn(
        `GitHub rate limit reached — pausing ${Math.round(waitMs / 1000)}s until reset.`,
      );
      await sleep(waitMs);
    }
    return res;
  }

  // Rate limited (primary reset via 403, or secondary via 403/429).
  if (res.status === 403 || res.status === 429) {
    if (attempt >= MAX_ATTEMPTS) {
      throw new Error(`GitHub rate limit — gave up after ${attempt} attempts (${path})`);
    }
    const retryAfter = Number(res.headers["retry-after"]);
    const reset = Number(res.headers["x-ratelimit-reset"]);
    let waitMs;
    if (retryAfter) waitMs = retryAfter * 1000;
    else if (reset) waitMs = Math.max(0, reset * 1000 - Date.now()) + 1000;
    else waitMs = 2 ** attempt * 1000; // exponential backoff fallback
    logger.warn(
      `GitHub ${res.status} on ${path} — backing off ${Math.round(waitMs / 1000)}s (attempt ${attempt}).`,
    );
    await sleep(waitMs);
    return ghGet(path, params, attempt + 1);
  }

  // Transient server errors — retry with backoff.
  if (res.status >= 500 && attempt < MAX_ATTEMPTS) {
    const waitMs = 2 ** attempt * 1000;
    logger.warn(`GitHub ${res.status} on ${path} — retrying in ${waitMs / 1000}s.`);
    await sleep(waitMs);
    return ghGet(path, params, attempt + 1);
  }

  // Anything else (404, 401, etc.) — surface it.
  const msg = res.data?.message || res.statusText;
  const err = new Error(`GitHub ${res.status} on ${path}: ${msg}`);
  err.status = res.status;
  throw err;
}

// ── Parse "owner/repo" (or a full github URL) into { owner, repo }
function parseRepo(input) {
  if (!input) return null;
  const clean = String(input)
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/$/, "");
  const [owner, repo] = clean.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}

const isBot = (user) => !user || user.type === "Bot";

// ─────────────────────────────────────────────────────────────────────────────
// ISSUES + PULL REQUESTS
// The /issues endpoint returns PRs too (they carry a `pull_request` field).
// We keep both but tag the kind, and skip bot-authored items.
// `since` (ISO) limits to items updated after that time.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchRepoIssues(owner, repo, options = {}) {
  const { since = null, includePRs = true, maxPages = MAX_PAGES } = options;
  const saved = [];

  for (let page = 1; page <= maxPages; page++) {
    const params = { state: "all", per_page: PER_PAGE, page, sort: "updated", direction: "desc" };
    if (since) params.since = since;

    const res = await ghGet(`/repos/${owner}/${repo}/issues`, params);
    const items = res.data || [];
    if (items.length === 0) break;

    for (const issue of items) {
      const isPR = Boolean(issue.pull_request);
      if (isPR && !includePRs) continue;
      if (isBot(issue.user)) continue;

      const kind = isPR ? "PR" : "ISSUE";
      const labels = (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name));
      const header =
        `[${kind} #${issue.number} · ${issue.state}` +
        (labels.length ? ` · ${labels.join(", ")}` : "") +
        `]`;
      const content = `${header} ${issue.title}\n\n${issue.body || ""}`.trim();

      saved.push(
        await saveExternalMessage({
          externalId: `gh_${isPR ? "pr" : "issue"}_${issue.id}`,
          serverId: `github_${owner}`,
          channelId: `${owner}/${repo}`,
          content,
          discordCreatedAt: new Date(issue.created_at),
          source: "github",
        }),
      );
    }

    if (items.length < PER_PAGE) break; // last page
    await sleep(PAGE_DELAY_MS);
  }

  logger.info(`GitHub: saved ${saved.length} issues/PRs from ${owner}/${repo}`);
  return saved;
}

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE COMMENTS — the actual discussion. Paginated, bot-filtered, windowed.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchRepoComments(owner, repo, options = {}) {
  const { since = null, maxPages = MAX_PAGES } = options;
  const saved = [];

  for (let page = 1; page <= maxPages; page++) {
    const params = { per_page: PER_PAGE, page, sort: "created", direction: "desc" };
    if (since) params.since = since;

    const res = await ghGet(`/repos/${owner}/${repo}/issues/comments`, params);
    const items = res.data || [];
    if (items.length === 0) break;

    for (const comment of items) {
      if (isBot(comment.user)) continue;
      const body = (comment.body || "").trim();
      if (!body) continue;

      saved.push(
        await saveExternalMessage({
          externalId: `gh_comment_${comment.id}`,
          serverId: `github_${owner}`,
          channelId: `${owner}/${repo}`,
          content: body,
          discordCreatedAt: new Date(comment.created_at),
          source: "github",
        }),
      );
    }

    if (items.length < PER_PAGE) break;
    await sleep(PAGE_DELAY_MS);
  }

  logger.info(`GitHub: saved ${saved.length} comments from ${owner}/${repo}`);
  return saved;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMITS — development velocity signal. Merge commits are skipped as noise.
// `since` (ISO) limits to commits after that time.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchRepoCommits(owner, repo, options = {}) {
  const { since = null, maxPages = MAX_PAGES } = options;
  const saved = [];

  for (let page = 1; page <= maxPages; page++) {
    const params = { per_page: PER_PAGE, page };
    if (since) params.since = since;

    let res;
    try {
      res = await ghGet(`/repos/${owner}/${repo}/commits`, params);
    } catch (e) {
      // Empty repos return 409 Conflict on the commits endpoint — treat as none.
      if (e.status === 409) break;
      throw e;
    }
    const items = res.data || [];
    if (items.length === 0) break;

    for (const c of items) {
      const message = c.commit?.message || "";
      if (/^merge\b/i.test(message)) continue; // skip merge-commit noise
      const date = c.commit?.author?.date || c.commit?.committer?.date;

      saved.push(
        await saveExternalMessage({
          externalId: `gh_commit_${c.sha}`,
          serverId: `github_${owner}`,
          channelId: `${owner}/${repo}`,
          content: `[COMMIT ${c.sha.slice(0, 7)}] ${message.split("\n")[0]}`,
          discordCreatedAt: new Date(date),
          source: "github",
        }),
      );
    }

    if (items.length < PER_PAGE) break;
    await sleep(PAGE_DELAY_MS);
  }

  logger.info(`GitHub: saved ${saved.length} commits from ${owner}/${repo}`);
  return saved;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPO METADATA — cheap, high-signal stats for the report header (stars, forks,
// open issues, language, last push, latest release). Not stored as messages;
// returned for the analyzer/report to use. Returns null if the repo is missing.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchRepoMeta(owner, repo) {
  let data;
  try {
    ({ data } = await ghGet(`/repos/${owner}/${repo}`));
  } catch (e) {
    if (e.status === 404) {
      logger.warn(`GitHub: repo ${owner}/${repo} not found (404).`);
      return null;
    }
    throw e;
  }

  // Latest release is optional — many repos have none.
  let latestRelease = null;
  try {
    const rel = await ghGet(`/repos/${owner}/${repo}/releases/latest`);
    latestRelease = {
      tag: rel.data.tag_name,
      name: rel.data.name,
      publishedAt: rel.data.published_at,
    };
  } catch (e) {
    if (e.status !== 404) logger.warn(`GitHub: releases lookup failed for ${owner}/${repo}: ${e.message}`);
  }

  return {
    fullName: data.full_name,
    description: data.description,
    stars: data.stargazers_count,
    forks: data.forks_count,
    watchers: data.subscribers_count,
    openIssues: data.open_issues_count, // includes open PRs
    language: data.language,
    topics: data.topics || [],
    archived: data.archived,
    pushedAt: data.pushed_at,
    createdAt: data.created_at,
    url: data.html_url,
    latestRelease,
    
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR — scrape a full repo's recent activity in one call.
// This is what the scheduler uses per subnet.
//   scrapeRepo("owner/repo", { sinceDays, includeCommits, includePRs })
// ─────────────────────────────────────────────────────────────────────────────
async function scrapeRepo(repoInput, options = {}) {
  const parsed = typeof repoInput === "string" ? parseRepo(repoInput) : repoInput;
  if (!parsed) throw new Error(`Invalid repo reference: ${JSON.stringify(repoInput)}`);
  const { owner, repo } = parsed;

  const {
    sinceDays = DEFAULT_LOOKBACK_DAYS,
    includeCommits = true,
    includePRs = true,
    maxPages = MAX_PAGES,
  } = options;

  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  logger.info(`GitHub: scraping ${owner}/${repo} (since ${since.split("T")[0]})`);

  const meta = await fetchRepoMeta(owner, repo);
  if (!meta) {
    return { owner, repo, meta: null, counts: { issues: 0, comments: 0, commits: 0 }, saved: 0 };
  }
  if (meta.archived) logger.info(`GitHub: ${owner}/${repo} is archived — scraping anyway.`);

  const issues = await fetchRepoIssues(owner, repo, { since, includePRs, maxPages });
  await sleep(PAGE_DELAY_MS);
  const comments = await fetchRepoComments(owner, repo, { since, maxPages });
  let commits = [];
  if (includeCommits) {
    await sleep(PAGE_DELAY_MS);
    commits = await fetchRepoCommits(owner, repo, { since, maxPages });
  }

  const counts = {
    issues: issues.length,
    comments: comments.length,
    commits: commits.length,
  };
  const total = counts.issues + counts.comments + counts.commits;
  logger.info(
    `GitHub: ${owner}/${repo} done — ${total} items (${counts.issues} issues/PRs, ${counts.comments} comments, ${counts.commits} commits)`,
  );

  return { owner, repo, channelId: `${owner}/${repo}`, meta, counts, saved: total };
}

module.exports = {
  scrapeRepo,
  fetchRepoIssues,
  fetchRepoComments,
  fetchRepoCommits,
  fetchRepoMeta,
  parseRepo,
};
