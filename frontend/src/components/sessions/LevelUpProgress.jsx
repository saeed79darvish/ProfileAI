import React from 'react';
import styled from 'styled-components';
import { EmojiEvents as TrophyIcon } from '@mui/icons-material';

const Container = styled.div`
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
`;

const IconWrapper = styled.div`
  margin-bottom: 8px;
  
  svg {
    font-size: 32px;
    color: #7c5ecf;
  }
`;

const Title = styled.h3`
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 4px 0;
`;

const Subtitle = styled.p`
  font-size: 13px;
  color: #555;
  margin: 0 0 16px 0;
  line-height: 1.4;
`;

const ProgressContainer = styled.div`
  background: rgba(0,0,0,0.03);
  border-radius: 8px;
  padding: 12px;
`;

const ProgressBar = styled.div`
  height: 8px;
  background: rgba(124,94,207,0.15);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(135deg, #7c5ecf, #9333ea);
  border-radius: 4px;
  width: ${props => props.$progress}%;
  transition: width 0.3s ease;
`;

const ProgressText = styled.span`
  font-size: 12px;
  color: #555;
  font-weight: 500;
`;

const LevelUpProgress = ({ 
  currentLevel = 'contributor',
  sessionsToNext = 2,
  progress = 60,
  currentSessions = 3,
  targetSessions = 5
}) => {
  const nextLevel = {
    'newcomer': 'Contributor',
    'contributor': 'Expert',
    'expert': 'Master',
    'master': 'Legend',
    'legend': 'Legend'
  }[currentLevel] || 'Expert';

  return (
    <Container>
      <IconWrapper>
        <TrophyIcon />
      </IconWrapper>
      <Title>Level Up!</Title>
      <Subtitle>
        Host {sessionsToNext} more sessions to reach {nextLevel} level
      </Subtitle>
      <ProgressContainer>
        <ProgressBar>
          <ProgressFill $progress={progress} />
        </ProgressBar>
        <ProgressText>{currentSessions}/{targetSessions} sessions completed</ProgressText>
      </ProgressContainer>
    </Container>
  );
};

export default LevelUpProgress;
