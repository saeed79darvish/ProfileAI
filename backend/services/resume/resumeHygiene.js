/**
 * Two things that reached a candidate's finished PDF and should never have.
 *
 * 1. PLACEHOLDERS. The output contract showed education as
 *    `{"school": "Institution or [add institution name]", ...}` and a rule told
 *    the model to use placeholders when the source lacked a field. Neither
 *    `stripAnnotationsInPlace` nor `sanitizeATS` touches education, so the
 *    brackets survived all the way to the renderer and a real resume shipped
 *    with a second education entry reading
 *
 *      [add institution name]            [add graduation year]
 *      [add degree] — Computer Programming, Specific Applications
 *
 *    A placeholder is a note to the candidate, and this codebase's rule is that
 *    the resume fields carry finished text while notes go to `openQuestions`.
 *    Education was simply never wired to that rule.
 *
 * 2. INFLATED TENURE. A summary claimed "eight years" on a work history whose
 *    own dates span 6.4 — against a posting gated on "7+ years". That is the
 *    most consequential number on a resume and the one a recruiter checks
 *    first by subtracting the dates printed directly underneath it. Nothing
 *    verified it: the metrics auditor looks for percentages and digits, and
 *    "eight" is a word.
 */

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, 'twenty-five': 25, thirty: 30,
};

/** Parse "2021-06", "2021-06-01", "June 2021", "2021" into a Date, or null. */
function parseDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^(present|current|now)$/i.test(s)) return new Date();
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1);
  m = s.match(/^(\d{4})$/);
  if (m) return new Date(Number(m[1]), 0, 1);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Years of professional experience the dates actually support.
 *
 * Intervals are UNIONED, not summed. A contract held alongside a staff job is
 * one stretch of time, and summing them is how two years of double-counting
 * moves someone a whole seniority band.
 *
 * @param {Array<{startDate?: string, endDate?: string, current?: boolean, period?: string}>} experience
 * @param {Date} [now]
 * @returns {number} years, to one decimal
 */
function totalExperienceYears(experience, now = new Date()) {
  const spans = [];
  for (const role of Array.isArray(experience) ? experience : []) {
    if (!role) continue;
    let start = parseDate(role.startDate);
    let end = role.current ? now : parseDate(role.endDate);

    // Fall back to a "Jun 2021 - Aug 2023" style period string.
    if ((!start || !end) && role.period) {
      const parts = String(role.period).split(/\s*[-–—to]+\s*/i).filter(Boolean);
      if (!start && parts[0]) start = parseDate(parts[0]);
      if (!end && parts[1]) end = parseDate(parts[1]);
    }
    if (!start) continue;
    if (!end) end = now;
    if (end < start) continue;
    spans.push([start.getTime(), end.getTime()]);
  }
  if (!spans.length) return 0;

  spans.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = spans[0];
  for (let i = 1; i < spans.length; i++) {
    const [s, e] = spans[i];
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      [curStart, curEnd] = [s, e];
    }
  }
  total += curEnd - curStart;
  return Math.round((total / MS_PER_YEAR) * 10) / 10;
}

const TENURE_RE = new RegExp(
  `\\b(\\d{1,2}|${Object.keys(NUMBER_WORDS).join('|')})\\s*\\+?\\s*(?:years?|yrs?)\\b`,
  'gi'
);

/**
 * Every "N years" claim in a piece of text.
 * @returns {Array<{raw: string, years: number}>}
 */
function findTenureClaims(text) {
  const out = [];
  const s = String(text || '');
  for (const m of s.matchAll(TENURE_RE)) {
    const token = String(m[1]).toLowerCase();
    const years = /^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token];
    if (typeof years === 'number' && years > 0 && years < 60) {
      out.push({ raw: m[0].trim(), years });
    }
  }
  return out;
}

/**
 * Flag any tenure claim the dates cannot support.
 *
 * `tolerance` exists because rounding a 6.6-year history to "7 years" is normal
 * resume writing, not a lie. Claiming eight on 6.4 is neither.
 *
 * @returns {{actualYears: number, claims: Array, inflated: Array, clean: boolean}}
 */
function auditTenureClaims(text, experience, { tolerance = 0.5, now = new Date() } = {}) {
  const actualYears = totalExperienceYears(experience, now);
  const claims = findTenureClaims(text);
  const inflated = actualYears > 0
    ? claims.filter((c) => c.years > actualYears + tolerance)
    : [];
  return { actualYears, claims, inflated, clean: inflated.length === 0 };
}

const PLACEHOLDER_RE = /\[\s*add[^\]]*\]/gi;

/** Is this field nothing but a placeholder (or empty)? */
function isPlaceholder(value) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return true;
  return !s.replace(PLACEHOLDER_RE, '').replace(/[\s,–—-]+/g, '');
}

/** Remove bracketed placeholders from a string, returning '' if that's all it was. */
function stripPlaceholders(value) {
  if (typeof value !== 'string') return value;
  return value.replace(PLACEHOLDER_RE, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Strip placeholder text out of the sections that render it verbatim.
 *
 * Education and projects were the two the existing scrubbers missed. An entry
 * with no real institution AND no real degree is dropped entirely — it carries
 * no information a reader can use, and printing "[add institution name]" on a
 * resume is worse than printing nothing.
 *
 * @returns {{questions: Array<{type: string, term: string, question: string}>, changed: string[]}}
 */
function stripPlaceholderEntries(draft) {
  const questions = [];
  const changed = [];

  if (Array.isArray(draft.education)) {
    const kept = [];
    for (const entry of draft.education) {
      if (!entry || typeof entry !== 'object') continue;
      const school = stripPlaceholders(entry.school || entry.institution || '');
      const degree = stripPlaceholders(entry.degree || '');
      const field = stripPlaceholders(entry.field || '');
      const year = stripPlaceholders(entry.year || entry.graduationYear || '');

      if (!school && !degree) {
        // Nothing identifying survives — drop it and ask instead of printing it.
        const hint = field || 'an education entry';
        questions.push({
          type: 'education_incomplete',
          term: hint,
          question: `Your profile has an education entry for "${hint}" with no institution or degree recorded. Add the school and degree, or it stays off the resume.`,
        });
        changed.push('education');
        continue;
      }
      const next = { ...entry, school, degree, field, year };
      delete next.institution;
      delete next.graduationYear;
      if (
        school !== (entry.school || entry.institution || '') ||
        degree !== (entry.degree || '') ||
        year !== (entry.year || entry.graduationYear || '')
      ) {
        changed.push('education');
        if (!year) {
          questions.push({
            type: 'education_incomplete',
            term: school || degree,
            question: `What year did you finish at ${school || degree}? It is missing from your profile, so the resume shows no date for it.`,
          });
        }
      }
      kept.push(next);
    }
    draft.education = kept;
  }

  if (Array.isArray(draft.projects)) {
    draft.projects = draft.projects.map((p) => {
      if (!p || typeof p !== 'object') return p;
      const title = stripPlaceholders(p.title || p.name || '');
      if (title !== (p.title || p.name || '')) changed.push('projects');
      return { ...p, title: title || p.title || p.name };
    });
  }

  for (const key of ['summary', 'title']) {
    if (typeof draft[key] === 'string' && PLACEHOLDER_RE.test(draft[key])) {
      draft[key] = stripPlaceholders(draft[key]);
      changed.push(key);
    }
  }

  return { questions, changed: [...new Set(changed)] };
}

module.exports = {
  totalExperienceYears,
  findTenureClaims,
  auditTenureClaims,
  stripPlaceholderEntries,
  stripPlaceholders,
  isPlaceholder,
  parseDate,
};
