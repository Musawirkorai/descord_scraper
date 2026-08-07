const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true, index: true },
  serverId: { type: String, required: true, index: true },
  serverRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Server' },
  name: { type: String, required: true },
  type: { type: String, enum: ['text', 'voice', 'thread', 'forum', 'announcement'], default: 'text' },
  topic: String,
  isActive: { type: Boolean, default: true },
  scrapeEnabled: { type: Boolean, default: false },
  lastMessageId: String,
  lastScrapedAt: Date,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

channelSchema.index({ serverId: 1, name: 1 });

module.exports = mongoose.model('Channel', channelSchema);
