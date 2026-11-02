import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { CircularProgress } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { profileAPI } from '../services/api';
import { extractApiError } from '../utils/apiError';
import { parseLimitError } from '../utils/aiLimit';
import {
  FlowDialog, PrimaryBtn, SecondaryBtn, Label, TextInput, Centered, Hint, ChangeCard, KeepBtn, ErrorText,
} from './flow/FlowLayout';
import NoteField from './flow/NoteField';

/**
 * Enhance with AI, in three steps:
 *   Analyze  - the profile is read first; each section reports what is wrong
 *              and offers its own actions, the recommended ones pre-selected.
 *   Rewrite  - one credit, the chosen actions as binding instructions.
 *   Review   - every change before and after, kept or skipped one at a time.
 *              Bullets still without a result ask for the figure instead of
 *              the model inventing one.
 *
 * The parent owns saving: it gets the kept changes and applies them to its
 * own record (see utils/enhanceApply.js).
 */

const SECTION_NAMES = { title: 'Title', summary: 'Summary', experience: 'Experience', education: 'Education' };
const STEPS = ['Analyze', 'Rewrite', 'Review'];

// ── Analyze ───────────────────────────────────────────────────────────────

const SectionCard = styled.div`
  margin-bottom: 14px;
  padding: 16px;
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid ${p => (p.$on ? '#5b5fd6' : '#e8e9f0')};
`;

const SectionHead = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;

  .box {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    margin-top: 4px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid ${p => (p.$on ? '#5b5fd6' : '#cfd2dc')};
    background: ${p => (p.$on ? '#5b5fd6' : '#fff')};
    color: #fff;
    svg { font-size: 18px; }
  }

  .text { flex: 1; min-width: 0; }
  .name { font-size: 18px; font-weight: 700; color: #13152a; }
  .meta {
    margin-top: 2px;
    font-size: 14px;
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge {
    flex-shrink: 0;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    background: ${p => (p.$issues ? '#fbeedd' : '#e3f4e8')};
    color: ${p => (p.$issues ? '#a55a12' : '#2f7a45')};
  }
`;

const Issues = styled.ul`
  margin: 14px 0 0;
  padding: 12px 14px 12px 30px;
  border-radius: 14px;
  background: #faf6ec;
  color: #4a3a1a;
  font-size: 15px;
  line-height: 1.45;

  li { margin: 4px 0; }
  li::marker { color: #d0822e; }
`;

const Ask = styled.div`
  margin: 16px 0 10px;
  font-size: 14.5px;
  font-weight: 600;
  color: #5a5e7a;
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1.5px solid ${p => (p.$on ? '#5b5fd6' : '#e2e4ec')};
  background: ${p => (p.$on ? '#f0f0fc' : '#fff')};
  color: ${p => (p.$on ? '#4b4fc4' : p.$muted ? '#9ca3af' : '#13152a')};
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;

  svg { font-size: 17px; }
`;

// Role cards inside Experience: one per job, each with its own choices.
const RoleCard = styled.div`
  margin-top: 12px;
  padding: 14px;
  border-radius: 14px;
  border: 1.5px solid ${p => (p.$on ? '#c9caf5' : '#eceef4')};
  background: ${p => (p.$on ? '#fafaff' : '#fff')};

  .role-issues { margin: 10px 0 0; padding-left: 20px; font-size: 14.5px; line-height: 1.45; color: #4a3a1a; }
  .role-issues li::marker { color: #d0822e; }
`;

// Picking one of these clears the others in the same role.
const ROLE_EXCLUSIVE = { shorter: ['more_detail', 'trim'], more_detail: ['shorter', 'trim'], trim: ['shorter', 'more_detail'] };


// ── Review ────────────────────────────────────────────────────────────────




const ResultAsk = styled.label`
  display: block;
  margin-top: 14px;
  padding: 12px 14px 14px;
  border-radius: 14px;
  background: #f0f0fc;

  span { display: block; margin-bottom: 8px; font-size: 14.5px; font-weight: 600; color: #4b4fc4; }
  input { height: 46px; }
`;


// ── Component ─────────────────────────────────────────────────────────────

const initialChoices = (sections) => Object.fromEntries(
  Object.entries(sections || {}).map(([key, s]) => [key, {
    on: !!s.selected,
    actions: new Set(s.recommended || []),
    note: '',
    // Experience is chosen per role when the analysis lists roles.
    ...(Array.isArray(s.roles) ? {
      roles: Object.fromEntries(s.roles.map((r) => [r.index, {
        on: !!r.selected,
        actions: new Set(r.recommended || []),
        note: '',
      }])),
    } : {}),
  }])
);

export default function EnhanceFlow({
  open,
  onClose,
  profileData,
  runEnhance,
  onApply,
  initialResult = null,
  creditLabel = '1 credit',
  onLimit,
  // Called with a rewrite that finished after the dialog was closed, so the
  // parent can reopen it at Review instead of losing a paid-for result.
  onLateResult,
}) {
  const [step, setStep] = useState('analyze');
  const [analysis, setAnalysis] = useState(null);
  const [analyzeError, setAnalyzeError] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [choices, setChoices] = useState({});
  const [result, setResult] = useState(null);
  const [rewriteError, setRewriteError] = useState('');
  const [kept, setKept] = useState({});
  const [results, setResults] = useState({});
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const targetRef = useRef(null);
  const bodyRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;
  const stepRef = useRef(step);
  stepRef.current = step;
  // The parent can deliver a result after the dialog is hidden, so hiding a
  // running rewrite is safe there (the profile page; not the edit form).
  const canHide = !!onLateResult;

  const showResult = (data) => {
    setResult(data);
    setKept(Object.fromEntries((data?.changes || []).map((c) => [c.id, true])));
    setResults({});
    setStep('review');
  };

  const analyze = async () => {
    setAnalyzeError('');
    setAnalysis(null);
    try {
      const { data } = await profileAPI.analyzeForEnhancement(profileData);
      setAnalysis(data.sections);
      setChoices(initialChoices(data.sections));
    } catch (err) {
      const limit = parseLimitError(err);
      if (limit) { onLimit?.(limit); onClose?.(); return; }
      setAnalyzeError(extractApiError(err, 'Could not read your profile. Please try again.'));
    }
  };

  useEffect(() => {
    if (!open) return;
    setApplyError('');
    setRewriteError('');
    if (initialResult) {
      showResult(initialResult);
      return;
    }
    // Reopened while a hidden rewrite is still running: show it, don't restart.
    if (stepRef.current === 'rewrite') return;
    setStep('analyze');
    setResult(null);
    setTargetRole('');
    analyze();
    // Once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialResult]);

  useEffect(() => { bodyRef.current?.scrollTo?.(0, 0); }, [step]);

  const chosenSections = useMemo(
    () => Object.keys(SECTION_NAMES).filter((k) => choices[k]?.on),
    [choices]
  );

  const update = (key, fn) => setChoices((prev) => ({ ...prev, [key]: fn(prev[key]) }));

  // Experience is on while any role is; switching the section switches them all.
  const updateRole = (index, fn) => update('experience', (c) => {
    const roles = { ...c.roles, [index]: fn(c.roles[index]) };
    return { ...c, roles, on: Object.values(roles).some((r) => r.on) };
  });
  const toggleSection = (key) => update(key, (c) => {
    if (!c.roles) return { ...c, on: !c.on };
    const on = !c.on;
    return { ...c, on, roles: Object.fromEntries(Object.entries(c.roles).map(([i, r]) => [i, { ...r, on }])) };
  });
  const toggleRoleAction = (index, id) => updateRole(index, (r) => {
    const actions = new Set(r.actions);
    if (actions.has(id)) actions.delete(id);
    else {
      actions.add(id);
      for (const other of ROLE_EXCLUSIVE[id] || []) actions.delete(other);
    }
    return { ...r, on: true, actions };
  });

  // Words the transcriber should expect: the candidate's own names and terms.
  const dictationHints = useMemo(() => [
    profileData?.title,
    ...(profileData?.experience || []).flatMap((e) => [e.title || e.position, e.company]),
    ...(Array.isArray(profileData?.skills) ? profileData.skills : Object.values(profileData?.skills || {}).flat()).slice(0, 25),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '), [profileData]);

  const toggleAction = (key, action) => {
    if (action.needsTargetRole && !targetRole.trim()) {
      targetRef.current?.focus();
      return;
    }
    update(key, (c) => {
      const actions = new Set(c.actions);
      if (actions.has(action.id)) actions.delete(action.id); else actions.add(action.id);
      return { ...c, on: true, actions };
    });
  };

  const enhance = async () => {
    if (!chosenSections.length) return;
    const options = {
      targetRole: targetRole.trim() || undefined,
      sections: chosenSections,
      actions: Object.fromEntries(chosenSections.map((k) => [k, choices[k].roles
        ? {
          roles: Object.fromEntries(Object.entries(choices[k].roles)
            .filter(([, r]) => r.on)
            .map(([i, r]) => [i, { actions: [...r.actions], note: r.note.trim() }])),
        }
        : [...choices[k].actions]])),
      notes: Object.fromEntries(chosenSections.map((k) => [k, choices[k].note.trim()]).filter(([, v]) => v)),
    };
    setRewriteError('');
    setStep('rewrite');
    try {
      const data = await runEnhance(options);
      if (data === undefined) return; // finished in the background after the page closed
      if (!data?.success) throw new Error(data?.error || data?.message || 'Enhancement failed');
      if (!openRef.current) { onLateResult?.(data); return; }
      showResult(data);
    } catch (err) {
      const limit = parseLimitError(err);
      if (limit) { onLimit?.(limit); onClose?.(); return; }
      setRewriteError(extractApiError(err, 'The rewrite failed. No credit was used. Please try again.'));
      setStep('analyze');
    }
  };

  const changes = result?.changes || [];
  const keptChanges = changes.filter((c) => kept[c.id]);

  const apply = async () => {
    if (!keptChanges.length) return;
    setApplying(true);
    setApplyError('');
    try {
      let final = keptChanges;
      const asks = keptChanges
        .filter((c) => c.askResult && (results[c.id] || '').trim())
        .map((c) => ({ id: c.id, bullet: c.after, result: results[c.id].trim(), role: c.label }));
      let skippedResults = 0;
      if (asks.length) {
        try {
          const { data } = await profileAPI.addEnhanceResults(asks);
          const byId = new Map((data.items || []).map((x) => [x.id, x]));
          skippedResults = (data.items || []).filter((x) => !x.ok).length;
          final = keptChanges.map((c) => (byId.get(c.id)?.ok ? { ...c, after: byId.get(c.id).text } : c));
        } catch (_) {
          // The rewrite itself still applies; only the typed figures are lost.
          skippedResults = asks.length;
        }
      }
      await onApply(final, { skippedResults });
    } catch (err) {
      setApplyError(extractApiError(err, 'Could not save your changes. Please try again.'));
    } finally {
      setApplying(false);
    }
  };

  const subtitle = step === 'review' ? 'Review before saving' : step === 'rewrite' ? 'Rewriting your sections' : 'Choose what to improve in each section';
  const stepIndex = step === 'analyze' ? 0 : step === 'rewrite' ? 1 : 2;

  const renderAnalyze = () => {
    if (analyzeError) {
      return (
        <Centered>
          <span>{analyzeError}</span>
          <SecondaryBtn type="button" style={{ flex: 'none', padding: '0 24px' }} onClick={analyze}>Try again</SecondaryBtn>
        </Centered>
      );
    }
    if (!analysis) {
      return (
        <Centered>
          <CircularProgress size={32} sx={{ color: '#5b5fd6' }} />
          <strong>Reading your profile</strong>
          <span>Checking your title, summary, experience and education.</span>
        </Centered>
      );
    }
    return (
      <>
        {rewriteError && <ErrorText role="alert">{rewriteError}</ErrorText>}
        <Label as="label" htmlFor="enhance-target-role">Target role (optional)</Label>
        <TextInput
          id="enhance-target-role"
          ref={targetRef}
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          placeholder="e.g. Staff Software Engineer"
          maxLength={80}
        />
        <Label style={{ marginTop: 26 }}>What we found</Label>
        {Object.keys(SECTION_NAMES).map((key) => {
          const s = analysis[key];
          const c = choices[key];
          if (!s || !c) return null;
          const issueCount = s.issues.length;
          return (
            <SectionCard key={key} $on={c.on}>
              <SectionHead
                type="button"
                $on={c.on}
                $issues={issueCount > 0}
                aria-pressed={c.on}
                onClick={() => toggleSection(key)}
              >
                <span className="box">{c.on && <CheckIcon />}</span>
                <span className="text">
                  <span className="name">{SECTION_NAMES[key]}</span>
                  <span className="meta" style={{ display: 'block' }}>{issueCount || c.on ? s.meta : 'No issues found'}</span>
                </span>
                <span className="badge">{issueCount ? `${issueCount} issue${issueCount === 1 ? '' : 's'}` : 'Looks good'}</span>
              </SectionHead>
              {c.on && c.roles && s.roles && (
                <>
                  {issueCount > 0 && (
                    <Issues>
                      {s.issues.map((issue) => <li key={issue}>{issue}</li>)}
                    </Issues>
                  )}
                  <Ask>Choose what to do for each role</Ask>
                  {s.roles.map((role) => {
                    const r = c.roles[role.index];
                    if (!r) return null;
                    return (
                      <RoleCard key={role.index} $on={r.on}>
                        <SectionHead
                          type="button"
                          $on={r.on}
                          $issues={role.issues.length > 0}
                          aria-pressed={r.on}
                          onClick={() => updateRole(role.index, (x) => ({ ...x, on: !x.on }))}
                        >
                          <span className="box">{r.on && <CheckIcon />}</span>
                          <span className="text">
                            {/* Company first: long job titles wrapped to three lines on a phone. */}
                            <span className="name" style={{ fontSize: 16 }}>{role.company || role.title}</span>
                            <span className="meta" style={{ display: 'block' }}>{role.company ? role.title : role.meta}</span>
                            {role.company && <span className="meta" style={{ display: 'block' }}>{role.meta}</span>}
                          </span>
                          <span className="badge">{role.issues.length ? `${role.issues.length} issue${role.issues.length === 1 ? '' : 's'}` : 'Looks good'}</span>
                        </SectionHead>
                        {r.on && (
                          <>
                            {role.issues.length > 0 && (
                              <ul className="role-issues">{role.issues.map((i) => <li key={i}>{i}</li>)}</ul>
                            )}
                            <Chips style={{ marginTop: 12 }}>
                              {role.actions.map((a) => {
                                const on = r.actions.has(a.id);
                                return (
                                  <Chip key={a.id} type="button" $on={on} aria-pressed={on} onClick={() => toggleRoleAction(role.index, a.id)}>
                                    {on && <CheckIcon />}{a.label}
                                  </Chip>
                                );
                              })}
                            </Chips>
                            <NoteField
                              value={r.note}
                              onChange={(note) => updateRole(role.index, (x) => ({ ...x, note }))}
                              placeholder="Anything else for this role? e.g. mention the BFF work"
                              label={`Anything else for ${role.title}`}
                              hints={dictationHints}
                            />
                          </>
                        )}
                      </RoleCard>
                    );
                  })}
                </>
              )}
              {c.on && !(c.roles && s.roles) && (
                <>
                  {issueCount > 0 && (
                    <Issues>
                      {s.issues.map((issue) => <li key={issue}>{issue}</li>)}
                    </Issues>
                  )}
                  <Ask>What should AI do?</Ask>
                  <Chips>
                    {s.actions.map((a) => {
                      const on = c.actions.has(a.id);
                      const blocked = a.needsTargetRole && !targetRole.trim();
                      return (
                        <Chip
                          key={a.id}
                          type="button"
                          $on={on && !blocked}
                          $muted={blocked}
                          aria-pressed={on && !blocked}
                          title={blocked ? 'Add a target role above first' : undefined}
                          onClick={() => toggleAction(key, a)}
                        >
                          {on && !blocked && <CheckIcon />}
                          {a.label}
                        </Chip>
                      );
                    })}
                  </Chips>
                  <NoteField
                    value={c.note}
                    onChange={(note) => update(key, (x) => ({ ...x, note }))}
                    placeholder="Anything else? e.g. keep “Architect”"
                    label={`Anything else for ${SECTION_NAMES[key]}`}
                    hints={dictationHints}
                  />
                </>
              )}
            </SectionCard>
          );
        })}
      </>
    );
  };

  const renderRewrite = () => (
    <Centered>
      <CircularProgress size={32} sx={{ color: '#5b5fd6' }} />
      <strong>Rewriting {chosenSections.length} section{chosenSections.length === 1 ? '' : 's'}</strong>
      <span>
        {chosenSections.map((k) => SECTION_NAMES[k]).join(', ')}. This takes about a minute; nothing is saved until you review it.
        {canHide && ' You can keep working; we’ll let you know when it’s ready.'}
      </span>
    </Centered>
  );

  const renderReview = () => {
    if (!changes.length) {
      return (
        <Centered>
          <strong>Nothing worth changing</strong>
          <span>{result?.message || 'Your profile already does what you asked for. No credit was used.'}</span>
        </Centered>
      );
    }
    return (
      <>
        <Hint>Tap a change to keep or skip it. Nothing is saved until you apply.</Hint>
        {applyError && <ErrorText role="alert">{applyError}</ErrorText>}
        {changes.map((c) => {
          const isKept = !!kept[c.id];
          return (
            <ChangeCard key={c.id} $kept={isKept}>
              <div className="head">
                <span className="label">{c.label}</span>
                <KeepBtn
                  type="button"
                  $kept={isKept}
                  aria-pressed={isKept}
                  onClick={() => setKept((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                >
                  {isKept ? <><CheckIcon />Keep</> : 'Skip'}
                </KeepBtn>
              </div>
              {c.before && <p className="before">{c.before}</p>}
              <p className="after">{c.after}</p>
              {c.askResult && isKept && (
                <ResultAsk>
                  <span>Add a result to make this stronger</span>
                  <TextInput
                    value={results[c.id] || ''}
                    onChange={(e) => setResults((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    placeholder="e.g. response time, number of users"
                    maxLength={200}
                  />
                </ResultAsk>
              )}
            </ChangeCard>
          );
        })}
      </>
    );
  };

  const renderFooter = () => {
    if (step === 'rewrite') {
      return canHide
        ? <SecondaryBtn type="button" style={{ flex: 1 }} onClick={onClose}>Hide and keep working</SecondaryBtn>
        : null;
    }
    if (step === 'analyze') {
      if (!analysis) return null;
      const n = chosenSections.length;
      return (
        <PrimaryBtn type="button" onClick={enhance} disabled={!n}>
          {n ? `Enhance ${n} section${n === 1 ? '' : 's'}${creditLabel ? ` · ${creditLabel}` : ''}` : 'Pick a section to enhance'}
        </PrimaryBtn>
      );
    }
    if (step === 'review') {
      if (!changes.length) {
        return <PrimaryBtn type="button" onClick={onClose}>Close</PrimaryBtn>;
      }
      return (
        <>
          <SecondaryBtn type="button" onClick={() => setStep('analyze')} disabled={applying}>Back</SecondaryBtn>
          <PrimaryBtn type="button" onClick={apply} disabled={!keptChanges.length || applying}>
            {applying
              ? <CircularProgress size={20} sx={{ color: '#fff' }} />
              : keptChanges.length ? `Apply ${keptChanges.length} change${keptChanges.length === 1 ? '' : 's'}` : 'Keep a change to apply'}
          </PrimaryBtn>
        </>
      );
    }
    return null;
  };

  const footer = renderFooter();

  return (
    <FlowDialog
      open={open}
      onClose={onClose}
      title="Enhance with AI"
      subtitle={subtitle}
      steps={STEPS}
      stepIndex={stepIndex}
      busy={(step === 'rewrite' && !canHide) || applying}
      footer={footer}
      bodyRef={bodyRef}
    >
      {step === 'analyze' && renderAnalyze()}
      {step === 'rewrite' && renderRewrite()}
      {step === 'review' && renderReview()}
    </FlowDialog>
  );
}
