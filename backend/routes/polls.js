const express = require('express');
const router = express.Router();
const { Op, literal } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const { User, Profile, Poll, PollVote, Notification } = require('../models');

// @route   GET /api/polls/categories
// @desc    Get all poll categories
// @access  Public
router.get('/categories', (req, res) => {
  res.json(Poll.getAllCategories());
});

// @route   GET /api/polls/expiry-presets
// @desc    Get expiry time presets
// @access  Public
router.get('/expiry-presets', (req, res) => {
  res.json(Poll.getExpiryPresets());
});

// @route   POST /api/polls
// @desc    Create a new poll
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { question, options, expiryPreset, expiresAt, isAnonymous, category } = req.body;
    const authorId = req.user.id;

    // Validate options
    if (!options || !Array.isArray(options) || options.length < 2 || options.length > 4) {
      return res.status(400).json({ message: 'Poll must have between 2 and 4 options' });
    }

    // Format options with IDs and vote counts
    const formattedOptions = options.map((text, index) => ({
      id: `opt_${index + 1}`,
      text: text.trim(),
      votes: 0
    }));

    // Calculate expiry time
    let pollExpiresAt;
    if (expiresAt) {
      pollExpiresAt = new Date(expiresAt);
    } else if (expiryPreset) {
      const presets = Poll.getExpiryPresets();
      const preset = presets.find(p => p.value === expiryPreset);
      if (preset) {
        pollExpiresAt = new Date(Date.now() + preset.ms);
      } else {
        pollExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default 24h
      }
    } else {
      pollExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default 24h
    }

    const poll = await Poll.create({
      authorId,
      question: question.trim(),
      options: formattedOptions,
      expiresAt: pollExpiresAt,
      isAnonymous: isAnonymous || false,
      category: category || 'general'
    });

    // Get author info for response
    const author = await User.findByPk(authorId, {
      attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
    });

    res.status(201).json({
      ...poll.toJSON(),
      author,
      hasVoted: false,
      userVote: null
    });
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/polls
// @desc    Get all polls with pagination
// @access  Public (auth optional for vote status)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, status, sort = 'recent' } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user?.id;

    // Build where clause
    const where = {};
    if (category && category !== 'all') {
      where.category = category;
    }
    
    // Status filter
    const now = new Date();
    if (status === 'active') {
      where.expiresAt = { [Op.gt]: now };
    } else if (status === 'ended') {
      where.expiresAt = { [Op.lte]: now };
    }

    // Build order clause
    let order;
    switch (sort) {
      case 'trending':
        order = [['totalVotes', 'DESC'], ['createdAt', 'DESC']];
        break;
      case 'hot':
        where.isHotTake = true;
        order = [['totalVotes', 'DESC']];
        break;
      case 'recent':
      default:
        order = [['createdAt', 'DESC']];
    }

    const { count, rows: polls } = await Poll.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }],
      order,
      limit: parseInt(limit),
      offset
    });

    // If user is logged in, check which polls they've voted on
    let userVotes = {};
    if (userId) {
      const votes = await PollVote.findAll({
        where: {
          userId,
          pollId: { [Op.in]: polls.map(p => p.id) }
        }
      });
      userVotes = votes.reduce((acc, vote) => {
        acc[vote.pollId] = vote.optionId;
        return acc;
      }, {});
    }

    // Add vote status and category info to each poll
    const pollsWithMeta = polls.map(poll => ({
      ...poll.toJSON(),
      hasVoted: !!userVotes[poll.id],
      userVote: userVotes[poll.id] || null,
      isExpired: poll.isExpired(),
      categoryInfo: Poll.getCategoryInfo(poll.category)
    }));

    res.json({
      polls: pollsWithMeta,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error getting polls:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/polls/trending
// @desc    Get trending polls (for sidebar widget)
// @access  Public
router.get('/trending', optionalAuth, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const userId = req.user?.id;

    // Get active polls with most votes in last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const polls = await Poll.findAll({
      where: {
        expiresAt: { [Op.gt]: new Date() },
        createdAt: { [Op.gte]: oneWeekAgo }
      },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName']
      }],
      order: [['totalVotes', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    // Check user votes
    let userVotes = {};
    if (userId) {
      const votes = await PollVote.findAll({
        where: {
          userId,
          pollId: { [Op.in]: polls.map(p => p.id) }
        }
      });
      userVotes = votes.reduce((acc, vote) => {
        acc[vote.pollId] = vote.optionId;
        return acc;
      }, {});
    }

    const pollsWithMeta = polls.map(poll => ({
      ...poll.toJSON(),
      hasVoted: !!userVotes[poll.id],
      userVote: userVotes[poll.id] || null,
      isExpired: poll.isExpired(),
      categoryInfo: Poll.getCategoryInfo(poll.category)
    }));

    res.json(pollsWithMeta);
  } catch (error) {
    console.error('Error getting trending polls:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/polls/hot-takes
// @desc    Get polls marked as "Hot Takes" (polarizing votes)
// @access  Public
router.get('/hot-takes', optionalAuth, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const userId = req.user?.id;

    const polls = await Poll.findAll({
      where: {
        isHotTake: true,
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName']
      }],
      order: [['totalVotes', 'DESC']],
      limit: parseInt(limit)
    });

    let userVotes = {};
    if (userId) {
      const votes = await PollVote.findAll({
        where: {
          userId,
          pollId: { [Op.in]: polls.map(p => p.id) }
        }
      });
      userVotes = votes.reduce((acc, vote) => {
        acc[vote.pollId] = vote.optionId;
        return acc;
      }, {});
    }

    const pollsWithMeta = polls.map(poll => ({
      ...poll.toJSON(),
      hasVoted: !!userVotes[poll.id],
      userVote: userVotes[poll.id] || null,
      categoryInfo: Poll.getCategoryInfo(poll.category)
    }));

    res.json(pollsWithMeta);
  } catch (error) {
    console.error('Error getting hot takes:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/polls/:id
// @desc    Get a single poll
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const poll = await Poll.findByPk(id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }]
    });

    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Increment view count
    await poll.increment('views');

    // Check if user has voted
    let userVote = null;
    if (userId) {
      const vote = await PollVote.findOne({
        where: { pollId: id, userId }
      });
      if (vote) {
        userVote = vote.optionId;
      }
    }

    // Get voters for non-anonymous polls (recent voters only)
    let recentVoters = [];
    if (!poll.isAnonymous) {
      const votes = await PollVote.findAll({
        where: { pollId: id },
        include: [{
          model: User,
          as: 'voter',
          attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
        }],
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      recentVoters = votes.map(v => ({
        ...v.voter.toJSON(),
        optionId: v.optionId
      }));
    }

    res.json({
      ...poll.toJSON(),
      hasVoted: !!userVote,
      userVote,
      isExpired: poll.isExpired(),
      categoryInfo: Poll.getCategoryInfo(poll.category),
      recentVoters
    });
  } catch (error) {
    console.error('Error getting poll:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/polls/:id/vote
// @desc    Vote on a poll
// @access  Private
router.post('/:id/vote', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { optionId } = req.body;
    const userId = req.user.id;

    const poll = await Poll.findByPk(id);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    // Check if poll has expired
    if (poll.isExpired()) {
      return res.status(400).json({ message: 'This poll has ended' });
    }

    // Validate option exists
    const optionExists = poll.options.some(opt => opt.id === optionId);
    if (!optionExists) {
      return res.status(400).json({ message: 'Invalid option' });
    }

    // Check if user already voted
    const existingVote = await PollVote.findOne({
      where: { pollId: id, userId }
    });

    if (existingVote) {
      // Allow changing vote
      const oldOptionId = existingVote.optionId;
      
      // Update vote
      await existingVote.update({ optionId });
      
      // Update poll options (decrement old, increment new)
      const updatedOptions = poll.options.map(opt => {
        if (opt.id === oldOptionId) {
          return { ...opt, votes: Math.max(0, (opt.votes || 0) - 1) };
        }
        if (opt.id === optionId) {
          return { ...opt, votes: (opt.votes || 0) + 1 };
        }
        return opt;
      });
      
      // Force Sequelize to detect the JSONB change
      poll.options = updatedOptions;
      poll.changed('options', true);
      await poll.save();
    } else {
      // Create new vote
      await PollVote.create({
        pollId: id,
        userId,
        optionId,
        isAnonymous: poll.isAnonymous
      });

      // Update poll options and total votes
      const updatedOptions = poll.options.map(opt => {
        if (opt.id === optionId) {
          return { ...opt, votes: (opt.votes || 0) + 1 };
        }
        return opt;
      });

      // Force Sequelize to detect the JSONB change by setting it directly
      poll.options = updatedOptions;
      poll.totalVotes = (poll.totalVotes || 0) + 1;
      poll.changed('options', true); // Force mark as changed
      await poll.save();
    }

    // Reload poll to get updated data
    await poll.reload();

    // Check and update hot take status
    const isHotTake = poll.calculateHotTake();
    if (isHotTake !== poll.isHotTake) {
      await poll.update({ isHotTake });
    }

    // Notify poll author (if not voting on own poll and not anonymous)
    if (poll.authorId !== userId && !poll.isAnonymous) {
      const voter = await User.findByPk(userId, {
        attributes: ['firstName', 'lastName']
      });
      
      await Notification.create({
        userId: poll.authorId,
        type: 'poll_vote',
        title: 'New vote on your poll!',
        message: `${voter.firstName} voted on "${poll.question.substring(0, 50)}..."`,
        data: { pollId: id },
        isRead: false
      });
    }

    // Check for viral notification triggers
    if (poll.totalVotes === 10 || poll.totalVotes === 50 || poll.totalVotes === 100 || poll.totalVotes === 1000) {
      await Notification.create({
        userId: poll.authorId,
        type: 'poll_milestone',
        title: '🔥 Your poll is trending!',
        message: `Your poll "${poll.question.substring(0, 30)}..." just hit ${poll.totalVotes} votes!`,
        data: { pollId: id, milestone: poll.totalVotes },
        isRead: false
      });
    }

    // Hot take notification
    if (isHotTake && !poll.isHotTake) {
      await Notification.create({
        userId: poll.authorId,
        type: 'hot_take',
        title: '🌶️ Hot Take Alert!',
        message: `Your poll is splitting opinions! It's now marked as a Hot Take.`,
        data: { pollId: id },
        isRead: false
      });
    }

    res.json({
      ...poll.toJSON(),
      hasVoted: true,
      userVote: optionId,
      isExpired: poll.isExpired(),
      categoryInfo: Poll.getCategoryInfo(poll.category)
    });
  } catch (error) {
    console.error('Error voting on poll:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/polls/:id/voters
// @desc    Get voters for a poll (non-anonymous only)
// @access  Public
router.get('/:id/voters', async (req, res) => {
  try {
    const { id } = req.params;
    const { optionId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const poll = await Poll.findByPk(id);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    if (poll.isAnonymous) {
      return res.status(403).json({ message: 'This is an anonymous poll' });
    }

    const where = { pollId: id };
    if (optionId) {
      where.optionId = optionId;
    }

    const { count, rows: votes } = await PollVote.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'voter',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      voters: votes.map(v => ({
        ...v.voter.toJSON(),
        optionId: v.optionId,
        votedAt: v.createdAt
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error getting poll voters:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/polls/:id
// @desc    Delete a poll (author only)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const poll = await Poll.findByPk(id);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    if (poll.authorId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this poll' });
    }

    // Delete all votes first
    await PollVote.destroy({ where: { pollId: id } });
    
    // Delete the poll
    await poll.destroy();

    res.json({ message: 'Poll deleted successfully' });
  } catch (error) {
    console.error('Error deleting poll:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/polls/:id/share
// @desc    Track poll share
// @access  Private
router.post('/:id/share', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const poll = await Poll.findByPk(id);
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }

    await poll.increment('shares');

    res.json({ shares: poll.shares + 1 });
  } catch (error) {
    console.error('Error tracking poll share:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/polls/user/:userId
// @desc    Get polls by a specific user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const currentUserId = req.user?.id;

    const { count, rows: polls } = await Poll.findAndCountAll({
      where: { authorId: userId },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'firstName', 'lastName', 'profilePictureUrl']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    let userVotes = {};
    if (currentUserId) {
      const votes = await PollVote.findAll({
        where: {
          userId: currentUserId,
          pollId: { [Op.in]: polls.map(p => p.id) }
        }
      });
      userVotes = votes.reduce((acc, vote) => {
        acc[vote.pollId] = vote.optionId;
        return acc;
      }, {});
    }

    const pollsWithMeta = polls.map(poll => ({
      ...poll.toJSON(),
      hasVoted: !!userVotes[poll.id],
      userVote: userVotes[poll.id] || null,
      isExpired: poll.isExpired(),
      categoryInfo: Poll.getCategoryInfo(poll.category)
    }));

    res.json({
      polls: pollsWithMeta,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error getting user polls:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/polls/check/:pollId
// @desc    Check if user has voted on a poll
// @access  Private
router.get('/check/:pollId', auth, async (req, res) => {
  try {
    const { pollId } = req.params;
    const userId = req.user.id;

    const vote = await PollVote.findOne({
      where: { pollId, userId }
    });

    res.json({
      hasVoted: !!vote,
      optionId: vote?.optionId || null
    });
  } catch (error) {
    console.error('Error checking poll vote:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
