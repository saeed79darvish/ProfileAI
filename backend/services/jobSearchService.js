/**
 * Job Search Service
 *
 * Shared Sequelize query logic for browsing and fetching internal Job
 * postings. Extracted from backend/routes/jobs.js so both the public
 * REST API (GET /api/jobs, GET /api/jobs/:id) and the Claude MCP
 * connector (backend/mcp/server.js) call the same code path.
 *
 * NOTE: Behaviour MUST stay identical to the original handlers — the
 * REST route is a thin wrapper around these functions.
 */

const { Op } = require('sequelize');
const { Job, User, RecruiterProfile } = require('../models');

/**
 * Build a `Job` Sequelize `where` clause from search/filter params.
 * Mirrors the logic at backend/routes/jobs.js GET /.
 */
function buildJobWhereClause({
  search,
  location,
  locationType,
  employmentType,
  experienceLevel,
  salaryMin,
  salaryMax,
  datePosted,
} = {}) {
  const where = { status: 'active' };

  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { company: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (datePosted) {
    const now = new Date();
    const dateMap = {
      day: new Date(now - 24 * 60 * 60 * 1000),
      '3days': new Date(now - 3 * 24 * 60 * 60 * 1000),
      week: new Date(now - 7 * 24 * 60 * 60 * 1000),
      '2weeks': new Date(now - 14 * 24 * 60 * 60 * 1000),
      month: new Date(now - 30 * 24 * 60 * 60 * 1000),
      '3months': new Date(now - 90 * 24 * 60 * 60 * 1000),
    };
    if (dateMap[datePosted]) {
      where.createdAt = { [Op.gte]: dateMap[datePosted] };
    }
  }

  if (location) where.location = { [Op.iLike]: `%${location}%` };
  if (locationType) where.locationType = locationType;
  if (employmentType) where.employmentType = employmentType;
  if (experienceLevel) where.experienceLevel = experienceLevel;
  if (salaryMin) where.salaryMax = { [Op.gte]: parseInt(salaryMin, 10) };
  if (salaryMax) where.salaryMin = { [Op.lte]: parseInt(salaryMax, 10) };

  return where;
}

/**
 * Search active jobs with filters + pagination.
 * Returns { jobs, pagination: { total, page, pages } }.
 */
async function searchJobs(params = {}) {
  const page = parseInt(params.page, 10) || 1;
  const limit = parseInt(params.limit, 10) || 20;
  const offset = (page - 1) * limit;

  const where = buildJobWhereClause(params);

  const { count, rows: jobs } = await Job.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'recruiter',
        attributes: ['id', 'firstName', 'lastName'],
        include: [
          {
            model: RecruiterProfile,
            as: 'recruiterProfile',
            attributes: ['companyName', 'companyLogo', 'industry', 'profilePicture'],
          },
        ],
      },
    ],
    order: [['featured', 'DESC'], ['createdAt', 'DESC']],
    limit,
    offset,
  });

  return {
    jobs,
    pagination: {
      total: count,
      page,
      pages: Math.ceil(count / limit),
    },
  };
}

/**
 * Fetch a single job by id (UUID). Bumps the `views` counter just like
 * the GET /api/jobs/:id route does.
 *
 * Returns the Job model instance (or null if not found).
 */
async function getJobById(id, { incrementViews = true } = {}) {
  const job = await Job.findByPk(id, {
    include: [
      {
        model: User,
        as: 'recruiter',
        attributes: ['id', 'firstName', 'lastName'],
        include: [
          {
            model: RecruiterProfile,
            as: 'recruiterProfile',
            attributes: [
              'companyName',
              'companyLogo',
              'companySlug',
              'industry',
              'companySize',
              'companyWebsite',
              'companyDescription',
              'profilePicture',
            ],
          },
        ],
      },
    ],
  });

  if (!job) return null;
  if (incrementViews) await job.increment('views');
  return job;
}

module.exports = {
  buildJobWhereClause,
  searchJobs,
  getJobById,
};
