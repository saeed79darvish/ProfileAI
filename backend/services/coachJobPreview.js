/**
 * coachJobPreview — three live openings for a profile the coach just built,
 * shown before the person has an account.
 *
 * The end of the coach asked for an account in exchange for a list of
 * features. Real openings for this person, by name, are a better reason, and
 * the job corpus already holds them. No model is called. The pool is found
 * the way the job board searches (utils/searchQuery: role synonyms, the
 * searchTsvAB index), from where they are heading, their title and their
 * recent roles, and ranked by the feed's own text scorer. A guest can hit
 * this as often as the rate limit allows and it costs a few indexed queries.
 *
 * The first version matched title words with LIKE, so a frontend engineer
 * aiming at an AI platform role was widened to "software engineer" and shown
 * Radar R&D and an infrastructure job in Warsaw. Searching each role they
 * have held finds their kind of job; their city or remote comes first; and
 * a senior person is never shown an early-career role.
 *
 * No score leaves this file. The feed only shows the graded match score
 * (utils/jobMatchScore on the frontend), never text relevance, so the card
 * shows the skills a posting asks for that they have, and the score comes
 * after sign-up.
 */

const { Op, literal } = require('sequelize');
const { ExternalJob, Company } = require('../models');
const { GHOST_THRESHOLD } = require('./ghostJobDetector');
const { deriveRoleQuery } = require('../utils/roleQuery');
const { buildJobSearchTsquery } = require('../utils/searchQuery');
const { rankJobs, computeYearsOfExperience, inferExperienceLevelOrNull } = require('./jobRelevanceService');
const { resolveCandidateLevel, excludesEarlyCareer, isEarlyCareerTitle } = require('./jobSeniorityFit');

const PREVIEW_COUNT = 3;
const POOL_PER_QUERY = 120;
const ROLE_QUERIES = 4;
const WINDOW_DAYS = 30;
const SKILLS_SHOWN = 4;

const str = (v, max) => String(v || '').slice(0, max);

/**
 * The draft as the scorer reads a profile, cut to sizes a real profile fits
 * in. The body comes from an unauthenticated caller.
 */
function previewProfile(body = {}) {
  const skills = Array.isArray(body.skills) ? body.skills : [];
  const experience = Array.isArray(body.experience) ? body.experience : [];
  const constraints = body.constraints && typeof body.constraints === 'object' ? body.constraints : {};
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
    // Only the two coach answers the level reading uses.
    constraints: {
      ...(constraints.careerStage ? { careerStage: str(constraints.careerStage, 40) } : {}),
      ...(constraints.seniority ? { seniority: str(constraints.seniority, 40) } : {}),
    },
  };
}

/**
 * The searches to pool from, most telling first: where they are heading,
 * their headline, then the roles they have held, newest first. Each is
 * reduced the way the jobs page reduces a title ("Senior UI Software
 * Architect Engineer" is a "UI Engineer" search), and repeats are dropped.
 */
function roleQueries(profile) {
  const titles = [profile.target, profile.title, ...profile.experience.map((r) => r.title)];
  const seen = new Set();
  const out = [];
  for (const title of titles) {
    const query = deriveRoleQuery(title);
    const key = query.toLowerCase();
    if (!query || seen.has(key) || !buildJobSearchTsquery(query)) continue;
    seen.add(key);
    out.push(query);
    if (out.length === ROLE_QUERIES) break;
  }
  return out;
}

/** Their level, as the feed reads it: what they told the coach, else the profile. */
function candidateLevelOf(profile) {
  const inferred = inferExperienceLevelOrNull(computeYearsOfExperience(profile), profile.title);
  return resolveCandidateLevel({ constraints: profile.constraints, inferredLevel: inferred }).level;
}

/** Their city, or remote. Matched loosely: boards spell places many ways. */
function isNearby(job, profile) {
  if (job.locationType === 'remote') return true;
  const city = String(profile.location || '').split(',')[0].trim().toLowerCase();
  return !!city && String(job.location || '').toLowerCase().includes(city);
}

/** The best few of a pool, as the card shows them. */
function pickPreviewJobs(pool, profile) {
  const level = candidateLevelOf(profile);
  const fitting = excludesEarlyCareer(level) ? pool.filter((j) => !isEarlyCareerTitle(j.title)) : pool;
  const ranked = rankJobs(fitting, profile, {
    sortMode: 'match',
    preferences: profile.constraints,
    target: profile.target,
  });

  // Nearby first, then anywhere, one per company: three teams at one
  // employer read as one opening.
  const ordered = [...ranked.filter((j) => isNearby(j, profile)), ...ranked.filter((j) => !isNearby(j, profile))];
  const companies = new Set();
  const varied = ordered.filter((job) => {
    const key = String(job.company || '').toLowerCase().trim();
    if (key && companies.has(key)) return false;
    companies.add(key);
    return true;
  });

  return varied.slice(0, PREVIEW_COUNT).map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    logoUrl: job.companyInfo?.logoUrl || null,
    location: job.location || (job.locationType === 'remote' ? 'Remote' : ''),
    locationType: job.locationType || null,
    salaryMin: job.salaryMin || null,
    salaryMax: job.salaryMax || null,
    salaryCurrency: job.salaryCurrency || null,
    postedAt: job.effectivePostedAt || job.postedAt || null,
    // Theirs, as they wrote them, that this posting asks for.
    skills: (job.matchedSkills || [])
      .map((s) => profile.skills.find((own) => own.toLowerCase() === s) || s)
      .slice(0, SKILLS_SHOWN),
  }));
}

async function findPreviewJobs(body, { windowDays = WINDOW_DAYS } = {}) {
  const profile = previewProfile(body);
  const queries = roleQueries(profile);
  if (!queries.length) return { jobs: [] };

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const pools = await Promise.all(queries.map((query) => ExternalJob.findAll({
    where: {
      [Op.and]: [
        { isActive: true },
        { effectivePostedAt: { [Op.gte]: since } },
        literal(`COALESCE("ExternalJob"."ghostScore", 0) < ${GHOST_THRESHOLD}`),
        literal(`"ExternalJob"."searchTsvAB" @@ to_tsquery('english', :tsQuery)`),
      ],
    },
    replacements: { tsQuery: buildJobSearchTsquery(query) },
    attributes: ['id', 'title', 'company', 'location', 'locationType', 'description', 'skills',
      'salaryMin', 'salaryMax', 'salaryCurrency', 'experienceLevel', 'effectivePostedAt', 'postedAt'],
    include: [{ model: Company, as: 'companyInfo', attributes: ['logoUrl'] }],
    order: [['effectivePostedAt', 'DESC']],
    limit: POOL_PER_QUERY,
  })));

  const byId = new Map();
  pools.flat().forEach((job) => { if (!byId.has(job.id)) byId.set(job.id, job); });
  const jobs = pickPreviewJobs([...byId.values()], profile);
  return { jobs: jobs.length >= PREVIEW_COUNT ? jobs : [] };
}

module.exports = { findPreviewJobs, pickPreviewJobs, previewProfile, roleQueries, PREVIEW_COUNT };
