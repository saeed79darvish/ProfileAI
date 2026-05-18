/**
 * AI Utility Functions
 * 
 * Shared utilities for AI service layer:
 * - safeParseJSON: Robust JSON extraction from AI responses
 * - validateAIScores: Sanity-check AI-generated numeric scores
 * - LRUCache: Proper least-recently-used cache
 * - withRetry: Retry with exponential backoff for transient failures
 */

/**
 * Safely extract and parse JSON from an AI response string.
 * Handles markdown code blocks, partial JSON, and malformed output.
 * 
 * @param {string} text - Raw AI response text
 * @param {*} fallback - Value to return on parse failure (default: null)
 * @param {'object'|'array'} expect - Expected JSON type ('object' or 'array')
 * @returns {*} - Parsed JSON or fallback
 */
function safeParseJSON(text, fallback = null, expect = 'object') {
  if (!text || typeof text !== 'string') return fallback;

  try {
    // Try direct parse first (fastest path)
    const direct = JSON.parse(text);
    if (expect === 'array' ? Array.isArray(direct) : typeof direct === 'object') {
      return direct;
    }
  } catch (_) {
    // Continue to regex extraction
  }

  try {
    // Strip markdown code blocks
    const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '');

    // Choose regex based on expected type
    const pattern = expect === 'array' 
      ? /\[[\s\S]*\]/
      : /\{[\s\S]*\}/;
    
    const match = stripped.match(pattern);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (_) {
    // Fall through to fallback
  }

  console.warn('[safeParseJSON] Failed to parse AI response, using fallback');
  return fallback;
}

/**
 * Validate and clamp AI-generated numeric scores to expected ranges.
 * Prevents propagation of wildly incorrect scores (e.g. -50, 999).
 * 
 * @param {Object} scores - Object with numeric score fields
 * @param {Object} rules - Map of field name → { min, max, default }
 * @returns {Object} - Validated scores with clamped/defaulted values
 */
function validateAIScores(scores, rules) {
  if (!scores || typeof scores !== 'object') {
    const result = {};
    for (const [key, rule] of Object.entries(rules)) {
      result[key] = rule.default ?? rule.min ?? 0;
    }
    return result;
  }

  const validated = { ...scores };
  
  for (const [key, rule] of Object.entries(rules)) {
    const val = validated[key];
    if (val === undefined || val === null || typeof val !== 'number' || isNaN(val)) {
      validated[key] = rule.default ?? rule.min ?? 0;
    } else {
      validated[key] = Math.max(rule.min ?? 0, Math.min(rule.max ?? 100, val));
    }
  }

  return validated;
}

/**
 * Proper LRU Cache implementation using Map's insertion-order guarantee.
 * On access, entries are moved to the end of the Map (most recent).
 * On eviction, the first entry (least recently used) is removed.
 */
class LRUCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this._map = new Map();
  }

  get(key) {
    if (!this._map.has(key)) return undefined;
    const value = this._map.get(key);
    // Move to end (most recently used)
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this._map.has(key)) {
      this._map.delete(key);
    } else if (this._map.size >= this.maxSize) {
      // Evict least recently used (first entry)
      const firstKey = this._map.keys().next().value;
      this._map.delete(firstKey);
    }
    this._map.set(key, value);
  }

  has(key) {
    return this._map.has(key);
  }

  delete(key) {
    return this._map.delete(key);
  }

  clear() {
    this._map.clear();
  }

  get size() {
    return this._map.size;
  }

  keys() {
    return this._map.keys();
  }
}

/**
 * Retry a function with exponential backoff.
 * Handles transient errors (rate limits, network timeouts, server errors).
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Max number of retries (default: 3)
 * @param {number} options.baseDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Max delay in ms (default: 10000)
 * @param {Function} options.shouldRetry - Predicate: (error, attempt) => boolean
 * @returns {Promise<*>} - Result of the function
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = defaultShouldRetry
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = delay * 0.2 * Math.random(); // 20% jitter
      console.warn(`[withRetry] Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${Math.round(delay + jitter)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}

/**
 * Default predicate for retryable errors.
 * Retries on rate limits (429), server errors (500+), timeouts, and network errors.
 */
function defaultShouldRetry(error) {
  // Anthropic/API HTTP errors
  if (error.status === 429) return true;  // Rate limited
  if (error.status >= 500) return true;   // Server error
  
  // Network errors
  const message = (error.message || '').toLowerCase();
  if (message.includes('timeout')) return true;
  if (message.includes('econnreset')) return true;
  if (message.includes('econnrefused')) return true;
  if (message.includes('socket hang up')) return true;
  if (message.includes('network')) return true;
  if (message.includes('overloaded')) return true;
  
  return false;
}

/**
 * pLimit-like concurrency limiter.
 * Limits the number of concurrent async operations.
 * 
 * @param {number} concurrency - Max concurrent operations
 * @returns {Function} - limit(fn) that returns a promise
 */
function createConcurrencyLimiter(concurrency) {
  let active = 0;
  const queue = [];

  function next() {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  }

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

module.exports = {
  safeParseJSON,
  validateAIScores,
  LRUCache,
  withRetry,
  createConcurrencyLimiter
};
