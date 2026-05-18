/**
 * Resume Module
 * 
 * Centralized exports for resume parsing, extraction, and AI functionality.
 * 
 * Sub-modules:
 * - extractors: PDF/DOCX text extraction
 * - patterns: Regex patterns and utility functions for parsing
 * - prompts: AI prompts for all resume-related operations
 */

const extractors = require('./extractors');
const patterns = require('./patterns');
const prompts = require('./prompts');

module.exports = {
  extractors,
  patterns,
  prompts,
  
  // Convenience re-exports for common functions
  extractTextFromResume: extractors.extractTextFromResume,
  extractPdfText: extractors.extractPdfText,
  extractDocxText: extractors.extractDocxText,
  
  parseDateToISO: patterns.parseDateToISO,
  extractContactInfo: patterns.extractContactInfo,
  extractName: patterns.extractName,
  extractSkills: patterns.extractSkills,
  PATTERNS: patterns.PATTERNS,
  SKILL_PATTERNS: patterns.SKILL_PATTERNS,
  
  parseResumePrompt: prompts.parseResumePrompt,
  enhanceProfilePrompt: prompts.enhanceProfilePrompt,
  gapAnalysisPrompt: prompts.gapAnalysisPrompt,
  tailorWithResumePrompt: prompts.tailorWithResumePrompt,
  interviewPrepPrompt: prompts.interviewPrepPrompt
};
