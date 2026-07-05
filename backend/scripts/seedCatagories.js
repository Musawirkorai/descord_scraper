// scripts/seed-categories.js
const mongoose = require("mongoose");
const SubnetCategory = require("../models/SubnetCategory");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await SubnetCategory.bulkWrite(
    ["Portfolio", "Contender", "Normal", "Deregistered"].map((name) => ({
      updateOne: { filter: { name }, update: { name }, upsert: true },
    }))
  );
  console.log("Categories seeded");
  process.exit(0);
}
seed();