import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { notificationAPI } from '../../services/api';
import {
  Box,
  Typography,
  Avatar,
  CircularProgress,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Button,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Event as EventIcon,
  Work as WorkIcon,
  Message as MessageIcon,
  SmartToy as AgentIcon,
  PersonAdd as FollowIcon,
  ThumbUp as LikeIcon,
  Comment as CommentIcon,
  Info as SystemIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  MoreVert as MoreVertIcon,
  Settings as SettingsIcon,
  Star as StarIcon,
  CheckCircleOutline as SuccessIcon,
} from '@mui/icons-material';
import { ROUTES, PAGE_SIZE } from './constants';
import styled from 'styled-components';

// ── Notification config ──

const notificationConfig = {
  interview_scheduled: { icon: EventIcon, color: '#4caf50', label: 'Interview' },
  interview_updated: { icon: EventIcon, color: '#2196f3', label: 'Interview' },
  interview_cancelled: { icon: EventIcon, color: '#f44336', label: 'Interview' },
  interview_reminder: { icon: EventIcon, color: '#ff9800', label: 'Interview' },
  application_received: { icon: WorkIcon, color: '#9c27b0', label: 'Jobs' },
  application_status: { icon: WorkIcon, color: '#667eea', label: 'Jobs' },
  message_received: { icon: MessageIcon, color: '#00bcd4', label: 'Messages' },
  agent_update: { icon: AgentIcon, color: '#673ab7', label: 'Agent' },
  agent_completed: { icon: AgentIcon, color: '#4caf50', label: 'Agent' },
  follow_new: { icon: FollowIcon, color: '#e91e63', label: 'Network' },
  post_like: { icon: LikeIcon, color: '#ff5722', label: 'Mentions' },
  post_comment: { icon: CommentIcon, color: '#795548', label: 'Mentions' },
  kudos: { icon: StarIcon, color: '#f59e0b', label: 'Mentions' },
  system: { icon: SystemIcon, color: '#607d8b', label: 'System' },
};

const getNotificationLink = (notification) => {
  const { type, data } = notification;
  switch (type) {
    case 'interview_scheduled':
    case 'interview_updated':
    case 'interview_cancelled':
    case 'interview_reminder':
      return ROUTES.INTERVIEWS;
    case 'application_received':
      return data?.jobId ? ROUTES.RECRUITER_JOB_APPLICATIONS(data.jobId) : ROUTES.RECRUITER_JOBS;
    case 'application_status':
      return ROUTES.JOBS;
    case 'message_received':
      return data?.conversationId ? ROUTES.MESSAGES_CONVERSATION(data.conversationId) : ROUTES.MESSAGES;
    case 'agent_update':
    case 'agent_completed':
      return data?.negotiationId ? ROUTES.AGENT_ARENA_DETAIL(data.negotiationId) : ROUTES.AGENT_ARENA;
    case 'follow_new':
      return data?.followerId ? ROUTES.PROFILE(data.followerId) : ROUTES.NETWORK;
    case 'post_like':
    case 'post_comment':
      return data?.postId ? ROUTES.FEED_POST(data.postId) : ROUTES.FEED;
    default:
      return null;
  }
};

// Tab filter mapping
const TAB_FILTERS = {
  0: null, // All
  1: ['post_like', 'post_comment', 'kudos'], // Mentions
  2: ['application_received', 'application_status', 'interview_scheduled', 'interview_updated', 'interview_cancelled', 'interview_reminder'], // Jobs
  3: ['message_received'], // Messages
  4: ['follow_new', 'agent_update', 'agent_completed'], // Network
};

// ── Styled Components ──

const PageWrapper = styled.div`
  max-width: 780px;
  margin: 0 auto;
  padding: 32px 24px 48px;

  @media (max-width: 600px) {
    padding: 16px 12px 32px;
  }
`;

const PageHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;

  @media (max-width: 600px) {
    flex-direction: column;
    gap: 12px;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: 600px) {
    width: 100%;
    justify-content: flex-end;
  }
`;

const HeaderLink = styled.button`
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;

  &:hover {
    color: #667eea;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const PrefsBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }
`;

const TabRow = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 2px solid #f3f4f6;
  margin-bottom: 0;
  margin-top: 16px;

  @media (max-width: 600px) {
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
  gap: 6px;

  &:hover {
    color: ${p => p.$active ? '#1a1a2e' : '#374151'};
  }

  @media (max-width: 600px) {
    font-size: 13px;
    padding: 10px 12px;
  }
`;

const TabBadge = styled.span`
  font-size: 11px;
  font-weight: 700;
  background: ${p => p.$active ? '#667eea' : '#e5e7eb'};
  color: ${p => p.$active ? 'white' : '#6b7280'};
  padding: 1px 7px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
`;

const NotifCard = styled.div`
  background: ${p => p.$unread ? '#faf9ff' : 'white'};
  border-bottom: 1px solid #f3f4f6;
  padding: 20px 24px;
  display: flex;
  gap: 14px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;

  &:hover {
    background: #f9fafb;
  }

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 600px) {
    padding: 16px 14px;
    gap: 12px;
  }
`;

const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const StatusDot = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${p => p.$color || '#667eea'};
  border: 2px solid white;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    font-size: 8px;
    color: white;
  }
`;

const NotifBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const NotifTitle = styled.div`
  font-size: 14px;
  color: #1a1a2e;
  line-height: 1.5;
  font-weight: ${p => p.$unread ? 600 : 400};

  strong {
    font-weight: 700;
  }

  a {
    color: #667eea;
    text-decoration: none;
    font-weight: 600;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const NotifTime = styled.div`
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
`;

const NotifPreview = styled.div`
  background: #f3f4f6;
  border-radius: 10px;
  padding: 10px 14px;
  margin-top: 8px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.4;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    right: -2px;
    top: 50%;
    transform: translateY(-50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #667eea;
    display: ${p => p.$unread ? 'block' : 'none'};
  }
`;

const NotifActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
`;

const NotifBtn = styled.button`
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: none;

  &.primary {
    background: #667eea;
    color: white;

    &:hover {
      background: #5a6fd6;
    }
  }

  &.secondary {
    background: none;
    color: #6b7280;
    padding: 5px 8px;

    &:hover {
      color: #374151;
    }
  }
`;

const UnreadDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #667eea;
  flex-shrink: 0;
  margin-top: 6px;
  margin-left: auto;
`;

const DayDivider = styled.div`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #9ca3af;
  padding: 12px 24px;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;

  @media (max-width: 600px) {
    padding: 10px 14px;
  }
`;

const NotifList = styled.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  overflow: hidden;
  margin-top: 0;

  @media (max-width: 600px) {
    border-radius: 12px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 56px 24px;

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
    color: #9ca3af;
  }
`;

// ── Helpers ──

const formatNotifTime = (dateStr) => {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return 'Yesterday, ' + format(date, 'h:mm a');
  }
  return format(date, 'MMM d, h:mm a');
};

const getDayLabel = (dateStr) => {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d');
};

const groupByDay = (notifications) => {
  const groups = [];
  let currentLabel = null;

  for (const n of notifications) {
    const label = getDayLabel(n.createdAt);
    if (label !== currentLabel) {
      groups.push({ type: 'divider', label });
      currentLabel = label;
    }
    groups.push({ type: 'notification', data: n });
  }
  return groups;
};

// ── Component ──

const NotificationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadNotifications = useCallback(async (resetPage = false) => {
    try {
      if (resetPage) {
        setLoading(true);
        setPage(1);
      }
      const currentPage = resetPage ? 1 : page;
      const params = { page: currentPage, limit: PAGE_SIZE };

      // Use type filter if on a specific tab
      const typeFilter = TAB_FILTERS[activeTab];
      if (typeFilter) {
        params.type = typeFilter.join(',');
      }

      const response = await notificationAPI.getAll(params);
      const { notifications: newNotifs, pagination } = response.data;

      if (resetPage) {
        setNotifications(newNotifs);
      } else {
        setNotifications(prev => [...prev, ...newNotifs]);
      }
      setHasMore(pagination.hasMore);
      setError(null);
    } catch {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  useEffect(() => {
    loadNotifications(true);
  }, [activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
      loadNotifications();
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      try {
        await notificationAPI.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
      } catch {
        // ignore
      }
    }
    const link = getNotificationLink(notification);
    if (link) navigate(link);
  };

  const handleMarkAllAsRead = async () => {
    setActionLoading(true);
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await notificationAPI.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setMenuAnchorEl(null);
    } catch {
      // ignore
    }
  };

  const handleMenuOpen = (e, notification) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setSelectedNotification(notification);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedNotification(null);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Filter notifications client-side for tabs (backend may not support type array filter)
  const filteredNotifs = useMemo(() => {
    const typeFilter = TAB_FILTERS[activeTab];
    if (!typeFilter) return notifications;
    return notifications.filter(n => typeFilter.includes(n.type));
  }, [notifications, activeTab]);

  const grouped = useMemo(() => groupByDay(filteredNotifs), [filteredNotifs]);

  const getNotifIcon = (type) => {
    const config = notificationConfig[type] || notificationConfig.system;
    return { Icon: config.icon, color: config.color };
  };

  // Determine action buttons per notification type
  const renderNotifActions = (notification) => {
    const { type, data } = notification;

    if (type === 'message_received') {
      return (
        <NotifActions onClick={e => e.stopPropagation()}>
          <NotifBtn
            className="primary"
            onClick={() => {
              const link = getNotificationLink(notification);
              if (link) navigate(link);
            }}
          >
            Reply
          </NotifBtn>
          <NotifBtn
            className="secondary"
            onClick={() => {
              const link = getNotificationLink(notification);
              if (link) navigate(link);
            }}
          >
            View thread
          </NotifBtn>
        </NotifActions>
      );
    }

    if (type === 'application_status') {
      return (
        <NotifActions onClick={e => e.stopPropagation()}>
          <NotifBtn
            className="primary"
            onClick={() => navigate(ROUTES.JOBS)}
          >
            View jobs
          </NotifBtn>
        </NotifActions>
      );
    }

    if (type === 'follow_new') {
      return (
        <NotifActions onClick={e => e.stopPropagation()}>
          <NotifBtn
            className="secondary"
            onClick={() => {
              if (data?.followerId) navigate(ROUTES.PROFILE(data.followerId));
            }}
          >
            Send message
          </NotifBtn>
        </NotifActions>
      );
    }

    return null;
  };

  const TABS = [
    { label: 'All', count: unreadCount },
    { label: 'Mentions' },
    { label: 'Jobs' },
    { label: 'Messages' },
    { label: 'Network' },
  ];

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <PageHeader>
        <div>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, color: '#1a1a2e', fontSize: { xs: '1.5rem', sm: '1.8rem' } }}
          >
            Notifications
          </Typography>
          <Typography sx={{ color: '#6b7280', fontSize: 14, mt: 0.5 }}>
            {unreadCount > 0
              ? `You have ${unreadCount} unread.`
              : 'All caught up!'}
          </Typography>
        </div>
        <HeaderActions>
          <HeaderLink
            onClick={handleMarkAllAsRead}
            disabled={actionLoading || unreadCount === 0}
          >
            Mark all as read
          </HeaderLink>
          <PrefsBtn>
            <SettingsIcon sx={{ fontSize: 16 }} />
            Preferences
          </PrefsBtn>
        </HeaderActions>
      </PageHeader>

      {/* ── Tabs ── */}
      <TabRow>
        {TABS.map((tab, i) => (
          <TabBtn key={tab.label} $active={activeTab === i} onClick={() => handleTabChange(i)}>
            {tab.label}
            {tab.count > 0 && (
              <TabBadge $active={activeTab === i}>{tab.count}</TabBadge>
            )}
          </TabBtn>
        ))}
      </TabRow>

      {/* ── Error ── */}
      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ── Content ── */}
      {loading && page === 1 ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress size={32} sx={{ color: '#667eea' }} />
        </Box>
      ) : filteredNotifs.length === 0 ? (
        <NotifList>
          <EmptyState>
            <div className="icon">
              <NotificationsIcon sx={{ fontSize: 48, color: '#d1d5db' }} />
            </div>
            <div className="title">
              {activeTab === 0 ? 'No notifications yet' : `No ${TABS[activeTab]?.label.toLowerCase()} notifications`}
            </div>
            <div className="desc">
              We'll notify you when something happens
            </div>
          </EmptyState>
        </NotifList>
      ) : (
        <NotifList>
          {grouped.map((item, idx) => {
            if (item.type === 'divider') {
              return <DayDivider key={`div-${idx}`}>{item.label}</DayDivider>;
            }

            const n = item.data;
            const { Icon, color } = getNotifIcon(n.type);

            return (
              <NotifCard
                key={n.id}
                $unread={!n.isRead}
                onClick={() => handleNotificationClick(n)}
              >
                <AvatarWrap>
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: `${color}20`,
                      color: color,
                      fontSize: 18,
                    }}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                  </Avatar>
                  <StatusDot $color={color}>
                    <Icon sx={{ fontSize: 8 }} />
                  </StatusDot>
                </AvatarWrap>

                <NotifBody>
                  <NotifTitle $unread={!n.isRead}
                    dangerouslySetInnerHTML={{ __html: n.title }}
                  />
                  <NotifTime>{formatNotifTime(n.createdAt)}</NotifTime>

                  {/* Message preview */}
                  {n.message && n.type === 'message_received' && (
                    <NotifPreview $unread={!n.isRead}>
                      "{n.message}"
                    </NotifPreview>
                  )}

                  {/* Action buttons */}
                  {renderNotifActions(n)}
                </NotifBody>

                {/* Unread dot */}
                {!n.isRead && <UnreadDot />}

                {/* Menu */}
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, n)}
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    opacity: 0.4,
                    '&:hover': { opacity: 1 },
                  }}
                >
                  <MoreVertIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </NotifCard>
            );
          })}

          {hasMore && (
            <Box textAlign="center" py={2}>
              <Button
                variant="text"
                onClick={handleLoadMore}
                disabled={loading}
                sx={{ textTransform: 'none', fontWeight: 600, color: '#667eea' }}
              >
                {loading ? <CircularProgress size={20} /> : 'Load more'}
              </Button>
            </Box>
          )}
        </NotifList>
      )}

      {/* ── Context Menu ── */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 160 } }}
      >
        {selectedNotification && !selectedNotification.isRead && (
          <MenuItem
            onClick={() => {
              handleNotificationClick(selectedNotification);
              handleMenuClose();
            }}
            sx={{ fontSize: 14 }}
          >
            <CheckIcon sx={{ fontSize: 18, mr: 1, color: '#667eea' }} />
            Mark as read
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (selectedNotification) handleDeleteNotification(selectedNotification.id);
          }}
          sx={{ fontSize: 14, color: '#ef4444' }}
        >
          <DeleteIcon sx={{ fontSize: 18, mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </PageWrapper>
  );
};

export default NotificationsPage;
