/**
 * Role Shape — how much space each job on the resume is allowed to take.
 *
 * "Older roles get fewer bullets" was already written in SENTENCE_STRUCTURE
 * VARIATION, as prose, and every run came back with the same four or five
 * bullets on all four jobs. A uniform shape across an eight-year history is one
 * of the loudest generated-resume tells there is, and it is arithmetic — bullet
 * counts and end dates — so it belongs in code rather than in a paragraph the
 * model grades itself against.
 *
 * Both sides of the run use this module, which is the point: the prompt tells
 * the model the exact per-role allowance up front, and the audit measures the
 * draft against the same numbers afterwards. A rule stated in one vocabulary and
 * checked in another is how "2-3 short lines" turned into five every time.
 */

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** "Present", "Current", "Now" — the role has not ended. */
const ONGOING_RE = /\b(present|current|now|ongoing|to date)\b/i;

/**
 * Pull the start and end date out of a period string. Handles the shapes that
 * actually turn up: "Jan 2021 - Mar 2023", "06/2018-12/2020", "2019 – Present",
 * "March 2015 to June 2016".
 *
 * @param {string} period
 * @param {Date} now
 * @returns {{start: Date|null, end: Date|null, ongoing: boolean}}
 */
function parsePeriod(period, now = new Date()) {
  const text = String(period || '').trim();
  if (!text) return { start: null, end: null, ongoing: false };

  const ongoing = ONGOING_RE.test(text);
  const points = [];

  // "Mon YYYY" / "Month YYYY"
  const monthYear = /([A-Za-z]{3,9})\.?\s+(\d{4})/g;
  let m;
  while ((m = monthYear.exec(text)) !== null) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo === undefined) continue;
    points.push(new Date(Number(m[2]), mo, 1));
  }

  // "MM/YYYY"
  const slashYear = /\b(\d{1,2})\/(\d{4})\b/g;
  while ((m = slashYear.exec(text)) !== null) {
    points.push(new Date(Number(m[2]), Math.max(0, Number(m[1]) - 1), 1));
  }

  // Bare years, only when nothing richer was found — otherwise "Jan 2021" would
  // be counted twice, once as a month-year and once as its own year.
  if (points.length === 0) {
    const bareYear = /\b(19|20)\d{2}\b/g;
    while ((m = bareYear.exec(text)) !== null) {
      points.push(new Date(Number(m[0]), 0, 1));
    }
  }

  points.sort((a, b) => a - b);
  const start = points[0] || null;
  const end = ongoing ? now : (points[points.length - 1] || null);
  return { start, end, ongoing };
}

/** How many years ago this role ended. Ongoing roles are 0. Unknown is null. */
function roleAgeYears(period, now = new Date()) {
  const { end } = parsePeriod(period, now);
  if (!end) return null;
  return Math.max(0, (now - end) / (365.25 * 24 * 60 * 60 * 1000));
}

/** How long the role lasted, in months. Null when the period cannot be read. */
function roleDurationMonths(period, now = new Date()) {
  const { start, end } = parsePeriod(period, now);
  if (!start || !end) return null;
  return Math.max(0, (end - start) / (30.44 * 24 * 60 * 60 * 1000));
}

/**
 * Split a description into its bullets.
 *
 * Descriptions come back as one string. When the model emits real lines, the
 * lines are the bullets; when it emits running prose, each sentence is a bullet
 * on the rendered resume, so sentences are what get split.
 *
 * The variation checks (opening verbs, bullet lengths) read the bullets this
 * returns and the tapering check counts them, which is the point of it being
 * one function: a resume cannot have four bullets for the budget and three for
 * the repetition check.
 */
function splitBullets(description) {
  const text = String(description || '').trim();
  if (!text) return [];

  const lines = text
    .split('\n')
    .map((l) => l.replace(/^\s*[•\-*·]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;

  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/[^A-Za-z0-9]/g, '').length > 2);
}

/** How many bullets a description carries. */
function countBullets(description) {
  return splitBullets(description).length;
}

const DEFAULT_SELECTED_BULLETS = 5;

/**
 * The bullet allowance for one role.
 *
 * @param {Object} opts
 * @param {number} opts.recencyRank - 0 = most recent role, 1 = next, …
 * @param {number|null} opts.ageYears - years since the role ended
 * @param {number|null} opts.durationMonths
 * @param {boolean} opts.isOldest
 * @param {number} opts.selected - the user's bullet-count setting
 * @returns {{max: number, min: number, reason: string}}
 */
function bulletAllowance({ recencyRank, ageYears, durationMonths, isOldest, selected }) {
  const chosen = Math.max(1, Number(selected) || DEFAULT_SELECTED_BULLETS);

  // The two most recent roles are the ones being applied with. They get what the
  // candidate asked for, regardless of how long ago the resume's timeline runs.
  if (recencyRank < 2) {
    return { max: chosen, min: 1, reason: 'recent role — user\'s selected bullet count' };
  }

  const shortStint = durationMonths !== null && durationMonths < 12;
  if (isOldest || shortStint) {
    return {
      max: 2,
      min: 1,
      reason: shortStint ? 'short stint — 1-2 bullets' : 'oldest role — 1-2 bullets',
    };
  }

  if (ageYears !== null && ageYears > 4) {
    return { max: 3, min: 2, reason: 'older than 4 years — 2-3 bullets' };
  }

  return { max: chosen, min: 1, reason: 'mid-history role — up to the selected count' };
}

/**
 * Plan the whole experience list at once: recency ranks, ages, and the bullet
 * allowance each role gets. Used by the prompt builder to state the budget and
 * by the audit to check it was honoured.
 *
 * @param {Array} experience - entries with { title, company, period, description }
 * @param {Object} opts
 * @param {number} [opts.selected] - user's experienceLines setting
 * @param {Date} [opts.now]
 * @returns {Array<Object>} one plan entry per role, in the input's order
 */
function planRoleShapes(experience, { selected, now = new Date() } = {}) {
  const entries = Array.isArray(experience) ? experience : [];

  const withDates = entries.map((e, index) => {
    // Three shapes in circulation: the tailored draft uses `period`, some stored
    // profiles use `duration`, and the profile editor writes discrete
    // `startDate`/`endDate`/`current` fields. Missing dates are not an error —
    // the role simply gets the recency rank its position implies.
    const period =
      e.period ||
      e.duration ||
      [e.startDate, e.endDate || (e.current ? 'Present' : '')].filter(Boolean).join(' - ');
    return {
      index,
      title: e.title || '',
      company: e.company || '',
      period,
      ageYears: roleAgeYears(period, now),
      durationMonths: roleDurationMonths(period, now),
      bullets: countBullets(e.description),
    };
  });

  // Recency rank comes from the dates when they parse, and falls back to the
  // resume's own order (reverse-chronological by convention) when they do not.
  const ranked = [...withDates].sort((a, b) => {
    if (a.ageYears === null && b.ageYears === null) return a.index - b.index;
    if (a.ageYears === null) return 1;
    if (b.ageYears === null) return -1;
    return a.ageYears - b.ageYears;
  });
  ranked.forEach((r, rank) => { r.recencyRank = rank; });

  const oldestIndex = ranked.length ? ranked[ranked.length - 1].index : -1;

  return withDates.map((r) => ({
    ...r,
    location: `experience_${r.index + 1}${r.company ? ` (${r.company})` : ''}`,
    allowance: bulletAllowance({
      recencyRank: r.recencyRank,
      ageYears: r.ageYears,
      durationMonths: r.durationMonths,
      isOldest: r.index === oldestIndex && ranked.length > 2,
      selected,
    }),
  }));
}

module.exports = {
  parsePeriod,
  roleAgeYears,
  roleDurationMonths,
  splitBullets,
  countBullets,
  bulletAllowance,
  planRoleShapes,
  DEFAULT_SELECTED_BULLETS,
};
