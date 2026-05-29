const Server = require('../models/Server');
const Channel = require('../models/Channel');
const logger = require('../utils/logger');

async function syncServerAndChannels(guild) {
  // Upsert server
  await Server.findOneAndUpdate(
    { discordId: guild.id },
    {
      discordId: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL({ size: 128 }),
      memberCount: guild.memberCount,
      description: guild.description,
      lastSyncAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // Upsert all text channels
  const textChannels = [...guild.channels.cache.values()]
    .filter(ch => ch.isTextBased && ch.isTextBased() && !ch.isThread());

  const ops = textChannels.map(ch => ({
    updateOne: {
      filter: { discordId: ch.id },
      update: {
        $set: {
          discordId: ch.id,
          serverId: guild.id,
          name: ch.name,
          topic: ch.topic || null,
          type: ch.type === 0 ? 'text' : ch.type === 5 ? 'announcement' : 'text',
        },
        $setOnInsert: { scrapeEnabled: false },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) await Channel.bulkWrite(ops, { ordered: false });
  logger.info(`Synced ${guild.name}: ${textChannels.length} channels`);
}

module.exports = { syncServerAndChannels };
