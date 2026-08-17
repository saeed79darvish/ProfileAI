/**
 * Line-Wrap And Hyphen Artifact Repair
 *
 * "componentdriven" and "crossfunctional" have shipped in tailored output
 * across multiple versions. The cause is not the model: pdf-parse emits a
 * hyphenated compound broken across a line as either a soft hyphen (U+00AD)
 * that later gets dropped, or a typographic hyphen (U+2010/U+2011) that no
 * downstream regex recognises. The compound arrives at the model ALREADY
 * joined, so the model faithfully reproduces the damage and every "check your
 * spelling" instruction in the prompt is aimed at the wrong stage.
 *
 * So this module works at both ends:
 *   1. repairWrappedHyphens() runs on INGEST, before the text ever reaches a
 *      prompt, and puts the hyphen back.
 *   2. findJoinedCompounds() runs on the FINISHED DRAFT as a deterministic
 *      scan, because generic "no typos" instructions have failed twice and a
 *      dictionary lookup cannot fail the same way.
 */

/**
 * Compounds that recur in resumes and must never appear joined. Stored in
 * canonical hyphenated form; the scanner derives the broken form from these,
 * so adding an entry here is all that is needed to cover a new compound.
 *
 * Entries are limited to compounds whose JOINED form is not itself a word.
 * "front-end" and "real-time" are deliberately absent: "frontend" and
 * "realtime" are ordinary spellings, and a scanner that rewrites them turns a
 * candidate's own style into a defect report. See ACCEPTED_JOINED_FORMS.
 */
const CANONICAL_COMPOUNDS = [
  'component-driven', 'cross-functional', 'end-to-end', 'data-driven',
  'user-facing', 'high-performance', 'test-driven', 'event-driven',
  'domain-driven', 'mission-critical', 'decision-making', 'problem-solving',
  'server-side', 'client-side', 'single-page', 'go-to-market',
  'day-to-day', 'self-service', 'third-party', 'well-tested',
  'peer-reviewed', 'customer-facing', 'production-ready', 'pixel-perfect',
  'first-party', 'role-based', 'feature-flagged', 'cost-effective',
  'time-to-market', 'up-to-date', 'stakeholder-facing',
];

/**
 * Joined spellings that are legitimate English or legitimate industry usage.
 * Never "repaired", no matter what turns up in the harvested vocabulary — a
 * candidate who writes "frontend" throughout has made a style choice, and
 * rewriting it is not a fix.
 */
const ACCEPTED_JOINED_FORMS = new Set([
  'frontend', 'backend', 'fullstack', 'realtime', 'opensource', 'multitenant',
  'microfrontend', 'microservice', 'microservices', 'typesafe', 'inhouse',
  'handson', 'designsystem', 'checkout', 'runtime', 'lifecycle', 'onboarding',
  'oncall', 'website', 'codebase', 'workflow', 'toolchain', 'timeline',
  'stakeholder', 'dataset', 'datasets', 'endpoint', 'endpoints', 'roadmap',
]);

/** All hyphen-like characters a PDF may emit where a plain "-" was intended. */
const HYPHEN_CLASS = '[--­‐‑‒–]';

/**
 * Repair hyphenated compounds that a PDF extractor broke across lines.
 *
 * Three distinct damage patterns, in the order they must be handled:
 *   "component-\ndriven"  the hyphen survived the wrap  -> rejoin, keep hyphen
 *   "component­driven"  soft hyphen, invisible     -> replace with hyphen
 *   "component‐driven"  typographic hyphen         -> normalise to ASCII
 *
 * Deliberately conservative: it only rejoins when the wrap lands between two
 * lowercase letter runs. "Engineer -\nBuilt X" and "2021-\n2023" are left
 * alone, because rejoining those would corrupt a real line break.
 *
 * @param {string} text - Raw extracted resume text
 * @returns {string} Text with wrap artifacts repaired
 */
function repairWrappedHyphens(text) {
  if (typeof text !== 'string' || !text) return text;

  return text
    // Typographic and non-breaking hyphens become ASCII so every later regex
    // (here and in the audit) sees one character instead of five.
    .replace(/[‐‑]/g, '-')
    // A soft hyphen BETWEEN letters was a hyphenation point: make it visible.
    .replace(/([a-z])­([a-z])/gi, '$1-$2')
    // Any remaining soft hyphen is layout noise with no semantic value.
    .replace(/­/g, '')
    // Hyphen at end of line followed by a lowercase continuation: rejoin.
    .replace(new RegExp(`([a-z])${HYPHEN_CLASS}[ \\t]*\\r?\\n[ \\t]*([a-z])`, 'g'), '$1-$2');
}

/**
 * Build the lookup used by findJoinedCompounds. Maps the damaged (joined) form
 * to its canonical form: "componentdriven" -> "component-driven".
 *
 * @param {string[]} extraCompounds - Compounds harvested from the original
 *   resume, so a candidate's own vocabulary is covered without editing the
 *   built-in list.
 */
function buildCompoundIndex(extraCompounds = [], sourceText = '') {
  const index = new Map();
  const source = String(sourceText || '').toLowerCase();
  for (const compound of [...CANONICAL_COMPOUNDS, ...extraCompounds]) {
    const canonical = String(compound).toLowerCase().trim();
    if (!canonical.includes('-')) continue;
    const joined = canonical.replace(/-/g, '');
    // Two-letter fragments ("e-2-e") produce joins too short to match safely.
    if (joined.length < 8) continue;
    if (ACCEPTED_JOINED_FORMS.has(joined)) continue;
    // If the ORIGINAL itself writes the joined form, that is the candidate's
    // own spelling, not wrap damage. Repairing it would edit their voice.
    if (source && new RegExp(`\\b${joined}\\b`, 'i').test(source)) continue;
    if (!index.has(joined)) index.set(joined, canonical);
  }
  return index;
}

/**
 * Harvest hyphenated compounds from the candidate's own source text so the
 * scan covers vocabulary the built-in list never anticipated.
 *
 * @param {string} sourceText - The ORIGINAL resume text
 * @returns {string[]} Hyphenated compounds found in the source
 */
function harvestCompounds(sourceText) {
  if (typeof sourceText !== 'string') return [];
  const found = new Set();
  const re = /\b([a-z]{3,})-([a-z]{3,})(?:-([a-z]{2,}))?\b/gi;
  let m;
  while ((m = re.exec(sourceText)) !== null) {
    found.add(m[0].toLowerCase());
  }
  return [...found];
}

/**
 * Scan finished resume text for compounds that lost their hyphen.
 *
 * @param {string} text - Resume-facing text to scan
 * @param {string[]} extraCompounds - From harvestCompounds(originalResumeText)
 * @returns {Array<{found: string, suggested: string}>}
 */
function findJoinedCompounds(text, extraCompounds = [], sourceText = '') {
  if (typeof text !== 'string' || !text) return [];
  const index = buildCompoundIndex(extraCompounds, sourceText);
  const hits = [];
  for (const [joined, canonical] of index) {
    const re = new RegExp(`\\b${joined}\\b`, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      hits.push({ found: m[0], suggested: matchCase(m[0], canonical) });
    }
  }
  return hits;
}

/**
 * Deterministically repair joined compounds in finished text. Used as the
 * last-resort fix when the review pass leaves one behind: a dictionary
 * substitution cannot introduce a new claim, so it is safe to apply without
 * asking the candidate.
 */
function repairJoinedCompounds(text, extraCompounds = [], sourceText = '') {
  if (typeof text !== 'string' || !text) return text;
  const index = buildCompoundIndex(extraCompounds, sourceText);
  let out = text;
  for (const [joined, canonical] of index) {
    out = out.replace(new RegExp(`\\b${joined}\\b`, 'gi'), (m) => matchCase(m, canonical));
  }
  return out;
}

/** Preserve the casing of the damaged token when substituting the fix. */
function matchCase(original, replacement) {
  if (original === original.toUpperCase() && /[A-Z]{2,}/.test(original)) {
    return replacement.toUpperCase();
  }
  if (/^[A-Z]/.test(original)) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

module.exports = {
  repairWrappedHyphens,
  harvestCompounds,
  findJoinedCompounds,
  repairJoinedCompounds,
  CANONICAL_COMPOUNDS,
  ACCEPTED_JOINED_FORMS,
};
