/**
 * Polish pass: better wording, no new facts.
 *
 * Tailoring used to keep the candidate's bullets word for word (see
 * foundation.js), so a resume came back reading like the profile it started
 * from. This pass rewrites the experience bullets and the summary for the
 * posting, and then CHECKS the result in code against the candidate's own text.
 * The model is trusted with wording only; every fact it writes must be traceable.
 *
 * A rewritten role that fails any check is thrown away and the foundation
 * (original bullets) is used for that role instead, so a bad answer costs
 * polish, never accuracy.
 */

const { planRoleShapes } = require('./roleShape');
const { splitUnitsOf, coverage } = require('./foundation');
const { findBannedLanguage, scrubBannedLanguage } = require('./writingRules');
const { auditTenureClaims } = require('./resumeHygiene');

const MAX_BULLET_CHARS = 230;
const MAX_SUMMARY_WORDS = 65;

const words = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9+#.%$ ]+/g, ' ').split(/\s+/).filter(Boolean);
const standaloneNumbers = (t) => (String(t || '').match(/(?<![A-Za-z0-9])\d[\d,.]*\+?%?/g) || []).map((n) => n.replace(/[,.]+$/, ''));
const numbersIn = (t) => (String(t || '').match(/\d[\d,.]*\+?%?/g) || []).map((n) => n.replace(/[,.]+$/, ''));

/** Leadership verbs a bullet may only use when the source already does. */
const LEADERSHIP_RE = /\b(led|lead|leading|architected|owned|directed|headed|managed|mentored|spearheaded|drove|oversaw)\b/i;
/** Scope words that inflate a claim when the source never says them. */
const SCOPE_RE = /\b(organization[- ]?wide|company[- ]?wide|enterprise[- ]?wide|across the (?:organization|company)|millions?|thousands?|global(?:ly)?|worldwide)\b/i;

/**
 * Terms that look like names or technologies (capitalised mid-sentence, or
 * containing . # +) and are absent from the source text.
 */
function unsupportedTerms(text, sourceText) {
  const source = String(sourceText || '').toLowerCase();
  const out = new Set();
  const sentences = String(text || '').split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const toks = s.split(/\s+/);
    toks.forEach((raw, i) => {
      const tok = raw.replace(/^[("'•\-–—]+|[)"',;:.!?]+$/g, '');
      if (tok.length < 2) return;
      const techShaped = /[.#+]/.test(tok) && /[A-Za-z]/.test(tok);
      const capitalMid = i > 0 && /^[A-Z][A-Za-z0-9]*$/.test(tok);
      if (!techShaped && !capitalMid) return;
      if (!source.includes(tok.toLowerCase())) out.add(tok);
    });
  }
  return [...out];
}

/** Sentence-level stripped copy of "(ES6+)" style duplicates when comparing skills. */
const skillKey = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9+#]+/g, '');

// ── Prompt ──────────────────────────────────────────────────────────────────

function buildPolishPrompt({ profile, jobDescription, targetTitle, company, keywords = {}, selected }) {
  const exp = Array.isArray(profile.experience) ? profile.experience : [];
  const shapes = planRoleShapes(exp, { selected });
  const roles = exp.map((e, i) => {
    const units = splitUnitsOf(e.description);
    const period = e.period || [e.startDate, e.endDate || (e.current ? 'Present' : '')].filter(Boolean).join(' - ');
    return [
      `ROLE ${i} — ${e.title || ''} at ${e.company || ''} (${period}); at most ${Math.min(shapes[i]?.allowance?.max ?? units.length, Math.max(units.length, 0))} bullets`,
      ...(units.length ? units.map((u, k) => `  [${k}] ${u}`) : ['  (no bullets — leave empty)']),
    ].join('\n');
  }).join('\n\n');

  const system = `You are a resume editor. You improve WORDING only. You never add facts.
You return JSON and nothing else.`;

  const prompt = `Rewrite this candidate's resume bullets and summary for one posting. The result must read like a person wrote it about their own work, not like a keyword list.

TARGET: ${targetTitle || 'the posting'}${company ? ` at ${company}` : ''}
POSTING KEYWORDS: ${(keywords.required || []).slice(0, 14).join(', ')}

CANDIDATE SUMMARY (their words):
${profile.summary || '(none)'}

CANDIDATE EXPERIENCE (the only source of facts):
${roles}

POSTING:
${String(jobDescription || '').slice(0, 5000)}

BULLET RULES
- Shape: a strong, plain verb, then what was built or owned, then the scale or result ONLY if the source states one. One to two lines, under ${MAX_BULLET_CHARS} characters.
- Facts come from the source bullet you cite in "from" and nowhere else. No new numbers, percentages, user counts, team sizes, tools, titles, employers or scope. If the source says "built", do not write "led" or "architected".
- Use the posting's vocabulary only where it is already true of that work. Never write a bullet whose only support is the posting's wording.
- Put the most relevant bullet first in each role. You may merge, shorten or drop weak or duplicate bullets. Never exceed a role's bullet limit and never pad. A role with no bullets stays empty.
- Vary the wording between roles. Any two-or-more-word phrase appears at most twice in the whole resume. Do not use: production-grade, scalable (more than once), cross-functional, stakeholders, passionate, leverage, robust, cutting-edge, seamless, best practices, strong ownership, customer empathy.
- Prefer concrete nouns (the system, the screen, the flow) over abstract ones (excellence, quality, synergy).

SUMMARY RULES
- Two or three sentences, at most ${MAX_SUMMARY_WORDS} words, in the same voice as the candidate's own summary (no "I").
- The first sentence says what this person builds and the kind of product, taken from the strongest bullets. It must not open with the posting's job title as an identity unless the candidate has held that title.
- No years-of-experience figure, no metrics, no self-rating (strong, passionate, proven), no run of four words copied from the posting.
- Mention at most two posting terms, only ones the bullets support.

OUTPUT (JSON only):
{"summary":"...","experience":[{"index":0,"bullets":[{"text":"...","from":[0]}]}]}
"from" lists the source bullet numbers each new bullet is based on. Every bullet needs it. Include every role index, in order.`;

  return { system, prompt, max_tokens: 3500 };
}

function parsePolish(text, repair) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data;
  try { data = JSON.parse(t); } catch (_) { data = typeof repair === 'function' ? repair(t) : null; }
  if (!data || typeof data !== 'object') return null;
  return data;
}

// ── Verification ────────────────────────────────────────────────────────────

/**
 * Check one rewritten role against its source. Returns the accepted bullet
 * texts, or `null` with the reasons the role was rejected.
 */
function verifyRole({ sourceUnits, bullets, allSourceText, limit }) {
  const reasons = [];
  if (!sourceUnits.length) return { units: [], reasons };
  if (!Array.isArray(bullets) || !bullets.length) return { units: null, reasons: ['no bullets returned'] };
  if (bullets.length > Math.min(limit, sourceUnits.length)) reasons.push(`too many bullets (${bullets.length})`);

  const roleText = sourceUnits.join(' ');
  const roleNumbers = new Set(numbersIn(roleText));
  const sourceHasLeadership = LEADERSHIP_RE.test(roleText);
  const sourceHasScope = SCOPE_RE.test(roleText);
  const out = [];

  for (const b of bullets) {
    const text = String(b && b.text || '').replace(/^[•\-\s]+/, '').replace(/\s+/g, ' ').trim();
    const from = Array.isArray(b && b.from) ? b.from.filter((n) => Number.isInteger(n) && sourceUnits[n]) : [];
    if (!text) { reasons.push('empty bullet'); continue; }
    if (!from.length) { reasons.push(`no source cited: "${text.slice(0, 50)}"`); continue; }
    if (text.length > MAX_BULLET_CHARS + 40) reasons.push(`too long: "${text.slice(0, 50)}"`);
    const bad = numbersIn(text).filter((n) => !roleNumbers.has(n));
    if (bad.length) reasons.push(`new number ${bad.join(', ')}: "${text.slice(0, 50)}"`);
    if (!sourceHasLeadership && LEADERSHIP_RE.test(text)) reasons.push(`leadership verb the source lacks: "${text.slice(0, 50)}"`);
    if (!sourceHasScope && SCOPE_RE.test(text)) reasons.push(`scope claim the source lacks: "${text.slice(0, 50)}"`);
    const terms = unsupportedTerms(text, allSourceText);
    if (terms.length) reasons.push(`terms not in the resume (${terms.join(', ')}): "${text.slice(0, 50)}"`);
    const cited = from.map((n) => sourceUnits[n]).join(' ');
    if (coverage(text, `${cited} ${allSourceText}`) < 0.5 || coverage(cited, text) < 0.12) {
      reasons.push(`drifts from its source: "${text.slice(0, 50)}"`);
    }
    out.push(scrubBannedLanguage(text).text);
  }
  // The role's own numbers are its evidence: a rewrite may not drop them.
  const WORD = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' };
  const joined = out.join(' ');
  const kept = standaloneNumbers(joined);
  const dropped = standaloneNumbers(roleText).filter((n) => !kept.includes(n) && !(WORD[n] && new RegExp(`\\b${WORD[n]}\\b`, 'i').test(joined)));
  if (dropped.length) reasons.push(`dropped the real figure ${dropped.join(', ')}`);
  return { units: reasons.length ? null : out, reasons };
}

function verifySummary({ summary, allSourceText, jobDescription, experience, targetTitle, heldTitles }) {
  const reasons = [];
  const text = String(summary || '').replace(/\s+/g, ' ').trim();
  if (!text) return { text: null, reasons: ['empty'] };
  const nWords = words(text).length;
  if (nWords > MAX_SUMMARY_WORDS + 10) reasons.push(`too long (${nWords} words)`);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 3) reasons.push(`${sentences.length} sentences`);
  if (/\b(I|I'm|I've|my|me)\b/.test(text)) reasons.push('first person');
  const bad = numbersIn(text).filter((n) => !numbersIn(allSourceText).includes(n));
  if (bad.length) reasons.push(`new number ${bad.join(', ')}`);
  if (/\b\d+\+?\s*(?:years?|yrs?)\b|\b(?:eight|seven|six|five|ten|nine)\+?\s+years?\b/i.test(text)) reasons.push('years-of-experience claim');
  else if (!auditTenureClaims(text, experience).clean) reasons.push('tenure claim the dates do not support');
  const terms = unsupportedTerms(text, allSourceText);
  if (terms.length) reasons.push(`terms not in the resume (${terms.join(', ')})`);
  if (/\b(strong|proven|passionate|exceptional|results[- ]driven|world[- ]class)\b/i.test(text)) reasons.push('self-rating');
  const tt = String(targetTitle || '').trim().toLowerCase();
  if (tt && text.toLowerCase().startsWith(tt) && !heldTitles.some((h) => h.includes(tt) || tt.includes(h))) {
    reasons.push('opens with a title the candidate has not held');
  }
  // No run of four words copied from the posting.
  const jd = words(jobDescription), sw = words(text);
  const jdGrams = new Set();
  for (let i = 0; i + 4 <= jd.length; i++) jdGrams.add(jd.slice(i, i + 4).join(' '));
  for (let i = 0; i + 4 <= sw.length; i++) if (jdGrams.has(sw.slice(i, i + 4).join(' '))) { reasons.push('copies the posting'); break; }
  if (findBannedLanguage(text).some((f) => !f.fixable)) reasons.push('banned language');
  return { text: reasons.length ? null : scrubBannedLanguage(text).text, reasons };
}

/**
 * Check a whole polish answer.
 * @returns {{ summary: string|null, roles: Array<{units:string[]|null, reasons:string[]}>, summaryReasons: string[] }}
 */
function verifyPolish({ polished, profile, jobDescription, targetTitle, selected }) {
  const exp = Array.isArray(profile.experience) ? profile.experience : [];
  const shapes = planRoleShapes(exp, { selected });
  const allSourceText = [
    profile.summary, profile.title,
    ...(Array.isArray(profile.skills) ? profile.skills : Object.values(profile.skills || {}).flat()),
    ...exp.flatMap((e) => [e.company, e.title, e.description]),
    ...(profile.education || []).flatMap((e) => [e.school, e.degree, e.field]),
  ].filter(Boolean).join(' ');
  const heldTitles = [profile.title, ...exp.map((e) => e.title)].filter(Boolean).map((t) => String(t).toLowerCase());
  const byIndex = new Map((polished && polished.experience || []).map((r) => [r && r.index, r]));

  const roles = exp.map((e, i) => {
    const sourceUnits = splitUnitsOf(e.description);
    const limit = shapes[i]?.allowance?.max ?? sourceUnits.length;
    const r = byIndex.get(i);
    const res = verifyRole({ sourceUnits, bullets: r && r.bullets, allSourceText, limit });
    return res;
  });
  const s = verifySummary({ summary: polished && polished.summary, allSourceText, jobDescription, experience: exp, targetTitle, heldTitles });
  return { summary: s.text, summaryReasons: s.reasons, roles };
}

/**
 * Write accepted pieces into the draft. A role that failed keeps whatever the
 * draft already holds (the foundation guard runs after this and restores the
 * originals there).
 * @returns {{ appliedRoles: string[], rejected: string[], summaryApplied: boolean }}
 */
function applyPolish(draft, profile, verdict) {
  const appliedRoles = [], appliedIndexes = [], rejected = [];
  const exp = Array.isArray(profile.experience) ? profile.experience : [];
  const out = Array.isArray(draft.experience) ? [...draft.experience] : [];
  exp.forEach((e, i) => {
    const label = e.company || e.title || `role ${i + 1}`;
    const r = verdict.roles[i];
    if (!r || r.units === null) { rejected.push(`${label}: ${r ? r.reasons.slice(0, 2).join('; ') : 'missing'}`); return; }
    if (!r.units.length) return;
    out[i] = { ...(out[i] || { company: e.company, title: e.title }), description: r.units.map((u) => `• ${u}`).join('\n') };
    appliedRoles.push(label);
    appliedIndexes.push(i);
  });
  draft.experience = out;
  let summaryApplied = false;
  if (verdict.summary) { draft.summary = verdict.summary; summaryApplied = true; }
  else rejected.push(`summary: ${verdict.summaryReasons.slice(0, 2).join('; ')}`);
  return { appliedRoles, appliedIndexes, rejected, summaryApplied };
}

// ── Skills: dedupe, group, cap ──────────────────────────────────────────────

const CATEGORY_RULES = [
  ['Languages', /^(javascript|typescript|html|css3?|sass|scss|python|java|go|ruby|sql|graphql|c\+\+|c#|php|swift|kotlin)$/],
  ['Frameworks', /^(react|redux|next\.?js|vue\.?js|angular|node\.?js|express|bootstrap|material ?ui|reactstrap|jest|enzyme|storybook|tailwind(css)?|svelte|nestjs)$/],
  ['Infrastructure', /^(aws|aws ?lambda|api ?gateway|docker|kubernetes|terraform|ci\/?cd|serverless|gcp|azure|mongodb|mysql|postgres(ql)?|redis|dynamodb)$/],
];

/**
 * One entry per skill (the shorter spelling wins), grouped, at most `cap`
 * entries, those named in the posting or demonstrated in the bullets first.
 * Never adds a skill.
 */
function tidySkills(skills, { jobDescription = '', bulletText = '', cap = 15 } = {}) {
  const flat = Array.isArray(skills) ? skills : Object.values(skills || {}).flat();
  const seen = new Map();
  for (const s of flat.map((x) => String(x).trim()).filter(Boolean)) {
    const k = skillKey(s);
    if (!seen.has(k) || s.length < seen.get(k).length) seen.set(k, s);
  }
  const jd = String(jobDescription).toLowerCase(), bt = String(bulletText).toLowerCase();
  const score = (s) => (jd.includes(s.toLowerCase().replace(/\(.*?\)/g, '').trim()) ? 2 : 0) + (bt.includes(s.toLowerCase().replace(/\(.*?\)/g, '').trim()) ? 1 : 0);
  const list = [...seen.values()].map((s, i) => ({ s, i, sc: score(s) })).sort((a, b) => b.sc - a.sc || a.i - b.i).slice(0, cap);
  const grouped = {};
  for (const { s } of list) {
    const key = skillKey(s);
    const cat = (CATEGORY_RULES.find(([, re]) => re.test(key.replace(/\./g, ''))) || [])[0] || 'Tools';
    (grouped[cat] = grouped[cat] || []).push(s);
  }
  const order = ['Languages', 'Frameworks', 'Infrastructure', 'Tools'];
  const ordered = {};
  for (const c of order) if (grouped[c]) ordered[c] = grouped[c];
  return ordered;
}

module.exports = {
  buildPolishPrompt, parsePolish, verifyPolish, verifyRole, verifySummary, applyPolish,
  tidySkills, unsupportedTerms, MAX_BULLET_CHARS,
};
