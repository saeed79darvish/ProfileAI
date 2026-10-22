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
  // What was in the box when the mic was tapped, so dictation appends to a
  // half-typed answer instead of eating it.
  const baseRef = useRef('');
  const finalRef = useRef('');
  // Set while a session is being thrown away (sending): no late result, from
  // either engine, may land in the box the send just emptied.
  const discardedRef = useRef(false);
  // Read inside callbacks that are created once.
  const handlersRef = useRef({ onText, onError, transcribe });
  useEffect(() => { handlersRef.current = { onText, onError, transcribe }; }, [onText, onError, transcribe]);

  const releaseMic = useCallback(() => {
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
      const mimeType = pickMimeType();
      const recorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        releaseMic();
        recorderRef.current = null;
        if (discardedRef.current || !chunksRef.current.length) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        chunksRef.current = [];
        setTranscribing(true);
        try {
          const text = await handlersRef.current.transcribe(blob);
          if (!discardedRef.current && String(text || '').trim()) {
            handlersRef.current.onText?.(mergeDictation(baseRef.current, text));
          }
        } catch {
          /* The preview is already in the box; keeping it beats an error. */
        } finally {
          setTranscribing(false);
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

  return { listening, transcribing, start, stop, cancel, toggle, supported: dictationSupported };
};
