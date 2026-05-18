import React from 'react';
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
