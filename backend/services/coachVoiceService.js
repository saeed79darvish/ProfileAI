/**
 * coachVoiceService — Remi, out loud.
 *
 * Vapi handles the ears and the mouth: transcription, turn-taking, barge-in,
 * speech. The judgement stays here. Vapi is pointed at our own endpoint as
 * its "custom LLM", so every spoken turn runs through the same coachTurn the
 * typed conversation uses — one set of guardrails, one checklist, one voice,
 * whether someone is typing or talking.
 *
 * That is the whole reason the conversation was inverted first. Before, the
 * flow lived in client-side JavaScript deciding what a person meant, and a
 * voice call has no client-side flow to run — the model has to drive, because
 * on a phone call nobody is tapping chips.
 *
 * What is collected during a call is kept here, keyed by Vapi's call id,
 * because Vapi re-sends the transcript each turn but knows nothing about a
 * profile. The frontend asks for it once the call ends.
 */

const axios = require('axios');
const { coachTurn } = require('./profileCoachService');

const VAPI_API_URL = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_PUBLIC_KEY = process.env.VAPI_PUBLIC_KEY;
// Where Vapi calls us back. Must be publicly reachable — Vapi cannot see
// localhost, which is what the tunnel in their quickstart is for.
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || 'https://api.profilleai.com';

const vapiClient = axios.create({
  baseURL: VAPI_API_URL,
  headers: {
    Authorization: `Bearer ${VAPI_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

/* What one call has learned so far.
 *
 * In memory on purpose for now: a call lasts minutes, the data is a dozen
 * fields, and persisting an unfinished voice profile to Postgres before the
 * person has decided to keep it is a privacy choice nobody asked for. The
 * cost is that it does not survive a restart or a second instance — noted in
 * the route, and the fix when it matters is Redis, not a table. */
const sessions = new Map();
const SESSION_TTL_MS = 60 * 60 * 1000;

const pruneSessions = () => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.touchedAt < cutoff) sessions.delete(id);
  }
};

function getSession(callId) {
  pruneSessions();
  if (!sessions.has(callId)) {
    sessions.set(callId, { learned: {}, turns: 0, touchedAt: Date.now() });
  }
  const session = sessions.get(callId);
  session.touchedAt = Date.now();
  return session;
}

/** Whether this call has heard enough to hand back, without consuming it. */
function peekSession(callId) {
  const session = sessions.get(callId);
  if (!session) return null;
  return { done: !!session.done, turns: session.turns };
}

/** Everything the call gathered, for the browser to merge when it ends. */
function takeSession(callId) {
  const session = sessions.get(callId);
  if (!session) return null;
  sessions.delete(callId);
  return session.learned;
}

/* Merging what a call learns is additive and first-wins, like the typed path:
   someone who says "Acme" early and "Acme Corp" later meant the same employer,
   and overwriting on every mention makes the profile flap. Arrays union. */
function mergeLearned(into, fields) {
  for (const [key, value] of Object.entries(fields || {})) {
    if (Array.isArray(value)) {
      const existing = Array.isArray(into[key]) ? into[key] : [];
      into[key] = Array.from(new Set([...existing, ...value]));
    } else if (into[key] === undefined || into[key] === '') {
      into[key] = value;
    }
  }
  return into;
}

/**
 * Create a one-off assistant for this person's call.
 *
 * Transient rather than a stored assistant: the first line and the voice are
 * the same every time, but the model behind it needs to know who is calling,
 * and a per-call assistant keeps that out of a shared object.
 */
async function createVoiceCoach({ firstName } = {}) {
  if (!VAPI_API_KEY) throw new Error('VAPI_API_KEY is not configured');

  const greeting = firstName
    ? `Hi ${firstName}, I'm Remi. I'll build your profile from this conversation — tell me what you do and we'll go from there.`
    : "Hi, I'm Remi. I'll build your profile from this conversation — tell me what you do and we'll go from there.";

  const payload = {
    name: `Remi-${Date.now()}`,
    firstMessage: greeting,
    // Our endpoint, our prompt, our guardrails. Vapi never sees a system
    // prompt because it never decides what to say.
    /* A base URL, not an endpoint: Vapi POSTs each turn to
       `<url>/chat/completions`, the way an OpenAI client would. The route is
       mounted at both spellings — see routes/profiles.js. */
    model: {
      provider: 'custom-llm',
      url: `${PUBLIC_API_URL}/api/profiles/coach/voice`,
      model: 'remi',
    },
    /* Vapi's own voices, not ElevenLabs.
       Validating an 11labs voice means Vapi calling ElevenLabs during
       assistant creation, and that dependency failed in production the first
       time anyone tapped Talk: "Couldn't Validate 11labs Voice. 11labs was
       temporarily unavailable." A voice that cannot be created is worse than
       a voice that is merely good, and Vapi's own need no third party up —
       they also cost less per minute. Both halves stay overridable so a
       better voice can be tried without a deploy. */
    voice: {
      provider: process.env.VAPI_COACH_VOICE_PROVIDER || 'vapi',
      voiceId: process.env.VAPI_COACH_VOICE_ID || 'Elliot',
    },
    transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
    // A profile conversation that has not finished in ten minutes is not
    // going to; this is the ceiling on what one call can cost.
    maxDurationSeconds: 600,
    endCallMessage: 'Great — I have what I need. Your profile is on screen.',
  };

  try {
    const { data } = await vapiClient.post('/assistant', payload);
    return data;
  } catch (error) {
    const complaint = String(error.response?.data?.message || '');
    // A voice provider having a bad minute should not cost somebody their
    // call. One retry on Vapi's own voice, which depends on nobody.
    if (!/voice/i.test(complaint) || payload.voice.provider === 'vapi') throw error;
    console.warn(`[voice] ${complaint} — retrying with Vapi's own voice`);
    const { data } = await vapiClient.post('/assistant', {
      ...payload,
      voice: { provider: 'vapi', voiceId: 'Elliot' },
    });
    return data;
  }
}

/**
 * One spoken turn, in OpenAI's chat-completions shape because that is what
 * Vapi speaks. The last user message is what they just said; everything
 * before it is the transcript.
 *
 * Returns the text for Vapi to speak. Streaming is handled by the route,
 * which has the response object.
 */
async function handleVoiceTurn({ callId, messages = [], profile = {} }) {
  const session = getSession(callId || 'anonymous');

  const spoken = [...messages].reverse().find((m) => m.role === 'user');
  const message = String(spoken?.content || '').trim();
  if (!message) return "I didn't catch that — could you say it again?";

  const history = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-10)
    .map((m) => ({ role: m.role === 'user' ? 'me' : 'coach', text: String(m.content || '') }));

  const turn = await coachTurn({
    profile: { ...profile, ...session.learned },
    missing: missingForVoice(session.learned),
    history,
    message,
  });

  mergeLearned(session.learned, turn.learned);
  session.turns += 1;

  /* Knowing when to stop talking.
     A call with no ending runs until the ten-minute cap and then drops
     mid-sentence, which is how this read to the first person who tried it.
     Once the essentials are in, Remi says so and hands back to the screen —
     deliberately the same words every time rather than whatever the model
     feels like, because this line is a promise about what happens next, and
     the browser is listening for it to close the call. */
  if (!session.done && !essentialsMissing(session.learned).length) {
    session.done = true;
    return HANDOVER;
  }

  return turn.say || 'Got it.';
}

/* The handover. Said out loud, then the call ends and the chat takes over —
   a resume is a file, and asking someone to find one while they are talking
   to their phone is asking them to do two things at once. */
const HANDOVER =
  "That is everything I need to get you started. I am putting it on screen now — "
  + 'if you have a resume handy, you can upload it there and I will fill in the rest.';

/* The same checklist the typed conversation uses, read off what the call has
   heard rather than off a draft. Kept here rather than imported from the
   frontend because the frontend is where the typed copy lives — if these ever
   disagree, this one is wrong. */
/* What a profile cannot do without. Education and location are useful and
   get asked for, but nobody should be kept on a phone call for them — they
   are two taps in the chat afterwards. */
function essentialsMissing(learned = {}) {
  return missingForVoice(learned).filter(
    (item) => !/education|where they are based/.test(item)
  );
}

function missingForVoice(learned = {}) {
  const missing = [];
  if (!learned.title) missing.push('their job title');
  if (!learned.seniority) missing.push('how senior they are');
  if (!learned.company && !learned.bullets?.length) missing.push('their most recent role, or a project');
  if (!learned.bullets?.length) missing.push('what they actually did there, concretely');
  if (!learned.skills?.length) missing.push('what they are good at');
  if (!learned.school && !learned.degree) missing.push('education, a bootcamp or certifications');
  if (!learned.location) missing.push('where they are based');
  if (!learned.target) missing.push('the role they want next');
  return missing;
}

module.exports = {
  createVoiceCoach,
  handleVoiceTurn,
  takeSession,
  peekSession,
  essentialsMissing,
  HANDOVER,
  mergeLearned,
  missingForVoice,
  VAPI_PUBLIC_KEY,
};
