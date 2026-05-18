/* ================================================================
   useVoiceChat · OpenAI-powered voice hook for the training chat.

   Why not the browser's Web Speech API? Because it's broken on iOS
   Safari (no webkitSpeechRecognition) and the TTS voices sound
   robotic. This hook uses:

     - MediaRecorder to capture mic audio (works everywhere)
     - /api/applypilot/voice/transcribe → OpenAI Whisper
     - /api/applypilot/voice/speak      → OpenAI TTS (mp3)

   Exposed API (same shape as the old browser-native hook so callers
   don't have to change):
     supported            – true if the browser has MediaRecorder
     listening            – mic is recording
     speaking             – TTS audio is playing
     thinking             – waiting for Whisper to finish transcribing
     interim              – always '' with Whisper (no partials)
     transcript           – final text from the last recording
     error                – last error message
     startListening()
     stopListening()
     speak(text, opts)    – Promise that resolves when TTS finishes
     speakText(text, opts)– speak() but strips HTML first
     cancel()             – stop everything
     clearTranscript()

   Auto-end by silence: pass `silenceMs > 0` and the hook will monitor
   mic levels via an AudioContext analyser. When RMS stays below the
   threshold for that long, we stop recording and send the clip.
   ================================================================ */
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyPilotAPI } from '../services/api';

const SILENCE_RMS_THRESHOLD = 0.015;

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const mt of candidates) {
    try { if (MediaRecorder.isTypeSupported(mt)) return mt; } catch {}
  }
  return '';
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function useVoiceChat(options = {}) {
  const {
    onTranscript,
    silenceMs = 0,
    voice = 'nova',
  } = options;

  const [supported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return typeof MediaRecorder !== 'undefined'
      && typeof navigator !== 'undefined'
      && !!navigator.mediaDevices?.getUserMedia;
  });

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  // Surfaces when the transcription endpoint has errored 2+ times in a row
  // so callers can stop hands-free auto-reopen and avoid request storms.
  const [transcriptionBroken, setTranscriptionBroken] = useState(false);

  // Media plumbing refs.
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeRef = useRef('');
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);

  // Silence detection.
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const lastVoiceAtRef = useRef(0);
  const hadVoiceRef = useRef(false);
  const silenceMsRef = useRef(silenceMs);
  useEffect(() => { silenceMsRef.current = silenceMs; }, [silenceMs]);
  // Consecutive transcription failures, after 2, we stop auto-reopening
  // the mic so the user isn't stuck in a silent loop hammering a broken
  // backend. Reset on any successful transcription.
  const failCountRef = useRef(0);

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  const cleanupMic = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    try { analyserRef.current?.disconnect(); } catch {}
    analyserRef.current = null;
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const monitorSilence = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    const startedAt = Date.now();
    lastVoiceAtRef.current = startedAt;
    hadVoiceRef.current = false;
    let voiceMsTotal = 0;
    let lastTickAt = startedAt;

    const tick = () => {
      if (!analyserRef.current) return;
      analyser.getByteTimeDomainData(buf);
      // RMS over the window (centered at 128 for 8-bit PCM).
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const tickNow = Date.now();
      const dt = tickNow - lastTickAt;
      lastTickAt = tickNow;
      if (rms > SILENCE_RMS_THRESHOLD) {
        lastVoiceAtRef.current = tickNow;
        hadVoiceRef.current = true;
        voiceMsTotal += dt;
      }

      const now = Date.now();
      const sinceVoice = now - lastVoiceAtRef.current;
      const sinceStart = now - startedAt;
      const stopAfter = silenceMsRef.current;
      // Auto-stop only if:
      //   (a) the user actually spoke,
      //   (b) they spoke for at least 400ms total (so a cough, a click,
      //       or a single filler "uh" doesn't end the turn),
      //   (c) they've now been quiet longer than stopAfter.
      if (
        stopAfter > 0
        && hadVoiceRef.current
        && voiceMsTotal >= 400
        && sinceVoice > stopAfter
        && recorderRef.current?.state === 'recording'
      ) {
        try { recorderRef.current.stop(); } catch {}
        return; // onstop handles the rest
      }
      // Safety cap: if the user stays silent for 20s, stop on our own so
      // we aren't holding the mic open indefinitely.
      if (!hadVoiceRef.current && sinceStart > 20000 && recorderRef.current?.state === 'recording') {
        try { recorderRef.current.stop(); } catch {}
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startListening = useCallback(async () => {
    if (listening || thinking) return;
    setError(null);
    setTranscript('');

    // Stop any TTS first so the mic doesn't pick up the speaker.
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current = null;
      if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
      setSpeaking(false);
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      setError(err?.message || 'Microphone permission denied');
      return;
    }
    streamRef.current = stream;

    const mimeType = pickSupportedMimeType();
    mimeRef.current = mimeType;
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (err) {
      setError(err?.message || 'Recording not supported');
      cleanupMic();
      return;
    }
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };

    recorder.onstop = async () => {
      setListening(false);
      const chunks = chunksRef.current;
      const type = mimeRef.current || chunks[0]?.type || 'audio/webm';
      const hadVoice = hadVoiceRef.current;
      cleanupMic();

      // No speech detected OR effectively empty clip → skip the round-trip.
      // Without this, pure silence would trigger endless 404/empty POSTs.
      if (!chunks.length || !hadVoice) return;
      const blob = new Blob(chunks, { type });
      if (blob.size < 2000) return;

      setThinking(true);
      try {
        const { data } = await applyPilotAPI.transcribeAudio(blob);
        const text = (data?.text || '').trim();
        if (text) {
          setTranscript(text);
          onTranscriptRef.current?.(text);
        }
        failCountRef.current = 0;
        setTranscriptionBroken(false);
      } catch (err) {
        failCountRef.current += 1;
        const status = err?.response?.status;
        const msg = status === 404
          ? 'Voice endpoint not found, restart the backend so the new /voice routes load.'
          : err?.response?.data?.message || err?.message || 'Transcription failed';
        setError(msg);
        if (failCountRef.current >= 2) setTranscriptionBroken(true);
      } finally {
        setThinking(false);
      }
    };

    // Silence detection via Web Audio analyser (independent of MediaRecorder).
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && silenceMsRef.current > 0) {
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        analyserRef.current = analyser;
        monitorSilence();
      }
    } catch {}

    recorder.start();
    setListening(true);
  }, [listening, thinking, cleanupMic, monitorSilence]);

  const stopListening = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state === 'recording') {
      try { rec.stop(); } catch {}
    } else {
      // Nothing to flush, just tear down.
      cleanupMic();
      setListening(false);
    }
  }, [cleanupMic]);

  /**
   * Speak text via OpenAI TTS. Returns a Promise that resolves when
   * playback ends (or rejects silently on error).
   */
  const speak = useCallback((text, opts = {}) => {
    const clean = String(text || '').trim();
    if (!clean) return Promise.resolve();

    // Cancel any previous playback.
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setSpeaking(true);
    return applyPilotAPI.synthesizeSpeech(clean, opts.voice || voice)
      .then(async ({ data }) => {
        // Backend errors return JSON with an `error` field even though
        // the response is typed as a blob. Detect and surface them.
        if (data?.type && data.type.startsWith('application/json')) {
          const txt = await data.text();
          throw new Error(txt || 'TTS returned an error payload');
        }
        if (!data || data.size === 0) {
          throw new Error('TTS returned an empty audio blob');
        }
        return new Promise((resolve) => {
          const url = URL.createObjectURL(data);
          audioUrlRef.current = url;
          const audio = new Audio(url);
          audio.preload = 'auto';
          audioRef.current = audio;
          audio.onended = () => {
            setSpeaking(false);
            URL.revokeObjectURL(url);
            if (audioUrlRef.current === url) audioUrlRef.current = null;
            if (audioRef.current === audio) audioRef.current = null;
            opts.onEnd?.();
            resolve();
          };
          audio.onerror = () => {
            // eslint-disable-next-line no-console
            console.warn('[voice] <audio> error:', audio.error);
            setSpeaking(false);
            setError('Audio playback failed');
            resolve();
          };
          audio.play().catch((err) => {
            // eslint-disable-next-line no-console
            console.warn('[voice] play() rejected:', err?.message || err);
            setSpeaking(false);
            setError('Tap the page once to enable audio playback');
            resolve();
          });
        });
      })
      .catch(async (err) => {
        setSpeaking(false);
        let msg = err?.message || 'TTS failed';
        // Axios error with a blob body, peek inside for the real message.
        if (err?.response?.data instanceof Blob) {
          try { msg = await err.response.data.text(); } catch {}
        } else if (err?.response?.data?.message) {
          msg = err.response.data.message;
        }
        // eslint-disable-next-line no-console
        console.warn('[voice] TTS failed:', msg);
        setError(msg);
      });
  }, [voice]);

  const cancel = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      try { recorderRef.current.stop(); } catch {}
    }
    cleanupMic();
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setListening(false);
    setSpeaking(false);
    setThinking(false);
  }, [cleanupMic]);

  useEffect(() => () => cancel(), [cancel]);

  return {
    supported,
    listening,
    speaking,
    thinking,
    interim: '', // Whisper has no streaming partials in this setup
    transcript,
    error,
    startListening,
    stopListening,
    speak,
    speakText: (t, o) => speak(stripTags(t), o),
    cancel,
    clearTranscript: () => setTranscript(''),
    transcriptionBroken,
  };
}
