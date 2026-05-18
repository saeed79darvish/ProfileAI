import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

const Container = styled.div`
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
`;

const Title = styled.h3`
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 16px 0;
`;

const SessionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SessionItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(0,0,0,0.03);
  }
`;

const IconWrapper = styled.div`
  font-size: 16px;
`;

const SessionInfo = styled.div`
  flex: 1;
`;

const SessionTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: #1a1a2e;
  line-height: 1.3;
`;

const SessionTime = styled.div`
  font-size: 12px;
  color: #666;
  margin-top: 2px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 16px;
  color: #666;
  font-size: 13px;
`;

// Format scheduled time
const formatTime = (date) => {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  
  if (isToday) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return d.toLocaleDateString('en-US', { weekday: 'long' }) + ` ${time}`;
};

const UpcomingSessions = ({ sessions = [] }) => {
  const navigate = useNavigate();
  
  const handleClick = (session) => {
    navigate(`/sessions/${session.id}`);
  };
  
  return (
    <Container>
      <Title>Upcoming Sessions</Title>
      {sessions.length === 0 ? (
        <EmptyState>No upcoming sessions</EmptyState>
      ) : (
        <SessionList>
          {sessions.map((session) => (
            <SessionItem key={session.id} onClick={() => handleClick(session)}>
              <IconWrapper>{session.isHost ? '🎤' : '📅'}</IconWrapper>
              <SessionInfo>
                <SessionTitle>{session.title}</SessionTitle>
                <SessionTime>
                  {formatTime(session.scheduledTime)}
                  {session.isHost && <span style={{ marginLeft: 6, color: '#7c5ecf', fontWeight: 500 }}>• Hosting</span>}
                </SessionTime>
              </SessionInfo>
            </SessionItem>
          ))}
        </SessionList>
      )}
    </Container>
  );
};

export default UpcomingSessions;
