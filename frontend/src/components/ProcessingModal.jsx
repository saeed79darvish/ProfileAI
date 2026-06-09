import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  LinearProgress,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Send as SendIcon,
  Description as ResumeIcon,
  AutoAwesome as AIIcon,
  Psychology as BrainIcon,
  CheckCircle as CheckIcon,
  Sync as SyncIcon,
  Lightbulb as TipIcon,
} from '@mui/icons-material';

// Animations
const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-15px); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.08); opacity: 0.9; }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const ripple = keyframes`
  0% {
    transform: scale(0.8);
    opacity: 0.6;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/* ── Modern stepped loader (big-tech style) — used by enhance/tips ── */
const stepIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const popCheck = keyframes`
  0%   { transform: scale(0.4); opacity: 0; }
  60%  { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
`;

const barShimmer = keyframes`
  0%   { background-position: -180% 0; }
  100% { background-position: 180% 0; }
`;

const tipFade = keyframes`
  0%, 100% { opacity: 0; transform: translateY(4px); }
  12%, 88% { opacity: 1; transform: translateY(0); }
`;

const ModernDialog = styled(Dialog)`
  .MuiDialog-paper {
    border-radius: 20px;
    overflow: hidden;
    background: #ffffff;
    min-width: 380px;
    max-width: 440px;
    box-shadow: 0 24px 70px rgba(17, 24, 39, 0.22);
  }
`;

const ModernHeader = styled(Box)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px 16px;

  .badge {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #eef2ff, #f5f3ff);
    color: #6366f1;
    flex: 0 0 auto;
  }
  .badge svg { font-size: 22px; }

  .htitle {
    font-size: 17px;
    font-weight: 700;
    color: #111827;
    line-height: 1.2;
  }
  .hsub {
    font-size: 12.5px;
    color: #6b7280;
    margin-top: 2px;
  }
`;

const ModernBody = styled(Box)`
  padding: 4px 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const StepList = styled(Box)`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const StepRow = styled(Box)`
  display: flex;
  align-items: center;
  gap: 12px;
  animation: ${stepIn} 0.35s ease both;

  .ico {
    flex: 0 0 22px;
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border-radius: 50%;
  }
  &[data-state='done'] .ico { background: #ecfdf5; color: #10b981; }
  &[data-state='done'] .ico svg { animation: ${popCheck} 0.3s ease both; font-size: 16px; }

  &[data-state='active'] .ico {
    border: 2px solid #e0e7ff;
    border-top-color: #6366f1;
    animation: ${spin} 0.7s linear infinite;
  }

  &[data-state='pending'] .ico { background: #f3f4f6; }
  &[data-state='pending'] .ico::after {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #cbd5e1;
  }

  .label {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    transition: color 0.3s;
  }
  &[data-state='pending'] .label { color: #9ca3af; }
  &[data-state='active'] .label { color: #4338ca; font-weight: 600; }
`;

const SkeletonWrap = styled(Box)`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid #f1f5f9;
`;

const SkeletonBar = styled(Box)`
  height: ${p => p.$h || 12}px;
  width: ${p => p.$w || '100%'};
  border-radius: 6px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e7ebf3 37%, #f1f5f9 63%);
  background-size: 280% 100%;
  animation: ${barShimmer} 1.4s ease-in-out infinite;
`;

const TipBar = styled(Box)`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 20px;
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f5f3ff, #eef2ff);
  border: 1px solid #ede9fe;

  .tip-ico { font-size: 16px; color: #8b5cf6; flex: 0 0 auto; }
  .tip-text {
    font-size: 12.5px;
    color: #5b21b6;
    font-weight: 500;
    animation: ${tipFade} 4s ease-in-out infinite;
  }
  .tip-text b { font-weight: 700; }
`;

const modernConfig = {
  enhance: {
    icon: AIIcon,
    steps: [
      'Reading your profile',
      'Optimizing wording & impact',
      'Strengthening key sections',
      'Polishing the final draft',
    ],
    tips: [
      <>We quantify achievements to make recruiters take notice.</>,
      <>Stronger action verbs &amp; clearer impact, automatically.</>,
      <>Your tone &amp; facts stay yours — we just sharpen them.</>,
    ],
  },
  tips: {
    icon: BrainIcon,
    steps: [
      'Reviewing your profile',
      'Benchmarking against top candidates',
      'Spotting growth opportunities',
      'Writing your personalized tips',
    ],
    tips: [
      <>Tips are tailored to <b>your</b> target roles &amp; level.</>,
      <>Act on the top suggestion first for the biggest lift.</>,
      <>A complete profile reaches the <b>Top 10%</b> faster.</>,
    ],
  },
};

function ModernProcessing({ open, type, title, subtitle }) {
  const cfg = modernConfig[type] || modernConfig.enhance;
  const Icon = cfg.icon;
  const [step, setStep] = useState(0);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    if (!open) { setStep(0); setTip(0); return; }
    const t = setInterval(() => {
      setStep((s) => (s < cfg.steps.length - 1 ? s + 1 : s));
    }, 1100);
    return () => clearInterval(t);
  }, [open, cfg.steps.length]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTip((i) => (i + 1) % cfg.tips.length), 4000);
    return () => clearInterval(t);
  }, [open, cfg.tips.length]);

  return (
    <ModernDialog open={open} disableEscapeKeyDown onClose={() => {}}>
      <DialogContent sx={{ p: 0 }}>
        <ModernHeader>
          <span className="badge"><Icon /></span>
          <Box>
            <div className="htitle">{title}</div>
            {subtitle && <div className="hsub">{subtitle}</div>}
          </Box>
        </ModernHeader>
        <ModernBody>
          <StepList>
            {cfg.steps.map((label, i) => {
              const state = i < step ? 'done' : i === step ? 'active' : 'pending';
              return (
                <StepRow key={i} data-state={state} style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="ico">{state === 'done' && <CheckIcon />}</span>
                  <span className="label">{label}</span>
                </StepRow>
              );
            })}
          </StepList>

          <SkeletonWrap>
            <SkeletonBar $w="42%" $h={10} />
            <SkeletonBar $w="100%" />
            <SkeletonBar $w="80%" />
          </SkeletonWrap>

          <TipBar>
            <TipIcon className="tip-ico" />
            <span className="tip-text" key={tip}>{cfg.tips[tip]}</span>
          </TipBar>
        </ModernBody>
      </DialogContent>
    </ModernDialog>
  );
}

// Styled Components
const StyledDialog = styled(Dialog)`
  .MuiDialog-paper {
    border-radius: 20px;
    overflow: hidden;
    background: ${props => props.$gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
    min-width: 380px;
    max-width: 480px;
    box-shadow: 0 20px 60px rgba(102, 126, 234, 0.4);
  }
`;

const GradientBackground = styled(Box)`
  position: relative;
  overflow: hidden;
  padding: 40px 32px;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      45deg,
      transparent 30%,
      rgba(255, 255, 255, 0.08) 50%,
      transparent 70%
    );
    animation: ${shimmer} 3s infinite;
  }
`;

const IconContainer = styled(Box)`
  position: relative;
  width: 100px;
  height: 100px;
  margin: 0 auto 28px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const FloatingIcon = styled(Box)`
  animation: ${float} 2.5s ease-in-out infinite;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const IconCircle = styled(Box)`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: ${pulse} 2s ease-in-out infinite;
  
  svg {
    font-size: 48px;
    color: white;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  }
`;

const RippleCircle = styled(Box)`
  position: absolute;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  animation: ${ripple} 2s ease-out infinite;
  animation-delay: ${props => props.$delay || '0s'};
`;

const SpinningIcon = styled(Box)`
  position: absolute;
  top: -8px;
  right: -8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    font-size: 18px;
    color: white;
    animation: ${spin} 1.5s linear infinite;
  }
`;

const ContentBox = styled(Box)`
  text-align: center;
  color: white;
  position: relative;
  z-index: 1;
`;

const Title = styled(Typography)`
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Subtitle = styled(Typography)`
  font-size: 15px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 28px;
  line-height: 1.5;
`;

const ProgressContainer = styled(Box)`
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 16px 20px;
  backdrop-filter: blur(10px);
`;

const PhaseText = styled(Typography)`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 10px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const StyledLinearProgress = styled(LinearProgress)`
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.25);
  
  .MuiLinearProgress-bar {
    border-radius: 3px;
    background: linear-gradient(90deg, #ffffff 0%, rgba(255, 255, 255, 0.9) 100%);
  }
`;

const ProgressPercentage = styled(Typography)`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 8px;
  font-weight: 500;
`;

// Type configurations
const typeConfig = {
  upload: {
    icon: UploadIcon,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    defaultTitle: 'Uploading',
    defaultSubtitle: 'Please wait while your file is being uploaded...',
    defaultPhase: 'Uploading file...',
  },
  resume: {
    icon: ResumeIcon,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    defaultTitle: 'Processing Resume',
    defaultSubtitle: 'AI is parsing your resume and extracting information...',
    defaultPhase: 'Analyzing document...',
  },
  submit: {
    icon: SendIcon,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    defaultTitle: 'Submitting Application',
    defaultSubtitle: 'Please wait while we submit your application...',
    defaultPhase: 'Sending data...',
  },
  ai: {
    icon: BrainIcon,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    defaultTitle: 'AI Processing',
    defaultSubtitle: 'Our AI is working on your request...',
    defaultPhase: 'Processing...',
  },
  enhance: {
    icon: AIIcon,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    defaultTitle: 'AI Enhancing',
    defaultSubtitle: 'AI is enhancing your content...',
    defaultPhase: 'Enhancing...',
  },
  sync: {
    icon: SyncIcon,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    defaultTitle: 'Syncing',
    defaultSubtitle: 'Synchronizing your data...',
    defaultPhase: 'Syncing...',
  },
  success: {
    icon: CheckIcon,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    defaultTitle: 'Success!',
    defaultSubtitle: 'Operation completed successfully.',
    defaultPhase: 'Complete',
  },
};

const ProcessingModal = ({ 
  open, 
  type = 'ai',
  title,
  subtitle,
  phase,
  progress = 0,
  showProgress = true,
}) => {
  const config = typeConfig[type] || typeConfig.ai;
  const Icon = config.icon;
  
  const displayTitle = title || config.defaultTitle;
  const displaySubtitle = subtitle || config.defaultSubtitle;
  const displayPhase = phase || config.defaultPhase;

  // Modern stepped loader for AI profile flows (big-tech style)
  if (modernConfig[type]) {
    return (
      <ModernProcessing
        open={open}
        type={type}
        title={displayTitle}
        subtitle={displaySubtitle}
      />
    );
  }

  return (
    <StyledDialog 
      open={open}
      disableEscapeKeyDown
      onClose={() => {}}
      $gradient={config.gradient}
    >
      <DialogContent sx={{ p: 0 }}>
        <GradientBackground>
          {/* Animated Icon */}
          <IconContainer>
            <RippleCircle $delay="0s" />
            <RippleCircle $delay="0.6s" />
            <RippleCircle $delay="1.2s" />
            <FloatingIcon>
              <IconCircle>
                <Icon />
              </IconCircle>
            </FloatingIcon>
            <SpinningIcon>
              <SyncIcon />
            </SpinningIcon>
          </IconContainer>
          
          {/* Content */}
          <ContentBox>
            <Title variant="h5">
              {displayTitle}
            </Title>
            <Subtitle variant="body2">
              {displaySubtitle}
            </Subtitle>
            
            {/* Progress Section */}
            {showProgress && (
              <ProgressContainer>
                <PhaseText>
                  {displayPhase}
                </PhaseText>
                <StyledLinearProgress 
                  variant={progress > 0 ? "determinate" : "indeterminate"}
                  value={progress}
                />
                {progress > 0 && (
                  <ProgressPercentage>
                    {Math.round(progress)}% complete
                  </ProgressPercentage>
                )}
              </ProgressContainer>
            )}
          </ContentBox>
        </GradientBackground>
      </DialogContent>
    </StyledDialog>
  );
};

export default ProcessingModal;
