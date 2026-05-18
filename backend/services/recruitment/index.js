/**
 * Recruitment Module
 * 
 * Modular structure for recruitment-related services
 * 
 * Structure:
 * - helpers.js  - Utility functions (experience calc, profile completeness)
 * - scoring.js  - Candidate scoring algorithms
 * 
 * Main service class is still in ../recruitmentService.js for backward compatibility
 * 
 * Usage:
 * 
 * // Legacy (still works):
 * const recruitmentService = require('../services/recruitmentService');
 * await recruitmentService.startRecruitmentDrive(jobId, config);
 * 
 * // New modular approach for utilities:
 * const { helpers, scoring } = require('../services/recruitment');
 * const totalYears = helpers.calculateTotalYearsExperience(experience);
 * const expScore = scoring.scoreExperienceMatch(totalYears, 'senior');
 */

const helpers = require('./helpers');
const scoring = require('./scoring');

module.exports = {
  helpers,
  scoring,
  
  // Re-export commonly used functions at top level for convenience
  calculateTotalYearsExperience: helpers.calculateTotalYearsExperience,
  calculateProfileCompleteness: helpers.calculateProfileCompleteness,
  scoreExperienceMatch: scoring.scoreExperienceMatch,
  calculateSimpleScore: scoring.calculateSimpleScore
};
