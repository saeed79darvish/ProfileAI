import React, { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Avatar, Tooltip, IconButton, Chip, Box, Typography } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useNavigate } from 'react-router-dom';
import { pollsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const fillAnimation = keyframes`
  from {
    width: 0%;
  }
`;

const pulseAnimation = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
`;

const Card = styled.div`
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  
  ${props => props.$isHotTake && css`
    border: 2px solid #7c5ecf;
    box-shadow: 0 4px 20px rgba(124, 94, 207, 0.15);
  `}
  
  &:hover {
    border-color: rgba(124,94,207,0.3);
  }
`;

const PollBadgeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
`;

const PollBadgeIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(124, 94, 207, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 16px 0;
`;

const AuthorInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const AuthorDetails = styled.div`
  .name {
    font-weight: 600;
    font-size: 0.9rem;
    color: #1a1a2e;
    cursor: pointer;
    
    &:hover {
      color: #7c5ecf;
    }
  }
  
  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: #666;
    margin-top: 2px;
  }
`;

const HotTakeBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #7c5ecf 0%, #9333ea 100%);
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  animation: ${pulseAnimation} 2s infinite;
`;

const CategoryBadge = styled(Chip)`
  && {
    height: 24px;
    font-size: 0.7rem;
    font-weight: 500;
    background: ${props => props.$color}15;
    color: ${props => props.$color};
    border: 1px solid ${props => props.$color}30;
  }
`;

const Content = styled.div`
  padding: 16px;
`;

const Question = styled.h3`
  margin: 0 0 16px;
  font-size: 1.1rem;
  font-weight: 600;
  color: #1a1a2e;
  line-height: 1.4;
`;

const OptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const OptionButton = styled.button`
  position: relative;
  width: 100%;
  padding: 14px 16px;
  background: ${props => props.$selected 
    ? `${props.$color}12` 
    : props.$hasVoted ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.03)'};
  border: 2px solid ${props => props.$selected ? props.$color : 'rgba(0,0,0,0.08)'};
  border-radius: 12px;
  cursor: ${props => props.$disabled ? 'default' : 'pointer'};
  text-align: left;
  overflow: hidden;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    border-color: ${props => props.$hasVoted ? 'rgba(0,0,0,0.08)' : props.$color};
    background: ${props => props.$hasVoted ? 'rgba(0,0,0,0.03)' : `${props.$color}08`};
  }
  
  &:disabled {
    cursor: default;
  }
`;

const OptionBackground = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: ${props => props.$color}20;
  border-radius: 10px;
  animation: ${fillAnimation} 0.8s ease-out forwards;
  width: ${props => props.$percentage}%;
`;

const OptionContent = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const OptionText = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: ${props => props.$selected ? '600' : '500'};
  color: ${props => props.$selected ? props.$color : 'rgba(0,0,0,0.7)'};
`;

const OptionStats = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: ${props => props.$color};
`;

const VoteCount = styled.span`
  font-size: 0.75rem;
  color: #666;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid rgba(0,0,0,0.08);
  background: rgba(0,0,0,0.02);
`;

const Stats = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.8rem;
  color: #666;
  
  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
  }
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const TimeRemaining = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: ${props => props.$urgent ? '#ef4444' : '#666'};
  font-weight: ${props => props.$urgent ? '600' : '400'};
`;

const ExpiredBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(0,0,0,0.05);
  border-radius: 12px;
  font-size: 0.75rem;
  color: #666;
  font-weight: 500;
`;

const OPTION_COLORS = ['#7c5ecf', '#9333ea', '#818cf8', '#c084fc'];

const getTimeRemaining = (expiresAt) => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;
  
  if (diff <= 0) return { text: 'Ended', urgent: false };
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours < 1) {
    return { text: `${minutes}m left`, urgent: true };
  } else if (hours < 24) {
    return { text: `${hours}h ${minutes}m left`, urgent: hours < 3 };
  } else {
    const days = Math.floor(hours / 24);
    return { text: `${days}d left`, urgent: false };
  }
};

const PollCard = ({ poll: initialPoll, onVote, compact = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [poll, setPoll] = useState(initialPoll);
  const [loading, setLoading] = useState(false);

  const {
    id,
    author,
    question,
    options,
    isAnonymous,
    isHotTake,
    categoryInfo,
    hasVoted,
    userVote,
    expiresAt,
    isExpired
  } = poll;

  // Calculate actual total votes from options to ensure accuracy
  const actualTotalVotes = options?.reduce((sum, opt) => sum + (opt.votes || 0), 0) || 0;

  const timeRemaining = getTimeRemaining(expiresAt);
  const canVote = user && !hasVoted && !isExpired;

  const handleVote = async (optionId) => {
    if (!canVote || loading) return;
    
    setLoading(true);
    try {
      const response = await pollsAPI.vote(id, optionId);
      setPoll(response.data);
      if (onVote) {
        onVote(response.data);
      }
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/poll/${id}`;
    const shareText = `Vote on this poll: "${question}"`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Poll on ProfileAI',
          text: shareText,
          url: shareUrl
        });
        await pollsAPI.trackShare(id);
      } catch (err) {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      await pollsAPI.trackShare(id);
      // Could show a toast here
    }
  };

  const getPercentage = (votes) => {
    if (actualTotalVotes === 0) return 0;
    return Math.round((votes / actualTotalVotes) * 100);
  };

  return (
    <Card $isHotTake={isHotTake}>
      <PollBadgeHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
          <PollBadgeIcon style={categoryInfo?.color ? { background: `${categoryInfo.color}22` } : {}}>
            <DashboardIcon sx={{ fontSize: 20, color: categoryInfo?.color || '#7c5ecf' }} />
          </PollBadgeIcon>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: categoryInfo?.color || '#7c5ecf' }}>{categoryInfo?.label || 'Community Poll'}</Typography>
            <Typography variant="caption" sx={{ display: 'block', color: '#888', fontSize: '12px', lineHeight: 1.3, mt: 0.25 }}>
              Posted by {author?.firstName} {author?.lastName?.[0] ? author.lastName[0] + '.' : ''}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" sx={{ color: 'rgba(0,0,0,0.3)', '&:hover': { color: '#7c5ecf' } }}>
          <MoreHorizIcon />
        </IconButton>
      </PollBadgeHeader>

      <Content>
        <Question>{question}</Question>
        
        <OptionsContainer>
          {options.map((option, index) => {
            const percentage = getPercentage(option.votes);
            const isSelected = userVote === option.id;
            const color = OPTION_COLORS[index % OPTION_COLORS.length];
            
            return (
              <OptionButton
                key={option.id}
                type="button"
                onClick={() => handleVote(option.id)}
                disabled={!canVote || loading}
                $color={color}
                $selected={isSelected}
                $hasVoted={hasVoted || isExpired}
              >
                {(hasVoted || isExpired) && (
                  <OptionBackground 
                    $color={color} 
                    $percentage={percentage} 
                  />
                )}
                <OptionContent>
                  <OptionText $selected={isSelected} $color={color}>
                    {isSelected && <CheckCircleIcon sx={{ fontSize: 18 }} />}
                    {option.text}
                  </OptionText>
                  {(hasVoted || isExpired) && (
                    <OptionStats $color={color}>
                      {percentage}%
                      <VoteCount>({option.votes})</VoteCount>
                    </OptionStats>
                  )}
                </OptionContent>
              </OptionButton>
            );
          })}
        </OptionsContainer>
      </Content>

      <Footer>
        <Stats>
          <span className="stat">
            <HowToVoteIcon sx={{ fontSize: 16 }} />
            {actualTotalVotes} {actualTotalVotes === 1 ? 'vote' : 'votes'}
          </span>
          {isExpired ? (
            <ExpiredBadge>
              <AccessTimeIcon sx={{ fontSize: 14 }} />
              Poll ended
            </ExpiredBadge>
          ) : (
            <TimeRemaining $urgent={timeRemaining.urgent}>
              <AccessTimeIcon sx={{ fontSize: 14 }} />
              {timeRemaining.text}
            </TimeRemaining>
          )}
        </Stats>
        
        <Actions>
          <Tooltip title="Share poll">
            <IconButton size="small" onClick={handleShare}>
              <ShareIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Actions>
      </Footer>
    </Card>
  );
};

export default PollCard;
