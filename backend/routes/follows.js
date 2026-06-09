const express = require('express');
const router = express.Router();
const { Follow, User, Profile, RecruiterProfile } = require('../models');
const auth = require('../middleware/auth');
const { Op } = require('sequelize');
const { isUuid } = require('../utils/slug');

// @route   POST /api/follows/:userId
// @desc    Follow a user
// @access  Private
router.post('/:userId', auth, async (req, res) => {
  try {
    const followingId = req.params.userId;
    const followerId = req.user.id;

    // Can't follow yourself
    if (followerId === followingId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    // Check if target user exists
    const targetUser = await User.findByPk(followingId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      where: { followerId, followingId }
    });

    if (existingFollow) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    // Create follow relationship
    await Follow.create({ followerId, followingId });

    // Get updated counts
    const followersCount = await Follow.count({ where: { followingId } });
    const followingCount = await Follow.count({ where: { followerId: followingId } });

    res.status(201).json({
      success: true,
      message: 'Successfully followed user',
      followersCount,
      followingCount
    });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/follows/:userId
// @desc    Unfollow a user
// @access  Private
router.delete('/:userId', auth, async (req, res) => {
  try {
    const followingId = req.params.userId;
    const followerId = req.user.id;

    const follow = await Follow.findOne({
      where: { followerId, followingId }
    });

    if (!follow) {
      return res.status(400).json({ error: 'Not following this user' });
    }

    await follow.destroy();

    // Get updated counts
    const followersCount = await Follow.count({ where: { followingId } });
    const followingCount = await Follow.count({ where: { followerId: followingId } });

    res.json({
      success: true,
      message: 'Successfully unfollowed user',
      followersCount,
      followingCount
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/follows/status/:userId
// @desc    Check if current user is following a user
// @access  Private
router.get('/status/:userId', auth, async (req, res) => {
  try {
    let followingId = req.params.userId;
    const followerId = req.user.id;

    // Accept a public slug as well as a UUID (followingId is a UUID column).
    if (!isUuid(followingId)) {
      const userBySlug = await User.findOne({ where: { slug: followingId }, attributes: ['id'] });
      if (!userBySlug) {
        return res.json({ isFollowing: false, followersCount: 0, followingCount: 0 });
      }
      followingId = userBySlug.id;
    }

    const follow = await Follow.findOne({
      where: { followerId, followingId }
    });

    const followersCount = await Follow.count({ where: { followingId } });
    const followingCount = await Follow.count({ where: { followerId: followingId } });

    res.json({
      isFollowing: !!follow,
      followersCount,
      followingCount
    });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/follows/followers/:userId
// @desc    Get followers of a user
// @access  Public
router.get('/followers/:userId', async (req, res) => {
  try {
    let userId = req.params.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Accept a public slug as well as a UUID (followingId is a UUID column).
    if (!isUuid(userId)) {
      const userBySlug = await User.findOne({ where: { slug: userId }, attributes: ['id'] });
      if (!userBySlug) {
        return res.json({ followers: [], total: 0, page: parseInt(page), pages: 0 });
      }
      userId = userBySlug.id;
    }

    const { count, rows: followers } = await Follow.findAndCountAll({
      where: { followingId: userId },
      include: [{
        model: User,
        as: 'follower',
        attributes: ['id', 'firstName', 'lastName', 'role'],
        include: [
          {
            model: Profile,
            as: 'profile',
            attributes: ['headline', 'profilePicture']
          },
          {
            model: RecruiterProfile,
            as: 'recruiterProfile',
            attributes: ['companyName', 'jobTitle', 'profilePicture']
          }
        ]
      }],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Format the response
    const formattedFollowers = followers.map(f => {
      const user = f.follower;
      const isRecruiter = user.role === 'recruiter';
      const profile = isRecruiter ? user.recruiterProfile : user.profile;
      
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        headline: isRecruiter ? profile?.jobTitle : profile?.headline,
        companyName: isRecruiter ? profile?.companyName : null,
        profilePicture: profile?.profilePicture,
        followedAt: f.createdAt
      };
    });

    res.json({
      followers: formattedFollowers,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/follows/following/:userId
// @desc    Get users that a user is following
// @access  Public
router.get('/following/:userId', async (req, res) => {
  try {
    let userId = req.params.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Accept a public slug as well as a UUID (followerId is a UUID column).
    if (!isUuid(userId)) {
      const userBySlug = await User.findOne({ where: { slug: userId }, attributes: ['id'] });
      if (!userBySlug) {
        return res.json({ following: [], total: 0, page: parseInt(page), pages: 0 });
      }
      userId = userBySlug.id;
    }

    const { count, rows: following } = await Follow.findAndCountAll({
      where: { followerId: userId },
      include: [{
        model: User,
        as: 'followedUser',
        attributes: ['id', 'firstName', 'lastName', 'role'],
        include: [
          {
            model: Profile,
            as: 'profile',
            attributes: ['headline', 'profilePicture']
          },
          {
            model: RecruiterProfile,
            as: 'recruiterProfile',
            attributes: ['companyName', 'jobTitle', 'profilePicture']
          }
        ]
      }],
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Format the response
    const formattedFollowing = following.map(f => {
      const user = f.followedUser;
      const isRecruiter = user.role === 'recruiter';
      const profile = isRecruiter ? user.recruiterProfile : user.profile;
      
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        headline: isRecruiter ? profile?.jobTitle : profile?.headline,
        companyName: isRecruiter ? profile?.companyName : null,
        profilePicture: profile?.profilePicture,
        followedAt: f.createdAt
      };
    });

    res.json({
      following: formattedFollowing,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/follows/counts/:userId
// @desc    Get follower and following counts for a user
// @access  Public
router.get('/counts/:userId', async (req, res) => {
  try {
    // The param may be a UUID or a public slug (e.g. /profile/saeed-darvish-2).
    // Follow.followingId/followerId are UUID columns, so passing a slug throws
    // 22P02 (invalid input syntax for uuid). Resolve a slug to its userId first;
    // a UUID is used as-is. Unknown slug → zero counts (not a 500).
    let userId = req.params.userId;
    if (!isUuid(userId)) {
      const userBySlug = await User.findOne({ where: { slug: userId }, attributes: ['id'] });
      if (!userBySlug) {
        return res.json({ followersCount: 0, followingCount: 0 });
      }
      userId = userBySlug.id;
    }

    const followersCount = await Follow.count({ where: { followingId: userId } });
    const followingCount = await Follow.count({ where: { followerId: userId } });

    res.json({
      followersCount,
      followingCount
    });
  } catch (error) {
    console.error('Error fetching follow counts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
