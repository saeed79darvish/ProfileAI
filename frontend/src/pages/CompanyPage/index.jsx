import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box, Container, Typography, Avatar, Button, Alert, CircularProgress,
  Paper, Tabs, Tab, Chip, Grid, Card, CardContent, Divider, IconButton,
  List, ListItem, ListItemIcon, ListItemText, Tooltip
} from '@mui/material';
import {
  Business as BusinessIcon,
  People as PeopleIcon,
  Work as WorkIcon,
  Language as LanguageIcon,
  OpenInNew as OpenInNewIcon,
  Share as ShareIcon,
  Verified as VerifiedIcon,
  LocationOn as LocationIcon,
  Add as AddIcon,
  Send as SendIcon,
  MoreHoriz as MoreHorizIcon,
  LinkedIn as LinkedInIcon,
} from '@mui/icons-material';
import { jobAPI, recruiterProfileAPI, postAPI, resolveImageUrl } from '../../services/api';
import { ROUTES, JOB_COLORS, LIMITS, FALLBACKS, SIMILAR_COMPANIES, TABS, TEXT } from './constants';

function CompanyPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [followers, setFollowers] = useState(0);

  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch company profile by slug
        const { data: companyData } = await recruiterProfileAPI.getCompanyBySlug(slug);
        setCompany(companyData);
        
        // Mock followers count (can be replaced with real data)
        setFollowers(Math.floor(Math.random() * 500) + 10);
        
        // Fetch company's jobs using the company's userId
        if (companyData?.userId) {
          try {
            const { data: jobsData } = await jobAPI.getByCompany(companyData.userId);
            setJobs(jobsData?.jobs || []);
          } catch (jobErr) {
            console.log('No jobs found for this company');
            setJobs([]);
          }
          
          // Fetch company's posts
          try {
            const { data: postsData } = await postAPI.getByUser(companyData.userId);
            setPosts(postsData?.posts || []);
          } catch (postErr) {
            console.log('No posts found for this company');
            setPosts([]);
          }
        }
      } catch (err) {
        console.error('Error fetching company:', err);
        setError(err.response?.data?.error || 'Company not found');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchCompanyData();
    }
  }, [slug]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: company?.companyName,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Container>
    );
  }

  if (!company) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">Company not found</Alert>
      </Container>
    );
  }

  const tabPanels = {
    0: <HomeTab company={company} jobs={jobs} />,
    1: <AboutTab company={company} />,
    2: <PostsTab posts={posts} company={company} />,
    3: <JobsTab jobs={jobs} company={company} />,
    4: <PeopleTab company={company} />,
  };

  return (
    <Box sx={{ bgcolor: '#f4f2ee', minHeight: '100vh' }}>
      {/* Banner Section - LinkedIn Style */}
      <Box
        sx={{
          height: { xs: 150, md: 191 },
          bgcolor: company.companyBanner ? 'transparent' : '#312E81',
          background: company.companyBanner 
            ? `url(${company.companyBanner}) center/cover no-repeat`
            : 'linear-gradient(135deg, #312E81 0%, #4C1D95 100%)',
          position: 'relative',
        }}
      >
        {/* Company Name on Banner (LinkedIn style) */}
        <Box 
          sx={{ 
            position: 'absolute', 
            right: { xs: 16, md: 40 }, 
            top: '50%', 
            transform: 'translateY(-50%)',
            display: { xs: 'none', md: 'block' }
          }}
        >
          <Typography 
            variant="h3" 
            sx={{ 
              color: 'white', 
              fontWeight: 'bold',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              letterSpacing: 1,
            }}
          >
            {company.companyName}
          </Typography>
        </Box>
      </Box>

      {/* Company Header Card */}
      <Container maxWidth="lg" sx={{ mt: -8, position: 'relative', zIndex: 1 }}>
        <Paper 
          elevation={0} 
          sx={{ 
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            overflow: 'hidden',
            bgcolor: 'white',
          }}
        >
          <Box sx={{ p: 3, pb: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
              {/* Company Logo - LinkedIn Style with border */}
              <Box
                sx={{
                  mt: { xs: 0, md: -8 },
                  border: '4px solid white',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  bgcolor: 'white',
                  width: 'fit-content',
                }}
              >
                <Avatar
                  src={company.companyLogo}
                  alt={company.companyName}
                  variant="square"
                  sx={{
                    width: 104,
                    height: 104,
                    bgcolor: '#f3f2ef',
                  }}
                >
                  <BusinessIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                </Avatar>
              </Box>

              {/* Company Info */}
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="h5" component="h1" fontWeight="bold" sx={{ color: 'rgba(0,0,0,0.9)' }}>
                    {company.companyName}
                  </Typography>
                  {company.isVerified && (
                    <Tooltip title="Verified company">
                      <VerifiedIcon sx={{ color: '#0a66c2', fontSize: 20 }} />
                    </Tooltip>
                  )}
                </Box>

                {company.companyTagline && (
                  <Typography variant="body1" sx={{ mb: 1, color: 'rgba(0,0,0,0.9)' }}>
                    {company.companyTagline}
                  </Typography>
                )}

                {/* Industry, Location, Followers - as chips */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {company.industry && (
                    <Chip
                      icon={<BusinessIcon sx={{ fontSize: 16 }} />}
                      label={company.industry}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: '#e0e0e0', color: 'text.secondary' }}
                    />
                  )}
                  {company.location && (
                    <Chip
                      icon={<LocationIcon sx={{ fontSize: 16 }} />}
                      label={company.location}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: '#e0e0e0', color: 'text.secondary' }}
                    />
                  )}
                  <Typography variant="body2" color="text.secondary">
                    · {followers} followers
                  </Typography>
                </Box>

                {/* Action Buttons - LinkedIn Style */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    sx={{ 
                      borderRadius: '20px', 
                      textTransform: 'none',
                      bgcolor: '#0a66c2',
                      fontWeight: 600,
                      px: 2,
                      '&:hover': { bgcolor: '#004182' },
                    }}
                  >
                    Follow
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    onClick={() => navigate(`/messages`)}
                    sx={{ 
                      borderRadius: '20px', 
                      textTransform: 'none',
                      borderColor: '#0a66c2',
                      color: '#0a66c2',
                      fontWeight: 600,
                      px: 2,
                      '&:hover': { borderColor: '#004182', bgcolor: 'rgba(10,102,194,0.04)' },
                    }}
                  >
                    Message
                  </Button>
                  {company.companyWebsite && (
                    <Button
                      variant="outlined"
                      endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                      href={company.companyWebsite.startsWith('http') ? company.companyWebsite : `https://${company.companyWebsite}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ 
                        borderRadius: '20px', 
                        textTransform: 'none',
                        borderColor: 'rgba(0,0,0,0.6)',
                        color: 'rgba(0,0,0,0.6)',
                        fontWeight: 600,
                        px: 2,
                        '&:hover': { borderColor: 'rgba(0,0,0,0.9)', bgcolor: 'rgba(0,0,0,0.04)' },
                      }}
                    >
                      Visit website
                    </Button>
                  )}
                  <IconButton 
                    sx={{ 
                      border: '1px solid rgba(0,0,0,0.6)',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                    }}
                  >
                    <MoreHorizIcon />
                  </IconButton>
                </Box>
              </Box>

              {/* LinkedIn icon on right */}
              <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'flex-start' }}>
                {company.linkedinUrl && (
                  <IconButton
                    component="a"
                    href={company.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: '#0a66c2' }}
                  >
                    <LinkedInIcon sx={{ fontSize: 32 }} />
                  </IconButton>
                )}
              </Box>
            </Box>
          </Box>

          {/* Navigation Tabs - LinkedIn Style */}
          <Box sx={{ borderTop: '1px solid #e0e0e0' }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              sx={{ 
                px: 2,
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 400,
                  fontSize: '16px',
                  color: 'rgba(0,0,0,0.6)',
                  minHeight: 52,
                  '&.Mui-selected': {
                    color: '#057642',
                    fontWeight: 600,
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#057642',
                  height: 3,
                },
              }}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Home" />
              <Tab label="About" />
              <Tab label="Posts" />
              <Tab label="Jobs" />
              <Tab label="People" />
            </Tabs>
          </Box>
        </Paper>

        {/* Tab Content */}
        <Box sx={{ mt: 3, mb: 4 }}>
          {tabPanels[activeTab]}
        </Box>
      </Container>
    </Box>
  );
}

function HomeTab({ company, jobs }) {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Paper sx={{ p: 3, mb: 3, borderRadius: '8px', border: '1px solid #e0e0e0', bgcolor: 'white' }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ color: 'rgba(0,0,0,0.9)' }}>
            Overview
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>
            {company.companyDescription || company.bio || 'No description available.'}
          </Typography>
        </Paper>

        {/* Recent Jobs */}
        {jobs.length > 0 && (
          <Paper sx={{ p: 3, borderRadius: '8px', border: '1px solid #e0e0e0', bgcolor: 'white' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ color: 'rgba(0,0,0,0.9)' }}>
                Recent Job Openings
              </Typography>
              <Button 
                variant="text" 
                endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                sx={{ color: '#0a66c2', textTransform: 'none', fontWeight: 500 }}
              >
                View all jobs
              </Button>
            </Box>
            <List disablePadding>
              {jobs.slice(0, 5).map((job, index) => {
                const colorScheme = JOB_COLORS[index % JOB_COLORS.length];
                
                // Calculate days ago
                const daysAgo = Math.floor((new Date() - new Date(job.createdAt)) / (1000 * 60 * 60 * 24));
                const timeAgo = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1d ago' : `${daysAgo}d ago`;
                
                return (
                  <React.Fragment key={job.id}>
                    <ListItem 
                      component={Link}
                      to={`/jobs/${job.id}`}
                      sx={{ 
                        px: 0,
                        py: 1.5,
                        '&:hover': { bgcolor: 'action.hover' },
                        borderRadius: 1,
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <ListItemIcon>
                        <Avatar sx={{ bgcolor: colorScheme.bg }}>
                          <WorkIcon sx={{ color: colorScheme.color }} />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" fontWeight="600">
                            {job.title}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              <LocationIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                              {job.location} • {job.employmentType || job.jobType || 'Full-time'}
                            </Typography>
                            {job.salaryMin && job.salaryMax && (
                              <Typography variant="body2" sx={{ color: '#16a34a', fontWeight: 500 }}>
                                ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        Posted {timeAgo}
                      </Typography>
                    </ListItem>
                    {index < jobs.slice(0, 5).length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          </Paper>
        )}

        {/* Meet the Recruiters Section */}
        <Paper 
          sx={{ 
            p: 3, 
            mt: 3,
            borderRadius: '8px', 
            background: 'linear-gradient(135deg, #312E81 0%, #4C1D95 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background decoration */}
          <Box sx={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', opacity: 0.2 }}>
            <PeopleIcon sx={{ fontSize: 120 }} />
          </Box>
          
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Meet the Recruiters
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, maxWidth: '60%', opacity: 0.9 }}>
            Connect directly with the people who work at {company.companyName} to learn more about our culture.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {company.user && (
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1.5,
                  bgcolor: 'rgba(255,255,255,0.15)',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                }}
              >
                <Avatar 
                  src={company.profilePicture}
                  sx={{ width: 40, height: 40 }}
                >
                  {company.user.firstName?.[0]}{company.user.lastName?.[0]}
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {company.user.firstName} {company.user.lastName}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    {company.jobTitle || 'Recruiter'}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>

      {/* Sidebar */}
      <Grid item xs={12} md={4}>
        {/* Company Details */}
        <Paper sx={{ p: 3, borderRadius: '8px', border: '1px solid #e0e0e0', bgcolor: 'white', mb: 3 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ color: 'rgba(0,0,0,0.9)' }}>
            Company Details
          </Typography>
          <List disablePadding>
            {company.industry && (
              <ListItem sx={{ px: 0, py: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <BusinessIcon color="action" />
                </ListItemIcon>
                <ListItemText 
                  primary={<Typography variant="caption" color="text.secondary">INDUSTRY</Typography>}
                  secondary={<Typography variant="body1" fontWeight="500">{company.industry}</Typography>}
                />
              </ListItem>
            )}
            {company.location && (
              <ListItem sx={{ px: 0, py: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <LocationIcon sx={{ color: '#6366f1' }} />
                </ListItemIcon>
                <ListItemText 
                  primary={<Typography variant="caption" color="text.secondary">HEADQUARTERS</Typography>}
                  secondary={<Typography variant="body1" fontWeight="500">{company.location}</Typography>}
                />
              </ListItem>
            )}
            <ListItem sx={{ px: 0, py: 1 }}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <CalendarIcon color="action" />
              </ListItemIcon>
              <ListItemText 
                primary={<Typography variant="caption" color="text.secondary">FOUNDED</Typography>}
                secondary={
                  <Typography variant="body1" fontWeight="500">
                    {company.foundedYear || (company.user?.createdAt ? new Date(company.user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'December 2025')}
                  </Typography>
                }
              />
            </ListItem>
            {company.companyWebsite && (
              <ListItem sx={{ px: 0, py: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <LanguageIcon color="action" />
                </ListItemIcon>
                <ListItemText 
                  primary={<Typography variant="caption" color="text.secondary">WEBSITE</Typography>}
                  secondary={
                    <Typography 
                      component="a" 
                      href={company.companyWebsite.startsWith('http') ? company.companyWebsite : `https://${company.companyWebsite}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: '#0a66c2', textDecoration: 'none', fontWeight: 500 }}
                    >
                      {company.companyWebsite.replace(/^https?:\/\//, '')}
                    </Typography>
                  }
                />
              </ListItem>
            )}
          </List>

          {/* Tech Stack */}
          {company.techStack && company.techStack.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                TECH STACK
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {company.techStack.map((tech, idx) => (
                  <Chip 
                    key={idx}
                    label={tech} 
                    size="small" 
                    variant="outlined"
                    sx={{ borderColor: '#e0e0e0', fontSize: '0.75rem' }}
                  />
                ))}
              </Box>
            </Box>
          )}
          {/* Default tech stack if none provided */}
          {(!company.techStack || company.techStack.length === 0) && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                TECH STACK
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {['React', 'Node.js', 'Python', 'AWS'].map((tech, idx) => (
                  <Chip 
                    key={idx}
                    label={tech} 
                    size="small" 
                    variant="outlined"
                    sx={{ borderColor: '#e0e0e0', fontSize: '0.75rem' }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Similar Companies */}
        <Paper sx={{ p: 3, borderRadius: '8px', border: '1px solid #e0e0e0', bgcolor: 'white' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            SIMILAR COMPANIES
          </Typography>
          <List disablePadding>
            {[
              { name: 'TechFlow Inc.', initial: 'T', color: '#3b82f6' },
              { name: 'Global Hire', initial: 'G', color: '#22c55e' },
              { name: 'NextStep AI', initial: 'N', color: '#ef4444' },
            ].map((similarCompany, idx) => (
              <ListItem key={idx} sx={{ px: 0, py: 0.75 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Avatar sx={{ width: 28, height: 28, bgcolor: similarCompany.color, fontSize: '0.875rem' }}>
                    {similarCompany.initial}
                  </Avatar>
                </ListItemIcon>
                <ListItemText 
                  primary={<Typography variant="body2">{similarCompany.name}</Typography>}
                />
                <Button 
                  size="small" 
                  variant="outlined"
                  sx={{ 
                    textTransform: 'none', 
                    fontSize: '0.75rem',
                    py: 0.25,
                    px: 1.5,
                    borderColor: '#0a66c2',
                    color: '#0a66c2',
                    minWidth: 'auto',
                  }}
                >
                  Follow
                </Button>
              </ListItem>
            ))}
          </List>
        </Paper>
      </Grid>
    </Grid>
  );
}

// About Tab Component
function AboutTab({ company }) {
  return (
    <Paper sx={{ p: 3, borderRadius: '8px', border: '1px solid #e0e0e0', bgcolor: 'white' }}>
      <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ color: 'rgba(0,0,0,0.9)' }}>
        About {company.companyName}
      </Typography>
      
      {company.companyDescription && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
            {company.companyDescription}
          </Typography>
        </Box>
      )}

      {company.bio && company.bio !== company.companyDescription && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            About Our Recruiting Team
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
            {company.bio}
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      <Grid container spacing={3}>
        {company.companyWebsite && (
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LanguageIcon color="action" />
              <Box>
                <Typography variant="body2" color="text.secondary">Website</Typography>
                <Typography 
                  component="a" 
                  href={company.companyWebsite.startsWith('http') ? company.companyWebsite : `https://${company.companyWebsite}`}
                  target="_blank"
                  color="primary"
                >
                  {company.companyWebsite}
                </Typography>
              </Box>
            </Box>
          </Grid>
        )}
        {company.industry && (
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon color="action" />
              <Box>
                <Typography variant="body2" color="text.secondary">Industry</Typography>
                <Typography>{company.industry}</Typography>
              </Box>
            </Box>
          </Grid>
        )}
        {(company.employeeCount || company.companySize) && (
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon color="action" />
              <Box>
                <Typography variant="body2" color="text.secondary">Company size</Typography>
                <Typography>{company.employeeCount || company.companySize}</Typography>
              </Box>
            </Box>
          </Grid>
        )}
        {company.location && (
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationIcon color="action" />
              <Box>
                <Typography variant="body2" color="text.secondary">Location</Typography>
                <Typography>{company.location}</Typography>
              </Box>
            </Box>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
}

// Jobs Tab Component
function JobsTab({ jobs, company }) {
  const navigate = useNavigate();

  if (jobs.length === 0) {
    return (
      <Paper sx={{ p: 4, borderRadius: '8px', border: '1px solid #e0e0e0', textAlign: 'center', bgcolor: 'white' }}>
        <WorkIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          No job openings at the moment
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Check back later for new opportunities at {company.companyName}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ borderRadius: '8px', border: '1px solid #e0e0e0', overflow: 'hidden', bgcolor: 'white' }}>
      <Box sx={{ p: 2, bgcolor: '#f9fafb', borderBottom: '1px solid #e0e0e0' }}>
        <Typography variant="h6" fontWeight="bold" sx={{ color: 'rgba(0,0,0,0.9)' }}>
          {jobs.length} Job{jobs.length !== 1 ? 's' : ''} at {company.companyName}
        </Typography>
      </Box>
      <List disablePadding>
        {jobs.map((job, index) => (
          <React.Fragment key={job.id}>
            <ListItem
              component={Link}
              to={`/jobs/${job.id}`}
              sx={{
                py: 2,
                px: 3,
                '&:hover': { bgcolor: 'action.hover' },
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <ListItemIcon>
                <Avatar src={company.companyLogo} variant="rounded" sx={{ width: 48, height: 48 }}>
                  <BusinessIcon />
                </Avatar>
              </ListItemIcon>
              <ListItemText
                sx={{ ml: 1 }}
                primary={
                  <Typography variant="subtitle1" fontWeight="bold" color="primary">
                    {job.title}
                  </Typography>
                }
                secondary={
                  <Box>
                    <Typography variant="body2">{company.companyName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {job.location} • {job.jobType || 'Full-time'}
                      {job.remote && ' • Remote'}
                    </Typography>
                    {job.salaryMin && job.salaryMax && (
                      <Chip
                        size="small"
                        label={`$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`}
                        sx={{ mt: 0.5, bgcolor: 'success.light', color: 'success.dark' }}
                      />
                    )}
                  </Box>
                }
              />
              <Button variant="outlined" size="small" sx={{ borderRadius: 2, ml: 2 }}>
                Apply
              </Button>
            </ListItem>
            {index < jobs.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );
}

// People Tab Component
function PeopleTab({ company }) {
  return (
    <Paper sx={{ p: 4, borderRadius: '8px', border: '1px solid #e0e0e0', textAlign: 'center', bgcolor: 'white' }}>
      <PeopleIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Team Members
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Connect with people who work at {company.companyName}
      </Typography>
      
      {/* Recruiter Card */}
      {company.user && (
        <Card sx={{ maxWidth: 300, mx: 'auto', mt: 2, border: '1px solid #e0e0e0' }} elevation={0}>
          <CardContent>
            <Avatar
              src={company.profilePicture}
              sx={{ width: 64, height: 64, mx: 'auto', mb: 2 }}
            >
              {company.user.firstName?.[0]}{company.user.lastName?.[0]}
            </Avatar>
            <Typography variant="subtitle1" fontWeight="bold">
              {company.user.firstName} {company.user.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {company.jobTitle || 'Recruiter'}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Paper>
  );
}

// Posts Tab Component
function PostsTab({ posts, company }) {
  if (posts.length === 0) {
    return (
      <Paper sx={{ p: 4, borderRadius: '8px', border: '1px solid #e0e0e0', textAlign: 'center', bgcolor: 'white' }}>
        <ArticleIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          No posts yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {company.companyName} hasn't shared any updates yet
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {posts.map((post) => (
        <Paper 
          key={post.id} 
          sx={{ 
            p: 3, 
            borderRadius: '8px', 
            border: '1px solid #e0e0e0',
            bgcolor: 'white',
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Avatar src={company.companyLogo} variant="square" sx={{ width: 48, height: 48, borderRadius: 1 }}>
              <BusinessIcon />
            </Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">
                {company.companyName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(post.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Typography>
            </Box>
          </Box>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
            {post.content}
          </Typography>
          {post.imageUrl && (
            <Box 
              component="img" 
              src={post.imageUrl} 
              alt="Post image"
              sx={{ 
                width: '100%', 
                maxHeight: 400, 
                objectFit: 'cover', 
                borderRadius: 1,
              }} 
            />
          )}
        </Paper>
      ))}
    </Box>
  );
}

export default CompanyPage;
