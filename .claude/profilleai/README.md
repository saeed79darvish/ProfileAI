# ProfilleAI — working knowledge base

A living register of what the product does, how it is tested, and what is
currently broken. Written for whoever (person or agent) picks up work here
next.

| File | What belongs in it |
| --- | --- |
| [architecture.md](architecture.md) | Deployment topology, instance sizing, and the operational constraints that keep biting |
| [features.md](features.md) | The product surface — what is live, what is flag-gated off, what is dormant |
| [testing.md](testing.md) | How to test: smoke, load, and what is not covered |
| [bugs.md](bugs.md) | Known defects with status. Add, don't replace |
| [capacity-2026-08-27.md](capacity-2026-08-27.md) | Load test writeup: where the platform saturates and why |

## Relationship to `docs/`

`docs/` holds product and architecture documents aimed at the team —
roadmaps, checklists, setup guides, [`docs/LOAD_TESTING.md`](../../docs/LOAD_TESTING.md).
Those stay where they are; this folder does not duplicate them.

What lives here instead is the **operational state**: what is actually true
about the running system right now, what has been measured, and what is known
to be broken. Prefer linking to `docs/` over restating it.

## Maintaining this

- Anything measured gets its number and its date. "Slow" is not information;
  "p95 349ms at 200 concurrent on 2026-08-27" is.
- Bugs get a status, not a deletion. A fixed bug moves to Fixed with the commit
  that fixed it — the history is the point.
- Where a claim comes from code, cite `file.js:line`. Line numbers drift, so
  name the symbol too when it matters.
- If something here turns out to be wrong, correct it in place and say when.
