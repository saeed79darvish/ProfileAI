import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  CircularProgress,
  Alert,
  Pagination,
  InputAdornment,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import GroupIcon from '@mui/icons-material/Group';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { useParams, useNavigate } from 'react-router-dom';
import { followAPI, messageAPI, resolveImageUrl } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import FollowButton from '../../components/FollowButton';
import { ROUTES, TEXT, PAGINATION } from './constants';
import styled from 'styled-components';

// ── Styled Components ──

const PageWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px 48px;

  @media (max-width: 768px) {
    padding: 16px 12px 32px;
  }
`;

const PageHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 28px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }
`;

const StatCard = styled.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 20px 24px;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  @media (max-width: 768px) {
    padding: 14px 16px;
    border-radius: 12px;
  }
`;

const StatLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6b7280;
  margin-bottom: 4px;
`;

const StatValue = styled.div`
  font-size: 28px;
  font-weight: 800;
  color: #1a1a2e;
  line-height: 1.2;

  @media (max-width: 768px) {
    font-size: 22px;
  }
`;

const StatSub = styled.div`
  font-size: 12px;
  color: ${p => p.$color || '#10b981'};
  margin-top: 4px;
  font-weight: 500;
`;

const ContentLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
  align-items: start;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const MainContent = styled.div`
  min-width: 0;
`;

const Sidebar = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (max-width: 960px) {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const SidebarCard = styled.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 20px;
  overflow: hidden;
`;

const SidebarTitle = styled.div`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #6b7280;
  margin-bottom: 16px;
`;

const SidebarItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  cursor: pointer;

  &:not(:last-child) {
    border-bottom: 1px solid #f3f4f6;
  }

  &:hover .item-name {
    color: #667eea;
  }
`;

const SidebarItemMeta = styled.div`
  flex: 1;
  min-width: 0;

  .item-name {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    transition: color 0.15s;
  }

  .item-sub {
    font-size: 12px;
    color: #9ca3af;
    margin-top: 1px;
  }
`;

const TabRow = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 2px solid #f3f4f6;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    margin-bottom: 12px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
`;

const TabBtn = styled.button`
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  background: none;
  border: none;
  border-bottom: 2px solid ${p => p.$active ? '#1a1a2e' : 'transparent'};
  color: ${p => p.$active ? '#1a1a2e' : '#6b7280'};
  cursor: pointer;
  margin-bottom: -2px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    color: ${p => p.$active ? '#1a1a2e' : '#374151'};
  }

  @media (max-width: 768px) {
    font-size: 13px;
    padding: 10px 12px;
  }
`;

const TabCount = styled.span`
  font-size: 11px;
  font-weight: 700;
  background: ${p => p.$active ? '#f3f4f6' : '#f3f4f6'};
  color: ${p => p.$active ? '#1a1a2e' : '#9ca3af'};
  padding: 2px 8px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
`;

const UserGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 10px;
  }
`;

const UserCard = styled.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #d1d5db;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  @media (max-width: 768px) {
    padding: 16px;
    border-radius: 12px;
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 6px;
`;

const UserMeta = styled.div`
  flex: 1;
  min-width: 0;
`;

const UserName = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const UserHeadline = styled.div`
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

const UserLocation = styled.div`
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const UserActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
`;

const ActionBtn = styled.button`
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: 1.5px solid #e5e7eb;
  background: white;
  color: #374151;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &:hover {
    background: #f9fafb;
    border-color: #d1d5db;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: #9ca3af;

  .icon {
    margin-bottom: 12px;
  }

  .title {
    font-size: 16px;
    font-weight: 600;
    color: #6b7280;
    margin-bottom: 4px;
  }

  .desc {
    font-size: 14px;
  }
`;

// ── Helpers ──

const AVATAR_COLORS = ['#667eea', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#764ba2'];

const getInitials = (first, last) =>
  `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();

const getAvatarColor = (name) => {
  const idx = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

// ── Tabs enum ──
const TABS = { CONNECTIONS: 0, FOLLOWERS: 1, FOLLOWING: 2 };

// ── Component ──

const FollowersPage = () => {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [activeTab, setActiveTab] = useState(TABS.CONNECTIONS);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);

  const targetUserId = userId || currentUser?.id;
  const isOwnNetwork = targetUserId === currentUser?.id;
  const totalConnections = counts.followers + counts.following;

  // Load counts + unread messages
  useEffect(() => {
    if (targetUserId) loadCounts();
    loadUnread();
  }, [targetUserId]);

  // Load list data based on active tab
  useEffect(() => {
    if (!targetUserId) return;
    if (activeTab === TABS.FOLLOWERS) loadFollowers();
    else loadFollowing(); // CONNECTIONS + FOLLOWING both use following list
  }, [targetUserId, activeTab, page]);

  const loadUnread = async () => {
    try {
      const res = await messageAPI.getUnreadCount();
      setUnreadMessages(res.data.unreadCount || 0);
    } catch {
      // ignore
    }
  };

  const loadCounts = async () => {
    try {
      const response = await followAPI.getCounts(targetUserId);
      setCounts({
        followers: response.data.followersCount,
        following: response.data.followingCount,
      });
    } catch {
      // ignore
    }
  };

  const loadFollowers = async () => {
    try {
      setLoading(true);
      const response = await followAPI.getFollowers(targetUserId, { page, limit: PAGINATION.DEFAULT_LIMIT });
      setFollowers(response.data.followers || []);
      setTotalPages(response.data.pages || 1);
    } catch {
      setError(TEXT.ERROR_FOLLOWERS);
    } finally {
      setLoading(false);
    }
  };

  const loadFollowing = async () => {
    try {
      setLoading(true);
      const response = await followAPI.getFollowing(targetUserId, { page, limit: PAGINATION.DEFAULT_LIMIT });
      setFollowing(response.data.following || []);
      setTotalPages(response.data.pages || 1);
    } catch {
      setError(TEXT.ERROR_FOLLOWING);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
    setSearch('');
  };

  const handleUserClick = (id, role) => {
    if (role === 'recruiter') navigate(ROUTES.RECRUITER_PROFILE(id));
    else navigate(ROUTES.USER_PROFILE(id));
  };

  const handleMessage = async (e, userId) => {
    e.stopPropagation();
    try {
      const res = await messageAPI.startConversation(userId);
      navigate(`/messages/${res.data.conversationId || res.data.id}`);
    } catch {
      navigate('/messages');
    }
  };

  const handleFollowChange = useCallback(() => {
    loadCounts();
    if (activeTab === TABS.FOLLOWERS) loadFollowers();
    else loadFollowing();
  }, [activeTab, targetUserId, page]);

  // Determine which list to show
  const users = activeTab === TABS.FOLLOWERS ? followers : following;
  const filtered = search
    ? users.filter(u =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        (u.headline || '').toLowerCase().includes(search.toLowerCase())
      )
    : users;

  // Build sidebar "trending" from first few followers
  const trendingUsers = followers.slice(0, 3);

  const tabLabel = activeTab === TABS.CONNECTIONS
    ? 'connections'
    : activeTab === TABS.FOLLOWERS
      ? 'followers'
      : 'following';

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <PageHeader>
        <div>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, color: '#1a1a2e', fontSize: { xs: '1.5rem', sm: '1.8rem' } }}
          >
            Network
          </Typography>
          <Typography sx={{ color: '#6b7280', fontSize: 14, mt: 0.5 }}>
            {isOwnNetwork
              ? `Your ${totalConnections.toLocaleString()} connections, grouped by where you've crossed paths.`
              : `${totalConnections.toLocaleString()} connections`}
          </Typography>
        </div>
      </PageHeader>

      {/* ── Stats ── */}
      <StatsRow>
        <StatCard>
          <StatLabel>Connections</StatLabel>
          <StatValue>{totalConnections.toLocaleString()}</StatValue>
          <StatSub $color="#10b981">Total network</StatSub>
        </StatCard>
        <StatCard>
          <StatLabel>Followers</StatLabel>
          <StatValue>{counts.followers.toLocaleString()}</StatValue>
          <StatSub $color="#10b981">Following you</StatSub>
        </StatCard>
        <StatCard>
          <StatLabel>Following</StatLabel>
          <StatValue>{counts.following.toLocaleString()}</StatValue>
          <StatSub $color="#667eea">You follow</StatSub>
        </StatCard>
        <StatCard>
          <StatLabel>Profile Views</StatLabel>
          <StatValue>{unreadMessages.toLocaleString()}</StatValue>
          <StatSub $color="#f59e0b">Unread messages</StatSub>
        </StatCard>
      </StatsRow>

      {/* ── Content with sidebar ── */}
      <ContentLayout>
        <MainContent>
          {/* Tabs */}
          <TabRow>
            <TabBtn $active={activeTab === TABS.CONNECTIONS} onClick={() => handleTabChange(TABS.CONNECTIONS)}>
              Connections
            </TabBtn>
            <TabBtn $active={activeTab === TABS.FOLLOWERS} onClick={() => handleTabChange(TABS.FOLLOWERS)}>
              Followers
              <TabCount $active={activeTab === TABS.FOLLOWERS}>{counts.followers}</TabCount>
            </TabBtn>
            <TabBtn $active={activeTab === TABS.FOLLOWING} onClick={() => handleTabChange(TABS.FOLLOWING)}>
              Following
              <TabCount $active={activeTab === TABS.FOLLOWING}>{counts.following}</TabCount>
            </TabBtn>
          </TabRow>

          {/* Search */}
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={`Search ${tabLabel}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#9ca3af', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  fontSize: 14,
                },
              }}
            />
          </Box>

          {/* Error */}
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* User cards grid */}
          {loading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress size={32} sx={{ color: '#667eea' }} />
            </Box>
          ) : filtered.length === 0 ? (
            <EmptyState>
              <div className="icon">
                <PeopleAltIcon sx={{ fontSize: 48, color: '#d1d5db' }} />
              </div>
              <div className="title">
                {search
                  ? 'No matches found'
                  : activeTab === TABS.FOLLOWERS
                    ? TEXT.EMPTY_FOLLOWERS
                    : TEXT.EMPTY_FOLLOWING}
              </div>
              <div className="desc">
                {search
                  ? 'Try a different search term'
                  : activeTab === TABS.FOLLOWERS
                    ? 'Share your profile to get discovered'
                    : 'Browse profiles to find people to follow'}
              </div>
            </EmptyState>
          ) : (
            <UserGrid>
              {filtered.map((user) => (
                <UserCard key={user.id} onClick={() => handleUserClick(user.id, user.role)}>
                  <UserInfo>
                    <Avatar
                      src={user.profilePicture ? resolveImageUrl(user.profilePicture) : undefined}
                      sx={{
                        width: 52,
                        height: 52,
                        bgcolor: getAvatarColor(user.firstName + user.lastName),
                        fontSize: 17,
                        fontWeight: 700,
                      }}
                    >
                      {getInitials(user.firstName, user.lastName)}
                    </Avatar>
                    <UserMeta>
                      <UserName>{user.firstName} {user.lastName}</UserName>
                      <UserHeadline>
                        {user.headline || (user.companyName ? user.companyName : user.role === 'recruiter' ? 'Recruiter' : '')}
                      </UserHeadline>
                      <UserLocation>
                        {user.location && <><span>📍</span> {user.location}</>}
                        {user.location && user.mutualCount ? ' · ' : ''}
                        {user.mutualCount ? `${user.mutualCount} mutual` : ''}
                      </UserLocation>
                    </UserMeta>
                  </UserInfo>
                  <UserActions onClick={(e) => e.stopPropagation()}>
                    <ActionBtn onClick={(e) => handleMessage(e, user.id)}>
                      Message
                    </ActionBtn>
                    <ActionBtn onClick={() => handleUserClick(user.id, user.role)}>
                      View profile
                    </ActionBtn>
                  </UserActions>
                </UserCard>
              ))}
            </UserGrid>
          )}

          {/* Pagination */}
          {totalPages > 1 && !search && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                size={isMobile ? 'small' : 'medium'}
                sx={{
                  '& .MuiPaginationItem-root': {
                    fontWeight: 600,
                    '&.Mui-selected': {
                      background: '#667eea',
                      color: 'white',
                    },
                  },
                }}
              />
            </Box>
          )}
        </MainContent>

        {/* ── Sidebar ── */}
        <Sidebar>
          {/* Trending Connections */}
          <SidebarCard>
            <SidebarTitle>Trending Connections</SidebarTitle>
            {trendingUsers.length > 0 ? (
              trendingUsers.map((user) => (
                <SidebarItem
                  key={user.id}
                  onClick={() => handleUserClick(user.id, user.role)}
                >
                  <Avatar
                    src={user.profilePicture ? resolveImageUrl(user.profilePicture) : undefined}
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: getAvatarColor(user.firstName + user.lastName),
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {getInitials(user.firstName, user.lastName)}
                  </Avatar>
                  <SidebarItemMeta>
                    <div className="item-name">{user.firstName} {user.lastName}</div>
                    <div className="item-sub">
                      {user.headline || (user.role === 'recruiter' ? 'Recruiter' : 'Member')}
                    </div>
                  </SidebarItemMeta>
                </SidebarItem>
              ))
            ) : (
              <Typography sx={{ fontSize: 13, color: '#9ca3af', py: 1 }}>
                Follow people to see trending connections
              </Typography>
            )}
          </SidebarCard>
        </Sidebar>
      </ContentLayout>
    </PageWrapper>
  );
};

export default FollowersPage;
