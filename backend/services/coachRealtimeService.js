/**
 * coachRealtimeService — Remi, out loud, on OpenAI's Realtime API.
 *
 * Replaces the Vapi custom-LLM arrangement for the profile coach. The shape
 * of the thing is genuinely different, and simpler:
 *
 *   Vapi:     browser <-> Vapi <-> our server <-> Claude
 *   Realtime: browser <-> OpenAI
 *
 * One model does hearing, thinking and speaking, which is why it costs about
 * a third of what the three-vendor pipeline did. We mint a short-lived token
 * and get out of the way — the audio never touches our server, so there is no
 * transcript to relay, no per-call session to hold in memory, and nothing to
 * poll. What the call learns arrives in the browser as tool calls and goes
 * straight into the draft the person is watching fill in.
 *
 * The cost of that is real and worth stating: the conversation is no longer
 * Claude's. Remi's identity and guardrails live in the session instructions
 * now (see ai/prompts/coachVoiceSession.js) rather than in a prompt we get to
 * re-send every turn, and the only enforcement during a call is the one set
 * of instructions it started with.
 *
 * The recruiter-side phone screening still runs on Vapi. This is the coach
 * only.
 */

const { coachVoiceInstructions, COACH_VOICE_TOOLS } = require('./ai/prompts/coachVoiceSession');

const CLIENT_SECRET_URL = 'https://api.openai.com/v1/realtime/client_secrets';

/* Mini, not the flagship. For a conversation that asks seven questions and
   reacts to the answers, the flagship's extra reasoning buys nothing audible
   and costs roughly three times as much per minute. Overridable because that
   trade changes with the model, not with the code. */
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1-mini';
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'marin';

/* Transcribing what the person says is an extra charge and is not needed to
   hold the conversation — the model hears the audio directly. We pay it
   because the chat is the record of the conversation however it was held,
   and someone who talks for three minutes and comes back to an empty
   transcript has been given nothing to check. */
const INPUT_TRANSCRIPTION_MODEL = process.env.OPENAI_REALTIME_STT_MODEL || 'whisper-1';

const isConfigured = () => !!process.env.OPENAI_API_KEY;

/**
 * A short-lived credential the browser can connect to OpenAI with directly.
 *
 * Ephemeral on purpose: it expires in about a minute and can do nothing but
 * open one realtime session, so it is safe in a browser in a way our actual
 * API key never would be.
 */
async function createVoiceSession({ firstName, profile = {}, missing = [] } = {}) {
  if (!isConfigured()) throw new Error('OPENAI_API_KEY is not configured');

  const body = {
    session: {
      type: 'realtime',
      model: REALTIME_MODEL,
      instructions: coachVoiceInstructions({ firstName, profile, missing }),
      tools: COACH_VOICE_TOOLS,
      tool_choice: 'auto',
      audio: {
        input: {
          transcription: { model: INPUT_TRANSCRIPTION_MODEL },
          /* Keyboards, traffic, a room. The browser suppresses some of this
             before it leaves the machine; this catches what is left, and
             what is left is what trips the detector below. */
          noise_reduction: { type: 'near_field' },
          /* Server-side voice activity detection, with interruption on.
             This is what makes talking over Remi work, and it is the part
             that was worth paying a platform for until it came in the box.

             The threshold went up to 0.62 as a workaround while the real
             problem was the missing echo cancellation on the microphone.
             With that fixed at the source it only hurt: a quiet answer fell
             under the bar and the call sat there as though nobody had
             spoken. Back to the default. The silence window stays a little
             longer than stock so that pausing to think is not read as
             finishing a sentence. */
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 700,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: { voice: REALTIME_VOICE },
      },
    },
  };

  const response = await fetch(CLIENT_SECRET_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error('Could not open a realtime session');
    error.detail = detail.slice(0, 400);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return {
    clientSecret: data.value,
    expiresAt: data.expires_at,
    model: REALTIME_MODEL,
    sessionId: data.session?.id || null,
  };
}

/* The field names a call is allowed to write into a draft. The model is told
   the same list, but a tool call is still model output, and a profile is not
   the place to find out that a prompt was followed loosely. */
const VOICE_FIELDS = new Set([
  'title', 'seniority', 'field', 'company', 'previousCompany', 'startDate',
  'endDate', 'bullets', 'skills', 'school', 'degree', 'location', 'roleType',
  'workStyle', 'target', 'yearsExperience',
]);

/** Keep what the call is allowed to have heard, drop the rest. */
function filterLearned(fields = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (!VOICE_FIELDS.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      const items = value.map((v) => String(v).trim()).filter(Boolean);
      if (items.length) clean[key] = items;
    } else {
      clean[key] = typeof value === 'number' ? value : String(value).trim();
    }
  }
  return clean;
}

module.exports = {
  createVoiceSession,
  filterLearned,
  isConfigured,
  REALTIME_MODEL,
  VOICE_FIELDS,
};
