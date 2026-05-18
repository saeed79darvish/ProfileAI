import {
  Container, Box, Paper, Typography, Button, IconButton,
  Tabs, Tab, Avatar, AvatarGroup, Chip, LinearProgress,
  useTheme, useMediaQuery, alpha, Skeleton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Snackbar,
  List, ListItem, ListItemAvatar, ListItemText, Divider, Tooltip
} from '@mui/material';
import {
  PageContainer,
  HeroSection,
  ContentSection,
  StatCard,
  LeaderboardItem,
  MilestoneCard
} from './styled';
import { ROUTES, MOOD_EMOJIS, GRADIENTS, TEXT, LIMITS } from './constants';

export default function ChallengeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [checkInData, setCheckInData] = useState({ mood: 'good', content: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadChallenge();
  }, [id]);

  const loadChallenge = async () => {
    try {
      setLoading(true);
      const response = await challengesAPI.getById(id);
      setChallenge(response.data);
    } catch (error) {
      console.error('Error loading challenge:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    try {
      setSubmitting(true);
      await challengesAPI.join(id);
      setSnackbar({ open: true, message: 'Successfully joined the challenge! 🎉' });
      loadChallenge();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Failed to join' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async () => {
    try {
      setSubmitting(true);
      await challengesAPI.leave(id);
      setSnackbar({ open: true, message: 'Left the challenge' });
      loadChallenge();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Failed to leave' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setSubmitting(true);
      await challengesAPI.checkIn(id, checkInData);
      setCheckInOpen(false);
      setCheckInData({ mood: 'good', content: '' });
      setSnackbar({ open: true, message: 'Check-in recorded! Keep it up! 🔥' });
      loadChallenge();
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Failed to check in' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNudge = async (participantUserId) => {
    try {
      await challengesAPI.nudge(id, participantUserId);
      setSnackbar({ open: true, message: 'Nudge sent! 👋' });
    } catch (error) {
      setSnackbar({ open: true, message: error.response?.data?.message || 'Failed to nudge' });
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/challenges/join/${challenge.inviteCode}`;
    navigator.clipboard.writeText(link);
    setSnackbar({ open: true, message: 'Invite link copied!' });
    setShareOpen(false);
  };

  const isParticipant = challenge?.participants?.some(p => p.userId === user?.id);
  const myParticipation = challenge?.participants?.find(p => p.userId === user?.id);
  const canCheckIn = isParticipant && myParticipation && !myParticipation.checkedInToday;
  const gradient = GRADIENTS[challenge?.type] || GRADIENTS.custom;

  if (loading) {
    return (
      <PageContainer>
        <Box sx={{ pt: 8, px: 3 }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 3 }} />
          <Skeleton variant="text" height={40} width="60%" />
          <Skeleton variant="text" height={24} width="40%" />
        </Box>
      </PageContainer>
    );
  }

  if (!challenge) {
    return (
      <PageContainer>
        <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h5">Challenge not found</Typography>
          <Button onClick={() => navigate(ROUTES.CHALLENGES)} sx={{ mt: 2 }}>
            Back to Challenges
          </Button>
        </Container>
      </PageContainer>
    );
  }

  const daysRemaining = Math.max(0, Math.ceil((new Date(challenge.endDate) - new Date()) / (1000 * 60 * 60 * 24)));
  const progressPercent = challenge.duration > 0 ? ((challenge.duration - daysRemaining) / challenge.duration) * 100 : 0;

  return (
    <PageContainer>
      <HeroSection $gradient={gradient}>
        <Container maxWidth="lg">
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate(ROUTES.CHALLENGES)}
            sx={{ color: 'white', mb: 2 }}
          >
            Back to Challenges
          </Button>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ color: 'white' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="h2" sx={{ fontSize: '3rem' }}>
                  {challenge.emoji || '🎯'}
                </Typography>
                <Box>
                  <Typography variant="h4" fontWeight={700}>{challenge.title}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Chip 
                      label={challenge.type?.replace('_', ' ')} 
                      size="small" 
                      sx={{ bgcolor: alpha('#fff', 0.2), color: 'white' }}
                    />
                    <Chip 
                      label={challenge.status} 
                      size="small" 
                      sx={{ bgcolor: alpha('#fff', 0.2), color: 'white' }}
                    />
                  </Box>
                </Box>
              </Box>
              
              {challenge.description && (
                <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: 600 }}>
                  {challenge.description}
                </Typography>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton 
                onClick={() => setShareOpen(true)}
                sx={{ bgcolor: alpha('#fff', 0.2), color: 'white' }}
              >
                <ShareIcon />
              </IconButton>
            </Box>
          </Box>
        </Container>
      </HeroSection>
      
      <ContentSection>
        <Container maxWidth="lg">
          {/* Stats Row */}
          <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 2, mb: 4 }}>
            <StatCard elevation={0}>
              <CalendarIcon sx={{ color: '#F97316', fontSize: 32 }} />
              <Typography variant="h4" fontWeight={700}>{daysRemaining}</Typography>
              <Typography variant="body2" color="text.secondary">Days Left</Typography>
            </StatCard>
            <StatCard elevation={0}>
              <PeopleIcon sx={{ color: '#8B5CF6', fontSize: 32 }} />
              <Typography variant="h4" fontWeight={700}>{challenge.participants?.length || 0}</Typography>
              <Typography variant="body2" color="text.secondary">Participants</Typography>
            </StatCard>
            <StatCard elevation={0}>
              <MilestoneIcon sx={{ color: '#10B981', fontSize: 32 }} />
              <Typography variant="h4" fontWeight={700}>{challenge.milestones?.length || 0}</Typography>
              <Typography variant="body2" color="text.secondary">Milestones</Typography>
            </StatCard>
            <StatCard elevation={0}>
              <FireIcon sx={{ color: '#EF4444', fontSize: 32 }} />
              <Typography variant="h4" fontWeight={700}>
                {myParticipation?.currentStreak || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">Your Streak</Typography>
            </StatCard>
          </Box>
          
          {/* Progress Bar */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Challenge Progress</Typography>
              <Typography variant="subtitle2" color="text.secondary">
                {Math.round(progressPercent)}% Complete
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progressPercent} 
              sx={{ height: 8, borderRadius: 4, bgcolor: alpha('#F97316', 0.1), '& .MuiLinearProgress-bar': { bgcolor: '#F97316', borderRadius: 4 } }}
            />
          </Paper>
          
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
            {!isParticipant ? (
              <Button
                variant="contained"
                size="large"
                onClick={handleJoin}
                disabled={submitting}
                sx={{ background: gradient }}
              >
                Join Challenge
              </Button>
            ) : (
              <>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setCheckInOpen(true)}
                  disabled={!canCheckIn || submitting}
                  startIcon={canCheckIn ? <AddIcon /> : <CheckIcon />}
                  sx={{ background: canCheckIn ? gradient : 'grey.400' }}
                >
                  {canCheckIn ? 'Daily Check-In' : 'Checked In Today ✓'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleLeave}
                  startIcon={<LeaveIcon />}
                  color="error"
                >
                  Leave Challenge
                </Button>
              </>
            )}
          </Box>
          
          {/* Tabs */}
          <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, v) => setActiveTab(v)}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
            >
              <Tab label="Overview" />
              <Tab label="Leaderboard" />
              <Tab label="Milestones" />
              <Tab label="Check-Ins" />
            </Tabs>
            
            <Box sx={{ p: 3 }}>
              {activeTab === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>About This Challenge</Typography>
                  <Typography variant="body1" color="text.secondary" paragraph>
                    {challenge.description || 'No description provided.'}
                  </Typography>
                  
                  {challenge.stakes && (
                    <Paper elevation={0} sx={{ p: 2, bgcolor: alpha('#F97316', 0.1), borderRadius: 2, mb: 2 }}>
                      <Typography variant="subtitle2" color="primary">🎲 Stakes</Typography>
                      <Typography variant="body2">{challenge.stakes}</Typography>
                    </Paper>
                  )}
                  
                  <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>Participants</Typography>
                  <AvatarGroup max={10}>
                    {challenge.participants?.map(p => (
                      <Tooltip key={p.id} title={p.user?.firstName || 'User'}>
                        <Avatar 
                          src={p.user?.Profile?.profilePicture ? resolveImageUrl(p.user.Profile.profilePicture) : undefined}
                        >
                          {p.user?.firstName?.[0]}
                        </Avatar>
                      </Tooltip>
                    ))}
                  </AvatarGroup>
                </Box>
              )}
              
              {activeTab === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Leaderboard</Typography>
                  {challenge.participants
                    ?.sort((a, b) => b.totalPoints - a.totalPoints)
                    .map((participant, index) => (
                      <LeaderboardItem key={participant.id} $isMe={participant.userId === user?.id}>
                        <Typography variant="h5" fontWeight={700} sx={{ width: 40, color: index < 3 ? '#F97316' : 'text.secondary' }}>
                          #{index + 1}
                        </Typography>
                        <Avatar 
                          src={participant.user?.Profile?.profilePicture ? resolveImageUrl(participant.user.Profile.profilePicture) : undefined}
                        >
                          {participant.user?.firstName?.[0]}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2">
                            {participant.user?.firstName} {participant.user?.lastName}
                            {participant.userId === user?.id && ' (You)'}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                              🔥 {participant.currentStreak} day streak
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ✓ {participant.totalCheckIns} check-ins
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="h6" fontWeight={700} color="primary">
                          {participant.totalPoints} pts
                        </Typography>
                        {isParticipant && participant.userId !== user?.id && !participant.checkedInToday && (
                          <Tooltip title="Send a friendly nudge">
                            <IconButton onClick={() => handleNudge(participant.userId)} size="small">
                              <NudgeIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </LeaderboardItem>
                    ))}
                </Box>
              )}
              
              {activeTab === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Milestones</Typography>
                  {challenge.milestones?.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {challenge.milestones.map((milestone, index) => {
                        const daysPassed = challenge.duration - daysRemaining;
                        const isCompleted = daysPassed >= milestone.day;
                        return (
                          <MilestoneCard key={index} $completed={isCompleted}>
                            <Box sx={{ minWidth: 60 }}>
                              <Chip 
                                label={`Day ${milestone.day}`} 
                                size="small" 
                                color={isCompleted ? 'success' : 'default'}
                              />
                            </Box>
                            <Box>
                              <Typography variant="subtitle2" fontWeight={600}>
                                {milestone.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {milestone.description}
                              </Typography>
                            </Box>
                            {isCompleted && <CheckIcon color="success" />}
                          </MilestoneCard>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No milestones defined.</Typography>
                  )}
                </Box>
              )}
              
              {activeTab === 3 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Recent Check-Ins</Typography>
                  {challenge.checkIns?.length > 0 ? (
                    <List>
                      {challenge.checkIns.slice(0, 20).map((checkIn, index) => (
                        <React.Fragment key={checkIn.id}>
                          <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                            <ListItemAvatar>
                              <Avatar 
                                src={checkIn.user?.Profile?.profilePicture ? resolveImageUrl(checkIn.user.Profile.profilePicture) : undefined}
                              >
                                {checkIn.user?.firstName?.[0]}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="subtitle2">
                                    {checkIn.user?.firstName} {checkIn.user?.lastName}
                                  </Typography>
                                  <Typography variant="h6">{MOOD_EMOJIS[checkIn.mood]}</Typography>
                                </Box>
                              }
                              secondary={
                                <>
                                  <Typography variant="body2">{checkIn.content}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(checkIn.createdAt).toLocaleDateString()} • Day {checkIn.dayNumber}
                                  </Typography>
                                </>
                              }
                            />
                          </ListItem>
                          {index < challenge.checkIns.length - 1 && <Divider variant="inset" component="li" />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No check-ins yet.</Typography>
                  )}
                </Box>
              )}
            </Box>
          </Paper>
        </Container>
      </ContentSection>
      
      {/* Check-In Dialog */}
      <Dialog open={checkInOpen} onClose={() => setCheckInOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Daily Check-In</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" gutterBottom>How are you feeling today?</Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', my: 3 }}>
            {Object.entries(MOOD_EMOJIS).map(([mood, emoji]) => (
              <Box
                key={mood}
                onClick={() => setCheckInData(prev => ({ ...prev, mood }))}
                sx={{
                  cursor: 'pointer',
                  p: 2,
                  borderRadius: 2,
                  border: '2px solid',
                  borderColor: checkInData.mood === mood ? '#F97316' : 'grey.200',
                  bgcolor: checkInData.mood === mood ? alpha('#F97316', 0.1) : 'transparent',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: '#F97316' }
                }}
              >
                <Typography variant="h4">{emoji}</Typography>
                <Typography variant="caption" display="block" textAlign="center" sx={{ textTransform: 'capitalize' }}>
                  {mood}
                </Typography>
              </Box>
            ))}
          </Box>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="What did you accomplish today?"
            value={checkInData.content}
            onChange={(e) => setCheckInData(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Share your progress, learnings, or challenges..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCheckInOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCheckIn}
            disabled={submitting}
            sx={{ bgcolor: '#F97316' }}
          >
            Submit Check-In
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Share Dialog */}
      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite Friends</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Share this link to invite friends to the challenge:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <TextField
              fullWidth
              value={`${window.location.origin}/challenges/join/${challenge.inviteCode}`}
              InputProps={{ readOnly: true }}
              size="small"
            />
            <Button variant="contained" onClick={copyInviteLink} startIcon={<CopyIcon />}>
              Copy
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </PageContainer>
  );
}
