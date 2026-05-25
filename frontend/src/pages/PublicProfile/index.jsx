import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  Button,
  IconButton,
  Avatar,
  Container,
  Grid,
  LinearProgress,
  CircularProgress,
  Divider,
  Alert,
  Snackbar,
  Fab,
  Fade,
  Zoom,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ChatIcon from '@mui/icons-material/Chat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import EmailIcon from '@mui/icons-material/Email';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import ShareIcon from '@mui/icons-material/Share';
import TwitterIcon from '@mui/icons-material/Twitter';
import LanguageIcon from '@mui/icons-material/Language';
import WorkIcon from '@mui/icons-material/Work';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BoltIcon from '@mui/icons-material/Bolt';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import CodeIcon from '@mui/icons-material/Code';
import FolderIcon from '@mui/icons-material/Folder';
import StarIcon from '@mui/icons-material/Star';
import { profileAPI, postAPI, followAPI, messageAPI, resolveImageUrl } from '@/services/api';
import { formatDateRange } from '@/utils/dateRange';
import { useAuth } from '@/contexts/AuthContext';
import FollowButton from '@/components/FollowButton';
import { ROUTES, LIMITS, DEFAULTS, ANIMATION } from './constants';

// Icon aliases for consistency
const BackIcon = ArrowBackIcon;
const CalendarIcon = CalendarTodayIcon;
const CopyIcon = ContentCopyIcon;
const LocationIcon = LocationOnIcon;
const WebsiteIcon = LanguageIcon;
const AchievementIcon = EmojiEventsIcon;
const AIIcon = AutoAwesomeIcon;
const CertIcon = CardMembershipIcon;

// Always show sidebar on public profile page (matching design mockup)
const showRecruiterSidebar = true;

// Animated Background Component

const AnimatedBackground = () => (
  <Box
    sx={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
      zIndex: 0,
      '&::before': {
        content: '""',
        position: 'absolute',
        width: '200%',
        height: '200%',
        top: '-50%',
        left: '-50%',
        background: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.2) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 200, 255, 0.2) 0%, transparent 40%)
        `,
        animation: 'rotate 30s linear infinite',
      },
      '@keyframes rotate': {
        '0%': { transform: 'rotate(0deg)' },
        '100%': { transform: 'rotate(360deg)' },
      },
    }}
  />
);

// Section Header Component
const SectionHeader = ({ icon: Icon, title, color = '#667eea' }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: 2,
        bgcolor: alpha(color, 0.15),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon sx={{ color: color, fontSize: 24 }} />
    </Box>
    <Typography variant="h5" fontWeight={600}>
      {title}
    </Typography>
  </Box>
);

// Skill Progress Bar Component
const SkillBar = ({ skill, index, percentage }) => {
  const [progress, setProgress] = useState(0);
  // Use provided percentage or default to 85 (instead of random)
  const level = percentage || 85;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(level);
    }, index * 100);
    return () => clearTimeout(timer);
  }, [level, index]);

  return (
    <Fade in timeout={500 + index * 100}>
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" fontWeight={500}>{skill}</Typography>
          <Typography variant="body2" sx={{ color: '#667eea', fontWeight: 600 }}>{level}%</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'rgba(0,0,0,0.06)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: `linear-gradient(90deg, #667eea 0%, #a855f7 100%)`,
            },
          }}
        />
      </Box>
    </Fade>
  );
};

// Project Card Component - matching screenshot style
const ProjectCard = ({ project, index }) => {
  const isValidUrl = (s) => {
    if (!s || typeof s !== 'string') return false;
    try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
  };
  const liveUrl = isValidUrl(project.url) ? project.url : '';
  const repoUrl = isValidUrl(project.githubUrl) ? project.githubUrl : '';
  const role = (project.role || '').trim();
  const isPresent = /^(present|current)$/i.test(String(project.endDate || '').trim());
  const dateRange = (project.startDate || project.endDate)
    ? `${project.startDate || ''}${project.startDate && (project.endDate || isPresent) ? ' – ' : ''}${isPresent ? 'Present' : (project.endDate || '')}`.trim()
    : '';
  const techs = Array.isArray(project.technologies)
    ? project.technologies.filter(Boolean)
    : (typeof project.technologies === 'string'
        ? project.technologies.split(',').map(t => t.trim()).filter(Boolean)
        : []);
  const handleCardClick = () => {
    const url = liveUrl || repoUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Zoom in timeout={300 + index * 150}>
      <Card
        onClick={handleCardClick}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          cursor: liveUrl || repoUrl ? 'pointer' : 'default',
          transition: 'all 0.3s ease',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
          },
        }}
      >
        {/* Project Image */}
        <Box
          sx={{
            height: 160,
            background: project.imageUrl
              ? `url(${resolveImageUrl(project.imageUrl)}) center/cover`
              : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {!project.imageUrl && (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: '#9ca3af'
            }}>
              <WorkIcon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="caption">No preview</Typography>
            </Box>
          )}
        </Box>

        <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom noWrap>
            {project.title || project.company}
          </Typography>

          {(role || dateRange) && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1, color: 'text.secondary' }}>
              {role && (
                <Typography variant="caption" sx={{ fontWeight: 500 }}>{role}</Typography>
              )}
              {role && dateRange && (
                <Box component="span" sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.secondary', opacity: 0.5 }} />
              )}
              {dateRange && (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarTodayIcon sx={{ fontSize: 12 }} />
                  <Typography variant="caption">{dateRange}</Typography>
                </Box>
              )}
            </Box>
          )}

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 2,
              minHeight: 40,
              fontSize: '0.875rem',
            }}
          >
            {project.description}
          </Typography>

          {/* Tags */}
          {techs.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: (liveUrl || repoUrl) ? 1.5 : 0 }}>
              {techs.slice(0, 3).map((tech, idx) => (
                <Chip
                  key={idx}
                  label={tech}
                  size="small"
                  sx={{
                    bgcolor: idx % 2 === 0 ? alpha('#10b981', 0.1) : alpha('#a855f7', 0.1),
                    color: idx % 2 === 0 ? '#059669' : '#9333ea',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    height: 24,
                  }}
                />
              ))}
            </Box>
          )}

          {/* Links */}
          {(liveUrl || repoUrl) && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 'auto' }}>
              {liveUrl && (
                <Tooltip title={liveUrl}>
                  <IconButton
                    component="a"
                    href={liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    size="small"
                    aria-label="Open live demo"
                    sx={{
                      color: '#667eea',
                      bgcolor: alpha('#667eea', 0.08),
                      '&:hover': { bgcolor: alpha('#667eea', 0.16) },
                    }}
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {repoUrl && (
                <Tooltip title={repoUrl}>
                  <IconButton
                    component="a"
                    href={repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    size="small"
                    aria-label="Open GitHub repository"
                    sx={{
                      color: '#1f2937',
                      bgcolor: alpha('#1f2937', 0.06),
                      '&:hover': { bgcolor: alpha('#1f2937', 0.12) },
                    }}
                  >
                    <GitHubIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Zoom>
  );
};

// Education Item Component - matching screenshot style
const EducationItem = ({ edu, idx }) => (
  <Fade in timeout={500 + idx * 200}>
    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          bgcolor: alpha('#3b82f6', 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <SchoolIcon sx={{ color: '#3b82f6', fontSize: 24 }} />
      </Box>
      <Box>
        <Typography variant="subtitle1" fontWeight={600}>
          {edu.degree}
          {(edu.fieldOfStudy || edu.field || edu.major) && !String(edu.degree || '').toLowerCase().includes(String(edu.fieldOfStudy || edu.field || edu.major).toLowerCase())
            ? `, ${edu.fieldOfStudy || edu.field || edu.major}`
            : ''}
        </Typography>
        <Typography variant="body2" sx={{ color: '#667eea', fontWeight: 500 }}>
          {edu.institution}{edu.location ? ` • ${edu.location}` : ''}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {(formatDateRange(edu.startDate, edu.endDate) || edu.year || '')}{edu.gpa ? ` • GPA: ${edu.gpa}` : ''}{edu.honors ? ` • ${edu.honors}` : ''}
        </Typography>
        {edu.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {edu.description}
          </Typography>
        )}
      </Box>
    </Box>
  </Fade>
);

// Stats Item Component
const StatItem = ({ value, label, color = '#667eea' }) => (
  <Box sx={{ textAlign: 'center', px: 3 }}>
    <Typography 
      variant="h4" 
      fontWeight={700} 
      sx={{ color }}
    >
      {value}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
  </Box>
);

// Recruiter CTA Sidebar Component - Compact design
const RecruiterCTASidebar = ({ fullName, navigate, currentUser, profileId }) => {
  const isLoggedInRecruiter = currentUser?.role === 'recruiter';
  
  return (
    <Card
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.25)',
        position: { xs: 'static', md: 'sticky' },
        top: { md: 100 },
      }}
    >
      {/* Purple gradient header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #ec4899 100%)',
          p: 2.5,
          textAlign: 'center',
        }}
      >
        <Typography variant="h6" fontWeight={700} sx={{ color: 'white', mb: 0.5, fontSize: '1rem' }}>
          {isLoggedInRecruiter ? 'Take Action on' : 'Interested in hiring'}
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ color: 'white', fontSize: '1.25rem' }}>
          {fullName?.split(' ')[0]}?
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', mt: 0.5, display: 'block' }}>
          {isLoggedInRecruiter 
            ? 'Connect with this candidate now'
            : 'Join ProfilleAI to unlock powerful recruiting tools'}
        </Typography>
      </Box>
      
      <CardContent sx={{ p: 0 }}>
        {isLoggedInRecruiter ? (
          /* Logged-in Recruiter Actions */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2.5, background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #ec4899 100%)' }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<ChatIcon />}
              onClick={() => navigate(`/messages?userId=${profileId}`)}
              sx={{
                borderRadius: 2,
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: 'white',
                color: '#8b5cf6',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
              }}
            >
              Send Message
            </Button>
            
            <Button
              fullWidth
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => window.open(`/api/resume/download/${profileId}`, '_blank')}
              sx={{
                borderRadius: 2,
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                borderColor: 'rgba(255,255,255,0.5)',
                color: 'white',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              Download Resume
            </Button>
            
            <Button
              fullWidth
              variant="outlined"
              startIcon={<CalendarIcon />}
              onClick={() => navigate(`/recruiter/schedule-interview?candidateId=${profileId}`)}
              sx={{
                borderRadius: 2,
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                borderColor: 'rgba(255,255,255,0.5)',
                color: 'white',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              Schedule Interview
            </Button>
          </Box>
        ) : (
          /* Visitor - Recruiter features coming soon */
          <>
            {/* Feature list on white background with separators */}
            <Box sx={{ bgcolor: 'white' }}>
              {[
                { icon: AIIcon, title: 'AI-Powered Screening', subtitle: 'Auto-match & rank candidates' },
                { icon: BoltIcon, title: 'AI Phone Screening', subtitle: 'Automated voice interviews' },
                { icon: CalendarIcon, title: 'Smart Scheduling', subtitle: 'Auto-book interviews' },
              ].map((feature, idx, arr) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2.5,
                    py: 1.5,
                    borderBottom: idx < arr.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: '#f3f0ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <feature.icon sx={{ color: '#8b5cf6', fontSize: 18 }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ color: '#1a1a2e', fontSize: '0.85rem' }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block', lineHeight: 1.3 }}>
                      {feature.subtitle}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
            
            {/* Coming Soon Banner */}
            <Box
              sx={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #ec4899 100%)',
                textAlign: 'center',
                py: 2,
                px: 2.5,
              }}
            >
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                Coming Soon
              </Typography>
              <Typography variant="body2" sx={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>
                Recruiter Tools
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.65rem', display: 'block' }}>
                AI-powered recruiting features launching soon
              </Typography>
            </Box>
            
            {/* Trust badges */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, py: 1.5, bgcolor: 'white' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleIcon sx={{ color: '#10b981', fontSize: 14 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  No credit card
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ color: '#667eea', fontSize: 14 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                  2 min setup
                </Typography>
              </Box>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Quick Highlight Card
const QuickHighlightCard = ({ icon: Icon, title, subtitle, color }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      p: 2,
      borderRadius: 2,
      bgcolor: 'white',
      border: '1px solid',
      borderColor: 'divider',
    }}
  >
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: 1.5,
        bgcolor: alpha(color, 0.15),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon sx={{ color, fontSize: 20 }} />
    </Box>
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
        {title}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {subtitle}
      </Typography>
    </Box>
  </Box>
);

const PublicProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [followCounts, setFollowCounts] = useState({ followersCount: 0, followingCount: 0 });
  const [userPosts, setUserPosts] = useState([]);
  const [userSessions, setUserSessions] = useState([]);
  const [showCopiedSnackbar, setShowCopiedSnackbar] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  
  const headerRef = useRef(null);

  // Get the shareable profile URL
  const profileUrl = `${window.location.origin}/profile/${id}`;
  
  // Copy profile URL to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setShowCopiedSnackbar(true);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  // Share profile
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.user?.firstName || 'Profile'}'s Portfolio`,
          text: `Check out this amazing profile on ProfilleAI!`,
          url: profileUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // Handle scroll for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyHeader(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await profileAPI.getPublicProfile(id);
        setProfile(response.data);
        
        const userId = response.data.userId || response.data.user?.id;
        
        try {
          const countsResponse = await followAPI.getCounts(id);
          setFollowCounts(countsResponse.data);
        } catch (e) {
          console.log('Could not fetch follow counts:', e);
        }
        
        if (userId) {
          try {
            const postsResponse = await postAPI.getByUser(userId, { limit: 10 });
            setUserPosts(postsResponse.data.posts || postsResponse.data || []);
          } catch (e) {
            console.log('Could not fetch user posts:', e);
          }
          
          try {
            console.log('Could not fetch user sessions (disabled)');
          } catch (e) {
            console.log('Could not fetch user sessions:', e);
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProfile();
    }
  }, [id]);
  
  const handleFollowChange = (isFollowing, counts) => {
    if (counts) {
      setFollowCounts(counts);
    }
  };

  if (loading) {
    return (
      <Box 
        display="flex" 
        flexDirection="column"
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <CircularProgress sx={{ color: 'white', mb: 2 }} size={60} />
        <Typography variant="h6" sx={{ color: 'white', opacity: 0.9 }}>
          Loading Portfolio...
        </Typography>
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        }}
      >
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: 4, maxWidth: 400 }}>
          <Typography variant="h5" color="error" gutterBottom>
            {error || 'Profile not found'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            The profile you're looking for doesn't exist or has been removed.
          </Typography>
          <Button 
            variant="contained"
            startIcon={<BackIcon />}
            onClick={() => navigate('/browse')}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 2,
            }}
          >
            Back to Browse
          </Button>
        </Card>
      </Box>
    );
  }

  // Map backend profile data
  const user = profile.user || {};
  const fullName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : profile.title || 'User';
  const email = user.email || '';
  const location = profile.location || '';
  const title = profile.title || '';
  const bio = profile.summary || profile.aiSummary || '';
  const headline = profile.headline || profile.title || '';
  
  // Skills can be stored either as a flat array or as a categorized object
  // ({ core: [], technical: [], software: [], tools: [], soft: [] }). Flatten
  // for counts/top-skill and preserve the grouped form for the Skills section.
  const SKILL_CATEGORY_LABELS = {
    core: 'Core',
    technical: 'Technical',
    software: 'Software & Tools',
    tools: 'Tools',
    soft: 'Soft Skills',
  };
  const SKILL_CATEGORY_COLORS = {
    core: '#667eea',
    technical: '#a855f7',
    software: '#06b6d4',
    tools: '#0ea5e9',
    soft: '#10b981',
  };
  const skillsByCategory = (() => {
    const raw = profile.skills;
    if (!raw) return {};
    if (Array.isArray(raw)) return raw.length ? { technical: raw.filter(Boolean) } : {};
    if (typeof raw === 'object') {
      const out = {};
      for (const [key, list] of Object.entries(raw)) {
        if (Array.isArray(list) && list.length) out[key] = list.filter(Boolean);
      }
      return out;
    }
    return {};
  })();
  const skills = Object.values(skillsByCategory).flat();
  
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const education = Array.isArray(profile.education) ? profile.education : [];
  const projects = Array.isArray(profile.projects) ? profile.projects : [];
  const achievements = profile.aiStrengths || [];
  const aiScore = profile.aiKeywords?.length > 0 ? Math.min(95, 60 + profile.aiKeywords.length * 5) : null;
  const profileImage = resolveImageUrl(profile.profilePicture) || '';
  const coverImage = resolveImageUrl(profile.coverImage) || '';
  
  // Helper to ensure URLs have proper protocol
  const ensureHttps = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
  };
  
  const certifications = Array.isArray(profile.certifications) ? profile.certifications : [];
  const languages = Array.isArray(profile.languages) ? profile.languages : [];
  const rawAvailability = profile.availabilityStatus || 'Open to Work';
  const availability = rawAvailability.toLowerCase() === 'open' ? 'Open to Work' : rawAvailability;
  const portfolioUrl = ensureHttps(profile.portfolioUrl);
  const socialLinks = {
    linkedin: ensureHttps(profile.linkedinUrl),
    github: ensureHttps(profile.githubUrl),
    twitter: ensureHttps(profile.twitterUrl),
    website: ensureHttps(profile.websiteUrl),
  };

  // Sum (endDate − startDate) per role; treat "Present"/missing endDate as today.
  // Output: integer years and a flag for any currently-active role (renders "+").
  const { yearsOfExperience, hasOngoingRole } = (() => {
    const parseDate = (val) => {
      if (!val) return null;
      const s = String(val).trim();
      if (!s) return null;
      if (/^(present|current)$/i.test(s)) return new Date();
      // Year-only like "2018"
      if (/^\d{4}$/.test(s)) return new Date(parseInt(s, 10), 0, 1);
      // YYYY-MM, YYYY/MM, YYYY-MM-DD, etc.
      const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
      if (isoMatch) {
        const [, y, m, d] = isoMatch;
        return new Date(parseInt(y, 10), parseInt(m, 10) - 1, d ? parseInt(d, 10) : 1);
      }
      const parsed = new Date(s);
      return isNaN(parsed.getTime()) ? null : parsed;
    };
    const today = new Date();
    let totalMs = 0;
    let ongoing = false;
    for (const exp of experience) {
      const start = parseDate(exp.startDate);
      const isPresent = !exp.endDate || /^(present|current)$/i.test(String(exp.endDate).trim()) || exp.current === true;
      const end = isPresent ? today : parseDate(exp.endDate);
      if (isPresent) ongoing = true;
      if (start && end && end >= start) {
        totalMs += end.getTime() - start.getTime();
      }
    }
    const years = totalMs > 0 ? Math.floor(totalMs / (365.25 * 24 * 60 * 60 * 1000)) : 0;
    return { yearsOfExperience: years, hasOngoingRole: ongoing };
  })();
  const yearsLabel = `${yearsOfExperience}${hasOngoingRole ? '+' : ''}`;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: { xs: '80px', md: 0 } }}>
      {/* Sticky Header - shows on scroll */}
      <Fade in={showStickyHeader}>
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bgcolor: 'white',
            borderBottom: '1px solid',
            borderColor: 'divider',
            zIndex: 1100,
            py: 1.5,
            px: 3,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar
                  src={profileImage}
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: '#667eea',
                  }}
                >
                  {fullName?.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {fullName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {headline || title}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                {!currentUser && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PersonIcon />}
                    component="a"
                    href={`/register?ref=${id}`}
                    sx={{
                      display: { xs: 'none', md: 'inline-flex' },
                      background: 'linear-gradient(135deg, #667eea 0%, #a855f7 100%)',
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 2,
                      textDecoration: 'none',
                    }}
                  >
                    Join ProfilleAI
                  </Button>
                )}
                {currentUser && currentUser.id !== id && (
                  <>
                    <FollowButton
                      userId={id}
                      size="small"
                      onFollowChange={handleFollowChange}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ChatIcon />}
                      onClick={async () => {
                        try {
                          const response = await messageAPI.startConversation(id);
                          navigate(`/messages/${response.data.conversationId}`);
                        } catch (error) {
                          navigate('/messages');
                        }
                      }}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    >
                      Message
                    </Button>
                  </>
                )}
              </Box>
            </Box>
          </Container>
        </Box>
      </Fade>

      {/* Hero Section */}
      <Box
        ref={headerRef}
        sx={{
          position: 'relative',
          background: 'linear-gradient(135deg, #667eea 0%, #a855f7 50%, #ec4899 100%)',
          // Desktop: full hero with content; Mobile: short gradient banner
          pt: { xs: 0, md: 6 },
          pb: { xs: 10, md: 20 },
          minHeight: { xs: 180, md: 'auto' },
          overflow: 'hidden',
        }}
      >
        <AnimatedBackground />
        
        {/* Desktop hero content */}
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, display: { xs: 'none', md: 'block' } }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
            {/* Profile Picture */}
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={profileImage}
                sx={{
                  width: 180,
                  height: 180,
                  border: '4px solid white',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                  fontSize: '4rem',
                  bgcolor: '#764ba2',
                }}
              >
                {fullName?.charAt(0) || 'U'}
              </Avatar>
              {skills.length >= 5 && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: '#10b981',
                    border: '3px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircleIcon sx={{ color: 'white', fontSize: 22 }} />
                </Box>
              )}
            </Box>
            
            {/* Profile Info */}
            <Box sx={{ flex: 1, textAlign: 'left', color: 'white' }}>
              <Typography variant="h3" fontWeight={700} sx={{ fontSize: '2.75rem', mb: 1 }}>
                {fullName}
              </Typography>
              <Typography variant="h5" sx={{ opacity: 0.95, mb: 2, fontWeight: 400 }}>
                {headline || title}
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
                {location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.9 }}>
                    <LocationIcon sx={{ fontSize: 18 }} />
                    <Typography variant="body2">{location}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981' }} />
                  <Typography variant="body2">{availability}</Typography>
                </Box>
              </Box>
              
              {/* Social Links */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                {socialLinks.linkedin && (
                  <IconButton href={socialLinks.linkedin} target="_blank" sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}>
                    <LinkedInIcon />
                  </IconButton>
                )}
                {socialLinks.github && (
                  <IconButton href={socialLinks.github} target="_blank" sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}>
                    <GitHubIcon />
                  </IconButton>
                )}
                {socialLinks.twitter && (
                  <IconButton href={socialLinks.twitter} target="_blank" sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}>
                    <TwitterIcon />
                  </IconButton>
                )}
                {portfolioUrl && (
                  <IconButton href={portfolioUrl} target="_blank" sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}>
                    <WebsiteIcon />
                  </IconButton>
                )}
              </Box>
            </Box>
            
            {/* Share/Copy Buttons - desktop only */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="contained"
                startIcon={<ShareIcon />}
                onClick={handleShare}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(10px)',
                  color: 'white',
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                }}
              >
                Share
              </Button>
              <Button
                variant="contained"
                startIcon={<CopyIcon />}
                onClick={handleCopyLink}
                sx={{
                  bgcolor: 'white',
                  color: '#667eea',
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.95)' },
                }}
              >
                Copy Link
              </Button>
            </Box>
          </Box>
        </Container>

        {/* Mobile avatar is placed outside the hero to avoid overflow:hidden clipping */}
      </Box>

      {/* Mobile: Avatar overlapping gradient bottom */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', position: 'relative', mt: '-65px', zIndex: 2, mb: 1.5 }}>
        <Box sx={{ position: 'relative' }}>
          <Avatar
            src={profileImage}
            sx={{
              width: 130,
              height: 130,
              border: '5px solid white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              fontSize: '3rem',
              bgcolor: '#764ba2',
            }}
          >
            {fullName?.charAt(0) || 'U'}
          </Avatar>
          {skills.length >= 5 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: '#10b981',
                border: '3px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircleIcon sx={{ color: 'white', fontSize: 18 }} />
            </Box>
          )}
        </Box>
      </Box>

      {/* Mobile Profile Info - on white background below avatar */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, bgcolor: 'white', textAlign: 'center', pt: 1, pb: 2, px: 2 }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5, color: '#1a1a2e' }}>
          {fullName}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5, px: 2, lineHeight: 1.4 }}>
          {headline || title}
        </Typography>
        
        {/* Location + Availability + Social */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {location && (
            <Chip
              icon={<LocationIcon sx={{ fontSize: 16, color: '#667eea !important' }} />}
              label={location}
              variant="outlined"
              size="small"
              sx={{ borderColor: '#e5e7eb', color: '#6b7280', fontWeight: 500, height: 32, borderRadius: 4 }}
            />
          )}
          <Chip
            icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981', ml: 0.5 }} />}
            label={availability}
            variant="outlined"
            size="small"
            sx={{ borderColor: '#e5e7eb', color: '#6b7280', fontWeight: 500, height: 32, borderRadius: 4 }}
          />
          {socialLinks.linkedin && (
            <IconButton href={socialLinks.linkedin} target="_blank" size="small" sx={{ bgcolor: '#0A66C2', color: 'white', width: 32, height: 32, '&:hover': { bgcolor: '#004182' } }}>
              <LinkedInIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>

        {/* Stats Row - card with dividers */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mx: 2, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ flex: 1, textAlign: 'center', py: 1.5, borderRight: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#667eea' }}>
              {yearsLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5, fontSize: '0.6rem' }}>
              Years Exp
            </Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center', py: 1.5, borderRight: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#a855f7' }}>
              {skills.length}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5, fontSize: '0.6rem' }}>
              Skills
            </Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center', py: 1.5, borderRight: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#6b7280' }}>
              {education.length}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5, fontSize: '0.6rem' }}>
              Degrees
            </Typography>
          </Box>
          <Box sx={{ flex: 1, textAlign: 'center', py: 1.5 }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#ec4899' }}>
              {projects.length}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5, fontSize: '0.6rem' }}>
              Projects
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Sticky Action Bar with Stats - desktop only */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, bgcolor: 'white', borderBottom: '1px solid', borderColor: 'divider', position: 'relative', zIndex: 10, mt: -10 }}>
        <Container maxWidth="lg">
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'visible', mt: -6 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
                {/* Mini Profile Info */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar src={profileImage} sx={{ width: 48, height: 48, bgcolor: '#667eea' }}>
                    {fullName?.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>{fullName}</Typography>
                    <Typography variant="body2" color="text.secondary">{headline || title}</Typography>
                  </Box>
                </Box>
                
                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {!currentUser && (
                    <Button
                      variant="contained"
                      startIcon={<PersonIcon />}
                      component="a"
                      href={`/register?ref=${id}`}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #a855f7 100%)',
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3,
                        textDecoration: 'none',
                      }}
                    >
                      Join ProfilleAI
                    </Button>
                  )}
                  {currentUser && currentUser.id !== id && (
                    <>
                      <FollowButton
                        userId={id}
                        onFollowChange={handleFollowChange}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3 }}
                      />
                      <Button
                        variant="outlined"
                        startIcon={<ChatIcon />}
                        onClick={async () => {
                          try {
                            const response = await messageAPI.startConversation(id);
                            navigate(`/messages/${response.data.conversationId}`);
                          } catch (error) {
                            navigate('/messages');
                          }
                        }}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3 }}
                      >
                        Message
                      </Button>
                    </>
                  )}
                </Box>
              </Box>
              
              {/* Stats Row */}
              <Divider sx={{ my: 2.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
                <StatItem value={yearsLabel} label={yearsOfExperience === 1 ? 'Year Experience' : 'Years Experience'} color="#667eea" />
                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
                <StatItem value={skills.length} label={skills.length === 1 ? 'Skill' : 'Skills'} color="#a855f7" />
                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
                <StatItem value={education.length} label={education.length === 1 ? 'Degree' : 'Degrees'} color="#6b7280" />
                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
                <StatItem value={projects.length} label={projects.length === 1 ? 'Project' : 'Projects'} color="#ec4899" />
              </Box>
            </CardContent>
          </Card>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Grid container spacing={{ xs: 2, md: 4 }}>
          {/* Left Column - Main Content */}
          <Grid item xs={12} md={showRecruiterSidebar ? 9 : 12}>
            {/* AI Analytics CTA - Show only for non-logged in users */}
            {!currentUser && (
              <Card 
                sx={{ 
                  borderRadius: 3, 
                  mb: 3, 
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  position: 'relative',
                }}
              >
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Box 
                      sx={{ 
                        width: 50, 
                        height: 50, 
                        borderRadius: 2, 
                        bgcolor: 'rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <AnalyticsIcon sx={{ color: 'white', fontSize: 28 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography variant="h6" fontWeight={700} sx={{ color: 'white', mb: 0.5 }}>
                        AI Candidate Analytics
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                        Get instant AI insights to see if {fullName?.split(' ')[0] || 'this candidate'} is the right fit for your role
                      </Typography>
                    </Box>
                    <Chip
                      label="Coming Soon"
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        height: 36,
                        border: '1px solid rgba(255,255,255,0.3)',
                        px: 1,
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* About Me Section */}
            {bio && (
              <Card sx={{ borderRadius: 3, mb: 3, overflow: 'hidden' }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <SectionHeader icon={PersonIcon} title="About Me" color="#667eea" />
                  <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                    {bio}
                  </Typography>
                </CardContent>
              </Card>
            )}
            
            {/* Quick Highlights */}
            <Card sx={{ borderRadius: 3, mb: 3, overflow: 'hidden' }}>
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <SectionHeader icon={StarIcon} title="Quick Highlights" color="#f59e0b" />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <QuickHighlightCard 
                      icon={WorkIcon}
                      title="Current Role"
                      subtitle={experience[0]?.role ? `${experience[0].role} at ${experience[0].company}` : (title || 'N/A')}
                      color="#3b82f6"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <QuickHighlightCard 
                      icon={SchoolIcon}
                      title="Education"
                      subtitle={
                        education[0]
                          ? [education[0].degree, education[0].institution].filter(Boolean).join(', ') || 'N/A'
                          : 'N/A'
                      }
                      color="#06b6d4"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <QuickHighlightCard 
                      icon={AchievementIcon}
                      title="Top Skill"
                      subtitle={skills[0] || 'N/A'}
                      color="#10b981"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <QuickHighlightCard 
                      icon={AccessTimeIcon}
                      title="Availability"
                      subtitle={availability}
                      color="#ef4444"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Skills Section */}
            {skills.length > 0 && (
              <Card sx={{ borderRadius: 3, mb: 3, overflow: 'hidden' }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <SectionHeader icon={CodeIcon} title="Skills & Expertise" color="#a855f7" />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {Object.entries(skillsByCategory).map(([category, list]) => {
                      const label = SKILL_CATEGORY_LABELS[category] || (category.charAt(0).toUpperCase() + category.slice(1));
                      const color = SKILL_CATEGORY_COLORS[category] || '#667eea';
                      return (
                        <Box key={category}>
                          <Typography
                            variant="caption"
                            sx={{
                              color,
                              fontWeight: 700,
                              letterSpacing: '0.5px',
                              textTransform: 'uppercase',
                              display: 'block',
                              mb: 1,
                            }}
                          >
                            {label}
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                            {list.map((skill, idx) => (
                              <Chip
                                key={`${category}-${idx}`}
                                label={skill}
                                size="small"
                                sx={{
                                  bgcolor: alpha(color, 0.1),
                                  color,
                                  fontWeight: 500,
                                  border: `1px solid ${alpha(color, 0.25)}`,
                                  '& .MuiChip-label': { px: 1.25 },
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Work Experience */}
            {experience.length > 0 && (
              <Card sx={{ borderRadius: 3, mb: 3, overflow: 'hidden' }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <SectionHeader icon={WorkIcon} title="Work Experience" color="#f97316" />
                  <Box>
                    {experience.map((exp, idx) => (
                      <Fade in timeout={500 + idx * 200} key={idx}>
                        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                          {/* Timeline dot */}
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: idx === 0 ? '#a855f7' : '#f97316',
                              mt: 0.75,
                              flexShrink: 0,
                            }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {exp.role || exp.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#a855f7', fontWeight: 500 }}>
                              {exp.company}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {(formatDateRange(exp.startDate, exp.endDate) || exp.duration || exp.period || '')}{exp.location ? ` • ${exp.location}` : ''}
                            </Typography>
                            {exp.description && (
                              <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
                                {exp.description
                                  .split(/•|\n/)
                                  .map(s => s.trim())
                                  .filter(Boolean)
                                  .map((bullet, bIdx) => (
                                    <Typography
                                      key={bIdx}
                                      component="li"
                                      variant="body2"
                                      color="text.secondary"
                                      sx={{ lineHeight: 1.6, mb: 0.5 }}
                                    >
                                      {bullet}
                                    </Typography>
                                  ))}
                              </Box>
                            )}
                            {/* Experience skills/tags */}
                            {exp.skills && exp.skills.length > 0 && (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                {exp.skills.slice(0, 4).map((skill, sIdx) => (
                                  <Chip
                                    key={sIdx}
                                    label={skill}
                                    size="small"
                                    sx={{
                                      bgcolor: '#f3f4f6',
                                      color: '#374151',
                                      fontWeight: 500,
                                      fontSize: '0.75rem',
                                      height: 26,
                                    }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Fade>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Featured Projects */}
            {projects.length > 0 && (
              <Card sx={{ borderRadius: 3, mb: 3, overflow: 'hidden' }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <SectionHeader icon={FolderIcon} title="Featured Projects" color="#f97316" />
                  <Grid container spacing={3}>
                    {projects.slice(0, 4).map((project, idx) => (
                      <Grid item xs={12} sm={6} key={idx}>
                        <ProjectCard project={project} index={idx} />
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Education */}
            {education.length > 0 && (
              <Card sx={{ borderRadius: 3, mb: 3, overflow: 'hidden' }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <SectionHeader icon={SchoolIcon} title="Education" color="#06b6d4" />
                  {education.map((edu, idx) => (
                    <EducationItem key={idx} edu={edu} idx={idx} />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Certifications */}
            {certifications.length > 0 && (
              <Card sx={{ borderRadius: 3, mb: 3, overflow: 'hidden' }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <SectionHeader icon={CertIcon} title="Certifications" color="#f59e0b" />
                  <Grid container spacing={2}>
                    {certifications.map((cert, idx) => (
                      <Grid item xs={6} key={idx}>
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'white',
                          }}
                        >
                          <Typography variant="subtitle2" fontWeight={600}>
                            {typeof cert === 'string' ? cert : cert.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {typeof cert === 'object' ? `${cert.issuer || ''} • ${cert.year || ''}` : ''}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Posts & Sessions - only show if there are any */}
            {userPosts.length > 0 && (
              <Grid container spacing={3}>
                {userPosts.length > 0 && (
                  <Grid item xs={12}>
                    <Card sx={{ borderRadius: 3, height: '100%' }}>
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Typography variant="h6" fontWeight={600}>Posts</Typography>
                          <Chip label={userPosts.length} size="small" sx={{ bgcolor: alpha('#f59e0b', 0.1), color: '#b45309' }} />
                        </Box>
                        {userPosts.slice(0, 3).map((post, idx) => (
                          <Box
                            key={post.id || idx}
                            onClick={() => navigate('/feed')}
                            sx={{
                              p: 1.5,
                              mb: 1,
                              borderRadius: 1.5,
                              cursor: 'pointer',
                              border: '1px solid',
                              borderColor: 'divider',
                              '&:hover': { bgcolor: '#f9fafb' },
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                              {post.content?.substring(0, 60)}...
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(post.createdAt).toLocaleDateString()}
                            </Typography>
                          </Box>
                        ))}
                      </CardContent>
                    </Card>
                  </Grid>
                )}
                
              </Grid>
            )}

            {/* Footer CTA - desktop only, hidden for logged-in users */}
            {!currentUser && (
            <Card
              sx={{
                borderRadius: 3,
                mt: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #a855f7 50%, #ec4899 100%)',
                color: 'white',
                textAlign: 'center',
                overflow: 'hidden',
                display: { xs: 'none', md: 'block' },
              }}
            >
              <CardContent sx={{ p: { xs: 4, md: 5 } }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                  Interested in working together?
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9, mb: 3 }}>
                  Let's create something amazing together
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<PersonIcon />}
                    component="a"
                    href={`/register?ref=${id}`}
                    sx={{
                      bgcolor: 'white',
                      color: '#667eea',
                      borderRadius: 2,
                      px: 4,
                      py: 1.25,
                      textTransform: 'none',
                      fontWeight: 600,
                      textDecoration: 'none',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.95)' },
                    }}
                  >
                    Join ProfilleAI
                  </Button>
                  {portfolioUrl && (
                    <Button
                      variant="contained"
                      startIcon={<OpenInNewIcon />}
                      href={portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        borderRadius: 2,
                        px: 4,
                        py: 1.25,
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                      }}
                    >
                      View Portfolio
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
            )}
          </Grid>

          {/* Right Column - Recruiter CTA Sidebar (desktop only) */}
          {showRecruiterSidebar && (
            <Grid item xs={12} md={3} sx={{ display: { xs: 'none', md: 'block' } }}>
              <RecruiterCTASidebar 
                fullName={fullName} 
                navigate={navigate}
                currentUser={currentUser}
                profileId={id}
              />
            </Grid>
          )}

          {/* Recruiter CTA - mobile only, inline at bottom */}
          {showRecruiterSidebar && (
            <Grid item xs={12} sx={{ display: { xs: 'block', md: 'none' } }}>
              <RecruiterCTASidebar 
                fullName={fullName} 
                navigate={navigate}
                currentUser={currentUser}
                profileId={id}
              />
            </Grid>
          )}
        </Grid>
      </Container>

      {/* Footer - hidden on mobile */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, bgcolor: '#1f2937', color: 'white', py: 3, mt: 4 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                © {new Date().getFullYear()} {fullName}. All rights reserved.
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.5 }}>
                Powered by ProfilleAI
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Typography 
                variant="body2" 
                component={Link}
                to="/privacy"
                sx={{ 
                  opacity: 0.7, 
                  textDecoration: 'none', 
                  color: 'inherit',
                  '&:hover': { opacity: 1 }
                }}
              >
                Privacy Policy
              </Typography>
              <Typography 
                variant="body2" 
                component={Link}
                to="/terms"
                sx={{ 
                  opacity: 0.7, 
                  textDecoration: 'none', 
                  color: 'inherit',
                  '&:hover': { opacity: 1 }
                }}
              >
                Terms of Service
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Floating Email FAB - hidden on mobile to avoid distracting from profile */}
      <Fab
        color="primary"
        href={`mailto:${email}`}
        sx={{
          display: { xs: 'none', md: 'flex' },
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'linear-gradient(135deg, #667eea 0%, #a855f7 100%)',
          boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
          '&:hover': {
            boxShadow: '0 12px 32px rgba(102, 126, 234, 0.5)',
          },
        }}
      >
        <EmailIcon />
      </Fab>

      {/* Copy Link Success Snackbar */}
      <Snackbar
        open={showCopiedSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowCopiedSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: { xs: 8, md: 0 } }}
      >
        <Alert 
          onClose={() => setShowCopiedSnackbar(false)} 
          severity="success"
          icon={<CheckCircleIcon />}
          sx={{ borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
        >
          Profile link copied to clipboard!
        </Alert>
      </Snackbar>

      {/* Sticky Bottom Bar - Mobile only */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'white',
          borderTop: '1px solid',
          borderColor: 'divider',
          zIndex: 1100,
          px: 2,
          py: 1.5,
          gap: 1.5,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
        }}
      >
        <Button
          variant="outlined"
          fullWidth
          startIcon={<CopyIcon />}
          onClick={handleCopyLink}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            py: 1.25,
            borderColor: '#e5e7eb',
            color: '#374151',
            '&:hover': { borderColor: '#667eea', color: '#667eea' },
          }}
        >
          Copy Link
        </Button>
        <Button
          variant="contained"
          fullWidth
          startIcon={<ShareIcon />}
          onClick={handleShare}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            py: 1.25,
            background: 'linear-gradient(135deg, #667eea 0%, #a855f7 100%)',
            '&:hover': { boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)' },
          }}
        >
          Share Profile
        </Button>
      </Box>
    </Box>
  );
};

export default PublicProfile;
