import React from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  RocketLaunch as RocketIcon,
  Check as CheckIcon,
  SmartToy as AgentIcon,
  Lock as LockIcon,
  AutoAwesome as SparkleIcon
} from '@mui/icons-material';

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
`;

const StyledDialog = styled(Dialog)`
  .MuiDialog-paper {
    border-radius: 20px;
    max-width: 520px;
    overflow: hidden;
  }
`;

const CloseButton = styled(IconButton)`
  position: absolute !important;
  top: 12px;
  right: 12px;
  color: white !important;
  z-index: 1;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 24px 24px 20px;
  text-align: center;
  color: white;
`;

const IconWrapper = styled.div`
  width: 52px;
  height: 52px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  
  svg {
    font-size: 26px;
  }
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px;
`;

const Subtitle = styled.p`
  font-size: 14px;
  opacity: 0.9;
  margin: 0;
`;

const Content = styled.div`
  padding: 20px 24px;
`;

const FeaturesList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 16px;
`;

const FeatureItem = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  
  svg {
    color: #10B981;
    font-size: 18px;
    flex-shrink: 0;
  }
  
  span {
    font-size: 13px;
    color: #374151;
  }
`;

const PriceSection = styled.div`
  text-align: center;
  margin-bottom: 16px;
  
  .price {
    font-size: 32px;
    font-weight: 700;
    color: #1F2937;
    
    span {
      font-size: 14px;
      font-weight: 400;
      color: #6B7280;
    }
  }
  
  .savings {
    font-size: 13px;
    color: #10B981;
    margin-top: 4px;
  }
`;

const UpgradeButton = styled.button`
  width: 100%;
  padding: 16px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
  }
`;

const MaybeLater = styled.button`
  width: 100%;
  padding: 12px;
  margin-top: 12px;
  background: transparent;
  border: none;
  color: #6B7280;
  font-size: 14px;
  cursor: pointer;
  
  &:hover {
    color: #374151;
  }
`;

const LockedFeatureBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 10px;
  margin-bottom: 16px;
  
  .icon {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
      color: white;
      font-size: 16px;
    }
  }
  
  .text {
    flex: 1;
    
    .title {
      font-size: 13px;
      font-weight: 600;
      color: #92400e;
      margin-bottom: 1px;
    }
    
    .desc {
      font-size: 11px;
      color: #a16207;
    }
  }
`;

const UpgradeModal = ({ 
  open, 
  onClose, 
  feature = '',
  returnPath = null,
  returnState = null,
  showAgentFeature = false
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const featureMessages = {
    resume_parse: 'You\'ve used all your resume parsing credits for today.',
    profile_enhance: 'You\'ve used all your profile enhancement credits for today.',
    tailor_profile: 'You\'ve used all your profile tailoring credits for today.',
    career_suggestions: 'You\'ve used all your career suggestion credits for today.',
    agent_arena: 'AI Agent requires a Pro subscription to use.',
    agent_apply: 'AI Agent for job applications requires a Pro subscription.',
    default: 'You\'ve reached your daily AI usage limit.'
  };

  const handleUpgrade = () => {
    // Store return path for navigation back after upgrade
    const pathToReturn = returnPath || location.pathname;
    sessionStorage.setItem('upgradeReturnPath', pathToReturn);
    
    if (returnState) {
      sessionStorage.setItem('upgradeReturnState', JSON.stringify(returnState));
    } else if (showAgentFeature) {
      // Store state to open agent modal on return
      sessionStorage.setItem('upgradeReturnState', JSON.stringify({ openAgentModal: true }));
    }
    
    onClose();
    navigate('/pricing');
  };

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="sm">
      <CloseButton onClick={onClose}>
        <CloseIcon />
      </CloseButton>
      
      <Header>
        <IconWrapper>
          {showAgentFeature ? <AgentIcon /> : <RocketIcon />}
        </IconWrapper>
        <Title>{showAgentFeature ? 'Unlock AI Agent' : 'Upgrade to Pro'}</Title>
        <Subtitle>
          {featureMessages[feature] || featureMessages.default}
        </Subtitle>
      </Header>
      
      <Content>
        {showAgentFeature && (
          <LockedFeatureBanner>
            <div className="icon">
              <LockIcon />
            </div>
            <div className="text">
              <div className="title">Premium Feature</div>
              <div className="desc">Upgrade to Pro to let AI apply for jobs on your behalf</div>
            </div>
          </LockedFeatureBanner>
        )}
        
        <FeaturesList>
          {showAgentFeature ? (
            <>
              <FeatureItem>
                <CheckIcon />
                <span>AI Agent negotiates with recruiters for you</span>
              </FeatureItem>
              <FeatureItem>
                <CheckIcon />
                <span>Automated salary & benefits negotiation</span>
              </FeatureItem>
              <FeatureItem>
                <CheckIcon />
                <span>Real-time negotiation updates</span>
              </FeatureItem>
              <FeatureItem>
                <CheckIcon />
                <span>Unlimited Agent Arena sessions</span>
              </FeatureItem>
            </>
          ) : (
            <>
              <FeatureItem>
                <CheckIcon />
                <span>10x more AI resume parses per day</span>
              </FeatureItem>
              <FeatureItem>
                <CheckIcon />
                <span>10x more profile enhancements</span>
              </FeatureItem>
              <FeatureItem>
                <CheckIcon />
                <span>20x more profile tailoring</span>
              </FeatureItem>
              <FeatureItem>
                <CheckIcon />
                <span>Unlimited Agent Arena negotiations</span>
              </FeatureItem>
              <FeatureItem>
                <CheckIcon />
                <span>Priority matching & support</span>
              </FeatureItem>
            </>
          )}
        </FeaturesList>
        
        <PriceSection>
          <div className="price">
            $29<span>/month</span>
          </div>
          <div className="savings">Save 30% with annual billing</div>
        </PriceSection>
        
        <UpgradeButton onClick={handleUpgrade}>
          <SparkleIcon style={{ marginRight: '8px' }} />
          Upgrade Now
        </UpgradeButton>
        
        <MaybeLater onClick={onClose}>
          Maybe later
        </MaybeLater>
      </Content>
    </StyledDialog>
  );
};

export default UpgradeModal;
