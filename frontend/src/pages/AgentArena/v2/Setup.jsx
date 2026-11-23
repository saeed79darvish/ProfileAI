/* ApplyPilot v2 · first-time setup, 4 steps. Saved once, on Start:
   the backend starts finding jobs the moment job titles are saved, so
   saving halfway would start ApplyPilot before the user said so. */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { startPilot } from '../../../hooks/useApplyPilot';
import { useToast } from '../../../contexts/ToastContext';
import { T, Page, Wrap, Row, Col, H1, Muted, Btn, Loading, Banner } from './ui';
import { useCriteria, SECTIONS, JobsSection, WhereSection, AnswersSection, PaceSection, MatchCount, planSentence } from './criteria';

const STEP_COPY = [
  { h: 'What jobs do you want?', p: 'We filled this in from your profile. Change anything that isn’t right.' },
  { h: 'Where, and for how much?', p: 'We skip jobs that don’t match these.' },
  { h: 'Questions almost every application asks', p: 'Answer once. We only use what you tell us here or on your profile, and never guess.' },
  { h: 'How many, and how picky?', p: 'Nothing is sent until you check it and press Approve and send.' },
];

const Rail = styled.ol`
  display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0; padding: 0;
`;
const Step = styled.button.attrs({ type: 'button' })`
  display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px 0 6px;
  border-radius: 50px; border: 0; cursor: pointer; font: inherit; font-size: 14px; font-weight: 600;
  background: ${(p) => (p.$cur ? T.tint2 : 'transparent')}; color: ${(p) => (p.$cur ? T.brandInk : T.ink2)};
  &:disabled { cursor: default; opacity: 0.6; }
  span { display: inline-flex; width: 28px; height: 28px; border-radius: 50%; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; background: ${(p) => (p.$lit ? T.brand : '#ecebf3')}; color: ${(p) => (p.$lit ? '#fff' : T.ink2)}; }
`;
const Bar = styled.div`
  background: #fff; border-bottom: 1px solid ${T.line};
`;
const Plan = styled.section`
  border-radius: 16px; background: ${T.night}; color: #fff; padding: 22px 24px; display: flex; flex-direction: column; gap: 8px;
  p { margin: 0; font-size: 18px; line-height: 1.6; }
`;

export default function Setup() {
  const c = useCriteria({ autosave: false });
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!c.ready) return <Page><Loading /></Page>;
  const { s } = c;

  const blockers = {
    1: !s.roleTitles.length ? 'Add at least one job title.' : null,
    2: !s.workstyle.length ? 'Pick at least one way to work.' : null,
    3: !s.workAuthorization ? 'Tell us if you can work in the United States.' : (!String(s.phone || '').trim() ? 'Add a phone number. Most applications require one.' : null),
    4: null,
  };
  const canLeave = (n) => !blockers[n];
  const next = () => {
    if (!canLeave(step)) { setTried(true); return; }
    setTried(false);
    setStep(step + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const start = async () => {
    const firstBad = [1, 2, 3].find((n) => !canLeave(n));
    if (firstBad) { setStep(firstBad); setTried(true); return; }
    setBusy(true);
    try {
      await c.save();
      await startPilot();
      nav('/applypilot/dashboard?started=1');
    } catch (e) {
      setBusy(false);
      toast.error('Couldn’t save your setup. Check your connection and try again.');
    }
  };
  const plan = planSentence(s);

  return (
    <Page>
      <Bar>
        <Row $justify="space-between" style={{ maxWidth: 1240, margin: '0 auto', padding: '14px 32px' }}>
          <strong style={{ fontSize: 17 }}>Set up ApplyPilot</strong>
          <Rail aria-label="Setup steps">
            {SECTIONS.map((sec, i) => {
              const n = i + 1;
              const reachable = n <= step || [1, 2, 3].slice(0, n - 1).every(canLeave);
              return (
                <li key={sec.key}>
                  <Step $cur={step === n} $lit={n <= step} aria-current={step === n ? 'step' : undefined}
                    disabled={!reachable} onClick={() => reachable && setStep(n)}>
                    <span>{n < step ? '✓' : n}</span>{sec.title}
                  </Step>
                </li>
              );
            })}
          </Rail>
          <Link to="/applypilot/welcome" style={{ fontSize: 14, color: T.ink2 }}>Leave setup</Link>
        </Row>
      </Bar>
      <Wrap $max={1200}>
        <Row $align="flex-start" $gap={32}>
          <Col $gap={26} $flex="999 1 600px">
            <Col $gap={8}>
              <H1 $size={32}>{STEP_COPY[step - 1].h}</H1>
              <Muted $size={16}>{STEP_COPY[step - 1].p}</Muted>
            </Col>
            {tried && blockers[step] && <Banner $tone="warn" role="alert">{blockers[step]}</Banner>}
            {step === 1 && <JobsSection c={c} />}
            {step === 2 && <WhereSection c={c} />}
            {step === 3 && <AnswersSection c={c} showMissing={tried} />}
            {step === 4 && (
              <>
                <PaceSection c={c} />
                <Plan aria-label="Your plan">
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: '#b9b4e0' }}>YOUR PLAN</span>
                  <p>
                    Every day we'll look for <strong>{plan.titles}</strong> jobs, {plan.where}{plan.place ? ` near ${plan.place}` : ''},
                    paying at least <strong>${plan.salary}k</strong>, and get up to <strong>{plan.daily}</strong> applications ready
                    ({plan.fit}).
                  </p>
                </Plan>
              </>
            )}
            <Row $justify="space-between" style={{ paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
              {step > 1 ? <Btn onClick={() => setStep(step - 1)}>Back</Btn> : <span />}
              {step < 4
                ? <Btn $kind="primary" $size="lg" onClick={next}>Continue</Btn>
                : <Btn $kind="primary" $size="lg" onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Start ApplyPilot'}</Btn>}
            </Row>
          </Col>
          <Col $gap={16} $flex="1 1 300px" style={{ position: 'sticky', top: 16 }}>
            <MatchCount match={c.match} />
          </Col>
        </Row>
      </Wrap>
    </Page>
  );
}
