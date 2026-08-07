const { Client, GatewayIntentBits } = require('discord.js');
const logger = require('../utils/logger');
// const { saveMessage } = require('./messageService');
const { saveMessageWithFiles } = require('./messageService');
const Channel = require('../models/Channel');

const BATCH_SIZE = 100; // Discord API max per request
const DELAY_MS = 1000;  // 1 second between batches (rate limit safety)

/**
 * Backfill all messages from a channel, paginating backwards.
 * @param {string} channelId - Discord channel ID
 * @param {object} options - { before, after, limit, onProgress }
 */
async function backfillChannel(discordClient, channelId, options = {}) {
  const { before, after, limit = Infinity, onProgress } = options;
  let lastId = before || null;
  let totalFetched = 0;
  let hasMore = true;

  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Channel ${channelId} not found or not text-based`);
  }

  logger.info(`Starting backfill for #${channel.name} (${channelId})`);

  while (hasMore && totalFetched < limit) {
    const fetchOptions = { limit: Math.min(BATCH_SIZE, limit - totalFetched) };
    if (lastId) fetchOptions.before = lastId;
    if (after) fetchOptions.after = after;

    const messages = await channel.messages.fetch(fetchOptions);
    if (messages.size === 0) { hasMore = false; break; }

    const sorted = [...messages.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);

    for (const msg of sorted) {
      if (msg.author.bot) continue;
      await saveMessageWithFiles(msg);

    }

    totalFetched += sorted.length;
    lastId = sorted[sorted.length - 1]?.id;

    if (onProgress) onProgress({ fetched: totalFetched, lastId, channelId });
    logger.info(`Backfill #${channel.name}: ${totalFetched} messages processed`);

    if (messages.size < BATCH_SIZE) { hasMore = false; break; }
    await sleep(DELAY_MS);
  }

  // Update channel record (message counts are intentionally not stored)
  await Channel.findOneAndUpdate(
    { discordId: channelId },
    { lastScrapedAt: new Date() }
  );

  logger.info(`✅ Backfill complete for #${channel.name}: ${totalFetched} total messages`);
  return totalFetched;
}

/**
 * Backfill all enabled channels for a server
 */
async function backfillServer(discordClient, serverId, options = {}) {
  const channels = await Channel.find({ serverId, scrapeEnabled: true, type: 'text' });
  const results = {};

  for (const ch of channels) {
    try {
      results[ch.discordId] = await backfillChannel(discordClient, ch.discordId, options);
    } catch (err) {
      logger.error(`Backfill failed for channel ${ch.name}:`, err.message);
      results[ch.discordId] = { error: err.message };
    }
    await sleep(2000); // pause between channels
  }

  return results;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { backfillChannel, backfillServer };
