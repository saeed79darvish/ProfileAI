import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Avatar,
  Button,
  Chip,
  CircularProgress,
  Box,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Card,
  CardContent,
  CardActions,
  Grid,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Collapse
} from '@mui/material';
import WorkIcon from '@mui/icons-material/Work';
import EventIcon from '@mui/icons-material/Event';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import GetAppIcon from '@mui/icons-material/GetApp';
import ExtensionIcon from '@mui/icons-material/Extension';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TuneIcon from '@mui/icons-material/Tune';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import EmailIcon from '@mui/icons-material/Email';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PhoneIcon from '@mui/icons-material/Phone';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import GitHubIcon from '@mui/icons-material/GitHub';
import LanguageIcon from '@mui/icons-material/Language';
import AddIcon from '@mui/icons-material/Add';
import SchoolIcon from '@mui/icons-material/School';
import CodeIcon from '@mui/icons-material/Code';
import BusinessIcon from '@mui/icons-material/Business';
import StarIcon from '@mui/icons-material/Star';
import ArticleIcon from '@mui/icons-material/Article';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PsychologyIcon from '@mui/icons-material/Psychology';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import QuizIcon from '@mui/icons-material/Quiz';
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useAuth } from '@/contexts/AuthContext';
import { profileAPI, tailoredProfileAPI, subscriptionAPI, postAPI, resolveImageUrl } from '@/services/api';
import { formatDateRange } from '@/utils/dateRange';
import { diag } from '@/utils/diagLogger';
import ResumePreviewModal from '@/components/ResumePreviewModal';
import ProcessingModal from '@/components/ProcessingModal';
import EnhancePromptModal from '@/components/EnhancePromptModal';
import EnhancementPreviewModal from '@/components/EnhancementPreviewModal';
import GapReviewDialog from '@/components/GapReviewDialog';

// Icon aliases used throughout the component
const LocationIcon = LocationOnIcon;
const ViewIcon = VisibilityIcon;
const CopyIcon = ContentCopyIcon;
const EnhanceIcon = AutoFixHighIcon;
const TailorIcon = TuneIcon;
const TipsIcon = TipsAndUpdatesIcon;
const WebsiteIcon = LanguageIcon;
const CompanyIcon = BusinessIcon;

import {
  GreetingSection,
  GreetingCard,
  OnboardingCard,
  OnboardingStepContent,
  ExtensionCTA,
  PageContainer,
  AIToolsCard,
  AIToolsHeader,
  AIToolsGrid,
  AIToolButton,
  PublicLinkSection,
  LinkIcon,
  LinkText,
  LinkInput,
  MainContent,
  ContentGrid,
  DesktopSidebar,
  Sidebar,
  ProfileCard,
  ProfilePictureWrapper,
  ProfilePicture,
  EditProfileBtn,
  ProfileName,
  ProfileTitle,
  ContactInfo,
  ContactItem,
  AvailabilitySection,
  AvailabilityLabel,
  AvailabilityBadge,
  SkillsCard,
  CardHeader,
  CardTitle,
  SkillCategory,
  CategoryLabel,
  SkillTags,
  SkillTag,
  RightContent,
  TabsContainer,
  TabsHeader,
  TabContent,
  Section,
  SectionHeader,
  SectionTitle,
  SectionAction,
  SummaryText,
  ExperienceItem,
  CompanyLogo,
  ExperienceContent,
  ExperienceTitle,
  ExperienceCompany,
  ExperienceMeta,
  ExperienceSkills,
  ExperienceDescription,
  LoadingContainer,
  ExtensionInstalledCard,
  ProfileHero,
  HeroAvatar,
  HeroIdentity,
  HeroTitle,
  HeroMeta,
  HeroActions,
  HeroEditBtn,
  HeroShareStrip,
  stepDetailStyle,
  onboardingRemindBtnSx,
  onboardingBackBtnSx,
  onboardingInstallBtnSx,
  compactLearnMoreBtnSx,
  aiSummaryBoxSx,
  tabsSx,
  postCardSx,
  tailoredCardSx
} from './styled';
import { ROUTES, ALLOWED_RESUME_TYPES, TIMINGS as DASH_TIMINGS, LIMITS, EXTENSION_STEPS_DATA } from './constants';
import { COMPANY_LOGO_COLORS, EXTENSION_STEP_COLORS } from './styled';
import { getGreeting } from './utils';

// SVG illustrations for each step
const StepIllustrations = {
  install: (
    <svg viewBox="0 0 80 80" fill="none">
      <rect x="8" y="12" width="64" height="44" rx="6" fill="#E8EAFF" stroke="#667eea" strokeWidth="1.5"/>
      <rect x="8" y="56" width="64" height="4" rx="2" fill="#667eea" opacity="0.2"/>
      <rect x="32" y="60" width="16" height="8" rx="2" fill="#667eea" opacity="0.15"/>
      <circle cx="40" cy="34" r="12" fill="#667eea" opacity="0.15"/>
      <path d="M40 26v12m0 0l-4-4m4 4l4-4" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="34" y="42" width="12" height="2" rx="1" fill="#667eea" opacity="0.6"/>
      <circle cx="58" cy="20" r="6" fill="#f59e0b" opacity="0.9"/>
      <path d="M56 20h4m-2-2v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  sync: (
    <svg viewBox="0 0 80 80" fill="none">
      <circle cx="25" cy="40" r="16" fill="#D1FAE5" stroke="#10b981" strokeWidth="1.5"/>
      <circle cx="25" cy="36" r="5" fill="#10b981" opacity="0.6"/>
      <path d="M18 46c0-4 3-7 7-7s7 3 7 7" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="55" cy="40" r="16" fill="#E8EAFF" stroke="#667eea" strokeWidth="1.5"/>
      <rect x="49" y="34" width="12" height="12" rx="2" fill="#667eea" opacity="0.2"/>
      <path d="M52 38h6m-6 3h4" stroke="#667eea" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M36 36l5 4-5 4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
      <path d="M44 36l-5 4 5 4" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
    </svg>
  ),
  autofill: (
    <svg viewBox="0 0 80 80" fill="none">
      <rect x="10" y="14" width="42" height="52" rx="4" fill="#FEF3C7" stroke="#f59e0b" strokeWidth="1.5"/>
      <rect x="16" y="22" width="24" height="3" rx="1.5" fill="#f59e0b" opacity="0.3"/>
      <rect x="16" y="28" width="30" height="3" rx="1.5" fill="#f59e0b" opacity="0.2"/>
      <rect x="16" y="34" width="20" height="3" rx="1.5" fill="#f59e0b" opacity="0.3"/>
      <rect x="16" y="40" width="28" height="3" rx="1.5" fill="#f59e0b" opacity="0.2"/>
      <rect x="16" y="46" width="18" height="3" rx="1.5" fill="#f59e0b" opacity="0.3"/>
      <rect x="16" y="52" width="26" height="3" rx="1.5" fill="#f59e0b" opacity="0.2"/>
      <circle cx="58" cy="52" r="14" fill="#667eea"/>
      <path d="M52 52l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M56 22c2-4 8-4 10 0" stroke="#764ba2" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <circle cx="61" cy="18" r="2" fill="#764ba2" opacity="0.4"/>
    </svg>
  ),
  tailor: (
    <svg viewBox="0 0 80 80" fill="none">
      <rect x="6" y="18" width="32" height="44" rx="4" fill="#FCE7F3" stroke="#ec4899" strokeWidth="1.5"/>
      <rect x="12" y="26" width="20" height="2" rx="1" fill="#ec4899" opacity="0.3"/>
      <rect x="12" y="31" width="16" height="2" rx="1" fill="#ec4899" opacity="0.2"/>
      <rect x="12" y="36" width="22" height="2" rx="1" fill="#ec4899" opacity="0.3"/>
      <rect x="42" y="18" width="32" height="44" rx="4" fill="#E8EAFF" stroke="#667eea" strokeWidth="1.5"/>
      <rect x="48" y="26" width="20" height="2" rx="1" fill="#667eea" opacity="0.3"/>
      <rect x="48" y="31" width="16" height="2" rx="1" fill="#667eea" opacity="0.2"/>
      <rect x="48" y="36" width="22" height="2" rx="1" fill="#667eea" opacity="0.3"/>
      <circle cx="40" cy="54" r="10" fill="linear-gradient(135deg, #ec4899, #667eea)" opacity="0.15"/>
      <circle cx="40" cy="54" r="10" fill="none" stroke="#764ba2" strokeWidth="1.5"/>
      <path d="M37 54l2 2 4-4" stroke="#764ba2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M30 14l10 4 10-4" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      <circle cx="40" cy="12" r="3" fill="#f59e0b" opacity="0.7"/>
    </svg>
  )
};

const stepIllustrations = [
  StepIllustrations.install,
  StepIllustrations.sync,
  StepIllustrations.autofill,
  StepIllustrations.tailor,
];

const extensionSteps = EXTENSION_STEPS_DATA.map((step, i) => ({
  ...step,
  ...EXTENSION_STEP_COLORS[i],
  illustration: stepIllustrations[i],
}));

// Truncate a string in the middle so the start and end remain visible.
// e.g. truncateMiddle("https://profileai.example.com/saeed", 22) →
//      "https://prof…/saeed"
const truncateMiddle = (value, max = 36) => {
  if (!value) return '';
  const str = String(value);
  if (str.length <= max) return str;
  const ellipsis = '…';
  const keep = max - ellipsis.length;
  // Slightly favour the end (slug/handle) over the protocol/host.
  const start = Math.ceil(keep * 0.55);
  const end = keep - start;
  return `${str.slice(0, start)}${ellipsis}${str.slice(str.length - end)}`;
};

// Pick the best identifier for the public profile URL.
//
// Order of preference:
//   1. profile.slug          ← when the backend ships slug support, this wins
//   2. user.slug / user.username
//   3. user.id (UUID)        ← current behavior, always works
//
// We deliberately do NOT generate a slug from firstName + lastName client-side,
// because the backend currently only resolves UUIDs at GET /profiles/:id —
// faking a slug would produce share links that 404 for everyone except the
// owner. Once the backend adds a slug column + lookup, this helper will
// automatically start emitting pretty URLs without any other code changes.
const getProfileSlug = (user, profile) => {
  if (profile && profile.slug) return profile.slug;
  if (user && (user.slug || user.username)) return user.slug || user.username;
  return user && user.id ? user.id : '';
};

// ============ MAIN COMPONENT ============

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, isAuthenticated, isValidating } = useAuth();
  const authDebugEnabled =
    window.location.search.includes('authDebug=1') ||
    localStorage.getItem('profileai_auth_debug') === '1';
  const authDebug = (...args) => {
    if (authDebugEnabled) console.log('[AUTH_FLOW][Dashboard]', ...args);
  };
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const TAB_MAP = { overview: 0, experience: 1, skills: 2, education: 3, tailored: 4, settings: 5 };
  const [activeTab, setActiveTab] = useState(() => TAB_MAP[searchParams.get('tab')] ?? 0);
  const requestedTab = searchParams.get('tab');
  const requestedResumeId = searchParams.get('resumeId') || searchParams.get('appId');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  
  // Tailored profiles state
  const [tailoredProfiles, setTailoredProfiles] = useState([]);
  const [loadingTailored, setLoadingTailored] = useState(false);
  const [selectedTailored, setSelectedTailored] = useState(null);
  const [showTailoredDialog, setShowTailoredDialog] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  
  // Interview prep interactive state
  const [interviewPrepStep, setInterviewPrepStep] = useState('ask'); // 'ask' | 'details' | 'loading' | 'results'
  const [gotInterview, setGotInterview] = useState(null); // null | true | false
  const [interviewLevel, setInterviewLevel] = useState('');
  const [interviewFormat, setInterviewFormat] = useState('');
  const [specificConcerns, setSpecificConcerns] = useState('');
  const [generatedPrep, setGeneratedPrep] = useState(null);
  const [prepError, setPrepError] = useState('');
  
  // Resume download state
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [downloadTailoredId, setDownloadTailoredId] = useState(null);
  const [downloadTailoredTitle, setDownloadTailoredTitle] = useState(null);
  
  // Resume upload state
  const [uploadingResume, setUploadingResume] = useState(false);
  
  // AI Usage state
  const [aiUsage, setAiUsage] = useState(null);

  // In-place Enhancement state
  const [showEnhancePrompt, setShowEnhancePrompt] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [pendingEnhancements, setPendingEnhancements] = useState(null);
  const [showEnhancementPreview, setShowEnhancementPreview] = useState(false);
  const [enhanceSaving, setEnhanceSaving] = useState(false);

  // In-place Tips/Feedback state
  const [gettingTips, setGettingTips] = useState(false);
  const [tips, setTips] = useState(null);
  const [showTipsDialog, setShowTipsDialog] = useState(false);

  // In-place Tailor state
  const [showTailorJobInput, setShowTailorJobInput] = useState(false);
  const [tailorJobDesc, setTailorJobDesc] = useState('');
  const [analyzingGaps, setAnalyzingGaps] = useState(false);
  const [detectedGaps, setDetectedGaps] = useState([]);
  const [satisfiedAlts, setSatisfiedAlts] = useState([]);
  const [showGapReview, setShowGapReview] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [tailorResult, setTailorResult] = useState(null);
  const [showTailorResultDialog, setShowTailorResultDialog] = useState(false);
  const [savingTailored, setSavingTailored] = useState(false);

  // Extension onboarding state
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState('full'); // 'full' | 'compact' | 'hidden'

  useEffect(() => {
    diag('dashboard.mount', {
      userId: user?.id,
      role: user?.role,
      hasProfile: user?.hasProfile,
      authLoading,
      isAuthenticated,
    });
    return () => diag('dashboard.unmount');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const nextTab = TAB_MAP[requestedTab];
    if (nextTab !== undefined && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, requestedTab]);

  // Derived values
  const companyLogoColors = COMPANY_LOGO_COLORS;
  const allowedTypes = ALLOWED_RESUME_TYPES;
  const profileData = {
    title: profile?.title || '',
    summary: profile?.summary || '',
    skills: profile?.skills ? Object.values(profile.skills).flat() : [],
    experience: profile?.experience || [],
    education: profile?.education || [],
    projects: profile?.projects || []
  };

  // Detect if extension is installed via DOM attribute + custom event
  useEffect(() => {
    const checkExtension = () => {
      const marker = document.documentElement.getAttribute('data-profileai-extension');
      if (marker === 'installed') {
        setExtensionInstalled(true);
        setOnboardingMode('hidden');
        return true;
      }
      return false;
    };
    
    // Check immediately (extension may already be loaded)
    if (!checkExtension()) {
      // Listen for the custom event dispatched by authBridge.js
      const handleExtensionDetected = () => {
        setExtensionInstalled(true);
        setOnboardingMode('hidden');
      };
      window.addEventListener('profileai-extension-detected', handleExtensionDetected);
      
      // Also poll a few times as fallback
      const timer1 = setTimeout(checkExtension, 1000);
      const timer2 = setTimeout(checkExtension, 3000);
      const timer3 = setTimeout(checkExtension, 6000);
      
      return () => {
        window.removeEventListener('profileai-extension-detected', handleExtensionDetected);
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, []);

  // Session-based dismiss: show full onboarding each login, unless extension installed
  useEffect(() => {
    if (extensionInstalled) {
      setOnboardingMode('hidden');
    } else {
      const dismissed = sessionStorage.getItem('profileai_ext_onboarding_session');
      setOnboardingMode(dismissed === 'compact' ? 'compact' : 'full');
    }
  }, [extensionInstalled]);

  const handleDismissOnboarding = () => {
    setOnboardingMode('compact');
    sessionStorage.setItem('profileai_ext_onboarding_session', 'compact');
  };

  const handleShowFullOnboarding = () => {
    setOnboardingStep(0);
    setOnboardingMode('full');
    sessionStorage.removeItem('profileai_ext_onboarding_session');
  };

  // Posts state
  const [userPosts, setUserPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const publicProfileUrl = user
    ? `${window.location.origin}/profile/${getProfileSlug(user, profile)}`
    : '';

  // Redirect recruiters away from the candidate dashboard. Admins are
  // allowed to view /profile so they can dogfood the candidate surface;
  // they can still reach the admin panel from the navbar.
  useEffect(() => {
    authDebug('role redirect check', {
      role: user?.role,
      hasProfile: user?.hasProfile,
      authLoading,
      isValidating,
      loading
    });
    if (user?.role === 'recruiter') {
      navigate('/recruiter/dashboard');
    } else if (
      user?.role === 'candidate' &&
      user?.hasProfile === false &&
      // Don't trust the eagerly-hydrated localStorage flag — it's commonly
      // stale right after a fresh register+createProfile flow. Wait until
      // the background /auth/me call confirms the user genuinely has no
      // profile before bouncing to onboarding.
      !isValidating
    ) {
      authDebug('redirect candidate to onboarding (hasProfile false)');
      navigate('/onboarding');
    }
  }, [user, navigate, isValidating]);

  useEffect(() => {
    if (
      !authLoading &&
      !isValidating &&
      !loading &&
      user?.role === 'candidate' &&
      !profile &&
      !error
    ) {
      authDebug('redirect candidate to onboarding (no profile loaded)');
      navigate('/onboarding');
    }
  }, [authLoading, isValidating, loading, user, profile, error, navigate]);

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        authDebug('skip loadProfile: no user');
        diag('dashboard.loadProfile.skip', { reason: 'no-user' });
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        authDebug('loadProfile request start', { userId: user?.id, role: user?.role });
        diag('dashboard.loadProfile.start', { userId: user?.id, role: user?.role });
        const response = await profileAPI.getMyProfile();
        authDebug('loadProfile success', {
          hasData: !!response?.data,
          title: response?.data?.title || null
        });
        diag('dashboard.loadProfile.success', {
          hasData: !!response?.data,
          title: response?.data?.title || null,
          profileId: response?.data?.id || null,
        });
        setProfile(response.data);
      } catch (err) {
        authDebug('loadProfile error', {
          status: err?.response?.status,
          message: err?.response?.data?.message || err?.message
        });
        diag('dashboard.loadProfile.error', {
          status: err?.response?.status,
          message: err?.response?.data?.message || err?.message,
          code: err?.code,
        });
        if (err.response?.status === 404) {
          // Check if user has an in-progress draft before redirecting to onboarding
          try {
            const draftKey = `profileai_draft_${user?.id || 'unknown'}`;
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
              const draft = JSON.parse(savedDraft);
              if (draft && (draft.title || draft.summary || draft.experience?.length > 0)) {
                navigate('/profile/create-form');
                return;
              }
            }
          } catch (draftErr) {
            // ignore draft check errors
          }
          // If the user has already seen the onboarding intro, send them
          // straight to the create-profile screen instead of looping back
          // through the intro slides on every visit.
          try {
            if (localStorage.getItem('profileai_seen_onboarding') === '1') {
              navigate('/profile/create');
              return;
            }
          } catch (flagErr) {
            // ignore localStorage read errors
          }
          navigate('/onboarding');
        } else {
          setError(err.response?.data?.message || 'Failed to load profile');
        }
      } finally {
        authDebug('loadProfile finished');
        setLoading(false);
      }
    };
    
    if (user) {
      loadProfile();
      loadTailoredProfiles();
      loadUserPosts();
      loadAiUsage();
    }
  }, [user, navigate]);

  const loadAiUsage = async () => {
    try {
      const response = await subscriptionAPI.getUsage();
      setAiUsage(response.data);
    } catch (err) {
      console.error('Failed to load AI usage:', err);
    }
  };

  const getUsageBadge = (featureKey) => {
    if (!aiUsage?.usage?.[featureKey]) {
      return (
        <span className="usage-info">
          <span className="usage-dot" />
          <span className="usage-count">UNLIMITED</span>
        </span>
      );
    }
    const data = aiUsage.usage[featureKey];
    const remaining = data.weeklyRemaining ?? data.weeklyLimit;
    if (remaining === -1 || remaining == null) {
      return (
        <span className="usage-info">
          <span className="usage-dot" />
          <span className="usage-count">UNLIMITED</span>
        </span>
      );
    }
    const cls = remaining === 0 ? 'danger' : remaining <= 1 ? 'warning' : '';
    return (
      <span className="usage-info">
        <span className={`usage-dot ${cls}`} />
        <span className={`usage-count ${cls}`}>{remaining} CREDITS LEFT</span>
      </span>
    );
  };

  const formatRelativeAge = (date) => {
    if (!date) return '';
    const ts = new Date(date).getTime();
    if (!Number.isFinite(ts)) return '';
    const diffMs = Date.now() - ts;
    const mins = Math.max(1, Math.round(diffMs / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.round(days / 30);
    return `${months}mo ago`;
  };

  const getTailoredProvenanceLabel = (tailored) => {
    const isApplyPilot = tailored?.source === 'applypilot' || !!tailored?.applyPilotApplicationId;
    if (!isApplyPilot) return '';
    const company = tailored?.sourceMeta?.company || tailored?.companyName || 'your';
    const submittedAt = tailored?.sourceMeta?.submittedAt;
    const anchorDate = submittedAt || tailored?.applyPilotSyncedAt || tailored?.updatedAt || tailored?.createdAt;
    const age = formatRelativeAge(anchorDate);
    if (submittedAt) return `From your ${company} application · submitted ${age}`;
    return `From your ${company} application · synced ${age}`;
  };

  const loadTailoredProfiles = async () => {
    setLoadingTailored(true);
    try {
      const response = await tailoredProfileAPI.getAll();
      setTailoredProfiles(response.data);
    } catch (err) {
      console.error('Failed to load tailored profiles:', err);
    } finally {
      setLoadingTailored(false);
    }
  };
  
  const loadUserPosts = async () => {
    if (!user?.id) return;
    setLoadingPosts(true);
    try {
      const response = await postAPI.getByUser(user.id);
      // Response is { posts, pagination } structure
      setUserPosts(response.data?.posts || response.data || []);
    } catch (err) {
      console.error('Failed to load user posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  };
  
  // Handle resume upload
  const handleResumeUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!allowedTypes.includes(file.type)) {
      setSnackbar({ open: true, message: 'Please upload a PDF or DOCX file' });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setSnackbar({ open: true, message: 'File size must be less than 5MB' });
      return;
    }

    setUploadingResume(true);

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await profileAPI.uploadResume(formData);
      
      if (response.data.success) {
        // Navigate to profile form with parsed data
        navigate('/profile/edit', {
          state: { resumeData: response.data.data }
        });
        setSnackbar({ open: true, message: 'Resume parsed successfully! Review and save your updated profile.' });
      } else {
        setSnackbar({ open: true, message: 'Failed to parse resume. Please try again.' });
      }
    } catch (err) {
      console.error('Error uploading resume:', err);
      setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to upload resume.' });
    } finally {
      setUploadingResume(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const handleViewTailored = (tailored) => {
    setSelectedTailored(tailored);
    setShowTailoredDialog(true);
    // Reset interview prep state
    setGotInterview(null);
    setInterviewLevel('');
    setInterviewFormat('');
    setSpecificConcerns('');
    setPrepError('');
    const draft = tailored?.tailoredData?.interviewPrepDraft;
    if (draft) {
      setGeneratedPrep(null);
      setInterviewPrepStep('details');
      setGotInterview(true);
      setInterviewLevel(draft.round || '');
      setInterviewFormat(draft.format || '');
      setSpecificConcerns(draft.inviteMeta?.specificConcerns || '');
      return;
    }
    // Check if prep was already generated for this profile
    if (tailored.tailoredData?.interviewPrep && tailored.tailoredData?.interviewPrepMeta) {
      setGeneratedPrep(tailored.tailoredData.interviewPrep);
      setInterviewPrepStep('results');
      setGotInterview(true);
      setInterviewLevel(tailored.tailoredData.interviewPrepMeta.interviewLevel || '');
      setInterviewFormat(tailored.tailoredData.interviewPrepMeta.interviewFormat || '');
    } else {
      setGeneratedPrep(null);
      setInterviewPrepStep('ask');
    }
  };

  useEffect(() => {
    if (activeTab !== 4) return;
    if (!requestedResumeId) return;
    if (showTailoredDialog && String(selectedTailored?.id) === String(requestedResumeId)) return;

    const match = (tailoredProfiles || []).find((tp) => (
      String(tp?.id) === String(requestedResumeId)
      || String(tp?.applyPilotApplicationId) === String(requestedResumeId)
    ));

    if (match) {
      handleViewTailored(match);
    }
  }, [activeTab, requestedResumeId, selectedTailored?.id, showTailoredDialog, tailoredProfiles]);

  const handleGenerateInterviewPrep = async () => {
    if (!interviewLevel) {
      setPrepError('Please select an interview round/stage');
      return;
    }
    setInterviewPrepStep('loading');
    setPrepError('');
    try {
      const response = await tailoredProfileAPI.generateInterviewPrep(selectedTailored.id, {
        interviewLevel,
        interviewFormat,
        specificConcerns
      });
      if (response.data.success) {
        setGeneratedPrep(response.data.interviewPrep);
        setInterviewPrepStep('results');
        // Update the local state so re-opening shows the results
        setSelectedTailored(prev => ({
          ...prev,
          tailoredData: {
            ...prev.tailoredData,
            interviewPrep: response.data.interviewPrep,
            interviewPrepMeta: response.data.interviewPrepMeta
          }
        }));
        // Update in the list too
        setTailoredProfiles(prev => prev.map(tp => 
          tp.id === selectedTailored.id 
            ? { ...tp, tailoredData: { ...tp.tailoredData, interviewPrep: response.data.interviewPrep, interviewPrepMeta: response.data.interviewPrepMeta } }
            : tp
        ));
      } else {
        setPrepError('Failed to generate interview prep. Please try again.');
        setInterviewPrepStep('details');
      }
    } catch (err) {
      console.error('Error generating interview prep:', err);
      setPrepError(err.response?.data?.error || 'Failed to generate interview prep.');
      setInterviewPrepStep('details');
    }
  };

  const handleDeleteTailored = async (id) => {
    setDeletingId(id);
    try {
      await tailoredProfileAPI.delete(id);
      setTailoredProfiles(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to delete tailored profile' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadResume = (tailoredId = null, tailoredTitle = null) => {
    setDownloadTailoredId(tailoredId);
    setDownloadTailoredTitle(tailoredTitle);
    setShowResumeDialog(true);
  };

  // In-place Enhancement: call API → show preview
  const handleEnhanceInPlace = async (customPrompt = '') => {
    setShowEnhancePrompt(false);
    setEnhancing(true);
    try {
      const response = await profileAPI.enhanceResumeData(profileData, customPrompt.trim() || undefined);
      if (response.data.success) {
        setPendingEnhancements(response.data.data);
        setShowEnhancementPreview(true);
      } else {
        setSnackbar({ open: true, message: response.data.message || 'Enhancement failed' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Enhancement failed. Please try again.' });
    } finally {
      setEnhancing(false);
    }
  };

  // Apply selected enhancement sections and save to DB
  const handleApplyEnhancements = async (selectedSections, _saveNow) => {
    if (!pendingEnhancements) return;
    setEnhanceSaving(true);
    try {
      const enhanced = pendingEnhancements;
      const updatedProfile = { ...profile };
      const skillsObj = {};
      if (selectedSections.title && enhanced.title) updatedProfile.title = enhanced.title;
      if (selectedSections.summary && enhanced.summary) updatedProfile.summary = enhanced.summary;
      if (selectedSections.skills && enhanced.skills?.length) {
        enhanced.skills.forEach(s => {
          const cat = s.category || 'General';
          if (!skillsObj[cat]) skillsObj[cat] = [];
          skillsObj[cat].push(s.name || s);
        });
        updatedProfile.skills = skillsObj;
      }
      if (selectedSections.experience && enhanced.experience?.length) updatedProfile.experience = enhanced.experience;
      if (selectedSections.education && enhanced.education?.length) updatedProfile.education = enhanced.education;
      if (selectedSections.projects && enhanced.projects?.length) updatedProfile.projects = enhanced.projects;

      await profileAPI.createOrUpdateProfile(updatedProfile);
      const refreshed = await profileAPI.getMyProfile();
      setProfile(refreshed.data);
      loadAiUsage();
      setPendingEnhancements(null);
      setShowEnhancementPreview(false);
      setSnackbar({ open: true, message: 'Profile enhanced and saved successfully!' });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to save enhanced profile' });
    } finally {
      setEnhanceSaving(false);
    }
  };

  // In-place AI Recruiter Feedback
  const handleGetTipsInPlace = async () => {
    setGettingTips(true);
    try {
      const response = await profileAPI.getEnhancementSuggestions(profileData);
      if (response.data.success) {
        setTips(response.data.suggestions);
        setShowTipsDialog(true);
      } else {
        setSnackbar({ open: true, message: 'Could not get feedback' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to get feedback. Please try again.' });
    } finally {
      setGettingTips(false);
    }
  };

  // In-place Tailor: Step 1 – Analyze gaps
  const handleAnalyzeGaps = async () => {
    if (!tailorJobDesc.trim() || tailorJobDesc.trim().length < 50) {
      setSnackbar({ open: true, message: 'Please provide a detailed job description (at least 50 characters)' });
      return;
    }
    setShowTailorJobInput(false);
    setAnalyzingGaps(true);
    try {
      const response = await profileAPI.analyzeGaps({ profileData, jobDescription: tailorJobDesc });
      if (response.data.success) {
        setDetectedGaps(response.data.gaps || []);
        setSatisfiedAlts(response.data.satisfiedAlternatives || []);
        setShowGapReview(true);
      } else {
        setSnackbar({ open: true, message: response.data.error || 'Failed to analyze gaps' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Gap analysis failed. Please try again.' });
    } finally {
      setAnalyzingGaps(false);
    }
  };

  // In-place Tailor: Step 2 – Tailor profile
  const handleGapReviewContinue = async (gapSelections) => {
    setShowGapReview(false);
    setTailoring(true);
    try {
      const response = await profileAPI.tailorProfileForJob({
        profileData,
        jobDescription: tailorJobDesc,
        gapSelections
      });
      if (response.data.success) {
        setTailorResult(response.data.data);
        setShowTailorResultDialog(true);
      } else {
        setSnackbar({ open: true, message: response.data.error || 'Tailoring failed' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Tailoring failed. Please try again.' });
    } finally {
      setTailoring(false);
    }
  };

  // In-place Tailor: Step 3 – Save tailored profile
  const handleSaveTailoredProfile = async () => {
    if (!tailorResult) return;
    setSavingTailored(true);
    try {
      const jobTitle = tailorResult.jobTitle || tailorResult.title || 'Untitled Position';
      const companyName = tailorResult.company || '';
      const matchScore = tailorResult.matchScore || null;

      const tailoredData = {
        title: tailorResult.title || profile?.title || '',
        summary: tailorResult.summary || profile?.summary || '',
        skills: tailorResult.skills || Object.values(profile?.skills || {}).flat(),
        experience: tailorResult.experience || profile?.experience || [],
        education: profile?.education || [],
        projects: tailorResult.projects || profile?.projects || [],
        location: profile?.location || '',
        phone: profile?.phone || '',
        linkedinUrl: profile?.linkedinUrl || '',
        githubUrl: profile?.githubUrl || '',
        matchAnalysis: tailorResult.matchAnalysis || null
      };

      await tailoredProfileAPI.save({
        jobTitle,
        companyName,
        tailoredData,
        matchScore,
        skillGaps: tailorResult._skillGaps || detectedGaps || [],
        learningPlan: tailorResult._learningPlan || null
      });

      setShowTailorResultDialog(false);
      setTailorResult(null);
      setTailorJobDesc('');
      setDetectedGaps([]);
      setSatisfiedAlts([]);
      // Reload tailored profiles list
      loadTailoredProfiles();
      loadAiUsage();
      setSnackbar({ open: true, message: `Tailored version "${jobTitle}" saved successfully!` });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to save tailored version' });
    } finally {
      setSavingTailored(false);
    }
  };
  
  const [linkCopied, setLinkCopied] = useState(false);
  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicProfileUrl);
    setSnackbar({ open: true, message: 'Link copied to clipboard!' });
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
  };
  
  const handleViewPublic = () => {
    window.open(publicProfileUrl, '_blank');
  };
  
  const handleEditProfile = () => {
    navigate('/profile/edit');
  };
  
  // Parse skills into display format
  const getSkillCategories = () => {
    const skills = profile?.skills || {};
    if (typeof skills === 'object' && !Array.isArray(skills)) {
      return skills;
    }
    return {};
  };
  
  // Show loading while auth is being checked
  if (authLoading || loading) {
    return (
      <PageContainer>
        <LoadingContainer>
          <CircularProgress />
        </LoadingContainer>
      </PageContainer>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }
  
  // Don't render candidate dashboard for non-candidates
  if (user?.role === 'recruiter' || user?.role === 'admin') {
    return null;
  }

  if (error) {
    return (
      <PageContainer>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="error">{error}</Typography>
        </Box>
      </PageContainer>
    );
  }

  if (!profile) {
    return null;
  }
  
  const skillCategories = getSkillCategories();
  const experience = profile?.experience || [];
  const education = profile?.education || [];
  const projects = profile?.projects || [];

  const isCurrentExp = (exp) => {
    // Explicit current flags always win
    if (exp.current === true || exp.isCurrent === true) return true;
    // If an end date is set, only "Present"/"Current" counts as ongoing
    if (exp.endDate != null && exp.endDate !== '') {
      return /present|current/i.test(String(exp.endDate));
    }
    // Otherwise infer from period text if present
    if (exp.period) {
      return /present|current/i.test(exp.period);
    }
    // No end signal at all → not current (avoid false positives on legacy data)
    return false;
  };

  const getExpPeriod = (exp) => {
    const formatted = formatDateRange(exp.startDate, exp.endDate);
    if (formatted) return formatted;
    return exp.period || '';
  };

  const renderExperienceItem = (exp, idx, truncateDesc = false) => (
    <ExperienceItem key={idx}>
      <CompanyLogo style={{ background: companyLogoColors[idx % companyLogoColors.length] }}>
        <WorkIcon />
      </CompanyLogo>
      <ExperienceContent>
        <ExperienceTitle>{exp.title || exp.position}</ExperienceTitle>
        <ExperienceCompany>
          <span className="company-name">{exp.company}</span>
          {exp.employmentType && (
            <>
              <span className="separator">·</span>
              <span className="employment-type">{exp.employmentType}</span>
            </>
          )}
        </ExperienceCompany>
        <ExperienceMeta>
          <span className="meta-date">
            <EventIcon />
            {getExpPeriod(exp)}
          </span>
          {isCurrentExp(exp) && (
            <span className="current-badge">Current</span>
          )}
          {exp.location && (
            <span className="meta-location">
              <LocationIcon />
              {exp.location}
            </span>
          )}
        </ExperienceMeta>
        <ExperienceDescription>
          {truncateDesc 
            ? <>{exp.description?.substring(0, 200)}{exp.description?.length > 200 && '...'}</> 
            : exp.description
          }
        </ExperienceDescription>
        {exp.skills && exp.skills.length > 0 && (
          <ExperienceSkills>
            {exp.skills.map((skill, sIdx) => (
              <span key={sIdx} className="skill-tag">{skill}</span>
            ))}
          </ExperienceSkills>
        )}
      </ExperienceContent>
    </ExperienceItem>
  );

  return (
    <PageContainer>
      {/* Main Content */}
      <MainContent>
        {/* Profile Hero, identity-first header */}
        <ProfileHero>
          <HeroAvatar src={resolveImageUrl(profile?.profilePicture)} alt={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}>
            {user?.firstName?.[0]}
          </HeroAvatar>
          <HeroIdentity>
            <h1>{user?.firstName} {user?.lastName}</h1>
            {(profile?.title || profile?.headline) && (
              <HeroTitle>{profile?.title || profile?.headline}</HeroTitle>
            )}
            <HeroMeta>
              {profile?.location && (
                <span className="meta-item">
                  <LocationIcon /> {profile.location}
                </span>
              )}
              <span className="availability">
                <span className="dot" /> Open to work
              </span>
            </HeroMeta>
          </HeroIdentity>
          <HeroActions>
            <HeroEditBtn onClick={handleEditProfile}>
              <EditIcon /> Edit<span className="edit-profile-suffix">&nbsp;Profile</span>
            </HeroEditBtn>
            <HeroShareStrip>
              <Tooltip title={publicProfileUrl}>
                <button
                  type="button"
                  className={`ghost-btn${linkCopied ? ' copied' : ''}`}
                  onClick={handleCopyLink}
                  aria-label="Copy public profile link"
                >
                  {linkCopied ? (
                    <>
                      <CheckCircleIcon /> Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon /> Copy link
                    </>
                  )}
                </button>
              </Tooltip>
              <Tooltip title="Open public profile">
                <button
                  type="button"
                  className="ghost-btn icon-only"
                  onClick={handleViewPublic}
                  aria-label="Open public profile"
                >
                  <ViewIcon />
                </button>
              </Tooltip>
            </HeroShareStrip>
          </HeroActions>
        </ProfileHero>


        {/* AI Tools Card */}
        <AIToolsCard>
          <AIToolsHeader>
            <div className="icon">
              <EnhanceIcon />
            </div>
            <div className="text">
              <div className="title">AI-Powered Tools</div>
              <div className="subtitle">Enhance your profile and create tailored versions for different jobs</div>
            </div>
          </AIToolsHeader>
          <AIToolsGrid>
            <Tooltip title="Costs 1 AI credit per use">
              <AIToolButton
                onClick={() => setShowEnhancePrompt(true)}
                disabled={enhancing}
              >
                <span className="icon-wrap" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}><EnhanceIcon /></span>
                <span className="label">Enhance</span>
                <span className="description">Optimize your profile content automatically. · 1 credit</span>
                {getUsageBadge('profile_enhance')}
              </AIToolButton>
            </Tooltip>
            <Tooltip title="Costs 1 AI credit per use">
              <AIToolButton onClick={() => setShowTailorJobInput(true)} disabled={analyzingGaps || tailoring}>
                <span className="icon-wrap" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}><TailorIcon /></span>
                <span className="label">Tailor</span>
                <span className="description">Customize for specific job descriptions. · 1 credit</span>
                {getUsageBadge('tailor_profile')}
              </AIToolButton>
            </Tooltip>
            <Tooltip title="Costs 1 AI credit per use">
              <AIToolButton 
                onClick={handleGetTipsInPlace}
                disabled={gettingTips}
              >
                <span className="icon-wrap" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}><TipsIcon /></span>
                <span className="label">Career Tips</span>
                <span className="description">Get AI feedback on your profile. · 1 credit</span>
                {getUsageBadge('career_suggestions')}
              </AIToolButton>
            </Tooltip>
            <AIToolButton onClick={() => handleDownloadResume()}>
              <span className="icon-wrap" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}><DownloadIcon /></span>
              <span className="label">Download Resume</span>
              <span className="description">Export your profile as a PDF resume.</span>
              {getUsageBadge()}
            </AIToolButton>
          </AIToolsGrid>
        </AIToolsCard>

        {/* Skills are rendered once in the desktop sidebar below. The previous
            MobileProfileSection duplicated the Skills card into the DOM (it
            was hidden on desktop via CSS), which made screen readers and the
            text-only page dump report "Skills & Expertise" twice. Mobile users
            still get the skills via the Skills tab and via the public profile. */}
        
        {/* Content Grid */}
        <ContentGrid>
        {/* Left Sidebar - Hidden on mobile */}
        <DesktopSidebar>
        <Sidebar>
          {/* Contact Card.
              The avatar / name / title / location / "Edit Profile" / "Open to work"
              badge are all surfaced in the ProfileHero at the top of the page,
              so this card is now contact-only to avoid duplication. */}
          {(user?.email || profile?.phone || profile?.linkedinUrl || profile?.githubUrl || profile?.portfolioUrl) && (
            <ProfileCard>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
              </CardHeader>
              <ContactInfo>
                {user?.email && (
                  <ContactItem href={`mailto:${user.email}`}>
                    <EmailIcon /> {user.email}
                  </ContactItem>
                )}
                {profile?.phone && (
                  <ContactItem href={`tel:${profile.phone}`}>
                    <PhoneIcon /> {profile.phone}
                  </ContactItem>
                )}
                {profile?.linkedinUrl && (
                  <ContactItem href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer">
                    <LinkedInIcon /> LinkedIn
                  </ContactItem>
                )}
                {profile?.githubUrl && (
                  <ContactItem href={profile.githubUrl} target="_blank" rel="noopener noreferrer">
                    <GitHubIcon /> GitHub
                  </ContactItem>
                )}
                {profile?.portfolioUrl && (
                  <ContactItem href={profile.portfolioUrl} target="_blank" rel="noopener noreferrer">
                    <WebsiteIcon /> Portfolio
                  </ContactItem>
                )}
              </ContactInfo>
            </ProfileCard>
          )}
          
          {/* Skills Card */}
          <SkillsCard>
            <CardHeader>
              <CardTitle>Skills & Expertise</CardTitle>
              <IconButton size="small" onClick={handleEditProfile}>
                <AddIcon fontSize="small" />
              </IconButton>
            </CardHeader>
            
            {Object.entries(skillCategories).map(([category, skills]) => (
              skills && skills.length > 0 && (
                <SkillCategory key={category}>
                  <CategoryLabel>{category}</CategoryLabel>
                  <SkillTags>
                    {skills.map((skill, idx) => (
                      <SkillTag 
                        key={idx} 
                        $highlighted={idx < 3}
                      >
                        {skill}
                      </SkillTag>
                    ))}
                  </SkillTags>
                </SkillCategory>
              )
            ))}
          </SkillsCard>
          
          {/* Tailored Versions Card */}
          {tailoredProfiles.length > 0 && (
            <SkillsCard>
              <CardHeader>
                <CardTitle>Tailored Versions</CardTitle>
                <Chip label={tailoredProfiles.length} size="small" color="primary" />
              </CardHeader>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {tailoredProfiles.slice(0, 3).map((tailored) => (
                  <Box 
                    key={tailored.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      '&:hover': { bgcolor: 'rgba(91, 106, 191, 0.06)' }
                    }}
                    onClick={() => handleViewTailored(tailored)}
                  >
                    <WorkIcon fontSize="small" color="primary" sx={{ flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <Typography variant="body2" noWrap fontWeight={500} sx={{ color: '#13152a', display: 'block' }}>
                        {tailored.companyName || tailored.jobTitle}
                      </Typography>
                      {tailored.companyName && (
                        <Typography variant="caption" color="#7b7f9e" noWrap sx={{ display: 'block' }}>
                          {tailored.jobTitle}
                        </Typography>
                      )}
                    </Box>
                    {tailored.matchScore && (
                      <Chip 
                        label={`${tailored.matchScore}%`}
                        size="small"
                        color={tailored.matchScore >= 80 ? 'success' : 'warning'}
                        sx={{ height: 20, fontSize: 11, flexShrink: 0 }}
                      />
                    )}
                  </Box>
                ))}
                {tailoredProfiles.length > 3 && (
                  <Button 
                    size="small" 
                    onClick={() => setActiveTab(4)}
                    sx={{ textTransform: 'none', color: '#5b6abf' }}
                  >
                    View all ({tailoredProfiles.length})
                  </Button>
                )}
              </Box>
            </SkillsCard>
          )}
        </Sidebar>
        </DesktopSidebar>
        
        {/* Right Content */}
        <RightContent>
          <TabsContainer>
            <TabsHeader>
              <Tabs 
                value={activeTab} 
                onChange={(e, v) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Profile sections"
                sx={tabsSx}
              >
                <Tab label="Overview" id="profile-tab-0" aria-controls="profile-tabpanel-0" />
                <Tab label="Experience" id="profile-tab-1" aria-controls="profile-tabpanel-1" />
                <Tab label="Education" id="profile-tab-2" aria-controls="profile-tabpanel-2" />
                <Tab label="Projects" id="profile-tab-3" aria-controls="profile-tabpanel-3" />
                <Tab label="Tailored Profiles" id="profile-tab-4" aria-controls="profile-tabpanel-4" />
                <Tab label="Posts" id="profile-tab-5" aria-controls="profile-tabpanel-5" />
              </Tabs>
            </TabsHeader>
            
            <TabContent
              role="tabpanel"
              id={`profile-tabpanel-${activeTab}`}
              aria-labelledby={`profile-tab-${activeTab}`}
              tabIndex={0}
            >
              {/* Overview Tab */}
              {activeTab === 0 && (
                <>
                  {/* Professional Summary */}
                  <Section>
                    <SectionHeader>
                      <SectionTitle>Professional Summary</SectionTitle>
                      <SectionAction onClick={handleEditProfile}>
                        <EditIcon fontSize="small" /> Edit
                      </SectionAction>
                    </SectionHeader>
                    <SummaryText>
                      {profile?.summary || 'No summary added yet. Click Edit to add your professional summary.'}
                    </SummaryText>
                  </Section>
                  
                  {/* AI Summary */}
                  {profile?.aiSummary && (
                    <Section>
                      <SectionHeader>
                        <SectionTitle>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <EnhanceIcon color="primary" /> AI-Enhanced Summary
                          </Box>
                        </SectionTitle>
                      </SectionHeader>
                      <Box sx={aiSummaryBoxSx}>
                        <SummaryText>{profile.aiSummary}</SummaryText>
                      </Box>
                    </Section>
                  )}
                  
                  {/* Experience Preview */}
                  <Section>
                    <SectionHeader>
                      <SectionTitle>Experience</SectionTitle>
                      <SectionAction onClick={() => setActiveTab(1)}>
                        View All
                      </SectionAction>
                    </SectionHeader>
                    {experience.slice(0, 3).map((exp, idx) => renderExperienceItem(exp, idx, true))}
                    {experience.length === 0 && (
                      <Box sx={{ color: '#7b7f9e', fontSize: '14px' }}>
                        No experience added yet. <SectionAction onClick={handleEditProfile}>Add experience</SectionAction>
                      </Box>
                    )}
                  </Section>
                </>
              )}
              
              {/* Experience Tab */}
              {activeTab === 1 && (
                <Section>
                  <SectionHeader>
                    <SectionTitle>Work Experience</SectionTitle>
                    <SectionAction onClick={handleEditProfile}>
                      <AddIcon fontSize="small" /> Add
                    </SectionAction>
                  </SectionHeader>
                  {experience.map((exp, idx) => renderExperienceItem(exp, idx, false))}
                  {experience.length === 0 && (
                    <Box sx={{ color: '#7b7f9e', fontSize: '14px', py: 4, textAlign: 'center' }}>
                      No work experience added yet.
                    </Box>
                  )}
                </Section>
              )}
              
              {/* Education Tab */}
              {activeTab === 2 && (
                <Section>
                  <SectionHeader>
                    <SectionTitle>Education</SectionTitle>
                    <SectionAction onClick={handleEditProfile}>
                      <AddIcon fontSize="small" /> Add
                    </SectionAction>
                  </SectionHeader>
                  {education.map((edu, idx) => {
                    const placeholderRe = /^(field|degree|n\/?a|none|null|undefined)$/i;
                    const cleanDegree =
                      edu.degree && !placeholderRe.test(String(edu.degree).trim()) ? String(edu.degree).trim() : '';
                    const rawField = edu.fieldOfStudy ?? edu.field ?? edu.major ?? '';
                    const cleanField =
                      rawField && !placeholderRe.test(String(rawField).trim()) ? String(rawField).trim() : '';
                    const showField =
                      cleanField &&
                      cleanField.toLowerCase() !== cleanDegree.toLowerCase() &&
                      !cleanDegree.toLowerCase().includes(cleanField.toLowerCase());
                    const titleText = [cleanDegree, showField ? cleanField : null]
                      .filter(Boolean)
                      .join(', ');
                    return (
                    <ExperienceItem key={idx}>
                      <CompanyLogo style={{ background: companyLogoColors[(idx + 2) % companyLogoColors.length] }}>
                        <SchoolIcon />
                      </CompanyLogo>
                      <ExperienceContent>
                        <ExperienceTitle>{titleText || 'Education'}</ExperienceTitle>
                        <ExperienceCompany>
                          <span className="company-name">{edu.institution || edu.school}</span>
                        </ExperienceCompany>
                        <ExperienceMeta>
                          <span className="meta-date">
                            <EventIcon />
                            {formatDateRange(edu.startDate, edu.endDate) || edu.year || ''}
                          </span>
                          {edu.location && (
                            <span className="meta-location">
                              <LocationOnIcon />
                              {edu.location}
                            </span>
                          )}
                          {edu.gpa && (
                            <span className="meta-location">
                              GPA: {edu.gpa}
                            </span>
                          )}
                          {edu.honors && (
                            <span className="meta-location">
                              {edu.honors}
                            </span>
                          )}
                        </ExperienceMeta>
                        {edu.description && (
                          <ExperienceDescription>{edu.description}</ExperienceDescription>
                        )}
                      </ExperienceContent>
                    </ExperienceItem>
                    );
                  })}
                  {education.length === 0 && (
                    <Box sx={{ color: '#7b7f9e', fontSize: '14px', py: 4, textAlign: 'center' }}>
                      No education added yet.
                    </Box>
                  )}
                </Section>
              )}
              
              {/* Projects Tab */}
              {activeTab === 3 && (
                <Section>
                  <SectionHeader>
                    <SectionTitle>Projects</SectionTitle>
                    <SectionAction onClick={handleEditProfile}>
                      <AddIcon fontSize="small" /> Add
                    </SectionAction>
                  </SectionHeader>
                  {projects.map((project, idx) => {
                    const title = project.title || project.name;
                    const description = (project.description || '').trim();
                    const role = (project.role || '').trim();
                    const techs = Array.isArray(project.technologies)
                      ? project.technologies.filter(Boolean)
                      : (typeof project.technologies === 'string'
                          ? project.technologies.split(',').map(t => t.trim()).filter(Boolean)
                          : []);
                    const isPresent = /^(present|current)$/i.test(String(project.endDate || '').trim());
                    const dateRange = (project.startDate || project.endDate)
                      ? `${project.startDate || ''}${project.startDate && (project.endDate || isPresent) ? ' – ' : ''}${isPresent ? 'Present' : (project.endDate || '')}`.trim()
                      : '';
                    const isValidUrl = (s) => {
                      if (!s || typeof s !== 'string') return false;
                      try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
                    };
                    const liveUrl = isValidUrl(project.url) ? project.url : '';
                    const repoUrl = isValidUrl(project.githubUrl) ? project.githubUrl : '';
                    const imageUrl = project.imageUrl ? resolveImageUrl(project.imageUrl) : '';
                    return (
                      <ExperienceItem key={idx}>
                        <CompanyLogo
                          style={{
                            background: imageUrl ? `url(${imageUrl}) center/cover` : companyLogoColors[(idx + 4) % companyLogoColors.length],
                          }}
                        >
                          {!imageUrl && <CodeIcon />}
                        </CompanyLogo>
                        <ExperienceContent>
                          <ExperienceTitle>{title || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Untitled project</span>}</ExperienceTitle>
                          {(role || dateRange) && (
                            <ExperienceMeta>
                              {role && <span className="meta-role">{role}</span>}
                              {dateRange && (
                                <span className="meta-date">
                                  <EventIcon />
                                  {dateRange}
                                </span>
                              )}
                            </ExperienceMeta>
                          )}
                          {description ? (
                            <ExperienceDescription>{description}</ExperienceDescription>
                          ) : (
                            <ExperienceDescription style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                              No description added yet.
                            </ExperienceDescription>
                          )}
                          {techs.length > 0 && (
                            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {techs.map((tech, i) => (
                                <Chip key={i} label={tech} size="small" variant="outlined" sx={{ borderColor: 'rgba(91,106,191,0.3)', color: '#5b6abf' }} />
                              ))}
                            </Box>
                          )}
                          {(liveUrl || repoUrl) && (
                            <Box sx={{ mt: 1.25, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {liveUrl && (
                                <Button
                                  component="a"
                                  href={liveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  size="small"
                                  startIcon={<OpenInNewIcon fontSize="small" />}
                                  sx={{ textTransform: 'none', color: '#5b6abf', fontWeight: 500 }}
                                >
                                  Live Demo
                                </Button>
                              )}
                              {repoUrl && (
                                <Button
                                  component="a"
                                  href={repoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  size="small"
                                  startIcon={<GitHubIcon fontSize="small" />}
                                  sx={{ textTransform: 'none', color: '#4a4d63', fontWeight: 500 }}
                                >
                                  GitHub
                                </Button>
                              )}
                            </Box>
                          )}
                        </ExperienceContent>
                      </ExperienceItem>
                    );
                  })}
                  {projects.length === 0 && (
                    <Box sx={{ color: '#7b7f9e', fontSize: '14px', py: 4, textAlign: 'center' }}>
                      No projects added yet.
                    </Box>
                  )}
                </Section>
              )}
              
              {/* Tailored Profiles Tab */}
              {activeTab === 4 && (
                <Section>
                  <SectionHeader>
                    <SectionTitle>Tailored Profile Versions</SectionTitle>
                    <SectionAction onClick={() => navigate('/profile/edit', { state: { action: 'tailor' } })}>
                      <AddIcon fontSize="small" /> Create New
                    </SectionAction>
                  </SectionHeader>
                  
                  {loadingTailored ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : tailoredProfiles.length > 0 ? (
                    <Grid container spacing={2}>
                      {tailoredProfiles.map((tailored) => (
                        <Grid item xs={12} sm={6} key={tailored.id}>
                          <Card 
                            sx={tailoredCardSx}
                            onClick={() => handleViewTailored(tailored)}
                          >
                            <CardContent sx={{ pb: 1, flex: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                                <Box sx={{ 
                                  width: 40, height: 40, borderRadius: 2, 
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <CompanyIcon sx={{ color: '#fff', fontSize: 20 }} />
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="subtitle1" fontWeight="bold" noWrap>
                                    {tailored.companyName || tailored.jobTitle}
                                  </Typography>
                                  <Typography variant="body2" color="#7b7f9e" noWrap>
                                    {tailored.companyName ? tailored.jobTitle : ''}
                                  </Typography>
                                  {tailored.tailoredData?.jobLevel && (
                                    <Chip
                                      label={tailored.tailoredData.jobLevel.level?.charAt(0).toUpperCase() + tailored.tailoredData.jobLevel.level?.slice(1) + (tailored.tailoredData.jobLevel.yearsExpected ? ` · ${tailored.tailoredData.jobLevel.yearsExpected}` : '')}
                                      size="small"
                                      sx={{ mt: 0.5, fontSize: '10px', height: 20, bgcolor: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' }}
                                    />
                                  )}
                                </Box>
                              </Box>
                              {getTailoredProvenanceLabel(tailored) && (
                                <Chip
                                  label={getTailoredProvenanceLabel(tailored)}
                                  size="small"
                                  sx={{
                                    mb: 1,
                                    maxWidth: '100%',
                                    bgcolor: '#eef2ff',
                                    color: '#4338ca',
                                    border: '1px solid #c7d2fe',
                                    '.MuiChip-label': {
                                      display: 'block',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    },
                                  }}
                                />
                              )}
                              {tailored.matchScore && (
                                <Chip 
                                  icon={<StarIcon sx={{ fontSize: 16 }} />}
                                  label={`${tailored.matchScore}% Match`}
                                  size="small"
                                  color={tailored.matchScore >= 80 ? 'success' : tailored.matchScore >= 60 ? 'warning' : 'default'}
                                  sx={{ mb: 1 }}
                                />
                              )}
                              {/* Missed Skills */}
                              {tailored.skillGaps && tailored.skillGaps.length > 0 && (
                                <Box sx={{ mt: 1, mb: 1 }}>
                                  <Typography variant="caption" sx={{ color: '#7b7f9e', fontWeight: 600, display: 'block', mb: 0.5 }}>
                                    Missing Skills
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {tailored.skillGaps
                                      .filter(g => g.status !== 'learned')
                                      .slice(0, 6)
                                      .map((gap, gi) => (
                                        <Chip
                                          key={gi}
                                          label={gap.skill}
                                          size="small"
                                          sx={{
                                            fontSize: '10px',
                                            height: 22,
                                            bgcolor: gap.severity === 'critical' ? '#fef2f2' : gap.severity === 'important' ? '#fffbeb' : '#eff6ff',
                                            color: gap.severity === 'critical' ? '#ef4444' : gap.severity === 'important' ? '#d97706' : '#3b82f6',
                                            border: '1px solid',
                                            borderColor: gap.severity === 'critical' ? '#fecaca' : gap.severity === 'important' ? '#fde68a' : '#bfdbfe',
                                          }}
                                        />
                                      ))}
                                    {tailored.skillGaps.filter(g => g.status !== 'learned').length > 6 && (
                                      <Chip
                                        label={`+${tailored.skillGaps.filter(g => g.status !== 'learned').length - 6} more`}
                                        size="small"
                                        sx={{ fontSize: '10px', height: 22, bgcolor: '#f3f4f6', color: '#6b7280' }}
                                      />
                                    )}
                                  </Box>
                                </Box>
                              )}
                              <Typography variant="caption" color="#7b7f9e" display="block">
                                Created: {new Date(tailored.createdAt).toLocaleDateString()}
                              </Typography>
                            </CardContent>
                            <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                              {!!tailored.applyPilotApplicationId && (
                                <Tooltip title="Open ApplyPilot review">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/applypilot/inbox/${tailored.applyPilotApplicationId}`);
                                    }}
                                  >
                                    <OpenInNewIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadResume(tailored.id, tailored.jobTitle);
                                }}
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTailored(tailored.id);
                                }}
                                disabled={deletingId === tailored.id}
                              >
                                {deletingId === tailored.id ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <DeleteIcon fontSize="small" />
                                )}
                              </IconButton>
                            </CardActions>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Box sx={{ color: '#7b7f9e', fontSize: '14px', py: 4, textAlign: 'center' }}>
                      <ArticleIcon sx={{ fontSize: 48, mb: 2, opacity: 0.4, color: '#5b6abf' }} />
                      <Box>No tailored profiles yet. Create one to customize your profile for specific jobs.</Box>
                    </Box>
                  )}
                </Section>
              )}
              
              {/* Posts Tab */}
              {activeTab === 5 && (
                <>
                  {/* My Posts Section */}
                  <Section>
                    <SectionHeader>
                      <SectionTitle>My Posts</SectionTitle>
                      <SectionAction onClick={() => navigate('/feed')}>
                        <AddIcon fontSize="small" /> Create Post
                      </SectionAction>
                    </SectionHeader>
                    
                    {loadingPosts ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : userPosts.length > 0 ? (
                      <Grid container spacing={3}>
                        {userPosts.map((post) => (
                          <Grid item xs={12} sm={6} md={4} key={post.id}>
                            <Card 
                              sx={postCardSx}
                              onClick={() => navigate('/feed')}
                            >
                              {/* Image or Gradient Placeholder */}
                              <Box
                                sx={{
                                  width: '100%',
                                  height: 160,
                                  overflow: 'hidden',
                                  position: 'relative',
                                  background: post.image 
                                    ? 'transparent' 
                                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                }}
                              >
                                {post.image ? (
                                  <img
                                    src={resolveImageUrl(post.image)}
                                    alt={post.title || 'Post'}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover'
                                    }}
                                  />
                                ) : (
                                  <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    height: '100%'
                                  }}>
                                    <ArticleIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.8)' }} />
                                  </Box>
                                )}
                                {/* Date Badge */}
                                <Box sx={{
                                  position: 'absolute',
                                  bottom: 8,
                                  right: 8,
                                  bgcolor: 'rgba(0,0,0,0.6)',
                                  color: 'white',
                                  px: 1.5,
                                  py: 0.5,
                                  borderRadius: 2,
                                  fontSize: '0.75rem'
                                }}>
                                  {new Date(post.createdAt).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </Box>
                              </Box>
                              
                              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2.5 }}>
                                <Typography 
                                  variant="h6" 
                                  fontWeight="600" 
                                  sx={{ 
                                    mb: 1,
                                    fontSize: '1rem',
                                    lineHeight: 1.3,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {post.title || 'Untitled Post'}
                                </Typography>
                                <Typography 
                                  variant="body2" 
                                  color="#7b7f9e" 
                                  sx={{
                                    flex: 1,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    mb: 2,
                                    lineHeight: 1.5
                                  }}
                                >
                                  {post.content?.substring(0, 120)}...
                                </Typography>
                                
                                {/* Stats Row */}
                                <Box sx={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 2,
                                  pt: 2,
                                  borderTop: '1px solid',
                                  borderColor: '#e4e7f2'
                                }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <ThumbUpIcon fontSize="small" sx={{ color: '#5b6abf' }} />
                                    <Typography variant="body2" fontWeight="500">
                                      {post.likesCount || 0}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <ChatBubbleOutlineIcon fontSize="small" sx={{ color: '#5b6abf' }} />
                                    <Typography variant="body2" fontWeight="500">
                                      {post.commentsCount || 0}
                                    </Typography>
                                  </Box>
                                </Box>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Box sx={{ 
                        color: '#7b7f9e', 
                        fontSize: '14px', 
                        py: 6, 
                        textAlign: 'center',
                        background: 'rgba(91, 106, 191, 0.04)',
                        borderRadius: 3
                      }}>
                        <ArticleIcon sx={{ fontSize: 56, mb: 2, color: '#5b6abf', opacity: 0.5 }} />
                        <Typography variant="h6" color="#4a4d63" gutterBottom>No posts yet</Typography>
                        <Typography variant="body2" color="#7b7f9e">
                          Share your thoughts and achievements with the community!
                        </Typography>
                      </Box>
                    )}
                  </Section>
                </>
              )}
            </TabContent>
          </TabsContainer>
        </RightContent>
      </ContentGrid>
    </MainContent>

      {/* Tailored Profile View Dialog */}
      <Dialog 
        open={showTailoredDialog} 
        onClose={() => setShowTailoredDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}
      >
        {selectedTailored && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ 
                  width: 52, height: 52, borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CompanyIcon sx={{ color: '#fff', fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" fontWeight="bold">
                    {selectedTailored.companyName || selectedTailored.jobTitle}
                  </Typography>
                  {selectedTailored.companyName && (
                    <Typography variant="subtitle1" color="text.secondary">
                      {selectedTailored.jobTitle}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    {selectedTailored.matchScore && (
                      <Chip 
                        icon={<StarIcon sx={{ fontSize: 16 }} />}
                        label={`${selectedTailored.matchScore}% Match`}
                        size="small"
                        color={selectedTailored.matchScore >= 80 ? 'success' : selectedTailored.matchScore >= 60 ? 'warning' : 'default'}
                      />
                    )}
                    {selectedTailored.tailoredData?.jobLevel && (
                      <Chip
                        icon={<TrendingUpIcon sx={{ fontSize: 16 }} />}
                        label={`${selectedTailored.tailoredData.jobLevel.level?.charAt(0).toUpperCase()}${selectedTailored.tailoredData.jobLevel.level?.slice(1)} Level${selectedTailored.tailoredData.jobLevel.yearsExpected ? ` · ${selectedTailored.tailoredData.jobLevel.yearsExpected}` : ''}`}
                        size="small"
                        sx={{ bgcolor: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' }}
                      />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Created {new Date(selectedTailored.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
              {selectedTailored.tailoredData && (
                <Box>
                  {/* Job Level Section */}
                  {selectedTailored.tailoredData?.jobLevel?.summary && (
                    <Box sx={{ px: 3, py: 2, bgcolor: '#f0f4ff', borderBottom: '1px solid #e2e8f0' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <TrendingUpIcon sx={{ color: '#3b82f6', fontSize: 20 }} />
                        <Typography variant="subtitle2" fontWeight="bold" color="#1e40af">
                          Position Level
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="#334155">
                        {selectedTailored.tailoredData.jobLevel.summary}
                      </Typography>
                    </Box>
                  )}

                  {/* Gap Analysis Section */}
                  {(selectedTailored.skillGaps?.length > 0 || selectedTailored.tailoredData?.matchAnalysis) && (
                    <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #e2e8f0' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <PsychologyIcon sx={{ color: '#7c3aed', fontSize: 20 }} />
                        <Typography variant="subtitle2" fontWeight="bold" color="#5b21b6">
                          Gap Analysis
                        </Typography>
                      </Box>

                      {/* Strong Matches */}
                      {selectedTailored.tailoredData?.matchAnalysis?.strongMatches?.length > 0 && (
                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" fontWeight="bold" sx={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <CheckCircleIcon sx={{ fontSize: 14 }} /> Strong Matches
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selectedTailored.tailoredData.matchAnalysis.strongMatches.map((m, i) => (
                              <Chip key={i} label={m} size="small" sx={{ fontSize: '11px', height: 24, bgcolor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }} />
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* Partial Matches */}
                      {selectedTailored.tailoredData?.matchAnalysis?.partialMatches?.length > 0 && (
                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" fontWeight="bold" sx={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <WarningIcon sx={{ fontSize: 14 }} /> Partial Matches
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selectedTailored.tailoredData.matchAnalysis.partialMatches.map((m, i) => (
                              <Chip key={i} label={m} size="small" sx={{ fontSize: '11px', height: 24, bgcolor: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }} />
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* Gaps */}
                      {(selectedTailored.tailoredData?.matchAnalysis?.gaps?.length > 0 || selectedTailored.skillGaps?.length > 0) && (
                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" fontWeight="bold" sx={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <ErrorIcon sx={{ fontSize: 14 }} /> Gaps to Address
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selectedTailored.tailoredData?.matchAnalysis?.gaps || selectedTailored.skillGaps?.map(g => g.skill) || []).map((g, i) => (
                              <Chip key={i} label={typeof g === 'string' ? g : g.skill || g} size="small" sx={{ fontSize: '11px', height: 24, bgcolor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }} />
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* Recommendations */}
                      {selectedTailored.tailoredData?.matchAnalysis?.recommendations?.length > 0 && (
                        <Box>
                          <Typography variant="caption" fontWeight="bold" sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <ArrowUpwardIcon sx={{ fontSize: 14 }} /> Recommendations
                          </Typography>
                          {selectedTailored.tailoredData.matchAnalysis.recommendations.map((r, i) => (
                            <Typography key={i} variant="body2" sx={{ color: '#334155', pl: 2, mb: 0.3, '&::before': { content: '"•"', position: 'absolute', ml: -1.5 }, position: 'relative' }}>
                              {r}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* ═══ Interactive Interview Preparation Section ═══ */}
                  <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #e2e8f0', bgcolor: interviewPrepStep === 'results' ? '#f8fffe' : '#fafbff' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <RecordVoiceOverIcon sx={{ color: '#059669', fontSize: 22 }} />
                      <Typography variant="subtitle1" fontWeight="bold" color="#065f46">
                        🎯 Interview Preparation
                      </Typography>
                    </Box>

                    {/* Step 1: Ask if they got an interview */}
                    {interviewPrepStep === 'ask' && (
                      <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                        <Typography variant="body1" fontWeight={500} sx={{ mb: 2, color: '#1e293b' }}>
                          Did you get an interview for this position?
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                          <Button 
                            variant={gotInterview === true ? 'contained' : 'outlined'}
                            color="success"
                            onClick={() => { setGotInterview(true); setInterviewPrepStep('details'); }}
                            sx={{ flex: 1, py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                          >
                            🎉 Yes, I got an interview!
                          </Button>
                          <Button 
                            variant={gotInterview === false ? 'contained' : 'outlined'}
                            color="inherit"
                            onClick={() => { setGotInterview(false); setInterviewPrepStep('details'); }}
                            sx={{ flex: 1, py: 1.2, borderRadius: 2, textTransform: 'none', fontWeight: 600, color: gotInterview === false ? '#fff' : '#64748b' }}
                          >
                            Not yet, but I want to prepare
                          </Button>
                        </Box>
                      </Box>
                    )}

                    {/* Step 2: Ask about interview details */}
                    {interviewPrepStep === 'details' && (
                      <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                        {gotInterview && (
                          <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1.5, border: '1px solid #bbf7d0' }}>
                            <Typography variant="body2" color="#16a34a" fontWeight={600}>
                              🎉 Congratulations on getting the interview! Let's get you prepared.
                            </Typography>
                          </Box>
                        )}

                        <Typography variant="body1" fontWeight={500} sx={{ mb: 2, color: '#1e293b' }}>
                          Tell us about the interview so we can tailor your preparation:
                        </Typography>

                        <FormControl fullWidth sx={{ mb: 2 }} size="small">
                          <InputLabel>Interview Round / Stage *</InputLabel>
                          <Select
                            value={interviewLevel}
                            onChange={(e) => setInterviewLevel(e.target.value)}
                            label="Interview Round / Stage *"
                          >
                            <MenuItem value="phone-screen">📞 Phone Screen / Recruiter Call</MenuItem>
                            <MenuItem value="hiring-manager">👤 Hiring Manager Interview</MenuItem>
                            <MenuItem value="technical-coding">💻 Technical / Coding Interview</MenuItem>
                            <MenuItem value="system-design">🏗️ System Design Interview</MenuItem>
                            <MenuItem value="behavioral">🤝 Behavioral / Culture Fit</MenuItem>
                            <MenuItem value="take-home">📝 Take-Home Assignment</MenuItem>
                            <MenuItem value="onsite-loop">🏢 Onsite / Full Loop</MenuItem>
                            <MenuItem value="final-round">🏆 Final Round / Executive</MenuItem>
                            <MenuItem value="panel">👥 Panel Interview</MenuItem>
                            <MenuItem value="general">❓ Not sure yet / General Prep</MenuItem>
                          </Select>
                        </FormControl>

                        <FormControl fullWidth sx={{ mb: 2 }} size="small">
                          <InputLabel>Interview Format</InputLabel>
                          <Select
                            value={interviewFormat}
                            onChange={(e) => setInterviewFormat(e.target.value)}
                            label="Interview Format"
                          >
                            <MenuItem value="video">📹 Video Call (Zoom/Teams/Meet)</MenuItem>
                            <MenuItem value="phone">📞 Phone Call</MenuItem>
                            <MenuItem value="in-person">🏢 In Person</MenuItem>
                            <MenuItem value="async">📝 Async / Take-Home</MenuItem>
                            <MenuItem value="unknown">❓ Not sure yet</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          size="small"
                          label="Any specific concerns or topics you're worried about? (optional)"
                          placeholder="e.g., I'm rusty on system design, worried about whiteboarding, first time interviewing at a FAANG..."
                          value={specificConcerns}
                          onChange={(e) => setSpecificConcerns(e.target.value)}
                          sx={{ mb: 2 }}
                        />

                        {prepError && (
                          <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
                            {prepError}
                          </Typography>
                        )}

                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button 
                            variant="text" 
                            onClick={() => { setInterviewPrepStep('ask'); setGotInterview(null); }}
                            sx={{ textTransform: 'none' }}
                          >
                            ← Back
                          </Button>
                          <Button
                            variant="contained"
                            onClick={handleGenerateInterviewPrep}
                            disabled={!interviewLevel}
                            sx={{ 
                              flex: 1, py: 1, borderRadius: 2, textTransform: 'none', fontWeight: 600,
                              background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                              '&:hover': { background: 'linear-gradient(135deg, #047857 0%, #0f766e 100%)' }
                            }}
                          >
                            🚀 Generate My Interview Prep Guide
                          </Button>
                        </Box>
                      </Box>
                    )}

                    {/* Step 3: Loading */}
                    {interviewPrepStep === 'loading' && (
                      <Box sx={{ p: 3, bgcolor: '#fff', borderRadius: 2, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                        <CircularProgress size={40} sx={{ color: '#059669', mb: 2 }} />
                        <Typography variant="body1" fontWeight={500} color="#334155">
                          Generating your personalized interview prep...
                        </Typography>
                        <Typography variant="body2" color="#64748b" sx={{ mt: 0.5 }}>
                          Analyzing your profile, skill gaps, and the {interviewLevel.replace('-', ' ')} round requirements
                        </Typography>
                        <LinearProgress sx={{ mt: 2, borderRadius: 1, '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #059669, #0d9488)' } }} />
                      </Box>
                    )}

                    {/* Step 4: Results */}
                    {interviewPrepStep === 'results' && generatedPrep && (
                      <Box>
                        {/* Regenerate button */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                          <Button 
                            size="small" 
                            onClick={() => setInterviewPrepStep('details')}
                            sx={{ textTransform: 'none', color: '#059669' }}
                          >
                            ↻ Prepare for a different round
                          </Button>
                        </Box>

                        {/* Round Overview */}
                        {generatedPrep.roundOverview && (
                          <Box sx={{ p: 2, mb: 2, bgcolor: '#ecfdf5', borderRadius: 2, border: '1px solid #a7f3d0' }}>
                            <Typography variant="body2" color="#065f46" fontWeight={500}>
                              {generatedPrep.roundOverview}
                            </Typography>
                          </Box>
                        )}

                        {/* Level Expectations */}
                        {generatedPrep.levelExpectations && (
                          <Box sx={{ p: 2, mb: 2, bgcolor: '#eff6ff', borderRadius: 2, border: '1px solid #bfdbfe' }}>
                            <Typography variant="caption" fontWeight="bold" sx={{ color: '#1e40af', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <TrendingUpIcon sx={{ fontSize: 14 }} /> What's Expected at This Level
                            </Typography>
                            <Typography variant="body2" color="#334155">
                              {generatedPrep.levelExpectations}
                            </Typography>
                          </Box>
                        )}

                        {/* Expected Topics */}
                        {generatedPrep.expectedTopics?.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" fontWeight="bold" sx={{ color: '#334155', mb: 0.5, display: 'block' }}>
                              📋 Expected Topics in This Round
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {generatedPrep.expectedTopics.map((t, i) => (
                                <Chip key={i} label={t} size="small" variant="outlined" sx={{ fontSize: '11px', borderColor: '#d1d5db' }} />
                              ))}
                            </Box>
                          </Box>
                        )}

                        {/* Technical Questions */}
                        {generatedPrep.technicalQuestions?.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#334155', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <QuizIcon sx={{ fontSize: 16 }} /> Technical Questions to Prepare
                            </Typography>
                            {generatedPrep.technicalQuestions.map((q, i) => (
                              <Box key={i} sx={{ mb: 1.5, p: 1.5, bgcolor: '#fff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                                <Typography variant="body2" fontWeight={600} color="#1e293b" sx={{ mb: 0.5 }}>
                                  {i + 1}. {typeof q === 'string' ? q : q.question}
                                </Typography>
                                {typeof q !== 'string' && (
                                  <>
                                    {q.whyAsked && (
                                      <Typography variant="caption" sx={{ color: '#6366f1', display: 'block', mb: 0.3 }}>
                                        💡 Why asked: {q.whyAsked}
                                      </Typography>
                                    )}
                                    {q.suggestedApproach && (
                                      <Typography variant="caption" sx={{ color: '#059669', display: 'block', mb: 0.3 }}>
                                        ✅ Approach: {q.suggestedApproach}
                                      </Typography>
                                    )}
                                    {q.relatedGap && (
                                      <Chip label={`Gap: ${q.relatedGap}`} size="small" sx={{ mt: 0.5, fontSize: '10px', height: 20, bgcolor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }} />
                                    )}
                                  </>
                                )}
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* Behavioral Questions */}
                        {generatedPrep.behavioralQuestions?.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#334155', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PsychologyIcon sx={{ fontSize: 16 }} /> Behavioral Questions (STAR Method)
                            </Typography>
                            {generatedPrep.behavioralQuestions.map((q, i) => (
                              <Box key={i} sx={{ mb: 1.5, p: 1.5, bgcolor: '#fff', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                                <Typography variant="body2" fontWeight={600} color="#1e293b" sx={{ mb: 0.5 }}>
                                  {i + 1}. {typeof q === 'string' ? q : q.question}
                                </Typography>
                                {typeof q !== 'string' && (
                                  <>
                                    {q.whyAsked && (
                                      <Typography variant="caption" sx={{ color: '#6366f1', display: 'block', mb: 0.3 }}>
                                        💡 Why asked: {q.whyAsked}
                                      </Typography>
                                    )}
                                    {q.starExample && (
                                      <Typography variant="caption" sx={{ color: '#059669', display: 'block', mb: 0.3 }}>
                                        📝 STAR example: {q.starExample}
                                      </Typography>
                                    )}
                                  </>
                                )}
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* Gap Mitigation Strategies */}
                        {generatedPrep.gapMitigation?.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#ef4444', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ErrorIcon sx={{ fontSize: 16 }} /> How to Handle Your Gaps
                            </Typography>
                            {generatedPrep.gapMitigation.map((g, i) => (
                              <Box key={i} sx={{ mb: 1, p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, border: '1px solid #fecaca' }}>
                                <Typography variant="body2" fontWeight={600} color="#991b1b" sx={{ mb: 0.3 }}>
                                  {typeof g === 'string' ? g : g.gap}
                                </Typography>
                                {typeof g !== 'string' && g.strategy && (
                                  <Typography variant="caption" color="#334155">
                                    → {g.strategy}
                                  </Typography>
                                )}
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* Talking Points */}
                        {generatedPrep.talkingPoints?.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#334155', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EmojiObjectsIcon sx={{ fontSize: 16 }} /> Your Key Talking Points
                            </Typography>
                            {generatedPrep.talkingPoints.map((p, i) => (
                              <Typography key={i} variant="body2" sx={{ color: '#334155', pl: 2, mb: 0.3, '&::before': { content: '"✓"', position: 'absolute', ml: -1.8, color: '#16a34a', fontWeight: 'bold' }, position: 'relative' }}>
                                {p}
                              </Typography>
                            ))}
                          </Box>
                        )}

                        {/* Questions to Ask */}
                        {generatedPrep.questionsToAsk?.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#334155', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              🙋 Questions You Should Ask the Interviewer
                            </Typography>
                            {generatedPrep.questionsToAsk.map((q, i) => (
                              <Typography key={i} variant="body2" sx={{ color: '#334155', pl: 2, mb: 0.4, '&::before': { content: '"→"', position: 'absolute', ml: -1.8, color: '#3b82f6', fontWeight: 'bold' }, position: 'relative' }}>
                                {q}
                              </Typography>
                            ))}
                          </Box>
                        )}

                        {/* Areas to Study */}
                        {generatedPrep.areasToStudy?.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#334155', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <MenuBookIcon sx={{ fontSize: 16 }} /> Study Plan
                            </Typography>
                            {generatedPrep.areasToStudy.map((a, i) => (
                              <Box key={i} sx={{ mb: 1, p: 1.5, bgcolor: '#fffbeb', borderRadius: 1.5, border: '1px solid #fde68a', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                <Chip 
                                  label={typeof a === 'string' ? 'study' : (a.priority || 'medium')} 
                                  size="small" 
                                  sx={{ 
                                    fontSize: '10px', height: 20, textTransform: 'uppercase', fontWeight: 700,
                                    bgcolor: (typeof a !== 'string' && a.priority === 'high') ? '#fef2f2' : (typeof a !== 'string' && a.priority === 'low') ? '#f0fdf4' : '#fffbeb',
                                    color: (typeof a !== 'string' && a.priority === 'high') ? '#ef4444' : (typeof a !== 'string' && a.priority === 'low') ? '#16a34a' : '#d97706',
                                    border: '1px solid',
                                    borderColor: (typeof a !== 'string' && a.priority === 'high') ? '#fecaca' : (typeof a !== 'string' && a.priority === 'low') ? '#bbf7d0' : '#fde68a'
                                  }} 
                                />
                                <Box>
                                  <Typography variant="body2" fontWeight={600} color="#92400e">
                                    {typeof a === 'string' ? a : a.topic}
                                  </Typography>
                                  {typeof a !== 'string' && a.resources && (
                                    <Typography variant="caption" color="#78716c">
                                      {a.resources}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* Do's and Don'ts */}
                        {generatedPrep.dosAndDonts && (
                          <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                            {generatedPrep.dosAndDonts.dos?.length > 0 && (
                              <Box sx={{ flex: 1, p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                                <Typography variant="caption" fontWeight="bold" color="#16a34a" sx={{ display: 'block', mb: 0.5 }}>
                                  ✅ DO
                                </Typography>
                                {generatedPrep.dosAndDonts.dos.map((d, i) => (
                                  <Typography key={i} variant="caption" sx={{ color: '#334155', display: 'block', mb: 0.2 }}>
                                    • {d}
                                  </Typography>
                                ))}
                              </Box>
                            )}
                            {generatedPrep.dosAndDonts.donts?.length > 0 && (
                              <Box sx={{ flex: 1, p: 1.5, bgcolor: '#fef2f2', borderRadius: 2, border: '1px solid #fecaca' }}>
                                <Typography variant="caption" fontWeight="bold" color="#ef4444" sx={{ display: 'block', mb: 0.5 }}>
                                  ❌ DON'T
                                </Typography>
                                {generatedPrep.dosAndDonts.donts.map((d, i) => (
                                  <Typography key={i} variant="caption" sx={{ color: '#334155', display: 'block', mb: 0.2 }}>
                                    • {d}
                                  </Typography>
                                ))}
                              </Box>
                            )}
                          </Box>
                        )}

                        {/* Timeline Plan */}
                        {generatedPrep.timelinePlan && (
                          <Box sx={{ p: 1.5, bgcolor: '#f5f3ff', borderRadius: 2, border: '1px solid #ddd6fe' }}>
                            <Typography variant="caption" fontWeight="bold" color="#7c3aed" sx={{ display: 'block', mb: 0.5 }}>
                              📅 Preparation Timeline
                            </Typography>
                            <Typography variant="body2" color="#334155">
                              {generatedPrep.timelinePlan}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>

                  {/* Tailored Profile Content */}
                  <Box sx={{ px: 3, py: 2 }}>
                    {selectedTailored.tailoredData.title && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Tailored Headline
                        </Typography>
                        <Typography variant="h6">
                          {selectedTailored.tailoredData.title}
                        </Typography>
                      </Box>
                    )}
                    {selectedTailored.tailoredData.summary && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Summary
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: '#334155' }}>
                          {selectedTailored.tailoredData.summary}
                        </Typography>
                      </Box>
                    )}
                    {selectedTailored.tailoredData.skills && selectedTailored.tailoredData.skills.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Skills
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {selectedTailored.tailoredData.skills.map((skill, index) => (
                            <Chip key={index} label={skill} size="small" color="primary" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 1.5 }}>
              <Button onClick={() => setShowTailoredDialog(false)}>
                Close
              </Button>
              <Button 
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  setShowTailoredDialog(false);
                  handleDownloadResume(selectedTailored.id, selectedTailored.jobTitle);
                }}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              >
                Download Resume
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* Resume Download / Preview Modal (identical to Jobs page) */}
      <ResumePreviewModal
        open={showResumeDialog}
        onClose={() => {
          setShowResumeDialog(false);
          setDownloadTailoredId(null);
          setDownloadTailoredTitle(null);
        }}
        profileData={profileData}
        tailoredProfileData={
          downloadTailoredId
            ? (tailoredProfiles.find(t => t.id === downloadTailoredId)?.tailoredData || null)
            : null
        }
        jobTitle={downloadTailoredTitle}
        user={user}
      />
      
      {/* Resume Upload Processing Modal */}
      <ProcessingModal
        open={uploadingResume}
        type="resume"
        title="Processing Resume"
        subtitle="AI is parsing your resume and extracting your professional information..."
        phase="Analyzing document..."
      />
      
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* In-place Enhance Prompt Modal */}
      <EnhancePromptModal
        open={showEnhancePrompt}
        onClose={() => setShowEnhancePrompt(false)}
        onEnhance={handleEnhanceInPlace}
        formData={profile ? {
          summary: profile.summary,
          skills: profile.skills || {},
          experience: profile.experience,
          education: profile.education,
          projects: profile.projects
        } : {}}
      />

      {/* Enhancement Preview Modal */}
      <EnhancementPreviewModal
        open={showEnhancementPreview}
        onClose={() => { setShowEnhancementPreview(false); setPendingEnhancements(null); }}
        onApply={handleApplyEnhancements}
        enhancements={pendingEnhancements}
        originalData={profileData}
        saving={enhanceSaving}
        showApplyOnly
      />

      {/* Enhancement Processing Modal */}
      <ProcessingModal
        open={enhancing}
        type="enhance"
        title="Enhancing Profile"
        subtitle="AI is optimizing your profile content..."
        phase="Rewriting sections..."
      />

      {/* Tips Processing Modal */}
      <ProcessingModal
        open={gettingTips}
        type="tips"
        title="Analyzing Profile"
        subtitle="AI recruiter is reviewing your profile..."
        phase="Generating feedback..."
      />

      {/* Career Tips Dialog */}
      <Dialog
        open={showTipsDialog}
        onClose={() => setShowTipsDialog(false)}
        maxWidth="sm"
        fullWidth
        scroll="paper"
        PaperProps={{ sx: { borderRadius: 3, background: '#fff', maxHeight: '85vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TipsIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a2e' }}>Career Tips</Typography>
            <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.3 }}>Personalized suggestions to improve your profile</Typography>
          </Box>
          <IconButton onClick={() => setShowTipsDialog(false)} size="small" sx={{ color: '#999' }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2, pb: 2 }}>
          {tips && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Strengths to Highlight */}
              {tips.strengthsToHighlight?.length > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <CheckCircleIcon sx={{ color: '#10b981', fontSize: 20 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#10b981' }}>Strengths</Typography>
                  </Box>
                  {tips.strengthsToHighlight.map((s, i) => (
                    <Box key={i} sx={{ pl: 1, mb: 0.8, borderLeft: '3px solid #10b981' }}>
                      <Typography variant="body2" sx={{ color: '#374151', lineHeight: 1.6 }}>
                        {typeof s === 'string' ? s : s.text || s.title || JSON.stringify(s)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
              {/* Missing Elements */}
              {tips.missingElements?.length > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <WarningIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f59e0b' }}>Missing Elements</Typography>
                  </Box>
                  {tips.missingElements.map((m, i) => (
                    <Box key={i} sx={{ pl: 1, mb: 0.8, borderLeft: '3px solid #f59e0b' }}>
                      <Typography variant="body2" sx={{ color: '#374151', lineHeight: 1.6 }}>
                        {typeof m === 'string' ? m : m.text || m.title || JSON.stringify(m)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
              {/* Summary Tips */}
              {tips.summaryTips?.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a1a2e', mb: 1 }}>Summary</Typography>
                  {tips.summaryTips.map((t, i) => (
                    <Box key={i} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f9fafb', border: '1px solid #e5e7eb', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: '#374151', lineHeight: 1.6 }}>
                        {typeof t === 'string' ? t : t.text || t.suggestion || JSON.stringify(t)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
              {/* Experience Tips */}
              {tips.experienceTips?.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a1a2e', mb: 1 }}>Experience</Typography>
                  {tips.experienceTips.map((t, i) => (
                    <Box key={i} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f9fafb', border: '1px solid #e5e7eb', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: '#374151', lineHeight: 1.6 }}>
                        {typeof t === 'string' ? t : t.text || t.suggestion || JSON.stringify(t)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
              {/* Skills Tips */}
              {tips.skillsTips?.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a1a2e', mb: 1 }}>Skills</Typography>
                  {tips.skillsTips.map((t, i) => (
                    <Box key={i} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f9fafb', border: '1px solid #e5e7eb', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: '#374151', lineHeight: 1.6 }}>
                        {typeof t === 'string' ? t : t.text || t.suggestion || JSON.stringify(t)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
              {/* Projects Tips */}
              {tips.projectTips?.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a1a2e', mb: 1 }}>Projects</Typography>
                  {tips.projectTips.map((t, i) => (
                    <Box key={i} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f9fafb', border: '1px solid #e5e7eb', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: '#374151', lineHeight: 1.6 }}>
                        {typeof t === 'string' ? t : t.text || t.suggestion || JSON.stringify(t)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
              {/* General Tips */}
              {tips.generalTips?.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a1a2e', mb: 1 }}>General Advice</Typography>
                  {tips.generalTips.map((t, i) => (
                    <Box key={i} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f9fafb', border: '1px solid #e5e7eb', mb: 1 }}>
                      <Typography variant="body2" sx={{ color: '#374151', lineHeight: 1.6 }}>
                        {typeof t === 'string' ? t : t.text || t.suggestion || JSON.stringify(t)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setShowTipsDialog(false)} variant="contained" sx={{ borderRadius: 2, textTransform: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a3f96)' } }}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tailor: Job Description Input Dialog */}
      <Dialog
        open={showTailorJobInput}
        onClose={() => setShowTailorJobInput(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, background: '#fff' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TailorIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a2e' }}>Tailor for a Job</Typography>
            <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.3 }}>Paste the job description to create a tailored version</Typography>
          </Box>
          <IconButton onClick={() => setShowTailorJobInput(false)} size="small" sx={{ color: '#999' }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            multiline
            minRows={6}
            maxRows={14}
            placeholder="Paste the full job description here (minimum 50 characters)..."
            value={tailorJobDesc}
            onChange={(e) => setTailorJobDesc(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                fontSize: 14,
                '&:hover fieldset': { borderColor: '#667eea' },
                '&.Mui-focused fieldset': { borderColor: '#667eea' },
              }
            }}
          />
          <Typography variant="caption" sx={{ color: tailorJobDesc.trim().length >= 50 ? '#10b981' : '#999', mt: 1, display: 'block' }}>
            {tailorJobDesc.trim().length}/50 characters minimum
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setShowTailorJobInput(false)} sx={{ borderRadius: 2, textTransform: 'none', color: '#666' }}>Cancel</Button>
          <Button
            onClick={handleAnalyzeGaps}
            variant="contained"
            disabled={tailorJobDesc.trim().length < 50}
            sx={{ borderRadius: 2, textTransform: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a3f96)' }, '&.Mui-disabled': { background: '#e0e0e0' } }}
          >
            Analyze Gaps
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tailor: Gap Analysis Processing Modal */}
      <ProcessingModal
        open={analyzingGaps}
        type="ai"
        title="Analyzing Gaps"
        subtitle="AI is comparing your profile against the job requirements..."
        phase="Identifying skill gaps..."
      />

      {/* Tailor: Gap Review Dialog */}
      <GapReviewDialog
        open={showGapReview}
        onClose={() => setShowGapReview(false)}
        gaps={detectedGaps}
        satisfiedAlternatives={satisfiedAlts}
        onContinue={handleGapReviewContinue}
        loading={tailoring}
      />

      {/* Tailor: Processing Modal */}
      <ProcessingModal
        open={tailoring}
        type="ai"
        title="Tailoring Profile"
        subtitle="AI is customizing your profile for this job..."
        phase="Rewriting sections..."
      />

      {/* Tailor: Result & Save Dialog */}
      <Dialog
        open={showTailorResultDialog}
        onClose={() => !savingTailored && setShowTailorResultDialog(false)}
        maxWidth="md"
        fullWidth
        scroll="paper"
        PaperProps={{ sx: { borderRadius: 3, background: '#fff', maxHeight: '85vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircleIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a2e' }}>Tailored Profile Ready</Typography>
            <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.3 }}>Review the changes and save as a separate tailored version</Typography>
          </Box>
          <IconButton onClick={() => !savingTailored && setShowTailorResultDialog(false)} size="small" sx={{ color: '#999' }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2, pb: 2 }}>
          {tailorResult && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Match Score */}
              {tailorResult.matchScore != null && (
                <Box sx={{ textAlign: 'center', py: 2, px: 3, borderRadius: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: tailorResult.matchScore >= 80 ? '#10b981' : tailorResult.matchScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                    {tailorResult.matchScore}%
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>Match Score</Typography>
                </Box>
              )}
              {/* Title */}
              {tailorResult.title && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a1a2e', mb: 0.5 }}>Title</Typography>
                  <Typography variant="body2" sx={{ color: '#374151', p: 1.5, borderRadius: 2, bgcolor: '#f9fafb', border: '1px solid #e5e7eb' }}>{tailorResult.title}</Typography>
                </Box>
              )}
              {/* Summary */}
              {tailorResult.summary && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a1a2e', mb: 0.5 }}>Summary</Typography>
                  <Typography variant="body2" sx={{ color: '#374151', p: 1.5, borderRadius: 2, bgcolor: '#f9fafb', border: '1px solid #e5e7eb', lineHeight: 1.7 }}>{tailorResult.summary}</Typography>
                </Box>
              )}
              {/* Match Analysis */}
              {tailorResult.matchAnalysis && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a1a2e', mb: 0.5 }}>Match Analysis</Typography>
                  <Typography variant="body2" sx={{ color: '#374151', p: 1.5, borderRadius: 2, bgcolor: '#f9fafb', border: '1px solid #e5e7eb', lineHeight: 1.7 }}>{tailorResult.matchAnalysis}</Typography>
                </Box>
              )}
              {/* Changelog */}
              {tailorResult.changelog?.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a1a2e', mb: 1 }}>Changes Made</Typography>
                  {tailorResult.changelog.map((change, i) => (
                    <Box key={i} sx={{ pl: 1, mb: 0.8, borderLeft: '3px solid #667eea' }}>
                      <Typography variant="body2" sx={{ color: '#374151', lineHeight: 1.6 }}>
                        {typeof change === 'string' ? change : change.description || change.text || JSON.stringify(change)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setShowTailorResultDialog(false)} disabled={savingTailored} sx={{ borderRadius: 2, textTransform: 'none', color: '#666' }}>Discard</Button>
          <Button
            onClick={handleSaveTailoredProfile}
            variant="contained"
            disabled={savingTailored}
            sx={{ borderRadius: 2, textTransform: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a3f96)' } }}
          >
            {savingTailored ? 'Saving...' : 'Save Tailored Version'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default Dashboard;
