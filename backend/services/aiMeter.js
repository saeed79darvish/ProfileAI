/**
 * AI Meter: records every call to an AI provider with its real token counts
 * and cost, attributed to a user and a feature.
 *
 * How attribution works without touching the ~90 call sites:
 *   - the auth middleware puts the user id in an AsyncLocalStorage context
 *   - aiRateLimiter(feature) adds the feature name to the same context
 *   - provider clients are wrapped once (meterAnthropic / meterOpenAI), and
 *     the wrapper reads the context when a call finishes
 * Calls made outside a request (ingestion, embeddings backfills) have no user
 * and are recorded with userId null, feature null.
 *
 * Metering must never break a feature: every failure here is swallowed.
 */
const { AsyncLocalStorage } = require('async_hooks');
const { priceCall } = require('../config/aiPricing');

const als = new AsyncLocalStorage();

/** Merge fields into the current async context (userId, feature, route). */
function setContext(fields) {
  const current = als.getStore() || {};
  als.enterWith({ ...current, ...fields });
}

const getContext = () => als.getStore() || {};

/** Run `fn` with a context, for background jobs that know their own feature. */
const runWithContext = (fields, fn) => als.run({ ...getContext(), ...fields }, fn);

let AIApiCall = null;
function model() {
  if (!AIApiCall) AIApiCall = require('../models/AIApiCall');
  return AIApiCall;
}

/**
 * Record one call. Fire-and-forget: returns a promise that never rejects.
 * `usage` is { input, output, cacheRead, cacheWrite } in tokens.
 */
function record({ provider, model: modelName, operation = 'chat', usage = {}, minutes = 0, characters = 0, latencyMs = null, error = null, context }) {
  try {
    const ctx = context || getContext();
    const { cost, priced } = priceCall({ provider, model: modelName, usage, minutes, characters });
    return model().create({
      userId: ctx.userId || null,
      provider,
      model: String(modelName || 'unknown').slice(0, 80),
      operation,
      feature: ctx.feature || null,
      route: ctx.route ? String(ctx.route).slice(0, 120) : null,
      inputTokens: usage.input || 0,
      outputTokens: usage.output || 0,
      cacheReadTokens: usage.cacheRead || 0,
      cacheWriteTokens: usage.cacheWrite || 0,
      costUsd: cost,
      priced,
      latencyMs,
      status: error ? 'error' : 'ok',
      error: error ? String(error.message || error).slice(0, 300) : null,
    }).catch((err) => console.warn('[aiMeter] could not record call:', err.message));
  } catch (err) {
    console.warn('[aiMeter] could not record call:', err.message);
    return Promise.resolve(null);
  }
}

/** Wrap a promise-returning provider call: time it, then record success or failure. */
async function measured(run, onSuccess, onFailure) {
  const started = Date.now();
  const ctx = getContext(); // captured now; the callback may resolve in another tick
  try {
    const result = await run();
    try { onSuccess(result, Date.now() - started, ctx); } catch (e) { console.warn('[aiMeter]', e.message); }
    return result;
  } catch (err) {
    try { onFailure(err, Date.now() - started, ctx); } catch (e) { console.warn('[aiMeter]', e.message); }
    throw err;
  }
}

/** Patch client.messages.create so every Claude call is recorded. */
function meterAnthropic(client) {
  if (!client || client.__metered) return client;
  const original = client.messages.create.bind(client.messages);
  client.messages.create = (params, options) => {
    if (params && params.stream) return original(params, options); // no usage up front
    return measured(
      () => original(params, options),
      (res, latencyMs, context) => {
        const u = res?.usage || {};
        record({
          provider: 'anthropic',
          model: params?.model || res?.model,
          usage: {
            input: u.input_tokens || 0,
            output: u.output_tokens || 0,
            cacheRead: u.cache_read_input_tokens || 0,
            cacheWrite: u.cache_creation_input_tokens || 0,
          },
          latencyMs,
          context,
        });
      },
      (err, latencyMs, context) => record({ provider: 'anthropic', model: params?.model, latencyMs, error: err, context })
    );
  };
  client.__metered = true;
  return client;
}

/** Patch the OpenAI endpoints we use: chat, embeddings, transcription, speech. */
function meterOpenAI(client) {
  if (!client || client.__metered) return client;

  const wrap = (resource, key, describe) => {
    if (!resource || typeof resource[key] !== 'function') return;
    const original = resource[key].bind(resource);
    resource[key] = (params, options) => measured(
      () => original(params, options),
      (res, latencyMs, context) => record({ provider: 'openai', ...describe(params, res), latencyMs, context }),
      (err, latencyMs, context) => record({ provider: 'openai', ...describe(params, null), latencyMs, error: err, context })
    );
  };

  wrap(client.chat?.completions, 'create', (params, res) => {
    const u = res?.usage || {};
    const cached = u.prompt_tokens_details?.cached_tokens || 0;
    return {
      model: res?.model || params?.model,
      operation: 'chat',
      usage: { input: Math.max(0, (u.prompt_tokens || 0) - cached), output: u.completion_tokens || 0, cacheRead: cached },
    };
  });
  wrap(client.embeddings, 'create', (params, res) => ({
    model: params?.model,
    operation: 'embedding',
    usage: { input: res?.usage?.prompt_tokens || res?.usage?.total_tokens || 0 },
  }));
  // Transcription returns bare text, so duration is estimated from the upload
  // size (voice clips from MediaRecorder run about 12 KB/s). Good enough to
  // see the order of magnitude; the real bill is on OpenAI's side.
  wrap(client.audio?.transcriptions, 'create', (params) => ({
    model: params?.model,
    operation: 'transcribe',
    minutes: params?.file?.size ? params.file.size / 12000 / 60 : 0.25,
  }));
  wrap(client.audio?.speech, 'create', (params) => ({
    model: params?.model,
    operation: 'speech',
    characters: String(params?.input || '').length,
  }));

  client.__metered = true;
  return client;
}

module.exports = { setContext, getContext, runWithContext, record, meterAnthropic, meterOpenAI };
