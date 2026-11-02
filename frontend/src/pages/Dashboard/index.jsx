import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import OnboardingMatches from '@/components/OnboardingMatches';
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
  Collapse,
  useMediaQuery,
  useTheme
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
import TwitterIcon from '@mui/icons-material/Twitter';
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
import { featureFlags } from '@/config/featureFlags';
import { profileAPI, tailoredProfileAPI, subscriptionAPI, postAPI, resolveImageUrl } from '@/services/api';
import { formatDateRange } from '@/utils/dateRange';
import { diag } from '@/utils/diagLogger';
import { trackEvent } from '@/utils/analytics';
import { extractApiError } from '@/utils/apiError';
import { parseLimitError } from '@/utils/aiLimit';
import LimitReachedModal from '@/components/LimitReachedModal';
import ResumePreviewModal from '@/components/ResumePreviewModal';
import ProcessingModal from '@/components/ProcessingModal';
import EnhanceFlow from '@/components/EnhanceFlow';
import { applyEnhanceChanges } from '@/utils/enhanceApply';
import { useBackgroundTasks, useMountedRef } from '@/contexts/BackgroundTasksContext';
import TailorFlow from '@/components/TailorFlow';
import TailoredResumes from '@/components/tailored/TailoredResumes';
import RecruiterReview from '@/components/RecruiterReview';
import LoadFailure from '@/components/common/LoadFailure';
import { extensionConfig } from '@/config/extension';

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
  MobilePanel,
  ShowAllButton,
  HeroProgress,
  MobileExtensionNote,
  MobileToolDock,
  mobileEmptySx,
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
  tailoredCardSx,
  StartPanel,
  StartActions,
  StartPrimary,
  StartSecondary,
} from './styled';
import { ROUTES, ALLOWED_RESUME_TYPES, TIMINGS as DASH_TIMINGS, LIMITS, EXTENSION_STEPS_DATA } from './constants';
import { COMPANY_LOGO_COLORS, EXTENSION_STEP_COLORS } from './styled';
import { getGreeting } from './utils';
import ProfileCompletionCard from './ProfileCompletionCard';
import FinishCoachCard from './FinishCoachCard';
import { takeFreshSignIn } from '@/utils/freshSignIn';
import useProfileCompletion from '@/hooks/useProfileCompletion';

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


// A company for a tailored-profile card when none was saved. Every Ashby
// posting was saved without one until the extension learned to read Ashby's
// "Role @ Company" tab title, so its card showed a bare job title among other
// bare job titles. The hosted ATSes carry the employer in the URL.
const companyFromJobUrl = (jobUrl) => {
  try {
    const u = new URL(String(jobUrl || ''));
    const host = u.hostname.replace(/^www\./, '');
    const cap = (x) => x.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (/myworkdayjobs\.com$/.test(host)) return cap(host.split('.')[0]);
    if (/(ashbyhq\.com|greenhouse\.io|lever\.co|workable\.com|breezy\.hr|jobvite\.com|smartrecruiters\.com)$/.test(host)) {
      const seg = u.pathname.split('/').filter(Boolean)[0] || '';
      return seg && !/^(jobs?|careers?|embed|apply)$/i.test(seg) && !/^[0-9a-f-]{20,}$/i.test(seg) ? cap(seg) : '';
    }
    if (/linkedin|indeed|glassdoor|ziprecruiter/.test(host)) return '';
    const parts = host.split('.');
    return parts.length >= 2 ? cap(parts[parts.length - 2]) : '';
  } catch (_) {
    return '';
  }
};
const cardCompany = (t) => (t?.companyName && String(t.companyName).trim()) || companyFromJobUrl(t?.jobUrl) || '';
const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  /* Arrived straight from onboarding, or just signed in or signed up any
     other way: open on the jobs that fit the profile. The state and the
     sign-in mark are cleared at once so a refresh or a Back does not bring
     the pop-up round again. Coach answers come in the state; a plain
     sign-in passes none and the pop-up reads their saved ones. */
  const location = useLocation();
  const [matchesFor, setMatchesFor] = useState(() => {
    const fresh = takeFreshSignIn();
    return location.state?.onboardingMatches || (fresh ? {} : null);
  });
  useEffect(() => {
    if (location.state?.onboardingMatches) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const closeMatches = useCallback(() => setMatchesFor(null), []);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
  // No profile on the server yet — the dashboard shows its own front door
  // rather than bouncing into the coach. See loadProfile's 404 branch.
  const [needsProfile, setNeedsProfile] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  // Indices must track the <Tab> order rendered below: Overview, Experience,
  // Education, Projects, Tailored Profiles, and Posts when the feed flag is on.
  // They had drifted one place apart, so ?tab=education opened Projects.
  // `skills` has no tab of its own — skills render inside Overview.
  const TAB_MAP = {
    overview: 0,
    skills: 0,
    experience: 1,
    education: 2,
    projects: 3,
    tailored: 4,
    // Only mapped when the Posts tab actually renders; otherwise an unknown
    // key falls back to Overview rather than a blank panel.
    ...(featureFlags.feed ? { posts: 5 } : {}),
  };
  const [activeTab, setActiveTab] = useState(() => TAB_MAP[searchParams.get('tab')] ?? 0);
  const requestedTab = searchParams.get('tab');
  const requestedResumeId = searchParams.get('resumeId') || searchParams.get('appId');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  
  // Tailored profiles state
  const [tailoredProfiles, setTailoredProfiles] = useState([]);
  const [loadingTailored, setLoadingTailored] = useState(false);
  // The tailored resume to open on the Tailored tab (from the overview card).
  const [tailoredFocusId, setTailoredFocusId] = useState(null);

  // Resume download state
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [downloadTailoredId, setDownloadTailoredId] = useState(null);
  const [downloadTailoredTitle, setDownloadTailoredTitle] = useState(null);
  const [downloadInitialTab, setDownloadInitialTab] = useState('preview');
  
  // Resume upload state
  const [uploadingResume, setUploadingResume] = useState(false);
  
  // AI Usage state
  const [aiUsage, setAiUsage] = useState(null);

  // In-place Enhancement state
  const [showEnhancePrompt, setShowEnhancePrompt] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  // Full 429 payload from the AI rate limiter; null when not limited.
  const [limitInfo, setLimitInfo] = useState(null);
  // A finished rewrite to open Enhance at its Review step (one that completed
  // while the dialog was closed or the user was on another page).
  const [enhanceResult, setEnhanceResult] = useState(null);
  // Enhancement runs as a background task so it survives leaving this page:
  // it used to live in this component, and navigating away lost the result
  // while still charging the credit.
  const { tasks: bgTasks, startTask, dismissTask } = useBackgroundTasks();
  const mountedRef = useMountedRef();
  const ENHANCE_TASK_ID = 'enhance-profile';

  // Recruiter Review (components/RecruiterReview.jsx)
  const [gettingTips, setGettingTips] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [reviewReady, setReviewReady] = useState(false);
  const REVIEW_TASK_ID = 'recruiter-review';
  const showReviewRef = useRef(false);
  showReviewRef.current = showReview;

  // Chrome extension promo dismissal (mobile only — extension is desktop-only)
  const [extPromoDismissed, setExtPromoDismissed] = useState(
    () => localStorage.getItem('profileai_ext_promo_dismissed') === '1'
  );
  const dismissExtPromo = () => {
    setExtPromoDismissed(true);
    try { localStorage.setItem('profileai_ext_promo_dismissed', '1'); } catch { /* ignore */ }
  };

  // Phone layout: the tabs pin under the navbar and follow the section being
  // read, and the AI tools dock to the bottom once their card scrolls away.
  const [navHeight, setNavHeight] = useState(56);
  const [toolsDocked, setToolsDocked] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showAllExperience, setShowAllExperience] = useState(false);
  const aiToolsRef = useRef(null);
  const tabsHeaderRef = useRef(null);
  const panelRefs = useRef([]);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  // Set when the scroll moved the tab, so the tab change doesn't scroll back.
  const spyTabRef = useRef(false);
  // Set while a tab tap is scrolling, so the passing sections don't flicker.
  const scrollLockRef = useRef(false);
  const unlockTimerRef = useRef(0);
  const didFirstScrollRef = useRef(false);
  const pageReady = !!profile && !loading && !authLoading;

  const panelOffset = () => navHeight + (tabsHeaderRef.current?.offsetHeight || 52);

  const holdScrollLock = () => {
    scrollLockRef.current = true;
    window.clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = window.setTimeout(() => { scrollLockRef.current = false; }, 160);
  };

  const scrollToPanel = (index, behavior) => {
    const el = panelRefs.current[index];
    if (!el) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    holdScrollLock();
    window.scrollTo({
      top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - panelOffset()),
      behavior: reduceMotion ? 'auto' : behavior,
    });
  };

  // The navbar's height changes with its second row of nav pills, so it is
  // measured rather than assumed: the pinned <nav> at the top of the page.
  useEffect(() => {
    if (!isMobile) return undefined;
    const nav = [...document.querySelectorAll('nav')].find((el) => {
      const { position } = window.getComputedStyle(el);
      return position === 'sticky' || position === 'fixed';
    });
    if (!nav) return undefined;
    const measure = () => setNavHeight(Math.round(nav.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [isMobile]);

  useEffect(() => {
    const el = aiToolsRef.current;
    if (!isMobile || !pageReady || !el) {
      setToolsDocked(false);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setToolsDocked(!entry.isIntersecting && entry.boundingClientRect.top < navHeight),
      { rootMargin: `-${navHeight}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile, pageReady, navHeight]);

  // Scrolling moves the tab to the section under the pinned tabs.
  useEffect(() => {
    if (!isMobile || !pageReady) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = panelOffset() + 8;
      let current = 0;
      let last = 0;
      panelRefs.current.forEach((el, i) => {
        if (!el) return;
        last = i;
        if (el.getBoundingClientRect().top <= line) current = i;
      });
      // A short last section can never reach the line; the page bottom counts.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && window.scrollY > 0) current = last;
      if (current !== activeTabRef.current) {
        spyTabRef.current = true;
        setActiveTab(current);
      }
    };
    const onScroll = () => {
      if (scrollLockRef.current) {
        holdScrollLock();
        return;
      }
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, pageReady, navHeight]);

  // A tab tap, ?tab= or any other tab change scrolls to that section.
  useEffect(() => {
    if (!isMobile || !pageReady) return;
    if (spyTabRef.current) {
      spyTabRef.current = false;
      return;
    }
    const first = !didFirstScrollRef.current;
    didFirstScrollRef.current = true;
    if (first && activeTab === 0) return;
    scrollToPanel(activeTab, first ? 'auto' : 'smooth');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isMobile, pageReady]);

  useEffect(() => () => window.clearTimeout(unlockTimerRef.current), []);

  // In-place Tailor state
  const [showTailorJobInput, setShowTailorJobInput] = useState(false);

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

  // ?tab= picks the tab when it changes. It used to also snap every other
  // tab change back to it, which fought the phone's scroll-following tabs.
  useEffect(() => {
    const nextTab = TAB_MAP[requestedTab];
    if (nextTab !== undefined) {
      setActiveTab(nextTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab]);

  // Derived values
  const companyLogoColors = COMPANY_LOGO_COLORS;
  const allowedTypes = ALLOWED_RESUME_TYPES;
  const profileData = {
    title: profile?.title || '',
    summary: profile?.summary || '',
    skills: profile?.skills ? Object.values(profile.skills).flat() : [],
    experience: profile?.experience || [],
    education: profile?.education || [],
    projects: profile?.projects || [],
    // The resume generator builds the contact header purely from this payload —
    // drop these and the PDF header collapses to just the email.
    phone: profile?.phone || '',
    location: profile?.location || '',
    linkedinUrl: profile?.linkedinUrl || '',
    githubUrl: profile?.githubUrl || '',
    portfolioUrl: profile?.portfolioUrl || ''
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

  // Shared completion scoring (same logic as the ProfileForm sidebar).
  const completion = useProfileCompletion(profile);

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
    }
    /* A candidate with no profile used to be bounced to /onboarding from
       here, before loadProfile had even answered. That is what made the app
       feel like it had no front door: every single visit landed you
       mid-conversation with the coach. The dashboard now has a start screen
       for exactly this case — see the needsProfile branch in the render —
       so there is somewhere to be instead. */
  }, [user, navigate, isValidating]);

  /* The same thing by another route: settled, signed in, nothing loaded.
     It no longer bounces — it shows the start screen, which is what this
     state actually means. Kept as an effect rather than deleted because
     `needsProfile` is only set by a confirmed 404, and a profile that comes
     back empty for any other reason would otherwise render nothing at all. */
  useEffect(() => {
    if (
      !authLoading &&
      !isValidating &&
      !loading &&
      user?.role === 'candidate' &&
      !profile &&
      !error
    ) {
      setNeedsProfile(true);
    }
  }, [authLoading, isValidating, loading, user, profile, error]);

  // Load profile data. Lifted out of the effect so the failure state can
  // re-run it — before this, a backend hiccup on boot left the user with a
  // dead page whose only escape was reloading the whole app.
  const loadProfile = useCallback(async () => {
    if (!user) {
      authDebug('skip loadProfile: no user');
      diag('dashboard.loadProfile.skip', { reason: 'no-user' });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
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
        /* No profile yet. This used to navigate straight into the coach,
           which meant the app had no front door — opening it dropped you
           mid-conversation every time, with no way to see what else was
           here or that you had a half-finished draft waiting. Show the
           dashboard's own starting screen instead and let them choose. */
        try {
          const draftKey = `profileai_draft_${user?.id || 'unknown'}`;
          const savedDraft = localStorage.getItem(draftKey);
          if (savedDraft) {
            const draft = JSON.parse(savedDraft);
            if (draft && (draft.title || draft.summary || draft.experience?.length > 0)) {
              setHasDraft(true);
            }
          }
        } catch (draftErr) {
          // ignore draft check errors
        }
        setNeedsProfile(true);
      } else {
        // Keep the error object, not just its message: LoadFailure reads the
        // status/code off it to tell "you're offline" apart from "we broke".
        setError(err);
      }
    } finally {
      authDebug('loadProfile finished');
      setLoading(false);
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadTailoredProfiles();
      loadUserPosts();
      loadAiUsage();
    }
  }, [user, loadProfile]);

  const loadAiUsage = async () => {
    try {
      const response = await subscriptionAPI.getUsage();
      setAiUsage(response.data);
    } catch (err) {
      console.error('Failed to load AI usage:', err);
    }
  };

  // Compute the binding credit limit for a feature from the batch usage payload.
  // A feature is truly unlimited only when ALL four cap axes (lifetime, daily,
  // weekly, monthly) are -1. Otherwise the binding remaining = the smallest
  // non-(-1) remaining value, and we label it with the matching period.
  const computeBindingFromPayload = (feature) => {
    if (!feature) return { isUnlimited: true, remaining: -1, period: 'week' };
    const weeklyUncapped   = feature.weeklyLimit   === -1;
    const monthlyUncapped  = feature.monthlyLimit  === -1;
    const dailyUncapped    = (feature.dailyLimit   ?? -1) === -1;
    const lifetimeUncapped = (feature.lifetimeLimit ?? -1) === -1;
    const isUnlimited = weeklyUncapped && monthlyUncapped && dailyUncapped && lifetimeUncapped;
    const wRem = weeklyUncapped   ? Infinity : (feature.weeklyRemaining   ?? 0);
    const mRem = monthlyUncapped  ? Infinity : (feature.monthlyRemaining  ?? 0);
    const dRem = dailyUncapped    ? Infinity : (feature.dailyRemaining    ?? 0);
    const lRem = lifetimeUncapped ? Infinity : (feature.lifetimeRemaining ?? 0);
    const candidates = [
      { period: 'week', rem: wRem },
      { period: 'month', rem: mRem },
      { period: 'day', rem: dRem },
      { period: 'lifetime', rem: lRem },
    ];
    const binding = candidates.reduce((a, b) => a.rem <= b.rem ? a : b);
    const remaining = isUnlimited ? -1 : Math.min(wRem, mRem, dRem, lRem);
    return { isUnlimited, remaining, period: binding.period };
  };

  const getUsageBadge = (featureKey) => {
    // Download Resume has no credit cost — suppress the badge entirely.
    if (!featureKey) return null;
    const { isUnlimited, remaining, period } = computeBindingFromPayload(
      aiUsage?.usage?.[featureKey]
    );
    const periodSuffix = period === 'month' ? 'this month'
      : period === 'day' ? 'today'
      : period === 'lifetime' ? 'lifetime'
      : 'this week';
    if (isUnlimited) {
      return (
        <span className="usage-info">
          <span className="usage-dot" />
          <span className="usage-count">Unlimited</span>
        </span>
      );
    }
    const cls = remaining === 0 ? 'danger' : remaining === 1 ? 'warning' : '';
    return (
      <span className="usage-info">
        <span className={`usage-dot ${cls}`} />
        <span className={`usage-count ${cls}`}>
          {remaining === 0 ? `None left ${periodSuffix}` : `${remaining} left ${periodSuffix}`}
        </span>
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

  // The overview's Tailored Versions card opens one on the Tailored tab.
  const handleViewTailored = (tailored) => {
    setTailoredFocusId(tailored.id);
    setActiveTab(4);
  };

  const handleDownloadResume = (tailoredId = null, tailoredTitle = null, tab = 'preview') => {
    setDownloadTailoredId(tailoredId);
    setDownloadTailoredTitle(tailoredTitle);
    setDownloadInitialTab(tab);
    setShowResumeDialog(true);
  };

  // Enhance with AI. The flow (components/EnhanceFlow.jsx) runs Analyze and
  // Review; the rewrite itself runs here as a background task, so leaving the
  // page doesn't lose a result that has already been paid for.
  const openEnhanceResult = (data) => {
    setEnhanceResult(data);
    setShowEnhancePrompt(true);
  };
  // Finished after "Hide and keep working": say so instead of popping it open.
  const [enhanceReady, setEnhanceReady] = useState(false);
  const holdEnhanceResult = (data) => {
    setEnhanceResult(data);
    setEnhanceReady(true);
  };

  // A rewrite that finished while the user was on another page: open it at
  // Review the moment they return.
  useEffect(() => {
    const task = bgTasks[ENHANCE_TASK_ID];
    if (!task || task.status !== 'done' || !task.needsAttention) return;
    dismissTask(ENHANCE_TASK_ID);
    if (task.result?.success) openEnhanceResult(task.result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgTasks]);

  const runEnhance = async (options) => {
    setEnhancing(true);
    try {
      const data = await startTask({
        id: ENHANCE_TASK_ID,
        label: 'Enhancing your profile',
        doneLabel: 'Your profile enhancement is ready',
        openPath: '/profile',
        ownerAlive: () => mountedRef.current,
        // Only the response body is kept: it is what the page needs, and it
        // is what survives a refresh in session storage.
        run: async () => (await profileAPI.enhanceResumeData(profileData, undefined, undefined, options)).data,
      });
      // Left the page meanwhile: the indicator offers the result instead.
      if (!mountedRef.current) return undefined;
      dismissTask(ENHANCE_TASK_ID);
      loadAiUsage();
      return data;
    } finally {
      setEnhancing(false);
    }
  };

  const applyEnhance = async (keptChanges, { skippedResults = 0 } = {}) => {
    await profileAPI.createOrUpdateProfile(applyEnhanceChanges(profile, keptChanges));
    const refreshed = await profileAPI.getMyProfile();
    setProfile(refreshed.data);
    loadAiUsage();
    setShowEnhancePrompt(false);
    setEnhanceResult(null);
    const n = keptChanges.length;
    setSnackbar({
      open: true,
      message: `Saved ${n} change${n === 1 ? '' : 's'} to your profile.`
        + (skippedResults ? ` ${skippedResults} result${skippedResults === 1 ? '' : 's'} couldn't be added; add ${skippedResults === 1 ? 'it' : 'them'} in Edit.` : ''),
    });
  };

  // In-place AI Recruiter Feedback
  // Runs as a background task so "Hide and keep working" doesn't lose it.
  // Reopening an unchanged profile is a server cache hit and costs nothing.
  const handleGetTipsInPlace = async () => {
    setReviewReady(false);
    setReviewError('');
    setReview(null);
    setShowReview(true);
    setGettingTips(true);
    try {
      const data = await startTask({
        id: REVIEW_TASK_ID,
        label: 'Recruiter Review',
        doneLabel: 'Your Recruiter Review is ready',
        openPath: '/profile',
        ownerAlive: () => mountedRef.current,
        run: async () => (await profileAPI.recruiterReview()).data,
      });
      if (!mountedRef.current) return;
      dismissTask(REVIEW_TASK_ID);
      setReview(data.review);
      loadAiUsage();
      // Hidden while it ran: tell them instead of popping it open.
      if (!showReviewRef.current) setReviewReady(true);
    } catch (err) {
      const limit = parseLimitError(err);
      if (limit) { setShowReview(false); setLimitInfo(limit); return; }
      setReviewError(extractApiError(err, 'Could not review your profile. Please try again.'));
    } finally {
      setGettingTips(false);
    }
  };

  // A review that finished while the user was on another page.
  useEffect(() => {
    const task = bgTasks[REVIEW_TASK_ID];
    if (!task || task.status !== 'done' || !task.needsAttention) return;
    dismissTask(REVIEW_TASK_ID);
    if (task.result?.review) { setReview(task.result.review); setShowReview(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgTasks]);

  // Each tip's button opens the screen that fixes it.
  const handleReviewAction = (tip) => {
    const editSection = {
      add_project: 'projects', clean_titles: 'experience', add_links: 'basic', add_photo: 'basic',
      add_location: 'basic', edit_education: 'education', trim_skills: 'skills',
    }[tip.fix];
    setShowReview(false);
    if (tip.fix === 'set_target_role') navigate('/profile/about-you');
    else if (editSection) handleCompletionItemClick(editSection);
    else setShowEnhancePrompt(true);
  };

  // In-place Tailor: Step 1 – Analyze gaps
  // Tailor for a Job (components/TailorFlow.jsx) saves the tailored copy
  // itself; the page only refreshes the list.
  const handleTailorSaved = (jobTitle) => {
    setShowTailorJobInput(false);
    loadTailoredProfiles();
    loadAiUsage();
    setSnackbar({ open: true, message: `Tailored copy "${jobTitle}" saved. Your main profile is unchanged.` });
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

  // Deep-link from the completion checklist straight into a section editor.
  const handleCompletionItemClick = (section) => {
    navigate('/profile/edit', { state: { section } });
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
  
  // Don't render candidate dashboard for recruiters. Admins are allowed
  // through so they can dogfood the candidate surface (see 333e93b).
  if (user?.role === 'recruiter') {
    return null;
  }

  if (error) {
    return (
      <PageContainer>
        <LoadFailure
          error={error}
          title="We couldn't load your profile"
          onRetry={loadProfile}
        />
      </PageContainer>
    );
  }

  if (needsProfile) {
    return (
      <PageContainer>
        <StartPanel>
          <h1>Welcome{user?.firstName ? `, ${user.firstName}` : ''}</h1>
          <p>
            You do not have a profile yet, and it is what gets you matched to jobs and
            lets you apply. Building one takes a few minutes: upload a resume if you
            have one, talk it through on a short call, or answer a few questions in chat.
          </p>
          <StartActions>
            <StartPrimary
              onClick={() => {
                trackEvent('start_screen_build_clicked', { hasDraft });
                navigate('/profile/create');
              }}
            >
              {hasDraft ? 'Pick up where you left off' : 'Build my profile'}
            </StartPrimary>
            <StartSecondary
              onClick={() => {
                trackEvent('start_screen_browse_clicked', {});
                navigate('/jobs');
              }}
            >
              Browse jobs first
            </StartSecondary>
          </StartActions>
        </StartPanel>
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

  const aiTools = [
    {
      key: 'enhance', label: 'Enhance', Icon: EnhanceIcon,
      gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
      description: 'Optimize your profile content automatically. · 1 credit',
      usageKey: 'profile_enhance',
      // Also how a hidden rewrite is reopened, so it stays enabled while one runs.
      onClick: () => { setEnhanceReady(false); setShowEnhancePrompt(true); },
    },
    {
      key: 'tailor', label: 'Tailor', Icon: TailorIcon,
      gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      description: 'Customize for specific job descriptions. · 1 credit',
      usageKey: 'tailor_profile',
      onClick: () => setShowTailorJobInput(true),
    },
    {
      key: 'tips', label: 'Recruiter Review', dockLabel: 'Review', Icon: TipsIcon,
      gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      description: 'See your profile the way a recruiter does. · 1 credit',
      usageKey: 'career_suggestions',
      onClick: handleGetTipsInPlace, disabled: gettingTips,
    },
    {
      key: 'download', label: 'Download', labelSuffix: ' Resume', Icon: DownloadIcon,
      gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
      description: 'Export your profile as a PDF resume.',
      onClick: () => handleDownloadResume(),
    },
  ];

  // Desktop shows the active tab's panel; phones stack every panel in one
  // scroll so the pinned tabs can follow along.
  const panel = (index, content) => {
    if (!isMobile) return activeTab === index ? content : null;
    return (
      <MobilePanel
        id={`profile-tabpanel-${index}`}
        aria-labelledby={`profile-tab-${index}`}
        ref={(el) => { panelRefs.current[index] = el; }}
      >
        {content}
      </MobilePanel>
    );
  };

  const visibleExperience = isMobile && !showAllExperience ? experience.slice(0, 3) : experience;

  return (
    <PageContainer style={isMobile ? { '--profile-nav-h': `${navHeight}px` } : undefined}>
      {/* Main Content */}
      <MainContent>
        {/* Profile Hero, identity-first header */}
        <ProfileHero>
          <HeroAvatar src={resolveImageUrl(profile?.profilePicture)} alt={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}>
            {user?.firstName?.[0]}{isMobile && user?.lastName?.[0]}
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
            {/* Their goals and call summaries, kept by the coach; theirs to
                see, edit and delete. */}
            <HeroEditBtn className="secondary" onClick={() => navigate('/profile/about-you')} title="What ProfilleAI knows about you">
              About you
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
          {isMobile && !completion.done && (
            <HeroProgress
              type="button"
              onClick={() => setShowChecklist((open) => !open)}
              aria-expanded={showChecklist}
              aria-label={`Profile ${completion.pct}% complete. ${showChecklist ? 'Hide' : 'Show'} the checklist`}
            >
              <span className="track">
                <span className="fill" style={{ width: `${completion.pct}%` }} />
              </span>
              <span className="text">
                <strong>{completion.pct}%</strong> · {completion.missing.length} step{completion.missing.length === 1 ? '' : 's'} left
              </span>
            </HeroProgress>
          )}
        </ProfileHero>

        {/* Saved partway through the coach: the way back to finish it. */}
        {profile && <FinishCoachCard />}

        {/* Profile completion checklist — progressive profiling nudge.
            Auto-hides once the profile is 100% complete to avoid clutter. */}
        {profile && !completion.done && (!isMobile || showChecklist) && (
          <ProfileCompletionCard
            completion={completion}
            onItemClick={handleCompletionItemClick}
            defaultOpen={isMobile}
          />
        )}

        {/* Chrome Extension promo — educate candidates on applying anywhere.
            The extension only runs on desktop Chrome, so on mobile we show a
            compact, dismissable note pointing users to a desktop browser. */}
        {!isMobile && (
          <Card
            sx={{
              mb: 3,
              borderRadius: 3,
              background: 'linear-gradient(135deg,#1e1b3a 0%,#2a1d4d 100%)',
              border: '1px solid rgba(124,58,237,0.35)',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', p: { xs: 2.5, sm: 3 } }}>
              <Box
                sx={{
                  width: 52, height: 52, borderRadius: 2.5, flexShrink: 0,
                  background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ExtensionIcon sx={{ color: '#fff', fontSize: 28 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>
                    Apply to jobs anywhere with our Chrome extension
                  </Typography>
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 14.5, lineHeight: 1.55 }}>
                  Autofill applications, draft AI answers to screening questions, and tailor your
                  resume on LinkedIn, Greenhouse, Workday, and any career page — without leaving the
                  job posting.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
                {extensionConfig.isPublished && extensionConfig.storeUrl && (
                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={() => window.open(extensionConfig.storeUrl, '_blank', 'noopener,noreferrer')}
                    sx={{ background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
                  >
                    Add to Chrome
                  </Button>
                )}
                <Button
                  variant="outlined"
                  onClick={() => navigate('/extension')}
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  Learn more
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}


        <AIToolsCard ref={aiToolsRef}>
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
            {aiTools.map((tool) => (
              <AIToolButton key={tool.key} onClick={tool.onClick} disabled={tool.disabled}>
                <span className="icon-wrap" style={{ background: tool.gradient }}><tool.Icon /></span>
                <span className="label">{tool.label}{tool.labelSuffix && <span className="label-suffix">{tool.labelSuffix}</span>}</span>
                <span className="description">{tool.description}</span>
                {getUsageBadge(tool.usageKey)}
              </AIToolButton>
            ))}
          </AIToolsGrid>
        </AIToolsCard>

        {/* The extension only runs on desktop Chrome, so phones get a
            dismissable one-line note instead of the promo. */}
        {isMobile && !extPromoDismissed && (
          <MobileExtensionNote>
            <p><strong>Chrome extension</strong> — open ProfilleAI on desktop to autofill applications.</p>
            <button type="button" aria-label="Dismiss" onClick={dismissExtPromo}>
              <CloseIcon />
            </button>
          </MobileExtensionNote>
        )}

        {/* Skills are rendered once in the desktop sidebar below. The previous
            MobileProfileSection duplicated the Skills card into the DOM (it
            was hidden on desktop via CSS), which made screen readers and the
            text-only page dump report "Skills & Expertise" twice. Mobile users
            still get the skills via the Skills tab and via the public profile. */}
        
        {/* Content Grid */}
        <ContentGrid $wide={!isMobile && activeTab === 4}>
        {/* Left Sidebar - Hidden on mobile, and beside Tailored resumes */}
        <DesktopSidebar $hide={!isMobile && activeTab === 4}>
        <Sidebar>
          {/* Contact Card.
              The avatar / name / title / location / "Edit Profile" / "Open to work"
              badge are all surfaced in the ProfileHero at the top of the page,
              so this card is now contact-only to avoid duplication. */}
          {(user?.email || profile?.phone || profile?.linkedinUrl || profile?.githubUrl || profile?.portfolioUrl || profile?.twitterUrl || profile?.websiteUrl) && (
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
                {profile?.twitterUrl && (
                  <ContactItem href={profile.twitterUrl} target="_blank" rel="noopener noreferrer">
                    <TwitterIcon /> Twitter
                  </ContactItem>
                )}
                {profile?.portfolioUrl && (
                  <ContactItem href={profile.portfolioUrl} target="_blank" rel="noopener noreferrer">
                    <WebsiteIcon /> Portfolio
                  </ContactItem>
                )}
                {profile?.websiteUrl && (
                  <ContactItem href={profile.websiteUrl} target="_blank" rel="noopener noreferrer">
                    <WebsiteIcon /> Website
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
                        {cardCompany(tailored) || tailored.jobTitle}
                      </Typography>
                      {cardCompany(tailored) && (
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
            <TabsHeader ref={tabsHeaderRef}>
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
                {/* Posts tab is gated on the social-feed feature flag.
                    When the /feed route is off (VITE_ENABLE_FEED=false),
                    showing the tab would send users to a blank no-route
                    page via Create Post. */}
                {featureFlags.feed && (
                  <Tab label="Posts" id="profile-tab-5" aria-controls="profile-tabpanel-5" />
                )}
              </Tabs>
            </TabsHeader>
            
            <TabContent
              {...(isMobile ? {} : {
                role: 'tabpanel',
                id: `profile-tabpanel-${activeTab}`,
                'aria-labelledby': `profile-tab-${activeTab}`,
                tabIndex: 0,
              })}
            >
              {/* Overview Tab */}
              {panel(0, (
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
                  
                  {/* Experience Preview — phones have the full Experience
                      section right below, so it would repeat. */}
                  {!isMobile && (
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
                  )}
                </>
              ))}
              
              {/* Experience Tab */}
              {panel(1, (
                <Section>
                  <SectionHeader>
                    <SectionTitle>Work Experience</SectionTitle>
                    <SectionAction onClick={handleEditProfile}>
                      <AddIcon fontSize="small" /> Add
                    </SectionAction>
                  </SectionHeader>
                  {visibleExperience.map((exp, idx) => renderExperienceItem(exp, idx, false))}
                  {visibleExperience.length < experience.length && (
                    <ShowAllButton type="button" onClick={() => setShowAllExperience(true)}>
                      Show all {experience.length} roles
                    </ShowAllButton>
                  )}
                  {experience.length === 0 && (
                    <Box sx={isMobile ? mobileEmptySx : { color: '#7b7f9e', fontSize: '14px', py: 4, textAlign: 'center' }}>
                      No work experience added yet.
                    </Box>
                  )}
                </Section>
              ))}
              
              {/* Education Tab */}
              {panel(2, (
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
                    <Box sx={isMobile ? mobileEmptySx : { color: '#7b7f9e', fontSize: '14px', py: 4, textAlign: 'center' }}>
                      No education added yet.
                    </Box>
                  )}
                </Section>
              ))}
              
              {/* Projects Tab */}
              {panel(3, (
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
                    <Box sx={isMobile ? mobileEmptySx : { color: '#7b7f9e', fontSize: '14px', py: 4, textAlign: 'center' }}>
                      No projects added yet.
                    </Box>
                  )}
                </Section>
              ))}
              
              {/* Tailored Profiles Tab */}
              {panel(4, (
                <TailoredResumes
                  items={tailoredProfiles}
                  loading={loadingTailored}
                  onItemsChange={setTailoredProfiles}
                  isMobile={isMobile}
                  user={user}
                  profile={profile}
                  onNew={() => setShowTailorJobInput(true)}
                  onOpenResume={(tp, tab) => handleDownloadResume(tp.id, tp.jobTitle, tab)}
                  requestedId={tailoredFocusId || (activeTab === 4 ? requestedResumeId : null)}
                />
              ))}

              {/* Posts Tab — gated by the social-feed feature flag. */}
              {featureFlags.feed && panel(5, (
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
              ))}
            </TabContent>
          </TabsContainer>
        </RightContent>
      </ContentGrid>
    </MainContent>

      {isMobile && (
        <MobileToolDock $visible={toolsDocked} aria-hidden={!toolsDocked} inert={toolsDocked ? undefined : ''}>
          {aiTools.map((tool) => (
            <button key={tool.key} type="button" onClick={tool.onClick} disabled={tool.disabled}>
              <span className="icon-wrap" style={{ background: tool.gradient }}><tool.Icon /></span>
              {tool.dockLabel || tool.label}
            </button>
          ))}
        </MobileToolDock>
      )}

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
        initialTab={downloadInitialTab}
      />
      
      {/* Out-of-credits modal, driven by the limiter's own 429 payload */}
      <LimitReachedModal
        limit={limitInfo}
        onClose={() => setLimitInfo(null)}
      />

      {/* Resume Upload Processing Modal */}
      <ProcessingModal
        open={uploadingResume}
        type="resume"
        title="Processing Resume"
        subtitle="AI is parsing your resume and extracting your professional information..."
      />
      
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* Enhance with AI: Analyze, Rewrite, Review */}
      <EnhanceFlow
        open={showEnhancePrompt}
        onClose={() => { setShowEnhancePrompt(false); setEnhanceResult(null); }}
        profileData={profileData}
        runEnhance={runEnhance}
        onApply={applyEnhance}
        onLateResult={holdEnhanceResult}
        initialResult={enhanceResult}
        creditLabel={aiUsage?.usage?.profile_enhance && computeBindingFromPayload(aiUsage.usage.profile_enhance).isUnlimited ? null : '1 credit'}
        onLimit={setLimitInfo}
      />

      <Snackbar
        open={enhanceReady}
        onClose={() => setEnhanceReady(false)}
        message="Your enhancement is ready to review"
        action={<Button size="small" onClick={() => { setEnhanceReady(false); setShowEnhancePrompt(true); }}>Open</Button>}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* Recruiter Review */}
      <RecruiterReview
        open={showReview}
        onClose={() => setShowReview(false)}
        loading={gettingTips}
        error={reviewError}
        review={review}
        onRetry={handleGetTipsInPlace}
        onHide={() => setShowReview(false)}
        onAction={handleReviewAction}
        onEnhance={() => { setShowReview(false); setShowEnhancePrompt(true); }}
      />
      <Snackbar
        open={reviewReady}
        onClose={() => setReviewReady(false)}
        message="Your Recruiter Review is ready"
        action={<Button size="small" onClick={() => { setReviewReady(false); setShowReview(true); }}>Open</Button>}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      {/* Tailor for a Job: Paste job, Match, Save */}
      <TailorFlow
        open={showTailorJobInput}
        onClose={() => setShowTailorJobInput(false)}
        profile={profile}
        onSaved={handleTailorSaved}
        onLimit={setLimitInfo}
        creditLabel={aiUsage?.usage?.tailor_profile && computeBindingFromPayload(aiUsage.usage.tailor_profile).isUnlimited ? null : '1 credit'}
      />
      {/* Only over a profile: someone without one is on their way to build it. */}
      <OnboardingMatches open={!!matchesFor && !!profile} prefs={matchesFor || undefined} onClose={closeMatches} />
    </PageContainer>
  );
};

export default Dashboard;
