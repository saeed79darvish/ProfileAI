# Product surface

Last verified: **2026-08-27**, against `server.js` route mounts and
`config/featureFlags.js`.

The product launched **candidate-only**. A large amount of recruiter-side code
exists and is mounted behind flags that are off in production — an unmounted
route returns 404, so "the endpoint 404s" usually means "the flag is off", not
"it was never built".

## Flag state in production

| Flag | Prod value | Effect when off |
| --- | --- | --- |
| `ENABLE_RECRUITER_SURFACE` | `false` | `/api/smart-match`, `/api/recruiter-profiles`, `/api/candidates`, `/api/guest-screening`, `/api/harvest`, `/api/vapi`, `/api/phone-screening` all unmounted |
| `ENABLE_FEED` | `false` | `/api/posts` and its nested comment/like routes unmounted |
| `ENABLE_CLAUDE_CONNECTOR` | `true` | `/mcp` plus the OAuth 2.1 endpoints are live |
| `ENABLE_APPLYPILOT` | dashboard | Whole `/api/applypilot/*` surface 404s except for admins and `APPLYPILOT_ALLOWED_USERS` |
| `APPLYPILOT_AUTOSUBMIT` | dashboard | Hybrid mode: prep runs, but the candidate submits manually |

Flags marked "dashboard" are `sync: false` in `render.yaml`, so the dashboard
value wins over the file on every Blueprint sync.

## Live candidate surface

**Accounts** — `/api/auth`. Email/password plus Google, GitHub, and LinkedIn
OAuth. Email verification is enforced by `requireVerifiedEmail` on most
authenticated routes. Only the `www` LinkedIn callback is registered; the apex
host fails the handshake.

**Profiles** — `/api/profiles`, `/api/projects`, `/api/tailored-profiles`,
`/api/resume`. Resume import and parsing, AI summaries, tailored profile
variants, PDF/DOCX generation. Profiles carry a 512-dim `openaiEmbedding` used
for job ranking.

**Job discovery** — `/api/external-jobs`. **Deliberately public**: logged-out
visitors can browse, which is the acquisition funnel. Auth is applied per-route
inside the router. This is the hot path and the busiest surface in production.
- Ranking has three modes: `recommended` (match × recency), `match`, `recent`.
  Anonymous visitors always get pure recency, since there is no profile to rank
  against.
- Semantic ranking uses pgvector against the profile embedding. The query
  embedding was deliberately removed from the request path — role/query text is
  ranked lexically inside Postgres instead, which measured better *and* costs
  nothing.
- Ghost-job detection demotes postings nobody appears to be hiring for via
  `ghostScore`. It never deletes.
- Corpus hygiene (sync, ghost scan, embedding backfill, prune, dedupe) runs on
  the cron worker, never on the API.

**Applications** — `/api/external-applications`, `/api/jobs`,
`/api/interviews`. Saved jobs, applied tracking, interview records.

**ApplyPilot** (gated) — `/api/applypilot`. Scouts matching jobs, prepares
tailored materials, and can auto-submit to Greenhouse, Lever, Ashby and Workday
via Puppeteer. Credentials are handled **server-side only** — never surface a
credentials UI. Currently hybrid: prep is automatic, submission is manual.

**Claude connector** — `/mcp`. A Claude.ai custom connector with its own OAuth
2.1 flow, letting a Claude user query their ProfilleAI data. Live in production.

**Supporting** — `/api/notifications`, `/api/referrals`, `/api/support`,
`/api/kudos`, `/api/polls`, `/api/reputation`, `/api/follows`, `/api/messages`,
`/api/invitations`, `/api/subscriptions`, `/api/credit-packs` (Stripe),
`/api/admin`.

**Chrome extension** — `chrome-extension-react/`. Side panel with LinkedIn
profile analysis and job-match scoring. Talks to the same API; its origin is
allowlisted via `CHROME_EXTENSION_ID`.

## Dormant / flagged off

Recruiter search and smart-match, recruiter profiles, the agent arena,
candidate harvest and import, phone screening (Vapi voice), guest screening,
and the social feed (posts, comments, likes). The code is present and mounted
only when its flag is on.

## Scheduled work

Runs on `profileai-cron-worker` via `npm run cron`: external job sync, the
ApplyPilot scout, the daily digest email (`0 8 * * *`), and the corpus-hygiene
sweeps. `ENABLE_JOB_RETENTION` ships **off on purpose** — the code default is
on, and enabling it retires most of the feed within hours. Turn it on
deliberately and watch `/api/external-jobs/health`.
