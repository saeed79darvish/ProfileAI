/**
 * A candidate against a job's stored requirements (jobRequirementsRead.js),
 * checked in code. Free, so the job list can show a match on every card.
 *
 * Coverage follows the same bar as the AI match:
 *   strong  - in a job title, or in a role that ended in the last 4 years
 *   partial - only in the skills list, summary or projects, or an older role
 *   none    - nowhere in the profile
 * The score itself comes from the existing scorer (jobMatchScore.js), so a
 * card's % and the detail page's list can never disagree.
 */

const { scoreJobMatch, candidateYears } = require('./jobMatchScore');

const RECENT_YEARS = 4;
const DEGREE_RE = /\b(bachelor'?s?|b\.?s\.?c?|b\.?a\.?|master'?s?|m\.?s\.?c?|m\.?b\.?a|ph\.?d|doctorate|degree)\b/i;

const lower = (s) => String(s || '').toLowerCase();
const flat = (v) => (Array.isArray(v) ? v : Object.values(v || {}).flat()).map((x) => (typeof x === 'string' ? x : x && (x.name || x.title) || '')).join(' \n ');

function endYear(e, now) {
  if (e.current || e.isCurrent || /present|current/i.test(String(e.endDate || ''))) return now.getFullYear();
  const m = String(e.endDate || e.period || '').match(/(19|20)\d{2}(?!.*(19|20)\d{2})/);
  return m ? Number(m[0]) : null;
}

/** The profile as searchable text, built once per request. */
function indexProfile(profile = {}, now = new Date()) {
  const roles = (Array.isArray(profile.experience) ? profile.experience : []).filter(Boolean).map((e) => {
    const y = endYear(e, now);
    return {
      title: lower(e.title || e.position),
      text: lower(`${e.title || e.position || ''} \n ${e.description || ''}`),
      recent: y === null ? false : y >= now.getFullYear() - RECENT_YEARS,
    };
  });
  return {
    roles,
    skills: lower(flat(profile.skills)),
    summary: lower(`${profile.title || ''} \n ${profile.headline || ''} \n ${profile.summary || ''}`),
    projects: lower((profile.projects || []).map((p) => `${p.title || p.name || ''} ${p.description || ''} ${flat(p.technologies)}`).join(' \n ')),
    education: lower((profile.education || []).map((e) => `${e.degree || ''} ${e.field || e.fieldOfStudy || ''} ${e.institution || e.school || ''}`).join(' \n ')),
    certifications: lower(flat(profile.certifications)),
    hasDegree: (profile.education || []).some((e) => DEGREE_RE.test(`${e.degree || ''}`)),
    years: candidateYears(profile.experience),
  };
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasTerm = (text, term) => !!text && new RegExp(`(^|[^a-z0-9+#])${escape(term)}($|[^a-z0-9+#])`).test(text);
// "millions of users" is also said "1M+ users" or "2.5 million monthly users".
const SCALE_TERM = /\b(millions? of|high[- ]traffic|large[- ]scale)\b/;
const SCALE_TEXT = /\b\d+(\.\d+)?\s*(m|mm|million|b|billion)\+?\s*(\w+\s+){0,2}(users|customers|members|players|visitors|requests)\b/;
const anyTerm = (text, terms) => terms.some((t) => hasTerm(text, t) || (SCALE_TERM.test(t) && SCALE_TEXT.test(text)));

function coverageOf(req, ix) {
  const terms = req.terms || [];
  switch (req.type) {
    case 'experience_years': {
      if (ix.years === null || !req.years) return 'none';
      if (ix.years >= req.years) return 'strong';
      return ix.years >= req.years * 0.7 ? 'partial' : 'none';
    }
    case 'education':
      if (terms.length && anyTerm(ix.education, terms)) return 'strong';
      return ix.hasDegree && DEGREE_RE.test(req.requirement) ? 'partial' : 'none';
    case 'credential':
      if (anyTerm(ix.certifications, terms) || anyTerm(ix.education, terms)) return 'strong';
      return anyTerm(ix.skills, terms) ? 'partial' : 'none';
    case 'title':
      if (ix.roles.some((r) => r.recent && anyTerm(r.title, terms))) return 'strong';
      return ix.roles.some((r) => anyTerm(r.title, terms)) || anyTerm(ix.summary, terms) ? 'partial' : 'none';
    default: {
      if (!terms.length) return 'none';
      if (ix.roles.some((r) => r.recent && anyTerm(r.text, terms))) return 'strong';
      if (ix.roles.some((r) => anyTerm(r.text, terms))) return 'partial';
      return anyTerm(ix.skills, terms) || anyTerm(ix.summary, terms) || anyTerm(ix.projects, terms) ? 'partial' : 'none';
    }
  }
}

/** Does the profile do this job at all? The role nouns, against titles first. */
function roleFitOf(read, ix) {
  // "software engineer" fits "Lead UI Software Development Engineer": the head
  // word (the last one) is what names the job family.
  const nouns = [...new Set((read.roleNouns || []).flatMap((n) => [n, String(n).split(/\s+/).pop()]))].filter(Boolean);
  if (!nouns.length) return 1;
  if (ix.roles.some((r) => anyTerm(r.title, nouns))) return 1;
  return anyTerm(ix.summary, nouns) ? 0.8 : 0.6;
}

/**
 * @param {Object} read - ExternalJob.requirementsRead
 * @param {Object|Object} profileOrIndex - a profile, or indexProfile() of one
 * @returns {{score, met, partial, total, requirements}|null}
 */
function matchFromRequirements(read, profileOrIndex) {
  if (!read || !Array.isArray(read.requirements) || !read.requirements.length) return null;
  const ix = profileOrIndex && profileOrIndex.roles ? profileOrIndex : indexProfile(profileOrIndex);
  const requirements = read.requirements.map((r) => {
    // A soft skill with no evidence words cannot be checked in code; it is
    // left out of the arithmetic rather than counted as missing.
    const type = r.type === 'soft' && !(r.terms || []).length ? 'responsibility' : r.type;
    return { ...r, type, coverage: type === 'responsibility' ? 'none' : coverageOf({ ...r, type }, ix) };
  });
  const scored = scoreJobMatch({ requirements, roleFit: roleFitOf(read, ix), recency: 1, seniorityFit: 1 }, null);
  const shown = requirements.filter((r) => r.type !== 'responsibility');
  if (!shown.length) return null;
  return {
    score: scored.score,
    met: shown.filter((r) => r.coverage === 'strong').length,
    partial: shown.filter((r) => r.coverage === 'partial').length,
    total: shown.length,
    requirements: shown.map((r) => ({
      requirement: r.requirement,
      hardness: r.hardness,
      status: r.coverage === 'strong' ? 'met' : r.coverage === 'partial' ? 'partial' : 'missing',
    })),
  };
}

module.exports = { indexProfile, matchFromRequirements, coverageOf };
