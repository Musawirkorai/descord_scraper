/**
 * LLM provider router
 * ───────────────────
 * Presents the OpenAI/Groq SDK surface (`.chat.completions.create(...)`) so no
 * call site needs to know which provider is in use, and picks the provider from
 * env:
 *
 *   LLM_PROVIDER=gemini   ← Google AI Studio (default when GEMINI_API_KEY is set)
 *   LLM_PROVIDER=groq     ← Groq, delegated untouched to ./groqPool
 *
 * WHY GEMINI IS THE DEFAULT
 * A single subnet report makes 5 sequential calls, and one call sends ~20-30k
 * input tokens (up to 800 chat messages, or 400 GitHub items). Groq's free tier
 * for gpt-oss-120b allows 8k tokens PER MINUTE and 200k per day, so one call is
 * roughly 3x the entire per-minute budget and a full day's batch of ~15 calls is
 * several times the daily budget. That tier cannot complete one run — it shows
 * up as "no report created". Gemini's free tier is bounded by requests/day
 * (~250 for Flash) rather than tokens/day, so ~15 calls/day fits with room to
 * spare, and the 1M context removes the truncation this pipeline works around.
 *
 * NOTE ON KEY ROTATION
 * Groq applies rate limits per ORGANIZATION, not per key, so rotating several
 * keys from one Groq account buys no extra capacity (see ./groqPool). Gemini
 * quota is per PROJECT, so keys from genuinely separate Google Cloud projects do
 * add capacity. The pool below is still worth having for resilience either way,
 * but do not expect extra Groq throughput from extra Groq keys.
 *
 * Gemini is reached through its OpenAI-compatible endpoint using the `openai`
 * package that is already a dependency, so this adds no new packages and the
 * standard `response_format: { type: "json_object" }` keeps working.
 */

const OpenAI = require("openai");
const logger = require("../utils/logger");

const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta/openai/";

// gemini-2.5-flash is on the free tier and has a 1M context. Google rotates
// model ids, so override with GEMINI_MODEL if this ever 404s. To see what your
// key can actually reach:
//   curl -H "x-goog-api-key: $GEMINI_API_KEY" \
//     https://generativelanguage.googleapis.com/v1beta/models
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

const DEFAULT_MAX_WAIT_MS = 60_000;
const FALLBACK_COOLDOWN_MS = 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Provider selection ───────────────────────────────────────────────────────
function pickProvider() {
  const explicit = (process.env.LLM_PROVIDER || "").trim().toLowerCase();
  if (explicit === "gemini" || explicit === "google") return "gemini";
  if (explicit === "groq") return "groq";

  // No explicit choice: prefer Gemini when it is configured, else fall back to
  // Groq so an existing .env with only GROQ_API_KEY keeps working untouched.
  const hasGemini = !!(
    process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY
  );
  return hasGemini ? "gemini" : "groq";
}

const PROVIDER = pickProvider();

// ── Model + capability surface ───────────────────────────────────────────────
// Exported so aiService / subnetIntelService stop hardcoding a Groq model id.
function resolveModel() {
  if (PROVIDER === "gemini") {
    return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  }
  return process.env.GROQ_MODEL || "openai/gpt-oss-120b";
}

const MODEL = resolveModel();

// Gemini Flash carries a 1M-token context; gpt-oss-120b carries 131k. Callers
// use this to decide whether they must down-sample a month of chat to fit.
const IS_LONG_CONTEXT = PROVIDER === "gemini";

// ── Key loading + error classification ───────────────────────────────────────
function loadKeys(...envVars) {
  const raw = envVars.filter(Boolean).join(",");
  return [
    ...new Set(
      raw
        .split(/[,\s]+/)
        .map((k) => k.trim())
        .filter(Boolean),
    ),
  ];
}

function isRateLimit(err) {
  if (err?.status === 429) return true;
  if (err?.error?.error?.code === "rate_limit_exceeded") return true;
  if (err?.error?.error?.status === "RESOURCE_EXHAUSTED") return true;
  // Only fall back to text matching when there is no HTTP status to trust —
  // otherwise a 400 that merely mentions rate limits would cool a healthy key.
  if (err?.status == null) {
    return /rate.?limit|resource.?exhausted/i.test(err?.message || "");
  }
  return false;
}

function isBadCredentials(err) {
  if (err?.status === 401 || err?.status === 403) return true;
  return /invalid.?api.?key|api key not valid|unauthor|permission.?denied/i.test(
    err?.message || "",
  );
}

// How long until this key is usable again. Prefers Retry-After, then Google's
// `retryDelay: "31s"` detail, then a duration embedded in the message.
function parseWaitMs(err) {
  const header =
    err?.headers?.["retry-after"] ?? err?.headers?.get?.("retry-after");
  const headerSec = Number(header);
  if (Number.isFinite(headerSec) && headerSec > 0) return headerSec * 1000;

  let body = "";
  try {
    body = JSON.stringify(err?.error ?? {});
  } catch {
    body = "";
  }
  const retryDelay = body.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
  if (retryDelay) return Number(retryDelay[1]) * 1000;

  const msg = err?.message || "";
  const hms = msg.match(/try again in\s+(?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i);
  if (hms) {
    const [, h, m, s] = hms;
    return (
      ((Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0)) * 1000
    );
  }
  return FALLBACK_COOLDOWN_MS;
}

function maxWaitMs() {
  const v = Number(process.env.LLM_MAX_WAIT_MS ?? process.env.GROQ_MAX_WAIT_MS);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_MAX_WAIT_MS;
}

// ── Generic key pool ─────────────────────────────────────────────────────────
// Same contract as ./groqPool: a key that reports a rate limit is cooled down
// until its stated reset and the next key is tried immediately; a key that
// reports bad credentials is dropped for the rest of the process. Rotation is
// instant, waiting is bounded.
function createKeyPool({ name, keys, makeClient, missingKeyHint }) {
  let pool = null;

  function getPool() {
    if (pool) return pool;
    if (keys.length === 0) throw new Error(missingKeyHint);

    pool = keys.map((key) => ({
      key,
      client: makeClient(key),
      cooldownUntil: 0, // epoch ms; 0 = available
      disabled: false, // set on bad credentials
    }));

    logger.info(
      `${name} pool: ${pool.length} API key(s) loaded` +
        (pool.length > 1 ? " — will rotate on rate limit." : "."),
    );
    return pool;
  }

  // Identify a key in logs by position + last 4 chars — never the key itself.
  const label = (entry, i) => `key#${i + 1}(…${entry.key.slice(-4)})`;

  async function create(params) {
    const entries = getPool();
    // Enough attempts for every key to be tried, plus one pass after a wait.
    const maxAttempts = entries.length * 2 + 1;
    let lastErr = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const now = Date.now();
      const idx = entries.findIndex(
        (e) => !e.disabled && e.cooldownUntil <= now,
      );

      if (idx === -1) {
        // Nothing available right now. Either everything is dead, or we could wait.
        const cooling = entries.filter((e) => !e.disabled);
        if (cooling.length === 0) {
          throw (
            lastErr ||
            new Error(
              `All ${name} API keys were rejected as invalid — check .env.`,
            )
          );
        }

        const waitMs = Math.min(...cooling.map((e) => e.cooldownUntil)) - now;
        if (waitMs > maxWaitMs()) {
          const mins = Math.round(waitMs / 60000);
          throw (
            lastErr ||
            new Error(
              `All ${cooling.length} ${name} key(s) rate limited; soonest reset in ~${mins}m.`,
            )
          );
        }
        logger.warn(
          `${name}: all keys rate limited — waiting ${Math.ceil(waitMs / 1000)}s for the soonest reset.`,
        );
        await sleep(Math.max(waitMs, 0) + 250);
        continue;
      }

      const entry = entries[idx];
      try {
        const res = await entry.client.chat.completions.create(params);
        if (attempt > 0) {
          logger.info(`${name}: succeeded on ${label(entry, idx)}.`);
        }
        return res;
      } catch (err) {
        lastErr = err;

        if (isBadCredentials(err)) {
          entry.disabled = true;
          logger.warn(
            `${name} ${label(entry, idx)} rejected (bad credentials) — dropping it for this process.`,
          );
          continue;
        }

        if (isRateLimit(err)) {
          const waitMs = parseWaitMs(err);
          entry.cooldownUntil = Date.now() + waitMs;
          const others = entries.filter(
            (e) => e !== entry && !e.disabled && e.cooldownUntil <= Date.now(),
          ).length;
          logger.warn(
            `${name} ${label(entry, idx)} rate limited — cooling down ${Math.ceil(waitMs / 1000)}s. ` +
              (others > 0
                ? `Rotating to the next key (${others} available).`
                : "No other key available right now."),
          );
          continue;
        }

        // Anything else (bad model id, malformed request, network) is not
        // something another key would fix — surface it immediately.
        throw err;
      }
    }

    throw lastErr || new Error(`${name} request failed across all keys.`);
  }

  return {
    create,
    _reset: () => {
      pool = null;
    },
  };
}

// ── Wire up the selected provider ────────────────────────────────────────────
let backend;

if (PROVIDER === "gemini") {
  backend = createKeyPool({
    name: "Gemini",
    keys: loadKeys(process.env.GEMINI_API_KEYS, process.env.GEMINI_API_KEY),
    // maxRetries: 0 is deliberate. The SDK's default (2 retries) would retry a
    // 429 against the SAME exhausted key three times before this pool ever got
    // to rotate — and Gemini's free tier is bounded by REQUESTS per day, so
    // those wasted attempts eat the exact quota we are trying to conserve.
    // Retry and rotation are this pool's job.
    makeClient: (apiKey) =>
      new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL, maxRetries: 0 }),
    missingKeyHint:
      "No Gemini API key configured — set GEMINI_API_KEY (or GEMINI_API_KEYS) in .env, " +
      "or set LLM_PROVIDER=groq to use Groq instead.",
  });
  logger.info(`LLM provider: Gemini (model ${MODEL}, long-context mode on).`);
} else {
  // Delegate to the existing Groq pool so Groq behaviour is entirely unchanged.
  const groqPool = require("./groqPool");
  backend = { create: (params) => groqPool.chat.completions.create(params) };
  logger.info(`LLM provider: Groq (model ${MODEL}).`);
}

// `json: true` is our own shorthand for "this call site parses the reply with
// JSON.parse". It is translated to the standard response_format and never
// forwarded verbatim, since providers reject unknown fields.
function normalizeParams(params) {
  const { json, ...rest } = params;
  if (json && !rest.response_format) {
    rest.response_format = { type: "json_object" };
  }
  return rest;
}

// A provider that rejects `response_format` outright would otherwise 400 every
// JSON call and take down every report. The prompts already specify the exact
// JSON shape and every call site strips ``` fences before parsing, so dropping
// the parameter degrades reliability slightly rather than breaking the run.
function rejectsResponseFormat(err) {
  if (err?.status !== 400) return false;
  const text = `${err?.message || ""} ${JSON.stringify(err?.error ?? {})}`;
  return /response_?format|response_?mime_?type|responseSchema/i.test(text);
}

let responseFormatUnsupported = false;

async function createCompletion(params) {
  const normalized = normalizeParams(params);

  if (responseFormatUnsupported && normalized.response_format) {
    const { response_format, ...rest } = normalized;
    return backend.create(rest);
  }

  try {
    return await backend.create(normalized);
  } catch (err) {
    if (normalized.response_format && rejectsResponseFormat(err)) {
      // Latch it so we stop paying a failed request per call for the rest of
      // the process — on a request-per-day free tier that matters.
      responseFormatUnsupported = true;
      logger.warn(
        `${PROVIDER}: model ${MODEL} rejected response_format — retrying without ` +
          "JSON mode and disabling it for this process. Prompt-instructed JSON " +
          "still applies.",
      );
      const { response_format, ...rest } = normalized;
      return backend.create(rest);
    }
    throw err;
  }
}

module.exports = {
  // Mirror the OpenAI/Groq SDK surface so call sites need no changes.
  chat: { completions: { create: createCompletion } },
  PROVIDER,
  MODEL,
  IS_LONG_CONTEXT,
  // Exposed for diagnostics / tests.
  _loadKeys: loadKeys,
  _parseWaitMs: parseWaitMs,
};
