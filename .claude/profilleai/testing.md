# Testing

Last verified: **2026-08-27**

There is no automated test suite in this repo. What exists is a smoke test and
a load-testing harness, both run by hand.

## Smoke test

```bash
cd backend
API=http://localhost:5001 npm run smoke
```

Exercises the candidate launch surface end to end and exits non-zero on any
failure, so it is CI-wireable. Deliberately skips recruiter routes, which are
flag-gated off. Point `API` at any host to run it against a deployed
environment.

## Load testing

Full method in [`docs/LOAD_TESTING.md`](../../docs/LOAD_TESTING.md). Results in
[capacity-2026-08-27.md](capacity-2026-08-27.md). Short version:

```bash
cd backend
COUNT=1000 node scripts/seedLoadTestUsers.js          # local only
VUS=200 DURATION=60 BYPASS=<token> npm run loadtest
node scripts/seedLoadTestUsers.js --cleanup
```

Three rules the harness enforces so a run cannot go wrong quietly:

1. **A remote target is locked to anonymous, read-only browsing.** Signed-in
   scenarios need seeded accounts, which only exist locally.
2. **Paid endpoints are skipped by default.**
   `GET /api/external-jobs/recommended` blocks on an OpenAI embedding whenever
   the caller's profile vector is missing or over 24h old. Seed synthetic
   embeddings rather than letting the app generate real ones.
3. **`CONFIRM_TARGET` must match the hostname** before anything runs against a
   live service.

Rate limiting buckets by IP and a load generator is one IP, so a meaningful run
needs `LOADTEST_BYPASS_TOKEN` set on the service. **Remove it afterwards.**

## Seeding local data

Never create test users through `POST /api/auth/register`: it bcrypts on the
API's event loop, sends real verification email, and trips the auth limiter.
Seed through Sequelize instead — `scripts/seedLoadTestUsers.js` is the pattern.

## What is not covered

- **No automated regression suite.** Every change is verified by hand.
- **Signed-in load against production has never been measured.** All production
  load numbers are anonymous browsing at ~99% cache hit rate, which is the
  cheapest path through the API by a wide margin.
- **Writes, uploads, resume parsing, and ApplyPilot have not been load-tested
  at all.** All are heavier per request than anything measured so far.
- **The database has never been pushed.** In every run so far the API process
  saturated first, so Postgres's ceiling is unknown.

## Watch during any test

`GET /health` does no I/O, so its latency is close to a pure reading of Node
event-loop lag. If it climbs while database timings look fine, the bottleneck
is CPU on the API process — more processes will help, a bigger database will
not.
