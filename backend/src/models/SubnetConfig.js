const mongoose = require("mongoose");

const SubnetConfigSchema = new mongoose.Schema(
  {
    subnetNumber: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    category: { type: String, default: "Others", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SubnetConfig", SubnetConfigSchema);