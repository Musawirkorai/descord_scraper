/**
 * Groq API key pool
 * ─────────────────
 * Wraps one or more Groq API keys behind the same interface as the Groq SDK
 * client (`.chat.completions.create(...)`), so callers need no changes.
 *
 * Configure EITHER:
 *   GROQ_API_KEY=gsk_single_key            ← one key (e.g. a paid key)
 *   GROQ_API_KEYS=gsk_a,gsk_b,gsk_c        ← several free keys, comma separated
 *
 * With a single key this is a thin pass-through — no rotation, no behaviour
 * change. That is the intended shape once a paid key removes the daily cap.
 *
 * With several keys, a key that reports a rate limit (429 — either requests/min
 * or the free tier's tokens-per-day ceiling) is put on cooldown until its stated
 * reset and the next key is tried immediately. A key that reports bad
 * credentials (401/403) is dropped for the rest of the process.
 *
 * Rotation is instant; WAITING is deliberately bounded. If every key is cooling
 * down, we only sleep when the shortest remaining cooldown is under
 * GROQ_MAX_WAIT_MS (default 60s). A tokens-per-day limit resets hours later, and
 * blocking a report run for hours is worse than failing it, so that throws.
 */

const Groq = require("groq-sdk");
const logger = require("../utils/logger");

const DEFAULT_MAX_WAIT_MS = 60_000;
const FALLBACK_COOLDOWN_MS = 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Key loading ──────────────────────────────────────────────────────────────
// GROQ_API_KEYS wins when both are set, but GROQ_API_KEY is folded in too so a
// single key in the old variable keeps working untouched.
function loadKeys() {
  const raw = [process.env.GROQ_API_KEYS, process.env.GROQ_API_KEY]
    .filter(Boolean)
    .join(",");
  return [...new Set(raw.split(/[,\s]+/).map((k) => k.trim()).filter(Boolean))];
}

// Identify a key in logs by position + last 4 chars — never the key itself.
function label(entry, i) {
  return `key#${i + 1}(…${entry.key.slice(-4)})`;
}

let pool = null;

function getPool() {
  if (pool) return pool;

  const keys = loadKeys();
  if (keys.length === 0) {
    throw new Error(
      "No Groq API key configured — set GROQ_API_KEY or GROQ_API_KEYS in .env.",
    );
  }

  pool = keys.map((key) => ({
    key,
    client: new Groq({ apiKey: key }),
    cooldownUntil: 0, // epoch ms; 0 = available
    disabled: false, // set on bad credentials
  }));

  logger.info(
    `Groq pool: ${pool.length} API key(s) loaded${pool.length > 1 ? " — will rotate on rate limit" : ""}.`,
  );
  return pool;
}

// ── Error classification ─────────────────────────────────────────────────────
function isRateLimit(err) {
  if (err?.status === 429) return true;
  if (err?.error?.error?.code === "rate_limit_exceeded") return true;
  // Only fall back to text matching when there is no HTTP status to trust —
  // otherwise a 400 that merely mentions rate limits would cool a healthy key.
  if (err?.status == null) return /rate.?limit/i.test(err?.message || "");
  return false;
}

function isBadCredentials(err) {
  if (err?.status === 401 || err?.status === 403) return true;
  return /invalid.?api.?key|unauthor/i.test(err?.message || "");
}

// How long until this key is usable again. Prefers the Retry-After header, then
// the duration Groq embeds in the message ("Please try again in 11m1.824s").
function parseWaitMs(err) {
  const header =
    err?.headers?.["retry-after"] ?? err?.headers?.get?.("retry-after");
  const headerSec = Number(header);
  if (Number.isFinite(headerSec) && headerSec > 0) return headerSec * 1000;

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
  const v = Number(process.env.GROQ_MAX_WAIT_MS);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_MAX_WAIT_MS;
}

// ── The call ─────────────────────────────────────────────────────────────────
async function createCompletion(params) {
  const keys = getPool();
  // Enough attempts for every key to be tried, plus one pass after a wait.
  const maxAttempts = keys.length * 2 + 1;
  let lastErr = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const now = Date.now();
    const idx = keys.findIndex((e) => !e.disabled && e.cooldownUntil <= now);

    if (idx === -1) {
      // Nothing available right now. Either everything is dead, or we could wait.
      const cooling = keys.filter((e) => !e.disabled);
      if (cooling.length === 0) {
        throw (
          lastErr ||
          new Error("All Groq API keys were rejected as invalid — check .env.")
        );
      }

      const waitMs = Math.min(...cooling.map((e) => e.cooldownUntil)) - now;
      if (waitMs > maxWaitMs()) {
        const mins = Math.round(waitMs / 60000);
        throw (
          lastErr ||
          new Error(
            `All ${cooling.length} Groq key(s) rate limited; soonest reset in ~${mins}m.`,
          )
        );
      }
      logger.warn(
        `Groq: all keys rate limited — waiting ${Math.ceil(waitMs / 1000)}s for the soonest reset.`,
      );
      await sleep(Math.max(waitMs, 0) + 250);
      continue;
    }

    const entry = keys[idx];
    try {
      const res = await entry.client.chat.completions.create(params);
      if (attempt > 0) {
        logger.info(`Groq: succeeded on ${label(entry, idx)}.`);
      }
      return res;
    } catch (err) {
      lastErr = err;

      if (isBadCredentials(err)) {
        entry.disabled = true;
        logger.warn(
          `Groq ${label(entry, idx)} rejected (bad credentials) — dropping it for this process.`,
        );
        continue;
      }

      if (isRateLimit(err)) {
        const waitMs = parseWaitMs(err);
        entry.cooldownUntil = Date.now() + waitMs;
        const others = keys.filter(
          (e) => e !== entry && !e.disabled && e.cooldownUntil <= Date.now(),
        ).length;
        logger.warn(
          `Groq ${label(entry, idx)} rate limited — cooling down ${Math.ceil(waitMs / 1000)}s. ` +
            (others > 0
              ? `Rotating to the next key (${others} available).`
              : "No other key available right now."),
        );
        continue;
      }

      // Anything else (bad model id, malformed request, network) is not something
      // another key would fix — surface it immediately rather than burning keys.
      throw err;
    }
  }

  throw lastErr || new Error("Groq request failed across all keys.");
}

// Mirror the Groq SDK surface so `openai.chat.completions.create(...)` callers
// work with no changes at the call site.
module.exports = {
  chat: { completions: { create: createCompletion } },
  // Exposed for diagnostics / tests.
  _loadKeys: loadKeys,
  _parseWaitMs: parseWaitMs,
  _reset: () => {
    pool = null;
  },
};
