import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AutoAwesome as CoachIcon,
  Mic as MicIcon,
  Send as SendIcon,
  VolumeUp as VoiceIcon,
} from '@mui/icons-material';

import { useAuth } from '../../contexts/AuthContext';
import { profileAPI } from '../../services/api';
import { computeProfileCompletion } from '../../hooks/useProfileCompletion';
import { saveGuestProfileDraft } from '../../utils/guestDraft';
import { trackEvent } from '../../utils/analytics';
import BrandLogo from '../../components/BrandLogo';
import ConfirmModal from '../../components/ConfirmModal';
import LinkedInImportModal from '../ProfileCreation/LinkedInImportModal';

import {
  LADDER,
  ROUTES,
  TEXT,
  TIMING,
  PANEL_ITEMS,
  ALLOWED_FILE_TYPES,
  VALIDATION,
} from './constants';
import {
  emptyDraft,
  getChips,
  matchSector,
  matchChip,
  parseSkillList,
  needsAI,
  nextStepIndex,
  mergeInterpreted,
  attachBullets,
  seedFromImport,
  draftToResumeData,
  draftToProfileShape,
  panelState,
} from './coachLogic';
import {
  PageContainer, TopBar, Logo, TopActions, TopButton, Body,
  ChatColumn, MessageList, Thread, Row, CoachAvatar, Bubble, BubbleHint, Typing,
  ChipRow, Chip, QuickReplies, QuickReply,
  ComposerWrap, Composer, ComposerInput, IconButton, Footnote, ErrorNote,
  SidePanel, PanelHead, Meter, PanelTitle, PanelTier, PanelSub,
  PanelItem, PanelItemHead, Dot, PanelItemBody,
  MobileStrip, StripBar, StripLabel, MobilePanel,
} from './styled';

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
 *     signed-out visitor walk the whole ladder — see needsAI().
 *  2. No authenticated request may fire unprompted on this page. It is
 *     guest-reachable, and api.js's 401 interceptor force-redirects to
 *     /login outside the boot grace window, which would silently eject a
 *     guest mid-conversation. Every call below is behind a user action or
 *     an isAuthenticated check.
 */

let messageSeq = 0;
const nextId = () => { messageSeq += 1; return `m${messageSeq}`; };

const ProfileCoach = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [linkedinStatus, setLinkedinStatus] = useState({
    urlImportAvailable: false,
    oauthAvailable: false,
  });

  const fileInputRef = useRef(null);
  const listEndRef = useRef(null);
  const timersRef = useRef([]);
  // Read inside delayed callbacks so a chip tapped during the typing pause
  // still sees the draft the previous answer produced.
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

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

  const pushMine = useCallback((text) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'me', text }]);
  }, []);

  // Retire the chip row on a message once it has been answered, so the
  // transcript reads as history rather than as still-live controls.
  const spendChips = useCallback((messageId) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, spent: true } : m)));
  }, []);

  const askStep = useCallback((index, currentDraft) => {
    const step = LADDER[index];
    if (!step) return;
    setTyping(true);
    later(() => {
      setTyping(false);
      pushCoach(step.question, {
        hint: step.hint,
        stepId: step.id,
        chips: getChips(step, currentDraft),
        multi: step.kind === 'multi',
        selected: [],
        optional: !!step.optional,
      });
    }, TIMING.TYPING_MS);
  }, [later, pushCoach]);

  /* ─── Opening ──────────────────────────────────────────────── */

  useEffect(() => {
    pushCoach(TEXT.GREETING, { hint: TEXT.GREETING_SUB });
    setStepIndex(0);
    askStep(0, emptyDraft());
    trackEvent('coach_started', {});
    // Intentionally once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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

    // The summary is the one thing the conversation can't collect by asking.
    // Guests don't get it here — it's an AI call — but they lose nothing
    // permanent: the editor offers the same thing once they have an account.
    if (isAuthenticated) {
      try {
        const { data } = await profileAPI.coachSummary(finalDraft);
        if (data?.summary) withSummary = { ...finalDraft, summary: data.summary };
      } catch {
        // A missing summary is not worth blocking the handoff over.
      }
    }

    setBusy(false);
    trackEvent('coach_completed', {
      authenticated: !!isAuthenticated,
      imported: withSummary.importedFrom || 'none',
    });

    const resumeData = draftToResumeData(withSummary);
    if (!isAuthenticated) saveGuestProfileDraft(resumeData);
    navigate(ROUTES.CREATE_FORM, { state: { source: 'coach', resumeData } });
  }, [isAuthenticated, navigate]);

  const advance = useCallback((fromIndex, nextDraft) => {
    const next = nextStepIndex(fromIndex, nextDraft);
    if (next === -1) {
      setTyping(true);
      later(() => {
        setTyping(false);
        pushCoach(TEXT.FINISH_TITLE, { hint: TEXT.FINISH_SUB });
        finish(nextDraft);
      }, TIMING.TYPING_MS);
      return;
    }
    setStepIndex(next);
    askStep(next, nextDraft);
  }, [askStep, finish, later, pushCoach]);

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
    setTyping(true);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      // Parsing is free either way; the guest endpoint just skips the
      // Authorization header so a stale token can't 401 the upload.
      const { data } = isAuthenticated
        ? await profileAPI.uploadResume(formData)
        : await profileAPI.guestUploadResume(formData);

      setTyping(false);
      if (data?.success && data?.data) {
        applyImport(data.data, 'resume');
      } else {
        pushCoach(TEXT.UPLOAD_FAILED);
      }
    } catch {
      setTyping(false);
      pushCoach(TEXT.UPLOAD_FAILED);
    } finally {
      setBusy(false);
    }
  }, [advance, applyImport, isAuthenticated, pushCoach]);

  /* ─── The AI gate ──────────────────────────────────────────── */

  // Called when a guest types something only the model can read. Their work
  // is persisted first, so registering picks the draft straight back up
  // (Register.jsx → claimGuestDraftFor).
  const gateGuest = useCallback(() => {
    saveGuestProfileDraft(draftToResumeData(draftRef.current));
    trackEvent('coach_ai_gate_shown', {});
    setGateOpen(true);
  }, []);

  /* ─── Answering ────────────────────────────────────────────── */

  const answerChip = useCallback((message, chip) => {
    const step = LADDER.find((s) => s.id === message.stepId);
    if (!step || message.spent || busy) return;
    const index = LADDER.findIndex((s) => s.id === step.id);

    // Multi-select: accumulate on the message, commit on Continue.
    if (step.kind === 'multi') {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== message.id) return m;
        const has = m.selected.includes(chip.id);
        return { ...m, selected: has ? m.selected.filter((s) => s !== chip.id) : [...m.selected, chip.id] };
      }));
      return;
    }

    pushMine(chip.label);

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
      spendChips(message.id);
      advance(index, draftRef.current);
      return;
    }

    spendChips(message.id);
    commit(step.assign ? { [step.assign]: chip.id } : {}, index);
  }, [advance, busy, commit, pushCoach, pushMine, spendChips]);

  const confirmMulti = useCallback((message) => {
    const step = LADDER.find((s) => s.id === message.stepId);
    if (!step || message.spent || busy) return;
    const index = LADDER.findIndex((s) => s.id === step.id);
    const chosen = message.chips.filter((c) => message.selected.includes(c.id));

    spendChips(message.id);
    pushMine(chosen.length ? chosen.map((c) => c.label).join(', ') : TEXT.SKIP_CHIP);

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

  const submitText = useCallback(async (event) => {
    event?.preventDefault();
    const text = input.trim();
    const step = LADDER[stepIndex];
    if (!text || !step || busy) return;
    if (!step.freeText) return;

    const liveMessage = [...messages].reverse().find((m) => m.stepId === step.id && !m.spent);

    setInput('');
    setError('');
    pushMine(text);

    const index = stepIndex;
    const current = draftRef.current;
    const usesAI = needsAI(step, text, current);

    // A guest who types something only the model can read gets the sign-up
    // prompt — and the step's chips stay live behind it, so dismissing the
    // prompt drops them back into a conversation they can still finish by
    // tapping. Spending the chips here would strand them.
    if (usesAI && !isAuthenticated) {
      gateGuest();
      return;
    }

    if (liveMessage) spendChips(liveMessage.id);

    /* ── The free, local paths ── */
    if (!usesAI) {
      if (step.id === 'sector') {
        const matched = matchSector(text);
        commit(matched.title ? { sector: matched.sector, title: matched.title } : { sector: matched.sector }, index);
        return;
      }
      if (step.id === 'skills') {
        const merged = Array.from(new Set([...(current.skills || []), ...parseSkillList(text)]));
        commit({ skills: merged }, index);
        return;
      }
      const chip = matchChip(text, getChips(step, current));
      if (chip && step.assign) {
        commit({ [step.assign]: chip.id }, index);
        return;
      }
      // No aiStep declared: what they typed IS the value (a job title).
      commit(step.assign ? { [step.assign]: text } : {}, index);
      return;
    }

    /* ── The model path, which guests don't have ── */
    setBusy(true);
    setTyping(true);
    try {
      if (step.aiStep === 'bullets') {
      setFollowUpFor(null);
        const recent = (current.experience || [])[0] || {};
        const { data } = await profileAPI.coachBullets({
          title: recent.title || current.title,
          company: recent.company,
          answer: text,
        });
        const nextDraft = attachBullets(current, data?.bullets || [], text);
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        setTyping(false);
        setBusy(false);
        advance(index, nextDraft);
        return;
      }

      const { data } = await profileAPI.coachInterpret({
        stepId: step.aiStep,
        question: step.question,
        answer: text,
        context: { sector: current.sector, level: current.level, title: current.title },
      });

      const nextDraft = mergeInterpreted(current, step.aiStep, data?.fields || {}, {
        intoLatest: followUpFor === step.aiStep,
      });
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setTyping(false);
      setBusy(false);

      // The model couldn't find something the step needs — ask once, stay put.
      // Only once: a second miss advances rather than looping on someone who
      // has already told us they don't want to answer.
      if (data?.followUp && followUpFor !== step.aiStep) {
        setFollowUpFor(step.aiStep);
        pushCoach(data.followUp, { stepId: step.id, chips: [], optional: !!step.optional });
        return;
      }
      setFollowUpFor(null);
      advance(index, nextDraft);
    } catch (err) {
      setTyping(false);
      setBusy(false);
      // A rate-limited or failed turn must not strand the conversation —
      // keep what they typed and move on rather than dead-ending them.
      const limited = err?.response?.status === 429;
      setError(limited ? (err.response.data?.error || TEXT.ERROR_GENERIC) : TEXT.ERROR_GENERIC);
      setFollowUpFor(null);
      advance(index, current);
    }
  }, [advance, busy, commit, followUpFor, gateGuest, input, isAuthenticated, messages, pushCoach, pushMine, spendChips, stepIndex]);

  /* ─── Derived view state ───────────────────────────────────── */

  const completion = useMemo(
    () => computeProfileCompletion(draftToProfileShape(draft)),
    [draft]
  );
  const panel = useMemo(
    () => panelState(draft, completion.items),
    [draft, completion.items]
  );

  // What the panel shows next to each label once it's filled in.
  const panelValue = useCallback((key) => {
    switch (key) {
      case 'title':
        return draftToProfileShape(draft).title;
      case 'lookingFor': {
        const parts = [...(draft.roleTypes || []), draft.workStyle].filter(Boolean);
        return parts.join(', ');
      }
      case 'skills':
        return (draft.skills || []).slice(0, 4).join(', ');
      case 'exp': {
        const row = (draft.experience || [])[0];
        return row ? [row.title, row.company].filter(Boolean).join(' at ') : '';
      }
      case 'edu': {
        const row = (draft.education || [])[0];
        return row ? [row.degree, row.institution].filter(Boolean).join(', ') : '';
      }
      default:
        return '';
    }
  }, [draft]);

  const currentStep = LADDER[stepIndex];
  const canType = !!currentStep?.freeText && !busy;

  const renderPanelItems = () => PANEL_ITEMS.map((item) => {
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
        <TopActions>
          {/* v1 has no voice. Shown but disabled so the affordance is
              discoverable and the layout doesn't shift when it ships. */}
          <TopButton type="button" disabled $muted title={TEXT.VOICE_COMING_SOON}>
            <VoiceIcon fontSize="small" />
            <span className="label">{TEXT.VOICE_ON}</span>
          </TopButton>
          <TopButton type="button" onClick={() => finish(draft)} disabled={busy}>
            {TEXT.SKIP}
          </TopButton>
        </TopActions>
      </TopBar>

      <MobileStrip type="button" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
        <StripLabel>{completion.pct}% · {completion.label}</StripLabel>
        <StripBar $pct={completion.pct}><i /></StripBar>
      </MobileStrip>
      <MobilePanel $open={panelOpen}>{renderPanelItems()}</MobilePanel>

      <Body>
        <ChatColumn>
          <MessageList>
            <Thread>
              {messages.map((message) => (
                <React.Fragment key={message.id}>
                  <Row $mine={message.role === 'me'}>
                    {message.role === 'coach' && (
                      <CoachAvatar aria-hidden="true"><CoachIcon htmlColor="#fff" /></CoachAvatar>
                    )}
                    <Bubble $mine={message.role === 'me'}>
                      {message.text}
                      {message.hint && <BubbleHint>{message.hint}</BubbleHint>}
                    </Bubble>
                  </Row>

                  {!!message.chips?.length && (
                    <ChipRow>
                      {message.chips.map((chip) => (
                        <Chip
                          key={chip.id}
                          type="button"
                          disabled={message.spent || busy}
                          $spent={message.spent}
                          $selected={message.selected?.includes(chip.id)}
                          onClick={() => answerChip(message, chip)}
                        >
                          {chip.label}
                        </Chip>
                      ))}
                      {message.multi && !message.spent && (
                        <Chip type="button" $selected onClick={() => confirmMulti(message)}>
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
                  <CoachAvatar aria-hidden="true"><CoachIcon htmlColor="#fff" /></CoachAvatar>
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

            <Composer onSubmit={submitText}>
              <ComposerInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={TEXT.INPUT_PLACEHOLDER}
                disabled={!canType}
                aria-label={TEXT.INPUT_PLACEHOLDER}
              />
              <IconButton type="button" disabled title={TEXT.VOICE_COMING_SOON} aria-label={TEXT.VOICE_COMING_SOON}>
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
        onChange={handleFile}
        // Not supported in every browser, which is exactly why the import
        // chips stay live rather than relying on this to unstick the flow.
        onCancel={() => pushCoach(TEXT.UPLOAD_CANCELLED)}
        style={{ display: 'none' }}
      />

      <LinkedInImportModal
        open={linkedinOpen}
        onClose={() => setLinkedinOpen(false)}
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
        title={TEXT.AI_GATE_TITLE}
        message={TEXT.AI_GATE_BODY}
        confirmText={TEXT.AI_GATE_CONFIRM}
        cancelText={TEXT.AI_GATE_CANCEL}
      />
    </PageContainer>
  );
};

export default ProfileCoach;
