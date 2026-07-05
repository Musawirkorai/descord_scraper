const mongoose = require('mongoose');

const subnetReportSchema = new mongoose.Schema({
  // Which subnet
  subnetNumber: { type: Number, required: true, index: true },
  channelId:    { type: String, required: true },
  channelName:  { type: String, required: true },

  // When this report was generated
  reportDate: { type: Date, required: true, index: true }, // day-level granularity

  // The full structured analysis
  report: {
    subnetName:       String,
    subnetNumber:     Number,

    // Section 1 — Topics
    mainTopics: [{
      title:       String,
      description: String,
      bulletPoints: [String],
    }],
    oneLiner: String,

    // Section 2 — Investability
    investabilityScore: Number,   // 1-10
    investabilityBreakdown: {
      technology:          Number,
      teamExecution:       Number,
      commercialPotential: Number,
      economicMaturity:    Number,
      decentralization:    Number,
    },
    positives:  [{ category: String, score: Number, detail: String }],
    concerns:   [{ category: String, score: Number, detail: String }],
    whatImpresses: String,
    raiseTo9: [String],  // what would raise score to 9/10

    // Section 3 — Sentiment & signals
    sentiment:        String,
    emergingSignals: [{
      signal:     String,
      description: String,
      evidence:   String,
      confidence: String,
    }],
    userIssues:    [String],
    openQuestions: [String],
    uncertainties: [String],

    // Meta
    messageCount: Number,
    analyzedDays: Number,
  },

  // Cycle tracking
  cycleNumber: { type: Number, default: 1 }, // which full cycle (1=first pass, 2=second, etc.)
  dayInCycle:  { type: Number },             // day 1 = subnets 1-4, day 2 = 5-8, etc.

  // Status
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'completed' },
  error:  String,

  generatedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

subnetReportSchema.index({ subnetNumber: 1, reportDate: -1 });
subnetReportSchema.index({ reportDate: -1, status: 1 });

module.exports = mongoose.model('SubnetReport', subnetReportSchema);
