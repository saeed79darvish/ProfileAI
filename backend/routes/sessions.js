const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { 
  CollaborationSession, 
  SessionParticipant, 
  SessionReview,
  UserReputation,
  UserBadge,
  User, 
  Profile,
  sequelize 
} = require('../models');
const { Op } = require('sequelize');

// ============================================
// GET /api/sessions - List all sessions with filters
// ============================================
router.get('/', async (req, res) => {
  try {
    const { 
      type,           // teaching, showcase, mentorship
      sessionType,    // alias for type (frontend uses this)
      category,
      status = 'scheduled',
      hostId,         // Filter by specific host
      limit = 20, 
      offset = 0,
      sortBy = 'scheduledTime',
      sortOrder = 'ASC'
    } = req.query;

    const where = {};
    
    // Accept both 'type' and 'sessionType' parameter
    const filterType = type || sessionType;
    if (filterType) where.sessionType = filterType;
    if (category) where.category = category;
    if (hostId) where.hostId = hostId;
    
    // Only apply status filter if not filtering by hostId (show all statuses for user profile)
    if (status && !hostId) where.status = status;

    // Only show scheduled or live sessions in feed (not for hostId filter)
    if (status === 'scheduled' && !hostId) {
      where.status = { [Op.in]: ['scheduled', 'live'] };
      where.scheduledTime = { [Op.gte]: new Date() };
    }

    const sessions = await CollaborationSession.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'host',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['headline', 'profilePicture', 'title']
            }
          ]
        },
        {
          model: SessionParticipant,
          as: 'participants',
          where: { role: 'co-host' },
          required: false,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'firstName', 'lastName'],
              include: [
                {
                  model: Profile,
                  as: 'profile',
                  attributes: ['profilePicture']
                }
              ]
            }
          ]
        }
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      sessions: sessions.rows,
      total: sessions.count,
      hasMore: parseInt(offset) + sessions.rows.length < sessions.count
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ============================================
// GET /api/sessions/my - Get current user's sessions
// ============================================
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { type = 'hosted' } = req.query; // hosted, attending, past

    let sessions;

    if (type === 'hosted') {
      sessions = await CollaborationSession.findAll({
        where: { 
          hostId: req.user.id,
          status: { [Op.in]: ['scheduled', 'live'] }
        },
        include: [
          {
            model: SessionParticipant,
            as: 'participants',
            include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName'] }]
          }
        ],
        order: [['scheduledTime', 'ASC']]
      });
    } else if (type === 'attending') {
      sessions = await SessionParticipant.findAll({
        where: { 
          userId: req.user.id,
          status: 'registered'
        },
        include: [
          {
            model: CollaborationSession,
            as: 'session',
            where: { status: { [Op.in]: ['scheduled', 'live'] } },
            include: [
              {
                model: User,
                as: 'host',
                attributes: ['id', 'firstName', 'lastName'],
                include: [{ model: Profile, as: 'profile', attributes: ['profilePicture'] }]
              }
            ]
          }
        ],
        order: [[{ model: CollaborationSession, as: 'session' }, 'scheduledTime', 'ASC']]
      });
      sessions = sessions.map(p => p.session);
    } else if (type === 'past') {
      sessions = await CollaborationSession.findAll({
        where: {
          [Op.or]: [
            { hostId: req.user.id },
            { '$participants.userId$': req.user.id }
          ],
          status: 'completed'
        },
        include: [
          {
            model: User,
            as: 'host',
            attributes: ['id', 'firstName', 'lastName']
          },
          {
            model: SessionParticipant,
            as: 'participants'
          }
        ],
        order: [['endedAt', 'DESC']],
        limit: 20
      });
    }

    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ============================================
// GET /api/sessions/upcoming - Get upcoming sessions for sidebar
// ============================================
router.get('/upcoming', authMiddleware, async (req, res) => {
  try {
    const registrations = await SessionParticipant.findAll({
      where: { 
        userId: req.user.id,
        status: 'registered'
      },
      include: [
        {
          model: CollaborationSession,
          as: 'session',
          where: { 
            status: 'scheduled',
            scheduledTime: { [Op.gte]: new Date() }
          },
          attributes: ['id', 'title', 'scheduledTime', 'sessionType']
        }
      ],
      order: [[{ model: CollaborationSession, as: 'session' }, 'scheduledTime', 'ASC']],
      limit: 5
    });

    res.json({
      sessions: registrations.map(r => r.session)
    });
  } catch (error) {
    console.error('Error fetching upcoming sessions:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming sessions' });
  }
});

// ============================================
// GET /api/sessions/trending - Get trending topics
// ============================================
router.get('/trending', async (req, res) => {
  try {
    const trending = await CollaborationSession.findAll({
      where: {
        status: { [Op.in]: ['scheduled', 'live', 'completed'] },
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      },
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'sessionCount']
      ],
      group: ['category'],
      order: [[sequelize.literal('sessionCount'), 'DESC']],
      limit: 5
    });

    res.json({ trending });
  } catch (error) {
    console.error('Error fetching trending topics:', error);
    res.status(500).json({ error: 'Failed to fetch trending topics' });
  }
});

// ============================================
// GET /api/sessions/:id - Get session details
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const session = await CollaborationSession.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'host',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['headline', 'profilePicture', 'title', 'summary']
            }
          ]
        },
        {
          model: SessionParticipant,
          as: 'participants',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'firstName', 'lastName'],
              include: [{ model: Profile, as: 'profile', attributes: ['profilePicture'] }]
            }
          ]
        }
      ]
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Increment view count
    await session.increment('viewCount');

    // Get current user ID from auth header if present
    let currentUserId = null;
    let isHost = false;
    let isParticipant = false;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUserId = decoded.id; // Fixed: use 'id' not 'userId'
        
        // Debug logging
        console.log('[Session Detail] hostId:', session.hostId, 'type:', typeof session.hostId);
        console.log('[Session Detail] currentUserId:', currentUserId, 'type:', typeof currentUserId);
        
        // Compare as strings to handle type mismatches
        isHost = String(session.hostId) === String(currentUserId);
        isParticipant = session.participants?.some(p => String(p.userId) === String(currentUserId));
        
        console.log('[Session Detail] isHost:', isHost, 'isParticipant:', isParticipant);
      } catch (e) {
        console.log('[Session Detail] Token error:', e.message);
      }
    }

    res.json({ 
      session,
      currentUserId,
      isHost,
      isParticipant
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ message: 'Failed to fetch session', error: error.message });
  }
});

// ============================================
// POST /api/sessions - Create new session
// ============================================
router.post('/', 
  authMiddleware,
  [
    body('title').trim().isLength({ min: 5, max: 255 }).withMessage('Title must be 5-255 characters'),
    body('sessionType').isIn(['teaching', 'showcase', 'mentorship']).withMessage('Invalid session type'),
    body('durationMinutes').optional().isInt({ min: 15, max: 180 }),
    body('maxParticipants').optional().isInt({ min: 1, max: 100 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        description,
        sessionType,
        category,
        tags,
        helpTopics,
        durationMinutes,
        maxParticipants,
        scheduledTime,
        projectDuration,
        coHosts,
        meetingLink
      } = req.body;

      const session = await CollaborationSession.create({
        hostId: req.user.id,
        title,
        description,
        sessionType,
        category,
        tags: tags || [],
        helpTopics: helpTopics || [],
        durationMinutes: durationMinutes || 30,
        maxParticipants: maxParticipants || 20,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        projectDuration,
        status: scheduledTime ? 'scheduled' : 'draft',
        meetingLink: meetingLink || null
      });

      // Add host as participant
      await SessionParticipant.create({
        sessionId: session.id,
        userId: req.user.id,
        role: 'host',
        status: 'registered',
        isConfirmed: true
      });

      // Add co-hosts if it's a team showcase
      if (coHosts && coHosts.length > 0 && sessionType === 'showcase') {
        for (const coHostId of coHosts) {
          await SessionParticipant.create({
            sessionId: session.id,
            userId: coHostId,
            role: 'co-host',
            status: 'registered',
            isConfirmed: false // Needs confirmation
          });
        }
      }

      // Update user reputation - track session creation
      await updateReputationOnCreate(req.user.id, sessionType);

      res.status(201).json({ session });
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }
);

// ============================================
// PUT /api/sessions/:id - Update session (host only)
// ============================================
router.put('/:id', 
  authMiddleware,
  [
    body('title').optional().trim().isLength({ min: 5, max: 255 }).withMessage('Title must be 5-255 characters'),
    body('sessionType').optional().isIn(['teaching', 'showcase', 'mentorship']).withMessage('Invalid session type'),
    body('durationMinutes').optional().isInt({ min: 15, max: 180 }),
    body('maxParticipants').optional().isInt({ min: 1, max: 100 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const session = await CollaborationSession.findByPk(req.params.id);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Only host can edit
      if (session.hostId !== req.user.id) {
        return res.status(403).json({ error: 'Only host can edit the session' });
      }

      // Can't edit if session has started or completed
      if (session.status === 'live' || session.status === 'completed') {
        return res.status(400).json({ error: 'Cannot edit a session that has started or completed' });
      }

      const {
        title,
        description,
        sessionType,
        category,
        tags,
        helpTopics,
        durationMinutes,
        maxParticipants,
        scheduledTime,
        meetingLink
      } = req.body;

      // Build update object with only provided fields
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (sessionType !== undefined) updateData.sessionType = sessionType;
      if (category !== undefined) updateData.category = category;
      if (tags !== undefined) updateData.tags = tags;
      if (helpTopics !== undefined) updateData.helpTopics = helpTopics;
      if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
      if (maxParticipants !== undefined) updateData.maxParticipants = maxParticipants;
      if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime ? new Date(scheduledTime) : null;
      if (meetingLink !== undefined) updateData.meetingLink = meetingLink;

      await session.update(updateData);

      res.json({ session, message: 'Session updated successfully' });
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({ error: 'Failed to update session' });
    }
  }
);

// ============================================
// POST /api/sessions/:id/join - Join a session
// ============================================
router.post('/:id/join', authMiddleware, async (req, res) => {
  try {
    const session = await CollaborationSession.findByPk(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'scheduled' && session.status !== 'live') {
      return res.status(400).json({ error: 'Cannot join this session' });
    }

    // Check if already registered
    const existing = await SessionParticipant.findOne({
      where: {
        sessionId: session.id,
        userId: req.user.id
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Already registered for this session' });
    }

    // Check capacity
    const currentCount = await SessionParticipant.count({
      where: { 
        sessionId: session.id,
        status: 'registered'
      }
    });

    if (currentCount >= session.maxParticipants) {
      return res.status(400).json({ error: 'Session is full' });
    }

    // Determine role based on session type
    let role = 'attendee';
    if (session.sessionType === 'mentorship') {
      role = req.body.asMentor ? 'mentor' : 'attendee';
    }

    const participant = await SessionParticipant.create({
      sessionId: session.id,
      userId: req.user.id,
      role,
      status: 'registered',
      isConfirmed: role === 'attendee' // Mentors need confirmation
    });

    // Update participant count
    await session.increment('currentParticipants');

    res.json({ 
      message: 'Successfully joined session',
      participant 
    });
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// ============================================
// POST /api/sessions/:id/leave - Leave a session
// ============================================
router.post('/:id/leave', authMiddleware, async (req, res) => {
  try {
    const participant = await SessionParticipant.findOne({
      where: {
        sessionId: req.params.id,
        userId: req.user.id
      }
    });

    if (!participant) {
      return res.status(404).json({ error: 'Not registered for this session' });
    }

    if (participant.role === 'host') {
      return res.status(400).json({ error: 'Host cannot leave. Cancel the session instead.' });
    }

    await participant.update({ status: 'cancelled' });

    // Update participant count
    const session = await CollaborationSession.findByPk(req.params.id);
    await session.decrement('currentParticipants');

    res.json({ message: 'Successfully left session' });
  } catch (error) {
    console.error('Error leaving session:', error);
    res.status(500).json({ error: 'Failed to leave session' });
  }
});

// ============================================
// POST /api/sessions/:id/start - Start a live session (host only)
// ============================================
router.post('/:id/start', authMiddleware, async (req, res) => {
  try {
    const { meetingLink } = req.body;
    const session = await CollaborationSession.findByPk(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.hostId !== req.user.id) {
      return res.status(403).json({ error: 'Only host can start the session' });
    }

    if (session.status !== 'scheduled') {
      return res.status(400).json({ error: 'Session cannot be started' });
    }

    // Update with meeting link if provided, otherwise keep existing
    const updateData = {
      status: 'live',
      startedAt: new Date()
    };
    
    if (meetingLink) {
      updateData.meetingLink = meetingLink;
    }

    await session.update(updateData);

    res.json({ message: 'Session started', session });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// ============================================
// POST /api/sessions/:id/end - End a session (host only)
// ============================================
router.post('/:id/end', authMiddleware, async (req, res) => {
  try {
    const session = await CollaborationSession.findByPk(req.params.id, {
      include: [{ model: SessionParticipant, as: 'participants' }]
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.hostId !== req.user.id) {
      return res.status(403).json({ error: 'Only host can end the session' });
    }

    if (session.status !== 'live') {
      return res.status(400).json({ error: 'Session is not live' });
    }

    // Count attended participants
    const attendedCount = session.participants.filter(p => 
      p.status === 'registered' || p.status === 'attended'
    ).length;

    await session.update({
      status: 'completed',
      endedAt: new Date(),
      totalAttendees: attendedCount
    });

    // Mark all registered participants as attended
    await SessionParticipant.update(
      { status: 'attended' },
      { where: { sessionId: session.id, status: 'registered' } }
    );

    // Update reputation for host
    await updateReputationOnComplete(req.user.id, session.sessionType, attendedCount);

    // Update reputation for attendees
    for (const participant of session.participants) {
      if (participant.userId !== req.user.id && participant.status === 'registered') {
        await updateReputationOnAttend(participant.userId);
      }
    }

    res.json({ message: 'Session ended', session });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// ============================================
// POST /api/sessions/:id/cancel - Cancel a session (host only)
// ============================================
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const session = await CollaborationSession.findByPk(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.hostId !== req.user.id) {
      return res.status(403).json({ error: 'Only host can cancel the session' });
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      return res.status(400).json({ error: 'Session cannot be cancelled' });
    }

    await session.update({ status: 'cancelled' });

    // TODO: Notify participants

    res.json({ message: 'Session cancelled' });
  } catch (error) {
    console.error('Error cancelling session:', error);
    res.status(500).json({ error: 'Failed to cancel session' });
  }
});

// ============================================
// POST /api/sessions/:id/reviews - Submit a review
// ============================================
router.post('/:id/reviews', 
  authMiddleware,
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('feedback').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const session = await CollaborationSession.findByPk(req.params.id);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.status !== 'completed') {
        return res.status(400).json({ error: 'Can only review completed sessions' });
      }

      // Check if user attended
      const participation = await SessionParticipant.findOne({
        where: {
          sessionId: session.id,
          userId: req.user.id,
          status: 'attended'
        }
      });

      if (!participation) {
        return res.status(400).json({ error: 'You did not attend this session' });
      }

      // Check if already reviewed
      const existingReview = await SessionReview.findOne({
        where: {
          sessionId: session.id,
          reviewerId: req.user.id
        }
      });

      if (existingReview) {
        return res.status(400).json({ error: 'You have already reviewed this session' });
      }

      const { rating, feedback, learnings, wouldRecommend } = req.body;

      const review = await SessionReview.create({
        sessionId: session.id,
        reviewerId: req.user.id,
        revieweeId: session.hostId,
        rating,
        feedback,
        learnings,
        wouldRecommend: wouldRecommend !== false
      });

      // Update session average rating
      const reviews = await SessionReview.findAll({
        where: { sessionId: session.id }
      });
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await session.update({ averageRating: avgRating.toFixed(2) });

      // Update host reputation
      await updateReputationOnReview(session.hostId, rating);

      res.status(201).json({ review });
    } catch (error) {
      console.error('Error creating review:', error);
      res.status(500).json({ error: 'Failed to create review' });
    }
  }
);

// ============================================
// GET /api/sessions/:id/reviews - Get session reviews
// ============================================
router.get('/:id/reviews', async (req, res) => {
  try {
    const reviews = await SessionReview.findAll({
      where: { sessionId: req.params.id },
      include: [
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, as: 'profile', attributes: ['profilePicture'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ============================================
// Helper Functions for Reputation Updates
// ============================================

async function updateReputationOnCreate(userId, sessionType) {
  let reputation = await UserReputation.findOne({ where: { userId } });
  
  if (!reputation) {
    reputation = await UserReputation.create({ userId });
  }

  // Track created sessions by type
  const updates = { totalSessionsHosted: reputation.totalSessionsHosted + 1 };
  
  if (sessionType === 'teaching') updates.totalTeachingSessions = reputation.totalTeachingSessions + 1;
  else if (sessionType === 'showcase') updates.totalShowcases = reputation.totalShowcases + 1;
  else if (sessionType === 'mentorship') updates.totalMentorships = reputation.totalMentorships + 1;

  await reputation.update(updates);
}

async function updateReputationOnComplete(userId, sessionType, attendeeCount) {
  let reputation = await UserReputation.findOne({ where: { userId } });
  
  if (!reputation) {
    reputation = await UserReputation.create({ userId });
  }

  // Award teaching credits based on session type and attendance
  let creditsEarned = 10; // Base credits
  if (sessionType === 'teaching') creditsEarned = 15;
  else if (sessionType === 'mentorship') creditsEarned = 5;
  
  // Bonus for good attendance
  if (attendeeCount >= 10) creditsEarned += 5;
  if (attendeeCount >= 20) creditsEarned += 5;

  const totalSessions = reputation.totalSessionsHosted;
  const newLevel = UserReputation.calculateLevel(totalSessions);
  const levelProgress = UserReputation.calculateLevelProgress(totalSessions, newLevel);

  await reputation.update({
    teachingCredits: reputation.teachingCredits + creditsEarned,
    peopleHelped: reputation.peopleHelped + attendeeCount,
    currentLevel: newLevel,
    levelProgress,
    lastSessionDate: new Date()
  });

  // Check for badge unlocks
  await checkBadgeUnlocks(userId, reputation);
}

async function updateReputationOnAttend(userId) {
  let reputation = await UserReputation.findOne({ where: { userId } });
  
  if (!reputation) {
    reputation = await UserReputation.create({ userId });
  }

  await reputation.update({
    sessionsAttended: reputation.sessionsAttended + 1
  });
}

async function updateReputationOnReview(userId, rating) {
  let reputation = await UserReputation.findOne({ where: { userId } });
  
  if (!reputation) {
    reputation = await UserReputation.create({ userId });
  }

  const newTotalRatings = reputation.totalRatingsReceived + 1;
  const newAvgRating = ((reputation.averageRating * reputation.totalRatingsReceived) + rating) / newTotalRatings;

  await reputation.update({
    averageRating: newAvgRating.toFixed(2),
    totalRatingsReceived: newTotalRatings
  });

  // Award bonus credits for good ratings
  if (rating >= 4) {
    await reputation.increment('teachingCredits', { by: 3 });
  }
}

async function checkBadgeUnlocks(userId, reputation) {
  const badgesToCheck = [
    { type: 'first_steps', condition: reputation.totalSessionsHosted >= 1 },
    { type: 'helpful_hand', condition: reputation.peopleHelped >= 10 },
    { type: 'educator', condition: reputation.totalTeachingSessions >= 10 },
    { type: 'rising_star', condition: reputation.peopleHelped >= 50 },
    { type: 'thought_leader', condition: reputation.teachingCredits >= 100 },
    { type: 'community_builder', condition: reputation.peopleHelped >= 50 },
    { type: 'top_rated', condition: reputation.averageRating >= 4.5 && reputation.totalRatingsReceived >= 10 }
  ];

  for (const badge of badgesToCheck) {
    if (badge.condition) {
      const existing = await UserBadge.findOne({
        where: { userId, badgeType: badge.type }
      });
      
      if (!existing) {
        await UserBadge.create({
          userId,
          badgeType: badge.type
        });
        // TODO: Send notification for badge unlock
      }
    }
  }
}

module.exports = router;
