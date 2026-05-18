/**
 * voiceService · OpenAI Whisper (STT) + OpenAI TTS wrappers.
 *
 * Used by the ApplyPilot training page so the agent-coach conversation
 * sounds natural and works on mobile (browser Web Speech API breaks on
 * iOS Safari). Isolated here so other flows (mock interview, etc.) can
 * reuse the same two calls.
 *
 * Env:
 *   OPENAI_API_KEY — required. Whisper + TTS are billed separately from
 *   the Anthropic Claude usage.
 *
 * Exports:
 *   transcribeAudio(buffer, { mimetype, filename })   → string
 *   synthesizeSpeech(text, { voice, format, speed }) → Buffer (MP3)
 */
const OpenAI = require('openai');
const { toFile } = require('openai/uploads');

let _client = null;
function client() {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000, maxRetries: 1 });
  }
  return _client;
}

/**
 * Transcribe a short audio clip to text with Whisper.
 * `buffer` is a Node Buffer (or similar) — typically raw webm/opus or
 * mp4/m4a coming out of MediaRecorder on the frontend.
 */
async function transcribeAudio(buffer, { mimetype = 'audio/webm', filename = 'clip.webm' } = {}) {
  if (!buffer || !buffer.length) throw new Error('empty audio');

  const file = await toFile(buffer, filename, { type: mimetype });
  const res = await client().audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'text',
    language: 'en',
  });
  // With response_format: 'text', the SDK returns a plain string.
  return typeof res === 'string' ? res.trim() : (res?.text || '').trim();
}

/**
 * Synthesize speech from text. Returns a Buffer of MP3 audio.
 * Voices: alloy, echo, fable, onyx, nova, shimmer.
 * We default to 'nova' — warmer, conversational.
 */
async function synthesizeSpeech(text, { voice = 'nova', format = 'mp3', speed = 1.0 } = {}) {
  if (!text || !text.trim()) throw new Error('empty text');

  // `tts-1` is GA on every OpenAI account; `gpt-4o-mini-tts` 404s on some
  // tiers. Stick with tts-1 until we have a reason to upgrade.
  const res = await client().audio.speech.create({
    model: 'tts-1',
    voice,
    input: text.slice(0, 4000), // safety cap
    response_format: format,
    speed,
  });
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = {
  transcribeAudio,
  synthesizeSpeech,
};
