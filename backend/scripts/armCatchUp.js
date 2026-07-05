// scripts/armCatchUp.js
// Clears lastRunDate + the isRunning lock so the backend's startup catch-up
// fires on the NEXT boot (useful for testing a full scheduled pass without
// waiting for midnight). Run with the backend STOPPED.
//   node scripts/armCatchUp.js
require("dotenv").config();
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const SubnetSchedule = require("../src/models/SubnetSchedule");
  const schedule = await SubnetSchedule.findOne();
  if (!schedule) {
    console.log("No schedule yet — it will be created on boot and catch-up will run.");
  } else {
    await SubnetSchedule.findByIdAndUpdate(schedule._id, {
      $unset: { lastRunDate: "" },
      isRunning: false,
    });
    console.log(
      `✅ Armed. Next boot will run a scheduled pass starting at subnet ${schedule.nextSubnetNumber}.`,
    );
  }
  await mongoose.disconnect();
  process.exit(0);
});
