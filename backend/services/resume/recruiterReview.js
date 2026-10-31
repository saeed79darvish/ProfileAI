/**
 * Recruiter Review: the profile as a recruiter reads it in a 30-second screen,
 * what stands out, what would make them pass, and how to fix each one.
 *
 * Replaces "Career Tips", a generic coach prompt whose advice ("use strong
 * verbs", "add metrics") was the same for everyone and pointed nowhere.
 *
 * Two halves, the same split as the Enhance analysis:
 *   - code finds the facts (no projects, tech stacks in job titles, no target
 *     role, a summary that opens with years, roles without results...). These
 *     are counted, never guessed, and every one of them reaches the candidate:
 *     if the model leaves one out, the code's own wording is used.
 *   - one model call reads the profile as a recruiter: a verdict, strengths
 *     that quote the profile, and tips in plain words. Each tip names a fix
 *     from FIXES, so every button opens something that can actually fix it.
 *
 * "Quick win" or "Improve" is decided by the fix, not the model: a quick win
 * is something the candidate can do in a few minutes without AI.
 */

const crypto = require('crypto');
const { findSectionIssues } = require('./enhanceAnalysis');

/** What a tip's button can do. The client maps each to a screen. */
const FIXES = {
  add_project: { quick: true, label: 'Add project' },
  clean_titles: { quick: true, label: 'Edit titles' },
  set_target_role: { quick: true, label: 'Set target role' },
  add_links: { quick: true, label: 'Add links' },
  add_photo: { quick: true, label: 'Add photo' },
  add_location: { quick: true, label: 'Add location' },
  edit_education: { quick: true, label: 'Edit education' },
  enhance_title: { quick: false, label: 'Fix with Enhance' },
  enhance_summary: { quick: false, label: 'Fix with Enhance' },
  enhance_experience: { quick: false, label: 'Fix with Enhance' },
  add_results: { quick: false, label: 'Fix with Enhance' },
  trim_skills: { quick: false, label: 'Edit skills' },
  none: { quick: false, label: '' },
};

const MAX_QUICK = 5;
const MAX_IMPROVE = 6;
const MAX_STRENGTHS = 5;
const SKILLS_TOO_MANY = 30;

const clip = (s, n) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, n);

/**
 * The facts a recruiter would notice, found in code. Each carries the fix and
 * the wording used if the model does not cover it.
 */
function reviewFacts(profile = {}, { hasPhoto = false, target = '' } = {}) {
  const facts = [];
  const add = (key, fix, title, body) => facts.push({ key, fix, title, body });
  const sections = findSectionIssues(profile);
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const projects = Array.isArray(profile.projects) ? profile.projects.filter((p) => p && (p.title || p.name)) : [];
  const skills = Array.isArray(profile.skills) ? profile.skills : Object.values(profile.skills || {}).flat();

  if (!projects.length) {
    add('no_projects', 'add_project', 'Add at least one project',
      'Your profile shows no projects. One with a link and a line about what it did gives a recruiter proof beyond job titles.');
  }
  const stacked = experience.map((e) => String(e.title || e.position || '')).filter((t) => /\(.+\)/.test(t));
  if (stacked.length) {
    add('title_stack', 'clean_titles', 'Remove tech stacks from job titles',
      `“${clip(stacked[0], 70)}” reads as noise to recruiters and ATS filters. Keep the title and move the stack into the bullets.`);
  }
  if (!String(target || '').trim()) {
    add('no_target', 'set_target_role', 'Set your target role',
      'Recruiters search by role. Telling us the one you want lets tailoring and your headline aim at it.');
  }
  if (!profile.linkedinUrl && !profile.githubUrl && !profile.portfolioUrl) {
    add('no_links', 'add_links', 'Add your LinkedIn or GitHub',
      'There is no link to check your work or background, which is often the first thing a recruiter clicks.');
  }
  if (!hasPhoto) {
    add('no_photo', 'add_photo', 'Add a profile photo',
      'Profiles with a photo look finished and are easier to remember after a screen.');
  }
  if (!String(profile.location || '').trim()) {
    add('no_location', 'add_location', 'Add your location',
      'Many roles filter by location or time zone; without one you can drop out of those searches.');
  }
  if (sections.education.issues.some((i) => /missing/.test(i))) {
    add('education_incomplete', 'edit_education', 'Complete your education entry', sections.education.issues.find((i) => /missing/.test(i)));
  }
  if (sections.title.issues.length) {
    add('title_unclear', 'enhance_title', 'Make your title one clear role', sections.title.issues[0]);
  }
  if (sections.summary.issues.length) {
    add('summary_weak', 'enhance_summary', 'Lead your summary with impact', sections.summary.issues.join(' '));
  }
  const noResults = sections.experience.issues.find((i) => /no results/.test(i));
  if (noResults) add('no_results', 'add_results', 'Add results to your bullets', noResults);
  const repeated = sections.experience.issues.find((i) => /start with|opens? with/.test(i));
  if (repeated) add('repeated_openers', 'enhance_experience', 'Vary how your bullets open', repeated);
  if (skills.length > SKILLS_TOO_MANY) {
    add('too_many_skills', 'trim_skills', 'Lead with your top 10 skills',
      `${skills.length} skills reads like a keyword list. Recruiters look for the handful that match the role, so put those first.`);
  }
  return facts;
}

function buildRecruiterReviewPrompt(aiProfile, facts, { target = '' } = {}) {
  return {
    system: 'You are an experienced technical recruiter. You screen profiles quickly and honestly, you say what you actually notice, and you never invent facts about the candidate.',
    prompt: `Screen this candidate's profile the way you would in a 30-second recruiter pass${target ? `, for the role they are aiming at: ${clip(target, 120)}` : ''}.

PROFILE:
${JSON.stringify(aiProfile, null, 2)}

FACTS ALREADY FOUND BY CODE (true; cover each one in a tip, citing its key):
${JSON.stringify(facts.map(({ key, fix, body }) => ({ key, fix, body })), null, 2)}

FIXES a tip can point to: ${Object.keys(FIXES).join(', ')}

RULES:
- verdict.headline: what a recruiter would say first, at most 8 words, e.g. "Strong Staff-level frontend profile". Name the level the history supports.
- verdict.summary: 1-2 sentences: what stands out, and what to fix first.
- strengths: up to 5 things that would make a recruiter keep reading. Each title is short; each body names the evidence from the profile (a company, a number, a system). No generic praise.
- tips: one per FACT, using its key, plus up to 3 more of your own (key "other") for weaknesses a recruiter would notice that the facts miss. Each tip: a short imperative title, a body of 1-2 sentences addressed to the candidate saying why a recruiter cares, and the fix that resolves it.
- Use only what the profile says. Never state a number, company or skill that is not in it.

Return ONLY JSON:
{"verdict":{"headline":"","summary":""},"strengths":[{"title":"","body":""}],"tips":[{"key":"","title":"","body":"","fix":""}]}`,
    max_tokens: 1800,
    temperature: 0.3,
  };
}

/**
 * Turn the model's answer (or nothing) into the review the client renders.
 * Every code fact appears exactly once; quick/improve comes from the fix.
 */
function normalizeReview(model, facts, { profileKey = '' } = {}) {
  const m = model && typeof model === 'object' ? model : {};
  const byKey = new Map(facts.map((f) => [f.key, f]));
  const tips = [];
  const covered = new Set();

  for (const t of Array.isArray(m.tips) ? m.tips : []) {
    if (!t || typeof t !== 'object') continue;
    const fact = byKey.get(t.key);
    if (fact && covered.has(fact.key)) continue;
    const title = clip(t.title, 80) || (fact && fact.title);
    const body = clip(t.body, 320) || (fact && fact.body);
    if (!title || !body) continue;
    // A code fact keeps its own fix; the model cannot route it elsewhere.
    const fix = fact ? fact.fix : (FIXES[t.fix] ? t.fix : 'none');
    if (fact) covered.add(fact.key);
    tips.push({ key: fact ? fact.key : 'other', title, body, fix });
  }
  for (const f of facts) {
    if (!covered.has(f.key)) tips.push({ key: f.key, title: f.title, body: f.body, fix: f.fix });
  }

  const withIds = tips.map((t, i) => ({
    ...t,
    id: `${t.key}-${i}`,
    action: FIXES[t.fix].label,
  }));
  const quickWins = withIds.filter((t) => FIXES[t.fix].quick).slice(0, MAX_QUICK);
  const improve = withIds.filter((t) => !FIXES[t.fix].quick).slice(0, MAX_IMPROVE);

  const strengths = (Array.isArray(m.strengths) ? m.strengths : [])
    .filter((s) => s && typeof s === 'object' && s.title && s.body)
    .slice(0, MAX_STRENGTHS)
    .map((s, i) => ({ id: `strength-${i}`, title: clip(s.title, 80), body: clip(s.body, 320) }));

  const verdict = m.verdict && m.verdict.headline
    ? { headline: clip(m.verdict.headline, 80), summary: clip(m.verdict.summary, 320) }
    : {
      headline: 'What a recruiter would notice first',
      summary: quickWins.length ? 'Start with the quick wins; each one takes a few minutes.' : 'Work through the tips below, most important first.',
    };

  // Stable per profile version, so "tips done" survives a reopen of the same review.
  const id = crypto.createHash('sha256').update(`${profileKey}|${withIds.map((t) => t.key).join(',')}`).digest('hex').slice(0, 16);
  return { id, verdict, quickWins, improve, strengths };
}

module.exports = { FIXES, reviewFacts, buildRecruiterReviewPrompt, normalizeReview };
