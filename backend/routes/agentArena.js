const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { aiRateLimiter, recordAIUsage } = require('../middleware/aiRateLimiter');
const agentArenaService = require('../services/agentArenaService');
const notificationService = require('../services/notificationService');
const featureFlags = require('../config/featureFlags');
const { Job, User, Profile } = require('../models');

/**
 * @route   POST /api/agent-arena/initiate
 * @desc    Start a new AI agent negotiation
 * @access  Private
 */
router.post('/initiate', auth, aiRateLimiter('agent_arena'), async (req, res) => {
  try {
    const { initiatorType, jobId, candidateId, agentContext } = req.body;
    const userId = req.user.id;

    // Validation
    if (!initiatorType || !['candidate', 'recruiter'].includes(initiatorType)) {
      return res.status(400).json({ error: 'Invalid initiator type. Must be "candidate" or "recruiter"' });
    }

    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    // Get the job to find the recruiter
    const job = await Job.findByPk(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    let finalCandidateId, finalRecruiterId;

    if (initiatorType === 'candidate') {
      // Candidate is applying - they are the current user
      if (req.user.role !== 'candidate') {
        return res.status(403).json({ error: 'Only candidates can apply for jobs' });
      }
      finalCandidateId = userId;
      finalRecruiterId = job.userId; // Job owner is the recruiter
    } else {
      // Recruiter is scouting - they are the current user
      if (!featureFlags.recruiterAgentArena) {
        return res.status(403).json({ error: 'Recruiter Agent Arena is disabled for this release' });
      }
      if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only recruiters can scout candidates' });
      }
      if (!candidateId) {
        return res.status(400).json({ error: 'Candidate ID is required for scouting' });
      }
      if (job.userId !== userId) {
        return res.status(403).json({ error: 'You can only scout for your own job postings' });
      }
      finalCandidateId = candidateId;
      finalRecruiterId = userId;
    }

    // Skip subscription limits for now (development mode)
    const limitCheck = { canCreate: true, activeCount: 0, monthlyCount: 0, limits: { active: -1, monthly: -1 }, tier: 'unlimited' };

    // Start the negotiation
    const negotiation = await agentArenaService.initiateNegotiation(
      initiatorType,
      jobId,
      finalCandidateId,
      finalRecruiterId,
      agentContext || {}
    );

    // Auto-run the full negotiation in the background (fire-and-forget)
    // This completes the AI-to-AI conversation without blocking the response
    const autoRun = req.body.autoRun !== false; // Default to true
    if (autoRun && negotiation.status === 'negotiating') {
      agentArenaService.runFullNegotiation(negotiation.id, 4)
        .then(result => {
          console.log(`✅ Auto-completed negotiation ${negotiation.id} with status: ${result.status}`);
        })
        .catch(err => {
          console.error(`❌ Error auto-running negotiation ${negotiation.id}:`, err.message);
        });
    }

    // Record AI usage for initiating agent arena
    await recordAIUsage(req.user.id, 'agent_arena', { 
      negotiationId: negotiation.id,
      initiatorType
    });

    // Notify the other party about the new negotiation
    const notifyUserId = initiatorType === 'candidate' ? finalRecruiterId : finalCandidateId;
    notificationService.notifyAgentArenaUpdate(notifyUserId, negotiation, 'started')
      .catch(err => console.error('Error creating negotiation start notification:', err));

    res.status(201).json({
      message: 'Agent negotiation started successfully',
      negotiation,
      limits: limitCheck,
      autoRunning: autoRun
    });
  } catch (error) {
    console.error('Error initiating negotiation:', error);
    res.status(500).json({ error: error.message || 'Failed to start negotiation' });
  }
});

/**
 * @route   GET /api/agent-arena/negotiations
 * @desc    Get all negotiations for the current user
 * @access  Private
 */
router.get('/negotiations', auth, async (req, res) => {
  try {
    const { role, status } = req.query;
    const negotiations = await agentArenaService.getUserNegotiations(req.user.id, role);

    // Filter by status if provided
    let filtered = negotiations;
    if (status) {
      filtered = negotiations.filter(n => n.status === status);
    }

    res.json({
      negotiations: filtered,
      total: filtered.length
    });
  } catch (error) {
    console.error('Error fetching negotiations:', error);
    res.status(500).json({ error: 'Failed to fetch negotiations' });
  }
});

/**
 * @route   GET /api/agent-arena/negotiations/:id
 * @desc    Get a single negotiation with all messages
 * @access  Private
 */
router.get('/negotiations/:id', auth, async (req, res) => {
  try {
    const negotiation = await agentArenaService.getNegotiationWithMessages(req.params.id);

    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    // Verify user is part of this negotiation
    if (negotiation.candidateId !== req.user.id && negotiation.recruiterId !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to view this negotiation' });
    }

    res.json({ negotiation });
  } catch (error) {
    console.error('Error fetching negotiation:', error);
    res.status(500).json({ error: 'Failed to fetch negotiation' });
  }
});

/**
 * @route   POST /api/agent-arena/negotiations/:id/continue
 * @desc    Run the next round of negotiation
 * @access  Private
 */
router.post('/negotiations/:id/continue', auth, async (req, res) => {
  try {
    const negotiation = await agentArenaService.getNegotiationWithMessages(req.params.id);

    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    // Verify user is part of this negotiation
    if (negotiation.candidateId !== req.user.id && negotiation.recruiterId !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to continue this negotiation' });
    }

    if (negotiation.status !== 'negotiating') {
      return res.status(400).json({ error: `Cannot continue - negotiation status is ${negotiation.status}` });
    }

    const updated = await agentArenaService.continueNegotiation(req.params.id);

    res.json({
      message: 'Negotiation round completed',
      negotiation: updated
    });
  } catch (error) {
    console.error('Error continuing negotiation:', error);
    res.status(500).json({ error: error.message || 'Failed to continue negotiation' });
  }
});

/**
 * @route   POST /api/agent-arena/negotiations/:id/run-full
 * @desc    Run multiple rounds until conclusion
 * @access  Private
 */
router.post('/negotiations/:id/run-full', auth, async (req, res) => {
  try {
    const { maxRounds = 5 } = req.body;
    const negotiation = await agentArenaService.getNegotiationWithMessages(req.params.id);

    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    // Verify user is part of this negotiation
    if (negotiation.candidateId !== req.user.id && negotiation.recruiterId !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to run this negotiation' });
    }

    if (negotiation.status !== 'negotiating') {
      return res.status(400).json({ error: `Cannot run - negotiation status is ${negotiation.status}` });
    }

    const completed = await agentArenaService.runFullNegotiation(req.params.id, maxRounds);

    // Notify both parties about negotiation completion
    const completionType = completed.status === 'agreed' ? 'agreed' : 'completed';
    notificationService.notifyAgentArenaUpdate(completed.candidateId, completed, completionType)
      .catch(err => console.error('Error creating candidate negotiation notification:', err));
    notificationService.notifyAgentArenaUpdate(completed.recruiterId, completed, completionType)
      .catch(err => console.error('Error creating recruiter negotiation notification:', err));

    res.json({
      message: 'Negotiation completed',
      negotiation: completed
    });
  } catch (error) {
    console.error('Error running full negotiation:', error);
    res.status(500).json({ error: error.message || 'Failed to run negotiation' });
  }
});

/**
 * @route   POST /api/agent-arena/negotiations/:id/conclude
 * @desc    Force agents to make final decisions
 * @access  Private
 */
router.post('/negotiations/:id/conclude', auth, async (req, res) => {
  try {
    const negotiation = await agentArenaService.getNegotiationWithMessages(req.params.id);

    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    // Verify user is part of this negotiation
    if (negotiation.candidateId !== req.user.id && negotiation.recruiterId !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to conclude this negotiation' });
    }

    if (negotiation.status !== 'negotiating') {
      return res.status(400).json({ error: `Cannot conclude - negotiation status is ${negotiation.status}` });
    }

    const concluded = await agentArenaService.concludeNegotiation(req.params.id);

    res.json({
      message: 'Negotiation concluded',
      negotiation: concluded
    });
  } catch (error) {
    console.error('Error concluding negotiation:', error);
    res.status(500).json({ error: error.message || 'Failed to conclude negotiation' });
  }
});

/**
 * @route   POST /api/agent-arena/negotiations/:id/human-override
 * @desc    Human takes over the negotiation
 * @access  Private
 */
router.post('/negotiations/:id/human-override', auth, async (req, res) => {
  try {
    const { action, note } = req.body;
    
    if (!action || !['proceed', 'decline', 'pause'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "proceed", "decline", or "pause"' });
    }

    const negotiation = await agentArenaService.getNegotiationWithMessages(req.params.id);

    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    // Verify user is part of this negotiation
    if (negotiation.candidateId !== req.user.id && negotiation.recruiterId !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to override this negotiation' });
    }

    const updated = await agentArenaService.humanTakeover(
      req.params.id,
      req.user.id,
      action,
      note
    );

    res.json({
      message: 'Human override recorded',
      negotiation: updated
    });
  } catch (error) {
    console.error('Error in human override:', error);
    res.status(500).json({ error: error.message || 'Failed to process human override' });
  }
});

/**
 * @route   GET /api/agent-arena/limits
 * @desc    Get current user's negotiation limits
 * @access  Private
 */
router.get('/limits', auth, async (req, res) => {
  try {
    const limits = await agentArenaService.checkNegotiationLimits(
      req.user.id,
      req.user.subscriptionTier || 'free'
    );

    res.json(limits);
  } catch (error) {
    console.error('Error checking limits:', error);
    res.status(500).json({ error: 'Failed to check limits' });
  }
});

/**
 * @route   POST /api/agent-arena/negotiations/:id/update-context
 * @desc    Update agent context for a negotiation (before it starts or during)
 * @access  Private
 */
router.post('/negotiations/:id/update-context', auth, async (req, res) => {
  try {
    const { agentContext } = req.body;
    const { AgentNegotiation } = require('../models');
    
    const negotiation = await AgentNegotiation.findByPk(req.params.id);

    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    // Determine which context to update based on user role
    const isCandidate = negotiation.candidateId === req.user.id;
    const isRecruiter = negotiation.recruiterId === req.user.id;

    if (!isCandidate && !isRecruiter) {
      return res.status(403).json({ error: 'You are not part of this negotiation' });
    }

    const updateField = isCandidate ? 'candidateAgentContext' : 'recruiterAgentContext';
    
    await negotiation.update({
      [updateField]: {
        ...negotiation[updateField],
        ...agentContext
      }
    });

    const updated = await agentArenaService.getNegotiationWithMessages(req.params.id);

    res.json({
      message: 'Agent context updated',
      negotiation: updated
    });
  } catch (error) {
    console.error('Error updating context:', error);
    res.status(500).json({ error: 'Failed to update agent context' });
  }
});

/**
 * @route   POST /api/agent-arena/reschedule
 * @desc    Start an AI agent negotiation to reschedule an interview
 * @access  Private (Candidate only)
 */
router.post('/reschedule', auth, async (req, res) => {
  try {
    const { interviewId, reason, preferredDates, flexibility } = req.body;
    const userId = req.user.id;

    if (req.user.role !== 'candidate') {
      return res.status(403).json({ error: 'Only candidates can request reschedule negotiations' });
    }

    if (!interviewId) {
      return res.status(400).json({ error: 'Interview ID is required' });
    }

    const rescheduleContext = {
      reason: reason || 'Schedule conflict',
      preferredDates: preferredDates || [],
      flexibility: flexibility || 'flexible'
    };

    const negotiation = await agentArenaService.initiateRescheduleNegotiation(
      interviewId,
      userId,
      rescheduleContext
    );

    res.status(201).json({
      message: 'Reschedule negotiation started - your AI agent is communicating with the recruiter',
      negotiation
    });
  } catch (error) {
    console.error('Error initiating reschedule negotiation:', error);
    res.status(500).json({ error: error.message || 'Failed to start reschedule negotiation' });
  }
});

/**
 * @route   POST /api/agent-arena/reschedule/:id/continue
 * @desc    Continue a reschedule negotiation
 * @access  Private
 */
router.post('/reschedule/:id/continue', auth, async (req, res) => {
  try {
    const negotiation = await agentArenaService.getNegotiationWithMessages(req.params.id);

    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    if (negotiation.candidateId !== req.user.id && negotiation.recruiterId !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to continue this negotiation' });
    }

    if (negotiation.type !== 'reschedule') {
      return res.status(400).json({ error: 'This is not a reschedule negotiation' });
    }

    const updated = await agentArenaService.continueRescheduleNegotiation(req.params.id);

    res.json({
      message: 'Reschedule negotiation round completed',
      negotiation: updated
    });
  } catch (error) {
    console.error('Error continuing reschedule negotiation:', error);
    res.status(500).json({ error: error.message || 'Failed to continue reschedule negotiation' });
  }
});

/**
 * @route   GET /api/agent-arena/interview/:interviewId/reschedule
 * @desc    Get reschedule negotiation for a specific interview
 * @access  Private
 */
router.get('/interview/:interviewId/reschedule', auth, async (req, res) => {
  try {
    const { AgentNegotiation } = require('../models');
    
    const negotiation = await AgentNegotiation.findOne({
      where: {
        interviewId: req.params.interviewId,
        type: 'reschedule',
        status: ['pending', 'negotiating']
      },
      order: [['createdAt', 'DESC']]
    });

    if (!negotiation) {
      return res.json({ hasActiveReschedule: false, negotiation: null });
    }

    if (negotiation.candidateId !== req.user.id && negotiation.recruiterId !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to view this negotiation' });
    }

    const full = await agentArenaService.getNegotiationWithMessages(negotiation.id);

    res.json({
      hasActiveReschedule: true,
      negotiation: full
    });
  } catch (error) {
    console.error('Error fetching reschedule negotiation:', error);
    res.status(500).json({ error: 'Failed to fetch reschedule negotiation' });
  }
});

module.exports = router;
