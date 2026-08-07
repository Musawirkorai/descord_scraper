// scripts/purgePII.js
// One-time cleanup: strip author identity and message counts from data already
// stored in the database, to match the new privacy policy (nothing about a
// message's author is kept, and no total message counts are stored).
//
//   node scripts/purgePII.js
//
// Idempotent — safe to run repeatedly. $unset on missing fields is a no-op.
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  // Use the native driver directly so mongoose's strict mode can't strip the
  // $unset of fields we just removed from the schemas.
  const db = mongoose.connection.db;

  // 1. Message author identity
  const msgRes = await db.collection("messages").updateMany(
    {},
    {
      $unset: {
        authorId: "",
        authorUsername: "",
        authorDisplayName: "",
        authorAvatar: "",
      },
    },
  );
  console.log(`Messages: stripped author fields from ${msgRes.modifiedCount} docs`);

  // 2. Per-channel message counts
  const chRes = await db
    .collection("channels")
    .updateMany({}, { $unset: { messageCount: "" } });
  console.log(`Channels: removed messageCount from ${chRes.modifiedCount} docs`);

  // 3. Subnet report message counts (community + github)
  const repRes = await db.collection("subnetreports").updateMany(
    {},
    {
      $unset: {
        "report.messageCount": "",
        "report.totalMessages": "",
        "report.githubAnalysis.messageCount": "",
      },
    },
  );
  console.log(`SubnetReports: removed message counts from ${repRes.modifiedCount} docs`);

  // 4. Legacy analytics results (messageCount nested in the mixed result blob)
  const aiRes = await db
    .collection("airesults")
    .updateMany({}, { $unset: { "result.messageCount": "" } });
  console.log(`AiResults: removed result.messageCount from ${aiRes.modifiedCount} docs`);

  // 5. Drop the now-unused serverId+authorId index if it still exists.
  try {
    await db
      .collection("messages")
      .dropIndex("serverId_1_authorId_1_discordCreatedAt_-1");
    console.log("Messages: dropped stale serverId+authorId index");
  } catch (e) {
    if (e.codeName !== "IndexNotFound" && !/index not found/i.test(e.message)) {
      console.warn("Index drop skipped:", e.message);
    }
  }

  console.log("PII purge complete.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("Purge failed:", e.message);
  process.exit(1);
});
