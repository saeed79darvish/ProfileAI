const express = require('express');
const router = express.Router();
const { Interview, User, Job, Profile, JobScreening, Message, Conversation, RecruiterProfile, PhoneScreeningCall } = require('../models');
const authMiddleware = require('../middleware/auth');
const { Op } = require('sequelize');
const aiService = require('../services/aiService');
const callSchedulerService = require('../services/callSchedulerService');
const notificationService = require('../services/notificationService');

// @route   GET /api/interviews
// @desc    Get all interviews for current user (candidate or recruiter)
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { role, status, upcoming } = req.query;

    let whereClause = {};
    
    // Filter by role
    if (role === 'candidate') {
      whereClause.candidateId = userId;
    } else if (role === 'recruiter') {
      whereClause.recruiterId = userId;
    } else {
      // Get all interviews where user is either candidate or recruiter
      whereClause[Op.or] = [
        { candidateId: userId },
        { recruiterId: userId }
      ];
    }

    // Filter by status
    if (status) {
      whereClause.status = status;
    }

    // Filter upcoming only
    if (upcoming === 'true') {
      whereClause.scheduledAt = {
        [Op.gte]: new Date()
      };
      whereClause.status = {
        [Op.in]: ['confirmed', 'pending']
      };
    }

    const interviews = await Interview.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{
            model: Profile,
            as: 'profile',
            attributes: ['headline', 'profilePicture', 'phone']
          }]
        },
        {
          model: User,
          as: 'recruiter',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'title', 'company', 'location']
        },
        {
          model: PhoneScreeningCall,
          as: 'phoneScreening',
          attributes: ['id', 'status', 'scheduledAt', 'endedAt', 'durationSeconds', 'screeningScore', 'recommendation', 'summary', 'endedReason', 'callAttempts'],
          required: false
        }
      ],
      order: [['scheduledAt', 'ASC'], ['createdAt', 'DESC']]
    });

    // Filter out dismissed interviews for candidates
    const filteredInterviews = interviews.filter(interview => {
      if (interview.candidateId === userId && interview.candidateResponse?.dismissed) {
        return false;
      }
      return true;
    });

    res.json(filteredInterviews);
  } catch (error) {
    console.error('Error fetching interviews:', error);
    res.status(500).json({ message: 'Error fetching interviews', error: error.message });
  }
});

// @route   GET /api/interviews/calendar
// @desc    Get interviews for calendar view (recruiter)
// @access  Private
router.get('/calendar', authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.query;
    const userId = req.user.id;

    // Default to current month/year
    const targetMonth = parseInt(month) || new Date().getMonth();
    const targetYear = parseInt(year) || new Date().getFullYear();

    // Get start and end of month
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const interviews = await Interview.findAll({
      where: {
        recruiterId: userId,
        scheduledAt: {
          [Op.between]: [startDate, endDate]
        },
        status: {
          [Op.in]: ['confirmed', 'pending']
        }
      },
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{
            model: Profile,
            as: 'profile',
            attributes: ['headline', 'profilePicture']
          }]
        },
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'title', 'company']
        }
      ],
      order: [['scheduledAt', 'ASC']]
    });

    res.json(interviews);
  } catch (error) {
    console.error('Error fetching calendar interviews:', error);
    res.status(500).json({ message: 'Error fetching calendar', error: error.message });
  }
});

// @route   GET /api/interviews/:id
// @desc    Get single interview details
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{
            model: Profile,
            as: 'profile',
            attributes: ['headline', 'profilePicture', 'skills']
          }]
        },
        {
          model: User,
          as: 'recruiter',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'title', 'company', 'location', 'description']
        }
      ]
    });

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Verify user has access
    if (interview.candidateId !== req.user.id && interview.recruiterId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this interview' });
    }

    res.json(interview);
  } catch (error) {
    console.error('Error fetching interview:', error);
    res.status(500).json({ message: 'Error fetching interview', error: error.message });
  }
});

// @route   POST /api/interviews
// @desc    Create a new interview/scheduling request
// @access  Private (Recruiter)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      jobId,
      candidateId,
      proposedSlots,
      type = 'screening',
      format = 'phone', // Default to phone for AI screening
      duration = 30,
      recruiterNotes,
      phoneScreeningEnabled = true, // AI phone screening enabled by default
      phoneScreeningDuration = 15
    } = req.body;

    // Validate required fields
    if (!jobId || !candidateId || !proposedSlots || proposedSlots.length === 0) {
      return res.status(400).json({ 
        message: 'Job ID, candidate ID, and at least one proposed time slot are required' 
      });
    }

    // Verify job belongs to recruiter
    const job = await Job.findByPk(jobId);
    if (!job || job.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to create interview for this job' });
    }

    // If phone screening enabled, verify candidate has phone number
    if (phoneScreeningEnabled) {
      const candidateProfile = await Profile.findOne({ where: { userId: candidateId } });
      if (!candidateProfile?.phone) {
        return res.status(400).json({ 
          message: 'Phone screening requires candidate to have a phone number on their profile' 
        });
      }
    }

    // Create interview
    const interview = await Interview.create({
      jobId,
      candidateId,
      recruiterId: req.user.id,
      proposedSlots,
      type,
      format,
      duration,
      recruiterNotes,
      phoneScreeningEnabled,
      phoneScreeningDuration,
      status: 'pending'
    });

    // Send message to candidate about scheduling
    await sendSchedulingMessage(req.user.id, candidateId, job, interview, proposedSlots);

    const fullInterview = await Interview.findByPk(interview.id, {
      include: [
        { model: User, as: 'candidate', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Job, as: 'job', attributes: ['id', 'title', 'company'] }
      ]
    });

    // Notify candidate about the interview scheduling request
    notificationService.notifyInterviewScheduled(candidateId, interview, job, req.user)
      .catch(err => console.error('Error sending interview notification:', err));

    res.status(201).json(fullInterview);
  } catch (error) {
    console.error('Error creating interview:', error);
    res.status(500).json({ message: 'Error creating interview', error: error.message });
  }
});

// @route   POST /api/interviews/:id/respond
// @desc    Candidate responds to interview request (accept a slot or propose new times)
// @access  Private (Candidate)
router.post('/:id/respond', authMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findByPk(req.params.id, {
      include: [
        { model: User, as: 'recruiter', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Job, as: 'job', attributes: ['id', 'title', 'company'] }
      ]
    });

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    if (interview.candidateId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to respond to this interview' });
    }

    const { action, selectedSlotIndex, proposedSlots, message } = req.body;

    if (action === 'accept') {
      // Candidate accepts one of the proposed slots
      if (selectedSlotIndex === undefined || selectedSlotIndex < 0 || 
          selectedSlotIndex >= interview.proposedSlots.length) {
        return res.status(400).json({ message: 'Invalid slot selection' });
      }

      const selectedSlot = interview.proposedSlots[selectedSlotIndex];
      
      await interview.update({
        status: 'confirmed',
        scheduledAt: new Date(selectedSlot.datetime),
        confirmedAt: new Date(),
        candidateResponse: {
          selectedSlot: selectedSlotIndex,
          message: message || ''
        },
        // Generate a simple meeting link (in production, integrate with Zoom/Google Meet)
        meetingLink: `https://meet.profileai.com/interview/${interview.id}`
      });

      // Auto-schedule phone screening if enabled
      if (interview.phoneScreeningEnabled) {
        try {
          const phoneScreening = await callSchedulerService.scheduleCall(interview.id, {
            duration: interview.phoneScreeningDuration || 15
          });
          await interview.update({ phoneScreeningCallId: phoneScreening.id });
          console.log(`📞 Auto-scheduled phone screening for interview ${interview.id}`);
        } catch (screeningError) {
          console.error('Failed to schedule phone screening:', screeningError.message);
          // Don't fail the interview confirmation if screening fails
        }
      }

      // Notify recruiter
      await sendConfirmationMessage(
        req.user.id, 
        interview.recruiterId, 
        interview.job, 
        interview, 
        selectedSlot
      );

    } else if (action === 'reschedule') {
      // Candidate proposes new times - automatically reschedule to first proposed time
      if (!proposedSlots || proposedSlots.length === 0) {
        return res.status(400).json({ message: 'At least one proposed time slot is required' });
      }

      // Automatically use the first proposed slot
      const selectedSlot = proposedSlots[0];
      const newScheduledAt = new Date(selectedSlot.datetime);
      const previousScheduledAt = interview.scheduledAt;

      // Update interview to confirmed with new time
      await interview.update({
        scheduledAt: newScheduledAt,
        status: 'confirmed',
        confirmedAt: new Date(),
        proposedSlots: proposedSlots,
        rescheduleHistory: [
          ...(interview.rescheduleHistory || []),
          {
            previousTime: previousScheduledAt,
            newTime: newScheduledAt,
            reason: message || 'Candidate requested reschedule',
            acceptedSlotIndex: 0,
            acceptedAt: new Date(),
            acceptedBy: 'automatic'
          }
        ]
      });

      // If phone screening is enabled, reschedule the call
      if (interview.phoneScreeningEnabled) {
        const existingCall = await PhoneScreeningCall.findOne({
          where: { interviewId: interview.id }
        });

        if (existingCall) {
          try {
            // Reset the call to scheduled status with new time
            await existingCall.update({
              scheduledAt: newScheduledAt,
              status: 'scheduled',
              callAttempts: 0,
              nextRetryAt: null,
              errorMessage: null,
              vapiCallId: null, // Clear old call ID so a new call can be initiated
              endedReason: null,
              lastError: null
            });
            
            console.log(`📞 Phone screening automatically rescheduled to ${newScheduledAt} for interview ${interview.id}`);
          } catch (screeningError) {
            console.error('Failed to reschedule phone screening:', screeningError.message);
          }
        }
      }

      // Get candidate info
      const candidate = await User.findByPk(req.user.id, {
        attributes: ['id', 'firstName', 'lastName']
      });

      // Notify recruiter about automatic reschedule
      await sendRescheduleMessage(
        req.user.id, 
        interview.recruiterId, 
        interview.job, 
        proposedSlots,
        message,
        interview,
        candidate,
        true // Indicate it was auto-rescheduled
      );

    } else if (action === 'decline') {
      await interview.update({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: message || 'Declined by candidate'
      });

      // Notify recruiter via notification service
      notificationService.notifyInterviewCancelled(interview.recruiterId, interview, interview.job, message || 'Declined by candidate')
        .catch(err => console.error('Error sending cancel notification:', err));

      // Notify recruiter
      await sendDeclineMessage(req.user.id, interview.recruiterId, interview.job, message);
    } else {
      return res.status(400).json({ message: 'Invalid action. Use: accept, reschedule, or decline' });
    }

    const updatedInterview = await Interview.findByPk(interview.id, {
      include: [
        { model: User, as: 'candidate', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'recruiter', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Job, as: 'job', attributes: ['id', 'title', 'company'] }
      ]
    });

    res.json(updatedInterview);
  } catch (error) {
    console.error('Error responding to interview:', error);
    res.status(500).json({ message: 'Error responding to interview', error: error.message });
  }
});

// @route   POST /api/interviews/:id/reschedule
// @desc    Directly reschedule an interview to a new time (candidate)
// @access  Private (candidate only)
router.post('/:id/reschedule', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    // Accept both 'newDateTime' (from CandidateInterviews) and 'proposedDate' (from MessagesPage)
    const { newDateTime, proposedDate, reason } = req.body;
    const dateTimeValue = newDateTime || proposedDate;
    const userId = req.user.id;
    
    console.log('📅 Reschedule request:', { id, newDateTime, proposedDate, reason, userId });

    const interview = await Interview.findByPk(id, {
      include: [
        { model: User, as: 'recruiter', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Job, as: 'job', attributes: ['id', 'title', 'company'] }
      ]
    });
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Verify the candidate owns this interview
    if (interview.candidateId !== userId) {
      return res.status(403).json({ message: 'Not authorized to reschedule this interview' });
    }

    // Validate new date time
    if (!dateTimeValue) {
      return res.status(400).json({ message: 'New date and time is required (use newDateTime or proposedDate)' });
    }

    const newScheduledAt = new Date(dateTimeValue);
    
    // Only validate that the time is not in the past
    if (newScheduledAt < new Date()) {
      return res.status(400).json({ message: 'Cannot schedule interview in the past' });
    }

    const previousScheduledAt = interview.scheduledAt;

    // Directly update the interview schedule
    await interview.update({
      scheduledAt: newScheduledAt,
      status: 'confirmed', // Keep it confirmed with new time
      rescheduleHistory: [
        ...(interview.rescheduleHistory || []),
        {
          previousTime: previousScheduledAt,
          newTime: newScheduledAt,
          reason: reason || 'Rescheduled by candidate',
          rescheduledAt: new Date(),
          rescheduledBy: 'candidate'
        }
      ]
    });

    // If phone screening is enabled, reschedule the call too
    console.log(`📋 Interview phone screening status: enabled=${interview.phoneScreeningEnabled}, callId=${interview.phoneScreeningCallId}`);
    
    if (interview.phoneScreeningEnabled) {
      const existingCall = await PhoneScreeningCall.findOne({
        where: { interviewId: interview.id }
      });

      console.log(`📋 Found existing call: ${existingCall ? existingCall.id.substring(0,8) : 'NO'}`);

      if (existingCall) {
        try {
          // Reset the call to scheduled status with new time
          await existingCall.update({
            scheduledAt: newScheduledAt,
            status: 'scheduled',
            callAttempts: 0,
            nextRetryAt: null,
            errorMessage: null,
            vapiCallId: null, // Clear old call ID so a new call can be initiated
            endedReason: null,
            lastError: null
          });
          
          console.log(`📞 Phone screening rescheduled to ${newScheduledAt} for interview ${interview.id}`);
        } catch (screeningError) {
          console.error('Failed to reschedule phone screening:', screeningError.message);
          // Don't fail the whole operation
        }
      } else {
        // No existing call, create one if phone screening should be enabled
        try {
          const callSchedulerService = require('../services/callSchedulerService');
          await callSchedulerService.scheduleCall(interview.id);
          console.log(`📞 Phone screening scheduled for rescheduled interview ${interview.id}`);
        } catch (scheduleError) {
          console.error('Failed to schedule phone screening:', scheduleError.message);
        }
      }
    }

    // Send notification message to recruiter
    try {
      const candidate = await User.findByPk(userId, {
        attributes: ['id', 'firstName', 'lastName']
      });

      let conversation = await Conversation.findOne({
        where: {
          [Op.or]: [
            { participant1Id: interview.recruiterId, participant2Id: userId },
            { participant1Id: userId, participant2Id: interview.recruiterId }
          ]
        }
      });

      if (conversation) {
        const newDateStr = newScheduledAt.toLocaleDateString('en-US', { 
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
        });
        const newTimeStr = newScheduledAt.toLocaleTimeString('en-US', { 
          hour: 'numeric', minute: '2-digit' 
        });

        await Message.create({
          conversationId: conversation.id,
          senderId: userId,
          content: `I've rescheduled our interview to ${newDateStr} at ${newTimeStr}. ${reason ? `Reason: ${reason}` : ''} Looking forward to speaking with you!`,
          metadata: {
            type: 'interview_rescheduled',
            interviewId: interview.id,
            previousTime: previousScheduledAt,
            newTime: newScheduledAt
          }
        });

        await conversation.update({ lastMessageAt: new Date() });
      }
    } catch (msgError) {
      console.error('Error sending reschedule notification:', msgError);
    }

    // Return updated interview
    const updatedInterview = await Interview.findByPk(interview.id, {
      include: [
        { model: User, as: 'candidate', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'recruiter', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Job, as: 'job', attributes: ['id', 'title', 'company'] }
      ]
    });

    res.json({ 
      message: 'Interview rescheduled successfully',
      interview: updatedInterview
    });
  } catch (error) {
    console.error('❌ Error rescheduling interview:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ message: 'Failed to reschedule interview', error: error.message });
  }
});

// @route   POST /api/interviews/:id/accept-reschedule
// @desc    Recruiter accepts one of candidate's proposed reschedule times
// @access  Private (recruiter only)
router.post('/:id/accept-reschedule', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedSlotIndex } = req.body;
    const userId = req.user.id;
    
    console.log('✅ Recruiter accepting reschedule:', { id, selectedSlotIndex, userId });

    const interview = await Interview.findByPk(id, {
      include: [
        { model: User, as: 'candidate', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'recruiter', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Job, as: 'job', attributes: ['id', 'title', 'company'] }
      ]
    });
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Verify the recruiter owns this interview
    if (interview.recruiterId !== userId) {
      return res.status(403).json({ message: 'Not authorized to accept reschedule for this interview' });
    }

    // Validate that interview has status 'rescheduled' and has proposed slots
    if (interview.status !== 'rescheduled' || !interview.proposedSlots || interview.proposedSlots.length === 0) {
      return res.status(400).json({ message: 'No reschedule proposal found for this interview' });
    }

    // Validate selected slot index
    if (selectedSlotIndex === undefined || selectedSlotIndex < 0 || selectedSlotIndex >= interview.proposedSlots.length) {
      return res.status(400).json({ message: 'Invalid slot selection' });
    }

    const selectedSlot = interview.proposedSlots[selectedSlotIndex];
    const newScheduledAt = new Date(selectedSlot.datetime);
    const previousScheduledAt = interview.scheduledAt;

    // Update interview to confirmed with new time
    await interview.update({
      scheduledAt: newScheduledAt,
      status: 'confirmed',
      confirmedAt: new Date(),
      rescheduleHistory: [
        ...(interview.rescheduleHistory || []),
        {
          previousTime: previousScheduledAt,
          newTime: newScheduledAt,
          reason: 'Recruiter accepted candidate proposed time',
          acceptedSlotIndex: selectedSlotIndex,
          acceptedAt: new Date(),
          acceptedBy: 'recruiter'
        }
      ]
    });

    // If phone screening is enabled, reschedule the call
    if (interview.phoneScreeningEnabled) {
      const existingCall = await PhoneScreeningCall.findOne({
        where: { interviewId: interview.id }
      });

      if (existingCall) {
        try {
          // Reset the call to scheduled status with new time
          await existingCall.update({
            scheduledAt: newScheduledAt,
            status: 'scheduled',
            callAttempts: 0,
            nextRetryAt: null,
            errorMessage: null,
            vapiCallId: null, // Clear old call ID so a new call can be initiated
            endedReason: null
          });
          
          console.log(`📞 Phone screening rescheduled to ${newScheduledAt} for interview ${interview.id}`);
        } catch (screeningError) {
          console.error('Failed to reschedule phone screening:', screeningError.message);
          // Don't fail the whole operation
        }
      } else {
        // No existing call, create one if phone screening should be enabled
        try {
          const callSchedulerService = require('../services/callSchedulerService');
          await callSchedulerService.scheduleCall(interview.id);
          console.log(`📞 Phone screening scheduled for rescheduled interview ${interview.id}`);
        } catch (scheduleError) {
          console.error('Failed to schedule phone screening:', scheduleError.message);
        }
      }
    }

    // Send notification message to candidate
    try {
      const candidate = interview.candidate;
      const recruiter = interview.recruiter;

      let conversation = await Conversation.findOne({
        where: {
          [Op.or]: [
            { participant1Id: interview.recruiterId, participant2Id: interview.candidateId },
            { participant1Id: interview.candidateId, participant2Id: interview.recruiterId }
          ]
        }
      });

      if (conversation) {
        const newDateStr = newScheduledAt.toLocaleDateString('en-US', { 
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
        });
        const newTimeStr = newScheduledAt.toLocaleTimeString('en-US', { 
          hour: 'numeric', minute: '2-digit' 
        });

        await Message.create({
          conversationId: conversation.id,
          senderId: userId, // From recruiter
          content: `Hi ${candidate.firstName}! I've confirmed our interview for ${newDateStr} at ${newTimeStr}. Thanks for your flexibility! Looking forward to speaking with you.`,
          metadata: {
            type: 'interview_rescheduled_confirmed',
            interviewId: interview.id,
            previousTime: previousScheduledAt,
            newTime: newScheduledAt,
            acceptedSlotIndex: selectedSlotIndex
          }
        });

        await conversation.update({ lastMessageAt: new Date() });
      }
    } catch (msgError) {
      console.error('Error sending reschedule confirmation:', msgError);
    }

    // Return updated interview
    const updatedInterview = await Interview.findByPk(interview.id, {
      include: [
        { model: User, as: 'candidate', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'recruiter', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Job, as: 'job', attributes: ['id', 'title', 'company'] }
      ]
    });

    res.json({ 
      message: 'Reschedule accepted and phone screening rescheduled',
      interview: updatedInterview
    });
  } catch (error) {
    console.error('❌ Error accepting reschedule:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ message: 'Failed to accept reschedule', error: error.message });
  }
});

// @route   PUT /api/interviews/:id
// @desc    Update interview (recruiter can update details, confirm reschedule)
// @access  Private (Recruiter)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findByPk(req.params.id);

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    if (interview.recruiterId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this interview' });
    }

    const {
      scheduledAt,
      meetingLink,
      location,
      recruiterNotes,
      status,
      feedback
    } = req.body;

    const updateData = {};
    if (scheduledAt) updateData.scheduledAt = new Date(scheduledAt);
    if (meetingLink) updateData.meetingLink = meetingLink;
    if (location) updateData.location = location;
    if (recruiterNotes) updateData.recruiterNotes = recruiterNotes;
    if (status) updateData.status = status;
    if (feedback) updateData.feedback = feedback;

    if (status === 'confirmed' && scheduledAt) {
      updateData.confirmedAt = new Date();
    }

    await interview.update(updateData);

    // If scheduledAt changed and phone screening is enabled, create or update the phone screening call
    if (scheduledAt && interview.phoneScreeningEnabled) {
      try {
        if (interview.phoneScreeningCallId) {
          // Update existing call
          const phoneScreeningCall = await PhoneScreeningCall.findByPk(interview.phoneScreeningCallId);
          if (phoneScreeningCall && ['scheduled', 'failed'].includes(phoneScreeningCall.status)) {
            await phoneScreeningCall.update({
              scheduledAt: new Date(scheduledAt),
              status: 'scheduled', // Reset to scheduled if it was failed
              callAttempts: 0,
              nextRetryAt: null,
              errorMessage: null,
              vapiCallId: null, // Clear old call ID so a new call can be initiated
              endedReason: null,
              lastError: null
            });
            console.log(`📞 Phone screening call rescheduled to ${scheduledAt}`);
          }
        } else {
          // Create new call if it doesn't exist
          const callSchedulerService = require('../services/callSchedulerService');
          const phoneScreening = await callSchedulerService.scheduleCall(interview.id, {
            duration: interview.phoneScreeningDuration || 15
          });
          await interview.update({ phoneScreeningCallId: phoneScreening.id });
          console.log(`📞 Phone screening call created for interview ${interview.id} at ${scheduledAt}`);
        }
      } catch (phoneError) {
        console.error('Error managing phone screening call:', phoneError);
        // Don't fail the whole request if phone screening update fails
      }
    }

    const updatedInterview = await Interview.findByPk(interview.id, {
      include: [
        { model: User, as: 'candidate', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Job, as: 'job', attributes: ['id', 'title', 'company'] }
      ]
    });

    res.json(updatedInterview);
  } catch (error) {
    console.error('Error updating interview:', error);
    res.status(500).json({ message: 'Error updating interview', error: error.message });
  }
});

// @route   DELETE /api/interviews/:id
// @desc    Cancel/delete interview
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findByPk(req.params.id);

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Both candidate and recruiter can cancel
    if (interview.candidateId !== req.user.id && interview.recruiterId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to cancel this interview' });
    }

    await interview.update({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: req.body.reason || `Cancelled by ${req.user.role}`
    });

    res.json({ message: 'Interview cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling interview:', error);
    res.status(500).json({ message: 'Error cancelling interview', error: error.message });
  }
});

// @route   DELETE /api/interviews/:id/dismiss
// @desc    Dismiss/remove interview from candidate's view (soft delete for candidate)
// @access  Private (candidate only)
router.delete('/:id/dismiss', authMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findByPk(req.params.id);

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Only the candidate can dismiss their interviews
    if (interview.candidateId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to dismiss this interview' });
    }

    // Always use soft dismiss - mark as dismissed in candidateResponse
    // This preserves interview data for analytics and recruiter view
    await interview.update({
      candidateResponse: {
        ...(interview.candidateResponse || {}),
        dismissed: true,
        dismissedAt: new Date()
      }
    });

    res.json({ message: 'Interview removed from your list' });
  } catch (error) {
    console.error('Error dismissing interview:', error);
    res.status(500).json({ message: 'Error dismissing interview', error: error.message });
  }
});

// @route   GET /api/interviews/pending/:messageId
// @desc    Get interview request by message ID (for candidate response UI)
// @access  Private
router.get('/pending/message/:messageId', authMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findOne({
      where: {
        messageId: req.params.messageId,
        candidateId: req.user.id
      },
      include: [
        { model: User, as: 'recruiter', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Job, as: 'job', attributes: ['id', 'title', 'company', 'location'] }
      ]
    });

    if (!interview) {
      return res.status(404).json({ message: 'No interview request found for this message' });
    }

    res.json(interview);
  } catch (error) {
    console.error('Error fetching interview by message:', error);
    res.status(500).json({ message: 'Error fetching interview', error: error.message });
  }
});

// Helper functions for sending messages

async function sendSchedulingMessage(recruiterId, candidateId, job, interview, proposedSlots) {
  try {
    // Find or create conversation
    let conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { participant1Id: recruiterId, participant2Id: candidateId },
          { participant1Id: candidateId, participant2Id: recruiterId }
        ]
      }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participant1Id: recruiterId,
        participant2Id: candidateId
      });
    }

    // Format time slots for message
    const slotsText = proposedSlots.map((slot, i) => {
      const date = new Date(slot.datetime);
      return `${i + 1}. ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }).join('\n');

    const messageContent = `Hi! I'd like to schedule a ${interview.type} interview with you for the ${job.title} position at ${job.company}.\n\nPlease select one of the following times that works for you:\n\n${slotsText}\n\nThe call will be about ${interview.duration} minutes via ${interview.format}. Looking forward to speaking with you!`;

    const message = await Message.create({
      conversationId: conversation.id,
      senderId: recruiterId,
      content: messageContent,
      metadata: {
        type: 'interview_request',
        interviewId: interview.id,
        proposedSlots: proposedSlots
      }
    });

    // Update interview with message ID
    await interview.update({ messageId: message.id });

    await conversation.update({ lastMessageAt: new Date() });
  } catch (error) {
    console.error('Error sending scheduling message:', error);
  }
}

async function sendConfirmationMessage(candidateId, recruiterId, job, interview, selectedSlot) {
  try {
    let conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { participant1Id: recruiterId, participant2Id: candidateId },
          { participant1Id: candidateId, participant2Id: recruiterId }
        ]
      }
    });

    if (!conversation) return;

    const date = new Date(selectedSlot.datetime);
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const messageContent = `Great news! I've confirmed our interview for ${dateStr} at ${timeStr}.\n\nMeeting link: ${interview.meetingLink}\n\nLooking forward to our conversation!`;

    await Message.create({
      conversationId: conversation.id,
      senderId: candidateId,
      content: messageContent,
      metadata: {
        type: 'interview_confirmed',
        interviewId: interview.id
      }
    });

    await conversation.update({ lastMessageAt: new Date() });
  } catch (error) {
    console.error('Error sending confirmation message:', error);
  }
}

async function sendRescheduleMessage(candidateId, recruiterId, job, proposedSlots, message, interview = null, candidate = null, autoRescheduled = false) {
  try {
    let conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { participant1Id: recruiterId, participant2Id: candidateId },
          { participant1Id: candidateId, participant2Id: recruiterId }
        ]
      }
    });

    if (!conversation) {
      // Create conversation if it doesn't exist
      conversation = await Conversation.create({
        participant1Id: candidateId,
        participant2Id: recruiterId
      });
    }

    const slotsText = proposedSlots.map((slot, i) => {
      const date = new Date(slot.datetime);
      return `${i + 1}. ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }).join('\n');

    // Don't create separate candidate message - will be included in AI response below

    // Generate AI recruiter agent response
    try {
      // Get recruiter info for personalized response
      const recruiter = await User.findByPk(recruiterId, {
        include: [{ model: RecruiterProfile, as: 'recruiterProfile' }]
      });

      const recruiterProfile = recruiter?.recruiterProfile || { firstName: recruiter?.firstName };
      const candidateName = candidate?.firstName || 'there';
      
      // Build the message content for AI context (use the reschedule reason/message)
      const rescheduleContext = message || "I need to reschedule the interview to a different time.";

      // Try to generate AI response with a timeout
      let agentResponse = null;
      let timeoutId = null;
      try {
        // Create a timeout promise with a handle we can clear
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('AI timeout')), 10000); // 10 second timeout
        });
        
        // Race between AI call and timeout
        agentResponse = await Promise.race([
          aiService.generateRecruiterAgentResponse(
            candidateName,
            rescheduleContext,
            interview,
            { firstName: recruiter?.firstName, companyName: recruiterProfile?.companyName },
            'reschedule'
          ),
          timeoutPromise
        ]);
        
        // Clear the timeout if AI call succeeded
        if (timeoutId) clearTimeout(timeoutId);
        console.log('🤖 [AI Agent] Generated reschedule response:', agentResponse);
      } catch (aiCallError) {
        console.log('🤖 [AI Agent] Using fallback response due to:', aiCallError.message);
        // Use fallback response
        agentResponse = {
          response: null, // Will use default below
          actionTaken: 'reschedule_acknowledged',
          requiresRecruiterApproval: true,
          internalNote: 'Auto-generated response (AI unavailable)'
        };
      }

      // Format reschedule message from candidate with their proposed slots
      const candidateReason = message || "Unfortunately, the proposed times don't work for me.";
      
      let rescheduleContent;
      if (autoRescheduled) {
        const selectedDate = new Date(proposedSlots[0].datetime);
        const dateStr = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        const timeStr = selectedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        
        rescheduleContent = `${candidateReason}\n\nI'd like to reschedule to a different time.\n\nHere are some times that would work better for me:\n\n${slotsText}\n\n✅ Interview automatically rescheduled to ${dateStr} at ${timeStr}`;
      } else {
        rescheduleContent = `${candidateReason}\n\nHere are some times that would work better for me:\n\n${slotsText}\n\nPlease let me know if any of these work for you.`;
      }

      // Create single reschedule request message from candidate
      const aiMessage = await Message.create({
        conversationId: conversation.id,
        senderId: candidateId, // From candidate, not recruiter AI
        content: rescheduleContent,
        metadata: {
          type: autoRescheduled ? 'interview_reschedule_confirmed' : 'interview_reschedule_request',
          isAiGenerated: false,
          requiresRecruiterAction: !autoRescheduled,
          interviewId: interview?.id,
          proposedSlots: proposedSlots,
          originalMessage: candidateReason,
          autoRescheduled: autoRescheduled
        }
      });

      console.log('🤖 [AI Agent] Reschedule response sent:', aiMessage.id);

      // Update conversation with AI response
      await conversation.update({ 
        lastMessageAt: new Date(),
        lastMessagePreview: rescheduleContent.substring(0, 100) + '...'
      });

    } catch (aiError) {
      console.error('AI Agent error (non-blocking):', aiError);
      
      // Even if AI fails completely, still send a fallback response
      try {
        const candidateReason = message || "Unfortunately, the proposed times don't work for me.";
        const fallbackContent = `${candidateReason}\n\nHere are some times that would work better for me:\n\n${slotsText}\n\nPlease let me know if any of these work for you.`;
        
        await Message.create({
          conversationId: conversation.id,
          senderId: candidateId,
          content: fallbackContent,
          metadata: {
            type: 'interview_reschedule_request',
            isAiGenerated: false,
            requiresRecruiterAction: true,
            interviewId: interview?.id,
            proposedSlots: proposedSlots,
            originalMessage: candidateReason
          }
        });
        
        await conversation.update({ 
          lastMessageAt: new Date(),
          lastMessagePreview: fallbackContent.substring(0, 100) + '...'
        });
        
        console.log('🤖 [AI Agent] Fallback reschedule response sent');
      } catch (fallbackError) {
        console.error('Fallback message error:', fallbackError);
        await conversation.update({ lastMessageAt: new Date() });
      }
    }

  } catch (error) {
    console.error('Error sending reschedule message:', error);
  }
}

async function sendDeclineMessage(candidateId, recruiterId, job, reason) {
  try {
    let conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { participant1Id: recruiterId, participant2Id: candidateId },
          { participant1Id: candidateId, participant2Id: recruiterId }
        ]
      }
    });

    if (!conversation) return;

    const messageContent = reason || "Thank you for considering me, but I've decided not to proceed at this time. Best of luck with your search!";

    await Message.create({
      conversationId: conversation.id,
      senderId: candidateId,
      content: messageContent,
      metadata: {
        type: 'interview_declined'
      }
    });

    await conversation.update({ lastMessageAt: new Date() });
  } catch (error) {
    console.error('Error sending decline message:', error);
  }
}

// @route   GET /api/interviews/:id/prep
// @desc    Get interview preparation guide with skill gaps from tailored profile
// @access  Private
router.get('/:id/prep', authMiddleware, async (req, res) => {
  try {
    const { TailoredProfile } = require('../models');
    
    const interview = await Interview.findOne({
      where: { id: req.params.id, candidateId: req.user.id },
      include: [
        { model: Job, as: 'job', attributes: ['id', 'title', 'company', 'description'] }
      ]
    });

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Find matching tailored profile by job title/company
    let tailoredProfile = null;
    if (interview.job) {
      tailoredProfile = await TailoredProfile.findOne({
        where: {
          userId: req.user.id,
          isActive: true,
          ...(interview.job.title && { jobTitle: interview.job.title })
        },
        order: [['createdAt', 'DESC']]
      });

      // Fallback: search by company name
      if (!tailoredProfile && interview.job.company) {
        tailoredProfile = await TailoredProfile.findOne({
          where: {
            userId: req.user.id,
            isActive: true,
            companyName: interview.job.company
          },
          order: [['createdAt', 'DESC']]
        });
      }
    }

    const skillGaps = tailoredProfile?.skillGaps || [];
    const criticalGaps = skillGaps.filter(g => g.severity === 'critical' && g.status !== 'learned');
    const importantGaps = skillGaps.filter(g => g.severity === 'important' && g.status !== 'learned');

    res.json({
      success: true,
      interview: {
        id: interview.id,
        scheduledAt: interview.scheduledAt,
        type: interview.type,
        job: interview.job
      },
      preparation: {
        tailoredProfileId: tailoredProfile?.id || null,
        totalGaps: skillGaps.length,
        criticalGaps,
        importantGaps,
        learnedCount: skillGaps.filter(g => g.status === 'learned').length,
        tips: [
          ...(criticalGaps.length > 0 ? [`Focus on these ${criticalGaps.length} critical skill gaps before your interview`] : []),
          ...(importantGaps.length > 0 ? [`Review these ${importantGaps.length} important skills the role requires`] : []),
          'Prepare examples from your experience that demonstrate these skills',
          'Be honest about areas you\'re still learning — show enthusiasm to grow'
        ]
      }
    });
  } catch (error) {
    console.error('Error fetching interview prep:', error);
    res.status(500).json({ error: 'Failed to fetch interview preparation' });
  }
});

module.exports = router;
