/**
 * jobSeniorityFit — how well a posting's level fits the candidate's level.
 *
 * The default jobs feed ranked on role and freshness only, so a student saw
 * Staff Engineer roles beside internships and a senior engineer saw
 * internships beside Staff roles. The coach now asks people what stage they
 * are at and what level they work at; this module turns those answers (or,
 * when they never answered, what their profile implies) into one small
 * ranking term and, for experienced people only, one exclusion.
 *
 * Everything here is pure so the rules can be tested without a database. The
 * SQL builders produce the same judgement as the JS functions, because the
 * feed scores in Postgres and the fallback paths score in Node, and the two
 * disagreeing would make the same job rank differently depending on whether
 * the candidate's profile happened to have an embedding yet.
 *
 * Levels are a small ordinal scale shared by candidates and jobs:
 *
 *   0  student / internship / apprenticeship / new grad
 *   1  entry, junior
 *   2  mid
 *   3  senior
 *   4  staff, principal, lead, manager and above
 */

const LEVEL = Object.freeze({ STUDENT: 0, ENTRY: 1, MID: 2, SENIOR: 3, STAFF_PLUS: 4 });

/* The coach's careerStage ids (frontend/src/data/jobTaxonomy.js CAREER_STAGES).
   Only the two that say "not yet working full-time" carry a level on their
   own. "experienced", "career_change" and "self_taught" describe the path, not
   the rung: a career changer can be a senior anything, so those fall through
   to the stated seniority or the profile. */
const CAREER_STAGES = ['experienced', 'internship', 'new_grad', 'career_change', 'self_taught'];
const STUDENT_STAGES = new Set(['internship', 'new_grad']);

/* The coach's level ids (LEVELS in pages/ProfileCoach/coachLogic.js). Ids are
   canonical across sectors, only their labels change, so "senior" means the
   same rung for a nurse as for an engineer. Freelance/consultant and
   self-employed say how someone works, not how senior they are, so they carry
   no level and the profile decides instead. */
const SENIORITY_LEVELS = Object.freeze({
  entry: LEVEL.ENTRY,
  ic: LEVEL.MID,
  senior: LEVEL.SENIOR,
  staff: LEVEL.STAFF_PLUS,
  principal: LEVEL.STAFF_PLUS,
  lead: LEVEL.STAFF_PLUS,
  manager: LEVEL.STAFF_PLUS,
  director: LEVEL.STAFF_PLUS,
  head: LEVEL.STAFF_PLUS,
  consultant: null,
  owner: null,
});
const SENIORITY_IDS = Object.keys(SENIORITY_LEVELS);

// The five-step scale the ingest pipeline writes to ExternalJobs.experienceLevel
// and that jobRelevanceService.inferExperienceLevel returns for candidates.
const INFERRED_LEVELS = Object.freeze({
  entry: LEVEL.ENTRY,
  mid: LEVEL.MID,
  senior: LEVEL.SENIOR,
  lead: LEVEL.STAFF_PLUS,
  executive: LEVEL.STAFF_PLUS,
});

/* Title words that mark a posting as early-career. Kept as word lists so the
   JS and Postgres patterns are generated from one source: JS has \b, Postgres
   regexes spell a word boundary [[:<:]] / [[:>:]], and a hand-maintained pair
   would drift. "Intern" is bounded on both sides so "Internal Audit" and
   "International" never match. */
const EARLY_CAREER_WORDS = [
  'intern', 'interns', 'internship', 'internships',
  'apprentice', 'apprentices', 'apprenticeship', 'apprenticeships',
  'graduate', 'graduates', 'co-op', 'coop',
];
const NEW_GRAD = 'new[- ]?grads?';
const ENTRY_WORDS = ['junior', 'jr', 'entry level', 'entry-level'];
const MID_WORDS = ['mid', 'mid-level', 'intermediate'];
const SENIOR_WORDS = ['senior', 'sr', 'manager'];
const STAFF_PLUS_WORDS = ['staff', 'principal', 'lead', 'head', 'director', 'vp', 'chief'];

const jsWords = (words) => new RegExp(`\\b(?:${words.join('|')})\\b`, 'i');
const EARLY_CAREER_RE = new RegExp(`\\b(?:${EARLY_CAREER_WORDS.join('|')})\\b|\\b${NEW_GRAD}\\b`, 'i');
const ENTRY_RE = jsWords(ENTRY_WORDS);
const MID_RE = jsWords(MID_WORDS);
const SENIOR_RE = jsWords(SENIOR_WORDS);
const STAFF_PLUS_RE = jsWords(STAFF_PLUS_WORDS);

const pgWords = (words) => `[[:<:]](${words.join('|')})[[:>:]]`;
/** Postgres ARE pattern for early-career titles. Contains no quote, backslash or `$`. */
const EARLY_CAREER_PG = `${pgWords(EARLY_CAREER_WORDS)}|[[:<:]]${NEW_GRAD}[[:>:]]`;

/**
 * Ranking adjustment by [candidateLevel][jobLevel].
 *
 * Units are the feed's banded rank score, where relevance contributes at most
 * 0.8 and one band is 0.1 (see searchSimilarJobs). So +0.1 lifts a job about
 * one band and the largest demotion, -0.18, sinks it about two. That is enough
 * to change the top of the page without letting level outrank a much better
 * role match: a strong match one level off still beats a weak match at the
 * right level.
 *
 * The shape:
 *   students       lift internships and entry roles, sink senior and above
 *   entry          lift entry, allow internships, sink senior and above
 *   mid            mild lift for mid, sink internships
 *   senior / staff lift their own band, sink entry; internships are excluded
 *                  outright (see excludesEarlyCareer), the row here is only
 *                  the fallback for a path that cannot filter
 *
 * A job whose level is unknown (most postings with no seniority word) gets 0:
 * absence of a keyword is not evidence of a level.
 */
const LEVEL_FIT = Object.freeze([
  //  job:  student  entry   mid    senior  staff+
  Object.freeze([0.10, 0.08, 0.00, -0.12, -0.18]), // candidate: student
  Object.freeze([0.04, 0.08, 0.02, -0.08, -0.15]), // candidate: entry
  Object.freeze([-0.10, -0.03, 0.04, 0.00, -0.04]), // candidate: mid
  Object.freeze([-0.18, -0.10, -0.02, 0.04, 0.02]), // candidate: senior
  Object.freeze([-0.18, -0.12, -0.04, 0.02, 0.04]), // candidate: staff+
]);

const isLevel = (n) => Number.isInteger(n) && n >= LEVEL.STUDENT && n <= LEVEL.STAFF_PLUS;

/**
 * The candidate's level from what they told the coach, or null when they told
 * it nothing that implies one.
 *
 * A student career stage wins over a stated seniority: someone who says they
 * have only done internships and picks "Junior" is still looking for
 * internships and graduate roles first.
 */
function candidateLevelFromPreferences(constraints = {}) {
  const stage = constraints?.careerStage;
  if (STUDENT_STAGES.has(stage)) return LEVEL.STUDENT;
  const level = SENIORITY_LEVELS[constraints?.seniority];
  return isLevel(level) ? level : null;
}

/**
 * The level used for ranking: what they said first, what the profile implies
 * second. `inferredLevel` is jobRelevanceService's five-step reading, passed
 * in rather than computed here so this module stays free of profile parsing;
 * pass null when the profile carries no level signal at all, so a guessed
 * default never moves anyone's feed.
 *
 * @returns {{ level: number|null, source: 'stated'|'inferred'|null }}
 */
function resolveCandidateLevel({ constraints = {}, inferredLevel = null } = {}) {
  const stated = candidateLevelFromPreferences(constraints);
  if (stated !== null) return { level: stated, source: 'stated' };
  const inferred = INFERRED_LEVELS[inferredLevel];
  if (isLevel(inferred)) return { level: inferred, source: 'inferred' };
  return { level: null, source: null };
}

/**
 * A posting's level: early-career title words first (the structured field
 * calls an internship "entry", which loses the distinction that matters
 * most), then the structured experienceLevel, then title keywords.
 */
function jobLevel(job = {}) {
  const title = String(job.title || '');
  if (EARLY_CAREER_RE.test(title)) return LEVEL.STUDENT;
  const structured = INFERRED_LEVELS[job.experienceLevel];
  if (isLevel(structured)) return structured;
  if (STAFF_PLUS_RE.test(title)) return LEVEL.STAFF_PLUS;
  if (SENIOR_RE.test(title)) return LEVEL.SENIOR;
  if (ENTRY_RE.test(title)) return LEVEL.ENTRY;
  if (MID_RE.test(title)) return LEVEL.MID;
  return null;
}

/** Ranking adjustment for one job; 0 when either level is unknown. */
function levelFitAdjustment(candidateLevel, jobLevelValue) {
  if (!isLevel(candidateLevel) || !isLevel(jobLevelValue)) return 0;
  return LEVEL_FIT[candidateLevel][jobLevelValue];
}

/**
 * Whether internships, apprenticeships and new-grad postings should be left
 * out entirely rather than ranked down. Only for senior and above, and never
 * when the person asked for them: an explicit internship filter, an entry
 * level filter, or a typed search for one.
 */
function excludesEarlyCareer(candidateLevel, { employmentType, experienceLevel, search } = {}) {
  if (!isLevel(candidateLevel) || candidateLevel < LEVEL.SENIOR) return false;
  const types = String(employmentType || '').toLowerCase().split(',').map((t) => t.trim());
  if (types.includes('internship')) return false;
  if (String(experienceLevel || '').toLowerCase() === 'entry') return false;
  if (search && EARLY_CAREER_RE.test(String(search))) return false;
  return true;
}

/** True when a title reads as an internship, apprenticeship or new-grad role. */
const isEarlyCareerTitle = (title) => EARLY_CAREER_RE.test(String(title || ''));

/**
 * SQL for the job's level, mirroring jobLevel(). `alias` is the table alias
 * whose title / experienceLevel columns are read. Returns NULL for unknown.
 */
function jobLevelSql(alias = 'ej') {
  const t = `COALESCE(${alias}.title, '')`;
  const structured = Object.entries(INFERRED_LEVELS)
    .map(([k, v]) => `WHEN ${alias}."experienceLevel" = '${k}' THEN ${v}`)
    .join(' ');
  return `(CASE
      WHEN ${t} ~* '${EARLY_CAREER_PG}' THEN ${LEVEL.STUDENT}
      ${structured}
      WHEN ${t} ~* '${pgWords(STAFF_PLUS_WORDS)}' THEN ${LEVEL.STAFF_PLUS}
      WHEN ${t} ~* '${pgWords(SENIOR_WORDS)}' THEN ${LEVEL.SENIOR}
      WHEN ${t} ~* '${pgWords(ENTRY_WORDS)}' THEN ${LEVEL.ENTRY}
      WHEN ${t} ~* '${pgWords(MID_WORDS)}' THEN ${LEVEL.MID}
      ELSE NULL END)`;
}

/**
 * SQL for the ranking adjustment against a known candidate level, or null
 * when there is no candidate level (callers then add nothing). The numbers
 * come from LEVEL_FIT and are formatted here, never from user input.
 */
function levelFitSql(candidateLevel, alias = 'ej') {
  if (!isLevel(candidateLevel)) return null;
  const row = LEVEL_FIT[candidateLevel];
  const whens = row.map((adj, jl) => `WHEN ${jl} THEN ${adj.toFixed(3)}`).join(' ');
  return `(CASE ${jobLevelSql(alias)} ${whens} ELSE 0.0 END)`;
}

/** SQL predicate that keeps a row only when its title is not early-career. */
function notEarlyCareerSql(titleExpr) {
  return `NOT (COALESCE(${titleExpr}, '') ~* '${EARLY_CAREER_PG}')`;
}

module.exports = {
  LEVEL,
  LEVEL_FIT,
  CAREER_STAGES,
  SENIORITY_IDS,
  SENIORITY_LEVELS,
  EARLY_CAREER_PG,
  candidateLevelFromPreferences,
  resolveCandidateLevel,
  jobLevel,
  levelFitAdjustment,
  excludesEarlyCareer,
  isEarlyCareerTitle,
  jobLevelSql,
  levelFitSql,
  notEarlyCareerSql,
};
