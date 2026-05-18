import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import {
  AutoAwesome as AIIcon,
  TrendingUp as TrendingIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { CircularProgress, LinearProgress, Tooltip } from '@mui/material';
import { subscriptionAPI } from '../services/api';

const Card = styled.div`
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(102, 126, 234, 0.15);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const TitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  .icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
      font-size: 20px;
      color: white;
    }
  }
  
  .text {
    h3 {
      font-size: 16px;
      font-weight: 600;
      color: white;
      margin: 0 0 4px;
    }
    
    p {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      margin: 0;
    }
  }
`;

const TierBadge = styled.span`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  
  ${props => props.$tier === 'free' && `
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
  `}
  
  ${props => props.$tier === 'pro' && `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  `}
  
  ${props => props.$tier === 'enterprise' && `
    background: rgba(255, 255, 255, 0.12);
    color: white;
  `}
`;

const UsageGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
`;

const UsageItem = styled.div`
  padding: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
`;

const UsageLabel = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const UsageCount = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: ${props => props.$warning ? '#F59E0B' : props.$danger ? '#EF4444' : 'white'};
  margin-bottom: 8px;
`;

const StyledProgress = styled(LinearProgress)`
  height: 6px;
  border-radius: 3px;
  background-color: rgba(255, 255, 255, 0.08) !important;
  
  .MuiLinearProgress-bar {
    background: ${props => 
      props.$danger ? '#EF4444' : 
      props.$warning ? '#F59E0B' : 
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    };
    border-radius: 3px;
  }
`;

const UpgradeButton = styled.button`
  width: 100%;
  padding: 12px 24px;
  margin-top: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
`;

const ErrorState = styled.div`
  text-align: center;
  padding: 20px;
  color: #EF4444;
  font-size: 14px;
`;

const featureLabels = {
  resume_parse: 'Resume Parse',
  profile_enhance: 'Profile Enhance',
  tailor_profile: 'Profile Tailor',
  career_suggestions: 'Career Tips',
  agent_arena: 'Agent Arena'
};

const AIUsageCard = ({ compact = false }) => {
  const navigate = useNavigate();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoading(true);
        const response = await subscriptionAPI.getUsage();
        setUsage(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load usage');
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  if (loading) {
    return (
      <Card>
        <LoadingState>
          <CircularProgress size={24} />
        </LoadingState>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorState>{error}</ErrorState>
      </Card>
    );
  }

  if (!usage) return null;

  const { tier, usage: usageData } = usage;
  const isFreeTier = tier === 'free';

  // Calculate if any feature is running low
  const hasLowUsage = Object.values(usageData).some(f => {
    if (f.dailyLimit === -1) return false;
    const remaining = f.dailyLimit - f.today;
    return remaining <= 1 && remaining >= 0;
  });

  const features = compact 
    ? ['resume_parse', 'profile_enhance', 'agent_arena']
    : Object.keys(usageData);

  return (
    <Card>
      <Header>
        <TitleSection>
          <div className="icon">
            <AIIcon />
          </div>
          <div className="text">
            <h3>AI Usage</h3>
            <p>Daily limits reset at midnight</p>
          </div>
        </TitleSection>
        <TierBadge $tier={tier}>{tier}</TierBadge>
      </Header>

      <UsageGrid>
        {features.map(feature => {
          const data = usageData[feature];
          if (!data) return null;
          
          const isUnlimited = data.dailyLimit === -1;
          const remaining = isUnlimited ? 999 : data.dailyLimit - data.today;
          const percentage = isUnlimited ? 0 : (data.today / data.dailyLimit) * 100;
          const isDanger = !isUnlimited && remaining === 0;
          const isWarning = !isUnlimited && remaining === 1;

          return (
            <Tooltip 
              key={feature} 
              title={`${data.month} used this month${data.monthlyLimit !== -1 ? ` / ${data.monthlyLimit} limit` : ''}`}
            >
              <UsageItem>
                <UsageLabel>
                  {featureLabels[feature] || feature}
                  {isDanger && <WarningIcon style={{ fontSize: 14, color: '#EF4444' }} />}
                </UsageLabel>
                <UsageCount $warning={isWarning} $danger={isDanger}>
                  {isUnlimited ? '∞' : `${remaining}/${data.dailyLimit}`}
                </UsageCount>
                {!isUnlimited && (
                  <StyledProgress 
                    variant="determinate" 
                    value={Math.min(percentage, 100)} 
                    $warning={isWarning}
                    $danger={isDanger}
                  />
                )}
              </UsageItem>
            </Tooltip>
          );
        })}
      </UsageGrid>

      {isFreeTier && (
        <UpgradeButton onClick={() => navigate('/pricing')}>
          <TrendingIcon />
          Upgrade for More AI Power
        </UpgradeButton>
      )}

      {hasLowUsage && !isFreeTier && (
        <div style={{ 
          marginTop: 16, 
          padding: '12px 16px', 
          background: 'rgba(245, 158, 11, 0.1)', 
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: 8,
          fontSize: 13,
          color: '#F59E0B',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <WarningIcon style={{ fontSize: 18 }} />
          Running low on some features. Limits reset at midnight.
        </div>
      )}
    </Card>
  );
};

export default AIUsageCard;
