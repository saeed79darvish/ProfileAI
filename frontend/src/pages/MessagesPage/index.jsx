import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Drawer,
  useTheme,
  useMediaQuery,
  Chip,
  Paper,
} from '@mui/material';
import {
  Send as SendIcon,
  ArrowBack as ArrowBackIcon,
  Search as MuiSearchIcon,
  Forum as ForumIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  Done as DoneIcon,
  AttachFile as AttachFileIcon,
  InsertEmoticon as EmojiIcon,
  Info as InfoIcon,
  Email as EmailIcon,
  AccessTime as TimeIcon,
  Star as StarIcon,
  Schedule as ScheduleIcon,
  EventAvailable as EventAvailableIcon,
  SmartToy as AgentIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate, useParams } from 'react-router-dom';
import { messageAPI, interviewAPI, agentArenaAPI, resolveImageUrl } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES, TIMINGS, TIME_THRESHOLDS } from './constants';
import * as S from './styled';

const AVATAR_COLORS = ['#667eea', '#764ba2', '#f093fb', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];
const getAvatarColor = (name) => {
  const code = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
};

const MessagesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  
  // Reschedule dialog state
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [pendingInterview, setPendingInterview] = useState(null);
  
  // AI Agent reschedule state
  const [rescheduleNegotiation, setRescheduleNegotiation] = useState(null);
  const [aiRescheduleLoading, setAiRescheduleLoading] = useState(false);
  const [showRescheduleChat, setShowRescheduleChat] = useState(false);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  const previousMessagesLength = useRef(0);

  const loadConversations = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const response = await messageAPI.getConversations();
      setConversations(response.data.conversations || []);
    } catch (err) {
      if (isInitial) setError('Failed to load conversations');
      console.error(err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const loadMessages = async (convId) => {
    try {
      const response = await messageAPI.getConversation(convId);
      setMessages(response.data.messages || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const loadPendingInterview = async (convId) => {
    try {
      const otherUser = getOtherParticipant(selectedConversation);
      if (otherUser && user?.role === 'candidate') {
        const response = await interviewAPI.getMyInterviews();
        const interviews = response.data.interviews || response.data || [];
        const pending = interviews.find(
          (i) => i.status === 'scheduled' && 
                 (i.recruiterId === otherUser.id || i.recruiterUserId === otherUser.id)
        );
        setPendingInterview(pending || null);
      }
    } catch (err) {
      console.error('Failed to load pending interview:', err);
      setPendingInterview(null);
    }
  };

  const scrollToBottom = useCallback((force = false) => {
    if (force || isUserAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isUserAtBottom]);

  // Track if user is scrolled to bottom
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px threshold
    setIsUserAtBottom(isAtBottom);
  }, []);

  useEffect(() => {
    loadConversations(true);
  }, []);

  useEffect(() => {
    if (!selectedConversation?.id) return;
    const interval = setInterval(() => {
      loadMessages(selectedConversation.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedConversation?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        setSelectedConversation(conv);
      }
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    if (selectedConversation?.id) {
      loadMessages(selectedConversation.id);
      loadPendingInterview(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  // Only auto-scroll when: 1) New messages arrive AND user is at bottom, OR 2) User sends a message
  useEffect(() => {
    const messagesIncreased = messages.length > previousMessagesLength.current;
    previousMessagesLength.current = messages.length;
    
    if (messagesIncreased && isUserAtBottom) {
      scrollToBottom(false);
    }
  }, [messages, isUserAtBottom, scrollToBottom]);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    navigate(`/messages/${conversation.id}`);
  };

  const handleSendMessage = async () => {
    console.log('📤 handleSendMessage called:', { newMessage, selectedConversation: selectedConversation?.id, sendingMessage });
    if (!newMessage.trim() || !selectedConversation || sendingMessage) {
      console.log('📤 handleSendMessage early return:', { 
        hasMessage: !!newMessage.trim(), 
        hasConversation: !!selectedConversation, 
        isSending: sendingMessage 
      });
      return;
    }

    try {
      setSendingMessage(true);
      console.log('📤 Sending message to conversation:', selectedConversation.id);
      const response = await messageAPI.sendToConversation(selectedConversation.id, newMessage.trim());
      console.log('📤 Message sent successfully:', response);
      setNewMessage('');
      await loadMessages(selectedConversation.id);
      await loadConversations();
      scrollToBottom(true); // Force scroll after sending
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      console.error('📤 Failed to send message:', err);
      console.error('📤 Error details:', err.response?.data || err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMenuOpen = (event, conv) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setConversationToDelete(conv);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleActionMenuOpen = (event) => {
    setActionMenuAnchorEl(event.currentTarget);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchorEl(null);
  };

  const handleOpenRescheduleDialog = () => {
    handleActionMenuClose();
    setRescheduleDialogOpen(true);
  };

  const handleCloseRescheduleDialog = () => {
    setRescheduleDialogOpen(false);
    setRescheduleDate(null);
    setRescheduleReason('');
  };

  const handleSubmitReschedule = async () => {
    if (!pendingInterview || !rescheduleDate) return;
    
    try {
      setSubmittingReschedule(true);
      await interviewAPI.requestReschedule(pendingInterview.id, {
        proposedDate: rescheduleDate.toISOString(),
        reason: rescheduleReason,
      });
      handleCloseRescheduleDialog();
      // Optionally send a message about the reschedule request
      const otherUser = getOtherParticipant(selectedConversation);
      if (otherUser && selectedConversation) {
        await messageAPI.sendMessage(selectedConversation.id, {
          content: `I've requested to reschedule our interview to ${rescheduleDate.toLocaleString()}. Reason: ${rescheduleReason || 'Schedule conflict'}`,
        });
        await loadMessages(selectedConversation.id);
      }
    } catch (err) {
      console.error('Failed to request reschedule:', err);
    } finally {
      setSubmittingReschedule(false);
    }
  };

  // AI Agent Reschedule Functions
  const handleStartAiReschedule = async () => {
    if (!pendingInterview) return;
    
    try {
      setAiRescheduleLoading(true);
      handleActionMenuClose();
      
      const response = await agentArenaAPI.initiateReschedule(
        pendingInterview.id,
        rescheduleReason || 'Schedule conflict',
        rescheduleDate ? [rescheduleDate.toISOString()] : [],
        'flexible'
      );
      
      setRescheduleNegotiation(response.data.negotiation);
      setShowRescheduleChat(true);
      handleCloseRescheduleDialog();
      
      // Send notification message
      if (selectedConversation) {
        await messageAPI.sendMessage(selectedConversation.id, {
          content: `🤖 My AI agent is reaching out to discuss rescheduling our interview. You'll receive the proposed changes shortly.`,
        });
        await loadMessages(selectedConversation.id);
      }
    } catch (err) {
      console.error('Failed to start AI reschedule:', err);
      alert(err.response?.data?.error || 'Failed to start AI reschedule negotiation');
    } finally {
      setAiRescheduleLoading(false);
    }
  };

  const handleContinueAiReschedule = async () => {
    if (!rescheduleNegotiation) return;
    
    try {
      setAiRescheduleLoading(true);
      const response = await agentArenaAPI.continueReschedule(rescheduleNegotiation.id);
      setRescheduleNegotiation(response.data.negotiation);
      
      // Check if negotiation concluded
      if (response.data.negotiation.status !== 'negotiating') {
        const outcome = response.data.negotiation.outcome;
        if (outcome?.newDate) {
          // Send confirmation message
          if (selectedConversation) {
            await messageAPI.sendMessage(selectedConversation.id, {
              content: `✅ Interview rescheduled to ${new Date(outcome.newDate).toLocaleString()}. Looking forward to it!`,
            });
            await loadMessages(selectedConversation.id);
            await loadPendingInterview(selectedConversation.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to continue AI reschedule:', err);
      alert(err.response?.data?.error || 'Failed to continue reschedule negotiation');
    } finally {
      setAiRescheduleLoading(false);
    }
  };

  const handleDeleteClick = () => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!conversationToDelete) return;
    
    try {
      await messageAPI.deleteConversation(conversationToDelete.id);
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
      
      if (selectedConversation?.id === conversationToDelete.id) {
        setSelectedConversation(null);
        setMessages([]);
        navigate('/messages');
      }
      
      await loadConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const getOtherParticipant = (conversation) => {
    if (!conversation) return null;
    return conversation.otherUser || null;
  };

  const getProfilePicture = (participant) => {
    if (!participant) return null;
    if (participant.profilePicture) {
      return resolveImageUrl(participant.profilePicture);
    }
    return null;
  };

  const getHeadline = (participant) => {
    if (!participant) return '';
    if (participant.headline) return participant.headline;
    if (participant.companyName) return participant.companyName;
    return participant.role === 'recruiter' ? 'Recruiter' : 'Candidate';
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return diffMins + 'm';
    if (diffHours < 24) return diffHours + 'h';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return diffDays + ' days ago';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatMessageTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isRescheduleMessage = (content) => {
    if (!content) return false;
    return content.toLowerCase().includes('reschedule') && content.toLowerCase().includes('interview');
  };

  const isInterviewRequestMessage = (message) => {
    if (!message.content) return false;
    const content = message.content.toLowerCase();
    if (message.metadata?.type === 'interview_request') return true;
    return (content.includes('interview') && content.includes('please select')) ||
           (content.includes('schedule an interview') && content.includes('preferred time'));
  };

  const isRescheduleRequestMessage = (message) => {
    return message.metadata?.type === 'interview_reschedule_request';
  };

  const getDateDivider = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const shouldShowDateDivider = (message, index, allMessages) => {
    if (index === 0) return true;
    const prevDate = new Date(allMessages[index - 1].createdAt).toDateString();
    const currDate = new Date(message.createdAt).toDateString();
    return prevDate !== currDate;
  };

  const filteredConversations = conversations.filter(conv => {
    const other = getOtherParticipant(conv);
    // Tab filters: 0=All, 1=Unread, 2=Recruiters, 3=Network
    if (tabValue === 1 && !conv.unreadCount) return false;
    if (tabValue === 2 && other?.role !== 'recruiter') return false;
    if (tabValue === 3 && other?.role === 'recruiter') return false;
    if (!searchQuery) return true;
    const name = ((other?.firstName || '') + ' ' + (other?.lastName || '')).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const unreadCount = conversations.filter(c => c.unreadCount).length;

  const navigateToProfile = (participant) => {
    if (!participant) return;
    if (participant.role === 'recruiter') {
      navigate(`/recruiter/${participant.id}`);
    } else {
      navigate(`/profile/${participant.id}`);
    }
  };

  if (loading) {
    return (
      <S.LoadingContainer>
        <S.Spinner />
      </S.LoadingContainer>
    );
  }

  const selectedParticipant = getOtherParticipant(selectedConversation);
  const canRequestReschedule = user?.role === 'candidate' && selectedParticipant?.role === 'recruiter';
  const tabs = [
    { label: 'All' },
    { label: 'Unread', badge: unreadCount || null },
    { label: 'Recruiters' },
    { label: 'Network' },
  ];

  return (
    <S.PageContainer>
      {/* ─── Left Sidebar ─── */}
      <S.Sidebar $hidden={!!selectedConversation}>
        <S.SidebarHeader>
          <S.SidebarTitle>Messages</S.SidebarTitle>
          <S.SearchBox>
            <S.SearchIcon><MuiSearchIcon fontSize="inherit" /></S.SearchIcon>
            <S.SearchInput
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </S.SearchBox>
        </S.SidebarHeader>

        <S.TabBar>
          {tabs.map((tab, i) => (
            <S.TabItem key={tab.label} $active={tabValue === i} onClick={() => setTabValue(i)}>
              {tab.label}
              {tab.badge ? <S.TabBadge>{tab.badge}</S.TabBadge> : null}
            </S.TabItem>
          ))}
        </S.TabBar>

        {error && <S.ErrorAlert>{error}</S.ErrorAlert>}

        <S.ConversationList>
          {filteredConversations.length === 0 ? (
            <S.EmptyState>
              <S.EmptyIcon><ForumIcon fontSize="inherit" /></S.EmptyIcon>
              <S.EmptyTitle>No conversations yet</S.EmptyTitle>
              <S.EmptySubtitle>Start a conversation from a profile page</S.EmptySubtitle>
            </S.EmptyState>
          ) : (
            filteredConversations.map((conv) => {
              const other = getOtherParticipant(conv);
              const isSelected = selectedConversation?.id === conv.id;
              const fullName = `${other?.firstName || ''} ${other?.lastName || ''}`.trim();
              const pic = getProfilePicture(other);
              const avatarColor = getAvatarColor(fullName);

              return (
                <S.ConversationItem
                  key={conv.id}
                  $active={isSelected}
                  $unread={!!conv.unreadCount}
                  onClick={() => handleSelectConversation(conv)}
                >
                  <S.ConvAvatar $color={avatarColor}>
                    {pic ? <img src={pic} alt="" /> : `${other?.firstName?.[0] || ''}${other?.lastName?.[0] || ''}`}
                  </S.ConvAvatar>
                  <S.ConvInfo>
                    <S.ConvTopRow>
                      <S.ConvName $unread={!!conv.unreadCount}>{fullName}</S.ConvName>
                      <S.ConvTime $unread={!!conv.unreadCount}>{formatTime(conv.lastMessageAt)}</S.ConvTime>
                    </S.ConvTopRow>
                    <S.ConvPreview>
                      <S.ConvPreviewText $unread={!!conv.unreadCount}>
                        {conv.lastMessagePreview || 'No messages yet'}
                      </S.ConvPreviewText>
                      {conv.unreadCount > 0 && <S.UnreadBadge>{conv.unreadCount}</S.UnreadBadge>}
                    </S.ConvPreview>
                  </S.ConvInfo>
                  <S.ConvMenuBtn onClick={(e) => handleMenuOpen(e, conv)}>
                    <MoreVertIcon fontSize="small" />
                  </S.ConvMenuBtn>
                </S.ConversationItem>
              );
            })
          )}
        </S.ConversationList>
      </S.Sidebar>

      {/* ─── Right Chat Panel ─── */}
      <S.ChatPanel>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <S.ChatHeader>
              <S.BackButton onClick={() => { setSelectedConversation(null); navigate('/messages'); }}>
                <ArrowBackIcon fontSize="inherit" />
              </S.BackButton>

              <S.ConvAvatar
                $color={getAvatarColor(`${selectedParticipant?.firstName} ${selectedParticipant?.lastName}`)}
                style={{ width: 42, height: 42, minWidth: 42, cursor: 'pointer', fontSize: 14 }}
                onClick={() => navigateToProfile(selectedParticipant)}
              >
                {getProfilePicture(selectedParticipant)
                  ? <img src={getProfilePicture(selectedParticipant)} alt="" />
                  : `${selectedParticipant?.firstName?.[0] || ''}${selectedParticipant?.lastName?.[0] || ''}`}
              </S.ConvAvatar>

              <S.ChatHeaderInfo onClick={() => navigateToProfile(selectedParticipant)}>
                <S.ChatHeaderName>
                  {selectedParticipant?.firstName} {selectedParticipant?.lastName}
                </S.ChatHeaderName>
                <S.ChatHeaderStatus>
                  <S.StatusDot />
                  Online · {getHeadline(selectedParticipant)}
                </S.ChatHeaderStatus>
              </S.ChatHeaderInfo>

              <S.ChatHeaderActions>
                {canRequestReschedule && (
                  <S.HeaderActionBtn onClick={handleActionMenuOpen} title="Request Reschedule">
                    <ScheduleIcon fontSize="inherit" />
                  </S.HeaderActionBtn>
                )}
                <S.HeaderActionBtn
                  className={showProfilePanel ? 'active' : ''}
                  onClick={() => setShowProfilePanel(!showProfilePanel)}
                  title="Info"
                >
                  <InfoIcon fontSize="inherit" />
                </S.HeaderActionBtn>
              </S.ChatHeaderActions>
            </S.ChatHeader>

            {/* Pending Interview Banner */}
            {pendingInterview && (
              <S.InterviewBanner>
                <S.BannerInfo>
                  <EventAvailableIcon />
                  <div>
                    <strong style={{ fontSize: 14 }}>Interview Scheduled</strong>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {new Date(pendingInterview.scheduledAt || pendingInterview.dateTime).toLocaleString([], {
                        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                </S.BannerInfo>
                <S.BannerBtn onClick={handleOpenRescheduleDialog}>
                  <ScheduleIcon fontSize="small" /> Request Reschedule
                </S.BannerBtn>
              </S.InterviewBanner>
            )}

            {/* Messages Area */}
            <S.MessagesArea ref={messagesContainerRef} onScroll={handleScroll}>
              {messages.length === 0 ? (
                <S.EmptyState>
                  <S.ConvAvatar
                    $color={getAvatarColor(`${selectedParticipant?.firstName} ${selectedParticipant?.lastName}`)}
                    style={{ width: 72, height: 72, fontSize: 24, marginBottom: 16 }}
                  >
                    {getProfilePicture(selectedParticipant)
                      ? <img src={getProfilePicture(selectedParticipant)} alt="" />
                      : `${selectedParticipant?.firstName?.[0] || ''}${selectedParticipant?.lastName?.[0] || ''}`}
                  </S.ConvAvatar>
                  <S.EmptyTitle>{selectedParticipant?.firstName} {selectedParticipant?.lastName}</S.EmptyTitle>
                  <S.EmptySubtitle>{getHeadline(selectedParticipant)}</S.EmptySubtitle>
                  <S.EmptySubtitle style={{ marginTop: 8 }}>Start the conversation by sending a message</S.EmptySubtitle>
                </S.EmptyState>
              ) : (
                messages.map((message, index) => {
                  const isMine = message.senderId === user?.id;
                  const showDivider = shouldShowDateDivider(message, index, messages);
                  const isReschedule = isRescheduleMessage(message.content);
                  const isInterviewRequest = isInterviewRequestMessage(message);
                  const isRescheduleRequest = isRescheduleRequestMessage(message);

                  return (
                    <React.Fragment key={message.id}>
                      {showDivider && (
                        <S.DateDivider>
                          <S.DateLabel>{getDateDivider(message.createdAt)}</S.DateLabel>
                        </S.DateDivider>
                      )}

                      <S.MessageRow $mine={isMine}>
                        {!isMine && (
                          <S.MessageAvatar>
                            {getProfilePicture(selectedParticipant)
                              ? <img src={getProfilePicture(selectedParticipant)} alt="" />
                              : selectedParticipant?.firstName?.[0] || '?'}
                          </S.MessageAvatar>
                        )}

                        <S.BubbleWrapper>
                          <S.Bubble $mine={isMine} $reschedule={isReschedule || isRescheduleRequest}>
                            {/* Interview request with action button */}
                            {isInterviewRequest && !isMine && user?.role === 'candidate' ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
                                  <EventAvailableIcon style={{ fontSize: 18, marginTop: 2, color: '#667eea' }} />
                                  <span>{message.content}</span>
                                </div>
                                <S.InterviewActionBtn onClick={() => navigate('/interviews')}>
                                  <CalendarIcon style={{ fontSize: 16 }} /> Select Time or Reschedule
                                </S.InterviewActionBtn>
                              </>
                            ) : (isReschedule || isRescheduleRequest) ? (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                <ScheduleIcon style={{ fontSize: 16, marginTop: 2, color: '#f59e0b' }} />
                                <span>{message.content}</span>
                              </div>
                            ) : (
                              message.content
                            )}
                          </S.Bubble>
                          <S.MessageMeta $mine={isMine}>
                            <S.MessageTime>{formatMessageTime(message.createdAt)}</S.MessageTime>
                            {isMine && (
                              <S.DeliveryIcon $read={message.isRead} title={message.isRead ? 'Read' : 'Delivered'}>
                                {message.isRead ? <DoneAllIcon fontSize="inherit" /> : <DoneIcon fontSize="inherit" />}
                              </S.DeliveryIcon>
                            )}
                          </S.MessageMeta>
                        </S.BubbleWrapper>

                        {isMine && (
                          <S.MessageAvatar style={{ background: '#764ba2' }}>
                            {user?.firstName?.[0] || 'Y'}
                          </S.MessageAvatar>
                        )}
                      </S.MessageRow>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </S.MessagesArea>

            {/* Input Area */}
            <S.InputArea>
              <S.InputWrapper>
                <S.InputIconBtn title="Attach file"><AttachFileIcon fontSize="inherit" /></S.InputIconBtn>
                <S.MessageInput
                  ref={inputRef}
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={sendingMessage}
                />
                <S.InputIconBtn title="Emoji"><EmojiIcon fontSize="inherit" /></S.InputIconBtn>
                <S.InputIconBtn title="Star"><StarIcon fontSize="inherit" /></S.InputIconBtn>
                <S.SendButton
                  $disabled={!newMessage.trim() || sendingMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                  onClick={handleSendMessage}
                >
                  {sendingMessage ? <CircularProgress size={16} color="inherit" /> : <>Send <SendIcon style={{ fontSize: 16 }} /></>}
                </S.SendButton>
              </S.InputWrapper>
            </S.InputArea>
          </>
        ) : (
          /* No conversation selected */
          <S.EmptyState style={{ display: isMobile ? 'none' : undefined }}>
            <S.EmptyIcon><ForumIcon fontSize="inherit" /></S.EmptyIcon>
            <S.EmptyTitle>Select a conversation</S.EmptyTitle>
            <S.EmptySubtitle>Choose from your existing conversations or start a new one from a profile page</S.EmptySubtitle>
          </S.EmptyState>
        )}
      </S.ChatPanel>

      {/* ─── Profile Panel (desktop) ─── */}
      {!isMobile && !isTablet && selectedConversation && showProfilePanel && selectedParticipant && (
        <S.ProfileSidebar>
          <S.ProfileHeader>
            <S.ProfileAvatar onClick={() => navigateToProfile(selectedParticipant)}>
              {getProfilePicture(selectedParticipant)
                ? <img src={getProfilePicture(selectedParticipant)} alt="" />
                : `${selectedParticipant.firstName?.[0] || ''}${selectedParticipant.lastName?.[0] || ''}`}
            </S.ProfileAvatar>
            <S.ProfileName onClick={() => navigateToProfile(selectedParticipant)}>
              {selectedParticipant.firstName} {selectedParticipant.lastName}
            </S.ProfileName>
            <S.ProfileHeadline>{getHeadline(selectedParticipant)}</S.ProfileHeadline>
          </S.ProfileHeader>
          <S.ProfileSection>
            <S.ProfileSectionTitle>About</S.ProfileSectionTitle>
            {selectedParticipant.email && (
              <S.ProfileInfoRow><EmailIcon /> {selectedParticipant.email}</S.ProfileInfoRow>
            )}
            <S.ProfileInfoRow>
              <TimeIcon /> Local time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </S.ProfileInfoRow>
          </S.ProfileSection>
          <S.ProfileSection style={{ marginTop: 'auto' }}>
            <S.ProfileSectionTitle>Settings</S.ProfileSectionTitle>
            <S.ProfileDangerBtn onClick={() => { setConversationToDelete(selectedConversation); setDeleteDialogOpen(true); }}>
              <DeleteIcon fontSize="small" /> Delete conversation
            </S.ProfileDangerBtn>
          </S.ProfileSection>
        </S.ProfileSidebar>
      )}

      {/* Profile Panel Drawer (mobile) */}
      <Drawer
        anchor="right"
        open={isMobile && showProfilePanel && !!selectedConversation}
        onClose={() => setShowProfilePanel(false)}
      >
        {selectedParticipant && (
          <S.ProfileSidebar style={{ width: 300, minWidth: 300 }}>
            <S.ProfileHeader>
              <S.ProfileAvatar onClick={() => navigateToProfile(selectedParticipant)}>
                {getProfilePicture(selectedParticipant)
                  ? <img src={getProfilePicture(selectedParticipant)} alt="" />
                  : `${selectedParticipant.firstName?.[0] || ''}${selectedParticipant.lastName?.[0] || ''}`}
              </S.ProfileAvatar>
              <S.ProfileName onClick={() => navigateToProfile(selectedParticipant)}>
                {selectedParticipant.firstName} {selectedParticipant.lastName}
              </S.ProfileName>
              <S.ProfileHeadline>{getHeadline(selectedParticipant)}</S.ProfileHeadline>
            </S.ProfileHeader>
            <S.ProfileSection>
              <S.ProfileSectionTitle>About</S.ProfileSectionTitle>
              {selectedParticipant.email && (
                <S.ProfileInfoRow><EmailIcon /> {selectedParticipant.email}</S.ProfileInfoRow>
              )}
              <S.ProfileInfoRow>
                <TimeIcon /> Local time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </S.ProfileInfoRow>
            </S.ProfileSection>
            <S.ProfileSection style={{ marginTop: 'auto' }}>
              <S.ProfileSectionTitle>Settings</S.ProfileSectionTitle>
              <S.ProfileDangerBtn onClick={() => { setConversationToDelete(selectedConversation); setDeleteDialogOpen(true); }}>
                <DeleteIcon fontSize="small" /> Delete conversation
              </S.ProfileDangerBtn>
            </S.ProfileSection>
          </S.ProfileSidebar>
        )}
      </Drawer>

      {/* ─── Context Menu ─── */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' } }}
      >
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main', gap: 1.5 }}>
          <DeleteIcon fontSize="small" /> Delete Conversation
        </MenuItem>
      </Menu>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>Delete Conversation?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Are you sure you want to delete this conversation? This action cannot be undone and all messages will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ textTransform: 'none', borderRadius: 2 }}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" sx={{ textTransform: 'none', borderRadius: 2 }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Action Menu for Reschedule */}
      <Menu
        anchorEl={actionMenuAnchorEl}
        open={Boolean(actionMenuAnchorEl)}
        onClose={handleActionMenuClose}
        PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: 280 } }}
      >
        <MenuItem onClick={handleOpenRescheduleDialog} sx={{ gap: 1.5 }}>
          <ScheduleIcon fontSize="small" color="primary" />
          <Box>
            <Typography variant="body2" fontWeight={500}>Direct Reschedule</Typography>
            <Typography variant="caption" color="text.secondary">Send reschedule request yourself</Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleStartAiReschedule} sx={{ gap: 1.5 }} disabled={aiRescheduleLoading}>
          <AgentIcon fontSize="small" sx={{ color: '#667eea' }} />
          <Box>
            <Typography variant="body2" fontWeight={500}>{aiRescheduleLoading ? 'Starting...' : 'AI Agent Reschedule'}</Typography>
            <Typography variant="caption" color="text.secondary">Let AI negotiate on your behalf</Typography>
          </Box>
        </MenuItem>
      </Menu>

      {/* AI Reschedule Chat Panel */}
      {showRescheduleChat && rescheduleNegotiation && (
        <Dialog open={showRescheduleChat} onClose={() => setShowRescheduleChat(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, minHeight: 500 } }}>
          <DialogTitle sx={{ fontWeight: 600, pb: 1, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <AgentIcon /> AI Reschedule Negotiation
              <Chip size="small" label={rescheduleNegotiation.status} sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,0.2)', color: 'white', textTransform: 'capitalize' }} />
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <Box sx={{ maxHeight: 350, overflowY: 'auto', p: 2, bgcolor: '#f8f9fa' }}>
              {rescheduleNegotiation.messages?.map((msg, idx) => (
                <Box key={idx} sx={{ display: 'flex', justifyContent: msg.agentRole === 'candidate_agent' ? 'flex-end' : 'flex-start', mb: 2 }}>
                  <Paper elevation={0} sx={{
                    maxWidth: '75%', px: 2, py: 1.5, borderRadius: 2,
                    background: msg.agentRole === 'candidate_agent' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                    color: msg.agentRole === 'candidate_agent' ? 'white' : 'text.primary',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <AgentIcon sx={{ fontSize: 16 }} />
                      <Typography variant="caption" fontWeight={600}>
                        {msg.agentRole === 'candidate_agent' ? 'Your Agent' : "Recruiter's Agent"}
                      </Typography>
                    </Box>
                    <Typography variant="body2">{msg.content}</Typography>
                  </Paper>
                </Box>
              ))}
              {aiRescheduleLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} sx={{ color: '#667eea' }} />
                </Box>
              )}
            </Box>
            {rescheduleNegotiation.outcome && (
              <Alert severity={rescheduleNegotiation.status === 'mutual_match' ? 'success' : 'info'} sx={{ mx: 2, mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>{rescheduleNegotiation.outcome.summary}</Typography>
                {rescheduleNegotiation.outcome.newDate && (
                  <Typography variant="body2">New interview time: {new Date(rescheduleNegotiation.outcome.newDate).toLocaleString()}</Typography>
                )}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button onClick={() => setShowRescheduleChat(false)}>Close</Button>
            {rescheduleNegotiation.status === 'negotiating' && (
              <Button variant="contained" onClick={handleContinueAiReschedule} disabled={aiRescheduleLoading}
                sx={{ bgcolor: '#667eea', '&:hover': { bgcolor: '#5a6fd6' } }}
                startIcon={aiRescheduleLoading ? <CircularProgress size={16} color="inherit" /> : <AgentIcon />}
              >
                {aiRescheduleLoading ? 'Processing...' : 'Continue Negotiation'}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      )}

      {/* Reschedule Dialog */}
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Dialog open={rescheduleDialogOpen} onClose={handleCloseRescheduleDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon sx={{ color: '#667eea' }} /> Request Interview Reschedule
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Please select your preferred new date and time for the interview. The recruiter will be notified of your request.
            </Typography>
            {pendingInterview && (
              <Alert severity="info" sx={{ mb: 3 }}>
                Current interview scheduled for:{' '}
                <strong>
                  {new Date(pendingInterview.scheduledAt || pendingInterview.dateTime).toLocaleString([], {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </strong>
              </Alert>
            )}
            <DateTimePicker
              label="Proposed New Date & Time"
              value={rescheduleDate}
              onChange={(newValue) => setRescheduleDate(newValue)}
              minDateTime={new Date()}
              slotProps={{ textField: { fullWidth: true, sx: { mb: 3 } } }}
            />
            <TextField
              fullWidth label="Reason for Reschedule (Optional)" multiline rows={3}
              value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="Please let the recruiter know why you need to reschedule..."
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 1 }}>
            <Button onClick={handleCloseRescheduleDialog} sx={{ textTransform: 'none', borderRadius: 2 }} disabled={submittingReschedule}>Cancel</Button>
            <Button onClick={handleSubmitReschedule} variant="contained" disabled={!rescheduleDate || submittingReschedule}
              sx={{ textTransform: 'none', borderRadius: 2, bgcolor: '#667eea', '&:hover': { bgcolor: '#5a6fd6' } }}
            >
              {submittingReschedule ? <CircularProgress size={20} color="inherit" /> : 'Send Request'}
            </Button>
          </DialogActions>
        </Dialog>
      </LocalizationProvider>
    </S.PageContainer>
  );
};

export default MessagesPage;
