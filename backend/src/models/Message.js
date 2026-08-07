const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  id: String,
  filename: String,
  contentType: String,
  size: Number,
  url: String,
}, { _id: false });


const messageSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true, index: true },
  channelId: { type: String, required: true, index: true },
  serverId: { type: String, required: true, index: true },
  // Author identity is intentionally NOT stored (privacy) — no username,
  // display name, avatar, or author id is persisted for any message.
  content: { type: String, default: '' },
  cleanContent: String,
  extractedText: { type: String, default: null },
  embeds: [mongoose.Schema.Types.Mixed],
  attachments: [attachmentSchema],
  reactions: [mongoose.Schema.Types.Mixed],
  referencedMessageId: String,
  isPinned: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  editedAt: Date,
  discordCreatedAt: { type: Date, required: true, index: true },
  // AI analysis
  sentiment: { type: String, enum: ['positive', 'negative', 'neutral', null], default: null },
  keywords: [String],
  topics: [String],
  aiProcessed: { type: Boolean, default: false, index: true },
  source: { type: String, enum: ['discord', 'github', 'twitter', 'other'], default: 'discord', index: true },
}, { timestamps: true });

// Compound indexes for fast filtering
messageSchema.index({ serverId: 1, channelId: 1, discordCreatedAt: -1 });
messageSchema.index({ content: 'text', cleanContent: 'text' }); // Full-text search
messageSchema.index({ keywords: 1 });
messageSchema.index({ discordCreatedAt: -1 });


module.exports = mongoose.model('Message', messageSchema);
