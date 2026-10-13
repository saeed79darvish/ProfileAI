/**
 * The candidate's profile, as the AI pipeline is allowed to see it.
 *
 * Every AI endpoint used to take the profile from the REQUEST BODY. The server
 * already has it — it is the user's own row — so that was redundant at best,
 * and in practice it was worse than redundant:
 *
 * - The extension cached the raw `/profiles/me` row and sent it back as-is on
 *   every tailor, gap, keyword and match call. That row carries two 512-number
 *   embedding vectors (~12.7 KB) and the full original resume text, so every
 *   request uploaded them.
 * - Gap analysis then pasted the whole object into the prompt as
 *   "supplementary" data — about 6,000 tokens of raw floats per call, plus the
 *   resume a second time. Pure cost and latency, no information.
 * - The extension's copy goes stale. Edit the profile on the web, tailor from
 *   the extension, and the resume is built from whatever was cached last.
 * - The web app and the extension each built the object differently, so the
 *   gap-analysis cache, keyed on a hash of it, held separate entries for the
 *   same person and the same job.
 *
 * So the profile is now loaded here, by user id, and narrowed to a whitelist.
 * A whitelist rather than a blocklist on purpose: the next column added to the
 * Profile table — another vector, another recruiter-side AI field — must not
 * reach a prompt merely because nobody remembered to exclude it.
 */

/**
 * The fields a resume prompt can use. Anything else on the row — embeddings,
 * timestamps, import metadata, recruiter-side AI fields (aiSummary, aiKeywords,
 * aiStrengths, aiRecruiterInsights), visibility flags — is not the candidate's
 * resume and is never sent to a model.
 */
const AI_PROFILE_FIELDS = [
  'title',
  'headline',
  'summary',
  'skills',
  'experience',
  'education',
  'projects',
  'certifications',
  'languages',
  'location',
  'phone',
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
  'firstName',
  'lastName',
];

/**
 * Narrow any profile-shaped object to the AI whitelist.
 *
 * Applied to server-loaded rows AND to anything a client still sends (older
 * extension builds, editors working on unsaved content), so no caller can put
 * an embedding vector into a prompt.
 *
 * @param {Object|null|undefined} profile - a plain object or a Sequelize row
 * @returns {Object}
 */
function toAIProfile(profile) {
  if (!profile || typeof profile !== 'object') return {};
  const source = typeof profile.toJSON === 'function' ? profile.toJSON() : profile;
  const out = {};
  for (const key of AI_PROFILE_FIELDS) {
    if (source[key] !== undefined && source[key] !== null) out[key] = source[key];
  }
  return out;
}

/**
 * Load the signed-in candidate's profile for an AI call.
 *
 * `originalResumeText` is returned separately because it is the fabrication
 * baseline, not prompt material to be serialised alongside everything else.
 *
 * @param {string} userId
 * @param {{ Profile: any, User?: any }} models
 * @returns {Promise<{ profileData: Object, originalResumeText: string|null } | null>}
 */
async function loadCandidateProfile(userId, { Profile, User } = {}) {
  if (!userId || !Profile) return null;
  const row = await Profile.findOne({
    where: { userId },
    attributes: [...AI_PROFILE_FIELDS.filter((f) => !['firstName', 'lastName'].includes(f)), 'originalResumeText'],
  });
  if (!row) return null;

  const plain = typeof row.toJSON === 'function' ? row.toJSON() : row;
  const profileData = toAIProfile(plain);

  // Name lives on User, not Profile. The extension merged it in client-side;
  // the server does it here so the result is the same whichever app asked.
  if (User) {
    try {
      const user = await User.findByPk(userId, { attributes: ['firstName', 'lastName'] });
      if (user) {
        if (user.firstName) profileData.firstName = user.firstName;
        if (user.lastName) profileData.lastName = user.lastName;
      }
    } catch (_) {
      /* name is cosmetic for the prompt; never fail the request over it */
    }
  }

  return { profileData, originalResumeText: plain.originalResumeText || null };
}

/** True when the profile has enough in it to tailor from. */
function hasProfileContent(profileData) {
  if (!profileData) return false;
  const exp = Array.isArray(profileData.experience) ? profileData.experience : [];
  return Boolean(profileData.summary || profileData.title || exp.length > 0);
}

module.exports = { AI_PROFILE_FIELDS, toAIProfile, loadCandidateProfile, hasProfileContent };
