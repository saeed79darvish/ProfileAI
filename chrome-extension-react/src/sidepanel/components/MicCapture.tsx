import React, { useCallback, useEffect, useRef, useState } from 'react';
import { classifyMicError, formatTimer, MAX_RECORD_SECONDS, micProblemMessage, type MicProblem } from '../../answerMemory';
import { transcribe } from '../memoryApi';

interface MicCaptureProps {
  /** Called with the transcript once a recording has been turned into text. */
  onText: (text: string) => void;
  /** Called when the microphone cannot be used, so the parent can show the typing path. */
  onProblem?: (problem: MicProblem, message: string) => void;
  label?: string;
  disabled?: boolean;
}

type Phase = 'idle' | 'recording' | 'transcribing';

export function openMicPermissionPage() {
  try {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/micpermission/index.html') });
  } catch (_) { /* nothing else to do */ }
}

const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

/** Record up to a minute, show the timer, and hand back the transcript. */
export const MicCapture: React.FC<MicCaptureProps> = ({ onText, onProblem, label = 'Speak', disabled }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [problem, setProblem] = useState<MicProblem | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelled = useRef(false);

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => () => {
    cancelled.current = true;
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch (_) {}
    releaseStream();
  }, []);

  const fail = useCallback((problem: MicProblem) => {
    const message = micProblemMessage(problem);
    setProblem(problem);
    setError(message);
    setPhase('idle');
    onProblem?.(problem, message);
  }, [onProblem]);

  const stop = useCallback(() => {
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch (_) {}
  }, []);

  const start = useCallback(async () => {
    setError('');
    setProblem(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      fail('unsupported');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      fail(classifyMicError(err));
      return;
    }
    streamRef.current = stream;
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch (err) {
      releaseStream();
      fail(classifyMicError(err));
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstop = async () => {
      releaseStream();
      if (cancelled.current) return;
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
      if (blob.size < 800) {
        setPhase('idle');
        setError('That recording was too short. Try again, or type it instead.');
        return;
      }
      setPhase('transcribing');
      const res = await transcribe(blob);
      if (cancelled.current) return;
      setPhase('idle');
      if (res.ok && res.text.trim()) onText(res.text.trim());
      else setError(res.ok ? 'We did not catch any words. Try again, or type it instead.' : res.error);
    };
    recRef.current = rec;
    rec.start();
    setSeconds(0);
    setPhase('recording');
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      const s = (Date.now() - startedAt) / 1000;
      setSeconds(s);
      if (s >= MAX_RECORD_SECONDS) stop();
    }, 250);
  }, [fail, onText, stop]);

  if (phase === 'recording') {
    return (
      <div className="mic-row">
        <span className="mic-dot" aria-hidden="true" />
        <span className="mic-timer" aria-live="off">{formatTimer(seconds)} of {formatTimer(MAX_RECORD_SECONDS)}</span>
        <button type="button" className="aq-btn primary" onClick={stop}>Stop</button>
      </div>
    );
  }
  if (phase === 'transcribing') {
    return (
      <div className="mic-row">
        <div className="spinner" />
        <span className="mic-timer">Turning your voice into text</span>
      </div>
    );
  }
  return (
    <div className="mic-wrap">
      <button type="button" className="aq-btn mic-btn" onClick={start} disabled={disabled}>
        <MicIcon /> {label}
      </button>
      {error && <p className="mic-error" role="status">{error}</p>}
      {problem === 'denied' && (
        <button type="button" className="aq-link" onClick={openMicPermissionPage}>
          Allow the microphone, then try again
        </button>
      )}
    </div>
  );
};
