import {
  Container, Box, Typography, Paper, CircularProgress, Alert, Button,
  Avatar, Chip, IconButton, Skeleton
} from '@mui/material';
import {
  PageContainer,
  ContentWrapper,
  BackButton,
  HeaderCard,
  AuthorSection,
  AuthorInfo,
  StatsRow
} from './styled';
import { TEXT, TIME_UNITS } from './constants';

const PollDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPoll();
  }, [id]);

  const loadPoll = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await pollsAPI.getById(id);
      setPoll(response.data);
    } catch (err) {
      console.error('Error loading poll:', err);
      setError(err.response?.data?.message || TEXT.ERROR_LOADING);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = (updatedPoll) => {
    setPoll(updatedPoll);
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = `Vote on this poll: "${poll?.question}"`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: TEXT.SHARE_TITLE,
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      // Could add a toast notification here
    }
    
    // Track share
    try {
      await pollsAPI.trackShare(id);
    } catch (e) {
      // Ignore
    }
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const created = new Date(date);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / TIME_UNITS.MINUTE_MS);
    const diffHours = Math.floor(diffMs / TIME_UNITS.HOUR_MS);
    const diffDays = Math.floor(diffMs / TIME_UNITS.DAY_MS);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <PageContainer>
        <ContentWrapper>
          <BackButton startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            {TEXT.BACK}
          </BackButton>
          <Paper sx={{ p: 3, borderRadius: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Skeleton variant="circular" width={48} height={48} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="30%" />
              </Box>
            </Box>
            <Skeleton variant="text" width="90%" height={32} />
            <Skeleton variant="rectangular" height={60} sx={{ mt: 2, borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={60} sx={{ mt: 1, borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={60} sx={{ mt: 1, borderRadius: 2 }} />
          </Paper>
        </ContentWrapper>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ContentWrapper>
          <BackButton startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            {TEXT.BACK}
          </BackButton>
          <Alert severity="error" sx={{ borderRadius: 3 }}>
            {error}
          </Alert>
          <Button 
            variant="contained" 
            onClick={loadPoll} 
            sx={{ mt: 2 }}
          >
            {TEXT.TRY_AGAIN}
          </Button>
        </ContentWrapper>
      </PageContainer>
    );
  }

  if (!poll) {
    return (
      <PageContainer>
        <ContentWrapper>
          <BackButton startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            {TEXT.BACK}
          </BackButton>
          <Alert severity="warning" sx={{ borderRadius: 3 }}>
            {TEXT.POLL_NOT_FOUND}
          </Alert>
        </ContentWrapper>
      </PageContainer>
    );
  }

  const author = poll.author || {};

  return (
    <PageContainer>
      <ContentWrapper>
        <BackButton startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          {TEXT.BACK_TO_FEED}
        </BackButton>

        {/* Header with author info */}
        <HeaderCard elevation={0}>
          <AuthorSection>
            <Avatar
              src={author.profilePictureUrl ? resolveImageUrl(author.profilePictureUrl) : undefined}
              sx={{ width: 48, height: 48, bgcolor: 'rgba(255,255,255,0.2)' }}
            >
              {author.firstName?.[0]}{author.lastName?.[0]}
            </Avatar>
            <AuthorInfo>
              <div 
                className="name" 
                onClick={() => navigate(`/profile/${author.id}`)}
              >
                {author.firstName} {author.lastName}
              </div>
              <div className="meta">
                Created {getTimeAgo(poll.createdAt)}
              </div>
            </AuthorInfo>
            <IconButton 
              onClick={handleShare}
              sx={{ color: 'white' }}
            >
              <ShareIcon />
            </IconButton>
          </AuthorSection>

          <Typography variant="h5" fontWeight={700}>
            {TEXT.POLL_HEADING}
          </Typography>

          <StatsRow>
            <div className="stat">
              🗳️ {poll.options?.reduce((sum, opt) => sum + (opt.votes || 0), 0) || 0} votes
            </div>
            <div className="stat">
              👁️ {poll.views || 0} views
            </div>
            <div className="stat">
              🔗 {poll.shares || 0} shares
            </div>
            {poll.isHotTake && (
              <Chip
                icon={<LocalFireDepartmentIcon sx={{ color: '#f97316 !important' }} />}
                label={TEXT.HOT_TAKE}
                size="small"
                sx={{
                  background: 'rgba(249, 115, 22, 0.2)',
                  color: '#f97316',
                  fontWeight: 600,
                  border: '1px solid rgba(249, 115, 22, 0.3)'
                }}
              />
            )}
          </StatsRow>
        </HeaderCard>

        {/* Poll Card */}
        <PollCard 
          poll={poll} 
          onVote={handleVote}
        />
      </ContentWrapper>
    </PageContainer>
  );
};

export default PollDetailPage;
