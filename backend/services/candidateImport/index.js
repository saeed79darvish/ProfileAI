/**
 * Candidate Import Module
 * 
 * Centralized exports for candidate import utilities.
 * 
 * Sub-modules:
 * - validators: Email, URL, and data validation
 * - parsers: CSV parsing and data normalization
 * - helpers: Duplicate detection, scoring, and utility functions
 */

const validators = require('./validators');
const parsers = require('./parsers');
const helpers = require('./helpers');

module.exports = {
  validators,
  parsers,
  helpers,
  
  // Convenience re-exports from validators
  isValidEmail: validators.isValidEmail,
  isValidLinkedInUrl: validators.isValidLinkedInUrl,
  validateCandidateRow: validators.validateCandidateRow,
  normalizeEmail: validators.normalizeEmail,
  REQUIRED_COLUMNS: validators.REQUIRED_COLUMNS,
  OPTIONAL_COLUMNS: validators.OPTIONAL_COLUMNS,
  
  // Convenience re-exports from parsers
  parseCSV: parsers.parseCSV,
  parseName: parsers.parseName,
  normalizeColumnName: parsers.normalizeColumnName,
  parseLinkedInUrls: parsers.parseLinkedInUrls,
  parseEmails: parsers.parseEmails,
  
  // Convenience re-exports from helpers
  findInternalDuplicates: helpers.findInternalDuplicates,
  calculateBasicScore: helpers.calculateBasicScore,
  formatImportStats: helpers.formatImportStats
};
