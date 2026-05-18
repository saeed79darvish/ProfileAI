/**
 * Backend Services Index
 * 
 * Centralized exports for all backend services.
 * Services are organized into categories for easy discovery.
 * 
 * Modularized Services (with sub-modules):
 * - ai/: AI prompts and utilities
 * - resume/: Resume parsing utilities
 * - recruitment/: Recruitment scoring and helpers
 * - agentArena/: Agent negotiation utilities
 * - candidateImport/: CSV import utilities
 */

// ═══════════════════════════════════════════════════════════════
// CORE SERVICES
// ═══════════════════════════════════════════════════════════════

const aiService = require('./aiService');
const resumeParserService = require('./resumeParserService');
const recruitmentService = require('./recruitmentService');
const agentArenaService = require('./agentArenaService');
const candidateImportService = require('./candidateImportService');

// ═══════════════════════════════════════════════════════════════
// COMMUNICATION SERVICES
// ═══════════════════════════════════════════════════════════════

const emailService = require('./emailService');
const notificationService = require('./notificationService');

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED SERVICES
// ═══════════════════════════════════════════════════════════════

const paymentService = require('./paymentService');
const embeddingService = require('./embeddingService');
const vapiService = require('./vapiService');
const callSchedulerService = require('./callSchedulerService');
const reputationService = require('./reputationService');
const linkedinEnrichmentService = require('./linkedinEnrichmentService');
const invitationService = require('./invitationService');
const candidateDataAggregator = require('./candidateDataAggregator');
const aiSkillsMatchingService = require('./aiSkillsMatchingService');
const sessionMatchingService = require('./sessionMatchingService');
const resumeGeneratorService = require('./resumeGeneratorService');

// ═══════════════════════════════════════════════════════════════
// MODULAR SUB-MODULES
// ═══════════════════════════════════════════════════════════════

const aiModules = require('./ai');
const resumeModules = require('./resume');
const recruitmentModules = require('./recruitment');
const agentArenaModules = require('./agentArena');
const candidateImportModules = require('./candidateImport');

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Core services
  aiService,
  resumeParserService,
  recruitmentService,
  agentArenaService,
  candidateImportService,
  
  // Communication
  emailService,
  notificationService,
  
  // Specialized
  paymentService,
  embeddingService,
  vapiService,
  callSchedulerService,
  reputationService,
  linkedinEnrichmentService,
  invitationService,
  candidateDataAggregator,
  aiSkillsMatchingService,
  sessionMatchingService,
  resumeGeneratorService,
  
  // Modular sub-modules (for direct access to utilities)
  modules: {
    ai: aiModules,
    resume: resumeModules,
    recruitment: recruitmentModules,
    agentArena: agentArenaModules,
    candidateImport: candidateImportModules
  }
};
