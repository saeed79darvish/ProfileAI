# Load testing

Answers one question: at N concurrent users, does the API still respond — and
if not, which layer gave out first?

## The tools

| Script | What it does |
| --- | --- |
| `backend/scripts/loadTest.js` | The load generator. No dependencies. |
| `backend/scripts/seedLoadTestUsers.js` | Creates disposable users + profiles and mints their JWTs. Local only. |
| `backend/scripts/dropDuplicateIndexes.js` | Removes duplicate indexes left behind by `sync({ alter: true })`. |

## What production actually is

Sizing matters more than any single number this test produces:

- **API** — `profilleai-api`, one Render `starter` instance: 512MB RAM, 0.5 CPU,
  a **single Node process** with no clustering. Node uses one thread for
  JavaScript, so 0.5 CPU is the hard ceiling on request throughput.
- **Postgres** — `profileai-db`, `basic-1gb`: 1GB RAM, 0.5 CPU.
- **DB pool** — `DB_POOL_MAX` defaults to 10 (`backend/config/database.js`).
  Concurrent requests beyond 10 queue for a connection.
- **Frontend** — Cloudflare Workers Assets. Static, and not a scaling concern.

A dev laptop has roughly an order of magnitude more CPU than the API dyno, so
**local numbers are an upper bound, not a prediction**. Use local runs to find
code-level problems (N+1 queries, cache misses, blocking work on the event
loop) and production runs to find the real ceiling.

## Cost safety

Some endpoints spend money per request. The generator classifies every step and
**skips the paid ones by default**:

| Endpoint | Spend |
| --- | --- |
| `GET /api/external-jobs` (anonymous) | none — ranking happens inside Postgres |
| `GET /api/external-jobs/:id`, `/companies`, `/locations`, `/departments`, `/skills` | none |
| `GET /api/profiles/me`, `/api/notifications`, `/api/external-jobs/saved` | none |
| `GET /api/external-jobs/recommended` | **OpenAI embedding, blocking**, whenever the caller's profile vector is missing or over 24h old |

Rules the generator enforces:

- Paid steps run only with `ALLOW_AI_SPEND=1`, and **only against localhost**.
- Against any remote host: `SCENARIO=browse` only — anonymous, read-only,
  AI-free — and `ALLOW_AI_SPEND` is refused outright.
- `seedLoadTestUsers.js` writes a synthetic 512-dim unit vector to every seeded
  profile. That keeps the pgvector ANN query on its real code path while
  costing nothing; without it a 1000-user run would buy 1000 embeddings.

Rankings from synthetic vectors are meaningless. That's fine — these runs
measure query cost, not match quality.

## Rate limiting

Every limiter buckets by IP, and a load generator is one IP no matter how many
users it simulates. The global limiter allows 600 requests per 15 minutes, so
an unmodified run measures 429s and nothing else.

`LOADTEST_BYPASS_TOKEN` (24+ characters) makes requests carrying a matching
`x-loadtest-token` header skip all limiters. It is inert when unset, and logs a
warning at boot when set. **Unset it when the run is over.**

## Running locally

```bash
cd backend

# 1. One-time: clear duplicate indexes (see "Duplicate indexes" below)
node scripts/dropDuplicateIndexes.js          # dry run
node scripts/dropDuplicateIndexes.js --apply

# 2. Seed users. Never via POST /api/auth/register — that bcrypts on the API's
#    event loop, sends verification email, and trips the auth limiter.
COUNT=1000 node scripts/seedLoadTestUsers.js

# 3. Start the API with the limiter bypass and background jobs off, so the run
#    measures request handling rather than competing with the cron sweeps.
ENABLE_EXTERNAL_JOBS_CRON=false RUN_SWEEPS_INLINE=false RUN_CRON_INLINE=false \
  APPLYPILOT_WORKER_INLINE=false \
  LOADTEST_BYPASS_TOKEN=<24+ char token> npm start

# 4. Anonymous browsing
TARGET=http://localhost:5001 VUS=200 DURATION=60 \
  BYPASS=<same token> npm run loadtest

# 5. Signed-in users
SCENARIO=authed TOKENS=/tmp/loadtest-tokens.json \
  VUS=200 DURATION=60 BYPASS=<same token> npm run loadtest

# 6. Clean up
node scripts/seedLoadTestUsers.js --cleanup
```

## Running against production

1. Deploy the bypass (`middleware/rateLimiters.js`) — inert until the env var is
   set.
2. Set `LOADTEST_BYPASS_TOKEN` on `profilleai-api` in the Render dashboard. This
   restarts the service.
3. Ramp in stages, never straight to the target. Each stage is a separate short
   run, and the watchdog ends it as soon as the service starts to hurt:

   ```bash
   for VUS in 25 50 100 200 400; do
     TARGET=https://api.profilleai.com CONFIRM_TARGET=api.profilleai.com \
     VUS=$VUS RAMP=10 DURATION=45 THINK=1000 \
     ABORT_ERROR_PCT=2 ABORT_P95=3000 \
     BYPASS=<token> node scripts/loadTest.js || break
   done
   ```

4. **Delete `LOADTEST_BYPASS_TOKEN` from the dashboard afterwards.**

`CONFIRM_TARGET` must equal the target hostname or the generator refuses to run
— a deliberate guard against pointing a 1000-user run at a live service by
reflex.

## Reading the output

- **`probe:/health`** — `/health` does no I/O, so its latency is a near-pure
  read of **event-loop lag**. Single-digit ms means the Node process is keeping
  up. If this climbs while database timings look fine, the bottleneck is CPU on
  the API process, and the fix is more processes, not a bigger database.
- **cache column** — hit rate on the feed's 90s response cache
  (`services/simpleCache.js`). The cache key includes the user id, so signed-in
  traffic is mostly misses by design. It also caps at 1000 entries total, so
  above ~1000 distinct active users the cache thrashes and the hit rate falls
  toward zero — the point where per-request cost jumps to the uncached path.
- **status 0** — the connection never completed. The server stopped accepting
  or answering, which is a harder failure than a 500.
- **429** — the limiter fired; the bypass token is missing or wrong.

## Duplicate indexes

`sequelize.sync({ alter: true })` re-creates every UNIQUE constraint on each run
rather than detecting the existing one, appending a numeric suffix:
`Users_email_key`, `Users_email_key1`, `Users_email_key2`, and so on. A dev
database booted a few hundred times accumulates thousands.

The cost is not disk. **Postgres locks every index on a table while planning a
query against it**, so a table with ~4000 indexes needs ~4000 lock slots for a
single `SELECT`. The lock table holds
`max_locks_per_transaction × max_connections` entries — 6400 on a default
install — so two concurrent queries exhaust it and sessions start failing with
`out of shared memory`. In this app that error surfaces from
`middleware/auth.js` as a **401**, because the catch-all there treats any
failure as a bad token: signed-in users get logged out under load.

This was found on the dev database, where `Users` had grown 3,957 indexes and
concurrency of 20 was enough to trigger it. `server.js` skips `sync()` when
`NODE_ENV=production`, so production should not be affected — but
`npm run sync-db-safe` runs alter mode against whatever `DATABASE_URL` points
at, so it is worth checking:

```sql
select c.relname, count(*) from pg_index i
join pg_class c on c.oid = i.indrelid
group by 1 order by 2 desc limit 10;
```

Anything above ~30 on a single table wants investigating.
