/**
 * A job posting's requirements, read once per posting and shared by everyone.
 *
 * The per-user match (/profiles/job-match) asks the model to read the posting
 * AND judge the candidate in one call, about $0.036 a time, so the job list
 * could only show a score for jobs someone paid to score ("Score top 5").
 * Reading the posting does not depend on who is looking. Done once per job
 * with Haiku and stored on the row, each user's coverage is then checked in
 * code (requirementCoverage.js), which makes a match on every card free.
 *
 * Each requirement carries `terms`: the words that, found in a profile,
 * evidence it ("react", "react.js"). Coverage is decided by those terms, so
 * they are where this read earns its keep.
 */

const REQUIREMENTS_READ_VERSION = 1;

const TYPES = ['skill', 'experience_years', 'credential', 'education', 'title', 'domain', 'soft', 'responsibility'];
const MAX_REQUIREMENTS = 12;
const MAX_TERMS = 8;

function buildRequirementsReadPrompt(job = {}) {
  const text = [job.description, job.requirements].filter(Boolean).join('\n\n').slice(0, 9000);
  return {
    system: 'You read job postings and list what a screener would check. Return valid JSON only.',
    prompt: `List the requirements of this job posting.

TITLE: ${String(job.title || '').slice(0, 200)}
COMPANY: ${String(job.company || '').slice(0, 120)}

POSTING:
${text}

RULES:
- A requirement is something a screener could check. Ignore company boilerplate, benefits, EEO text, and logistics (location, office days, travel, visa, salary).
- At most ${MAX_REQUIREMENTS}, in the posting's order, each under 60 characters in the posting's own terms.
- type: one of ${TYPES.join(', ')}. Use experience_years for every requirement stating a number of years, and responsibility for duties of the job ("mentor juniors") rather than bars to clear.
- hardness: "must" when stated as required or listed under Requirements/Basic qualifications; "nice" when preferred/bonus/"a plus".
- terms: up to ${MAX_TERMS} lowercase words or short phrases that would appear in a candidate's resume if they meet it: common spellings and alternatives the posting accepts ("react", "react.js"; "java", "kotlin" for "Java or Kotlin"), and for broader requirements the concrete ways a resume shows them ("millions of users", "1m+ users", "high-traffic" for large-scale consumer products; "lighthouse", "core web vitals", "load time" for web performance). Never single generic words like "products" or "experience". For experience_years, the area ("frontend", "web"). For soft and responsibility, [].
- years: for experience_years only, the minimum number of years as a number.
- roleNouns: 1-3 lowercase words naming the job itself ("engineer", "designer", "product manager").

Return ONLY JSON:
{"roleNouns":[""],"requirements":[{"requirement":"","type":"","hardness":"must","terms":[""],"years":null}]}`,
    max_tokens: 1400,
    temperature: 0,
  };
}

const clean = (s, n) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, n);

/** Validate the model's answer into the stored shape, or null if unusable. */
function normalizeRequirementsRead(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.requirements)) return null;
  const requirements = raw.requirements
    .filter((r) => r && typeof r === 'object' && clean(r.requirement, 80))
    .slice(0, MAX_REQUIREMENTS)
    .map((r) => {
      let type = TYPES.includes(r.type) ? r.type : 'skill';
      const years = type === 'experience_years' && r.years != null && Number.isFinite(Number(r.years)) && Number(r.years) > 0
        ? Math.min(30, Number(r.years))
        : null;
      // "Experience building large-scale products" carries no number to check
      // against dates; its terms are the evidence, as for a skill.
      if (type === 'experience_years' && years === null) type = 'skill';
      return {
        requirement: clean(r.requirement, 80),
        type,
        hardness: r.hardness === 'nice' ? 'nice' : 'must',
        terms: (Array.isArray(r.terms) ? r.terms : [])
          .map((t) => clean(t, 40).toLowerCase())
          .filter((t) => t.length >= 2)
          .slice(0, MAX_TERMS),
        ...(years !== null ? { years } : {}),
      };
    });
  if (!requirements.length) return null;
  return {
    version: REQUIREMENTS_READ_VERSION,
    roleNouns: (Array.isArray(raw.roleNouns) ? raw.roleNouns : []).map((n) => clean(n, 30).toLowerCase()).filter(Boolean).slice(0, 3),
    requirements,
  };
}

module.exports = { buildRequirementsReadPrompt, normalizeRequirementsRead, REQUIREMENTS_READ_VERSION };
