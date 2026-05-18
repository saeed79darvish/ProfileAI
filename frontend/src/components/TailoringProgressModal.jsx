import React, { useState, useEffect, useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Dialog, useMediaQuery } from '@mui/material';

const STEPS = [
  { label: 'Analyzing job description', subtitle: 'Extracting key requirements and keywords', icon: '🔍' },
  { label: 'Matching your skills & experience', subtitle: "Mapping your background to the role's requirements", icon: '🧩' },
  { label: 'Rewriting for keyword optimization', subtitle: 'Tailoring bullet points to align with ATS and recruiter expectations', icon: '✏️' },
  { label: 'Finalizing tailored profile', subtitle: 'Polishing and formatting the final resume', icon: '✨' },
];

const TIPS = [
  'ATS systems scan for keyword matches in the first 6 seconds',
  'Tailored resumes are 3x more likely to get an interview',
  'Quantified achievements stand out to hiring managers',
  'Mirroring the job description language improves ATS scores',
  'Including relevant certifications can boost your ranking',
];

// === Animations ===
const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const checkPop = keyframes`
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
`;

const miniProgress = keyframes`
  0% { width: 0%; }
  100% { width: 100%; }
`;

// === Styled Components ===
const Container = styled.div`
  display: flex;
  flex-direction: column;
`;

const HeaderSection = styled.div`
  padding: 28px 28px 20px;
  background: ${p => p.$done ? 'linear-gradient(135deg, #f0fdf4, #ecfdf5)' : 'linear-gradient(135deg, #f0f4ff, #eef2ff)'};
  transition: background 0.6s ease;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
`;

const IconCircleWrap = styled.div`
  position: relative;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
`;

const SpinRing = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  width: 64px;
  height: 64px;
  animation: ${spin} 2.5s linear infinite;
`;

const IconInner = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  background: white;
  transition: all 0.5s ease;

  ${p => p.$done && css`
    background: #10b981;
    color: white;
    font-size: 24px;
    width: 56px;
    height: 56px;
  `}
`;

const HeaderInfo = styled.div`
  flex: 1;

  h3 {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    color: ${p => p.$done ? '#15803d' : '#1a1a2e'};
    transition: color 0.5s;
  }

  .job-info {
    font-size: 14px;
    color: #6b7280;
    margin-top: 3px;
    line-height: 1.4;

    strong { color: #1a1a2e; font-weight: 700; }
  }
`;

const ProgressRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
`;

const ProgressLabel = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: ${p => p.$done ? '#15803d' : '#6b7280'};
`;

const ProgressPct = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: ${p => p.$done ? '#15803d' : '#3b82f6'};
`;

const ProgressBar = styled.div`
  height: 6px;
  border-radius: 4px;
  background: ${p => p.$done ? '#bbf7d0' : '#e5e7eb'};
  overflow: hidden;
  margin-bottom: 6px;
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 4px;
  background: ${p => p.$done
    ? '#10b981'
    : 'linear-gradient(90deg, #3b82f6, #6366f1, #3b82f6)'};
  background-size: 200% 100%;
  transition: width 0.6s ease;
  ${p => !p.$done && css`
    animation: ${shimmer} 2s linear infinite;
  `}
`;

const StepList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px 28px;
`;

const StepRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  animation: ${fadeIn} 0.3s ease;

  ${p => (p.$active || p.$justDone) && css`
    background: white;
    border: 1.5px solid #e5e7eb;
    border-radius: 14px;
    padding: 16px 18px;
    margin: 4px -4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  `}
`;

const StepCircle = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 700;
  transition: all 0.3s;

  ${p => p.$state === 'done' && css`
    background: #10b981;
    color: white;
    border-radius: 12px;
    animation: ${checkPop} 0.4s ease;
  `}

  ${p => p.$state === 'active' && css`
    background: white;
    border: 2px solid #3b82f6;
    color: #3b82f6;
    font-size: 18px;
  `}

  ${p => p.$state === 'pending' && css`
    background: #f3f4f6;
    color: #9ca3af;
    font-size: 14px;
  `}
`;

const StepContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const StepLabel = styled.div`
  font-size: 15px;
  font-weight: ${p => p.$active ? 700 : p.$done ? 600 : 400};
  color: ${p =>
    p.$done ? '#10b981'
    : p.$active ? '#1a1a2e'
    : '#9ca3af'};
  transition: color 0.3s;
`;

const StepSubtitle = styled.div`
  font-size: 13px;
  color: #6b7280;
  margin-top: 2px;
`;

const StepMiniBar = styled.div`
  height: 3px;
  border-radius: 2px;
  background: #e5e7eb;
  margin-top: 10px;
  overflow: hidden;
  width: 60%;
`;

const StepMiniBarFill = styled.div`
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #3b82f6, #6366f1);
  animation: ${miniProgress} 3.5s ease-in-out;
`;

const TipBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 28px 20px;
  padding: 12px 16px;
  border-radius: 12px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  animation: ${fadeIn} 0.4s ease;
`;

const TipIcon = styled.span`
  font-size: 18px;
  flex-shrink: 0;
`;

const TipText = styled.span`
  font-size: 13px;
  color: #92400e;
  font-style: italic;
  line-height: 1.4;
`;

const FooterBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: calc(100% - 56px);
  margin: 0 28px 24px;
  padding: 14px;
  border-radius: 14px;
  border: none;
  background: #1a1a2e;
  color: white;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #2d2b55;
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(26, 26, 46, 0.3);
  }

  .arrow { font-size: 18px; }
`;

// === Component ===
export default function TailoringProgressModal({ open, onMinimize, onViewResult, jobTitle, company, startFromStep = 0, maxStep = STEPS.length, completed = false }) {
  const [stepIdx, setStepIdx] = useState(startFromStep);
  const [tipIdx, setTipIdx] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState((startFromStep / STEPS.length) * 100);

  const isDone = stepIdx >= STEPS.length;

  // Normal auto-advance timer (stops one step before maxStep so last step stays "active" until API completes)
  useEffect(() => {
    if (!open) {
      setStepIdx(startFromStep);
      setSmoothProgress((startFromStep / STEPS.length) * 100);
      return;
    }
    setStepIdx(startFromStep);
    setSmoothProgress((startFromStep / STEPS.length) * 100);
    const interval = setInterval(() => {
      setStepIdx(prev => (prev < maxStep - 1 ? prev + 1 : prev));
    }, 3500);
    return () => clearInterval(interval);
  }, [open, startFromStep, maxStep]);

  // Smooth progress animation within each step
  useEffect(() => {
    if (isDone) { setSmoothProgress(100); return; }
    const stepStart = (stepIdx / STEPS.length) * 100;
    const stepEnd = ((stepIdx + 1) / STEPS.length) * 100;
    setSmoothProgress(stepStart);
    // Animate from stepStart toward stepEnd over the step duration
    const duration = 3500;
    const interval = 50;
    const increment = ((stepEnd - stepStart) * interval) / duration;
    let current = stepStart;
    const timer = setInterval(() => {
      current += increment;
      if (current >= stepEnd - 1) {
        setSmoothProgress(stepEnd - 1);
        clearInterval(timer);
      } else {
        setSmoothProgress(current);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [stepIdx, isDone]);

  // When API signals completed, fast-forward remaining steps
  useEffect(() => {
    if (!completed || isDone) return;
    const remaining = STEPS.length - stepIdx;
    if (remaining <= 0) { setStepIdx(STEPS.length); setSmoothProgress(100); return; }
    // Animate through remaining steps (700ms each for visibility)
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setStepIdx(prev => {
        const next = prev + 1;
        // Also drive smooth progress in sync
        setSmoothProgress((next / STEPS.length) * 100);
        return next;
      });
      if (step >= remaining) clearInterval(timer);
    }, 700);
    return () => clearInterval(timer);
  }, [completed]);

  // Rotate tips
  useEffect(() => {
    if (isDone) return;
    const interval = setInterval(() => {
      setTipIdx(prev => (prev + 1) % TIPS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isDone]);

  const progress = isDone ? 100 : Math.round(smoothProgress);
  const stepLabel = isDone ? 'All steps complete' : `Step ${stepIdx + 1} of ${STEPS.length}`;
  const isMobile = useMediaQuery('(max-width:768px)');

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ style: { borderRadius: isMobile ? 0 : 20, overflow: 'hidden' } }}
    >
      <Container>
        <HeaderSection $done={isDone}>
          <HeaderRow>
            <IconCircleWrap>
              {isDone ? (
                <IconInner $done>✓</IconInner>
              ) : (
                <>
                  <SpinRing viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="29" fill="none" stroke="#e0e7ff" strokeWidth="3" />
                    <circle cx="32" cy="32" r="29" fill="none" stroke="#3b82f6" strokeWidth="3"
                      strokeLinecap="round" strokeDasharray="45 137" />
                  </SpinRing>
                  <IconInner>{STEPS[stepIdx]?.icon || '🔍'}</IconInner>
                </>
              )}
            </IconCircleWrap>
            <HeaderInfo $done={isDone}>
              <h3>{isDone ? 'Tailoring Complete!' : 'Tailoring in Progress.'}</h3>
              {(jobTitle || company) && (
                <div className="job-info">
                  {jobTitle}{company ? <> at <strong>{company}</strong></> : ''}
                </div>
              )}
            </HeaderInfo>
          </HeaderRow>

          <ProgressBar $done={isDone}>
            <ProgressFill $done={isDone} style={{ width: `${progress}%` }} />
          </ProgressBar>
          <ProgressRow>
            <ProgressLabel $done={isDone}>{stepLabel}</ProgressLabel>
            <ProgressPct $done={isDone}>{Math.round(progress)}%</ProgressPct>
          </ProgressRow>
        </HeaderSection>

        <StepList>
          {STEPS.map((step, i) => {
            const state = i < stepIdx ? 'done' : i === stepIdx && !isDone ? 'active' : 'pending';
            const isActive = state === 'active';
            const isJustDone = !isDone && state === 'done' && i === stepIdx - 1;
            // When done, all are "done"
            const finalState = isDone ? 'done' : state;

            return (
              <StepRow key={i} $active={isActive} $justDone={isJustDone}>
                <StepCircle $state={finalState}>
                  {finalState === 'done' ? '✓' : finalState === 'active' ? step.icon : i + 1}
                </StepCircle>
                <StepContent>
                  <StepLabel $done={finalState === 'done'} $active={isActive}>
                    {step.label}
                  </StepLabel>
                  {isActive && (
                    <>
                      <StepSubtitle>{step.subtitle}</StepSubtitle>
                      <StepMiniBar>
                        <StepMiniBarFill key={stepIdx} />
                      </StepMiniBar>
                    </>
                  )}
                </StepContent>
              </StepRow>
            );
          })}
        </StepList>

        {!isDone && (
          <TipBar key={tipIdx}>
            <TipIcon>💡</TipIcon>
            <TipText>{TIPS[tipIdx]}</TipText>
          </TipBar>
        )}

        {isDone && (
          <FooterBtn onClick={onViewResult || onMinimize}>
            View Tailored Resume <span className="arrow">→</span>
          </FooterBtn>
        )}
      </Container>
    </Dialog>
  );
}
