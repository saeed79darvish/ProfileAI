/**
 * Read-only access to a user's tailored resumes for the MCP connector's
 * interview-prep tools. Everything here is strictly scoped to the owning
 * user id — the connector must never leak one user's resumes to another.
 */

const { TailoredProfile } = require('../models');

/**
 * List a user's active tailored resumes, newest first.
 * @param {string} userId
 * @param {{ limit?: number }} [opts]
 */
async function listForUser(userId, { limit = 20 } = {}) {
  const rows = await TailoredProfile.findAll({
    where: { userId, isActive: true },
    order: [['createdAt', 'DESC']],
    limit,
  });
  return rows.map((r) => summarize(r));
}

/**
 * Fetch one tailored resume by id, scoped to the owning user. Returns the
 * full record (including interview prep + gaps) or null.
 * @param {string} userId
 * @param {string} id
 */
async function getForUser(userId, id) {
  const row = await TailoredProfile.findOne({ where: { id, userId } });
  if (!row) return null;

  const data = row.tailoredData || {};
  return {
    ...summarize(row),
    interviewPrep: data.interviewPrep || null,
    interviewPrepMeta: data.interviewPrepMeta || null,
    // Match analysis (strong matches / missing requirements) is stored
    // alongside the tailored data when the gap analysis ran.
    matchAnalysis: data.matchAnalysis || null,
    skillGaps: Array.isArray(row.skillGaps) ? row.skillGaps : [],
  };
}

/** Compact, list-friendly projection shared by list + detail. */
function summarize(row) {
  const gaps = Array.isArray(row.skillGaps) ? row.skillGaps : [];
  const data = row.tailoredData || {};
  return {
    id: row.id,
    jobTitle: row.jobTitle,
    companyName: row.companyName || null,
    jobUrl: row.jobUrl || null,
    matchScore: row.matchScore ?? null,
    gapCount: gaps.length,
    hasInterviewPrep: !!data.interviewPrep,
    createdAt: row.createdAt,
  };
}

module.exports = { listForUser, getForUser };
