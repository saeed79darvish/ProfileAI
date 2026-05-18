const { Op } = require('sequelize');
const { AIUsage, User, PromoRedemption, CreditPack } = require('../models');
const { getLimits, isUnlimited, ESTIMATED_COSTS, FEATURE_NAMES, getWeekStart, getNextWeekStart } = require('../config/aiLimits');

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
 */
const aiRateLimiter = (featureType) => {
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
      const tier = user.subscriptionTier || 'free';
      
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
          where: { userId, featureType }
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
          where: {
            userId,
            featureType,
            usedAt: { [Op.gte]: todayStart }
          }
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
        where: {
          userId,
          featureType,
          usedAt: { [Op.gte]: weekStart }
        }
      });

      // Check weekly limit (primarily for free tier)
      let subscriptionLimitReached = false;
      if (!isUnlimited(effectiveWeeklyLimit) && weekUsage >= effectiveWeeklyLimit) {
        subscriptionLimitReached = true;
      }

      // Count this month's usage
      const monthUsage = await AIUsage.count({
        where: {
          userId,
          featureType,
          usedAt: { [Op.gte]: monthStart }
        }
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

  const featureTypes = [
    'resume_parse',
    'profile_enhance',
    'tailor_profile',
    'cover_letter',
    'post_enhance',
    'career_suggestions'
  ];

  const promoBonus = await getActivePromoBonus(userId);
  const usage = {};

  for (const featureType of featureTypes) {
    const limits = getLimits(role, tier, featureType);

    let effectiveWeeklyLimit = limits.weekly;
    if (promoBonus && !isUnlimited(limits.weekly) && limits.weekly > 0) {
      effectiveWeeklyLimit = Math.floor(limits.weekly * promoBonus.multiplier) + promoBonus.flatBonus;
    }

    // Count this week's usage
    const weekUsage = await AIUsage.count({
      where: {
        userId,
        featureType,
        usedAt: { [Op.gte]: weekStart }
      }
    });

    // Count this month's usage
    const monthUsage = await AIUsage.count({
      where: {
        userId,
        featureType,
        usedAt: { [Op.gte]: monthStart }
      }
    });

    // Get credit pack credits
    const { totalCredits: creditPackCredits } = await getAvailableCreditPackCredits(userId, featureType);

    usage[featureType] = {
      name: FEATURE_NAMES[featureType],
      week: weekUsage,
      month: monthUsage,
      weeklyLimit: effectiveWeeklyLimit,
      baseWeeklyLimit: limits.weekly,
      monthlyLimit: limits.monthly,
      weeklyRemaining: isUnlimited(effectiveWeeklyLimit) ? -1 : Math.max(0, effectiveWeeklyLimit - weekUsage),
      monthlyRemaining: isUnlimited(limits.monthly) ? -1 : Math.max(0, limits.monthly - monthUsage),
      creditPackCredits,
      hasPromoBonus: !!promoBonus
    };
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
  recordAIUsage,
  getUsageSummary,
  getAvailableCreditPackCredits,
  deductCreditPackCredit
};
