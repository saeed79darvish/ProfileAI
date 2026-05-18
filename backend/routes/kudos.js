const express = require('express');
const router = express.Router();
const { Op, literal, fn, col } = require('sequelize');
const auth = require('../middleware/auth');
const { User, Profile, Post, Kudos, Notification } = require('../models');

// @route   GET /api/kudos/types
// @desc    Get all kudos types
// @access  Public
router.get('/types', (req, res) => {
  res.json(Kudos.getAllTypes());
});

// @route   POST /api/kudos
// @desc    Give kudos to someone
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { receiverId, type, message, postId, profileId, isPublic = true } = req.body;
    const senderId = req.user.id;

    // Validate receiver exists
    const receiver = await User.findByPk(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Can't give kudos to yourself
    if (senderId === receiverId) {
      return res.status(400).json({ message: "You can't give kudos to yourself" });
    }

    // Validate type
    const validTypes = ['great_work', 'helpful', 'inspiring', 'expert', 'game_changer'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid kudos type' });
    }

    // If postId provided, check if already gave kudos on this post
    if (postId) {
      const existingKudos = await Kudos.findOne({
        where: {
          senderId,
          postId
        }
      });
      if (existingKudos) {
        return res.status(400).json({ message: 'You already gave kudos on this post' });
      }

      // Validate post exists
      const post = await Post.findByPk(postId);
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
    }

    // Create kudos
    const kudos = await Kudos.create({
      senderId,
      receiverId,
      type,
      message: message || null,
      postId: postId || null,
      profileId: profileId || null,
      isPublic
    });

    // Get sender info for response
    const sender = await User.findByPk(senderId, {
      attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
    });

    // Create notification for receiver
    const typeInfo = Kudos.getTypeInfo(type);
    await Notification.create({
      userId: receiverId,
      type: 'kudos',
      title: `${sender.firstName} gave you kudos!`,
      message: `${typeInfo.emoji} ${typeInfo.label}${message ? `: "${message}"` : ''}`,
      data: {
        kudosId: kudos.id,
        senderId,
        senderName: `${sender.firstName} ${sender.lastName}`,
        kudosType: type,
        postId
      }
    });

    res.status(201).json({
      ...kudos.toJSON(),
      sender: {
        id: sender.id,
        firstName: sender.firstName,
        lastName: sender.lastName,
        profilePictureUrl: sender.profilePictureUrl
      },
      typeInfo
    });
  } catch (error) {
    console.error('Error giving kudos:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/kudos/:id
// @desc    Remove kudos
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const kudos = await Kudos.findByPk(req.params.id);
    
    if (!kudos) {
      return res.status(404).json({ message: 'Kudos not found' });
    }

    // Only sender can remove their kudos
    if (kudos.senderId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await kudos.destroy();
    res.json({ message: 'Kudos removed' });
  } catch (error) {
    console.error('Error removing kudos:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/kudos/post/:postId
// @desc    Get all kudos for a post
// @access  Public
router.get('/post/:postId', async (req, res) => {
  try {
    const kudos = await Kudos.findAll({
      where: { postId: req.params.postId },
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }],
      order: [['createdAt', 'DESC']]
    });

    // Add type info to each kudos
    const kudosWithInfo = kudos.map(k => ({
      ...k.toJSON(),
      typeInfo: Kudos.getTypeInfo(k.type)
    }));

    res.json(kudosWithInfo);
  } catch (error) {
    console.error('Error getting post kudos:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/kudos/received
// @desc    Get kudos received by current user
// @access  Private
router.get('/received', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: kudos } = await Kudos.findAndCountAll({
      where: { receiverId: req.user.id },
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }, {
        model: Post,
        as: 'post',
        attributes: ['id', 'content'],
        required: false
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    const kudosWithInfo = kudos.map(k => ({
      ...k.toJSON(),
      typeInfo: Kudos.getTypeInfo(k.type)
    }));

    res.json({
      kudos: kudosWithInfo,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Error getting received kudos:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/kudos/given
// @desc    Get kudos given by current user
// @access  Private
router.get('/given', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: kudos } = await Kudos.findAndCountAll({
      where: { senderId: req.user.id },
      include: [{
        model: User,
        as: 'receiver',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }, {
        model: Post,
        as: 'post',
        attributes: ['id', 'content'],
        required: false
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    const kudosWithInfo = kudos.map(k => ({
      ...k.toJSON(),
      typeInfo: Kudos.getTypeInfo(k.type)
    }));

    res.json({
      kudos: kudosWithInfo,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Error getting given kudos:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/kudos/stats
// @desc    Get kudos stats for current user
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total received
    const totalReceived = await Kudos.count({
      where: { receiverId: userId }
    });

    // Total given
    const totalGiven = await Kudos.count({
      where: { senderId: userId }
    });

    // Received this week
    const receivedThisWeek = await Kudos.count({
      where: {
        receiverId: userId,
        createdAt: { [Op.gte]: weekAgo }
      }
    });

    // Given this week
    const givenThisWeek = await Kudos.count({
      where: {
        senderId: userId,
        createdAt: { [Op.gte]: weekAgo }
      }
    });

    // Kudos by type received
    const byTypeReceived = await Kudos.findAll({
      where: { receiverId: userId },
      attributes: [
        'type',
        [fn('COUNT', col('id')), 'count']
      ],
      group: ['type']
    });

    // Calculate streak (consecutive days giving kudos)
    const recentKudos = await Kudos.findAll({
      where: { senderId: userId },
      attributes: [[fn('DATE', col('createdAt')), 'date']],
      group: [fn('DATE', col('createdAt'))],
      order: [[fn('DATE', col('createdAt')), 'DESC']],
      limit: 30
    });

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const dates = recentKudos.map(k => k.get('date'));
    
    // Check if gave kudos today or yesterday
    if (dates.length > 0) {
      const firstDate = dates[0];
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      if (firstDate === today || firstDate === yesterday) {
        streak = 1;
        for (let i = 1; i < dates.length; i++) {
          const expected = new Date(new Date(dates[i-1]).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          if (dates[i] === expected) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    res.json({
      totalReceived,
      totalGiven,
      receivedThisWeek,
      givenThisWeek,
      streak,
      byType: byTypeReceived.map(t => ({
        type: t.type,
        count: parseInt(t.get('count')),
        ...Kudos.getTypeInfo(t.type)
      }))
    });
  } catch (error) {
    console.error('Error getting kudos stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/kudos/leaderboard
// @desc    Get weekly kudos leaderboard
// @access  Public
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'receivers', limit = 10 } = req.query;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (type === 'receivers') {
      // Top kudos receivers this week
      const topReceivers = await Kudos.findAll({
        where: {
          createdAt: { [Op.gte]: weekAgo }
        },
        attributes: [
          'receiverId',
          [fn('COUNT', col('Kudos.id')), 'kudosCount']
        ],
        include: [{
          model: User,
          as: 'receiver',
          attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
        }],
        group: ['receiverId', 'receiver.id'],
        order: [[fn('COUNT', col('Kudos.id')), 'DESC']],
        limit: parseInt(limit)
      });

      res.json({
        type: 'receivers',
        title: 'Top Kudos Receivers This Week',
        users: topReceivers.map((r, index) => ({
          rank: index + 1,
          userId: r.receiverId,
          user: r.receiver,
          count: parseInt(r.get('kudosCount'))
        }))
      });
    } else {
      // Top kudos givers this week
      const topGivers = await Kudos.findAll({
        where: {
          createdAt: { [Op.gte]: weekAgo }
        },
        attributes: [
          'senderId',
          [fn('COUNT', col('Kudos.id')), 'kudosCount']
        ],
        include: [{
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
        }],
        group: ['senderId', 'sender.id'],
        order: [[fn('COUNT', col('Kudos.id')), 'DESC']],
        limit: parseInt(limit)
      });

      res.json({
        type: 'givers',
        title: 'Top Kudos Givers This Week',
        users: topGivers.map((g, index) => ({
          rank: index + 1,
          userId: g.senderId,
          user: g.sender,
          count: parseInt(g.get('kudosCount'))
        }))
      });
    }
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/kudos/user/:userId
// @desc    Get public kudos for a user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: kudos } = await Kudos.findAndCountAll({
      where: { 
        receiverId: req.params.userId,
        isPublic: true
      },
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    const kudosWithInfo = kudos.map(k => ({
      ...k.toJSON(),
      typeInfo: Kudos.getTypeInfo(k.type)
    }));

    res.json({
      kudos: kudosWithInfo,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Error getting user kudos:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/kudos/check/:postId
// @desc    Check if current user gave kudos on a post
// @access  Private
router.get('/check/:postId', auth, async (req, res) => {
  try {
    const kudos = await Kudos.findOne({
      where: {
        senderId: req.user.id,
        postId: req.params.postId
      }
    });

    res.json({
      hasGivenKudos: !!kudos,
      kudos: kudos ? {
        ...kudos.toJSON(),
        typeInfo: Kudos.getTypeInfo(kudos.type)
      } : null
    });
  } catch (error) {
    console.error('Error checking kudos:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
