/**
 * Agent Arena Module
 * 
 * Centralized exports for Agent Arena service utilities.
 * 
 * Sub-modules:
 * - scheduling: Interview slot generation and scheduling utilities
 * - helpers: Status helpers, outcome messages, and utility functions
 */

const scheduling = require('./scheduling');
const helpers = require('./helpers');

module.exports = {
  scheduling,
  helpers,
  
  // Convenience re-exports from scheduling
  generateInterviewSlots: scheduling.generateInterviewSlots,
  generateRescheduleSlots: scheduling.generateRescheduleSlots,
  formatSlot: scheduling.formatSlot,
  DEFAULT_WORKING_HOURS: scheduling.DEFAULT_WORKING_HOURS,
  
  // Convenience re-exports from helpers
  NEGOTIATION_STATUS: helpers.NEGOTIATION_STATUS,
  AGENT_ROLES: helpers.AGENT_ROLES,
  NEGOTIATION_TYPES: helpers.NEGOTIATION_TYPES,
  getOutcomeMessage: helpers.getOutcomeMessage,
  getNextAgent: helpers.getNextAgent,
  isNegotiationComplete: helpers.isNegotiationComplete,
  isPositiveOutcome: helpers.isPositiveOutcome,
  mapDecisionsToStatus: helpers.mapDecisionsToStatus
};
