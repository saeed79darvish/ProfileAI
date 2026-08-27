# Deployment architecture and operational constraints

Last verified: **2026-08-27**

## Topology

```
browser ──► Cloudflare ──► Render LB ──► profilleai-api (Node/Express)
                                              │
   profilleai.com (Cloudflare Workers Assets)  ├──► profileai-db (Postgres 18 + pgvector)
                                              │
                          profileai-cron-worker ┘
```

| Component | Where | Plan | Notes |
| --- | --- | --- | --- |
| Frontend | Cloudflare Workers Assets | — | `wrangler.jsonc` + `worker.js` at repo root. Static; not a scaling concern |
| API | Render `profilleai-api` | `starter` — 512MB, **0.5 CPU** | Single Node process, **no clustering**. Bound to api.profilleai.com |
| Cron worker | Render `profileai-cron-worker` | `starter` | Owns external-jobs sync, digest, and all corpus-hygiene sweeps |
| Database | Render `profileai-db` | `basic-1gb` — 1GB, 0.5 CPU | Postgres 18, pgvector. Internal network only, no public access |

Service names are load-bearing and inconsistent on purpose: the API is
`profilleai-api` (**double l**), the worker is `profileai-cron-worker`
(**single l**). Renaming either in `render.yaml` makes a Blueprint sync spawn a
duplicate service rather than adopt the existing one. This has happened before
and caused double cron runs against one database.

## Constraints that keep biting

**No staging environment.** Backend deploys on push to `main` (`autoDeploy: true`).
The frontend is separate and needs its own `wrangler deploy` — a backend push
does not ship frontend changes.

**The production database is unreachable from a dev machine** (`ipAllowList: []`).
Anything that needs to inspect prod data runs from a Render shell.

**`git push` is not reliably automatic here.** Always `git fetch` and compare
before believing a backend change is live.

**Blueprint drift is real.** `render.yaml` has repeatedly disagreed with the
running services; a failing sync means *nothing* in that file reaches
production, so services run on dashboard values plus code defaults. The file
carries long comments explaining each trap — read them before editing it.

**Background work must not run on the API dyno.** `RUN_CRON_INLINE` and
`RUN_SWEEPS_INLINE` must both stay `false` there. Running sweeps inline
alongside request traffic previously caused Postgres deadlocks and
`JavaScript heap out of memory` crashes.

## Request-path facts worth knowing

- **DB pool** is `DB_POOL_MAX` (default **10**) per process, with `min: 2` kept
  warm. `statement_timeout` is 15s and `hnsw.ef_search` is 200, both set per
  connection in `backend/config/database.js`.
- **Response cache** is in-process and capped at **1000 entries**
  (`backend/services/simpleCache.js`). The jobs feed caches for 90s under a key
  that includes the user id, so signed-in traffic is mostly misses by design.
- **Two proxies sit in front**, so `req.ip` is not the caller. Use
  `clientIp(req)` from `backend/utils/clientIp.js` for anything identity-bearing.
- **`effectivePostedAt` is trigger-maintained.** Never write it from application
  code; it is the canonical feed sort date.

## Measured capacity

~190 req/sec, CPU-bound on the single Node process. Full numbers and method in
[capacity-2026-08-27.md](capacity-2026-08-27.md).
