/**
 * Provider price list, USD per 1M tokens (or per unit where noted).
 *
 * Cost is computed when a call is recorded and stored on the row, so changing
 * a price here only affects calls made afterwards. History keeps the price it
 * was actually charged at.
 *
 * Claude prices: https://platform.claude.com/docs/en/about-claude/pricing
 * OpenAI prices: https://openai.com/api/pricing
 * Verify both when a model is added; an unknown model records tokens with
 * cost 0 and priced=false, so the dashboard can flag it instead of hiding it.
 */

// cacheRead / cacheWrite default to 0.1x / 1.25x of input when omitted.
const ANTHROPIC = {
  'claude-fable-5-2':  { input: 8,    output: 40, cacheRead: 0.2 },
  'claude-fable-5-1':  { input: 10,   output: 50 },
  'claude-fable-5':    { input: 10,   output: 50 },
  'claude-opus-5-5':   { input: 4,    output: 20, cacheRead: 0.2 },
  'claude-opus-5':     { input: 5,    output: 25 },
  'claude-opus-4-8':   { input: 5,    output: 25 },
  'claude-opus-4-7':   { input: 5,    output: 25 },
  'claude-opus-4-6':   { input: 5,    output: 25 },
  'claude-sonnet-5-5': { input: 2,    output: 10, cacheRead: 0.1 },
  'claude-sonnet-5':   { input: 2,    output: 10 },
  'claude-sonnet-4-6': { input: 3,    output: 15 },
  'claude-sonnet-4-5': { input: 3,    output: 15 },
  'claude-haiku-5-5':  { input: 0.1,  output: 0.5 },
  'claude-haiku-4-5':  { input: 1,    output: 5 },
};

const OPENAI = {
  'gpt-4o':                 { input: 2.5,  output: 10 },
  'gpt-4o-mini':            { input: 0.15, output: 0.6 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },
  // Speech models bill per audio, not per token; see PER_MINUTE / PER_MILLION_CHARS.
};

// Audio billed by duration or characters.
const PER_MINUTE = {
  'whisper-1': 0.006,
  'gpt-4o-transcribe': 0.006,
  // Realtime voice, blended estimate per conversation minute (audio in + out).
  // Override with AI_REALTIME_USD_PER_MINUTE.
  realtime: Number(process.env.AI_REALTIME_USD_PER_MINUTE) || 0.06,
};
const PER_MILLION_CHARS = {
  'tts-1': 15,
};

// Longest-prefix match so dated snapshots ("claude-haiku-4-5-20251001") price correctly.
function lookup(table, model = '') {
  if (table[model]) return table[model];
  const key = Object.keys(table)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? table[key] : null;
}

function tokenCost(price, { input = 0, output = 0, cacheRead = 0, cacheWrite = 0 }) {
  const read = price.cacheRead ?? price.input * 0.1;
  const write = price.cacheWrite ?? price.input * 1.25;
  return (input * price.input + output * price.output + cacheRead * read + cacheWrite * write) / 1e6;
}

/** { cost, priced } for a call. priced=false means the model is not in the table. */
function priceCall({ provider, model, usage = {}, minutes = 0, characters = 0 }) {
  if (provider === 'anthropic') {
    const p = lookup(ANTHROPIC, model);
    return p ? { cost: tokenCost(p, usage), priced: true } : { cost: 0, priced: false };
  }
  if (provider === 'openai') {
    if (minutes) {
      const rate = lookup(PER_MINUTE, model) ?? PER_MINUTE[model];
      const perMin = typeof rate === 'number' ? rate : PER_MINUTE.realtime;
      return { cost: minutes * perMin, priced: true };
    }
    if (characters) {
      const rate = lookup(PER_MILLION_CHARS, model);
      return rate ? { cost: (characters * rate) / 1e6, priced: true } : { cost: 0, priced: false };
    }
    const p = lookup(OPENAI, model);
    return p ? { cost: tokenCost(p, usage), priced: true } : { cost: 0, priced: false };
  }
  return { cost: 0, priced: false };
}

module.exports = { priceCall, ANTHROPIC, OPENAI };
