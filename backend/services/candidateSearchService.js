/**
 * Candidate Search Service
 *
 * Query helpers for browsing and fetching candidate Profile records.
 * Used by the Claude MCP connector (backend/mcp/server.js).
 *
 * The existing REST handler at backend/routes/profiles.js GET / is left
 * intact: it has a richer relevance-scoring pass that the MCP tool does
 * not need, and rewriting it carries regression risk. This service
 * intentionally exposes a narrower, well-typed API for the connector.
 */

const { Op, literal } = require('sequelize');
const { Profile, User } = require('../models');

function classifyExperienceLevel(expCount) {
  if (expCount >= 5) return 'Senior';
  if (expCount >= 3) return 'Mid-Level';
  if (expCount >= 1) return 'Junior';
  return 'Entry';
}

function enrichProfile(profile) {
  const p = profile.toJSON ? profile.toJSON() : profile;
  const expCount = Array.isArray(p.experience) ? p.experience.length : 0;
  return {
    ...p,
    experienceLevel: classifyExperienceLevel(expCount),
    experienceCount: expCount,
  };
}

/**
 * Search public candidate profiles.
 *
 * Filters:
 *   - search:           free-text across title/summary/aiSummary/skills/name
 *   - skills:           string[] (matches any) or comma-separated string
 *   - location:         partial match
 *   - experienceLevel:  Entry | Junior | Mid-Level | Senior (post-filter)
 *   - aiEnhanced:       boolean → require aiSummary
 *   - sortBy:           recent (default) | experience | aiScore
 *   - limit, offset:    pagination
 *
 * Returns { profiles, total, filtered }.
 */
async function searchProfiles(params = {}) {
  const {
    search,
    skills,
    location,
    experienceLevel,
    aiEnhanced,
    sortBy = 'recent',
    limit = 20,
    offset = 0,
  } = params;

  const where = { isPublic: true };
  const userWhere = { role: 'candidate' };
  const replacements = {};
  let paramIndex = 0;
  const searchConditions = [];

  const safeLike = (sqlExpr, value) => {
    const key = `p${paramIndex++}`;
    replacements[key] = `%${value}%`;
    return literal(`${sqlExpr} ILIKE :${key}`);
  };

  if (search) {
    const term = String(search).trim();
    searchConditions.push({ title: { [Op.iLike]: `%${term}%` } });
    searchConditions.push({ summary: { [Op.iLike]: `%${term}%` } });
    searchConditions.push({ aiSummary: { [Op.iLike]: `%${term}%` } });
    searchConditions.push({ location: { [Op.iLike]: `%${term}%` } });
    searchConditions.push(safeLike(`CAST("Profile"."skills" AS TEXT)`, term));
    searchConditions.push(safeLike(`CAST("Profile"."experience" AS TEXT)`, term));
    searchConditions.push(safeLike(`"user"."firstName"`, term));
    searchConditions.push(safeLike(`"user"."lastName"`, term));
    searchConditions.push(
      safeLike(`CONCAT("user"."firstName", ' ', "user"."lastName")`, term),
    );
  }

  // Skills can arrive as a string[] (preferred) or a CSV string.
  let skillsList = [];
  if (Array.isArray(skills)) {
    skillsList = skills.filter((s) => typeof s === 'string' && s.trim());
  } else if (typeof skills === 'string' && skills.trim()) {
    skillsList = skills.split(',').map((s) => s.trim()).filter(Boolean);
  }
  for (const skill of skillsList) {
    const key = `p${paramIndex++}`;
    replacements[key] = `%${skill.toLowerCase()}%`;
    searchConditions.push(
      literal(`LOWER(CAST("Profile"."skills" AS TEXT)) LIKE :${key}`),
    );
  }

  if (location) {
    searchConditions.push({ location: { [Op.iLike]: `%${location}%` } });
  }

  if (aiEnhanced === true || aiEnhanced === 'true') {
    where.aiSummary = { [Op.ne]: null };
  }

  if (searchConditions.length > 0) {
    where[Op.or] = searchConditions;
  }

  let order = [['createdAt', 'DESC']];
  if (sortBy === 'experience') {
    order = [
      [literal(`COALESCE(jsonb_array_length("Profile"."experience"), 0)`), 'DESC'],
      ['createdAt', 'DESC'],
    ];
  } else if (sortBy === 'aiScore') {
    order = [
      [literal(`CASE WHEN "Profile"."aiSummary" IS NOT NULL THEN 1 ELSE 0 END`), 'DESC'],
      [literal(`CASE WHEN "Profile"."aiRecruiterInsights" IS NOT NULL THEN 1 ELSE 0 END`), 'DESC'],
      ['createdAt', 'DESC'],
    ];
  }

  const queryOptions = {
    where,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'role', 'slug'],
        where: userWhere,
      },
    ],
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    order,
  };
  if (Object.keys(replacements).length > 0) queryOptions.replacements = replacements;

  const { count, rows } = await Profile.findAndCountAll(queryOptions);
  let enriched = rows.map(enrichProfile);

  if (experienceLevel) {
    const wanted = String(experienceLevel).toLowerCase();
    enriched = enriched.filter((p) => p.experienceLevel.toLowerCase() === wanted);
  }

  return {
    profiles: enriched,
    total: count,
    filtered: enriched.length,
  };
}

/**
 * Fetch a candidate Profile by user id (UUID) or user slug.
 * Public profiles only. Returns null if not found.
 */
async function getProfileById(idOrSlug) {
  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    String(idOrSlug || ''),
  );

  let userId = idOrSlug;
  if (!isUuid) {
    const userBySlug = await User.findOne({
      where: { slug: idOrSlug },
      attributes: ['id'],
    });
    if (!userBySlug) return null;
    userId = userBySlug.id;
  }

  const profile = await Profile.findOne({
    where: { userId, isPublic: true },
    order: [['createdAt', 'DESC']],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'slug'],
      },
    ],
  });

  if (!profile) return null;
  return enrichProfile(profile);
}

module.exports = {
  searchProfiles,
  getProfileById,
  classifyExperienceLevel,
};
