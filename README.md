# ProfilleAI - AI-Enhanced Career Platform

An AI-powered platform that helps candidates build a professional profile, get matched against a continuously-synced external job corpus, and tailor their resume per application.

> **Naming:** the repo and local package names are still `ProfileAI`, but the public brand and domain are **ProfilleAI** (`profilleai.com`, double "l"). Both spellings are load-bearing in different places — see [Deployment](#-deployment) before renaming anything.

**Current launch scope is candidate-only.** The recruiter surface, social feed, Agent Arena, and the Claude connector all ship in the codebase but are gated off by default. See [Feature Flags](#-feature-flags).

## 🌟 Features

### Live for candidates
- **Auth** - JWT sessions plus Google, GitHub, and LinkedIn OAuth
- **Profile builder** - Skills, experience, projects, education, with resume upload and parsing (PDF and DOCX)
- **AI enhancement** - Generated summaries, key strengths, recruiter insights, and SEO keywords
- **Job matching** - Semantic search over a synced external-jobs corpus using pgvector embeddings, with ghost-job scoring to demote stale postings
- **Resume tailoring** - Per-job resume and cover-letter generation, exported as PDF or DOCX
- **Daily digest** - Opt-in job-match email

### Built but flagged off
- **Recruiter surface** - Candidate search, smart match, harvest, phone screening
- **ApplyPilot** - Scouts matching jobs and prepares application materials. Runs in hybrid mode (prepares only; the candidate submits manually). Full auto-submit drives ATS forms through Puppeteer and is a separate flag.
- **Social feed**, **Agent Arena**, **Claude connector** (Remote MCP server at `/mcp`)

## 🛠️ Tech Stack

### Frontend
- React 18 + TypeScript, built with **Vite**
- Material-UI (MUI) v5, Framer Motion, Chart.js
- Context API for state, Axios for transport
- Sentry for error reporting

### Backend
- Node.js 22 + Express
- PostgreSQL 16 with **pgvector** for embedding search
- Sequelize ORM
- pg-boss for the ApplyPilot job queue, node-cron for schedules
- OpenAI (`gpt-4o-mini`, `text-embedding-3-small`), Anthropic, and Voyage
- Puppeteer for ATS automation, Resend for email, Stripe for billing

## 📋 Prerequisites

- Node.js 22.x (backend) and Node 20+ (frontend)
- PostgreSQL 14+ with the `vector` extension available
- OpenAI API key (required); Anthropic, Voyage, Cloudinary, Resend, and Stripe keys are optional per feature

## 🚀 Installation & Setup

### 1. Clone

```bash
git clone https://github.com/saeed79darvish/ProfileAI.git
cd ProfileAI
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Minimum working `.env`:

```env
PORT=5001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=profileai
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRE=7d

OPENAI_API_KEY=your_openai_api_key_here
VOYAGE_API_KEY=            # optional, used for some embedding paths

CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

### 3. Database

```bash
psql -U postgres -c "CREATE DATABASE profileai;"
psql -U postgres -d profileai -c "CREATE EXTENSION IF NOT EXISTS vector;"

cd backend
npm run init-db          # creates tables
npm run enable-pgvector  # verifies the extension + vector columns
```

Seeding helpers: `npm run add-mock-profiles`, `npm run add-50-candidates`, `npm run seed-aggregators`.

> Seed local test users directly through Sequelize. Do not point `/api/auth/register` at real credentials from `.env`.

### 4. Frontend

```bash
cd ../frontend
npm install
```

`frontend/.env` leaves `VITE_API_URL` commented out by default so requests go through the Vite dev proxy (this is what makes testing from a phone on the LAN work). Set it only if you need to hit a backend on another host.

### 5. Run

**Terminal 1 - backend:**
```bash
cd backend && npm run dev
```

**Terminal 2 - frontend:**
```bash
cd frontend && npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5001

**Optional - background jobs:**
```bash
cd backend && npm run cron    # external-jobs sync, digest, corpus-hygiene sweeps
```

Instead of the separate process you can set `RUN_CRON_INLINE=true` and `RUN_SWEEPS_INLINE=true` to embed them in the API for convenience. **Local only** - see [Operational notes](#operational-notes).

## 🚩 Feature Flags

All flags are env-var booleans (`true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`) and default to **off**. Defined in [backend/config/featureFlags.js](backend/config/featureFlags.js) and [frontend/src/config/featureFlags.ts](frontend/src/config/featureFlags.ts).

### Backend (`backend/.env`)

| Env var | Code key | Default | What it does |
|---|---|---|---|
| `ENABLE_RECRUITER_SURFACE` | `recruiterSurface` | `false` | Master gate for the recruiter side. Off means every recruiter-only route returns 404, which decommissions the expensive AI surfaces (smart match, recruiter job AI, phone screening, candidate search). |
| `ENABLE_RECRUITER_AGENT_ARENA` | `recruiterAgentArena` | `false` | Recruiter Agent Arena (AI-driven candidate screening flow). |
| `ENABLE_APPLYPILOT` | `applyPilotEnabled` | `false` | Master gate for ApplyPilot. When off, `/api/applypilot/*` returns 404 for everyone except admins and `APPLYPILOT_ALLOWED_USERS`. |
| `APPLYPILOT_ALLOWED_USERS` | `applyPilotAllowedUsers` | empty | Comma-separated email allowlist for staged tester rollout while the master gate is still off. |
| `APPLYPILOT_AUTOSUBMIT` | `applyPilotAutoSubmit` | `false` | Turns ApplyPilot from hybrid mode (prepare materials, user submits manually) into full auto-submit. Mounts the submit worker, scout enqueue, and approve/submit routes. |
| `ENABLE_FEED` | `feed` | `false` | Mounts the social-feed API (`/api/posts` and nested comment/like/save routes). |
| `ENABLE_CLAUDE_CONNECTOR` | `claudeConnector` | `false` | Mounts the `/mcp` endpoint (Remote MCP server) so ProfilleAI can be added as a Custom Connector in Claude.ai. |
| `ENABLE_PHONE_SCREENING_SCHEDULER` | n/a | `false` | Starts the phone-screening scheduler. Keep off unless the screening tables are migrated. |

### Frontend (`frontend/.env`)

| Env var | Code key | Default | What it does |
|---|---|---|---|
| `VITE_ENABLE_RECRUITER_SURFACE` | `recruiterSurface` | `false` | Renders recruiter routes and nav links. Pair with the backend flag. |
| `VITE_ENABLE_RECRUITER_AGENT_ARENA` | `recruiterAgentArena` | `false` | Agent Arena UI in the AI Screening config modal and Browse Profiles. |
| `VITE_ENABLE_FEED` | `feed` | `false` | Mounts the `/feed` route, Feed nav link, and Community-Feed footer link. |
| `VITE_ENABLE_CLAUDE_CONNECTOR` | `claudeConnector` | `false` | Shows the "Use ProfilleAI in Claude" promo and onboarding UI. |
| `VITE_ENABLE_APPLYPILOT_COACH` | `applyPilotCoach` | `false` | ApplyPilot "Coach training" tab. Code ships regardless; the flag only reveals it. |

**Usage:** backend and frontend flags are independent. Turn both on for any user-facing feature that has an API and a UI.

## 🔑 API Surface

Full route list lives in [backend/routes/](backend/routes/) and is mounted in [backend/server.js](backend/server.js). Highlights:

### Authentication
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- OAuth token-exchange endpoints for Google, GitHub, and LinkedIn (`POST /api/auth/{google,github,linkedin}` plus matching `/register` variants)

### Profiles
- `GET /api/profiles/me`, `POST /api/profiles`, `GET /api/profiles/:id`
- `POST /api/profiles/enhance` - AI enhancement
- Resume upload and parse (PDF and DOCX, 5MB cap, parsed in-process)

### Jobs
- `GET /api/external-jobs` - ranked feed, semantic plus keyword, with filters and pagination
- Apply-click tracking and applied-badge lookups

### Ops
- `GET /health` - liveness probe used by Render's health check

## 📦 Project Structure

```
ProfileAI/
├── backend/                  # Express API + workers (deployed to Render)
│   ├── config/               # database, featureFlags
│   ├── middleware/           # auth, recruiterSurface gate, errorHandler
│   ├── models/               # Sequelize models
│   ├── routes/               # ~34 route modules
│   ├── services/             # ~55 services (AI, embeddings, ATS adapters, jobs)
│   ├── workers/              # cronWorker, sweepWorker, prepWorker, submitWorker
│   ├── scripts/              # init-db, migrations, backfills, smoke tests
│   ├── mcp/                  # Remote MCP server (Claude connector)
│   └── server.js
│
├── frontend/                 # React + Vite SPA (deployed to Cloudflare)
│   └── src/{components,contexts,pages,services,config}
│
├── chrome-extension-react/   # Browser extension
├── content/                  # Blog and SEO content
├── docs/                     # Internal docs and QA briefs
├── render.yaml               # Render Blueprint (API + cron worker + Postgres)
├── wrangler.jsonc            # Cloudflare Workers config (frontend hosting)
└── worker.js                 # Cloudflare edge worker (redirects, asset serving)
```

## 🔒 Security

- bcrypt password hashing, JWT auth on protected routes
- Helmet, CORS allowlist, and express-rate-limit
- Sequelize parameterization against SQL injection
- express-validator on inputs; disposable-email-domain blocking on signup
- Upload size caps on every multipart route

## 🚢 Deployment

Two hosting systems, deployed separately.

### Backend - Render ([render.yaml](render.yaml))

Blueprint provisions three things:

| Service | Type | Plan | Purpose |
|---|---|---|---|
| `profilleai-api` | web | starter (512MB) | The API, bound to `api.profilleai.com`. **Double "l".** |
| `profileai-cron-worker` | worker | starter (512MB) | External-jobs sync, digest, corpus-hygiene sweeps. **Single "l".** |
| `profileai-db` | Postgres | basic-256mb | Shared database, pgvector enabled |

The two spellings are not a typo and are not interchangeable. The API service is double-"l"; the worker and database are single-"l". A Blueprint name that does not exactly match a live service does not update it — it creates a second one.

Deploys are triggered by pushing to `main` (`autoDeploy: true`).

### Frontend - Cloudflare Workers Assets ([wrangler.jsonc](wrangler.jsonc))

```bash
npm run deploy        # builds frontend/build, then wrangler deploy
npm run deploy:nobuild
```

**The frontend does not deploy on git push.** A Render static site for the frontend was removed precisely because Render kept rebuilding from `main` while DNS pointed at Cloudflare, so frontend fixes silently never reached users. Every frontend change needs an explicit `wrangler deploy`.

### Operational notes

These are the ones that have actually bitten:

- **Service names must match the live services character for character.** The API is `profilleai-api` (double "l"); the worker is `profileai-cron-worker` and the database is `profileai-db` (single "l"). A mismatch does not rename anything — it spawns a duplicate service that deploys from `main` alongside the real one. This has already happened once to the API, and the duplicate ran boot migrations and queue workers against the shared Postgres until it was suspended.
- **`RUN_CRON_INLINE` and `RUN_SWEEPS_INLINE` must both stay `false` in production.** The cron worker owns those jobs. Running them inline too meant up to 8 concurrent batch sweeps colliding on `ExternalJobs` locks and competing with request traffic for heap, which crashed the API with `JavaScript heap out of memory`.
- **Confirm backend deploys landed.** `git push` is not reliably automatic here. Run `git fetch` and compare against the remote before assuming a backend change is live.
- **There is no staging, and the production database is not reachable from a dev machine.** Test against local Postgres.
- **`effectivePostedAt` is trigger-maintained.** It is the canonical feed sort date; never write it from application code.

## 🧪 Testing

```bash
cd backend && npm run smoke     # smoke test against a running API
cd frontend && npm run type-check && npm run lint
```

## 📄 License

MIT.

## 👤 Author

**Saeed Darvish**
- Email: saeed79darvish@gmail.com
- LinkedIn: [linkedin.com/in/saeed-darvish](https://linkedin.com/in/saeed-darvish)
- Location: San Francisco, CA

## 📞 Support

Open an issue on GitHub or contact saeed79darvish@gmail.com.

---

**Built with ❤️ by Saeed Darvish**
