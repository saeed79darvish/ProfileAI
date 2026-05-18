import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Avatar,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { sessionAPI, resolveImageUrl } from '../../services/api';

const StyledDialog = styled(Dialog)`
  .MuiDialog-paper {
    border-radius: 16px;
    max-width: 520px;
    width: 100%;
    background: #ffffff;
    border: 1px solid rgba(124, 94, 207, 0.2);
    color: #1a1a2e;
  }
`;

const Header = styled(DialogTitle)`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
`;

const HeaderContent = styled.div`
  flex: 1;
`;

const TypeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: ${props => {
    switch (props.$type) {
      case 'teaching': return 'rgba(124, 94, 207, 0.15)';
      case 'showcase': return 'rgba(147, 51, 234, 0.15)';
      case 'mentorship': return 'rgba(124, 94, 207, 0.15)';
      default: return 'rgba(0, 0, 0, 0.05)';
    }
  }};
  color: ${props => {
    switch (props.$type) {
      case 'teaching': return '#7c5ecf';
      case 'showcase': return '#9333ea';
      case 'mentorship': return '#7c5ecf';
      default: return 'rgba(0,0,0,0.5)';
    }
  }};
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 8px;
`;

const Title = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 8px 0;
`;

const Content = styled(DialogContent)`
  padding: 24px !important;
`;

const Section = styled.div`
  margin-bottom: 20px;
`;

const SectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
  margin: 0 0 12px 0;
`;

const Description = styled.p`
  font-size: 14px;
  color: rgba(0, 0, 0, 0.6);
  line-height: 1.6;
  margin: 0;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  margin: 16px 0;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #555;
  
  svg {
    font-size: 18px;
    color: #888;
  }
`;

const HostSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 12px;
`;

const HostInfo = styled.div`
  flex: 1;
`;

const HostName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
`;

const HostTitle = styled.div`
  font-size: 12px;
  color: #555;
`;

const RatingBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #7c5ecf;
  font-weight: 500;
  
  svg {
    font-size: 14px;
  }
`;

const SkillList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const SkillTag = styled.span`
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  font-size: 13px;
`;

const Actions = styled(DialogActions)`
  padding: 16px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  justify-content: space-between;
`;

const ParticipantCount = styled.span`
  font-size: 13px;
  color: #555;
`;

const formatDateTime = (date) => {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const getTypeIcon = (type) => {
  switch (type) {
    case 'teaching': return '📚';
    case 'showcase': return '🎯';
    case 'mentorship': return '🤝';
    default: return '📅';
  }
};

const JoinSessionModal = ({ open, onClose, sessionId, onJoined }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);

  useEffect(() => {
    if (open && sessionId) {
      fetchSession();
    }
  }, [open, sessionId]);

  const fetchSession = async () => {
    setLoading(true);
    setError('');
    setIsHost(false);
    setIsParticipant(false);
    
    try {
      const response = await sessionAPI.getById(sessionId);
      setSession(response.data.session);
      // Check if user is already a participant or host
      setIsHost(response.data.isHost || false);
      setIsParticipant(response.data.isParticipant || false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    // Double-check before joining
    if (isHost || isParticipant) {
      return;
    }
    
    setJoining(true);
    setError('');
    
    try {
      await sessionAPI.join(sessionId);
      setIsParticipant(true);
      onJoined?.(session);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to join session');
    } finally {
      setJoining(false);
    }
  };

  const alreadyJoined = isHost || isParticipant;
  const participantCount = session?.participants?.length || 0;
  const spotsLeft = session ? session.maxParticipants - participantCount : 0;

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Header>
        {loading ? (
          <HeaderContent>
            <Title>Loading...</Title>
          </HeaderContent>
        ) : session ? (
          <HeaderContent>
            <TypeBadge $type={session.sessionType}>
              {getTypeIcon(session.sessionType)} {session.sessionType}
            </TypeBadge>
            <Title>{session.title}</Title>
          </HeaderContent>
        ) : (
          <HeaderContent>
            <Title>Session Not Found</Title>
          </HeaderContent>
        )}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Header>
      
      <Content>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <CircularProgress />
          </div>
        ) : error && !session ? (
          <Alert severity="error">{error}</Alert>
        ) : session ? (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            
            <Section>
              <Description>{session.description}</Description>
            </Section>
            
            <MetaRow>
              <MetaItem>
                <ScheduleIcon />
                {formatDateTime(session.scheduledTime)}
              </MetaItem>
              <MetaItem>
                <PeopleIcon />
                {spotsLeft} spots left
              </MetaItem>
            </MetaRow>
            
            <Section>
              <SectionTitle>Hosted by</SectionTitle>
              <HostSection>
                <Avatar 
                  src={session.host?.Profile?.profilePicture ? resolveImageUrl(session.host.Profile.profilePicture) : undefined}
                  sx={{ width: 48, height: 48 }}
                >
                  {session.host?.firstName?.[0]}
                </Avatar>
                <HostInfo>
                  <HostName>
                    {session.host?.firstName} {session.host?.lastName}
                  </HostName>
                  <HostTitle>
                    {session.host?.Profile?.headline || 'Community Member'}
                  </HostTitle>
                </HostInfo>
                {session.host?.reputation?.averageRating > 0 && (
                  <RatingBadge>
                    <StarIcon /> {session.host.reputation.averageRating.toFixed(1)}
                  </RatingBadge>
                )}
              </HostSection>
            </Section>
            
            {session.skillsTaught?.length > 0 && (
              <Section>
                <SectionTitle>What You'll Learn</SectionTitle>
                <SkillList>
                  {session.skillsTaught.map((skill, idx) => (
                    <SkillTag key={idx}>{skill}</SkillTag>
                  ))}
                </SkillList>
              </Section>
            )}
          </>
        ) : null}
      </Content>
      
      {!loading && session && (
        <Actions>
          <ParticipantCount>
            {participantCount}/{session.maxParticipants} participants
          </ParticipantCount>
          <div>
            <Button onClick={onClose} sx={{ mr: 1 }}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleJoin}
              disabled={joining || alreadyJoined || spotsLeft <= 0}
              sx={{ 
                backgroundColor: '#7c5ecf',
                '&:hover': { backgroundColor: '#6d28d9' }
              }}
            >
              {joining ? 'Joining...' : isHost ? "You're Hosting" : isParticipant ? 'Already Joined' : spotsLeft <= 0 ? 'Session Full' : 'Join Session'}
            </Button>
          </div>
        </Actions>
      )}
    </StyledDialog>
  );
};

export default JoinSessionModal;
