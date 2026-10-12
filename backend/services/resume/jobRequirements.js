/**
 * The posting's SUBSTANTIVE requirements — the ones that are not tool names.
 *
 * Keyword extraction only ever produced short skill nouns, because the filter
 * it ran through (`isValidSkill`) rejects anything over six words and anything
 * mentioning years. That is correct for a skills list and catastrophic as the
 * pipeline's only reading of a posting: "8+ years building distributed
 * systems", "own the architecture of a multi-team platform" and "mentor senior
 * engineers" were all discarded as malformed skill names.
 *
 * Those are precisely the lines that separate a Staff posting from a Senior
 * one, and with them gone the prompt, the coverage audit and the gap report all
 * reasoned about a posting as if it were a list of technologies. Tailoring a
 * resume to the tools and ignoring the scope is how you produce something that
 * passes a keyword scan and reads wrong to a recruiter.
 */

/** Boilerplate that is never a requirement, however the posting phrases it. */
const BOILERPLATE_RE = new RegExp(
  [
    'equal opportunity',
    '\\be\\.?e\\.?o\\.?\\b',
    'affirmative action',
    'reasonable accommodation',
    '\\bbenefits?\\b',
    '\\bperks?\\b',
    '401\\(?k\\)?',
    'health insurance',
    'dental',
    'vision care',
    'paid time off',
    '\\bpto\\b',
    'salary range',
    'compensation range',
    'pay range',
    'base salary',
    '\\bbonus\\b',
    'stock options',
    'about (?:us|the company|our team)',
    'our mission',
    'why join',
    'apply now',
    'background check',
    'drug screen',
    'visa sponsorship is not',
  ].join('|'),
  'i'
);

/**
 * Is this a usable requirement?
 *
 * Deliberately permissive about shape — a requirement is a phrase, not a noun —
 * and strict only about the two things that make an entry useless: being
 * boilerplate, and being too long to be one requirement.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidRequirement(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (text.length < 8) return false;
  // One requirement, not a pasted paragraph. 200 chars is roughly 30 words.
  if (text.length > 200) return false;
  const words = text.split(/\s+/).length;
  if (words < 2 || words > 30) return false;
  if (BOILERPLATE_RE.test(text)) return false;
  return true;
}

/** Normalised form for de-duplicating requirements against each other. */
function normalizeRequirement(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALLOWED_STATUSES = new Set(['demonstrated', 'partial', 'missing']);

/**
 * Reconcile the model's self-reported requirement coverage with the
 * requirements we asked about.
 *
 * Two failure modes are corrected here rather than trusted:
 *
 *   1. A requirement the model simply did not mention. Silence is not evidence
 *      of coverage, so an unreported requirement is recorded as `unassessed`
 *      and travels to the candidate — the alternative is a gap report that
 *      looks complete because the model stopped early.
 *   2. A status outside the three allowed values, or an entry for a
 *      requirement nobody asked about. Both are dropped.
 *
 * @param {string[]} requirements - what we asked the model to assess
 * @param {Array<{requirement?: string, status?: string, evidence?: string}>} reported
 * @returns {{
 *   coverage: Array<{requirement: string, status: string, evidence: string|null}>,
 *   unmet: Array<{requirement: string, status: string, evidence: string|null}>,
 *   demonstratedCount: number,
 *   total: number
 * }}
 */
function reconcileRequirementCoverage(requirements, reported) {
  const asked = (Array.isArray(requirements) ? requirements : []).filter(isValidRequirement);
  const byKey = new Map();
  for (const r of Array.isArray(reported) ? reported : []) {
    const name = typeof r === 'string' ? r : r && r.requirement;
    if (!name) continue;
    const key = normalizeRequirement(name);
    if (!key) continue;
    const status = String((r && r.status) || '').toLowerCase().trim();
    byKey.set(key, {
      status: ALLOWED_STATUSES.has(status) ? status : 'unassessed',
      evidence: (r && typeof r.evidence === 'string' && r.evidence.trim()) || null,
    });
  }

  const coverage = [];
  const seen = new Set();
  for (const requirement of asked) {
    const key = normalizeRequirement(requirement);
    if (seen.has(key)) continue;
    seen.add(key);
    const hit = byKey.get(key);
    coverage.push({
      requirement,
      status: hit ? hit.status : 'unassessed',
      evidence: hit ? hit.evidence : null,
    });
  }

  return {
    coverage,
    unmet: coverage.filter((c) => c.status !== 'demonstrated'),
    demonstratedCount: coverage.filter((c) => c.status === 'demonstrated').length,
    total: coverage.length,
  };
}

/** The note shown beside an unmet requirement in the gap report. */
function requirementGapNote(status) {
  if (status === 'partial') {
    return 'Only partially demonstrated by the resume — address the rest in the cover letter.';
  }
  if (status === 'unassessed') {
    return 'Not assessed against your resume — check this one yourself before submitting.';
  }
  return 'The resume does not demonstrate this requirement.';
}

module.exports = {
  isValidRequirement,
  normalizeRequirement,
  reconcileRequirementCoverage,
  requirementGapNote,
  BOILERPLATE_RE,
};
