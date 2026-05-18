import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { kudosAPI, resolveImageUrl } from '../../services/api';

const Container = styled.div`
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
`;

const Header = styled.div`
  padding: 16px;
  background: linear-gradient(135deg, #7c5ecf 0%, #9333ea 100%);
  color: white;
  
  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const TabContainer = styled.div`
  display: flex;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 4px;
  margin-top: 12px;
`;

const Tab = styled.button`
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: ${props => props.$active ? 'rgba(255,255,255,0.25)' : 'transparent'};
  color: ${props => props.$active ? 'white' : 'rgba(255, 255, 255, 0.8)'};
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$active ? 'rgba(255,255,255,0.25)' : 'rgba(255, 255, 255, 0.15)'};
  }
`;

const List = styled.div`
  padding: 8px;
`;

const UserItem = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  transition: background 0.15s ease;
  
  &:hover {
    background: rgba(0,0,0,0.03);
  }
`;

const Rank = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  
  ${props => {
    switch (props.$rank) {
      case 1:
        return `
          background: linear-gradient(135deg, #7c5ecf, #9333ea);
          color: white;
        `;
      case 2:
        return `
          background: linear-gradient(135deg, #818cf8, #7c5ecf);
          color: white;
        `;
      case 3:
        return `
          background: linear-gradient(135deg, #c084fc, #818cf8);
          color: white;
        `;
      default:
        return `
          background: rgba(0,0,0,0.05);
          color: #555;
        `;
    }
  }}
`;

const Avatar = styled(Link)`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c5ecf 0%, #9333ea 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const UserInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const UserName = styled(Link)`
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(0,0,0,0.7);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  &:hover {
    color: #7c5ecf;
  }
`;

const KudosCount = styled.div`
  font-size: 0.75rem;
  color: #666;
  margin-top: 2px;
  
  span {
    font-weight: 600;
    color: #7c5ecf;
  }
`;

const Badge = styled.div`
  padding: 4px 10px;
  background: rgba(124, 94, 207, 0.15);
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #7c5ecf;
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: #666;
  
  .emoji {
    font-size: 2rem;
    margin-bottom: 8px;
  }
  
  p {
    margin: 0;
    font-size: 0.85rem;
  }
`;

const Footer = styled.div`
  padding: 12px 16px;
  border-top: 1px solid rgba(0,0,0,0.08);
  text-align: center;
  
  a {
    font-size: 0.8rem;
    color: #7c5ecf;
    text-decoration: none;
    font-weight: 500;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

const StreakBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #7c5ecf 0%, #9333ea 100%);
  border-radius: 20px;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 12px;
  justify-content: center;
`;

const KudosLeaderboard = ({ showStats = false }) => {
  const [activeTab, setActiveTab] = useState('receivers');
  const [leaderboard, setLeaderboard] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
    if (showStats) {
      loadStats();
    }
  }, [activeTab, showStats]);

  const loadLeaderboard = async () => {
    try {
      const response = await kudosAPI.getLeaderboard(activeTab, 5);
      setLeaderboard(response.data.users || []);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await kudosAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  return (
    <Container>
      <Header>
        <h3>
          <span>🏆</span>
          Kudos Leaderboard
        </h3>
        <TabContainer>
          <Tab 
            $active={activeTab === 'receivers'} 
            onClick={() => setActiveTab('receivers')}
          >
            Top Receivers
          </Tab>
          <Tab 
            $active={activeTab === 'givers'} 
            onClick={() => setActiveTab('givers')}
          >
            Top Givers
          </Tab>
        </TabContainer>
        {showStats && stats?.streak > 0 && (
          <StreakBadge>
            <span>🔥</span>
            {stats.streak} day kudos streak!
          </StreakBadge>
        )}
      </Header>

      <List>
        {loading ? (
          <EmptyState>
            <div className="emoji">⏳</div>
            <p>Loading...</p>
          </EmptyState>
        ) : leaderboard.length === 0 ? (
          <EmptyState>
            <div className="emoji">🙌</div>
            <p>
              {activeTab === 'receivers' 
                ? 'Be the first to receive kudos!' 
                : 'Be the first to give kudos!'}
            </p>
          </EmptyState>
        ) : (
          leaderboard.map((item, index) => (
            <UserItem
              key={item.userId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Rank $rank={item.rank}>
                {item.rank <= 3 ? ['🥇', '🥈', '🥉'][item.rank - 1] : item.rank}
              </Rank>
              <Avatar to={`/profile/${item.userId}`}>
                {item.user?.profilePictureUrl ? (
                  <img src={resolveImageUrl(item.user.profilePictureUrl)} alt="" />
                ) : (
                  `${item.user?.firstName?.[0] || '?'}${item.user?.lastName?.[0] || ''}`
                )}
              </Avatar>
              <UserInfo>
                <UserName to={`/profile/${item.userId}`}>
                  {item.user?.firstName} {item.user?.lastName}
                </UserName>
                <KudosCount>
                  <span>{item.count}</span> kudos {activeTab === 'receivers' ? 'received' : 'given'}
                </KudosCount>
              </UserInfo>
            </UserItem>
          ))
        )}
      </List>

      {showStats && stats && (
        <Footer>
          <div style={{ marginBottom: 8, fontSize: '0.8rem', color: '#555' }}>
            Your kudos: <strong>{stats.totalReceived}</strong> received • <strong>{stats.totalGiven}</strong> given
          </div>
        </Footer>
      )}
    </Container>
  );
};

export default KudosLeaderboard;
