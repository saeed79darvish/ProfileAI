import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useDictation — speak into the composer, watch the words arrive, then send.
 *
 * Two engines, one after the other:
 *   while speaking   the browser's own recogniser, for the live preview, so
 *                    a mishearing is visible while it is still easy to fix
 *   on stop          the recording is transcribed by a real speech model
 *                    (`transcribe`, our server), with the person's own words
 *                    as hints, and its text replaces the preview
 *
 * The browser recogniser alone got most of a sentence wrong for anyone with
 * an accent or a technical job: "checkout" came back as "cholesterol". It is
 * a generic engine tuned for short commands and cannot be told what words to
 * expect. The preview stays because watching the words appear is what makes
 * dictation feel live; the accurate text is what goes in the box. If the
 * server cannot be reached, the preview is kept, so nothing is lost.
 *
 * Deliberately does NOT send. Even a good model mishears a name now and
 * then, and a line that submits itself gives nobody a chance to fix it
 * before it lands on their profile. Dictation fills the box; the person
 * still presses send.
 */

const Recognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;
const canRecord = typeof window !== 'undefined'
  && typeof window.MediaRecorder !== 'undefined'
  && !!navigator?.mediaDevices?.getUserMedia;

/* Phones get the recording alone, no browser preview. On Android Chrome and
   iOS Safari the recogniser and the recorder fight over the one microphone:
   whichever opens second gets silence or an error, and which one opens
   second depends on how fast the permission check comes back. That race
   was "dictation works sometimes". Without the preview, the transcript made
   during each pause fills the box instead, so the words still arrive while
   they talk. */
const isTouchDevice = () => typeof window !== 'undefined'
  && !!window.matchMedia?.('(pointer: coarse)').matches;

// Long enough for a real answer; a forgotten mic should not record forever.
const MAX_RECORDING_MS = 3 * 60 * 1000;

/* Transcribing ahead. The accurate pass used to start only when they
   pressed send, so every voice answer waited a second or more for it. Now,
   after a short pause in speech, the recording so far is transcribed in the
   background; if they send without speaking again, that text is ready, or
   nearly. Speaking again just means the full recording is used, as before. */
const SPEECH_LEVEL = 0.08;
const SPECULATE_AFTER_MS = 600;
const CHUNK_MS = 400;

/**
 * What the input should show: what they had typed, plus what they have said
 * so far. Kept pure and separate because it is the one part worth reasoning
 * about — the rest is browser plumbing.
 */
export const mergeDictation = (base, transcript) => {
  const typed = String(base || '').trimEnd();
  const heard = String(transcript || '').trim();
  if (!heard) return typed;
  if (!typed) return heard;
  return `${typed} ${heard}`;
};

export const dictationSupported = !!Recognition || canRecord;

const pickMimeType = () => {
  if (!canRecord || !window.MediaRecorder.isTypeSupported) return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    .find((t) => window.MediaRecorder.isTypeSupported(t)) || '';
};

/**
 * @param {object} opts
 * @param {(text: string) => void} opts.onText
 * @param {(code: string) => void} [opts.onError]
 * @param {(blob: Blob) => Promise<string>} [opts.transcribe] the accurate pass
 */
export const useDictation = ({ onText, onError, transcribe } = {}) => {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const capTimerRef = useRef(null);
  /* Live microphone level, 0 to 1, for the waveform in the composer. A ref,
     not state: it changes every frame and only the canvas reads it. */
  const levelRef = useRef(0);
  const meterRef = useRef(null);
  // When speech was last heard, and the transcript started for that pause.
  const lastVoiceAtRef = useRef(0);
  const aheadRef = useRef(null);
  // Resolves finish(): the text that should end up in the box.
  const settleRef = useRef(null);
  const settle = (text) => {
    const resolve = settleRef.current;
    settleRef.current = null;
    resolve?.(text);
  };
  // What was in the box when the mic was tapped, so dictation appends to a
  // half-typed answer instead of eating it.
  const baseRef = useRef('');
  const finalRef = useRef('');
  // Set while a session is being thrown away (sending): no late result, from
  // either engine, may land in the box the send just emptied.
  const discardedRef = useRef(false);
  /* Set once the mic stops with a recording to transcribe. The browser can
     deliver one last preview result after stop(); written to the box, it
     could land after the accurate text and overwrite it. It is still kept
     (finalRef) as the fallback. */
  const previewClosedRef = useRef(false);
  /* Bumped by every start and stop. Asking for the microphone takes a
     moment (longer on a phone); a session stopped or replaced while it
     waited must not start recording when the answer comes back. Tapping
     stop during that wait used to leave a recorder running unseen, with the
     mic light on, for up to three minutes. */
  const sessionRef = useRef(0);
  // The microphone has been asked for and the recorder is not running yet.
  const micPendingRef = useRef(false);
  // A pause transcript was put in the box (phones, with no preview).
  const aheadShownRef = useRef(false);
  // Read inside callbacks that are created once.
  const handlersRef = useRef({ onText, onError, transcribe });
  useEffect(() => { handlersRef.current = { onText, onError, transcribe }; }, [onText, onError, transcribe]);

  const stopMeter = () => {
    const meter = meterRef.current;
    meterRef.current = null;
    levelRef.current = 0;
    if (!meter) return;
    cancelAnimationFrame(meter.raf);
    try { meter.ctx.close(); } catch { /* already closed */ }
  };

  /* Reads the level off the same stream being recorded: an analyser on the
     mic, RMS of each frame, smoothed so the bars move like speech rather
     than flicker. */
  const startMeter = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      /* Created after awaiting the microphone, so outside the tap: iOS
         starts it suspended, the level reads zero, and no pause is ever
         detected. */
      if (ctx.state === 'suspended') ctx.resume?.().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const meter = { ctx, raf: 0 };
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        levelRef.current = levelRef.current * 0.6 + Math.min(1, rms * 4) * 0.4;
        const now = performance.now();
        if (levelRef.current > SPEECH_LEVEL) lastVoiceAtRef.current = now;
        transcribeAhead(now);
        meter.raf = requestAnimationFrame(tick);
      };
      meter.raf = requestAnimationFrame(tick);
      meterRef.current = meter;
    } catch { /* no meter: the waveform stays flat, dictation still works */ }
  };

  /* Once per pause: a second of quiet after speech, with a recording to
     send, and nothing already started for this same pause. */
  const transcribeAhead = (now) => {
    const recorder = recorderRef.current;
    const voiceAt = lastVoiceAtRef.current;
    if (!recorder || recorder.state !== 'recording' || !voiceAt) return;
    if (now - voiceAt < SPECULATE_AFTER_MS || aheadRef.current?.voiceAt === voiceAt) return;
    if (!chunksRef.current.length || !handlersRef.current.transcribe) return;
    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
    const ahead = { voiceAt, text: handlersRef.current.transcribe(blob).catch(() => null) };
    aheadRef.current = ahead;
    // No preview running (phones): this is the live text.
    if (recognitionRef.current) return;
    ahead.text.then((text) => {
      if (discardedRef.current || previewClosedRef.current || aheadRef.current !== ahead) return;
      if (!String(text || '').trim()) return;
      aheadShownRef.current = true;
      handlersRef.current.onText?.(mergeDictation(baseRef.current, text));
    });
  };

  const releaseMic = useCallback(() => {
    stopMeter();
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
    capTimerRef.current = null;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* gone */ }
    streamRef.current = null;
  }, []);

  /* Stop listening and keep what was said: the mic button. The recording
     goes to the accurate pass; the preview stays in the box meanwhile. */
  const stop = useCallback(() => {
    sessionRef.current += 1;
    micPendingRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      previewClosedRef.current = true;
      try { recorder.stop(); } catch { releaseMic(); }
    } else {
      releaseMic();
    }
    setListening(false);
  }, [releaseMic]);

  /** Throw the session away, keeping nothing: sending. */
  const cancel = useCallback(() => {
    sessionRef.current += 1;
    micPendingRef.current = false;
    discardedRef.current = true;
    try { recognitionRef.current?.abort(); } catch { /* nothing running */ }
    try { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop(); } catch { /* done */ }
    releaseMic();
    setListening(false);
    setTranscribing(false);
  }, [releaseMic]);

  const startPreview = useCallback(() => {
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    /* English, explicitly. The browser language is often not the language
       being spoken (a Farsi or Greek UI, an English answer), and the
       recogniser then hears English as if it were that language. */
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      if (discardedRef.current) return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalRef.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (previewClosedRef.current) return;
      handlersRef.current.onText?.(mergeDictation(baseRef.current, finalRef.current + interim));
    };
    recognition.onerror = (event) => {
      // Silence is not a failure worth a message; a refused microphone is.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      /* With a recording running, or about to, the preview failing is not
         worth a message. The microphone request is still out while the
         recogniser starts, and an error from it then used to turn the mic
         off on screen while the recorder went on to start anyway. */
      if (recorderRef.current || micPendingRef.current) return;
      setListening(false);
      handlersRef.current.onError?.(event.error);
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* already running */ }
  }, []);

  const start = useCallback(async (currentText = '') => {
    if (!dictationSupported) return;
    sessionRef.current += 1;
    const session = sessionRef.current;
    baseRef.current = currentText;
    finalRef.current = '';
    discardedRef.current = false;
    previewClosedRef.current = false;
    aheadShownRef.current = false;
    chunksRef.current = [];
    recorderRef.current = null;
    recognitionRef.current = null;
    setListening(true);

    const recordable = canRecord && !!handlersRef.current.transcribe;
    const withPreview = !!Recognition && !(recordable && isTouchDevice());
    if (withPreview) startPreview();

    if (!recordable) return;
    micPendingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (session !== sessionRef.current) {
        // Stopped, sent or restarted while the microphone was being asked for.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micPendingRef.current = false;
      streamRef.current = stream;
      startMeter(stream);
      const mimeType = pickMimeType();
      const recorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        releaseMic();
        recorderRef.current = null;
        const preview = mergeDictation(baseRef.current, finalRef.current);
        if (discardedRef.current || !chunksRef.current.length) {
          settle(preview);
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        chunksRef.current = [];
        setTranscribing(true);
        let result = null;
        // Started during the last pause, and nothing said since: use it.
        const ahead = aheadRef.current;
        aheadRef.current = null;
        const stillCurrent = ahead && ahead.voiceAt === lastVoiceAtRef.current;
        try {
          let text = stillCurrent ? await ahead.text : null;
          if (!String(text || '').trim()) text = await handlersRef.current.transcribe(blob);
          if (!discardedRef.current && String(text || '').trim()) {
            result = mergeDictation(baseRef.current, text);
            handlersRef.current.onText?.(result);
          }
        } catch {
          /* The preview is already in the box; keeping it beats an error. */
        } finally {
          setTranscribing(false);
          settle(result);
          /* They spoke and nothing came back from either engine: say so,
             rather than leave an empty box that looks like the mic did
             nothing. Silence (they said nothing) stays quiet. */
          const heardNothing = !result && !finalRef.current.trim() && !aheadShownRef.current;
          if (heardNothing && lastVoiceAtRef.current && !discardedRef.current) {
            handlersRef.current.onError?.('transcribe-failed');
          }
        }
      };
      recorderRef.current = recorder;
      lastVoiceAtRef.current = 0;
      aheadRef.current = null;
      // In short pieces, so the recording so far can be sent mid-answer.
      recorder.start(CHUNK_MS);
      capTimerRef.current = setTimeout(() => stop(), MAX_RECORDING_MS);
    } catch (error) {
      if (session !== sessionRef.current) return;
      micPendingRef.current = false;
      // No recording (refused, or no device): the preview alone carries on
      // if it is running; otherwise this is the message.
      recorderRef.current = null;
      if (!withPreview) {
        setListening(false);
        handlersRef.current.onError?.(error?.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture');
      }
    }
  }, [releaseMic, startPreview, stop]);

  /**
   * Stop listening and wait for the accurate text: what pressing send does
   * while the mic is on. Sending used to throw the recording away and send
   * the browser's rough preview, the exact text the accurate pass exists to
   * replace. Resolves to the final text, or null to keep what is in the box.
   */
  const finish = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') {
      sessionRef.current += 1;
      micPendingRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
      setListening(false);
      return Promise.resolve(null);
    }
    const done = new Promise((resolve) => { settleRef.current = resolve; });
    stop();
    return done;
  }, [stop]);

  const toggle = useCallback((currentText) => {
    if (listening) stop();
    else start(currentText);
  }, [listening, start, stop]);

  // Nothing left recording, and the mic light off, when the page changes.
  useEffect(() => () => {
    sessionRef.current += 1;
    discardedRef.current = true;
    try { recognitionRef.current?.abort(); } catch { /* nothing to abort */ }
    try { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop(); } catch { /* done */ }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* gone */ }
  }, []);

  return { listening, transcribing, levelRef, start, stop, finish, cancel, toggle, supported: dictationSupported };
};
