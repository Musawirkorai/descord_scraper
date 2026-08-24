/**
 * Standalone Discord client for scripts
 * ─────────────────────────────────────
 * The scheduler backfills fresh Discord history only when it is handed a live
 * client (see `processSubnet` in services/subnetScheduler.js). The manual run
 * scripts used to pass `null`, so they could only ever analyze whatever was
 * already in Mongo — which silently produced GitHub-only reports whenever the
 * backend had not been running to ingest messages live.
 *
 * This gives those scripts a real, short-lived client. Read-only intents; no
 * event listeners, since it exists purely to fetch channel history.
 */

const { Client, GatewayIntentBits, Partials, Events } = require("discord.js");
const logger = require("../utils/logger");

const LOGIN_TIMEOUT_MS = 30_000;

/**
 * Log in a throwaway client. Returns null (never throws) when no token is set
 * or login fails, so a caller can degrade to DB-only analysis instead of dying.
 */
async function createScraperClient() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    logger.warn(
      "DISCORD_BOT_TOKEN not set — skipping Discord backfill, analyzing stored messages only.",
    );
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`login timed out after ${LOGIN_TIMEOUT_MS}ms`)),
        LOGIN_TIMEOUT_MS,
      );
      client.once(Events.ClientReady, () => {
        clearTimeout(timer);
        resolve();
      });
      client.once(Events.Error, (e) => {
        clearTimeout(timer);
        reject(e);
      });
      client.login(process.env.DISCORD_BOT_TOKEN).catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  } catch (err) {
    logger.error(`Discord login failed: ${err.message} — continuing without backfill.`);
    await client.destroy().catch(() => {});
    return null;
  }

  logger.info(`✅ Discord client ready as ${client.user.tag} (backfill enabled)`);
  return client;
}

/** Tear the client down so the process can exit cleanly. Never throws. */
async function destroyScraperClient(client) {
  if (!client) return;
  await client.destroy().catch(() => {});
}

module.exports = { createScraperClient, destroyScraperClient };
