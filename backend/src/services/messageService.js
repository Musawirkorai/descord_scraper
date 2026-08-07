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
    // Author identity is intentionally not captured or stored (privacy).
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

const axios = require('axios');

// Add this helper
async function extractTextFromAttachments(attachments) {
  const textTypes = ['text/plain', 'text/markdown', 'application/json'];
  const results = [];

  for (const a of attachments) {
    const isText = textTypes.some(t => a.contentType?.includes(t))
      || a.filename?.match(/\.(txt|md|log|json|csv)$/i);

    if (isText) {
      try {
        const res = await axios.get(a.url, { responseType: 'text', timeout: 5000 });
        results.push(`[${a.filename}]:\n${res.data.substring(0, 3000)}`);
      } catch (e) {
        // skip unreadable files
      }
    }
  }

  return results.join('\n\n') || null;
}

async function saveMessageWithFiles(msg) {
  console.log(`📎 saveMessageWithFiles called — attachments: ${msg.attachments?.size}`);
  const data = transformMessage(msg);

  if (msg.attachments?.size > 0) {
    const attachmentList = [...msg.attachments.values()];
    console.log(`📄 Attachment filenames:`, attachmentList.map(a => a.filename));
    data.extractedText = await extractTextFromAttachments(attachmentList);
    console.log(`✅ extractedText result:`, data.extractedText ? data.extractedText.substring(0, 100) : 'NULL');
  }

  return Message.findOneAndUpdate(
    { discordId: data.discordId },
    { $set: data },
    { upsert: true, new: true }
  );
}

module.exports = { saveMessage, saveMessages, saveExternalMessage, transformMessage, saveMessageWithFiles };

// module.exports = { saveMessage, saveMessages, saveExternalMessage, transformMessage };
