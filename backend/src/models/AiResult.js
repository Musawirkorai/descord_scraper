const mongoose = require("mongoose");

const aiResultSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "monthly_summary",
        "trend_analysis",
        "sentiment_report",
        "keyword_cluster",
        "custom",
      ],
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ["server", "channel", "user", "global"],
      required: true,
    },
    targetId: { type: String, index: true }, // serverId, channelId, or userId
    targetName: String,
    dateRange: {
      from: { type: Date, index: true },
      to: Date,
    },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
    // Set from llmProvider.MODEL by the caller. The old "gpt-4o-mini" default
    // mislabelled every stored result, so there is deliberately no default.
    model: { type: String },
    tokensUsed: Number,
    generatedAt: { type: Date, default: Date.now, index: true },
    expiresAt: Date, // for TTL-based invalidation
    cacheKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

aiResultSchema.index({ type: 1, scope: 1, targetId: 1, generatedAt: -1 });

module.exports = mongoose.model("AiResult", aiResultSchema);
