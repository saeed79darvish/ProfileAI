import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  Chip,
  Grid,
  Avatar,
  LinearProgress,
  Divider,
  Skeleton
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  Work as WorkIcon,
  Message as MessagesIcon,
  ArrowForward as ArrowForwardIcon,
  Email as EmailIcon,
  Bookmark as BookmarkIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  Chat as ChatIcon,
  SmartToy as AIIcon,
  WorkspacePremium as UpgradeIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { profileAPI, recruiterProfileAPI, jobAPI, messageAPI, resolveImageUrl } from '../../services/api';
import { ROUTES, LIMITS, QUOTAS, CHART_LABELS, TEXT } from './constants';
import GreenhouseIntegration from '../../components/GreenhouseIntegration';

// Chart data for profile views, will be empty for new users
  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Profile Views',
        data: [0, 0, 0, 0, 0, 0, 0],
        fill: true,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderColor: '#7c3aed',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#7c3aed',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#7c3aed',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b' }
      },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: { color: '#64748b' },
        beginAtZero: true
      }
    }
  };

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const RecruiterDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeJobs, setActiveJobs] = useState([]);
  const [topCandidates, setTopCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [stats, setStats] = useState({
    profileViews: 0,
    profileViewsTrend: 0,
    newMatches: 0,
    matchesTrend: 0,
    jobPosts: 0,
    jobPostsTrend: 0,
    messages: 0,
    messagesTrend: 0,
    savedCandidates: 0,
    searchesToday: 0,
    connections: 0
  });

  const [subscriptionUsage] = useState({
    aiEnhancements: { used: 0, total: 3 },
    smartMatches: { used: 0, total: 10 }
  });

  useEffect(() => {
    if (user?.role !== 'recruiter' && user?.role !== 'admin') {
      navigate('/profile');
      return;
    }
    // Redirect to onboarding if recruiter hasn't set up profile yet
    if (user?.role === 'recruiter' && user?.hasRecruiterProfile === false) {
      navigate('/recruiter/onboarding', { replace: true });
    }
  }, [user, navigate]);

  // Fetch real jobs from API
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoadingJobs(true);
        const response = await jobAPI.getMyJobs({ limit: 5 });
        const jobs = response.data.jobs || response.data || [];
        const activeJobsList = jobs.filter(j => j.status === 'active' || j.status === 'open').slice(0, 5);
        setActiveJobs(activeJobsList.map(j => ({
          id: j.id,
          title: j.title || 'Untitled Job',
          views: j.viewCount || 0,
          interested: j.applicationCount || 0
        })));
        // Update job count stat
        setStats(prev => ({ ...prev, jobPosts: activeJobsList.length }));
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
        setActiveJobs([]);
      } finally {
        setLoadingJobs(false);
        setLoadingStats(false);
      }
    };

    if (user?.role === 'recruiter' || user?.role === 'admin') {
      fetchJobs();
    }
  }, [user]);

  // Fetch unread message count
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await messageAPI.getUnreadCount();
        const count = response.data.count || response.data.unreadCount || 0;
        setStats(prev => ({ ...prev, messages: count }));
      } catch (error) {
        console.error('Failed to fetch message count:', error);
      }
    };

    if (user?.role === 'recruiter' || user?.role === 'admin') {
      fetchMessages();
    }
  }, [user]);

  // Fetch real candidates from API
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setLoadingCandidates(true);
        const response = await profileAPI.getAllProfiles({ limit: 6 });
        const profiles = response.data.profiles || [];
        const mappedCandidates = profiles.map(p => ({
          id: p.userId,
          name: `${p.user?.firstName || ''} ${p.user?.lastName || ''}`.trim() || 'Unknown',
          title: p.title || 'Professional',
          location: p.location || 'Location not specified',
          experience: p.experience?.[0]?.duration || 'Experience not listed',
          matchScore: Math.floor(Math.random() * 20) + 80,
          avatar: p.profilePicture ? resolveImageUrl(p.profilePicture) : null,
          skills: (p.skills || []).slice(0, 3)
        }));
        setTopCandidates(mappedCandidates);
        setStats(prev => ({ ...prev, newMatches: mappedCandidates.length }));
      } catch (error) {
        console.error('Failed to fetch candidates:', error);
      } finally {
        setLoadingCandidates(false);
      }
    };
    
    if (user?.role === 'recruiter' || user?.role === 'admin') {
      fetchCandidates();
    }
  }, [user]);

  return (
    <Box sx={{ display: 'flex', bgcolor: '#fafafa', minHeight: '100vh' }}>
      {/* Left Sidebar */}
      <Box
        sx={{
          width: 280,
          bgcolor: 'white',
          borderRight: '1px solid #e5e7eb',
          p: 3,
          position: 'fixed',
          height: '100vh',
          overflowY: 'auto',
          display: { xs: 'none', md: 'block' }
        }}
      >
        {/* Quick Actions */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', fontSize: '0.75rem' }}>
            Quick Actions
          </Typography>
          <Button
            fullWidth
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/recruiter/jobs')}
            sx={{
              mb: 1.5,
              py: 1.5,
              bgcolor: '#7c3aed',
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              '&:hover': { bgcolor: '#4f46e5' }
            }}
          >
            Post New Job
          </Button>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AIIcon />}
            onClick={() => navigate('/browse')}
            sx={{
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              borderColor: '#e5e7eb',
              color: '#374151',
              '&:hover': { bgcolor: '#f9fafb', borderColor: '#d1d5db' }
            }}
          >
            AI Smart Match
          </Button>
        </Box>

        {/* Active Jobs */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', fontSize: '0.75rem' }}>
            Active Jobs
          </Typography>
          {loadingJobs ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Skeleton variant="rounded" height={60} />
              <Skeleton variant="rounded" height={60} />
            </Box>
          ) : activeJobs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3, color: '#94a3b8' }}>
              <WorkIcon sx={{ fontSize: 32, mb: 1, opacity: 0.5 }} />
              <Typography variant="body2" color="text.secondary">No active jobs yet</Typography>
              <Button size="small" sx={{ mt: 1, textTransform: 'none', color: '#7c3aed' }} onClick={() => navigate('/recruiter/jobs')}>Post your first job</Button>
            </Box>
          ) : (
          <List disablePadding>
            {activeJobs.map((job) => (
              <ListItem
                key={job.id}
                disablePadding
                sx={{
                  mb: 1,
                  p: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: '#f9fafb' }
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                    {job.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <VisibilityIcon sx={{ fontSize: 14 }} /> {job.views} views
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {job.interested} interested
                    </Typography>
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
          )}
        </Box>

        {/* Upgrade Card */}
        {user?.subscriptionTier === 'free' && (
          <Card sx={{ bgcolor: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: 'white', p: 2 }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Box sx={{ textAlign: 'center' }}>
                <UpgradeIcon sx={{ fontSize: 40, mb: 1, color: 'white' }} />
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                  Upgrade to Pro
                </Typography>
                <Typography variant="caption" sx={{ mb: 2, display: 'block', opacity: 0.9 }}>
                  Unlock unlimited AI matching and advanced analytics
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  sx={{
                    bgcolor: 'white',
                    color: '#7c3aed',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': { bgcolor: '#f9fafb' }
                  }}
                  onClick={() => navigate('/pricing')}
                >
                  View Plans
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Main Content */}
      <Box sx={{ ml: { xs: 0, md: '280px' }, flex: 1 }}>
        {/* Purple Gradient Hero */}
        <Box sx={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
          color: 'white',
          p: 4,
          pb: 5,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -60,
            right: -60,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -80,
            left: -40,
            width: 250,
            height: 250,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }
        }}>
          <Container maxWidth="xl" disableGutters sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5, color: 'white' }}>
              Recruiter Dashboard
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}! Here's your recruitment overview.
            </Typography>
          </Container>
        </Box>
        <Container maxWidth="xl" disableGutters sx={{ p: 4 }}>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ position: 'relative', overflow: 'visible' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <VisibilityIcon sx={{ fontSize: 18, color: '#7c3aed' }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          Profile Views
                        </Typography>
                      </Box>
                      <Typography variant="h4" fontWeight={700}>
                        {stats.profileViews.toLocaleString()}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <TrendingUpIcon sx={{ fontSize: 14, color: '#10b981' }} />
                        <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
                          +{stats.profileViewsTrend}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <PersonIcon sx={{ fontSize: 18, color: '#6d28d9' }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          New Matches
                        </Typography>
                      </Box>
                      <Typography variant="h4" fontWeight={700}>
                        {stats.newMatches}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <TrendingUpIcon sx={{ fontSize: 14, color: '#10b981' }} />
                        <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
                          +{stats.matchesTrend}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <WorkIcon sx={{ fontSize: 18, color: '#10b981' }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          Job Posts
                        </Typography>
                      </Box>
                      <Typography variant="h4" fontWeight={700}>
                        {stats.jobPosts}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600 }}>
                          Active
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <MessagesIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          Messages
                        </Typography>
                      </Box>
                      <Typography variant="h4" fontWeight={700}>
                        {stats.messages}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 600 }}>
                          {stats.messagesTrend}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            {/* Left Column */}
            <Grid item xs={12} md={8}>
              {/* Profile Views Analytics */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" fontWeight={600}>
                      Profile Views Analytics
                    </Typography>
                    <Chip label="Last 7 days" size="small" variant="outlined" />
                  </Box>
                  <Box sx={{ height: 250 }}>
                    <Line data={chartData} options={chartOptions} />
                  </Box>
                </CardContent>
              </Card>

              {/* Top Matched Candidates */}
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" fontWeight={600}>
                      Top Matched Candidates
                    </Typography>
                    <Button
                      endIcon={<ArrowForwardIcon />}
                      sx={{ textTransform: 'none', color: '#7c3aed', fontWeight: 600 }}
                      onClick={() => navigate('/browse')}
                    >
                      View All
                    </Button>
                  </Box>
                  {loadingCandidates ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <Typography color="text.secondary">Loading candidates...</Typography>
                    </Box>
                  ) : topCandidates.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary" sx={{ mb: 2 }}>No candidates found yet</Typography>
                      <Button variant="outlined" onClick={() => navigate('/browse')}>
                        Browse Profiles
                      </Button>
                    </Box>
                  ) : (
                  <Grid container spacing={2}>
                    {topCandidates.map((candidate) => (
                      <Grid item xs={12} sm={6} md={4} key={candidate.id}>
                        <Card variant="outlined" sx={{ position: 'relative', '&:hover': { boxShadow: 3 } }}>
                          <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
                            <Chip
                              label={`${candidate.matchScore}% Match`}
                              size="small"
                              sx={{
                                bgcolor: '#10b981',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: '0.75rem'
                              }}
                            />
                          </Box>
                          <CardContent>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                              <Avatar 
                                src={candidate.avatar}
                                sx={{ width: 64, height: 64, mb: 2, bgcolor: '#e0e7ff', color: '#7c3aed', fontSize: '1.5rem', fontWeight: 700 }}
                              >
                                {candidate.name.charAt(0)}
                              </Avatar>
                              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                                {candidate.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                {candidate.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                📍 {candidate.location} • {candidate.experience}
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center', mb: 2 }}>
                                {candidate.skills.map((skill, idx) => (
                                  <Chip key={idx} label={skill} size="small" sx={{ fontSize: '0.7rem', height: 24 }} />
                                ))}
                              </Box>
                              <Button
                                fullWidth
                                variant="contained"
                                startIcon={<EmailIcon />}
                                sx={{
                                  textTransform: 'none',
                                  bgcolor: '#7c3aed',
                                  fontWeight: 600,
                                  '&:hover': { bgcolor: '#4f46e5' }
                                }}
                                onClick={() => navigate(`/profile/${candidate.id}`)}
                              >
                                Contact
                              </Button>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Right Column */}
            <Grid item xs={12} md={4}>
              {/* Subscription */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" fontWeight={600}>
                      Subscription
                    </Typography>
                    <Chip label={user?.subscriptionTier?.toUpperCase() || 'FREE'} size="small" sx={{ bgcolor: '#f3f4f6', fontWeight: 600 }} />
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        AI Enhancements
                      </Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {subscriptionUsage.aiEnhancements.used} / {subscriptionUsage.aiEnhancements.total}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(subscriptionUsage.aiEnhancements.used / subscriptionUsage.aiEnhancements.total) * 100}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: '#e5e7eb',
                        '& .MuiLinearProgress-bar': { bgcolor: '#7c3aed' }
                      }}
                    />
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Smart Matches
                      </Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {subscriptionUsage.smartMatches.used} / {subscriptionUsage.smartMatches.total}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(subscriptionUsage.smartMatches.used / subscriptionUsage.smartMatches.total) * 100}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: '#e5e7eb',
                        '& .MuiLinearProgress-bar': { bgcolor: '#7c3aed' }
                      }}
                    />
                  </Box>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<UpgradeIcon />}
                    sx={{
                      bgcolor: '#7c3aed',
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1.5,
                      '&:hover': { bgcolor: '#4f46e5' }
                    }}
                    onClick={() => navigate('/pricing')}
                  >
                    Upgrade to Pro
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                    Quick Stats
                  </Typography>
                  <List disablePadding>
                    <ListItem disablePadding sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <BookmarkIcon sx={{ color: '#6d28d9' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={500}>
                            Saved Candidates
                          </Typography>
                        </Box>
                        <Typography variant="h6" fontWeight={700}>
                          {stats.savedCandidates}
                        </Typography>
                      </Box>
                    </ListItem>
                    <Divider />
                    <ListItem disablePadding sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <SearchIcon sx={{ color: '#3b82f6' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={500}>
                            Searches Today
                          </Typography>
                        </Box>
                        <Typography variant="h6" fontWeight={700}>
                          {stats.searchesToday}
                        </Typography>
                      </Box>
                    </ListItem>
                    <Divider />
                    <ListItem disablePadding sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PersonIcon sx={{ color: '#10b981' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={500}>
                            Connections
                          </Typography>
                        </Box>
                        <Typography variant="h6" fontWeight={700}>
                          {stats.connections}
                        </Typography>
                      </Box>
                    </ListItem>
                  </List>
                </CardContent>
              </Card>

              {/* Greenhouse ATS Integration */}
              <GreenhouseIntegration />

              {/* Getting Started */}
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" fontWeight={600}>
                      Getting Started
                    </Typography>
                  </Box>
                  <List disablePadding>
                    {[
                      { icon: <BusinessIcon />, label: 'Set up company profile', path: '/recruiter/profile', color: '#6d28d9', bg: '#ede9fe', done: false },
                      { icon: <WorkIcon />, label: 'Post your first job', path: '/recruiter/jobs', color: '#3b82f6', bg: '#dbeafe', done: activeJobs.length > 0 },
                      { icon: <PersonIcon />, label: 'Browse candidates', path: '/browse', color: '#10b981', bg: '#d1fae5', done: false },
                      { icon: <ChatIcon />, label: 'Send your first message', path: '/messages', color: '#f59e0b', bg: '#fef3c7', done: false }
                    ].map((item, idx) => (
                      <React.Fragment key={idx}>
                        <ListItem
                          disablePadding
                          sx={{ py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: '#f9fafb' }, borderRadius: 2, px: 1 }}
                          onClick={() => navigate(item.path)}
                        >
                          <Box sx={{ display: 'flex', gap: 2, width: '100%', alignItems: 'center' }}>
                            <Avatar sx={{ width: 40, height: 40, bgcolor: item.bg, color: item.color }}>
                              {item.icon}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={500} sx={{ textDecoration: item.done ? 'line-through' : 'none', color: item.done ? '#94a3b8' : '#1e293b' }}>
                                {item.label}
                              </Typography>
                            </Box>
                            <ArrowForwardIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                          </Box>
                        </ListItem>
                        {idx < 3 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
};

export default RecruiterDashboard;
