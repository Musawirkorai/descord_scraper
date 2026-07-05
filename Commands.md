# Running the App

## Development — ONE command (recommended)

From the project root:

```
cd C:\Users\iBraHeeM\Projects\discord-scraper
npm run dev
```

This starts **both** processes together with colored, labeled logs:

| Label | What runs                     | Port |
|-------|-------------------------------|------|
| API   | `src/index.js` (API + bot)    | 4000 |
| WEB   | React dev server (`frontend`) | 3000 |

> **Note:** `src/index.js` already boots the Discord bot (it requires `bot/index.js`,
> which logs in on load). You do **not** need a separate `node src/bot/index.js` —
> running it too logs the same bot token in twice.

First-time setup (installs root + backend + frontend deps):

```
npm run install:all
```

Other root scripts:

- `npm run dev:api` — backend only (API + bot)
- `npm run dev:web` — frontend only
- `npm run build`   — production build of the frontend

---

## Manual API test commands (optional — open a separate terminal)

Login:

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:4000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@test.com","password":"admin123"}' -UseBasicParsing
$token = ($response.Content | ConvertFrom-Json).token
```

Test AI trends:

```powershell
Invoke-WebRequest -Uri "http://localhost:4000/api/analytics/trends" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"scope":"channel","targetId":"1501557198453735507","targetName":"general","days":7}' -UseBasicParsing
```

---

## Debug / one-off scripts

```
cd backend
node src/debug-subnets.js
node src/run-subnets-now.js
node scripts/runNow.js
```

---

## Deployment (later)

For production you won't use `npm run dev`. Typical setup:

- **Frontend:** `npm run build` → serve the static `frontend/build` from a CDN / static host
  (Netlify, Vercel, S3+CloudFront), or have the backend serve it.
- **Backend:** run `src/index.js` under a process manager (PM2, systemd, or a Docker
  container) so it restarts on crash. Set real env vars (Mongo URI, Discord token,
  JWT secret, `FRONTEND_URL`) instead of `.env`.
- Point the frontend at the deployed API URL (replace the CRA `proxy` with an env-based
  base URL).
