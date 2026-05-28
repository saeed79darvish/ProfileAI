// Static blog posts for ProfilleAI.
// Why static (not CMS): SEO/AI crawlers index HTML fast, no external
// fetches needed at runtime, and content ships with the same Cloudflare
// deploy as the SPA. Each post body is plain HTML (sanitized at author
// time) so we can render directly with dangerouslySetInnerHTML.
//
// To add a post: append a new object below. Each post automatically
// appears in /blog and gets its own /blog/:slug route.

export const POSTS = [
  {
    slug: 'ai-resume-tailoring-guide-2026',
    title: 'How AI Resume Tailoring Actually Works (and Why It Beats ChatGPT)',
    description:
      'A deep dive into how ProfilleAI rewrites your resume per job — semantic matching, ATS keyword injection, and why a single living profile beats copy-pasting into ChatGPT.',
    date: '2026-05-20',
    author: 'ProfilleAI Team',
    readingMinutes: 7,
    tags: ['AI Resume', 'ATS', 'Career'],
    body: `
<p>If you've tried using ChatGPT to rewrite your resume for every job, you've already discovered the friction: paste resume, paste JD, prompt, edit, repeat. By job #5 you're cutting corners. By job #20 you've stopped tailoring entirely.</p>

<h2>The core idea: one profile, infinite resumes</h2>
<p>ProfilleAI flips the model. You upload your resume once — we parse it into a structured profile (experience, skills, projects, achievements, metrics). From then on, every tailoring request is a <em>selection</em> problem, not a writing problem: which 4–6 bullets from your 50+ achievements best match this JD?</p>

<h2>Why ATS keyword matching matters</h2>
<p>Most Fortune-500 companies use applicant tracking systems (Greenhouse, Lever, Workday, iCIMS, SmartRecruiters) that score resumes on keyword overlap before a human sees them. Generic AI rewrites lose this game because they paraphrase your skills — "led" becomes "spearheaded", "React" becomes "modern JS frameworks". ProfilleAI does the opposite: it preserves the exact terminology the JD uses.</p>

<h2>How tailoring works under the hood</h2>
<ol>
  <li><strong>Extract</strong> — the job description is parsed into required skills, soft skills, seniority, and 2–3 implicit "must-haves".</li>
  <li><strong>Rank</strong> — every bullet in your profile is scored against the JD using semantic similarity + keyword overlap.</li>
  <li><strong>Rewrite</strong> — the top bullets are lightly rewritten by GPT-4 to mirror the JD's terminology, while preserving your real metrics.</li>
  <li><strong>Assemble</strong> — a one-page resume is generated, sectioned per the JD's priorities (a backend role surfaces infra wins; a frontend role surfaces UX wins).</li>
</ol>

<h2>What this means for you</h2>
<p>You stop maintaining 4 versions of your resume. You stop pasting into ChatGPT. You apply faster, and your application reaches a human more often.</p>

<p><a href="/register">Try ProfilleAI free →</a></p>
`,
  },
  {
    slug: 'auto-apply-to-jobs-applypilot',
    title: 'Auto-Applying to Jobs in 2026: Is It Safe, Smart, and Effective?',
    description:
      'How ApplyPilot — the ProfilleAI Chrome extension — auto-applies on your behalf, where it works (LinkedIn, Greenhouse, Lever, Workday), and how to stay in control.',
    date: '2026-05-12',
    author: 'ProfilleAI Team',
    readingMinutes: 6,
    tags: ['ApplyPilot', 'Auto Apply', 'Chrome Extension'],
    body: `
<p>"Auto-apply" tools used to mean spam: a bot blasting your generic resume at 1,000 jobs a day. The result was predictable — recruiters tuned them out, platforms banned them, and candidates burned their reputation.</p>

<h2>The new model: review-and-approve</h2>
<p>ApplyPilot doesn't fire-and-forget. For every job you queue, it:</p>
<ul>
  <li>Tailors your resume + cover letter for that specific role.</li>
  <li>Fills out the application form (including the soul-crushing 40-field Workday flows).</li>
  <li>Pauses and shows you a preview. <strong>You approve before submission.</strong></li>
</ul>

<h2>What platforms it supports</h2>
<p>LinkedIn Easy Apply, Indeed, Greenhouse, Lever, Workday, iCIMS, Ashby, SmartRecruiters, Workable, and most custom company career sites. If a site has a form, ApplyPilot can usually fill it.</p>

<h2>Why this isn't "spam"</h2>
<p>Because every application is tailored and human-reviewed, recruiters see the same quality they'd see from a candidate spending 20 minutes per app — except you did it in 30 seconds. That's the leverage.</p>

<p><a href="/apply-pilot">See ApplyPilot in action →</a></p>
`,
  },
  {
    slug: 'salary-negotiation-ai-agent-practice',
    title: 'Practice Salary Negotiation with an AI Agent (Without the Awkwardness)',
    description:
      'Why most engineers leave $10–40k on the table, and how ProfilleAI\'s negotiation agent simulates a real hiring manager so you can rehearse before the call.',
    date: '2026-05-03',
    author: 'ProfilleAI Team',
    readingMinutes: 5,
    tags: ['Negotiation', 'Salary', 'AI Agent'],
    body: `
<p>The single highest-leverage hour of your career is the 60 minutes between getting an offer and accepting it. Most candidates fumble it — not because they don't know they should negotiate, but because they've never <em>practiced</em>.</p>

<h2>What the agent simulates</h2>
<p>ProfilleAI's negotiation agent plays a realistic hiring manager or recruiter. It pushes back, it anchors low, it asks about competing offers, it tests your BATNA. You respond in your own voice. After each round, it scores you on:</p>
<ul>
  <li>Anchor strength</li>
  <li>Information leakage (did you give away your current salary?)</li>
  <li>Use of competing offers</li>
  <li>Closing technique</li>
</ul>

<h2>Common mistakes the agent will catch</h2>
<ol>
  <li>Answering "what are you currently making?" with a number.</li>
  <li>Accepting the first offer because it's "good enough".</li>
  <li>Negotiating only base — and forgetting RSUs, signing bonus, and refresh grants.</li>
</ol>

<h2>How to use it</h2>
<p>Upload the offer letter (or paste the terms). Pick a difficulty. Practice 3–5 rounds. By call time, you've already heard the objections and know your responses.</p>

<p><a href="/pricing">See plans →</a></p>
`,
  },
];

export function getPost(slug) {
  return POSTS.find((p) => p.slug === slug);
}
