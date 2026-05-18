import React from 'react';
import styled, { keyframes } from 'styled-components';
import {
  Dialog,
  DialogContent,
  Box,
  LinearProgress,
  IconButton,
  Button,
} from '@mui/material';
import {
  Psychology as BrainIcon,
  PersonSearch as PersonSearchIcon,
  AutoAwesome as SparklesIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// Animations
const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(124, 94, 207, 0.3), 0 0 60px rgba(124, 94, 207, 0.1); }
  50% { box-shadow: 0 0 30px rgba(124, 94, 207, 0.5), 0 0 80px rgba(124, 94, 207, 0.2); }
`;

const dotPulse = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
`;

// Styled Components
const StyledDialog = styled(Dialog)`
  .MuiDialog-paper {
    border-radius: 24px;
    overflow: hidden;
    background: #1a1a2e;
    min-width: 420px;
    max-width: 480px;
    border: 1px solid rgba(124, 94, 207, 0.15);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  }
`;

const ModalBody = styled(Box)`
  padding: 48px 40px 40px;
  text-align: center;
  position: relative;
`;

const IconWrapper = styled(Box)`
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 36px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const OuterRing = styled(Box)`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(145deg, #252540 0%, #1e1e35 100%);
  box-shadow: 
    inset 0 2px 4px rgba(0, 0, 0, 0.3),
    0 0 0 3px rgba(124, 94, 207, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const InnerCircle = styled(Box)`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c5ecf 0%, #9333ea 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${pulse} 2.5s ease-in-out infinite, ${glow} 2.5s ease-in-out infinite;
  
  svg {
    font-size: 36px;
    color: white;
  }
`;

const StatusDot = styled(Box)`
  position: absolute;
  top: 6px;
  right: 14px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #7c5ecf;
  border: 3px solid #1a1a2e;
  animation: ${dotPulse} 1.5s ease-in-out infinite;
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 10px;
  letter-spacing: -0.3px;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.45);
  margin: 0 0 36px;
  line-height: 1.6;
  max-width: 320px;
  margin-left: auto;
  margin-right: auto;
`;

const ProgressSection = styled(Box)`
  width: 100%;
`;

const ProgressLabels = styled(Box)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const PhaseLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #a78bfa;
  
  svg {
    font-size: 16px;
  }
`;

const WaitLabel = styled.span`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.35);
`;

const StyledLinearProgress = styled(LinearProgress)`
  height: 8px;
  border-radius: 4px;
  background: #252540;
  
  .MuiLinearProgress-bar {
    border-radius: 4px;
    background: linear-gradient(90deg, #7c5ecf 0%, #a78bfa 100%);
  }
`;

const StepDots = styled(Box)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 32px;
`;

const Dot = styled(Box)`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$active ? '#7c5ecf' : 'rgba(255, 255, 255, 0.15)'};
  transition: background 0.3s;
`;

const StatsGrid = styled(Box)`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 28px;
`;

const StatCard = styled(Box)`
  background: rgba(124, 94, 207, 0.1);
  border: 1px solid rgba(124, 94, 207, 0.12);
  border-radius: 12px;
  padding: 14px 8px;
`;

const StatValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: white;
  margin-bottom: 2px;
`;

const StatLabel = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CloseButton = styled(IconButton)`
  position: absolute;
  top: 12px;
  right: 12px;
  color: rgba(255, 255, 255, 0.3);
  z-index: 10;
  
  &:hover {
    color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.05);
  }
`;

const HintText = styled.p`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  margin: 20px 0 0;
  font-style: italic;
`;

const AIProcessingModal = ({ 
  open, 
  onClose,
  onCancel,
  title = "AI Processing",
  subtitle = "Please wait while AI analyzes the data...",
  phase = "Processing Data",
  progress = 0,
  stats = null,
  type = "screening"
}) => {
  const getIcon = () => {
    if (type === 'search') return <PersonSearchIcon />;
    return <BrainIcon />;
  };

  // Determine which dot is active based on progress
  const activeDot = progress >= 66 ? 2 : progress >= 33 ? 1 : 0;

  const handleCancelClick = () => {
    try { onCancel?.(); } catch (_) { /* ignore */ }
    // Also close the modal so the user gets an immediate dismissal.
    if (onClose) onClose();
  };

  return (
    <StyledDialog
      open={open}
      onClose={onCancel ? handleCancelClick : onClose}
      disableEscapeKeyDown={!onCancel && !onClose}
    >
      <DialogContent sx={{ p: 0 }}>
        <ModalBody>
          {(onClose || onCancel) && (
            <CloseButton
              onClick={onCancel ? handleCancelClick : onClose}
              size="small"
              title={onCancel ? 'Cancel' : 'Continue in background'}
              aria-label={onCancel ? 'Cancel' : 'Close'}
            >
              <CloseIcon fontSize="small" />
            </CloseButton>
          )}

          {/* Icon */}
          <IconWrapper>
            <OuterRing>
              <InnerCircle>
                {getIcon()}
              </InnerCircle>
            </OuterRing>
            <StatusDot />
          </IconWrapper>

          {/* Text */}
          <Title>{title}</Title>
          <Subtitle>{subtitle}</Subtitle>

          {/* Progress */}
          <ProgressSection>
            <ProgressLabels>
              <PhaseLabel>
                <SparklesIcon />
                {phase}
              </PhaseLabel>
              <WaitLabel>Please wait</WaitLabel>
            </ProgressLabels>
            <StyledLinearProgress
              variant={progress > 0 ? "determinate" : "indeterminate"}
              value={progress}
            />
          </ProgressSection>

          {/* Stats */}
          {stats && (
            <StatsGrid>
              {stats.evaluated !== undefined && (
                <StatCard>
                  <StatValue>{stats.evaluated}</StatValue>
                  <StatLabel>Evaluated</StatLabel>
                </StatCard>
              )}
              {stats.found !== undefined && (
                <StatCard>
                  <StatValue>{stats.found}</StatValue>
                  <StatLabel>Found</StatLabel>
                </StatCard>
              )}
              {stats.shortlisted !== undefined && (
                <StatCard>
                  <StatValue>{stats.shortlisted}</StatValue>
                  <StatLabel>Shortlisted</StatLabel>
                </StatCard>
              )}
            </StatsGrid>
          )}

          {/* Step dots */}
          <StepDots>
            <Dot $active={activeDot >= 0} />
            <Dot $active={activeDot >= 1} />
            <Dot $active={activeDot >= 2} />
          </StepDots>

          {onCancel ? (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onClick={handleCancelClick}
                sx={{
                  textTransform: 'none',
                  color: 'rgba(255, 255, 255, 0.85)',
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                  fontWeight: 600,
                  px: 3,
                  '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    background: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                Cancel
              </Button>
            </Box>
          ) : onClose && (
            <HintText>
              You can close this and continue working. Processing will run in the background.
            </HintText>
          )}
        </ModalBody>
      </DialogContent>
    </StyledDialog>
  );
};

export default AIProcessingModal;
