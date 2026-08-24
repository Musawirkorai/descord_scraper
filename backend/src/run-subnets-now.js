/**
 * run-subnets-now.js
 * Manually trigger TODAY'S batch immediately, using the SAME rotation logic as
 * the automatic scheduler (single source of truth). You normally do NOT need to
 * run this — the backend runs the analysis automatically at midnight and on
 * startup. Use it only to force an out-of-band run.
 *
 * Run with: node src/run-subnets-now.js
 *
 * Logs in a short-lived Discord client first so the run backfills fresh chat
 * history, matching what the scheduler inside the running backend does. If no
 * bot token is configured it degrades to analyzing whatever is already in Mongo.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { runDailySubnetAnalysis } = require("./services/subnetScheduler");
const {
  createScraperClient,
  destroyScraperClient,
} = require("./bot/scraperClient");

async function main() {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/discord_scraper",
  );
  console.log("✅ MongoDB connected\n");

  const serverId = process.env.DISCORD_GUILD_ID;
  if (!serverId) {
    console.error("❌ DISCORD_GUILD_ID not set in .env");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("📊 Running today's scheduled batch (next 3 in rotation)...\n");
  const client = await createScraperClient();
  let result;
  try {
    result = await runDailySubnetAnalysis(client, serverId);
  } finally {
    await destroyScraperClient(client);
  }

  console.log("\n🎉 Done:", JSON.stringify(result, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
