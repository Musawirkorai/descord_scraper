const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  iconUrl: String,
  memberCount: Number,
  description: String,
  isActive: { type: Boolean, default: true },
  scrapeEnabled: { type: Boolean, default: false },
  addedAt: { type: Date, default: Date.now },
  lastSyncAt: Date,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

module.exports = mongoose.model('Server', serverSchema);
