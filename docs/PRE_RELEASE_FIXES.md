# ProfileAI Pre-Release Fix Plan (Candidate-Only Launch)

> Generated: March 28, 2026 — Full audit of backend, frontend, and Chrome extension

---

## Round 1 — App Won't Work Without These

| # | Issue | File | Details |
|---|-------|------|---------|
| 1 | **Hardcoded `localhost:5001` fallback** | `frontend/src/services/api.js` | Production breaks entirely if `VITE_API_URL` not set. Must require env var or use `/api` proxy. |
| 2 | **No env var validation at startup** | `backend/server.js` | `JWT_SECRET`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` not checked — crashes at runtime when features are used. |
| 3 | **CORS allows all origins in dev mode** | `backend/server.js` | Fallback `callback(null, true)` persists if `NODE_ENV` stays `development`. Must reject unknown origins in production. |
| 4 | **Error handler exposes stack traces** | `backend/middleware/errorHandler.js` | Raw `err.message` sent to client — may leak SQL queries, file paths, API keys. |

---

## Round 2 — Candidate UX Broken Without These

| # | Issue | File | Details |
|---|-------|------|---------|
| 5 | **Recruiter nav items visible to candidates** | `frontend/src/components/Navbar.jsx` | Dashboard, Jobs, AI Results, Calendar, Candidates, My Company, Import History — all show for candidates. |
| 6 | **Dark theme hardcoded for ALL users** | `frontend/src/components/Navbar.jsx` | `const useDarkTheme = true` — candidates see recruiter dark branding. Should be role-based. |
| 7 | **Agent Arena in nav but goes nowhere** | `frontend/src/App.jsx` | Routes redirect to `/profile`. Hide from nav or show "Coming Soon" page. |
| 8 | **50+ `console.log` statements in production** | Multiple frontend files | Leaks debug info, user data, API details to browser console. |

---

## Round 3 — Security Before Public Traffic

| # | Issue | File | Details |
|---|-------|------|---------|
| 9 | **No rate limiting on `/forgot-password`** | `backend/routes/auth.js` | Brute-force password reset attack vector. Add 3 requests per 15 min limit. |
| 10 | **Missing HSTS/security headers** | `backend/server.js` | No `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`. Add to Helmet config. |
| 11 | **No input validation on AI endpoints** | `backend/routes/profiles.js` | `/tailor-for-job` sends raw user input to AI. Prompt injection + XSS risk. |
| 12 | **Job application answers stored unsanitized** | `backend/routes/jobs.js` | Candidates can submit HTML/scripts in `applicationAnswers` — stored XSS. |
| 13 | **Impersonation endpoint lacks audit logging** | `backend/routes/auth.js` | No rate limit, no log trail, no token expiry for impersonation. |
| 14 | **Webhook verification skipped without secret** | `backend/routes/vapi.js` | If `VAPI_WEBHOOK_SECRET` not set, ALL webhooks accepted — even in production. |

---

## Round 4 — Polish & Stability

| # | Issue | File | Details |
|---|-------|------|---------|
| 15 | **Missing error boundaries** | Multiple frontend pages | `ProfileForm`, `Dashboard`, `FeedPage`, `BrowseProfiles` — one bad data shape = blank screen. |
| 16 | **`window.location.href` instead of React Router** | `api.js`, `PrivateRoute.jsx`, others | Full page reloads lose app state. Replace with Router navigation. |
| 17 | **`/applications` page not implemented** | `Navbar.jsx`, `App.jsx` | Nav item exists but page doesn't. Implement or remove from nav. |
| 18 | **401 interceptor race condition** | `frontend/src/services/api.js` | Multiple simultaneous 401s trigger multiple logouts. Add dedup flag. |
| 19 | **Empty OAuth Client IDs** | `frontend/.env` | Google/GitHub login buttons crash silently. Validate or hide OAuth buttons. |
| 20 | **sessionStorage cache has no expiry** | `frontend/src/pages/ProfileForm.jsx` | Profile enhancements cached without timestamp — stale data applied. |

---

## Recruiter Features to Disable for Launch

### Frontend Routes to Redirect → `/profile`

| Route | Component |
|-------|-----------|
| `/recruiter/onboarding` | RecruiterOnboarding |
| `/recruiter/dashboard` | RecruiterDashboard |
| `/recruiter/profile` | RecruiterProfileForm |
| `/recruiter/jobs` | RecruiterJobs |
| `/recruiter/imports` | ImportHistoryPage |
| `/recruiter/calendar` | RecruiterCalendar |
| `/recruiter/interviews` | RecruiterInterviews |
| `/recruiter/schedule-interview` | ScheduleInterview |
| `/recruiter/jobs/:id/application-form` | ApplicationFormBuilder |
| `/recruiter/jobs/:id/applications` | JobApplications |
| `/recruiter-tools/:profileId` | RecruiterTools |
| `/browse` | BrowseProfiles (recruiter search) |

### Navbar Items to Hide

- Dashboard, Jobs, AI Results, Calendar, Candidates (recruiter primary nav)
- My Company, Import History, Plans (recruiter dropdown)

### Backend Routes — Keep Dormant (No Changes Needed)

Backend recruiter routes already require `role === 'recruiter'` — they'll return 403 for candidates. No code changes needed, just hide the frontend paths.

### Candidate Features That Stay Active

- ✅ Job browsing & applications
- ✅ Profile creation & editing (with AI enhancement)
- ✅ Messaging & notifications
- ✅ Social feed & posts
- ✅ Network / followers
- ✅ Tailored profiles for job applications
- ✅ External application tracking
- ✅ Interview responses (when invited)

---

## Chrome Extension — Separate Release Cycle

**Status: NOT READY for Chrome Web Store**

| Blocker | Details |
|---------|---------|
| `<all_urls>` permissions | Must restrict to specific job board domains |
| No Content Security Policy | XSS vulnerable |
| Hardcoded `localhost` URLs | No production build pipeline |
| `innerHTML` with user data | XSS in content scripts |
| No privacy policy | CWS requirement |
| Missing promotional images | 620×620, 1280×800, 440×280 needed |
| JWT tokens in plaintext storage | Use `chrome.storage.session` + encryption |
| No token expiry checks | Tokens stored indefinitely |

**Recommendation:** Ship web app first, Chrome extension in a separate phase.

---

## Summary

| Priority | Items | Status |
|----------|-------|--------|
| **Round 1** — App basics | 4 fixes | ⬜ Not started |
| **Round 2** — Candidate UX | 4 fixes | ⬜ Not started |
| **Round 3** — Security | 6 fixes | ⬜ Not started |
| **Round 4** — Polish | 6 fixes | ⬜ Not started |
| **Recruiter disable** | 12 routes + 8 nav items | ⬜ Not started |
| **Chrome extension** | 8+ blockers | 🔴 Separate release |
