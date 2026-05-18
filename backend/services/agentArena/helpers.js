/**
 * Agent Arena Helper Utilities
 * 
 * Status helpers, outcome messages, and utility functions for the Agent Arena service.
 */

/**
 * Negotiation status constants
 */
const NEGOTIATION_STATUS = {
  NEGOTIATING: 'negotiating',
  PENDING_DECISION: 'pending_decision',
  MUTUAL_INTEREST: 'mutual_interest',
  HIRED: 'hired',
  DECLINED_BY_CANDIDATE: 'declined_by_candidate',
  DECLINED_BY_RECRUITER: 'declined_by_recruiter',
  STALLED: 'stalled',
  WITHDRAWN: 'withdrawn',
  SCREENING_COMPLETE: 'screening_complete',
  FOLLOW_UP: 'follow_up',
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  COMPLETED: 'completed'
};

/**
 * Agent roles
 */
const AGENT_ROLES = {
  CANDIDATE: 'candidate_agent',
  RECRUITER: 'recruiter_agent'
};

/**
 * Negotiation types
 */
const NEGOTIATION_TYPES = {
  NEGOTIATION: 'negotiation',
  SCREENING: 'screening',
  RESCHEDULE: 'reschedule'
};

/**
 * Get human-readable outcome message based on negotiation status
 * @param {string} status - Negotiation status
 * @returns {string} Human-readable outcome message
 */
function getOutcomeMessage(status) {
  const messages = {
    [NEGOTIATION_STATUS.MUTUAL_INTEREST]: 'Both parties expressed mutual interest.',
    [NEGOTIATION_STATUS.HIRED]: 'Candidate has been hired!',
    [NEGOTIATION_STATUS.DECLINED_BY_CANDIDATE]: 'Candidate declined the opportunity.',
    [NEGOTIATION_STATUS.DECLINED_BY_RECRUITER]: 'Recruiter decided not to proceed.',
    [NEGOTIATION_STATUS.STALLED]: 'Negotiation stalled without a clear outcome.',
    [NEGOTIATION_STATUS.WITHDRAWN]: 'Negotiation was withdrawn.',
    [NEGOTIATION_STATUS.SCREENING_COMPLETE]: 'Initial screening completed.',
    [NEGOTIATION_STATUS.FOLLOW_UP]: 'Follow-up scheduled.',
    [NEGOTIATION_STATUS.INTERVIEW_SCHEDULED]: 'Interview has been scheduled!',
    [NEGOTIATION_STATUS.COMPLETED]: 'Negotiation completed successfully.'
  };
  return messages[status] || 'The negotiation has concluded.';
}

/**
 * Determine next agent turn based on last turn
 * @param {string} lastTurn - Last agent that took a turn
 * @returns {string} Next agent role
 */
function getNextAgent(lastTurn) {
  return lastTurn === AGENT_ROLES.CANDIDATE ? AGENT_ROLES.RECRUITER : AGENT_ROLES.CANDIDATE;
}

/**
 * Check if a negotiation status indicates completion
 * @param {string} status - Negotiation status
 * @returns {boolean}
 */
function isNegotiationComplete(status) {
  const completedStatuses = [
    NEGOTIATION_STATUS.MUTUAL_INTEREST,
    NEGOTIATION_STATUS.HIRED,
    NEGOTIATION_STATUS.DECLINED_BY_CANDIDATE,
    NEGOTIATION_STATUS.DECLINED_BY_RECRUITER,
    NEGOTIATION_STATUS.STALLED,
    NEGOTIATION_STATUS.WITHDRAWN,
    NEGOTIATION_STATUS.SCREENING_COMPLETE,
    NEGOTIATION_STATUS.INTERVIEW_SCHEDULED,
    NEGOTIATION_STATUS.COMPLETED
  ];
  return completedStatuses.includes(status);
}

/**
 * Check if a negotiation status indicates success
 * @param {string} status - Negotiation status
 * @returns {boolean}
 */
function isPositiveOutcome(status) {
  const positiveStatuses = [
    NEGOTIATION_STATUS.MUTUAL_INTEREST,
    NEGOTIATION_STATUS.HIRED,
    NEGOTIATION_STATUS.INTERVIEW_SCHEDULED,
    NEGOTIATION_STATUS.COMPLETED
  ];
  return positiveStatuses.includes(status);
}

/**
 * Map AI decision to negotiation status
 * @param {string} candidateDecision - Candidate's decision
 * @param {string} recruiterDecision - Recruiter's decision
 * @returns {string} Negotiation status
 */
function mapDecisionsToStatus(candidateDecision, recruiterDecision) {
  // Both positive
  if (candidateDecision === 'yes' && recruiterDecision === 'yes') {
    return NEGOTIATION_STATUS.MUTUAL_INTEREST;
  }
  
  // Both want to continue
  if (candidateDecision === 'continue' && recruiterDecision === 'continue') {
    return NEGOTIATION_STATUS.NEGOTIATING;
  }
  
  // Candidate declined
  if (candidateDecision === 'no' || candidateDecision === 'decline') {
    return NEGOTIATION_STATUS.DECLINED_BY_CANDIDATE;
  }
  
  // Recruiter declined
  if (recruiterDecision === 'no' || recruiterDecision === 'decline') {
    return NEGOTIATION_STATUS.DECLINED_BY_RECRUITER;
  }
  
  // Mixed signals or unclear - continue
  return NEGOTIATION_STATUS.NEGOTIATING;
}

/**
 * Calculate negotiation progress percentage
 * @param {number} currentRound - Current round number
 * @param {number} maxRounds - Maximum allowed rounds
 * @returns {number} Progress percentage (0-100)
 */
function calculateProgress(currentRound, maxRounds) {
  return Math.min(100, Math.round((currentRound / maxRounds) * 100));
}

/**
 * Format agent context for logging/debugging
 * @param {Object} context - Agent context object
 * @returns {string} Formatted context string
 */
function formatAgentContext(context) {
  if (!context) return 'No context';
  
  const parts = [];
  if (context.priorities) parts.push(`Priorities: ${context.priorities.join(', ')}`);
  if (context.constraints) parts.push(`Constraints: ${context.constraints.join(', ')}`);
  if (context.preferences) parts.push(`Preferences: ${JSON.stringify(context.preferences)}`);
  
  return parts.length > 0 ? parts.join(' | ') : 'Empty context';
}

/**
 * Parse sentiment from AI response
 * @param {string} content - Message content
 * @returns {string} Sentiment classification
 */
function parseSentiment(content) {
  const positiveWords = ['excited', 'interested', 'great', 'excellent', 'wonderful', 'impressive'];
  const negativeWords = ['concerned', 'hesitant', 'unfortunately', 'regret', 'decline', 'issues'];
  
  const contentLower = content.toLowerCase();
  const positiveCount = positiveWords.filter(w => contentLower.includes(w)).length;
  const negativeCount = negativeWords.filter(w => contentLower.includes(w)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

module.exports = {
  NEGOTIATION_STATUS,
  AGENT_ROLES,
  NEGOTIATION_TYPES,
  getOutcomeMessage,
  getNextAgent,
  isNegotiationComplete,
  isPositiveOutcome,
  mapDecisionsToStatus,
  calculateProgress,
  formatAgentContext,
  parseSentiment
};
