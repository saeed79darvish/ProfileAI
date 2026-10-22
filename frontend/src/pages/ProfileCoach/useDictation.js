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

// Long enough for a real answer; a forgotten mic should not record forever.
const MAX_RECORDING_MS = 3 * 60 * 1000;

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
        meter.raf = requestAnimationFrame(tick);
      };
      meter.raf = requestAnimationFrame(tick);
      meterRef.current = meter;
    } catch { /* no meter: the waveform stays flat, dictation still works */ }
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
      // With a recording running, the preview failing is not worth a message.
      if (recorderRef.current) return;
      setListening(false);
      handlersRef.current.onError?.(event.error);
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* already running */ }
  }, []);

  const start = useCallback(async (currentText = '') => {
    if (!dictationSupported) return;
    baseRef.current = currentText;
    finalRef.current = '';
    discardedRef.current = false;
    previewClosedRef.current = false;
    chunksRef.current = [];
    recorderRef.current = null;
    setListening(true);
    startPreview();

    if (!canRecord || !handlersRef.current.transcribe) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
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
        try {
          const text = await handlersRef.current.transcribe(blob);
          if (!discardedRef.current && String(text || '').trim()) {
            result = mergeDictation(baseRef.current, text);
            handlersRef.current.onText?.(result);
          }
        } catch {
          /* The preview is already in the box; keeping it beats an error. */
        } finally {
          setTranscribing(false);
          settle(result);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      capTimerRef.current = setTimeout(() => stop(), MAX_RECORDING_MS);
    } catch (error) {
      // No recording (refused, or no device): the preview alone carries on
      // if it is running; otherwise this is the message.
      recorderRef.current = null;
      if (!Recognition) {
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
    discardedRef.current = true;
    try { recognitionRef.current?.abort(); } catch { /* nothing to abort */ }
    try { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop(); } catch { /* done */ }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* gone */ }
  }, []);

  return { listening, transcribing, levelRef, start, stop, finish, cancel, toggle, supported: dictationSupported };
};
