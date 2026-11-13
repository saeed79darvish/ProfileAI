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
const { auditTenureClaims, findTenureClaims, totalExperienceYears } = require('./resumeHygiene');

const MAX_BULLET_CHARS = 230;
const MAX_SUMMARY_WORDS = 65;

const words = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9+#.%$ ]+/g, ' ').split(/\s+/).filter(Boolean);
const standaloneNumbers = (t) => (String(t || '').match(/(?<![A-Za-z0-9])\d[\d,.]*\+?%?/g) || []).map((n) => n.replace(/[,.]+$/, ''));
const numbersIn = (t) => (String(t || '').match(/\d[\d,.]*\+?%?/g) || []).map((n) => n.replace(/[,.]+$/, ''));

/** Outcome adjectives a bullet may only use when the source already does. */
const OUTCOME_RE = /\b(fast(?:er)?|smooth(?:ly)?|at scale|scales|scaling up|reliabl[ey]|seamless(?:ly)?|robust|easy[- ]to[- ]use|blazing|effortless(?:ly)?)\b/i;
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
      const low = tok.toLowerCase();
      if (!source.includes(low) && !source.includes(low.replace(/(?:e?s)$/, ''))) out.add(tok);
    });
  }
  return [...out];
}

/** Sentence-level stripped copy of "(ES6+)" style duplicates when comparing skills. */
const skillKey = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9+#]+/g, '');
/** css3 / html5 and the like match a posting that says css / html. */
const skillStem = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/\b(css|html)\d\b/g, '$1').trim();

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

  const years = Math.floor(totalExperienceYears(exp));
  const yearsFact = years >= 3
    ? `YEARS OF EXPERIENCE: the dated roles add up to ${years} years. The first sentence of the summary may state "${years} years" (never a higher number). A recruiter screens on this, so state it plainly, inside a full sentence with a subject: "Frontend engineer with ${years} years of experience building React interfaces for ...". Never open with the number alone.`
    : 'YEARS OF EXPERIENCE: too short to state; leave years out.';
  const reqs = (Array.isArray(keywords.requirements) ? keywords.requirements : []).filter(Boolean).slice(0, 10);
  const reqBlock = reqs.length ? `POSTING REQUIREMENTS, as the posting ranks them:\n${reqs.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n` : '';

  const system = `You are a resume editor. You improve WORDING only. You never add facts.
You return JSON and nothing else.`;

  const prompt = `Rewrite this candidate's resume bullets and summary for one posting. The result must read like a person wrote it about their own work, not like a keyword list.

TARGET: ${targetTitle || 'the posting'}${company ? ` at ${company}` : ''}
POSTING KEYWORDS: ${(keywords.required || []).slice(0, 14).join(', ')}
${reqBlock}${yearsFact}

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
- A figure keeps the attribution its source gives it. "resulting in a 25% increase in engagement" becomes "...a 25% increase in engagement", never "raised engagement 25%". Do not turn a contribution into a cause, and never put an unexplained figure first in a role.
- Add no outcome the source does not state: no "fast", "smooth", "at scale", "reliable", "easy to use" unless the source says so.
- Do not explain what something was FOR unless the source says so. "enhancing feature design efficiency" stays about faster feature design; do not add an audience or benefit ("giving designers shared building blocks"). Purpose, audience and benefit clauses are claims like any other.
- Name collaborators ("product managers and designers", "UX and QA") at most twice in the whole resume. Say what was built with them instead.
- Order each role's bullets by what THIS posting asks for first. Compress off-topic material (for a frontend posting: servers, containers, cloud plumbing) into one short clause or drop it; give the space to work the posting cares about.
- Vary how bullets open. No verb opens more than two bullets in the whole resume, and a bullet is not "Built X in A, B and C to improve D": cut trailing purpose clauses that say nothing ("to align with business goals", "to improve efficiency").
- Tense: past tense for past roles, present tense only for the current role, and the same tense across a role.
- Every distinctive claim in the summary must be backed by a bullet you keep. Do not describe the candidate's whole career by one or two projects ("content-heavy products", "consumer-facing") and do not echo the posting's framing for work the source does not show.

SUMMARY RULES
- Two or three sentences, at most ${MAX_SUMMARY_WORDS} words, in the same voice as the candidate's own summary (no "I").
- The first sentence says what this person builds and the kind of product, taken from the strongest bullets. It must not open with the posting's job title as an identity unless the candidate has held that title.
- Years: only the figure given above, in the first sentence, and only if it was given. No metrics, no self-rating (strong, passionate, proven), no run of four words copied from the posting.
- The first sentence answers the posting's top requirements the candidate can truthfully meet, using their strongest matching evidence, even when other work is more impressive.
- Mention at most two posting terms, only ones the bullets support.
- Name the strongest evidence for this posting with a concrete system or result (what was built, for whom), not a stack inventory. Skip "comfortable with X" filler and backend breadth the posting does not ask for.

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
  const roleTextLower = roleText.toLowerCase();
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
    const outcome = (text.match(OUTCOME_RE) || [])[0];
    if (outcome && !roleTextLower.includes(outcome.toLowerCase())) reasons.push(`outcome the source never states ("${outcome}"): "${text.slice(0, 50)}"`);
    for (const n of numbersIn(text)) {
      const cause = new RegExp(`\\b(?:raised|lifted|boosted|drove|grew|increased|cut|reduced|improved|saved)\\b[^.;]{0,60}\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      const srcSentence = sourceUnits.find((u) => u.includes(n));
      if (srcSentence && /\b(resulting in|contributing to|leading to|which led to)\b/i.test(srcSentence) && cause.test(text)) {
        reasons.push(`turns "resulting in ${n}" into a cause: "${text.slice(0, 50)}"`);
      }
    }
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
  const actualYears = Math.floor(totalExperienceYears(experience));
  const overclaim = findTenureClaims(text).filter((c) => c.years > actualYears);
  if (overclaim.length) reasons.push(`years-of-experience claim the dates do not support ("${overclaim[0].raw}", the roles add up to ${actualYears})`);
  const yearsAllowed = new Set(findTenureClaims(text).filter((c) => c.years <= actualYears).map((c) => String(c.years)));
  const bad = numbersIn(text).filter((n) => !numbersIn(allSourceText).includes(n) && !yearsAllowed.has(n.replace(/\+$/, '')));
  if (bad.length) reasons.push(`new number ${bad.join(', ')}`);
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


function allSource(profile) {
  const exp = Array.isArray(profile.experience) ? profile.experience : [];
  return [
    profile.summary, profile.title,
    ...(Array.isArray(profile.skills) ? profile.skills : Object.values(profile.skills || {}).flat()),
    ...exp.flatMap((e) => [e.company, e.title, e.description]),
    ...(profile.education || []).flatMap((e) => [e.school, e.degree, e.field]),
  ].filter(Boolean).join(' ');
}
const heldTitlesOf = (profile) => [profile.title, ...(profile.experience || []).map((e) => e.title)].filter(Boolean).map((t) => String(t).toLowerCase());

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
  ['Languages', /^(javascript|typescript|html|css|sass|scss|less|python|java|go|ruby|sql|c\+\+|c#|php|swift|kotlin)$/],
  ['Frameworks', /^(react|redux|nextjs|vuejs|angular|nodejs|express|bootstrap|materialui|reactstrap|storybook|tailwindcss|tailwind|svelte|nestjs)$/],
  ['APIs and data', /^(graphql|rest|restapis?|restfulapis?|mongodb|mysql|postgres(ql)?|redis|dynamodb)$/],
  ['Testing', /^(jest|enzyme|cypress|playwright|vitest|mocha|testinglibrary)$/],
  ['Infrastructure', /^(aws|awslambda|apigateway|docker|kubernetes|terraform|cicd|serverless|gcp|azure)$/],
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
  const score = (s) => (jd.includes(skillStem(s)) ? 2 : 0) + (bt.includes(skillStem(s)) ? 1 : 0);
  const list = [...seen.values()].map((s, i) => ({ s, i, sc: score(s) })).sort((a, b) => b.sc - a.sc || a.i - b.i).slice(0, cap);
  const grouped = {};
  for (const { s } of list) {
    const key = skillKey(s);
    const cat = (CATEGORY_RULES.find(([, re]) => re.test(key.replace(/\./g, '').replace(/^(css|html)\d$/, '$1'))) || [])[0] || 'Tools';
    (grouped[cat] = grouped[cat] || []).push(s);
  }
  const order = ['Languages', 'Frameworks', 'APIs and data', 'Testing', 'Infrastructure', 'Tools'];
  const ordered = {};
  for (const c of order) if (grouped[c]) ordered[c] = grouped[c];
  return ordered;
}



/**
 * A summary that failed only because of one sentence (a phrase copied from the
 * posting, an unsupported term) keeps its other sentences rather than being
 * thrown away for the candidate's old text. Returns null when nothing usable
 * remains or the remainder still fails.
 */
function salvageSummary(text, check) {
  const sentences = String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 2) return null;
  for (let drop = 0; drop < sentences.length; drop++) {
    const kept = sentences.filter((_, i) => i !== drop).join(' ');
    const res = check(kept);
    if (res.text) return res.text;
  }
  return null;
}

// ── Judge and repair ────────────────────────────────────────────────────────

const OPENER_LIMIT = 2;

/** Roles holding an opening verb that is used more than OPENER_LIMIT times in the resume. */
function overusedOpeners(units) {
  const counts = new Map();
  units.flat().forEach((u) => { const v = words(u)[0]; if (v) counts.set(v, (counts.get(v) || 0) + 1); });
  return [...counts].filter(([, c]) => c > OPENER_LIMIT + 1).map(([v, c]) => ({ verb: v, count: c }));
}

/**
 * Collect everything that must be redone: code rejections, claims the fast
 * judge could not trace, and verbs opening too many bullets across the resume.
 * @returns {{ roles: Map<number,string[]>, summary: string[] }}
 */
function collectFailures({ verdict, profile, judged }) {
  const exp = Array.isArray(profile.experience) ? profile.experience : [];
  const roles = new Map();
  const add = (i, reason) => roles.set(i, [...(roles.get(i) || []), reason]);
  verdict.roles.forEach((r, i) => {
    if (r.units === null) r.reasons.slice(0, 3).forEach((x) => add(i, x));
  });
  const summary = verdict.summary ? [] : verdict.summaryReasons.slice(0, 3);
  for (const j of (judged && judged.roles) || []) {
    if (verdict.roles[j.index] && Array.isArray(verdict.roles[j.index].units) && Array.isArray(j.unsupported) && j.unsupported.length) {
      j.unsupported.slice(0, 2).forEach((c) => add(j.index, `claim not supported by the source: "${String(c).slice(0, 90)}"`));
    }
  }
  if (judged && Array.isArray(judged.summary) && judged.summary.length && verdict.summary) {
    judged.summary.slice(0, 2).forEach((c) => summary.push(`claim not supported by the source: "${String(c).slice(0, 90)}"`));
  }
  // Verb repetition counts the wording that will actually ship: polished units
  // where accepted, the candidate's own bullets elsewhere.
  const shipping = exp.map((e, i) => (verdict.roles[i] && Array.isArray(verdict.roles[i].units) && verdict.roles[i].units.length ? verdict.roles[i].units : splitUnitsOf(e.description)));
  for (const { verb, count } of overusedOpeners(shipping)) {
    shipping.forEach((units, i) => {
      const editable = exp[i] && splitUnitsOf(exp[i].description).length > 0;
      if (editable && units.some((u) => words(u)[0] === verb)) add(i, `"${verb}" opens ${count} bullets across the resume; open this role's bullets differently`);
    });
  }
  return { roles, summary };
}

function buildRepairPrompt({ basePrompt, failures, profile, previous }) {
  const lines = [];
  for (const [i, reasons] of failures.roles) {
    const e = profile.experience[i] || {};
    lines.push(`ROLE ${i} (${e.title || ''} at ${e.company || ''}) was rejected:\n${reasons.map((r) => `  - ${r}`).join('\n')}`);
  }
  if (failures.summary.length) lines.push(`SUMMARY was rejected:\n${failures.summary.map((r) => `  - ${r}`).join('\n')}`);
  return `${basePrompt}

YOUR PREVIOUS ANSWER (for reference):
${JSON.stringify(previous).slice(0, 6000)}

PARTS THAT FAILED CHECKS:
${lines.join('\n\n')}

Redo ONLY those parts. Fix exactly the problems listed, stay within the same rules, and keep every fact tied to its source bullet. Return the same JSON shape containing only the redone roles${failures.summary.length ? ' and the summary' : ''}.`;
}

function buildFaithfulnessPrompt({ profile, polished, verdict }) {
  const exp = Array.isArray(profile.experience) ? profile.experience : [];
  const blocks = exp.map((e, i) => {
    const r = verdict.roles[i];
    if (!r || !Array.isArray(r.units) || !r.units.length) return null;
    const src = splitUnitsOf(e.description).map((u, k) => `  source[${k}] ${u}`).join('\n');
    return `ROLE ${i}\n${src}\n${r.units.map((u, k) => `  new[${k}] ${u}`).join('\n')}`;
  }).filter(Boolean).join('\n\n');
  return `You check rewritten resume bullets against their source. For each ROLE, list every phrase in a new[] bullet that claims something its source does not say. Be strict about purpose, audience and benefit clauses (\"giving designers...\", \"so teams can...\", \"for users who...\"), scope (\"every\", \"entire\", \"across the company\"), outcomes and tools that are not in the source bullets. Pure rewording is fine; anything added is not. Also check the SUMMARY against all source bullets.

${blocks}

SUMMARY: ${verdict.summary || '(none)'}
SOURCE SUMMARY: ${profile.summary || ''}

Return JSON only: {"roles":[{"index":0,"unsupported":["quote the new claim"]}],"summary":["quote any unsupported claim"]}. Use empty lists when everything is supported.`;
}

/**
 * The whole pass: write, verify, judge, repair once, verify again.
 *
 * @param {Object} o
 * @param {Function} o.ask       async (prompt, {system,max_tokens}) => text  (the writing model)
 * @param {Function} [o.askFast] async (prompt) => text  (a small model for the faithfulness check)
 * @param {Function} [o.canRetry] () => boolean  whether the clock allows another round
 * @param {Function} [o.repair]  JSON repair for a truncated answer
 * @returns {Promise<{ verdict?: Object, error?: string, repaired?: boolean }>}
 */
async function run({ profile, jobDescription, targetTitle, company, keywords, selected, ask, askFast, canRetry = () => false, repair }) {
  const cfg = buildPolishPrompt({ profile, jobDescription, targetTitle, company, keywords, selected });
  const first = parsePolish(await ask(cfg.prompt, { system: cfg.system, max_tokens: cfg.max_tokens }), repair);
  if (!first) return { error: 'unparseable answer' };
  const verify = (polished) => verifyPolish({ polished, profile, jobDescription, targetTitle, selected });
  let verdict = verify(first);

  let judged = null;
  if (askFast) {
    try {
      const raw = await askFast(buildFaithfulnessPrompt({ profile, polished: first, verdict }));
      judged = parsePolish(raw, repair);
    } catch (_) { /* the code checks stand on their own */ }
  }

  const failures = collectFailures({ verdict, profile, judged });
  let repaired = false;
  let lastSummary = first.summary;
  if ((failures.roles.size || failures.summary.length) && canRetry()) {
    try {
      const second = parsePolish(await ask(buildRepairPrompt({ basePrompt: cfg.prompt, failures, profile, previous: first }), { system: cfg.system, max_tokens: 2500 }), repair);
      if (second) {
        if (second.summary) lastSummary = second.summary;
        const again = verify({ summary: second.summary || first.summary, experience: [...(second.experience || [])] });
        // Take a redone piece only if it now passes the code checks.
        const byIndex = new Map((second.experience || []).map((r) => [r && r.index, r]));
        for (const i of failures.roles.keys()) {
          if (byIndex.has(i) && Array.isArray(again.roles[i].units)) { verdict.roles[i] = again.roles[i]; repaired = true; }
          else if (Array.isArray(verdict.roles[i].units)) { /* judged-down role: nothing better, keep what passed the code checks */ }
        }
        if (failures.summary.length && second.summary && again.summary) { verdict.summary = again.summary; verdict.summaryReasons = []; repaired = true; }
      }
    } catch (_) { /* keep the first verdict */ }
  }
  // Last resort for the summary: keep what is sound rather than fall back to the
  // candidate's old, untailored text.
  if (!verdict.summary) {
    const check = (text) => verifySummary({ summary: text, allSourceText: allSource(profile), jobDescription, experience: profile.experience || [], targetTitle, heldTitles: heldTitlesOf(profile) });
    const saved = salvageSummary(lastSummary, check) || salvageSummary(first.summary, check);
    if (saved) { verdict.summary = saved; verdict.summaryReasons = []; repaired = true; }
  }
  return { verdict, repaired };
}

module.exports = {
  buildPolishPrompt, parsePolish, verifyPolish, verifyRole, verifySummary, applyPolish, run, collectFailures, buildRepairPrompt,
  tidySkills, unsupportedTerms, salvageSummary, MAX_BULLET_CHARS,
};
