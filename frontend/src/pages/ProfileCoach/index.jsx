import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic as MicIcon,
  Add as AttachIcon,
  Send as SendIcon,
  Tune as TuneIcon,
  Extension as ExtensionIcon,
  MailOutline as MailIcon,
  EditOutlined as EditIcon,
  Public as PublicIcon,
  DescriptionOutlined as FileIcon,
  CheckCircle as DoneIcon,
  ErrorOutline as FailedIcon,
} from '@mui/icons-material';

import { useAuth } from '../../contexts/AuthContext';
import { profileAPI, careerContextAPI } from '../../services/api';
import { computeProfileCompletion } from '../../hooks/useProfileCompletion';
import { saveGuestProfileDraft } from '../../utils/guestDraft';
import { trackEvent } from '../../utils/analytics';
import BrandLogo from '../../components/BrandLogo';
import ConfirmModal from '../../components/ConfirmModal';
import LinkedInImportModal from '../ProfileCreation/LinkedInImportModal';
import { useDictation } from './useDictation';
import CoachMark from './CoachMark';
import DictationWave from './DictationWave';
import VoicePanel from './VoicePanel';
import { useVoiceCall, VOICE_STATES } from './useVoiceCall';
import {
  IntroCarousel,
  BuildProfileCard,
  INTRO_TEXT,
  SLIDES,
} from '../../components/OnboardingIntro';

import {
  LADDER,
  ROUTES,
  TEXT,
  COACH_TEXT,
  TOUR_CARDS,
  TIMING,
  PANEL_ITEMS,
  JOB_SECTORS,
  ALLOWED_FILE_TYPES,
  VALIDATION,
  UPLOAD_STEPS,
  UPLOAD_STEP_MS,
} from './constants';
import {
  emptyDraft,
  getChips,
  matchSector,
  matchChip,
  nextStepIndex,
  mergeInterpreted,
  attachBullets,
  seedFromImport,
  draftToResumeData,
  draftToProfileShape,
  panelState,
  resumeSections,
  isPresentable,
  canAnswer,
  questionText,
  hintText,
  preferenceLabels,
  isAlreadyAnswered,
  missingFields,
  applyBraindump,
  canRewind,
  draftRewoundTo,
  coachCompletion,
  loadConversation,
  saveConversation,
  clearConversation,
  readsAsAnswer,
  visiblePanelItems,
  parseLinks,
  sectorChips,
  fieldFromText,
  roleConfirmText,
  careerContextOf,
  seedFromCareerContext,
  checkLines,
  applyCheckEdit,
  SAY_IT_CHIP,
  parseSkillList,
  RESUME_CHOICE,
  VOICE_CHOICE,
  VOICE_SIGNIN_CHOICE,
  RETRY_IMPORT_CHOICES,
  ASKED_IMPORT_CHOICES,
  POST_CALL_IMPORT_CHOICES,
  VOICE_OFFER_STEP,
  voiceAgenda,
  MORE_SECTORS_CHIP,
  CUSTOM_ANSWER_CHIP,
} from './coachLogic';
import {
  PageContainer, TopBar, Logo, Body,
  ChatColumn, MessageList, Thread, Row, CoachAvatar, Bubble, BubbleHint, EditHint, Typing,
  ChipRow, Chip, QuickReplies, QuickReply,
  ComposerWrap, Composer, ComposerField, ComposerInput, ComposerWave, ClearButton, DropOverlay, AttachmentCard, IconButton, Footnote, ErrorNote,
  SidePanel, PanelHead, Meter, PanelTitle, PanelTier, PanelSub,
  PanelItem, PanelItemHead, Dot, PanelItemBody, PanelRoles, PanelTags,
  MobileStrip, StripBar, StripLabel, MobilePanel,
  Card, CardLabel, CardList, Finding,
  VerdictRow, Verdict, MarketNote, Headline, EffortTag,
  ResumeSheet, ResumeName, ResumeMeta, ResumeSection, ResumeEntry, ResumeSkills,
  TourGrid, TourCard, TourIcon,
  ConvertCard, ConvertActions, ConvertPrimary, ConvertSecondary, ConvertNote,
  UploadCard, UploadIcon, UploadBody, UploadTrack, ChipRemove, MultiDone,
  CheckList, CheckEdit,
} from './styled';

const TOUR_ICONS = {
  tune: TuneIcon,
  extension: ExtensionIcon,
  mail: MailIcon,
  public: PublicIcon,
};

// Which colour the target verdict wears. Kept out of the component so the
// three strings the service can return are visible in one place.
const VERDICT_TONE = {
  'within reach': 'near',
  'a stretch': 'mid',
  'a big jump': 'far',
};

/**
 * Narrated progress while a resume is parsed.
 *
 * Owns its own timer rather than storing a tick on the message: the parse
 * takes several seconds, and re-rendering the entire transcript five times to
 * advance a label is wasteful. The bar creeps toward 90% and only completes
 * when the parse actually returns, so it never claims to be finished before
 * it is.
 */
const UploadProgress = ({ fileName, done, failed }) => {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (done || failed) return undefined;
    const id = setInterval(
      () => setStepIdx((i) => Math.min(i + 1, UPLOAD_STEPS.length - 1)),
      UPLOAD_STEP_MS
    );
    return () => clearInterval(id);
  }, [done, failed]);

  const pct = failed ? 100 : done ? 100 : Math.min(90, 12 + stepIdx * 20);

  return (
    <UploadCard>
      <UploadIcon>
        {failed ? <FailedIcon htmlColor="#dc2626" /> : done ? <DoneIcon htmlColor="#22c55e" /> : <FileIcon />}
      </UploadIcon>
      <UploadBody>
        <b>{fileName}</b>
        <span>{failed ? TEXT.UPLOAD_UNREADABLE : done ? 'Read it.' : UPLOAD_STEPS[stepIdx]}</span>
        <UploadTrack $pct={pct} $done={done} $failed={failed}><i /></UploadTrack>
      </UploadBody>
    </UploadCard>
  );
};

/**
 * The check after a voice call: the facts it heard, one line each, every
 * line fixable in place. Top-level so a line being edited keeps its text
 * while the page re-renders around it.
 */
const CheckCard = ({ lines, spent, busy, onSave, onDone }) => {
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState('');
  const save = (kind) => {
    if (value.trim()) onSave(kind, value.trim());
    setEditing(null);
  };
  return (
    <Card>
      <CheckList>
        {lines.map((line) => (
          <li key={line.kind}>
            <span className="label">{line.label}</span>
            {editing === line.kind ? (
              <CheckEdit
                onSubmit={(e) => {
                  e.preventDefault();
                  save(line.kind);
                }}
              >
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  aria-label={line.label}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <button type="submit">{TEXT.CHECK_SAVE}</button>
                <button type="button" className="quiet" onClick={() => setEditing(null)}>{TEXT.CHECK_CANCEL}</button>
              </CheckEdit>
            ) : (
              <>
                <span className="text">{line.text}</span>
                {!spent && (
                  <button
                    type="button"
                    className="edit"
                    aria-label={`${TEXT.CHECK_EDIT} ${line.label}`}
                    onClick={() => {
                      setEditing(line.kind);
                      setValue(line.text);
                    }}
                  >
                    <EditIcon fontSize="inherit" />
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </CheckList>
      {!spent && (
        <ChipRow style={{ marginLeft: 0, marginTop: 14 }}>
          <Chip type="button" $primary disabled={busy || !!editing} onClick={onDone}>
            {TEXT.CHECK_DONE}
          </Chip>
        </ChipRow>
      )}
    </Card>
  );
};

/**
 * ProfileCoach — the conversational profile builder.
 *
 * Replaces both the three-choice-cards page and the seven-step wizard: resume
 * upload and LinkedIn import are now a question inside the conversation
 * rather than a fork in front of it.
 *
 * The ladder, the chip vocabulary and every draft transform live in
 * ./coachLogic.js (plain JS, unit-tested). This file owns React state, the
 * API calls, and nothing else worth testing through a renderer.
 *
 * Two rules shape most of the branching here:
 *
 *  1. Tapping a chip must never cost an AI call. That is what lets a
 *     signed-out visitor walk the whole ladder by tapping.
 *  2. No authenticated request may fire unprompted on this page. It is
 *     guest-reachable, and api.js's 401 interceptor force-redirects to
 *     /login outside the boot grace window, which would silently eject a
 *     guest mid-conversation. Every call below is behind a user action or
 *     an isAuthenticated check.
 */

/* Model-answered asides allowed per conversation. At roughly a tenth of a
   cent each this is about a penny — the point is not the money, it is that an
   endpoint which returns model output to anonymous callers needs a ceiling
   that is not only per-IP. */
const ASIDE_LIMIT = 8;

/* How long a freshly shown row of chips ignores taps. */
// "PDF · 182 KB" under the attached file's name.
const attachmentMeta = (file) => {
  const kind = /pdf$/i.test(file.type) ? 'PDF' : 'Word';
  const kb = file.size / 1024;
  return `${kind} · ${kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`}`;
};

const TAP_GUARD_MS = 600;

let messageSeq = 0;
const nextId = () => { messageSeq += 1; return `m${messageSeq}`; };

/* Restored ids were minted by a previous page load. Continue the sequence
   rather than restart it, or the next message collides with an old one and
   React renders two rows into the same key. */
const resumeIdSequence = (messages = []) => {
  const highest = messages.reduce((top, m) => {
    const n = Number(String(m.id || '').replace(/^m/, ''));
    return Number.isFinite(n) && n > top ? n : top;
  }, 0);
  messageSeq = Math.max(messageSeq, highest);
};

/* The welcome intro that used to be the standalone /onboarding page now runs
   as the first messages of this conversation — see components/
   OnboardingIntro. It plays every time rather than once per browser: this is
   what "Get started" promises, a returning visitor is one tap from skipping
   it, and the one-shot version mostly succeeded at hiding itself from the
   people testing whether it worked. */

const ProfileCoach = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  /* A conversation left in this browser within the last day. Read once, in
     a lazy initialiser, so the first render already has it — restoring in an
     effect would flash the intro at someone who is mid-conversation. */
  const [restored] = useState(() => {
    const saved = loadConversation();
    if (saved) resumeIdSequence(saved.messages);
    return saved;
  });

  /* The saved conversation is offered, never restored behind their back.
     Someone who hard-refreshes usually means it — and a silent resume also
     spends model calls continuing a conversation they were trying to leave. */
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [stepIndex, setStepIndex] = useState(-1);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gateOpen, setGateOpen] = useState(false);
  // Set to a step's aiStep while its clarifying question is outstanding, so
  // the answer completes the row that turn started instead of adding another.
  const [followUpFor, setFollowUpFor] = useState(null);
  // True while one of the review's own follow-up questions is on screen. The
  // review step declares freeText:false — it asks nothing itself — so without
  // this the composer would be disabled exactly when the coach just asked
  // something.
  const [probing, setProbing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [linkedinStatus, setLinkedinStatus] = useState({
    urlImportAvailable: false,
    oauthAvailable: false,
  });

  // Read inside delayed callbacks so a chip tapped during the typing pause
  // still sees the draft the previous answer produced.
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  /* Dictation's accurate pass: the clip goes to a real speech model with
     the person's own words as hints, so their title, companies and skills
     come back spelled the way they are, not the way they sound. */
  const transcribeClip = useCallback(async (blob) => {
    const d = draftRef.current || {};
    const hints = [
      d.title, d.target,
      ...(d.experience || []).flatMap((r) => [r.title, r.company]),
      ...(d.education || []).flatMap((e) => [e.institution, e.degree]),
      ...(d.skills || []).slice(0, 25),
    ].filter(Boolean);
    const text = await profileAPI.coachTranscribe(blob, Array.from(new Set(hints)).join(', '));
    return text;
  }, []);

  const dictation = useDictation({
    onText: setInput,
    onError: (code) => setError(code === 'not-allowed' || code === 'service-not-allowed'
      ? TEXT.DICTATE_DENIED
      : TEXT.DICTATE_FAILED),
    transcribe: transcribeClip,
  });

  const fileInputRef = useRef(null);
  // Read inside askStep, which is declared before the dictation hook's
  // value is worth depending on.
  const dictationSupportedRef = useRef(dictation.supported);
  dictationSupportedRef.current = dictation.supported;
  const listEndRef = useRef(null);
  const composerRef = useRef(null);
  /* Send was pressed while the accurate transcript was on its way. Sent the
     moment it lands, from the box the transcript just filled. */
  const sendWhenTranscribedRef = useRef(false);
  useEffect(() => {
    if (dictation.transcribing || !sendWhenTranscribedRef.current) return;
    sendWhenTranscribedRef.current = false;
    composerRef.current?.form?.requestSubmit();
  }, [dictation.transcribing]);
  /* An error belongs to the question it was about. It used to stay pinned
     above the box through the next question and a whole call. */
  useEffect(() => { setError(''); }, [stepIndex]);
  // The box grows with what is in it (typed or dictated); CSS caps it at
  // about six lines and scrolls past that, keeping the newest words in view.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    if (document.activeElement !== el) el.scrollTop = el.scrollHeight;
  }, [input]);
  // Set for the one render after an in-place message update that must not
  // scroll the transcript (see the scroll effect below).
  const keepScrollRef = useRef(false);
  /* Following the bottom. True while the reader is at the end of the chat;
     false once they scroll up to read, or while a long card is pinned. */
  const listRef = useRef(null);
  const threadRef = useRef(null);
  const stickRef = useRef(true);
  const holdUntilRef = useRef(0);
  /* A card to read from its top: the resume review and the finished resume.
     Scrolling those to their end showed the last line first, and the
     messages after them pulled the card away while it was being read. */
  const anchorIdRef = useRef(null);
  const anchoredRef = useRef(new Set());
  const anchoredAtRef = useRef(0);
  // The talk-or-type offer is made once per conversation, never again.
  const voiceOfferedRef = useRef(false);
  const voiceAvailableRef = useRef(false);
  /* How many asides have been answered by the model in this conversation.
     Each costs a call; a person asks two or three, a script does not stop.
     The cap is high enough that nobody real will meet it. */
  const asidesRef = useRef(0);
  const timersRef = useRef([]);
  // Read inside the turn call, which must not re-create itself per message.
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // askStep dispatches run steps, run steps call advance, and advance calls
  // askStep. Refs are what let those three be defined in a readable order
  // without a circular useCallback dependency.
  const advanceRef = useRef(() => {});
  // askStep offers the call, and offerVoice is declared below it.
  const offerVoiceRef = useRef(() => false);
  const runnersRef = useRef({});

  // Clear pending "typing" timers on unmount — otherwise a fast navigate
  // away leaves a setState firing into an unmounted tree.
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  /* ─── Message helpers ──────────────────────────────────────── */

  const pushCoach = useCallback((text, extra = {}) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'coach', text, at: Date.now(), ...extra }]);
  }, []);

  const pushMine = useCallback((text, extra = {}) => {
    // They acted, so they are done reading whatever was pinned.
    anchorIdRef.current = null;
    stickRef.current = true;
    setMessages((prev) => [...prev, { id: nextId(), role: 'me', text, ...extra }]);
  }, []);

  /* What the coach learned, kept on the account (CareerContext). Only for
     signed-in users; a guest's goes along with their draft and is saved when
     they sign up. Never blocks the conversation. */
  const saveCareerContext = useCallback((d, opts) => {
    if (!isAuthenticated) return;
    const patch = careerContextOf(d);
    if (!Object.keys(patch).length) return;
    careerContextAPI.merge(patch, opts).catch(() => {});
  }, [isAuthenticated]);

  // The record from earlier sessions, so this one does not ask again.
  const savedContextRef = useRef(null);
  useEffect(() => {
    if (!isAuthenticated || restored) return;
    careerContextAPI.get()
      .then(({ data }) => { savedContextRef.current = data?.context || null; })
      .catch(() => {});
  }, [isAuthenticated, restored]);

  // Retire the chip row on a message once it has been answered, so the
  // transcript reads as history rather than as still-live controls.
  const spendChips = useCallback((messageId) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, spent: true } : m)));
  }, []);

  const askStep = useCallback((index, currentDraft) => {
    const step = LADDER[index];
    if (!step) return;

    /* The one moment a call is worth offering.
       Everything above this step is facts — a title, a company, a list of
       skills — and a button is faster and more accurate than speech for
       every one of them. Everything from here down is why: what they want
       next, what is in the way. Those are the questions nobody answers well
       in a text box, and the ones that make a profile sound like a person.
       So the invitation goes here, where there is already someone on the
       other end to be curious about, rather than at the door. */
    if (step.id === VOICE_OFFER_STEP && !voiceOfferedRef.current && voiceAvailableRef.current) {
      voiceOfferedRef.current = true;
      if (offerVoiceRef.current()) return;
    }

    // Steps that do work rather than ask: they announce themselves, then the
    // runner takes over and calls advance when it is done.
    if (step.kind === 'run') {
      pushCoach(questionText(step, currentDraft));
      later(() => {
        const run = runnersRef.current[step.runs];
        if (run) run(index);
        else advanceRef.current(index, currentDraft);
      }, TIMING.ACK_MS);
      return;
    }

    // The closing cards carry their own content. The tour offers a continue
    // chip so the person reads it at their own pace; the sign-up card is the
    // end of the line and waits on its own buttons.
    if (step.kind === 'tour' || step.kind === 'convert') {
      setTyping(true);
      later(() => {
        setTyping(false);
        pushCoach(questionText(step, currentDraft), {
          [step.kind]: true,
          stepId: step.id,
          continues: step.kind === 'tour',
        });
      }, TIMING.TYPING_MS);
      return;
    }

    setTyping(true);
    later(() => {
      setTyping(false);
      pushCoach(questionText(step, currentDraft), {
        hint: hintText(step, currentDraft),
        stepId: step.id,
        // A story is easier said than typed. The browser's own speech input
        // is free and works signed out; the words land in the box to edit.
        chips: step.story && dictationSupportedRef.current
          ? [{ ...SAY_IT_CHIP }]
          : getChips(step, currentDraft),
        multi: step.kind === 'multi',
        selected: [],
        optional: !!step.optional,
      });
    }, TIMING.TYPING_MS);
  }, [later, pushCoach]);

  /**
   * Take back an answer.
   *
   * Everything from that question onward is dropped — the answer, the
   * questions it led to, and the draft fields they filled — and the question
   * is asked again. Anything less is worse than the mistake: change your
   * sector and the job title you picked from the old sector's list is still
   * sitting in your headline.
   */
  const rewindTo = useCallback((message) => {
    const step = LADDER.find((s) => s.id === message.stepId);
    if (!step || !canRewind(step) || busy) return;
    const at = LADDER.findIndex((s) => s.id === step.id);

    setMessages((prev) => {
      const answerAt = prev.findIndex((m) => m.id === message.id);
      if (answerAt < 0) return prev;
      // Back to just before the question was asked, so askStep can ask it
      // cleanly rather than leaving a spent row above a live one.
      let questionAt = answerAt;
      while (questionAt > 0 && prev[questionAt - 1].stepId === step.id) questionAt -= 1;
      return prev.slice(0, questionAt);
    });

    const rewound = draftRewoundTo(draftRef.current, step.id);
    draftRef.current = rewound;
    setDraft(rewound);
    setStepIndex(at);
    setFollowUpFor(null);
    setProbing(false);
    trackEvent('coach_answer_changed', { step: step.id });
    later(() => askStep(at, rewound), TIMING.ACK_MS);
  }, [askStep, busy, later]);


  /* ─── Opening ──────────────────────────────────────────────── */

  /* Straight to the Build card. The three-slide carousel that used to come
     first repeated what the homepage had just said, and the card after it
     repeated slide one. Conversations saved mid-carousel still render it. */
  const startIntro = useCallback(() => {
    pushCoach(INTRO_TEXT.WELCOME);
    pushCoach(INTRO_TEXT.START_BUBBLE, { introBuild: true });
    trackEvent('coach_intro_started', { carousel: false });
  }, [pushCoach]);

  /**
   * Offer the choice before the questions start.
   *
   * Asked rather than assumed, and asked once: most people will type, and a
   * voice invitation that keeps reappearing is a product nagging someone to
   * spend its money. Signed-in only — a minute of talking costs about what a
   * hundred typed turns do.
   */
  const offerVoice = useCallback(() => {
    if (!voiceAvailableRef.current) return false;
    pushCoach(TEXT.VOICE_OFFER, {
      stepId: VOICE_CHOICE,
      chips: [
        { id: 'talk', label: TEXT.VOICE_START },
        { id: 'type', label: TEXT.VOICE_KEEP_TYPING },
      ],
      selected: [],
    });
    return true;
  }, [isAuthenticated, pushCoach]);

  useEffect(() => { offerVoiceRef.current = offerVoice; }, [offerVoice]);

  /** Take up the offer, or decline it and start over. */
  const answerResumeOffer = useCallback((message, choice) => {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, spent: true } : m)));
    if (choice === 'resume' && restored) {
      draftRef.current = restored.draft;
      setDraft(restored.draft);
      setStepIndex(restored.stepIndex);
      setMessages([...restored.messages, {
        id: nextId(), role: 'coach', text: TEXT.RESUMED, ephemeral: true,
      }]);
      trackEvent('coach_resumed', {});
      return;
    }
    clearConversation();
    setMessages([]);
    setDraft(emptyDraft());
    setStepIndex(-1);
    draftRef.current = emptyDraft();
    trackEvent('coach_restarted', {});
    later(startIntro, TIMING.ACK_MS);
  }, [later, restored, startIntro]);

  /** Greet and ask the first ladder question — where every path through the
      intro (finished, skipped from a slide, skipped from the top bar) ends. */
  /** Begin the questions at the first thing still missing. */
  /* The call is not offered here any more.
     It used to come before the first question, on the theory that the point
     of talking is to skip the typing. That theory was wrong in practice: a
     cold call has nothing to react to, so it opens by reading the form out
     loud — "what is your job title" — which is the one thing a call is worse
     at than a button. It is now offered at the `target` step, once there is
     a person on the other end to be curious about. */
  const startLadderFrom = useCallback((draft0, { silent = false, from = 'intro', ask = true } = {}) => {
    draftRef.current = draft0;
    setDraft(draft0);
    const at = Math.max(0, nextStepIndex(-1, draft0));
    setStepIndex(at);
    if (!silent) pushCoach(TEXT.GREETING, { hint: TEXT.GREETING_SUB });
    if (ask) askStep(at, draft0);
    /* ask: false leaves the ladder parked on the next gap without asking it,
       for a caller that has something to put on screen first — after a call,
       that is the upload offer. Whatever answers it picks up from here. */
    trackEvent('coach_started', { intro: from, resumedAt: LADDER[at]?.id });
  }, [askStep, later, offerVoice, pushCoach]);

  const startLadder = useCallback(
    (from, seed = null) => startLadderFrom(
      seedFromCareerContext({ ...emptyDraft(), ...(seed || {}) }, savedContextRef.current || {}),
      { from }
    ),
    [startLadderFrom]
  );

  useEffect(() => {
    if (restored) {
      pushCoach(TEXT.RESUME_OFFER, {
        ephemeral: true,
        stepId: RESUME_CHOICE,
        chips: [
          { id: 'resume', label: TEXT.RESUME_CHIP },
          { id: 'fresh', label: TEXT.FRESH_CHIP },
        ],
        selected: [],
      });
      trackEvent('coach_resume_offered', { atStep: LADDER[restored.stepIndex]?.id || 'intro' });
      return;
    }
    startIntro();
    // Intentionally once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Every answer, straight to storage. Cheap — a transcript is a few
     kilobytes of plain objects — and it is the difference between a dropped
     connection costing someone a moment and costing them the whole thing. */
  useEffect(() => {
    if (!messages.length) return;
    saveConversation({ draft, stepIndex, messages });
  }, [draft, stepIndex, messages]);

  /* ─── The intro ────────────────────────────────────────────── */

  const showBuildCard = useCallback(() => {
    setTyping(true);
    later(() => {
      setTyping(false);
      pushCoach(INTRO_TEXT.START_BUBBLE, { introBuild: true });
    }, TIMING.ACK_MS);
  }, [later, pushCoach]);

  /* The carousel advances inside its own message rather than posting a new
     one. Three stacked slide cards read as a wall, not a conversation. */
  const setSlide = useCallback((message, next) => {
    keepScrollRef.current = true;
    setMessages((prev) => prev.map(
      (m) => (m.id === message.id ? { ...m, introSlide: next } : m)
    ));
  }, []);

  /** The intro is over: drop the carousel and offer the build card. */
  const closeIntro = useCallback((messageId) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    showBuildCard();
  }, [showBuildCard]);

  const introContinue = useCallback((message) => {
    const next = message.introSlide + 1;
    if (next < SLIDES.length) {
      setSlide(message, next);
      trackEvent('coach_intro_slide', { slide: next + 1 });
      return;
    }
    closeIntro(message.id);
  }, [closeIntro, setSlide]);

  const introJump = useCallback((message, to) => {
    if (to === message.introSlide) return;
    setSlide(message, to);
  }, [setSlide]);

  const introSkip = useCallback((message) => {
    trackEvent('coach_intro_skipped', { at: message.introSlide + 1 });
    closeIntro(message.id);
  }, [closeIntro]);

  const introStart = useCallback((message) => {
    if (message.spent) return;
    spendChips(message.id);
    pushMine(INTRO_TEXT.BUILD_BUTTON);
    startLadder('completed');
  }, [pushMine, spendChips, startLadder]);


  useEffect(() => {
    // Advancing the intro carousel changes a message in place. Scrolling to
    // the bottom there would drag the card the person is reading out from
    // under them, so that one update opts out.
    if (keepScrollRef.current) {
      keepScrollRef.current = false;
      holdUntilRef.current = Date.now() + 400;
      return;
    }
    const card = [...messages].reverse().find((m) => (m.review || m.resume) && !anchoredRef.current.has(m.id));
    if (card) {
      anchoredRef.current.add(card.id);
      anchorIdRef.current = card.id;
      anchoredAtRef.current = Date.now();
      stickRef.current = false;
      listRef.current?.querySelector(`[data-mid="${card.id}"]`)?.scrollIntoView({ block: 'start' });
      return;
    }
    if (anchorIdRef.current) return;
    listEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, typing]);

  /* Content that grows after the scroll (chips fading in, the Continue
     button appearing, a card laying out) used to end up under the text box
     on a phone. While following the bottom, follow it as it grows. */
  useEffect(() => {
    const list = listRef.current;
    const thread = threadRef.current;
    if (!list || !thread) return undefined;
    const onScroll = () => {
      const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
      // The list scrolls smoothly: its first events on the way up to a
      // pinned card still read as the bottom, and must not unpin it.
      if (atBottom && Date.now() - anchoredAtRef.current > 1000) anchorIdRef.current = null;
      stickRef.current = atBottom && !anchorIdRef.current;
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      if (!stickRef.current || anchorIdRef.current || Date.now() < holdUntilRef.current) return;
      list.scrollTop = list.scrollHeight;
    }) : null;
    observer?.observe(thread);
    return () => {
      list.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, []);

  // Server config booleans only — public endpoint, safe for guests. (It used
  // to require auth; calling it unconditionally back then is exactly what
  // tripped the 401 interceptor and bounced guests to /login.)
  useEffect(() => {
    let cancelled = false;
    profileAPI.getLinkedInImportStatus()
      .then(({ data }) => {
        if (cancelled) return;
        setLinkedinStatus({
          urlImportAvailable: !!data?.urlImportAvailable,
          oauthAvailable: !!data?.oauthAvailable,
        });
      })
      .catch(() => {
        // Fail closed: the modal then shows its PDF path, which always works.
        if (!cancelled) setLinkedinStatus({ urlImportAvailable: false, oauthAvailable: false });
      });
    return () => { cancelled = true; };
  }, []);

  /* ─── Advancing ────────────────────────────────────────────── */

  const finish = useCallback(async (finalDraft) => {
    setBusy(true);
    let withSummary = finalDraft;

    // The summary is the one thing the conversation can't collect by asking,
    // and it is the first thing a recruiter reads. Guests get it too: the
    // endpoint is public and metered by IP exactly like the interpret, bullets
    // and target calls they have already made by this point, so withholding it
    // only produced emptier profiles for the people who had not committed yet.
    try {
      const { data } = await profileAPI.coachSummary(finalDraft);
      if (data?.summary) withSummary = { ...finalDraft, summary: data.summary };
    } catch {
      // A missing summary is not worth blocking the handoff over.
    }

    setBusy(false);
    trackEvent('coach_completed', {
      authenticated: !!isAuthenticated,
      imported: withSummary.importedFrom || 'none',
    });

    const resumeData = draftToResumeData(withSummary);
    // The draft now lives somewhere better. Leaving the transcript behind
    // would restore a finished conversation over a fresh one.
    clearConversation();
    if (!isAuthenticated) saveGuestProfileDraft(resumeData, { careerContext: careerContextOf(withSummary) });
    else saveCareerContext(withSummary);
    navigate(ROUTES.CREATE_FORM, { state: { source: 'coach', resumeData } });
  }, [isAuthenticated, navigate, saveCareerContext]);

  const advance = useCallback((fromIndex, nextDraft) => {
    const next = nextStepIndex(fromIndex, nextDraft);
    // The ladder now ends on the sign-up card, which waits for a click. There
    // is nothing to navigate to on its own — leaving the person on the
    // finished profile they just watched being built is the point.
    if (next === -1) {
      setStepIndex(-1);
      return;
    }
    setStepIndex(next);
    askStep(next, nextDraft);
  }, [askStep]);

  useEffect(() => { advanceRef.current = advance; }, [advance]);

  const commit = useCallback((patch, fromIndex) => {
    setFollowUpFor(null);
    const nextDraft = { ...draftRef.current, ...patch };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    advance(fromIndex, nextDraft);
  }, [advance]);

  /* ─── Imports ──────────────────────────────────────────────── */

  const applyImport = useCallback((parsed, source) => {
    setMessages((prev) => prev.map((m) => (m.stepId === 'importOffer' ? { ...m, spent: true } : m)));
    const nextDraft = seedFromImport(draftRef.current, parsed, source);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    trackEvent('coach_import', { source });
    pushCoach(source === 'linkedin' ? TEXT.LINKEDIN_DONE : TEXT.UPLOAD_DONE);
    // Whatever the import filled, isAlreadyAnswered() skips — so this lands
    // on the first genuine gap rather than re-asking what we just read.
    advance(LADDER.findIndex((s) => s.id === 'importOffer'), nextDraft);
  }, [advance, pushCoach]);

  /**
   * Put the way forward at the bottom of the conversation.
   *
   * The import chips stayed live after a refused file, but by then the
   * transcript had grown a progress card and two messages, so the only way
   * out was to scroll back up and find them. A chat that has just told you
   * no has to say what to do next in the same breath, at the end, where you
   * are already looking.
   */
  const offerImportAgain = useCallback((text, choices = RETRY_IMPORT_CHOICES, { postCall = false } = {}) => {
    setMessages((prev) => [
      // Retire the older row so there is exactly one live set of these.
      ...prev.map((m) => (m.stepId === 'importOffer' ? { ...m, spent: true } : m)),
      {
        id: nextId(),
        role: 'coach',
        text,
        stepId: 'importOffer',
        postCall,
        chips: choices.map((c) => ({ ...c })),
        selected: [],
      },
    ]);
  }, []);

  /* Takes the picker's change event, or a File that was dropped on the chat
     or pasted into the box: every way in ends up in the same reader. */
  const handleFile = useCallback(async (eventOrFile) => {
    filePickPendingRef.current = false;
    let file = eventOrFile;
    if (eventOrFile?.target) {
      file = eventOrFile.target.files?.[0];
      eventOrFile.target.value = '';
    }
    if (!file) return;

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError(TEXT.ERROR_FILE_TYPE);
      return;
    }
    if (file.size > VALIDATION.MAX_FILE_SIZE) {
      setError(TEXT.ERROR_FILE_SIZE);
      return;
    }

    setError('');
    setBusy(true);

    // Their side of the exchange is the file itself, then a card that narrates
    // the parse. A typing indicator alone reads as a stalled page on a wait
    // this long, which is what had people re-clicking upload.
    pushMine(file.name);
    const progressId = nextId();
    setMessages((prev) => [...prev, {
      id: progressId, role: 'coach', text: '', uploading: true, fileName: file.name,
    }]);
    const finishProgress = (ok) => setMessages((prev) => prev.map(
      (m) => (m.id === progressId ? { ...m, uploadDone: ok, uploadFailed: !ok } : m)
    ));

    try {
      const formData = new FormData();
      formData.append('resume', file);
      // Parsing is free either way; the guest endpoint just skips the
      // Authorization header so a stale token can't 401 the upload.
      const { data } = isAuthenticated
        ? await profileAPI.uploadResume(formData)
        : await profileAPI.guestUploadResume(formData);

      const ok = !!(data?.success && data?.data);
      finishProgress(ok);
      if (ok) applyImport(data.data, 'resume');
      else offerImportAgain(TEXT.UPLOAD_FAILED);
    } catch (err) {
      finishProgress(false);
      // The server can tell a file that is not a resume from a parse that
      // failed. Saying "I could not read that file" about a contract we read
      // perfectly well is both wrong and unhelpable.
      // The server can tell a file that is not a resume from a scan or a
      // locked PDF; each gets the sentence that is actually true.
      const said = {
        not_a_resume: err?.userMessage,
        pdf_no_text: TEXT.UPLOAD_NO_TEXT,
        pdf_password: TEXT.UPLOAD_PASSWORD,
      }[err?.code];
      offerImportAgain(said || TEXT.UPLOAD_FAILED);
    } finally {
      setBusy(false);
    }
  }, [applyImport, isAuthenticated, offerImportAgain, pushMine]);

  /* ─── Run steps: the coach does work and reports back ──────── */

  // Queue of the coach's own follow-up questions, drained one at a time after
  // the review. Kept in a ref because the drain happens inside timers that
  // would otherwise close over a stale array.
  const probeQueueRef = useRef([]);

  /**
   * Ask the next probe the review produced, or move on when they run out.
   * Probes are answered like any other free-text step, but they route through
   * the 'probe' schema, which takes whatever the answer evidences — a bullet,
   * a tool, or nothing.
   */
  const nextProbe = useCallback((fromIndex) => {
    const question = probeQueueRef.current.shift();
    if (!question) {
      setProbing(false);
      advanceRef.current(fromIndex, draftRef.current);
      return;
    }
    setTyping(true);
    later(() => {
      setTyping(false);
      setProbing(true);
      pushCoach(question, { stepId: 'review', probe: true });
    }, TIMING.TYPING_MS);
  }, [later, pushCoach]);

  const runReview = useCallback(async (index) => {
    setBusy(true);
    setTyping(true);
    try {
      const { data } = await profileAPI.coachReview({
        profile: draftToProfileShape(draftRef.current),
        sector: draftRef.current.sector,
      });
      const review = data?.review;
      setTyping(false);
      setBusy(false);
      if (!review) throw new Error('empty review');

      const nextDraft = { ...draftRef.current, review };
      draftRef.current = nextDraft;
      setDraft(nextDraft);

      /* A review with nothing in it says nothing: no "Got it." bubble over
         an empty card. */
      const hasFindings = !!(review.working?.length || review.fix?.length);
      if (review.opening || hasFindings) {
        pushCoach(review.opening || '', hasFindings ? { review } : {});
      }
      probeQueueRef.current = (review.probes || []).slice(0, 2);

      /* Voice on this server: talk the review through. The
         gaps it found and the questions a resume cannot answer (what next,
         why, what is in the way) go on the call's agenda. Declining runs the
         same follow-ups as typed questions. */
      if (voiceAvailableRef.current && !voiceOfferedRef.current) {
        voiceOfferedRef.current = true;
        later(() => pushCoach(TEXT.VOICE_OFFER_REVIEW, {
          stepId: VOICE_CHOICE,
          afterReview: index,
          chips: [
            { id: 'talk', label: TEXT.VOICE_START },
            { id: 'type', label: TEXT.VOICE_KEEP_TYPING },
          ],
          selected: [],
        }), TIMING.ACK_MS);
        return;
      }

      if (probeQueueRef.current.length) {
        later(() => pushCoach(COACH_TEXT.REVIEW_PROBE_INTRO), TIMING.ACK_MS);
        later(() => nextProbe(index), TIMING.ACK_MS + TIMING.TYPING_MS);
      } else {
        advanceRef.current(index, nextDraft);
      }
    } catch {
      setTyping(false);
      setBusy(false);
      // A failed review must not strand someone mid-conversation — the rest
      // of the build still works without it. Counted, though: a silent
      // failure nobody counts is an outage nobody notices.
      trackEvent('coach_step_failed', { step: 'review' });
      advanceRef.current(index, draftRef.current);
    }
  }, [isAuthenticated, later, nextProbe, pushCoach]);

  const runAssess = useCallback(async (index) => {
    setBusy(true);
    setTyping(true);
    try {
      const { data } = await profileAPI.coachTarget({
        profile: draftToProfileShape(draftRef.current),
        target: draftRef.current.target,
        location: draftRef.current.location,
        // Decides whether "nearby" means their city, remote postings, or both.
        workStyle: draftRef.current.workStyle,
        // Why they want it and what they think is stopping them, in their
        // own words. The whole point of having asked.
        motivation: draftRef.current.targetWhy,
        blocker: draftRef.current.targetBlocker,
      });
      const assessment = data?.assessment;
      setTyping(false);
      setBusy(false);
      if (!assessment) throw new Error('empty assessment');

      const nextDraft = { ...draftRef.current, assessment };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      pushCoach(assessment.headline || '', { assessment });
      saveCareerContext(nextDraft);
      advanceRef.current(index, nextDraft);
    } catch {
      setTyping(false);
      setBusy(false);
      trackEvent('coach_step_failed', { step: 'assess' });
      advanceRef.current(index, draftRef.current);
    }
  }, [pushCoach, saveCareerContext]);

  const runBuild = useCallback(async (index) => {
    setBusy(true);
    setTyping(true);
    let built = draftRef.current;

    // The summary is the last thing written, so it can draw on everything the
    // conversation surfaced rather than only what was known at the start.
    if (!built.summary) {
      try {
        const { data } = await profileAPI.coachSummary(built);
        if (data?.summary) built = { ...built, summary: data.summary };
      } catch {
        // A profile without a summary is still a profile.
      }
    }

    draftRef.current = built;
    setDraft(built);
    setTyping(false);
    setBusy(false);

    const ready = isPresentable(built);
    pushCoach(ready ? COACH_TEXT.BUILD_DONE : COACH_TEXT.BUILD_INCOMPLETE, { resume: built });
    trackEvent('coach_profile_built', { presentable: ready, imported: built.importedFrom || 'none' });
    advanceRef.current(index, built);
  }, [pushCoach]);

  useEffect(() => {
    runnersRef.current = { review: runReview, assess: runAssess, build: runBuild };
  }, [runReview, runAssess, runBuild]);

  /* ─── Answering ────────────────────────────────────────────── */

  /* ─── Talking instead of typing ────────────────────────────── */

  const [lastSpoken, setLastSpoken] = useState(null);
  /* Whether this deployment can do voice. Asked once, publicly, before the
     choice is ever offered — an environment with no OpenAI key shows no
     voice option rather than one that fails on tap, and starts showing it
     the moment the key is set. */

  /* Whether a call can be placed right now, for this visitor: voice is set
     up on the server AND they have a call left (guests: one a day). The
     offers only appear when this is true, so nobody is offered a call that
     ends in a sign-up message. Re-checked after every call. */
  const refreshVoiceStatus = useCallback(() => {
    profileAPI.coachVoiceStatus()
      .then(({ data }) => { voiceAvailableRef.current = !!data?.available && data?.canCall !== false; })
      .catch(() => { voiceAvailableRef.current = false; });
  }, []);

  useEffect(() => { refreshVoiceStatus(); }, [isAuthenticated, refreshVoiceStatus]);

  /* What was said goes into the transcript as it happens. The chat is the
     record of the conversation whichever way it was held, and after the call
     ends it is the only record — so it has to be the same messages, not a
     summary of them. */
  const onTranscript = useCallback((line) => {
    setLastSpoken(line);
    setMessages((prev) => {
      /* A transcript is final per utterance, not per turn: somebody who
         pauses in the middle of a thought produces two of them, and a
         greeting once arrived as four bubbles broken at its own commas.
         Consecutive lines from the same speaker are one thing said, so they
         join into one bubble. Roles alternate, so this never glues two
         people together. */
      const last = prev[prev.length - 1];
      /* Only the person's lines are joined: their pauses split one thought
         into several transcripts. Remi's arrive one whole reply at a time,
         and joining them glued an interrupted reply to the next one into a
         single bubble that repeated itself. */
      if (last?.spoken && last.role === line.role && line.role === 'me') {
        const joined = `${last.text} ${line.text}`.replace(/\s+/g, ' ').trim();
        return [...prev.slice(0, -1), { ...last, text: joined }];
      }
      return [...prev, { id: nextId(), role: line.role, text: line.text, spoken: true }];
    });
  }, []);

  /* What the call hears, as it hears it.
     The model calls a tool the moment it learns something, and because the
     browser holds the call that arrives here directly — the draft fills in
     behind the orb while the person is still talking. The old arrangement
     could not do this: the model ran on a server somewhere and the browser
     found out what had been said only after hanging up. */
  const heardAnythingRef = useRef(false);
  // The plan's time limit for the call in progress; cleared when it ends.
  const callCapTimerRef = useRef(null);
  useEffect(() => () => { if (callCapTimerRef.current) clearTimeout(callCapTimerRef.current); }, []);
  // Which facts the call produced, so only those are checked afterwards.
  const heardKeysRef = useRef(new Set());

  const onLearned = useCallback((fields) => {
    const clean = Object.fromEntries(
      Object.entries(fields || {}).filter(([, v]) => v !== null && v !== undefined && v !== '')
    );
    if (!Object.keys(clean).length) return;
    heardAnythingRef.current = true;
    Object.keys(clean).forEach((k) => heardKeysRef.current.add(k));
    const merged = applyBraindump(draftRef.current, clean);
    if (clean.target && !merged.target) merged.target = String(clean.target);
    draftRef.current = merged;
    setDraft(merged);
  }, []);

  /* Park the ladder on the first gap, then make the handover Remi promised
     out loud: a file is the one thing a phone call cannot collect, so it is
     the first thing the screen asks for. Whichever chip they pick, the
     questions pick up from the gap underneath. */
  const afterCall = useCallback((merged) => {
    // They already gave us a document; offering one again would be absurd.
    if (merged.importedFrom) {
      startLadderFrom(merged, { silent: true, from: 'voice' });
      return;
    }
    startLadderFrom(merged, { silent: true, from: 'voice', ask: false });
    later(
      () => offerImportAgain(TEXT.VOICE_HANDOVER, POST_CALL_IMPORT_CHOICES, { postCall: true }),
      TIMING.ACK_MS
    );
  }, [later, offerImportAgain, startLadderFrom]);

  /**
   * The call is over. Everything it heard is already in the draft, so this
   * only has to decide what the screen says next.
   */
  const onCallEnded = useCallback(() => {
    setLastSpoken(null);
    if (callCapTimerRef.current) {
      clearTimeout(callCapTimerRef.current);
      callCapTimerRef.current = null;
    }
    refreshVoiceStatus();
    /* The call kept as a few sentences on their record; the transcript is
       sent to be summarised and is not stored. Signed-in only: guests
       cannot place a call. */
    const spoken = messagesRef.current.filter((m) => m.spoken && m.text)
      .map((m) => ({ role: m.role, text: m.text }));
    if (isAuthenticated && spoken.length >= 2) {
      careerContextAPI.summarizeCall(spoken).catch(() => {});
      saveCareerContext(draftRef.current);
    }
    /* "Cut off before I caught anything" is only true when they never
       spoke. A real conversation that saved no profile facts (talking about
       goals, or why jobs were short) still happened, and saying otherwise
       read as the call having failed. */
    const theySpoke = spoken.some((l) => l.role === 'me');
    if (!heardAnythingRef.current && theySpoke) {
      heardKeysRef.current = new Set();
      pushCoach(TEXT.VOICE_DONE_TALK);
      afterCall(draftRef.current);
      return;
    }
    if (!heardAnythingRef.current) {
      pushCoach(TEXT.VOICE_NOTHING);
      later(() => startLadderFrom(draftRef.current, { silent: true, from: 'voice' }), TIMING.ACK_MS);
      return;
    }
    heardAnythingRef.current = false;
    const heard = Array.from(heardKeysRef.current);
    heardKeysRef.current = new Set();
    const merged = draftRef.current;
    pushCoach(TEXT.VOICE_DONE);
    trackEvent('coach_voice_completed', { fields: heard.length });
    /* Names and dates are what speech gets wrong, and on a resume they are
       the mistakes that matter. The facts the call heard are shown once,
       each fixable in place, before the conversation moves on. */
    if (checkLines(merged, heard).length) {
      later(() => pushCoach(TEXT.CHECK_TITLE, { checkKeys: heard }), TIMING.ACK_MS);
      return;
    }
    afterCall(merged);
  }, [afterCall, isAuthenticated, later, pushCoach, refreshVoiceStatus, saveCareerContext]);

  const saveCheckEdit = useCallback((kind, text) => {
    const next = applyCheckEdit(draftRef.current, kind, text);
    draftRef.current = next;
    setDraft(next);
    trackEvent('coach_check_fixed', { kind });
  }, []);

  const finishCheck = useCallback((message) => {
    if (message.spent) return;
    spendChips(message.id);
    pushMine(TEXT.CHECK_DONE);
    afterCall(draftRef.current);
  }, [afterCall, pushMine, spendChips]);

  const onVoiceError = useCallback((kind) => {
    pushCoach(kind === 'mic-denied' ? TEXT.VOICE_MIC_DENIED : TEXT.VOICE_FAILED);
  }, [pushCoach]);

  const voice = useVoiceCall({
    onTranscript,
    onLearned,
    onEnded: onCallEnded,
    onError: onVoiceError,
  });

  /** Take the offer: create this person's voice coach, then open the session. */
  /**
   * Take the offer. Returns false when the call did not start, so the caller
   * can carry on with the questions instead of leaving someone looking at an
   * explanation with nothing to do next.
   */
  /* Guests get one free call a day (five minutes). Past that, the way on is
     an account, offered with the buttons to make one: the conversation is
     saved in this browser, so signing in and coming back resumes it. */
  const offerAccountForVoice = useCallback((text) => {
    pushCoach(text || TEXT.VOICE_SIGNED_OUT, {
      stepId: VOICE_SIGNIN_CHOICE,
      chips: [
        { id: 'register', label: TEXT.VOICE_REGISTER },
        { id: 'signin', label: TEXT.VOICE_SIGNIN },
        { id: 'type', label: TEXT.VOICE_KEEP_TYPING },
      ],
      selected: [],
    });
  }, [pushCoach]);

  const startTalking = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      /* What they have already told us goes with the request, so the call
         does not open by asking for something they typed two minutes ago. */
      const { data } = await profileAPI.coachVoiceSession(
        draftRef.current,
        voiceAgenda(draftRef.current)
      );
      if (!data?.clientSecret || !data?.model) {
        pushCoach(TEXT.VOICE_FAILED);
        return false;
      }
      await voice.start({ clientSecret: data.clientSecret, model: data.model });
      /* The plan's allowance for this call. The server counts it when the
         call starts; ending it here is what makes the count true. */
      if (data.maxSessionMinutes > 0) {
        // Cancelled when the call ends (onCallEnded): a timer left running
        // stopped the NEXT state of the page minutes later.
        if (callCapTimerRef.current) clearTimeout(callCapTimerRef.current);
        callCapTimerRef.current = setTimeout(() => voice.stop(), data.maxSessionMinutes * 60 * 1000);
      }
      trackEvent('coach_voice_started', { guest: !isAuthenticated, maxMinutes: data.maxSessionMinutes || null });
      return true;
    } catch (err) {
      // Out of voice allowance: the server's sentence says which and why.
      if (err?.response?.status === 429) {
        trackEvent('coach_voice_blocked', { reason: err.response.data?.code || 'limit', guest: !isAuthenticated });
        if (!isAuthenticated) offerAccountForVoice(err.response.data?.message);
        else pushCoach(err.response.data?.message || TEXT.VOICE_FAILED);
        return false;
      }
      // Includes the 503 when voice is not configured on the server. Any
      // detail the server passed through is shown rather than swallowed —
      // the first failure should say what went wrong, not just that it did.
      const detail = err?.response?.data?.detail;
      pushCoach(detail ? `${TEXT.VOICE_FAILED} (${detail})` : TEXT.VOICE_FAILED);
      return false;
    } finally {
      setBusy(false);
    }
  }, [isAuthenticated, later, offerAccountForVoice, pushCoach, voice]);

  /* ─── The file picker, and walking away from it ────────────── */

  /* A cancelled file dialog left the conversation waiting on a file that was
     never coming, with the text box disabled under it. The input's own
     cancel event is not wired up by React and is missing in older browsers,
     so a cancel is also read off the page getting focus back with no file
     chosen. Whichever notices first puts the options back; the ref makes
     sure only one of them does. */
  const filePickPendingRef = useRef(false);

  const filePickCancelled = useCallback(() => {
    if (!filePickPendingRef.current) return;
    filePickPendingRef.current = false;
    trackEvent('coach_upload_cancelled', {});
    offerImportAgain(TEXT.UPLOAD_CANCELLED);
  }, [offerImportAgain]);

  /* `attach`: the + in the text box. The file waits in the box until Send,
     and closing the dialog without one is not a refused upload. */
  const attachModeRef = useRef(false);
  const openFilePicker = useCallback(({ attach = false } = {}) => {
    const input = fileInputRef.current;
    if (!input) return;
    attachModeRef.current = attach;
    if (attach) {
      input.click();
      return;
    }
    filePickPendingRef.current = true;
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      // A chosen file's change event lands just after focus returns.
      later(filePickCancelled, 1000);
    };
    window.addEventListener('focus', onFocus);
    input.click();
  }, [filePickCancelled, later]);

  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return undefined;
    input.addEventListener('cancel', filePickCancelled);
    return () => input.removeEventListener('cancel', filePickCancelled);
  }, [filePickCancelled]);

  /* Drag a resume anywhere onto the chat. Without this, Chrome's default for
     a dropped PDF is to open it in place of the page, and the conversation
     was gone. Outside a call and between turns only, like the paperclip. */
  const [dragging, setDragging] = useState(false);
  /* A file attached to the message being written, like any chat app: it
     shows as a card in the box, can be removed, and goes on Send. */
  const [attached, setAttached] = useState(null);
  const attachFile = useCallback((dropped) => {
    if (!dropped) return;
    /* A dragged file often arrives with no type at all (it depends on the
       app it came from), so a real PDF was refused. Go by the extension
       when the type is missing, and label the file so the server takes it. */
    const byName = { pdf: 'application/pdf', docx: ALLOWED_FILE_TYPES[1], doc: 'application/msword' }[
      String(dropped.name || '').split('.').pop().toLowerCase()
    ];
    const file = !dropped.type && byName ? new File([dropped], dropped.name, { type: byName }) : dropped;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError(TEXT.ERROR_FILE_TYPE);
      return;
    }
    if (file.size > VALIDATION.MAX_FILE_SIZE) {
      setError(TEXT.ERROR_FILE_SIZE);
      return;
    }
    setError('');
    setAttached(file);
    composerRef.current?.focus({ preventScroll: true });
  }, []);
  const dragDepthRef = useRef(0);
  const canAttach = !busy && voice.state === VOICE_STATES.idle;
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');

  useEffect(() => {
    // Dropped just outside the chat column: still never navigate away.
    const block = (e) => { if (hasFiles(e)) e.preventDefault(); };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  const dropHandlers = {
    onDragEnter: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      if (canAttach) setDragging(true);
    },
    onDragOver: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = canAttach ? 'copy' : 'none';
    },
    onDragLeave: (e) => {
      if (!hasFiles(e)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (!dragDepthRef.current) setDragging(false);
    },
    onDrop: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && canAttach) attachFile(file);
    },
  };

  const answerChip = useCallback((message, chip) => {
    // Resuming is a question about the conversation, not one inside it, so it
    // resolves before any ladder lookup.
    if (message.stepId === VOICE_SIGNIN_CHOICE) {
      if (message.spent) return;
      pushMine(chip.label);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, spent: true } : m)));
      if (chip.id === 'register' || chip.id === 'signin') {
        trackEvent('coach_voice_signin_clicked', { via: chip.id });
        // ?redirect brings them back here, where the saved conversation is
        // waiting to be picked up.
        navigate(`${chip.id === 'register' ? ROUTES.REGISTER : ROUTES.LOGIN}?redirect=/profile/create`);
        return;
      }
      later(() => askStep(stepIndex, draftRef.current), TIMING.ACK_MS);
      return;
    }
    if (message.stepId === VOICE_CHOICE) {
      if (message.spent) return;
      pushMine(chip.label);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, spent: true } : m)));
      /* Offered after an import's review: typing means the review's
         follow-ups as questions, exactly as without the offer. Otherwise the
         question the offer interrupted is asked. */
      const reviewAt = message.afterReview;
      const carryOn = () => {
        if (reviewAt == null) {
          later(() => askStep(stepIndex, draftRef.current), TIMING.ACK_MS);
        } else if (probeQueueRef.current.length) {
          later(() => pushCoach(COACH_TEXT.REVIEW_PROBE_INTRO), TIMING.ACK_MS);
          later(() => nextProbe(reviewAt), TIMING.ACK_MS + TIMING.TYPING_MS);
        } else {
          later(() => advanceRef.current(reviewAt, draftRef.current), TIMING.ACK_MS);
        }
      };
      if (chip.id === 'talk') {
        startTalking().then((started) => {
          // The call covers the review's follow-ups; they are not asked again.
          if (started) probeQueueRef.current = [];
          /* Declined or misconfigured: the questions carry on. Signed out is
             the exception: that path puts its own choice on screen, and
             asking the next question underneath it would bury it. */
          else carryOn();
        });
      } else {
        carryOn();
      }
      return;
    }
    if (message.stepId === RESUME_CHOICE) {
      if (message.spent) return;
      pushMine(chip.label);
      answerResumeOffer(message, chip.id);
      return;
    }
    const step = LADDER.find((s) => s.id === message.stepId);
    if (!step || message.spent || busy) return;
    const index = LADDER.findIndex((s) => s.id === step.id);

    // "Type my own" is not an answer either — it hands over the keyboard.
    // The chips stay live: someone who opens the keyboard and then spots the
    // title they wanted must still be able to tap it.
    if (chip.id === CUSTOM_ANSWER_CHIP.id) {
      composerRef.current?.focus();
      trackEvent('coach_custom_answer_opened', { step: step.id });
      return;
    }

    // Starts the mic. Not an answer: what they say lands in the box, and
    // sending it is the answer.
    if (chip.id === SAY_IT_CHIP.id) {
      setError('');
      if (!dictation.listening) dictation.start(input);
      composerRef.current?.focus();
      trackEvent('coach_say_it', { step: step.id });
      return;
    }

    // "More fields" is not an answer: it reveals the rest of the sectors on
    // the question already asked, so nothing is spent and nothing advances.
    if (chip.id === MORE_SECTORS_CHIP.id) {
      keepScrollRef.current = true;
      setMessages((prev) => prev.map(
        (m) => (m.id === message.id ? { ...m, chips: sectorChips(true) } : m)
      ));
      trackEvent('coach_sectors_expanded', {});
      return;
    }

    /* Multi-select: a tap picks, a second tap (or its ×) un-picks, and
       Done under the row sends the picks, in the order they were tapped. */
    if (step.kind === 'multi') {
      const has = message.selected.includes(chip.id);
      const selected = has ? message.selected.filter((s) => s !== chip.id) : [...message.selected, chip.id];
      // Not held still: the first pick adds Continue under the row, and it
      // has to come into view.
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, selected } : m)));
      return;
    }

    pushMine(chip.label, { stepId: step.id });

    if (step.id === 'importOffer') {
      // Deliberately NOT spent here. The file dialog can be dismissed and the
      // LinkedIn modal closed, and neither fires anything we can rely on
      // everywhere — leaving these chips live means the conversation always
      // has a way forward. applyImport() retires them once one succeeds.
      if (chip.id === 'resume') {
        pushCoach(TEXT.UPLOAD_PROMPT);
        openFilePicker();
        return;
      }
      if (chip.id === 'linkedin') {
        pushCoach(TEXT.LINKEDIN_PROMPT);
        setLinkedinOpen(true);
        return;
      }
      spendChips(message.id);
      /* The upload offer after a call is a detour, not a rung.
         `index` is where importOffer sits in the ladder — near the top — so
         advancing from it walks the whole thing again from there. It skips
         what the draft already answers, but anything it does not recognise
         gets asked a second time, which is how somebody who had already
         picked full-time got asked about full-time after talking for two
         minutes. Resume where the conversation actually is. */
      if (message.postCall) askStep(stepIndex, draftRef.current);
      else advance(index, draftRef.current);
      return;
    }

    spendChips(message.id);
    commit(step.assign ? { [step.assign]: chip.id } : {}, index);
  }, [advance, answerResumeOffer, askStep, busy, commit, dictation, input, later, navigate, nextProbe, openFilePicker, pushCoach, pushMine, spendChips, startTalking, stepIndex]);

  /**
   * @param {object} [extra]
   * @param {string[]} [extra.ids] chips named in the box rather than tapped
   * @param {string[]} [extra.values] free values typed alongside (skills only)
   */
  const confirmMulti = useCallback((message, { ids = [], values: typed = [] } = {}) => {
    const step = LADDER.find((s) => s.id === message.stepId);
    if (!step || message.spent || busy) return;
    const index = LADDER.findIndex((s) => s.id === step.id);
    // In the order they were picked: for skills, first tapped reads as strongest.
    const chosen = Array.from(new Set([...message.selected, ...ids]))
      .map((id) => message.chips.find((c) => c.id === id))
      .filter(Boolean);

    spendChips(message.id);
    const said = [...chosen.map((c) => c.label), ...typed];
    pushMine(said.length ? said.join(', ') : TEXT.SKIP_CHIP, { stepId: step.id });

    // Skills chips carry their label as id; preference chips carry an id the
    // editor's dropdowns expect. Both are already the right value to store.
    const values = [...chosen.map((c) => c.id), ...typed];
    if (step.assign === 'skills') {
      const merged = Array.from(new Set([...(draftRef.current.skills || []), ...values]));
      commit({ skills: merged }, index);
    } else {
      commit(step.assign ? { [step.assign]: values } : {}, index);
    }
  }, [busy, commit, pushMine, spendChips]);

  /** Move on from a card that was shown rather than asked. */
  const continueFrom = useCallback((message) => {
    if (message.spent) return;
    spendChips(message.id);
    advanceRef.current(LADDER.findIndex((s) => s.id === message.stepId), draftRef.current);
  }, [spendChips]);

  const skipStep = useCallback((message) => {
    const step = LADDER.find((s) => s.id === message.stepId);
    if (!step || message.spent) return;
    setFollowUpFor(null);
    spendChips(message.id);
    pushMine(TEXT.SKIP_CHIP);
    advance(LADDER.findIndex((s) => s.id === step.id), draftRef.current);
  }, [advance, pushMine, spendChips]);

  /**
   * They said hello, or asked us something, instead of answering.
   *
   * A greeting is free: say hello back and re-ask. A question costs one small
   * call, because a canned "let's stay on topic" is exactly the unhelpfulness
   * people mean when they say a chatbot is not smart. Either way the step is
   * re-asked afterwards, so the conversation never stalls on an aside.
   */
  /**
   * Answer a question, and nothing else. Shared by the intro and the ladder.
   * Returns what was said, because whether it ended with a question decides
   * what the conversation does next.
   */
  const answerQuestion = useCallback(async (text, asked, stepId) => {
    setBusy(true);
    setTyping(true);
    if (asidesRef.current >= ASIDE_LIMIT) {
      pushCoach(TEXT.ASIDE_LIMIT_HIT);
      return TEXT.ASIDE_LIMIT_HIT;
    }
    asidesRef.current += 1;

    let answer = '';
    try {
      const { data } = await profileAPI.coachAsk({
        question: text,
        asked,
        context: {
          sector: draftRef.current.sector,
          level: draftRef.current.level,
          title: draftRef.current.title,
          stepId,
        },
      });
      answer = data?.answer?.trim() || TEXT.ASIDE_FALLBACK;
    } catch {
      answer = TEXT.ASIDE_FALLBACK;
    } finally {
      setTyping(false);
      setBusy(false);
    }
    pushCoach(answer);
    return answer;
  }, [pushCoach]);

  /** Has this step's question been answered, however it got answered? */
  const stepAnswered = useCallback((step, draft) => {
    const value = step.assign ? draft[step.assign] : null;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return !!value.trim();
    return isAlreadyAnswered(step, draft);
  }, []);

  /* `step` is the question on screen, if any. The model is told the question
     and its buttons: without them it could not see what the person was
     looking at, and "show me the suggested levels" got "I don't have any"
     right under a row of levels. */
  const runTurn = useCallback(async (text, step = null) => {
    const onScreen = step ? getChips(step, draftRef.current)
      // Real answers only: "Type my own", "More fields", "Say it instead"
      // and the like are controls, not something to pick in words.
      .filter((c) => !String(c.id).startsWith('__')) : [];
    setBusy(true);
    setTyping(true);
    try {
      const { data } = await profileAPI.coachTurn({
        profile: draftToProfileShape(draftRef.current),
        missing: missingFields(draftRef.current),
        /* Enough of the conversation that the review, the call and the
           questions since are all in view. Ten messages was a few minutes,
           and the coach then asked about things said just before that. */
        history: messagesRef.current
          .filter((m) => m.text)
          .slice(-30)
          .map((m) => ({ role: m.role, text: m.text })),
        message: text,
        /* Live voice is for signed-in users only. A guest who asks to talk is
           pointed at the mic, never walked into an account wall. */
        liveVoice: voiceAvailableRef.current ? 'live' : 'none',
        asked: step ? questionText(step, draftRef.current) : '',
        options: onScreen.map((c) => c.label),
      });

      const learned = data?.learned || {};
      if (Object.keys(learned).length) {
        const merged = applyBraindump(draftRef.current, learned);
        // roleTypes and workStyle are chip answers the model can also hear in
        // passing; applyBraindump deliberately does not own them.
        if (learned.roleType && !(merged.roleTypes || []).length) {
          merged.roleTypes = [String(learned.roleType).toLowerCase()];
        }
        if (learned.workStyle && !merged.workStyle) {
          merged.workStyle = String(learned.workStyle).toLowerCase();
        }
        if (learned.target && !merged.target) merged.target = String(learned.target);
        draftRef.current = merged;
        setDraft(merged);
      }

      setTyping(false);
      if (data?.say) pushCoach(data.say);
      if (data?.voice && voiceAvailableRef.current) {
        /* They asked to talk out loud: same path as the button. Answering
           "I can only read text" next to a mic and a talk button is the coach
           contradicting the page it lives on. */
        setBusy(false);
        await startTalking();
        return { ok: true, awaiting: true, shown: true };
      }
      /* They asked to upload a resume or bring in LinkedIn. Show the real
         buttons rather than describe them: the coach used to answer "paste
         it into the text box", which is not a thing this page does. A file
         dialog cannot be opened from here (the browser only allows that
         from a tap), so the chips are the step. postCall makes "Not now"
         return to the question they were on, not to the top of the ladder. */
      if (data?.show === 'import') {
        offerImportAgain(data?.say ? '' : TEXT.IMPORT_ASKED, ASKED_IMPORT_CHOICES, { postCall: true });
        return { ok: true, awaiting: true, shown: true };
      }
      // Waiting needs something to wait on: an empty reply that claims to be
      // waiting would leave the conversation sitting there with no question.
      return {
        ok: true,
        awaiting: data?.awaiting !== false && !!String(data?.say || '').trim(),
        choice: onScreen.find((c) => c.label === data?.choice) || null,
      };
    } catch {
      setTyping(false);
      return { ok: false, awaiting: false };
    } finally {
      setBusy(false);
    }
  }, [isAuthenticated, offerImportAgain, pushCoach, startTalking]);

  /**
   * Put the answer options back without restating the question.
   *
   * A text-only step gets nothing: the composer is already there, and an
   * empty row would be noise.
   */
  const offerChipsAgain = useCallback((step, liveMessage) => {
    const chips = getChips(step, draftRef.current);
    if (!chips.length) return;
    setMessages((prev) => [
      ...prev.map((m) => (m.id === liveMessage?.id ? { ...m, spent: true } : m)),
      {
        id: nextId(),
        role: 'coach',
        text: '',
        stepId: step.id,
        chips,
        multi: step.kind === 'multi',
        selected: [],
        optional: !!step.optional,
      },
    ]);
  }, []);

  const handleAside = useCallback(async (text, intent, step, liveMessage) => {
    const index = LADDER.findIndex((s) => s.id === step.id);

    // A bare "ok" has nothing in it to answer. Acknowledged in place, free.
    if (intent === 'ack') {
      if (liveMessage) spendChips(liveMessage.id);
      pushCoach(TEXT.GREETING_BACK);
      later(() => askStep(index, draftRef.current), TIMING.ACK_MS);
      return;
    }

    // Greetings go to the model like anything else someone says. A person
    // who says hello and gets a form letter back has learned what this is.
    const answer = await answerQuestion(text, questionText(step, draftRef.current), step.id);

    /* The coach is waiting, so nothing is asked on top of it: re-asking both
       contradicts the invitation and buries it. Two ways to know — they asked
       permission (deterministic, read off their message), or the reply itself
       ended in a question. The first exists because the second was not enough:
       "Of course, go ahead." is an invitation with no question mark in it, and
       the step question landed underneath it anyway.
       The chips stay live above either way, so tapping an answer is still
       one tap — holding the floor is not blocking the path. */
    if (intent === 'permission' || /\?\s*$/.test(answer)) return;

    /* Answer, then hold the options out — do not ask the question again.
       Repeating it is what made the coach read as not caring what was asked:
       you ask about the portfolio, you get an answer, and then the same
       question you were already looking at is restated as though the aside
       were an interruption to get past. The options come back underneath the
       answer instead, with no question bubble: the way forward is visible,
       nothing is repeated, and the next thing they say can just as easily be
       another question. */
    later(() => offerChipsAgain(step, liveMessage), TIMING.ACK_MS);
  }, [answerQuestion, later, offerChipsAgain, pushCoach]);

  /**
   * Typed while the intro is on screen.
   *
   * The composer used to be dead here, because it is gated on there being a
   * question to answer and the intro asks nothing. That was defensible when
   * the intro was a slideshow and the box could only take dictation; it is
   * not, now that the coach can answer things. A question gets answered and
   * the intro stays put. Anything else is someone who would rather talk than
   * read three slides, so the intro gets out of the way.
   */
  /**
   * Typed while the intro is on screen — now run by the model, like the rest.
   *
   * This was the last path still deciding for itself what someone meant, and
   * it failed exactly the way the others did: "how profileai helps me" was
   * matched against sector aliases, found "pr" inside "profileai", announced
   * "Media, Writing & PR — got it" and started building a journalism profile.
   * The question went unanswered.
   *
   * Now the same turn endpoint answers it. If what they said was about
   * themselves, the model records it and the questions start from whatever is
   * still missing; if it was a question about the product, they get an answer
   * and the intro stays where it is.
   */
  const handleIntroText = useCallback(async (text) => {
    const before = draftRef.current;
    const turn = await runTurn(text);
    if (!turn.ok) {
      setError(TEXT.ERROR_GENERIC);
      return;
    }

    // Did they tell us anything about themselves, or just ask something?
    const after = draftRef.current;
    const toldUsSomething = after !== before && (
      after.sector || after.title || (after.skills || []).length || (after.experience || []).length
    );
    if (!toldUsSomething) return;

    setMessages((prev) => prev
      .filter((m) => m.introSlide == null)
      .map((m) => (m.introBuild ? { ...m, spent: true } : m)));
    trackEvent('coach_intro_typed_past', {});
    // No second greeting: the model has already replied to them in its own
    // words, and "Right — let's build your profile" on top of that is the
    // product talking over itself.
    later(() => startLadderFrom(draftRef.current, { silent: true }), TIMING.ACK_MS);
  }, [later, runTurn, startLadderFrom]);

  /**
   * A turn run by the model rather than by regexes.
   *
   * Everything typed goes here now. The model is given the profile, what it
   * still needs and the transcript, and decides what to say and what it just
   * learned — including when "what they said" is a question, a greeting, a
   * correction or three answers at once. Thirteen hand-written patterns used
   * to make that call, and every phrasing nobody anticipated landed in the
   * wrong one.
   *
   * The ladder is still ours. The model never decides what a profile needs;
   * it decides how to ask for the next missing piece, and the chips keep
   * working exactly as before for anyone who would rather tap.
   */
  const submitText = useCallback(async (event) => {
    event?.preventDefault();
    /* Pressed while the accurate transcript is still coming back: that is
       still "send this". It used to be ignored (Enter) or impossible (the
       button was disabled), which read as the box not sending. It goes the
       moment the transcript lands — see the effect on dictation.transcribing. */
    if (dictation.transcribing) {
      sendWhenTranscribedRef.current = true;
      return;
    }
    /* Send while the mic is on means "that is my answer": stop, wait for the
       accurate transcript, and send that, not the live preview. */
    let text = input.trim();
    if (dictation.listening) {
      const final = await dictation.finish();
      if (final && String(final).trim()) text = String(final).trim();
    }
    // An attached file goes first, through the same reader as an upload.
    // Anything typed beside it stays in the box for the next message.
    if (attached && !busy) {
      const file = attached;
      setAttached(null);
      await handleFile(file);
      return;
    }
    const step = LADDER[stepIndex];
    if (!text || busy) return;

    // The intro is on screen and nothing has been asked yet.
    if (!step) {
      setInput('');
      setError('');
      pushMine(text);
      await handleIntroText(text);
      return;
    }
    /* A pick-several question is answered by sending: the box holds the
       picks, and anything else typed there is matched to a chip or, for
       skills, added as one. */
    const liveMulti = [...messages].reverse().find((m) => m.multi && !m.spent && m.stepId === step.id);
    if (liveMulti) {
      const parts = text.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean);
      const byLabel = (part) => liveMulti.chips.find((c) => c.label.toLowerCase() === part.toLowerCase());
      const ids = parts.map(byLabel).filter(Boolean).map((c) => c.id);
      const loose = parts.filter((p) => !byLabel(p));
      const typed = step.assign === 'skills' ? loose.flatMap((p) => parseSkillList(p)) : [];
      if (ids.length || liveMulti.selected.length || typed.length) {
        setInput('');
        setError('');
        confirmMulti(liveMulti, { ids, values: typed });
        return;
      }
    }

    // canAnswer, not step.freeText: a probe question belongs to the review
    // step, which asks nothing itself and so declares freeText: false.
    if (!canAnswer(step, probing)) return;

    const liveMessage = [...messages].reverse().find((m) => m.stepId === step.id && !m.spent);

    setInput('');
    setError('');
    pushMine(text);

    const index = stepIndex;
    const current = draftRef.current;

    /* One model call decides what they meant.
       Thirteen regexes used to make that call — answer or question, greeting
       or correction, skip or hedge — and every phrasing nobody anticipated
       landed in the wrong branch. The model gets the profile, the gap and the
       transcript, and comes back with what to say and what it learned. The
       chips above are untouched and still free for anyone who would rather
       tap than type. */

    // A probe answer is prose about their work by definition — there is no
    // chip that could express it, so it always goes to the model.
    if (probing) {
      if (liveMessage) spendChips(liveMessage.id);
      setBusy(true);
      setTyping(true);
      try {
        const { data } = await profileAPI.coachInterpret({
          stepId: 'probe',
          question: liveMessage ? liveMessage.text : questionText(step, current),
          answer: text,
          context: { title: current.title, sector: current.sector },
        });
        const nextDraft = mergeInterpreted(current, 'probe', data?.fields || {});
        draftRef.current = nextDraft;
        setDraft(nextDraft);
      } catch {
        // Losing one probe answer is not worth stopping the conversation for.
        setError(TEXT.ERROR_GENERIC);
      } finally {
        setTyping(false);
        setBusy(false);
      }
      nextProbe(index);
      return;
    }

    // Guests reach the model too. The conversation is the product demo, so it
    // runs end to end and the account is asked for at the close, once there is
    // a finished profile to save. The server meters anonymous callers by IP
    // (coachGuard in routes/profiles.js) since there is no user to meter.
    /* Exact and free: a pasted URL, or text that is literally one of the
       chips on screen. Neither is a judgement call, so neither needs a model.
       Everything else does. */
    if (step.id === 'links') {
      const links = parseLinks(text);
      if (Object.keys(links).length) {
        if (liveMessage) spendChips(liveMessage.id);
        commit(links, index);
        return;
      }
      /* Not a link: a question ("why are you asking?"), or "I don't have
         one". Both deserve an answer, not "that does not look like a link"
         with their sentence put back in the box. The coach replies in
         context; a link is optional, so unless it asked them something the
         conversation moves on. */
      const turn = await runTurn(text, step);
      if (!turn.ok) {
        setError(TEXT.ERROR_GENERIC);
        return;
      }
      if (turn.shown || turn.awaiting) return;
      advance(index, draftRef.current);
      return;
    }

    /* Typed at the resume question instead of tapping: that is a person
       carrying on the conversation, which is what "just chat" means. The box
       used to be disabled here, and after a cancelled upload it looked like
       the page had frozen. */
    if (step.id === 'importOffer') {
      setMessages((prev) => prev.map((m) => (m.stepId === 'importOffer' ? { ...m, spent: true } : m)));
      const turn = await runTurn(text, step);
      if (!turn.ok) {
        setError(TEXT.ERROR_GENERIC);
        return;
      }
      if (turn.shown) return;
      if (!turn.awaiting) advance(index, draftRef.current);
      return;
    }

    // A field is matched against all of ours, not just the chips on screen,
    // and one we do not have is kept as typed.
    if (step.id === 'sector') {
      const field = fieldFromText(text);
      if (field) {
        if (liveMessage) spendChips(liveMessage.id);
        commit(field.title && !current.title ? { sector: field.sector, title: field.title } : { sector: field.sector }, index);
        return;
      }
    }

    const tapped = matchChip(text, getChips(step, current));
    if (tapped && step.assign) {
      if (liveMessage) spendChips(liveMessage.id);
      commit({ [step.assign]: tapped.id }, index);
      return;
    }

    const turn = await runTurn(text, step);
    if (!turn.ok) {
      setError(TEXT.ERROR_GENERIC);
      return;
    }
    // A typed answer retires the row it answered, "Type my own" included —
    // it used to stay lit after the answer was already in.
    if (liveMessage) spendChips(liveMessage.id);

    // A button picked in words ("senior I guess"): same as tapping it.
    if (turn.choice && step.assign && step.kind !== 'multi') {
      commit({ [step.assign]: turn.choice.id }, index);
      return;
    }
    // The call or the upload buttons took over the bottom of the chat.
    if (turn.shown) return;

    /* It asked them something. Wait for the answer rather than talking over
       it, but keep the buttons under it: a reply on a button question used
       to retire the row for good, leaving the question with nothing to tap. */
    if (turn.awaiting) {
      if (!stepAnswered(step, draftRef.current)) offerChipsAgain(step, null);
      return;
    }

    /* Did that fill in what this step was for? If so the conversation moves
       on; if not — they asked a question, or said something unrelated — the
       options come back without the question being restated at them. */
    if (stepAnswered(step, draftRef.current)) advance(index, draftRef.current);
    else offerChipsAgain(step, null);
  }, [advance, attached, busy, commit, dictation, handleFile, offerChipsAgain, runTurn, stepAnswered, followUpFor, handleAside, handleIntroText, input, isAuthenticated, messages, nextProbe, probing, pushCoach, pushMine, spendChips, stepIndex]);

  /* ─── Converting ───────────────────────────────────────────── */

  /**
   * The end of the conversation. Two different people arrive here:
   *
   * A signed-in user already has somewhere to put this, so it is saved and
   * they land on their portfolio. A guest's profile only exists in this tab,
   * so it is stashed and registration publishes it — the draft is marked
   * autoPublish because they have just watched it being built and reviewed it
   * on screen. Dropping them back into the editor to approve it again would
   * be asking twice.
   */
  const handleConvert = useCallback(async (mode) => {
    const finalDraft = draftRef.current;
    const resumeData = draftToResumeData(finalDraft);

    if (!isAuthenticated) {
      saveGuestProfileDraft(resumeData, {
        source: 'coach',
        autoPublish: true,
        // Saved to their record once the account exists (Register).
        careerContext: careerContextOf(finalDraft),
      });
      trackEvent('coach_convert_clicked', { mode, imported: finalDraft.importedFrom || 'none' });
      navigate(mode === 'signin' ? ROUTES.LOGIN : `${ROUTES.REGISTER}?role=candidate`);
      return;
    }

    setBusy(true);
    try {
      await profileAPI.createOrUpdateProfile(resumeData);
      saveCareerContext(finalDraft);
      trackEvent('coach_profile_saved', { imported: finalDraft.importedFrom || 'none' });
      navigate(ROUTES.PORTFOLIO);
    } catch {
      // Saving failed, so do not pretend it worked — hand them to the editor,
      // which has the full save path and can surface the real error.
      setBusy(false);
      setError(TEXT.ERROR_GENERIC);
      navigate(ROUTES.CREATE_FORM, { state: { source: 'coach', resumeData } });
    }
  }, [isAuthenticated, navigate, saveCareerContext]);

  /* ─── Derived view state ───────────────────────────────────── */

  const completionRaw = useMemo(
    () => computeProfileCompletion(draftToProfileShape(draft)),
    [draft]
  );
  /* Scored over what this conversation asks for — see coachCompletion. The
     editor keeps the canonical nine-item rubric; this meter would otherwise
     top out at 78% for someone who answered every single question. */
  const completion = useMemo(
    () => coachCompletion(completionRaw, draft),
    [completionRaw, draft]
  );
  const panel = useMemo(
    () => panelState(draft, completionRaw.items),
    [draft, completionRaw.items]
  );

  // What the panel shows next to each label once it's filled in.
  const panelValue = useCallback((key) => {
    switch (key) {
      case 'title':
        return draftToProfileShape(draft).title;
      case 'location':
        return draft.location || '';
      // The labels they tapped ("Full-time"), not the stored ids.
      case 'lookingFor':
        return preferenceLabels(draft);
      /* Skills as tags, a dozen at most: a comma list cut at four read as if
         the import had only found four. */
      case 'skills': {
        const all = draft.skills || [];
        if (!all.length) return '';
        return (
          <PanelTags>
            {all.slice(0, 12).map((skill) => <span key={skill}>{skill}</span>)}
            {all.length > 12 && <em>+{all.length - 12} more</em>}
          </PanelTags>
        );
      }
      /* Every role at a glance (title, company, how long), newest first,
         rather than the first job and a paragraph of its text. A resume of
         seven jobs showed as one. */
      case 'exp': {
        const rows = (draft.experience || []).filter((r) => r && (r.title || r.company));
        if (!rows.length) return '';
        return (
          <PanelRoles>
            {rows.slice(0, 3).map((r, i) => (
              <li key={`${r.company}${i}`}>
                <strong>{r.title || r.company}</strong>
                <span>{[r.title ? r.company : '', roleConfirmText(r)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
            {rows.length > 3 && <li className="more">+{rows.length - 3} more role{rows.length - 3 === 1 ? '' : 's'}</li>}
          </PanelRoles>
        );
      }
      case 'proj':
        return (draft.projects || []).map((p) => p.title).filter(Boolean).slice(0, 3).join(', ');
      case 'edu':
        return (draft.education || []).slice(0, 2)
          .map((row) => [row.degree, row.institution, String(row.endDate || '').match(/\b(19|20)\d{2}\b/)?.[0]]
            .filter(Boolean)
            // "Bootcamp, Software Engineering Bootcamp": drop a part the next one already says.
            .filter((part, i, all) => !all.slice(i + 1).some((other) => String(other).toLowerCase().includes(String(part).toLowerCase())))
            .join(' · '))
          .join('; ');
      default:
        return '';
    }
  }, [draft]);

  const currentStep = LADDER[stepIndex];
  // While "talk or type?" is waiting, the question it precedes has not been
  // asked yet, so its Skip does not belong on screen.
  const voiceOfferLive = messages.some((m) => m.stepId === VOICE_CHOICE && !m.spent);
  // A story question carries a "Say it instead" row, and its Skip goes in it.
  const liveRowHasChips = messages.some(
    (m) => m.stepId === currentStep?.id && !m.spent && m.chips?.length
  );
  // The intro (stepIndex -1) has no question, but it does have a coach who
  // can answer one — see handleIntroText.
  // A live pick-several row is answered from the box, whatever the step's
  // freeText says.
  const liveMultiRow = messages.some((m) => m.multi && !m.spent && m.stepId === currentStep?.id);
  const canType = (liveMultiRow || (!currentStep ? stepIndex < 0 : canAnswer(currentStep, probing))) && !busy;

  /* The cursor waits in the box whenever there is something to type: after
     each question, after the coach replies, after a chip was tapped. Having
     to click into the box before every answer made a chat feel like a form.
     Desktop only: on a touch screen focus opens the keyboard over the chips
     on every question. Never pulled away from another field being typed in
     (the paste box, a line on the check card), and not during a call. */
  useEffect(() => {
    if (!canType || voice.state !== VOICE_STATES.idle) return;
    if (!window.matchMedia?.('(pointer: fine)').matches) return;
    const active = document.activeElement;
    const typingElsewhere = active && active !== composerRef.current
      && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
    if (typingElsewhere) return;
    composerRef.current?.focus({ preventScroll: true });
  }, [canType, messages.length, voice.state]);

  /* ─── Card renderers ───────────────────────────────────────── */

  const renderReview = (review) => (
    <Card>
      {!!review.working?.length && (
        <>
          <CardLabel>{COACH_TEXT.REVIEW_WORKING}</CardLabel>
          <CardList>
            {review.working.map((item, i) => (
              <Finding key={`w${i}`} $tone="good"><b>{item}</b></Finding>
            ))}
          </CardList>
        </>
      )}
      {!!review.fix?.length && (
        <>
          <CardLabel style={{ marginTop: review.working?.length ? 20 : 0 }}>
            {COACH_TEXT.REVIEW_FIX}
          </CardLabel>
          <CardList>
            {review.fix.map((item, i) => (
              <Finding key={`f${i}`} $tone="warn">
                <b>{item.what}</b>
                {item.why && <span>{item.why}</span>}
                {item.how && <i>{item.how}</i>}
              </Finding>
            ))}
          </CardList>
        </>
      )}
    </Card>
  );

  const renderAssessment = (assessment) => {
    const { market } = assessment;
    return (
      <Card>
        <CardLabel>{COACH_TEXT.ASSESS_TITLE}</CardLabel>
        <VerdictRow>
          <Verdict $tone={VERDICT_TONE[assessment.verdict]}>{assessment.verdict}</Verdict>
          {/* A null total means we did not measure it, which is not the same
              as zero — saying nothing is the only honest option there. */}
          {typeof market?.total === 'number' && market.total > 0 && (
            <MarketNote>
              {COACH_TEXT.ASSESS_OPENINGS(market.total)}
              {/* A measured zero is shown. For someone who asked for on-site,
                  "none in your area" is the single most useful fact we have,
                  and hiding it would leave them with only the flattering
                  headline number. A null still shows nothing — that one means
                  we did not measure, which is not the same as none. */}
              {typeof market.nearby === 'number'
                ? `, ${COACH_TEXT.ASSESS_NEARBY(market.nearby, market.nearbyKind)}`
                : ''}
            </MarketNote>
          )}
        </VerdictRow>

        {!!assessment.why?.length && (
          <>
            <CardLabel>{COACH_TEXT.ASSESS_WHY}</CardLabel>
            <CardList>
              {assessment.why.map((w, i) => (
                <Finding key={`y${i}`} $tone="good"><b>{w}</b></Finding>
              ))}
            </CardList>
          </>
        )}

        {!!assessment.closes?.length && (
          <>
            <CardLabel style={{ marginTop: 20 }}>{COACH_TEXT.ASSESS_CLOSES}</CardLabel>
            <CardList>
              {assessment.closes.map((c, i) => (
                <Finding key={`c${i}`} $tone="warn">
                  <b>
                    {c.what}
                    <EffortTag>{COACH_TEXT.EFFORT[c.effort] || c.effort}</EffortTag>
                  </b>
                </Finding>
              ))}
            </CardList>
          </>
        )}
      </Card>
    );
  };

  const renderResume = (built) => {
    const sections = resumeSections(built);
    const shape = draftToProfileShape(built);
    return (
      <Card>
        <CardLabel>{COACH_TEXT.RESUME_CARD_TITLE}</CardLabel>
        <ResumeSheet>
          <ResumeName>{shape.title || 'Your profile'}</ResumeName>
          <ResumeMeta>{[built.location, built.target && `Targeting ${built.target}`].filter(Boolean).join(' · ')}</ResumeMeta>

          {sections.map((section) => (
            <ResumeSection key={section.key}>
              <h4>{section.label}</h4>
              {section.kind === 'text' && <p>{section.body}</p>}
              {section.kind === 'chips' && (
                <ResumeSkills>
                  {section.items.map((skill) => <span key={skill}>{skill}</span>)}
                </ResumeSkills>
              )}
              {section.kind === 'entries' && section.items.map((entry, i) => (
                <ResumeEntry key={`${section.key}${i}`}>
                  <strong>{entry.heading}</strong>
                  {entry.meta && <em>{entry.meta}</em>}
                  {!!entry.lines.length && (
                    <ul>{entry.lines.map((line, j) => <li key={j}>{line}</li>)}</ul>
                  )}
                </ResumeEntry>
              ))}
            </ResumeSection>
          ))}
        </ResumeSheet>
      </Card>
    );
  };

  const renderTour = () => (
    <Card>
      <TourGrid>
        {TOUR_CARDS.map((card) => {
          const Icon = TOUR_ICONS[card.icon];
          return (
            <TourCard key={card.id}>
              <TourIcon>{Icon ? <Icon fontSize="small" /> : null}</TourIcon>
              <h5>{card.title}</h5>
              <p>{card.body}</p>
            </TourCard>
          );
        })}
      </TourGrid>
      <BubbleHint style={{ marginTop: 16 }}>{COACH_TEXT.TOUR_OUTRO}</BubbleHint>
    </Card>
  );

  const renderConvert = () => (
    <ConvertCard>
      <h4>{COACH_TEXT.CONVERT_TITLE}</h4>
      <p>{COACH_TEXT.CONVERT_BODY}</p>
      <ConvertActions>
        <ConvertPrimary type="button" onClick={() => handleConvert('register')} disabled={busy}>
          {COACH_TEXT.CONVERT_CTA}
        </ConvertPrimary>
        <ConvertSecondary type="button" onClick={() => handleConvert('signin')} disabled={busy}>
          {COACH_TEXT.CONVERT_SIGNIN}
        </ConvertSecondary>
      </ConvertActions>
      <ConvertNote>{COACH_TEXT.CONVERT_NOTE}</ConvertNote>
    </ConvertCard>
  );

  const renderPanelItems = () => visiblePanelItems(draft, PANEL_ITEMS).map((item) => {
    const done = !!panel[item.key];
    const value = done ? panelValue(item.key) : '';
    return (
      <PanelItem key={item.key}>
        <PanelItemHead $done={done}>
          <Dot $done={done} />
          {item.label}
        </PanelItemHead>
        <PanelItemBody $done={done}>{value || item.hint}</PanelItemBody>
      </PanelItem>
    );
  });

  return (
    <PageContainer>
      <TopBar>
        <Logo onClick={() => navigate(ROUTES.HOME)} aria-label={TEXT.LOGO}>
          <BrandLogo />
        </Logo>
        {/* No header actions. Voice is offered inside the conversation, where
            it fits (after an import, or at the first story question), and the
            conversation is the way through to the profile. */}
      </TopBar>

      <MobileStrip type="button" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
        <StripLabel>{completion.pct}% · {completion.label}</StripLabel>
        <StripBar $pct={completion.pct}><i /></StripBar>
      </MobileStrip>
      <MobilePanel $open={panelOpen}>{renderPanelItems()}</MobilePanel>

      <Body>
        <ChatColumn {...dropHandlers}>
          {dragging && (
            <DropOverlay aria-hidden="true">
              <AttachIcon />
              <strong>{TEXT.DROP_TITLE}</strong>
              <span>{TEXT.DROP_SUB}</span>
            </DropOverlay>
          )}
          <MessageList ref={listRef}>
            <Thread ref={threadRef}>
              {messages.map((message) => (
                <React.Fragment key={message.id}>
                  {/* Where a card read from its top scrolls to. The negative
                      margin cancels the thread's gap for this empty marker. */}
                  {(message.review || message.resume) && (
                    <div data-mid={message.id} style={{ height: 0, marginBottom: -14, scrollMarginTop: 12 }} />
                  )}
                  {/* Cards that carry their own heading (the upload progress)
                      have no bubble text, and an empty bubble is just a grey
                      rectangle floating above them. */}
                  {!!message.text && (
                    <Row $mine={message.role === 'me'}>
                      {message.role === 'coach' && (
                        <CoachAvatar><CoachMark /></CoachAvatar>
                      )}
                      {/* Your own tapped answers are live controls: tap one to
                          take it back. Typed answers are not — a sentence the
                          model turned into experience rows cannot be cleanly
                          un-picked, and those stay editable in the editor. */}
                      {canRewind(LADDER.find((s) => s.id === message.stepId)) && message.role === 'me' ? (
                        <Bubble
                          $mine
                          as="button"
                          type="button"
                          $editable
                          onClick={() => rewindTo(message)}
                          title={TEXT.CHANGE_ANSWER}
                          aria-label={`${message.text}, ${TEXT.CHANGE_ANSWER}`}
                        >
                          {message.text}
                          <EditHint aria-hidden="true"><EditIcon /> {TEXT.CHANGE_ANSWER}</EditHint>
                        </Bubble>
                      ) : (
                        <Bubble $mine={message.role === 'me'}>
                          {message.text}
                          {message.hint && <BubbleHint>{message.hint}</BubbleHint>}
                        </Bubble>
                      )}
                    </Row>
                  )}

                  {message.introSlide != null && (
                    <IntroCarousel
                      index={message.introSlide}
                      onNext={() => introContinue(message)}
                      onJump={(to) => introJump(message, to)}
                      onSkip={() => introSkip(message)}
                    />
                  )}
                  {message.introBuild && (
                    <BuildProfileCard
                      spent={message.spent}
                      onStart={() => introStart(message)}
                    />
                  )}

                  {message.uploading && (
                    <UploadProgress
                      fileName={message.fileName}
                      done={!!message.uploadDone}
                      failed={!!message.uploadFailed}
                    />
                  )}
                  {message.checkKeys && (
                    <CheckCard
                      lines={checkLines(draft, message.checkKeys)}
                      spent={message.spent}
                      busy={busy}
                      onSave={saveCheckEdit}
                      onDone={() => finishCheck(message)}
                    />
                  )}
                  {message.review && renderReview(message.review)}
                  {message.assessment && renderAssessment(message.assessment)}
                  {message.resume && renderResume(message.resume)}
                  {message.tour && renderTour()}
                  {message.continues && !message.spent && (
                    <ChipRow>
                      <Chip type="button" onClick={() => continueFrom(message)}>
                        {COACH_TEXT.TOUR_CONTINUE}
                      </Chip>
                    </ChipRow>
                  )}
                  {message.convert && renderConvert()}

                  {!!message.chips?.length && (
                    <ChipRow>
                      {message.chips.map((chip) => {
                        const picked = !!message.selected?.includes(chip.id);
                        const removable = message.multi && !message.spent && picked;
                        return (
                          <Chip
                            key={chip.id}
                            type="button"
                            disabled={message.spent || busy}
                            $spent={message.spent}
                            $ghost={String(chip.id).startsWith('__')}
                            $selected={picked}
                            aria-pressed={message.multi ? picked : undefined}
                            aria-label={removable ? `${chip.label}, ${TEXT.CHIP_REMOVE}` : undefined}
                            onClick={() => {
                              /* New chips appear right under the cursor that
                                 just tapped something. A tap in the first
                                 moment is a stray one, not a choice: it once
                                 started a voice call nobody asked for. */
                              if (message.at && Date.now() - message.at < TAP_GUARD_MS) return;
                              answerChip(message, chip);
                            }}
                          >
                            {chip.label}
                            {removable && <ChipRemove aria-hidden="true">×</ChipRemove>}
                          </Chip>
                        );
                      })}
                      {/* Nothing picked yet: Skip. Once something is picked,
                          Done appears under the row. */}
                      {message.multi && !message.spent && !message.selected?.length && (
                        <Chip type="button" $ghost onClick={() => confirmMulti(message)}>
                          {TEXT.SKIP_CHIP}
                        </Chip>
                      )}
                      {message.optional && !message.multi && !message.spent && (
                        <Chip type="button" onClick={() => skipStep(message)}>
                          {TEXT.SKIP_CHIP}
                        </Chip>
                      )}
                    </ChipRow>
                  )}
                  {message.multi && !message.spent && !!message.selected?.length && (
                    <MultiDone>
                      <Chip type="button" $primary disabled={busy} onClick={() => confirmMulti(message)}>
                        {TEXT.MULTI_DONE(message.selected.length)}
                      </Chip>
                    </MultiDone>
                  )}
                </React.Fragment>
              ))}

              {typing && (
                <Row>
                  <CoachAvatar><CoachMark /></CoachAvatar>
                  <Bubble aria-label={TEXT.THINKING}>
                    <Typing><span /><span /><span /></Typing>
                  </Bubble>
                </Row>
              )}
              <div ref={listEndRef} />
            </Thread>
          </MessageList>

          <ComposerWrap>
            {error && <ErrorNote role="alert">{error}</ErrorNote>}

            {/* Skip lives here for text-only steps, which have no chip row
                of their own to hang it on. */}
            {currentStep?.optional && !currentStep?.chipSet && !liveRowHasChips && !voiceOfferLive && (
              <QuickReplies>
                <QuickReply
                  type="button"
                  onClick={() => {
                    pushMine(TEXT.SKIP_CHIP);
                    advance(stepIndex, draftRef.current);
                  }}
                >
                  {TEXT.SKIP_CHIP}
                </QuickReply>
              </QuickReplies>
            )}

            <Composer onSubmit={submitText}>
              <IconButton
                type="button"
                disabled={!canAttach}
                onClick={() => { setError(''); openFilePicker({ attach: true }); }}
                title={TEXT.ATTACH_RESUME}
                aria-label={TEXT.ATTACH_RESUME}
              >
                <AttachIcon fontSize="small" />
              </IconButton>
              <ComposerField>
              {attached && (
                <AttachmentCard>
                  <span className="icon"><FileIcon fontSize="small" /></span>
                  <span className="text">
                    <strong title={attached.name}>{attached.name}</strong>
                    <span>{attachmentMeta(attached)}</span>
                  </span>
                  <button
                    type="button"
                    className="remove"
                    onClick={() => { setAttached(null); composerRef.current?.focus(); }}
                    aria-label={TEXT.ATTACH_REMOVE}
                  >
                    ×
                  </button>
                </AttachmentCard>
              )}
              {dictation.listening && <ComposerWave as={DictationWave} levelRef={dictation.levelRef} />}
              <ComposerInput
                ref={composerRef}
                rows={1}
                enterKeyHint="send"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                // A resume copied in Finder and pasted here is an upload.
                onPaste={(e) => {
                  const file = e.clipboardData?.files?.[0];
                  if (!file || !canAttach) return;
                  e.preventDefault();
                  attachFile(file);
                }}
                /* Enter sends everything in the box, Shift+Enter is a new
                   line. Not mid-composition (an IME picking characters), and
                   not while the accurate transcript is still on its way. */
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }}
                // When the answer is a tap, the box says so instead of just
                // looking broken.
                placeholder={dictation.transcribing
                  ? TEXT.DICTATE_TRANSCRIBING
                  : liveMultiRow
                  ? TEXT.INPUT_PLACEHOLDER_MULTI
                  : !canType && currentStep
                  ? TEXT.INPUT_PLACEHOLDER_CHIPS
                  : dictation.supported ? TEXT.INPUT_PLACEHOLDER_VOICE : TEXT.INPUT_PLACEHOLDER}
                disabled={!canType}
                aria-label={TEXT.INPUT_PLACEHOLDER}
              />
              </ComposerField>
              {input && !dictation.listening && !dictation.transcribing && canType && (
                <ClearButton
                  type="button"
                  onClick={() => { setInput(''); composerRef.current?.focus(); }}
                  aria-label={TEXT.CLEAR_INPUT_LABEL}
                >
                  {TEXT.CLEAR_INPUT}
                </ClearButton>
              )}
              <IconButton
                type="button"
                $listening={dictation.listening}
                disabled={!dictation.supported || !canType}
                onClick={() => {
                  setError('');
                  dictation.toggle(input);
                  /* Focus back in the box. Left on this button, the Enter
                     that was meant to send clicked the mic again instead. */
                  composerRef.current?.focus();
                }}
                title={!dictation.supported
                  ? TEXT.DICTATE_UNSUPPORTED
                  : dictation.listening ? TEXT.DICTATE_STOP : TEXT.DICTATE_START}
                aria-label={dictation.listening ? TEXT.DICTATE_STOP : TEXT.DICTATE_START}
                aria-pressed={dictation.listening}
              >
                <MicIcon fontSize="small" />
              </IconButton>
              {/* Held while the accurate transcript is on its way, so the
                  rough live preview is never what gets sent. */}
              <IconButton type="submit" $primary disabled={attached ? busy : (!canType || !input.trim())} aria-label={TEXT.SEND}>
                <SendIcon fontSize="small" />
              </IconButton>
            </Composer>
            <Footnote>{TEXT.FOOTER}</Footnote>
          </ComposerWrap>
        </ChatColumn>

        <SidePanel>
          <PanelHead>
            <Meter>
              <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true">
                <circle cx="29" cy="29" r="25" fill="none" stroke="#eeeef6" strokeWidth="5" />
                <circle
                  cx="29" cy="29" r="25" fill="none"
                  stroke={completion.color} strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${(completion.pct / 100) * 157} 157`}
                  style={{ transition: 'stroke-dasharray 320ms ease' }}
                />
              </svg>
              <span>{completion.pct}%</span>
            </Meter>
            <div>
              <PanelTitle>{TEXT.PANEL_TITLE}</PanelTitle>
              <PanelTier $color={completion.color}>{completion.label}</PanelTier>
              <PanelSub>{TEXT.PANEL_ENCOURAGE}</PanelSub>
            </div>
          </PanelHead>
          {renderPanelItems()}
        </SidePanel>
      </Body>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={(e) => {
          if (!attachModeRef.current) {
            handleFile(e);
            return;
          }
          attachModeRef.current = false;
          const file = e.target.files?.[0];
          e.target.value = '';
          attachFile(file);
        }}
        style={{ display: 'none' }}
      />

      {voice.state !== VOICE_STATES.idle && (
        <VoicePanel
          state={voice.state}
          speaking={voice.speaking}
          level={voice.level}
          muted={voice.muted}
          onToggleMute={voice.toggleMute}
          lastLine={lastSpoken}
          // After an import Remi already knows the resume; the prompt says so.
          hint={draft.importedFrom ? TEXT.VOICE_HINT_IMPORTED : TEXT.VOICE_HINT}
          onEnd={voice.stop}
        />
      )}

      <LinkedInImportModal
        open={linkedinOpen}
        onClose={() => {
          setLinkedinOpen(false);
          // Closing the window without importing is the same dead end as a
          // cancelled file dialog: the last thing on screen was a promise to
          // pull something in, and nothing did.
          offerImportAgain(TEXT.IMPORT_CANCELLED);
        }}
        onImported={(data) => {
          setLinkedinOpen(false);
          applyImport(data, 'linkedin');
        }}
        urlImportAvailable={linkedinStatus.urlImportAvailable}
        oauthAvailable={linkedinStatus.oauthAvailable}
        isAuthenticated={isAuthenticated}
        onRequireAuth={() => setGateOpen(true)}
      />

      <ConfirmModal
        show={gateOpen}
        onClose={() => setGateOpen(false)}
        onConfirm={() => navigate(`${ROUTES.REGISTER}?role=candidate`)}
        variant="info"
        title={TEXT.LINKEDIN_GATE_TITLE}
        message={TEXT.LINKEDIN_GATE_BODY}
        confirmText={TEXT.LINKEDIN_GATE_CONFIRM}
        cancelText={TEXT.LINKEDIN_GATE_CANCEL}
      />
    </PageContainer>
  );
};

export default ProfileCoach;
