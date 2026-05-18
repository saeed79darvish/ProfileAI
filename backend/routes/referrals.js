const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const { User, Referral } = require('../models');

// @route   GET /api/referrals/my-code
// @desc    Get or create user's referral code
// @access  Private
router.get('/my-code', auth, async (req, res) => {
  try {
    // Find existing active referral code for user
    let referral = await Referral.findOne({
      where: {
        referrerId: req.user.id,
        status: 'pending',
        referredUserId: null
      },
      order: [['createdAt', 'DESC']]
    });
    
    // If no active code, create one
    if (!referral) {
      referral = await Referral.create({
        referrerId: req.user.id,
        code: Referral.generateCode()
      });
    }
    
    // Get referral stats
    const completedReferrals = await Referral.count({
      where: {
        referrerId: req.user.id,
        status: { [Op.in]: ['completed', 'rewarded'] }
      }
    });
    
    const pendingRewards = await Referral.count({
      where: {
        referrerId: req.user.id,
        status: 'completed' // Completed but not yet rewarded
      }
    });
    
    // Use proper URL based on environment
    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' 
      ? 'https://profileai.app' 
      : 'http://localhost:3000');
    
    res.json({
      code: referral.code,
      referralLink: `${frontendUrl}/register?ref=${referral.code}`,
      stats: {
        totalReferred: completedReferrals,
        pendingRewards,
        totalClicks: referral.clickCount
      }
    });
  } catch (error) {
    console.error('Error getting referral code:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/referrals/my-referrals
// @desc    Get all referrals made by user
// @access  Private
router.get('/my-referrals', auth, async (req, res) => {
  try {
    const referrals = await Referral.findAll({
      where: {
        referrerId: req.user.id,
        referredUserId: { [Op.not]: null }
      },
      include: [{
        model: User,
        as: 'referredUser',
        attributes: ['id', 'firstName', 'lastName', 'createdAt']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    // Calculate totals
    const totalReferred = referrals.length;
    const totalRewarded = referrals.filter(r => r.status === 'rewarded').length;
    const totalPremiumDaysEarned = referrals
      .filter(r => r.status === 'rewarded' && r.rewardType === 'premium_days')
      .reduce((sum, r) => sum + r.rewardAmount, 0);
    
    res.json({
      referrals: referrals.map(r => ({
        id: r.id,
        referredUser: r.referredUser ? {
          id: r.referredUser.id,
          name: `${r.referredUser.firstName} ${r.referredUser.lastName}`,
          joinedAt: r.referredUser.createdAt
        } : null,
        status: r.status,
        rewardType: r.rewardType,
        rewardAmount: r.rewardAmount,
        rewardedAt: r.rewardedAt,
        createdAt: r.createdAt
      })),
      stats: {
        totalReferred,
        totalRewarded,
        totalPremiumDaysEarned,
        pendingRewards: totalReferred - totalRewarded
      }
    });
  } catch (error) {
    console.error('Error getting referrals:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/referrals/track-click
// @desc    Track when someone clicks a referral link
// @access  Public
router.post('/track-click', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Referral code is required' });
    }
    
    const referral = await Referral.findOne({
      where: { code: code.toUpperCase() }
    });
    
    if (!referral) {
      return res.status(404).json({ message: 'Invalid referral code' });
    }
    
    // Increment click count
    await referral.increment('clickCount');
    
    res.json({ valid: true });
  } catch (error) {
    console.error('Error tracking referral click:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/referrals/validate
// @desc    Validate a referral code (used during signup)
// @access  Public
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ valid: false, message: 'Referral code is required' });
    }
    
    const referral = await Referral.findOne({
      where: {
        code: code.toUpperCase(),
        status: 'pending'
      },
      include: [{
        model: User,
        as: 'referrer',
        attributes: ['id', 'firstName']
      }]
    });
    
    if (!referral) {
      return res.json({ valid: false, message: 'Invalid or already used referral code' });
    }
    
    res.json({
      valid: true,
      referrer: referral.referrer ? referral.referrer.firstName : 'A friend',
      message: `You were invited by ${referral.referrer?.firstName || 'a friend'}!`
    });
  } catch (error) {
    console.error('Error validating referral:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/referrals/complete-by-referrer
// @desc    Complete a referral using referrer's user ID (from shared profile links)
// @access  Private
router.post('/complete-by-referrer', auth, async (req, res) => {
  try {
    const { referrerId } = req.body;
    
    if (!referrerId) {
      return res.json({ success: false, message: 'No referrer ID provided' });
    }
    
    // Can't refer yourself
    if (referrerId === req.user.id) {
      return res.json({ success: false, message: 'Cannot refer yourself' });
    }
    
    // Check referrer exists
    const referrer = await User.findByPk(referrerId);
    if (!referrer) {
      return res.json({ success: false, message: 'Referrer not found' });
    }
    
    // Check if this user was already referred
    const existingReferral = await Referral.findOne({
      where: { referredUserId: req.user.id, status: { [Op.in]: ['completed', 'rewarded'] } }
    });
    if (existingReferral) {
      return res.json({ success: false, message: 'Already referred' });
    }
    
    // Create and complete referral in one step
    const referral = await Referral.create({
      referrerId,
      referredUserId: req.user.id,
      code: Referral.generateCode(),
      status: 'completed',
      source: 'direct',
      metadata: { fromPublicProfile: true }
    });
    
    // Check milestone rewards
    const completedCount = await Referral.count({
      where: { referrerId, status: { [Op.in]: ['completed', 'rewarded'] } }
    });
    
    const milestones = [1, 3, 5, 10, 25, 50, 100];
    let rewardGranted = false;
    
    if (milestones.includes(completedCount)) {
      const currentExpiry = referrer.subscriptionExpiresAt 
        ? new Date(referrer.subscriptionExpiresAt)
        : new Date();
      
      const daysToAdd = completedCount >= 10 ? 60 : completedCount >= 5 ? 30 : 7;
      const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()));
      newExpiry.setDate(newExpiry.getDate() + daysToAdd);
      
      await referrer.update({
        subscriptionTier: referrer.subscriptionTier === 'free' ? 'pro' : referrer.subscriptionTier,
        subscriptionExpiresAt: newExpiry
      });
      
      await referral.update({
        status: 'rewarded',
        rewardedAt: new Date(),
        rewardAmount: daysToAdd
      });
      
      rewardGranted = true;
    }
    
    res.json({
      success: true,
      message: 'Referral completed! Thanks for joining via a friend.',
      referrerRewarded: rewardGranted
    });
  } catch (error) {
    console.error('Error completing referral by referrer:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/referrals/complete
// @desc    Complete a referral (called after successful signup)
// @access  Private
router.post('/complete', auth, async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.json({ success: false, message: 'No referral code provided' });
    }
    
    // Find the pending referral
    const referral = await Referral.findOne({
      where: {
        code: code.toUpperCase(),
        status: 'pending'
      }
    });
    
    if (!referral) {
      return res.json({ success: false, message: 'Invalid or already used referral code' });
    }
    
    // Can't refer yourself
    if (referral.referrerId === req.user.id) {
      return res.json({ success: false, message: 'Cannot use your own referral code' });
    }
    
    // Update referral with new user
    await referral.update({
      referredUserId: req.user.id,
      status: 'completed'
    });
    
    // Check if referrer qualifies for reward (e.g., 3 referrals = 1 month premium)
    const completedCount = await Referral.count({
      where: {
        referrerId: referral.referrerId,
        status: 'completed'
      }
    });
    
    // Auto-reward at milestones (3, 5, 10, etc.)
    const milestones = [3, 5, 10, 25, 50, 100];
    let rewardGranted = false;
    
    if (milestones.includes(completedCount)) {
      // Grant premium days to referrer
      const referrer = await User.findByPk(referral.referrerId);
      if (referrer) {
        const currentExpiry = referrer.subscriptionExpiresAt 
          ? new Date(referrer.subscriptionExpiresAt)
          : new Date();
        
        const daysToAdd = completedCount >= 10 ? 60 : 30; // More days for higher milestones
        const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()));
        newExpiry.setDate(newExpiry.getDate() + daysToAdd);
        
        await referrer.update({
          subscriptionTier: referrer.subscriptionTier === 'free' ? 'pro' : referrer.subscriptionTier,
          subscriptionExpiresAt: newExpiry
        });
        
        // Mark referral as rewarded
        await referral.update({
          status: 'rewarded',
          rewardedAt: new Date(),
          rewardAmount: daysToAdd
        });
        
        rewardGranted = true;
      }
    }
    
    res.json({
      success: true,
      message: 'Referral completed!',
      referrerRewarded: rewardGranted
    });
  } catch (error) {
    console.error('Error completing referral:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/referrals/share
// @desc    Log when user shares their referral link
// @access  Private
router.post('/share', auth, async (req, res) => {
  try {
    const { source = 'direct' } = req.body;
    
    // Create a new referral entry for tracking this share
    const referral = await Referral.create({
      referrerId: req.user.id,
      code: Referral.generateCode(),
      source
    });
    
    res.json({
      success: true,
      code: referral.code,
      referralLink: `${process.env.FRONTEND_URL || 'https://profileai.app'}/signup?ref=${referral.code}`
    });
  } catch (error) {
    console.error('Error sharing referral:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/referrals/leaderboard
// @desc    Get top referrers
// @access  Public
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // This is a raw query for aggregation
    const topReferrers = await Referral.findAll({
      where: {
        status: { [Op.in]: ['completed', 'rewarded'] }
      },
      attributes: [
        'referrerId',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'referralCount']
      ],
      include: [{
        model: User,
        as: 'referrer',
        attributes: ['id', 'firstName', 'lastName']
      }],
      group: ['referrerId', 'referrer.id'],
      order: [[require('sequelize').literal('COUNT(id)'), 'DESC']],
      limit: parseInt(limit)
    });
    
    res.json({
      leaderboard: topReferrers.map((r, index) => ({
        rank: index + 1,
        user: r.referrer ? {
          id: r.referrer.id,
          name: `${r.referrer.firstName} ${r.referrer.lastName?.charAt(0) || ''}.`
        } : null,
        referralCount: parseInt(r.dataValues.referralCount)
      }))
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
