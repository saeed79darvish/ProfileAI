import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Paper,
  Avatar,
  Stack,
  IconButton,
  Fade,
  Skeleton,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  Tooltip,
  Pagination,
} from '@mui/material';
import {
  HeroSection,
  AgentButton,
  HeroContent,
  HeroHeader,
  HeroTitle,
  HeroSubtitle,
  StatsGrid,
  StatCard,
  StatValue,
  StatLabel,
  DecorativeCircle
} from './styled';
import { ROUTES, COMMON_SKILLS, EXPERIENCE_LEVELS, SORT_OPTIONS, LIMITS, AI_WEIGHTS, COMPLETENESS_WEIGHTS, TEXT } from './constants';
import { featureFlags } from '../../config/featureFlags';

const BrowseProfiles = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [selectedCandidateForAgent, setSelectedCandidateForAgent] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [totalResults, setTotalResults] = useState(0);
  
  // Advanced filter states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [aiEnhancedOnly, setAiEnhancedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Redirect candidates away - this page is for recruiters only
  useEffect(() => {
    if (isAuthenticated && user?.role === 'candidate') {
      navigate('/profile');
    }
  }, [isAuthenticated, user, navigate]);

  // Load profiles when any filter changes (using debounced search)
  useEffect(() => {
    loadProfiles();
  }, [page, debouncedSearch, selectedSkills, locationFilter, experienceLevel, aiEnhancedOnly, sortBy]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      
      // Remove undefined values
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      const response = await profileAPI.getAllProfiles(params);
      
      setProfiles(response.data.profiles || []);
      setTotalResults(response.data.total || 0);
    } catch (err) {
      console.error('Failed to load profiles:', err);
      setProfiles([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const calculateAIScore = (profile) => {
    if (profile.aiSummary) score += 25;
    if (profile.aiStrengths && profile.aiStrengths.length > 0) score += 25;
    if (profile.aiKeywords && profile.aiKeywords.length > 5) score += 20;
    if (profile.aiRecruiterInsights) score += 30;
    return score;
  };

  const getProfileCompleteness = (profile) => {
    if (profile.summary) completeness += 15;
    if (profile.experience && profile.experience.length > 0) completeness += 25;
    if (profile.education && profile.education.length > 0) completeness += 15;
    if (profile.projects && profile.projects.length > 0) completeness += 15;
    if (Object.values(profile.skills || {}).flat().length > 0) completeness += 20;
    if (profile.linkedinUrl || profile.githubUrl) completeness += 10;
    return completeness;
  };

  const getExperienceLevel = (profile) => {
    const expCount = (profile.experience || []).length;
    if (expCount >= 5) return { level: 'Senior', color: 'error' };
    if (expCount >= 3) return { level: 'Mid-Level', color: 'warning' };
    if (expCount >= 1) return { level: 'Junior', color: 'info' };
    return { level: 'Entry', color: 'success' };
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    // Page reset will happen when debouncedSearch changes
  };
  
  // Reset page when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== '') {
      setPage(1);
    }
  }, [debouncedSearch]);

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedSkills([]);
    setLocationFilter('');
    setExperienceLevel('');
    setAiEnhancedOnly(false);
    setSortBy('relevance');
    setPage(1);
  };

  const hasActiveFilters = search || selectedSkills.length > 0 || locationFilter || experienceLevel || aiEnhancedOnly;

  const handleScoutWithAgent = (e, profile) => {
    e.stopPropagation();
    // Flatten user data so AgentNegotiationModal can access firstName/lastName directly
    setSelectedCandidateForAgent({
      ...profile,
      firstName: profile.user?.firstName,
      lastName: profile.user?.lastName,
    });
    setAgentModalOpen(true);
  };

  const handleAgentSuccess = (negotiation) => {
    setAgentModalOpen(false);
    setSelectedCandidateForAgent(null);
    // Navigate to the agent arena to view the negotiation
    navigate(`/agent-arena/${negotiation.id}`);
  };

  return (
    <Box sx={{ bgcolor: 'grey.50', minHeight: '100vh' }}>
      {/* Hero Header */}
      <HeroSection>
        <HeroContent>
          <Fade in timeout={800}>
            <div>
              <HeroHeader>
                <PsychologyIcon />
                <div>
                  <HeroTitle>Discover Top Talent</HeroTitle>
                  <HeroSubtitle>
                    AI-powered profiles to help you find the perfect candidates
                  </HeroSubtitle>
                </div>
              </HeroHeader>

              {/* Stats Bar */}
              <StatsGrid>
                {[
                  { value: profiles.length, label: 'Active Profiles', icon: '👤' },
                  { value: profiles.filter(p => p.aiSummary).length, label: 'AI Enhanced', icon: '🤖' },
                  { value: new Set(profiles.flatMap(p => Object.values(p.skills || {}).flat())).size, label: 'Unique Skills', icon: '⚡' },
                  { value: '100%', label: 'Free to Browse', icon: '🎉' }
                ].map((stat, idx) => (
                  <StatCard key={idx}>
                    <StatValue>
                      {stat.icon} {stat.value}
                    </StatValue>
                    <StatLabel>{stat.label}</StatLabel>
                  </StatCard>
                ))}
              </StatsGrid>
            </div>
          </Fade>
        </HeroContent>

        {/* Decorative circles */}
        <DecorativeCircle className="circle-1" />
        <DecorativeCircle className="circle-2" />
      </HeroSection>

      {/* Search Section */}
      <Container maxWidth="lg" sx={{ mt: -4, position: 'relative', zIndex: 10 }}>
        <Paper
          elevation={4}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            mb: 4
          }}
        >
          {/* Main Search Bar */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              fullWidth
              placeholder="Search by name, title, skills, location... (e.g., 'Marketing Manager in New York')"
              value={search}
              onChange={handleSearch}
              sx={{ flex: 1, minWidth: 280 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="primary" sx={{ fontSize: 28 }} />
                  </InputAdornment>
                ),
                endAdornment: search && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  fontSize: { xs: '0.95rem', md: '1.1rem' },
                  py: { xs: 0.5, md: 1 }
                }
              }}
            />
            <Button
              variant={showFilters ? "contained" : "outlined"}
              startIcon={<FilterIcon />}
              endIcon={showFilters ? <CollapseIcon /> : <ExpandIcon />}
              onClick={() => setShowFilters(!showFilters)}
              sx={{ minWidth: 120 }}
            >
              Filters {hasActiveFilters && `(${[selectedSkills.length > 0, locationFilter, experienceLevel, aiEnhancedOnly].filter(Boolean).length})`}
            </Button>
          </Box>
          
          {/* Advanced Filters Panel */}
          <Collapse in={showFilters}>
            <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Grid container spacing={2}>
                {/* Skills Filter */}
                <Grid item xs={12} md={4}>
                  <Autocomplete
                    multiple
                    options={COMMON_SKILLS}
                    value={selectedSkills}
                    onChange={(e, newValue) => { setSelectedSkills(newValue); setPage(1); }}
                    freeSolo
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="outlined"
                          label={option}
                          size="small"
                          color="primary"
                          {...getTagProps({ index })}
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Skills"
                        placeholder="Type or select skills..."
                        size="small"
                      />
                    )}
                  />
                </Grid>
                
                {/* Location Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Location"
                    placeholder="e.g., San Francisco, Remote"
                    value={locationFilter}
                    onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocationIcon fontSize="small" />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
                
                {/* Experience Level Filter */}
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Experience Level</InputLabel>
                    <Select
                      value={experienceLevel}
                      label="Experience Level"
                      onChange={(e) => { setExperienceLevel(e.target.value); setPage(1); }}
                    >
                      {EXPERIENCE_LEVELS.map(level => (
                        <MenuItem key={level.value} value={level.value}>
                          {level.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                {/* Sort By */}
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={sortBy}
                      label="Sort By"
                      onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                      startAdornment={
                        <InputAdornment position="start">
                          <SortIcon fontSize="small" />
                        </InputAdornment>
                      }
                    >
                      {SORT_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              
              {/* Filter Toggles & Clear */}
              <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Tooltip title="Show only profiles with AI-generated insights">
                  <Chip
                    icon={<AIIcon />}
                    label="AI Enhanced Only"
                    onClick={() => { setAiEnhancedOnly(!aiEnhancedOnly); setPage(1); }}
                    color={aiEnhancedOnly ? "primary" : "default"}
                    variant={aiEnhancedOnly ? "filled" : "outlined"}
                    sx={{ cursor: 'pointer' }}
                  />
                </Tooltip>
                
                {hasActiveFilters && (
                  <Button
                    size="small"
                    startIcon={<ClearIcon />}
                    onClick={handleClearFilters}
                    color="error"
                  >
                    Clear All Filters
                  </Button>
                )}
                
                <Box sx={{ flexGrow: 1 }} />
                
                <Typography variant="body2" color="text.secondary">
                  Found <strong>{totalResults}</strong> candidate{totalResults !== 1 ? 's' : ''}
                  {hasActiveFilters && ' matching your criteria'}
                </Typography>
              </Box>
            </Box>
          </Collapse>
          
          {/* Active Filter Chips (when filters panel is closed) */}
          {!showFilters && hasActiveFilters && (
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                Active filters:
              </Typography>
              {selectedSkills.map(skill => (
                <Chip
                  key={skill}
                  label={skill}
                  size="small"
                  onDelete={() => setSelectedSkills(selectedSkills.filter(s => s !== skill))}
                />
              ))}
              {locationFilter && (
                <Chip
                  icon={<LocationIcon />}
                  label={locationFilter}
                  size="small"
                  onDelete={() => setLocationFilter('')}
                />
              )}
              {experienceLevel && (
                <Chip
                  label={EXPERIENCE_LEVELS.find(l => l.value === experienceLevel)?.label}
                  size="small"
                  onDelete={() => setExperienceLevel('')}
                />
              )}
              {aiEnhancedOnly && (
                <Chip
                  icon={<AIIcon />}
                  label="AI Enhanced"
                  size="small"
                  color="primary"
                  onDelete={() => setAiEnhancedOnly(false)}
                />
              )}
              <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                {totalResults} result{totalResults !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Profile Grid */}
        {loading ? (
          <Grid container spacing={3}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Grid item xs={12} sm={6} md={4} key={n}>
                <Card sx={{ height: 400, borderRadius: 2 }}>
                  <CardContent>
                    <Skeleton variant="circular" width={60} height={60} />
                    <Skeleton variant="text" sx={{ mt: 2 }} height={40} />
                    <Skeleton variant="text" height={30} />
                    <Skeleton variant="rectangular" height={100} sx={{ mt: 2, borderRadius: 1 }} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : profiles.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
            <SearchIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" color="text.secondary" gutterBottom>
              No profiles found
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Try adjusting your search terms
            </Typography>
          </Paper>
        ) : (
          <>
          <Grid container spacing={3} sx={{ pb: 6 }}>
            {profiles.map((profile, index) => {
              const aiScore = calculateAIScore(profile);
              const completeness = getProfileCompleteness(profile);
              const expLevel = getExperienceLevel(profile);
              const topSkills = Object.values(profile.skills || {}).flat().slice(0, 5);

              return (
                <Grid item xs={12} sm={6} lg={4} key={profile.id}>
                  <Fade in timeout={300 + index * 100}>
                    <Card
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 2,
                        position: 'relative',
                        overflow: 'visible',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          transform: 'translateY(-8px)',
                          boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                        }
                      }}
                    >
                      {/* Top Badge */}
                      {aiScore >= 70 && (
                        <Chip
                          icon={<TrophyIcon />}
                          label="⭐ Top Candidate"
                          color="warning"
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: -12,
                            right: 16,
                            fontWeight: 'bold',
                            boxShadow: 2
                          }}
                        />
                      )}

                      <CardContent sx={{ flexGrow: 1, p: 3 }}>
                        {/* Profile Header */}
                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                          <Avatar
                            src={resolveImageUrl(profile.profilePicture)}
                            sx={{
                              bgcolor: 'primary.main',
                              width: 64,
                              height: 64,
                              fontSize: '1.5rem',
                              fontWeight: 'bold',
                              boxShadow: 2
                            }}
                          >
                            {!profile.profilePicture && `${profile.user?.firstName?.[0]}${profile.user?.lastName?.[0]}`}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography 
                              variant="h6" 
                              fontWeight="700"
                              sx={{ 
                                mb: 0.5,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {profile.user?.firstName} {profile.user?.lastName}
                            </Typography>
                            <Typography 
                              variant="body2" 
                              color="text.secondary"
                              sx={{ 
                                mb: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {profile.title}
                            </Typography>
                            {profile.location && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LocationIcon fontSize="small" color="action" />
                                <Typography variant="caption" color="text.secondary">
                                  {profile.location}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>

                        {/* Tags */}
                        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                          <Chip
                            label={expLevel.level}
                            color={expLevel.color}
                            size="small"
                            icon={<WorkIcon />}
                          />
                          <Chip
                            label={`${completeness}% Complete`}
                            size="small"
                            icon={<SpeedIcon />}
                            color={completeness >= 80 ? 'success' : 'default'}
                            variant="outlined"
                          />
                          {aiScore >= 50 && (
                            <Chip
                              label="AI Enhanced"
                              size="small"
                              icon={<AIIcon />}
                              color="secondary"
                              variant="outlined"
                            />
                          )}
                        </Stack>

                        {/* AI Summary */}
                        {profile.aiSummary && (
                          <Paper
                            elevation={0}
                            sx={{
                              bgcolor: 'primary.50',
                              p: 2,
                              mb: 2,
                              borderRadius: 1.5,
                              borderLeft: '4px solid',
                              borderColor: 'primary.main'
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                              <AIIcon fontSize="small" color="primary" />
                              <Typography variant="caption" fontWeight="700" color="primary">
                                AI INSIGHTS
                              </Typography>
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                lineHeight: 1.5
                              }}
                            >
                              {profile.aiSummary}
                            </Typography>
                          </Paper>
                        )}

                        {/* Skills */}
                        {topSkills.length > 0 && (
                          <Box>
                            <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                              TOP SKILLS
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {topSkills.map((skill, idx) => (
                                <Chip
                                  key={idx}
                                  label={skill}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                      </CardContent>

                      <CardActions sx={{ p: 2, pt: 0, gap: 1, flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<ViewIcon />}
                            onClick={() => navigate(`/profile/${profile.userId}`)}
                            sx={{ 
                              borderRadius: 1.5,
                              textTransform: 'none',
                              fontWeight: 600
                            }}
                          >
                            View Profile
                          </Button>
                          <Button
                            fullWidth
                            variant="contained"
                            startIcon={<RocketIcon />}
                            onClick={() => navigate(`/recruiter-tools/${profile.userId}`)}
                            sx={{ 
                              borderRadius: 1.5,
                              textTransform: 'none',
                              fontWeight: 600,
                              background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                            }}
                          >
                            AI Tools
                          </Button>
                        </Box>
                        {featureFlags.recruiterAgentArena && (
                          <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                            <AgentButton
                              fullWidth
                              variant="contained"
                              startIcon={<AgentIcon />}
                              onClick={(e) => handleScoutWithAgent(e, profile)}
                            >
                              🤖 Scout with Agent
                            </AgentButton>
                          </Box>
                        )}
                      </CardActions>
                    </Card>
                  </Fade>
                </Grid>
              );
            })}
          </Grid>
          
          {/* Pagination */}
          {totalResults > limit && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
              <Pagination
                count={Math.ceil(totalResults / limit)}
                page={page}
                onChange={(e, newPage) => setPage(newPage)}
                color="primary"
                size="large"
                showFirstButton
                showLastButton
                sx={{
                  '& .MuiPaginationItem-root': {
                    fontWeight: 500,
                  },
                }}
              />
            </Box>
          )}
        </>
        )}
      </Container>

      {/* Agent Negotiation Modal for Scouting */}
      {featureFlags.recruiterAgentArena && (
        <AgentNegotiationModal
          open={agentModalOpen}
          onClose={() => {
            setAgentModalOpen(false);
            setSelectedCandidateForAgent(null);
          }}
          onSuccess={handleAgentSuccess}
          initiatorType="recruiter"
          candidateData={selectedCandidateForAgent}
        />
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BrowseProfiles;
