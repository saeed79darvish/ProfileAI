# ProfilleAI QA Tester Brief

Welcome, and thanks for taking this on. Read this whole document before you
start testing. It will save you hours and it tells you exactly what I consider
a valuable bug.

---

## 1. What the product is

ProfilleAI is an AI-powered job platform. Three things happen here:

- **Candidates** build a profile (often by uploading a resume, which gets
  parsed by AI), search jobs, tailor their resume to a specific job, and apply.
- **Recruiters** post jobs, review applicants, screen them, and schedule
  interviews.
- **A Chrome extension** rides along on external job sites (LinkedIn,
  Greenhouse, Lever, Workday, and others), detects the job on the page,
  autofills application forms, and tailors the candidate's resume in a side
  panel.

There is also an admin area, a messaging system, a social feed, and polls.

Roughly 90 screens on the web app plus the extension. It is a big surface. You
will not test all of it in the first engagement, which is why section 5
prioritizes.

---

## 2. Environment and accounts

**Test URL:** provided separately by DM. Do not post it publicly.

**Accounts:** I will give you pre-seeded logins for each role. Do not create
your own accounts through the signup form except when you are specifically
testing signup, and tell me when you do so I can clean them up.

| Role | Purpose |
|---|---|
| Candidate A | Fresh account, no profile, for onboarding flows |
| Candidate B | Fully built profile, for job search, apply, tailor |
| Recruiter | Posting jobs, reviewing applicants, interviews |
| Admin | Admin dashboard, users, promos, support |

**Important about AI credits.** Every AI feature (resume parse, profile
enhance, resume tailoring, cover letter, gap review, keyword analysis) is
metered per account and costs me real money per call. On the free tier you get
about 2 profile enhances and 5 tailors per month, so you will hit the wall
almost immediately. The accounts I give you will have raised limits. If you see
a "limit reached" or "out of credits" message, **stop and tell me** rather than
creating new accounts to get around it.

**Email:** signup, password reset, and interview invites send real email. Use
the mail account I give you, not your personal one.

---

## 3. Rules of engagement

Please do these:

- Test like a real user having a bad day. Refresh mid-flow. Press the browser
  back button. Open two tabs on the same flow. Submit a form twice fast.
  Upload the wrong file type. Leave required fields blank. Paste 5,000
  characters into a field expecting 50.
- Log every bug as you find it. Do not batch them up in your memory for the
  end of the day.
- Record a short screen capture for anything that is not obvious from a
  screenshot. Loom, or any tool, as long as I can watch it in a browser.

Please do not do these:

- Do not run automated scanners, load tests, or brute-force tools against the
  site.
- Do not test payment with a real card. If you reach a checkout screen, stop
  and report what you see. I will hand you test card details if I want that
  flow covered.
- Do not delete other users' data from the admin panel. Read-only exploration
  of admin is fine, destructive actions only on accounts I flag as disposable.
- Do not send me a Lighthouse or accessibility-scanner export as a bug list. I
  want functional bugs found by a human.

---

## 4. What counts as a good bug

I care about these, roughly in order:

1. **Broken flow.** A user cannot complete something they came to do.
2. **Wrong or lost data.** Something the user entered vanishes, shows up on the
   wrong screen, or shows up for the wrong user.
3. **Bad state.** Works the first time, fails the second. Works until you
   refresh. Stale data after an update. Two tabs disagreeing.
4. **Permission leaks.** A candidate seeing recruiter data, a logged-out user
   reaching a logged-in page, one user seeing another's information.
5. **Confusing or wrong copy** at a decision point, error messages that do not
   say what went wrong.
6. **Layout breakage** that actually blocks use on mobile, not 2px misalignment.

Low value, please deprioritize: color and spacing opinions, "the font could be
bigger", missing meta tags, console warnings with no user-visible effect.

### Bug report format

One entry per bug. I need every field.

```
ID:        (sequential, BUG-001)
Title:     One line. What breaks, where.
Severity:  Critical / High / Medium / Low  (definitions below)
Role:      Guest / Candidate / Recruiter / Admin / Extension
Where:     URL or extension surface
Env:       Browser + version, OS, desktop or mobile, screen width
Steps:     1. ...  2. ...  3. ...   (numbered, so I can follow them exactly)
Expected:  What should have happened
Actual:    What did happen
Evidence:  Screenshot and/or video link
Frequency: Always / Sometimes (x out of y attempts) / Once
Notes:     Anything from the browser console, network tab, or a hunch
```

**Severity definitions:**

- **Critical** — data loss, security or privacy leak, a core flow is completely
  impassable (cannot sign up, cannot apply, cannot post a job).
- **High** — a core flow is passable but badly broken, or a secondary flow is
  impassable.
- **Medium** — annoying, has a workaround, or affects a less-used path.
- **Low** — cosmetic, copy, or edge case a real user would rarely hit.

Deliver as a Google Sheet or Notion table, one row per bug. Not a Word doc.

---

## 5. Web app test scope, in priority order

Work top to bottom. If you run out of hours, I would rather have P1 and P2 done
thoroughly than all five done shallowly.

### P1. Candidate core path

This is the money path. Test it hardest.

- `/register` and `/signup` — signup, validation, duplicate email, weak
  password, email verification
- `/login`, `/forgot-password`, `/reset-password/:token` — including an
  expired or reused reset link
- Sign in with Google and with LinkedIn
- `/onboarding` — the intro carousel, every branch, and what happens if you
  abandon halfway and come back
- **Guest profile builder** — build a profile *before* registering, then
  register, and confirm the draft survives and attaches to the new account.
  This is new and I expect bugs here.
- `/profile/create`, `/profile/create-form`, `/profile/edit` — resume upload
  and AI parsing, then editing what came back, then saving. Try a scanned PDF,
  a .docx, a 20-page resume, a resume in another language, and a corrupt file.
  Pay attention to whether parsed education and work history survive a save.
- `/profile/preferences` — the job preferences wizard
- `/jobs`, `/jobs/:id` — search, filters, pagination, sort, empty results
- `/jobs/:id/apply` — the full application, including the tailor-resume step
- `/my-jobs`, `/track` — application tracking after applying
- `/dashboard`, `/profile`

### P2. Recruiter core path

- `/recruiter/onboarding`, `/recruiter/profile`
- `/recruiter/jobs` — create, edit, close, and delete a job posting
- `/recruiter/jobs/:id/application-form` — the custom application form builder
- `/recruiter/jobs/:id/applications` — reviewing applicants, status changes
- `/recruiter-tools/:profileId` — candidate screening tools
- `/recruiter/interviews`, `/recruiter/calendar`, `/recruiter/schedule-interview`
  — scheduling, timezones, rescheduling, cancelling. Timezone handling is a
  classic bug source, test it across at least two timezones.
- `/screen/:token` — the guest screening link, opened logged out
- `/invite/:token` — invitation acceptance, including an already-used invite

**Cross-role check:** after a recruiter changes an application's status, does
the candidate see the correct new status? Run the two roles in two browsers
side by side.

### P3. Cross-cutting

- **Auth boundaries.** While logged out, paste in a logged-in URL from each
  list above. While logged in as a candidate, try every `/recruiter/*` and
  `/admin/*` URL. Report anything that renders instead of redirecting.
- **Mobile.** Real phone if you have one, otherwise devtools at 390px and
  768px. P1 flows only.
- **Browsers.** Chrome first, then Safari and Firefox on the P1 path.
- `/messages`, `/notifications`, `/network` — real-time behavior, unread
  counts, whether counts clear correctly
- `/pricing`, `/subscription/success` — read only, do not pay

### P4. Secondary features

`/feed`, `/polls`, `/poll/:id`, `/browse`, `/profile/:id`, `/recruiter/:id`,
`/company/:slug`, `/blog`, `/blog/:slug`, `/help`, `/resume/download`,
`/interviews`, `/applypilot`

### P5. Admin

`/admin`, `/admin/users`, `/admin/promos`, `/admin/support`. Read-only
exploration plus promo code creation and redemption.

---

## 6. Chrome extension scope

**This is not optional and it is not an afterthought.** The extension is a
major part of the product and it is the least tested. Budget at least a quarter
of your hours here.

### Setup

I will send you either a `.zip` of the built extension or a Chrome Web Store
link. To load a zip:

1. Unzip it somewhere permanent.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.
5. Pin the extension to the toolbar.

Tell me immediately if the extension you load points at the wrong backend. The
side panel will show sign-in failures if so, and that is a build configuration
problem on my side, not a bug for you to chase.

### Surfaces to test

The extension has five distinct UI surfaces. Test each.

1. **Toolbar popup** — click the extension icon
2. **Side panel** — the main surface, most features live here
3. **Onboarding page** — opens on first install
4. **Gap review page** — a full page opened from the side panel
5. **In-page content script** — the widget injected onto job sites

### Extension flows

**Install and first run**
- Fresh install onboarding. Then uninstall, reinstall, and confirm state is
  clean, not half-remembered.
- Update behavior: does an already-signed-in user stay signed in?

**Authentication** (highest risk area)
- Sign in from inside the side panel with email and password
- Sign in with Google (opens a Chrome auth window)
- Sign in with LinkedIn
- Sign in on the *website* and confirm the extension picks up that session
  automatically
- Sign out on the website, then check the extension. Does it correctly become
  signed out, or does it keep showing stale data?
- **Service worker sleep test.** Chrome shuts down the extension's background
  worker after roughly 30 seconds of inactivity. Sign in, then leave the
  browser completely alone for 5 minutes, then open the side panel. Are you
  still signed in? Does everything still work? This is the single most likely
  place for a bug, please test it several times.
- Signed-out state: what does a guest see in the side panel, and does the
  guest call-to-action work?

**Job detection and autofill** — test on all of these sites:

| Site | What to open |
|---|---|
| LinkedIn | A job posting, and an Easy Apply form |
| Greenhouse | Any `job-boards.greenhouse.io` application form |
| Lever | Any `jobs.lever.co` application form |
| Workday | Any `myworkdayjobs.com` posting (multi-step form) |
| Ashby | Any `jobs.ashbyhq.com` posting |
| SmartRecruiters | Any posting |
| iCIMS | Any posting |
| Indeed | A job view page |
| Random company career page | Anything not in this list, to test the generic fallback |

For each site, check:
- Does the extension notice it is on a job page at all?
- Does it extract the right job title, company, and description? Report wrong
  or empty extraction with the URL.
- Does autofill fill the right value in the right field? Report anything filled
  into the wrong box, that is worse than not filling at all.
- Does it handle multi-step forms (Workday especially) or does it only fill
  page one?
- Does it break the host page? Layout shifts, blocked buttons, console errors,
  the site's own JavaScript failing.
- Navigate between jobs *without a full page reload* (LinkedIn does this
  constantly) and check the extension updates to the new job instead of showing
  the previous one.

**AI features in the side panel**
- Tailor resume to the current job, watch the progress state, review the
  result, save the tailored profile
- Generate a cover letter
- Generate smart answers to application questions, and single-answer generation
- Saved answers: create, edit, delete, and confirm they are reused on the next
  form
- Gap review
- Keyword insights and job match score
- LinkedIn profile analyzer
- Download the tailored resume, then open the downloaded file and confirm it is
  not corrupt and the content actually matches what was on screen
- Redeem a promo code

**Extension resilience**
- Open the side panel on a non-job page (Gmail, a news site). It should degrade
  gracefully, not error.
- Trigger a tailor, then close the tab mid-generation.
- Go offline, then use each feature. Are the error messages human-readable?
- Have the side panel open on two windows at once.
- Report anything appearing in the extension's own console
  (`chrome://extensions`, then "Inspect views: service worker").

---

## 7. Known issues, do not report these

- LinkedIn sign-in fails when the site is reached at the bare domain without
  `www`. Known, fix pending. Use the `www` URL.
- Some job listings show an older posted date than the source site.
- Blog pages are static content, low priority.

If you find something that *seems* related to these but is clearly a different
symptom, report it anyway and note the connection.

---

## 8. Deliverables and schedule

For the first engagement:

| Day | Work | Hours |
|---|---|---|
| 1 | Read this, set up, write a one-page test plan, send it to me before testing | 2 |
| 1-2 | P1 candidate path | 5 |
| 2 | P2 recruiter path | 4 |
| 3 | Chrome extension | 4 |
| 3 | P3 cross-cutting, auth boundaries, mobile | 3 |
| 4 | Write up, triage severity, send report | 2 |

**Send me the test plan before you start testing.** It is one page: what you
plan to cover, in what order, on what devices. It takes you 30 minutes and it
stops us discovering on day 4 that we understood the scope differently.

**Daily check-in:** one short message at the end of each day. What you covered,
what you found, what is blocking you. If something blocks you, message me
immediately rather than waiting for the check-in. Idle time still costs you
hours you could bill on real testing.

**Final deliverable:** the bug sheet, plus a short summary at the top with
total bugs by severity, which areas felt weakest, and what you would test next
if you had more time. That last part genuinely matters to me.

---

## 9. Questions

Message me any time during my working hours. There is a lot of non-obvious
product logic here (AI credit limits, onboarding gates, promo codes, recruiter
permissions). A question costs me two minutes. A wrongly-filed bug based on a
guess costs us both an hour.
