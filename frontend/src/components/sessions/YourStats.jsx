import React from 'react';
import styled from 'styled-components';
import { Leaderboard as ChartIcon } from '@mui/icons-material';

const Container = styled.div`
  background: #ffffff;
  border: none;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const Title = styled.h3`
  font-size: 13px;
  font-weight: 700;
  color: #666;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$color || '#7c5ecf'};
  flex-shrink: 0;
`;

const HeaderIcon = styled.div`
  color: #7c5ecf;
  display: flex;
  align-items: center;
  
  svg {
    font-size: 20px;
  }
`;

const StatList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const StatRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const StatLabel = styled.span`
  font-size: 14px;
  color: #555;
  flex: 1;
`;

const StatValue = styled.span`
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
`;

const ProgressSection = styled.div`
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(0,0,0,0.08);
`;

const ProgressLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const ProgressText = styled.span`
  font-size: 13px;
  color: #7c5ecf;
  font-weight: 500;
`;

const ProgressPercent = styled.span`
  font-size: 13px;
  color: #7c5ecf;
  font-weight: 600;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(124,94,207,0.15);
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(135deg, #7c5ecf, #9333ea);
  width: ${props => props.$percent || 0}%;
  transition: width 0.5s ease;
`;

const YourStats = ({ stats }) => {
  const { teachingCredits = 0, sessionsAttended = 0, peopleHelped = 0 } = stats || {};
  
  // Calculate profile strength (simple heuristic)
  const profileStrength = Math.min(100, Math.round(
    (teachingCredits > 0 ? 25 : 0) +
    (sessionsAttended > 0 ? 25 : 0) +
    (peopleHelped > 0 ? 25 : 0) +
    25 // base
  ));
  
  return (
    <Container>
      <Header>
        <Title>Your Activity</Title>
        <HeaderIcon><ChartIcon /></HeaderIcon>
      </Header>
      <StatList>
        <StatRow>
          <Dot $color="#7c5ecf" />
          <StatLabel>Teaching Credits</StatLabel>
          <StatValue>{teachingCredits}</StatValue>
        </StatRow>
        <StatRow>
          <Dot $color="#9333ea" />
          <StatLabel>Sessions Attended</StatLabel>
          <StatValue>{sessionsAttended}</StatValue>
        </StatRow>
        <StatRow>
          <Dot $color="#10b981" />
          <StatLabel>People Helped</StatLabel>
          <StatValue>{peopleHelped}</StatValue>
        </StatRow>
      </StatList>
      <ProgressSection>
        <ProgressLabel>
          <ProgressText>Profile Strength</ProgressText>
          <ProgressPercent>{profileStrength}%</ProgressPercent>
        </ProgressLabel>
        <ProgressBar>
          <ProgressFill $percent={profileStrength} />
        </ProgressBar>
      </ProgressSection>
    </Container>
  );
};

export default YourStats;
