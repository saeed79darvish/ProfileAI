/**
 * AI Core - Centralized AI calling infrastructure
 * Uses Claude Sonnet for all AI features with retry logic
 */
const Anthropic = require('@anthropic-ai/sdk');
const { withRetry, safeParseJSON, validateAIScores } = require('../../utils/aiUtils');
const { stripAiTellChars } = require('../../utils/aiTextCleanup');

const anthropic = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 60000, // 60s request timeout
});

// Default Claude model. Override via ANTHROPIC_MODEL env var.
// Sonnet 4.5 retires 2026-11-30 and starts shedding availability 2026-10-30.
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

// Fast/cheap model for low-stakes features (post enhancement, career tips, etc.)
// ~80% cheaper than Sonnet — used for features where quality is good enough.
// claude-3-5-haiku-20241022 was retired 2026-02-19 and now 404s. Keep this an
// alias rather than a dated snapshot so the next retirement is a no-op here.
const HAIKU_MODEL = process.env.ANTHROPIC_HAIKU_MODEL || 'claude-haiku-4-5';

/**
 * Whether a model will accept a `temperature`.
 *
 * The Claude 5 family dropped it: passing one is a hard 400, not a warning.
 * We had temperature on literally every call in the codebase, so moving the
 * default to Sonnet 5.5 without this would have turned every AI feature off
 * at once — the kind of migration that looks like a one-line model rename
 * right up until production.
 *
 * Keyed on the major version rather than a list of model ids, so a model
 * released next month is handled without a deploy. Verified against the API
 * across both families: every 4.x accepts it, every 5.x rejects it, and all
 * of them work without it.
 */
function supportsTemperature(model = '') {
  const major = /claude-(?:opus|sonnet|haiku|fable)-(\d+)/.exec(model);
  return major ? Number(major[1]) < 5 : true;
}

/** Complaint shape when a model has dropped temperature support. */
const isTemperatureComplaint = (err) =>
  err?.status === 400 && /temperature/i.test(String(err?.message || ''));

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

    const chosen = model || DEFAULT_MODEL;
    const request = {
      model: chosen,
      max_tokens,
      system: systemText,
      messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
    };
    if (supportsTemperature(chosen)) request.temperature = temperature;

    let response;
    try {
      response = await anthropic.messages.create(request);
    } catch (err) {
      // Backstop for a family we have not met yet that also drops it.
      if (!isTemperatureComplaint(err)) throw err;
      delete request.temperature;
      response = await anthropic.messages.create(request);
    }
    
    // Strip AI-tell characters (em/en dashes, non-breaking spaces) so all
    // downstream consumers get clean text without touching each caller.
    const rawText = response.content[0].text;
    const cleaned = stripAiTellChars(rawText);

    // Return in OpenAI-compatible shape so existing code works unchanged
    return {
      choices: [{
        message: {
          content: cleaned
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
  validateAIScores,
  DEFAULT_MODEL,
  HAIKU_MODEL,
  supportsTemperature
};
