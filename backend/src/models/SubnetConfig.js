const mongoose = require("mongoose");

const SubnetConfigSchema = new mongoose.Schema(
  {
    subnetNumber: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    category: { type: String, default: "Others", trim: true },

    // Public GitHub repositories associated with this subnet, as "owner/repo"
    // strings. Scraped + analyzed each cycle and rendered as a separate GitHub
    // section in the report. Empty = no GitHub analysis for this subnet.
    githubRepos: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SubnetConfig", SubnetConfigSchema);