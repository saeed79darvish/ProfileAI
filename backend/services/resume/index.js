/**
 * Resume Module
 * 
 * Centralized exports for resume parsing, extraction, and AI functionality.
 * 
 * Sub-modules:
 * - extractors: PDF/DOCX text extraction
 * - patterns: Regex patterns and utility functions for parsing
 *
 * Prompts used to live here too (prompts.js). It held a second, older pair of
 * tailoring prompts plus enhancement and gap-analysis variants, none of which
 * were reachable — every export was referenced only by itself and this file.
 * It read as live code and was a trap for anyone auditing "the tailoring
 * prompt", so it was removed. The live prompts are tailoringPrompts.js,
 * enhancementPrompts.js, and the rules they share in writingRules.js.
 */

const extractors = require('./extractors');
const patterns = require('./patterns');

module.exports = {
  extractors,
  patterns,
  
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
};
