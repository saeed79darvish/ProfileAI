import React from 'react';
import styled from 'styled-components';
import {

  Psychology as MentorIcon,
} from '@mui/icons-material';

const Container = styled.div`
  background: #ffffff;
  border: none;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
`;

const Title = styled.h3`
  font-size: 13px;
  font-weight: 700;
  color: #666;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ActionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ActionItem = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(0,0,0,0.03);
  }
`;

const IconCircle = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${props => props.$bg || 'rgba(124,94,207,0.15)'};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  svg {
    font-size: 20px;
    color: ${props => props.$color || '#7c5ecf'};
  }
`;

const ActionText = styled.span`
  font-size: 14px;
  color: #1a1a2e;
  font-weight: 500;
`;

const QuickActions = ({ onFindMentorship }) => {
  return (
    <Container>
      <Title>Quick Actions</Title>
      <ActionList>
        <ActionItem onClick={onFindMentorship}>
          <IconCircle $bg="rgba(16,185,129,0.15)" $color="#10b981">
            <MentorIcon />
          </IconCircle>
          <ActionText>Find Mentorship</ActionText>
        </ActionItem>
      </ActionList>
    </Container>
  );
};

export default QuickActions;
