const mongoose = require('mongoose');

// Tracks where we are in the 150-subnet rotation cycle
const subnetScheduleSchema = new mongoose.Schema({
  currentIndex: { type: Number, default: 0 },  // 0-149, which subnet to process next
  cycleNumber:  { type: Number, default: 1 },   // increments after full 150-subnet pass
  subnetsPerDay: { type: Number, default: 4 },  // how many subnets to analyze per day
  lastRunDate:  { type: Date },                  // last time scheduler ran
  isRunning:    { type: Boolean, default: false },// lock to prevent double-runs
}, { timestamps: true });

module.exports = mongoose.model('SubnetSchedule', subnetScheduleSchema);
