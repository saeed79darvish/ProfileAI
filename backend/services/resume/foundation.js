/**
 * Tailoring keeps the candidate's foundation.
 *
 * The candidate's principle, in their words: the summary is the main thing;
 * don't change the foundation and basics. Swap the title to the posting's,
 * then ADD a line or two for the job's key themes. The same for experience —
 * keep the bullets, reorder or add, never rewrite from scratch or cut.
 *
 * Until now tailoring rewrote the summary wholesale, so the tailored version
 * shared nothing with the resume the candidate actually wrote. Asking the
 * model to "keep the foundation" is the kind of instruction that loses to the
 * twenty rewrite rules around it, so the foundation is assembled HERE, in
 * code, from the candidate's own text, and the model is only asked for the
 * addition.
 */

const ROLE_NOUNS =
  'engineer|developer|programmer|architect|manager|designer|analyst|scientist|researcher|lead|director|head|consultant|specialist|administrator|coordinator|strategist|writer|recruiter|accountant|controller|officer|associate|technician';

/**
 * A summary that opens with a role title: "Senior Software Engineer with 8+
 * years…", "Frontend Engineer who builds…", "Product Designer specializing
 * in…". Captures the title so it can be swapped for the posting's headline.
 */
const LEADING_TITLE_RE = new RegExp(
  `^\\s*((?:[A-Z][\\w+#./&-]*\\s+){0,5}(?:${ROLE_NOUNS})(?:\\s+(?:I{1,3}|IV|V|[1-5]))?)` +
  `(?=\\s*(?:,|—|–|-|\\||with\\b|who\\b|specializ|focus|experienced\\b|skilled\\b|based\\b|bringing\\b|offering\\b))`,
  'i'
);

/**
 * The candidate's summary with its leading title replaced by the posting's
 * headline. A summary that does not open with a title is returned untouched —
 * nothing is invented to make room for one.
 */
function swapLeadingTitle(summary, headline) {
  const text = String(summary || '').trim();
  const target = String(headline || '').trim();
  if (!text || !target) return text;
  const m = text.match(LEADING_TITLE_RE);
  if (!m) return text;
  return target + text.slice(m[0].length);
}

const sentencesOf = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .filter(Boolean);

/**
 * Clean the model's addition: strip placeholders, cap at two sentences, drop
 * anything that merely repeats the foundation.
 */
function cleanAddition(addition, foundation) {
  let text = String(addition || '').replace(/\[\s*add[^\]]*\]/gi, '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  // Compare both sides normalised the same way, and only treat a sentence as
  // a repeat when it is long enough to be one — "one" is inside "component".
  const normal = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const base = normal(foundation);
  const kept = sentencesOf(text).filter((s) => {
    const key = normal(s);
    if (!key) return false;
    return key.length < 20 || !base.includes(key);
  });
  return kept.slice(0, 2).join(' ');
}

/**
 * The tailored summary: the candidate's own text, title swapped, with the
 * model's addition appended.
 *
 * @returns {{ summary: string, foundation: string, addition: string, titleSwapped: boolean }}
 */
function buildTailoredSummary({ originalSummary, headline, addition }) {
  const original = String(originalSummary || '').trim();
  const foundation = swapLeadingTitle(original, headline);
  const extra = cleanAddition(addition, foundation);
  const summary = [foundation, extra].filter(Boolean).join(' ').trim();
  return { summary, foundation, addition: extra, titleSwapped: foundation !== original };
}

module.exports = { swapLeadingTitle, buildTailoredSummary, cleanAddition, LEADING_TITLE_RE };

// ── Experience: every original bullet survives ──────────────────────────────

const bulletsOf = (description) =>
  String(description || '')
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[•\-*–—]\s*/, '').trim())
    .filter(Boolean);

const sig = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#%$. ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

/**
 * Does tailored bullet `t` still carry original bullet `o`? Light keyword
 * surfacing is allowed ("…in React" becoming "…in React and TypeScript"), so
 * the test is that nearly all of the original's words — and every number — are
 * still present, not that the strings are equal.
 */
function carries(t, o) {
  const ow = sig(o);
  if (!ow.length) return true;
  const tw = new Set(sig(t));
  const kept = ow.filter((w) => tw.has(w)).length / ow.length;
  const numbersKept = (o.match(/\d[\d,.]*%?/g) || []).every((n) => t.includes(n));
  return kept >= 0.85 && numbersKept;
}

/**
 * For each role: every original bullet is kept (as the tailored line that still
 * carries it, so keyword surfacing survives; otherwise verbatim), tailored
 * lines that carry no original bullet are kept as ADDITIONS after them, and a
 * role the model dropped comes back whole.
 *
 * @returns {{ restored: string[] }}
 */
function enforceFoundationBullets(draft, originalExperience) {
  const restored = [];
  const src = Array.isArray(originalExperience) ? originalExperience : [];
  if (!src.length) return { restored };
  const out = Array.isArray(draft.experience) ? [...draft.experience] : [];

  for (let i = 0; i < src.length; i++) {
    const o = src[i] || {};
    const label = o.company || o.title || `role ${i + 1}`;
    const origBullets = bulletsOf(o.description);
    const entry = out[i] && typeof out[i] === 'object' ? out[i] : null;
    if (!entry) {
      out[i] = { company: o.company || '', title: o.title || '', period: o.period || '', description: origBullets.map((b) => `• ${b}`).join('\n') };
      restored.push(`${label}: role was dropped — restored`);
      continue;
    }
    const tailored = bulletsOf(entry.description);
    const used = new Set();
    const kept = [];
    let lost = 0;
    for (const ob of origBullets) {
      const idx = tailored.findIndex((tb, k) => !used.has(k) && carries(tb, ob));
      if (idx >= 0) { used.add(idx); kept.push(tailored[idx]); }
      else { kept.push(ob); lost++; }
    }
    const additions = tailored.filter((_, k) => !used.has(k));
    if (lost) restored.push(`${label}: ${lost} bullet(s) rewritten or dropped — originals restored`);
    out[i] = { ...entry, description: [...kept, ...additions].map((b) => `• ${b}`).join('\n') };
  }
  draft.experience = out;
  return { restored };
}

// ── Education: the most specific record wins, field by field ───────────────

const GENERIC_SCHOOL = /^(?:bootcamp|boot camp|school|university|college|institute|academy|online|self[- ]taught|n\/?a)$/i;

/**
 * The stored profile record can be THINNER than the resume the model read:
 * "Bootcamp" where the resume says "UCSC Silicon Valley Extension". Preferring
 * the record outright printed "Bootcamp". Each field now takes the more
 * specific value: a generic word loses to a real name, and an empty field
 * loses to any value. Nothing present in either version is dropped.
 */
function mergeEducation(recordEntries, draftEntries) {
  const rec = Array.isArray(recordEntries) ? recordEntries.filter((e) => e && typeof e === 'object') : [];
  const dr = Array.isArray(draftEntries) ? draftEntries.filter((e) => e && typeof e === 'object') : [];
  // A bracketed placeholder is not a value, however long it is.
  const isPlaceholder = (v) => /\[\s*add[^\]]*\]/i.test(v);
  const val = (e, ...keys) => { for (const k of keys) { const v = e && e[k]; if (typeof v === 'string' && v.trim() && !isPlaceholder(v)) return v.trim(); } return ''; };
  const better = (a, b, generic) => {
    if (!a) return b; if (!b) return a;
    if (generic && GENERIC_SCHOOL.test(a) && !GENERIC_SCHOOL.test(b)) return b;
    if (generic && GENERIC_SCHOOL.test(b) && !GENERIC_SCHOOL.test(a)) return a;
    return a.length >= b.length ? a : b;
  };
  const n = Math.max(rec.length, dr.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = rec[i] || {}, d = dr[i] || {};
    const entry = {
      school: better(val(r, 'school', 'institution'), val(d, 'school', 'institution'), true),
      degree: better(val(r, 'degree'), val(d, 'degree'), false),
      field: better(val(r, 'field', 'fieldOfStudy'), val(d, 'field'), false),
      year: better(val(r, 'year', 'graduationYear', 'endDate'), val(d, 'year', 'graduationYear'), false),
    };
    if (entry.school || entry.degree) out.push(entry);
  }
  return out;
}

module.exports.enforceFoundationBullets = enforceFoundationBullets;
module.exports.mergeEducation = mergeEducation;
module.exports.bulletsOf = bulletsOf;
