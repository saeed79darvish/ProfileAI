/**
 * Free requirement matches for the jobs in a list response.
 *
 * Each job's requirements are read once and stored (jobRequirementsService);
 * here the signed-in candidate's coverage is checked in code for the ~20 jobs
 * on the page. Jobs never read are queued so the next load shows their match.
 * Any failure returns the payload unchanged: a missing badge, never a broken
 * list.
 */

const { indexProfile, matchFromRequirements } = require('./resume/requirementCoverage');
const { queueRead } = require('./jobRequirementsService');

const PROFILE_TTL_MS = 60 * 1000;
const QUEUE_PER_PAGE = 20;
const _profiles = new Map();

async function profileIndexFor(userId) {
  const hit = _profiles.get(userId);
  if (hit && Date.now() - hit.at < PROFILE_TTL_MS) return hit.ix;
  const { Profile, User } = require('../models');
  const { loadCandidateProfile } = require('./resume/candidateProfile');
  const loaded = await loadCandidateProfile(userId, { Profile, User });
  const ix = loaded ? indexProfile(loaded.profileData) : null;
  _profiles.set(userId, { at: Date.now(), ix });
  if (_profiles.size > 2000) _profiles.delete(_profiles.keys().next().value);
  return ix;
}

/** Forget a cached profile (call when the profile is saved). */
function forgetProfile(userId) {
  _profiles.delete(userId);
}

async function readsFor(ids) {
  const sequelize = require('../config/database');
  return sequelize.query(
    `SELECT id::text AS id, "requirementsRead", "requirementsReadAt" FROM "ExternalJobs" WHERE id::text = ANY($1)`,
    { bind: [ids], type: sequelize.constructor.QueryTypes.SELECT }
  );
}

/**
 * @param {string} userId
 * @param {{jobs: Object[]}} payload - left untouched; a copy is returned
 * @param {{sortByMatch?: boolean}} opts - order this page by match, best first
 */
async function attachMatches(userId, payload, { sortByMatch = false } = {}) {
  if (!userId || !payload || !Array.isArray(payload.jobs) || !payload.jobs.length) return payload;
  try {
    const ix = await profileIndexFor(userId);
    if (!ix) return payload;
    const ids = payload.jobs.map((j) => j && j.id && String(j.id)).filter(Boolean);
    const rows = await readsFor(ids);
    const byId = new Map(rows.map((r) => [r.id, r]));
    let jobs = payload.jobs.map((j) => {
      const row = byId.get(String(j.id));
      const m = row && row.requirementsRead ? matchFromRequirements(row.requirementsRead, ix) : null;
      return m ? { ...j, match: { score: m.score, met: m.met, partial: m.partial, total: m.total } } : j;
    });
    queueRead(rows.filter((r) => !r.requirementsReadAt).map((r) => r.id).slice(0, QUEUE_PER_PAGE));
    if (sortByMatch) {
      // Scored jobs lead, unscored keep their ranked order after. Scores are
      // grouped in bands of 10 after an age penalty (2 points a day past a week,
      // up to 30) and the newest leads within a band, so a fresh good match is not
      // buried under a weeks-old strong one. Same rule as the page's own sort.
      const now = Date.now();
      const postedOf = (j) => {
        const t = Date.parse(j.effectivePostedAt || j.postedAt || j.createdAt || '');
        return Number.isFinite(t) ? t : 0;
      };
      const bandOf = (j) => {
        const posted = postedOf(j);
        const ageDays = posted ? Math.max(0, (now - posted) / 86400000) : 365;
        return Math.floor((j.match.score - Math.min(30, Math.max(0, ageDays - 7) * 2)) / 10);
      };
      jobs = jobs
        .map((j, i) => ({ j, i }))
        .sort((a, b) => {
          if (!a.j.match || !b.j.match) return (a.j.match ? -1 : b.j.match ? 1 : 0) || a.i - b.i;
          return (bandOf(b.j) - bandOf(a.j)) || (postedOf(b.j) - postedOf(a.j)) || a.i - b.i;
        })
        .map((x) => x.j);
    }
    return { ...payload, jobs };
  } catch (err) {
    console.warn('[JobMatchList] could not attach matches:', err.message);
    return payload;
  }
}

/** One job's full match (the detail page's ✓/– list), reading it first if needed. */
async function matchForJob(userId, jobId) {
  const ix = await profileIndexFor(userId);
  if (!ix) return null;
  const [row] = await readsFor([String(jobId)]);
  if (!row) return null;
  let read = row.requirementsRead;
  if (!read && !row.requirementsReadAt) {
    const sequelize = require('../config/database');
    const [job] = await sequelize.query(
      `SELECT id, title, company, description, requirements FROM "ExternalJobs" WHERE id::text = $1`,
      { bind: [String(jobId)], type: sequelize.constructor.QueryTypes.SELECT }
    );
    const { readAndStore } = require('./jobRequirementsService');
    read = job ? await readAndStore(job) : null;
  }
  return read ? matchFromRequirements(read, ix) : null;
}

module.exports = { attachMatches, matchForJob, forgetProfile };
