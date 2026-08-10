# SEO/GEO content batch — first 10 articles

Drafted per the Profile AI SEO + GEO content engine brief. Each article's frontmatter carries its Part 7 deliverable metadata (primary/secondary keywords, meta title/description, slug, schema types, internal links, AI-answer target).

1. [How to Tailor a Resume to a Job Description](01-tailor-resume-to-job-description.md)
2. [How to Beat Applicant Tracking Systems](02-how-to-beat-applicant-tracking-systems.md)
3. [How to Spot a Ghost Job](03-how-to-spot-a-ghost-job.md)
4. [How to Apply to Jobs Faster Without Burning Out](04-how-to-apply-to-jobs-faster.md)
5. [What Is a Resume Score and How Is It Calculated?](05-what-is-a-resume-score.md)
6. [AI Cover Letter Generator: How to Write One Fast](06-ai-cover-letter-generator-guide.md)
7. [Chrome Extensions That Autofill Job Applications](07-chrome-extensions-that-autofill-job-applications.md)
8. [How Job Matching Algorithms Actually Work](08-how-job-matching-algorithms-work.md)
9. [Best AI Resume Tailoring Tools in 2026, Compared](09-best-ai-resume-tailoring-tools-2026.md)
10. [The ATS Myth: What Recruiters Actually See](10-the-applicant-tracking-system-myth.md)

## Status: live

All 10 are published in the real site at [frontend/src/pages/Blog/posts.js](../../frontend/src/pages/Blog/posts.js) — that's the live source of truth now, not these markdown files. The HTML versions there differ slightly from these drafts:

- Brand corrected to **ProfilleAI** (the actual entity name used site-wide) — these markdown drafts still say "Profile AI" from the original brief and were never fixed here.
- Internal links point to real routes (`/register`, `/applypilot`, `/jobs`, `/pricing`, `/blog/:slug`) instead of the placeholder `/features/*` paths used in these drafts.
- CTAs and a few body paragraphs now cite the actual free-plan limits from `frontend/src/pages/Pricing/constants.ts` (3 lifetime tailored resumes, 2 cover letters/month, 1 parse/month, no credit card) — ApplyPilot itself is called out as Pro+ only, not free.
- Each post now carries a `faq` array that also drives FAQPage JSON-LD (added to `BlogPost.jsx`).

Also done: schema markup (BlogPosting + FAQPage via `SEO.jsx`/`BlogPost.jsx`), the 10 new URLs added to `frontend/public/sitemap.xml` (which also had two pre-existing dead links fixed: `/apply-pilot` → `/applypilot`, `/browse-profiles` → `/browse`), and `frontend/public/llms.txt` created.

Not done: Article 9's competitor comparison stays at the category level — no specific competitor pricing/features are named, since those weren't verified against live sites. The off-site work from Part 5 of the brief (Reddit/Quora participation, directory listings, guest posts) needs a human, not automation.
