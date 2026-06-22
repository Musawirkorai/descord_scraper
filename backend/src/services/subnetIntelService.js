const Groq = require("groq-sdk");
const Message = require("../models/Message");
const logger = require("../utils/logger");

const openai = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

const SAMPLE_THRESHOLD = 500;
const SAMPLE_SIZE = 300;

// ── clean Discord noise from message content
function cleanContent(content) {
  if (!content) return "";
  let t = content;
  t = t.replace(/^[^\n—]{1,60}—\s*(Yesterday at\s*)?\d{1,2}:\d{2}\s*(AM|PM)?\s*$/gim, "");
  t = t.replace(/[A-Za-z0-9_.\- ]{1,40}—\s*(Yesterday at\s*)?\d{1,2}:\d{2}\s*(AM|PM)?\s*/g, "");
  t = t.replace(/@[A-Za-z0-9_.\- ]{1,40}(\s*[\[【][^\]】]{0,30}[\]】])*(\s+SN\d+)?/g, "");
  t = t.replace(/Role icon,\s*[^\n]*/gi, "");
  t = t.replace(/[\[【][τА-Яא-תa-zA-Z,\s.ף]+[\]】]/g, "");
  t = t.replace(/https?:\/\/\S+/g, "");
  t = t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
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
          { $match: { channelId, discordCreatedAt: { $gte: dayStart, $lt: dayEnd } } },
          { $sample: { size: perDay } },
          { $project: { content: 1, discordCreatedAt: 1, extractedText: 1 } },
        ])
      );
    }

    const results = await Promise.all(buckets);
    messages = results.flat().sort(
      (a, b) => new Date(a.discordCreatedAt) - new Date(b.discordCreatedAt)
    );
  }

  logger.info(`Channel ${channelId}: ${total} total → ${messages.length} used (${samplingMethod})`);

  const formatted = messages
    .map((m) => {
      let text = cleanContent(m.content);
      if (m.extractedText) text += `\n[File]: ${m.extractedText.substring(0, 400)}`;
      return text;
    })
    .filter((t) => t.length > 8)
    .map((t, i) => `${i + 1}. ${t.substring(0, 500)}`)
    .join("\n");

  return { text: formatted, total, sampled: messages.length, samplingMethod };
}

// ── TOPICS ANALYSIS
async function analyzeTopics(channelName, subnetNumber, msgText, sampled, total) {
  const samplingNote =
    total > SAMPLE_THRESHOLD
      ? `(${sampled} messages randomly sampled from ${total} total using stratified daily sampling)`
      : `(all ${sampled} messages analyzed)`;

  const prompt = `You are a HIGH-ACCURACY CHAT ANALYSIS SYSTEM analyzing a Bittensor subnet Discord channel.

Channel: ${channelName} — Subnet ${subnetNumber}
Messages analyzed: ${samplingNote}

HARD RULES:
- NEVER invent topics not explicitly present in the messages
- NEVER add external knowledge or assume missing context  
- Keep topic labels close to original wording from the chat
- No usernames in output
- If uncertain → mark LOW CONFIDENCE

MESSAGES:
${msgText}

Extract the main topics discussed. Structure as a comprehensive numbered report like a research brief.

Return ONLY this JSON, no markdown:
{
  "subnetName": "inferred subnet name from context e.g. Apex, ScoreVision, Chutes",
  "briefDescription": "2-3 sentence description of what this subnet does based on the discussion",
  "mainTopics": [
    {
      "title": "Topic title e.g. Mining and Model Development",
      "description": "1-2 sentence overview of this topic",
      "bulletPoints": ["specific point from discussion", "specific point"]
    }
  ],
  "oneLiner": "One sentence capturing the core purpose of this subnet channel",
  "overallSentiment": "positive|negative|neutral|mixed",
  "sentimentDetail": "1-2 sentences explaining what drives the sentiment",
  "emergingSignals": [
    {
      "signal": "signal name",
      "description": "what exactly was discussed",
      "evidence": "short direct reference from chat",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],
  "userIssues": ["real problem explicitly mentioned"],
  "openQuestions": ["unresolved question explicitly raised"],
  "developmentsToWatch": ["future development that would change the subnet trajectory"]
}`;

  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 2500,
  });

  const text = res.choices[0].message.content.replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}

// ── INVESTABILITY ANALYSIS
async function analyzeInvestability(channelName, subnetNumber, msgText, topicsResult) {
  const topicsSummary = (topicsResult.mainTopics || [])
    .map((t) => `${t.title}: ${t.description}`)
    .join("\n");

  const prompt = `You are a professional Bittensor subnet investment analyst.

Channel: ${channelName} — Subnet ${subnetNumber}
Subnet: ${topicsResult.subnetName || "Unknown"}

Topics discussed:
${topicsSummary}

Message sample:
${msgText.substring(0, 3500)}

HARD RULES:
- Base analysis ONLY on what is in the messages
- NEVER invent revenue, clients, or features not mentioned
- Be honest about weaknesses — don't inflate scores
- No usernames in output

Evaluate investability of this subnet strictly from the community discussion.

Return ONLY this JSON, no markdown:
{
  "investabilityScore": number 1.0-10.0,
  "scoreLabel": "e.g. Strong Buy | Buy | Neutral | Caution | Avoid",
  "investabilityBreakdown": {
    "technology": number,
    "teamExecution": number,
    "commercialPotential": number,
    "economicMaturity": number,
    "decentralization": number
  },
  "positives": [
    {
      "category": "category name",
      "score": number,
      "detail": "2-3 sentences grounded in the discussion"
    }
  ],
  "concerns": [
    {
      "category": "concern name",
      "score": number,
      "detail": "2-3 sentences grounded in the discussion"
    }
  ],
  "whatImpresses": "2-3 sentences on what stands out most from the discussion",
  "raiseTo9": "What specific evidence would push this above 9/10",
  "lowerRating": "What developments would lower the rating",
  "comparisonContext": "1-2 sentences placing this subnet vs typical Bittensor subnets",
  "bottomLine": "2-3 sentence investment summary"
}`;

  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 2500,
  });

  const text = res.choices[0].message.content.replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}

// ── CHAT: answer a custom question about a subnet
async function answerSubnetQuestion(channelId, subnetName, question, days = 30) {
  const { text: msgText, total, sampled } = await fetchChannelMessages(channelId, days);

  if (!msgText) return { answer: "Not enough message data to answer this question." };

  const prompt = `You are analyzing the Discord community of the Bittensor subnet "${subnetName}".

Messages from the past ${days} days (${sampled} of ${total} total, usernames removed):
${msgText.substring(0, 4000)}

HARD RULES:
- Answer ONLY based on what is in the messages
- NEVER invent facts or add external knowledge
- If the answer is not in the messages, say so clearly
- Use bullet points for clarity
- No usernames in output
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
    messageCount: sampled,
    totalMessages: total,
  };
}

// ── MAIN: analyze one subnet
async function analyzeSubnet(channelId, channelName, subnetNumber, days = 30) {
  logger.info(`Analyzing subnet ${subnetNumber} — #${channelName}`);

  const { text: msgText, total, sampled, samplingMethod } = await fetchChannelMessages(channelId, days);

  if (!msgText || sampled < 5) {
    logger.warn(`Subnet ${subnetNumber}: not enough messages (${sampled})`);
    return null;
  }

  const topics = await analyzeTopics(channelName, subnetNumber, msgText, sampled, total);
  await new Promise((r) => setTimeout(r, 1500));
  const invest = await analyzeInvestability(channelName, subnetNumber, msgText, topics);

  return {
    subnetName: topics.subnetName || channelName,
    briefDescription: topics.briefDescription || "",
    mainTopics: topics.mainTopics || [],
    oneLiner: topics.oneLiner || "",
    overallSentiment: topics.overallSentiment || "neutral",
    sentimentDetail: topics.sentimentDetail || "",
    emergingSignals: topics.emergingSignals || [],
    userIssues: topics.userIssues || [],
    openQuestions: topics.openQuestions || [],
    developmentsToWatch: topics.developmentsToWatch || [],
    investabilityScore: invest.investabilityScore,
    scoreLabel: invest.scoreLabel || "",
    investabilityBreakdown: invest.investabilityBreakdown || {},
    positives: invest.positives || [],
    concerns: invest.concerns || [],
    whatImpresses: invest.whatImpresses || "",
    raiseTo9: invest.raiseTo9 || "",
    lowerRating: invest.lowerRating || "",
    comparisonContext: invest.comparisonContext || "",
    bottomLine: invest.bottomLine || "",
    messageCount: sampled,
    totalMessages: total,
    samplingMethod,
    analyzedDays: days,
  };
}

module.exports = { analyzeSubnet, answerSubnetQuestion, fetchChannelMessages };