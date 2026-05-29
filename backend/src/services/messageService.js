const Message = require('../models/Message');
const logger = require('../utils/logger');

/**
 * Transform a Discord.js Message object into our schema
 */
function transformMessage(msg) {
  return {
    discordId: msg.id,
    channelId: msg.channelId,
    serverId: msg.guildId,
    authorId: msg.author.id,
    authorUsername: msg.author.username,
    authorDisplayName: msg.member?.displayName || msg.author.globalName || msg.author.username,
    authorAvatar: msg.author.displayAvatarURL({ size: 64 }),
    content: msg.content,
    cleanContent: msg.cleanContent,
    embeds: msg.embeds.map(e => ({ title: e.title, description: e.description, url: e.url })),
    attachments: [...msg.attachments.values()].map(a => ({
      id: a.id,
      filename: a.name,
      contentType: a.contentType,
      size: a.size,
      url: a.url,
    })),
    reactions: [...(msg.reactions?.cache?.values() || [])].map(r => ({
      emoji: r.emoji.name,
      count: r.count,
    })),
    referencedMessageId: msg.reference?.messageId || null,
    isPinned: msg.pinned,
    discordCreatedAt: msg.createdAt,
    source: 'discord',
  };
}

/**
 * Save a Discord message (upsert)
 */
async function saveMessage(msg) {
  const data = transformMessage(msg);
  const saved = await Message.findOneAndUpdate(
    { discordId: data.discordId },
    { $set: data },
    { upsert: true, new: true }
  );
  return saved;
}

/**
 * Save a batch of messages
 */
async function saveMessages(msgs) {
  const ops = msgs.map(msg => {
    const data = transformMessage(msg);
    return {
      updateOne: {
        filter: { discordId: data.discordId },
        update: { $set: data },
        upsert: true,
      },
    };
  });

  if (ops.length === 0) return { saved: 0 };
  const result = await Message.bulkWrite(ops, { ordered: false });
  return { saved: result.upsertedCount + result.modifiedCount };
}

/**
 * Save an external source message (GitHub, Twitter, etc.)
 */
async function saveExternalMessage(data) {
  return Message.findOneAndUpdate(
    { discordId: data.externalId },
    { $set: { ...data, discordId: data.externalId } },
    { upsert: true, new: true }
  );
}

module.exports = { saveMessage, saveMessages, saveExternalMessage, transformMessage };
