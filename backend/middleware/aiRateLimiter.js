const { Op } = require('sequelize');
const { AIUsage, User, Profile, PromoRedemption, CreditPack } = require('../models');
const { getLimits, isUnlimited, ESTIMATED_COSTS, FEATURE_NAMES, ONBOARDING_FREE_FEATURES, getWeekStart, getNextWeekStart } = require('../config/aiLimits');

/**
 * When the user saved their first Profile, or null if they have not yet.
 * Profile rows are only created by the first save (POST /api/profiles), so
 * "no row" is exactly "still building the first profile".
 */
const getFirstProfileSavedAt = async (userId) => {
  const profile = await Profile.findOne({ where: { userId }, attributes: ['createdAt'] });
  return profile ? profile.createdAt : null;
};

/**
 * A usedAt filter starting at the later of a window start and a floor.
 * Either may be null; both null means "all time".
 */
const usedSince = (windowStart, floor) => {
  const from = floor && (!windowStart || floor > windowStart) ? floor : windowStart;
  return from ? { usedAt: { [Op.gte]: from } } : {};
};

/** Paid tiers keep their own limits even before onboarding is finished. */
const isPaidTier = (tier) => !!tier && tier !== 'free';

/**
 * Get the best active promo bonus for a user (highest multiplier / flat)
 */
const getActivePromoBonus = async (userId) => {
  try {
    const redemptions = await PromoRedemption.findAll({
      where: {
        userId,
        isActive: true,
        type: 'ai_bonus',
        expiresAt: { [Op.gt]: new Date() }
      },
      order: [['dailyMultiplier', 'DESC']]
    });

    if (redemptions.length === 0) return null;

    let bestMultiplier = 1;
    let totalFlatBonus = 0;
    for (const r of redemptions) {
      if (r.dailyMultiplier && r.dailyMultiplier > bestMultiplier) {
        bestMultiplier = r.dailyMultiplier;
      }
      if (r.dailyBonusFlat) {
        totalFlatBonus += r.dailyBonusFlat;
      }
    }

    return { multiplier: bestMultiplier, flatBonus: totalFlatBonus };
  } catch (error) {
    console.error('Error checking promo bonus:', error);
    return null;
  }
};

/**
 * Check if user has available credit pack credits for a feature
 */
const getAvailableCreditPackCredits = async (userId, featureType) => {
  try {
    const packs = await CreditPack.findAll({
      where: {
        userId,
        featureType,
        status: 'active',
        creditsRemaining: { [Op.gt]: 0 }
      },
      order: [['purchasedAt', 'ASC']] // Use oldest pack first (FIFO)
    });
    
    const totalCredits = packs.reduce((sum, p) => sum + p.creditsRemaining, 0);
    return { packs, totalCredits };
  } catch (error) {
    console.error('Error checking credit packs:', error);
    return { packs: [], totalCredits: 0 };
  }
};

/**
 * Deduct one credit from the user's credit packs (FIFO order)
 */
const deductCreditPackCredit = async (userId, featureType) => {
  try {
    // Find the oldest pack with remaining credits
    const pack = await CreditPack.findOne({
      where: {
        userId,
        featureType,
        status: 'active',
        creditsRemaining: { [Op.gt]: 0 }
      },
      order: [['purchasedAt', 'ASC']]
    });

    if (!pack) return false;

    pack.creditsRemaining -= 1;
    if (pack.creditsRemaining <= 0) {
      pack.status = 'exhausted';
    }
    await pack.save();
    return true;
  } catch (error) {
    console.error('Error deducting credit pack credit:', error);
    return false;
  }
};

/**
 * AI Rate Limiter Middleware
 * 
 * Checks usage limits in this order:
 * 1. Initial free trial uses (if initialFree is set, first N uses bypass all caps)
 * 2. Daily limit (if daily is set)
 * 3. Subscription limits (weekly for free, monthly for pro)
 * 4. Credit pack overflow (if subscription limit reached but user has credit packs)
 * 
 * Free tier: daily + weekly + monthly limits
 * Pro tier: monthly limits only (no daily/weekly caps)
 * 
 * Usage: router.post('/enhance', authMiddleware, aiRateLimiter('profile_enhance'), handler)
 *
 * Options:
 *   freeWhen: 'noProfileYet'
 *     Free while the user is building their first profile (no Profile row).
 *     Only the abuse ceiling in ONBOARDING_FREE_FEATURES[featureType].safetyCap
 *     applies then. Once a profile exists, usage recorded BEFORE it was first
 *     saved is ignored, so onboarding never eats into the monthly allowance.
 *     e.g. aiRateLimiter('resume_parse', { freeWhen: 'noProfileYet' })
 */
const aiRateLimiter = (featureType, options = {}) => {
  const freeWhenNoProfile = options.freeWhen === 'noProfileYet';
  if (options.freeWhen && !freeWhenNoProfile) {
    throw new Error(`aiRateLimiter: unknown freeWhen "${options.freeWhen}"`);
  }
  return async (req, res, next) => {
    // Optional global escape hatch for local development. Set
    // DISABLE_AI_RATE_LIMIT=true to bypass; otherwise the limits below run.
    if (process.env.DISABLE_AI_RATE_LIMIT === 'true') {
      return next();
    }
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      const role = user.role || 'candidate';
      let tier = user.subscriptionTier || 'free';

      // Onboarding override: a free candidate who hasn't completed their first
      // profile gets the generous 'onboarding' tier. Paid users keep their own
      // limits, which are never lower (and the onboarding tier's lifetime caps
      // would otherwise apply to someone who has already paid).
      if (role === 'candidate' && !user.aiOnboardingCompleted && !isPaidTier(tier)) {
        tier = 'onboarding';
      }

      // Usage before the first profile save does not count against the caps
      // of a freeWhen:'noProfileYet' feature. Null means "count everything".
      let countFloor = null;
      if (freeWhenNoProfile && role === 'candidate') {
        const firstSavedAt = await getFirstProfileSavedAt(userId);
        if (!firstSavedAt) {
          const safetyCap = ONBOARDING_FREE_FEATURES[featureType]?.safetyCap;
          if (safetyCap > 0) {
            const used = await AIUsage.count({ where: { userId, featureType } });
            if (used >= safetyCap) {
              return res.status(429).json({
                error: 'Limit reached',
                message: `You've used ${FEATURE_NAMES[featureType] || featureType} a lot without saving a profile. Save your profile to continue.`,
                featureType,
                usage: { total: used, onboardingSafetyCap: safetyCap },
                upgradeRequired: false,
              });
            }
          }
          req.aiUsage = {
            featureType,
            userId,
            limits: { onboardingFree: true },
            useCreditPack: false,
            onboardingFree: true,
            currentUsage: {},
          };
          return next();
        }
        countFloor = firstSavedAt;
      }

      // Get limits for this feature
      const limits = getLimits(role, tier, featureType);
      
      // Apply promo bonus to weekly limits
      const promoBonus = await getActivePromoBonus(userId);
      let effectiveWeeklyLimit = limits.weekly;
      if (promoBonus && !isUnlimited(limits.weekly) && limits.weekly > 0) {
        effectiveWeeklyLimit = Math.floor(limits.weekly * promoBonus.multiplier) + promoBonus.flatBonus;
      }

      // Check if feature is completely unavailable (0 limits)
      if (limits.weekly === 0 && limits.monthly === 0) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `${FEATURE_NAMES[featureType]} is not available on your current plan.`,
          upgradeRequired: true,
          featureType,
          limits
        });
      }

      // Get time boundaries
      const weekStart = getWeekStart();
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Count total lifetime usage (for initialFree / lifetime cap checks)
      let totalUsage = 0;
      const needsLifetimeCount =
        (limits.initialFree && limits.initialFree > 0) ||
        (limits.lifetime && !isUnlimited(limits.lifetime) && limits.lifetime > 0);

      if (needsLifetimeCount) {
        totalUsage = await AIUsage.count({
          where: { userId, featureType, ...usedSince(null, countFloor) }
        });

        // Hard lifetime cap (e.g. Free tier tailor_profile = 3 lifetime).
        // When exhausted, fall through to credit-pack overflow check below.
        if (limits.lifetime && !isUnlimited(limits.lifetime) && totalUsage >= limits.lifetime) {
          const { totalCredits } = await getAvailableCreditPackCredits(userId, featureType);
          if (totalCredits > 0) {
            req.aiUsage = {
              featureType,
              userId,
              limits,
              effectiveWeeklyLimit,
              promoBonus,
              useCreditPack: true,
              currentUsage: { total: totalUsage, lifetimeLimit: limits.lifetime },
              creditPackCredits: totalCredits
            };
            return next();
          }
          return res.status(429).json({
            error: 'Lifetime trial used',
            message: `You've used all ${limits.lifetime} free ${FEATURE_NAMES[featureType]} credits. Upgrade to Pro or buy a credit pack to continue.`,
            featureType,
            usage: { total: totalUsage, lifetimeLimit: limits.lifetime },
            upgradeRequired: true,
            creditPacksAvailable: false,
            buyMoreUrl: '/pricing'
          });
        }

        // If still within initial free trial window, skip remaining caps.
        if (limits.initialFree && limits.initialFree > 0 && totalUsage < limits.initialFree) {
          req.aiUsage = {
            featureType,
            userId,
            limits,
            effectiveWeeklyLimit,
            promoBonus,
            useCreditPack: false,
            currentUsage: { total: totalUsage, initialFreeRemaining: limits.initialFree - totalUsage }
          };
          return next();
        }
      }

      // Check daily limit (if configured)
      if (limits.daily && !isUnlimited(limits.daily) && limits.daily > 0) {
        const dayUsage = await AIUsage.count({
          where: { userId, featureType, ...usedSince(todayStart, countFloor) }
        });

        if (dayUsage >= limits.daily) {
          const tomorrow = new Date(todayStart);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          return res.status(429).json({
            error: 'Daily limit reached',
            message: `You've used your daily ${FEATURE_NAMES[featureType]} credit. Try again tomorrow.`,
            featureType,
            usage: {
              today: dayUsage,
              dailyLimit: limits.daily
            },
            resetAt: tomorrow.toISOString(),
            upgradeRequired: tier === 'free',
            buyMoreUrl: '/pricing#credit-packs'
          });
        }
      }

      // Count this week's usage
      const weekUsage = await AIUsage.count({
        where: { userId, featureType, ...usedSince(weekStart, countFloor) }
      });

      // Check weekly limit (primarily for free tier)
      let subscriptionLimitReached = false;
      if (!isUnlimited(effectiveWeeklyLimit) && weekUsage >= effectiveWeeklyLimit) {
        subscriptionLimitReached = true;
      }

      // Count this month's usage
      const monthUsage = await AIUsage.count({
        where: { userId, featureType, ...usedSince(monthStart, countFloor) }
      });

      // Check monthly limit
      if (!subscriptionLimitReached && !isUnlimited(limits.monthly) && monthUsage >= limits.monthly) {
        subscriptionLimitReached = true;
      }

      // If subscription limit reached, check credit packs as overflow
      if (subscriptionLimitReached) {
        const { totalCredits } = await getAvailableCreditPackCredits(userId, featureType);
        
        if (totalCredits > 0) {
          // Has credit packs — allow through, mark for credit pack deduction
          req.aiUsage = {
            featureType,
            userId,
            limits,
            effectiveWeeklyLimit,
            promoBonus,
            useCreditPack: true,
            currentUsage: { week: weekUsage, month: monthUsage },
            creditPackCredits: totalCredits
          };
          return next();
        }

        // No credit packs either — blocked
        const nextWeek = getNextWeekStart();
        const nextMonth = new Date(monthStart);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        // Determine which limit was hit for the error message
        const isWeeklyLimitHit = !isUnlimited(effectiveWeeklyLimit) && weekUsage >= effectiveWeeklyLimit;
        
        return res.status(429).json({
          error: isWeeklyLimitHit ? 'Weekly limit reached' : 'Monthly limit reached',
          message: isWeeklyLimitHit
            ? `You've used all ${effectiveWeeklyLimit} weekly ${FEATURE_NAMES[featureType]} credits. Resets ${nextWeek.toLocaleDateString('en-US', { weekday: 'long' })}.`
            : `You've used all ${limits.monthly} monthly ${FEATURE_NAMES[featureType]} credits.`,
          featureType,
          usage: {
            week: weekUsage,
            weeklyLimit: effectiveWeeklyLimit,
            month: monthUsage,
            monthlyLimit: limits.monthly,
            promoBonus: promoBonus ? `${promoBonus.multiplier}x + ${promoBonus.flatBonus} flat` : null
          },
          resetAt: isWeeklyLimitHit ? nextWeek.toISOString() : nextMonth.toISOString(),
          upgradeRequired: tier === 'free',
          creditPacksAvailable: false,
          buyMoreUrl: '/pricing#credit-packs'
        });
      }

      // Within limits — proceed normally
      req.aiUsage = {
        featureType,
        userId,
        limits,
        effectiveWeeklyLimit,
        promoBonus,
        useCreditPack: false,
        currentUsage: { week: weekUsage, month: monthUsage }
      };

      next();
    } catch (error) {
      console.error('AI Rate Limiter error:', error);
      next();
    }
  };
};

/**
 * Record AI usage after successful completion.
 * Also deducts credit pack credits if the request used overflow.
 */
const recordAIUsage = async (userId, featureType, metadata = {}) => {
  try {
    const estimatedCost = ESTIMATED_COSTS[featureType] || 0;
    
    await AIUsage.create({
      userId,
      featureType,
      usedAt: new Date(),
      estimatedCost,
      metadata
    });

    // If this usage was marked for credit pack deduction, do it
    if (metadata.useCreditPack) {
      await deductCreditPackCredit(userId, featureType);
    }

    return true;
  } catch (error) {
    console.error('Error recording AI usage:', error);
    return false;
  }
};

/**
 * aiRateLimiter for signed-in callers only; guests pass straight through to
 * whatever guest limiter already ran (e.g. coachGuard's IP meter). Use after
 * optionalAuth / coachGuard, which set req.user when there is a token.
 */
const aiRateLimiterIfSignedIn = (featureType, options) => {
  const limiter = aiRateLimiter(featureType, options);
  return (req, res, next) => (req.user?.id ? limiter(req, res, next) : next());
};

// ── Live voice coach ─────────────────────────────────────────────────────
// Metered in minutes, not calls. The browser talks to OpenAI directly, so we
// never see the call end: a session is recorded at start with the minutes it
// was granted (metadata.minutes), and the client is told to hang up at that
// cap. settleVoiceSession can true it up later if an end hook is ever added.
const VOICE_FEATURE = 'coach_voice_session';

/**
 * What this user may start right now.
 * Returns { allowed, maxSessionMinutes, remainingMinutes, reason, tier }.
 * remainingMinutes is -1 when there is no monthly minute budget.
 */
const getVoiceAllowance = async (user) => {
  const role = user.role || 'candidate';
  let tier = user.subscriptionTier || 'free';
  if (role === 'candidate' && !user.aiOnboardingCompleted && !isPaidTier(tier)) {
    tier = 'onboarding';
  }
  const limits = getLimits(role, tier, VOICE_FEATURE);
  const maxSession = limits.maxSessionMinutes > 0 ? limits.maxSessionMinutes : 10;

  if (limits.weekly === 0 && limits.monthly === 0) {
    return { allowed: false, maxSessionMinutes: 0, remainingMinutes: 0, reason: 'not_available', tier };
  }

  if (limits.lifetime > 0) {
    const sessions = await AIUsage.count({ where: { userId: user.id, featureType: VOICE_FEATURE } });
    if (sessions >= limits.lifetime) {
      return { allowed: false, maxSessionMinutes: 0, remainingMinutes: 0, reason: 'lifetime_used', tier };
    }
  }

  let remainingMinutes = -1;
  if (limits.monthlyMinutes > 0) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const rows = await AIUsage.findAll({
      where: { userId: user.id, featureType: VOICE_FEATURE, usedAt: { [Op.gte]: monthStart } },
      attributes: ['metadata'],
    });
    const used = rows.reduce((sum, r) => sum + (Number(r.metadata?.minutes) || 0), 0);
    remainingMinutes = Math.max(0, limits.monthlyMinutes - used);
    // Under a minute left is not a call worth starting.
    if (remainingMinutes < 1) {
      return { allowed: false, maxSessionMinutes: 0, remainingMinutes: 0, reason: 'minutes_used', tier };
    }
  }

  const maxSessionMinutes = remainingMinutes === -1
    ? maxSession
    : Math.max(1, Math.min(maxSession, Math.floor(remainingMinutes)));
  return { allowed: true, maxSessionMinutes, remainingMinutes, reason: null, tier };
};

/**
 * Middleware for POST /coach/voice/session. Puts the allowance on
 * req.voiceAllowance, or answers 429 with an upgrade prompt.
 */
const coachVoiceSessionLimiter = async (req, res, next) => {
  if (process.env.DISABLE_AI_RATE_LIMIT === 'true') return next();
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const user = await User.findByPk(userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const allowance = await getVoiceAllowance(user);
    if (!allowance.allowed) {
      const message = allowance.reason === 'minutes_used'
        ? "You've used this month's voice coach minutes."
        : allowance.reason === 'lifetime_used'
          ? "You've had your free voice coach session. Upgrade to Pro for monthly voice minutes."
          : 'The voice coach is not available on your current plan.';
      return res.status(429).json({
        error: 'Voice limit reached',
        message,
        featureType: VOICE_FEATURE,
        reason: allowance.reason,
        upgradeRequired: !isPaidTier(user.subscriptionTier) || allowance.reason === 'minutes_used',
        buyMoreUrl: '/pricing',
      });
    }
    req.voiceAllowance = allowance;
    next();
  } catch (error) {
    // Same stance as aiRateLimiter: metering trouble never blocks the user.
    console.error('[voice limiter] error:', error.message);
    next();
  }
};

/** Record a started voice session against the minutes it was granted. */
const recordVoiceSession = async (userId, grantedMinutes, metadata = {}) => {
  try {
    return await AIUsage.create({
      userId,
      featureType: VOICE_FEATURE,
      usedAt: new Date(),
      estimatedCost: 0,
      metadata: { ...metadata, minutes: Number(grantedMinutes) || 0, settled: false },
    });
  } catch (error) {
    console.error('Error recording voice session:', error.message);
    return null;
  }
};

/** True a session up to the minutes actually spoken, once known. */
const settleVoiceSession = async (usageId, userId, actualMinutes) => {
  try {
    const row = await AIUsage.findOne({ where: { id: usageId, userId, featureType: VOICE_FEATURE } });
    if (!row) return false;
    const granted = Number(row.metadata?.minutes) || 0;
    const minutes = Math.max(0, Math.min(granted, Math.ceil(Number(actualMinutes) || 0)));
    row.metadata = { ...row.metadata, minutes, granted, settled: true };
    await row.save();
    return true;
  } catch (error) {
    console.error('Error settling voice session:', error.message);
    return false;
  }
};

/**
 * Get usage summary for a user (includes weekly limits + credit packs)
 */
const getUsageSummary = async (userId, role = 'candidate', tier = 'free') => {
  const weekStart = getWeekStart();
  const nextWeek = getNextWeekStart();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const featureTypes = [
    'resume_parse',
    'profile_enhance',
    'profile_coach',
    'tailor_profile',
    'cover_letter',
    'post_enhance',
    'career_suggestions',
    'job_match'
  ];

  const promoBonus = await getActivePromoBonus(userId);
  // Only candidates have onboarding-free features. A null here (no profile
  // yet) means nothing is floored: their usage so far is all free anyway.
  const firstProfileSavedAt = role === 'candidate'
    ? await getFirstProfileSavedAt(userId).catch(() => null)
    : null;
  const usage = {};

  for (const featureType of featureTypes) {
    try {
      const limits = getLimits(role, tier, featureType);

      let effectiveWeeklyLimit = limits.weekly;
      if (promoBonus && !isUnlimited(limits.weekly) && limits.weekly > 0) {
        effectiveWeeklyLimit = Math.floor(limits.weekly * promoBonus.multiplier) + promoBonus.flatBonus;
      }

      // Onboarding-free features ignore usage from before the first profile
      // save, exactly as aiRateLimiter does, so the meter matches the gate.
      const floor = ONBOARDING_FREE_FEATURES[featureType] ? firstProfileSavedAt : null;

      const weekUsage = await AIUsage.count({
        where: { userId, featureType, ...usedSince(weekStart, floor) }
      });
      const monthUsage = await AIUsage.count({
        where: { userId, featureType, ...usedSince(monthStart, floor) }
      });
      // Today's usage (for features with a daily cap)
      const dayUsage = await AIUsage.count({
        where: { userId, featureType, ...usedSince(dayStart, floor) }
      });
      // Lifetime usage (for features with a lifetime trial cap)
      const lifetimeUsage = await AIUsage.count({
        where: { userId, featureType, ...usedSince(null, floor) }
      });

      // Get credit pack credits
      const { totalCredits: creditPackCredits } = await getAvailableCreditPackCredits(userId, featureType);

      usage[featureType] = {
        name: FEATURE_NAMES[featureType],
        week: weekUsage,
        month: monthUsage,
        day: dayUsage,
        lifetime: lifetimeUsage,
        weeklyLimit: effectiveWeeklyLimit,
        baseWeeklyLimit: limits.weekly,
        monthlyLimit: limits.monthly,
        dailyLimit: limits.daily ?? -1,
        lifetimeLimit: limits.lifetime ?? -1,
        weeklyRemaining: isUnlimited(effectiveWeeklyLimit) ? -1 : Math.max(0, effectiveWeeklyLimit - weekUsage),
        monthlyRemaining: isUnlimited(limits.monthly) ? -1 : Math.max(0, limits.monthly - monthUsage),
        dailyRemaining: (!limits.daily || isUnlimited(limits.daily)) ? -1 : Math.max(0, limits.daily - dayUsage),
        lifetimeRemaining: (!limits.lifetime || isUnlimited(limits.lifetime)) ? -1 : Math.max(0, limits.lifetime - lifetimeUsage),
        creditPackCredits,
        hasPromoBonus: !!promoBonus
      };
    } catch (featureError) {
      // Don't let one bad feature type take down the whole usage summary —
      // log which feature + error caused it so it's diagnosable, and fall
      // back to a safe "everything unlimited-looking is off" default.
      console.error(`[getUsageSummary] Failed to compute usage for feature "${featureType}" (user ${userId}, role ${role}, tier ${tier}):`, featureError);
      usage[featureType] = {
        name: FEATURE_NAMES[featureType] || featureType,
        week: 0, month: 0, day: 0, lifetime: 0,
        weeklyLimit: 0, baseWeeklyLimit: 0, monthlyLimit: 0, dailyLimit: -1, lifetimeLimit: -1,
        weeklyRemaining: 0, monthlyRemaining: 0, dailyRemaining: -1, lifetimeRemaining: -1,
        creditPackCredits: 0,
        hasPromoBonus: !!promoBonus,
        error: true
      };
    }
  }

  return {
    tier,
    role,
    usage,
    promoBonus: promoBonus ? {
      multiplier: promoBonus.multiplier,
      flatBonus: promoBonus.flatBonus
    } : null,
    weeklyResetDate: nextWeek.toISOString().split('T')[0],
    monthlyResetDate: nextMonth.toISOString().split('T')[0]
  };
};

module.exports = {
  aiRateLimiter,
  aiRateLimiterIfSignedIn,
  getVoiceAllowance,
  coachVoiceSessionLimiter,
  recordVoiceSession,
  settleVoiceSession,
  isPaidTier,
  recordAIUsage,
  getUsageSummary,
  getAvailableCreditPackCredits,
  deductCreditPackCredit
};
