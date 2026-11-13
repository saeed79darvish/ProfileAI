/**
 * Judging a tailored resume.
 *
 * Two layers, the same split the rest of the pipeline uses:
 *
 *   deterministicChecks  facts a program can count: identity of every role,
 *                        numbers and tools traceable to the source, bullet
 *                        counts, repeated phrases, summary rules. No AI.
 *   judgeWithModel       one model call that reads the source, the posting and
 *                        the result the way a skeptical recruiter would and
 *                        scores what code cannot: faithfulness of the claims,
 *                        whether it reads like a person, relevance, specificity.
 *
 * Used by scripts/tailorEval.js to find what the tailoring logic gets wrong.
 * It is a measuring tool: nothing here changes a resume.
 */

const { unsupportedTerms } = require('./polish');
const { sameCompany } = require('./sourceIdentity');
const { findBannedLanguage } = require('./writingRules');
const { findTenureClaims, totalExperienceYears } = require('./resumeHygiene');

const numbersIn = (t) => (String(t || '').match(/\d[\d,.]*\+?%?/g) || []).map((n) => n.replace(/[,.]+$/, ''));
const wordsOf = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9+#. ]+/g, ' ').split(/\s+/).filter(Boolean);
const bulletsOf = (d) => String(d || '').split('\n').map((l) => l.replace(/^[•\-\s]+/, '').trim()).filter(Boolean);

/** The candidate's profile as plain text: everything a claim may be traced to. */
function profileText(profile) {
  const p = profile || {};
  const skills = Array.isArray(p.skills) ? p.skills : Object.values(p.skills || {}).flat();
  return [
    p.title, p.summary, skills.join(', '),
    ...(p.experience || []).map((e) => `${e.title} at ${e.company} (${e.period || [e.startDate, e.endDate || (e.current ? 'Present' : '')].filter(Boolean).join(' - ')})\n${e.description || ''}`),
    ...(p.education || []).map((e) => `${e.degree || ''} ${e.school || ''}`),
  ].filter(Boolean).join('\n');
}

/** Resume text of a tailored result, section by section. */
function resultText(result) {
  const skills = result.skillsGrouped ? Object.values(result.skillsGrouped).flat() : (result.skills || []);
  return {
    summary: String(result.summary || ''),
    bullets: (result.experience || []).flatMap((e) => bulletsOf(e.description)),
    skills,
  };
}

/**
 * @returns {{ pass: boolean, failures: Array<{check: string, detail: string}> }}
 */
function deterministicChecks({ profile, result, jobDescription = '' }) {
  const failures = [];
  const fail = (check, detail) => failures.push({ check, detail });
  const source = profileText(profile);
  const srcExp = profile.experience || [];
  const outExp = result.experience || [];

  // Identity: every role is the candidate's own, in order, with their title.
  if (outExp.length !== srcExp.length) fail('roles', `${outExp.length} roles returned for ${srcExp.length} on the profile`);
  srcExp.forEach((o, i) => {
    const e = outExp[i];
    if (!e) return;
    if (!sameCompany(e.company, o.company)) fail('role-company', `role ${i + 1} is "${e.company}", the profile has "${o.company}"`);
    if (String(e.title || '').trim().toLowerCase() !== String(o.title || '').trim().toLowerCase()) fail('role-title', `"${e.title}" at ${o.company}, the profile says "${o.title}"`);
    if (!String(e.period || '').trim() && (o.startDate || o.period)) fail('role-dates', `${o.company} has no dates`);
    if (bulletsOf(e.description).length > Math.max(bulletsOf(o.description).length, 1)) fail('padding', `${o.company}: more bullets than the source`);
  });

  const { summary, bullets, skills } = resultText(result);

  // Numbers and names must trace to the source.
  const srcNums = new Set(numbersIn(source));
  const okYears = new Set(findTenureClaims(summary).filter((c) => c.years <= Math.floor(totalExperienceYears(srcExp))).map((c) => String(c.years)));
  const newNums = [...new Set(numbersIn([summary, ...bullets].join(' ')))].filter((n) => !srcNums.has(n) && !okYears.has(n.replace(/\+$/, '')));
  if (newNums.length) fail('invented-number', newNums.join(', '));
  const terms = unsupportedTerms([summary, ...bullets].join('. '), source);
  if (terms.length) fail('unsupported-term', terms.slice(0, 8).join(', '));
  const srcLower = source.toLowerCase();
  const strangeSkills = skills.filter((s) => !srcLower.includes(String(s).toLowerCase().replace(/\(.*?\)/g, '').trim()));
  if (strangeSkills.length) fail('skill-not-in-profile', strangeSkills.join(', '));

  // Skills list shape.
  const flat = skills.map((s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9+#]/g, ''));
  if (new Set(flat).size !== flat.length) fail('duplicate-skills', 'the same skill is listed twice');
  if (skills.length > 15) fail('skills-cap', `${skills.length} skills listed`);

  // Summary rules.
  const nSummaryWords = wordsOf(summary).length;
  if (nSummaryWords > 75) fail('summary-length', `${nSummaryWords} words`);
  const actualYears = Math.floor(totalExperienceYears(srcExp));
  const overclaim = findTenureClaims(summary).filter((c) => c.years > actualYears);
  if (overclaim.length) fail('summary-years', `claims "${overclaim[0].raw}", the dated roles add up to ${actualYears}`);
  if (/\b(strong|proven|passionate|exceptional|results[- ]driven|world[- ]class)\b/i.test(summary)) fail('summary-self-rating', 'rates itself');
  const jd = wordsOf(jobDescription), sw = wordsOf(summary);
  const grams = new Set();
  for (let i = 0; i + 4 <= jd.length; i++) grams.add(jd.slice(i, i + 4).join(' '));
  for (let i = 0; i + 4 <= sw.length; i++) if (grams.has(sw.slice(i, i + 4).join(' '))) { fail('summary-copies-jd', sw.slice(i, i + 4).join(' ')); break; }

  // Wording: banned phrases and repetition across the whole resume.
  const all = [summary, ...bullets].join(' ');
  const banned = findBannedLanguage(all).map((f) => f.term);
  if (banned.length) fail('banned-language', [...new Set(banned)].slice(0, 6).join(', '));
  // A skill name repeated ("in react") is not a wording tic.
  const skillWords = new Set(wordsOf((Array.isArray(profile.skills) ? profile.skills : Object.values(profile.skills || {}).flat()).join(' ')));
  const w = wordsOf(all), counts = new Map();
  for (let n = 2; n <= 3; n++) for (let i = 0; i + n <= w.length; i++) {
    const g = w.slice(i, i + n);
    if (g.every((x) => x.length <= 3 || ['the', 'and', 'for', 'with', 'that', 'into', 'across'].includes(x))) continue;
    if (g.some((x) => skillWords.has(x))) continue;
    const k = g.join(' '); counts.set(k, (counts.get(k) || 0) + 1);
  }
  const repeated = [...counts].filter(([k, c]) => c >= 5 && k.split(' ').length >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, c]) => `"${k}" x${c}`);
  if (repeated.length) fail('repetition', repeated.join(', '));

  // The same opening verb on four or more bullets reads machine-written.
  const openers = new Map();
  for (const b of bullets) { const v = wordsOf(b)[0]; if (v) openers.set(v, (openers.get(v) || 0) + 1); }
  const overused = [...openers].filter(([, c]) => c >= 4).map(([v, c]) => `"${v}" x${c}`);
  if (overused.length) fail('verb-repetition', overused.join(', '));

  return { pass: failures.length === 0, failures };
}


// ── ATS ─────────────────────────────────────────────────────────────────────

const stem = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9+#. ]+/g, ' ').replace(/\b(css|html)\d\b/g, '$1').replace(/\s+/g, ' ').trim().replace(/s\b/g, '');

/**
 * What an applicant tracking system sees: does the resume contain the posting's
 * keywords the candidate can truthfully claim, are the dates parseable, is the
 * text plain. A keyword the SOURCE supports but the resume omits is a miss; a
 * keyword the source does not support is a gap, never a miss.
 */
function atsChecks({ profile, result }) {
  const source = stem(profileText(profile));
  const { summary, bullets, skills } = resultText(result);
  const resume = stem([result.title, summary, ...bullets, ...skills].join(' '));
  const keywords = Array.isArray(result._jobKeywords) ? result._jobKeywords : [];
  const supported = keywords.filter((k) => source.includes(stem(k)));
  const covered = supported.filter((k) => resume.includes(stem(k)));
  const missingSupported = supported.filter((k) => !covered.includes(k));
  const problems = [];
  const DATE = /^[A-Z][a-z]{2} \d{4}( - ([A-Z][a-z]{2} \d{4}|Present))?$/;
  for (const e of result.experience || []) {
    if (e.period && !DATE.test(String(e.period).trim())) problems.push(`date not machine-readable: "${e.period}" (${e.company})`);
  }
  const body = [result.title, summary, ...bullets, ...skills].join(' ');
  if (/[^\x20-\x7E\n]/.test(body)) problems.push(`non-ASCII characters: ${[...new Set(body.match(/[^\x20-\x7E\n]/g))].join(' ')}`);
  if (/\[|\bTODO\b|\bN\/A\b|lorem/i.test(body)) problems.push('placeholder or bracketed text');
  if (!String(result.title || '').trim()) problems.push('empty headline');
  if (!summary.trim()) problems.push('empty summary');
  if (!skills.length) problems.push('no skills section');
  return {
    coverage: supported.length ? Math.round((covered.length / supported.length) * 100) : 100,
    supported, covered, missingSupported,
    gaps: keywords.filter((k) => !supported.includes(k)),
    problems,
  };
}

// ── The model judge ─────────────────────────────────────────────────────────

const RUBRIC = `You are a skeptical senior recruiter and fact-checker. You are given a candidate's SOURCE profile (the only truth), a JOB POSTING, and a TAILORED RESUME written for it. Judge the tailored resume.

Score each 1 to 5 (5 = excellent, 1 = unacceptable):
- faithfulness: every claim, number, title, scope and tool traces to the source. Any invented or inflated claim caps this at 2.
- human_voice: reads like a person describing their own work. Penalise stock phrases, stacked abstractions, identical sentence shapes, the same phrase repeated, and a summary that sounds like a job ad.
- relevance: leads with the evidence the posting cares about, ordered by what matters to this posting, using only true material. Do not reward keyword stuffing.
- specificity: concrete systems, screens and outcomes rather than adjectives.
- skim: would the first six lines make a recruiter keep reading?

Then list the most important issues, worst first, at most 8. For each: where (summary, a role, skills), the exact quote, what is wrong, and which general RULE in a tailoring prompt would prevent it for every candidate (not a fix for this one resume).

Return JSON only:
{"scores":{"faithfulness":n,"human_voice":n,"relevance":n,"specificity":n,"skim":n},
 "issues":[{"severity":"high|medium|low","where":"...","quote":"...","problem":"...","rule":"..."}],
 "verdict":"one sentence"}`;

async function judgeWithModel({ profile, result, jobDescription, callModel, repair }) {
  const years = Math.floor(totalExperienceYears(profile.experience || []));
  const roles = (result.experience || []).map((e) => `${e.title} | ${e.company} | ${e.period || ''}\n${e.description || ''}`).join('\n\n');
  const skills = result.skillsGrouped ? Object.entries(result.skillsGrouped).map(([k, v]) => `${k}: ${v.join(', ')}`).join('\n') : (result.skills || []).join(', ');
  const prompt = `${RUBRIC}

=== SOURCE PROFILE (truth) ===
${profileText(profile)}
(The dated roles add up to ${years} years of experience, so a summary may truthfully say up to ${years} years.)

=== JOB POSTING ===
${String(jobDescription || '').slice(0, 4500)}

=== TAILORED RESUME ===
Headline: ${result.title || ''}
Summary: ${result.summary || ''}

${roles}

Skills:
${skills}`;
  const text = await callModel({ prompt, max_tokens: 6000 });
  const t = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch (_) {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (__) { /* fall through */ } }
    const fixed = typeof repair === 'function' ? repair(t) : null;
    if (fixed && fixed.scores) return fixed;
    return { scores: {}, issues: [], verdict: 'judge answer was not valid JSON' };
  }
}

module.exports = { deterministicChecks, atsChecks, judgeWithModel, profileText, resultText, RUBRIC };
