/**
 * debug-subnets.js
 * Diagnose scheduler state and release stuck locks.
 * Does NOT reset currentIndex — preserves your rotation position.
 * Run with: node src/debug-subnets.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const SUBNETS_PER_RUN = 3;

function extractSubnetNumber(name) {
  const match = name.match(/^(\d+)/);
  return match ? parseInt(match[1]) : 9999;
}

async function main() {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/discord_scraper",
  );
  console.log("✅ MongoDB connected\n");

  const SubnetSchedule = require("./models/SubnetSchedule");
  const SubnetReport = require("./models/SubnetReport");
  const Channel = require("./models/Channel");
  const Message = require("./models/Message");

  // ── 1. Schedule state
  console.log("=== SCHEDULE STATE ===");
  const schedule = await SubnetSchedule.findOne();
  if (!schedule) {
    console.log("No schedule document — will be created on first run");
  } else {
    console.log(`  isRunning    : ${schedule.isRunning}`);
    console.log(`  currentIndex : ${schedule.currentIndex}`);
    console.log(`  cycleNumber  : ${schedule.cycleNumber}`);
    console.log(`  lastRunDate  : ${schedule.lastRunDate}`);
  }

  // ── 2. Release lock only — do NOT touch currentIndex
  console.log("\n=== RELEASING LOCK (index preserved) ===");
  await SubnetSchedule.findOneAndUpdate(
    {},
    { isRunning: false },
    { upsert: true },
  );
  console.log("✅ Lock released — rotation position preserved");

  // ── 3. Show all channels with subnet numbers
  console.log("\n=== SUBNET CHANNELS ===");
  const channels = await Channel.find().sort({ name: 1 });
  const subnetChannels = channels
    .map((ch) => ({
      ...ch.toObject(),
      subnetNumber: extractSubnetNumber(ch.name),
    }))
    .filter((ch) => ch.subnetNumber !== 9999)
    .sort((a, b) => a.subnetNumber - b.subnetNumber);

  console.log(`Total channels in DB  : ${channels.length}`);
  console.log(`Numbered subnet channels: ${subnetChannels.length}\n`);

  subnetChannels.forEach((c, i) => {
    console.log(
      `  [${i}] SN${c.subnetNumber} — #${c.name} — scrapeEnabled: ${c.scrapeEnabled}`,
    );
  });

  // ── 4. Show what NEXT run will process
  if (schedule && subnetChannels.length > 0) {
    const total = subnetChannels.length;
    const startIndex = schedule.currentIndex % total;
    const nextBatch = subnetChannels.slice(
      startIndex,
      startIndex + SUBNETS_PER_RUN,
    );

    console.log(`\n=== NEXT RUN WILL PROCESS ===`);
    console.log(
      `  Index ${startIndex} to ${startIndex + SUBNETS_PER_RUN - 1} of ${total}:`,
    );
    nextBatch.forEach((ch) => {
      console.log(`  → SN${ch.subnetNumber} #${ch.name}`);
    });
  }

  // ── 5. Message counts
  console.log("\n=== MESSAGE COUNTS ===");
  for (const ch of subnetChannels) {
    const count = await Message.countDocuments({ channelId: ch.discordId });
    const status = count >= 5 ? "✅" : "⚠️ ";
    console.log(
      `  ${status} SN${ch.subnetNumber} #${ch.name}: ${count} messages`,
    );
  }

  // ── 6. Recent reports
  console.log("\n=== RECENT REPORTS ===");
  const reports = await SubnetReport.find().sort({ generatedAt: -1 }).limit(10);
  if (reports.length === 0) {
    console.log("  No reports yet");
  } else {
    reports.forEach((r) => {
      const score = r.report?.investabilityScore;
      const topics = r.report?.mainTopics?.length || 0;
      console.log(
        `  SN${r.subnetNumber} — ${r.channelName} — ${r.status} — score: ${score || "?"}/10 — topics: ${topics}`,
      );
    });
  }

  // ── 7. Option to reset index
  const resetArg = process.argv.includes("--reset");
  if (resetArg) {
    await SubnetSchedule.findOneAndUpdate(
      {},
      { currentIndex: 0, cycleNumber: 1 },
    );
    console.log("\n⚠️  Index reset to 0 (--reset flag used)");
  } else {
    console.log(
      "\n💡 To reset rotation to start: node src/debug-subnets.js --reset",
    );
  }

  console.log("\n=== DONE ===");
  console.log(
    "Run: node src/run-subnets-now.js   ← processes today's 3 subnets only",
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
