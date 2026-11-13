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
 *   mirror   the posting names a level the candidate has reached, in a role they
 *            actually are, in any profession ("Senior Frontend Engineer",
 *            "Senior Accountant"): use the posting's wording, which is also what
 *            an ATS matches on.
 *   keep     anything else: a role that is not on their resume, a level above
 *            theirs, a management/individual-contributor switch, or a posting
 *            with no level. The candidate's own title stays, with at
 *            most two focus terms from the posting that the profile supports
 *            ("Staff Software Engineer, Frontend Platform | Design Systems").
 *
 * A band the candidate has not held is never claimed. Deterministic: no model
 * is asked, so no pass can drift the result.
 */

const { headlineFromPostingTitle } = require('./titleMatch');

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

/** Words that describe level or scope, not the profession. */
const GENERIC_WORDS = new Set([
  'software', 'web', 'application', 'applications', 'senior', 'sr', 'staff', 'lead', 'principal', 'associate',
  'junior', 'jr', 'mid', 'the', 'of', 'and', 'for', 'in', 'a', 'an', 'to', 'at',
]);
/** Nouns that are the same profession under different names. */
const ENGINEER_FAMILY = new Set(['engineer', 'developer', 'programmer', 'architect']);

const stem = (t) => String(t || '').toLowerCase().replace(/front[\s-]end/g, 'frontend').replace(/back[\s-]end/g, 'backend').replace(/[^a-z0-9+#]+/g, ' ').replace(/\s+/g, ' ').trim();
const singular = (w) => String(w || '').replace(/(?:ies)$/, 'y').replace(/(?:ses|xes|ches|shes)$/, (m) => m.slice(0, -2)).replace(/s$/, '');

/** Management is a different kind of job, not a level of an individual-contributor one. */
const mgmtOf = (t) => (/\b(?:director|vp|vice president|head of)\b/i.test(t) ? 'exec' : /\bmanager\b/i.test(t) ? 'manager' : null);

/** The level word in a title, ignoring management nouns ("Senior Marketing Manager" is senior). */
const LEVEL_ORDER = [
  ['distinguished', /\bdistinguished\b/i], ['fellow', /\bfellow\b/i], ['senior-staff', /\bsenior[\s-]+staff\b/i],
  ['senior-principal', /\bsenior[\s-]+principal\b/i], ['principal', /\bprincipal\b/i], ['staff', /\bstaff\b/i],
  ['lead', /\b(?:lead|leader)\b/i], ['senior', /\b(?:senior|snr|sr\.?)\b/i], ['mid', /\b(?:mid|intermediate)\b/i],
  ['junior', /\b(?:junior|jr\.?|entry[\s-]+level)\b/i], ['associate', /\bassociate\b/i], ['intern', /\b(?:intern|internship|co-?op)\b/i],
];
const levelOf = (t) => { for (const [band, re] of LEVEL_ORDER) if (re.test(String(t || ''))) return band; return null; };

/** The candidate's own level: their stated title first, else the highest they have held. */
function candidateLevel(candidateTitle, heldTitles) {
  const own = levelOf(candidateTitle);
  if (own) return own;
  let best = null;
  for (const t of heldTitles || []) {
    const b = levelOf(t);
    if (b && (best === null || RANK[b] > RANK[best])) best = b;
  }
  return best;
}

/**
 * Is the posting's role something this candidate IS, in any profession? The
 * head noun must be one of theirs ("Accountant", "Nurse", "Engineer") and every
 * other distinguishing word must already appear in their titles or skills. A
 * "Design Technologist" posting fails for a software engineer because
 * "technologist" is not a role on their resume; "Charge Nurse" fails for a
 * registered nurse because "charge" is not in their history.
 */
function fitsCandidate(discipline, candidateTitle, heldTitles, skills) {
  const tokens = stem(discipline).split(' ').filter(Boolean);
  if (!tokens.length) return false;
  const head = tokens[tokens.length - 1];
  const titles = stem([candidateTitle, ...(heldTitles || [])].filter(Boolean).join(' '));
  if (!titles) return false;
  const titleWords = titles.split(' ').map(singular);
  const headOk = ENGINEER_FAMILY.has(head)
    ? [...ENGINEER_FAMILY].some((n) => titleWords.includes(n))
    : titleWords.includes(singular(head));
  if (!headOk) return false;
  const have = ` ${titles} ${stem((skills || []).join(' '))} `;
  return tokens.slice(0, -1).filter((w) => !GENERIC_WORDS.has(w)).every((w) => have.includes(` ${w}`) || have.includes(w));
}

const titleCase = (t) => String(t || '').replace(/\b([a-z])([a-z]*)/g, (m, a, b) => (b.length <= 1 && /^(?:ui|ux|ai|ml|qa|ci|cd)$/i.test(a + b) ? (a + b).toUpperCase() : a.toUpperCase() + b));

/** Tools and stack names: they say little in a headline and are already in Skills. */
const TOOL_RE = /^(?:react(?: js)?|reactjs|javascript|typescript|js|ts|html5?|css3?|sass|scss|node(?: js)?|nodejs|express|git|github|aws|aws lambda|api gateway|docker|kubernetes|graphql|redux|jest|enzyme|next(?: js)?|nextjs|vue(?: js)?|angular|bootstrap|material ui|reactstrap|mongodb|mysql|postgres(?:ql)?|python|java|go|sql|rest|api|apis|figma|npm|webpack|vite|videojs)$/;
/** Ways of working: true of everyone, so never a focus. */
const PRACTICE_RE = /^(?:code reviews?|git and code reviews?|testing|testing and debugging|debugging|documentation|teamwork|problem solving|agile|scrum)$|\b(?:leadership|mentor\w*|collaborat\w*|communicat\w*|ownership)\b/;

/**
 * Up to two specialties for the headline of a posting whose own title cannot be
 * used. They come from the candidate's OWN skills, so every one is theirs, and
 * are ranked by how much the posting talks about them ("Design Systems" for a
 * posting that mentions design systems six times). Tools and ways of working
 * are never chosen. When the profile lists no skills, the posting's keywords
 * stand in, held to the same support and filter rules.
 */
function focusTerms({ skills = [], keywords = [], jobDescription = '', sourceText = '', evidenceText = null, candidateTitle = '', max = 2 }) {
  // A specialty in the headline promises evidence below it, so it must appear in
  // the experience itself, not only in a skills list.
  const evidence = stem(evidenceText === null ? '' : evidenceText);
  const evidenced = (term) => evidenceText === null || evidence.includes(stem(term).replace(/s$/, ''));
  const jd = stem(jobDescription);
  const own = stem(candidateTitle);
  const usable = (term) => {
    const t = String(term || '').trim();
    const st = stem(t);
    // A specialty reads as a phrase ("design systems", "wound care", "revenue
    // recognition"). A single word is almost always a tool or a credential
    // (Excel, Salesforce, Epic, ACLS), which belongs in Skills, not the headline.
    if (!t || !st || t.split(/\s+/).length < 2 || t.split(/\s+/).length > 4) return false;
    return !TOOL_RE.test(st) && !PRACTICE_RE.test(st) && !own.includes(st);
  };
  const count = (term) => {
    const key = stem(term).replace(/s$/, '');
    return key ? jd.split(key).length - 1 : 0;
  };
  const display = (t) => (/[A-Z]/.test(t) ? t : titleCase(t));
  const picked = [];
  const take = (term) => { if (!picked.some((p) => stem(p) === stem(term))) picked.push(display(String(term).trim())); };

  const own_ = [...new Set((skills || []).map((x) => String(x).trim()).filter(Boolean))]
    .filter((t) => usable(t) && evidenced(t))
    .map((t, i) => ({ t, i, c: count(t) }))
    .filter((x) => x.c > 0)
    .sort((a, b) => b.c - a.c || a.i - b.i);
  own_.slice(0, max).forEach((x) => take(x.t));

  if (!picked.length) {
    const source = stem(sourceText);
    for (const k of keywords || []) {
      if (picked.length >= max) break;
      if (usable(k) && evidenced(k) && source.includes(stem(k))) take(k);
    }
  }
  return picked.slice(0, max);
}

/**
 * @param {Object} o
 * @param {string} o.postingTitle     the posting's title as the board or JD gives it
 * @param {string} o.candidateTitle   the candidate's own stored headline
 * @param {string[]} [o.heldTitles]   titles from their experience
 * @param {string[]} [o.skills]       their skills
 * @param {string[]} [o.keywords]     the posting's required keywords, in its order
 * @param {string} [o.jobDescription] the posting text, used to rank the candidate's own skills
 * @param {string} [o.sourceText]     everything the candidate's resume says
 * @param {string} [o.evidenceText]   the experience bullets; when given, a focus must appear in them
 * @returns {{ headline: string, mode: 'mirror'|'keep'|'posting', detail: string }}
 */
function resolveHeadline({ postingTitle, candidateTitle, heldTitles = [], skills = [], keywords = [], sourceText = '', evidenceText = null, jobDescription = '' }) {
  const own = String(candidateTitle || '').replace(/\s+/g, ' ').trim() || String(heldTitles[0] || '').trim();
  const posting = headlineFromPostingTitle(postingTitle);
  if (!own) {
    // Nothing of the candidate's own to keep: the posting's role is all there is.
    return { headline: posting, mode: 'posting', detail: 'No title on your profile, so the posting\'s role is used.' };
  }
  if (!posting) return { headline: own, mode: 'keep', detail: 'Kept your own title.' };

  // The role is the part before the first separator ("Senior Account Executive,
  // Enterprise" is a Senior Account Executive; "Enterprise" is the segment). No
  // list of role nouns is needed for this, so it holds in every profession.
  const role = posting.split(/\s*(?:,|:|\||\s[-\u2013\u2014]\s|\()\s*/)[0].trim() || posting;
  const postLevel = levelOf(role);
  const candLevel = candidateLevel(own, heldTitles);
  const discipline = role.replace(BAND_TEXT_RE, ' ').replace(/\s+/g, ' ').trim().replace(LEVEL_SUFFIX_RE, '').trim();
  const fits = fitsCandidate(discipline, own, [own, ...heldTitles], skills);
  // A candidate whose title states no level is treated as mid-level for the
  // comparison, so a posting that names a higher level is never claimed.
  const postRank = postLevel ? RANK[postLevel] : undefined;
  const candRank = candLevel ? RANK[candLevel] : 2;
  const sameKind = mgmtOf(role) === mgmtOf(own);

  const mirrorable = fits && sameKind && postLevel && postRank !== undefined && postRank <= candRank;
  if (mirrorable) {
    const word = BAND_WORD[postLevel];
    const headline = `${word ? `${word} ` : ''}${titleCase(discipline)}`.trim();
    return { headline, mode: 'mirror', detail: `Headline follows the posting's role, "${headline}", which is at or below your own level.` };
  }

  // A focus is added only where the posting's title could not be used because it
  // is unusual or a different kind of role: that is when the headline needs help
  // to read as close to the job. A common title above the candidate's level, or
  // with no level, already names their own discipline.
  const focus = !fits || !sameKind ? focusTerms({ skills, keywords, jobDescription, sourceText: sourceText || skills.join(' '), evidenceText, candidateTitle: own }) : [];
  let headline = own;
  let used = [];
  if (focus.length) {
    used = focus;
    headline = `${own} | ${used.join(', ')}`;
    if (headline.length > 80) { used = [focus[0]]; headline = `${own} | ${used[0]}`; }
    if (headline.length > 80) { used = []; headline = own; }
  }
  const why = !fits ? `"${posting}" is not a role on your resume, so your own title stays`
    : !sameKind ? `"${posting}" is a different kind of role (management versus individual contributor), so your own title stays`
      : !postLevel ? 'the posting states no level, so your own title stays'
        : 'the posting is above the level on your resume, so your own title stays';
  return { headline, mode: 'keep', detail: `Kept your own title (${why})${used.length ? `, with ${used.join(' and ')} from the posting` : ''}.` };
}

module.exports = { resolveHeadline, focusTerms, candidateLevel, fitsCandidate };
