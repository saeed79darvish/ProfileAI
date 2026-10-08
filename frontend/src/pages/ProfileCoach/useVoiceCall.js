import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useVoiceCall — Remi, spoken.
 *
 * Vapi runs the audio: microphone, transcription, turn-taking, barge-in and
 * the voice itself. It does not run the conversation. Every spoken turn goes
 * to our own endpoint (see backend/services/coachVoiceService.js), which is
 * the same coachTurn the typed chat uses — one checklist, one set of
 * guardrails, one Remi, whether someone is typing or talking.
 *
 * The SDK is loaded only when someone actually starts a call. It pulls in a
 * WebRTC stack that nobody who types should have to download.
 */

export const VOICE_STATES = {
  idle: 'idle',
  connecting: 'connecting',
  live: 'live',
  ending: 'ending',
};

export const useVoiceCall = ({ onTranscript, onEnded, onError } = {}) => {
  const [state, setState] = useState(VOICE_STATES.idle);
  // True while Remi is the one talking, so the UI can say who has the floor.
  const [speaking, setSpeaking] = useState(false);
  const vapiRef = useRef(null);
  const callIdRef = useRef(null);
  const handlersRef = useRef({ onTranscript, onEnded, onError });
  useEffect(() => { handlersRef.current = { onTranscript, onEnded, onError }; }, [onTranscript, onEnded, onError]);

  const stop = useCallback(() => {
    setState(VOICE_STATES.ending);
    try { vapiRef.current?.stop(); } catch { /* already gone */ }
  }, []);

  const start = useCallback(async ({ assistantId, publicKey }) => {
    if (!assistantId || !publicKey) {
      handlersRef.current.onError?.('not-configured');
      return;
    }
    setState(VOICE_STATES.connecting);

    try {
      const { default: Vapi } = await import('@vapi-ai/web');
      const vapi = new Vapi(publicKey);
      vapiRef.current = vapi;

      vapi.on('call-start', () => setState(VOICE_STATES.live));
      vapi.on('speech-start', () => setSpeaking(true));
      vapi.on('speech-end', () => setSpeaking(false));

      vapi.on('message', (message) => {
        // Partials arrive constantly while someone is mid-sentence; only the
        // finished line belongs in a transcript somebody will read back.
        if (message?.type !== 'transcript' || message.transcriptType !== 'final') return;
        const text = String(message.transcript || '').trim();
        if (!text) return;
        handlersRef.current.onTranscript?.({
          role: message.role === 'assistant' ? 'coach' : 'me',
          text,
        });
      });

      vapi.on('call-end', () => {
        setState(VOICE_STATES.idle);
        setSpeaking(false);
        handlersRef.current.onEnded?.(callIdRef.current);
        callIdRef.current = null;
      });

      vapi.on('error', (err) => {
        setState(VOICE_STATES.idle);
        setSpeaking(false);
        // A refused microphone is the common one and is the person's to fix.
        const kind = /permission|denied|NotAllowed/i.test(String(err?.message || err))
          ? 'mic-denied'
          : 'failed';
        handlersRef.current.onError?.(kind);
      });

      const call = await vapi.start(assistantId);
      // Needed after the call ends, to ask the server what it collected.
      callIdRef.current = call?.id || null;
    } catch (err) {
      setState(VOICE_STATES.idle);
      handlersRef.current.onError?.(
        /permission|denied|NotAllowed/i.test(String(err?.message || err)) ? 'mic-denied' : 'failed'
      );
    }
  }, []);

  // A call still running after the page changes keeps the microphone open.
  useEffect(() => () => {
    try { vapiRef.current?.stop(); } catch { /* nothing running */ }
  }, []);

  return { state, speaking, start, stop, live: state === VOICE_STATES.live };
};
