const mongoose = require('mongoose');

// Tracks where we are in the 150-subnet rotation cycle
const subnetScheduleSchema = new mongoose.Schema({
  // Subnet NUMBER (e.g. 30) to start the next run from. This is the source of
  // truth for rotation — it is robust against channels being added/removed,
  // unlike an array index. null → start from the lowest available subnet.
  nextSubnetNumber: { type: Number, default: null },
  currentIndex: { type: Number, default: 0 },  // array position of nextSubnetNumber (kept in sync for the status UI)
  cycleNumber:  { type: Number, default: 1 },   // increments after a full pass over all subnets
  subnetsPerDay: { type: Number, default: 3 },  // how many subnets to analyze per day
  lastRunDate:  { type: Date },                  // last time scheduler ran
  isRunning:    { type: Boolean, default: false },// lock to prevent double-runs

  // ── Pause / hold ──────────────────────────────────────────────────────────
  // When paused, the automatic daily rotation is skipped WITHOUT advancing the
  // rotation pointer, so resuming continues from exactly where it stopped.
  // Manual runs (POST /run with explicit subnets) still work while paused.
  isPaused:    { type: Boolean, default: false },
  pausedAt:    { type: Date },                    // when the pause was set
  resumeAt:    { type: Date, default: null },     // auto-resume time (null → indefinite, resume manually)
  pauseReason: { type: String },                  // optional note, e.g. "on vacation"
}, { timestamps: true });

module.exports = mongoose.model('SubnetSchedule', subnetScheduleSchema);
