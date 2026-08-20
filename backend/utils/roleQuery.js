/**
 * Turn a candidate's profile title/headline into a short role query.
 *
 * Ported from frontend/src/pages/CandidateJobs/index.jsx, which had the only
 * copy. Two consumers now need it on the server:
 *
 *   - The daily digest, so the email can pool jobs by the candidate's ROLE
 *     instead of by global recency (see jobDigestService.buildMatchesForProfile).
 *   - GET /external-jobs, so the list request no longer has to wait for the
 *     browser to fetch the profile, derive a role, and only then ask for jobs.
 *
 * The frontend copy still exists and still owns the "what goes in the search
 * box" decision; this is the same reduction applied server-side. Keep the two
 * in sync — a divergence shows up as the email and the page disagreeing about
 * what the candidate does, which is exactly the class of bug this file exists
 * to stop.
 */

const SENIORITY_WORD_RE = /^(?:senior|sr\.?|junior|jr\.?|staff|principal|chief|head|entry|mid|associate|intern|interim|lead|vp|vice|president|deputy|assistant|level)$/i;
// Filler that appears in a person's title but rarely in the postings they want
// ("Frontend Software Engineer" should still match a "Frontend Engineer" role).
const ROLE_FILLER_RE = /^(?:full[-\s]?stack|fullstack|software|web|technical|technology|digital|global|of|the|and|for|i{1,3}|iv|v)$/i;
// Nouns that name a role family. Used to locate the anchor token when a title
// is long enough that we have to drop something.
const ROLE_FAMILY_WORDS = new Set([
  'engineer', 'engineering', 'developer', 'programmer', 'architect', 'scientist',
  'analyst', 'designer', 'manager', 'director', 'consultant', 'specialist',
  'administrator', 'researcher', 'recruiter', 'marketer', 'writer', 'strategist',
  'accountant', 'technician', 'nurse', 'teacher', 'producer', 'editor', 'planner',
]);

/**
 * @param {string} rawTitle - profile.title or profile.headline
 * @returns {string} a 1-3 word role query, or '' when nothing usable survives
 */
function deriveRoleQuery(rawTitle) {
  const text = String(rawTitle || '').trim();
  if (!text) return '';

  // Employer / location clause: " at Equinix", " @ Stripe", " | Acme",
  // " - Acme", " , Acme". Also drop parenthetical asides like "(Contract)".
  const head = text.split(/\s+(?:at|@|\||·|•|—|–)\s+|\s*,\s+|\s+-\s+/i)[0]
    .replace(/[([{].*?[)\]}]/g, ' ');

  const tokens = head
    .split(/[\s/]+/)
    .map((t) => t.replace(/[^A-Za-z0-9+#.-]/g, '').replace(/^[.-]+|[.-]+$/g, ''))
    .filter(Boolean);

  // Seniority always goes. Filler only goes while at least two words remain —
  // "Frontend Software Engineer" should shed "Software", but "Staff Software
  // Engineer" must not be reduced all the way to a bare "Engineer".
  const meaningful = tokens.filter((t) => !SENIORITY_WORD_RE.test(t));
  for (let i = meaningful.length - 1; i >= 0 && meaningful.length > 2; i--) {
    if (ROLE_FILLER_RE.test(meaningful[i])) meaningful.splice(i, 1);
  }
  if (meaningful.length === 0) return '';
  if (meaningful.length <= 3) return meaningful.join(' ').slice(0, 80);

  let familyIdx = -1;
  for (let i = meaningful.length - 1; i >= 0; i--) {
    if (ROLE_FAMILY_WORDS.has(meaningful[i].toLowerCase())) { familyIdx = i; break; }
  }
  if (familyIdx <= 0) return meaningful.slice(0, 2).join(' ').slice(0, 80);
  return `${meaningful[0]} ${meaningful[familyIdx]}`.slice(0, 80);
}

/**
 * Tokens that carry no role identity on their own.
 *
 * Used to weight title matching (see jobRelevanceService.scoreJob). A profile
 * titled "Senior Frontend Full-Stack Software Engineer" shares
 * senior/software/engineer with an enormous share of the corpus — those words
 * say "a technical individual contributor", which is not enough to call
 * something a match. "Frontend" is the word that identifies the role, and an
 * unweighted token count cannot tell the difference between the two kinds.
 */
const GENERIC_TITLE_TOKENS = new Set([
  // seniority
  'senior', 'sr', 'junior', 'jr', 'staff', 'principal', 'chief', 'head', 'entry',
  'mid', 'associate', 'intern', 'interim', 'lead', 'vp', 'vice', 'president',
  'deputy', 'assistant', 'level', 'i', 'ii', 'iii', 'iv',
  // role family / generic craft words
  'engineer', 'engineering', 'developer', 'development', 'programmer', 'manager',
  'specialist', 'analyst', 'consultant', 'coordinator', 'administrator', 'officer',
  // generic qualifiers
  'software', 'technical', 'technology', 'digital', 'global', 'general',
  'full', 'stack', 'fullstack', 'fullstack', 'web',
  // connectives
  'of', 'the', 'and', 'for', 'a', 'an', 'in', 'to', 'with',
]);

/**
 * Split a title into (specialty, generic) token sets.
 * Specialty tokens are what actually identify a role.
 */
function splitTitleTokens(title) {
  const toks = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/[\s/-]+/)
    .map((t) => t.replace(/^[.]+|[.]+$/g, ''))
    .filter((t) => t.length > 1);
  const specialty = [];
  const generic = [];
  for (const t of toks) {
    if (GENERIC_TITLE_TOKENS.has(t)) generic.push(t);
    else specialty.push(t);
  }
  return { specialty: [...new Set(specialty)], generic: [...new Set(generic)] };
}

module.exports = { deriveRoleQuery, splitTitleTokens, GENERIC_TITLE_TOKENS };
