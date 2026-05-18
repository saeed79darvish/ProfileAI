/**
 * AI Feature Usage Limits Configuration
 *
 * All AI features use Claude Sonnet 4 (Anthropic).
 * Limits are per subscription tier and role.
 * -1 means unlimited.
 *
 * FREE tier: monthly caps + a lifetime cap on tailor_profile (the trial trigger).
 * PRO tier: monthly caps, no daily/weekly caps.
 * PRO+ tier: same as Pro plus ApplyPilot auto-apply (handled at feature level).
 *
 * Limit fields (all optional, applied if > 0):
 *   - lifetime: max uses for the entire account history (one-shot trials)
 *   - daily:    max uses per calendar day
 *   - weekly:   max uses per ISO week
 *   - monthly:  max uses per calendar month
 *
 * Costs (Claude Sonnet 4 — input $3/1M, output $15/1M):
 *   resume_parse        ~$0.024  (one-shot per resume)
 *   profile_enhance     ~$0.051  (one-shot per profile; 4 parallel calls)
 *   tailor_profile      ~$0.026  (per job application — high repeat)
 *   cover_letter        ~$0.018  (per job application — high repeat)
 *   career_suggestions  ~$0.020
 *   job_enhance         ~$0.026  (recruiter only)
 */

const AI_LIMITS = {
  candidate: {
    free: {
      // Free is a TRIAL: tight monthly caps + a hard lifetime cap on the
      // repeat-use feature (tailor_profile) to drive conversion.
      resume_parse:       { monthly: 1,  weekly: -1 },
      profile_enhance:    { monthly: 1,  weekly: -1 },
      tailor_profile:     { lifetime: 3, daily: 1, monthly: -1, weekly: -1 },
      cover_letter:       { monthly: 2,  weekly: -1 },
      post_enhance:       { weekly: 0,   monthly: 0 }, // disabled
      career_suggestions: { monthly: 5,  weekly: -1 },
    },
    pro: {
      resume_parse:       { monthly: 20, weekly: -1 },
      profile_enhance:    { monthly: 30, weekly: -1 },
      tailor_profile:     { monthly: 50, weekly: -1 },
      cover_letter:       { monthly: 30, weekly: -1 },
      post_enhance:       { weekly: 0,   monthly: 0 },
      career_suggestions: { monthly: -1, weekly: -1 },
    },
    // Pro+ adds ApplyPilot auto-apply (gated separately at feature level).
    pro_plus: {
      resume_parse:       { monthly: 50,  weekly: -1 },
      profile_enhance:    { monthly: 100, weekly: -1 },
      tailor_profile:     { monthly: 200, weekly: -1 },
      cover_letter:       { monthly: 200, weekly: -1 },
      post_enhance:       { weekly: 0,    monthly: 0 },
      career_suggestions: { monthly: -1,  weekly: -1 },
    },
    // Legacy: enterprise rows kept so existing 'enterprise' DB rows still
    // resolve to generous limits during migration. New signups should use
    // pro_plus instead.
    enterprise: {
      resume_parse:       { monthly: -1, weekly: -1 },
      profile_enhance:    { monthly: -1, weekly: -1 },
      tailor_profile:     { monthly: -1, weekly: -1 },
      cover_letter:       { monthly: -1, weekly: -1 },
      post_enhance:       { weekly: 0,   monthly: 0 },
      career_suggestions: { monthly: -1, weekly: -1 },
    }
  },
  // Recruiter limits kept for future use
  recruiter: {
    free: {
      resume_parse: { weekly: 0, monthly: 0 },
      profile_enhance: { weekly: 0, monthly: 0 },
      tailor_profile: { weekly: 0, monthly: 0 },
      cover_letter: { weekly: 0, monthly: 0 },
      post_enhance: { weekly: 10, monthly: -1 },
      job_enhance: { weekly: 5, monthly: 15 },
    },
    pro: {
      resume_parse: { weekly: 0, monthly: 0 },
      profile_enhance: { weekly: 0, monthly: 0 },
      tailor_profile: { weekly: 0, monthly: 0 },
      cover_letter: { weekly: 0, monthly: 0 },
      post_enhance: { weekly: -1, monthly: -1 },
      job_enhance: { weekly: -1, monthly: 100 },
    },
    enterprise: {
      resume_parse: { weekly: 0, monthly: 0 },
      profile_enhance: { weekly: 0, monthly: 0 },
      tailor_profile: { weekly: 0, monthly: 0 },
      cover_letter: { weekly: 0, monthly: 0 },
      post_enhance: { weekly: -1, monthly: -1 },
      job_enhance: { weekly: -1, monthly: -1 },
    }
  }
};

// Feature display names for UI
const FEATURE_NAMES = {
  resume_parse: 'Resume Parsing',
  profile_enhance: 'Profile Enhancement',
  tailor_profile: 'Resume Tailoring',
  cover_letter: 'AI Cover Letter',
  post_enhance: 'Post Enhancement',
  job_enhance: 'Job Description Enhancement',
  career_suggestions: 'Career Suggestions'
};

// Estimated costs per feature — Claude Sonnet 4 (Anthropic)
// Input: $3/1M tokens, Output: $15/1M tokens
const ESTIMATED_COSTS = {
  resume_parse: 0.024,       // Claude Sonnet 4
  profile_enhance: 0.051,    // Claude Sonnet 4 (4 parallel calls)
  tailor_profile: 0.026,     // Claude Sonnet 4
  cover_letter: 0.018,       // Claude Sonnet 4
  post_enhance: 0.015,       // Claude Sonnet 4
  job_enhance: 0.026,        // Claude Sonnet 4
  career_suggestions: 0.020  // Claude Sonnet 4
};

/**
 * Credit pack definitions — one-time purchases, credits never expire.
 *
 * Strategy: only sell *application credits* (tailor + cover letter bundled
 * 1:1, since users always need both per job). Parse and profile_enhance are
 * one-shot actions — when free users hit the cap we show an upgrade prompt
 * instead of selling a pack.
 *
 * Pricing is intentionally tuned so that subscribing to Pro is the obvious
 * better value:
 *   apply_25 ($13.99) ≈ Pro ($14.99/mo) — nudges to subscription
 *   apply_60 ($24.99) ≈ Pro+ ($29.99/mo) — nudges power users to Pro+
 */
const CREDIT_PACKS = {
  apply_10: {
    name: 'Apply 10',
    price: 6.99,
    credits: { tailor_profile: 10, cover_letter: 10 },
    description: '10 tailored resumes + 10 cover letters',
    popular: false
  },
  apply_25: {
    name: 'Apply 25',
    price: 13.99,
    credits: { tailor_profile: 25, cover_letter: 25 },
    description: '25 tailored resumes + 25 cover letters',
    popular: true
  },
  apply_60: {
    name: 'Apply 60',
    price: 24.99,
    credits: { tailor_profile: 60, cover_letter: 60 },
    description: '60 tailored resumes + 60 cover letters',
    popular: false
  }
};

/**
 * Get limits for a specific user tier and role
 */
function getLimits(role, tier, featureType) {
  const roleKey = role === 'recruiter' ? 'recruiter' : 'candidate';
  const tierKey = tier || 'free';
  
  const roleLimits = AI_LIMITS[roleKey];
  if (!roleLimits) return { weekly: 0, monthly: 0 };
  
  const tierLimits = roleLimits[tierKey];
  if (!tierLimits) return AI_LIMITS[roleKey].free[featureType] || { weekly: 0, monthly: 0 };
  
  return tierLimits[featureType] || { weekly: 0, monthly: 0 };
}

/**
 * Check if a limit value means unlimited
 */
function isUnlimited(limit) {
  return limit === -1;
}

/**
 * Get the start of the current week (Monday 00:00:00)
 */
function getWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? 6 : day - 1; // Days since Monday
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Get next Monday date for reset display
 */
function getNextWeekStart() {
  const weekStart = getWeekStart();
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  return nextWeek;
}

module.exports = {
  AI_LIMITS,
  FEATURE_NAMES,
  ESTIMATED_COSTS,
  CREDIT_PACKS,
  getLimits,
  isUnlimited,
  getWeekStart,
  getNextWeekStart
};
