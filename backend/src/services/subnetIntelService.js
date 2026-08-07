const Groq = require("groq-sdk");
const Message = require("../models/Message");
const SubnetConfig = require("../models/SubnetConfig");
const SubnetReport = require("../models/SubnetReport");
const { getSubnetMeta } = require("../utils/subnetMeta");
const { fetchRepoMeta, parseRepo } = require("./githubScraper");
const logger = require("../utils/logger");

const openai = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

const SAMPLE_THRESHOLD = 500;
const SAMPLE_SIZE = 300;

// Minimum usable (post-cleaning) messages needed to run the Discord analysis at
// all. Deliberately 1: a single real message is still worth analyzing, and when
// there are none we fall through to a GitHub-only report rather than skipping
// the subnet entirely.
const MIN_DISCORD_MESSAGES = 1;

// Below this, the chat sample is too thin to draw confident conclusions from, so
// the prompts are told to stay conservative and the report is flagged low-volume.
const LOW_VOLUME_THRESHOLD = 15;

// ── clean Discord noise from message content
function cleanContent(content) {
  if (!content) return "";
  let t = content;
  t = t.replace(
    /^[^\n—]{1,60}—\s*(Yesterday at\s*)?\d{1,2}:\d{2}\s*(AM|PM)?\s*$/gim,
    "",
  );
  t = t.replace(
    /[A-Za-z0-9_.\- ]{1,40}—\s*(Yesterday at\s*)?\d{1,2}:\d{2}\s*(AM|PM)?\s*/g,
    "",
  );
  t = t.replace(
    /@[A-Za-z0-9_.\- ]{1,40}(\s*[\[【][^\]】]{0,30}[\]】])*(\s+SN\d+)?/g,
    "",
  );
  t = t.replace(/Role icon,\s*[^\n]*/gi, "");
  t = t.replace(/[\[【][τА-Яא-תa-zA-Z,\s.ף]+[\]】]/g, "");
  t = t.replace(/https?:\/\/\S+/g, "");
  t = t
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t;
}

// ── smart fetch: full for small channels, stratified random for large
async function fetchChannelMessages(channelId, days = 30) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const query = { channelId, discordCreatedAt: { $gte: from, $lte: to } };
  const total = await Message.countDocuments(query);

  let messages;
  let samplingMethod;

  if (total <= SAMPLE_THRESHOLD) {
    samplingMethod = "full";
    messages = await Message.find(query)
      .sort({ discordCreatedAt: 1 })
      .limit(800)
      .select("content discordCreatedAt extractedText");
  } else {
    samplingMethod = "stratified_random";
    const perDay = Math.ceil(SAMPLE_SIZE / days);
    const buckets = [];

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(from);
      dayStart.setDate(dayStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      buckets.push(
        Message.aggregate([
          {
            $match: {
              channelId,
              discordCreatedAt: { $gte: dayStart, $lt: dayEnd },
            },
          },
          { $sample: { size: perDay } },
          { $project: { content: 1, discordCreatedAt: 1, extractedText: 1 } },
        ]),
      );
    }

    const results = await Promise.all(buckets);
    messages = results
      .flat()
      .sort(
        (a, b) => new Date(a.discordCreatedAt) - new Date(b.discordCreatedAt),
      );
  }

  logger.info(
    `Channel ${channelId}: ${total} total → ${messages.length} used (${samplingMethod})`,
  );

  // Keep anything with real content after cleaning. The threshold is low on
  // purpose — short messages ("it's down", "fixed?") are still signal, and in a
  // quiet channel they may be all there is.
  const cleaned = messages
    .map((m) => {
      let text = cleanContent(m.content);
      if (m.extractedText)
        text += `\n[File]: ${m.extractedText.substring(0, 400)}`;
      return text.trim();
    })
    .filter((t) => t.length > 2);

  const formatted = cleaned
    .map((t, i) => `${i + 1}. ${t.substring(0, 600)}`)
    .join("\n");

  logger.info(
    `Formatted text: ${formatted.length} chars from ${cleaned.length} usable message(s)`,
  );

  // `usable` = messages that survived cleaning. This — not the raw fetched count —
  // is what decides whether there is anything to analyze.
  return {
    text: formatted,
    total,
    sampled: messages.length,
    usable: cleaned.length,
    samplingMethod,
  };
}

// ── TOPICS ANALYSIS — exhaustive, no merging
async function analyzeTopics(
  channelName,
  subnetNumber,
  msgText,
  usable,
  total,
  lowVolume = false,
) {
  const samplingNote =
    total > SAMPLE_THRESHOLD
      ? `(messages randomly sampled from the channel using stratified daily sampling)`
      : `(all available messages analyzed)`;

  // With a handful of messages there is real signal but no basis for sweeping
  // conclusions — say what is there and nothing more.
  const lowVolumeNote = lowVolume
    ? `
⚠️ LOW MESSAGE VOLUME — this channel was very quiet in this period. Special rules:
- Analyze EXACTLY what the few messages say — even a single message is worth reporting
- Do NOT extrapolate, infer, or pad the report to make it look fuller
- It is CORRECT to return only 1 or 2 topics here — do not invent more
- Leave emergingSignals, userIssues, openQuestions, developmentsToWatch as empty arrays if the messages do not support them
- In sentimentDetail, state plainly that the channel had very little activity this period
`
    : "";

  const prompt = `You are a HIGH-ACCURACY CHAT ANALYSIS SYSTEM analyzing a Bittensor subnet Discord channel.

Channel: ${channelName} — Subnet ${subnetNumber}
Messages analyzed: ${samplingNote}
${lowVolumeNote}
CRITICAL RULES — READ CAREFULLY:
- You MUST list EVERY distinct topic discussed — including minor ones mentioned only once or twice
- You MUST NOT merge separate topics into one broad category
- Each technical issue, bug report, feature request, debate, announcement is its OWN topic
- If 8 different things were discussed, list 8 topics — not 3 merged ones
- Keep topic titles close to the exact wording used in the chat
- Do NOT skip anything — missing a topic is a failure
- NEVER invent a topic that is not in the messages below
- No usernames in output

MESSAGES:
${msgText}

Return ONLY valid JSON, no markdown:
{
  "subnetName": "official name of this subnet inferred from context",
  "briefDescription": "2-3 sentence description of what this subnet does based on the discussion",
  "oneLiner": "one sentence capturing the core purpose of this subnet",
  "overallSentiment": "positive|negative|neutral|mixed",
  "sentimentDetail": "1-2 sentences explaining what drives the sentiment based on actual messages",
  "mainTopics": [
    {
      "title": "Exact topic name — close to how it was discussed",
      "description": "1-2 sentence overview of this specific topic",
      "bulletPoints": [
        "specific detail or point from the actual discussion",
        "another specific detail from the actual discussion",
        "another specific detail from the actual discussion"
      ]
    }
  ],
  "emergingSignals": [
    {
      "signal": "signal name",
      "description": "what exactly was discussed",
      "evidence": "short direct reference from chat — under 15 words",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],
  "userIssues": [
    "specific problem explicitly mentioned in the messages"
  ],
  "openQuestions": [
    "unresolved question or debate explicitly raised in the messages"
  ],
  "developmentsToWatch": [
    "specific future development mentioned or implied that would change the subnet trajectory"
  ]
}`;

  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 4000,
  });

  const raw = res.choices[0].message.content.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    logger.error(`Topics JSON parse failed: ${e.message}`);
    logger.error(`Raw response (first 500): ${raw.substring(0, 500)}`);
    throw new Error(`Topics analysis JSON parse failed: ${e.message}`);
  }

  logger.info(`Topics extracted: ${parsed.mainTopics?.length || 0} topics`);
  return parsed;
}

// ── INVESTABILITY ANALYSIS
async function analyzeInvestability(
  channelName,
  subnetNumber,
  msgText,
  topicsResult,
  lowVolume = false,
) {
  const topicsSummary = (topicsResult.mainTopics || [])
    .map((t, i) => `${i + 1}. ${t.title}: ${t.description}`)
    .join("\n");

  const prompt = `You are a professional Bittensor subnet investment analyst.

Channel: ${channelName} — Subnet ${subnetNumber}
Subnet: ${topicsResult.subnetName || "Unknown"}

All topics discussed in this channel:
${topicsSummary}

Message sample (for evidence):
${msgText.substring(0, 4000)}

HARD RULES:
- Base analysis ONLY on what is in the messages
- NEVER invent revenue, clients, partnerships, or features not explicitly mentioned
- Be honest about weaknesses — do not inflate scores
- Score each breakdown dimension independently and accurately
- No usernames in output
- raiseTo9 MUST contain at least 5 distinct, specific bullet points — never fewer${
    lowVolume
      ? `
- ⚠️ VERY FEW MESSAGES were available this period. Do NOT treat the thin sample as
  evidence of failure, and do NOT invent strengths to compensate. Score conservatively
  toward the middle (Hold), explicitly name "insufficient community discussion this
  period" as a concern, and state in bottomLine that the community signal is limited.
  raiseTo9 items may include increasing community engagement/visibility.`
      : ""
  }

Evaluate the investability of this subnet strictly from the community discussion.

Return ONLY valid JSON, no markdown:
{
  "investabilityScore": 7.5,
  "scoreLabel": "Strong Buy|Buy|Hold|Caution|Avoid",
  "investabilityBreakdown": {
    "technology": 7.0,
    "teamExecution": 8.0,
    "commercialPotential": 6.5,
    "economicMaturity": 6.0,
    "decentralization": 7.0
  },
  "positives": [
    {
      "category": "Short label e.g. Active Development Team",
      "score": 8.5,
      "detail": "2-3 sentences grounded in specific things discussed in the channel"
    }
  ],
  "concerns": [
    {
      "category": "Short label e.g. Validator Scoring Issues",
      "score": 5.0,
      "detail": "2-3 sentences grounded in specific things discussed in the channel"
    }
  ],
  "whatImpresses": "2-3 sentences on what stands out most positively from the discussion",
  "raiseTo9": [
    "specific thing that must happen in the next month to push this rating higher",
    "another specific milestone or fix needed within the next month",
    "another concrete development or improvement needed",
    "another specific action or announcement that would increase confidence",
    "another measurable outcome that would justify a higher rating"
  ],
  "lowerRating": "What specific failure or development would lower the rating significantly",
  "comparisonContext": "1-2 sentences placing this subnet vs typical Bittensor subnets",
  "bottomLine": "2-3 sentence investment summary — who should consider this and why"
}

scoreLabel rules: 9-10 = Strong Buy, 7-8.9 = Buy, 5-6.9 = Hold, 3-4.9 = Caution, 1-2.9 = Avoid`;

  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 3000,
  });

  const raw = res.choices[0].message.content.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    logger.error(`Investability JSON parse failed: ${e.message}`);
    throw new Error(`Investability analysis JSON parse failed: ${e.message}`);
  }

  // Safety net: ensure raiseTo9 is always an array with at least 1 item
  if (!Array.isArray(parsed.raiseTo9)) {
    parsed.raiseTo9 = parsed.raiseTo9
      ? [parsed.raiseTo9]
      : ["No specific improvements identified from the discussion."];
  }

  return parsed;
}

// ── MONTH-OVER-MONTH — compare this period against the previous report.
// Judges whether last period's "raiseTo9" goals were actually delivered, using
// ONLY this period's messages (usernames/timestamps already stripped upstream).
async function analyzeMonthOverMonth(
  channelName,
  subnetNumber,
  msgText,
  currentInvest,
  previousReport,
) {
  const prev = previousReport?.report || {};
  const prevGoals = Array.isArray(prev.raiseTo9) ? prev.raiseTo9 : [];
  const prevScore = prev.investabilityScore ?? null;
  const currentScore = currentInvest.investabilityScore ?? null;
  const prevDate = previousReport?.reportDate
    ? new Date(previousReport.reportDate).toISOString().split("T")[0]
    : null;

  // Nothing meaningful to compare against
  if (!prevGoals.length && prevScore == null) return null;

  const goalsList = prevGoals.length
    ? prevGoals.map((g, i) => `${i + 1}. ${g}`).join("\n")
    : "(no specific goals were recorded last period)";

  const prompt = `You are a Bittensor subnet analyst comparing this subnet's progress against the PREVIOUS report.

Channel: ${channelName} — Subnet ${subnetNumber}

LAST PERIOD, the analyst said the following would need to happen for a higher rating:
${goalsList}

LAST PERIOD investability score: ${prevScore ?? "unknown"}
THIS PERIOD investability score: ${currentScore ?? "unknown"}

THIS PERIOD's community messages (usernames and timestamps already removed):
${msgText.substring(0, 5000)}

HARD RULES:
- Judge each previous goal ONLY from THIS period's messages
- If a goal is not discussed at all this period, mark it "not_addressed" with evidence "No discussion found this period"
- NEVER invent progress that is not supported by the messages
- Do NOT include any username, sender name, timestamp, or personal data in the output
- Keep every evidence string under 15 words

Return ONLY valid JSON, no markdown:
{
  "summary": "2-3 sentences: what has actually changed since last period, grounded in the messages",
  "improvements": [
    {
      "item": "restate the previous goal briefly",
      "status": "done|in_progress|not_addressed",
      "evidence": "short reference from this period's chat"
    }
  ],
  "newProgress": [
    "concrete improvement observed this period that was NOT one of the previous goals"
  ],
  "regressions": [
    "something that got worse or a new concern versus last period"
  ]
}

Include exactly one "improvements" entry for EVERY previous goal listed above.`;

  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 2000,
  });

  const raw = res.choices[0].message.content.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    logger.error(`Month-over-month JSON parse failed: ${e.message}`);
    return null;
  }

  const delta =
    prevScore != null && currentScore != null
      ? Math.round((currentScore - prevScore) * 10) / 10
      : null;

  return {
    hasPrevious: true,
    previousDate: previousReport?.reportDate || null,
    previousScore: prevScore,
    currentScore,
    scoreDelta: delta,
    direction:
      delta == null ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    summary: parsed.summary || "",
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    newProgress: Array.isArray(parsed.newProgress) ? parsed.newProgress : [],
    regressions: Array.isArray(parsed.regressions) ? parsed.regressions : [],
  };
}

// ── CHAT: answer a custom question about a subnet
async function answerSubnetQuestion(
  channelId,
  subnetName,
  question,
  days = 30,
  progressContext = "",
) {
  const {
    text: msgText,
    total,
    sampled,
  } = await fetchChannelMessages(channelId, days);

  if (!msgText)
    return { answer: "Not enough message data to answer this question." };

  const prompt = `You are analyzing the Discord community of the Bittensor subnet "${subnetName}".

Messages from the past ${days} days (${sampled} of ${total} total, usernames removed):
${msgText.substring(0, 5000)}
${
  progressContext
    ? `\nMONTH-OVER-MONTH PROGRESS (already computed from prior reports — usernames, timestamps, and personal data removed):\n${progressContext}\n`
    : ""
}
HARD RULES:
- Answer ONLY based on what is in the messages${progressContext ? " and the month-over-month progress above" : ""}
- NEVER invent facts or add external knowledge
- If the answer is not in the messages, say so clearly
- Use bullet points for clarity
- No usernames, timestamps, or personal data of any sender in output
- Mark anything uncertain as LOW CONFIDENCE

Question: ${question}

Answer in clear, structured bullet points. Be specific and cite discussion themes as evidence.`;

  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 1500,
  });

  return {
    answer: res.choices[0].message.content,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GITHUB ANALYSIS — parallel to the Discord analysis, but reads the GitHub
// activity that githubScraper stored as Message docs (source:"github",
// channelId:"owner/repo"). Aggregated across ALL of a subnet's repos into a
// single section. Does NOT affect the investability score.
// ─────────────────────────────────────────────────────────────────────────────

// Fetch recent GitHub activity messages for a set of "owner/repo" channelIds.
// GitHub content is already clean (no Discord chrome), so we skip cleanContent.
async function fetchGithubMessages(channelIds, days = 30) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const query = {
    source: "github",
    channelId: { $in: channelIds },
    discordCreatedAt: { $gte: from, $lte: to },
  };
  const total = await Message.countDocuments(query);

  // GitHub activity is far lower-volume than chat — take the most recent items
  // up to a cap rather than stratified sampling.
  const messages = await Message.find(query)
    .sort({ discordCreatedAt: -1 })
    .limit(400)
    .select("content discordCreatedAt")
    .lean();

  const formatted = messages
    .map((m) => (m.content || "").trim())
    .filter((t) => t.length > 5)
    .map((t, i) => `${i + 1}. ${t.substring(0, 600)}`)
    .join("\n");

  logger.info(
    `GitHub messages for [${channelIds.join(", ")}]: ${total} total → ${messages.length} used`,
  );

  return { text: formatted, total, sampled: messages.length };
}

// LLM pass: write a FULL development report from the repo's recent activity —
// exhaustive topics with bullet points (same shape as the Discord topics), plus
// recent highlights and concerns. Returns null on parse failure (non-fatal).
async function analyzeGithubActivity(subnetName, subnetNumber, msgText, statsSummary) {
  const prompt = `You are a HIGH-ACCURACY SOFTWARE PROJECT ANALYST writing a full development report on the GitHub repository/repositories of the Bittensor subnet "${subnetName}" (Subnet ${subnetNumber}).

REPOSITORY SNAPSHOT (stars/forks/issues/language/releases/description/topics):
${statsSummary}

RECENT DEVELOPMENT ACTIVITY — issues, pull requests, commits, and comments from the last ~30 days. Each line is one item. Author handles may appear; do NOT reproduce any usernames or handles in your output:
${msgText.substring(0, 8000)}

YOUR JOB — write a thorough report on what is going on with this repository, as if briefing an investor who cannot read the repo themselves. EXTRACT AND ORGANIZE EVERYTHING MEANINGFUL:
- What is actively being built, fixed, and changed (features, bug fixes, refactors)
- Releases / version bumps and what they contained
- Recurring themes across commits and PRs
- Open problems, unresolved issues, and debated questions
- Overall maintenance health and development pace

CRITICAL RULES:
- List EVERY distinct development theme as its own topic — do NOT merge separate areas into one
- If 7 different things are happening, produce 7 topics — not 3 broad ones
- Every bullet must be grounded in the ACTUAL activity above — NEVER invent features, releases, partnerships, or work not shown
- Be specific: reference concrete commit themes, PR titles, issue subjects, version numbers
- Do NOT include usernames or personal handles anywhere
- momentum: judge honestly from commit/PR/issue volume and recency

Return ONLY valid JSON, no markdown:
{
  "summary": "3-4 sentences: the big picture of what is happening in this repository right now",
  "momentum": "high|moderate|low",
  "momentumDetail": "1-2 sentences justifying the momentum call, referencing volume/recency of commits and PRs",
  "devFocus": ["short focus-area label", "another", "another"],
  "topics": [
    {
      "title": "Exact development theme — close to how it appears in the commits/PRs/issues",
      "description": "1-2 sentence overview of this specific area of work",
      "bulletPoints": [
        "specific concrete detail from the actual activity",
        "another specific detail",
        "another specific detail"
      ]
    }
  ],
  "recentHighlights": [
    "a notable merged PR, release, or significant fix — concrete and specific"
  ],
  "concerns": [
    "a repo-level risk grounded in the activity — e.g. many stale open issues, a critical unresolved bug, low commit frequency, single area of activity only"
  ]
}

Aim for as many topics as the activity genuinely supports — missing a real development theme is a failure.`;

  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 4000,
  });

  const raw = res.choices[0].message.content.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(raw);
    logger.info(`GitHub report: ${parsed.topics?.length || 0} dev topics extracted`);
    return {
      summary: parsed.summary || "",
      momentum: parsed.momentum || "low",
      momentumDetail: parsed.momentumDetail || "",
      devFocus: Array.isArray(parsed.devFocus) ? parsed.devFocus : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      recentHighlights: Array.isArray(parsed.recentHighlights) ? parsed.recentHighlights : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
    };
  } catch (e) {
    logger.error(`GitHub activity JSON parse failed: ${e.message}`);
    return null;
  }
}

// MAIN GitHub analysis for one subnet. `repos` = array of "owner/repo" strings.
// Returns the githubAnalysis block, or null if there are no repos / no data.
async function analyzeGithub(repos, subnetNumber, subnetName, days = 30) {
  if (!Array.isArray(repos) || repos.length === 0) return null;

  // 1. Repo health metadata (deterministic — no LLM).
  const repoStats = [];
  for (const r of repos) {
    const parsed = parseRepo(r);
    if (!parsed) {
      logger.warn(`GitHub: skipping invalid repo reference "${r}"`);
      continue;
    }
    try {
      const meta = await fetchRepoMeta(parsed.owner, parsed.repo);
      if (!meta) continue;
      repoStats.push({
        fullName: meta.fullName,
        description: meta.description || null,
        topics: Array.isArray(meta.topics) ? meta.topics : [],
        stars: meta.stars || 0,
        forks: meta.forks || 0,
        openIssues: meta.openIssues || 0,
        language: meta.language || null,
        pushedAt: meta.pushedAt || null,
        url: meta.url,
        archived: Boolean(meta.archived),
        latestReleaseTag: meta.latestRelease?.tag || null,
        latestReleaseDate: meta.latestRelease?.publishedAt || null,
      });
    } catch (e) {
      logger.warn(`GitHub: meta lookup failed for ${r}: ${e.message}`);
    }
  }

  if (repoStats.length === 0) {
    logger.info(`GitHub: subnet ${subnetNumber} — no accessible repos, skipping section`);
    return null;
  }

  // Aggregate stats across all repos.
  const languages = [...new Set(repoStats.map((r) => r.language).filter(Boolean))];
  const lastPushedAt = repoStats
    .map((r) => r.pushedAt)
    .filter(Boolean)
    .map((d) => new Date(d))
    .sort((a, b) => b - a)[0] || null;

  const stats = {
    repoCount: repoStats.length,
    totalStars: repoStats.reduce((s, r) => s + r.stars, 0),
    totalForks: repoStats.reduce((s, r) => s + r.forks, 0),
    totalOpenIssues: repoStats.reduce((s, r) => s + r.openIssues, 0),
    languages,
    lastPushedAt,
    repos: repoStats,
  };

  // 2. LLM summary of recent activity (only if the scraper has stored some).
  const channelIds = repos
    .map((r) => {
      const p = parseRepo(r);
      return p ? `${p.owner}/${p.repo}` : null;
    })
    .filter(Boolean);

  const { text, total, sampled } = await fetchGithubMessages(channelIds, days);

  // Even a single commit/issue/PR is worth reporting — a quiet repo is itself a
  // finding, and this is often the only signal a low-chat subnet has.
  let activity = null;
  if (text && sampled >= 1) {
    const statsSummary = repoStats
      .map(
        (r) =>
          `- ${r.fullName}: ${r.stars}★, ${r.forks} forks, ${r.openIssues} open issues` +
          (r.language ? `, ${r.language}` : "") +
          (r.latestReleaseTag ? `, latest release ${r.latestReleaseTag}` : "") +
          (r.pushedAt ? `, last push ${new Date(r.pushedAt).toISOString().split("T")[0]}` : "") +
          (r.description ? `\n    Description: ${r.description}` : "") +
          (r.topics?.length ? `\n    GitHub topics: ${r.topics.join(", ")}` : ""),
      )
      .join("\n");
    try {
      activity = await analyzeGithubActivity(subnetName, subnetNumber, text, statsSummary);
    } catch (e) {
      logger.warn(`GitHub activity analysis failed for subnet ${subnetNumber}: ${e.message}`);
    }
  } else {
    logger.info(
      `GitHub: subnet ${subnetNumber} — no recent activity items, reporting repo stats only`,
    );
  }

  return { stats, activity, analyzedDays: days };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED VERDICT — the final synthesis. Weighs BOTH the Discord community
// analysis AND the GitHub development analysis into a single investment score
// out of 10, explains why, lists what would raise the rating, and answers the
// alpha-token price-outlook question. This is the section shown at the very end.
// ─────────────────────────────────────────────────────────────────────────────
async function analyzeCombined(
  subnetName,
  subnetNumber,
  invest,
  githubAnalysis,
  coverage = {},
) {
  // GitHub context (or an explicit note that there's no dev signal).
  let ghContext =
    "No GitHub repositories are configured for this subnet, or no development data was available. Base the verdict mostly on the community analysis and note the missing development signal.";
  if (githubAnalysis?.stats) {
    const s = githubAnalysis.stats;
    const a = githubAnalysis.activity;
    ghContext =
      `Repositories: ${s.repoCount}. Total stars ${s.totalStars}, forks ${s.totalForks}, open issues ${s.totalOpenIssues}.` +
      (s.languages?.length ? ` Languages: ${s.languages.join(", ")}.` : "") +
      (s.lastPushedAt
        ? ` Last push: ${new Date(s.lastPushedAt).toISOString().split("T")[0]}.`
        : "") +
      (a
        ? `\nDevelopment momentum: ${a.momentum}. ${a.summary || ""}` +
          (a.devFocus?.length ? `\nDev focus: ${a.devFocus.join(", ")}.` : "") +
          (a.notableItems?.length
            ? `\nNotable: ${a.notableItems.map((it) => it.title).join("; ")}.`
            : "")
        : "\nNo recent development-activity summary available.");
  }

  // Discord context — or an explicit note that the channel was silent this period.
  // A quiet channel is NOT evidence the project is failing, so say so outright:
  // otherwise the model reads the absence as a negative and tanks the score.
  let discordContext =
    "The Discord channel had no usable discussion in this period, so there is NO community analysis available. " +
    "Treat this as a MISSING signal, not as a negative one — base the verdict on the development activity below, " +
    "note the lack of community discussion as a limitation and a risk to visibility, and set confidence accordingly.";
  if (invest) {
    discordContext =
      `Community-only investability score: ${invest.investabilityScore ?? "unknown"}/10 (${invest.scoreLabel || "n/a"}).` +
      `\nPositives: ${(invest.positives || []).map((p) => p.category).join(", ") || "none noted"}.` +
      `\nConcerns: ${(invest.concerns || []).map((c) => c.category).join(", ") || "none noted"}.` +
      (invest.bottomLine ? `\nBottom line: ${invest.bottomLine}` : "") +
      (coverage.lowVolume
        ? `\nNOTE: very few messages were available this period, so the community score rests on a thin sample. ` +
          `Weight the development activity more heavily and reflect the limited community evidence in your confidence.`
        : "");
  }

  const prompt = `You are a professional Bittensor subnet investment analyst producing the FINAL combined verdict.

Subnet: ${subnetName} (Subnet ${subnetNumber})

You have TWO independent analyses:

1) DISCORD COMMUNITY ANALYSIS:
${discordContext}

2) GITHUB DEVELOPMENT ANALYSIS:
${ghContext}

Produce a SINGLE combined investment score out of 10 that weighs BOTH the community signals (Discord) AND the actual development activity (GitHub). A subnet with strong development but a weak community — or a lively community but a dead repo — must be scored honestly. Real, recent code activity is a strong positive; a stale or empty repo is a real negative.

HARD RULES:
- Base everything ONLY on the two analyses above — never invent facts, partnerships, or releases
- Be honest; do not inflate scores
- combinedScore must be a number from 1 to 10 (one decimal allowed)
- raiseRating MUST contain at least 5 distinct, specific, concrete items
- For the alpha-token question, reason ONLY from concrete near-term catalysts evidenced above (upcoming releases, mainnet/product launches, partnerships, dev milestones, growing activity). If none are evident, say so plainly and set confidence LOW.

Return ONLY valid JSON, no markdown:
{
  "combinedScore": 7.2,
  "scoreLabel": "Strong Buy|Buy|Hold|Caution|Avoid",
  "rationale": "3-5 sentences explaining the combined score, explicitly referencing BOTH community sentiment and development activity and how they weigh against each other",
  "raiseRating": [
    "specific action or milestone that would raise this combined rating",
    "another specific item",
    "another",
    "another",
    "another"
  ],
  "alphaOutlook": {
    "answer": "Direct answer to: Do you foresee anything happening in the near future that would make the price of this subnet's alpha token increase substantially? 3-5 sentences grounded in the analyses.",
    "catalysts": [
      "specific near-term catalyst evidenced above (e.g. upcoming release, launch, partnership, rising dev activity)"
    ],
    "confidence": "HIGH|MEDIUM|LOW"
  }
}

scoreLabel rules: 9-10 = Strong Buy, 7-8.9 = Buy, 5-6.9 = Hold, 3-4.9 = Caution, 1-2.9 = Avoid`;

  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 2500,
  });

  const raw = res.choices[0].message.content.replace(/```json|```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    logger.error(`Combined verdict JSON parse failed: ${e.message}`);
    return null;
  }

  const ao = parsed.alphaOutlook || {};
  return {
    combinedScore:
      typeof parsed.combinedScore === "number" ? parsed.combinedScore : null,
    scoreLabel: parsed.scoreLabel || "",
    rationale: parsed.rationale || "",
    raiseRating: Array.isArray(parsed.raiseRating) ? parsed.raiseRating : [],
    alphaOutlook: {
      answer: ao.answer || "",
      catalysts: Array.isArray(ao.catalysts) ? ao.catalysts : [],
      confidence: ao.confidence || "LOW",
    },
  };
}

// ── Resolve a subnet's display identity, honoring user-managed SubnetConfig.
// Precedence:
//   name        → SubnetConfig override  >  static meta  >  AI-inferred  >  channel name
//   description → SubnetConfig override  >  (caller keeps AI briefDescription)
// This is what makes the Subnet Settings page actually "apply across reports".
async function resolveSubnetIdentity(subnetNumber, aiName, channelName) {
  let cfg = null;
  try {
    cfg = await SubnetConfig.findOne({ subnetNumber }).lean();
  } catch (e) {
    logger.warn(`SubnetConfig lookup failed for subnet ${subnetNumber}: ${e.message}`);
  }
  const meta = getSubnetMeta(subnetNumber, aiName, channelName);
  return {
    name: cfg?.name?.trim() || meta.name,
    configuredDescription: cfg?.description?.trim() || null,
  };
}

// ── MAIN: analyze one subnet.
//
// Discord and GitHub are INDEPENDENT sources. A thin or empty Discord channel no
// longer aborts the subnet: the Discord half is simply skipped and the report is
// built from GitHub alone. The subnet is only skipped outright when BOTH sources
// have nothing — otherwise there is always something worth reporting.
async function analyzeSubnet(channelId, channelName, subnetNumber, days = 30) {
  logger.info(`Analyzing subnet ${subnetNumber} — #${channelName}`);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const {
    text: msgText,
    total,
    usable,
    samplingMethod,
  } = await fetchChannelMessages(channelId, days);

  const hasDiscord = Boolean(msgText) && usable >= MIN_DISCORD_MESSAGES;
  const lowVolume = hasDiscord && usable < LOW_VOLUME_THRESHOLD;

  let topics = null;
  let invest = null;
  let monthOverMonth = null;

  if (hasDiscord) {
    if (lowVolume) {
      logger.info(
        `Subnet ${subnetNumber}: low Discord volume — analyzing anyway, flagged low-confidence`,
      );
    }

    // Call 1 — topics (exhaustive)
    topics = await analyzeTopics(
      channelName,
      subnetNumber,
      msgText,
      usable,
      total,
      lowVolume,
    );

    // 2s gap to avoid Groq rate limit
    await sleep(2000);

    // Call 2 — investability (uses topics as context)
    invest = await analyzeInvestability(
      channelName,
      subnetNumber,
      msgText,
      topics,
      lowVolume,
    );

    // Call 3 — month-over-month progress vs the previous completed report.
    // Compares last period's "raiseTo9" goals against this period's discussion.
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const previousReport = await SubnetReport.findOne({
        subnetNumber,
        status: "completed",
        reportDate: { $lt: todayStart },
        "report.investabilityScore": { $ne: null },
      })
        .sort({ reportDate: -1 })
        .lean();

      if (previousReport) {
        await sleep(2000); // rate-limit gap
        monthOverMonth = await analyzeMonthOverMonth(
          channelName,
          subnetNumber,
          msgText,
          invest,
          previousReport,
        );
        logger.info(
          `Subnet ${subnetNumber}: month-over-month vs ${new Date(
            previousReport.reportDate,
          ).toISOString().split("T")[0]} — ${monthOverMonth ? "computed" : "skipped"}`,
        );
      } else {
        logger.info(
          `Subnet ${subnetNumber}: no prior report — baseline period, no comparison`,
        );
      }
    } catch (e) {
      logger.warn(
        `Month-over-month comparison failed for subnet ${subnetNumber}: ${e.message}`,
      );
    }
  } else {
    logger.warn(
      `Subnet ${subnetNumber}: no usable Discord messages in the last ${days}d — continuing with GitHub only`,
    );
  }

  // Apply user-managed config (name/description) so Subnet Settings edits take effect
  const identity = await resolveSubnetIdentity(
    subnetNumber,
    topics?.subnetName,
    channelName,
  );

  // GitHub analysis — separate section, aggregated across the subnet's repos.
  // Runs regardless of how much Discord data there was, and is independent of the
  // investability score. Non-fatal: a failure here still yields a Discord report.
  let githubAnalysis = null;
  let repoCount = 0;
  try {
    const cfg = await SubnetConfig.findOne({ subnetNumber })
      .select("githubRepos")
      .lean();
    const repos = cfg?.githubRepos || [];
    repoCount = repos.length;
    if (repos.length > 0) {
      if (hasDiscord) await sleep(2000); // rate-limit gap
      githubAnalysis = await analyzeGithub(
        repos,
        subnetNumber,
        identity.name,
        days,
      );
      logger.info(
        `Subnet ${subnetNumber}: GitHub analysis ${githubAnalysis ? "computed" : "skipped (no data)"} for ${repos.length} repo(s)`,
      );
    } else {
      logger.info(`Subnet ${subnetNumber}: no GitHub repos configured`);
    }
  } catch (e) {
    logger.warn(`GitHub analysis failed for subnet ${subnetNumber}: ${e.message}`);
  }

  // Only now is it genuinely a "no data" subnet: nothing from chat AND nothing
  // from GitHub. Anything less than that still produces a report.
  if (!hasDiscord && !githubAnalysis) {
    logger.warn(
      `Subnet ${subnetNumber}: no usable Discord messages and no GitHub data` +
        (repoCount === 0 ? " (no repos configured)" : "") +
        " — nothing to report",
    );
    return null;
  }

  // Final combined verdict — synthesizes Discord + GitHub into one investment
  // score, plus the alpha-token outlook. Non-fatal. Runs even when one side is
  // missing; the prompt is told which signal is absent.
  let combinedVerdict = null;
  try {
    await sleep(2000); // rate-limit gap
    combinedVerdict = await analyzeCombined(
      identity.name,
      subnetNumber,
      invest,
      githubAnalysis,
      { hasDiscord, lowVolume },
    );
    logger.info(
      `Subnet ${subnetNumber}: combined verdict ${combinedVerdict ? `computed (${combinedVerdict.combinedScore}/10)` : "skipped"}`,
    );
  } catch (e) {
    logger.warn(`Combined verdict failed for subnet ${subnetNumber}: ${e.message}`);
  }

  return {
    // Identity
    subnetName: identity.name,
    briefDescription:
      identity.configuredDescription ||
      topics?.briefDescription ||
      githubAnalysis?.stats?.repos?.find((r) => r.description)?.description ||
      "",
    oneLiner: topics?.oneLiner || "",

    // Sentiment
    overallSentiment: topics?.overallSentiment || "neutral",
    sentimentDetail: topics?.sentimentDetail || "",

    // Topics — the main section
    mainTopics: topics?.mainTopics || [],

    // Signals & issues
    emergingSignals: topics?.emergingSignals || [],
    userIssues: topics?.userIssues || [],
    openQuestions: topics?.openQuestions || [],
    developmentsToWatch: topics?.developmentsToWatch || [],

    // Investability (Discord-only). null when the channel had no usable messages —
    // the frontend hides the section rather than showing an empty score.
    investabilityScore: invest?.investabilityScore ?? null,
    scoreLabel: invest?.scoreLabel || "",
    investabilityBreakdown: invest?.investabilityBreakdown || {},
    positives: invest?.positives || [],
    concerns: invest?.concerns || [],
    whatImpresses: invest?.whatImpresses || "",
    raiseTo9: invest?.raiseTo9 || [],
    monthOverMonth,

    // GitHub — separate section (null if no repos configured / no data)
    githubAnalysis,

    // Final combined verdict — Discord + GitHub → one score, + alpha outlook
    combinedVerdict,

    lowerRating: invest?.lowerRating || "",
    comparisonContext: invest?.comparisonContext || "",
    bottomLine: invest?.bottomLine || "",

    // Which sources actually backed this report, so the UI can be honest about
    // confidence. Qualitative only — no message counts are stored.
    dataCoverage: {
      hasDiscordData: hasDiscord,
      discordVolume: !hasDiscord ? "none" : lowVolume ? "low" : "normal",
      hasGithubData: Boolean(githubAnalysis),
      hasGithubActivity: Boolean(githubAnalysis?.activity),
    },

    // Meta (message counts are intentionally not stored)
    samplingMethod,
    analyzedDays: days,
  };
}

module.exports = {
  analyzeSubnet,
  answerSubnetQuestion,
  fetchChannelMessages,
  analyzeGithub,
};