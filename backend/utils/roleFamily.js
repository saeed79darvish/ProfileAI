/**
 * The engineering family a title names, when it names one: frontend, backend,
 * mobile, data, ml, devops. Used to stop a Staff Software Engineer, Frontend
 * Platform being sent to "Backend Software Engineer, Infrastructure".
 *
 * Why it exists: deriveRoleQuery reduces that profile to "Software Engineer"
 * (the specialty after the comma is dropped), and every software engineer
 * posting matches that equally well. The family is read from the words people
 * actually put in titles, and only when exactly one family is named: a title
 * that names two ("Frontend and Backend Engineer", "Full Stack") is a
 * generalist's and matches nothing in particular, and a title that names none
 * ("Software Engineer") says nothing, so neither side of a comparison is ever
 * excluded on a guess.
 */

const { normalizeRoleCompounds } = require('./roleQuery');

const FAMILIES = [
  ['frontend', /\b(frontend|front-end|ui|react|angular|vue|web ui)\b/i],
  ['backend', /\b(backend|back-end|api|server|laravel|django|rails|spring boot|php|golang)\b/i],
  ['mobile', /\b(mobile|ios|android|react native|flutter)\b/i],
  ['data', /\b(data|analytics|etl|bi)\b/i],
  ['ml', /\b(machine learning|ml|ai|nlp|deep learning|research scientist)\b/i],
  ['devops', /\b(devops|sre|site reliability|infrastructure|cloud|platform reliability)\b/i],
  ['security', /\b(security|appsec)\b/i],
];
const GENERALIST = /\bfull[\s-]?stack\b/i;

/** The one family a title names, or null when it names none or several. */
function titleFamily(title) {
  const t = normalizeRoleCompounds(title).replace(/\bfullstack\b/gi, 'full stack');
  if (!t.trim() || GENERALIST.test(t)) return null;
  // "Frontend Infrastructure" is a frontend job; the surface words outrank the support ones.
  const hits = FAMILIES.filter(([, re]) => re.test(t)).map(([name]) => name);
  if (hits.length === 1) return hits[0];
  if (hits.includes('frontend') && hits.every((h) => h === 'frontend' || h === 'devops')) return 'frontend';
  if (hits.includes('backend') && hits.every((h) => h === 'backend' || h === 'devops')) return 'backend';
  return null;
}

/** The candidate's family: their title, then headline, then their latest role. */
function profileFamily(profile = {}) {
  const exp = Array.isArray(profile.experience) ? profile.experience.filter(Boolean) : [];
  const latest = exp.find((e) => e.current || e.isCurrent) || exp[0] || {};
  for (const t of [profile.title, profile.headline, latest.title || latest.position]) {
    const f = titleFamily(t);
    if (f) return f;
  }
  return null;
}

/** False only when both sides name a family and the families differ. */
function familyFits(candidateFamily, jobTitle) {
  if (!candidateFamily) return true;
  const f = titleFamily(jobTitle);
  return !f || f === candidateFamily;
}

module.exports = { titleFamily, profileFamily, familyFits };
