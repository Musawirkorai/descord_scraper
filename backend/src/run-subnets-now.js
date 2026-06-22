/**
 * run-subnets-now.js
 * Bypasses the scheduler completely — directly analyzes all channels with messages.
 * Run with: node src/run-subnets-now.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/discord_scraper");
  console.log("✅ MongoDB connected\n");

  const Channel      = require("./models/Channel");
  const Message      = require("./models/Message");
  const SubnetReport = require("./models/SubnetReport");
  const SubnetSchedule = require("./models/SubnetSchedule");
  const { analyzeSubnet } = require("./services/subnetIntelService");

  // Release lock
  await SubnetSchedule.findOneAndUpdate({}, { isRunning: false }, { upsert: true });
  console.log("✅ Lock released\n");

  // Get all channels that have messages
  const channels = await Channel.find().sort({ name: 1 });
  console.log(`Found ${channels.length} channels total\n`);

  // Filter to channels with messages
  const withMessages = [];
  for (const ch of channels) {
    const count = await Message.countDocuments({ channelId: ch.discordId });
    if (count >= 5) {
      withMessages.push({ ...ch.toObject(), messageCount: count });
      console.log(`✅ #${ch.name} — ${count} messages`);
    } else {
      console.log(`⚠️  #${ch.name} — only ${count} messages (skipping)`);
    }
  }

  console.log(`\n📊 Will analyze ${withMessages.length} channels with sufficient data\n`);

  if (withMessages.length === 0) {
    console.log("❌ No channels have enough messages. Run a backfill first from the Scraper Jobs page.");
    process.exit(1);
  }

  const reportDate = new Date();
  reportDate.setHours(0, 0, 0, 0);

  let successCount = 0;

  for (const ch of withMessages) {
    // Extract subnet number from channel name
    const match = ch.name.match(/^(\d+)/);
    const subnetNumber = match ? parseInt(match[1]) : (withMessages.indexOf(ch) + 1);

    console.log(`\n🔍 Analyzing #${ch.name} (Subnet ${subnetNumber}) — ${ch.messageCount} messages...`);

    try {
      const report = await analyzeSubnet(ch.discordId, ch.name, subnetNumber, 30);

      if (!report) {
        console.log(`  ⚠️  No report generated (insufficient data after cleaning)`);
        continue;
      }

      // Save to DB
      await SubnetReport.findOneAndUpdate(
        { channelId: ch.discordId, reportDate },
        {
          subnetNumber,
          channelId:   ch.discordId,
          channelName: ch.name,
          reportDate,
          report,
          cycleNumber: 1,
          dayInCycle:  1,
          status:      "completed",
        },
        { upsert: true, new: true }
      );

      successCount++;
      console.log(`  ✅ Done — Score: ${report.investabilityScore}/10 — ${report.subnetName}`);

      // Wait 3 seconds between subnets to avoid Groq rate limits
      if (withMessages.indexOf(ch) < withMessages.length - 1) {
        console.log(`  ⏳ Waiting 3s before next subnet...`);
        await new Promise(r => setTimeout(r, 3000));
      }

    } catch (err) {
      console.log(`  ❌ Failed: ${err.message}`);

      await SubnetReport.findOneAndUpdate(
        { channelId: ch.discordId, reportDate },
        {
          subnetNumber,
          channelId:   ch.discordId,
          channelName: ch.name,
          reportDate,
          status: "failed",
          error:  err.message,
          cycleNumber: 1,
        },
        { upsert: true }
      );
    }
  }

  console.log(`\n🎉 Complete — ${successCount}/${withMessages.length} reports generated`);
  console.log("Open DataHarvest → Subnet Intel → Today tab to see your reports.\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
