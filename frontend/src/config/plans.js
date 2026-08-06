/**
 * Plan and credit-pack data for the out-of-credits modal.
 *
 * Mirrors backend/config/aiLimits.js (AI_LIMITS + CREDIT_PACKS) and the Pricing
 * page. Every number the modal shows a user comes from here, so a claim like
 * "30 enhancements a month, up from 2" is the limit the rate limiter will
 * actually enforce rather than marketing copy that drifted.
 *
 * If you change AI_LIMITS or CREDIT_PACKS on the backend, change this too.
 */

export const TIER_ORDER = ['free', 'starter', 'pro', 'pro_plus'];

export const PLANS = {
  free: {
    id: 'free',
    label: 'Free plan',
    price: 0,
    limits: {
      resume_parse: 2,
      profile_enhance: 2,
      tailor_profile: 5,
      cover_letter: 5,
      career_suggestions: 10,
      post_enhance: 0,
      interview_prep: 0,
    },
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    price: 6.99,
    limits: {
      resume_parse: 5,
      profile_enhance: 10,
      tailor_profile: 20,
      cover_letter: 20,
      career_suggestions: -1,
      post_enhance: 0,
      interview_prep: 0,
    },
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    price: 14.99,
    popular: true,
    limits: {
      resume_parse: 20,
      profile_enhance: 30,
      tailor_profile: 75,
      cover_letter: 75,
      career_suggestions: -1,
      post_enhance: 20,
      interview_prep: 3,
    },
  },
  pro_plus: {
    id: 'pro_plus',
    label: 'Pro+',
    price: 29.99,
    limits: {
      resume_parse: 50,
      profile_enhance: 50,
      tailor_profile: 150,
      cover_letter: 150,
      career_suggestions: -1,
      post_enhance: -1,
      interview_prep: 10,
    },
  },
};

// Legacy tier retained on old rows; treat as top of the ladder.
const TERMINAL_TIERS = new Set(['pro_plus', 'enterprise']);

/** The plan we should sell to someone currently on `tier`, or null at the top. */
export function nextPlanFor(tier) {
  const current = (tier || 'free').toLowerCase();
  if (TERMINAL_TIERS.has(current)) return null;
  const idx = TIER_ORDER.indexOf(current);
  // Unknown tiers fall back to pitching Pro, the plan most users step up to.
  if (idx === -1) return PLANS.pro;
  // Free skips Starter and is pitched Pro: Starter's headline benefit over Free
  // is small, and Pro is the plan the pricing page markets as the default.
  if (current === 'free') return PLANS.pro;
  return PLANS[TIER_ORDER[idx + 1]] || null;
}

export function currentPlanFor(tier) {
  const key = (tier || 'free').toLowerCase();
  return PLANS[key] || { id: key, label: key.replace(/_/g, ' '), price: 0, limits: {} };
}

const fmtLimit = (n) => (n === -1 ? 'Unlimited' : n);

/**
 * Three concrete selling points for `plan`, led by the feature the user was
 * just blocked on so the pitch answers the wall they actually hit.
 */
export function planHighlights(plan, currentPlan, featureType) {
  const out = [];
  const cur = currentPlan?.limits || {};
  const next = plan?.limits || {};

  const NAMES = {
    resume_parse: 'resume parses',
    profile_enhance: 'enhancements',
    tailor_profile: 'résumé tailorings',
    cover_letter: 'cover letters',
    career_suggestions: 'career suggestions',
    post_enhance: 'post enhancements',
    interview_prep: 'interview preps',
  };

  if (featureType && next[featureType] !== undefined) {
    const from = cur[featureType];
    const to = next[featureType];
    out.push({
      strong: `${fmtLimit(to)} ${NAMES[featureType] || 'credits'}`,
      rest: to === -1
        ? ''
        : (typeof from === 'number' && from >= 0 ? ` a month, up from ${from}` : ' a month'),
    });
  }

  // Fill the rest with the biggest remaining jumps, so the card never pads with
  // a benefit the user already has.
  const others = Object.keys(NAMES)
    .filter((k) => k !== featureType)
    .filter((k) => {
      const to = next[k];
      const from = cur[k] ?? 0;
      if (to === undefined || to === 0) return false;
      return to === -1 || to > from;
    })
    .sort((a, b) => (next[b] === -1 ? 1e9 : next[b]) - (next[a] === -1 ? 1e9 : next[a]));

  for (const k of others.slice(0, 2)) {
    // "Unlimited X a month" reads wrong; unlimited has no period to qualify.
    out.push({ strong: `${fmtLimit(next[k])} ${NAMES[k]}`, rest: next[k] === -1 ? '' : ' a month' });
  }

  return out.slice(0, 3);
}

/**
 * Credit packs, mirroring backend CREDIT_PACKS.
 *
 * NOTE: packs grant tailor_profile and cover_letter credits ONLY. There is no
 * pack that grants profile_enhance, career_suggestions or resume_parse, which
 * is why the limiter reports creditPacksAvailable:false for those. The modal
 * must not offer a pack that cannot unblock the feature the user hit.
 */
export const CREDIT_PACKS = [
  { id: 'apply_10', credits: 10, price: 6.99, grants: ['tailor_profile', 'cover_letter'] },
  { id: 'apply_25', credits: 25, price: 13.99, grants: ['tailor_profile', 'cover_letter'], popular: true },
  { id: 'apply_60', credits: 60, price: 24.99, grants: ['tailor_profile', 'cover_letter'] },
];

export function packsFor(featureType) {
  if (!featureType) return [];
  return CREDIT_PACKS.filter((p) => p.grants.includes(featureType));
}

/** Per-credit price, and savings vs the cheapest pack. */
export function packEconomics(pack, all) {
  const per = pack.price / pack.credits;
  const base = all.length ? Math.max(...all.map((p) => p.price / p.credits)) : per;
  const savePct = base > 0 ? Math.round((1 - per / base) * 100) : 0;
  return { per, savePct };
}
