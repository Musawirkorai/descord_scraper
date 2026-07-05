const mongoose = require("mongoose");

// Default categories (Portfolio, Contender, Normal, Deregistered) are seeded
// via POST /api/subnet-config/seed. Categories are also auto-created whenever a
// subnet config is saved with a new category name.
const SubnetCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SubnetCategory", SubnetCategorySchema);