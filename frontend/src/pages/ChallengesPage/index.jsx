import React, { useState, useEffect, useMemo } from 'react';
import {
  pulse,
  shimmer,
  PageContainer,
  HeroSection,
  LiveBadge,
  LiveDot,
  GradientText,
  StatsRow,
  StatItem,
  StatIconCircle,
  TrendingBar,
  TrendingLabel,
  FilterSection,
  ChallengeGrid,
  ChallengeCardStyled,
  CardImageWrapper,
  CardImage,
  CategoryBadge,
  CategoryDot,
  FavoriteButton,
  TimeBadge,
  CardBody,
  XpBadge,
  ViewDetailsLink,
  LeaderboardSection,
  LeaderboardTable,
  LeaderboardRow,
  RankBadge
} from './styled';
import { ROUTES, STATUS_CONFIG, CATEGORY_CONFIG, LIMITS, TEXT } from './constants';

export default function ChallengesPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [challenges, setChallenges] = useState([]);
  const [myChallenges, setMyChallenges] = useState([]);
  const [bookmarked, setBookmarked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState(0);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [favorites, setFavorites] = useState(new Set());

  const [stats, setStats] = useState({ openChallenges: 0, activeChallengers: 0, totalChallenges: 0 });

  useEffect(() => {
    if (activeTab === 0) {
      fetchChallenges();
    } else if (activeTab === 1) {
      fetchMyChallenges();
    }
    // Tab 2 (bookmarked) uses local state
  }, [activeTab, selectedType, selectedStatus, sortBy, searchQuery]);

  const fetchChallenges = async () => {
    try {
      setLoading(true);
      const params = {
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        sort: sortBy,
        search: searchQuery || undefined,
        limit: 20
      };
      const response = await challengesAPI.getAll(params);
      setChallenges(response.data.challenges || []);
      setStats({
        openChallenges: response.data.challenges?.filter(c => c.status === 'recruiting').length || 0,
        activeChallengers: response.data.challenges?.reduce((sum, c) => sum + (c.participantCount || 0), 0) || 0,
        totalChallenges: response.data.pagination?.total || 0
      });
    } catch (err) {
      console.error('Error fetching challenges:', err);
      setError('Failed to load challenges');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyChallenges = async () => {
    if (!isAuthenticated) {
      setMyChallenges([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await challengesAPI.getMyChallenges();
      const all = [...(response.data.created || []), ...(response.data.participated || [])];
      setMyChallenges(all);
    } catch (err) {
      console.error('Error fetching my challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChallengeClick = (challenge) => {
    navigate(`/challenges/${challenge.id}`);
  };

  const toggleFavorite = (e, challengeId) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(challengeId)) {
        next.delete(challengeId);
        setBookmarked(bk => bk.filter(c => c.id !== challengeId));
      } else {
        next.add(challengeId);
        const challenge = challenges.find(c => c.id === challengeId) || myChallenges.find(c => c.id === challengeId);
        if (challenge) setBookmarked(bk => [...bk, challenge]);
      }
      return next;
    });
  };

  const getTimeLabel = (challenge) => {
    if (challenge.status === 'recruiting' && challenge.startDate) {
      const diff = Math.ceil((new Date(challenge.startDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (diff > 0) return `Starts in ${diff} day${diff !== 1 ? 's' : ''}`;
      return 'Starting soon';
    }
    if (challenge.status === 'active' && challenge.endDate) {
      const diff = Math.ceil((new Date(challenge.endDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (diff > 0) return `Ends in ${diff} day${diff !== 1 ? 's' : ''}`;
      return 'Ending soon';
    }
    if (challenge.status === 'completed') return 'Completed';
    return `${challenge.duration} days`;
  };

  const getXp = (challenge) => {
    return challenge.duration * 10;
  };

  // Build leaderboard from challenge creators/participants
  const topChallengers = useMemo(() => {
    challenges.forEach(c => {
      if (c.creator) {
        const id = c.creator.id || c.creatorId;
        if (!creatorMap[id]) {
          creatorMap[id] = {
            id,
            firstName: c.creator.firstName,
            lastName: c.creator.lastName,
            profilePicture: c.creator.profilePicture,
            completed: 0,
            points: 0,
            streak: 0
          };
        }
        creatorMap[id].completed += 1;
        creatorMap[id].points += (c.participantCount || 0) * 10;
        creatorMap[id].streak = Math.max(creatorMap[id].streak, c.duration || 0);
      }
    });
    return Object.values(creatorMap)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);
  }, [challenges]);

  const renderChallengeCard = (challenge) => {
    const config = CATEGORY_CONFIG[challenge.type] || CATEGORY_CONFIG.custom;
    const isFav = favorites.has(challenge.id);
    const coverUrl = challenge.coverImage ? resolveImageUrl(challenge.coverImage) : null;

    return (
      <ChallengeCardStyled key={challenge.id} onClick={() => handleChallengeClick(challenge)}>
        <CardImageWrapper $gradient={config.gradient}>
          {coverUrl ? (
            <CardImage src={coverUrl} alt={challenge.title} loading="lazy" />
          ) : null}
          <CategoryBadge>
            <CategoryDot $color={config.dotColor} />
            {config.label}
          </CategoryBadge>
          <FavoriteButton onClick={(e) => toggleFavorite(e, challenge.id)}>
            {isFav ? (
              <HeartIcon sx={{ fontSize: 18, color: '#ef4444' }} />
            ) : (
              <HeartOutlineIcon sx={{ fontSize: 18, color: '#64748b' }} />
            )}
          </FavoriteButton>
          <TimeBadge>
            <TimeIcon sx={{ fontSize: 13 }} />
            {getTimeLabel(challenge)}
          </TimeBadge>
          {challenge.participantCount > 0 && (
            <Box sx={{ position: 'absolute', bottom: 14, right: 14, zIndex: 2 }}>
              <AvatarGroup max={3} sx={{
                '& .MuiAvatar-root': { width: 28, height: 28, border: '2px solid white', fontSize: 11 }
              }}>
                {Array.from({ length: Math.min(challenge.participantCount, 3) }).map((_, i) => (
                  <Avatar key={i} sx={{ bgcolor: ['#6366f1', '#ec4899', '#f59e0b'][i] }}>
                    {String.fromCharCode(65 + i)}
                  </Avatar>
                ))}
              </AvatarGroup>
            </Box>
          )}
        </CardImageWrapper>

        <CardBody>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5, color: '#1a1a2e', lineHeight: 1.3 }}>
            {challenge.title}
          </Typography>

          {challenge.description && (
            <Typography
              variant="body2"
              sx={{
                mb: 2,
                color: '#64748b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.5
              }}
            >
              {challenge.description}
            </Typography>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
            <XpBadge>
              <BoltIcon sx={{ fontSize: 14 }} />
              {getXp(challenge)} XP
            </XpBadge>
            <ViewDetailsLink onClick={(e) => { e.stopPropagation(); handleChallengeClick(challenge); }}>
              View Details <ArrowForwardIcon sx={{ fontSize: 15 }} />
            </ViewDetailsLink>
          </Box>
        </CardBody>
      </ChallengeCardStyled>
    );
  };

  const displayChallenges = activeTab === 0 ? challenges : activeTab === 1 ? myChallenges : bookmarked;

  // Trending challenge for the hero bar
  const trendingChallenge = challenges.find(c => c.status === 'recruiting' && (c.participantCount || 0) > 0) || challenges[0];

  return (
    <PageContainer>
      <Container maxWidth="lg">
        {/* ============ HERO ============ */}
        <HeroSection>
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <LiveBadge>
              <LiveDot />
              LIVE CHALLENGES
            </LiveBadge>

            <Typography variant="h3" fontWeight={800} sx={{ mb: 1, lineHeight: 1.2, fontSize: { xs: '1.75rem', md: '2.5rem' } }}>
              Master Your Skills in{' '}
              <GradientText>Challenge Mode</GradientText>
            </Typography>

            <Typography variant="body1" sx={{ opacity: 0.7, maxWidth: 520, mb: 3, lineHeight: 1.6 }}>
              Join time-bound challenges with friends. Daily check-ins, leaderboards, and accountability to push your growth.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/challenges/create')}
                sx={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  fontWeight: 700,
                  borderRadius: '14px',
                  px: 3.5,
                  py: 1.2,
                  textTransform: 'none',
                  fontSize: 15,
                  boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                  '&:hover': { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }
                }}
              >
                Create Challenge
              </Button>
              <Button
                variant="outlined"
                startIcon={<InfoIcon />}
                sx={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: 'white',
                  fontWeight: 600,
                  borderRadius: '14px',
                  px: 3,
                  py: 1.2,
                  textTransform: 'none',
                  fontSize: 15,
                  '&:hover': { borderColor: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)' }
                }}
              >
                How it works
              </Button>
            </Box>

            <StatsRow>
              <StatItem>
                <StatIconCircle $bg="rgba(34, 197, 94, 0.2)">
                  <TrophyIcon sx={{ fontSize: 22, color: '#22c55e' }} />
                </StatIconCircle>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1 }}>{stats.openChallenges}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>Open Challenges</Typography>
                </Box>
              </StatItem>
              <StatItem>
                <StatIconCircle $bg="rgba(99, 102, 241, 0.2)">
                  <GroupIcon sx={{ fontSize: 22, color: '#6366f1' }} />
                </StatIconCircle>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1 }}>{stats.activeChallengers}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>Active Challengers</Typography>
                </Box>
              </StatItem>
              <StatItem>
                <StatIconCircle $bg="rgba(236, 72, 153, 0.2)">
                  <FireIcon sx={{ fontSize: 22, color: '#ec4899' }} />
                </StatIconCircle>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1 }}>{stats.totalChallenges}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>Total Challenges</Typography>
                </Box>
              </StatItem>
            </StatsRow>

            {trendingChallenge && (
              <TrendingBar>
                <TrendingLabel>🔥 Trending</TrendingLabel>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  "{trendingChallenge.title}", {trendingChallenge.participantCount || 0} people joined
                </Typography>
              </TrendingBar>
            )}
          </Box>
        </HeroSection>

        {/* ============ FILTER / TABS ============ */}
        <FilterSection>
          <Box sx={{ borderBottom: '1px solid #f1f5f9' }}>
            <Tabs
              value={activeTab}
              onChange={(e, v) => setActiveTab(v)}
              sx={{
                px: 2,
                '& .MuiTab-root': {
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: 15,
                  color: '#64748b',
                  minHeight: 56,
                  '&.Mui-selected': { color: '#6366f1' }
                },
                '& .MuiTabs-indicator': { background: '#6366f1', height: 3, borderRadius: '3px 3px 0 0' }
              }}
            >
              <Tab icon={<TrendingIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Discover" />
              <Tab
                icon={<TrophyIcon sx={{ fontSize: 20 }} />}
                iconPosition="start"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    My Challenges
                    <Chip
                      label={myChallenges.length}
                      size="small"
                      sx={{
                        height: 22,
                        minWidth: 22,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#6366f1',
                        color: 'white'
                      }}
                    />
                  </Box>
                }
              />
              <Tab icon={<BookmarkOutlineIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Bookmarked" />
            </Tabs>
          </Box>

          <Box sx={{ p: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search challenges..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8' }} /></InputAdornment>
              }}
              sx={{
                flex: 1,
                minWidth: isMobile ? '100%' : 220,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  background: '#f8fafc',
                  '& fieldset': { borderColor: '#e2e8f0' },
                  '&:hover fieldset': { borderColor: '#cbd5e1' }
                }
              }}
            />

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '12px',
                  background: '#f8fafc',
                  '& fieldset': { borderColor: '#e2e8f0' },
                  fontSize: 14
                }}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="sprint">Coding</MenuItem>
                <MenuItem value="deep_dive">Design</MenuItem>
                <MenuItem value="transformation">Writing</MenuItem>
                <MenuItem value="custom">General</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '12px',
                  background: '#f8fafc',
                  '& fieldset': { borderColor: '#e2e8f0' },
                  fontSize: 14
                }}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="recruiting">Open to Join</MenuItem>
                <MenuItem value="active">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '12px',
                  background: '#f8fafc',
                  '& fieldset': { borderColor: '#e2e8f0' },
                  fontSize: 14
                }}
              >
                <MenuItem value="newest">Newest First</MenuItem>
                <MenuItem value="popular">Most Popular</MenuItem>
                <MenuItem value="starting_soon">Starting Soon</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
              <IconButton
                size="small"
                onClick={() => setViewMode('grid')}
                sx={{
                  borderRadius: '10px',
                  background: viewMode === 'grid' ? '#6366f1' : '#f1f5f9',
                  color: viewMode === 'grid' ? 'white' : '#64748b',
                  width: 36,
                  height: 36,
                  '&:hover': { background: viewMode === 'grid' ? '#4f46e5' : '#e2e8f0' }
                }}
              >
                <GridViewIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setViewMode('list')}
                sx={{
                  borderRadius: '10px',
                  background: viewMode === 'list' ? '#6366f1' : '#f1f5f9',
                  color: viewMode === 'list' ? 'white' : '#64748b',
                  width: 36,
                  height: 36,
                  '&:hover': { background: viewMode === 'list' ? '#4f46e5' : '#e2e8f0' }
                }}
              >
                <ListViewIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>
        </FilterSection>

        {/* ============ ERROR ============ */}
        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

        {/* ============ CARDS ============ */}
        {loading ? (
          <ChallengeGrid>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Paper key={i} elevation={0} sx={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
                <Skeleton variant="rectangular" height={180} />
                <Box sx={{ p: 2.5 }}>
                  <Skeleton variant="text" width="80%" height={28} />
                  <Skeleton variant="text" width="100%" />
                  <Skeleton variant="text" width="60%" />
                </Box>
              </Paper>
            ))}
          </ChallengeGrid>
        ) : displayChallenges.length === 0 ? (
          <Box sx={{
            background: 'white',
            borderRadius: '20px',
            p: 8,
            textAlign: 'center',
            boxShadow: '0 2px 16px rgba(0,0,0,0.06)'
          }}>
            <Box sx={{
              width: 80,
              height: 80,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #ede9fe, #e0e7ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3
            }}>
              <TrophyIcon sx={{ fontSize: 40, color: '#6366f1' }} />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#1a1a2e', mb: 1 }}>
              {activeTab === 2 ? 'No bookmarked challenges' : 'No challenges found'}
            </Typography>
            <Typography variant="body1" sx={{ color: '#64748b', mb: 3, maxWidth: 400, mx: 'auto' }}>
              {activeTab === 0
                ? 'Be the first to create a challenge and inspire others!'
                : activeTab === 1
                  ? "You haven't joined any challenges yet. Explore and find one!"
                  : 'Bookmark challenges by clicking the heart icon on any card.'}
            </Typography>
            {activeTab !== 2 && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/challenges/create')}
                sx={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  fontWeight: 600,
                  borderRadius: '14px',
                  px: 4,
                  py: 1.2,
                  textTransform: 'none',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.3)'
                }}
              >
                Create Challenge
              </Button>
            )}
          </Box>
        ) : (
          <ChallengeGrid>{displayChallenges.map(renderChallengeCard)}</ChallengeGrid>
        )}

        {/* ============ TOP CHALLENGERS ============ */}
        {topChallengers.length > 0 && activeTab === 0 && (
          <LeaderboardSection>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrophyIcon sx={{ fontSize: 24, color: '#d97706' }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#1a1a2e' }}>Top Challengers</Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Most active participants this month</Typography>
              </Box>
            </Box>

            <LeaderboardTable>
              <thead>
                <tr>
                  <td style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Rank</td>
                  <td style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>User</td>
                  <td style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Completed</td>
                  <td style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Points</td>
                  <td style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Streak</td>
                </tr>
              </thead>
              <tbody>
                {topChallengers.map((challenger, idx) => (
                  <LeaderboardRow key={challenger.id} $isTop={idx === 0}>
                    <td>
                      <RankBadge $rank={idx + 1}>
                        {idx < 3 ? <StarIcon sx={{ fontSize: 16 }} /> : idx + 1}
                      </RankBadge>
                    </td>
                    <td>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={challenger.profilePicture ? resolveImageUrl(challenger.profilePicture) : undefined}
                          sx={{ width: 36, height: 36 }}
                        >
                          {challenger.firstName?.[0]}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600} sx={{ color: '#1a1a2e' }}>
                          {challenger.firstName} {challenger.lastName?.[0]}.
                        </Typography>
                      </Box>
                    </td>
                    <td>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#1a1a2e' }}>
                        {challenger.completed}
                      </Typography>
                    </td>
                    <td>
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#6366f1' }}>
                        {challenger.points.toLocaleString()}
                      </Typography>
                    </td>
                    <td>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <FireIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                        <Typography variant="body2" fontWeight={600} sx={{ color: '#1a1a2e' }}>
                          {challenger.streak}
                        </Typography>
                      </Box>
                    </td>
                  </LeaderboardRow>
                ))}
              </tbody>
            </LeaderboardTable>
          </LeaderboardSection>
        )}
      </Container>
    </PageContainer>
  );
}
