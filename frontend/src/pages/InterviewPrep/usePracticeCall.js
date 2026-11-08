import { useCallback, useEffect, useRef, useState } from 'react';
import { interviewPrepAPI } from '@/services/interviewPrep';
import {
  nextIndexAfterFeedback, sessionErrorState, callErrorKind, cleanNote, upsertNote, cleanFinish,
} from './practiceLogic';

/**
 * usePracticeCall - "Practice out loud", spoken, over OpenAI's Realtime API.
 *
 * Same stack and the same proven patterns as the profile coach's useVoiceCall
 * (which is live and must not change): a short-lived key from our server, WebRTC
 * straight to OpenAI, a data channel for events, a greeting first and replies
 * switched on after it, a time budget that lands instead of cutting, and
 * everything put down on unmount and when the tab closes.
 *
 * What is different here is the job. The server session carries a list of
 * questions and two tools: record_feedback (after each answer) and
 * finish_session (at the end). This hook turns those tool calls into state:
 *   - currentIndex is 1-based and moves to N+1 when record_feedback arrives
 *     for question N (practiceLogic.nextIndexAfterFeedback, never backwards);
 *   - heardText is the candidate's words for the current answer, from the
 *     input transcription events, cleared when feedback for it is recorded;
 *   - notes collects the feedback, finished holds the closing summary.
 * Nothing is recorded or kept here but text.
 */

const REALTIME_URL = 'https://api.openai.com/v1/realtime/calls';
const EVENT_CHANNEL = 'oai-events';

export const PRACTICE_STATES = { idle: 'idle', connecting: 'connecting', live: 'live', ending: 'ending' };

// Used when the server sends no allowance. Asked for, never imposed: see the budget below.
const DEFAULT_BUDGET_MS = 12 * 60 * 1000;
const HEADS_UP_BEFORE_MS = 60 * 1000;
const FINISH_THOUGHT_MS = 45 * 1000;
const OVERTIME_CAP_MS = 2.5 * 60 * 1000;
// Recording feedback, then the summary, then the spoken goodbye can each be a separate response.
const MAX_GOODBYE_TRIES = 3;
const SILENCE_NUDGE_MS = 5000;
const MAX_NUDGES = 2;
const GOODBYE_CAP_MS = 12 * 1000;
const GREETING_CAP_MS = 10 * 1000;
const RECONNECT_GRACE_MS = 6000;
const MAX_HEARD_CHARS = 4000;

const REPLYING_TURN_DETECTION = { type: 'semantic_vad', eagerness: 'low', create_response: true, interrupt_response: true };

const HEADS_UP_TEXT = 'About a minute left in this session. Do not start a new question. Let them finish their answer, give your feedback on it, and get ready to call finish_session.';
const TIME_UP_TEXT = 'Time is up. Do not ask another question. If they were mid-answer, give your feedback on it and call record_feedback. Then call finish_session with a short summary and one top tip, and say a brief goodbye.';
const LAST_QUESTION_TEXT = 'That was the last question. Say one short sentence to wrap up, then call finish_session with your summary and one top tip.';
const NEXT_TEXT = 'I am done with my answer. Give me your feedback now, call record_feedback, then move on to the next question.';

export const usePracticeCall = () => {
  const [state, setState] = useState(PRACTICE_STATES.idle);
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(1);
  const [heardText, setHeardText] = useState('');
  const [notes, setNotes] = useState([]);
  const [finished, setFinished] = useState(null);
  const [error, setError] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [ended, setEnded] = useState(null); // { dropped, seconds, startedAt } once a session is over

  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const micRef = useRef(null);
  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const capRef = useRef(null);
  const wrapRef = useRef(null);
  const deadlineRef = useRef(null);
  const finishThoughtRef = useRef(null);
  const nudgeTimerRef = useRef(null);
  const greetingCapRef = useRef(null);
  const blipRef = useRef(null);
  const wakeLockRef = useRef(null);
  // Bumped whenever a start is superseded, stopped or unmounted, so a slow await can tell it is stale.
  const runRef = useRef(0);
  const questionsRef = useRef([]);
  const indexRef = useRef(1);
  const heardRef = useRef('');
  const startedAtMsRef = useRef(0);
  const finishedRef = useRef(false);
  const endedRef = useRef(true);
  const closingRef = useRef(false);
  const goodbyeSentRef = useRef(false);
  const goodbyeSpokenRef = useRef(false);
  const goodbyeTriesRef = useRef(0);
  const theyAreTalkingRef = useRef(false);
  const heardThemRef = useRef(false);
  const speakingRef = useRef(false);
  const leavingRef = useRef(false);
  const responseInFlightRef = useRef(false);
  const nudgesRef = useRef(0);
  const greetedRef = useRef(false);
  const greetingDoneRef = useRef(false);
  const greetingTriesRef = useRef(0);

  const holdScreen = useCallback(async () => {
    try {
      if (!navigator.wakeLock || wakeLockRef.current) return;
      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      lock.addEventListener?.('release', () => {
        if (wakeLockRef.current === lock) wakeLockRef.current = null;
      });
    } catch { /* refused: the phone may sleep */ }
  }, []);
  const releaseScreen = useCallback(() => {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    try { lock?.release(); } catch { /* already released */ }
  }, []);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && pcRef.current && !endedRef.current) holdScreen();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [holdScreen]);

  /** Put everything down: the microphone, the connection, every timer. Safe to call twice. */
  const teardown = useCallback(() => {
    releaseScreen();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    [capRef, wrapRef, deadlineRef, finishThoughtRef, nudgeTimerRef, greetingCapRef, blipRef].forEach((ref) => {
      if (ref.current) clearTimeout(ref.current);
      ref.current = null;
    });
    try { micRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* already stopped */ }
    try { channelRef.current?.close(); } catch { /* already closed */ }
    try { pcRef.current?.close(); } catch { /* already closed */ }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
    micRef.current = null;
    channelRef.current = null;
    pcRef.current = null;
    setSpeaking(false);
    setLevel(0);
    setMuted(false);
  }, [releaseScreen]);

  /** End the session once, whoever asked. `dropped` when the connection went, not the person. */
  const finish = useCallback(({ dropped = false } = {}) => {
    if (endedRef.current) return;
    endedRef.current = true;
    runRef.current += 1;
    const seconds = startedAtMsRef.current ? Math.max(0, Math.round((Date.now() - startedAtMsRef.current) / 1000)) : 0;
    teardown();
    setState(PRACTICE_STATES.idle);
    setEnded({ dropped, seconds, startedAt: startedAtMsRef.current ? new Date(startedAtMsRef.current).toISOString() : new Date().toISOString() });
  }, [teardown]);

  const stop = useCallback(() => {
    if (endedRef.current) {
      // Not running (or already over): only make sure nothing is left open.
      runRef.current += 1;
      teardown();
      setState(PRACTICE_STATES.idle);
      return;
    }
    setState(PRACTICE_STATES.ending);
    finish();
  }, [finish, teardown]);

  const toggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      const next = !wasMuted;
      try { micRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; }); } catch { /* call over */ }
      return next;
    });
  }, []);

  /* The coach's output level, from the receiver's own stats (see useVoiceCall for why not WebAudio). */
  const watchLevel = useCallback((receiver) => {
    if (!receiver) return;
    let statsLevel = 0;
    let polling = false;
    let lastPoll = 0;
    const poll = async () => {
      if (polling || !receiver.getStats) return;
      polling = true;
      try {
        const report = await receiver.getStats();
        report.forEach((stat) => {
          if (stat.type === 'inbound-rtp' && typeof stat.audioLevel === 'number') statsLevel = stat.audioLevel;
        });
      } catch { /* the receiver went away with the call */ }
      polling = false;
    };
    const tick = (now) => {
      if (now - lastPoll > 80) {
        lastPoll = now;
        poll();
      }
      let peak = statsLevel;
      try {
        const [source] = receiver.getSynchronizationSources?.() || [];
        if (typeof source?.audioLevel === 'number') peak = Math.max(peak, source.audioLevel);
      } catch { /* the receiver went away with the call */ }
      setLevel((prev) => prev * 0.7 + Math.min(1, peak * 2.4) * 0.3);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const sendEvent = useCallback((payload) => {
    try {
      const ch = channelRef.current;
      if (!ch || ch.readyState !== 'open') return false;
      ch.send(JSON.stringify(payload));
      return true;
    } catch {
      return false; // channel already closed
    }
  }, []);

  const clearNudge = useCallback(() => {
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = null;
  }, []);

  /** The greeting is said: from now on a finished thought gets a reply. */
  const startReplying = useCallback(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    if (greetingCapRef.current) clearTimeout(greetingCapRef.current);
    greetingCapRef.current = null;
    sendEvent({ type: 'session.update', session: { type: 'realtime', audio: { input: { turn_detection: REPLYING_TURN_DETECTION } } } });
  }, [sendEvent]);

  /** Ask for a response that should already have come. */
  const scheduleNudge = useCallback(() => {
    clearNudge();
    if (!greetedRef.current) return;
    nudgeTimerRef.current = setTimeout(() => {
      if (endedRef.current || leavingRef.current) return;
      if (responseInFlightRef.current || speakingRef.current) return;
      if (nudgesRef.current >= MAX_NUDGES) return;
      nudgesRef.current += 1;
      sendEvent({ type: 'response.create' });
    }, SILENCE_NUDGE_MS);
  }, [clearNudge, sendEvent]);

  /** Hang up once the coach has stopped talking, or after a cap. */
  const hangUpWhenQuiet = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const began = Date.now();
    const check = () => {
      if (endedRef.current) return;
      const quiet = !speakingRef.current;
      if (quiet || Date.now() - began > GOODBYE_CAP_MS) {
        setTimeout(() => finish(), quiet ? 600 : 0);
        return;
      }
      setTimeout(check, 250);
    };
    setTimeout(check, 700);
  }, [finish]);

  /** A system turn: steers the next response, never spoken or transcribed. */
  const tellCoach = useCallback((text) => {
    sendEvent({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text }] } });
  }, [sendEvent]);

  /** Ask for the closing once nobody has the floor (or when forced). */
  const sayGoodbyeWhenFree = useCallback((force = false) => {
    if (!closingRef.current || goodbyeSentRef.current) return;
    if (endedRef.current || leavingRef.current) return;
    if (!force && (theyAreTalkingRef.current || responseInFlightRef.current || speakingRef.current)) return;
    goodbyeSentRef.current = true;
    goodbyeTriesRef.current = 1;
    clearNudge();
    if (finishThoughtRef.current) clearTimeout(finishThoughtRef.current);
    finishThoughtRef.current = null;
    sendEvent({
      type: 'session.update',
      session: { type: 'realtime', audio: { input: { turn_detection: { ...REPLYING_TURN_DETECTION, create_response: false, interrupt_response: false } } } },
    });
    tellCoach(TIME_UP_TEXT);
    sendEvent({ type: 'response.create' });
  }, [clearNudge, sendEvent, tellCoach]);

  /** Everything that is not audio arrives here. */
  const onEvent = useCallback((raw) => {
    let event;
    try { event = JSON.parse(raw); } catch { return; }

    switch (event.type) {
      case 'response.created':
        responseInFlightRef.current = true;
        clearNudge();
        break;
      case 'response.done':
        responseInFlightRef.current = false;
        nudgesRef.current = 0;
        // The first response is the greeting; a cancelled one is asked for again, once.
        if (!greetedRef.current) {
          const status = event.response?.status;
          if (status && status !== 'completed' && greetingTriesRef.current < 2) {
            greetingTriesRef.current += 1;
            setTimeout(() => {
              if (endedRef.current || greetedRef.current) return;
              sendEvent({ type: 'response.create' });
            }, 700);
            break;
          }
          greetingDoneRef.current = true;
          if (!speakingRef.current) setTimeout(startReplying, 800);
        }
        if (goodbyeSentRef.current) {
          if (finishedRef.current || goodbyeSpokenRef.current || goodbyeTriesRef.current >= MAX_GOODBYE_TRIES) {
            hangUpWhenQuiet();
          } else {
            goodbyeTriesRef.current += 1;
            sendEvent({ type: 'response.create' });
          }
        } else {
          sayGoodbyeWhenFree();
        }
        break;
      case 'input_audio_buffer.speech_started':
        theyAreTalkingRef.current = true;
        clearNudge();
        break;
      case 'input_audio_buffer.speech_stopped':
        theyAreTalkingRef.current = false;
        if (closingRef.current && !goodbyeSentRef.current) {
          setTimeout(() => sayGoodbyeWhenFree(), 400);
          break;
        }
        scheduleNudge();
        break;
      case 'output_audio_buffer.started':
        speakingRef.current = true;
        setSpeaking(true);
        break;
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        speakingRef.current = false;
        setSpeaking(false);
        setLevel(0);
        if (greetingDoneRef.current && !greetedRef.current) setTimeout(startReplying, 800);
        break;

      // The candidate's words, once the transcriber is sure of them. These build the live "what we heard".
      case 'conversation.item.input_audio_transcription.completed': {
        const text = String(event.transcript || '').trim();
        // Before the greeting is done whatever was heard is the room or an echo, not an answer.
        if (!text || !greetedRef.current) break;
        heardThemRef.current = true;
        const joined = heardRef.current ? `${heardRef.current} ${text}` : text;
        heardRef.current = joined.length > MAX_HEARD_CHARS ? joined.slice(joined.length - MAX_HEARD_CHARS) : joined;
        setHeardText(heardRef.current);
        break;
      }

      case 'response.output_audio_transcript.done': {
        const text = String(event.transcript || '').trim();
        if (text && goodbyeSentRef.current) goodbyeSpokenRef.current = true;
        break;
      }

      case 'response.function_call_arguments.done': {
        let args = {};
        try { args = JSON.parse(event.arguments || '{}'); } catch { /* ignore a malformed call */ }

        let hangUp = false;
        let lastQuestionDone = false;
        if (event.name === 'record_feedback') {
          const note = cleanNote(args);
          if (note) {
            setNotes((prev) => upsertNote(prev, note));
            const total = questionsRef.current.length;
            const next = nextIndexAfterFeedback(indexRef.current, note.questionIndex, total);
            indexRef.current = next;
            setCurrentIndex(next);
            // The next answer starts from nothing.
            heardRef.current = '';
            setHeardText('');
            lastQuestionDone = total > 0 && next > total;
          }
        } else if (event.name === 'finish_session') {
          // A finish before anyone has said a word is the model reacting to the room, not a finished session.
          if (heardThemRef.current) {
            finishedRef.current = true;
            setFinished(cleanFinish(args));
            hangUp = true;
          }
        }

        /* Answer the tool, then ask for the next response. The API does not
           resume on its own after a tool result; without the second half the
           coach goes silent after taking a note. */
        const answered = sendEvent({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: event.call_id, output: JSON.stringify({ ok: true }) },
        });
        if (answered && !hangUp && !goodbyeSentRef.current) {
          if (lastQuestionDone && !finishedRef.current) tellCoach(LAST_QUESTION_TEXT);
          sendEvent({ type: 'response.create' });
        }
        if (!hangUp && !goodbyeSentRef.current) scheduleNudge();
        if (hangUp) hangUpWhenQuiet();
        break;
      }

      case 'error':
        // A greeting that failed must not leave the session unable to reply.
        startReplying();
        break;

      default:
        break;
    }
  }, [clearNudge, hangUpWhenQuiet, sayGoodbyeWhenFree, scheduleNudge, sendEvent, startReplying, tellCoach]);

  /**
   * Begin a session for a prep. Asks our server for the session (questions and
   * a short-lived key), then opens the call. Failures land in `error`:
   * 'upgrade' | 'limit' | 'unavailable' | 'not_ready' | 'mic-denied' | 'failed'.
   */
  const start = useCallback(async (prepId, body = {}) => {
    if (!endedRef.current || !prepId) return;
    endedRef.current = false;
    runRef.current += 1;
    const run = runRef.current;
    const stale = () => runRef.current !== run;

    heardThemRef.current = false;
    speakingRef.current = false;
    leavingRef.current = false;
    responseInFlightRef.current = false;
    nudgesRef.current = 0;
    greetedRef.current = false;
    greetingDoneRef.current = false;
    greetingTriesRef.current = 0;
    closingRef.current = false;
    goodbyeSentRef.current = false;
    goodbyeSpokenRef.current = false;
    goodbyeTriesRef.current = 0;
    theyAreTalkingRef.current = false;
    finishedRef.current = false;
    heardRef.current = '';
    indexRef.current = 1;
    questionsRef.current = [];
    startedAtMsRef.current = 0;
    setQuestions([]);
    setCurrentIndex(1);
    setHeardText('');
    setNotes([]);
    setFinished(null);
    setEnded(null);
    setError(null);
    setErrorMessage('');
    setElapsedMs(0);
    setStartedAt(null);
    setState(PRACTICE_STATES.connecting);
    holdScreen();

    const fail = (kind, message = '') => {
      endedRef.current = true;
      teardown();
      setState(PRACTICE_STATES.idle);
      setError(kind);
      setErrorMessage(message);
    };

    let session;
    try {
      const res = await interviewPrepAPI.startPractice(prepId, body);
      session = res.data || {};
    } catch (e) {
      if (stale()) return;
      const st = sessionErrorState(e);
      fail(st.kind, st.message);
      return;
    }
    if (stale()) return;

    const list = (Array.isArray(session.questions) ? session.questions : [])
      .filter((q) => q && typeof q.text === 'string' && q.text.trim())
      .map((q, i) => ({ id: String(q.id || `p${i + 1}`), text: q.text.trim(), kind: q.kind === 'resume' ? 'resume' : 'reported' }));
    if (!session.clientSecret || !session.model || !list.length) {
      fail('failed');
      return;
    }
    questionsRef.current = list;
    setQuestions(list);

    try {
      // Echo cancellation and the other two are the difference between a call and a feedback loop.
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (stale()) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      micRef.current = mic;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = document.createElement('audio');
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (event) => {
        [audio.srcObject] = event.streams;
        watchLevel(event.receiver);
      };
      pc.addTrack(mic.getAudioTracks()[0], mic);

      const channel = pc.createDataChannel(EVENT_CHANNEL);
      channelRef.current = channel;
      channel.addEventListener('message', (event) => onEvent(event.data));
      channel.addEventListener('open', () => {
        if (stale()) return;
        const now = Date.now();
        startedAtMsRef.current = now;
        setStartedAt(now);
        setState(PRACTICE_STATES.live);
        if (window.matchMedia?.('(pointer: coarse)').matches) {
          sendEvent({ type: 'session.update', session: { type: 'realtime', audio: { input: { noise_reduction: { type: 'far_field' } } } } });
        }
        // The coach speaks first: nothing else would start the session.
        sendEvent({ type: 'response.create' });
        greetingCapRef.current = setTimeout(startReplying, GREETING_CAP_MS);
      });

      pc.onconnectionstatechange = () => {
        const now = pc.connectionState;
        if (now === 'connected' && blipRef.current) {
          clearTimeout(blipRef.current);
          blipRef.current = null;
        } else if (now === 'disconnected' && !blipRef.current) {
          blipRef.current = setTimeout(() => {
            blipRef.current = null;
            if (pc.connectionState !== 'connected') finish({ dropped: true });
          }, RECONNECT_GRACE_MS);
        } else if (now === 'failed' || now === 'closed') {
          finish({ dropped: now === 'failed' });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (stale()) return;

      const answer = await fetch(`${REALTIME_URL}?model=${encodeURIComponent(session.model)}`, {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${session.clientSecret}`, 'Content-Type': 'application/sdp' },
      });
      if (!answer.ok) throw new Error(`realtime handshake failed: ${answer.status}`);
      const sdp = await answer.text();
      if (stale()) return;
      await pc.setRemoteDescription({ type: 'answer', sdp });
      if (stale()) return;

      /* The time budget: a minute before it runs out the coach is told to land
         it; when it runs out nothing is cut, the coach finishes the answer in
         progress, gives feedback and closes; only a session well past that is
         put down, because a forgotten tab is billed by the minute. */
      const maxMinutes = Number(session.maxSessionMinutes);
      const budgetMs = maxMinutes > 0 ? maxMinutes * 60 * 1000 : DEFAULT_BUDGET_MS;
      wrapRef.current = setTimeout(() => {
        if (endedRef.current || leavingRef.current) return;
        tellCoach(HEADS_UP_TEXT);
      }, Math.max(budgetMs / 2, budgetMs - HEADS_UP_BEFORE_MS));
      deadlineRef.current = setTimeout(() => {
        if (endedRef.current || leavingRef.current) return;
        closingRef.current = true;
        sayGoodbyeWhenFree();
        finishThoughtRef.current = setTimeout(() => sayGoodbyeWhenFree(true), FINISH_THOUGHT_MS);
      }, budgetMs);
      capRef.current = setTimeout(() => finish(), budgetMs + OVERTIME_CAP_MS);
    } catch (err) {
      if (stale()) return;
      fail(callErrorKind(err));
    }
  }, [finish, holdScreen, onEvent, sayGoodbyeWhenFree, sendEvent, startReplying, teardown, tellCoach, watchLevel]);

  /**
   * "I am done, next question": a short typed turn asking the coach to give
   * feedback and move on. Only when it is safe: the session is live, the
   * coach has finished greeting, is not mid-reply, and is not wrapping up.
   */
  const requestNext = useCallback(() => {
    if (endedRef.current || leavingRef.current || closingRef.current || goodbyeSentRef.current) return false;
    if (!greetedRef.current || responseInFlightRef.current || speakingRef.current) return false;
    const sent = sendEvent({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: NEXT_TEXT }] },
    });
    if (!sent) return false;
    sendEvent({ type: 'response.create' });
    scheduleNudge();
    return true;
  }, [scheduleNudge, sendEvent]);

  // The clock on screen. Stops by itself when the session leaves the live state.
  useEffect(() => {
    if (state !== PRACTICE_STATES.live || !startedAt) return undefined;
    const t = setInterval(() => setElapsedMs(Date.now() - startedAt), 500);
    return () => clearInterval(t);
  }, [state, startedAt]);

  // A session still running after the page changes, or the tab closes, keeps the microphone open and the minutes billing.
  useEffect(() => {
    const down = () => {
      endedRef.current = true;
      runRef.current += 1;
      teardown();
    };
    window.addEventListener('pagehide', down);
    window.addEventListener('beforeunload', down);
    return () => {
      window.removeEventListener('pagehide', down);
      window.removeEventListener('beforeunload', down);
      down();
    };
  }, [teardown]);

  return {
    state,
    speaking,
    level,
    muted,
    toggleMute,
    start,
    stop,
    elapsedMs,
    heardText,
    currentIndex,
    notes,
    finished,
    error,
    // Beyond the shared contract, used by the practice page only:
    errorMessage,
    questions,
    startedAt,
    ended,
    requestNext,
    live: state === PRACTICE_STATES.live,
  };
};

export default usePracticeCall;
