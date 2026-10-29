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

/* How a call ends when its time runs out.
   A call that simply vanishes at a deadline is the worst way to end one, and
   it happened: the plan's minutes ran out mid-sentence and the screen closed
   on someone who was still answering. So the time is a budget, not a guillotine:
     - a minute before it runs out Remi is told, quietly, to start landing it;
     - when it runs out nothing is cut. If they are talking, Remi waits for
       them to finish, then thanks them, says the preview is on its way and
       hangs up the way every call ends;
     - only a call still running well past that is put down, because by then
       something has gone wrong and a forgotten tab is billed by the minute.
   Without a plan allowance (it is always sent today) the budget is five
   minutes, which is what Remi is told to aim for anyway. */
const DEFAULT_BUDGET_MS = 5 * 60 * 1000;
const HEADS_UP_BEFORE_MS = 60 * 1000;
// Past the budget: how long someone may finish a thought before Remi says
// goodbye regardless, and how long before the call is put down regardless.
const FINISH_THOUGHT_MS = 45 * 1000;
const OVERTIME_CAP_MS = 2 * 60 * 1000;
// A goodbye can come back as a tool call with no words; ask again, then leave.
const MAX_GOODBYE_TRIES = 2;

const HEADS_UP_TEXT = 'About a minute left on this call. Do not start any new topic. Let them finish what they are saying, cover the most important thing still open if there is one, and get ready to wrap up.';
const SHARE_ERROR_WINDOW_MS = 8000;
const GOODBYE_TEXT = 'Time is up. Do not ask anything else. Briefly thank them for what they just said, tell them you have what you need, that their profile preview is being put together and will be on screen in a moment, and that once they have checked it you will finish the rest of the profile together. Then call hand_back_to_chat.';

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

/* The session opens with turn detection that hears but does not reply
   (create_response: false, coachRealtimeService.js), so the greeting is the
   one and only opening. Replies are switched on once it is done; this is the
   longest that may take before they are switched on anyway. */
const GREETING_CAP_MS = 10 * 1000;
const REPLYING_TURN_DETECTION = {
  type: 'semantic_vad',
  eagerness: 'low',
  create_response: true,
  interrupt_response: true,
};

export const useVoiceCall = ({ onTranscript, onLearned, onEnded, onError, onShareFailed } = {}) => {
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
  const rafRef = useRef(null);
  const capRef = useRef(null);
  const wrapRef = useRef(null);
  const deadlineRef = useRef(null);
  const finishThoughtRef = useRef(null);
  /* The ending, in order: the budget ran out (closing), Remi was asked to
     say goodbye (goodbyeSent), and Remi actually said something
     (goodbyeSpoken). */
  const closingRef = useRef(false);
  const goodbyeSentRef = useRef(false);
  const goodbyeSpokenRef = useRef(false);
  const goodbyeTriesRef = useRef(0);
  // True between their speech starting and stopping.
  const theyAreTalkingRef = useRef(false);
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
  // True once the greeting is done and turn detection may answer on its own.
  const greetedRef = useRef(false);
  const greetingCapRef = useRef(null);

  const handlersRef = useRef({ onTranscript, onLearned, onEnded, onError, onShareFailed });
  useEffect(() => {
    handlersRef.current = { onTranscript, onLearned, onEnded, onError, onShareFailed };
  }, [onTranscript, onLearned, onEnded, onError, onShareFailed]);

  /** Put everything down, once, whoever asked. */
  /* The screen stays on for the call. People put the phone down to talk,
     the screen dimmed and locked, and the call carried on behind a lock
     screen they then had to fight to get back to. The lock is dropped by
     the browser whenever the page is hidden, so it is taken again when the
     page comes back while the call is still on. Not every browser has it
     (iOS before 16.4); there the phone just sleeps as before. */
  const wakeLockRef = useRef(null);
  // When something was last shared, to tell a refused picture from a broken call.
  const sharedAtRef = useRef(0);
  const holdScreen = useCallback(async () => {
    try {
      if (!navigator.wakeLock || wakeLockRef.current) return;
      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      lock.addEventListener?.('release', () => {
        if (wakeLockRef.current === lock) wakeLockRef.current = null;
      });
    } catch { /* refused (battery saver, hidden page): the phone may sleep */ }
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

  const teardown = useCallback(() => {
    releaseScreen();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (capRef.current) clearTimeout(capRef.current);
    [wrapRef, deadlineRef, finishThoughtRef].forEach((ref) => {
      if (ref.current) clearTimeout(ref.current);
      ref.current = null;
    });
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = null;
    if (greetingCapRef.current) clearTimeout(greetingCapRef.current);
    greetingCapRef.current = null;
    rafRef.current = null;
    capRef.current = null;
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

  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    teardown();
    setState(VOICE_STATES.idle);
    handlersRef.current.onEnded?.();
  }, [teardown]);

  const stop = useCallback(() => {
    /* Stopping a call that is already over must still close the screen.
       finish() returns early once the call has ended, so this used to leave
       the state on "ending" for good: the voice screen reopened when a
       leftover timer stopped an old call, and its × did nothing, because
       every press took the same early return. */
    if (endedRef.current) {
      setState(VOICE_STATES.idle);
      return;
    }
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

  /* Remi's output level, for the orb.
     This used to run the remote stream through a WebAudio analyser while an
     <audio> element played the same stream. Chrome does not love that: the
     same MediaStream feeding a playback element and a graph node is a known
     source of crackle, and crackle on the line is also what trips voice
     detection and makes a call interrupt itself mid-sentence. Both
     complaints, one cause.

     The receiver reports an audio level for free, computed from the RTP it
     is already decoding. No second consumer of the stream, no graph, no
     artefacts.

     The synchronization source only carries a level when the sender adds
     the audio-level RTP header extension, and OpenAI's stream does not, so
     on its own it read 0 for the whole call and the ring never moved while
     Remi spoke. The receiver's inbound-rtp stats carry a level the browser
     computes from the decoded audio, so that is polled too and the louder
     of the two wins. */
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
      // Eased, so the orb swells and settles rather than twitching.
      setLevel((prev) => prev * 0.7 + Math.min(1, peak * 2.4) * 0.3);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const clearNudge = useCallback(() => {
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = null;
  }, []);

  /** The greeting is said: from now on, a finished thought gets a reply. */
  const startReplying = useCallback(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    if (greetingCapRef.current) clearTimeout(greetingCapRef.current);
    greetingCapRef.current = null;
    try {
      channelRef.current?.send(JSON.stringify({
        type: 'session.update',
        session: { type: 'realtime', audio: { input: { turn_detection: REPLYING_TURN_DETECTION } } },
      }));
    } catch { /* channel already closed */ }
  }, []);

  /** Ask for a response that should already have come. */
  const scheduleNudge = useCallback(() => {
    clearNudge();
    // Before the greeting there is nothing owed: the greeting is coming.
    if (!greetedRef.current) return;
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

  /** A system turn: steers the next response, never spoken or transcribed. */
  const tellRemi = useCallback((text) => {
    try {
      channelRef.current?.send(JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'message', role: 'system', content: [{ type: 'input_text', text }] },
      }));
    } catch { /* channel already closed */ }
  }, []);

  /* Ask for the goodbye, once nobody has the floor. Called whenever the floor
     might have just freed up; it does nothing until it is the right moment. */
  const sayGoodbyeWhenFree = useCallback((force = false) => {
    if (!closingRef.current || goodbyeSentRef.current) return;
    if (endedRef.current || leavingRef.current) return;
    if (!force && (theyAreTalkingRef.current || responseInFlightRef.current || speakingRef.current)) return;
    goodbyeSentRef.current = true;
    goodbyeTriesRef.current = 1;
    clearNudge();
    if (finishThoughtRef.current) clearTimeout(finishThoughtRef.current);
    finishThoughtRef.current = null;
    try {
      /* From here a sound in the room must not start a new question or cut
         the goodbye short. */
      channelRef.current?.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          audio: { input: { turn_detection: { ...REPLYING_TURN_DETECTION, create_response: false, interrupt_response: false } } },
        },
      }));
    } catch { /* channel already closed */ }
    tellRemi(GOODBYE_TEXT);
    try {
      channelRef.current?.send(JSON.stringify({ type: 'response.create' }));
    } catch { /* channel already closed */ }
  }, [clearNudge, tellRemi]);

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
        // The first response is the greeting.
        startReplying();
        if (goodbyeSentRef.current) {
          /* The goodbye has been said: leave once it has finished playing.
             A goodbye that came back as only a note-taking tool call gets
             asked for once more. */
          if (goodbyeSpokenRef.current || goodbyeTriesRef.current >= MAX_GOODBYE_TRIES) {
            hangUpWhenQuiet();
          } else {
            goodbyeTriesRef.current += 1;
            try {
              channelRef.current?.send(JSON.stringify({ type: 'response.create' }));
            } catch { /* channel already closed */ }
          }
        } else {
          // Remi was mid-reply when time ran out; that reply is now over.
          sayGoodbyeWhenFree();
        }
        break;
      // They are talking; nothing is owed yet.
      case 'input_audio_buffer.speech_started':
        theyAreTalkingRef.current = true;
        clearNudge();
        break;
      // They stopped. Something should happen now.
      case 'input_audio_buffer.speech_stopped':
        theyAreTalkingRef.current = false;
        if (closingRef.current && !goodbyeSentRef.current) {
          /* Out of time and they have just finished: that is the moment.
             Turn detection may be about to reply to them; give it a beat to
             start, and the goodbye follows whatever it says. */
          setTimeout(() => sayGoodbyeWhenFree(), 400);
          break;
        }
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
        if (text && goodbyeSentRef.current) goodbyeSpokenRef.current = true;
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
          /* During the goodbye the response.done handler decides what comes
             next; asking here as well would start a second reply. */
          if (!hangUp && !goodbyeSentRef.current) channelRef.current?.send(JSON.stringify({ type: 'response.create' }));
        } catch { /* channel already closed */ }
        // Belt for the braces above: if that response never arrives, ask again.
        if (!hangUp && !goodbyeSentRef.current) scheduleNudge();

        /* Leaving: wait for the goodbye to actually finish rather than
           counting off a fixed delay. A sentence takes as long as it takes,
           and the old 1.2 seconds cut it off — which read as the call
           dropping rather than ending. */
        if (hangUp) hangUpWhenQuiet();
        break;
      }

      case 'error':
        // A greeting that failed must not leave the call unable to reply.
        startReplying();
        /* Just after something was shared, the error is about that (a
           picture the model would not take), not the call: say so on the
           call screen and let Remi ask for it in words instead. */
        if (Date.now() - sharedAtRef.current < SHARE_ERROR_WINDOW_MS) {
          sharedAtRef.current = 0;
          handlersRef.current.onShareFailed?.();
          tellRemi('What they just tried to show you did not come through. Tell them so in a few words and ask them to describe it instead.');
          try { channelRef.current?.send(JSON.stringify({ type: 'response.create' })); } catch { /* closed */ }
          break;
        }
        handlersRef.current.onError?.('failed');
        break;

      default:
        break;
    }
  }, [clearNudge, finish, hangUpWhenQuiet, sayGoodbyeWhenFree, scheduleNudge, startReplying, tellRemi]);

  /**
   * maxMinutes is the plan's allowance for this call. It sets when Remi
   * starts wrapping up, not when the line goes dead.
   */
  const start = useCallback(async ({ clientSecret, model, maxMinutes = null }) => {
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
    greetedRef.current = false;
    closingRef.current = false;
    goodbyeSentRef.current = false;
    goodbyeSpokenRef.current = false;
    goodbyeTriesRef.current = 0;
    theyAreTalkingRef.current = false;
    setState(VOICE_STATES.connecting);
    // Asked for here, inside the tap that started the call: iOS wants that.
    holdScreen();

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
        watchLevel(event.receiver);
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
        greetingCapRef.current = setTimeout(startReplying, GREETING_CAP_MS);
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

      /* The time budget. Asked for, never imposed: see DEFAULT_BUDGET_MS. */
      const budgetMs = maxMinutes > 0 ? maxMinutes * 60 * 1000 : DEFAULT_BUDGET_MS;
      wrapRef.current = setTimeout(() => {
        if (endedRef.current || leavingRef.current) return;
        // Steers the next reply; it does not start one.
        tellRemi(HEADS_UP_TEXT);
      }, Math.max(budgetMs / 2, budgetMs - HEADS_UP_BEFORE_MS));
      deadlineRef.current = setTimeout(() => {
        if (endedRef.current || leavingRef.current) return;
        closingRef.current = true;
        sayGoodbyeWhenFree();
        // Someone still mid-thought this long after gets the goodbye anyway.
        finishThoughtRef.current = setTimeout(() => sayGoodbyeWhenFree(true), FINISH_THOUGHT_MS);
      }, budgetMs);
      capRef.current = setTimeout(() => finish(), budgetMs + OVERTIME_CAP_MS);
    } catch (err) {
      teardown();
      setState(VOICE_STATES.idle);
      // A refused microphone is the common one and is the person's to fix.
      const denied = /permission|denied|NotAllowed/i.test(String(err?.name || err?.message || err));
      handlersRef.current.onError?.(denied ? 'mic-denied' : 'failed');
    }
  }, [finish, holdScreen, onEvent, sayGoodbyeWhenFree, startReplying, teardown, tellRemi, watchLevel]);

  // A call still running after the page changes keeps the microphone open.
  useEffect(() => () => teardown(), [teardown]);

  /**
   * Show Remi something mid-call: a photo or screenshot (seen as an image)
   * or a document's text. It goes in as their own turn, so Remi reacts to it
   * out loud, then the floor is theirs again.
   */
  const share = useCallback(({ name = '', imageUrl = '', text = '' } = {}) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== 'open') return false;
    sharedAtRef.current = Date.now();
    const intro = imageUrl
      ? `I just shared an image with you${name ? ` (${name})` : ''}. Look at it.`
      : `I just shared a document with you${name ? `, ${name}` : ''}. Here is its text:\n\n${text}`;
    try {
      channel.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: intro },
            ...(imageUrl ? [{ type: 'input_image', image_url: imageUrl }] : []),
          ],
        },
      }));
      if (!responseInFlightRef.current) channel.send(JSON.stringify({ type: 'response.create' }));
      scheduleNudge();
      return true;
    } catch {
      return false;
    }
  }, [scheduleNudge]);

  return {
    state,
    speaking,
    level,
    muted,
    toggleMute,
    start,
    stop,
    share,
    live: state === VOICE_STATES.live,
  };
};
