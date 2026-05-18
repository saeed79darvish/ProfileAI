const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { UserReputation, UserBadge, User, Profile, sequelize } = require('../models');
const { Op } = require('sequelize');

// ============================================
// GET /api/reputation/me - Get current user's stats
// ============================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    let reputation = await UserReputation.findOne({
      where: { userId: req.user.id }
    });

    // Create reputation record if it doesn't exist
    if (!reputation) {
      reputation = await UserReputation.create({
        userId: req.user.id,
        teachingCredits: 0,
        sessionsHosted: 0,
        sessionsAttended: 0,
        peopleHelped: 0,
        totalRatingsGiven: 0,
        totalRatingsReceived: 0,
        averageRating: 0,
        level: 'newcomer'
      });
    }

    // Get badges
    const badges = await UserBadge.findAll({
      where: { userId: req.user.id }
    });

    res.json({
      reputation,
      badges
    });
  } catch (error) {
    console.error('Failed to get reputation:', error);
    res.status(500).json({ message: 'Failed to get reputation', error: error.message });
  }
});

// ============================================
// GET /api/reputation/:userId - Get user's reputation
// ============================================
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const reputation = await UserReputation.findOne({
      where: { userId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName']
      }]
    });

    if (!reputation) {
      return res.status(404).json({ message: 'Reputation not found' });
    }

    const badges = await UserBadge.findAll({
      where: { userId }
    });

    res.json({
      reputation,
      badges
    });
  } catch (error) {
    console.error('Failed to get reputation:', error);
    res.status(500).json({ message: 'Failed to get reputation', error: error.message });
  }
});

// ============================================
// GET /api/reputation/leaderboard - Get leaderboard
// ============================================
router.get('/leaderboard', async (req, res) => {
  try {
    const { category = 'teachingCredits', limit = 10 } = req.query;

    const validCategories = ['teachingCredits', 'sessionsHosted', 'peopleHelped', 'averageRating'];
    const sortField = validCategories.includes(category) ? category : 'teachingCredits';

    const leaderboard = await UserReputation.findAll({
      order: [[sortField, 'DESC']],
      limit: parseInt(limit, 10),
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName'],
        include: [{
          model: Profile,
          attributes: ['profilePicture', 'headline']
        }]
      }]
    });

    res.json({ leaderboard });
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    res.status(500).json({ message: 'Failed to get leaderboard', error: error.message });
  }
});

// ============================================
// GET /api/badges/me - Get current user's badges
// ============================================
router.get('/badges/me', authMiddleware, async (req, res) => {
  try {
    const badges = await UserBadge.findAll({
      where: { userId: req.user.id }
    });

    // Define all possible badges with progress
    const allBadges = [
      { type: 'first_steps', name: 'First Steps', description: 'Attend your first session', icon: '🎯' },
      { type: 'educator', name: 'Educator', description: 'Host 5 teaching sessions', icon: '📚' },
      { type: 'mentor_master', name: 'Mentor Master', description: 'Complete 10 mentorship sessions', icon: '🧠' },
      { type: 'team_player', name: 'Team Player', description: 'Join 10 team showcases', icon: '👥' },
      { type: 'rising_star', name: 'Rising Star', description: 'Get 50 total attendees', icon: '⭐' },
      { type: 'knowledge_sharer', name: 'Knowledge Sharer', description: 'Share 20 resources', icon: '📖' },
      { type: 'community_builder', name: 'Community Builder', description: 'Help 100 people', icon: '🏆' }
    ];

    const earnedBadgeTypes = badges.map(b => b.badgeType);
    const badgesWithStatus = allBadges.map(badge => ({
      ...badge,
      earned: earnedBadgeTypes.includes(badge.type),
      earnedAt: badges.find(b => b.badgeType === badge.type)?.createdAt
    }));

    res.json({ badges: badgesWithStatus });
  } catch (error) {
    console.error('Failed to get badges:', error);
    res.status(500).json({ message: 'Failed to get badges', error: error.message });
  }
});

module.exports = router;
