const { Notification, User, Job, Interview, JobApplication, Conversation, AgentNegotiation } = require('../models');

/**
 * Core function to create a notification
 * @param {string} userId - ID of user to notify
 * @param {string} type - Notification type enum
 * @param {string} title - Short title for the notification
 * @param {string} message - Detailed message
 * @param {object} data - Related entity IDs
 */
const createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      data
    });
    
    console.log(`📬 Notification created for user ${userId}: ${type} - ${title}`);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw - notifications shouldn't break the main flow
    return null;
  }
};

/**
 * Notify candidate when an interview is scheduled
 */
const notifyInterviewScheduled = async (candidateId, interview, job, recruiter) => {
  const scheduledDate = new Date(interview.scheduledAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return createNotification(
    candidateId,
    'interview_scheduled',
    `Interview Scheduled: ${job?.title || 'New Position'}`,
    `Your interview has been scheduled for ${scheduledDate}. ${interview.type === 'ai_phone' ? 'You will receive an AI phone call.' : `Meeting type: ${interview.type}`}`,
    {
      interviewId: interview.id,
      jobId: interview.jobId,
      recruiterId: recruiter?.id,
      scheduledAt: interview.scheduledAt
    }
  );
};

/**
 * Notify candidate when interview is updated/rescheduled
 */
const notifyInterviewUpdated = async (candidateId, interview, job, changeType = 'updated') => {
  const scheduledDate = new Date(interview.scheduledAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const titles = {
    rescheduled: 'Interview Rescheduled',
    updated: 'Interview Updated',
    confirmed: 'Interview Confirmed'
  };

  return createNotification(
    candidateId,
    'interview_updated',
    `${titles[changeType] || 'Interview Updated'}: ${job?.title || 'Position'}`,
    `Your interview has been ${changeType}. New time: ${scheduledDate}`,
    {
      interviewId: interview.id,
      jobId: interview.jobId,
      scheduledAt: interview.scheduledAt,
      changeType
    }
  );
};

/**
 * Notify candidate when interview is cancelled
 */
const notifyInterviewCancelled = async (candidateId, interview, job, reason = '') => {
  return createNotification(
    candidateId,
    'interview_cancelled',
    `Interview Cancelled: ${job?.title || 'Position'}`,
    reason || 'Your interview has been cancelled. The recruiter may reach out with more information.',
    {
      interviewId: interview.id,
      jobId: interview.jobId
    }
  );
};

/**
 * Notify recruiter when they receive a new application
 */
const notifyApplicationReceived = async (recruiterId, application, candidate, job) => {
  const candidateName = `${candidate?.firstName || 'A candidate'} ${candidate?.lastName || ''}`.trim();
  
  return createNotification(
    recruiterId,
    'application_received',
    `New Application: ${job?.title || 'Your Job'}`,
    `${candidateName} has applied for the ${job?.title || 'position'} role.`,
    {
      applicationId: application.id,
      jobId: job?.id,
      candidateId: candidate?.id
    }
  );
};

/**
 * Notify candidate when their application status changes
 */
const notifyApplicationStatusChange = async (candidateId, application, job, newStatus) => {
  const statusMessages = {
    reviewing: 'Your application is being reviewed by the recruiter.',
    shortlisted: 'Congratulations! You have been shortlisted for this position.',
    interview_scheduled: 'An interview has been scheduled for your application.',
    rejected: 'We regret to inform you that your application was not selected for this position.',
    hired: 'Congratulations! You have been selected for this position!',
    withdrawn: 'Your application has been withdrawn.'
  };

  const statusTitles = {
    reviewing: 'Application Under Review',
    shortlisted: 'You\'re Shortlisted!',
    interview_scheduled: 'Interview Scheduled',
    rejected: 'Application Update',
    hired: 'You\'re Hired!',
    withdrawn: 'Application Withdrawn'
  };

  return createNotification(
    candidateId,
    'application_status',
    `${statusTitles[newStatus] || 'Application Update'}: ${job?.title || 'Position'}`,
    statusMessages[newStatus] || `Your application status has been updated to: ${newStatus}`,
    {
      applicationId: application.id,
      jobId: job?.id,
      status: newStatus
    }
  );
};

/**
 * Notify recipient when they receive a new message
 */
const notifyNewMessage = async (recipientId, sender, conversation, messagePreview = '') => {
  const senderName = `${sender?.firstName || 'Someone'} ${sender?.lastName || ''}`.trim();
  const preview = messagePreview.length > 100 
    ? messagePreview.substring(0, 100) + '...' 
    : messagePreview;
  
  return createNotification(
    recipientId,
    'message_received',
    `New Message from ${senderName}`,
    preview || 'You have received a new message.',
    {
      conversationId: conversation.id,
      senderId: sender?.id
    }
  );
};

/**
 * Notify user of Agent Arena updates
 */
const notifyAgentArenaUpdate = async (userId, negotiation, updateType, additionalInfo = {}) => {
  const updateMessages = {
    started: 'A new AI negotiation has started for your opportunity.',
    round_complete: `Round ${additionalInfo.round || ''} of the negotiation has been completed.`,
    offer_made: 'An offer has been made in the negotiation.',
    counter_offer: 'A counter-offer has been received.',
    agreed: 'The negotiation has reached an agreement!',
    stalled: 'The negotiation seems to have stalled.',
    completed: 'The AI negotiation has been completed.',
    failed: 'The negotiation could not reach an agreement.'
  };

  const updateTitles = {
    started: 'Negotiation Started',
    round_complete: 'Negotiation Round Complete',
    offer_made: 'New Offer',
    counter_offer: 'Counter Offer Received',
    agreed: 'Agreement Reached!',
    stalled: 'Negotiation Stalled',
    completed: 'Negotiation Complete',
    failed: 'Negotiation Ended'
  };

  const type = ['agreed', 'completed'].includes(updateType) 
    ? 'agent_completed' 
    : 'agent_update';

  return createNotification(
    userId,
    type,
    updateTitles[updateType] || 'Agent Arena Update',
    updateMessages[updateType] || 'Your Agent Arena negotiation has an update.',
    {
      negotiationId: negotiation.id,
      jobId: negotiation.jobId,
      updateType,
      ...additionalInfo
    }
  );
};

/**
 * Notify user when someone follows them
 */
const notifyNewFollower = async (userId, follower) => {
  const followerName = `${follower?.firstName || 'Someone'} ${follower?.lastName || ''}`.trim();
  
  return createNotification(
    userId,
    'follow_new',
    `${followerName} started following you`,
    `${followerName} is now following your profile and posts.`,
    {
      followerId: follower?.id
    }
  );
};

/**
 * Notify post author when their post is liked
 */
const notifyPostLike = async (authorId, liker, post) => {
  // Don't notify if user liked their own post
  if (authorId === liker?.id) return null;
  
  const likerName = `${liker?.firstName || 'Someone'} ${liker?.lastName || ''}`.trim();
  const postPreview = post?.content 
    ? post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '')
    : 'your post';
  
  return createNotification(
    authorId,
    'post_like',
    `${likerName} liked your post`,
    `Your post "${postPreview}" received a new like.`,
    {
      postId: post?.id,
      likerId: liker?.id
    }
  );
};

/**
 * Notify post author when someone comments on their post
 */
const notifyPostComment = async (authorId, commenter, post, commentPreview = '') => {
  // Don't notify if user commented on their own post
  if (authorId === commenter?.id) return null;
  
  const commenterName = `${commenter?.firstName || 'Someone'} ${commenter?.lastName || ''}`.trim();
  const preview = commentPreview.length > 100 
    ? commentPreview.substring(0, 100) + '...' 
    : commentPreview;
  
  return createNotification(
    authorId,
    'post_comment',
    `${commenterName} commented on your post`,
    preview || 'Someone left a comment on your post.',
    {
      postId: post?.id,
      commenterId: commenter?.id
    }
  );
};

/**
 * Send a system notification
 */
const notifySystem = async (userId, title, message, data = {}) => {
  return createNotification(
    userId,
    'system',
    title,
    message,
    data
  );
};

module.exports = {
  createNotification,
  notifyInterviewScheduled,
  notifyInterviewUpdated,
  notifyInterviewCancelled,
  notifyApplicationReceived,
  notifyApplicationStatusChange,
  notifyNewMessage,
  notifyAgentArenaUpdate,
  notifyNewFollower,
  notifyPostLike,
  notifyPostComment,
  notifySystem
};
