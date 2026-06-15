/**
 * AI Core - Centralized AI calling infrastructure
 * Uses Claude Sonnet for all AI features with retry logic
 */
const Anthropic = require('@anthropic-ai/sdk');
const { withRetry, safeParseJSON, validateAIScores } = require('../../utils/aiUtils');

const anthropic = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 60000, // 60s request timeout
});

// Default Claude model. Override via ANTHROPIC_MODEL env var.
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

/**
 * Centralized AI call function
 * Includes retry with exponential backoff for transient failures
 * @param {Object} options - Call options
 * @param {Array} options.messages - Array of message objects with role and content
 * @param {number} options.max_tokens - Maximum tokens in response
 * @param {number} options.temperature - Temperature for response randomness
 * @returns {Object} - OpenAI-compatible response shape
 */
async function callAI({ messages, max_tokens = 1000, temperature = 0.7, model }) {
  return withRetry(async () => {
    // Extract system message if present, otherwise use default
    const systemMsgs = messages.filter(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');
    const systemText = systemMsgs.map(m => m.content).join('\n') ||
      'You are a helpful AI assistant. Always return well-structured, accurate responses.';

    const response = await anthropic.messages.create({
      model: model || DEFAULT_MODEL,
      max_tokens,
      temperature,
      system: systemText,
      messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
    });
    
    // Return in OpenAI-compatible shape so existing code works unchanged
    return {
      choices: [{
        message: {
          content: response.content[0].text
        }
      }],
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }, {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  });
}

module.exports = {
  callAI,
  safeParseJSON,
  validateAIScores
};
