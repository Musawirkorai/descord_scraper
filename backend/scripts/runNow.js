// scripts/runNow.js
require("dotenv").config();
const mongoose = require("mongoose");
const { runDailySubnetAnalysis } = require("../src/services/subnetScheduler.js");

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log("Running SN9, SN10, SN11...");
  const result = await runDailySubnetAnalysis(
    null,
    process.env.DISCORD_GUILD_ID,
    [97],
  );
  console.log(result);
  process.exit(0);
});

