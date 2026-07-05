// scripts/diagSubnet.js <subnetNumber>  — inspect one subnet end-to-end
require("dotenv").config();
const mongoose = require("mongoose");

const sn = parseInt(process.argv[2], 10) || 31;

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Channel = require("../src/models/Channel");
  const Message = require("../src/models/Message");
  const SubnetReport = require("../src/models/SubnetReport");
  const SubnetSchedule = require("../src/models/SubnetSchedule");

  const sched = await SubnetSchedule.findOne().lean();
  console.log(
    `\nSchedule: nextSubnetNumber=${sched?.nextSubnetNumber} currentIndex=${sched?.currentIndex} cycle=${sched?.cycleNumber}`,
  );

  const ch = await Channel.findOne({ name: new RegExp(`^${sn}[^0-9]`) }).lean();
  if (!ch) {
    console.log(`\nSN${sn}: NO CHANNEL matches ^${sn}`);
  } else {
    const count = await Message.countDocuments({ channelId: ch.discordId });
    console.log(
      `\nSN${sn} channel: #${ch.name}  discordId=${ch.discordId}  scrapeEnabled=${ch.scrapeEnabled}  type=${ch.type}  messages=${count}`,
    );
  }

  const reports = await SubnetReport.find({ subnetNumber: sn })
    .sort({ reportDate: -1 })
    .lean();
  console.log(`\nReports for SN${sn}: ${reports.length}`);
  reports.forEach((r) =>
    console.log(
      `  reportDate=${r.reportDate?.toISOString?.().slice(0, 10)} status=${r.status} score=${r.report?.investabilityScore ?? "-"} generatedAt=${r.generatedAt}`,
    ),
  );
  console.log("");

  await mongoose.disconnect();
  process.exit(0);
});
