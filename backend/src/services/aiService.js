// const OpenAI = require('openai');
const { cacheGet, cacheSet } = require("../config/redis");
const AiResult = require("../models/AiResult");
const Message = require("../models/Message");
const logger = require("../utils/logger");

const Groq = require("groq-sdk");
const openai = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

/**
 * Generate a cache key for AI operations
 */
function buildCacheKey(type, scope, targetId, dateStr) {
  return `ai:${type}:${scope}:${targetId}:${dateStr}`;
}

/**
 * Fetch messages for a given scope and date range
 */
async function fetchMessagesForAnalysis(
  scope,
  targetId,
  from,
  to,
  limit = 500,
) {
  const query = { discordCreatedAt: { $gte: from, $lte: to } };
  if (scope === "channel") query.channelId = targetId;
  if (scope === "server") query.serverId = targetId;
  if (scope === "user") query.authorId = targetId;

  const msgs = await Message.find(query)
    .sort({ discordCreatedAt: 1 })
    .limit(limit)
    .select("content authorUsername discordCreatedAt sentiment keywords");

  return msgs;
}

/**
 * Format messages for LLM prompt
 */
function formatMessagesForPrompt(messages) {
  return messages
    .filter((m) => m.content?.trim())
    .map((m) => `[${m.authorUsername}]: ${m.content.substring(0, 500)}`)
    .join("\n");
}

/**
 * Daily summary generation
 */
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
  const cacheKey = buildCacheKey("daily_summary", scope, targetId, dateStr);

  // Check Redis cache
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  // Check MongoDB cache
  const dbCached = await AiResult.findOne({ cacheKey });
  if (dbCached) {
    await cacheSet(cacheKey, dbCached.result, 3600);
    return dbCached.result;
  }

  const messages = await fetchMessagesForAnalysis(scope, targetId, from, to);
  if (messages.length === 0)
    return { summary: "No messages found for this period.", messageCount: 0 };

  const msgText = formatMessagesForPrompt(messages);
  const prompt = `You are analyzing Discord/community messages from "${targetName}" for ${dateStr}.

Messages:
${msgText}

Generate a concise daily summary as JSON with these exact fields:
{
  "summary": "2-3 paragraph overview of main discussions",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "sentiment": "positive|negative|neutral|mixed",
  "highlights": ["notable moment 1", "notable moment 2"],
  "activeUsers": ["username1", "username2"],
  "messageCount": ${messages.length},
  "date": "${dateStr}"
}

Return ONLY valid JSON, no markdown.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 1000,
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

  // Store in both caches
  await cacheSet(cacheKey, result, 86400);
  await AiResult.findOneAndUpdate(
    { cacheKey },
    {
      type: "daily_summary",
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

/**
 * Trend analysis over a date range
 */
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
  const prompt = `Analyze the following community messages from the last ${days} days for "${targetName}".

${msgText}

Return a JSON object with:
{
  "trendingTopics": [{"topic": "string", "frequency": number, "sentiment": "positive|negative|neutral"}],
  "keywordClusters": [{"cluster": "string", "keywords": ["k1","k2"]}],
  "overallSentiment": "positive|negative|neutral|mixed",
  "peakActivityPeriods": ["description"],
  "notableThemes": ["theme1", "theme2"],
  "summary": "paragraph summary of trends"
}

Return ONLY valid JSON.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 1500,
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
  result.messageCount = messages.length;
  result.analyzedDays = days;

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

/**
 * Sentiment analysis for a channel/server
 */
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
  const prompt = `Perform sentiment analysis on these messages:

${msgText}

Return JSON:
{
  "overall": "positive|negative|neutral|mixed",
  "positivePercent": number,
  "negativePercent": number,
  "neutralPercent": number,
  "emotionalTone": "description",
  "mostPositiveTopics": ["topic"],
  "mostNegativeTopics": ["topic"]
}

Return ONLY valid JSON.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 800,
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

/**
 * Custom query analysis
 */
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
  const prompt = `Based on these community messages:

${msgText}

Answer this question: ${question}

Be concise, data-driven, and cite specific examples from the messages.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 1000,
  });

  return {
    answer: response.choices[0].message.content,
    messageCount: messages.length,
  };
}

module.exports = {
  generateDailySummary,
  analyzeTrends,
  analyzeSentiment,
  customAnalysis,
};
