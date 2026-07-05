// scripts/seed-subnet-configs.js
require("dotenv").config();
const mongoose = require("mongoose");
const SubnetConfig = require("../src/models/SubnetConfig");
const { SUBNET_META } = require("../src/utils/subnetMeta");

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  const ops = Object.entries(SUBNET_META).map(([num, meta]) => ({
    updateOne: {
      filter: { subnetNumber: Number(num) },
      update: {
        $setOnInsert: {
          subnetNumber: Number(num),
          name: meta.name,
          description: meta.description,
          category: "Normal",
        },
      },
      upsert: true,
    },
  }));

  const result = await SubnetConfig.bulkWrite(ops);
  console.log(`Seeded/verified ${ops.length} subnet configs`, result.upsertedCount, "new");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});