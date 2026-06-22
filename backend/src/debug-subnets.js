/**
 * debug-subnets.js
 * Run with: node src/debug-subnets.js
 * This will diagnose and fix the scheduler, then run analysis on your 19 channels.
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  // ── Connect
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/discord_scraper");
  console.log("✅ MongoDB connected\n");

  const SubnetSchedule = require("./models/SubnetSchedule");
  const SubnetReport   = require("./models/SubnetReport");
  const Channel        = require("./models/Channel");
  const Message        = require("./models/Message");

  // ── 1. Show current schedule state
  console.log("=== SCHEDULE STATE ===");
  const schedule = await SubnetSchedule.findOne();
  if (!schedule) {
    console.log("No schedule document found — will be created on first run");
  } else {
    console.log("isRunning:    ", schedule.isRunning);
    console.log("currentIndex: ", schedule.currentIndex);
    console.log("cycleNumber:  ", schedule.cycleNumber);
    console.log("lastRunDate:  ", schedule.lastRunDate);
  }

  // ── 2. Force-release the lock
  console.log("\n=== RELEASING LOCK ===");
  await SubnetSchedule.findOneAndUpdate(
    {},
    { isRunning: false, currentIndex: 0 },
    { upsert: true }
  );
  console.log("✅ Lock released, currentIndex reset to 0");

  // ── 3. Show all channels
  console.log("\n=== ALL CHANNELS IN DB ===");
  const channels = await Channel.find().sort({ name: 1 });
  console.log(`Total channels: ${channels.length}`);
  channels.forEach(c => {
    console.log(`  ${c.scrapeEnabled ? "✅" : "❌"} #${c.name} (id: ${c.discordId}) scrapeEnabled: ${c.scrapeEnabled}`);
  });

  // ── 4. Enable scraping on ALL channels (so we can run immediately)
  console.log("\n=== ENABLING SCRAPE ON ALL CHANNELS ===");
  const result = await Channel.updateMany({}, { scrapeEnabled: true });
  console.log(`✅ Enabled scraping on ${result.modifiedCount} channels`);

  // ── 5. Show message counts per channel
  console.log("\n=== MESSAGE COUNTS PER CHANNEL ===");
  for (const ch of channels) {
    const count = await Message.countDocuments({ channelId: ch.discordId });
    console.log(`  #${ch.name}: ${count} messages`);
  }

  // ── 6. Show existing reports
  console.log("\n=== EXISTING SUBNET REPORTS ===");
  const reports = await SubnetReport.find().sort({ generatedAt: -1 }).limit(10);
  if (reports.length === 0) {
    console.log("  No reports found yet");
  } else {
    reports.forEach(r => {
      console.log(`  Subnet ${r.subnetNumber} — ${r.channelName} — status: ${r.status} — score: ${r.report?.investabilityScore || "?"}`);
    });
  }

  console.log("\n=== DONE ===");
  console.log("Now restart your server and click 'Run Now' in the Schedule tab.");
  console.log("Or run: node src/run-subnets-now.js");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });