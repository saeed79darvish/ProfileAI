import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Container, Box, Paper, Typography, Grid, Avatar, Button, IconButton,
  TextField, Chip, Divider, CircularProgress, Alert, Menu, MenuItem,
  Dialog, DialogContent, DialogTitle, Skeleton, Tooltip, Fade, InputAdornment,
  Select, Badge, LinearProgress, ToggleButton, ToggleButtonGroup,
  useTheme, useMediaQuery, alpha, Collapse, Tabs, Tab, Snackbar
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import CommentIcon from '@mui/icons-material/Comment';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import StarIcon from '@mui/icons-material/Star';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BarChartIcon from '@mui/icons-material/BarChart';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import LinkIcon from '@mui/icons-material/Link';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ImageIcon from '@mui/icons-material/Image';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import FilterListIcon from '@mui/icons-material/FilterList';
import GroupsIcon from '@mui/icons-material/Groups';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import SchoolIcon from '@mui/icons-material/School';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';

// Icon aliases
const MedalIcon = EmojiEventsIcon;
const BookIcon = MenuBookIcon;
const RocketIcon = RocketLaunchIcon;
const AIIcon = AutoAwesomeIcon;
const ChartIcon = BarChartIcon;
const MoreIcon = MoreVertIcon;
const EmojiIcon = EmojiEmotionsIcon;
const FilterIcon = FilterListIcon;
const CopyIcon = ContentCopyIcon;
const LikeIcon = ThumbUpIcon;
const LikeOutlinedIcon = ThumbUpOutlinedIcon;
const TeachIcon = SchoolIcon;
const WandIcon = AutoFixHighIcon;
const AchievementIcon = WorkspacePremiumIcon;
import { useAuth } from '@/contexts/AuthContext';
import { profileAPI, postAPI, resolveImageUrl, pollsAPI, reputationAPI } from '@/services/api';
import {
  PageContainer,
  MainGrid,
  LeftSidebar,
  RightSidebar,
  MainContent,
  ProfileCard,
  ProfileGradientBanner,
  ProfileContent,
  ProfileAvatar,
  ProBadge,
  ProfileName,
  ProfileTitle,
  ProfileStats,
  ProfileStat,
  ActionCardsRow,
  ActionCard,
  ActionCardIcon,
  ActionCardDecoIcon,
  ActionCardInfo,
  TabsContainer,
  StyledTabs,
  StyledTab,
  FilterBar,
  FilterChip,
  SessionList,
  EmptyState,
  EmptyIcon,
  AchievementCard,
  AchievementHeader,
  CategoryIcon,
  CategoryLabel,
  AchievementBody,
  AchievementTitle,
  AchievementContent,
  CopyCodeButton,
  AchievementMeta,
  AuthorInfo,
  AuthorAvatar,
  AuthorName,
  AchievementActions,
  ActionButton,
  JoinCTACard,
  JoinCTATitle,
  JoinCTASubtitle,
  JoinCTAButton,
  JoinCTASecondary,
  BenefitsList,
  BenefitItem,
  UnauthHeroBanner,
  HeroBannerContent,
  HeroBannerTitle,
  HeroBannerSubtitle,
  HeroBannerButtons,
  HeroPrimaryBtn,
  HeroSecondaryBtn,
  InlineSignupCard,
  InlineSignupIcon,
  InlineSignupTitle,
  InlineSignupText,
  InlineSignupBtn,
  WhyJoinCard,
  WhyJoinTitle,
  WhyJoinItem,
  WhyJoinItemIcon,
  WhyJoinItemText,
  WhyJoinCTA,
  glassStyle,
  PostImageContainer,
  ImageOverlayBadge,
  PostMenuIconButton,
  ShareKnowledgeSection,
  ShareKnowledgeIconWrapper,
  GradientDialogTitle,
  GradientButton,
  CaptionText,
  DefaultAvatar,
} from './styled';
import { ROUTES, TIMINGS, LIMITS, SESSION_FILTERS } from './constants';
import { getAchievementCategory } from './utils';
import { YourStats } from '@/components/sessions';
import ShareMenu from '@/components/feed/ShareMenu';
import AIProcessingModal from '@/components/AIProcessingModal';
import CreatePollModal from '@/components/polls/CreatePollModal';
import ProfileHoverCard from '@/components/ProfileHoverCard';
import InlineComments from '@/components/feed/InlineComments';
import InviteFriends from '@/components/referral/InviteFriends';
import PollCard from '@/components/polls/PollCard';

// ============ ICON MAP FOR CATEGORY/FILTERS ============
const CATEGORY_ICON_MAP = {
  medal: (color) => <MedalIcon sx={{ fontSize: 20, color }} />,
  book: (color) => <BookIcon sx={{ fontSize: 20, color }} />,
  rocket: (color) => <RocketIcon sx={{ fontSize: 20, color }} />,
  star: (color) => <StarIcon sx={{ fontSize: 20, color }} />,
  settings: (color) => <SettingsIcon sx={{ fontSize: 20, color }} />,
};

const FILTER_ICON_MAP = {
  public: <PublicIcon />,
  comment: <CommentIcon />,
  howToVote: <HowToVoteIcon />,
};

// ============ MAIN FEED PAGE ============
const FeedPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));

  // Tab state
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'all');
  
  // Content state
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState('all');
  
  // Posts state (for Community tab)
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [likedPosts, setLikedPosts] = useState(new Set());
  
  // User profile state
  const [userProfile, setUserProfile] = useState(null);
  
  // User stats
  const [userStats, setUserStats] = useState({
    teachingCredits: 0,
    sessionsAttended: 0,
    peopleHelped: 0,
    level: 'newcomer',
    sessionsHosted: 0
  });
  const [levelProgress, setLevelProgress] = useState({
    currentLevel: 'newcomer',
    sessionsToNext: 5,
    progress: 0,
    currentSessions: 0,
    targetSessions: 5
  });
  
  // Modals
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showPostInfoModal, setShowPostInfoModal] = useState(false);
  
  // Post creation state
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('achievement');
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postImage, setPostImage] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const postTextFieldRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlText, setUrlText] = useState('');
  const [urlLink, setUrlLink] = useState('');

  
  // AI Enhancement state
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiEnhancedContent, setAiEnhancedContent] = useState(null);
  
  // Post menu state
  const [postMenuAnchor, setPostMenuAnchor] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  
  // Edit post modal state
  const [showEditPostModal, setShowEditPostModal] = useState(false);
  const [editPostContent, setEditPostContent] = useState('');
  const [editPostSubmitting, setEditPostSubmitting] = useState(false);
  
  // Trending topics
  const [trendingTopics, setTrendingTopics] = useState([]);
  
  // Error state
  const [error, setError] = useState('');
  
  // Coming soon snackbar
  const [showComingSoon, setShowComingSoon] = useState(false);
  
  // Snackbar message state
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Comments state
  const [expandedComments, setExpandedComments] = useState(new Set());
  
  // Share menu state
  const [shareMenuAnchor, setShareMenuAnchor] = useState(null);
  const [sharePost, setSharePost] = useState(null);
  
  // Saved posts state
  const [savedPosts, setSavedPosts] = useState(new Set());

  // Polls state
  const [polls, setPolls] = useState([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [showCreatePollModal, setShowCreatePollModal] = useState(false);
  const [userVotes, setUserVotes] = useState({});

  // Load sessions
  const loadSessions = useCallback(async () => {
    console.log('[FeedPage] loadSessions called, sessionFilter:', sessionFilter);
    setSessionsLoading(true);
    
    // Load posts for 'all' or 'posts' filters
    if (sessionFilter === 'all' || sessionFilter === 'posts') {
      try {
        const response = await postAPI.getAll({ limit: 20 });
        const loadedPosts = response.data.posts || response.data || [];
        console.log('[FeedPage] Loaded posts:', loadedPosts.length, loadedPosts.map(p => p.id));
        setPosts(loadedPosts);
        
        // Load liked status for posts if authenticated
        if (isAuthenticated && loadedPosts.length > 0) {
          try {
            const postIds = loadedPosts.map(p => p.id);
            const likesResponse = await postAPI.checkLikes(postIds);
            const likedIds = likesResponse.data.likedPostIds || [];
            setLikedPosts(new Set(likedIds));
            
            // Also load saved status
            const savedResponse = await postAPI.checkSavedPosts(postIds);
            const savedIds = savedResponse.data.savedPostIds || [];
            setSavedPosts(new Set(savedIds));
          } catch (likesErr) {
            console.error('Failed to load liked/saved posts:', likesErr);
          }
        }
      } catch (err) {
        console.error('Failed to load posts:', err);
        setPosts([]);
      }
    } else {
      setPosts([]);
    }
    
    setSessionsLoading(false);
  }, [sessionFilter]);

  // Load user profile for sidebar card
  const loadUserProfile = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await profileAPI.getMyProfile();
      setUserProfile(response.data);
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  }, [isAuthenticated]);

  // Load user stats
  const loadUserStats = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await reputationAPI.getMyStats();
      const stats = response.data.reputation || response.data || {};
      setUserStats({
        teachingCredits: stats.teachingCredits || 0,
        sessionsAttended: stats.sessionsAttended || 0,
        peopleHelped: stats.peopleHelped || 0,
        level: stats.level || 'newcomer',
        sessionsHosted: stats.sessionsHosted || 0
      });
      
      // Calculate level progress
      const sessionsHosted = stats.sessionsHosted || 0;

      // Local-scope only — these used to be module-level `let` vars which
      // leaked state across renders/users. Keep them strictly inside this
      // callback.
      let currentLevel = 'newcomer';
      let targetSessions = 5;

      if (sessionsHosted >= 25) {
        currentLevel = 'master';
        targetSessions = 50;
      } else if (sessionsHosted >= 10) {
        currentLevel = 'expert';
        targetSessions = 25;
      } else if (sessionsHosted >= 5) {
        currentLevel = 'contributor';
        targetSessions = 10;
      }
      
      const prevTarget = currentLevel === 'newcomer' ? 0 : 
                        currentLevel === 'contributor' ? 5 : 
                        currentLevel === 'expert' ? 10 : 25;
      const progress = ((sessionsHosted - prevTarget) / (targetSessions - prevTarget)) * 100;
      
      setLevelProgress({
        currentLevel,
        sessionsToNext: targetSessions - sessionsHosted,
        progress: Math.min(progress, 100),
        currentSessions: sessionsHosted,
        targetSessions
      });
    } catch (err) {
      console.error('Failed to load user stats:', err);
    }
  }, [isAuthenticated]);

  // Load trending topics
  const loadTrendingTopics = useCallback(async () => {
    setTrendingTopics([
      { category: 'CareerGrowth', sessionCount: 124 },
      { category: 'TechTips', sessionCount: 89 },
      { category: 'Promotion', sessionCount: 67 },
      { category: 'Leadership', sessionCount: 45 }
    ]);
  }, []);

  // Load polls
  const loadPolls = useCallback(async () => {
    setPollsLoading(true);
    try {
      const response = await pollsAPI.getAll({ limit: 10, status: 'active' });
      setPolls(response.data.polls || response.data || []);
      
      // Load user votes if authenticated
      if (isAuthenticated && response.data.polls?.length > 0) {
        const newVotes = {};
        for (const poll of response.data.polls) {
          try {
            const voteResponse = await pollsAPI.checkVote(poll.id);
            if (voteResponse.data.hasVoted) {
              newVotes[poll.id] = voteResponse.data.optionId;
            }
          } catch (e) {
            // Ignore - user hasn't voted
          }
        }
        setUserVotes(newVotes);
      }
    } catch (err) {
      console.error('Error loading polls:', err);
    } finally {
      setPollsLoading(false);
    }
  }, [isAuthenticated]);

  // Handle poll vote - callback receives updated poll data from PollCard
  const handlePollVote = (updatedPoll) => {
    // Update the polls list with the new poll data
    setPolls(prev => prev.map(p => p.id === updatedPoll.id ? updatedPoll : p));
    // Update user votes
    if (updatedPoll.userVote) {
      setUserVotes(prev => ({ ...prev, [updatedPoll.id]: updatedPoll.userVote }));
    }
  };

  // Handle poll created
  const handlePollCreated = () => {
    loadPolls();
  };

  // Effects
  useEffect(() => {
    loadSessions();
    loadPolls();
  }, [loadSessions, loadPolls]);

  useEffect(() => {
    loadUserStats();
    loadUserProfile();
    loadTrendingTopics();
  }, [loadUserStats, loadUserProfile, loadTrendingTopics]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setSearchParams({ tab: newValue });
  };

  // Handle topic click
  const handleTopicClick = (topic) => {
    setSessionFilter('all');
    // Could add search/filter by topic
  };

  // Handle like post
  const handleLikePost = async (postId) => {
    if (!isAuthenticated) return;
    try {
      const isLiked = likedPosts.has(postId);
      
      // Call like endpoint (it toggles)
      await postAPI.like(postId);
      
      // Update liked posts set
      if (isLiked) {
        setLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
      } else {
        setLikedPosts(prev => new Set([...prev, postId]));
      }
      
      // Update post like count in the posts array
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            likesCount: isLiked ? (post.likesCount || 1) - 1 : (post.likesCount || 0) + 1
          };
        }
        return post;
      }));
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  // Handle toggle comments
  const handleToggleComments = (postId) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };
  
  // Handle share menu
  const handleOpenShareMenu = (event, post) => {
    setShareMenuAnchor(event.currentTarget);
    setSharePost(post);
  };
  
  const handleCloseShareMenu = () => {
    setShareMenuAnchor(null);
    setSharePost(null);
  };
  
  // Handle save/bookmark post
  const handleSavePost = async (postId) => {
    if (!isAuthenticated) return;
    try {
      const isSaved = savedPosts.has(postId);
      await postAPI.savePost(postId);
      
      if (isSaved) {
        setSavedPosts(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      } else {
        setSavedPosts(prev => new Set([...prev, postId]));
      }
    } catch (err) {
      console.error('Failed to save post:', err);
    }
  };

  // Handle AI enhance post
  const handleAIEnhance = async () => {
    if (!newPostContent.trim() || newPostContent.length < 10) {
      setSnackbarMessage('Please write at least 10 characters before enhancing');
      setSnackbarOpen(true);
      return;
    }
    
    try {
      setAiEnhancing(true);
      const response = await postAPI.enhanceWithAI(newPostContent);
      const enhanced = response.data;
      
      if (enhanced.enhanced) {
        setAiEnhancedContent({
          original: newPostContent,
          enhanced: enhanced.enhanced,
          score: enhanced.predictedEngagement?.score || 0
        });
        setNewPostContent(enhanced.enhanced);
        setSnackbarMessage('✨ Post enhanced!');
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('Failed to enhance post:', err);
      setSnackbarMessage('Failed to enhance post. Please try again.');
      setSnackbarOpen(true);
    } finally {
      setAiEnhancing(false);
    }
  };

  // Handle create post
  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    if (postSubmitting) return; // hard guard against double-clicks
    setPostSubmitting(true);

    // Idempotency key — generated once per submit attempt. If the request is
    // retried or the user double-clicks before the modal closes, the backend
    // returns the originally-created post instead of creating a duplicate.
    const idempotencyKey =
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {

      // Upload image first if present
      let uploadedImageUrl = null;
      if (postImage) {
        setImageUploading(true);
        try {
          const uploadResponse = await postAPI.uploadImage(postImage);
          uploadedImageUrl = uploadResponse.data.imageUrl;
        } catch (imgErr) {
          console.error('Failed to upload image:', imgErr);
        } finally {
          setImageUploading(false);
        }
      }

      await postAPI.create({
        content: newPostContent.trim(),
        postType: newPostCategory,
        imageUrl: uploadedImageUrl,
        idempotencyKey,
      });
      
      // Clear form
      setNewPostContent('');
      setNewPostCategory('achievement');
      setPostImage(null);
      setPostImagePreview(null);
      setAiEnhancedContent(null);
      setShowCreatePostModal(false);
      
      // Switch to posts tab to see the new post (or stay on all)
      if (sessionFilter !== 'all' && sessionFilter !== 'posts') {
        setSessionFilter('posts');
      }
      // Trigger reload
      setTimeout(() => loadSessions(), 100);
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      setPostSubmitting(false);
    }
  };

  // Handle image selection for post
  const handlePostImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setSnackbarMessage('Image must be less than 5MB');
        setSnackbarOpen(true);
        return;
      }
      setPostImage(file);
      const reader = new FileReader();
      reader.onload = () => setPostImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Remove selected image
  const handleRemovePostImage = () => {
    setPostImage(null);
    setPostImagePreview(null);
  };

  // Copy code to clipboard
  const handleCopyCode = (code, buttonElement) => {
    navigator.clipboard.writeText(code).then(() => {
      buttonElement.classList.add('copied');
      buttonElement.innerHTML = '<svg class="MuiSvgIcon-root" focusable="false" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>Copied!';
      setTimeout(() => {
        buttonElement.classList.remove('copied');
        buttonElement.innerHTML = '<svg class="MuiSvgIcon-root" focusable="false" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path></svg>Copy';
      }, 2000);
    });
  };

  // Render content with code blocks
  // Render inline markdown: bold, italic, inline code, links
  const renderInlineMarkdown = (text) => {
    if (!text) return text;
    const parts = [];
    let key = 0;
    let lastIndex = 0;
    const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
    let match;
    while ((match = inlineRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{text.substring(lastIndex, match.index)}</span>);
      }
      if (match[2]) {
        parts.push(<strong key={key++}>{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(<em key={key++}>{match[3]}</em>);
      } else if (match[4]) {
        parts.push(<code key={key++} style={{ background: 'rgba(124,94,207,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em', color: '#7c5ecf' }}>{match[4]}</code>);
      } else if (match[5] && match[6]) {
        parts.push(<a key={key++} href={match[6]} target="_blank" rel="noopener noreferrer" style={{ color: '#7c5ecf', textDecoration: 'underline' }}>{match[5]}</a>);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(<span key={key++}>{text.substring(lastIndex)}</span>);
    }
    return parts.length > 0 ? parts : text;
  };

  const renderContentWithCodeBlocks = (content) => {
    if (!content) return null;
    
    // Split content by code blocks (triple backticks)
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      // Multi-line code block
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).trim();
        return (
          <pre key={index} style={{ position: 'relative' }}>
            <CopyCodeButton
              className="copy-button"
              onClick={(e) => handleCopyCode(code, e.currentTarget)}
            >
              <CopyIcon fontSize="small" />
              Copy
            </CopyCodeButton>
            <code>{code}</code>
          </pre>
        );
      }
      // Regular text - process line by line for lists, then inline markdown
      else {
        const lines = part.split('\n');
        return (
          <span key={index}>
            {lines.map((line, lineIdx) => {
              const trimmed = line.trimStart();
              // Bullet list item
              if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
                const listContent = trimmed.startsWith('• ') ? trimmed.slice(2) : trimmed.slice(2);
                return <div key={lineIdx} style={{ paddingLeft: 16, display: 'flex', gap: 6 }}><span>•</span><span>{renderInlineMarkdown(listContent)}</span></div>;
              }
              // Numbered list item
              const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
              if (numMatch) {
                return <div key={lineIdx} style={{ paddingLeft: 16, display: 'flex', gap: 6 }}><span>{numMatch[1]}.</span><span>{renderInlineMarkdown(numMatch[2])}</span></div>;
              }
              // Regular line
              if (lineIdx < lines.length - 1) {
                return <React.Fragment key={lineIdx}>{renderInlineMarkdown(line)}<br /></React.Fragment>;
              }
              return <React.Fragment key={lineIdx}>{renderInlineMarkdown(line)}</React.Fragment>;
            })}
          </span>
        );
      }
    });
  };

  // Handle post menu open
  const handlePostMenuOpen = (event, post) => {
    setPostMenuAnchor(event.currentTarget);
    setSelectedPost(post);
  };

  // Handle post menu close
  const handlePostMenuClose = () => {
    setPostMenuAnchor(null);
    setSelectedPost(null);
  };

  // Handle delete post
  const handleDeletePost = async () => {
    if (!selectedPost || !window.confirm('Are you sure you want to delete this post?')) {
      handlePostMenuClose();
      return;
    }
    
    try {
      await postAPI.delete(selectedPost.id);
      // Reload posts
      loadSessions();
      handlePostMenuClose();
    } catch (err) {
      console.error('Failed to delete post:', err);
      setSnackbarMessage('Failed to delete post. Please try again.');
      setSnackbarOpen(true);
    }
  };

  // Handle edit post - open modal
  const handleEditPost = () => {
    if (selectedPost) {
      setEditPostContent(selectedPost.content || '');
      setShowEditPostModal(true);
    }
    setPostMenuAnchor(null); // Close menu but keep selectedPost
  };

  // Submit edited post
  const handleSubmitEditPost = async () => {
    if (!selectedPost || !editPostContent.trim()) return;
    
    try {
      setEditPostSubmitting(true);
      await postAPI.update(selectedPost.id, { content: editPostContent.trim() });
      // Update local state
      setPosts(prev => prev.map(p => 
        p.id === selectedPost.id ? { ...p, content: editPostContent.trim() } : p
      ));
      setShowEditPostModal(false);
      setSelectedPost(null);
      setEditPostContent('');
    } catch (err) {
      console.error('Failed to edit post:', err);
      setSnackbarMessage('Failed to edit post. Please try again.');
      setSnackbarOpen(true);
    } finally {
      setEditPostSubmitting(false);
    }
  };

  // Render achievement card
  const renderAchievementCard = (post) => {
    const category = getAchievementCategory(post);
    const author = post.author || {};
    const isOwner = user && post.userId === user.id;
    
    return (
      <AchievementCard key={post.id} elevation={0}>
        <AchievementHeader $category={category.label}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
            <CategoryIcon>{CATEGORY_ICON_MAP[category.iconName]?.(category.color)}</CategoryIcon>
            <Box>
              <CategoryLabel>{category.label}</CategoryLabel>
              <CaptionText variant="caption" sx={{ mt: 0.25 }}>
                Posted in {post.postType ? post.postType.charAt(0).toUpperCase() + post.postType.slice(1) : 'General'}
              </CaptionText>
            </Box>
          </Box>
          <PostMenuIconButton
            size="small"
            onClick={(e) => handlePostMenuOpen(e, post)}
          >
            <MoreIcon />
          </PostMenuIconButton>
        </AchievementHeader>
        <AchievementBody>
          {post.title && <AchievementTitle>{post.title}</AchievementTitle>}
          <AchievementContent>
            {renderContentWithCodeBlocks(post.content)}
          </AchievementContent>
          
          {/* Post Image */}
          {post.imageUrl && (
            <PostImageContainer>
              <img 
                src={resolveImageUrl(post.imageUrl)} 
                alt="Post" 
              />
            </PostImageContainer>
          )}
          
          <AchievementMeta>
            <AuthorInfo>
              <ProfileHoverCard
                userId={author.id}
                userName={author.name || `${author.firstName || ''} ${author.lastName || ''}`}
                userAvatar={author.avatar}
                userRole={author.role || 'candidate'}
                headline={author.headline || author.title}
                location={author.location}
                companyName={author.companyName}
                disabled={!author.id}
              >
                <AuthorAvatar>
                  {author.avatar ? (
                    <img src={resolveImageUrl(author.avatar)} alt={author.name || author.firstName} />
                  ) : (
                    <DefaultAvatar sx={{ width: 36, height: 36 }}>
                      {(author.name || `${author.firstName || ''} ${author.lastName || ''}`).split(' ').map(n => n[0]).join('')}
                    </DefaultAvatar>
                  )}
                </AuthorAvatar>
              </ProfileHoverCard>
              <Box>
                <ProfileHoverCard
                  userId={author.id}
                  userName={author.name || `${author.firstName || ''} ${author.lastName || ''}`}
                  userAvatar={author.avatar}
                  userRole={author.role || 'candidate'}
                  headline={author.headline || author.title}
                  location={author.location}
                  companyName={author.companyName}
                  disabled={!author.id}
                >
                  <AuthorName>
                    {author.name || `${author.firstName} ${author.lastName}`}
                  </AuthorName>
                </ProfileHoverCard>
                <CaptionText variant="caption">
                  {author.title || author.headline || 'Member'} {post.createdAt && `• ${formatDistanceToNow(new Date(post.createdAt), { addSuffix: false })} ago`}
                </CaptionText>
              </Box>
            </AuthorInfo>
            <AchievementActions>
              <ActionButton 
                $active={likedPosts.has(post.id)}
                onClick={() => handleLikePost(post.id)}
              >
                {likedPosts.has(post.id) ? <LikeIcon fontSize="small" /> : <LikeOutlinedIcon fontSize="small" />}
                {post.likesCount || 0}
              </ActionButton>
              <ActionButton onClick={() => handleToggleComments(post.id)}>
                <CommentIcon fontSize="small" />
                {post.commentsCount || 0}
              </ActionButton>
              <ActionButton onClick={(e) => handleOpenShareMenu(e, post)}>
                <ShareIcon fontSize="small" />
              </ActionButton>
            </AchievementActions>
          </AchievementMeta>
          
          {/* Inline Comments */}
          <InlineComments
            postId={post.id}
            isExpanded={expandedComments.has(post.id)}
            onToggle={() => handleToggleComments(post.id)}
            commentCount={post.commentsCount || 0}
          />
        </AchievementBody>
      </AchievementCard>
    );
  };

  return (
    <PageContainer>
      <MainGrid $isMobile={isMobile} $isTablet={isTablet}>
        
        {/* ======= LEFT SIDEBAR ======= */}
        {!isMobile && (
          <LeftSidebar>
            {/* User Profile Card (authenticated) */}
            {isAuthenticated && user && (
              <ProfileCard>
                <ProfileGradientBanner />
                <ProfileContent>
                <ProfileAvatar>
                  {userProfile?.profilePicture ? (
                    <img src={resolveImageUrl(userProfile.profilePicture)} alt={user.firstName} />
                  ) : (
                    <DefaultAvatar sx={{ width: 110, height: 110, fontSize: 36, border: '4px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                      {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}
                    </DefaultAvatar>
                  )}
                  {user.subscriptionTier === 'pro' && <ProBadge>PRO</ProBadge>}
                </ProfileAvatar>
                <ProfileName>{user.firstName} {user.lastName}</ProfileName>
                <ProfileTitle>{userProfile?.headline || user.role || 'Member'}</ProfileTitle>
                <ProfileStats>
                  <ProfileStat>
                    <div className="value">{userStats.teachingCredits || 0}</div>
                    <div className="label">Credits</div>
                  </ProfileStat>
                  <ProfileStat>
                    <div className="value">{userStats.sessionsAttended || 0}</div>
                    <div className="label">Sessions</div>
                  </ProfileStat>
                  <ProfileStat>
                    <div className="value">{userStats.peopleHelped || 0}</div>
                    <div className="label">Helped</div>
                  </ProfileStat>
                </ProfileStats>
                </ProfileContent>
              </ProfileCard>
            )}

            {/* Join CTA Card (not authenticated) */}
            {!isAuthenticated && (
              <JoinCTACard>
                <JoinCTATitle>Build Your AI-Powered Profile</JoinCTATitle>
                <JoinCTASubtitle>
                  Join thousands of professionals using AI to land their dream job.
                </JoinCTASubtitle>
                <JoinCTAButton onClick={() => navigate('/register')}>
                  Get Started Free
                </JoinCTAButton>
                <JoinCTASecondary onClick={() => navigate('/login')}>
                  Already have an account? Sign In
                </JoinCTASecondary>
                <BenefitsList>
                  <BenefitItem>
                    <CheckIcon /> AI Resume Tailoring
                  </BenefitItem>
                  <BenefitItem>
                    <CheckIcon /> Smart Cover Letters
                  </BenefitItem>
                  <BenefitItem>
                    <CheckIcon /> Profile Enhancement
                  </BenefitItem>
                  <BenefitItem>
                    <CheckIcon /> Community
                  </BenefitItem>
                </BenefitsList>
              </JoinCTACard>
            )}

            {/* Your Stats */}
            {isAuthenticated && (
              <YourStats stats={userStats} />
            )}
          </LeftSidebar>
        )}

        {/* ======= MAIN CONTENT ======= */}
        <MainContent>
          {/* Hero Banner for unauthenticated users */}
          {!isAuthenticated && (
            <UnauthHeroBanner>
              <HeroBannerContent>
                <HeroBannerTitle>
                  Welcome to <span>ProfileAI</span> Community
                </HeroBannerTitle>
                <HeroBannerSubtitle>
                  Join our community of professionals. Get AI-powered tools to enhance your profile, 
                  tailor your resume, and connect with others.
                </HeroBannerSubtitle>
                <HeroBannerButtons>
                  <HeroPrimaryBtn onClick={() => navigate('/register')}>
                    <RocketIcon /> Join Free
                  </HeroPrimaryBtn>
                  <HeroSecondaryBtn onClick={() => navigate('/login')}>
                    Sign In
                  </HeroSecondaryBtn>
                </HeroBannerButtons>
              </HeroBannerContent>
            </UnauthHeroBanner>
          )}

          {/* Quick Action Cards (authenticated only) */}
          {isAuthenticated && (
            <ActionCardsRow>
              <ActionCard onClick={() => setShowCreatePostModal(true)}>
                <ActionCardDecoIcon style={{ color: '#7c5ecf' }}><WandIcon /></ActionCardDecoIcon>
                <ActionCardIcon style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#7c5ecf' }}><WandIcon /></ActionCardIcon>
                <ActionCardInfo>
                  <h4>Share Win</h4>
                  <p>Celebrate achievements</p>
                </ActionCardInfo>
              </ActionCard>

              <ActionCard onClick={() => setShowCreatePollModal(true)}>
                <ActionCardDecoIcon style={{ color: '#c084fc' }}><ChartIcon /></ActionCardDecoIcon>
                <ActionCardIcon style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc' }}><ChartIcon /></ActionCardIcon>
                <ActionCardInfo>
                  <h4>Start Debate</h4>
                  <p>Create a poll</p>
                </ActionCardInfo>
              </ActionCard>
            </ActionCardsRow>
          )}

          {/* Error */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 3, borderRadius: 3, background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)', '& .MuiAlert-icon': { color: '#f87171' } }}
              action={
                <Button color="inherit" size="small" onClick={() => loadSessions()}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {/* Filter Bar */}
          <FilterBar>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flex: 1 }}>
              {SESSION_FILTERS.map(filter => (
                <FilterChip
                  key={filter.value}
                  $active={sessionFilter === filter.value}
                  onClick={() => setSessionFilter(filter.value)}
                >
                  {FILTER_ICON_MAP[filter.iconName]}
                  {filter.label}
                </FilterChip>
              ))}
            </Box>
            <PostMenuIconButton size="small">
              <FilterIcon />
            </PostMenuIconButton>
          </FilterBar>

          {/* Content List */}
          {sessionsLoading ? (
            <SessionList>
              {[1, 2, 3].map(i => (
                <Paper key={i} elevation={0} sx={{ ...glassStyle, borderRadius: 3, p: 3 }}>
                  <Skeleton variant="rectangular" height={24} width={120} sx={{ borderRadius: 1, mb: 2, bgcolor: 'rgba(0,0,0,0.06)' }} />
                  <Skeleton variant="text" width="80%" height={28} sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />
                  <Box sx={{ display: 'flex', gap: 2, mt: 2, mb: 2 }}>
                    <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="40%" sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />
                      <Skeleton variant="text" width="60%" sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />
                    </Box>
                  </Box>
                  <Skeleton variant="rectangular" height={44} sx={{ borderRadius: 2, bgcolor: 'rgba(0,0,0,0.06)' }} />
                </Paper>
              ))}
            </SessionList>
          ) : sessionFilter === 'all' ? (
            // Show Polls, Posts
            (posts.length === 0 && polls.length === 0) ? (
              <EmptyState>
                <EmptyIcon>
                  <PublicIcon />
                </EmptyIcon>
                <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: '#1a1a2e' }}>
                  Nothing here yet
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, color: '#555' }}>
                  Be the first to share or host something!
                </Typography>
              </EmptyState>
            ) : (
              <Fade in>
                <SessionList>
                  {/* Polls first */}
                  {polls.map(poll => (
                    <PollCard
                      key={poll.id}
                      poll={poll}
                      onVote={handlePollVote}
                    />
                  ))}
                  {/* Posts */}
                  {posts.map((post, idx) => (
                    <React.Fragment key={post.id}>
                      {renderAchievementCard(post)}
                      {!isAuthenticated && idx === 1 && (
                        <InlineSignupCard>
                          <InlineSignupIcon><RocketIcon /></InlineSignupIcon>
                          <InlineSignupTitle>Enjoying the community?</InlineSignupTitle>
                          <InlineSignupText>
                            Create a free account to post, comment, and use AI tools to boost your career.
                          </InlineSignupText>
                          <InlineSignupBtn onClick={() => navigate('/register')}>
                            Join ProfileAI, It's Free
                          </InlineSignupBtn>
                        </InlineSignupCard>
                      )}
                    </React.Fragment>
                  ))}
                </SessionList>
              </Fade>
            )
          ) : sessionFilter === 'posts' ? (
            // Show Achievement Cards (Posts only)
            posts.length === 0 ? (
              <EmptyState>
                <EmptyIcon>
                  <AchievementIcon />
                </EmptyIcon>
                <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: '#1a1a2e' }}>
                  No posts shared yet
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, color: '#555' }}>
                  Be the first to share your career win!
                </Typography>
                {isAuthenticated && (
                  <Button
                    variant="contained"
                    onClick={() => setShowCreatePostModal(true)}
                    sx={{
                      borderRadius: 3,
                      px: 4,
                      background: 'linear-gradient(135deg, #7c5ecf, #9333ea)',
                    }}
                  >
                    Share Post
                  </Button>
                )}
              </EmptyState>
            ) : (
              <Fade in>
                <SessionList>
                  {posts.map((post, idx) => (
                    <React.Fragment key={post.id}>
                      {renderAchievementCard(post)}
                      {!isAuthenticated && idx === 1 && (
                        <InlineSignupCard>
                          <InlineSignupIcon><RocketIcon /></InlineSignupIcon>
                          <InlineSignupTitle>Enjoying the community?</InlineSignupTitle>
                          <InlineSignupText>
                            Create a free account to post, comment, and use AI tools to boost your career.
                          </InlineSignupText>
                          <InlineSignupBtn onClick={() => navigate('/register')}>
                            Join ProfileAI, It's Free
                          </InlineSignupBtn>
                        </InlineSignupCard>
                      )}
                    </React.Fragment>
                  ))}
                </SessionList>
              </Fade>
            )
          ) : sessionFilter === 'polls' ? (
            // Show Polls only
            pollsLoading ? (
              <SessionList>
                {[1, 2, 3].map(i => (
                  <Paper key={i} elevation={0} sx={{ ...glassStyle, borderRadius: 3, p: 3 }}>
                    <Skeleton variant="text" width="80%" height={28} sx={{ bgcolor: 'rgba(0,0,0,0.06)' }} />
                    <Box sx={{ mt: 2 }}>
                      <Skeleton variant="rectangular" height={44} sx={{ borderRadius: 2, mb: 1, bgcolor: 'rgba(0,0,0,0.06)' }} />
                      <Skeleton variant="rectangular" height={44} sx={{ borderRadius: 2, mb: 1, bgcolor: 'rgba(0,0,0,0.06)' }} />
                      <Skeleton variant="rectangular" height={44} sx={{ borderRadius: 2, bgcolor: 'rgba(0,0,0,0.06)' }} />
                    </Box>
                  </Paper>
                ))}
              </SessionList>
            ) : polls.length === 0 ? (
              <EmptyState>
                <EmptyIcon>
                  <HowToVoteIcon />
                </EmptyIcon>
                <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: '#1a1a2e' }}>
                  No polls yet
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, color: '#555' }}>
                  Start a debate and see what others think!
                </Typography>
                {isAuthenticated && (
                  <Button
                    variant="contained"
                    onClick={() => setShowCreatePollModal(true)}
                    sx={{
                      borderRadius: 3,
                      px: 4,
                      background: 'linear-gradient(135deg, #7c5ecf, #9333ea)',
                    }}
                  >
                    📊 Create First Poll
                  </Button>
                )}
              </EmptyState>
            ) : (
              <Fade in>
                <SessionList>
                  {polls.map(poll => (
                    <PollCard
                      key={poll.id}
                      poll={poll}
                      userVote={userVotes[poll.id]}
                      onVote={handlePollVote}
                    />
                  ))}
                </SessionList>
              </Fade>
            )
          ) : null}

          {/* Share your knowledge CTA */}
          {isAuthenticated && (
            <ShareKnowledgeSection>
              <ShareKnowledgeIconWrapper>
                <RocketIcon />
              </ShareKnowledgeIconWrapper>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#1a1a2e', mb: 1 }}>
                Share your knowledge
              </Typography>
              <Typography variant="body2" sx={{ color: '#555', mb: 2.5, maxWidth: 320, mx: 'auto' }}>
                Write a post to share your recent learnings or achievements with the community.
              </Typography>
              <GradientButton
                variant="contained"
                onClick={() => setShowCreatePostModal(true)}
                sx={{ px: 3 }}
              >
                Create Post
              </GradientButton>
            </ShareKnowledgeSection>
          )}
        </MainContent>

        {/* ======= RIGHT SIDEBAR ======= */}
        {!isTablet && (
          <RightSidebar>
            {/* Invite Friends (authenticated) */}
            {isAuthenticated && (
              <InviteFriends />
            )}

            {/* Why Join Card (not authenticated) */}
            {!isAuthenticated && (
              <WhyJoinCard>
                <WhyJoinTitle>
                  <StarIcon /> Why Join ProfileAI?
                </WhyJoinTitle>
                <WhyJoinItem>
                  <WhyJoinItemIcon $bg="rgba(124, 94, 207, 0.1)" $color="#7c5ecf">
                    <AIIcon />
                  </WhyJoinItemIcon>
                  <WhyJoinItemText>
                    <h4>AI Resume Tailoring</h4>
                    <p>Customize your resume for every job in seconds</p>
                  </WhyJoinItemText>
                </WhyJoinItem>
                <WhyJoinItem>
                  <WhyJoinItemIcon $bg="rgba(99, 102, 241, 0.1)" $color="#6366f1">
                    <WandIcon />
                  </WhyJoinItemIcon>
                  <WhyJoinItemText>
                    <h4>Profile Enhancement</h4>
                    <p>AI rewrites your profile to stand out</p>
                  </WhyJoinItemText>
                </WhyJoinItem>
                <WhyJoinItem>
                  <WhyJoinItemIcon $bg="rgba(16, 185, 129, 0.1)" $color="#10b981">
                    <GroupsIcon />
                  </WhyJoinItemIcon>
                  <WhyJoinItemText>
                    <h4>Live Sessions</h4>
                    <p>Learn and teach with real professionals</p>
                  </WhyJoinItemText>
                </WhyJoinItem>
                <WhyJoinItem>
                  <WhyJoinItemIcon $bg="rgba(245, 158, 11, 0.1)" $color="#f59e0b">
                    <TeachIcon />
                  </WhyJoinItemIcon>
                  <WhyJoinItemText>
                    <h4>Cover Letters</h4>
                    <p>Generate tailored cover letters with AI</p>
                  </WhyJoinItemText>
                </WhyJoinItem>
                <WhyJoinCTA onClick={() => navigate('/register')}>
                  Get Started Free
                </WhyJoinCTA>
              </WhyJoinCard>
            )}
            

          </RightSidebar>
        )}
      </MainGrid>

      {/* Create Post Modal */}
      <Dialog
        open={showCreatePostModal}
        onClose={() => setShowCreatePostModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, overflow: 'visible', background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'linear-gradient(135deg, #7c5ecf, #9333ea)',
          color: 'white',
          borderRadius: '12px 12px 0 0',
          py: 1.5
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: 20 }}>✨</span>
            <Typography variant="h6" fontWeight={700}>Share Your Achievement</Typography>
          </Box>
          <IconButton onClick={() => setShowCreatePostModal(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, background: '#ffffff' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Category Selection */}
            <Box>
              <Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: '#555' }}>
                What are you celebrating?
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {[
                  { value: 'achievement', label: '🏆 Career Win', color: '#7c5ecf' },
                  { value: 'learning', label: '📚 Learning', color: '#818cf8' },
                  { value: 'project', label: '🚀 Project', color: '#9333ea' },
                  { value: 'milestone', label: '🎯 Milestone', color: '#c084fc' }
                ].map(cat => (
                  <Chip
                    key={cat.value}
                    label={cat.label}
                    onClick={() => setNewPostCategory(cat.value)}
                    sx={{
                      background: newPostCategory === cat.value ? cat.color : 'rgba(0,0,0,0.04)',
                      color: newPostCategory === cat.value ? 'white' : '#555',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        background: newPostCategory === cat.value ? cat.color : 'rgba(0,0,0,0.08)'
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Post Content */}
            <Box sx={{ position: 'relative' }}>
              <TextField
                inputRef={postTextFieldRef}
                multiline
                rows={4}
                placeholder={"Share what you've accomplished..."}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                fullWidth
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: showEmojiPicker || showUrlInput ? '8px 8px 0 0' : 2,
                    color: '#1a1a2e',
                    '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#7c5ecf' },
                  },
                  '& .MuiInputBase-input::placeholder': { color: '#888' }
                }}
              />

              {/* Action bar under textarea: emoji + link */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                p: '4px 8px',
                background: '#f8f8fc',
                border: '1px solid rgba(0,0,0,0.12)',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px'
              }}>
                <Tooltip title="Add Emoji">
                  <IconButton
                    size="small"
                    onClick={() => { setShowEmojiPicker(prev => !prev); setShowUrlInput(false); }}
                    sx={{ color: showEmojiPicker ? '#7c5ecf' : '#888', '&:hover': { color: '#7c5ecf' } }}
                  >
                    <EmojiIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Add Link">
                  <IconButton
                    size="small"
                    onClick={() => { setShowUrlInput(prev => !prev); setShowEmojiPicker(false); }}
                    sx={{ color: showUrlInput ? '#7c5ecf' : '#888', '&:hover': { color: '#7c5ecf' } }}
                  >
                    <LinkIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <Box sx={{
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderTop: 'none',
                  borderRadius: '0 0 12px 12px',
                  background: '#fff',
                  p: 1,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.25,
                  maxHeight: 160,
                  overflowY: 'auto'
                }}>
                  {['🎉', '🏆', '🚀', '💡', '🔥', '✨', '💪', '🎯', '👏', '❤️', '⭐', '📚', '💻', '🎓', '🤝', '🌟', '✅', '📈', '🙌', '💼',
                    '😊', '😍', '🤩', '😎', '🥰', '😄', '🤗', '🥳', '👍', '🙏', '💯', '❤️‍🔥', '👋', '🫶', '✌️',
                    '💼', '📊', '🏢', '💰', '📋', '🏅', '📝', '💎', '🔑', '⚡', '🎵', '🎁'].map((emoji, idx) => (
                    <Box
                      key={idx}
                      onClick={() => {
                        const el = postTextFieldRef.current;
                        const pos = el ? el.selectionStart : newPostContent.length;
                        setNewPostContent(prev => prev.substring(0, pos) + emoji + prev.substring(pos));
                        setShowEmojiPicker(false);
                        setTimeout(() => el?.focus(), 0);
                      }}
                      sx={{
                        fontSize: 24,
                        cursor: 'pointer',
                        p: 0.5,
                        borderRadius: 1,
                        transition: 'all 0.15s',
                        '&:hover': { background: 'rgba(124,94,207,0.1)', transform: 'scale(1.15)' }
                      }}
                    >
                      {emoji}
                    </Box>
                  ))}
                </Box>
              )}

              {/* URL Input */}
              {showUrlInput && (
                <Box sx={{
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderTop: 'none',
                  borderRadius: '0 0 12px 12px',
                  background: '#fff',
                  p: 1.5,
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-end'
                }}>
                  <TextField
                    size="small"
                    label="Text"
                    placeholder="Link text"
                    value={urlText}
                    onChange={(e) => setUrlText(e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    label="URL"
                    placeholder="https://..."
                    value={urlLink}
                    onChange={(e) => setUrlLink(e.target.value)}
                    sx={{ flex: 1.5 }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    disabled={!urlLink}
                    onClick={() => {
                      const display = urlText || urlLink;
                      const markdown = `[${display}](${urlLink})`;
                      const el = postTextFieldRef.current;
                      const pos = el ? el.selectionStart : newPostContent.length;
                      setNewPostContent(prev => prev.substring(0, pos) + markdown + prev.substring(pos));
                      setUrlText('');
                      setUrlLink('');
                      setShowUrlInput(false);
                      setTimeout(() => el?.focus(), 0);
                    }}
                    sx={{
                      background: '#7c5ecf',
                      minWidth: 'auto',
                      px: 2,
                      '&:hover': { background: '#6b4fbf' }
                    }}
                  >
                    Add
                  </Button>
                </Box>
              )}
            </Box>

            {/* Image Upload Section */}
            <Box>
              <input
                type="file"
                accept="image/*"
                id="post-image-upload"
                style={{ display: 'none' }}
                onChange={handlePostImageSelect}
              />
              {postImagePreview ? (
                <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
                  <img 
                    src={postImagePreview} 
                    alt="Preview" 
                    style={{ 
                      width: '100%', 
                      maxHeight: 200, 
                      objectFit: 'cover',
                      borderRadius: 8
                    }} 
                  />
                  <IconButton
                    size="small"
                    onClick={handleRemovePostImage}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      '&:hover': { background: 'rgba(0,0,0,0.8)' }
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Button
                  component="label"
                  htmlFor="post-image-upload"
                  variant="outlined"
                  startIcon={<ImageIcon />}
                  fullWidth
                  sx={{
                    borderStyle: 'dashed',
                    borderColor: 'rgba(0,0,0,0.12)',
                    color: '#555',
                    py: 1.5,
                    '&:hover': {
                      borderColor: '#7c5ecf',
                      background: 'rgba(124,94,207,0.08)'
                    }
                  }}
                >
                  Add Image (optional)
                </Button>
              )}
            </Box>

            {/* AI Quick Actions & Character count */}
            {newPostContent.length >= 10 && (
              <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.75,
                p: 1,
                background: 'linear-gradient(135deg, rgba(124,94,207,0.04), rgba(147,51,234,0.04))',
                borderRadius: 2,
                border: '1px solid rgba(124,94,207,0.1)'
              }}>
                <Typography variant="caption" sx={{ width: '100%', color: '#7c5ecf', fontWeight: 600, mb: 0.25 }}>
                  <AIIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                  AI Quick Actions
                </Typography>
                {[
                  { label: '✨ Enhance', action: () => handleAIEnhance() },
                ].map((item, idx) => (
                  <Chip
                    key={idx}
                    label={item.label}
                    size="small"
                    onClick={item.action}
                    disabled={aiEnhancing}
                    sx={{
                      fontSize: 11,
                      height: 26,
                      background: 'rgba(124,94,207,0.08)',
                      color: '#6b4fbf',
                      fontWeight: 500,
                      cursor: 'pointer',
                      '&:hover': { background: 'rgba(124,94,207,0.18)' }
                    }}
                  />
                ))}
                {aiEnhancing && <CircularProgress size={16} sx={{ color: '#7c5ecf', ml: 1 }} />}
                {aiEnhancedContent && (
                  <Chip 
                    size="small" 
                    label={`Engagement Score: ${aiEnhancedContent.score}%`}
                    sx={{ 
                      background: 'linear-gradient(135deg, rgba(124,94,207,0.15), rgba(147,51,234,0.15))',
                      color: '#7c5ecf',
                      fontWeight: 600,
                      fontSize: 11,
                      height: 26
                    }}
                  />
                )}
              </Box>
            )}

            {/* Character count & actions */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: '#888' }}>
                {newPostContent.length} characters
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  variant="text"
                  onClick={() => setShowCreatePostModal(false)}
                  sx={{ color: '#555' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCreatePost}
                  disabled={!newPostContent.trim() || postSubmitting || imageUploading}
                  sx={{
                    background: 'linear-gradient(135deg, #7c5ecf, #9333ea)',
                    px: 3,
                    '&:hover': {
                      background: 'linear-gradient(135deg, #9333ea, #6d28d9)',
                    }
                  }}
                >
                  {(postSubmitting || imageUploading) ? <CircularProgress size={20} sx={{ color: 'white' }} /> : '✨ Share'}
                </Button>
              </Box>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Coming Soon Snackbar */}
      <Snackbar
        open={showComingSoon}
        autoHideDuration={3000}
        onClose={() => setShowComingSoon(false)}
        message="🚀 AI Matching coming soon!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      
      {/* General Snackbar for messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* Post Info Modal */}
      <Dialog
        open={showPostInfoModal}
        onClose={() => setShowPostInfoModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' } }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #7c5ecf, #9333ea)', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: 24 }}>✨</span>
            <Typography variant="h6" fontWeight={700}>How Posts Work</Typography>
          </Box>
          <IconButton onClick={() => setShowPostInfoModal(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, background: '#ffffff' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ 
                width: 40, height: 40, borderRadius: 2, 
                background: 'rgba(124,94,207,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0
              }}>🏆</Box>
              <Box>
                <Typography fontWeight={600} gutterBottom sx={{ color: '#1a1a2e' }}>Share Your Achievements</Typography>
                <Typography variant="body2" sx={{ color: '#555' }}>
                  Celebrate career wins, new skills learned, projects launched, or milestones reached. Your success inspires others!
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ 
                width: 40, height: 40, borderRadius: 2, 
                background: 'rgba(124,94,207,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0
              }}>📝</Box>
              <Box>
                <Typography fontWeight={600} gutterBottom sx={{ color: '#1a1a2e' }}>Format Your Post</Typography>
                <Typography variant="body2" sx={{ color: '#555' }}>
                  Use the formatting toolbar to add bold, italic, lists, code snippets, and emojis to make your post stand out.
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ 
                width: 40, height: 40, borderRadius: 2, 
                background: 'rgba(147,51,234,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0
              }}>❤️</Box>
              <Box>
                <Typography fontWeight={600} gutterBottom sx={{ color: '#1a1a2e' }}>Engage & Connect</Typography>
                <Typography variant="body2" sx={{ color: '#555' }}>
                  Others can like and comment on your posts. Build your network by engaging with the community's achievements.
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 1, borderColor: 'rgba(0,0,0,0.06)' }} />
            
            <Box sx={{ background: 'rgba(124,94,207,0.08)', borderRadius: 2, p: 2, border: '1px solid rgba(124,94,207,0.15)' }}>
              <Typography variant="body2" fontWeight={600} color="#7c5ecf" gutterBottom>
                💡 Pro Tip
              </Typography>
              <Typography variant="body2" sx={{ color: '#555' }}>
                Posts with specific details get more engagement. Instead of "Got promoted!", try "Just got promoted to Senior Engineer after leading the migration to microservices!"
              </Typography>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Edit Post Modal */}
      <Dialog
        open={showEditPostModal}
        onClose={() => {
          setShowEditPostModal(false);
          setSelectedPost(null);
          setEditPostContent('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)' }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(135deg, #7c5ecf, #9333ea)',
          color: 'white',
          borderRadius: '12px 12px 0 0'
        }}>
          Edit Post
          <IconButton 
            onClick={() => {
              setShowEditPostModal(false);
              setSelectedPost(null);
              setEditPostContent('');
            }}
            size="small"
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ background: '#ffffff' }}>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={editPostContent}
            onChange={(e) => setEditPostContent(e.target.value)}
            placeholder="What's your achievement?"
            variant="outlined"
            sx={{ 
              mt: 1,
              '& .MuiOutlinedInput-root': {
                color: '#1a1a2e',
                '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
                '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#7c5ecf' },
              },
              '& .MuiInputBase-input::placeholder': { color: '#888' }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button 
              onClick={() => {
                setShowEditPostModal(false);
                setSelectedPost(null);
                setEditPostContent('');
              }}
              sx={{ color: '#555' }}
            >
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleSubmitEditPost}
              disabled={editPostSubmitting || !editPostContent.trim()}
              sx={{
                background: 'linear-gradient(135deg, #7c5ecf, #9333ea)',
                '&:hover': { background: 'linear-gradient(135deg, #9333ea, #6d28d9)' }
              }}
            >
              {editPostSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Post Options Menu */}
      <Menu
        anchorEl={postMenuAnchor}
        open={Boolean(postMenuAnchor)}
        onClose={handlePostMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            '& .MuiMenuItem-root': {
              color: '#1a1a2e',
              '&:hover': { background: 'rgba(124,94,207,0.08)' }
            }
          }
        }}
      >
        <MenuItem onClick={handleEditPost}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeletePost} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
      
      {/* Share Menu */}
      <ShareMenu
        anchorEl={shareMenuAnchor}
        open={Boolean(shareMenuAnchor)}
        onClose={handleCloseShareMenu}
        postId={sharePost?.id}
        postContent={sharePost?.content}
        authorName={sharePost?.author?.name || `${sharePost?.author?.firstName || ''} ${sharePost?.author?.lastName || ''}`}
      />

      {/* AI Processing Modal */}
      <AIProcessingModal 
        open={aiEnhancing}
        title="AI Enhancing Post"
        subtitle="AI is analyzing your content and making it more engaging..."
        phase="Optimizing Content for Maximum Engagement"
        type="enhancement"
      />

      {/* Create Poll Modal */}
      <CreatePollModal
        open={showCreatePollModal}
        onClose={() => setShowCreatePollModal(false)}
        onPollCreated={handlePollCreated}
      />
    </PageContainer>
  );
};

export default FeedPage;
