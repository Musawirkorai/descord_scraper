# DataHarvest — Discord Scraper + AI Analysis Platform

A production-ready community intelligence system for scraping Discord, GitHub, Twitter
and analyzing it with AI.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                    │
│   React Dashboard (port 3000)  ←→  WebSocket (real-time updates)       │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTP + WS
┌─────────────────────────────▼───────────────────────────────────────────┐
│                         BACKEND API (Express · port 4000)               │
│                                                                         │
│  /api/auth   /api/servers   /api/channels   /api/messages               │
│  /api/analytics   /api/scraper                                          │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  Auth (JWT)  │  │  Rate Limit  │  │  WebSocket Broadcaster       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │
└──────┬─────────────────────────────────────────┬────────────────────────┘
       │                                         │
┌──────▼──────┐    ┌────────────────┐    ┌──────▼─────────────────────────┐
│  MongoDB    │    │  Redis Cache   │    │     AI Service Layer            │
│             │    │                │    │                                 │
│  servers    │    │  ai_results    │    │  generateDailySummary()         │
│  channels   │    │  session cache │    │  analyzeTrends()                │
│  messages   │    │  rate limits   │    │  analyzeSentiment()             │
│  ai_results │    │                │    │  customAnalysis()               │
│  users      │    └────────────────┘    │                                 │
└─────────────┘                          │  → OpenAI GPT-4o-mini           │
                                         └─────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       DATA COLLECTION LAYER                             │
│                                                                         │
│  ┌──────────────────────────────┐   ┌─────────────────────────────┐    │
│  │     Discord Bot (discord.js) │   │   GitHub REST API Adapter   │    │
│  │                              │   │                             │    │
│  │  • Real-time: MessageCreate  │   │  • Issues  • Comments       │    │
│  │  • Backfill: paginate msgs   │   │  • PRs     • Releases       │    │
│  │  • Guild sync on startup     │   │                             │    │
│  └──────────────────────────────┘   └─────────────────────────────┘    │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │     External Adapters (extensible)                               │  │
│  │     Twitter/X  ·  Reddit  ·  Slack  ·  Telegram  ·  HN          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```
discord-scraper/
├── backend/
│   ├── src/
│   │   ├── index.js                # Express app entry
│   │   ├── bot/
│   │   │   └── index.js            # Discord.js bot
│   │   ├── config/
│   │   │   ├── database.js         # Mongoose connect
│   │   │   └── redis.js            # Redis connect + cache helpers
│   │   ├── models/
│   │   │   ├── Server.js
│   │   │   ├── Channel.js
│   │   │   ├── Message.js          # Indexed for fast queries
│   │   │   ├── AiResult.js         # Cached AI outputs
│   │   │   └── User.js             # Dashboard auth
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── servers.js
│   │   │   ├── channels.js
│   │   │   ├── messages.js         # Full filtering + pagination
│   │   │   ├── analytics.js        # AI triggers
│   │   │   └── scraper.js          # Job management
│   │   ├── services/
│   │   │   ├── messageService.js   # Transform + upsert messages
│   │   │   ├── syncService.js      # Sync guilds → DB
│   │   │   ├── scraperService.js   # Historical backfill engine
│   │   │   ├── aiService.js        # OpenAI integration + caching
│   │   │   ├── websocket.js        # WS broadcaster
│   │   │   └── githubScraper.js    # GitHub adapter
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT guard + admin check
│   │   └── utils/
│   │       └── logger.js           # Winston logger
│   ├── .env.example
│   ├── package.json
│   ├── Dockerfile
│   └── Dockerfile.bot
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Full dashboard (login, nav, pages)
│   │   └── utils/api.js
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
└── docker/
    └── docker-compose.yml
```

---

## Quick Start

### 1. Discord Bot Setup

1. Go to https://discord.com/developers/applications
2. Create a New Application → Bot tab → Add Bot
3. Enable **Privileged Gateway Intents**: Server Members, Message Content
4. Copy the **Bot Token** → paste in `.env`
5. Invite bot to server:
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&permissions=68608&scope=bot
   ```
   Required permissions: Read Messages/View Channels, Read Message History

### 2. Environment Setup

```bash
cd backend
cp .env.example .env
# Edit .env — fill in DISCORD_BOT_TOKEN, OPENAI_API_KEY, JWT_SECRET
```

### 3. Run with Docker

```bash
cd docker
docker-compose up -d
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- MongoDB: localhost:27017
- Redis: localhost:6379

### 4. Create Admin User

Temporarily set `ALLOW_REGISTRATION=true` in `.env`, restart backend, then:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@you.com","password":"yourpassword","role":"admin"}'
```

Then set `ALLOW_REGISTRATION=false` again.

### 5. Run Locally (Dev)

```bash
# Terminal 1 — API
cd backend && npm install && npm run dev

# Terminal 2 — Bot
cd backend && node src/bot/index.js

# Terminal 3 — Frontend
cd frontend && npm install && npm start
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/servers` | List all servers |
| PATCH | `/api/servers/:id` | Toggle scraping |
| GET | `/api/channels?serverId=` | List channels |
| GET | `/api/messages?channelId=&keyword=&from=&to=&page=` | Filtered messages |
| GET | `/api/messages/stats` | Message stats + charts |
| POST | `/api/analytics/summary` | Generate AI daily summary |
| POST | `/api/analytics/trends` | Generate trend analysis |
| POST | `/api/analytics/sentiment` | Sentiment breakdown |
| POST | `/api/analytics/ask` | Custom AI question |
| POST | `/api/scraper/backfill/channel` | Start channel backfill |
| POST | `/api/scraper/github` | Import GitHub repo data |
| GET | `/api/scraper/jobs` | List active/past jobs |

---

## MongoDB Indexes

The Message collection uses these indexes for fast queries:

```js
{ serverId, channelId, discordCreatedAt: -1 }  // channel timeline
{ serverId, authorId, discordCreatedAt: -1 }    // user history
{ content: "text", cleanContent: "text" }        // full-text search
{ keywords: 1 }                                  // keyword filter
{ discordCreatedAt: -1 }                         // global timeline
{ source: 1 }                                    // source filter
```

---

## Extending to More Sources

Add a new file under `backend/src/services/`:

```js
// twitterScraper.js
const { saveExternalMessage } = require('./messageService');

async function scrapeTwitterSearch(query) {
  // Use Twitter API v2 or nitter
  const tweets = await fetchTweets(query);
  for (const tweet of tweets) {
    await saveExternalMessage({
      externalId: `tw_${tweet.id}`,
      serverId: `twitter_search`,
      channelId: query,
      authorId: tweet.author_id,
      authorUsername: tweet.author.username,
      content: tweet.text,
      discordCreatedAt: new Date(tweet.created_at),
      source: 'twitter',
    });
  }
}
```

The AI analysis layer works on any source since it queries by `serverId`/`channelId`.

---

## Deployment Options

### VPS (Recommended — Hostinger/DigitalOcean)

```bash
# On your VPS
git clone your-repo
cd discord-scraper/docker
cp ../backend/.env.example ../backend/.env
# Edit .env with production values
docker-compose up -d
# Optional: set up nginx + certbot for SSL
```

### Fly.io

```bash
fly launch  # in /backend
fly launch  # in /frontend
fly secrets set DISCORD_BOT_TOKEN=... OPENAI_API_KEY=...
```

### AWS

- EC2 t3.small or t3.medium (2-4 vCPU)
- MongoDB Atlas free tier
- Redis via ElastiCache or Redis Cloud free tier
- Deploy with `docker-compose` or ECS

---

## Security Checklist

- [x] Discord token stored in `.env`, never committed
- [x] JWT authentication on all API routes
- [x] Rate limiting: 200 req/15min per IP
- [x] Helmet.js security headers
- [x] Password hashing with bcrypt (12 rounds)
- [x] CORS restricted to frontend URL
- [x] Admin-only routes for mutation operations
- [x] `ALLOW_REGISTRATION` flag — disabled by default
- [ ] Add HTTPS via nginx + certbot in production
- [ ] Rotate JWT_SECRET periodically

---

## Rate Limit Handling

**Discord API**: The backfill engine uses 100 messages/request with 1s delay between
batches and 2s between channels. Discord allows ~50 req/s per bot, so this is safe.

**OpenAI**: AI results are cached in both Redis (1-24h TTL) and MongoDB to avoid
re-calling the API for identical requests.

**GitHub API**: 60 req/h unauthenticated, 5000/h with a PAT token.
#   d e s c o r d _ s c r a p e r  
 