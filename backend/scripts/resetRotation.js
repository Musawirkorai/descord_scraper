// scripts/resetRotation.js
// One-off fix: point the subnet rotation at a specific subnet number so the
// NEXT scheduled/manual run starts there.
//
// Usage:  node scripts/resetRotation.js 30
//         (defaults to 30 if no number is passed)
//
// After this, the daily scheduler will analyze 30, 31, 32, then 33, 34, 35, ...
require("dotenv").config();
const mongoose = require("mongoose");

const startSubnet = parseInt(process.argv[2], 10) || 30;

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const SubnetSchedule = require("../src/models/SubnetSchedule");
  const {
    getSortedSubnetChannels,
  } = require("../src/services/subnetScheduler.js");

  const serverId = process.env.DISCORD_GUILD_ID;
  const allSubnets = await getSortedSubnetChannels(serverId);

  // Exact match if it exists; otherwise fall through to the next available
  // subnet >= requested (missing subnets are skipped).
  let targetIndex = allSubnets.findIndex((ch) => ch.subnetNumber === startSubnet);
  if (targetIndex === -1) {
    targetIndex = allSubnets.findIndex((ch) => ch.subnetNumber >= startSubnet);
    if (targetIndex !== -1) {
      console.log(
        `ℹ️  Subnet ${startSubnet} has no channel — starting from the next available: ${allSubnets[targetIndex].subnetNumber}`,
      );
    }
  }

  if (targetIndex === -1) {
    console.error(
      `❌ No subnet >= ${startSubnet} found among scrape-enabled channels.`,
    );
    console.error(
      `   Available: ${allSubnets.map((c) => c.subnetNumber).join(", ")}`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  let schedule = await SubnetSchedule.findOne();
  if (!schedule) {
    schedule = await SubnetSchedule.create({});
  }

  // Safety: if the server is mid-run, a reset here would race the running
  // analysis (it may advance past the value we set). Warn and bail.
  if (schedule.isRunning) {
    console.error(
      "⚠️  A subnet run is currently in progress (isRunning=true).",
    );
    console.error(
      "    Stop the backend (or wait for the run to finish) before resetting,",
    );
    console.error("    so the reset isn't overwritten by the running batch.");
    await mongoose.disconnect();
    process.exit(1);
  }

  await SubnetSchedule.findByIdAndUpdate(schedule._id, {
    nextSubnetNumber: allSubnets[targetIndex].subnetNumber,
    currentIndex: targetIndex,
    isRunning: false,
  });

  const next3 = allSubnets
    .slice(targetIndex, targetIndex + 3)
    .map((c) => c.subnetNumber);

  console.log(`✅ Rotation reset — next run will analyze: ${next3.join(", ")}`);
  await mongoose.disconnect();
  process.exit(0);
});
