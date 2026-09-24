import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useDictation — speak into the composer, watch the words arrive, then send.
 *
 * The browser's own speech recognition, not ours: no audio leaves the device
 * for us to handle, there is nothing to meter, and it works for a signed-out
 * visitor like everything else in this conversation. Chrome and Safari have
 * it behind a prefix; Firefox does not have it at all, which is why the
 * button reports `supported` rather than assuming.
 *
 * Deliberately does NOT send. Recognition mishears names, job titles and
 * companies constantly — "Threedy" comes back as "three D" — and a line that
 * submits itself gives nobody a chance to fix it before it lands on their
 * profile. Dictation fills the box; the person still presses send.
 */

const Recognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

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

export const dictationSupported = !!Recognition;

export const useDictation = ({ onText, onError } = {}) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  // What was in the box when the mic was tapped, so dictation appends to a
  // half-typed answer instead of eating it.
  const baseRef = useRef('');
  const finalRef = useRef('');
  // Read inside the recognition callbacks, which are created once and would
  // otherwise close over the first render's props.
  const handlersRef = useRef({ onText, onError });
  useEffect(() => { handlersRef.current = { onText, onError }; }, [onText, onError]);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    setListening(false);
  }, []);

  const start = useCallback((currentText = '') => {
    if (!Recognition) return;
    baseRef.current = currentText;
    finalRef.current = '';

    const recognition = new Recognition();
    recognition.continuous = true;
    // Interim results are the point: the words appear as they are spoken, so
    // a mishearing is obvious while it is still easy to fix.
    recognition.interimResults = true;
    recognition.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalRef.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      handlersRef.current.onText?.(mergeDictation(baseRef.current, finalRef.current + interim));
    };

    recognition.onerror = (event) => {
      setListening(false);
      // Silence is not a failure worth a message; a refused microphone is.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      handlersRef.current.onError?.(event.error);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if it is already running — treat as already listening.
      setListening(true);
    }
  }, []);

  const toggle = useCallback((currentText) => {
    if (listening) stop();
    else start(currentText);
  }, [listening, start, stop]);

  // A recogniser left running after the page changes keeps the mic light on.
  useEffect(() => () => {
    try { recognitionRef.current?.abort(); } catch { /* nothing to abort */ }
  }, []);

  return { listening, start, stop, toggle, supported: dictationSupported };
};
