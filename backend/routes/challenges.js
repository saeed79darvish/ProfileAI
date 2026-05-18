const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const {
  Challenge,
  ChallengeParticipant,
  ChallengeCheckIn,
  User,
  Profile,
  Notification,
  sequelize
} = require('../models');
const { Op } = require('sequelize');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

// Multer for image uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPEG, GIF or WebP images are allowed'));
  },
});

// Helper to upload to cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'challenges' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// Challenge templates
const CHALLENGE_TEMPLATES = {
  sprint: {
    name: '7-Day Sprint',
    duration: 7,
    description: 'Ship a side project in 7 days',
    milestones: [
      { day: 1, title: 'Day 1: Idea & Setup', description: 'Define your project and set up the foundation' },
      { day: 3, title: 'Day 3: MVP', description: 'Build the minimum viable product' },
      { day: 5, title: 'Day 5: Polish', description: 'Refine and add finishing touches' },
      { day: 7, title: 'Day 7: Launch', description: 'Ship it!' }
    ]
  },
  deep_dive: {
    name: '14-Day Deep Dive',
    duration: 14,
    description: 'Master a new skill through focused learning',
    milestones: [
      { day: 1, title: 'Day 1: Foundations', description: 'Start with the basics' },
      { day: 7, title: 'Day 7: Halfway Check', description: 'Review progress and adjust' },
      { day: 10, title: 'Day 10: Project Start', description: 'Begin applying your knowledge' },
      { day: 14, title: 'Day 14: Showcase', description: 'Share what you learned' }
    ]
  },
  transformation: {
    name: '30-Day Transformation',
    duration: 30,
    description: 'Transform your career in 30 days',
    milestones: [
      { day: 1, title: 'Day 1: Audit', description: 'Assess your current situation' },
      { day: 7, title: 'Week 1: Plan', description: 'Create your action plan' },
      { day: 14, title: 'Week 2: Build', description: 'Start building momentum' },
      { day: 21, title: 'Week 3: Network', description: 'Expand your connections' },
      { day: 30, title: 'Day 30: Launch', description: 'Take the leap!' }
    ]
  }
};

// Points system constants
const POINTS = {
  DAILY_CHECK_IN: 10,
  STREAK_BONUS_3: 5,
  STREAK_BONUS_7: 15,
  STREAK_BONUS_14: 30,
  STREAK_BONUS_30: 100,
  MILESTONE_COMPLETE: 25,
  FIRST_CHECK_IN: 20,
  PHOTO_BONUS: 5,
  GREAT_MOOD: 3,
  CRUSHING_IT: 5
};

// @route   GET /api/challenges/templates
// @desc    Get challenge templates
// @access  Public
router.get('/templates', (req, res) => {
  res.json(CHALLENGE_TEMPLATES);
});

// @route   GET /api/challenges
// @desc    Get all challenges with filters
// @access  Public (with optional auth for personalized data)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      status = 'recruiting', 
      type,
      visibility = 'public',
      sort = 'newest',
      search,
      page = 1,
      limit = 10
    } = req.query;

    const where = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (type) {
      where.type = type;
    }
    
    if (visibility === 'public') {
      where.visibility = 'public';
    } else if (req.user) {
      // Show public and friend challenges if authenticated
      where.visibility = { [Op.in]: ['public', 'friends'] };
    }
    
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    let order = [['createdAt', 'DESC']];
    if (sort === 'popular') {
      order = [['participantCount', 'DESC']];
    } else if (sort === 'starting_soon') {
      order = [['startDate', 'ASC']];
    } else if (sort === 'ending_soon') {
      order = [['endDate', 'ASC']];
    }

    const offset = (page - 1) * limit;

    const { rows: challenges, count } = await Challenge.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: Profile,
            as: 'profile',
            attributes: ['profilePicture']
          }]
        },
        {
          model: ChallengeParticipant,
          as: 'participants',
          limit: 5,
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName'],
            include: [{
              model: Profile,
              as: 'profile',
              attributes: ['profilePicture']
            }]
          }]
        }
      ],
      order,
      offset,
      limit: parseInt(limit)
    });

    // Check if current user is participating
    let userParticipations = {};
    if (req.user) {
      const participations = await ChallengeParticipant.findAll({
        where: {
          userId: req.user.id,
          challengeId: { [Op.in]: challenges.map(c => c.id) }
        }
      });
      participations.forEach(p => {
        userParticipations[p.challengeId] = p;
      });
    }

    const enhancedChallenges = challenges.map(c => ({
      ...c.toJSON(),
      isParticipating: !!userParticipations[c.id],
      userParticipation: userParticipations[c.id] || null
    }));

    res.json({
      challenges: enhancedChallenges,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/challenges/my
// @desc    Get challenges the user is participating in or created
// @access  Private
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { filter = 'all' } = req.query; // 'all', 'created', 'joined', 'active', 'completed'

    let createdChallenges = [];
    let participatedChallenges = [];

    if (filter === 'all' || filter === 'created') {
      createdChallenges = await Challenge.findAll({
        where: { creatorId: req.user.id },
        include: [
          {
            model: ChallengeParticipant,
            as: 'participants',
            limit: 5,
            include: [{
              model: User,
              as: 'user',
              attributes: ['id', 'firstName', 'lastName'],
              include: [{ model: Profile, as: 'profile', attributes: ['profilePicture'] }]
            }]
          }
        ],
        order: [['createdAt', 'DESC']]
      });
    }

    if (filter === 'all' || filter === 'joined' || filter === 'active' || filter === 'completed') {
      const participantWhere = { userId: req.user.id };
      if (filter === 'active') {
        participantWhere.status = 'active';
      } else if (filter === 'completed') {
        participantWhere.status = 'completed';
      }

      const participations = await ChallengeParticipant.findAll({
        where: participantWhere,
        include: [{
          model: Challenge,
          as: 'challenge',
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'firstName', 'lastName'],
              include: [{ model: Profile, as: 'profile', attributes: ['profilePicture'] }]
            },
            {
              model: ChallengeParticipant,
              as: 'participants',
              limit: 5
            }
          ]
        }],
        order: [['createdAt', 'DESC']]
      });

      participatedChallenges = participations.map(p => ({
        ...p.challenge.toJSON(),
        userParticipation: {
          status: p.status,
          streak: p.streak,
          points: p.points,
          totalCheckIns: p.totalCheckIns,
          lastCheckIn: p.lastCheckIn
        }
      }));
    }

    res.json({
      created: createdChallenges,
      participated: participatedChallenges
    });
  } catch (error) {
    console.error('Error fetching user challenges:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/challenges/:id
// @desc    Get a single challenge with full details
// @access  Public (with optional auth)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const challenge = await Challenge.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{ model: Profile, as: 'profile', attributes: ['profilePicture', 'headline'] }]
        },
        {
          model: ChallengeParticipant,
          as: 'participants',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName'],
            include: [{ model: Profile, as: 'profile', attributes: ['profilePicture'] }]
          }],
          order: [['points', 'DESC']]
        }
      ]
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    // Get recent check-ins
    const recentCheckIns = await ChallengeCheckIn.findAll({
      where: { challengeId: challenge.id },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName'],
        include: [{ model: Profile, as: 'profile', attributes: ['profilePicture'] }]
      }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    // Check user participation
    let userParticipation = null;
    let userCheckIns = [];
    if (req.user) {
      userParticipation = await ChallengeParticipant.findOne({
        where: { challengeId: challenge.id, userId: req.user.id }
      });
      
      if (userParticipation) {
        userCheckIns = await ChallengeCheckIn.findAll({
          where: { challengeId: challenge.id, userId: req.user.id },
          order: [['day', 'ASC']]
        });
      }
    }

    // Calculate current day of challenge
    let currentDay = null;
    if (challenge.startDate && challenge.status === 'active') {
      const now = new Date();
      const start = new Date(challenge.startDate);
      currentDay = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
    }

    res.json({
      ...challenge.toJSON(),
      recentCheckIns,
      userParticipation,
      userCheckIns,
      currentDay,
      isCreator: req.user?.id === challenge.creatorId
    });
  } catch (error) {
    console.error('Error fetching challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges
// @desc    Create a new challenge
// @access  Private
router.post('/', authMiddleware, upload.single('coverImage'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('duration').isInt({ min: 1, max: 365 }).withMessage('Duration must be 1-365 days'),
  body('type').optional().isIn(['sprint', 'deep_dive', 'transformation', 'custom']),
  body('visibility').optional().isIn(['public', 'friends', 'private'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      duration,
      type = 'custom',
      visibility = 'public',
      minParticipants = 1,
      maxParticipants = 50,
      milestones,
      allowSkipDays = 2,
      requireDailyCheckIn = true,
      isTeamChallenge = false,
      teamSize,
      stakes,
      tags,
      startImmediately = false
    } = req.body;

    // Parse milestones if it's a string
    let parsedMilestones = milestones;
    if (typeof milestones === 'string') {
      try {
        parsedMilestones = JSON.parse(milestones);
      } catch (e) {
        parsedMilestones = [];
      }
    }

    // Use template milestones if no custom milestones provided
    if (!parsedMilestones || parsedMilestones.length === 0) {
      if (CHALLENGE_TEMPLATES[type]) {
        parsedMilestones = CHALLENGE_TEMPLATES[type].milestones;
      }
    }

    // Parse tags
    let parsedTags = tags;
    if (typeof tags === 'string') {
      try {
        parsedTags = JSON.parse(tags);
      } catch (e) {
        parsedTags = tags.split(',').map(t => t.trim());
      }
    }

    // Upload cover image if provided
    let coverImageUrl = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      coverImageUrl = result.secure_url;
    }

    const challenge = await Challenge.create({
      creatorId: req.user.id,
      title,
      description,
      duration: parseInt(duration),
      type,
      visibility,
      minParticipants: parseInt(minParticipants),
      maxParticipants: parseInt(maxParticipants),
      milestones: parsedMilestones || [],
      allowSkipDays: parseInt(allowSkipDays),
      requireDailyCheckIn,
      isTeamChallenge,
      teamSize: teamSize ? parseInt(teamSize) : null,
      stakes,
      tags: parsedTags || [],
      coverImage: coverImageUrl,
      status: startImmediately ? 'recruiting' : 'draft'
    });

    // Creator automatically joins
    await ChallengeParticipant.create({
      challengeId: challenge.id,
      userId: req.user.id,
      status: 'joined',
      joinedAt: new Date()
    });

    // Update participant count
    challenge.participantCount = 1;
    await challenge.save();

    res.status(201).json(challenge);
  } catch (error) {
    console.error('Error creating challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/challenges/:id
// @desc    Update a challenge (only creator, only if draft/recruiting)
// @access  Private
router.put('/:id', authMiddleware, upload.single('coverImage'), async (req, res) => {
  try {
    const challenge = await Challenge.findByPk(req.params.id);
    
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (challenge.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (!['draft', 'recruiting'].includes(challenge.status)) {
      return res.status(400).json({ message: 'Cannot edit active or completed challenges' });
    }

    const updateFields = [
      'title', 'description', 'duration', 'type', 'visibility',
      'minParticipants', 'maxParticipants', 'milestones',
      'allowSkipDays', 'requireDailyCheckIn', 'isTeamChallenge',
      'teamSize', 'stakes', 'tags'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        if (field === 'milestones' || field === 'tags') {
          if (typeof value === 'string') {
            try {
              value = JSON.parse(value);
            } catch (e) {
              if (field === 'tags') value = value.split(',').map(t => t.trim());
            }
          }
        }
        challenge[field] = value;
      }
    });

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      challenge.coverImage = result.secure_url;
    }

    await challenge.save();
    res.json(challenge);
  } catch (error) {
    console.error('Error updating challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges/:id/publish
// @desc    Publish a draft challenge (set to recruiting)
// @access  Private (creator only)
router.post('/:id/publish', authMiddleware, async (req, res) => {
  try {
    const challenge = await Challenge.findByPk(req.params.id);
    
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (challenge.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (challenge.status !== 'draft') {
      return res.status(400).json({ message: 'Challenge is already published' });
    }

    challenge.status = 'recruiting';
    await challenge.save();

    res.json(challenge);
  } catch (error) {
    console.error('Error publishing challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges/:id/start
// @desc    Start a challenge (begins countdown)
// @access  Private (creator only)
router.post('/:id/start', authMiddleware, async (req, res) => {
  try {
    const challenge = await Challenge.findByPk(req.params.id, {
      include: [{ model: ChallengeParticipant, as: 'participants' }]
    });
    
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (challenge.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (challenge.status !== 'recruiting') {
      return res.status(400).json({ message: 'Challenge cannot be started from current state' });
    }

    if (challenge.participantCount < challenge.minParticipants) {
      return res.status(400).json({ 
        message: `Need at least ${challenge.minParticipants} participants to start (currently ${challenge.participantCount})` 
      });
    }

    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + challenge.duration);

    challenge.status = 'active';
    challenge.startDate = startDate;
    challenge.endDate = endDate;
    await challenge.save();

    // Update all participants to active status
    await ChallengeParticipant.update(
      { status: 'active' },
      { where: { challengeId: challenge.id, status: 'joined' } }
    );

    // Notify all participants
    const participants = await ChallengeParticipant.findAll({
      where: { challengeId: challenge.id }
    });

    for (const participant of participants) {
      if (participant.userId !== req.user.id) {
        await Notification.create({
          userId: participant.userId,
          type: 'challenge_started',
          title: 'Challenge Started!',
          message: `${challenge.title} has begun! Day 1 starts now.`,
          data: { challengeId: challenge.id }
        });
      }
    }

    res.json(challenge);
  } catch (error) {
    console.error('Error starting challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges/:id/join
// @desc    Join a challenge
// @access  Private
router.post('/:id/join', authMiddleware, async (req, res) => {
  try {
    const challenge = await Challenge.findByPk(req.params.id);
    
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (challenge.status !== 'recruiting') {
      return res.status(400).json({ message: 'Challenge is not accepting participants' });
    }

    if (challenge.participantCount >= challenge.maxParticipants) {
      return res.status(400).json({ message: 'Challenge is full' });
    }

    // Check if already participating
    const existingParticipation = await ChallengeParticipant.findOne({
      where: { challengeId: challenge.id, userId: req.user.id }
    });

    if (existingParticipation) {
      if (existingParticipation.status === 'dropped') {
        existingParticipation.status = 'joined';
        existingParticipation.joinedAt = new Date();
        await existingParticipation.save();
      } else {
        return res.status(400).json({ message: 'Already participating in this challenge' });
      }
    } else {
      await ChallengeParticipant.create({
        challengeId: challenge.id,
        userId: req.user.id,
        status: 'joined',
        joinedAt: new Date(),
        invitedBy: req.body.invitedBy || null
      });
    }

    // Update participant count
    challenge.participantCount = await ChallengeParticipant.count({
      where: { challengeId: challenge.id, status: { [Op.notIn]: ['dropped', 'invited'] } }
    });
    await challenge.save();

    // Notify creator
    if (challenge.creatorId !== req.user.id) {
      const joiner = await User.findByPk(req.user.id);
      await Notification.create({
        userId: challenge.creatorId,
        type: 'challenge_joined',
        title: 'New Participant!',
        message: `${joiner.firstName} ${joiner.lastName} joined ${challenge.title}`,
        data: { challengeId: challenge.id, userId: req.user.id }
      });
    }

    res.json({ message: 'Successfully joined challenge', participantCount: challenge.participantCount });
  } catch (error) {
    console.error('Error joining challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges/join/:inviteCode
// @desc    Join a challenge via invite code
// @access  Private
router.post('/join/:inviteCode', authMiddleware, async (req, res) => {
  try {
    const challenge = await Challenge.findOne({
      where: { inviteCode: req.params.inviteCode.toUpperCase() }
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    // Redirect to the normal join endpoint
    req.params.id = challenge.id;
    return router.handle(req, res);
  } catch (error) {
    console.error('Error joining via invite code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges/:id/leave
// @desc    Leave a challenge
// @access  Private
router.post('/:id/leave', authMiddleware, async (req, res) => {
  try {
    const participation = await ChallengeParticipant.findOne({
      where: { challengeId: req.params.id, userId: req.user.id }
    });

    if (!participation) {
      return res.status(404).json({ message: 'Not participating in this challenge' });
    }

    const challenge = await Challenge.findByPk(req.params.id);

    // Creator cannot leave
    if (challenge.creatorId === req.user.id) {
      return res.status(400).json({ message: 'Creator cannot leave the challenge' });
    }

    participation.status = 'dropped';
    await participation.save();

    // Update participant count
    challenge.participantCount = await ChallengeParticipant.count({
      where: { challengeId: challenge.id, status: { [Op.notIn]: ['dropped', 'invited'] } }
    });
    await challenge.save();

    res.json({ message: 'Left challenge successfully' });
  } catch (error) {
    console.error('Error leaving challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges/:id/invite
// @desc    Invite friends to a challenge
// @access  Private (participants only)
router.post('/:id/invite', authMiddleware, [
  body('userIds').isArray().withMessage('userIds must be an array')
], async (req, res) => {
  try {
    const challenge = await Challenge.findByPk(req.params.id);
    
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    // Check if user is participating
    const participation = await ChallengeParticipant.findOne({
      where: { challengeId: challenge.id, userId: req.user.id }
    });

    if (!participation && challenge.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Must be a participant to invite others' });
    }

    const { userIds } = req.body;
    const inviter = await User.findByPk(req.user.id);
    const invited = [];

    for (const userId of userIds) {
      // Check if already participating
      const existing = await ChallengeParticipant.findOne({
        where: { challengeId: challenge.id, userId }
      });

      if (!existing) {
        await ChallengeParticipant.create({
          challengeId: challenge.id,
          userId,
          status: 'invited',
          invitedBy: req.user.id,
          invitedAt: new Date()
        });

        // Create notification
        await Notification.create({
          userId,
          type: 'challenge_invite',
          title: 'Challenge Invitation!',
          message: `${inviter.firstName} ${inviter.lastName} invited you to join "${challenge.title}"`,
          data: { challengeId: challenge.id, inviterId: req.user.id }
        });

        invited.push(userId);
      }
    }

    res.json({ message: `Invited ${invited.length} users`, invited });
  } catch (error) {
    console.error('Error inviting to challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges/:id/check-in
// @desc    Submit a daily check-in
// @access  Private (active participants only)
router.post('/:id/check-in', authMiddleware, upload.single('image'), [
  body('content').optional().isLength({ max: 2000 }),
  body('mood').isIn(['struggling', 'okay', 'good', 'great', 'crushing'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const challenge = await Challenge.findByPk(req.params.id);
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (challenge.status !== 'active') {
      return res.status(400).json({ message: 'Challenge is not active' });
    }

    const participation = await ChallengeParticipant.findOne({
      where: { challengeId: challenge.id, userId: req.user.id, status: 'active' }
    });

    if (!participation) {
      return res.status(403).json({ message: 'Not an active participant' });
    }

    // Calculate current day
    const now = new Date();
    const start = new Date(challenge.startDate);
    const currentDay = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;

    if (currentDay > challenge.duration) {
      return res.status(400).json({ message: 'Challenge has ended' });
    }

    // Check if already checked in today
    const existingCheckIn = await ChallengeCheckIn.findOne({
      where: { challengeId: challenge.id, userId: req.user.id, day: currentDay }
    });

    if (existingCheckIn) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    const { content, mood, isSkipDay = false } = req.body;

    // Upload image if provided
    let imageUrl = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
    }

    // Calculate points
    let pointsEarned = 0;
    if (!isSkipDay) {
      pointsEarned += POINTS.DAILY_CHECK_IN;
      
      // First check-in bonus
      if (participation.totalCheckIns === 0) {
        pointsEarned += POINTS.FIRST_CHECK_IN;
      }
      
      // Photo bonus
      if (imageUrl) {
        pointsEarned += POINTS.PHOTO_BONUS;
      }
      
      // Mood bonus
      if (mood === 'great') {
        pointsEarned += POINTS.GREAT_MOOD;
      } else if (mood === 'crushing') {
        pointsEarned += POINTS.CRUSHING_IT;
      }
      
      // Streak bonus
      const newStreak = participation.streak + 1;
      if (newStreak === 3) pointsEarned += POINTS.STREAK_BONUS_3;
      if (newStreak === 7) pointsEarned += POINTS.STREAK_BONUS_7;
      if (newStreak === 14) pointsEarned += POINTS.STREAK_BONUS_14;
      if (newStreak === 30) pointsEarned += POINTS.STREAK_BONUS_30;
    }

    // Check for milestone completion
    let milestoneCompleted = null;
    const milestone = challenge.milestones?.find(m => m.day === currentDay);
    if (milestone && !isSkipDay) {
      milestoneCompleted = currentDay;
      pointsEarned += POINTS.MILESTONE_COMPLETE;
      
      participation.completedMilestones = [
        ...(participation.completedMilestones || []),
        { day: currentDay, completedAt: new Date() }
      ];
    }

    // Create check-in
    const checkIn = await ChallengeCheckIn.create({
      challengeId: challenge.id,
      userId: req.user.id,
      day: currentDay,
      content,
      mood,
      imageUrl,
      isSkipDay,
      pointsEarned,
      milestoneCompleted,
      checkInTime: now.toTimeString().slice(0, 8)
    });

    // Update participation
    if (isSkipDay) {
      participation.skipDaysUsed += 1;
      participation.streak = 0;
    } else {
      participation.streak += 1;
      if (participation.streak > participation.longestStreak) {
        participation.longestStreak = participation.streak;
      }
    }
    
    participation.points += pointsEarned;
    participation.totalCheckIns += 1;
    participation.lastCheckIn = now;
    participation.completionPercentage = (participation.totalCheckIns / challenge.duration) * 100;
    
    participation.changed('completedMilestones', true);
    await participation.save();

    res.json({
      checkIn,
      pointsEarned,
      totalPoints: participation.points,
      streak: participation.streak,
      milestoneCompleted: milestone || null
    });
  } catch (error) {
    console.error('Error creating check-in:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/challenges/:id/check-ins
// @desc    Get all check-ins for a challenge
// @access  Public
router.get('/:id/check-ins', optionalAuth, async (req, res) => {
  try {
    const { day, userId, page = 1, limit = 20 } = req.query;
    const where = { challengeId: req.params.id };

    if (day) where.day = parseInt(day);
    if (userId) where.userId = userId;

    const offset = (page - 1) * limit;

    const { rows: checkIns, count } = await ChallengeCheckIn.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName'],
        include: [{ model: Profile, as: 'profile', attributes: ['profilePicture'] }]
      }],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(limit)
    });

    res.json({
      checkIns,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/challenges/:id/leaderboard
// @desc    Get challenge leaderboard
// @access  Public
router.get('/:id/leaderboard', optionalAuth, async (req, res) => {
  try {
    const participants = await ChallengeParticipant.findAll({
      where: { 
        challengeId: req.params.id,
        status: { [Op.in]: ['active', 'completed'] }
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName'],
        include: [{ model: Profile, as: 'profile', attributes: ['profilePicture'] }]
      }],
      order: [['points', 'DESC'], ['streak', 'DESC'], ['totalCheckIns', 'DESC']]
    });

    const leaderboard = participants.map((p, index) => ({
      rank: index + 1,
      user: p.user,
      points: p.points,
      streak: p.streak,
      longestStreak: p.longestStreak,
      totalCheckIns: p.totalCheckIns,
      completionPercentage: p.completionPercentage,
      isCurrentUser: req.user?.id === p.userId
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges/:id/nudge/:userId
// @desc    Nudge a participant who hasn't checked in
// @access  Private (participants only)
router.post('/:id/nudge/:userId', authMiddleware, async (req, res) => {
  try {
    const challenge = await Challenge.findByPk(req.params.id);
    if (!challenge || challenge.status !== 'active') {
      return res.status(404).json({ message: 'Active challenge not found' });
    }

    // Check if sender is a participant
    const senderParticipation = await ChallengeParticipant.findOne({
      where: { challengeId: challenge.id, userId: req.user.id, status: 'active' }
    });

    if (!senderParticipation) {
      return res.status(403).json({ message: 'Must be an active participant to nudge' });
    }

    // Get target participation
    const targetParticipation = await ChallengeParticipant.findOne({
      where: { challengeId: challenge.id, userId: req.params.userId, status: 'active' }
    });

    if (!targetParticipation) {
      return res.status(404).json({ message: 'Target user is not an active participant' });
    }

    // Check if can be nudged
    if (!targetParticipation.canBeNudged()) {
      return res.status(400).json({ message: 'User was nudged recently. Try again later.' });
    }

    // Update nudge tracking
    targetParticipation.recordNudge();
    await targetParticipation.save();

    senderParticipation.lastNudgeSent = new Date();
    await senderParticipation.save();

    // Create notification
    const sender = await User.findByPk(req.user.id);
    await Notification.create({
      userId: req.params.userId,
      type: 'challenge_nudge',
      title: 'You got nudged! 👋',
      message: `${sender.firstName} is wondering if you checked in on "${challenge.title}" today!`,
      data: { challengeId: challenge.id, nudgerId: req.user.id }
    });

    res.json({ message: 'Nudge sent successfully' });
  } catch (error) {
    console.error('Error sending nudge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/challenges/:id
// @desc    Delete a challenge (only creator, only if draft)
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const challenge = await Challenge.findByPk(req.params.id);
    
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (challenge.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (challenge.status !== 'draft') {
      return res.status(400).json({ message: 'Can only delete draft challenges' });
    }

    // Delete associated records
    await ChallengeParticipant.destroy({ where: { challengeId: challenge.id } });
    await ChallengeCheckIn.destroy({ where: { challengeId: challenge.id } });
    await challenge.destroy();

    res.json({ message: 'Challenge deleted successfully' });
  } catch (error) {
    console.error('Error deleting challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges/:id/complete
// @desc    Mark challenge as completed (automatically called or manually by creator)
// @access  Private
router.post('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const challenge = await Challenge.findByPk(req.params.id);
    
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (challenge.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (challenge.status !== 'active') {
      return res.status(400).json({ message: 'Challenge is not active' });
    }

    challenge.status = 'completed';
    await challenge.save();

    // Update participants
    const participants = await ChallengeParticipant.findAll({
      where: { challengeId: challenge.id, status: 'active' },
      order: [['points', 'DESC']]
    });

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      p.status = 'completed';
      p.completedAt = new Date();
      p.finalRank = i + 1;
      await p.save();

      // Notify participant
      await Notification.create({
        userId: p.userId,
        type: 'challenge_completed',
        title: '🎉 Challenge Completed!',
        message: `You finished "${challenge.title}" in position #${i + 1}!`,
        data: { challengeId: challenge.id, rank: i + 1, points: p.points }
      });
    }

    // Calculate completion rate
    const totalActive = participants.length;
    const completed = participants.filter(p => p.completionPercentage >= 80).length;
    challenge.completionRate = totalActive > 0 ? (completed / totalActive) * 100 : 0;
    await challenge.save();

    res.json({ message: 'Challenge completed', rankings: participants.map(p => ({ userId: p.userId, rank: p.finalRank, points: p.points })) });
  } catch (error) {
    console.error('Error completing challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
