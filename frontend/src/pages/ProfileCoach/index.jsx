import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mic as MicIcon,
  Send as SendIcon,
  Extension as ExtensionIcon,
  EditOutlined as EditIcon,
  GraphicEq as TalkIcon,
  Public as PublicIcon,
  Link as LinkIcon,
  DescriptionOutlined as FileIcon,
  CheckCircle as DoneIcon,
  ErrorOutline as FailedIcon,
} from '@mui/icons-material';

import { useAuth } from '../../contexts/AuthContext';
import { profileAPI, authAPI, tailoredProfileAPI } from '../../services/api';
import { computeProfileCompletion } from '../../hooks/useProfileCompletion';
import { saveGuestProfileDraft, clearGuestProfileDraft } from '../../utils/guestDraft';
import GoogleAuthButton from '../../components/GoogleAuthButton';
import { trackEvent } from '../../utils/analytics';
import BrandLogo from '../../components/BrandLogo';
import ConfirmModal from '../../components/ConfirmModal';
import LinkedInImportModal from '../ProfileCreation/LinkedInImportModal';
import { useDictation } from './useDictation';
import CoachMark from './CoachMark';
import VoicePanel from './VoicePanel';
import { useVoiceCall, VOICE_STATES } from './useVoiceCall';

import {
  LADDER,
  ROUTES,
  TEXT,
  COACH_TEXT,
  TIMING,
  ALLOWED_FILE_TYPES,
  VALIDATION,
  UPLOAD_STEPS,
  UPLOAD_STEP_MS,
} from './constants';
import {
  emptyDraft,
  getChips,
  matchChip,
  nextStepIndex,
  mergeInterpreted,
  seedFromImport,
  draftToResumeData,
  draftToProfileShape,
  resumeSections,
  isPresentable,
  canAnswer,
  questionText,
  isAlreadyAnswered,
  missingFields,
  applyBraindump,
  canRewind,
  draftRewoundTo,
  loadConversation,
  saveConversation,
  clearConversation,
  parseLinks,
  sectorChips,
  levelsFor,
  looksLikeTitle,
  normalizeTitle,
  deriveFromTitle,
  sectorLabel,
  levelLabel,
  roleConfirmText,
  latestBullets,
  applyCorrection,
  preferenceLabels,
  questionsLeft,
  autocompleteOptions,
  VOICE_CHOICE,
  VOICE_SIGNIN_CHOICE,
  RETRY_IMPORT_CHOICES,
  POST_CALL_IMPORT_CHOICES,
  VOICE_OFFER_STEP,
  voiceAgenda,
  MORE_SECTORS_CHIP,
  CUSTOM_ANSWER_CHIP,
} from './coachLogic';
import {
  PageContainer, TopBar, Logo, TopActions, TopButton, Body,
  ChatColumn, MessageList, Thread, Row, CoachAvatar, Bubble, BubbleHint, EditHint, Typing,
  ChipRow, Chip, QuickReplies, QuickReply,
  ComposerWrap, Composer, ComposerInput, IconButton, Footnote, ErrorNote, TalkButton,
  ListeningNote,
  SidePanel, PanelHead, Meter, PanelTitle, PanelTier, PanelSub,
  PreviewSheet, PreviewPlaceholder,
  MobileStrip, StripBar, StripLabel, MobilePanel,
  Card, CardLabel, CardList, Finding,
  VerdictRow, Verdict, MarketNote, EffortTag,
  ResumeSheet, ResumeName, ResumeMeta, ResumeSection, ResumeEntry, ResumeSkills,
  ConvertCard, ConvertActions, ConvertSecondary, ConvertNote,
  PasteArea, InlineForm, InlinePrimary, SecondaryLink, MatchScore, NextGrid, NextAction,
  UploadCard, UploadIcon, UploadBody, UploadTrack,
} from './styled';

/* Not answers: edits to what the title implied, made from the chips under
   the read-back. Their own stepIds so answerChip routes them aside from the
   ladder. */
const EDIT_FIELD = '__edit_field';
const EDIT_LEVEL = '__edit_level';
const EDIT_CHOICE = '__edit_choice';
const CONFIRM_CHOICE = '__confirm';

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
 * A textarea card inside the transcript: the job to tailor against, or the
 * resume to paste. Top-level so what has been typed survives the page
 * re-rendering around it.
 */
const TextCard = ({ spent, busy, rows, placeholder, cta, onSubmit, secondary }) => {
  const [value, setValue] = useState('');
  if (spent) return null;
  return (
    <Card>
      <InlineForm
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(value);
        }}
      >
        <PasteArea
          rows={rows}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={busy}
        />
        <ConvertActions>
          <InlinePrimary type="submit" disabled={busy || !value.trim()}>{cta}</InlinePrimary>
          {secondary && (
            <SecondaryLink type="button" onClick={secondary.onClick} disabled={busy}>
              {secondary.label}
            </SecondaryLink>
          )}
        </ConvertActions>
      </InlineForm>
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

const ProfileCoach = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  /* A conversation left in this browser within the last day. Read once, in
     a lazy initialiser, so the first render already has it — restoring in an
     effect would flash the intro at someone who is mid-conversation. */
  const [restored] = useState(() => {
    const saved = loadConversation();
    if (saved) resumeIdSequence(saved.messages);
    return saved;
  });

  /* Restored straight away, with a small "Start over" under it. A blocking
     "pick up or start fresh?" question stood between a returning visitor and
     their own conversation, and the panel read 0% until they answered it.
     A second reload before answering also saved the empty page over the
     conversation it was offering back. */
  const [messages, setMessages] = useState(() => (restored ? restored.messages : []));
  const [draft, setDraft] = useState(() => (restored ? restored.draft : emptyDraft()));
  const [stepIndex, setStepIndex] = useState(() => (restored ? restored.stepIndex : -1));
  // The fix-in-place mode a "Fix it" tap opens: the next thing typed corrects
  // the role or the bullets instead of answering the next question.
  const [fixing, setFixing] = useState(null);
  const [searchParams] = useSearchParams();
  const { setToken, setUser } = useAuth();
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

  const dictation = useDictation({
    onText: setInput,
    onError: (code) => setError(code === 'not-allowed' || code === 'service-not-allowed'
      ? TEXT.DICTATE_DENIED
      : TEXT.DICTATE_FAILED),
  });

  const fileInputRef = useRef(null);
  const listEndRef = useRef(null);
  const composerRef = useRef(null);
  // Set for the one render after an in-place message update that must not
  // scroll the transcript (see the scroll effect below).
  const keepScrollRef = useRef(false);
  // The talk-or-type offer is made once per conversation, never again.
  const voiceOfferedRef = useRef(false);
  const voiceAvailableRef = useRef(false);
  const timersRef = useRef([]);
  // Read inside delayed callbacks so a chip tapped during the typing pause
  // still sees the draft the previous answer produced.
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);
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
    setMessages((prev) => [...prev, { id: nextId(), role: 'coach', text, ...extra }]);
  }, []);

  const pushMine = useCallback((text, extra = {}) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'me', text, ...extra }]);
  }, []);

  // Retire the chip row on a message once it has been answered, so the
  // transcript reads as history rather than as still-live controls.
  const spendChips = useCallback((messageId) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, spent: true } : m)));
  }, []);

  const askStep = useCallback((index, currentDraft) => {
    const step = LADDER[index];
    if (!step) return;
    // One event per step reached, so the funnel can be read step by step:
    // where people stop is the whole question about this flow.
    trackEvent('coach_step_shown', { step: step.id, imported: currentDraft?.importedFrom || 'none' });

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

    // The closing cards carry their own controls and wait on them.
    if (step.kind === 'tailor' || step.kind === 'convert' || step.kind === 'next') {
      setTyping(true);
      later(() => {
        setTyping(false);
        pushCoach(questionText(step, currentDraft), {
          hint: step.hint,
          [step.kind]: true,
          stepId: step.id,
        });
      }, TIMING.TYPING_MS);
      return;
    }

    setTyping(true);
    later(() => {
      setTyping(false);
      pushCoach(questionText(step, currentDraft), {
        hint: step.hint,
        stepId: step.id,
        chips: getChips(step, currentDraft),
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

  /**
   * Offer the call. Signed-in only: a voice button that ends at a sign-up
   * wall is worse than none, and guests have dictation in the composer.
   */
  const offerVoice = useCallback(() => {
    if (!voiceAvailableRef.current || !isAuthenticated) return false;
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

  /** Begin the questions at the first thing still missing. */
  const startLadderFrom = useCallback((draft0, { silent = false, from = 'start', ask = true } = {}) => {
    draftRef.current = draft0;
    setDraft(draft0);
    const at = Math.max(0, nextStepIndex(-1, draft0));
    setStepIndex(at);
    if (!silent) pushCoach(TEXT.GREETING, { hint: TEXT.GREETING_SUB });
    if (ask) askStep(at, draft0);
    /* ask: false leaves the ladder parked on the next gap without asking it,
       for a caller that has something to put on screen first — after a call,
       that is the upload offer. Whatever answers it picks up from here. */
    trackEvent('coach_started', { from, resumedAt: LADDER[at]?.id });
  }, [askStep, pushCoach]);

  /* Straight into the first question. A three-slide carousel and a "Build
     your AI profile" card used to stand here: four taps of marketing after
     the person had already clicked Get Started. */
  const startFresh = useCallback(() => {
    startLadderFrom({ ...emptyDraft(), account: !!isAuthenticated });
  }, [isAuthenticated, startLadderFrom]);

  /** "Start over", under the restored conversation. */
  const startOver = useCallback(() => {
    if (busy) return;
    timersRef.current.forEach(clearTimeout);
    clearConversation();
    setMessages([]);
    setFixing(null);
    setProbing(false);
    setStepIndex(-1);
    trackEvent('coach_restarted', {});
    later(startFresh, TIMING.ACK_MS);
  }, [busy, later, startFresh]);

  useEffect(() => {
    if (restored) {
      setMessages((prev) => [...prev, {
        id: nextId(), role: 'coach', text: TEXT.RESUMED, ephemeral: true, startOver: true,
      }]);
      trackEvent('coach_resumed', { atStep: LADDER[restored.stepIndex]?.id || 'start' });
      return;
    }
    /* Arriving back from email sign-up with nothing to continue: the
       conversation expired or was finished elsewhere. Their profile was
       published on the way, so send them to it rather than to a blank chat. */
    if (searchParams.get('continue') && isAuthenticated) {
      navigate(ROUTES.PORTFOLIO, { replace: true });
      return;
    }
    startFresh();
    // Intentionally once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* An account can appear mid-conversation — Google in the save card, or a
     return from email sign-up. The draft carries it, because the ladder's
     skip rules (save, coaching) read the draft. */
  useEffect(() => {
    if (!!draftRef.current.account === !!isAuthenticated) return;
    const next = { ...draftRef.current, account: !!isAuthenticated };
    draftRef.current = next;
    setDraft(next);
  }, [isAuthenticated]);

  /* Every answer, straight to storage. Cheap — a transcript is a few
     kilobytes of plain objects — and it is the difference between a dropped
     connection costing someone a moment and costing them the whole thing. */
  useEffect(() => {
    if (!messages.length) return;
    saveConversation({ draft, stepIndex, messages });
  }, [draft, stepIndex, messages]);

  useEffect(() => {
    // Some updates change a message in place (the edit chips, a card's own
    // state). Scrolling to the bottom there drags it out from under them.
    if (keepScrollRef.current) {
      keepScrollRef.current = false;
      return;
    }
    listEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, typing]);

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
    if (!isAuthenticated) saveGuestProfileDraft(resumeData);
    navigate(ROUTES.CREATE_FORM, { state: { source: 'coach', resumeData } });
  }, [isAuthenticated, navigate]);

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
    // What was read, shown back before anything else is asked — so a wrong
    // parse is caught here, not after it has been published.
    const said = { linkedin: TEXT.LINKEDIN_DONE, paste: TEXT.PASTE_DONE }[source] || TEXT.UPLOAD_DONE;
    pushCoach(said, { resume: nextDraft });
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

  const handleFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
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
      trackEvent('coach_import_failed', { code: err?.code || 'unknown' });
      // The server can tell a file that is not a resume from a parse that
      // failed, and a scan from a broken file. Each has a different way
      // forward, and pasting the text is first in the row for all of them.
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

  /** Paste the resume instead of uploading it. */
  const offerPaste = useCallback(() => {
    setMessages((prev) => [
      ...prev.map((m) => (m.paste && !m.spent ? { ...m, spent: true } : m)),
      { id: nextId(), role: 'coach', text: TEXT.PASTE_PROMPT, paste: true },
    ]);
  }, []);

  const submitPaste = useCallback(async (message, text) => {
    const body = String(text || '').trim();
    if (busy || message.spent) return;
    if (body.length < 200) {
      setError(TEXT.PASTE_TOO_SHORT);
      return;
    }
    setError('');
    setBusy(true);
    setTyping(true);
    spendChips(message.id);
    try {
      const { data } = isAuthenticated
        ? await profileAPI.parseResumeText(body)
        : await profileAPI.guestParseResumeText(body);
      setTyping(false);
      if (data?.success && data?.data) applyImport(data.data, 'paste');
      else offerImportAgain(TEXT.UPLOAD_FAILED);
    } catch (err) {
      setTyping(false);
      const said = err?.response?.data?.code === 'not_a_resume' ? err.response.data.error : TEXT.UPLOAD_FAILED;
      offerImportAgain(said);
    } finally {
      setBusy(false);
    }
  }, [applyImport, busy, isAuthenticated, offerImportAgain, spendChips]);

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

      pushCoach(review.opening || TEXT.ACK_DEFAULT, { review });
      probeQueueRef.current = (review.probes || []).slice(0, 2);
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
  }, [later, nextProbe, pushCoach]);

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
      advanceRef.current(index, nextDraft);
    } catch {
      setTyping(false);
      setBusy(false);
      trackEvent('coach_step_failed', { step: 'assess' });
      advanceRef.current(index, draftRef.current);
    }
  }, [pushCoach]);

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

  /**
   * The save, for anyone with an account — signed in before they started, or
   * just now through the card above. The tailored resume made during
   * onboarding is saved with it: it is the first of their free tailorings,
   * and the reason they signed up.
   */
  const runSave = useCallback(async (index) => {
    setBusy(true);
    setTyping(true);
    const d = draftRef.current;
    const resumeData = draftToResumeData(d);
    try {
      await profileAPI.createOrUpdateProfile(resumeData);
    } catch {
      setTyping(false);
      setBusy(false);
      trackEvent('coach_step_failed', { step: 'save' });
      pushCoach(COACH_TEXT.SAVE_FAILED);
      // Saving failed, so do not pretend it worked — hand them to the
      // editor, which has the full save path and can surface the real error.
      later(() => navigate(ROUTES.CREATE_FORM, { state: { source: 'coach', resumeData } }), TIMING.ACK_MS * 2);
      return;
    }

    let saved = d;
    const preview = d.tailorPreview;
    if (preview && !preview.saved) {
      try {
        await tailoredProfileAPI.save({
          jobTitle: preview.jobTitle || 'Tailored resume',
          companyName: preview.company || '',
          jobUrl: preview.jobUrl || undefined,
          tailoredData: preview.tailored,
          originalProfileSnapshot: resumeData,
          matchScore: typeof preview.match?.score === 'number' ? preview.match.score : null,
          skillGaps: (preview.tailored?._skillGaps || []).map((g) => ({ ...g, status: 'pending' })),
          learningPlan: preview.tailored?._learningPlan || null,
          fromOnboardingPreview: !!preview.madeAsGuest,
        });
        saved = { ...d, tailorPreview: { ...preview, saved: true } };
      } catch {
        // The profile is saved; losing the preview is not worth failing over.
        trackEvent('coach_step_failed', { step: 'save_tailored' });
      }
    }
    // The stash Register would have claimed is now saved; leaving it would
    // offer the same draft again on the next sign-up in this browser.
    clearGuestProfileDraft();
    draftRef.current = saved;
    setDraft(saved);
    setTyping(false);
    setBusy(false);
    trackEvent('coach_profile_saved', { imported: d.importedFrom || 'none', tailored: !!preview });
    pushCoach(COACH_TEXT.SAVE_DONE);
    advanceRef.current(index, saved);
  }, [later, navigate, pushCoach]);

  useEffect(() => {
    runnersRef.current = { review: runReview, assess: runAssess, build: runBuild, save: runSave };
  }, [runReview, runAssess, runBuild, runSave]);

  /* ─── Answering ────────────────────────────────────────────── */

  /* ─── Talking instead of typing ────────────────────────────── */

  const [lastSpoken, setLastSpoken] = useState(null);
  /* Whether this deployment can do voice. Asked once, publicly, before the
     choice is ever offered — an environment with no OpenAI key shows no
     voice option rather than one that fails on tap, and starts showing it
     the moment the key is set. */
  const [voiceAvailable, setVoiceAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    profileAPI.coachVoiceStatus()
      .then(({ data }) => {
        if (cancelled) return;
        voiceAvailableRef.current = !!data?.available;
        setVoiceAvailable(!!data?.available);
      })
      .catch(() => { if (!cancelled) setVoiceAvailable(false); });
    return () => { cancelled = true; };
  }, []);

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
      if (last?.spoken && last.role === line.role) {
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

  const onLearned = useCallback((fields) => {
    const clean = Object.fromEntries(
      Object.entries(fields || {}).filter(([, v]) => v !== null && v !== undefined && v !== '')
    );
    if (!Object.keys(clean).length) return;
    heardAnythingRef.current = true;
    const merged = applyBraindump(draftRef.current, clean);
    if (clean.target && !merged.target) merged.target = String(clean.target);
    draftRef.current = merged;
    setDraft(merged);
  }, []);

  /**
   * The call is over. Everything it heard is already in the draft, so this
   * only has to decide what the screen says next.
   */
  const onCallEnded = useCallback(() => {
    setLastSpoken(null);
    if (!heardAnythingRef.current) {
      pushCoach(TEXT.VOICE_NOTHING);
      later(() => startLadderFrom(draftRef.current, { silent: true, from: 'voice' }), TIMING.ACK_MS);
      return;
    }
    heardAnythingRef.current = false;
    const merged = draftRef.current;
    pushCoach(TEXT.VOICE_DONE);
    trackEvent('coach_voice_completed', { fields: Object.keys(merged).length });
    /* Park the ladder on the first gap, then make the handover Remi
       promised out loud: a file is the one thing a phone call cannot
       collect, so it is the first thing the screen asks for. Whichever
       chip they pick, the questions pick up from the gap underneath. */
    startLadderFrom(merged, { silent: true, from: 'voice', ask: false });
    later(
      () => offerImportAgain(TEXT.VOICE_HANDOVER, POST_CALL_IMPORT_CHOICES, { postCall: true }),
      TIMING.ACK_MS
    );
  }, [later, offerImportAgain, pushCoach, startLadderFrom]);

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
  const startTalking = useCallback(async () => {
    if (!isAuthenticated) {
      /* Not a dead end: the conversation is already saved in this browser,
         so signing in and coming back resumes it. Saying "you need an
         account" without a way to get one is how a product turns its own
         best moment into a shrug. */
      pushCoach(TEXT.VOICE_SIGNED_OUT, {
        stepId: VOICE_SIGNIN_CHOICE,
        chips: [
          { id: 'register', label: TEXT.VOICE_REGISTER },
          { id: 'signin', label: TEXT.VOICE_SIGNIN },
          { id: 'type', label: TEXT.VOICE_KEEP_TYPING },
        ],
        selected: [],
      });
      trackEvent('coach_voice_blocked', { reason: 'signed-out' });
      return false;
    }
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
      trackEvent('coach_voice_started', { maxMinutes: data.maxSessionMinutes || null });
      /* The plan's allowance for this call. The server counts it when the
         call starts; ending it here is what makes the count true. */
      if (data.maxSessionMinutes > 0) later(() => voice.stop(), data.maxSessionMinutes * 60 * 1000);
      return true;
    } catch (err) {
      if (err?.response?.status === 429) {
        pushCoach(err.response.data?.message || TEXT.VOICE_FAILED);
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
  }, [isAuthenticated, later, pushCoach, voice]);

  /* ─── The title, read back ─────────────────────────────────── */

  /* Field and level are worked out from the title and shown back under it
     as chips. Nothing waits on them: the next question follows at once, and
     the chips stay there for anyone who wants to correct the guess. */
  const acknowledgeTitle = useCallback((d) => {
    const field = sectorLabel(d.sector);
    const level = levelLabel(d.sector, d.level);
    pushCoach(TEXT.TITLE_ACK(draftToProfileShape(d).title, field, level), {
      stepId: EDIT_CHOICE,
      chips: [
        { id: 'field', label: TEXT.EDIT_FIELD(field) },
        { id: 'level', label: TEXT.EDIT_LEVEL(level) },
      ],
      selected: [],
      // Optional controls, not a question: they never block the ladder.
      keepLive: true,
    });
  }, [pushCoach]);

  const editTitleField = useCallback((which) => {
    const sector = draftRef.current.sector;
    pushCoach(which === 'field' ? TEXT.EDIT_PICK_FIELD : TEXT.EDIT_PICK_LEVEL, {
      stepId: which === 'field' ? EDIT_FIELD : EDIT_LEVEL,
      chips: which === 'field'
        ? sectorChips(true)
        : levelsFor(sector).map((l) => ({ id: l.id, label: l.label })),
      selected: [],
    });
  }, [pushCoach]);

  /* ─── Read back, fix in place ──────────────────────────────── */

  /* Facts are read back once before they settle onto the resume. The coach
     used to write them silently and sometimes wrongly — a duplicate job, a
     start month nobody gave — and the person found out at the end. */
  const showConfirm = useCallback((kind, index, d) => {
    const row = (d.experience || [])[0];
    if (!row) {
      advanceRef.current(index, d);
      return;
    }
    const lines = kind === 'bullets' ? latestBullets(d) : [];
    if (kind === 'bullets' && !lines.length) {
      advanceRef.current(index, d);
      return;
    }
    pushCoach(kind === 'role' ? TEXT.CONFIRM_ROLE(roleConfirmText(row)) : TEXT.CONFIRM_BULLETS, {
      stepId: CONFIRM_CHOICE,
      confirmFor: { kind, index },
      bullets: lines,
      chips: [
        { id: 'yes', label: TEXT.CONFIRM_YES },
        { id: 'fix', label: TEXT.CONFIRM_FIX },
      ],
      selected: [],
    });
  }, [pushCoach]);

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
    if (message.stepId === EDIT_CHOICE) {
      editTitleField(chip.id);
      return;
    }
    if (message.stepId === EDIT_FIELD || message.stepId === EDIT_LEVEL) {
      if (message.spent) return;
      if (chip.id === MORE_SECTORS_CHIP.id) return;
      spendChips(message.id);
      pushMine(chip.label);
      const patch = message.stepId === EDIT_FIELD
        // A new field can make the old level meaningless (an Apprentice is
        // not a tech rung), so it is re-read from the title.
        ? deriveFromTitle({ ...draftRef.current, sector: chip.id, level: '' })
        : { ...draftRef.current, level: chip.id };
      draftRef.current = patch;
      setDraft(patch);
      pushCoach(`${TEXT.EDIT_DONE} ${draftToProfileShape(patch).title}.`);
      trackEvent('coach_title_edited', { what: message.stepId === EDIT_FIELD ? 'field' : 'level' });
      return;
    }
    if (message.stepId === CONFIRM_CHOICE) {
      if (message.spent || busy) return;
      spendChips(message.id);
      pushMine(chip.label);
      const { kind, index: at } = message.confirmFor || {};
      trackEvent('coach_confirm', { kind, answer: chip.id });
      if (chip.id === 'fix') {
        setFixing({ kind, index: at });
        pushCoach(kind === 'role' ? TEXT.FIX_ROLE : TEXT.FIX_BULLETS);
        composerRef.current?.focus();
        return;
      }
      setFixing(null);
      later(() => advanceRef.current(at, draftRef.current), TIMING.ACK_MS);
      return;
    }
    if (message.stepId === VOICE_CHOICE) {
      if (message.spent) return;
      pushMine(chip.label);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, spent: true } : m)));
      if (chip.id === 'talk') {
        startTalking().then((started) => {
          /* Declined or misconfigured: the questions carry on. Signed out is
             the exception — that path puts its own choice on screen, and
             asking the next question underneath it would bury it. */
          if (!started && isAuthenticated) {
            later(() => askStep(stepIndex, draftRef.current), TIMING.ACK_MS);
          }
        });
      } else {
        later(() => askStep(stepIndex, draftRef.current), TIMING.ACK_MS);
      }
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

    // Multi-select: accumulate on the message, commit on Continue.
    if (step.kind === 'multi') {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== message.id) return m;
        const has = m.selected.includes(chip.id);
        return { ...m, selected: has ? m.selected.filter((s) => s !== chip.id) : [...m.selected, chip.id] };
      }));
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
        fileInputRef.current?.click();
        return;
      }
      if (chip.id === 'linkedin') {
        pushCoach(TEXT.LINKEDIN_PROMPT);
        setLinkedinOpen(true);
        return;
      }
      if (chip.id === 'paste') {
        offerPaste();
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
  }, [advance, askStep, busy, commit, editTitleField, isAuthenticated, later, navigate, offerPaste, pushCoach, pushMine, spendChips, startTalking, stepIndex]);

  const confirmMulti = useCallback((message) => {
    const step = LADDER.find((s) => s.id === message.stepId);
    if (!step || message.spent || busy) return;
    const index = LADDER.findIndex((s) => s.id === step.id);
    // In the order they were tapped: "tap your strongest first" is how the
    // top three get ranked, so the order is the answer.
    const chosen = message.selected
      .map((id) => message.chips.find((c) => c.id === id))
      .filter(Boolean);

    spendChips(message.id);
    pushMine(
      chosen.length ? chosen.map((c) => c.label).join(', ') : TEXT.SKIP_CHIP,
      { stepId: step.id }
    );

    // Skills chips carry their label as id; preference chips carry an id the
    // editor's dropdowns expect. Both are already the right value to store.
    const values = chosen.map((c) => c.id);
    if (step.assign === 'skills') {
      const merged = Array.from(new Set([...(draftRef.current.skills || []), ...values]));
      commit({ skills: merged }, index);
    } else {
      commit(step.assign ? { [step.assign]: values } : {}, index);
    }
  }, [busy, commit, pushMine, spendChips]);


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

  /** Has this step's question been answered, however it got answered? */
  const stepAnswered = useCallback((step, draft) => {
    const value = step.assign ? draft[step.assign] : null;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return !!value.trim();
    return isAlreadyAnswered(step, draft);
  }, []);

  /**
   * @param {object} [opts]
   * @param {'role'|'bullets'} [opts.fix] a correction: what it says replaces
   *        the role or the bullets instead of filling gaps around them
   * @param {boolean} [opts.holdSay] return the reply instead of posting it,
   *        for a caller that may show a read-back card in its place
   */
  const runTurn = useCallback(async (text, { fix = null, holdSay = false } = {}) => {
    setBusy(true);
    setTyping(true);
    try {
      const { data } = await profileAPI.coachTurn({
        profile: draftToProfileShape(draftRef.current),
        missing: missingFields(draftRef.current),
        history: messagesRef.current
          .filter((m) => m.text)
          .slice(-10)
          .map((m) => ({ role: m.role, text: m.text })),
        message: text,
        /* Live voice is for signed-in users only. A guest who asks to talk is
           pointed at the mic, never walked into an account wall. */
        liveVoice: !voiceAvailableRef.current ? 'none' : (isAuthenticated ? 'live' : 'account'),
      });

      const learned = data?.learned || {};
      if (Object.keys(learned).length) {
        const merged = fix
          ? applyCorrection(draftRef.current, fix, learned)
          : applyBraindump(draftRef.current, learned);
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
      if (data?.say && !holdSay) pushCoach(data.say);
      if (data?.voice && voiceAvailableRef.current) {
        /* They asked to talk out loud, and they are signed in: same path as
           the button. Answering "I can only read text" next to a mic and a
           talk button is the coach contradicting the page it lives on. */
        setBusy(false);
        if (holdSay && data?.say) pushCoach(data.say);
        await startTalking();
        return { ok: true, awaiting: true, say: '' };
      }
      // Waiting needs something to wait on: an empty reply that claims to be
      // waiting would leave the conversation sitting there with no question.
      return { ok: true, awaiting: data?.awaiting !== false && !!String(data?.say || '').trim(), say: data?.say || '' };
    } catch {
      setTyping(false);
      return { ok: false, awaiting: false, say: '' };
    } finally {
      setBusy(false);
    }
  }, [isAuthenticated, pushCoach, startTalking]);

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
    // Sending throws the recogniser away rather than stopping it: stop()
    // finalises, and that last result arrives after the box has been cleared
    // and puts the whole spoken sentence straight back into it.
    if (dictation.listening) dictation.cancel();
    const text = input.trim();
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
    // canAnswer, not step.freeText: a probe question belongs to the review
    // step, which asks nothing itself and so declares freeText: false.
    if (!canAnswer(step, probing)) return;

    const liveMessage = [...messages].reverse().find((m) => m.stepId === step.id && !m.spent);

    setInput('');
    setError('');
    pushMine(text);

    const index = stepIndex;
    const current = draftRef.current;

    /* A correction — after "Fix it", or typed straight over a read-back that
       is still waiting. Either way it replaces what was read back. */
    const liveConfirm = [...messages].reverse().find((m) => m.stepId === CONFIRM_CHOICE && !m.spent);
    const fix = fixing || (liveConfirm ? liveConfirm.confirmFor : null);
    if (fix) {
      if (liveConfirm) spendChips(liveConfirm.id);
      const turn = await runTurn(text, { fix: fix.kind, holdSay: true });
      setFixing(null);
      if (!turn.ok) {
        setError(TEXT.ERROR_GENERIC);
        return;
      }
      showConfirm(fix.kind, fix.index, draftRef.current);
      return;
    }

    /* A plain job title is the answer as typed, and costs no model call.
       Field and level are read off it and shown back as chips. */
    if (step.id === 'title' && looksLikeTitle(text)) {
      const next = deriveFromTitle({ ...current, title: normalizeTitle(text) });
      draftRef.current = next;
      setDraft(next);
      acknowledgeTitle(next);
      advance(index, next);
      return;
    }

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
      if (!Object.keys(links).length) {
        setError(TEXT.ERROR_NO_LINK);
        setInput(text);
        return;
      }
      if (liveMessage) spendChips(liveMessage.id);
      commit(links, index);
      return;
    }

    const tapped = matchChip(text, getChips(step, current));
    if (tapped && step.assign) {
      if (liveMessage) spendChips(liveMessage.id);
      commit({ [step.assign]: tapped.id }, index);
      return;
    }

    const turn = await runTurn(text, { holdSay: !!step.confirm || step.id === 'title' });
    if (!turn.ok) {
      setError(TEXT.ERROR_GENERIC);
      return;
    }
    // A typed answer retires the row it answered, "Type my own" included —
    // it used to stay lit after the answer was already in.
    if (liveMessage) spendChips(liveMessage.id);

    // It asked them something. Wait for the answer rather than talking over it.
    if (turn.awaiting) {
      if ((step.confirm || step.id === 'title') && turn.say) pushCoach(turn.say);
      return;
    }

    /* Did that fill in what this step was for? If so the conversation moves
       on — through a read-back first where the answer was facts — and if not
       (they asked a question, or said something unrelated) the options come
       back without the question being restated at them. */
    const answered = stepAnswered(step, draftRef.current);
    if (answered && step.confirm) {
      showConfirm(step.confirm, index, draftRef.current);
      return;
    }
    if ((step.confirm || step.id === 'title') && turn.say && !answered) pushCoach(turn.say);
    if (answered && step.id === 'title') {
      const next = deriveFromTitle(draftRef.current);
      draftRef.current = next;
      setDraft(next);
      acknowledgeTitle(next);
      advance(index, next);
      return;
    }
    if (answered) advance(index, draftRef.current);
    else offerChipsAgain(step, null);
  }, [acknowledgeTitle, advance, busy, commit, dictation, fixing, offerChipsAgain, runTurn, showConfirm, stepAnswered, handleIntroText, input, messages, nextProbe, probing, pushCoach, pushMine, spendChips, stepIndex]);

  /* ─── The payoff: one job, tailored ────────────────────────── */

  const submitTailor = useCallback(async (message, value) => {
    const raw = String(value || '').trim();
    if (busy || message.spent || !raw) return;
    const isLink = /^(https?:\/\/|www\.)\S+$/i.test(raw);
    if (!isLink && raw.length < 200) {
      setError(COACH_TEXT.TAILOR_TOO_SHORT);
      return;
    }
    setError('');
    spendChips(message.id);
    pushMine(isLink ? raw : `${raw.slice(0, 90).replace(/\s+/g, ' ')}...`);
    setBusy(true);
    setTyping(true);
    pushCoach(COACH_TEXT.TAILOR_WORKING);
    const index = LADDER.findIndex((st) => st.id === 'tailor');
    const jobUrl = isLink ? (/^https?:/i.test(raw) ? raw : `https://${raw}`) : undefined;
    try {
      const { data } = await profileAPI.coachTailorPreview({
        profile: draftToProfileShape(draftRef.current),
        jobUrl,
        jobDescription: isLink ? undefined : raw,
      });
      if (!data?.success || !data?.tailored) throw new Error('empty');
      const preview = {
        tailored: data.tailored,
        match: data.match || null,
        jobTitle: data.jobTitle || '',
        company: data.company || '',
        jobUrl,
        // Made before there was an account to count it against; counted when
        // it is saved. A signed-in preview was counted by the endpoint.
        madeAsGuest: !isAuthenticated,
      };
      const next = { ...draftRef.current, tailorPreview: preview };
      draftRef.current = next;
      setDraft(next);
      setTyping(false);
      const score = typeof preview.match?.score === 'number' ? Math.round(preview.match.score) : null;
      const role = [preview.jobTitle, preview.company && `at ${preview.company}`].filter(Boolean).join(' ');
      pushCoach(COACH_TEXT.TAILOR_DONE(score, role), { tailorResult: preview });
      // The activation event: a tailored resume for a real job.
      trackEvent('coach_tailored_resume', { score, source: isLink ? 'link' : 'text', authenticated: !!isAuthenticated });
      later(() => advanceRef.current(index, next), TIMING.ACK_MS);
    } catch (err) {
      setTyping(false);
      const code = err?.response?.data?.code;
      const status = err?.response?.status;
      trackEvent('coach_step_failed', { step: 'tailor', code: code || status || 'unknown' });
      const said = code === 'job_url_unreadable' ? COACH_TEXT.TAILOR_URL_FAILED
        : status === 429 ? COACH_TEXT.TAILOR_LIMIT
        : COACH_TEXT.TAILOR_FAILED;
      // Back on screen with the way forward, at the bottom where they are.
      pushCoach(said, { tailor: true, stepId: 'tailor' });
    } finally {
      setBusy(false);
    }
  }, [busy, isAuthenticated, later, pushCoach, pushMine, spendChips]);

  const skipTailor = useCallback((message) => {
    if (busy || message.spent) return;
    spendChips(message.id);
    pushMine(COACH_TEXT.TAILOR_SKIP);
    trackEvent('coach_tailor_skipped', {});
    advance(LADDER.findIndex((st) => st.id === 'tailor'), draftRef.current);
  }, [advance, busy, pushMine, spendChips]);

  /* ─── Saving: one tap, inside the chat ─────────────────────── */

  /**
   * Google, without leaving the conversation. The register page — password,
   * confirm password, a terms checkbox — was the last screen of onboarding,
   * reached after a navigation away from everything just built. Consent is
   * the single line under the button.
   */
  const handleGoogleSave = useCallback(async (payload, message) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await authAPI.googleRegister(
        payload?.credential ? { credential: payload.credential } : payload,
        'candidate',
        true
      );
      const { token, user } = data || {};
      if (!token || !user) throw new Error('no session');
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);
      trackEvent('register_completed', { role: user.role, method: 'google', via: 'coach' });
      if (message) spendChips(message.id);

      /* An account that already has a profile is not overwritten by a
         conversation. They get the editor, with this draft to merge. */
      if (user.hasProfile) {
        const resumeData = draftToResumeData(draftRef.current);
        pushCoach(COACH_TEXT.CONVERT_HAS_PROFILE);
        clearConversation();
        setBusy(false);
        later(() => navigate(ROUTES.CREATE_FORM, { state: { guestDraft: resumeData } }), TIMING.ACK_MS * 2);
        return;
      }

      const next = { ...draftRef.current, account: true };
      draftRef.current = next;
      setDraft(next);
      setBusy(false);
      advanceRef.current(LADDER.findIndex((st) => st.id === 'convert'), next);
    } catch (err) {
      setBusy(false);
      setError(err?.response?.data?.error || COACH_TEXT.CONVERT_FAILED);
    }
  }, [busy, later, navigate, pushCoach, setToken, setUser, spendChips]);

  /**
   * Email instead of Google, or an existing account. The draft is stashed for
   * Register to claim, and Register sends them back here to carry on.
   */
  const handleConvert = useCallback((mode) => {
    const finalDraft = draftRef.current;
    saveGuestProfileDraft(draftToResumeData(finalDraft), { source: 'coach', autoPublish: true });
    trackEvent('coach_convert_clicked', { mode, imported: finalDraft.importedFrom || 'none' });
    const back = encodeURIComponent('/profile/create?continue=1');
    navigate(mode === 'signin'
      ? `${ROUTES.LOGIN}?redirect=${back}`
      : `${ROUTES.REGISTER}?role=candidate&redirect=${back}`);
  }, [navigate]);

  /* Back from email sign-up or sign-in with the conversation still here:
     carry on from the save card as if Google had just finished. */
  const resumedAfterAuthRef = useRef(false);
  useEffect(() => {
    if (resumedAfterAuthRef.current || !isAuthenticated || !restored) return;
    if (LADDER[stepIndex]?.id !== 'convert') return;
    resumedAfterAuthRef.current = true;
    const next = { ...draftRef.current, account: true };
    draftRef.current = next;
    setDraft(next);
    setMessages((prev) => prev.map((m) => (m.convert ? { ...m, spent: true } : m)));
    later(() => advanceRef.current(stepIndex, next), TIMING.ACK_MS);
  }, [isAuthenticated, later, restored, stepIndex]);

  /* ─── Derived view state ───────────────────────────────────── */

  /* One score, the same function the editor and the dashboard use, so the
     number here is the number they see next. The chat used to re-score its
     own subset and said 86% where the editor said 67%. */
  const completion = useMemo(
    () => computeProfileCompletion(draftToProfileShape(draft)),
    [draft]
  );
  const left = useMemo(() => questionsLeft(stepIndex, draft), [stepIndex, draft]);
  const titleOptions = useMemo(() => autocompleteOptions('titles'), []);
  const skillOptions = useMemo(() => autocompleteOptions('skills'), []);

  const currentStep = LADDER[stepIndex];
  // The intro (stepIndex -1) has no question, but it does have a coach who
  // can answer one — see handleIntroText.
  const canType = (!currentStep ? stepIndex < 0 : canAnswer(currentStep, probing)) && !busy;

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

  const renderTailorResult = (preview) => {
    const { match, tailored } = preview;
    const score = typeof match?.score === 'number' ? Math.round(match.score) : null;
    return (
      <Card>
        {score !== null && (
          <>
            <CardLabel>{COACH_TEXT.MATCH_TITLE}</CardLabel>
            <VerdictRow>
              <MatchScore $score={score}>{score}%</MatchScore>
              {match.summary && <MarketNote>{match.summary}</MarketNote>}
            </VerdictRow>
          </>
        )}
        {!!match?.strengths?.length && (
          <>
            <CardLabel>{COACH_TEXT.MATCH_STRENGTHS}</CardLabel>
            <CardList>
              {match.strengths.slice(0, 4).map((item, i) => (
                <Finding key={`s${i}`} $tone="good"><b>{item}</b></Finding>
              ))}
            </CardList>
          </>
        )}
        {!!match?.gaps?.length && (
          <>
            <CardLabel style={{ marginTop: 16 }}>{COACH_TEXT.MATCH_GAPS}</CardLabel>
            <CardList>
              {match.gaps.slice(0, 4).map((item, i) => (
                <Finding key={`g${i}`} $tone="warn"><b>{item}</b></Finding>
              ))}
            </CardList>
          </>
        )}
        <CardLabel style={{ marginTop: 16 }}>{COACH_TEXT.TAILORED_TITLE}</CardLabel>
        <ResumeSheet>
          <ResumeName>{tailored?.title || draftToProfileShape(draft).title}</ResumeName>
          {tailored?.summary && <ResumeSection><p>{tailored.summary}</p></ResumeSection>}
          {(tailored?.experience || []).slice(0, 2).map((row, i) => (
            <ResumeEntry key={`t${i}`}>
              <strong>{[row.title, row.company].filter(Boolean).join(' · ')}</strong>
              {!!row.description && (
                <ul>
                  {String(row.description).split('\n').map((l) => l.replace(/^[•\-*]\s*/, '').trim())
                    .filter(Boolean).slice(0, 4).map((l, j) => <li key={j}>{l}</li>)}
                </ul>
              )}
            </ResumeEntry>
          ))}
        </ResumeSheet>
      </Card>
    );
  };

  const renderConvert = (message) => (
    <ConvertCard>
      <h4>{COACH_TEXT.CONVERT_TITLE}</h4>
      <p>{draft.tailorPreview ? COACH_TEXT.CONVERT_BODY_TAILORED : COACH_TEXT.CONVERT_BODY}</p>
      {!message.spent && (
        <>
          <GoogleAuthButton
            label={COACH_TEXT.CONVERT_GOOGLE}
            loading={busy}
            onSuccess={(payload) => handleGoogleSave(payload, message)}
            onError={() => { /* real failures surface from the API call */ }}
          />
          <ConvertActions>
            <ConvertSecondary type="button" onClick={() => handleConvert('register')} disabled={busy}>
              {COACH_TEXT.CONVERT_EMAIL}
            </ConvertSecondary>
            <ConvertSecondary type="button" onClick={() => handleConvert('signin')} disabled={busy}>
              {COACH_TEXT.CONVERT_SIGNIN}
            </ConvertSecondary>
          </ConvertActions>
          <ConvertNote>
            {COACH_TEXT.CONVERT_TERMS_PRE}
            <Link to={ROUTES.TERMS} target="_blank" rel="noopener noreferrer">{COACH_TEXT.CONVERT_TERMS}</Link>
            {COACH_TEXT.CONVERT_TERMS_AND}
            <Link to={ROUTES.PRIVACY} target="_blank" rel="noopener noreferrer">{COACH_TEXT.CONVERT_PRIVACY}</Link>
            {'. '}
            {COACH_TEXT.CONVERT_NOTE}
          </ConvertNote>
        </>
      )}
    </ConvertCard>
  );

  const [copied, setCopied] = useState(false);
  const renderNext = () => {
    const publicUrl = user?.id ? `${window.location.origin}${ROUTES.PUBLIC_PROFILE(user.id)}` : '';
    return (
      <Card>
        <CardLabel>{COACH_TEXT.NEXT_TITLE}</CardLabel>
        <NextGrid>
          <NextAction type="button" onClick={() => { trackEvent('coach_next', { to: 'portfolio' }); navigate(ROUTES.PORTFOLIO); }}>
            <PublicIcon fontSize="small" />
            <span>{COACH_TEXT.NEXT_PORTFOLIO}</span>
          </NextAction>
          {publicUrl && (
            <NextAction
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(publicUrl).then(() => setCopied(true)).catch(() => {});
                trackEvent('coach_next', { to: 'copy_link' });
              }}
            >
              <LinkIcon fontSize="small" />
              <span>{copied ? COACH_TEXT.NEXT_COPIED : COACH_TEXT.NEXT_COPY_LINK}</span>
            </NextAction>
          )}
          {/* After the first tailored resume, the extension is the next
              thing worth having: it does the same for every job they open. */}
          <NextAction type="button" onClick={() => { trackEvent('coach_next', { to: 'extension' }); navigate(ROUTES.EXTENSION); }}>
            <ExtensionIcon fontSize="small" />
            <span>{COACH_TEXT.NEXT_EXTENSION}</span>
            <small>{COACH_TEXT.NEXT_EXTENSION_WHY}</small>
          </NextAction>
          <NextAction type="button" onClick={() => { trackEvent('coach_next', { to: 'editor' }); navigate(ROUTES.CREATE_FORM, { state: { source: 'coach', resumeData: draftToResumeData(draft) } }); }}>
            <EditIcon fontSize="small" />
            <span>{COACH_TEXT.NEXT_EDIT}</span>
          </NextAction>
        </NextGrid>
      </Card>
    );
  };

  /* The side panel is the resume itself, filling in as they answer: each
     bullet appears as it is written. A list of field labels used to sit
     here, and location and the achievement never showed in it at all. */
  const renderPreview = () => {
    const shape = draftToProfileShape(draft);
    const sections = resumeSections(draft);
    const has = (key) => sections.some((sec) => sec.key === key);
    const prefs = preferenceLabels(draft);
    return (
      <PreviewSheet>
        <ResumeName>{shape.title || <PreviewPlaceholder>{TEXT.PREVIEW_HEADLINE}</PreviewPlaceholder>}</ResumeName>
        <ResumeMeta>
          {[draft.location, prefs].filter(Boolean).join(' · ') || <PreviewPlaceholder>{TEXT.PREVIEW_META}</PreviewPlaceholder>}
        </ResumeMeta>
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
        {!has('experience') && !has('projects') && (
          <ResumeSection><h4>Experience</h4><PreviewPlaceholder>{TEXT.PREVIEW_EXPERIENCE}</PreviewPlaceholder></ResumeSection>
        )}
        {!has('skills') && (
          <ResumeSection><h4>Skills</h4><PreviewPlaceholder>{TEXT.PREVIEW_SKILLS}</PreviewPlaceholder></ResumeSection>
        )}
        {!has('education') && (
          <ResumeSection><h4>Education</h4><PreviewPlaceholder>{TEXT.PREVIEW_EDUCATION}</PreviewPlaceholder></ResumeSection>
        )}
      </PreviewSheet>
    );
  };

  return (
    <PageContainer>
      <TopBar>
        <Logo onClick={() => navigate(ROUTES.HOME)} aria-label={TEXT.LOGO}>
          <BrandLogo />
        </Logo>
        <TopActions>
          {/* Shown when this server can place a call and someone is signed in
              to take it. Guests have the mic; a voice button that ends at a
              sign-up wall is worse than none. */}
          {voiceAvailable && isAuthenticated && (
            <TalkButton
              type="button"
              onClick={() => startTalking()}
              disabled={busy || voice.state !== VOICE_STATES.idle}
              title={TEXT.VOICE_START}
            >
              <TalkIcon />
              <span className="label">{TEXT.VOICE_START}</span>
            </TalkButton>
          )}
          {/* During the intro "skip" means skip the intro — bailing to the
              editor from here would hand over a completely empty draft. */}
          <TopButton
            type="button"
            onClick={() => finish(draft)}
            disabled={busy}
          >
            {TEXT.SKIP}
          </TopButton>
        </TopActions>
      </TopBar>

      <MobileStrip type="button" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
        <StripLabel>{completion.pct}% · {TEXT.QUESTIONS_LEFT(left)}</StripLabel>
        <StripBar $pct={completion.pct}><i /></StripBar>
      </MobileStrip>
      <MobilePanel $open={panelOpen}>{renderPreview()}</MobilePanel>

      <Body>
        <ChatColumn>
          <MessageList>
            <Thread>
              {messages.map((message) => (
                <React.Fragment key={message.id}>
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
                          aria-label={`${message.text} — ${TEXT.CHANGE_ANSWER}`}
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

                  {message.startOver && (
                    <ChipRow>
                      <Chip type="button" $ghost onClick={startOver} disabled={busy}>
                        {TEXT.START_OVER}
                      </Chip>
                    </ChipRow>
                  )}
                  {message.paste && (
                    <TextCard
                      spent={message.spent}
                      busy={busy}
                      rows={8}
                      placeholder={TEXT.PASTE_PLACEHOLDER}
                      cta={TEXT.PASTE_CTA}
                      onSubmit={(value) => submitPaste(message, value)}
                    />
                  )}
                  {!!message.bullets?.length && (
                    <Card>
                      <ResumeEntry>
                        <ul>{message.bullets.map((line, j) => <li key={j}>{line}</li>)}</ul>
                      </ResumeEntry>
                    </Card>
                  )}

                  {message.uploading && (
                    <UploadProgress
                      fileName={message.fileName}
                      done={!!message.uploadDone}
                      failed={!!message.uploadFailed}
                    />
                  )}
                  {message.review && renderReview(message.review)}
                  {message.assessment && renderAssessment(message.assessment)}
                  {message.resume && renderResume(message.resume)}
                  {message.tailor && (
                    <TextCard
                      spent={message.spent}
                      busy={busy}
                      rows={3}
                      placeholder={COACH_TEXT.TAILOR_PLACEHOLDER}
                      cta={COACH_TEXT.TAILOR_CTA}
                      onSubmit={(value) => submitTailor(message, value)}
                      secondary={{ label: COACH_TEXT.TAILOR_SKIP, onClick: () => skipTailor(message) }}
                    />
                  )}
                  {message.tailorResult && renderTailorResult(message.tailorResult)}
                  {message.convert && renderConvert(message)}
                  {message.next && renderNext()}

                  {!!message.chips?.length && (
                    <ChipRow>
                      {message.chips.map((chip) => (
                        <Chip
                          key={chip.id}
                          type="button"
                          disabled={(message.spent && !message.keepLive) || busy}
                          $spent={message.spent && !message.keepLive}
                          $ghost={String(chip.id).startsWith('__')}
                          $selected={message.selected?.includes(chip.id)}
                          onClick={() => answerChip(message, chip)}
                        >
                          {chip.label}
                        </Chip>
                      ))}
                      {message.multi && !message.spent && (
                        <Chip
                          type="button"
                          $primary={!!message.selected?.length}
                          $ghost={!message.selected?.length}
                          onClick={() => confirmMulti(message)}
                        >
                          {message.selected?.length ? TEXT.DONE_CHIP : TEXT.SKIP_CHIP}
                        </Chip>
                      )}
                      {message.optional && !message.multi && !message.spent && (
                        <Chip type="button" onClick={() => skipStep(message)}>
                          {TEXT.SKIP_CHIP}
                        </Chip>
                      )}
                    </ChipRow>
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
            {currentStep?.optional && !currentStep?.chipSet && (
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

            {dictation.listening && <ListeningNote role="status">{TEXT.LISTENING}</ListeningNote>}

            <Composer onSubmit={submitText}>
              <ComposerInput
                ref={composerRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={dictation.supported ? TEXT.INPUT_PLACEHOLDER_VOICE : TEXT.INPUT_PLACEHOLDER}
                disabled={!canType}
                aria-label={TEXT.INPUT_PLACEHOLDER}
                // Titles and skills are suggested as they are typed: "Senior
                // Backend Engineer" is three keystrokes, and the spelling is
                // the one recruiters search.
                list={currentStep?.autocomplete && !fixing ? `coach-${currentStep.autocomplete}` : undefined}
              />
              <datalist id="coach-titles">
                {titleOptions.map((t) => <option key={t} value={t} />)}
              </datalist>
              <datalist id="coach-skills">
                {skillOptions.map((t) => <option key={t} value={t} />)}
              </datalist>
              <IconButton
                type="button"
                $listening={dictation.listening}
                disabled={!dictation.supported || !canType}
                onClick={() => {
                  setError('');
                  dictation.toggle(input);
                }}
                title={!dictation.supported
                  ? TEXT.DICTATE_UNSUPPORTED
                  : dictation.listening ? TEXT.DICTATE_STOP : TEXT.DICTATE_START}
                aria-label={dictation.listening ? TEXT.DICTATE_STOP : TEXT.DICTATE_START}
                aria-pressed={dictation.listening}
              >
                <MicIcon fontSize="small" />
              </IconButton>
              <IconButton type="submit" $primary disabled={!canType || !input.trim()} aria-label={TEXT.SEND}>
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
              <PanelSub>{TEXT.QUESTIONS_LEFT(left)}</PanelSub>
            </div>
          </PanelHead>
          {renderPreview()}
        </SidePanel>
      </Body>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleFile}
        // Not supported in every browser, which is exactly why the import
        // chips stay live rather than relying on this to unstick the flow.
        onCancel={() => offerImportAgain(TEXT.UPLOAD_CANCELLED)}
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
