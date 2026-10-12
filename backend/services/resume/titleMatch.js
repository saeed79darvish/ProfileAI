/**
 * Title comparison for the tailoring pipeline.
 *
 * Three passes (tailoring, review, enforcement) can each rewrite the resume's
 * `title`, and nothing used to measure whether the result still matched the
 * posting. A Staff Software Engineer posting shipped a resume titled Senior
 * Software Engineer: the band was silently substituted, every honesty check
 * passed (no bullet was fabricated), and the defect reached the candidate.
 *
 * The seniority band is the part that must never move. It is a different job,
 * a different pay scale and a different interview loop — not a synonym.
 */

/**
 * Seniority bands, most specific first. Order matters: "senior staff" must
 * resolve to `staff` rather than `senior`, so the compound entries are tested
 * before the bare ones.
 */
const BANDS = [
  { band: 'distinguished', re: /\bdistinguished\b/i },
  { band: 'fellow', re: /\bfellow\b/i },
  { band: 'senior-staff', re: /\bsenior[\s-]+staff\b/i },
  { band: 'senior-principal', re: /\bsenior[\s-]+principal\b/i },
  { band: 'principal', re: /\bprincipal\b/i },
  { band: 'staff', re: /\bstaff\b/i },
  { band: 'director', re: /\bdirector\b/i },
  { band: 'vp', re: /\b(?:vp|vice\s+president)\b/i },
  { band: 'head', re: /\bhead\s+of\b/i },
  { band: 'manager', re: /\bmanager\b/i },
  { band: 'lead', re: /\b(?:lead|leader)\b/i },
  { band: 'senior', re: /\b(?:senior|snr|sr\.?)\b/i },
  { band: 'mid', re: /\b(?:mid|intermediate|ii|iii)\b/i },
  { band: 'junior', re: /\b(?:junior|jr\.?|entry[\s-]+level)\b/i },
  { band: 'associate', re: /\bassociate\b/i },
  { band: 'intern', re: /\b(?:intern|internship|co-?op)\b/i },
];

/**
 * Reduce a title to a comparable form: case-folded, punctuation-flattened,
 * whitespace-collapsed. Deliberately does NOT strip the seniority band — the
 * band is the thing being compared.
 *
 * Job-board furniture that is not part of the role name is removed, because the
 * scraped header often carries it ("Staff Software Engineer - Easy Apply").
 */
function normalizeTitleForCompare(title) {
  return String(title || '')
    .toLowerCase()
    // Board furniture and scrape residue.
    .replace(/\b(?:easy apply|apply now|new|urgent(?:ly)? hiring|hiring|remote|hybrid|on-?site|full[\s-]?time|part[\s-]?time|contract|w2|c2c)\b/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The seniority band a title sits in, or null when it states none (a bare
 * "Software Engineer" genuinely has no band and must not be given one).
 */
function seniorityBand(title) {
  const text = String(title || '');
  for (const { band, re } of BANDS) {
    if (re.test(text)) return band;
  }
  return null;
}

/**
 * Compare the posting's title against whatever ended up on the resume.
 *
 * @param {string} target - the posting's title (authoritative)
 * @param {string} actual - the title on the tailored resume
 * @returns {{
 *   target: string|null, actual: string|null,
 *   normalizedEqual: boolean,
 *   targetBand: string|null, actualBand: string|null,
 *   bandMismatch: boolean,
 *   clean: boolean,
 *   detail: string|null
 * }}
 */
function compareTitles(target, actual) {
  const t = String(target || '').trim();
  const a = String(actual || '').trim();

  if (!t) {
    // Nothing to check against. Not a pass and not a failure — unmeasurable,
    // and saying so is more useful than reporting a green check.
    return {
      target: null,
      actual: a || null,
      normalizedEqual: false,
      targetBand: null,
      actualBand: seniorityBand(a),
      bandMismatch: false,
      clean: true,
      detail: 'No posting title supplied — title match could not be verified.',
    };
  }

  const normalizedEqual = normalizeTitleForCompare(t) === normalizeTitleForCompare(a);
  const targetBand = seniorityBand(t);
  const actualBand = seniorityBand(a);
  const bandMismatch = targetBand !== actualBand;

  let detail = null;
  if (bandMismatch) {
    detail =
      `Seniority band mismatch: posting is "${t}" (${targetBand || 'no band'}) ` +
      `but the resume says "${a || '(empty)'}" (${actualBand || 'no band'}).`;
  } else if (!normalizedEqual) {
    detail = `Title wording differs from the posting: "${a || '(empty)'}" vs "${t}".`;
  }

  return {
    target: t,
    actual: a || null,
    normalizedEqual,
    targetBand,
    actualBand,
    bandMismatch,
    clean: normalizedEqual && !bandMismatch,
    detail,
  };
}

module.exports = { normalizeTitleForCompare, seniorityBand, compareTitles };
