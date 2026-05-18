# ApplyPilot — backend notes

## What this is

The backend for the `/agent-arena/*` screens in the frontend. Four routes
groups mounted at `/api/applypilot/*`:

| Screen      | Endpoints                                                |
| ----------- | -------------------------------------------------------- |
| Setup       | `GET/PUT /config`, `POST /start`, `POST /pause`          |
| Dashboard   | `GET /stats`, `GET /queue`, `GET /activity`, `GET /status` |
| Review      | `GET /applications/:id`, `GET /applications/:id/resume.pdf`, `POST /applications/:id/preview|approve|submit|reject|reopen|edit|request-edit|resolve` |
| Platform    | `GET /ats`, `GET/POST /credentials`, `POST /submit`     |
| Training    | `GET /training`, `POST /training/messages`, `GET/PUT/DELETE /training/memory[/:id]` |

## Files

- `routes/applyPilot.js`              – HTTP surface
- `services/applyPilotService.js`     – Claude calls + DB helpers
- `services/applyPilotScout.js`       – cron worker (every 10 min)
- `models/ApplyPilot*.js`             – 4 Sequelize models

## Environment

Uses the same `ANTHROPIC_API_KEY` as the rest of the backend (loaded by
`services/ai/core.js`). No extra env vars required.

## First run

1. `npm run dev` — Sequelize in dev mode calls `sequelize.sync({ alter: true })`
   on boot, which will create the four `ApplyPilot*` tables.
2. Log in as a candidate on the frontend → visit `/agent-arena`.
3. Run the Setup wizard and click *Start ApplyPilot*. This flips
   `ApplyPilotConfig.state = 'running'`.
4. Either wait for the 10-minute cron cycle or call the scout by hand:
   ```js
   node -e "require('./services/applyPilotScout').runScout().then(() => process.exit(0))"
   ```
5. Watch `ApplyPilotApplication` rows appear with `status='pending'`
   → `'preparing'` → `'prepared'`. The Review screen picks them up
   automatically.

## Gotchas

- **Scoring cost.** `scoreJob()` runs once per candidate job per user per
  scout cycle. The batch is capped at `BATCH_JOBS_PER_USER=30` in
  `applyPilotScout.js`. Raise/lower to match budget.
- **Submit is queued.** `POST /applications/:id/approve` and
   `POST /applications/:id/submit` enqueue the `applypilot:submit`
   worker, which renders a resume PDF, picks an ATS adapter, and writes
   `submitting` → `submitted|failed|needs_attention` back onto the row.
- **Credentials are not implemented yet.** `/credentials` exists as a
   route surface placeholder so the frontend can probe capabilities, but
   there is no vault-backed ATS login storage yet.
- **Embeddings.** `ApplyPilotTrainingMemory.embedding` is a nullable
  `FLOAT[]` column — unused today, but leaves the door open for a
  "most relevant memory row" lookup when answer drafts get long.
- **The legacy `agentArenaAPI`** in `routes/agentArena.js` is a separate
  feature (agent↔agent negotiation); the two do not share state.
