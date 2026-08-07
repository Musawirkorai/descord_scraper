const router = require("express").Router();
const { requireAuth, requireAdmin } = require("../middleware/auth");
const SubnetConfig = require("../models/SubnetConfig");
const SubnetCategory = require("../models/SubnetCategory");
const { getSubnetMeta, SUBNET_META } = require("../utils/subnetMeta");
const logger = require("../utils/logger");

const DEFAULT_CATEGORIES = ["Portfolio", "Contender", "Others", "Not Eligible"];

// Parse & validate a subnet number from a route param. Returns null if invalid.
function parseSubnetNumber(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ── GET all subnet configs ──────────────────────────────────────────────────
router.get("/subnet-config", requireAuth, async (req, res) => {
  try {
    const configs = await SubnetConfig.find().sort({ subnetNumber: 1 }).lean();
    res.json(configs);
  } catch (err) {
    logger.error("GET /subnet-config failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET all categories ──────────────────────────────────────────────────────
router.get("/subnet-categories", requireAuth, async (req, res) => {
  try {
    const cats = await SubnetCategory.find().sort({ name: 1 }).lean();
    res.json(cats);
  } catch (err) {
    logger.error("GET /subnet-categories failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── UPSERT a subnet's name/category/description ──────────────────────────────
router.put(
  "/subnet-config/:subnetNumber",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const subnetNumber = parseSubnetNumber(req.params.subnetNumber);
      if (subnetNumber === null) {
        return res
          .status(400)
          .json({ error: "subnetNumber must be a positive integer" });
      }

      // Normalize inputs
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      const category =
        typeof req.body.category === "string" && req.body.category.trim()
          ? req.body.category.trim()
          : "Others";
      const description =
        typeof req.body.description === "string"
          ? req.body.description.trim()
          : "";

      // Normalize GitHub repos into a clean, de-duplicated list of "owner/repo".
      // Accepts an array or a comma/newline-separated string. Strips any full
      // github.com URL down to "owner/repo".
      let githubRepos;
      if (req.body.githubRepos !== undefined) {
        const raw = Array.isArray(req.body.githubRepos)
          ? req.body.githubRepos
          : String(req.body.githubRepos).split(/[\n,]/);
        githubRepos = [
          ...new Set(
            raw
              .map((s) =>
                String(s)
                  .trim()
                  .replace(/^https?:\/\/github\.com\//i, "")
                  .replace(/\.git$/i, "")
                  .replace(/\/+$/, ""),
              )
              .filter((s) => /^[^/\s]+\/[^/\s]+$/.test(s)),
          ),
        ];
      }

      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }

      // Register a new category if we haven't seen it before
      await SubnetCategory.findOneAndUpdate(
        { name: category },
        { name: category },
        { upsert: true, setDefaultsOnInsert: true },
      );

      const update = { subnetNumber, name, category, description };
      if (githubRepos !== undefined) update.githubRepos = githubRepos;

      const updated = await SubnetConfig.findOneAndUpdate(
        { subnetNumber },
        update,
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );
      res.json(updated);
    } catch (err) {
      logger.error("PUT /subnet-config failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ── DELETE a subnet override (reverts it to static meta/AI fallback) ─────────
router.delete(
  "/subnet-config/:subnetNumber",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const subnetNumber = parseSubnetNumber(req.params.subnetNumber);
      if (subnetNumber === null) {
        return res
          .status(400)
          .json({ error: "subnetNumber must be a positive integer" });
      }
      const deleted = await SubnetConfig.findOneAndDelete({ subnetNumber });
      if (!deleted) {
        return res
          .status(404)
          .json({ error: `No config found for subnet ${subnetNumber}` });
      }
      res.json({ message: `Subnet ${subnetNumber} config reset to default` });
    } catch (err) {
      logger.error("DELETE /subnet-config failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ── SEED — populate configs for every real subnet channel + default categories.
// Safe to run repeatedly: only fills in subnets that don't have a config yet,
// so it never clobbers manual edits. Names/descriptions come from static meta.
router.post(
  "/subnet-config/seed",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      // Ensure the default category set exists
      await Promise.all(
        DEFAULT_CATEGORIES.map((name) =>
          SubnetCategory.findOneAndUpdate(
            { name },
            { name },
            { upsert: true, setDefaultsOnInsert: true },
          ),
        ),
      );

      const existing = new Set(
        (await SubnetConfig.find().select("subnetNumber").lean()).map(
          (c) => c.subnetNumber,
        ),
      );

      // Seed every subnet in the static catalog (all 128), not just those that
      // currently have a Discord channel — insert-missing so manual edits stay.
      const toInsert = [];
      for (const [numStr, meta] of Object.entries(SUBNET_META)) {
        const n = Number(numStr);
        if (existing.has(n)) continue;
        toInsert.push({
          subnetNumber: n,
          name: meta.name,
          description: meta.description || "",
          category: meta.category || "Others",
        });
      }

      // Also cover any live channel whose subnet is beyond the catalog.
      const serverId = process.env.DISCORD_GUILD_ID;
      if (serverId) {
        try {
          const {
            getSortedSubnetChannels,
          } = require("../services/subnetScheduler");
          const channels = await getSortedSubnetChannels(serverId);
          for (const ch of channels) {
            if (existing.has(ch.subnetNumber)) continue;
            if (SUBNET_META[ch.subnetNumber]) continue; // already added above
            const meta = getSubnetMeta(ch.subnetNumber, null, ch.name);
            toInsert.push({
              subnetNumber: ch.subnetNumber,
              name: meta.name,
              description: meta.description || "",
              category: meta.category || "Others",
            });
          }
        } catch (e) {
          logger.warn(`Seed: channel scan skipped — ${e.message}`);
        }
      }

      if (toInsert.length > 0) {
        await SubnetConfig.insertMany(toInsert, { ordered: false });
      }

      res.json({
        message: "Seed complete",
        configsCreated: toInsert.length,
        alreadyConfigured: existing.size,
        totalCatalog: Object.keys(SUBNET_META).length,
        categories: DEFAULT_CATEGORIES,
      });
    } catch (err) {
      logger.error("POST /subnet-config/seed failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
