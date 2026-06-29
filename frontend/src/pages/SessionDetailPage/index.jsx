import {
  Avatar,
  AvatarGroup,
  Chip,
  Button,
  CircularProgress,
  Box,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  PageContainer,
  Header,
  BackButton,
  SessionCard,
  HostBanner,
  ParticipantBanner,
  TypeBadge,
  StatusBadge,
  Title,
  BadgeRow,
  HostSection,
  HostInfo,
  HostName,
  HostTitle,
  MetaGrid,
  MetaItem,
  MetaLabel,
  MetaValue,
  DescriptionSection,
  SectionTitle,
  Description,
  TagsSection,
  ParticipantsSection,
  ParticipantList,
  ParticipantCard,
  ParticipantName,
  ParticipantRole,
  ActionButtons,
  LoadingContainer
} from './styled';
import { ROUTES, EXTERNAL_LINKS, LIMITS, TEXT as CONST_TEXT } from './constants';

const formatDateTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const getTypeIcon = (type) => {
  switch (type) {
    case 'teaching': return <TeachingIcon />;
    case 'showcase': return <ShowcaseIcon />;
    case 'mentorship': return <MentorshipIcon />;
    default: return <FireIcon />;
  }
};

const SessionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Start session dialog
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [meetingLinkInput, setMeetingLinkInput] = useState('');
  
  // Edit session dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    sessionType: 'teaching',
    maxParticipants: 20,
    scheduledTime: ''
  });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        setLoading(true);
        const { data } = await sessionAPI.getById(id);
        setSession(data.session);
        setIsHost(data.isHost);
        setIsParticipant(data.isParticipant);
        // Pre-fill meeting link if exists
        setMeetingLinkInput(data.session.meetingLink || '');
      } catch (err) {
        console.error('Failed to fetch session:', err);
        setError(err.response?.data?.message || 'Failed to load session');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchSession();
    }
  }, [id]);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/sessions/${id}` } });
      return;
    }
    
    try {
      setActionLoading(true);
      await sessionAPI.join(id);
      // Refresh session data
      const { data } = await sessionAPI.getById(id);
      setSession(data.session);
      setIsParticipant(true);
    } catch (err) {
      console.error('Failed to join session:', err);
      setError(err.response?.data?.message || 'Failed to join session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    try {
      setActionLoading(true);
      await sessionAPI.leave(id);
      // Refresh session data
      const { data } = await sessionAPI.getById(id);
      setSession(data.session);
      setIsParticipant(false);
    } catch (err) {
      console.error('Failed to leave session:', err);
      setError(err.response?.data?.message || 'Failed to leave session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenStartDialog = () => {
    setShowStartDialog(true);
  };

  const handleStart = async () => {
    try {
      setActionLoading(true);
      // Pass the meeting link when starting
      await sessionAPI.start(id, meetingLinkInput || undefined);
      setShowStartDialog(false);
      // Refresh session data
      const { data } = await sessionAPI.getById(id);
      setSession(data.session);
      // If there's a meeting link, open it in new tab
      if (meetingLinkInput && /^https?:\/\//i.test(meetingLinkInput)) {
        window.open(meetingLinkInput, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Failed to start session:', err);
      setError(err.response?.data?.message || 'Failed to start session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnd = async () => {
    try {
      setActionLoading(true);
      await sessionAPI.end(id);
      // Refresh session data
      const { data } = await sessionAPI.getById(id);
      setSession(data.session);
    } catch (err) {
      console.error('Failed to end session:', err);
      setError(err.response?.data?.message || 'Failed to end session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    // Could add a toast notification here
  };

  // Open edit dialog with current session values
  const handleOpenEditDialog = () => {
    if (session) {
      setEditForm({
        title: session.title || '',
        description: session.description || '',
        sessionType: session.sessionType || 'teaching',
        maxParticipants: session.maxParticipants || 20,
        scheduledTime: session.scheduledTime 
          ? new Date(session.scheduledTime).toISOString().slice(0, 16) 
          : ''
      });
      setShowEditDialog(true);
    }
  };

  // Handle edit form submission
  const handleEditSubmit = async () => {
    try {
      setEditLoading(true);
      await sessionAPI.update(id, {
        title: editForm.title,
        description: editForm.description,
        sessionType: editForm.sessionType,
        maxParticipants: parseInt(editForm.maxParticipants),
        scheduledTime: editForm.scheduledTime ? new Date(editForm.scheduledTime).toISOString() : null
      });
      // Refresh session data
      const { data } = await sessionAPI.getById(id);
      setSession(data.session);
      setShowEditDialog(false);
    } catch (err) {
      console.error('Failed to update session:', err);
      setError(err.response?.data?.error || 'Failed to update session');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <LoadingContainer>
          <CircularProgress />
        </LoadingContainer>
      </PageContainer>
    );
  }

  if (error && !session) {
    return (
      <PageContainer>
        <Header>
          <BackButton onClick={() => navigate('/profile')}>
            <BackIcon />
          </BackButton>
        </Header>
        <Alert severity="error">{error}</Alert>
      </PageContainer>
    );
  }

  if (!session) {
    return (
      <PageContainer>
        <Header>
          <BackButton onClick={() => navigate('/feed')}>
            <BackIcon />
          </BackButton>
        </Header>
        <Alert severity="warning">Session not found</Alert>
      </PageContainer>
    );
  }

  const host = session.host;
  const hostProfile = host?.profile;
  const participants = session.participants || [];
  const participantCount = participants.length;
  const spotsLeft = (session.maxParticipants || 20) - participantCount;
  const isFull = spotsLeft <= 0;

  return (
    <PageContainer>
      <Header>
        <BackButton onClick={() => navigate('/feed')}>
          <BackIcon />
        </BackButton>
        <span style={{ fontSize: '14px', color: '#6B7280' }}>Back to Feed</span>
      </Header>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <SessionCard>
        {/* Host Banner - shown only when user is the host */}
        {isHost && (
          <HostBanner>
            <div className="host-text">
              <div className="icon">
                <StarIcon />
              </div>
              <div>
                <div className="label">You're the Host</div>
                <div className="title">Manage Your Session</div>
              </div>
            </div>
            <div className="host-stats">
              <div className="stat">
                <div className="value">{participantCount}</div>
                <div className="label">Joined</div>
              </div>
              <div className="stat">
                <div className="value">{spotsLeft}</div>
                <div className="label">Spots Left</div>
              </div>
            </div>
          </HostBanner>
        )}

        {/* Participant Banner - shown only when user is a participant (not host) */}
        {!isHost && isParticipant && (
          <ParticipantBanner>
            <div className="icon">
              <CheckIcon />
            </div>
            <div className="text">✓ You're registered for this session</div>
          </ParticipantBanner>
        )}

        {/* Badges row */}
        <BadgeRow>
          <TypeBadge $type={session.sessionType}>
            {getTypeIcon(session.sessionType)}
            {session.sessionType}
          </TypeBadge>
          <StatusBadge $status={session.status}>
            {session.status === 'live' && <FireIcon sx={{ fontSize: 16 }} />}
            {session.status}
          </StatusBadge>
          {session.category && (
            <Chip label={session.category} size="small" variant="outlined" />
          )}
        </BadgeRow>

        {/* Title */}
        <Title>{session.title}</Title>

        {/* Host section */}
        <HostSection>
          <Link to={`/profile/${host?.id}`} style={{ textDecoration: 'none' }}>
            <Avatar
              src={resolveImageUrl(hostProfile?.profilePicture)}
              sx={{ width: 56, height: 56, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
            >
              {host?.firstName?.[0]}
            </Avatar>
          </Link>
          <HostInfo>
            <HostName>
              <Link 
                to={`/profile/${host?.id}`}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {host?.firstName} {host?.lastName}
              </Link>
            </HostName>
            <HostTitle>{hostProfile?.headline || hostProfile?.title || 'Session Host'}</HostTitle>
          </HostInfo>
        </HostSection>

        {/* Meta grid */}
        <MetaGrid>
          <MetaItem>
            <CalendarIcon />
            <div>
              <MetaLabel>Scheduled for</MetaLabel>
              <MetaValue>{formatDateTime(session.scheduledTime)}</MetaValue>
            </div>
          </MetaItem>
          <MetaItem>
            <TimeIcon />
            <div>
              <MetaLabel>Duration</MetaLabel>
              <MetaValue>{session.durationMinutes || 60} minutes</MetaValue>
            </div>
          </MetaItem>
          <MetaItem>
            <PeopleIcon />
            <div>
              <MetaLabel>Participants</MetaLabel>
              <MetaValue>
                {participantCount} / {session.maxParticipants || 20}
                {spotsLeft > 0 && spotsLeft <= 5 && (
                  <span style={{ color: '#D97706', marginLeft: 8 }}>
                    Only {spotsLeft} spots left!
                  </span>
                )}
              </MetaValue>
            </div>
          </MetaItem>
          <MetaItem>
            <ViewIcon />
            <div>
              <MetaLabel>Views</MetaLabel>
              <MetaValue>{session.viewCount || 0}</MetaValue>
            </div>
          </MetaItem>
        </MetaGrid>

        {/* Description */}
        {session.description && (
          <DescriptionSection>
            <SectionTitle>About this Session</SectionTitle>
            <Description>{session.description}</Description>
          </DescriptionSection>
        )}

        {/* Tags */}
        {session.tags && session.tags.length > 0 && (
          <TagsSection>
            <SectionTitle style={{ width: '100%' }}>Topics & Skills</SectionTitle>
            {session.tags.map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                sx={{ background: '#F3F4F6' }}
              />
            ))}
          </TagsSection>
        )}

        {/* Help topics */}
        {session.helpTopics && session.helpTopics.length > 0 && (
          <TagsSection>
            <SectionTitle style={{ width: '100%' }}>What You'll Learn</SectionTitle>
            {session.helpTopics.map((topic, index) => (
              <Chip
                key={index}
                label={topic}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </TagsSection>
        )}

        {/* Participants */}
        {participants.length > 0 && (
          <ParticipantsSection>
            <SectionTitle>Registered Participants ({participants.length})</SectionTitle>
            <ParticipantList>
              {participants.map((participant) => (
                <Link 
                  key={participant.id} 
                  to={`/profile/${participant.user?.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <ParticipantCard sx={{ cursor: 'pointer', '&:hover': { background: '#F3F4F6' } }}>
                    <Avatar
                      src={resolveImageUrl(participant.user?.profile?.profilePicture)}
                      sx={{ width: 32, height: 32 }}
                    >
                      {participant.user?.firstName?.[0]}
                    </Avatar>
                    <div>
                      <ParticipantName>
                        {participant.user?.firstName} {participant.user?.lastName}
                      </ParticipantName>
                      {participant.role !== 'participant' && (
                        <ParticipantRole>{participant.role}</ParticipantRole>
                      )}
                    </div>
                  </ParticipantCard>
                </Link>
              ))}
            </ParticipantList>
          </ParticipantsSection>
        )}

        {/* Action buttons */}
        <ActionButtons>
          {/* Share button - always visible */}
          <Tooltip title="Copy link to clipboard">
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={handleShare}
            >
              Share
            </Button>
          </Tooltip>

          {/* Host actions */}
          {isHost && session.status === 'scheduled' && (
            <>
              <Button
                variant="contained"
                color="success"
                startIcon={<StartIcon />}
                onClick={handleOpenStartDialog}
                disabled={actionLoading}
              >
                Start Session
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleOpenEditDialog}
              >
                Edit
              </Button>
            </>
          )}

          {isHost && session.status === 'live' && (
            <>
              <Button
                variant="contained"
                color="primary"
                startIcon={<VideoIcon />}
                href={session.meetingLink}
                target="_blank"
                disabled={!session.meetingLink}
              >
                Open Meeting
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<EndIcon />}
                onClick={handleEnd}
                disabled={actionLoading}
              >
                End Session
              </Button>
            </>
          )}

          {/* Participant actions */}
          {!isHost && session.status === 'scheduled' && (
            <>
              {isParticipant ? (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleLeave}
                  disabled={actionLoading}
                >
                  Leave Session
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<JoinIcon />}
                  onClick={handleJoin}
                  disabled={actionLoading || isFull}
                >
                  {isFull ? 'Session Full' : 'Join Session'}
                </Button>
              )}
            </>
          )}

          {/* Live session - join link for participants */}
          {!isHost && session.status === 'live' && session.meetingLink && (
            <Button
              variant="contained"
              color="success"
              startIcon={<VideoIcon />}
              href={session.meetingLink}
              target="_blank"
            >
              Join Live Session
            </Button>
          )}
          
          {/* Live session without link */}
          {!isHost && session.status === 'live' && !session.meetingLink && (
            <Button
              variant="contained"
              color="success"
              disabled
            >
              Waiting for Host Link...
            </Button>
          )}
        </ActionButtons>
      </SessionCard>

      {/* Start Session Dialog */}
      <Dialog 
        open={showStartDialog} 
        onClose={() => setShowStartDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          🚀 Start Your Session
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {/* Quick Create Buttons */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 1.5 }}>
                Quick Create Meeting
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => window.open('https://meet.google.com/new', '_blank')}
                  sx={{ 
                    py: 1.5,
                    borderColor: '#E5E7EB',
                    color: '#374151',
                    textTransform: 'none',
                    fontSize: '14px',
                    fontWeight: 500,
                    '&:hover': { borderColor: '#4285F4', background: '#F8FAFF' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <img src="https://www.gstatic.com/meet/google_meet_horizontal_wordmark_2020q4_1x_icon_124_40_2373e79660dabbf194273d27aa7ee1f5.png" alt="Google Meet" style={{ height: 20 }} 
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                    />
                    <span style={{ display: 'none' }}>🎥 Google Meet</span>
                  </Box>
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => window.open('https://zoom.us/start/videomeeting', '_blank')}
                  sx={{ 
                    py: 1.5,
                    borderColor: '#E5E7EB',
                    color: '#374151',
                    textTransform: 'none',
                    fontSize: '14px',
                    fontWeight: 500,
                    '&:hover': { borderColor: '#2D8CFF', background: '#F8FAFF' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <img src="https://st1.zoom.us/zoom.ico" alt="Zoom" style={{ height: 20 }} 
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                    />
                    <span style={{ display: 'none' }}>📹 Zoom</span>
                    <span>Zoom</span>
                  </Box>
                </Button>
              </Box>
              <Box sx={{ fontSize: '12px', color: '#9CA3AF', mt: 1 }}>
                Click to create a meeting, then copy and paste the link below
              </Box>
            </Box>

            <Divider sx={{ my: 2 }}>
              <Chip label="or paste your link" size="small" />
            </Divider>

            <TextField
              fullWidth
              label="Meeting Link"
              value={meetingLinkInput}
              onChange={(e) => setMeetingLinkInput(e.target.value)}
              placeholder="https://zoom.us/j/123456789 or https://meet.google.com/abc-xyz"
              helperText="Paste your Zoom, Google Meet, or Teams link here"
              sx={{ mb: 2 }}
            />
            
            <Alert severity="info" icon={false} sx={{ fontSize: '13px' }}>
              <strong>Tip:</strong> Once you click "Go Live", participants will see the link and can join your session.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowStartDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="success"
            onClick={handleStart}
            disabled={actionLoading || !meetingLinkInput.trim()}
            startIcon={<StartIcon />}
          >
            {actionLoading ? 'Starting...' : 'Go Live!'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog 
        open={showEditDialog} 
        onClose={() => setShowEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Session</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Title"
              value={editForm.title}
              onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Session title"
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={editForm.description}
              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What will participants learn or do?"
              multiline
              rows={4}
            />
            <TextField
              fullWidth
              select
              label="Session Type"
              value={editForm.sessionType}
              onChange={(e) => setEditForm(prev => ({ ...prev, sessionType: e.target.value }))}
              SelectProps={{ native: true }}
            >
              <option value="teaching">🎓 Teaching</option>
              <option value="showcase">🚀 Showcase</option>
              <option value="mentorship">🧠 Mentorship</option>
            </TextField>
            <TextField
              fullWidth
              label="Max Participants"
              type="number"
              value={editForm.maxParticipants}
              onChange={(e) => setEditForm(prev => ({ ...prev, maxParticipants: e.target.value }))}
              inputProps={{ min: 1, max: 100 }}
            />
            <TextField
              fullWidth
              label="Scheduled Date & Time"
              type="datetime-local"
              value={editForm.scheduledTime}
              onChange={(e) => setEditForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowEditDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleEditSubmit}
            disabled={editLoading || !editForm.title.trim()}
          >
            {editLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default SessionDetailPage;
