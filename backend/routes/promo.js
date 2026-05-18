const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const { User, PromoCode, PromoRedemption } = require('../models');

// ─── USER ENDPOINTS ───────────────────────────────────────────

// @route   POST /api/promo/redeem
// @desc    Redeem a promo code
// @access  Private
router.post('/redeem', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Promo code is required' });
    }

    const normalizedCode = code.trim().toUpperCase();

    // Find the promo code
    const promo = await PromoCode.findOne({
      where: { code: normalizedCode, isActive: true }
    });

    if (!promo) {
      return res.status(404).json({ error: 'Invalid promo code' });
    }

    // Check validity window
    const now = new Date();
    if (promo.validFrom && now < new Date(promo.validFrom)) {
      return res.status(400).json({ error: 'This promo code is not active yet' });
    }
    if (promo.validUntil && now > new Date(promo.validUntil)) {
      return res.status(400).json({ error: 'This promo code has expired' });
    }

    // Check max redemptions
    if (promo.maxRedemptions !== null && promo.currentRedemptions >= promo.maxRedemptions) {
      return res.status(400).json({ error: 'This promo code has reached its redemption limit' });
    }

    // Check if user already redeemed this code
    const existing = await PromoRedemption.findOne({
      where: { userId: req.user.id, promoCodeId: promo.id }
    });
    if (existing) {
      return res.status(400).json({ error: 'You have already redeemed this promo code' });
    }

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + promo.durationDays);

    // Create redemption
    const redemption = await PromoRedemption.create({
      userId: req.user.id,
      promoCodeId: promo.id,
      type: promo.type,
      dailyMultiplier: promo.dailyMultiplier,
      dailyBonusFlat: promo.dailyBonusFlat,
      grantTier: promo.grantTier,
      expiresAt,
      isActive: true
    });

    // Increment redemption count
    await promo.increment('currentRedemptions');

    // If subscription_upgrade, update user tier
    if (promo.type === 'subscription_upgrade' && promo.grantTier) {
      const user = await User.findByPk(req.user.id);
      // Only upgrade, don't downgrade
      const tierRank = { free: 0, pro: 1, enterprise: 2 };
      if (tierRank[promo.grantTier] > tierRank[user.subscriptionTier]) {
        user.subscriptionTier = promo.grantTier;
        user.subscriptionStatus = 'active';
        user.subscriptionExpiresAt = expiresAt;
        await user.save();
      }
    }

    // Build user-friendly benefit description
    let benefitMessage = '';
    if (promo.type === 'ai_bonus') {
      if (promo.dailyMultiplier > 1) {
        benefitMessage = `${promo.dailyMultiplier}x daily AI credits`;
      }
      if (promo.dailyBonusFlat > 0) {
        benefitMessage += benefitMessage ? ` + ${promo.dailyBonusFlat} bonus per feature` : `+${promo.dailyBonusFlat} daily AI credits per feature`;
      }
      benefitMessage += ` for ${promo.durationDays} days`;
    } else if (promo.type === 'subscription_upgrade') {
      benefitMessage = `${promo.grantTier} plan access for ${promo.durationDays} days`;
    } else if (promo.type === 'trial_extension') {
      benefitMessage = `Trial extended by ${promo.durationDays} days`;
    }

    res.json({
      success: true,
      message: `Promo code "${normalizedCode}" applied successfully!`,
      benefit: benefitMessage,
      expiresAt: expiresAt.toISOString(),
      redemption: {
        id: redemption.id,
        type: redemption.type,
        dailyMultiplier: redemption.dailyMultiplier,
        dailyBonusFlat: redemption.dailyBonusFlat,
        expiresAt: redemption.expiresAt
      }
    });
  } catch (error) {
    console.error('Error redeeming promo code:', error);
    res.status(500).json({ error: 'Failed to redeem promo code' });
  }
});

// @route   GET /api/promo/my-promos
// @desc    Get user's active promo benefits
// @access  Private
router.get('/my-promos', auth, async (req, res) => {
  try {
    const redemptions = await PromoRedemption.findAll({
      where: {
        userId: req.user.id,
        isActive: true,
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [{
        model: PromoCode,
        as: 'promoCode',
        attributes: ['code', 'description', 'type']
      }],
      order: [['expiresAt', 'DESC']]
    });

    res.json({
      activePromos: redemptions.map(r => ({
        id: r.id,
        code: r.promoCode?.code,
        description: r.promoCode?.description,
        type: r.type,
        dailyMultiplier: r.dailyMultiplier,
        dailyBonusFlat: r.dailyBonusFlat,
        grantTier: r.grantTier,
        expiresAt: r.expiresAt,
        daysRemaining: Math.max(0, Math.ceil((new Date(r.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
      }))
    });
  } catch (error) {
    console.error('Error fetching user promos:', error);
    res.status(500).json({ error: 'Failed to fetch promo benefits' });
  }
});

// ─── ADMIN ENDPOINTS ──────────────────────────────────────────

// @route   POST /api/promo/admin/create
// @desc    Create a new promo code (admin only)
// @access  Private (admin)
router.post('/admin/create', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      code,
      description,
      type = 'ai_bonus',
      dailyMultiplier = 2,
      dailyBonusFlat = 0,
      grantTier,
      durationDays = 30,
      maxRedemptions = null,
      validFrom,
      validUntil
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Promo code is required' });
    }

    const normalizedCode = code.trim().toUpperCase();

    // Check uniqueness
    const existing = await PromoCode.findOne({ where: { code: normalizedCode } });
    if (existing) {
      return res.status(400).json({ error: 'A promo code with this name already exists' });
    }

    const promo = await PromoCode.create({
      code: normalizedCode,
      description,
      type,
      dailyMultiplier: type === 'ai_bonus' ? dailyMultiplier : null,
      dailyBonusFlat: type === 'ai_bonus' ? dailyBonusFlat : null,
      grantTier: type === 'subscription_upgrade' ? grantTier : null,
      durationDays,
      maxRedemptions,
      validFrom: validFrom || new Date(),
      validUntil: validUntil || null,
      isActive: true,
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, promoCode: promo });
  } catch (error) {
    console.error('Error creating promo code:', error);
    res.status(500).json({ error: 'Failed to create promo code' });
  }
});

// @route   GET /api/promo/admin/list
// @desc    List all promo codes (admin only)
// @access  Private (admin)
router.get('/admin/list', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const promos = await PromoCode.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.json({ promoCodes: promos });
  } catch (error) {
    console.error('Error listing promo codes:', error);
    res.status(500).json({ error: 'Failed to list promo codes' });
  }
});

// @route   PUT /api/promo/admin/:id
// @desc    Update a promo code (admin only)
// @access  Private (admin)
router.put('/admin/:id', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const promo = await PromoCode.findByPk(req.params.id);
    if (!promo) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    const allowed = ['description', 'isActive', 'maxRedemptions', 'validUntil', 'dailyMultiplier', 'dailyBonusFlat', 'durationDays'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        promo[key] = req.body[key];
      }
    }
    await promo.save();

    res.json({ success: true, promoCode: promo });
  } catch (error) {
    console.error('Error updating promo code:', error);
    res.status(500).json({ error: 'Failed to update promo code' });
  }
});

module.exports = router;
