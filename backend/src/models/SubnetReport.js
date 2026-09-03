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
    briefDescription: String,     // 2-3 sentence overview of the subnet

    // Section 1 — Topics
    mainTopics: [{
      title:       String,
      description: String,
      bulletPoints: [String],
    }],
    oneLiner: String,

    // Section 2 — Investability
    // null when the Discord channel had no usable messages this period (the report
    // is then built from GitHub alone) — see dataCoverage below.
    investabilityScore: Number,   // 1-10 (after ratingBoost)
    scoreLabel:         String,   // Strong Buy | Buy | Hold | Caution | Avoid
    // Uniform lift added to investabilityScore, the breakdown and combinedScore
    // when this report was generated (RATING_BOOST). Recorded so month-over-month
    // can compare across a boost change instead of reading it as real movement.
    ratingBoost:        Number,
    investabilityBreakdown: {
      technology:          Number,
      teamExecution:       Number,
      commercialPotential: Number,
      economicMaturity:    Number,
      decentralization:    Number,
    },
    positives:  [{ category: String, score: Number, detail: String }],
    concerns:   [{ category: String, score: Number, detail: String }],
    whatImpresses:     String,
    raiseTo9:         [String],  // what would raise score to 9/10
    lowerRating:       String,   // what would lower the rating significantly
    comparisonContext: String,   // this subnet vs typical Bittensor subnets
    bottomLine:        String,   // investment summary

    // Section 2b — Month-over-month progress (vs the previous report for this subnet)
    // Tracks whether last period's "raiseTo9" goals were actually delivered this
    // period. hasPrevious=false on the very first report (nothing to compare to).
    monthOverMonth: {
      hasPrevious:   { type: Boolean, default: false },
      previousDate:  Date,     // reportDate of the report being compared against
      previousScore: Number,
      currentScore:  Number,
      scoreDelta:    Number,   // currentScore - previousScore
      direction:     String,   // up | down | flat
      summary:       String,   // narrative of what changed since last period
      improvements: [{
        item:     String,      // the goal set last period (a previous raiseTo9 item)
        status:   String,      // done | in_progress | not_addressed
        evidence: String,      // short reference from this period's chat
      }],
      newProgress:  [String],  // improvements this period that were not previously flagged
      regressions:  [String],  // things that got worse / new concerns vs last period
    },

    // Section 2c — GitHub development analysis (separate from Discord/investability).
    // Aggregated across all of the subnet's repos. null when no repos are configured
    // or none could be scraped. Repo health stats are deterministic (from the GitHub
    // API); `activity` is an LLM summary of recent issues/PRs/commits/comments.
    githubAnalysis: {
      stats: {
        repoCount:       Number,
        totalStars:      Number,
        totalForks:      Number,
        totalOpenIssues: Number,
        languages:       [String],
        lastPushedAt:    Date,
        repos: [{
          fullName:          String,
          description:       String,
          stars:             Number,
          forks:             Number,
          openIssues:        Number,
          language:          String,
          pushedAt:          Date,
          url:               String,
          archived:          Boolean,
          latestReleaseTag:  String,
          latestReleaseDate: Date,
        }],
      },
      activity: {
        summary:        String,    // overview of what's going on with the repo
        momentum:       String,    // high | moderate | low
        momentumDetail: String,
        devFocus:       [String],  // short focus-area chips
        // Exhaustive development report — same shape as Discord mainTopics, so it
        // renders in the same bulleted TopicBlock style.
        topics: [{
          title:        String,
          description:  String,
          bulletPoints: [String],
        }],
        recentHighlights: [String], // notable merged PRs / releases / fixes
        concerns:         [String], // repo-level risks (stale areas, unresolved issues, etc.)
      },
      analyzedDays: Number,
    },

    // Section 2d — Final combined verdict (Discord + GitHub synthesized).
    // The investment score shown at the very end of the report.
    combinedVerdict: {
      combinedScore: Number,   // 1-10, weighs community + development
      scoreLabel:    String,   // Strong Buy | Buy | Hold | Caution | Avoid
      rationale:     String,   // why this score
      raiseRating:  [String],  // what would raise the combined rating
      alphaOutlook: {
        answer:     String,    // near-term alpha-token price outlook
        catalysts: [String],   // concrete near-term catalysts
        confidence: String,    // HIGH | MEDIUM | LOW
      },
    },

    // Which sources actually backed this report. A quiet Discord channel no longer
    // blocks a report — the GitHub half still runs — so the UI needs to know which
    // signals are present to be honest about confidence.
    // Qualitative only: no message counts are stored.
    dataCoverage: {
      hasDiscordData:    { type: Boolean, default: true },
      discordVolume:     String,  // none | low | normal
      hasGithubData:     { type: Boolean, default: false },
      hasGithubActivity: { type: Boolean, default: false },
    },

    // Section 3 — Sentiment & signals
    sentiment:        String,
    overallSentiment: String,  // positive | negative | neutral | mixed
    sentimentDetail:  String,  // what drives the sentiment
    emergingSignals: [{
      signal:     String,
      description: String,
      evidence:   String,
      confidence: String,
    }],
    userIssues:          [String],
    openQuestions:       [String],
    developmentsToWatch: [String],
    uncertainties:       [String],

    // Meta
    samplingMethod: String,  // full | stratified_random
    analyzedDays:   Number,
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
