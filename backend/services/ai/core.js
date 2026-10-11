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
 * Pull the model's answer out of a response's content blocks.
 *
 * Not `content[0].text`. The Claude 5 family runs adaptive thinking by
 * default, and it decides per request: a short prompt comes back as
 * `[text]`, but a long, genuinely hard one comes back as
 * `[thinking, text]`. A thinking block has no `.text`, so `content[0].text`
 * is `undefined` and the `.trim()` after it throws a TypeError — which is
 * not retryable, so it surfaced to the client as a bare 400.
 *
 * That is why tailor-for-job failed while analyze-gaps kept working: gaps
 * run on Haiku 4.5 (no adaptive thinking), tailoring runs on the Sonnet 5
 * default with a prompt complex enough to always trigger it.
 *
 * Thinking text is deliberately ignored — with `display` left at its default
 * the blocks are empty anyway, and the reasoning is never the answer.
 */
function extractText(response) {
  const blocks = (response && response.content) || [];
  const text = blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
  if (!text.trim()) {
    const kinds = blocks.map((b) => (b && b.type) || 'unknown').join(', ') || 'none';
    throw new Error(
      `Claude returned no text content (blocks: ${kinds}, stop_reason: ${response && response.stop_reason})`
    );
  }
  return text;
}

/**
 * Turning thinking OFF.
 *
 * The Claude 5 family runs adaptive thinking by default, and thinking tokens
 * are spent out of `max_tokens`. Every call in this codebase had its budget
 * tuned against a model that did not think — tailoring asks for 6000 and a
 * resume fills most of it — so adaptive thinking quietly ate the output
 * allowance and tailor-for-job started coming back with
 * `stop_reason: max_tokens` and no text block at all.
 *
 * None of these calls want reasoning. They ask for one JSON document, and the
 * judgement in this service lives in the deterministic audit and enforcement
 * passes, not in the model's scratchpad.
 *
 * There is no version rule for the off switch. Checked against the live API:
 *
 *   claude-sonnet-5-5                     {type:'between_tools'}  ('disabled' 400s)
 *   claude-sonnet-5, opus-5, haiku-4-5    {type:'disabled'}       ('between_tools' 400s)
 *   claude-opus-5-5                       neither — cannot be turned off
 *
 * So the obvious `supportsTemperature`-style major-version test would be wrong
 * today, not just eventually, and a hardcoded id table would rot on the next
 * release. Instead we try the forms in order and keep whichever one the API
 * accepted. The 400 names the right form, so an unknown model costs a couple
 * of rejected calls once per process and nothing after that.
 */
const THINKING_OFF_FORMS = [{ type: 'between_tools' }, { type: 'disabled' }];

/* model -> index into THINKING_OFF_FORMS. An index at the end of the list
   means every form was refused and the model always thinks. */
const thinkingOffByModel = new Map();

const isThinkingComplaint = (err) =>
  err?.status === 400 && /thinking/i.test(String(err?.message || ''));

/* When thinking cannot be turned off it still has to be paid for out of
   max_tokens, so give it a budget of its own rather than let it crowd out the
   answer — which is the whole failure this code exists to prevent. */
const THINKING_HEADROOM = 16000;
const MAX_OUTPUT_TOKENS = 32000;

function withThinkingOff(request) {
  const index = thinkingOffByModel.get(request.model) ?? 0;
  const form = THINKING_OFF_FORMS[index];
  if (form) return { ...request, thinking: form };
  return {
    ...request,
    max_tokens: Math.min(MAX_OUTPUT_TOKENS, (request.max_tokens || 2000) + THINKING_HEADROOM),
  };
}

/** Records that `model` refused its current form. Returns false once we have
 *  run out of things to try, which makes the error a real one. */
function noteThinkingRefused(model) {
  const index = thinkingOffByModel.get(model) ?? 0;
  if (index >= THINKING_OFF_FORMS.length) return false;
  thinkingOffByModel.set(model, index + 1);
  return true;
}

/**
 * `messages.create` with thinking turned off, learning how to ask per model.
 * Both callAI implementations go through this — the one here and the separate
 * one in resumeParserService.
 */
async function createMessage(client, request) {
  for (;;) {
    try {
      return await client.messages.create(withThinkingOff(request));
    } catch (err) {
      if (!isThinkingComplaint(err) || !noteThinkingRefused(request.model)) throw err;
      console.warn(
        `[ProfilleAI] ${request.model} refused that thinking setting; trying the next one`
      );
    }
  }
}

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
      response = await createMessage(anthropic, request);
    } catch (err) {
      // Backstop for a family we have not met yet that also drops it.
      if (!isTemperatureComplaint(err)) throw err;
      delete request.temperature;
      response = await createMessage(anthropic, request);
    }
    
    // Strip AI-tell characters (em/en dashes, non-breaking spaces) so all
    // downstream consumers get clean text without touching each caller.
    const rawText = extractText(response);
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
  supportsTemperature,
  extractText,
  createMessage,
  withThinkingOff,
  noteThinkingRefused
};
