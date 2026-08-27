# Known issues

Newest first. A fixed entry moves to **Fixed** and keeps its commit — the
history is the point of this file.

---

## Open

### Production index bloat — unverified
**Severity:** unknown, potentially severe · **Found:** 2026-08-27

`sequelize.sync({ alter: true })` re-creates every UNIQUE constraint on each
run with a numeric suffix (`Users_email_key`, `Users_email_key1`, …). The dev
database had reached **3,957 indexes on `Users`** before this was found.

Why it matters: Postgres locks every index on a table to plan a query against
it. One `SELECT` therefore wanted ~3,957 of the 6,400 available lock slots
(`max_locks_per_transaction 64 × max_connections 100`), and **20 concurrent
requests exhausted the lock table**, failing with `out of shared memory`.

`server.js` skips `sync()` when `NODE_ENV=production`, so production *should*
be clean — but `npm run sync-db-safe` runs alter mode against whatever
`DATABASE_URL` names, so it may have been run there.

**To check** — from a Render shell on `profilleai-api`:
```bash
node scripts/dropDuplicateIndexes.js      # dry run, read-only
```
Anything above ~30 indexes on one table wants investigating. Add `--apply` only
after reading the plan it prints.

---

### API saturates at ~190 req/sec
**Severity:** blocks growth · **Found:** 2026-08-27

Single Node process on half a CPU core, no clustering. Throughput plateaus at
190 req/sec; past 400 concurrent users everything additional becomes queue, and
at 800 the API returns 502s with p95 at 9 seconds. Recovers on its own within
25 seconds of load being removed.

Not a code defect — a sizing decision. Full analysis and the options in
[capacity-2026-08-27.md](capacity-2026-08-27.md).

---

### Per-process cache degrades as instances multiply
**Severity:** will bite on scale-out · **Found:** 2026-08-27

`services/simpleCache.js` holds 1000 entries in-process, and the jobs feed keys
on user id plus filters. Two consequences:

1. At ~1000 signed-in users with a few filter combinations each, the cache
   thrashes and every request falls through to Postgres against a pool of 10.
2. Adding API instances makes it *worse*, not better — each warms its own copy,
   so N instances multiply database load rather than dividing it.

Fix before scaling out, not after: shared cache, larger cap, or a coarser key.

---

## Fixed

### Rate limiting and audit IPs keyed on a proxy address
**Severity:** security + latent outage · **Fixed:** 2026-08-27

The API sits behind Cloudflare **and** Render, but `server.js` set
`trust proxy: 1`, skipping only one hop. `req.ip` therefore resolved to an
intermediate address that rotates across the provider's fleet.

Measured in production: consecutive requests reported `ratelimit-remaining` of
**481, then 599, then 599** — the counter never accumulated. So the login,
register and forgot-password limiters were not limiting anyone, the guest
analyzer's abuse caps were ineffective, and stored `ipAddress` audit values in
`GuestLeads` and `CandidateInvitations` pointed at infrastructure rather than
users.

The mirror-image failure is worse and is why this was not left alone: had that
address ever stabilised, **every user would collapse into one 600-request
bucket** and the whole API would answer 429 to everyone at once.

**Fix:** `backend/utils/clientIp.js` resolves the caller from Cloudflare's
`CF-Connecting-IP` (a single value, so no hop-counting), falling back to the
left-most `X-Forwarded-For` entry. All three limiters now key on it via
`ipKeyGenerator`, which collapses IPv6 to a /56 so a rotating client cannot
mint fresh buckets. Applied to `guestRateLimiter` and both audit sites too.

**Residual risk:** a caller reaching the Render origin directly, bypassing
Cloudflare, can set either header freely — exactly as it could already set
`X-Forwarded-For`, so this is not a new exposure. Closing it means restricting
the origin to Cloudflare's IP ranges at the platform level. Until then treat
these values as an abuse signal, not proof of identity.

---

### Database failures reported to users as "Token is not valid"
**Severity:** user-visible · **Fixed:** 2026-08-27

`middleware/auth.js` caught every exception in one block, answered
`401 Token is not valid`, and **logged nothing**. Any database trouble — pool
timeout, dropped connection, statement timeout — therefore told signed-in users
their session was invalid, and the frontend logged them out. The silence made
it invisible in the logs at the same time.

Reproduced exactly during load testing: lock-table exhaustion in Postgres
surfaced as **100% spurious 401s at a concurrency of 20**, with nothing in the
application log to explain it. It was misdiagnosed as an auth problem until the
underlying Postgres error was found by hand.

**Fix:** genuine token errors (`JsonWebTokenError`, `TokenExpiredError`,
`NotBeforeError`) still answer 401. Anything else logs at error level and
answers **503**, which keeps the session intact and tells the client to retry.
`optionalAuth` still degrades to anonymous — correct for an optional path — but
now logs instead of failing silently.
