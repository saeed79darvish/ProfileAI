import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useVoiceCall — Remi, spoken, over OpenAI's Realtime API.
 *
 * The browser holds the call. We ask our server for a short-lived token,
 * then open a WebRTC connection straight to OpenAI: our microphone up, Remi's
 * voice down, and a data channel in the middle carrying everything that is
 * not audio — transcripts as they are finalised, and the tool calls that put
 * what was said into the profile.
 *
 * This replaced a three-vendor pipeline (a platform, a transcriber, a speech
 * synthesiser, and Claude behind all of it) with one model that hears, thinks
 * and speaks. Most of what that platform was being paid for is in this file
 * now, and most of it turned out to be about forty lines: an offer, an
 * answer, and listening to a data channel. What is genuinely gone is the
 * server's involvement — the audio never touches it, so there is no
 * transcript to relay and nothing to poll.
 *
 * Barge-in and turn-taking are not here because the session asks OpenAI for
 * server-side voice activity detection with interruption on. That is the one
 * hard part of a voice call, and it comes in the box.
 */

const REALTIME_URL = 'https://api.openai.com/v1/realtime/calls';
const EVENT_CHANNEL = 'oai-events';

export const VOICE_STATES = {
  idle: 'idle',
  connecting: 'connecting',
  live: 'live',
  ending: 'ending',
};

/* A call that has not ended on its own by now is not going to. Nothing caps
   this for us any more: the platform that used to enforce a ceiling is gone,
   and a forgotten open tab is billed by the minute like any other call. The
   conversation this exists for is two to three minutes, so three is the
   ceiling and anything past it is a call that has gone wrong. */
const MAX_CALL_MS = 3 * 60 * 1000;

/* How long to let silence run after somebody finishes speaking before
   deciding the model is not going to answer. Long enough that a slow turn is
   not interrupted, short enough that nobody concludes the call is dead —
   people start saying "hello? hello?" at about five seconds. */
const SILENCE_NUDGE_MS = 5000;

/* Two nudges per turn, then stop. A watchdog that keeps firing turns one
   stuck turn into a model talking over itself, which is worse than silence. */
const MAX_NUDGES = 2;

/* How long to let a goodbye run before hanging up anyway. */
const GOODBYE_CAP_MS = 12 * 1000;

export const useVoiceCall = ({ onTranscript, onLearned, onEnded, onError } = {}) => {
  const [state, setState] = useState(VOICE_STATES.idle);
  // True while Remi is the one talking, so the UI can say who has the floor.
  const [speaking, setSpeaking] = useState(false);
  /* How loud Remi is, right now, 0–1. This is what makes the orb look alive
     rather than animated: a shape pulsing on a timer reads as a loading
     spinner, while one that moves with the actual voice reads as the voice. */
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);

  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const micRef = useRef(null);
  const audioRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const capRef = useRef(null);
  const endedRef = useRef(false);
  /* Whether the person has actually said anything yet. The model asking to
     hang up before it has heard a single word means it is reacting to its
     own voice or to room noise, not to a finished conversation — and the
     person is left holding a call that thanked them for their time. */
  const heardThemRef = useRef(false);
  // Mirrors `speaking` for the hangup poll, which runs outside React's render.
  const speakingRef = useRef(false);
  const leavingRef = useRef(false);
  /* Watchdog state. The missing response.create after a tool call is fixed at
     the source, but "the call froze and I had no idea why" is bad enough that
     it is worth a second line of defence: anything else that leaves a turn
     unanswered — a response that errors server-side, a dropped event — looks
     identical to the person sitting there talking to nobody. */
  const responseInFlightRef = useRef(false);
  const nudgeTimerRef = useRef(null);
  const nudgesRef = useRef(0);

  const handlersRef = useRef({ onTranscript, onLearned, onEnded, onError });
  useEffect(() => {
    handlersRef.current = { onTranscript, onLearned, onEnded, onError };
  }, [onTranscript, onLearned, onEnded, onError]);

  /** Put everything down, once, whoever asked. */
  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (capRef.current) clearTimeout(capRef.current);
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = null;
    rafRef.current = null;
    capRef.current = null;
    try { micRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* already stopped */ }
    try { channelRef.current?.close(); } catch { /* already closed */ }
    try { pcRef.current?.close(); } catch { /* already closed */ }
    try { audioCtxRef.current?.close(); } catch { /* already closed */ }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
    micRef.current = null;
    channelRef.current = null;
    pcRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current = null;
    setSpeaking(false);
    setLevel(0);
    setMuted(false);
  }, []);

  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    teardown();
    setState(VOICE_STATES.idle);
    handlersRef.current.onEnded?.();
  }, [teardown]);

  const stop = useCallback(() => {
    setState(VOICE_STATES.ending);
    finish();
  }, [finish]);

  /** Hold the microphone while they think, cough, or talk to someone else. */
  const toggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      const next = !wasMuted;
      try { micRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; }); } catch { /* call over */ }
      return next;
    });
  }, []);

  /* Remi's actual output level, read off the audio we are playing. The
     Realtime API tells us when speech starts and stops but not how loud it
     is, and "is talking" alone gives you a shape that blinks on and off. */
  const watchLevel = useCallback((stream) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i += 1) {
          peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
        }
        // Eased, so the orb swells and settles rather than twitching.
        setLevel((prev) => prev * 0.7 + Math.min(1, peak * 2.2) * 0.3);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch { /* no meter is survivable; a dead call is not */ }
  }, []);

  const clearNudge = useCallback(() => {
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = null;
  }, []);

  /** Ask for a response that should already have come. */
  const scheduleNudge = useCallback(() => {
    clearNudge();
    nudgeTimerRef.current = setTimeout(() => {
      if (endedRef.current || leavingRef.current) return;
      if (responseInFlightRef.current || speakingRef.current) return;
      if (nudgesRef.current >= MAX_NUDGES) return;
      nudgesRef.current += 1;
      try {
        channelRef.current?.send(JSON.stringify({ type: 'response.create' }));
      } catch { /* channel already closed */ }
    }, SILENCE_NUDGE_MS);
  }, [clearNudge]);

  /* Hang up once Remi has stopped talking.
     The goodbye is a spoken sentence of unpredictable length, so this waits
     for silence instead of guessing. The cap is for the case where the
     goodbye never comes and nothing would otherwise end the call. */
  const hangUpWhenQuiet = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const startedAt = Date.now();
    const check = () => {
      if (endedRef.current) return;
      const quiet = !speakingRef.current;
      if (quiet || Date.now() - startedAt > GOODBYE_CAP_MS) {
        setTimeout(() => finish(), quiet ? 600 : 0);
        return;
      }
      setTimeout(check, 250);
    };
    // A beat first: the audio for the goodbye may not have started yet.
    setTimeout(check, 700);
  }, [finish]);

  /* Everything that is not audio arrives here. */
  const onEvent = useCallback((raw) => {
    let event;
    try { event = JSON.parse(raw); } catch { return; }

    switch (event.type) {
      /* Watchdog bookkeeping. A turn is "answered" from the moment a
         response is created, not from when audio starts — a model that is
         thinking has not stalled. */
      case 'response.created':
        responseInFlightRef.current = true;
        clearNudge();
        break;
      case 'response.done':
        responseInFlightRef.current = false;
        nudgesRef.current = 0;
        break;
      // They are talking; nothing is owed yet.
      case 'input_audio_buffer.speech_started':
        clearNudge();
        break;
      // They stopped. Something should happen now.
      case 'input_audio_buffer.speech_stopped':
        scheduleNudge();
        break;

      // Remi has the floor.
      case 'output_audio_buffer.started':
        speakingRef.current = true;
        setSpeaking(true);
        break;
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        speakingRef.current = false;
        setSpeaking(false);
        setLevel(0);
        break;

      // What the person said, once the transcriber is sure of it.
      case 'conversation.item.input_audio_transcription.completed': {
        const text = String(event.transcript || '').trim();
        if (!text) break;
        heardThemRef.current = true;
        handlersRef.current.onTranscript?.({ role: 'me', text });
        break;
      }

      // What Remi said, once it is finished saying it.
      case 'response.output_audio_transcript.done': {
        const text = String(event.transcript || '').trim();
        if (text) handlersRef.current.onTranscript?.({ role: 'coach', text });
        break;
      }

      /* A tool call. This is the whole reason the data channel matters: the
         profile fills in while the person is still talking, on the screen
         behind the call, with no server in the path. */
      case 'response.function_call_arguments.done': {
        let args = {};
        try { args = JSON.parse(event.arguments || '{}'); } catch { /* ignore a malformed call */ }

        let hangUp = false;
        if (event.name === 'remember_about_them') {
          handlersRef.current.onLearned?.(args);
        } else if (event.name === 'hand_back_to_chat') {
          // Nobody has spoken. Whatever it thinks it heard, it was not them.
          hangUp = heardThemRef.current;
        }

        /* Answer the tool, then ask for the next response.
           Both halves are required and the second one is easy to miss: the
           API does not resume on its own after a tool result, it waits to be
           asked. Without it Remi said "let me get that down", called the
           tool, and went silent for the rest of the call — which is exactly
           what it did, and it looked like the call had frozen. */
        try {
          channelRef.current?.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: event.call_id,
              output: JSON.stringify({ ok: true }),
            },
          }));
          if (!hangUp) channelRef.current?.send(JSON.stringify({ type: 'response.create' }));
        } catch { /* channel already closed */ }
        // Belt for the braces above: if that response never arrives, ask again.
        if (!hangUp) scheduleNudge();

        /* Leaving: wait for the goodbye to actually finish rather than
           counting off a fixed delay. A sentence takes as long as it takes,
           and the old 1.2 seconds cut it off — which read as the call
           dropping rather than ending. */
        if (hangUp) hangUpWhenQuiet();
        break;
      }

      case 'error':
        handlersRef.current.onError?.('failed');
        break;

      default:
        break;
    }
  }, [clearNudge, finish, hangUpWhenQuiet, scheduleNudge]);

  const start = useCallback(async ({ clientSecret, model }) => {
    if (!clientSecret || !model) {
      handlersRef.current.onError?.('not-configured');
      return;
    }
    endedRef.current = false;
    heardThemRef.current = false;
    speakingRef.current = false;
    leavingRef.current = false;
    responseInFlightRef.current = false;
    nudgesRef.current = 0;
    setState(VOICE_STATES.connecting);

    try {
      /* These three are the difference between a call and a feedback loop.
         Without echoCancellation the microphone hears Remi through the
         speakers, the transcriber faithfully writes it down, and the model
         answers itself — which is exactly what it did: talking to nobody and
         then thanking the person for their time. `audio: true` asks for none
         of this; every one of them has to be named. */
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micRef.current = mic;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remi's voice, played through an element we own and clean up.
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (event) => {
        [audio.srcObject] = event.streams;
        watchLevel(event.streams[0]);
      };

      pc.addTrack(mic.getAudioTracks()[0], mic);

      const channel = pc.createDataChannel(EVENT_CHANNEL);
      channelRef.current = channel;
      channel.addEventListener('message', (event) => onEvent(event.data));
      channel.addEventListener('open', () => {
        setState(VOICE_STATES.live);
        /* Say hello first. Nothing else starts the conversation: with server
           voice detection the model speaks when it hears something, so a
           silent opening means the first cough in the room becomes the first
           thing Remi replies to. */
        try {
          channel.send(JSON.stringify({ type: 'response.create' }));
        } catch { /* channel closed before it opened */ }
      });

      // A dropped connection is an ended call, not a frozen screen.
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) finish();
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const answer = await fetch(`${REALTIME_URL}?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      });
      if (!answer.ok) throw new Error(`realtime handshake failed: ${answer.status}`);

      await pc.setRemoteDescription({ type: 'answer', sdp: await answer.text() });

      capRef.current = setTimeout(() => finish(), MAX_CALL_MS);
    } catch (err) {
      teardown();
      setState(VOICE_STATES.idle);
      // A refused microphone is the common one and is the person's to fix.
      const denied = /permission|denied|NotAllowed/i.test(String(err?.name || err?.message || err));
      handlersRef.current.onError?.(denied ? 'mic-denied' : 'failed');
    }
  }, [finish, onEvent, teardown, watchLevel]);

  // A call still running after the page changes keeps the microphone open.
  useEffect(() => () => teardown(), [teardown]);

  return {
    state,
    speaking,
    level,
    muted,
    toggleMute,
    start,
    stop,
    live: state === VOICE_STATES.live,
  };
};
