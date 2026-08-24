// scripts/runNow.js — manual subnet run.
// Logs in a real Discord client first so the run backfills fresh chat history
// instead of analyzing whatever happened to be in Mongo already.
require("dotenv").config();
const mongoose = require("mongoose");
const {
  runDailySubnetAnalysis,
} = require("../src/services/subnetScheduler.js");
const {
  createScraperClient,
  destroyScraperClient,
} = require("../src/bot/scraperClient.js");

// Subnets to run, e.g. `node scripts/runNow.js 9 10 11`. Defaults to 9, 10, 11.
const subnets = process.argv.slice(2).map(Number).filter(Boolean);
const targets = subnets.length ? subnets : [3,4,5];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Running SN${targets.join(", SN")}...`);

  const client = await createScraperClient();
  try {
    const result = await runDailySubnetAnalysis(
      client,
      process.env.DISCORD_GUILD_ID,
      targets,
    );
    console.log(result);
  } finally {
    await destroyScraperClient(client);
    await mongoose.disconnect().catch(() => {});
  }
  process.exit(0);
})().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
