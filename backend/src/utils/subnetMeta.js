// backend/src/utils/subnetMeta.js
// Static catalog of Bittensor subnets — name, description, and category.
// Source of truth at runtime is the SubnetConfig collection in MongoDB; this
// file seeds that collection (via POST /api/subnet-config/seed) and acts as a
// fallback when a subnet isn't configured in the DB yet.
//
// Categories: "Portfolio" | "Contender" | "Others" | "Not Eligible".
// Keep this in sync with frontend/src/utils/subnetMeta_clean.js.

const SUBNET_META = {
  1: { name: "Apex", category: "Portfolio", description: "Evaluating and ranking large language models through competitive benchmarking, helping to identify the most capable AI systems." },
  2: { name: "Dsperse", category: "Contender", description: "AI inference and task distribution, connecting users with a network of providers that can execute AI workloads." },
  3: { name: "Teutonic", category: "Others", description: "" },
  4: { name: "Targon", category: "Portfolio", description: "AI inference, routing user requests to high-performance language models, rewarding miners for fast, accurate AI responses." },
  5: { name: "Hone", category: "Not Eligible", description: "Advancing general intelligence by having miners develop AI systems that can solve novel ARC-AGI reasoning challenges." },
  6: { name: "Numinous", category: "Others", description: "Building AI forecasting agents, using competitive and self-play environments to identify models that can accurately predict future events." },
  7: { name: "Allways", category: "Not Eligible", description: "Autonomous AI agents and task execution, providing infrastructure so agents can perform real-world digital tasks." },
  8: { name: "Vanta", category: "Contender", description: "Prop trading, miners develop AI-driven trading strategies, evaluated on performance to generate trading intelligence." },
  9: { name: "IOTA", category: "Others", description: "Decentralized AI training, enabling miners to contribute compute and model improvements to train open-source AI systems." },
  10: { name: "Unclaimed", category: "Not Eligible", description: "" },
  11: { name: "TrajectoryRL", category: "Others", description: "Optimizing AI agent behavior, miners compete to discover cheaper, safer, more effective prompting and agent workflows that improve LLM agents." },
  12: { name: "Horde", category: "Others", description: "Provides decentralized, trusted GPU compute power to validators and subnets, enabling scalable AI validation and inference." },
  13: { name: "Data Universe", category: "Portfolio", description: "Decentralized data acquisition and retrieval, rewarding miners for collecting, and serving high-quality datasets to train and improve AI models." },
  14: { name: "Cacheon", category: "Not Eligible", description: "AI inference optimization, miners compete to build the fastest and most efficient LLM servers while maintaining output correctness." },
  15: { name: "ORO", category: "Others", description: "Evaluating AI shopping agents, miners solve e-commerce tasks such as product discovery, price comparison, and purchasing decisions." },
  16: { name: "BitAds", category: "Not Eligible", description: "Decentralized digital advertising, AI agents create, optimize, and match advertisements with audiences to maximize advertising performance." },
  17: { name: "404-GEN", category: "Contender", description: "AI-powered 3D content creation, miners generate 3D models, assets, and virtual worlds from text or image prompts for gaming, AR and VR." },
  18: { name: "Zeus", category: "Contender", description: "AI-powered weather and environmental forecasting, miners compete to produce faster, more accurate climate predictions." },
  19: { name: "Blockmachine", category: "Others", description: "Decentralized blockchain infrastructure, miners operate RPC and archive nodes and are rewarded for serving real blockchain data requests." },
  20: { name: "GroundLayer", category: "Not Eligible", description: "Capital formation and structured financing, enabling subnet owners to raise capital and investors to gain structured exposure through OTC deals." },
  21: { name: "AdTAO", category: "Others", description: "Optimizing pay-per-click advertising campaigns, miners use AI to diagnose ad accounts and recommend changes that improve marketing performance." },
  22: { name: "DeSearch", category: "Others", description: "Search and information retrieval, miners compete to find, rank, and deliver the most relevant information in response to user queries." },
  23: { name: "Trishool", category: "Contender", description: "AI security, miners compete to identify and defend against jailbreaks, prompt injections and other attacks to build safer, more robust AI." },
  24: { name: "Quasar", category: "Not Eligible", description: "Long-context AI memory and reasoning, miners compete to build models that understand, recall, and reason without losing coherence or accuracy." },
  25: { name: "Mainframe", category: "Not Eligible", description: "Decentralized cloud computing, miners provide compute resources and infrastructure used to power AI apps, agents, and enterprise workloads." },
  26: { name: "Perturb", category: "Others", description: "AI robustness and adversarial testing, miners compete to discover inputs, perturbations, and attacks that expose weaknesses in AI models." },
  27: { name: "Unclaimed", category: "Not Eligible", description: "" },
  28: { name: "GM", category: "Not Eligible", description: "Creating an open social-intelligence network, miners generate, rank, and curate high-quality social content and interactions." },
  29: { name: "Bootstrap", category: "Not Eligible", description: "Launching and accelerating new AI projects, providing a framework so early-stage models, agents, and subnets can be tested and scaled." },
  30: { name: "Endure", category: "Not Eligible", description: "Risk intelligence network, miners identify, assess and price financial and credit risks, creating a collective intelligence layer for lending." },
  31: { name: "Recall", category: "Not Eligible", description: "Retrieval-augmented generation, miners provide the best embeddings, vector search, and AI-generated answers." },
  32: { name: "ItsAI", category: "Others", description: "Decentralized AI identity and personalization, enabling AI agents and applications to maintain persistent memory, preferences, and context." },
  33: { name: "ReadyAI", category: "Others", description: "Evaluating and orchestrating AI agents for real-world business tasks, miners build agents that reliably complete practical workflows." },
  34: { name: "Mind", category: "Contender", description: "AI-generated content detection, miners compete to identify deepfakes, synthetic images, videos, and audio to preserve trust in digital media." },
  35: { name: "0xMarkets", category: "Others", description: "Prediction markets, miners compete to forecast the outcomes of future events and generate probabilistic intelligence for decision-making." },
  36: { name: "EIREL", category: "Others", description: "Decentralized marketplace for AI agents, miners build and deploy specialized agents, evaluated on their ability to perform real-world tasks." },
  37: { name: "Aurelius", category: "Contender", description: "Mechanistic interpretability, miners uncover and explain the internal reasoning processes of AI models, making them more understandable." },
  38: { name: "Chronos", category: "Not Eligible", description: "Time-series forecasting, miners compete to predict future values of financial, economic, environmental, and other sequential datasets." },
  39: { name: "Cathedral", category: "Others", description: "AI alignment and value formation, miners develop systems that better understand and reason about human values, ethics, and long-term goals." },
  40: { name: "Unclaimed", category: "Not Eligible", description: "" },
  41: { name: "Almanac", category: "Contender", description: "Decentralized forecasting, miners predict future events, creating collective intelligence for forecasting and decision support." },
  42: { name: "Unclaimed", category: "Not Eligible", description: "" },
  43: { name: "Graphite", category: "Not Eligible", description: "Graph optimization, miners solve complex routing and network problems as efficiently as possible using decentralized computation." },
  44: { name: "Score", category: "Portfolio", description: "Computer vision for sports analytics, miners analyze football footage to track players, recognize game events and generate insights." },
  45: { name: "Alpharidge", category: "Others", description: "Uses distributed computing to optimize code generation, automated debugging and prompt engineering." },
  46: { name: "Zipcode", category: "Portfolio", description: "Real-estate intelligence, miners collect, validate and analyze property data to build a database of housing, valuation and location information." },
  47: { name: "EvolAI", category: "Not Eligible", description: "Research, training, and evaluation of AI systems, miners improve model quality, efficiency, and capabilities through continuous optimization." },
  48: { name: "Quantum-C", category: "Contender", description: "Quantum computing, miners develop models to predict and optimize, quantum algorithms and simulations, bridging classical AI & quantum computing." },
  49: { name: "Nepher", category: "Others", description: "Miners compete to develop and train robots, using simulations to create AI systems that transfer from virtual environments to real-world robots." },
  50: { name: "Synth", category: "Others", description: "Probabilistic financial forecasting, miners generate synthetic price-path distributions that help traders, AI agents, and portfolio managers." },
  51: { name: "Lium", category: "Others", description: "GPU-compute marketplace, miners supply GPU resources while users rent them on demand for AI training, inference and other workloads." },
  52: { name: "Dojo", category: "Not Eligible", description: "Human preference evaluation, miners collect and rank human feedback on AI outputs to determine which models produce the most useful responses." },
  53: { name: "Unclaimed", category: "Not Eligible", description: "" },
  54: { name: "MIID", category: "Others", description: "Generating identities and fraud scenarios, enabling banks, fintechs and compliance teams to test and strengthen KYC and fraud-detection systems." },
  55: { name: "NIOME", category: "Others", description: "Genomic-intelligence that generates private synthetic human DNA data, enabling pharmaceutical research, precision medicine, and biological AI." },
  56: { name: "Gradients", category: "Portfolio", description: "AI training, miners contribute gradient updates and model improvements, evaluated and aggregated to build capable machine-learning models." },
  57: { name: "Unclaimed", category: "Not Eligible", description: "" },
  58: { name: "Handshake", category: "Not Eligible", description: "AI-to-AI communication and interoperability, miners help autonomous agents discover and coordinate with one another across different networks." },
  59: { name: "BabelBit", category: "Contender", description: "Real-time speech-to-speech translation, miners predict meaning and translate language with near-human simultaneity and minimal latency." },
  60: { name: "Bitsec", category: "Contender", description: "Cybersecurity, miners discover software vulnerabilities, analyze attack surfaces and identify security weaknesses in code and applications." },
  61: { name: "Red-Team", category: "Others", description: "Adversarial AI testing, miners act as attackers and defenders to uncover vulnerabilities, jailbreaks and prompt injections in AI systems." },
  62: { name: "Ridges", category: "Portfolio", description: "Autonomous AI agents, miners build agents that can solve complex, multi-step tasks in dynamic environments, balancing capability and cost." },
  63: { name: "Enigma", category: "Others", description: "Decentralized reasoning miners compete to solve logical, mathematical, and analytical challenges that require deep inference." },
  64: { name: "Chutes", category: "Portfolio", description: "AI inference marketplace, miners serve open-source models through APIs, allowing developers to access scalable AI compute and model endpoints." },
  65: { name: "TAO Private Network", category: "Portfolio", description: "Private, permisioned AI infrastructure, enabling enterprises to run AI workloads, agents and data pipelines in secure environments." },
  66: { name: "Ninja", category: "Not Eligible", description: "AI coding agents, miners compete in winner-take-all battles on real GitHub issues to build the world's best open-source software agents." },
  67: { name: "Harnyx", category: "Others", description: "Deep-research network miners compete to produce comprehensive research reports, turning high-quality research into a scalable commodity." },
  68: { name: "NOVA", category: "Contender", description: "AI drug-discovery network, miners compete to identify therapeutic molecules and protein targets, accelerating pharmaceutical research." },
  69: { name: "Unclaimed", category: "Not Eligible", description: "" },
  70: { name: "NexisGen", category: "Others", description: "AI data-production subnet, miners generate and validate training datasets, enabling organizations to obtain data for training AI models." },
  71: { name: "LeadPoet", category: "Portfolio", description: "AI-powered lead-generation marketing; miners compete to create high-converting content evaluated for quality and effectiveness." },
  72: { name: "StreetVision", category: "Not Eligible", description: "Autonomous driving AI, miners analyze video to detect road conditions and infrastructure changes that improve maps and train AI systems." },
  73: { name: "Parked", category: "Not Eligible", description: "Monetizing idle assets, miners discover, aggregate, and optimize underutilized digital resources to generate economic value." },
  74: { name: "Gittensor", category: "Others", description: "Miners develop valuable code improvements for public software projects, with contributions evaluated for quality and usefulness." },
  75: { name: "Hippius", category: "Portfolio", description: "Storage and data availability, miners provide storage infrastructure and are rewarded for storing, retrieving, and serving data." },
  76: { name: "Byzantium", category: "Not Eligible", description: "AI training and deployment infrastructure, enabling participants to contribute compute resources toward building and serving AI models." },
  77: { name: "Liquidity", category: "Others", description: "DeFi infrastructure, miners are rewarded for providing liquidity to TAO and alpha markets, creating more efficient trading." },
  78: { name: "Vocence", category: "Others", description: "Voice intelligence, miners compete to build speech-to-text, text-to-speech, speaker recognition, and voice-generation models." },
  79: { name: "Matrx", category: "Others", description: "Knowledge graphs and relationship intelligence, miners build and query data that helps AI understand how entities, concepts, and events relate." },
  80: { name: "Dogelayer", category: "Others", description: "Merges traditional Litecoin/Dogecoin mining with Bittensor validation, allowing miners to earn rewards and emissions through a mining operation." },
  81: { name: "Reliquary", category: "Others", description: "Post-training and model refinement, miners compete to improve existing AI through fine-tuning, alignment and distillation." },
  82: { name: "Compelle", category: "Others", description: "AI debate arena, miners compete by having AI models argue opposing sides of questions, with performance tracked through rankings and outcomes." },
  83: { name: "CliqueAI", category: "Not Eligible", description: "Combinatorial optimization, miners compete to solve maximum clique problems and other graph-theory challenges using AI and search algorithms." },
  84: { name: "Droid", category: "Others", description: "AI-powered mobile and software automation, miners build agents that can understand interfaces, navigate applications, and complete tasks." },
  85: { name: "Vidaio", category: "Portfolio", description: "AI-powered video enhancement, miners compete to upscale low-resolution video and compress video files while preserving visual quality." },
  86: { name: "Unclaimed", category: "Not Eligible", description: "" },
  87: { name: "Lamida2", category: "Not Eligible", description: "Ecosystem subnet and venture platform focused on helping investors and builders discover, fund, launch and scale subnet businesses." },
  88: { name: "Investing", category: "Others", description: "Optimizing TAO and alpha-token staking strategies, miners compete to develop portfolio allocations and investment approaches." },
  89: { name: "InfiniteHash", category: "Not Eligible", description: "Combines Bitcoin mining with the TAO economy, allowing participants to contribute Bitcoin hashpower while earning subnet rewards." },
  90: { name: "Unclaimed", category: "Not Eligible", description: "" },
  91: { name: "Bitstarter", category: "Not Eligible", description: "Crowdfunding and startup-launch platform for Bittensor, helping new subnet teams raise capital, gain mentorship and attract community support." },
  92: { name: "Unclaimed", category: "Not Eligible", description: "" },
  93: { name: "Bitcast", category: "Portfolio", description: "Podcast and long-form audio intelligence, miners compete to transcribe, summarize, search, analyze and extract insights from spoken content." },
  94: { name: "Bitsota", category: "Others", description: "AI research network, miners compete to discover genuine machine-learning breakthroughs, evolving new algorithms and models." },
  95: { name: "Actual", category: "Not Eligible", description: "Grounding AI in real-world truth, miners verify claims, assess factual accuracy, and distinguish reliable information." },
  96: { name: "Verathos", category: "Others", description: "Cryptographically verified AI inference and training, miners perform AI computations and prove that the results were generated correctly." },
  97: { name: "Albedo", category: "Others", description: "AI model distillation, miners compress large models into smaller, faster, and cheaper models, preserving intelligence and reasoning." },
  98: { name: "ForeverMoney", category: "Not Eligible", description: "AI-powered liquidity manager, miners optimize liquidity positions on decentralized exchanges, maximizing trading-fee income." },
  99: { name: "Leoma", category: "Others", description: "AI-powered legal intelligence, miners analyze legal documents, interpret regulations and conduct legal research." },
  100: { name: "Platform", category: "Not Eligible", description: "AI evaluation and research network, miners compete across parallel challenges—such as benchmarking, bug discovery and federated training." },
  101: { name: "Unclaimed", category: "Others", description: "" },
  102: { name: "Connito AI", category: "Others", description: "Customer support intelligence, miners build AI systems to understand customer issues, retrieve relevant information and provide assistance." },
  103: { name: "Djinn", category: "Others", description: "AI agents that can plan, reason, use tools, and execute complex workflows, with miners competing to build increasingly capable digital workers." },
  104: { name: "Sovereign", category: "Others", description: "Digital sovereignty and decentralized internet infrastructure, miners provide services that reduce dependence on centralized platforms." },
  105: { name: "Beam", category: "Others", description: "Bandwidth and data-transfer network that coordinates, verifies, and optimizes the movement of data across cloud infrastructure and AI systems." },
  106: { name: "Nodexo", category: "Not Eligible", description: "GPU cloud marketplace, miners contribute GPU resources while customers rent on-demand AI compute, with performance verified through Proof-of-GPU." },
  107: { name: "Minos", category: "Others", description: "Genomic variant calling, miners compete to identify DNA mutations from genome sequencing data with clinical-grade accuracy." },
  108: { name: "TalkHead", category: "Others", description: "AI-generated talking-head videos, miners compete to create lip-synced video avatars from a reference image, text prompt and voice profile." },
  109: { name: "Academia", category: "Not Eligible", description: "Scientific research and academic knowledge generation, miners produce quality research, literature reviews, hypotheses and scholarly insights." },
  110: { name: "GreenCompute", category: "Others", description: "Energy-efficient AI infrastructure, miners provide compute resources with the lowest possible energy consumption, maintaining high performance." },
  111: { name: "OneOneOne", category: "Not Eligible", description: "Human-data network that collects, validates, and serves user-generated content—such as social posts—to provide AI with real-world knowledge." },
  112: { name: "Minotaur", category: "Not Eligible", description: "DEX aggregation and swap optimization, miners find the best routes, prices and execution strategies for cryptocurrency trades." },
  113: { name: "TensorUSD", category: "Not Eligible", description: "Creating and maintaining a TAO-backed decentralized stablecoin, miners act as decentralized market makers to support a unit of account." },
  114: { name: "SOMA", category: "Others", description: "Model Context Protocol infrastructure network enables AI agents to connect to tools, data, and other AI services, coordinating intelligence." },
  115: { name: "SoulX", category: "Not Eligible", description: "Creating lifelike AI characters and NPCs, miners build digital personalities with memory, emotional depth and evolving relationships." },
  116: { name: "Unclaimed", category: "Not Eligible", description: "" },
  117: { name: "Glyph", category: "Not Eligible", description: "Document intelligence and optical character recognition, miners extract, structure and understand information from PDFs and scanned documents." },
  118: { name: "Ditto", category: "Contender", description: "Memory and context layer for AI agents, miners provide long-term memory, retrieval, and context that allow agents to remember information." },
  119: { name: "Satori", category: "Not Eligible", description: "Data feeds and predictive intelligence, miners collect real-world data and generate forecasts that can be consumed by AI agents and traders." },
  120: { name: "Affine", category: "Contender", description: "Reinforcement learning and model-improvement network that coordinates multiple Bittensor subnets, continuously training and refining AI." },
  121: { name: "Sundae Bar", category: "Portfolio", description: "Evaluating and ranking AI agents, miners build agents that complete real-world tasks, use tools effectively and demonstrate reliable behavior." },
  122: { name: "Lamida1", category: "Not Eligible", description: "Venture creation and development, helping founders launch and scale new Bittensor businesses connecting investors, operators and subnet teams." },
  123: { name: "MANTIS", category: "Others", description: "Financial forecasting, miners compete to generate predictive signals and embeddings that improve forecasts of asset prices." },
  124: { name: "Swarm", category: "Others", description: "Coordinating large numbers of AI agents, miners build swarms of specialized agents that collaborate, divide work and solve complex tasks." },
  125: { name: "Flyspeck", category: "Not Eligible", description: "Formal verification and mathematical proof systems, miners generate, verify and validate machine-checkable proofs for mathematics and software." },
  126: { name: "Poker44", category: "Others", description: "Poker-security network miners compete to detect bots and unfair play in online poker, turning real gameplay data into fraud detection." },
  127: { name: "Astrid", category: "Not Eligible", description: "Developing and evaluating autonomous AI trading agents, miners build systems that can adapt to changing market conditions." },
  128: { name: "ByteLeap", category: "Not Eligible", description: "AI cloud-computing subnet that provides near–bare-metal GPU infrastructure for AI training and inference, connecting GPU providers with users." },
};

function extractCleanName(channelName) {
  if (!channelName) return "";
  let clean = channelName.replace(/^\d+[-–—•\s]+/, "");
  clean = clean.replace(/[-–—•\s]+\d+$/, "");
  clean = clean.replace(/[-–—•◈λ★⭐🔥]+/g, " ").trim();
  return (
    clean
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ") || channelName
  );
}

function getSubnetMeta(subnetNumber, aiGeneratedName, channelName) {
  const meta = SUBNET_META[subnetNumber];
  const name =
    meta?.name || aiGeneratedName || extractCleanName(channelName) || `Subnet ${subnetNumber}`;
  const description = meta?.description || null;
  const category = meta?.category || null;
  return { name, description, category };
}

module.exports = { SUBNET_META, extractCleanName, getSubnetMeta };
