import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { CircularProgress } from '@mui/material';
import {
  Check as CheckIcon,
  Bolt as BoltIcon,
  Build as BuildIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { FlowDialog, PrimaryBtn, SecondaryBtn, ErrorText } from './flow/FlowLayout';

/**
 * Recruiter Review: the profile as a recruiter reads it (backend
 * services/resume/recruiterReview.js). While it runs, the steps it is on;
 * when it is ready, a verdict and three tabs:
 *   Quick wins - minutes each, no AI; each opens the screen that fixes it
 *   Improve    - rewrites; most open Enhance
 *   Strengths  - what would make a recruiter keep reading
 * "Mark done" is remembered in this browser per review, so progress
 * ("2 of 6 tips done") survives closing it.
 */

const STEPS = [
  { title: 'Reading your profile', detail: 'Title, summary, roles, skills and links' },
  { title: 'Screening it like a recruiter', detail: 'What stands out and what would make them pass' },
  { title: 'Writing your tips', detail: 'Each one with a way to fix it' },
];

const doneKey = (id) => `profileai_review_done:${id}`;
const loadDone = (id) => {
  try { return new Set(JSON.parse(localStorage.getItem(doneKey(id)) || '[]')); } catch (_) { return new Set(); }
};
const saveDone = (id, set) => {
  try { localStorage.setItem(doneKey(id), JSON.stringify([...set])); } catch (_) { /* per-browser convenience only */ }
};

const Progress = styled.div`
  margin-top: 16px;
  .bar { height: 6px; border-radius: 999px; background: #e5e7ef; overflow: hidden; }
  .fill { height: 100%; border-radius: inherit; background: #5b5fd6; transition: width 0.6s ease; }
  .label { margin-top: 8px; font-size: 13.5px; font-weight: 600; color: #4a4d63; }
`;

const StepList = styled.ol`
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e8e9f0;
  overflow: hidden;

  li { display: flex; align-items: flex-start; gap: 14px; padding: 16px; }
  li + li { border-top: 1px solid #f0f1f6; }
  li[data-state='active'] { background: #f7f7fd; }

  .mark {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    svg { font-size: 18px; }
  }
  li[data-state='done'] .mark { background: #22a05b; color: #fff; }
  li[data-state='active'] .mark { background: #6d5ce7; color: #fff; }
  li[data-state='todo'] .mark { background: #f1f2f6; color: #9ca3af; }

  .title { font-size: 16px; font-weight: 600; }
  li[data-state='done'] .title { color: #1f7a45; }
  li[data-state='todo'] .title { color: #9ca3af; font-weight: 500; }
  .detail { margin-top: 2px; font-size: 13.5px; color: #6b7280; }
`;

const Note = styled.p`
  margin: 0 2px;
  font-size: 14.5px;
  line-height: 1.5;
  color: #6b7280;
`;

const Tabs = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 14px;
  padding: 4px;
  border-radius: 16px;
  background: #eceef4;

  button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 42px;
    padding: 0 6px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: #6b7280;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }
  button[aria-selected='true'] { background: #fff; color: #13152a; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12); }
  .count {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: #e3e5ee;
    font-size: 12px;
    line-height: 20px;
    color: #4a4d63;
  }
  button[aria-selected='true'] .count { background: #fde9d4; color: #a55a12; }
`;

const Verdict = styled.div`
  margin-bottom: 14px;
  padding: 16px;
  border-radius: 18px;
  background: #f3f1ff;
  border: 1px solid #e2defa;

  h4 { margin: 0 0 6px; font-size: 17px; font-weight: 700; color: #13152a; }
  p { margin: 0; font-size: 15px; line-height: 1.5; color: #4a4d63; }
  .done { margin-top: 10px; font-size: 14px; font-weight: 600; color: #6d5ce7; }
`;

const Tip = styled.div`
  display: flex;
  gap: 14px;
  margin-bottom: 12px;
  padding: 16px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e8e9f0;
  opacity: ${p => (p.$done ? 0.55 : 1)};

  .icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${p => p.$tint};
    color: ${p => p.$color};
    svg { font-size: 18px; }
  }
  .text { flex: 1; min-width: 0; }
  h4 { margin: 2px 0 6px; font-size: 16.5px; font-weight: 700; color: #13152a; }
  p { margin: 0; font-size: 15px; line-height: 1.5; color: #4a4d63; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .actions button {
    height: 40px;
    padding: 0 14px;
    border-radius: 10px;
    font: inherit;
    font-size: 14.5px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .fix { border: none; background: #5b5fd6; color: #fff; }
  .mark { border: 1.5px solid #e2e4ec; background: #fff; color: #13152a; }
  .mark svg { font-size: 16px; }
`;

export default function RecruiterReview({
  open, onClose, loading, error, review, onRetry, onHide, onAction, onEnhance,
}) {
  const [stage, setStage] = useState(0);
  const [tab, setTab] = useState('quick');
  const [done, setDone] = useState(new Set());

  // The read happens in one request; the steps mark where it is in it.
  useEffect(() => {
    if (!loading) return undefined;
    setStage(0);
    const timers = [setTimeout(() => setStage(1), 700), setTimeout(() => setStage(2), 9000)];
    return () => timers.forEach(clearTimeout);
  }, [loading]);

  useEffect(() => {
    if (!review) return;
    setDone(loadDone(review.id));
    setTab(review.quickWins.length ? 'quick' : review.improve.length ? 'improve' : 'strengths');
  }, [review]);

  const tips = useMemo(() => (review ? [...review.quickWins, ...review.improve] : []), [review]);
  const doneCount = tips.filter((t) => done.has(t.id)).length;

  const toggleDone = (id) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDone(next);
    saveDone(review.id, next);
  };

  if (!open) return null;

  if (loading || (!review && !error)) {
    const pct = Math.round(((stage + 0.5) / STEPS.length) * 100);
    return (
      <FlowDialog
        open={open}
        onClose={onHide}
        title="Recruiter Review"
        subtitle="A recruiter's read of your profile"
        headerExtra={(
          <Progress>
            <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
            <div className="label">Step {stage + 1} of {STEPS.length}</div>
          </Progress>
        )}
        footer={onHide && <SecondaryBtn type="button" style={{ flex: 1 }} onClick={onHide}>Hide and keep working</SecondaryBtn>}
      >
        <StepList>
          {STEPS.map((s, i) => {
            const state = i < stage ? 'done' : i === stage ? 'active' : 'todo';
            return (
              <li key={s.title} data-state={state}>
                <span className="mark">{state === 'done' ? <CheckIcon /> : state === 'active' ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : i + 1}</span>
                <span>
                  <div className="title">{s.title}</div>
                  {state === 'active' && <div className="detail">{s.detail}</div>}
                </span>
              </li>
            );
          })}
        </StepList>
        <Note>A review takes about 15 seconds. You can keep working; we'll let you know when it's ready.</Note>
      </FlowDialog>
    );
  }

  if (error) {
    return (
      <FlowDialog
        open={open}
        onClose={onClose}
        title="Recruiter Review"
        subtitle="A recruiter's read of your profile"
        headerExtra={null}
        footer={<PrimaryBtn type="button" onClick={onRetry}>Try again</PrimaryBtn>}
      >
        <ErrorText role="alert">{error}</ErrorText>
      </FlowDialog>
    );
  }

  const tabs = [
    { id: 'quick', label: 'Quick wins', count: review.quickWins.length },
    { id: 'improve', label: 'Improve', count: review.improve.length },
    { id: 'strengths', label: 'Strengths', count: review.strengths.length },
  ];

  const renderTip = (t, quick) => (
    <Tip key={t.id} $done={done.has(t.id)} $tint={quick ? '#fff1e6' : '#eef0ff'} $color={quick ? '#ea7a1f' : '#5b5fd6'}>
      <span className="icon">{quick ? <BoltIcon /> : <BuildIcon />}</span>
      <div className="text">
        <h4>{t.title}</h4>
        <p>{t.body}</p>
        <div className="actions">
          {t.action && !done.has(t.id) && (
            <button type="button" className="fix" onClick={() => onAction(t)}>{t.action}</button>
          )}
          <button type="button" className="mark" aria-pressed={done.has(t.id)} onClick={() => toggleDone(t.id)}>
            {done.has(t.id) ? <><CheckIcon />Done</> : 'Mark done'}
          </button>
        </div>
      </div>
    </Tip>
  );

  return (
    <FlowDialog
      open={open}
      onClose={onClose}
      title="Recruiter Review"
      subtitle="How a recruiter sees your profile"
      headerExtra={(
        <Tabs role="tablist" aria-label="Review">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}<span className="count">{t.count}</span>
            </button>
          ))}
        </Tabs>
      )}
      footer={onEnhance && <PrimaryBtn type="button" onClick={onEnhance}>Fix with Enhance</PrimaryBtn>}
    >
      <Verdict>
        <h4>Recruiter verdict: {review.verdict.headline}</h4>
        {review.verdict.summary && <p>{review.verdict.summary}</p>}
        {tips.length > 0 && <div className="done">{doneCount} of {tips.length} tips done</div>}
      </Verdict>
      {tab === 'quick' && review.quickWins.map((t) => renderTip(t, true))}
      {tab === 'improve' && review.improve.map((t) => renderTip(t, false))}
      {tab === 'strengths' && review.strengths.map((s) => (
        <Tip key={s.id} $tint="#e3f4e8" $color="#2f7a45">
          <span className="icon"><VerifiedIcon /></span>
          <div className="text"><h4>{s.title}</h4><p>{s.body}</p></div>
        </Tip>
      ))}
      {tab !== 'strengths' && !(tab === 'quick' ? review.quickWins : review.improve).length && (
        <Note>Nothing here. A recruiter wouldn't flag anything in this group.</Note>
      )}
    </FlowDialog>
  );
}
