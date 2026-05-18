const cron = require('node-cron');
const { Op } = require('sequelize');
const { PhoneScreeningCall, Interview, Job, User, Profile, Notification } = require('../models');
const vapiService = require('./vapiService');

/**
 * Ensure date is in UTC for consistent storage and comparison.
 * PostgreSQL stores TIMESTAMP WITH TIME ZONE in UTC, and Sequelize
 * returns JavaScript Date objects which are always in UTC internally.
 * This helper ensures any input is properly converted.
 */
function ensureUTC(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  // JavaScript Date objects store time in UTC internally
  // toISOString() returns UTC, getTime() returns UTC milliseconds
  return d;
}

/**
 * Get current time in UTC for consistent scheduling comparisons
 */
function getNowUTC() {
  return new Date();
}

// Store for active cron jobs
const scheduledJobs = new Map();

// Track calls currently being initiated to prevent duplicate attempts
const initiatingCalls = new Set();

/**
 * Calculate exponential backoff delay for retries
 * @param {number} attempt - Current attempt number (1-based)
 * @param {number} baseMinutes - Base delay in minutes (default 10)
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attempt, baseMinutes = 10) {
  // Exponential backoff: 10 min -> 20 min -> 40 min -> 80 min (capped at 2 hours)
  const multiplier = Math.pow(2, attempt - 1);
  const delayMinutes = Math.min(baseMinutes * multiplier, 120); // Cap at 2 hours
  return delayMinutes * 60 * 1000;
}

/**
 * Initialize the call scheduler
 * Runs every minute to check for calls that need to be initiated
 */
function initializeScheduler() {
  console.log('📞 Initializing phone screening call scheduler...');
  
  // Check for scheduled calls every minute
  // recoverMissedExecutions: false prevents flood of warnings if event loop was blocked
  cron.schedule('* * * * *', async () => {
    await processScheduledCalls();
  }, { recoverMissedExecutions: false });
  
  // Cleanup old failed calls daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    await cleanupOldCalls();
  }, { recoverMissedExecutions: false });
  
  // Process retry queue every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await processRetryQueue();
  }, { recoverMissedExecutions: false });
  
  // On startup, immediately check for any missed calls
  setTimeout(async () => {
    console.log('🔍 Startup check: looking for missed calls...');
    await processScheduledCalls();
  }, 5000); // Wait 5 seconds for DB connection
  
  console.log('✅ Phone screening call scheduler initialized');
}

/**
 * Process calls that are scheduled for the current time
 */
async function processScheduledCalls() {
  const now = new Date();
  
  console.log(`🔄 Scheduler check at ${now.toISOString()}`);
  
  try {
    // Find calls that are ready to be initiated
    // Only pick up 'scheduled' status - 'in-progress' means call already initiated
    const scheduledCalls = await PhoneScreeningCall.findAll({
      where: {
        status: 'scheduled',
        scheduledAt: {
          [Op.lte]: now
        }
      },
      include: [
        { 
          model: Interview,
          as: 'Interview',
          include: [{ model: Job, as: 'job' }]
        },
        { 
          model: User, 
          as: 'candidate',
          include: [{ model: Profile, as: 'profile' }]
        }
      ]
    });
    
    if (scheduledCalls.length > 0) {
      console.log(`📞 Found ${scheduledCalls.length} calls ready to initiate`);
    }
    
    for (const call of scheduledCalls) {
      try {
        // Concurrency guard: Skip if already being initiated
        if (initiatingCalls.has(call.id)) {
          console.log(`⏳ Call ${call.id} already being initiated, skipping`);
          continue;
        }
        
        // Verify the interview is still confirmed
        if (call.Interview?.status !== 'confirmed') {
          console.log(`Skipping call ${call.id} - interview no longer confirmed`);
          await call.update({ status: 'cancelled', errorMessage: 'Interview was cancelled or rescheduled' });
          continue;
        }
        
        // Verify the call scheduledAt matches interview scheduledAt (stale check)
        // If they don't match, the interview was rescheduled and this call record is stale
        if (call.Interview?.scheduledAt) {
          const interviewTime = new Date(call.Interview.scheduledAt).getTime();
          const callTime = new Date(call.scheduledAt).getTime();
          // Allow 60 second tolerance for timing differences
          if (Math.abs(interviewTime - callTime) > 60000) {
            console.log(`⏰ Stale call ${call.id} - interview rescheduled to ${call.Interview.scheduledAt}, updating call time`);
            // Update the call to match the interview time instead of cancelling
            await call.update({ 
              scheduledAt: call.Interview.scheduledAt,
              status: 'scheduled'
            });
            continue; // Skip this iteration, will be picked up on next scheduler run
          }
        }
        
        // Mark as initiating to prevent duplicate calls
        initiatingCalls.add(call.id);
        await call.update({ status: 'initiating' });
        
        try {
          // Initiate the call
          await vapiService.initiateCall(call.id);
          console.log(`✅ Initiated screening call ${call.id}`);
        } finally {
          // Always remove from initiating set
          initiatingCalls.delete(call.id);
        }
      } catch (error) {
        // Remove from initiating set on error
        initiatingCalls.delete(call.id);
        console.error(`❌ Failed to initiate call ${call.id}:`, error.message);
        
        // Update status based on retry logic with exponential backoff
        const currentAttempts = (call.callAttempts || 0) + 1;
        const baseRetryMinutes = call.retryAfterMinutes || 10;
        
        if (currentAttempts < (call.maxAttempts || 3)) {
          const retryDelay = calculateRetryDelay(currentAttempts, baseRetryMinutes);
          await call.update({
            status: 'scheduled',
            callAttempts: currentAttempts,
            nextRetryAt: new Date(Date.now() + retryDelay),
            lastError: error.message
          });
          console.log(`🔄 Retry ${currentAttempts} scheduled in ${retryDelay / 60000} minutes`);
        } else {
          await call.update({
            status: 'failed',
            failureReason: `Candidate did not answer. Rescheduling required.`
          });
          
          // Notify recruiter of failed call
          try {
            await Notification.create({
              userId: call.recruiterId,
              type: 'phone_screening_failed',
              title: 'Phone Screening - No Answer',
              message: `${call.candidateName || 'Candidate'} did not answer the phone screening call for ${call.jobTitle || 'position'}. They will need to reschedule.`,
              metadata: {
                phoneScreeningId: call.id,
                interviewId: call.interviewId,
                candidateId: call.candidateId,
                error: error.message
              },
              isRead: false
            });
          } catch (notifError) {
            console.error('Failed to create notification:', notifError.message);
          }
          
          // Also notify candidate that they need to reschedule
          try {
            await Notification.create({
              userId: call.candidateId,
              type: 'phone_screening_missed',
              title: 'Missed Phone Screening Call',
              message: `You missed the scheduled phone screening call for ${call.jobTitle || 'your interview'}. Please reschedule at your earliest convenience.`,
              metadata: {
                phoneScreeningId: call.id,
                interviewId: call.interviewId,
                jobId: call.jobId
              },
              isRead: false
            });
          } catch (notifError) {
            console.error('Failed to create candidate notification:', notifError.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing scheduled calls:', error);
  }
}

/**
 * Process calls that need to be retried
 */
async function processRetryQueue() {
  const now = new Date();
  
  try {
    const retriableCalls = await PhoneScreeningCall.findAll({
      where: {
        status: 'scheduled',
        callAttempts: {
          [Op.gt]: 0
        },
        nextRetryAt: {
          [Op.lte]: now
        },
        [Op.or]: [
          { maxAttempts: { [Op.gt]: { [Op.col]: 'callAttempts' } } },
          { maxAttempts: null }
        ]
      }
    });
    
    if (retriableCalls.length > 0) {
      console.log(`🔄 Processing ${retriableCalls.length} retry calls`);
    }
    
    for (const call of retriableCalls) {
      try {
        await vapiService.initiateCall(call.id);
        console.log(`✅ Retry successful for call ${call.id}`);
      } catch (error) {
        console.error(`❌ Retry failed for call ${call.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error processing retry queue:', error);
  }
}

/**
 * Clean up old failed/cancelled calls
 */
async function cleanupOldCalls() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  try {
    // Delete old Vapi assistants for completed calls
    const oldCalls = await PhoneScreeningCall.findAll({
      where: {
        status: {
          [Op.in]: ['completed', 'failed', 'cancelled']
        },
        createdAt: {
          [Op.lt]: thirtyDaysAgo
        },
        vapiAssistantId: {
          [Op.ne]: null
        }
      }
    });
    
    for (const call of oldCalls) {
      try {
        await vapiService.deleteAssistant(call.vapiAssistantId);
        await call.update({ vapiAssistantId: null });
      } catch (error) {
        // Non-critical, continue
      }
    }
    
    console.log(`🧹 Cleaned up ${oldCalls.length} old call records`);
  } catch (error) {
    console.error('Error cleaning up old calls:', error);
  }
}

/**
 * Schedule a new phone screening call
 */
async function scheduleCall(interviewId, options = {}) {
  const {
    targetDurationMinutes = 15,
    maxAttempts = 3
  } = options;
  
  const interview = await Interview.findByPk(interviewId, {
    include: [
      { model: Job, as: 'job' },
      { model: User, as: 'candidate', include: [{ model: Profile, as: 'profile' }] },
      { model: User, as: 'recruiter' }
    ]
  });
  
  if (!interview) {
    throw new Error('Interview not found');
  }
  
  if (interview.status !== 'confirmed') {
    throw new Error('Interview must be confirmed before scheduling a screening call');
  }
  
  const candidateProfile = interview.candidate?.profile;
  if (!candidateProfile?.phone) {
    throw new Error('Candidate phone number is required for phone screening');
  }
  
  // Check for existing scheduled call
  const existingCall = await PhoneScreeningCall.findOne({
    where: {
      interviewId: interview.id,
      status: {
        [Op.notIn]: ['completed', 'failed', 'cancelled']
      }
    }
  });
  
  if (existingCall) {
    throw new Error('A phone screening call is already scheduled for this interview');
  }
  
  // Create the phone screening call record
  const phoneScreeningCall = await PhoneScreeningCall.create({
    interviewId: interview.id,
    jobId: interview.jobId,
    candidateId: interview.candidateId,
    recruiterId: interview.recruiterId,
    candidatePhone: candidateProfile.phone,
    candidateName: `${interview.candidate.firstName} ${interview.candidate.lastName}`,
    jobTitle: interview.job?.title,
    companyName: interview.job?.company,
    scheduledAt: interview.scheduledAt,
    targetDurationMinutes: targetDurationMinutes,
    maxAttempts: maxAttempts,
    status: 'scheduled'
  });
  
  console.log(`📅 Scheduled phone screening call ${phoneScreeningCall.id} for ${interview.scheduledAt}`);
  
  return phoneScreeningCall;
}

/**
 * Cancel a scheduled phone screening call
 */
async function cancelCall(phoneScreeningCallId) {
  const call = await PhoneScreeningCall.findByPk(phoneScreeningCallId);
  
  if (!call) {
    throw new Error('Phone screening call not found');
  }
  
  if (['completed', 'in_progress'].includes(call.status)) {
    throw new Error('Cannot cancel a call that is in progress or completed');
  }
  
  // If call is active in Vapi, end it
  if (call.vapiCallId && call.status === 'ringing') {
    try {
      await vapiService.endCall(call.vapiCallId);
    } catch (error) {
      console.error('Error ending Vapi call:', error);
    }
  }
  
  await call.update({ status: 'cancelled' });
  
  console.log(`❌ Cancelled phone screening call ${phoneScreeningCallId}`);
  
  return call;
}

/**
 * Reschedule a phone screening call
 */
async function rescheduleCall(phoneScreeningCallId, newScheduledAt) {
  const call = await PhoneScreeningCall.findByPk(phoneScreeningCallId);
  
  if (!call) {
    throw new Error('Phone screening call not found');
  }
  
  if (['in_progress', 'completed'].includes(call.status)) {
    throw new Error('Cannot reschedule a call that is in progress or completed');
  }
  
  await call.update({
    scheduledAt: newScheduledAt,
    status: 'scheduled',
    callAttempts: 0,
    nextRetryAt: null,
    lastError: null
  });
  
  console.log(`📅 Rescheduled phone screening call ${phoneScreeningCallId} to ${newScheduledAt}`);
  
  return call;
}

/**
 * Get upcoming scheduled calls for a recruiter
 */
async function getUpcomingCalls(recruiterId, limit = 10) {
  return PhoneScreeningCall.findAll({
    where: {
      recruiterId,
      status: 'scheduled',
      scheduledAt: {
        [Op.gte]: new Date()
      }
    },
    include: [
      { model: Interview, as: 'Interview' },
      { model: Job, as: 'Job', attributes: ['id', 'title', 'company'] },
      { 
        model: User, 
        as: 'candidate',
        attributes: ['id', 'email'],
        include: [{ model: Profile, as: 'profile', attributes: ['firstName', 'lastName', 'phone'] }]
      }
    ],
    order: [['scheduledAt', 'ASC']],
    limit
  });
}

/**
 * Get call statistics for a recruiter
 */
async function getCallStats(recruiterId) {
  const [total, completed, failed, avgScore] = await Promise.all([
    PhoneScreeningCall.count({ where: { recruiterId } }),
    PhoneScreeningCall.count({ where: { recruiterId, status: 'completed' } }),
    PhoneScreeningCall.count({ where: { recruiterId, status: 'failed' } }),
    PhoneScreeningCall.findOne({
      where: { recruiterId, status: 'completed', screeningScore: { [Op.ne]: null } },
      attributes: [[sequelize.fn('AVG', sequelize.col('screeningScore')), 'avgScore']],
      raw: true
    })
  ]);
  
  return {
    total,
    completed,
    failed,
    pending: total - completed - failed,
    averageScore: avgScore?.avgScore ? Math.round(avgScore.avgScore) : null,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

// Import sequelize for aggregation functions
const { sequelize } = require('../models');

module.exports = {
  initializeScheduler,
  processScheduledCalls,
  processRetryQueue,
  scheduleCall,
  cancelCall,
  rescheduleCall,
  getUpcomingCalls,
  getCallStats
};
