/**
 * learnedAnswers: the pure rules behind "learned answers".
 *
 * What a person picked or typed on one application form is remembered, so the
 * same kind of question on another form (even worded differently) is filled in
 * without asking again. Nothing here does I/O; the model stage is injected.
 */

const crypto = require('crypto');
const { detectFact, mapFactToOption, polarityOf } = require('../config/answerCatalog');

const MAX_ITEMS = 300;
const MAX_QUESTION = 300;
const MAX_ANSWER = 500;
const MAX_OPTIONS = 20;
const MAX_OPTION_LEN = 200;
const JACCARD_SAME = 0.8;
const JACCARD_CANDIDATE = 0.3;
const MAX_CANDIDATES = 5;
const RESOLVABLE_FIELDS = new Set(['select', 'radio', 'combobox', 'text']);

const STRIP = new Set(['a', 'an', 'the', 'you', 'your', 'for', 'this', 'of', 'in', 'to', 'is', 'are', 'do', 'does', 'will', 'would', 'we', 'our', 'with']);

const badRequest = (message, code = 'invalid_learned_answer') => Object.assign(new Error(message), { status: 400, code });

const cleanText = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** lowercase, no punctuation, filler words dropped, tokens sorted and joined. */
function normalizeKey(question) {
  const tokens = String(question || '').toLowerCase()
    .replace(/'s\b/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STRIP.has(t))
    // A light stem so "drivers" and "driver", "licenses" and "license" are one word.
    .map((t) => (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
  return tokens.sort().join(' ');
}

const tokenSet = (key) => new Set(String(key || '').split(' ').filter(Boolean));

function jaccard(keyA, keyB) {
  const a = tokenSet(keyA);
  const b = tokenSet(keyB);
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** A shared word of five letters or more ("license", "relocate"): worth asking the model about. */
const sharesDistinctiveWord = (keyA, keyB) => {
  const b = tokenSet(keyB);
  return [...tokenSet(keyA)].some((t) => t.length >= 5 && !/\d/.test(t) && b.has(t));
};

const numbersOf = (key) => [...tokenSet(key)].filter((t) => /\d/.test(t)).sort().join(',');

/** Same words, same numbers ("25 percent" is not "50 percent"). */
const deterministicMatch = (keyA, keyB) => (
  keyA === keyB || (numbersOf(keyA) === numbersOf(keyB) && jaccard(keyA, keyB) >= JACCARD_SAME)
);

const isSensitive = (question) => {
  const hit = detectFact(question);
  return !!(hit && hit.sensitive);
};

/* ---------- answer to catalog value ---------- */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9% ]+/g, ' ').replace(/\s+/g, ' ').trim();

const VALUE_FACTS = new Set(['sponsorshipNow', 'sponsorshipFuture', 'workAuthorization', 'openToRelocation', 'officeComfort']);

/**
 * The catalog value an answer stands for, or null when unclear.
 * Only yes/no style facts are derived.
 */
function valueFromAnswer(factId, answerText, questionText = '') {
  if (!VALUE_FACTS.has(factId)) return null;
  const n = norm(answerText);
  if (!n) return null;
  const p = polarityOf(answerText);
  const bare = /^(yes|no)\b/.test(n) ? n.split(' ')[0] : p;
  switch (factId) {
    case 'sponsorshipNow':
    case 'sponsorshipFuture':
      return bare === 'yes' || bare === 'no' ? bare : null;
    case 'workAuthorization':
      return bare === 'yes' ? 'authorized_no_sponsorship' : null;
    case 'openToRelocation':
      if (/\bdepend/.test(n)) return 'depends';
      return bare === 'yes' || bare === 'no' ? bare : null;
    case 'officeComfort': {
      if (/\bremote\b/.test(n) && !/hybrid|on ?site|office/.test(n)) return 'remote_only';
      if (/\bhybrid\b/.test(n)) return 'hybrid_ok';
      if (/\bon ?site\b|\bin office\b|\bin person\b/.test(n)) return 'onsite_ok';
      const q = String(questionText || '').toLowerCase();
      const pct = q.match(/(\d{1,3})\s*%/);
      const heavy = (pct && Number(pct[1]) >= 80) || /(four|five|4|5) days|full[- ]time (in|at)|fully (on-?site|in[- ]office)/.test(q);
      if (bare === 'yes') return heavy ? 'onsite_ok' : 'hybrid_ok';
      if (bare === 'no') return heavy ? null : 'remote_only';
      return null;
    }
    default: return null;
  }
}

/* ---------- answer to option text ---------- */

const optText = (o) => (typeof o === 'string' ? o : (o && (o.text || o.label || o.value)) || '');

/** The option that clearly stands for a stored answer, or null. */
function mapAnswerToOption(answerText, options) {
  const opts = (Array.isArray(options) ? options : []).map(optText).filter((o) => o.trim());
  const a = norm(answerText);
  if (!opts.length || !a) return null;
  const exact = opts.find((o) => norm(o) === a);
  if (exact) return exact;
  if (a === 'yes' || a === 'no') {
    const probe = mapFactToOption('openToRelocation', a, opts);
    return probe || null;
  }
  const words = (s) => ` ${norm(s)} `;
  const hits = opts.filter((o) => {
    const on = norm(o);
    return on.length >= 3 && (words(a).includes(words(on)) || words(on).includes(words(a)));
  });
  return hits.length === 1 ? hits[0] : null;
}

/* ---------- the stored list ---------- */

const cleanOptions = (options) => (Array.isArray(options) ? options : [])
  .map((o) => cleanText(optText(o), MAX_OPTION_LEN)).filter(Boolean).slice(0, MAX_OPTIONS);

/**
 * Adds or replaces the learned answer for a question. Pure: returns
 * { items, item } or { skipped: 'sensitive' }, or throws a 400-tagged error.
 */
function upsertLearned(current, input = {}, now = new Date(), makeId = () => crypto.randomUUID()) {
  const items = Array.isArray(current) ? current : [];
  const question = cleanText(input.question, MAX_QUESTION);
  const rawAnswer = String(input.answer ?? '').replace(/\s+/g, ' ').trim();
  if (!question) throw badRequest('question is required');
  if (!rawAnswer) throw badRequest('answer is required');
  if (rawAnswer.length > MAX_ANSWER) throw badRequest('answer is too long to remember');
  if (isSensitive(question)) return { skipped: 'sensitive', items };
  const key = normalizeKey(question);
  if (!key) throw badRequest('question is required');

  const options = cleanOptions(input.options);
  const kind = input.kind === 'choice' || input.kind === 'text' ? input.kind : (options.length ? 'choice' : 'text');
  const stamp = now.toISOString();
  const hit = detectFact(question);
  const factId = typeof hit === 'string' ? hit : undefined;
  const choiceValue = factId ? valueFromAnswer(factId, rawAnswer, question) : null;

  const previous = items.find((i) => i.key === key);
  const item = {
    id: previous ? previous.id : makeId(),
    question,
    key,
    kind,
    answer: rawAnswer,
    ...(options.length ? { options } : {}),
    ...(factId ? { factId } : {}),
    ...(choiceValue ? { choiceValue } : {}),
    ...(cleanText(input.company, 120) ? { company: cleanText(input.company, 120) } : {}),
    ...(cleanText(input.jobTitle, 160) ? { jobTitle: cleanText(input.jobTitle, 160) } : {}),
    source: 'user',
    uses: previous ? previous.uses || 0 : 0,
    createdAt: previous ? previous.createdAt : stamp,
    updatedAt: stamp,
    lastUsedAt: previous ? previous.lastUsedAt || null : null,
  };
  const next = [item, ...items.filter((i) => i.key !== key)].slice(0, MAX_ITEMS);
  return { items: next, item, factId, choiceValue };
}

/** The person edits the answer of one item. Returns { items, item } or null. */
function editLearned(current, id, answer, now = new Date()) {
  const items = Array.isArray(current) ? current : [];
  const text = String(answer ?? '').replace(/\s+/g, ' ').trim();
  if (!text) throw badRequest('answer is required');
  if (text.length > MAX_ANSWER) throw badRequest('answer is too long to remember');
  const found = items.find((i) => i.id === id);
  if (!found) return null;
  const choiceValue = found.factId ? valueFromAnswer(found.factId, text, found.question) : null;
  const { choiceValue: _old, ...rest } = found;
  const item = { ...rest, answer: text, ...(choiceValue ? { choiceValue } : {}), updatedAt: now.toISOString() };
  return { items: items.map((i) => (i.id === id ? item : i)), item, choiceValue };
}

/** Records that learned answers were used. */
function bumpUses(current, ids, now = new Date()) {
  const used = new Set(ids);
  const stamp = now.toISOString();
  return (Array.isArray(current) ? current : []).map((i) => (
    used.has(i.id) ? { ...i, uses: (i.uses || 0) + 1, lastUsedAt: stamp } : i
  ));
}

/* ---------- the resolver ---------- */

const factOf = (question) => { const h = detectFact(question); return typeof h === 'string' ? h : null; };

function matchPrompt(question, candidates) {
  const list = candidates.map((c, i) => `${i}. Question: "${c.question}" Answer: "${c.answer}"`).join('\n');
  return `A job application form asks a new question. The person already answered similar questions on other forms.
Decide whether one of the earlier questions asks for the same thing, so its answer is also the right answer to the new question.

NEW QUESTION: "${question}"

EARLIER QUESTIONS:
${list}

Rules:
- same_concept is true only when both ask about the same underlying fact or preference.
- same_polarity is true only when a "yes" to one means "yes" to the other. Asking whether someone NEEDS something is the opposite of asking whether they HAVE or ARE ALLOWED something (for example needing visa sponsorship versus being authorized to work).
- When unsure, return null for match and false for both flags.

Reply with JSON only: {"match": <index of the earlier question or null>, "same_concept": true|false, "same_polarity": true|false}`;
}

/**
 * Finds the learned answer for a question. Returns
 * { item, how } with how = 'key' | 'model', or null.
 *
 * @param {string} question
 * @param {Array<object>} learned
 * @param {(call:{question:string,candidates:Array,prompt:string})=>Promise<object|null>} [runMatch]
 */
async function findLearned(question, learned, runMatch) {
  const items = Array.isArray(learned) ? learned : [];
  if (!items.length) return null;
  const key = normalizeKey(question);
  if (!key) return null;
  const qFact = factOf(question);
  // A question about one catalog fact is never the same as a question about another.
  const compatible = items.filter((i) => !(qFact && i.factId && i.factId !== qFact));

  const exact = compatible.filter((i) => deterministicMatch(key, i.key))
    .sort((a, b) => jaccard(key, b.key) - jaccard(key, a.key));
  if (exact.length) return { item: exact[0], how: 'key' };
  if (typeof runMatch !== 'function') return null;

  const candidates = compatible
    .map((i) => ({ i, score: jaccard(key, i.key) }))
    .filter((c) => (c.score >= JACCARD_CANDIDATE || sharesDistinctiveWord(key, c.i.key)) && numbersOf(key) === numbersOf(c.i.key))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map((c) => c.i);
  if (!candidates.length) return null;

  let verdict = null;
  try {
    verdict = await runMatch({
      question,
      candidates: candidates.map((c) => ({ question: c.question, answer: c.answer })),
      prompt: matchPrompt(question, candidates),
    });
  } catch { return null; }
  if (!verdict || verdict.same_concept !== true || verdict.same_polarity !== true) return null;
  const idx = verdict.match;
  if (!Number.isInteger(idx) || idx < 0 || idx >= candidates.length) return null;
  return { item: candidates[idx], how: 'model' };
}

/**
 * Turns a found learned item into the detail the client shows, or a
 * needs_you detail with a suggestion when it does not fit this form.
 */
function learnedDetail(question, found, options) {
  const { item } = found;
  const opts = Array.isArray(options) ? options : [];
  const learnedFrom = {
    question: item.question,
    ...(item.company ? { company: item.company } : {}),
    at: item.updatedAt || item.createdAt || null,
  };
  const choiceValue = item.factId ? valueFromAnswer(item.factId, item.answer, question) : (item.choiceValue || null);
  const base = { learnedId: item.id, learnedFrom, ...(choiceValue ? { choiceValue } : {}) };
  if (opts.length) {
    const mapped = mapAnswerToOption(item.answer, opts);
    if (!mapped) return { answer: '', source: 'needs_you', suggestion: item.answer, ...base };
    return { answer: mapped, source: 'learned', ...base };
  }
  return { answer: item.answer, source: 'learned', ...base };
}

module.exports = {
  MAX_ITEMS, MAX_ANSWER, MAX_QUESTION, RESOLVABLE_FIELDS,
  normalizeKey, jaccard, deterministicMatch, isSensitive, valueFromAnswer, mapAnswerToOption,
  upsertLearned, editLearned, bumpUses, findLearned, learnedDetail, matchPrompt,
};
