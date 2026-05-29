require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const logger = require('../utils/logger');
const { saveMessage } = require('../services/messageService');
const { broadcastEvent } = require('../services/websocket');
const { syncServerAndChannels } = require('../services/syncService');
const { connectDB } = require('../config/database');
const { connectRedis } = require('../config/redis');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once(Events.ClientReady, async (c) => {
  // Connect to DB FIRST before doing anything
  await connectDB();
  await connectRedis().catch(() => logger.warn('Redis unavailable - caching disabled'));

  logger.info(`✅ Discord bot logged in as ${c.user.tag}`);
  logger.info(`📡 Connected to ${c.guilds.cache.size} guild(s)`);

  // Sync all guilds on startup
  for (const [, guild] of c.guilds.cache) {
    await syncServerAndChannels(guild).catch(e => logger.error(`Sync failed for ${guild.name}:`, e));
  }
});

// Real-time message listener
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  try {
    const saved = await saveMessage(message);
    broadcastEvent('new_message', {
      serverId: message.guildId,
      channelId: message.channelId,
      message: saved,
    });
  } catch (err) {
    logger.error('Failed to save message:', err);
  }
});

// Message edit tracking
client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
  if (!newMsg.content || newMsg.author?.bot) return;
  try {
    const Message = require('../models/Message');
    await Message.findOneAndUpdate(
      { discordId: newMsg.id },
      {
        content: newMsg.content,
        cleanContent: newMsg.cleanContent,
        isEdited: true,
        editedAt: newMsg.editedTimestamp ? new Date(newMsg.editedTimestamp) : new Date(),
      }
    );
  } catch (err) {
    logger.error('Failed to update message:', err);
  }
});

// New guild join
client.on(Events.GuildCreate, async (guild) => {
  logger.info(`Joined new guild: ${guild.name}`);
  await syncServerAndChannels(guild);
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  logger.error('Discord login failed:', err);
  process.exit(1);
});

module.exports = client;