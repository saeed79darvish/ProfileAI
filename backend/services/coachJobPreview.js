/**
 * coachJobPreview — three live openings for a profile the coach just built,
 * shown before the person has an account.
 *
 * The end of the coach asked for an account in exchange for a list of
 * features. Real openings for this person, by name, are a better reason, and
 * the job corpus already holds them. No model is called: the pool is a title
 * match (coachMarket's terms, so it agrees with the count the coach quoted),
 * ranked by the same text scorer the job feed uses. A guest can hit this as
 * often as the rate limit allows and it costs one indexed query.
 *
 * No score leaves this file. The feed only shows the graded match score
 * (utils/jobMatchScore on the frontend), never text relevance, so the preview
 * shows the job and leaves "how well you match" for after sign-up.
 */

const { Op, literal } = require('sequelize');
const { ExternalJob } = require('../models');
const { GHOST_THRESHOLD } = require('./ghostJobDetector');
const { titleTerms, titleTermWhere } = require('./coachMarket');
const { rankJobs } = require('./jobRelevanceService');

const PREVIEW_COUNT = 3;
const POOL_SIZE = 150;
const WINDOW_DAYS = 30;

const str = (v, max) => String(v || '').slice(0, max);

/**
 * The draft as the scorer reads a profile, cut to sizes a real profile fits
 * in. The body comes from an unauthenticated caller.
 */
function previewProfile(body = {}) {
  const skills = Array.isArray(body.skills) ? body.skills : [];
  const experience = Array.isArray(body.experience) ? body.experience : [];
  return {
    title: str(body.title, 200),
    target: str(body.target, 200),
    location: str(body.location, 200),
    summary: str(body.summary, 3000),
    skills: skills.map((s) => str(s, 80)).filter(Boolean).slice(0, 80),
    experience: experience.slice(0, 12).map((row = {}) => ({
      title: str(row.title, 200),
      company: str(row.company, 200),
      startDate: str(row.startDate, 20),
      endDate: str(row.endDate, 20),
      current: !!row.current,
      description: str(row.description, 2000),
    })),
  };
}

/** The best few of a pool, as the card shows them. */
function pickPreviewJobs(pool, profile) {
  const ranked = rankJobs(pool, profile, { sortMode: 'match', target: profile.target });
  // One per company: three teams at one employer reads as one opening.
  const companies = new Set();
  const varied = ranked.filter((job) => {
    const key = String(job.company || '').toLowerCase().trim();
    if (key && companies.has(key)) return false;
    companies.add(key);
    return true;
  });
  return varied.slice(0, PREVIEW_COUNT).map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location || (job.locationType === 'remote' ? 'Remote' : ''),
    postedAt: job.effectivePostedAt || job.postedAt || null,
  }));
}

/**
 * The title matches to try, narrowest first. Every word of "Staff Software
 * Engineer, AI and LLM Platform" in one title is rare, and three good jobs
 * for "Software Engineer" beat none, so the net widens until it holds enough:
 * all of the target's words, then its first two, then their current title.
 */
function termSets(profile) {
  const target = titleTerms(profile.target);
  const current = titleTerms(profile.title);
  const sets = [target, target.slice(0, 2), current, current.slice(0, 2)].filter((t) => t.length);
  const seen = new Set();
  return sets.filter((t) => {
    const key = t.join(' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function findPreviewJobs(body, { windowDays = WINDOW_DAYS } = {}) {
  const profile = previewProfile(body);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  for (const terms of termSets(profile)) {
    const pool = await ExternalJob.findAll({
      where: {
        [Op.and]: [
          { isActive: true },
          literal(`COALESCE("ExternalJob"."ghostScore", 0) < ${GHOST_THRESHOLD}`),
          { effectivePostedAt: { [Op.gte]: since } },
          ...terms.map(titleTermWhere),
        ],
      },
      attributes: ['id', 'title', 'company', 'location', 'locationType', 'description', 'skills', 'effectivePostedAt', 'postedAt'],
      order: [['effectivePostedAt', 'DESC']],
      limit: POOL_SIZE,
    });
    // Counted after one-per-company, so a pool of one employer keeps widening.
    const jobs = pickPreviewJobs(pool, profile);
    if (jobs.length >= PREVIEW_COUNT) return { jobs };
  }
  return { jobs: [] };
}

module.exports = { findPreviewJobs, pickPreviewJobs, previewProfile, termSets, PREVIEW_COUNT };
