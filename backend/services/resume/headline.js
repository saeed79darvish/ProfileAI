/**
 * The headline a tailored resume carries.
 *
 * The rule used to be: copy the posting's title. That is right for a common
 * title and wrong for the rest. A "Staff Design Technologist" posting turned a
 * Staff Software Engineer's resume into one headed "Staff Design Technologist",
 * a job the candidate has never held, and a recruiter who compares the headline
 * with the experience below it sees the mismatch in the first second.
 *
 * So the candidate's own title is the main thing and the posting only moves it
 * when that is safe and recognisable:
 *
 *   mirror   the posting names a seniority band the candidate has reached, in a
 *            common role family they fit ("Senior Frontend Engineer"): use the
 *            posting's wording, which is also what an ATS matches on.
 *   keep     anything else: an uncommon title, a band above the candidate's, or
 *            a posting with no band. The candidate's own title stays, with at
 *            most two focus terms from the posting that the profile supports
 *            ("Staff Software Engineer, Frontend Platform | Design Systems").
 *
 * A band the candidate has not held is never claimed. Deterministic: no model
 * is asked, so no pass can drift the result.
 */

const { headlineFromPostingTitle, seniorityBand } = require('./titleMatch');

/** Rank of each band; a posting above the candidate's rank is never mirrored. */
const RANK = {
  intern: 0, junior: 1, associate: 1, mid: 2, senior: 3, lead: 4,
  staff: 5, 'senior-staff': 6, principal: 6, 'senior-principal': 7, distinguished: 8, fellow: 8,
};
/** Bands that name a different kind of job (management), not a level of the same one. */
const MANAGEMENT = new Set(['manager', 'director', 'vp', 'head']);
const BAND_WORD = {
  intern: 'Intern', junior: 'Junior', associate: 'Associate', mid: '', senior: 'Senior', lead: 'Lead',
  staff: 'Staff', 'senior-staff': 'Senior Staff', principal: 'Principal', 'senior-principal': 'Senior Principal',
};

const BAND_TEXT_RE = /\b(?:distinguished|fellow|senior[\s-]+staff|senior[\s-]+principal|principal|staff|lead|leader|senior|snr|sr\.?|mid|intermediate|junior|jr\.?|entry[\s-]+level|associate|intern|internship|co-?op)\b/gi;
const LEVEL_SUFFIX_RE = /\s+(?:i{1,3}|iv|v|\d{1,2})$/i;

/** Role families recruiters and applicant tracking systems recognise at a glance. */
const COMMON_DISCIPLINE_RE = new RegExp(
  '^(?:(?:software|frontend|front[\\s-]end|backend|back[\\s-]end|full[\\s-]?stack|web|ui|ux|mobile|ios|android|data|machine learning|ml|ai|devops|site reliability|sre|platform|infrastructure|cloud|security|qa|test|quality|embedded|firmware|systems|application|solutions|sales|support|release|build|network|database|analytics|research|applied)\\s+)*' +
  '(?:engineer|developer|programmer|architect|scientist|analyst)$',
  'i'
);

const ENGINEER_NOUN_RE = /\b(?:engineer|developer|programmer|architect)\b/i;
const OTHER_NOUN_RE = /\b(?:scientist|analyst|designer|manager|researcher|consultant|specialist)\b/i;

const stem = (t) => String(t || '').toLowerCase().replace(/front[\s-]end/g, 'frontend').replace(/back[\s-]end/g, 'backend').replace(/[^a-z0-9+#]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The candidate's own band: their stated title first, else the highest they have held. */
function candidateBand(candidateTitle, heldTitles) {
  const own = seniorityBand(candidateTitle);
  if (own && !MANAGEMENT.has(own)) return own;
  let best = null;
  for (const t of heldTitles || []) {
    const b = seniorityBand(t);
    if (b && RANK[b] !== undefined && (best === null || RANK[b] > RANK[best])) best = b;
  }
  return best;
}

/** Does the posting's discipline fit what the candidate actually is? */
function fitsCandidate(discipline, candidateTitle, heldTitles, skills) {
  const titles = [candidateTitle, ...(heldTitles || [])].filter(Boolean).join(' ');
  const noun = (discipline.match(OTHER_NOUN_RE) || [])[0];
  if (noun && !new RegExp(`\\b${noun}\\b`, 'i').test(titles)) return false; // a different profession
  if (!noun && !ENGINEER_NOUN_RE.test(titles) && titles) return false;
  const have = stem(`${titles} ${(skills || []).join(' ')}`);
  const generic = new Set(['engineer', 'developer', 'programmer', 'architect', 'scientist', 'analyst', 'software', 'senior', 'staff']);
  const key = stem(discipline).split(' ').filter((w) => w && !generic.has(w));
  return key.every((w) => have.includes(w));
}

const titleCase = (t) => String(t || '').replace(/\b([a-z])([a-z]*)/g, (m, a, b) => (b.length <= 1 && /^(?:ui|ux|ai|ml|qa|ci|cd)$/i.test(a + b) ? (a + b).toUpperCase() : a.toUpperCase() + b));

/**
 * Up to two terms from the posting that the profile genuinely supports and the
 * candidate's own title does not already say.
 */
function focusTerms(keywords, sourceText, candidateTitle, max = 2) {
  const source = stem(sourceText);
  const own = stem(candidateTitle);
  const out = [];
  for (const k of keywords || []) {
    const term = String(k || '').trim();
    if (!term || term.split(/\s+/).length > 4) continue;
    const s = stem(term);
    if (!s || own.includes(s) || out.some((o) => stem(o) === s)) continue;
    if (/^(?:react|javascript|typescript|html|css|css3|html5|node|nodejs|git|aws)\b/.test(s) && s.split(' ').length === 1) continue; // stack words say little in a headline
    if (!source.includes(s)) continue;
    out.push(/[A-Z]/.test(term) ? term : titleCase(term));
    if (out.length >= max) break;
  }
  return out;
}

/**
 * @param {Object} o
 * @param {string} o.postingTitle     the posting's title as the board or JD gives it
 * @param {string} o.candidateTitle   the candidate's own stored headline
 * @param {string[]} [o.heldTitles]   titles from their experience
 * @param {string[]} [o.skills]       their skills
 * @param {string[]} [o.keywords]     the posting's required keywords, in its order
 * @param {string} [o.sourceText]     everything the candidate's resume says
 * @returns {{ headline: string, mode: 'mirror'|'keep'|'posting', detail: string }}
 */
function resolveHeadline({ postingTitle, candidateTitle, heldTitles = [], skills = [], keywords = [], sourceText = '' }) {
  const own = String(candidateTitle || '').replace(/\s+/g, ' ').trim() || String(heldTitles[0] || '').trim();
  const posting = headlineFromPostingTitle(postingTitle);
  if (!own) {
    // Nothing of the candidate's own to keep: the posting's role is all there is.
    return { headline: posting, mode: 'posting', detail: 'No title on your profile, so the posting\'s role is used.' };
  }
  if (!posting) return { headline: own, mode: 'keep', detail: 'Kept your own title.' };

  const postBand = seniorityBand(posting);
  const candBand = candidateBand(own, heldTitles);
  const discipline = posting.replace(BAND_TEXT_RE, ' ').replace(/\s+/g, ' ').trim().replace(LEVEL_SUFFIX_RE, '').trim();
  const common = COMMON_DISCIPLINE_RE.test(discipline);
  const fits = common && fitsCandidate(discipline, own, heldTitles, skills);
  const postRank = postBand ? RANK[postBand] : undefined;
  const candRank = candBand ? RANK[candBand] : undefined;

  const mirrorable = fits && postBand && !MANAGEMENT.has(postBand) && postRank !== undefined && candRank !== undefined && postRank <= candRank;
  if (mirrorable) {
    const word = BAND_WORD[postBand];
    const headline = `${word ? `${word} ` : ''}${titleCase(discipline)}`.trim();
    return { headline, mode: 'mirror', detail: `Headline follows the posting's role, "${headline}", which is at or below your own level.` };
  }

  // A focus is added only where the posting's title could not be used because it
  // is unusual or a different kind of role: that is when the headline needs help
  // to read as close to the job. A common title above the candidate's level, or
  // with no level, already names their own discipline.
  const focus = !common || !fits ? focusTerms(keywords, sourceText || `${skills.join(' ')}`, own) : [];
  let headline = own;
  if (focus.length) {
    headline = `${own} | ${focus.join(', ')}`;
    if (headline.length > 80) headline = `${own} | ${focus[0]}`;
    if (headline.length > 80) headline = own;
  }
  const why = !common ? `"${posting}" is not a common title, so your own title stays`
    : !fits ? `"${posting}" is a different kind of role from yours, so your own title stays`
      : !postBand ? 'the posting states no level, so your own title stays'
        : 'the posting is above the level on your resume, so your own title stays';
  return { headline, mode: 'keep', detail: `Kept your own title (${why})${headline !== own ? `, with ${focus.join(' and ')} from the posting` : ''}.` };
}

module.exports = { resolveHeadline, focusTerms, candidateBand };
