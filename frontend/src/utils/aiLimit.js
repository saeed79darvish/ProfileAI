/**
 * Helpers for the 429 the AI rate limiter returns when a user is out of credits.
 *
 * The limiter emits three shapes (lifetime trial, daily, weekly/monthly) that
 * share a common core, so call sites can treat them uniformly:
 *
 *   {
 *     error: 'Monthly limit reached',
 *     message: "You've used all 2 monthly Profile Enhancement credits.",
 *     featureType: 'profile_enhance',
 *     usage: { week, weeklyLimit, month, monthlyLimit, promoBonus }
 *          | { today, dailyLimit }
 *          | { total, lifetimeLimit },
 *     resetAt: '2026-09-01T00:00:00.000Z',   // absent on the lifetime shape
 *     upgradeRequired: true,
 *     creditPacksAvailable: false,
 *     buyMoreUrl: '/pricing#credit-packs'
 *   }
 */

// Mirrors backend/config/aiLimits.js CREDIT_PACKS. Packs currently grant credits
// for these features ONLY, so offering "buy credits" for anything else would be
// a button that cannot deliver what it promises.
export const PACK_COVERED_FEATURES = new Set(['tailor_profile', 'cover_letter']);

export const FEATURE_LABELS = {
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
  // Tier-gated features rather than metered ones; they reach the same modal
  // via a synthesised payload so the upgrade path is identical.
  agent_apply: 'AI Agent Apply',
  agent_arena: 'Agent Arena',
};

/**
 * Returns the limit payload when `err` is a rate-limit rejection, else null.
 * Use it to decide whether to open the limit modal instead of showing an
 * inline error — running out of credits is a purchase moment, not a failure.
 */
export function parseLimitError(err) {
  const res = err?.response;
  if (!res || res.status !== 429) return null;
  const data = res.data;
  if (!data || typeof data !== 'object') return null;
  return {
    error: data.error || 'Limit reached',
    message: data.message || '',
    featureType: data.featureType || null,
    usage: data.usage || {},
    resetAt: data.resetAt || null,
    upgradeRequired: Boolean(data.upgradeRequired),
    creditPacksAvailable: Boolean(data.creditPacksAvailable),
    buyMoreUrl: data.buyMoreUrl || '/pricing',
  };
}

/** Used / total for whichever window the limiter actually enforced. */
export function readUsage(usage = {}) {
  if (typeof usage.lifetimeLimit === 'number') {
    return { used: usage.total ?? 0, total: usage.lifetimeLimit, window: 'lifetime' };
  }
  if (typeof usage.dailyLimit === 'number') {
    return { used: usage.today ?? 0, total: usage.dailyLimit, window: 'today' };
  }
  // Weekly and monthly arrive together; the enforced one is whichever is capped
  // and exhausted. -1 means unlimited, so it can never be the binding limit.
  const weekly = usage.weeklyLimit;
  if (typeof weekly === 'number' && weekly >= 0 && (usage.week ?? 0) >= weekly) {
    return { used: usage.week ?? 0, total: weekly, window: 'this week' };
  }
  if (typeof usage.monthlyLimit === 'number' && usage.monthlyLimit >= 0) {
    return { used: usage.month ?? 0, total: usage.monthlyLimit, window: 'this month' };
  }
  return { used: 0, total: 0, window: '' };
}

/**
 * "1 September" — or null when there is nothing to wait for.
 *
 * Formatted in UTC deliberately. `resetAt` is a calendar boundary serialised as
 * midnight UTC (e.g. 2026-09-01T00:00:00.000Z); rendering it in a negative-offset
 * local zone rolls it back a day, so a user in Pacific time would be told their
 * credits refresh on 31 August when the limiter actually resets them on the 1st.
 */
export function formatReset(resetAt) {
  if (!resetAt) return null;
  const d = new Date(resetAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Whole days from now until the reset, or null if unknown/past. */
export function daysUntil(resetAt) {
  if (!resetAt) return null;
  const d = new Date(resetAt);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.ceil(ms / 86400000);
}
