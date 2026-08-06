import React, { useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Dialog, useMediaQuery } from '@mui/material';

/**
 * The single progress modal for every long-running AI/upload flow.
 *
 * This replaces three components with four visual styles (TailoringProgressModal,
 * AIProcessingModal, and ProcessingModal — which itself forked into a stepped
 * light variant and a gradient-purple one). The tailoring design won because it
 * was the only one that told the user what is actually happening: named steps
 * with real progress, rather than a spinner and an indeterminate bar.
 *
 * Add a flow by adding a PRESETS entry — never by branching on styling.
 */

// Each preset supplies the step script and the rotating tips for one flow.
const PRESETS = {
  tailor: {
    heading: ['Tailoring in Progress', 'Tailoring Complete'],
    steps: [
      { label: 'Analyzing job description', subtitle: 'Extracting key requirements and keywords', icon: '🔍' },
      { label: 'Matching your skills & experience', subtitle: "Mapping your background to the role's requirements", icon: '🧩' },
      { label: 'Rewriting for keyword optimization', subtitle: 'Tailoring bullet points to align with ATS and recruiter expectations', icon: '✏️' },
      { label: 'Finalizing tailored profile', subtitle: 'Polishing and formatting the final resume', icon: '✨' },
    ],
    tips: [
      'ATS systems scan for keyword matches in the first 6 seconds',
      'Tailored resumes are 3x more likely to get an interview',
      'Quantified achievements stand out to hiring managers',
      'Mirroring the job description language improves ATS scores',
      'Including relevant certifications can boost your ranking',
    ],
  },

  enhance: {
    heading: ['Enhancing in Progress', 'Enhancement Complete'],
    steps: [
      { label: 'Reading your profile', subtitle: 'Understanding your background and voice', icon: '📖' },
      { label: 'Optimizing wording & impact', subtitle: 'Sharpening action verbs and clarity', icon: '✏️' },
      { label: 'Strengthening key sections', subtitle: 'Surfacing measurable achievements', icon: '💪' },
      { label: 'Polishing the final draft', subtitle: 'Final pass for tone and consistency', icon: '✨' },
    ],
    tips: [
      'We quantify achievements to make recruiters take notice',
      'Stronger action verbs and clearer impact, automatically',
      'Your tone and facts stay yours — we just sharpen them',
    ],
  },

  suggestions: {
    heading: ['Generating Suggestions', 'Suggestions Ready'],
    steps: [
      { label: 'Reviewing your profile', subtitle: 'Reading your experience and skills', icon: '📖' },
      { label: 'Benchmarking against top candidates', subtitle: 'Comparing with strong profiles in your field', icon: '📊' },
      { label: 'Spotting growth opportunities', subtitle: 'Finding the highest-leverage improvements', icon: '🎯' },
      { label: 'Writing your personalized tips', subtitle: 'Turning findings into concrete actions', icon: '💡' },
    ],
    tips: [
      'Tips are tailored to your target roles and level',
      'Act on the top suggestion first for the biggest lift',
      'A complete profile reaches the Top 10% faster',
    ],
  },

  gaps: {
    heading: ['Analyzing Skill Gaps', 'Analysis Complete'],
    steps: [
      { label: 'Reading the job requirements', subtitle: 'Extracting required skills and seniority', icon: '🔍' },
      { label: 'Comparing against your profile', subtitle: 'Matching your background to the role', icon: '🧩' },
      { label: 'Identifying gaps', subtitle: 'Finding what is missing or underspecified', icon: '🎯' },
      { label: 'Suggesting learning resources', subtitle: 'Recommending concrete ways to close them', icon: '📚' },
    ],
    tips: [
      'Closing one core gap often matters more than three minor ones',
      'Gaps framed as "in progress" still read well to recruiters',
      'Most roles list more requirements than they truly need',
    ],
  },

  resume: {
    heading: ['Processing Resume', 'Resume Processed'],
    steps: [
      { label: 'Reading your document', subtitle: 'Extracting text from the uploaded file', icon: '📄' },
      { label: 'Identifying sections', subtitle: 'Locating experience, skills and education', icon: '🔍' },
      { label: 'Extracting structured details', subtitle: 'Pulling out roles, dates and employers', icon: '🧩' },
      { label: 'Filling in your profile', subtitle: 'Mapping everything onto the form', icon: '✨' },
    ],
    tips: [
      'Review the parsed fields before saving — you have the final say',
      'A clean, single-column resume parses most accurately',
      'Dates in "Month Year" format are the easiest to read',
    ],
  },

  submit: {
    heading: ['Submitting Application', 'Application Submitted'],
    steps: [
      { label: 'Validating your details', subtitle: 'Checking everything required is present', icon: '✅' },
      { label: 'Attaching your resume', subtitle: 'Packaging your documents for the employer', icon: '📎' },
      { label: 'Sending to the employer', subtitle: 'Delivering your application', icon: '📤' },
      { label: 'Confirming receipt', subtitle: 'Waiting for acknowledgement', icon: '✨' },
    ],
    tips: [
      'Applications sent early in the week tend to get read sooner',
      'A tailored resume meaningfully improves your response rate',
      'You can track this application from My Jobs',
    ],
  },

  post: {
    heading: ['Enhancing Post', 'Post Enhanced'],
    steps: [
      { label: 'Reading your draft', subtitle: 'Understanding your message and tone', icon: '📖' },
      { label: 'Improving clarity & hook', subtitle: 'Making the opening earn attention', icon: '✏️' },
      { label: 'Optimizing for engagement', subtitle: 'Shaping it for how people actually read', icon: '📈' },
      { label: 'Final polish', subtitle: 'Tightening the wording', icon: '✨' },
    ],
    tips: [
      'Posts that open with a specific detail outperform generic ones',
      'Shorter paragraphs are far easier to read in a feed',
      'Your voice stays yours — we only sharpen the delivery',
    ],
  },

  screening: {
    heading: ['Screening Candidates', 'Screening Complete'],
    steps: [
      { label: 'Loading candidate pool', subtitle: 'Gathering applicants for this role', icon: '📥' },
      { label: 'Evaluating against requirements', subtitle: 'Scoring each candidate on fit', icon: '🧩' },
      { label: 'Ranking by match quality', subtitle: 'Ordering by strength of match', icon: '📊' },
      { label: 'Preparing shortlist', subtitle: 'Assembling your results', icon: '✨' },
    ],
    tips: [
      'Scores reflect fit against this role only, not overall quality',
      'Reviewing the top ten first is usually the best use of time',
      'You can adjust screening criteria and re-run at any point',
    ],
  },

  search: {
    heading: ['Searching Candidates', 'Search Complete'],
    steps: [
      { label: 'Interpreting your criteria', subtitle: 'Understanding what you are looking for', icon: '🔍' },
      { label: 'Scanning the talent pool', subtitle: 'Searching across available profiles', icon: '🌐' },
      { label: 'Scoring relevance', subtitle: 'Ranking by how well each matches', icon: '📊' },
      { label: 'Assembling results', subtitle: 'Preparing your matches', icon: '✨' },
    ],
    tips: [
      'Broader criteria surface more candidates worth a look',
      'Skills matter more than exact job titles when searching',
      'Saved searches can be re-run as new candidates join',
    ],
  },
};

const DEFAULT_PRESET = 'enhance';

// Legacy `type` values from the three retired components, mapped onto presets so
// existing call sites keep working while they migrate.
const TYPE_ALIASES = {
  enhancement: 'enhance',
  ai: 'enhance',
  tips: 'suggestions',
  upload: 'resume',
  sync: 'enhance',
};

const resolvePreset = (variant) =>
  PRESETS[variant] || PRESETS[TYPE_ALIASES[variant]] || PRESETS[DEFAULT_PRESET];

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
  min-width: 0;

  h3 {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    color: ${p => p.$done ? '#15803d' : '#1a1a2e'};
    transition: color 0.5s;
  }

  .context {
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

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(${p => p.$count}, 1fr);
  gap: 12px;
  margin: 0 28px 20px;
`;

const StatCard = styled.div`
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px 8px;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 26px;
  font-weight: 800;
  color: #1a1a2e;
  line-height: 1.1;
`;

const StatLabel = styled.div`
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
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

const FooterRow = styled.div`
  display: flex;
  gap: 10px;
  margin: 0 28px 24px;
`;

const PrimaryBtn = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
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
`;

const SecondaryBtn = styled.button`
  flex: 1;
  padding: 13px;
  border-radius: 14px;
  border: 1.5px solid #e5e7eb;
  background: white;
  color: #6b7280;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #d1d5db;
    background: #f9fafb;
    color: #374151;
  }
`;

const HintText = styled.p`
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  margin: 0 28px 22px;
  font-style: italic;
`;

const STEP_MS = 3500;

export default function ProgressModal({
  open,
  variant = DEFAULT_PRESET,
  // `type` is the prop name the retired components used; accept it as an alias.
  type,
  title,
  subtitle,
  context,
  steps: stepsOverride,
  progress: progressOverride,
  stats = null,
  completed = false,
  startFromStep = 0,
  maxStep,
  onCancel,
  onClose,
  onViewResult,
  viewResultLabel = 'View Result',
}) {
  const preset = resolvePreset(type || variant);
  const STEPS = stepsOverride || preset.steps;
  const TIPS = preset.tips;
  const ceiling = maxStep ?? STEPS.length;

  const [stepIdx, setStepIdx] = useState(startFromStep);
  const [tipIdx, setTipIdx] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState((startFromStep / STEPS.length) * 100);

  const isDone = stepIdx >= STEPS.length;
  // A caller-supplied progress number takes over the bar entirely; otherwise we
  // simulate forward motion so the user isn't staring at a frozen indeterminate.
  const isDriven = typeof progressOverride === 'number';

  useEffect(() => {
    if (!open) {
      setStepIdx(startFromStep);
      setSmoothProgress((startFromStep / STEPS.length) * 100);
      return;
    }
    setStepIdx(startFromStep);
    setSmoothProgress((startFromStep / STEPS.length) * 100);
    const interval = setInterval(() => {
      setStepIdx(prev => (prev < ceiling - 1 ? prev + 1 : prev));
    }, STEP_MS);
    return () => clearInterval(interval);
  }, [open, startFromStep, ceiling, STEPS.length]);

  // Smooth progress animation within each step (simulated mode only).
  useEffect(() => {
    if (isDriven) return;
    if (isDone) { setSmoothProgress(100); return; }
    const stepStart = (stepIdx / STEPS.length) * 100;
    const stepEnd = ((stepIdx + 1) / STEPS.length) * 100;
    setSmoothProgress(stepStart);
    const tick = 50;
    const increment = ((stepEnd - stepStart) * tick) / STEP_MS;
    let current = stepStart;
    const timer = setInterval(() => {
      current += increment;
      if (current >= stepEnd - 1) {
        setSmoothProgress(stepEnd - 1);
        clearInterval(timer);
      } else {
        setSmoothProgress(current);
      }
    }, tick);
    return () => clearInterval(timer);
  }, [stepIdx, isDone, isDriven, STEPS.length]);

  // When the caller signals completion, fast-forward the remaining steps so the
  // user sees them finish rather than the modal vanishing mid-list.
  useEffect(() => {
    if (!completed || isDone) return;
    const remaining = STEPS.length - stepIdx;
    if (remaining <= 0) { setStepIdx(STEPS.length); setSmoothProgress(100); return; }
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setStepIdx(prev => {
        const next = prev + 1;
        setSmoothProgress((next / STEPS.length) * 100);
        return next;
      });
      if (step >= remaining) clearInterval(timer);
    }, 700);
    return () => clearInterval(timer);
  }, [completed]);

  useEffect(() => {
    if (isDone || !open) return;
    const interval = setInterval(() => {
      setTipIdx(prev => (prev + 1) % TIPS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isDone, open, TIPS.length]);

  const progress = isDone ? 100 : isDriven ? progressOverride : Math.round(smoothProgress);
  const stepLabel = isDone ? 'All steps complete' : `Step ${Math.min(stepIdx + 1, STEPS.length)} of ${STEPS.length}`;
  const isMobile = useMediaQuery('(max-width:768px)');
  const heading = isDone
    ? (preset.heading?.[1] || 'Complete')
    : (title || preset.heading?.[0] || 'Working');

  const statEntries = stats
    ? Object.entries(stats).filter(([, v]) => v !== undefined && v !== null)
    : [];

  const dismiss = onCancel || onClose;

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      fullScreen={isMobile}
      onClose={dismiss || undefined}
      disableEscapeKeyDown={!dismiss}
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
                  <IconInner>{STEPS[Math.min(stepIdx, STEPS.length - 1)]?.icon || '⏳'}</IconInner>
                </>
              )}
            </IconCircleWrap>
            <HeaderInfo $done={isDone}>
              <h3>{heading}</h3>
              {(context || subtitle) && (
                <div className="context">{context || subtitle}</div>
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
                  {isActive && step.subtitle && (
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

        {statEntries.length > 0 && (
          <StatsGrid $count={statEntries.length}>
            {statEntries.map(([key, value]) => (
              <StatCard key={key}>
                <StatValue>{value}</StatValue>
                <StatLabel>{key}</StatLabel>
              </StatCard>
            ))}
          </StatsGrid>
        )}

        {!isDone && (
          <TipBar key={tipIdx}>
            <TipIcon>💡</TipIcon>
            <TipText>{TIPS[tipIdx]}</TipText>
          </TipBar>
        )}

        {isDone && onViewResult && (
          <FooterRow>
            <PrimaryBtn onClick={onViewResult}>{viewResultLabel}</PrimaryBtn>
          </FooterRow>
        )}

        {!isDone && onCancel && (
          <FooterRow>
            <SecondaryBtn onClick={onCancel}>Cancel</SecondaryBtn>
          </FooterRow>
        )}

        {!isDone && !onCancel && onClose && (
          <HintText>
            You can close this and keep working. It will finish in the background.
          </HintText>
        )}
      </Container>
    </Dialog>
  );
}

export { PRESETS };
