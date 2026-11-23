/**
 * What the form filler knows about the applicant.
 *
 * Auto-apply should answer every question from what the user already
 * told us, so the Profile is merged with the ApplyPilot answers (phone,
 * links, notice period, relocation, salary) the user gave in Setup. The
 * Profile alone left phone and salary blank, which paused real sends.
 */
const { ApplyPilotTrainingMemory } = require('../../models');

function plain(x) {
  if (!x) return {};
  return typeof x.toJSON === 'function' ? x.toJSON() : { ...x };
}

function buildApplicantProfile(profile, pilotConfig) {
  const p = plain(profile);
  const ap = plain(pilotConfig)?.profile || {};
  const criteria = plain(pilotConfig)?.criteria || {};
  const floorK = Number(criteria.salaryFloorK);
  return {
    ...p,
    phone: ap.phone || p.phone || null,
    linkedinUrl: ap.linkedinUrl || p.linkedinUrl || p.socialLinks?.linkedin || null,
    githubUrl: ap.githubUrl || p.githubUrl || p.socialLinks?.github || null,
    portfolioUrl: ap.portfolioUrl || p.portfolioUrl || p.website || null,
    location: p.location || ap.currentLocation || null,
    noticePeriod: ap.noticePeriod || null,
    relocationWillingness: ap.relocationWillingness ?? null,
    // The user's stated expectation, else the lowest salary they set in
    // Setup ("I won't take less than X") as an honest starting point.
    salaryExpectation: ap.salaryExpectation || (Number.isFinite(floorK) && floorK > 0 ? `$${floorK},000` : null),
  };
}

/**
 * Save an answer the user gave on one application so every later
 * application reuses it (mapFields puts memory rows in its prompt).
 */
async function rememberAnswer(userId, question, answer) {
  const key = String(question || '').trim().slice(0, 250);
  const value = String(answer || '').trim();
  if (!userId || !key || !value) return null;
  const existing = await ApplyPilotTrainingMemory.findOne({ where: { userId, topic: 'answers', key } });
  if (existing) {
    existing.value = value;
    existing.source = 'manual';
    await existing.save();
    return existing;
  }
  return ApplyPilotTrainingMemory.create({ userId, topic: 'answers', key, value, source: 'manual' });
}

module.exports = { buildApplicantProfile, rememberAnswer };
