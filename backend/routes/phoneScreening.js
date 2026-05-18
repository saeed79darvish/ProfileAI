const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { PhoneScreeningCall, Interview, Job, User, Profile } = require('../models');
const vapiService = require('../services/vapiService');
const callSchedulerService = require('../services/callSchedulerService');
const { Op } = require('sequelize');

/**
 * @route   POST /api/phone-screening/schedule/:interviewId
 * @desc    Schedule a phone screening call for an interview
 * @access  Private (Recruiter only)
 */
router.post('/schedule/:interviewId',
  authMiddleware,
  [
    param('interviewId').isUUID().withMessage('Valid interview ID is required'),
    body('duration').optional().isIn([15, 30]).withMessage('Duration must be 15 or 30 minutes'),
    body('maxRetries').optional().isInt({ min: 0, max: 5 }).withMessage('Max retries must be 0-5')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Verify user is a recruiter
      if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only recruiters can schedule phone screenings' });
      }
      
      const { interviewId } = req.params;
      const { duration = 15, maxRetries = 3 } = req.body;
      
      // Verify recruiter owns this interview
      const interview = await Interview.findByPk(interviewId);
      if (!interview) {
        return res.status(404).json({ message: 'Interview not found' });
      }
      
      if (interview.recruiterId !== req.user.id) {
        return res.status(403).json({ message: 'You can only schedule calls for your own interviews' });
      }
      
      const phoneScreening = await callSchedulerService.scheduleCall(interviewId, {
        duration,
        maxRetries
      });
      
      res.status(201).json({
        message: 'Phone screening call scheduled successfully',
        phoneScreening
      });
      
    } catch (error) {
      console.error('Error scheduling phone screening:', error);
      res.status(400).json({ message: error.message });
    }
  }
);

/**
 * @route   POST /api/phone-screening/:id/start
 * @desc    Manually start a phone screening call immediately
 * @access  Private (Recruiter only)
 */
router.post('/:id/start',
  authMiddleware,
  param('id').isUUID().withMessage('Valid phone screening ID is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only recruiters can start phone screenings' });
      }
      
      const phoneScreening = await PhoneScreeningCall.findByPk(req.params.id);
      
      if (!phoneScreening) {
        return res.status(404).json({ message: 'Phone screening not found' });
      }
      
      if (phoneScreening.recruiterId !== req.user.id) {
        return res.status(403).json({ message: 'You can only start your own phone screenings' });
      }
      
      if (!['scheduled', 'failed'].includes(phoneScreening.status)) {
        return res.status(400).json({ message: `Cannot start a call with status: ${phoneScreening.status}` });
      }
      
      const result = await vapiService.initiateCall(phoneScreening.id);
      
      res.json({
        message: 'Phone screening call initiated',
        ...result
      });
      
    } catch (error) {
      console.error('Error starting phone screening:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * @route   GET /api/phone-screening/caller-info
 * @desc    Get the AI caller phone number for candidates to save
 * @access  Public
 */
router.get('/caller-info', async (req, res) => {
  try {
    const callerNumber = process.env.VAPI_CALLER_DISPLAY_NUMBER || null;
    res.json({
      callerNumber,
      callerName: 'AI Recruiter',
      tip: callerNumber 
        ? `Save this number to your contacts to avoid missing calls`
        : `Save the caller's number when you receive the call`
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get caller info' });
  }
});

/**
 * @route   GET /api/phone-screening/interview/:interviewId
 * @desc    Get phone screening for a specific interview
 * @access  Private
 */
router.get('/interview/:interviewId',
  authMiddleware,
  async (req, res) => {
    try {
      const { interviewId } = req.params;
      
      const phoneScreening = await PhoneScreeningCall.findOne({
        where: { interviewId },
        include: [
          { model: Job, as: 'Job', attributes: ['id', 'title', 'company'] },
          { 
            model: User, 
            as: 'candidate',
            attributes: ['id', 'email'],
            include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePicture'] }]
          }
        ],
        order: [['createdAt', 'DESC']]
      });
      
      if (!phoneScreening) {
        return res.status(404).json({ message: 'No phone screening found for this interview' });
      }
      
      // Only recruiter or candidate can view
      if (phoneScreening.recruiterId !== req.user.id && phoneScreening.candidateId !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized to view this phone screening' });
      }
      
      res.json(phoneScreening);
      
    } catch (error) {
      console.error('Error getting phone screening for interview:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * @route   POST /api/phone-screening/:id/reschedule
 * @desc    Request to reschedule a phone screening call (candidate)
 * @access  Private (Candidate only)
 */
router.post('/:id/reschedule',
  authMiddleware,
  [
    body('newDateTime').isISO8601().withMessage('Valid date/time is required'),
    body('reason').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const phoneScreening = await PhoneScreeningCall.findByPk(req.params.id, {
        include: [
          { model: Interview, as: 'Interview' },
          { model: Job, as: 'Job', attributes: ['id', 'title', 'company'] }
        ]
      });
      
      if (!phoneScreening) {
        return res.status(404).json({ message: 'Phone screening not found' });
      }
      
      // Only candidate can reschedule their own call
      if (phoneScreening.candidateId !== req.user.id) {
        return res.status(403).json({ message: 'Only the candidate can reschedule their phone screening' });
      }
      
      // Can only reschedule if status is scheduled or failed
      if (!['scheduled', 'failed'].includes(phoneScreening.status)) {
        return res.status(400).json({ 
          message: `Cannot reschedule a call with status: ${phoneScreening.status}` 
        });
      }
      
      const { newDateTime, reason } = req.body;
      const newTime = new Date(newDateTime);
      
      // Validate new time is in the future
      if (newTime <= new Date()) {
        return res.status(400).json({ message: 'New time must be in the future' });
      }
      
      // Update phone screening call - reset all relevant fields for a fresh call
      await phoneScreening.update({
        scheduledAt: newTime,
        status: 'scheduled',
        callAttempts: 0, // Reset attempt count
        nextRetryAt: null,
        errorMessage: null,
        vapiCallId: null, // Clear old call ID so a new call can be initiated
        endedReason: null,
        lastError: null
      });
      
      // Also update the interview scheduledAt if linked
      if (phoneScreening.Interview) {
        await phoneScreening.Interview.update({
          scheduledAt: newTime
        });
      }
      
      res.json({
        message: 'Phone screening rescheduled successfully',
        phoneScreening: {
          id: phoneScreening.id,
          scheduledAt: newTime,
          status: 'scheduled',
          job: phoneScreening.Job
        }
      });
      
    } catch (error) {
      console.error('Error rescheduling phone screening:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * @route   GET /api/phone-screening/:id
 * @desc    Get phone screening call details
 * @access  Private
 */
router.get('/:id',
  authMiddleware,
  param('id').isUUID().withMessage('Valid phone screening ID is required'),
  async (req, res) => {
    try {
      const phoneScreening = await PhoneScreeningCall.findByPk(req.params.id, {
        include: [
          { model: Interview, as: 'Interview' },
          { model: Job, as: 'Job', attributes: ['id', 'title', 'company'] },
          { 
            model: User, 
            as: 'candidate',
            attributes: ['id', 'email'],
            include: [{ model: Profile, attributes: ['firstName', 'lastName', 'profilePicture'] }]
          },
          {
            model: User,
            as: 'recruiter',
            attributes: ['id', 'email']
          }
        ]
      });
      
      if (!phoneScreening) {
        return res.status(404).json({ message: 'Phone screening not found' });
      }
      
      // Only recruiter or candidate can view
      if (phoneScreening.recruiterId !== req.user.id && phoneScreening.candidateId !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized to view this phone screening' });
      }
      
      res.json(phoneScreening);
      
    } catch (error) {
      console.error('Error getting phone screening:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * @route   GET /api/phone-screening/:id/results
 * @desc    Get screening results and analysis
 * @access  Private (Recruiter only)
 */
router.get('/:id/results',
  authMiddleware,
  param('id').isUUID().withMessage('Valid phone screening ID is required'),
  async (req, res) => {
    try {
      const phoneScreening = await PhoneScreeningCall.findByPk(req.params.id, {
        include: [
          { model: Job, as: 'Job', attributes: ['id', 'title', 'company'] },
          { 
            model: User, 
            as: 'candidate',
            attributes: ['id', 'email'],
            include: [{ model: Profile, as: 'profile', attributes: ['firstName', 'lastName', 'profilePicture', 'headline'] }]
          }
        ]
      });
      
      if (!phoneScreening) {
        return res.status(404).json({ message: 'Phone screening not found' });
      }
      
      if (phoneScreening.recruiterId !== req.user.id) {
        return res.status(403).json({ message: 'Only the recruiter can view screening results' });
      }
      
      if (phoneScreening.status !== 'completed') {
        return res.status(400).json({ message: 'Screening has not been completed yet' });
      }
      
      res.json({
        id: phoneScreening.id,
        status: phoneScreening.status,
        job: phoneScreening.Job,
        candidate: phoneScreening.candidate,
        scheduledAt: phoneScreening.scheduledAt,
        actualDuration: phoneScreening.actualDuration,
        screeningScore: phoneScreening.screeningScore,
        screeningResult: phoneScreening.screeningResult,
        recommendation: phoneScreening.recommendation,
        scoreBreakdown: phoneScreening.scoreBreakdown,
        strengths: phoneScreening.strengths,
        concerns: phoneScreening.concerns,
        extractedData: phoneScreening.extractedData,
        aiSummary: phoneScreening.aiSummary,
        transcript: phoneScreening.transcript,
        recordingUrl: phoneScreening.recordingUrl
      });
      
    } catch (error) {
      console.error('Error getting screening results:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * @route   GET /api/phone-screening/:id/listen-url
 * @desc    Get live listen URL for human-in-the-loop
 * @access  Private (Recruiter only)
 */
router.get('/:id/listen-url',
  authMiddleware,
  param('id').isUUID().withMessage('Valid phone screening ID is required'),
  async (req, res) => {
    try {
      const phoneScreening = await PhoneScreeningCall.findByPk(req.params.id);
      
      if (!phoneScreening) {
        return res.status(404).json({ message: 'Phone screening not found' });
      }
      
      if (phoneScreening.recruiterId !== req.user.id) {
        return res.status(403).json({ message: 'Only the recruiter can listen to the call' });
      }
      
      if (!phoneScreening.vapiCallId) {
        return res.status(400).json({ message: 'Call has not been initiated yet' });
      }
      
      if (!['ringing', 'in_progress'].includes(phoneScreening.status)) {
        return res.status(400).json({ message: 'Call is not currently active' });
      }
      
      const urls = await vapiService.getListenUrl(phoneScreening.vapiCallId);
      
      res.json({
        phoneScreeningId: phoneScreening.id,
        status: phoneScreening.status,
        ...urls
      });
      
    } catch (error) {
      console.error('Error getting listen URL:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * @route   POST /api/phone-screening/:id/transfer
 * @desc    Transfer call to human recruiter
 * @access  Private (Recruiter only)
 */
router.post('/:id/transfer',
  authMiddleware,
  [
    param('id').isUUID().withMessage('Valid phone screening ID is required'),
    body('phoneNumber').isMobilePhone().withMessage('Valid phone number is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const phoneScreening = await PhoneScreeningCall.findByPk(req.params.id);
      
      if (!phoneScreening) {
        return res.status(404).json({ message: 'Phone screening not found' });
      }
      
      if (phoneScreening.recruiterId !== req.user.id) {
        return res.status(403).json({ message: 'Only the recruiter can transfer the call' });
      }
      
      if (phoneScreening.status !== 'in_progress') {
        return res.status(400).json({ message: 'Can only transfer an active call' });
      }
      
      await vapiService.transferToHuman(phoneScreening.vapiCallId, req.body.phoneNumber);
      
      await phoneScreening.update({ 
        transferredToHuman: true,
        transferredAt: new Date()
      });
      
      res.json({ message: 'Call transferred to human recruiter' });
      
    } catch (error) {
      console.error('Error transferring call:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * @route   POST /api/phone-screening/:id/end
 * @desc    End an active call
 * @access  Private (Recruiter only)
 */
router.post('/:id/end',
  authMiddleware,
  param('id').isUUID().withMessage('Valid phone screening ID is required'),
  async (req, res) => {
    try {
      const phoneScreening = await PhoneScreeningCall.findByPk(req.params.id);
      
      if (!phoneScreening) {
        return res.status(404).json({ message: 'Phone screening not found' });
      }
      
      if (phoneScreening.recruiterId !== req.user.id) {
        return res.status(403).json({ message: 'Only the recruiter can end the call' });
      }
      
      if (!['ringing', 'in_progress'].includes(phoneScreening.status)) {
        return res.status(400).json({ message: 'Call is not currently active' });
      }
      
      await vapiService.endCall(phoneScreening.vapiCallId);
      
      res.json({ message: 'Call ended successfully' });
      
    } catch (error) {
      console.error('Error ending call:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * @route   DELETE /api/phone-screening/:id
 * @desc    Cancel a scheduled phone screening
 * @access  Private (Recruiter only)
 */
router.delete('/:id',
  authMiddleware,
  param('id').isUUID().withMessage('Valid phone screening ID is required'),
  async (req, res) => {
    try {
      const phoneScreening = await PhoneScreeningCall.findByPk(req.params.id);
      
      if (!phoneScreening) {
        return res.status(404).json({ message: 'Phone screening not found' });
      }
      
      if (phoneScreening.recruiterId !== req.user.id) {
        return res.status(403).json({ message: 'Only the recruiter can cancel this screening' });
      }
      
      await callSchedulerService.cancelCall(phoneScreening.id);
      
      res.json({ message: 'Phone screening cancelled successfully' });
      
    } catch (error) {
      console.error('Error cancelling phone screening:', error);
      res.status(400).json({ message: error.message });
    }
  }
);

/**
 * @route   PUT /api/phone-screening/:id/reschedule
 * @desc    Reschedule a phone screening call
 * @access  Private (Recruiter only)
 */
router.put('/:id/reschedule',
  authMiddleware,
  [
    param('id').isUUID().withMessage('Valid phone screening ID is required'),
    body('scheduledAt').isISO8601().withMessage('Valid date is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const phoneScreening = await PhoneScreeningCall.findByPk(req.params.id);
      
      if (!phoneScreening) {
        return res.status(404).json({ message: 'Phone screening not found' });
      }
      
      if (phoneScreening.recruiterId !== req.user.id) {
        return res.status(403).json({ message: 'Only the recruiter can reschedule this screening' });
      }
      
      const updated = await callSchedulerService.rescheduleCall(
        phoneScreening.id, 
        new Date(req.body.scheduledAt)
      );
      
      res.json({
        message: 'Phone screening rescheduled successfully',
        phoneScreening: updated
      });
      
    } catch (error) {
      console.error('Error rescheduling phone screening:', error);
      res.status(400).json({ message: error.message });
    }
  }
);

/**
 * @route   GET /api/phone-screening/recruiter/list
 * @desc    Get all phone screenings for a recruiter
 * @access  Private (Recruiter only)
 */
router.get('/recruiter/list',
  authMiddleware,
  [
    query('status').optional().isIn(['scheduled', 'pending', 'initiating', 'queued', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'voicemail', 'busy', 'cancelled']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  async (req, res) => {
    try {
      if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only recruiters can access this endpoint' });
      }
      
      const { status, limit = 20, offset = 0 } = req.query;
      
      const where = { recruiterId: req.user.id };
      if (status) {
        where.status = status;
      }
      
      const { rows, count } = await PhoneScreeningCall.findAndCountAll({
        where,
        include: [
          { model: Job, as: 'Job', attributes: ['id', 'title', 'company'] },
          { 
            model: User, 
            as: 'candidate',
            attributes: ['id', 'email'],
            include: [{ model: Profile, as: 'profile', attributes: ['firstName', 'lastName', 'profilePicture'] }]
          }
        ],
        order: [['scheduledAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        phoneScreenings: rows,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
    } catch (error) {
      console.error('Error listing phone screenings:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * @route   GET /api/phone-screening/recruiter/upcoming
 * @desc    Get upcoming scheduled phone screenings
 * @access  Private (Recruiter only)
 */
router.get('/recruiter/upcoming',
  authMiddleware,
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req, res) => {
    try {
      if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only recruiters can access this endpoint' });
      }
      
      const limit = parseInt(req.query.limit) || 10;
      const upcoming = await callSchedulerService.getUpcomingCalls(req.user.id, limit);
      
      res.json({ phoneScreenings: upcoming });
      
    } catch (error) {
      console.error('Error getting upcoming screenings:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * @route   GET /api/phone-screening/recruiter/stats
 * @desc    Get phone screening statistics for a recruiter
 * @access  Private (Recruiter only)
 */
router.get('/recruiter/stats',
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only recruiters can access this endpoint' });
      }
      
      const stats = await callSchedulerService.getCallStats(req.user.id);
      
      res.json(stats);
      
    } catch (error) {
      console.error('Error getting screening stats:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
