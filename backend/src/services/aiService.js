const { cacheGet, cacheSet } = require("../config/redis");
const AiResult = require("../models/AiResult");
const Message = require("../models/Message");
const logger = require("../utils/logger");

// Provider router: Gemini (default) or Groq, both behind the same
// `.chat.completions.create(...)` interface, each with key rotation on rate
// limit. Model id comes from the provider so it is never hardcoded here.
const llm = require("./llmProvider");
const openai = llm;
const MODEL = llm.MODEL;

// Same reasoning as subnetIntelService: these caps exist to fit a small context
// window, so they scale with the provider. See llmProvider.IS_LONG_CONTEXT.
const LONG_CTX = llm.IS_LONG_CONTEXT;
const envInt = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
};
const ANALYSIS_MESSAGE_LIMIT = envInt(
  "ANALYSIS_MESSAGE_LIMIT",
  LONG_CTX ? 6000 : 500,
);
const MESSAGE_CHAR_CAP = envInt("ANALYSIS_MESSAGE_CHARS", LONG_CTX ? 2000 : 1200);
const FILE_CHAR_CAP = envInt("ANALYSIS_FILE_CHARS", LONG_CTX ? 4000 : 800);

function buildCacheKey(type, scope, targetId, dateStr) {
  return `ai:${type}:${scope}:${targetId}:${dateStr}`;
}

async function fetchMessagesForAnalysis(
  scope,
  targetId,
  from,
  to,
  limit = ANALYSIS_MESSAGE_LIMIT,
) {
  const query = { discordCreatedAt: { $gte: from, $lte: to } };
  if (scope === "channel") query.channelId = targetId;
  if (scope === "server") query.serverId = targetId;
  if (scope === "user") query.authorId = targetId;

  return Message.find(query)
    .sort({ discordCreatedAt: 1 })
    .limit(limit)
    .select("content discordCreatedAt extractedText");
}

/**
 * Strip usernames, handles, timestamps, role noise, URLs, and @mentions
 * from message content BEFORE it reaches the LLM.
 */
function cleanMessageContent(content) {
  if (!content) return "";
  let text = content;

  // Remove pure timestamp/attribution header lines
  text = text.replace(
    /^[^\n—]{1,60}—\s*(Yesterday at\s*)?\d{1,2}:\d{2}\s*(AM|PM)?\s*$/gim,
    "",
  );

  // Strip inline "Name — HH:MM AM/PM" attribution prefixes
  text = text.replace(
    /[A-Za-z0-9_.\- ]{1,40}—\s*(Yesterday at\s*)?\d{1,2}:\d{2}\s*(AM|PM)?\s*/g,
    "",
  );

  // Strip @mentions including complex Discord names with bracket role suffixes
  text = text.replace(
    /@[A-Za-z0-9_.\- ]{1,40}(\s*[\[【][^\]】]{0,30}[\]】])*(\s+SN\d+)?/g,
    "",
  );

  // Strip "Role icon, ..." noise Discord injects
  text = text.replace(/Role icon,\s*[^\n]*/gi, "");

  // Strip bracket tags like "[τ, ף]" "[τ,τ]" "[CTX]"
  text = text.replace(/[\[【][τА-Яא-תa-zA-Z,\s.ף]+[\]】]/g, "");

  // Strip subnet labels like "SN44" "SN64" when standing alone
  text = text.replace(/\bSN\d+\b/g, "");

  // Strip URLs
  text = text.replace(/https?:\/\/\S+/g, "");

  // Collapse whitespace
  text = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/**
 * Format cleaned messages — includes both plain text and extracted file content.
 */
function formatMessagesForPrompt(messages) {
  return messages
    .map((m) => {
      let text = cleanMessageContent(m.content);
      if (m.extractedText) {
        text += `\n[Attached file content]: ${m.extractedText.substring(0, FILE_CHAR_CAP)}`;
      }
      return text;
    })
    .filter((c) => c.length > 8)
    .map((c, i) => `${i + 1}. ${c.substring(0, MESSAGE_CHAR_CAP)}`)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
async function generateDailySummary(
  scope,
  targetId,
  targetName,
  date = new Date(),
) {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);
  const dateStr = from.toISOString().split("T")[0];
  const cacheKey = buildCacheKey("monthly_summary", scope, targetId, dateStr);

  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const dbCached = await AiResult.findOne({ cacheKey });
  if (dbCached) {
    await cacheSet(cacheKey, dbCached.result, 3600);
    return dbCached.result;
  }

  const messages = await fetchMessagesForAnalysis(scope, targetId, from, to);
  if (messages.length === 0)
    return { summary: "No messages found for this period.", messageCount: 0 };

  const msgText = formatMessagesForPrompt(messages);

  const prompt = `You are a HIGH-ACCURACY CHAT ANALYSIS SYSTEM.
Analyze the following chat messages from the "${targetName}" channel on ${dateStr}.
All usernames have been stripped — focus only on the content.

HARD RULES:
- NEVER invent facts not explicitly present in the messages
- NEVER add external knowledge or assume missing context
- NEVER create topics, events, or features not mentioned
- DO NOT rename topics into unrelated abstractions
- Only extract sentiment clearly supported by the messages
- If uncertain, mark as LOW CONFIDENCE

MESSAGES:
${msgText}

Return ONLY this JSON, no markdown:
{
  "summary": "3-5 bullet points only — what was actually discussed, nothing invented",
  "sentiment": "positive|negative|neutral|mixed",
  "sentimentDetail": [
    "bullet: specific reason for sentiment based only on actual messages"
  ],
  "keyTopics": [
    "exact topic as discussed — keep label close to original wording"
  ],
  "emergingSignals": [
    {
      "signal": "signal name",
      "description": "what exactly was said or repeated in the chat",
      "evidence": "short direct reference from the messages",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],
  "userIssues": [
    "real problem explicitly mentioned in the messages"
  ],
  "uncertainties": [
    "anything unclear or ambiguous — label LOW CONFIDENCE"
  ],
  "messageCount": ${messages.length},
  "date": "${dateStr}"
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 1500,
    json: true,
  });

  let result;
  try {
    const text = response.choices[0].message.content
      .replace(/```json|```/g, "")
      .trim();
    result = JSON.parse(text);
  } catch {
    result = {
      summary: response.choices[0].message.content,
      messageCount: messages.length,
      date: dateStr,
    };
  }

  delete result.activeUsers;
  delete result.messageCount; // message counts are intentionally not stored

  await cacheSet(cacheKey, result, 86400);
  await AiResult.findOneAndUpdate(
    { cacheKey },
    {
      type: "monthly_summary",
      scope,
      targetId,
      targetName,
      dateRange: { from, to },
      result,
      model: MODEL,
      tokensUsed: response.usage?.total_tokens,
      cacheKey,
    },
    { upsert: true },
  );

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// TREND ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
async function analyzeTrends(scope, targetId, targetName, days = 7) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const cacheKey = buildCacheKey("trend_analysis", scope, targetId, `${days}d`);

  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const messages = await fetchMessagesForAnalysis(
    scope,
    targetId,
    from,
    to,
    1000,
  );
  if (messages.length < 5) return { trends: [], messageCount: messages.length };

  const msgText = formatMessagesForPrompt(messages.slice(0, 800));

  const prompt = `You are a HIGH-ACCURACY CHAT ANALYSIS SYSTEM analyzing ${days} days of messages from the "${targetName}" channel.
All usernames have been stripped.

HARD RULES:
- NEVER invent topics not present in the messages
- NEVER add external knowledge
- Only include signals with clear evidence from the chat
- Keep topic labels close to original wording
- Mark uncertain patterns as LOW CONFIDENCE

MESSAGES:
${msgText}

Return ONLY this JSON, no markdown:
{
  "summary": "3-5 bullet points of what this channel is actually focused on",
  "overallSentiment": "positive|negative|neutral|mixed",
  "trendingTopics": [
    {
      "topic": "exact topic name close to original wording",
      "frequency": number,
      "sentiment": "positive|negative|neutral",
      "description": "1 sentence — only what is actually discussed, no invention"
    }
  ],
  "emergingSignals": [
    {
      "signal": "signal name",
      "description": "what exactly was said or repeated",
      "evidence": "short direct reference from chat",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],
  "keywordClusters": [
    { "cluster": "theme name", "keywords": ["kw1", "kw2", "kw3"] }
  ],
  "notableThemes": [
    "theme only if clearly repeated in the messages"
  ],
  "uncertainties": [
    "anything unclear or weakly supported — LOW CONFIDENCE"
  ],
  "messageCount": ${messages.length},
  "analyzedDays": ${days}
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 1500,
    json: true,
  });

  let result;
  try {
    const text = response.choices[0].message.content
      .replace(/```json|```/g, "")
      .trim();
    result = JSON.parse(text);
  } catch {
    result = { summary: response.choices[0].message.content };
  }

  result.analyzedDays = days;
  delete result.messageCount; // message counts are intentionally not stored

  await cacheSet(cacheKey, result, 7200);
  await AiResult.create({
    type: "trend_analysis",
    scope,
    targetId,
    targetName,
    dateRange: { from, to },
    result,
    model: MODEL,
    tokensUsed: response.usage?.total_tokens,
    cacheKey,
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SENTIMENT ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
async function analyzeSentiment(scope, targetId, from, to) {
  const messages = await fetchMessagesForAnalysis(
    scope,
    targetId,
    from,
    to,
    300,
  );
  if (messages.length === 0) return { overall: "neutral", breakdown: {} };

  const msgText = formatMessagesForPrompt(messages);

  const prompt = `You are a HIGH-ACCURACY CHAT ANALYSIS SYSTEM.
Perform sentiment analysis on these messages (usernames removed).

HARD RULES:
- Base sentiment ONLY on actual user expressions in the messages
- Do NOT guess sentiment — if unclear mark as LOW CONFIDENCE
- Do NOT mention any names

MESSAGES:
${msgText}

Return ONLY this JSON, no markdown:
{
  "overall": "positive|negative|neutral|mixed",
  "positivePercent": number,
  "negativePercent": number,
  "neutralPercent": number,
  "emotionalTone": "1 sentence describing the mood based only on the messages",
  "mostPositiveTopics": [
    "topic clearly generating positive reactions"
  ],
  "mostNegativeTopics": [
    "topic clearly generating negative or frustrated reactions"
  ],
  "sentimentDrivers": [
    "specific factor from the chat driving overall sentiment"
  ],
  "uncertainties": [
    "any sentiment that is unclear or weakly supported — LOW CONFIDENCE"
  ]
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 800,
    json: true,
  });

  try {
    const text = response.choices[0].message.content
      .replace(/```json|```/g, "")
      .trim();
    return JSON.parse(text);
  } catch {
    return { overall: "neutral", raw: response.choices[0].message.content };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM / ASK
// ─────────────────────────────────────────────────────────────────────────────
async function customAnalysis(scope, targetId, question, days = 7) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const messages = await fetchMessagesForAnalysis(
    scope,
    targetId,
    from,
    to,
    500,
  );
  if (messages.length === 0) return { answer: "No messages found to analyze." };

  const msgText = formatMessagesForPrompt(messages.slice(0, 600));

  const prompt = `You are a HIGH-ACCURACY CHAT ANALYSIS SYSTEM.
Answer the question below based ONLY on the messages provided (usernames removed).

HARD RULES:
- NEVER invent facts not present in the messages
- NEVER add external knowledge
- If the answer is not clearly supported by the messages, say so explicitly
- Cite specific topics or discussion threads as evidence
- Do not reference any usernames

MESSAGES:
${msgText}

Question: ${question}

Answer in clear bullet points. Mark anything uncertain as LOW CONFIDENCE.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 1000,
  });

  return {
    answer: response.choices[0].message.content,
    messageCount: messages.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-CHANNEL ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
async function analyzeMultipleChannels(
  targets,
  analysisType = "summary",
  days = 7,
  question = "",
) {
  if (!targets || targets.length === 0)
    return { error: "No targets provided." };

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const perChannelLimit = Math.max(50, Math.floor(1200 / targets.length));

  const allMessageSets = await Promise.all(
    targets.map(({ scope, targetId }) =>
      fetchMessagesForAnalysis(scope, targetId, from, to, perChannelLimit),
    ),
  );

  const taggedLines = [];
  targets.forEach(({ targetName }, idx) => {
    const cleaned = allMessageSets[idx]
      .map((m) => {
        let text = cleanMessageContent(m.content);
        if (m.extractedText) {
          text += `\n[File]: ${m.extractedText.substring(0, 400)}`;
        }
        return text;
      })
      .filter((c) => c.length > 8);

    if (cleaned.length > 0) {
      taggedLines.push(`\n=== #${targetName} ===`);
      cleaned.slice(0, Math.floor(900 / targets.length)).forEach((c, i) => {
        taggedLines.push(`${i + 1}. ${c.substring(0, 480)}`);
      });
    }
  });

  if (taggedLines.length === 0)
    return {
      summary: "No messages found across selected channels.",
      messageCount: 0,
    };

  const totalCount = allMessageSets.reduce((sum, s) => sum + s.length, 0);
  const msgText = taggedLines.join("\n");
  const channelList = targets.map((t) => `#${t.targetName}`).join(", ");
  const dateStr = from.toISOString().split("T")[0];

  let prompt;

  if (analysisType === "summary") {
    prompt = `You are a HIGH-ACCURACY CHAT ANALYSIS SYSTEM.
Analyze messages from these channels: ${channelList}
Time range: last ${days} days from ${dateStr}. Usernames removed.

HARD RULES:
- NEVER invent facts not present in the messages
- NEVER add external knowledge or missing context
- Only report what is explicitly discussed in each channel
- Keep topic labels close to original wording
- Mark anything uncertain as LOW CONFIDENCE
- No usernames or handles in output

MESSAGES:
${msgText}

Return ONLY this JSON, no markdown:
{
  "summary": "3-5 bullet points covering the main topics actually discussed across all channels",
  "overallSentiment": "positive|negative|neutral|mixed",
  "perChannel": [
    {
      "channel": "#channel-name",
      "summary": "2-3 bullet points of what is actually discussed in this channel",
      "sentiment": "positive|negative|neutral|mixed",
      "keyTopics": ["exact topic 1", "exact topic 2", "exact topic 3"],
      "userIssues": ["real problem explicitly mentioned in this channel"],
      "openQuestions": ["unresolved question explicitly raised in this channel"],
      "emergingSignals": [
        {
          "signal": "signal name",
          "evidence": "short direct reference from chat",
          "confidence": "HIGH|MEDIUM|LOW"
        }
      ]
    }
  ],
  "crossChannelThemes": [
    "topic clearly appearing in 2 or more channels — only if explicitly present"
  ],
  "highlights": [
    "key finding grounded in the actual messages"
  ],
  "uncertainties": [
    "anything unclear or weakly supported across channels — LOW CONFIDENCE"
  ],
  "messageCount": ${totalCount}
}`;
  } else if (analysisType === "trends") {
    prompt = `You are a HIGH-ACCURACY CHAT ANALYSIS SYSTEM identifying trends across channels: ${channelList} over the last ${days} days.
Usernames removed.

HARD RULES:
- NEVER invent topics not in the messages
- Only include signals with clear evidence
- Keep labels close to original wording
- Mark uncertain patterns as LOW CONFIDENCE
- No usernames in output

MESSAGES:
${msgText}

Return ONLY this JSON, no markdown:
{
  "summary": "3-5 bullet points of what these channels are actually focused on",
  "overallSentiment": "positive|negative|neutral|mixed",
  "trendingTopics": [
    {
      "topic": "exact topic close to original wording",
      "frequency": number,
      "sentiment": "positive|negative|neutral",
      "description": "1 sentence — only what is actually discussed",
      "channels": ["#ch1", "#ch2"]
    }
  ],
  "perChannelTrends": [
    {
      "channel": "#channel-name",
      "topTopics": ["topic 1", "topic 2", "topic 3"],
      "sentiment": "positive|negative|neutral|mixed",
      "emergingSignals": [
        {
          "signal": "signal name",
          "evidence": "short reference from chat",
          "confidence": "HIGH|MEDIUM|LOW"
        }
      ]
    }
  ],
  "crossChannelTopics": [
    "topic clearly appearing in 2+ channels"
  ],
  "uncertainties": [
    "anything weakly supported — LOW CONFIDENCE"
  ],
  "messageCount": ${totalCount}
}`;
  } else {
    prompt = `You are a HIGH-ACCURACY CHAT ANALYSIS SYSTEM.
Answer the question based ONLY on messages from channels: ${channelList} (last ${days} days).
Usernames removed.

HARD RULES:
- NEVER invent facts not in the messages
- NEVER add external knowledge
- If not clearly supported by the messages, say so explicitly
- Cite specific channels and topics as evidence
- No usernames in output

MESSAGES:
${msgText}

Question: ${question}

Answer in clear bullet points. Mark anything uncertain as LOW CONFIDENCE.`;
  }

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 2000,
    json: analysisType !== "ask",
  });

  let result;
  if (analysisType === "ask") {
    result = {
      answer: response.choices[0].message.content,
      messageCount: totalCount,
      channels: targets.map((t) => t.targetName),
    };
  } else {
    try {
      const text = response.choices[0].message.content
        .replace(/```json|```/g, "")
        .trim();
      result = JSON.parse(text);
    } catch {
      result = {
        summary: response.choices[0].message.content,
        messageCount: totalCount,
      };
    }
    result.channels = targets.map((t) => t.targetName);
    delete result.activeUsers;
  }

  delete result.messageCount; // message counts are intentionally not stored

  const cacheKey = buildCacheKey(
    `multi_${analysisType}`,
    "multi",
    targets
      .map((t) => t.targetId)
      .sort()
      .join("-"),
    `${days}d`,
  );

  await AiResult.findOneAndUpdate(
    { cacheKey },
    {
      type:
        analysisType === "summary"
          ? "monthly_summary"
          : analysisType === "trends"
            ? "trend_analysis"
            : "custom",
      scope: "channel",
      targetId: targets[0].targetId,
      targetName: channelList,
      dateRange: { from, to },
      result,
      model: MODEL,
      tokensUsed: response.usage?.total_tokens,
      cacheKey,
    },
    { upsert: true },
  );

  return result;
}

async function analyzeTextFile(fileContent, targetName, analysisType = "full") {
  const MAX_CHARS = 100000;
  const truncated =
    fileContent.length > MAX_CHARS
      ? fileContent.substring(0, MAX_CHARS) + "\n[Content truncated...]"
      : fileContent;

  // Count approximate messages for messageCount field
  const approxMsgCount = (fileContent.match(/\n[A-Za-z]/g) || []).length;

  const prompt = `You are a SUBNET INTELLIGENCE ANALYST for the Bittensor ecosystem.
Analyze the following Discord channel content for "${targetName}".

ANALYSIS REQUIREMENTS:
- Extract EVERY topic discussed, no matter how minor — exhaustiveness is critical
- Ground every claim in the actual content — never invent facts
- Be specific: use exact feature names, error messages, and terminology from the chat

CONTENT:
${truncated}

Return ONLY this JSON — no markdown, no preamble:
{
  "subnetName": "official name of this subnet (e.g. 'Data Universe' or 'Apex')",
  "oneLiner": "one punchy sentence summarizing what this subnet does and its current state",
  "briefDescription": "2-3 sentence overview of the subnet and the main themes from this period",
  "scoreLabel": "Strong Buy|Buy|Hold|Caution|Avoid — matching the investability score",

  "overallSentiment": "positive|negative|neutral|mixed",
  "sentimentDetail": "1-2 sentences explaining WHY the sentiment is what it is, based on actual chat",

  "investabilityScore": 7.5,
  "investabilityBreakdown": {
    "technology": 7.0,
    "teamExecution": 8.0,
    "commercialPotential": 6.5,
    "economicMaturity": 6.0,
    "decentralization": 7.0
  },

  "mainTopics": [
    {
      "title": "Exact topic name close to how it was discussed",
      "description": "2-3 sentence summary of what was discussed on this topic",
      "bulletPoints": [
        "specific point 1 from the chat",
        "specific point 2 from the chat",
        "specific point 3 from the chat"
      ]
    }
  ],

  "positives": [
    {
      "category": "Short label e.g. 'Active Development Team'",
      "detail": "2-3 sentences explaining why this is a positive signal with specific evidence from chat",
      "score": 8.5
    }
  ],

  "concerns": [
    {
      "category": "Short label e.g. 'Validator Scoring Issues'",
      "detail": "2-3 sentences explaining the concern with specific evidence from the chat",
      "score": 5.0
    }
  ],

  "bottomLine": "2-3 sentence investment summary — what kind of investor should consider this and why",
  "whatImpresses": "The single most impressive thing about this subnet based on the chat",
  "raiseTo9": "What specific development would push the investability score to 9/10",
  "lowerRating": "What specific development or failure would lower the score significantly",
  "comparisonContext": "How this subnet compares to others in the Bittensor ecosystem based on what is discussed",

  "emergingSignals": [
    {
      "signal": "Signal name",
      "description": "What was said or repeated in the chat",
      "evidence": "Short direct reference from the chat — keep under 15 words",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],

  "userIssues": [
    "Specific problem explicitly mentioned by users in the chat"
  ],

  "openQuestions": [
    "Unresolved question or debate explicitly raised in the chat"
  ],

  "developmentsToWatch": [
    "Specific future development mentioned or implied that would meaningfully change the subnet's trajectory"
  ],

  "messageCount": 0,
  "analyzedDays": 30
}

HARD RULES:
- mainTopics must list EVERY distinct topic discussed — aim for 6-12 topics minimum if the content is rich
- Each mainTopics entry needs at least 3 bulletPoints with specific details
- positives and concerns must each have 3-5 entries with real evidence
- developmentsToWatch must have 5-8 specific items
- investabilityScore must be a number between 1.0 and 10.0
- scoreLabel must match: 9-10=Strong Buy, 7-8.9=Buy, 5-6.9=Hold, 3-4.9=Caution, 1-2.9=Avoid
- All breakdown scores must be numbers between 1.0 and 10.0
- Never use null — use empty arrays [] for missing array fields, empty string "" for missing strings`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 4000,
    json: true,
  });

  let result;
  try {
    const text = response.choices[0].message.content
      .replace(/```json|```/g, "")
      .trim();
    result = JSON.parse(text);
  } catch {
    result = {
      subnetName: targetName,
      oneLiner: "Analysis parsing failed.",
      briefDescription: response.choices[0].message.content.substring(0, 200),
      investabilityScore: null,
      mainTopics: [],
      positives: [],
      concerns: [],
      emergingSignals: [],
      userIssues: [],
      openQuestions: [],
      developmentsToWatch: [],
      overallSentiment: "neutral",
    };
  }

  // Ensure messageCount is set
  if (!result.messageCount || result.messageCount === 0) {
    result.messageCount = approxMsgCount;
  }

  return result;
}

module.exports = {
  generateDailySummary,
  analyzeTrends,
  analyzeSentiment,
  customAnalysis,
  analyzeMultipleChannels,
};
