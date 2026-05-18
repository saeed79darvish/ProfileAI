import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { Skeleton, ToggleButton, ToggleButtonGroup, Avatar, Tooltip } from '@mui/material';
import { pollsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const pulse = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
`;

const Container = styled.div`
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(0,0,0,0.08);
`;

const Title = styled.h3`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #1a1a2e;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledToggleButtonGroup = styled(ToggleButtonGroup)`
  && {
    .MuiToggleButton-root {
      padding: 4px 8px;
      font-size: 0.7rem;
      text-transform: none;
      border-radius: 8px !important;
      border: none;
      
      &.Mui-selected {
        background: linear-gradient(135deg, #7c5ecf 0%, #9333ea 100%);
        color: white;
        
        &:hover {
          background: linear-gradient(135deg, #6d28d9 0%, #9333ea 100%);
        }
      }
    }
  }
`;

const PollList = styled.div`
  padding: 8px;
`;

const PollItem = styled.div`
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  
  &:hover {
    background: rgba(0,0,0,0.03);
    border-color: rgba(0,0,0,0.06);
  }
  
  &:not(:last-child) {
    margin-bottom: 8px;
  }
`;

const PollQuestion = styled.div`
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(0,0,0,0.7);
  margin-bottom: 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const PollMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.7rem;
  color: #666;
`;

const PollStats = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  
  .stat {
    display: flex;
    align-items: center;
    gap: 3px;
  }
`;

const HotTakeIndicator = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #7c5ecf;
  font-weight: 600;
  animation: ${pulse} 2s infinite;
`;

const MiniVoteBar = styled.div`
  display: flex;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  background: rgba(124,94,207,0.15);
  margin-top: 8px;
`;

const MiniVoteSegment = styled.div`
  height: 100%;
  background: ${props => props.$color};
  width: ${props => props.$percentage}%;
  transition: width 0.3s ease;
`;

const EmptyState = styled.div`
  padding: 24px;
  text-align: center;
  color: #666;
  
  .icon {
    font-size: 2rem;
    margin-bottom: 8px;
    opacity: 0.5;
  }
  
  .title {
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .subtitle {
    font-size: 0.8rem;
  }
`;

const ViewAllLink = styled.button`
  display: block;
  width: 100%;
  padding: 12px;
  background: rgba(0,0,0,0.03);
  border: none;
  border-top: 1px solid rgba(0,0,0,0.08);
  color: #7c5ecf;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(124,94,207,0.1);
  }
`;

const OPTION_COLORS = ['#7c5ecf', '#9333ea', '#818cf8', '#c084fc'];

const getTimeRemaining = (expiresAt) => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;
  
  if (diff <= 0) return 'Ended';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours < 1) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const TrendingPolls = ({ limit = 5 }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState('trending');

  useEffect(() => {
    fetchPolls();
  }, [viewType]);

  const fetchPolls = async () => {
    setLoading(true);
    try {
      let response;
      if (viewType === 'hot') {
        response = await pollsAPI.getHotTakes(limit);
      } else {
        response = await pollsAPI.getTrending(limit);
      }
      setPolls(response.data);
    } catch (error) {
      console.error('Error fetching polls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = (e, newView) => {
    if (newView) {
      setViewType(newView);
    }
  };

  const handlePollClick = (pollId) => {
    navigate(`/poll/${pollId}`);
  };

  const getPercentages = (options) => {
    const totalVotes = options?.reduce((sum, opt) => sum + (opt.votes || 0), 0) || 0;
    if (totalVotes === 0) return options.map(() => 0);
    return options.map(opt => Math.round((opt.votes / totalVotes) * 100));
  };

  return (
    <Container>
      <Header>
        <Title>
          {viewType === 'hot' ? (
            <LocalFireDepartmentIcon sx={{ color: '#7c5ecf' }} />
          ) : (
            <TrendingUpIcon sx={{ color: '#7c5ecf' }} />
          )}
          {viewType === 'hot' ? 'Hot Takes' : 'Trending Polls'}
        </Title>
        <StyledToggleButtonGroup
          value={viewType}
          exclusive
          onChange={handleViewChange}
          size="small"
        >
          <ToggleButton value="trending">
            <TrendingUpIcon sx={{ fontSize: 14, mr: 0.5 }} />
            Trending
          </ToggleButton>
          <ToggleButton value="hot">
            <LocalFireDepartmentIcon sx={{ fontSize: 14, mr: 0.5 }} />
            Hot
          </ToggleButton>
        </StyledToggleButtonGroup>
      </Header>

      <PollList>
        {loading ? (
          // Skeleton loading
          [...Array(3)].map((_, i) => (
            <PollItem key={i}>
              <Skeleton variant="text" width="90%" height={20} />
              <Skeleton variant="text" width="60%" height={16} />
              <Skeleton variant="rectangular" height={4} sx={{ mt: 1, borderRadius: 1 }} />
            </PollItem>
          ))
        ) : polls.length === 0 ? (
          <EmptyState>
            <div className="icon">📊</div>
            <div className="title">No {viewType === 'hot' ? 'hot takes' : 'polls'} yet</div>
            <div className="subtitle">Be the first to start a debate!</div>
          </EmptyState>
        ) : (
          polls.map(poll => {
            const percentages = getPercentages(poll.options);
            const actualTotalVotes = poll.options?.reduce((sum, opt) => sum + (opt.votes || 0), 0) || 0;
            
            return (
              <PollItem key={poll.id} onClick={() => handlePollClick(poll.id)}>
                <PollQuestion>
                  {poll.question}
                </PollQuestion>
                
                <PollMeta>
                  <PollStats>
                    <span className="stat">
                      <HowToVoteIcon sx={{ fontSize: 12 }} />
                      {actualTotalVotes}
                    </span>
                    <span className="stat">
                      <AccessTimeIcon sx={{ fontSize: 12 }} />
                      {getTimeRemaining(poll.expiresAt)}
                    </span>
                  </PollStats>
                  
                  {poll.isHotTake && (
                    <HotTakeIndicator>
                      <LocalFireDepartmentIcon sx={{ fontSize: 12 }} />
                      Hot
                    </HotTakeIndicator>
                  )}
                </PollMeta>

                {poll.totalVotes > 0 && (
                  <MiniVoteBar>
                    {poll.options.map((opt, idx) => (
                      <MiniVoteSegment
                        key={opt.id}
                        $color={OPTION_COLORS[idx % OPTION_COLORS.length]}
                        $percentage={percentages[idx]}
                      />
                    ))}
                  </MiniVoteBar>
                )}
              </PollItem>
            );
          })
        )}
      </PollList>

      {polls.length > 0 && (
        <ViewAllLink onClick={() => navigate('/polls')}>
          View all polls →
        </ViewAllLink>
      )}
    </Container>
  );
};

export default TrendingPolls;
