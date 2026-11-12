import React, { useState } from 'react';
import styled from 'styled-components';
import { CircularProgress } from '@mui/material';
import NoteField from '../../components/flow/NoteField';

/*
 * What the person can do about one point in the resume review: let the coach
 * fix it from what is already there, or add a few words (typed or spoken)
 * and have it fixed with those. The rewrite shows here, under the point,
 * and lands on the profile only when they tap "Use this".
 */

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
`;

const Action = styled.button`
  border: 1.5px solid ${({ $primary }) => ($primary ? '#5b5fd6' : '#d9dbe5')};
  background: ${({ $primary }) => ($primary ? '#5b5fd6' : '#fff')};
  color: ${({ $primary }) => ($primary ? '#fff' : '#3b3f8f')};
  border-radius: 999px;
  padding: 7px 14px;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  min-height: 36px;

  &:disabled { opacity: 0.55; cursor: default; }
`;

const Proposal = styled.div`
  margin-top: 10px;
  padding: 12px 14px;
  border: 1px solid #c7c8f5;
  border-radius: 12px;
  background: #f7f7ff;

  b { display: block; font-size: 0.78rem; font-weight: 700; color: #6c6c86; margin-bottom: 2px; }
  p { margin: 0 0 8px; font-size: 0.95rem; line-height: 1.45; color: #1a1a2e; }
  ul { margin: 0 0 8px; padding-left: 18px; font-size: 0.93rem; line-height: 1.45; color: #1a1a2e; }
`;

const Note = styled.p`
  margin: 10px 0 0;
  font-size: 0.9rem;
  color: ${({ $bad }) => ($bad ? '#b45309' : '#15803d')};
`;

/** True when the plan holds any text to show. */
const hasChange = (plan) => !!(plan && (plan.headline || plan.summary || plan.roles?.length || plan.skills?.length));

export default function FindingFix({ finding, onPlan, onApply }) {
  // idle | detail | working | ready | none | error | applied
  const [mode, setMode] = useState('idle');
  const [detail, setDetail] = useState('');
  const [plan, setPlan] = useState(null);

  const run = async (extra) => {
    setMode('working');
    try {
      const next = await onPlan(finding, extra);
      if (!hasChange(next)) { setMode('none'); return; }
      setPlan(next);
      setMode('ready');
    } catch {
      setMode('error');
    }
  };

  if (mode === 'applied') return <Note>Added to your profile.</Note>;

  const working = mode === 'working';
  return (
    <>
      {(mode === 'idle' || mode === 'none' || mode === 'error') && (
        <>
          <Row>
            <Action type="button" $primary onClick={() => run('')}>Fix it for me</Action>
            <Action type="button" onClick={() => setMode('detail')}>Add detail</Action>
          </Row>
          {mode === 'none' && (
            <Note $bad>
              I cannot fix this one honestly from what is on your profile. Add a few details and I will.
            </Note>
          )}
          {mode === 'error' && <Note $bad>That did not work. Try again in a moment.</Note>}
        </>
      )}

      {mode === 'detail' && (
        <>
          <NoteField
            multiline
            value={detail}
            onChange={setDetail}
            maxLength={1000}
            label="Add detail for this fix"
            placeholder="Tell me what is true, in your own words"
            hints={`${finding.what || ''}`.slice(0, 120)}
          />
          <Row>
            <Action type="button" $primary disabled={!detail.trim()} onClick={() => run(detail)}>
              Fix with this
            </Action>
            <Action type="button" onClick={() => setMode('idle')}>Cancel</Action>
          </Row>
        </>
      )}

      {working && (
        <Row style={{ alignItems: 'center' }}>
          <CircularProgress size={16} sx={{ color: '#5b5fd6' }} />
          <span style={{ fontSize: '0.9rem', color: '#6c6c86' }}>Writing the fix</span>
        </Row>
      )}

      {mode === 'ready' && plan && (
        <>
          <Proposal>
            {plan.headline && (<><b>Headline</b><p>{plan.headline}</p></>)}
            {plan.summary && (<><b>Summary</b><p>{plan.summary}</p></>)}
            {(plan.roles || []).map((r) => (
              <React.Fragment key={r.index}>
                <b>{[r.title, r.company].filter(Boolean).join(' at ') || 'Role'}</b>
                <ul>{r.bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}</ul>
              </React.Fragment>
            ))}
            {!!plan.skills?.length && (<><b>Skills to add</b><p>{plan.skills.join(', ')}</p></>)}
          </Proposal>
          <Row>
            <Action type="button" $primary onClick={() => { onApply(plan); setMode('applied'); }}>Use this</Action>
            <Action type="button" onClick={() => setMode('detail')}>Add detail and redo</Action>
            <Action type="button" onClick={() => { setPlan(null); setMode('idle'); }}>Skip</Action>
          </Row>
        </>
      )}
    </>
  );
}
