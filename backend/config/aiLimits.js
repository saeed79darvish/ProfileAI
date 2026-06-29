/**
 * AI Feature Usage Limits Configuration
 *
 * All AI features use Claude Sonnet 4 (Anthropic) by default.
 * Cheap/low-stakes features route to Claude Haiku (see FEATURE_MODELS).
 * Limits are per subscription tier and role.
 * -1 means unlimited.
 *
 * Tiers (candidate):
 *   onboarding  — active until user sets aiOnboardingCompleted=true.
 *                 Generous lifetime caps so new users can build a great
 *                 first profile before seeing any paywall.
 *   free        — post-onboarding free plan. Light monthly caps.
 *   starter     — $6.99/month. Fills the gap between free and Pro.
 *   pro         — $14.99/month. Heavy monthly caps, no daily/weekly.
 *   pro_plus    — $29.99/month. Max limits; ApplyPilot gated separately.
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
 *   cover_letter        ~$0.018  (Claude Haiku — ~$0.005)
 *   career_suggestions  ~$0.020  (Claude Haiku — ~$0.006)
 *   post_enhance        ~$0.015  (Claude Haiku — ~$0.004)
 *   interview_prep      ~$0.145  (8k token response — Pro+ only)
 *   job_enhance         ~$0.026  (recruiter only)
 */

const AI_LIMITS = {
  candidate: {
    // ── ONBOARDING PHASE ────────────────────────────────────────────────
    // Active while user.aiOnboardingCompleted === false.
    // Generous lifetime caps so new users can build a great first profile
    // without hitting a paywall. Once they save a complete profile the flag
    // flips and they fall through to their subscription tier limits.
    onboarding: {
      resume_parse:       { lifetime: 3,  weekly: -1 }, // 3 upload attempts
      profile_enhance:    { lifetime: 5,  weekly: -1 }, // polish multiple times
      tailor_profile:     { lifetime: 1,  weekly: -1 }, // one taste test
      cover_letter:       { lifetime: 2,  weekly: -1 }, // two taste tests
      post_enhance:       { lifetime: 0,  weekly: 0  }, // not during onboarding
      career_suggestions: { lifetime: 10, weekly: -1 }, // guide them through
      interview_prep:     { lifetime: 0,  weekly: 0  }, // Pro feature
    },
    // ── FREE (post-onboarding) ──────────────────────────────────────────
    free: {
      resume_parse:       { monthly: 2,  weekly: -1 },
      profile_enhance:    { monthly: 2,  weekly: -1 },
      tailor_profile:     { monthly: 5,  weekly: -1 }, // was 3 lifetime — removed that friction
      cover_letter:       { monthly: 5,  weekly: -1 },
      post_enhance:       { weekly: 0,   monthly: 0 }, // disabled
      career_suggestions: { monthly: 10, weekly: -1 },
      interview_prep:     { weekly: 0,   monthly: 0 }, // Pro+ only
    },
    // ── STARTER ($6.99/month) ──────────────────────────────────────────
    starter: {
      resume_parse:       { monthly: 5,  weekly: -1 },
      profile_enhance:    { monthly: 10, weekly: -1 },
      tailor_profile:     { monthly: 20, weekly: -1 },
      cover_letter:       { monthly: 20, weekly: -1 },
      post_enhance:       { weekly: 0,   monthly: 0 }, // disabled
      career_suggestions: { monthly: -1, weekly: -1 }, // unlimited
      interview_prep:     { weekly: 0,   monthly: 0 }, // Pro only
    },
    // ── PRO ($14.99/month) ─────────────────────────────────────────────
    pro: {
      resume_parse:       { monthly: 20, weekly: -1 },
      profile_enhance:    { monthly: 30, weekly: -1 },
      tailor_profile:     { monthly: 75, weekly: -1 },
      cover_letter:       { monthly: 75, weekly: -1 },
      post_enhance:       { monthly: 20, weekly: -1 }, // enabled for Pro
      career_suggestions: { monthly: -1, weekly: -1 },
      interview_prep:     { monthly: 3,  weekly: -1 },
    },
    // ── PRO+ ($29.99/month) ────────────────────────────────────────────
    // ApplyPilot auto-apply is gated separately at the feature level.
    pro_plus: {
      resume_parse:       { monthly: 50,  weekly: -1 },
      profile_enhance:    { monthly: 50,  weekly: -1 }, // was 100 — capped to protect margin
      tailor_profile:     { monthly: 150, weekly: -1 }, // was 200 — capped
      cover_letter:       { monthly: 150, weekly: -1 }, // was 200 — capped
      post_enhance:       { monthly: -1,  weekly: -1 }, // unlimited
      career_suggestions: { monthly: -1,  weekly: -1 },
      interview_prep:     { monthly: 10,  weekly: -1 },
    },
    // ── ENTERPRISE (legacy) ────────────────────────────────────────────
    // Retained for existing rows. New signups use pro_plus.
    enterprise: {
      resume_parse:       { monthly: -1, weekly: -1 },
      profile_enhance:    { monthly: -1, weekly: -1 },
      tailor_profile:     { monthly: -1, weekly: -1 },
      cover_letter:       { monthly: -1, weekly: -1 },
      post_enhance:       { weekly: 0,   monthly: 0 },
      career_suggestions: { monthly: -1, weekly: -1 },
      interview_prep:     { monthly: -1, weekly: -1 },
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
  career_suggestions: 'Career Suggestions',
  interview_prep: 'Interview Preparation',
  analyze_gaps: 'Skill Gap Analysis',
  generate_answers: 'Application Answer Generation',
};

// Estimated costs per feature (Claude Sonnet 4 unless FEATURE_MODELS routes to Haiku)
// Sonnet 4: Input $3/1M, Output $15/1M
// Haiku 3.5: Input $0.80/1M, Output $4/1M
const ESTIMATED_COSTS = {
  resume_parse: 0.024,       // Sonnet — quality-critical
  profile_enhance: 0.051,    // Sonnet — quality-critical (4 parallel calls)
  tailor_profile: 0.026,     // Sonnet — quality-critical
  cover_letter: 0.005,       // Haiku  — ~73% cheaper than Sonnet ($0.018)
  post_enhance: 0.004,       // Haiku  — ~73% cheaper than Sonnet ($0.015)
  job_enhance: 0.007,        // Haiku  — recruiter-only
  career_suggestions: 0.006, // Haiku  — ~70% cheaper than Sonnet ($0.020)
  interview_prep: 0.145,     // Sonnet — 8k token response, Pro+ only
  analyze_gaps: 0.015,       // Sonnet — complex analysis
  generate_answers: 0.025,   // Sonnet — personalized content
};

/**
 * Model routing — features mapped to Haiku save ~73–80% vs Sonnet.
 * Used by service layer to pass the right model to callAI().
 * Features NOT listed here use the default Sonnet model.
 */
const FEATURE_MODELS = {
  cover_letter: 'haiku',
  post_enhance: 'haiku',
  career_suggestions: 'haiku',
  job_enhance: 'haiku',
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
  FEATURE_MODELS,
  CREDIT_PACKS,
  getLimits,
  isUnlimited,
  getWeekStart,
  getNextWeekStart
};
