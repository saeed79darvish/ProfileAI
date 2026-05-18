/**
 * AI Service Module
 * 
 * This module provides a modular structure for AI services:
 * - core.js: Central AI calling infrastructure
 * - prompts/: Domain-specific prompt templates
 * 
 * For backward compatibility, the main AIService class is still exported
 * from the legacy aiService.js file. New code can import prompts directly.
 * 
 * Usage:
 * 
 * // Legacy (still works):
 * const aiService = require('../services/aiService');
 * const result = await aiService.enhancePost(content, postType, userRole);
 * 
 * // New modular approach:
 * const { callAI } = require('../services/ai/core');
 * const { post: postPrompts } = require('../services/ai/prompts');
 * const prompt = postPrompts.enhancePostPrompt(content, roleContext, maxLength);
 * const response = await callAI({ messages: [{ role: 'user', content: prompt }] });
 */

const { callAI, safeParseJSON, validateAIScores } = require('./core');
const prompts = require('./prompts');

// Re-export for convenience
module.exports = {
  // Core functionality
  callAI,
  safeParseJSON,
  validateAIScores,
  
  // All prompts organized by domain
  prompts,
  
  // Direct access to prompt modules
  profilePrompts: prompts.profile,
  jobPrompts: prompts.job,
  postPrompts: prompts.post,
  agentPrompts: prompts.agent,
  screeningPrompts: prompts.screening
};
