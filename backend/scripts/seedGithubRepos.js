// scripts/seedGithubRepos.js
// One-off: attach each subnet's public GitHub repo(s) to its SubnetConfig.
// Safe to re-run — only sets the githubRepos field, never touches name/category/
// description on existing configs. Subnets with no GitHub page are skipped.
//
//   node scripts/seedGithubRepos.js
//
require("dotenv").config();
const mongoose = require("mongoose");
const SubnetConfig = require("../src/models/SubnetConfig");
const { SUBNET_META } = require("../src/utils/subnetMeta");

// subnetNumber → "owner/repo". Subnets marked "no github" / deprecated / 404 are
// intentionally omitted. URLs were normalized (trailing slash and /tree/... removed).
const REPOS = {
  1: "macrocosm-os/apex",
  2: "inference-labs-inc/subnet-2",
  4: "manifold-inc/targon",
  5: "manifold-inc/hone",
  6: "numinouslabs/numinous",
  7: "entrius/allways",
  8: "taoshidev/vanta-network",
  9: "macrocosm-os/iota",
  10: "Swap-Subnet/swap-subnet",
  11: "trajectoryRL/trajectoryRL",
  12: "backend-developers-ltd/ComputeHorde",
  13: "macrocosm-os/data-universe",
  14: "latent-to/cacheon-old",
  15: "ORO-AI/oro",
  16: "fast-thinker/fast-thinker",
  17: "404-Repo/404-gen-subnet",
  18: "Orpheus-AI/Zeus",
  19: "taostat/blockmachine",
  20: "RogueTensor/comingsoon",
  21: "ippcteam/SN21-adtao",
  22: "Desearch-ai/subnet-22",
  23: "TrishoolAI/trishool-phase2",
  24: "SILX-LABS/QUASAR-SUBNET",
  25: "macrocosm-os/mainframe",
  26: "0xsigurd/Perturb",
  27: "SILX-LABS/Orion",
  28: "taostat/gm-miner",
  29: "coldint/hotfloat",
  32: "It-s-AI/llm-detection",
  33: "afterpartyai/bittensor-conversation-genome-project",
  34: "BitMind-AI/bitmind-subnet",
  35: "General-Tao-Ventures/cartha-validator",
  36: "RendixNetwork/eirel-ai",
  37: "Aurelius-Protocol/Aurelius-Protocol",
  38: "chronollm/sn38",
  40: "RalphLabsAI/ralph",
  41: "sportstensor/sn41",
  43: "GraphiteAI/Graphite-Subnet",
  44: "score-technologies/turbovision",
  45: "Team-Rizzo/alpharidge-ai",
  46: "resi-labs-ai/RESI-models",
  47: "openevolai/evolai",
  48: "qbittensor-labs/quantum-compute",
  49: "nepher-ai/nepher-subnet",
  50: "synthdataco/synth-subnet",
  51: "Datura-ai/lium-io",
  52: "tensorplex-labs/dojo",
  53: "hanlinai/engy",
  54: "yanez-compliance/MIID-subnet",
  55: "genomesio/subnet-niome",
  56: "gradients-ai/G.O.D",
  58: "greevils-ai/greevils-cli",
  59: "babelbit/babelbit_subnet",
  60: "Bitsec-AI/sandbox",
  61: "RedTeamSubnet/RedTeam",
  62: "ridgesai/ridges",
  63: "qbittensor-labs/enigma",
  64: "chutesai/chutes",
  65: "taofu-labs/tpn-subnet",
  66: "ninja-subnet/ninja-validator",
  67: "harnyx/harnyx",
  68: "metanova-labs/nova",
  69: "HeraldMedia/herald",
  70: "RendixNetwork/nexisgen",
  71: "leadpoet/leadpoet",
  72: "natixnetwork/streetvision-subnet",
  74: "entrius/gittensor",
  75: "thenervelab/thebrain",
  76: "byzantiumaitao-arch/byzantium",
  77: "creativebuilds/sn77",
  78: "vocence-78/vocence",
  79: "taos-im/sn-79",
  80: "RaoFoundation/subtensor",
  82: "compelle/compelle-validator",
  83: "toptensor/CliqueAI",
  85: "vidaio-subnet/vidaio-subnet",
  88: "mobiusfund/investing",
  89: "DeltaCompute24/InfiniteQuant-Subnet",
  91: "TensorLink-AI/cascade",
  93: "bitcast-network/bitcast",
  94: "AlveusLabs/SN94-BitSota",
  96: "verathos-ai/verathos",
  97: "unarbos/albedo",
  98: "neverplayalone/neverplayalone_subnet",
  100: "BaseIntelligence/base",
  101: "tag101-ai/tag101",
  102: "Connito-AI/Connito",
  103: "Djinn-Inc/djinn",
  104: "masxai/masxai-subnet",
  106: "nodexo-ai/nodexo",
  107: "minos-protocol/minos_subnet",
  108: "talkheadai/talkhead-subnet",
  112: "subnet112/minotaur_subnet",
  113: "TensorUSD/subnet",
  114: "DendriteHQ/SOMA",
  115: "hashi115/hashichain",
  117: "glyph-research/glyph-subnet",
  120: "AffineFoundation/affine-cortex",
  121: "sundae-bar/bittensor-subnet",
  123: "Barbariandev/MANTIS",
  124: "swarm-subnet/swarm",
  126: "Poker44/Poker44-subnet",
  127: "astridintelligence/sn-127",
  128: "byteleapai/byteleap-Miner",
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Seeding GitHub repos for ${Object.keys(REPOS).length} subnets...`);

  let updated = 0;
  for (const [numStr, repo] of Object.entries(REPOS)) {
    const subnetNumber = Number(numStr);
    const meta = SUBNET_META[subnetNumber];
    await SubnetConfig.updateOne(
      { subnetNumber },
      {
        $set: { githubRepos: [repo] },
        $setOnInsert: {
          name: meta?.name || `Subnet ${subnetNumber}`,
          category: meta?.category || "Others",
          description: meta?.description || "",
        },
      },
      { upsert: true },
    );
    updated++;
    console.log(`  SN${subnetNumber} → ${repo}`);
  }

  console.log(`Done. ${updated} subnet configs updated with GitHub repos.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
