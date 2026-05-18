import React from 'react';
import styled from 'styled-components';
import { Avatar, Chip, Box, AvatarGroup } from '@mui/material';
import {
  AccessTime as TimeIcon,
  People as PeopleIcon,
  CalendarToday as CalendarIcon,
  LocalFireDepartment as FireIcon
} from '@mui/icons-material';
import { resolveImageUrl } from '../../services/api';

// Card container
const Card = styled.div`
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  
  &:hover {
    border-color: rgba(124,94,207,0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }
`;

// Session type badge
const TypeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  ${props => props.$type === 'teaching' && `
    background: rgba(124,94,207,0.15);
    color: #7c5ecf;
  `}
  
  ${props => props.$type === 'showcase' && `
    background: rgba(124,94,207,0.15);
    color: #7c5ecf;
  `}
  
  ${props => props.$type === 'mentorship' && `
    background: rgba(124,94,207,0.15);
    color: #818cf8;
  `}
`;

const NewBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(124,94,207,0.15);
  color: #7c5ecf;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const TimeAgo = styled.span`
  font-size: 12px;
  color: #666;
`;

const Title = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 12px 0;
  line-height: 1.4;
`;

const HostInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
`;

const HostName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: rgba(0,0,0,0.7);
`;

const HostHeadline = styled.span`
  font-size: 13px;
  color: #666;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #555;
  
  svg {
    font-size: 16px;
    color: #666;
  }
`;

const TagsRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const Tag = styled.span`
  padding: 4px 10px;
  background: rgba(0,0,0,0.04);
  color: #555;
  border-radius: 4px;
  font-size: 12px;
`;

const MatchBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: ${props => props.$color === 'success' ? 'rgba(124,94,207,0.12)' : 
                         props.$color === 'primary' ? 'rgba(124,94,207,0.12)' : 
                         props.$color === 'info' ? 'rgba(124,94,207,0.12)' : 'rgba(0,0,0,0.03)'};
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  color: ${props => props.$color === 'success' ? '#7c5ecf' : 
                    props.$color === 'primary' ? '#7c5ecf' : 
                    props.$color === 'info' ? '#818cf8' : '#555'};
`;

const ActionButton = styled.button`
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$type === 'teaching' && `
    background: linear-gradient(135deg, #7c5ecf, #9333ea);
    color: white;
    &:hover { background: linear-gradient(135deg, #6d28d9, #9333ea); }
  `}
  
  ${props => props.$type === 'showcase' && `
    background: linear-gradient(135deg, #9333ea, #7c5ecf);
    color: white;
    &:hover { background: linear-gradient(135deg, #7c5ecf, #9333ea); }
  `}
  
  ${props => props.$type === 'mentorship' && `
    background: linear-gradient(135deg, #7c5ecf, #9333ea);
    color: white;
    &:hover { background: linear-gradient(135deg, #818cf8, #7c5ecf); }
  `}
`;

const MatchScore = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(124,94,207,0.15);
  color: #7c5ecf;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  margin-left: 8px;
`;

// Helper to format time ago
const formatTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

// Format scheduled time
const formatScheduledTime = (date) => {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  
  if (isToday) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return d.toLocaleDateString('en-US', { weekday: 'short' }) + ` ${time}`;
};

// Type labels
const TYPE_LABELS = {
  teaching: 'Teaching Session',
  showcase: 'Team Showcase',
  mentorship: 'Mentorship'
};

// Action button labels
const ACTION_LABELS = {
  teaching: 'Reserve Your Spot',
  showcase: 'Join Showcase',
  mentorship: 'Offer Guidance'
};

/**
 * Session Card Component
 * 
 * Props:
 * - session: Session object
 * - matchScore: Optional match score (0-100)
 * - matchReason: Optional match reason object { icon, text, color }
 * - onAction: Callback when action button clicked
 * - isNew: Whether to show NEW badge
 */
const SessionCard = ({ 
  session, 
  matchScore, 
  matchReason, 
  onAction,
  isNew = false 
}) => {
  const {
    id,
    sessionType,
    title,
    host,
    participants,
    durationMinutes,
    maxParticipants,
    currentParticipants,
    scheduledTime,
    tags,
    category,
    projectDuration,
    helpTopics,
    createdAt
  } = session;

  // Get co-hosts for showcase
  const coHosts = participants?.filter(p => p.role === 'co-host') || [];
  
  return (
    <Card>
      {/* Header with badge */}
      <Header>
        <div>
          <TypeBadge $type={sessionType}>
            {TYPE_LABELS[sessionType]}
          </TypeBadge>
          {isNew && (
            <NewBadge>
              <FireIcon style={{ fontSize: 12 }} /> NEW
            </NewBadge>
          )}
          {matchScore && matchScore >= 80 && (
            <MatchScore>⭐ {matchScore}% Match</MatchScore>
          )}
        </div>
        <TimeAgo>{formatTimeAgo(createdAt)}</TimeAgo>
      </Header>

      {/* Title */}
      <Title>{title}</Title>

      {/* Host info */}
      <HostInfo>
        {sessionType === 'showcase' && coHosts.length > 0 ? (
          <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}>
            <Avatar 
              src={resolveImageUrl(host?.profile?.profilePicture)} 
              alt={`${host?.firstName} ${host?.lastName}`}
            />
            {coHosts.map(ch => (
              <Avatar 
                key={ch.userId}
                src={resolveImageUrl(ch.user?.profile?.profilePicture)}
                alt={`${ch.user?.firstName} ${ch.user?.lastName}`}
              />
            ))}
          </AvatarGroup>
        ) : (
          <Avatar 
            src={resolveImageUrl(host?.profile?.profilePicture)}
            sx={{ width: 40, height: 40 }}
          />
        )}
        <div>
          <HostName>
            {sessionType === 'showcase' && coHosts.length > 0 
              ? `${host?.firstName}'s Team`
              : `${host?.firstName} ${host?.lastName}`
            }
          </HostName>
          <br />
          <HostHeadline>
            {host?.profile?.headline || host?.profile?.title}
            {projectDuration && ` • ${projectDuration}`}
          </HostHeadline>
        </div>
      </HostInfo>

      {/* Help topics for mentorship */}
      {sessionType === 'mentorship' && helpTopics?.length > 0 && (
        <Box sx={{ mb: 2, pl: 1 }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
            Looking for advice on:
          </div>
          {helpTopics.slice(0, 4).map((topic, idx) => (
            <div key={idx} style={{ fontSize: 13, color: 'rgba(0,0,0,0.6)', marginLeft: 8 }}>
              • {topic}
            </div>
          ))}
        </Box>
      )}

      {/* Meta info */}
      <MetaRow>
        <MetaItem>
          <TimeIcon />
          {durationMinutes} min
        </MetaItem>
        <MetaItem>
          <PeopleIcon />
          {sessionType === 'mentorship' 
            ? `${currentParticipants || 0}/${maxParticipants || 3} mentors`
            : `${currentParticipants || 0}/${maxParticipants} spots`
          }
        </MetaItem>
        {scheduledTime && (
          <MetaItem>
            <CalendarIcon />
            {formatScheduledTime(scheduledTime)}
          </MetaItem>
        )}
      </MetaRow>

      {/* Tags */}
      <TagsRow>
        {category && <Tag>{category}</Tag>}
        {tags?.slice(0, 3).map((tag, idx) => (
          <Tag key={idx}>{tag}</Tag>
        ))}
      </TagsRow>

      {/* Match reason banner */}
      {matchReason && (
        <MatchBanner $color={matchReason.color}>
          <span>{matchReason.icon}</span>
          <span>{matchReason.text}</span>
        </MatchBanner>
      )}

      {/* Action button */}
      <ActionButton 
        $type={sessionType}
        onClick={() => onAction?.(session)}
      >
        {ACTION_LABELS[sessionType]}
      </ActionButton>
    </Card>
  );
};

export default SessionCard;
