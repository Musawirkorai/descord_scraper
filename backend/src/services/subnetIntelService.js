const Groq = require("groq-sdk");
const Message = require("../models/Message");
const SubnetConfig = require("../models/SubnetConfig");
const { getSubnetMeta } = require("../utils/subnetMeta");
const logger = require("../utils/logger");

const openai = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

const SAMPLE_THRESHOLD = 500;
const SAMPLE_SIZE = 300;

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

  const formatted = messages
    .map((m) => {
      let text = cleanContent(m.content);
      if (m.extractedText)
        text += `\n[File]: ${m.extractedText.substring(0, 400)}`;
      return text;
    })
    .filter((t) => t.length > 8)
    .map((t, i) => `${i + 1}. ${t.substring(0, 600)}`)
    .join("\n");

  logger.info(`Formatted text: ${formatted.length} chars`);

  return { text: formatted, total, sampled: messages.length, samplingMethod };
}

// ── TOPICS ANALYSIS — exhaustive, no merging
async function analyzeTopics(
  channelName,
  subnetNumber,
  msgText,
  sampled,
  total,
) {
  const samplingNote =
    total > SAMPLE_THRESHOLD
      ? `(${sampled} messages randomly sampled from ${total} total using stratified daily sampling)`
      : `(all ${sampled} messages analyzed)`;

  const prompt = `You are a HIGH-ACCURACY CHAT ANALYSIS SYSTEM analyzing a Bittensor subnet Discord channel.

Channel: ${channelName} — Subnet ${subnetNumber}
Messages analyzed: ${samplingNote}

CRITICAL RULES — READ CAREFULLY:
- You MUST list EVERY distinct topic discussed — including minor ones mentioned only once or twice
- You MUST NOT merge separate topics into one broad category
- Each technical issue, bug report, feature request, debate, announcement is its OWN topic
- If 8 different things were discussed, list 8 topics — not 3 merged ones
- Keep topic titles close to the exact wording used in the chat
- Do NOT skip anything — missing a topic is a failure
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
- raiseTo9 MUST contain at least 5 distinct, specific bullet points — never fewer

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

// ── CHAT: answer a custom question about a subnet
async function answerSubnetQuestion(
  channelId,
  subnetName,
  question,
  days = 30,
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

// ── MAIN: analyze one subnet (two sequential LLM calls)
async function analyzeSubnet(channelId, channelName, subnetNumber, days = 30) {
  logger.info(`Analyzing subnet ${subnetNumber} — #${channelName}`);

  const {
    text: msgText,
    total,
    sampled,
    samplingMethod,
  } = await fetchChannelMessages(channelId, days);

  if (!msgText || sampled < 5) {
    logger.warn(`Subnet ${subnetNumber}: not enough messages (${sampled})`);
    return null;
  }

  // Call 1 — topics (exhaustive)
  const topics = await analyzeTopics(
    channelName,
    subnetNumber,
    msgText,
    sampled,
    total,
  );

  // 2s gap to avoid Groq rate limit
  await new Promise((r) => setTimeout(r, 2000));

  // Call 2 — investability (uses topics as context)
  const invest = await analyzeInvestability(
    channelName,
    subnetNumber,
    msgText,
    topics,
  );

  // Apply user-managed config (name/description) so Subnet Settings edits take effect
  const identity = await resolveSubnetIdentity(
    subnetNumber,
    topics.subnetName,
    channelName,
  );

  return {
    // Identity
    subnetName: identity.name,
    briefDescription:
      identity.configuredDescription || topics.briefDescription || "",
    oneLiner: topics.oneLiner || "",

    // Sentiment
    overallSentiment: topics.overallSentiment || "neutral",
    sentimentDetail: topics.sentimentDetail || "",

    // Topics — the main section
    mainTopics: topics.mainTopics || [],

    // Signals & issues
    emergingSignals: topics.emergingSignals || [],
    userIssues: topics.userIssues || [],
    openQuestions: topics.openQuestions || [],
    developmentsToWatch: topics.developmentsToWatch || [],

    // Investability
    investabilityScore: invest.investabilityScore,
    scoreLabel: invest.scoreLabel || "",
    investabilityBreakdown: invest.investabilityBreakdown || {},
    positives: invest.positives || [],
    concerns: invest.concerns || [],
    whatImpresses: invest.whatImpresses || "",
    raiseTo9: invest.raiseTo9 || [],
    lowerRating: invest.lowerRating || "",
    comparisonContext: invest.comparisonContext || "",
    bottomLine: invest.bottomLine || "",

    // Meta
    messageCount: sampled,
    totalMessages: total,
    samplingMethod,
    analyzedDays: days,
  };
}

module.exports = { analyzeSubnet, answerSubnetQuestion, fetchChannelMessages };