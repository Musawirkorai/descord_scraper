# Deployment

## The constraint that decides everything

`backend/src/index.js` requires `./bot/index` in the **same process** as the
Express API, and starts the `node-cron` subnet scheduler on the Discord client's
`ready` event. So this is not a request/response web app — it is a long-running
process holding a Discord gateway socket, and it must stay awake.

That rules out free tiers which sleep on inactivity. **Render's and Railway's
free tiers do not work for this app**: a free Render web service spins down after
15 minutes without inbound HTTP traffic, and the Discord gateway connection is
*outbound*, so it will not keep the service awake. The bot would drop offline and
the midnight cron would never fire.

Two paths work. Path A is recommended.

---

## Path A — Oracle Cloud Always Free (recommended)

One always-free ARM VM running all four containers via `docker/docker-compose.yml`.
Truly free, always on, no per-service free-tier juggling, and Mongo + Redis are
local so you are not bound by a hosted database's free limits.

Two things to know up front: Oracle reduced the Always Free Ampere allowance to
**2 OCPU / 12 GB RAM** in June 2026 (still ample here), and ARM capacity is often
exhausted in popular regions — you may need to retry or pick another
availability domain.

### 1. Create the VM

Create an **Always Free** instance: Ubuntu 22.04, shape `VM.Standard.A1.Flex`,
2 OCPU / 12 GB. Save the SSH key.

### 2. Open the ports

This trips up nearly everyone: Oracle's Ubuntu images ship with restrictive
*local* iptables rules on top of the cloud firewall. You must open both.

- **VCN**: Networking → your VCN → Security Lists → add ingress for TCP 80 and 443.
- **On the VM**:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### 3. Install Docker

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER && newgrp docker
```

### 4. Clone and configure

```bash
git clone <your-repo-url> discord-scraper
cd discord-scraper
cp backend/.env.example backend/.env
nano backend/.env      # fill in the values from the table below
```

Set `MONGO_USER` and `MONGO_PASS` too — compose reads them for the Mongo
container and builds `MONGODB_URI` from them, overriding whatever is in `.env`:

```bash
echo 'MONGO_USER=admin' >> .env
echo 'MONGO_PASS=<a-long-random-password>' >> .env
```

### 5. Launch

```bash
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs -f backend
```

The dashboard is on port 80, the API on 4000. nginx (`frontend/nginx.conf`)
proxies `/api` and `/ws` to the backend container, so the frontend's default
`/api` base is already correct — no build arg needed for this path.

### 6. Put TLS in front (recommended)

```bash
sudo apt install -y certbot
# point a DNS A record at the VM's public IP first
sudo certbot certonly --standalone -d yourdomain.com
```

Then terminate TLS in the frontend nginx container or a host-level nginx, and set
`FRONTEND_URL=https://yourdomain.com` in `backend/.env`.

---

## Path B — managed free tiers (no server to run)

| Piece | Provider | Free limit that matters |
|---|---|---|
| Frontend | Vercel / Cloudflare Pages | generous for static |
| Backend + bot | Koyeb free nano | 512 MB RAM, does not sleep |
| MongoDB | Atlas M0 | 512 MB, ~100 ops/sec |
| Redis | Upstash | 500K commands/month, 256 MB |

**Backend on Koyeb**: deploy from the repo with Dockerfile `backend/Dockerfile`,
port 4000, health check `/health`. 512 MB is tight for discord.js with the
`GuildMembers` intent — if it OOMs, that is the limit you have hit.

**Frontend**: build command `npm run build`, output `build`, and set
`REACT_APP_API_URL=https://<your-koyeb-app>/api` as a build-time env var. CRA
inlines this at build time, so it must be set before the build, not at runtime.

**Backend env**: `FRONTEND_URL=https://<your-vercel-domain>` (this is the CORS
allowlist — a comma-separated list is accepted), plus the Atlas and Upstash URLs.
Upstash uses `rediss://` (TLS), which the `redis` client handles natively.

The Atlas M0 512 MB / ~100 ops-per-sec ceiling is the limit most likely to push
you off free tier, since the scraper writes every message it sees.

---

## Environment variables

Full documentation is in `backend/.env.example`. The ones that must be right:

| Variable | Notes |
|---|---|
| `DISCORD_BOT_TOKEN` | required |
| `DISCORD_GUILD_ID` | **the scheduler is skipped without it** |
| `MONGODB_URI` | overridden by compose on Path A |
| `REDIS_URL` | optional — the API now degrades to no-cache instead of crashing |
| `LLM_PROVIDER` | `gemini` (default) or `groq` |
| `GEMINI_API_KEY` | from https://aistudio.google.com/apikey |
| `JWT_SECRET` | long random string — change it |
| `FRONTEND_URL` | CORS allowlist; comma-separated list allowed |
| `SUBNET_SCHEDULE_TZ` | IANA zone, e.g. `America/Boise`. Cron runs at 00:00 there |
| `GITHUB_TOKEN` | an expired token shows up as "no report created" |

### Why Gemini is the default provider

One subnet report makes 5 sequential LLM calls, and a single call sends ~20–30k
input tokens. Groq's **free** tier for `gpt-oss-120b` allows **8k tokens per
minute** and 200k per day — one call is roughly 3× the entire per-minute budget,
and a day's batch of ~15 calls is several times the daily budget. That tier
cannot complete a single run; it surfaces as "no report created".

Gemini's free tier is bounded by **requests per day** (~250 for Flash) rather
than tokens per day, so ~15 calls/day fits with room to spare, and the 1M context
means a month of chat no longer has to be down-sampled to fit.

**Privacy tradeoff:** Google's *free* tier may use submitted content to improve
their products, with human reviewers able to annotate inputs and outputs. Paid
tier and Vertex do not. Usernames and mentions are stripped before anything
reaches the model (`cleanMessageContent` in `services/aiService.js`), but the
discussion content still leaves your infrastructure. Use a paid key if that
matters.

---

## Verifying a deploy

```bash
curl https://your-host/health                 # {"status":"ok","uptime":...}
docker compose -f docker/docker-compose.yml logs backend | grep "LLM provider"
```

You want to see, in the backend logs:

- `✅ MongoDB connected`
- `LLM provider: Gemini (model gemini-2.5-flash, long-context mode on).`
- `✅ Discord bot logged in as ...`
- `🚀 Discord client ready and subnet scheduler started.`

To force a subnet run without waiting for midnight:

```bash
docker compose -f docker/docker-compose.yml exec backend node src/run-subnets-now.js
```

---

## Troubleshooting

**"No report created"** — almost always one of three external limits, all of
which fail quietly:
1. A dead/renamed model id. List what your key can reach:
   `curl -H "x-goog-api-key: $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/models`
2. LLM quota exhausted — grep the logs for `rate limited`.
3. An expired `GITHUB_TOKEN`.

**Bot online but no reports** — `DISCORD_GUILD_ID` is unset, so `startScheduler`
was skipped. Check for the `⚠️ DISCORD_GUILD_ID is missing` warning at startup.

**Dashboard loads but every request fails** — `REACT_APP_API_URL` was wrong at
*build* time, or the frontend origin is not in `FRONTEND_URL`. Check the browser
console for a CORS error.

**Container exits immediately on ARM** — a stale `node_modules` being copied into
the image. `backend/.dockerignore` and `frontend/.dockerignore` prevent this;
make sure they are committed.

**Rate limits on Groq don't improve with more keys** — Groq quota is per
*organization*, not per key. Extra keys from one Groq account add nothing. Gemini
quota is per *project*, so keys from separate projects do add capacity.
