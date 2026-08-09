import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { profileAPI, tailoredProfileAPI, resolveImageUrl } from '@/services/api';
import {
  Container,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Grid,
  Chip,
  IconButton,
  Alert,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Tooltip,
  Avatar,
  Breadcrumbs,
  LinearProgress,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  Menu,
  MenuItem,
  Snackbar
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon,
  AutoAwesome as AIIcon,
  Lightbulb as TipIcon,
  CheckCircle as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  CompareArrows as CompareIcon,
  Work as WorkIcon,
  ContentPaste as PasteIcon,
  BookmarkAdd as BookmarkAddIcon,
  ArrowBack as BackIcon,
  Download as DownloadIcon,
  Tune as TailorIcon,
  CameraAlt as CameraIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  NavigateNext as NavigateNextIcon,
  UploadFile as UploadFileIcon,
  Badge as BadgeIcon,
  BusinessCenter as BusinessCenterIcon,
  Stars as StarsIcon,
  School as SchoolIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  LinkedIn as LinkedInIcon,
  GitHub as GitHubIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
  InfoOutlined as InfoOutlinedIcon,
  HelpOutline as HelpIcon
} from '@mui/icons-material';
import {
  PageContainer,
  AIToolsBar,
  AIToolsLeft,
  BreadcrumbLink,
  BreadcrumbCurrent,
  MobileBackButton,
  AIToolsButtons,
  AIButton,
  HideOnMobile,
  FormContainer,
  Sidebar,
  SidebarCard,
  SidebarTitle,
  ProgressSection,
  ProgressLabel,
  NavItems,
  NavItem,
  MainContent,
  ProfilePictureUpload,
  ProfileAvatar,
  AvatarOverlay,
  UploadPhotoText,
  UploadPhotoHint,
  MobileAIMenuButton,
  DraftRestoredBanner,
  MobileSectionNav,
  MobileSectionPills,
  MobileSectionPill,
  MobileCompletionBadge
} from './styled';
import { ROUTES, SOFTWARE_KEYWORDS, TECHNICAL_KEYWORDS, SOFT_SKILL_KEYWORDS, VALID_IMAGE_TYPES, ALLOWED_RESUME_TYPES, TIMINGS, LIMITS } from './constants';
import { stripMarkdown } from './utils';
import ProfileCelebration from './ProfileCelebration';
import { computeProfileCompletion } from '@/hooks/useProfileCompletion';
import EnhancePromptModal from '@/components/EnhancePromptModal';
import EnhancementPreviewModal from '@/components/EnhancementPreviewModal';
import ProfileWelcomeOnboardingModal from '@/components/ProfileWelcomeOnboardingModal';
import GapReviewDialog from '@/components/GapReviewDialog';
import AIProcessingModal from '@/components/AIProcessingModal';
import LimitReachedModal from '@/components/LimitReachedModal';
import { parseLimitError } from '@/utils/aiLimit';
import AICreditsBadge from '@/components/AICreditsBadge';
import { toIsoMonth, isPresentValue, parseLegacyPeriod, formatDateRange } from '@/utils/dateRange';
import { trackEvent } from '@/utils/analytics';
import { saveGuestProfileDraft } from '@/utils/guestDraft';
import ConfirmModal from '@/components/ConfirmModal';
import { validateHttpUrl, normalizeHttpUrl } from '@/utils/urlValidation';
import { extractApiError } from '@/utils/apiError';

// (Date helpers live in @/utils/dateRange so ProfileForm, Dashboard, and
// PublicProfile all render periods identically.)

// Best-effort one-time migration: when an existing record only has the legacy
// free-text `period` / `year` field, parse it into structured startDate/endDate
// so the new pickers can light up immediately. The original legacy field is
// kept on the entry as a fallback (helperText surfaces it). When it can't be
// parsed confidently, we leave start/end blank so the user can fill them in.
const migrateExperienceDates = (rows) =>
  (rows || []).map((row) => {
    if ((row.startDate || row.endDate) || !row.period) return row;
    const parsed = parseLegacyPeriod(row.period);
    if (!parsed) return row;
    return { ...row, startDate: parsed.startDate, endDate: parsed.endDate };
  });

const migrateEducationDates = (rows) =>
  (rows || []).map((row) => {
    if ((row.startDate || row.endDate) || (!row.year && !row.period)) return row;
    const parsed = parseLegacyPeriod(row.year || row.period);
    if (!parsed) return row;
    return { ...row, startDate: parsed.startDate, endDate: parsed.endDate };
  });

// Light theme TextField styling
  const darkTextFieldSx = {
    '& .MuiOutlinedInput-root': {
      color: '#1a1a2e',
      backgroundColor: 'white',
      borderRadius: '8px',
      transition: 'box-shadow 0.15s ease-in-out',
      '& fieldset': {
        borderColor: '#d1d5db',
        borderWidth: '1px',
      },
      '&:hover fieldset': {
        borderColor: '#667eea',
        borderWidth: '1px',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#667eea',
        borderWidth: '1px',
      },
      '&.Mui-focused': {
        boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.15)',
      },
    },
    // Truncate long values when input is not focused; show full text on focus.
    '& .MuiOutlinedInput-input:not(:focus)': {
      textOverflow: 'ellipsis',
    },
    '& textarea.MuiOutlinedInput-input': {
      textOverflow: 'clip',
    },
    '& .MuiInputLabel-root': {
      color: '#6b7280',
      fontSize: '12px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      '&.Mui-focused': {
        color: '#667eea',
      },
    },
    '& .MuiInputBase-input::placeholder': {
      color: '#9ca3af',
      opacity: 1,
    },
    // Suppress the browser's default focus outline on the inner <input>;
    // MUI's fieldset + box-shadow already conveys the focused state, and the
    // double border looked broken (a blue rectangle around only the input,
    // skipping the icon adornment).
    '& .MuiInputBase-input:focus, & .MuiInputBase-input:focus-visible': {
      outline: 'none',
      boxShadow: 'none',
    },
    '& .MuiFormHelperText-root': {
      color: '#9ca3af',
    },
  };

// ============ END STYLED COMPONENTS ============

/**
 * Reusable inline "Enhance with AI" button used by the Summary, Experience and
 * Project description fields. Always rendered (no length gate) so candidates
 * can discover the feature even when the field is empty — disabled state +
 * helper text explain why it's not actionable yet.
 */
const InlineAIEnhanceButton = ({ loading, disabled, onClick, helperText, label = 'Enhance with AI' }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 1.5,
      mt: 0.75,
      flexWrap: 'wrap',
    }}
  >
    <Typography
      variant="caption"
      sx={{ color: disabled ? '#94a3b8' : '#6366f1', fontSize: 11.5, fontWeight: 500 }}
    >
      {helperText}
    </Typography>
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      size="small"
      startIcon={loading ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <AIIcon sx={{ fontSize: 16 }} />}
      sx={{
        textTransform: 'none',
        fontWeight: 700,
        fontSize: 12.5,
        px: 1.5,
        py: 0.5,
        borderRadius: 1.5,
        color: '#fff',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
        '&:hover': {
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
        },
        '&.Mui-disabled': {
          background: '#e2e8f0',
          color: '#94a3b8',
          boxShadow: 'none',
        },
      }}
    >
      {loading ? 'Enhancing…' : `${label} · 1 credit`}
    </Button>
  </Box>
);

const ProfileForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Draft auto-save
  const DRAFT_KEY = useMemo(() => `profileai_draft_${user?.id || 'unknown'}`, [user?.id]);
  const draftTimerRef = useRef(null);
  const formDataRef = useRef(null); // Keep a ref for the beforeunload handler
  const initialFormDataRef = useRef(null); // Snapshot of initial form data for dirty checking
  // Snapshot of the profile as loaded from the server (BEFORE any localStorage
  // draft is merged in). Used by the "Clear data" action on the draft-restored
  // banner so it can revert to saved values without wiping the form.
  const savedProfileSnapshotRef = useRef(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [initialFormLoaded, setInitialFormLoaded] = useState(false); // Tracks when form is ready for auto-save
  const [enhancing, setEnhancing] = useState(false);
  const [gettingSuggestions, setGettingSuggestions] = useState(false);
  // AbortControllers for cancellable AI requests, so the loading modals' Cancel
  // button can abort the in-flight HTTP call without consuming a credit on the
  // client side. The server may still bill if the request had already reached
  // it, but the user-facing experience aborts immediately.
  const enhanceAbortRef = useRef(null);
  const suggestionsAbortRef = useRef(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  // Unified confirm-delete dialog for Experience/Project/Education entries
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: '', index: -1, label: '' });
  // Per-field validation errors (keyed by field name)
  const [fieldErrors, setFieldErrors] = useState({});
  // Top-level error summary shown on failed submit
  const [validationSummary, setValidationSummary] = useState([]);

  // Section refs for sidebar navigation
  const basicInfoRef = useRef(null);
  const experienceRef = useRef(null);
  const skillsRef = useRef(null);
  const educationRef = useRef(null);
  const projectsRef = useRef(null);
  const [activeSection, setActiveSection] = useState('basic');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saveToast, setSaveToast] = useState({ open: false, message: '' });
  const [suggestions, setSuggestions] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [enhancements, setEnhancements] = useState(null);
  const [showEnhancementDialog, setShowEnhancementDialog] = useState(false);
  const [showEnhancePrompt, setShowEnhancePrompt] = useState(false);
  // First-time welcome modal (one-shot per user, persisted in localStorage)
  const [showWelcome, setShowWelcome] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [isExistingProfile, setIsExistingProfile] = useState(false);
  const [profileId, setProfileId] = useState(null);
  // Celebration screen shown after a candidate's FIRST profile creation.
  const [showCelebration, setShowCelebration] = useState(false);
  // Guest (pre-registration) builder: AI features and the actual server-side
  // save both require an account, so any of those actions surface this
  // prompt instead of failing with a 401. `guestPromptReason` only changes
  // the copy — 'save' after they've finished building, 'feature' when they
  // reach for something AI-powered mid-edit.
  const [showGuestSignupPrompt, setShowGuestSignupPrompt] = useState(false);
  const [guestPromptReason, setGuestPromptReason] = useState('feature');
  const requireAuthForAction = (reason = 'feature') => {
    if (isAuthenticated) return true;
    setGuestPromptReason(reason);
    setShowGuestSignupPrompt(true);
    return false;
  };
  
  // Job tailoring states
  const [showJobTailor, setShowJobTailor] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [tailoring, setTailoring] = useState(false);
  const [tailoredProfile, setTailoredProfile] = useState(null);
  const [showTailorDialog, setShowTailorDialog] = useState(false);
  const [savingTailoredVersion, setSavingTailoredVersion] = useState(false);
  
  // Gap review states (two-step tailoring)
  const [analyzingGaps, setAnalyzingGaps] = useState(false);
  const [detectedGaps, setDetectedGaps] = useState([]);
  const [satisfiedAlternatives, setSatisfiedAlternatives] = useState([]);
  const [showGapReview, setShowGapReview] = useState(false);
  const [gapSelections, setGapSelections] = useState(null);
  const [showRetailorConfirm, setShowRetailorConfirm] = useState(false);
  const [existingTailorJob, setExistingTailorJob] = useState(null);
  
  // Upgrade modal state for rate limiting
  // Full 429 payload from the AI rate limiter; null when not limited.
  const [limitInfo, setLimitInfo] = useState(null);
  
  // Resume upload state
  const [uploadingResume, setUploadingResume] = useState(false);

  // Mobile AI tools overflow menu (collapses Upload Resume / Enhance / Tailor / Tips on small screens)
  const [aiMenuAnchor, setAiMenuAnchor] = useState(null);
  const aiMenuOpen = Boolean(aiMenuAnchor);
  const closeAiMenu = () => setAiMenuAnchor(null);

  // Track if data came from resume upload
  const [hasResumeData, setHasResumeData] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    location: '',
    phone: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    summary: '',
    profilePicture: '',
    coverImage: '',
    skills: {
      core: [],
      technical: [],
      software: [],
      industry: [],
      soft: []
    },
    experience: [],
    education: [],
    projects: [],
    isPublic: true
  });

  const [newSkill, setNewSkill] = useState({
    core: '',
    technical: '',
    software: '',
    industry: '',
    soft: ''
  });

  // Unified single-input skill flow (replaces the 5 per-category inputs).
  const [newSkillInput, setNewSkillInput] = useState('');
  // Category selected via the "Add skill" form. 'auto' means use auto-categorize.
  const [newSkillCategory, setNewSkillCategory] = useState('auto');
  // Per-chip "Move to category" menu state.
  const [skillMenu, setSkillMenu] = useState({ anchorEl: null, category: null, index: null });

  // Derived values
  const validTypes = VALID_IMAGE_TYPES;
  const allowedTypes = ALLOWED_RESUME_TYPES;
  const profileData = {
    title: formData.title,
    summary: formData.summary,
    skills: Object.values(formData.skills).flat(),
    experience: formData.experience,
    education: formData.education,
    projects: formData.projects
  };

  // Skill categorization helper - industry-agnostic
  const categorizeSkillsHelper = (skills) => {
    // Fresh categories object per call, must NOT be module-scoped or it
    // accumulates across calls/component remounts.
    const categories = {
      core: [],
      technical: [],
      software: [],
      industry: [],
      soft: [],
    };

    skills.forEach(skill => {
      const skillLower = skill.toLowerCase();
      if (SOFT_SKILL_KEYWORDS.some(kw => skillLower.includes(kw))) {
        categories.soft.push(skill);
      } else if (SOFTWARE_KEYWORDS.some(kw => skillLower.includes(kw))) {
        categories.software.push(skill);
      } else if (TECHNICAL_KEYWORDS.some(kw => skillLower.includes(kw))) {
        categories.technical.push(skill);
      } else {
        // Default: treat as core professional skill
        categories.core.push(skill);
      }
    });

    return categories;
  };

  // Load existing profile on mount
  useEffect(() => {
    const loadExistingProfile = async () => {
      try {
        // Guest builder: there's no account yet, so skip straight to the
        // "no profile found" branch below (which already falls back to a
        // localStorage draft). Actually calling getMyProfile would 401,
        // and the axios interceptor force-redirects unauthenticated 401s
        // from protected endpoints to /login outside the boot-grace window
        // — that would boot the guest out of the builder entirely.
        if (!isAuthenticated) {
          throw { guestSkip: true };
        }
        const response = await profileAPI.getMyProfile();
        if (response.data) {
          const profile = response.data;
          setIsExistingProfile(true);
          setProfileId(profile.id);
          
          let categorizedSkills = { core: [], technical: [], software: [], industry: [], soft: [] };
          if (profile.skills) {
            if (Array.isArray(profile.skills)) {
              categorizedSkills = categorizeSkillsHelper(profile.skills);
            } else if (typeof profile.skills === 'object') {
              // Support both old and new category names
              categorizedSkills = {
                core: profile.skills.core || profile.skills.frontend || [],
                technical: profile.skills.technical || profile.skills.backend || [],
                software: profile.skills.software || profile.skills.databases || [],
                industry: profile.skills.industry || profile.skills.cloud || [],
                soft: profile.skills.soft || profile.skills.tools || []
              };
            }
          }

          const serverFormData = {
            title: profile.title || '',
            location: profile.location || '',
            phone: profile.phone || '',
            linkedinUrl: profile.linkedinUrl || '',
            githubUrl: profile.githubUrl || '',
            portfolioUrl: profile.portfolioUrl || '',
            summary: profile.summary || '',
            profilePicture: profile.profilePicture || '',
            coverImage: profile.coverImage || '',
            skills: categorizedSkills,
            experience: migrateExperienceDates(profile.experience || []),
            education: migrateEducationDates(profile.education || []),
            projects: profile.projects || [],
            isPublic: profile.isPublic !== false
          };
          setFormData(serverFormData);
          // Capture the server-only snapshot so the draft-restored banner's
          // "Clear data" can revert to saved values.
          savedProfileSnapshotRef.current = serverFormData;

          // Check if there's a more recent draft with unsaved changes
          try {
            const savedDraft = localStorage.getItem(DRAFT_KEY);
            if (savedDraft) {
              const draft = JSON.parse(savedDraft);
              // Only restore draft if it's newer than the profile's last update
              const profileUpdatedAt = profile.updatedAt ? new Date(profile.updatedAt).getTime() : 0;
              if (draft && draft._draftTimestamp && draft._draftTimestamp > profileUpdatedAt) {
                // Strip the meta key before comparing so a stale draft that
                // matches saved data byte-for-byte doesn't trigger the
                // "Restored unsaved changes" banner. Without this check,
                // a debounced auto-save that wrote the same content as the
                // server would still surface the banner on reload.
                const { _draftTimestamp, ...draftPayload } = draft;
                const merged = { ...serverFormData, ...draftPayload };
                const isMeaningfullyDifferent = JSON.stringify(merged) !== JSON.stringify(serverFormData);
                if (isMeaningfullyDifferent) {
                  setFormData(merged);
                  setDraftRestored(true);
                  // Surfaced via the slim DraftRestoredBanner — see render section below.
                } else {
                  // Draft matches saved data; clear it so it doesn't haunt
                  // future loads, and don't show the banner.
                  localStorage.removeItem(DRAFT_KEY);
                }
              } else {
                // Draft is stale, remove it
                localStorage.removeItem(DRAFT_KEY);
              }
            }
          } catch (draftErr) {
            console.log('Could not check for draft:', draftErr);
          }
        }
      } catch (err) {
        // No existing profile - check for a saved draft in localStorage
        console.log('No existing profile found, checking for draft...');
        try {
          const savedDraft = localStorage.getItem(DRAFT_KEY);
          if (savedDraft) {
            const draft = JSON.parse(savedDraft);
            // Only restore if the draft has meaningful data
            if (draft && (draft.title || draft.summary || (draft.experience && draft.experience.length > 0))) {
              setFormData(prev => ({ ...prev, ...draft }));
              setDraftRestored(true);
              // Surfaced via the slim DraftRestoredBanner, no loud success alert.
            }
          }
        } catch (draftErr) {
          console.log('Could not restore draft:', draftErr);
        }
      } finally {
        setInitialLoading(false);
        setInitialFormLoaded(true);
      }
    };
    // A profile built pre-registration (see utils/guestDraft.js), claimed by
    // Register.jsx and handed off here. Already in the exact formData shape
    // (categorized skills object, not a flat array) — set directly instead
    // of going through the resume-shape mapping below.
    if (location.state && location.state.guestDraft) {
      setFormData(prev => ({ ...prev, ...location.state.guestDraft }));
      setInitialLoading(false);
      setInitialFormLoaded(true);
      setHasResumeData(false);
      setSuccess('Welcome back! We saved the profile you built — review it and click Save to publish.');
    } else if (location.state && location.state.resumeData) {
      const data = location.state.resumeData;
      console.log('Loading resume data:', data);
      
      setFormData({
        title: data.title || '',
        location: data.location || '',
        phone: data.phone || '',
        linkedinUrl: data.linkedinUrl || '',
        githubUrl: data.githubUrl || '',
        summary: data.summary || '',
        skills: categorizeSkillsHelper(data.skills || []),
        experience: data.experience || [],
        education: data.education || [],
        projects: data.projects || [],
        isPublic: true
      });
      setInitialLoading(false);
      setInitialFormLoaded(true);
      // Wizard-originated drafts are not actually parsed resumes — don't expose
      // the "Clear Resume" affordance and use copy that matches the source.
      const fromWizard = location.state?.source === 'wizard';
      setHasResumeData(!fromWizard);
      setSuccess(
        fromWizard
          ? 'Profile draft created from your preferences. Add more details to stand out.'
          : 'Resume parsed successfully! Review and edit the information below before saving.'
      );
    } else {
      loadExistingProfile();
    }
  }, [location.state]);

  // Auto-dismiss the resume / wizard intro banner the first time the user
  // changes the form. Save success messages get cleared elsewhere; this only
  // handles the informational banner that appears on mount.
  const introBannerSnapshotRef = useRef(null);
  useEffect(() => {
    if (!success || !initialFormLoaded) return;
    // Only treat the success message as the intro banner if it matches the
    // exact strings we set on mount; real save messages should stay until
    // their own flow clears them.
    const isIntro =
      success.startsWith('Profile draft created from your preferences') ||
      success.startsWith('Resume parsed successfully');
    if (!isIntro) return;
    if (introBannerSnapshotRef.current === null) {
      introBannerSnapshotRef.current = JSON.stringify(formData);
      return;
    }
    if (JSON.stringify(formData) !== introBannerSnapshotRef.current) {
      setSuccess('');
      introBannerSnapshotRef.current = null;
    }
  }, [formData, success, initialFormLoaded]);

  // Auto-save form data to localStorage as a draft (debounced)
  useEffect(() => {
    // Skip saving until form has been loaded with initial data
    if (!initialFormLoaded) return;

    // Capture the initial baseline once for dirty detection
    if (initialFormDataRef.current === null) {
      try {
        initialFormDataRef.current = JSON.stringify(formData);
      } catch (e) {
        initialFormDataRef.current = '';
      }
    }

    // Keep ref in sync for the beforeunload handler
    formDataRef.current = formData;

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        // Only save if there's meaningful data
        const hasData = formData.title || formData.summary || 
          formData.experience?.length > 0 || formData.education?.length > 0 ||
          Object.values(formData.skills || {}).some(arr => arr?.length > 0);
        if (hasData) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...formData, _draftTimestamp: Date.now() }));
        }
      } catch (e) {
        console.log('Could not save draft:', e);
      }
    }, 1000); // 1 second debounce

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [formData, initialFormLoaded, DRAFT_KEY]);

  // Save draft immediately when the user closes/refreshes the tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!formDataRef.current || !initialFormLoaded) return;
      try {
        const fd = formDataRef.current;
        const hasData = fd.title || fd.summary || 
          fd.experience?.length > 0 || fd.education?.length > 0 ||
          Object.values(fd.skills || {}).some(arr => arr?.length > 0);
        if (hasData) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...fd, _draftTimestamp: Date.now() }));
        }
      } catch (e) { /* ignore */ }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [initialFormLoaded, DRAFT_KEY]);

  // Determine whether the form has unsaved changes vs. the initial baseline
  const isFormDirty = useCallback(() => {
    if (!initialFormDataRef.current) return false;
    try {
      return JSON.stringify(formData) !== initialFormDataRef.current;
    } catch (e) {
      return false;
    }
  }, [formData]);

  // Cancel handler, confirm before discarding edits
  const handleCancel = useCallback(() => {
    if (isFormDirty()) {
      setDiscardDialogOpen(true);
    } else {
      navigate('/profile');
    }
  }, [isFormDirty, navigate]);

  const confirmDiscard = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    setDiscardDialogOpen(false);
    navigate('/profile');
  }, [DRAFT_KEY, navigate]);

  // Esc key triggers the same discard flow as Cancel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      // Don't hijack Esc when another dialog/modal is the active target
      const target = e.target;
      const tag = (target && target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (target && target.isContentEditable)) {
        // Let inputs handle their own Esc (e.g., autocomplete close)
        return;
      }
      if (discardDialogOpen) return; // dialog already open
      handleCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCancel, discardDialogOpen]);

  // Restore cached enhancement results from sessionStorage (survives refresh)
  useEffect(() => {
    if (!initialLoading && !enhancements) {
      try {
        const cached = sessionStorage.getItem('profileai_enhancements');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.title || parsed.summary || parsed.skills)) {
            setEnhancements(parsed);
            setShowEnhancementDialog(true);
          }
        }
      } catch (_) {}
    }
  }, [initialLoading]);

  // First-time welcome: show once per user when the candidate hasn't built up
  // a real profile yet (no work experience). We DON'T suppress for wizard-sourced
  // drafts — a wizard fills in title/skills but still leaves the candidate
  // staring at an empty Experience section, which is when the AI tour matters
  // most. Triggered automatically the first time, and re-openable via the
  // "Show me how" button in the toolbar.
  const welcomeStorageKey = useMemo(
    () => `profileai_profile_welcome_seen_${user?.id || 'unknown'}`,
    [user?.id]
  );
  useEffect(() => {
    if (initialLoading) return;
    const hasExperience = (formData.experience || []).length > 0;
    if (hasExperience) return; // returning user with real content
    try {
      if (localStorage.getItem(welcomeStorageKey)) return;
    } catch (_) {
      // ignore storage errors
    }
    const t = setTimeout(() => setShowWelcome(true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoading, welcomeStorageKey]);

  const handleWelcomeClose = useCallback(() => {
    setShowWelcome(false);
    try { localStorage.setItem(welcomeStorageKey, '1'); } catch (_) {}
  }, [welcomeStorageKey]);

  const handleWelcomeResumeParsed = useCallback((data) => {
    setFormData({
      title: data.title || '',
      location: data.location || '',
      phone: data.phone || '',
      linkedinUrl: data.linkedinUrl || '',
      githubUrl: data.githubUrl || '',
      summary: data.summary || '',
      skills: categorizeSkillsHelper(data.skills || []),
      experience: data.experience || [],
      education: data.education || [],
      projects: data.projects || [],
      isPublic: true,
    });
    setHasResumeData(true);
    setSuccess('Resume parsed successfully! Review and edit the information below before saving.');
    try { localStorage.setItem(welcomeStorageKey, '1'); } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeStorageKey]);

  // Scroll the Experience section into view (used by Enhance pre-flight prompt
  // and the empty-state CTA).
  const scrollToExperience = useCallback(() => {
    try {
      experienceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (_) {}
  }, []);

  // Handle action from Dashboard navigation
  useEffect(() => {
    if (location.state?.action && !initialLoading && formData.title) {
      const action = location.state.action;
      
      // Clear the action from state to prevent re-triggering
      window.history.replaceState({}, document.title);
      
      if (action === 'enhance') {
        // Show prompt modal so user can customize enhancement
        setTimeout(() => setShowEnhancePrompt(true), 300);
      } else if (action === 'tailor') {
        // Show job tailor section
        setShowJobTailor(true);
      } else if (action === 'tips') {
        // Auto-trigger tips
        setTimeout(() => handleGetSuggestions(), 500);
      }
    }
  }, [initialLoading, formData.title, location.state?.action]);

  // Scroll to a specific section when deep-linked from the Dashboard checklist.
  useEffect(() => {
    const section = location.state?.section;
    if (!section || initialLoading) return;
    const refMap = {
      basic: basicInfoRef,
      experience: experienceRef,
      skills: skillsRef,
      education: educationRef,
      projects: projectsRef,
    };
    const ref = refMap[section];
    if (ref?.current) {
      setActiveSection(section);
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    }
  }, [initialLoading, location.state?.section]);

  // Initialize form with parsed resume data if available
  useEffect(() => {
    if (location.state && location.state.resumeData) {
      const data = location.state.resumeData;
      console.log('Loading resume data:', data);

      setFormData({
        title: data.title || '',
        location: data.location || '',
        phone: data.phone || '',
        linkedinUrl: data.linkedinUrl || '',
        githubUrl: data.githubUrl || '',
        summary: data.summary || '',
        skills: categorizeSkillsHelper(data.skills || []),
        experience: data.experience || [],
        education: data.education || [],
        projects: data.projects || [],
        isPublic: true
      });

      const fromWizard = location.state?.source === 'wizard';
      setSuccess(
        fromWizard
          ? 'Profile draft created from your preferences. Add more details to stand out.'
          : 'Resume parsed successfully! Review and edit the information below before saving.'
      );
    }
  }, [location.state]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear field error on edit
    if (fieldErrors[e.target.name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[e.target.name];
        return next;
      });
    }
  };

  // ── Field-level validation ──
  // Acceptance: Inline error on blur; aria-invalid + aria-describedby; submit blocked until valid.
  const FIELD_LIMITS = {
    title: 120,
    location: 120,
    summary: 1500,
    experienceDescription: 2000,
    projectDescription: 1500,
    educationDescription: 1000
  };

  // User-facing labels for the three per-project URL fields. Used by the
  // validation summary ("Project 2 — Live Demo URL: ...") and as the
  // fieldLabel passed to the shared URL validator.
  const PROJECT_URL_LABELS = {
    url: 'Live Demo URL',
    githubUrl: 'GitHub / Source Code URL',
    imageUrl: 'Project Image URL',
  };
  const PROJECT_URL_FIELDS = Object.keys(PROJECT_URL_LABELS);

  const validateField = useCallback((name, value) => {
    const v = (value ?? '').toString().trim();
    switch (name) {
      case 'title':
        if (!v) return 'Professional title is required.';
        if (v.length > FIELD_LIMITS.title) return `Must be ${FIELD_LIMITS.title} characters or fewer.`;
        return '';
      case 'phone': {
        if (!v) return '';
        // Permit +, digits, spaces, dashes, parens; require 7-20 useful chars
        if (!/^\+?[0-9\s().-]{7,20}$/.test(v)) {
          return 'Enter a valid phone number (digits, +, -, spaces, parentheses).';
        }
        return '';
      }
      case 'linkedinUrl':
        return validateHttpUrl(value, {
          fieldLabel: 'LinkedIn URL',
          hostMatch: { regex: /linkedin\./i, message: 'Enter a linkedin.com URL.' },
        });
      case 'githubUrl':
        return validateHttpUrl(value, {
          fieldLabel: 'GitHub URL',
          hostMatch: { regex: /github\./i, message: 'Enter a github.com URL.' },
        });
      case 'portfolioUrl':
        return validateHttpUrl(value, { fieldLabel: 'Portfolio URL' });
      case 'email': {
        if (!v) return '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address.';
        return '';
      }
      case 'summary': {
        if (v.length > FIELD_LIMITS.summary) return `Must be ${FIELD_LIMITS.summary} characters or fewer.`;
        return '';
      }
      default:
        return '';
    }
  }, []);

  const handleBlur = (e) => {
    const { name, value } = e.target;
    // Auto-prepend https:// so users pasting bare "www.linkedin.com/in/x" or
    // "linkedin.com/in/x" don't hit the strict validator's error. Only rewrite
    // recognised URL fields; leave everything else untouched.
    const URL_FIELDS = ['linkedinUrl', 'githubUrl', 'portfolioUrl'];
    let nextValue = value;
    if (URL_FIELDS.includes(name)) {
      const normalized = normalizeHttpUrl(value);
      if (normalized !== value) {
        nextValue = normalized;
        setFormData((prev) => ({ ...prev, [name]: normalized }));
      }
    }
    const msg = validateField(name, nextValue);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (msg) next[name] = msg;
      else delete next[name];
      return next;
    });
  };

  const validateAll = useCallback(() => {
    const errs = {};
    const fields = ['title', 'phone', 'linkedinUrl', 'githubUrl', 'portfolioUrl', 'summary'];
    // Auto-normalise all URL fields once before we validate, so a save
    // attempt with bare "linkedin.com/in/x" gets the https:// prefix
    // applied and passes instead of blocking submit with a red error.
    const urlFields = ['linkedinUrl', 'githubUrl', 'portfolioUrl'];
    const normalisedUpdates = {};
    urlFields.forEach((f) => {
      const n = normalizeHttpUrl(formData[f]);
      if (n !== formData[f]) normalisedUpdates[f] = n;
    });
    (formData.projects || []).forEach((project, i) => {
      PROJECT_URL_FIELDS.forEach((field) => {
        const n = normalizeHttpUrl(project?.[field]);
        if (n !== project?.[field]) {
          normalisedUpdates.projects = normalisedUpdates.projects || formData.projects.map(p => ({ ...p }));
          normalisedUpdates.projects[i][field] = n;
        }
      });
    });
    if (Object.keys(normalisedUpdates).length > 0) {
      setFormData((prev) => ({ ...prev, ...normalisedUpdates }));
    }
    const nextForm = { ...formData, ...normalisedUpdates };
    fields.forEach((f) => {
      const msg = validateField(f, nextForm[f]);
      if (msg) errs[f] = msg;
    });
    // Per-project URL fields (Live Demo / Source Code / Image). Submit is
    // blocked the same way as Basic Info.
    (nextForm.projects || []).forEach((project, i) => {
      PROJECT_URL_FIELDS.forEach((field) => {
        const msg = validateHttpUrl(project?.[field], {
          fieldLabel: PROJECT_URL_LABELS[field],
        });
        if (msg) errs[`projects.${i}.${field}`] = msg;
      });
    });
    return errs;
  }, [formData, validateField]);

  const handleAddSkill = (category) => {
    if (newSkill[category].trim()) {
      setFormData({
        ...formData,
        skills: {
          ...formData.skills,
          [category]: [...formData.skills[category], newSkill[category].trim()]
        }
      });
      setNewSkill({ ...newSkill, [category]: '' });
    }
  };

  // Add a skill from the single unified input. If `category` is explicitly
  // provided (the user picked one in the dropdown), use it; otherwise fall
  // back to categorizeSkillsHelper so the user doesn't have to pick.
  const handleAddSkillUnified = (raw, explicitCategory = null) => {
    const skill = (raw || '').trim();
    if (!skill) return;
    let category = explicitCategory;
    if (!category || category === 'auto') {
      const cats = categorizeSkillsHelper([skill]);
      category = Object.keys(cats).find((k) => cats[k].length > 0) || 'core';
    }
    // Avoid duplicates across all categories (case-insensitive).
    const allExisting = Object.values(formData.skills || {}).flat().map((s) => String(s).toLowerCase());
    if (allExisting.includes(skill.toLowerCase())) {
      setNewSkillInput('');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      skills: {
        ...prev.skills,
        [category]: [...(prev.skills[category] || []), skill],
      },
    }));
    setNewSkillInput('');
  };

  // Move an existing skill chip to a different category. Used by the
  // per-chip "Move to" menu so users can correct miscategorized skills.
  const moveSkillToCategory = (fromCategory, index, toCategory) => {
    if (fromCategory === toCategory) return;
    setFormData((prev) => {
      const fromList = prev.skills?.[fromCategory] || [];
      const skill = fromList[index];
      if (!skill) return prev;
      return {
        ...prev,
        skills: {
          ...prev.skills,
          [fromCategory]: fromList.filter((_, i) => i !== index),
          [toCategory]: [...(prev.skills?.[toCategory] || []), skill],
        },
      };
    });
  };

  const handleDeleteSkill = (category, index) => {
    const updatedSkills = formData.skills[category].filter((_, i) => i !== index);
    setFormData({
      ...formData,
      skills: {
        ...formData.skills,
        [category]: updatedSkills
      }
    });
  };

  const handleAddExperience = () => {
    setFormData({
      ...formData,
      experience: [
        ...formData.experience,
        { company: '', title: '', period: '', description: '', achievements: [], employmentType: '', location: '', skills: [] }
      ]
    });
  };

  const handleExperienceChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      experience: prev.experience.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      ),
    }));
  };

  const handleDeleteExperience = (index) => {
    setFormData({
      ...formData,
      experience: formData.experience.filter((_, i) => i !== index)
    });
  };

  const handleAddProject = () => {
    setFormData({
      ...formData,
      projects: [...formData.projects, { 
        title: '', 
        description: '', 
        url: '', 
        githubUrl: '',
        technologies: [],
        imageUrl: '',
        startDate: '',
        endDate: '',
        role: ''
      }]
    });
  };

  const handleProjectChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      projects: prev.projects.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      ),
    }));
    // Clear any previously-shown URL error for this field as soon as the
    // user edits it; re-validation happens on blur.
    if (PROJECT_URL_FIELDS.includes(field)) {
      const key = `projects.${index}.${field}`;
      setFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // onBlur handler for per-project URL inputs. Mirrors the top-level
  // handleBlur but uses composite keys (`projects.${i}.${field}`).
  const handleProjectUrlBlur = useCallback((index, field, value) => {
    // Same https:// auto-prefix as the top-level handleBlur.
    const normalised = normalizeHttpUrl(value);
    let effectiveValue = value;
    if (normalised !== value) {
      effectiveValue = normalised;
      setFormData((prev) => ({
        ...prev,
        projects: prev.projects.map((row, i) =>
          i === index ? { ...row, [field]: normalised } : row
        ),
      }));
    }
    const msg = validateHttpUrl(effectiveValue, { fieldLabel: PROJECT_URL_LABELS[field] });
    const key = `projects.${index}.${field}`;
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (msg) next[key] = msg;
      else delete next[key];
      return next;
    });
  }, []);

  const handleDeleteProject = (index) => {
    setFormData({
      ...formData,
      projects: formData.projects.filter((_, i) => i !== index)
    });
  };

  const handleAddEducation = () => {
    setFormData({
      ...formData,
      education: [
        ...formData.education,
        {
          degree: '',
          institution: '',
          fieldOfStudy: '',
          location: '',
          gpa: '',
          honors: '',
          description: '',
          startDate: '',
          endDate: '',
        },
      ],
    });
  };

  const handleEducationChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      ),
    }));
  };

  const handleDeleteEducation = (index) => {
    setFormData({
      ...formData,
      education: formData.education.filter((_, i) => i !== index)
    });
  };

  // Inline enhance: AI-improve a single text field
  const [enhancingField, setEnhancingField] = useState(null);
  // Pending diff preview: { fieldId, original, enhanced, applyFn, label }
  const [enhancePreview, setEnhancePreview] = useState(null);
  const handleEnhanceField = async (fieldId, type, text, context, applyFn, label = 'this section') => {
    if (!requireAuthForAction()) return;
    if (!text || text.trim().length < 10) {
      setError('Text must be at least 10 characters to enhance');
      return;
    }
    setEnhancingField(fieldId);
    try {
      const response = await profileAPI.enhanceText(text, type, context);
      if (response.data?.success && response.data.enhancedText) {
        const enhanced = stripMarkdown(response.data.enhancedText);
        // 5.3: never overwrite user content silently — show diff preview first.
        setEnhancePreview({ fieldId, original: text, enhanced, applyFn, label, hallucinationFlags: response.data.hallucinationFlags || [] });
      } else {
        setError('Failed to enhance text');
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setLimitInfo(parseLimitError(err) || { featureType: 'profile_enhance', upgradeRequired: true, buyMoreUrl: '/pricing' });
      } else {
        setError(extractApiError(err, 'Failed to enhance text'));
      }
    } finally {
      setEnhancingField(null);
    }
  };

  const acceptEnhancePreview = () => {
    if (enhancePreview?.applyFn) enhancePreview.applyFn(enhancePreview.enhanced);
    setEnhancePreview(null);
    setSaveToast({ open: true, message: 'Enhancement applied. Remember to save.' });
  };
  const rejectEnhancePreview = () => setEnhancePreview(null);

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!requireAuthForAction()) return;
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image file (jpg, png, gif, or webp)');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    setError('');

    try {
      const response = await profileAPI.uploadImage(file);
      const imageUrl = response.data.imageUrl;
      
      setFormData(prev => ({
        ...prev,
        profilePicture: imageUrl
      }));

      // The backend now also persists the picture on upload, so refresh the
      // auth context so the avatar in the navbar updates immediately.
      try { await refreshUser(); } catch (_) { /* non-fatal */ }

      setSuccess('Profile picture saved.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Profile picture upload error:', err);
      setError('Failed to upload profile picture: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Run validation. Block submit until all fields are valid.
    const errs = validateAll();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const labels = {
        title: 'Professional Title',
        phone: 'Phone',
        linkedinUrl: 'LinkedIn URL',
        githubUrl: 'GitHub URL',
        portfolioUrl: 'Portfolio URL',
        summary: 'Professional Summary'
      };
      const summary = Object.entries(errs).map(([name, msg]) => {
        // Project-URL keys look like "projects.0.url"; derive a friendly
        // "Project 1 — Live Demo URL" label.
        if (name.startsWith('projects.')) {
          const [, idx, field] = name.split('.');
          const human = PROJECT_URL_LABELS[field] || field;
          return { name, label: `Project ${parseInt(idx, 10) + 1} — ${human}`, message: msg };
        }
        return { name, label: labels[name] || name, message: msg };
      });
      setValidationSummary(summary);
      // Focus first invalid field
      const firstName = summary[0]?.name;
      if (firstName) {
        const targetRef = firstName.startsWith('projects.') ? projectsRef : basicInfoRef;
        targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          // Project inputs use composite names ("projects.0.url"); the
          // selector escapes the dots so querySelector treats them as part
          // of the attribute value, not as CSS class separators.
          const el = document.querySelector(`[name="${firstName.replace(/\./g, '\\.')}"]`);
          if (el && typeof el.focus === 'function') el.focus({ preventScroll: true });
        }, 250);
      }
      return;
    }
    setValidationSummary([]);
    setLoading(true);

    // Strip blank/placeholder entries silently. Required-field minimums per type:
    //   Experience → company + title + period (start or end date)
    //   Education  → institution + degree + year/date
    //   Project    → title + description
    const PLACEHOLDER_RE = /^(field|degree|period|company\s*name|institution\s*name|role|title|n\/?a|none|null|undefined|tbd)$/i;
    const isReal = (v) => {
      if (v == null) return false;
      const s = String(v).trim();
      return !!s && !PLACEHOLDER_RE.test(s);
    };
    const dropped = { experience: 0, education: 0, projects: 0 };
    const cleanExperience = (formData.experience || []).filter((exp) => {
      const ok = isReal(exp.company) && isReal(exp.title) && (isReal(exp.startDate) || isReal(exp.endDate));
      if (!ok) dropped.experience++;
      return ok;
    });
    const cleanEducation = (formData.education || []).filter((edu) => {
      const ok = isReal(edu.institution) && isReal(edu.degree) &&
        (isReal(edu.year) || isReal(edu.startDate) || isReal(edu.endDate));
      if (!ok) dropped.education++;
      return ok;
    });
    const cleanProjects = (formData.projects || []).filter((p) => {
      const ok = isReal(p.title) && isReal(p.description);
      if (!ok) dropped.projects++;
      return ok;
    });
    const cleanedFormData = {
      ...formData,
      experience: cleanExperience,
      education: cleanEducation,
      projects: cleanProjects,
    };
    const droppedTotal = dropped.experience + dropped.education + dropped.projects;

    if (!isAuthenticated) {
      // Guest builder: no account to save to yet. Keep the completed draft
      // client-side (never sent to the server pre-registration — see
      // utils/guestDraft.js) and prompt sign-up. Registering picks this
      // draft back up and submits it as the visitor's first real save.
      saveGuestProfileDraft(cleanedFormData);
      if (droppedTotal > 0) {
        setFormData(cleanedFormData);
      }
      trackEvent('guest_profile_draft_saved');
      setLoading(false);
      setGuestPromptReason('save');
      setShowGuestSignupPrompt(true);
      return;
    }

    try {
      await profileAPI.createOrUpdateProfile(cleanedFormData);
      // Reflect the cleaned data in local state so the UI stays in sync.
      if (droppedTotal > 0) {
        setFormData(cleanedFormData);
      }
      // Refresh user data to update profile picture in auth context
      await refreshUser();
      // Clear draft from localStorage after successful save
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
      setDraftRestored(false);
      // Update the dirty-check baseline so the unsaved-changes banner stays gone.
      initialFormDataRef.current = JSON.parse(JSON.stringify(cleanedFormData));
      const droppedParts = [];
      if (dropped.experience) droppedParts.push(`${dropped.experience} experience`);
      if (dropped.education) droppedParts.push(`${dropped.education} education`);
      if (dropped.projects) droppedParts.push(`${dropped.projects} project`);
      const droppedMsg = droppedParts.length
        ? ` (skipped ${droppedParts.join(', ')} ${droppedTotal === 1 ? 'entry' : 'entries'} with missing required fields)`
        : '';
      setSuccess(`Profile saved successfully!${droppedMsg}`);
      setSaveToast({ open: true, message: `Profile saved${droppedMsg}` });
      // First-time creators get a celebration + share moment; edits go straight back.
      if (!isExistingProfile) {
        trackEvent('profile_created', { emailVerified: !!user?.emailVerified });
        setShowCelebration(true);
      } else {
        setTimeout(() => navigate('/profile'), 1500);
      }
    } catch (err) {
      setError(extractApiError(err, 'Failed to save profile'));
    } finally {
      setLoading(false);
    }
  };

  const handleEnhanceWithAI = async (customPrompt = '') => {
    setShowEnhancePrompt(false);
    if (!requireAuthForAction()) return;
    setError('');
    setSuccess('');
    setEnhancing(true);
    const controller = new AbortController();
    enhanceAbortRef.current = controller;

    try {

      const response = await profileAPI.enhanceResumeData(profileData, customPrompt.trim() || undefined, { signal: controller.signal });
      
      if (response.data.success) {
        setEnhancements(response.data.data);
        setShowEnhancementDialog(true);
        // Persist so results survive page refresh
        try { sessionStorage.setItem('profileai_enhancements', JSON.stringify(response.data.data)); } catch (_) {}
      } else {
        setError('Failed to enhance profile with AI');
      }
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || controller.signal.aborted) {
        // Cancelled by the user; no-op.
      } else if (err.response?.status === 429) {
        setLimitInfo(parseLimitError(err) || { featureType: err.response?.data?.feature || 'profile_enhance', upgradeRequired: true, buyMoreUrl: '/pricing' });
      } else {
        setError(extractApiError(err, 'Failed to enhance profile with AI'));
      }
    } finally {
      enhanceAbortRef.current = null;
      setEnhancing(false);
    }
  };

  const handleGetSuggestions = async () => {
    if (!requireAuthForAction()) return;
    setError('');
    setGettingSuggestions(true);
    const controller = new AbortController();
    suggestionsAbortRef.current = controller;
    // Modal will show from gettingSuggestions state

    try {

      const response = await profileAPI.getEnhancementSuggestions(profileData, { signal: controller.signal });
      
      if (response.data.success) {
        setSuggestions(response.data.suggestions);
        setShowSuggestions(true);
      } else {
        setError('Failed to get suggestions');
      }
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || controller.signal.aborted) {
        // Cancelled by the user; no-op.
      } else if (err.response?.status === 429) {
        // Rate limit exceeded - show upgrade modal
        setLimitInfo(parseLimitError(err) || { featureType: err.response?.data?.feature || 'career_suggestions', upgradeRequired: true, buyMoreUrl: '/pricing' });
      } else {
        setError(extractApiError(err, 'Failed to get suggestions'));
      }
    } finally {
      suggestionsAbortRef.current = null;
      setGettingSuggestions(false);
    }
  };

  const applyEnhancements = async (selectedSections, saveImmediately = false) => {
    if (!enhancements) return;

    // Smart skill merge: preserve original categories, only categorize truly new skills
    let mergedSkills = formData.skills;
    const existingSkillMap = {};
    const newCategories = { core: [], technical: [], software: [], industry: [], soft: [] };
    if (selectedSections.skills && enhancements.skills) {
      Object.entries(formData.skills).forEach(([cat, arr]) => {
        (arr || []).forEach(s => { existingSkillMap[s.toLowerCase()] = cat; });
      });
      // Keep all original skills in their categories
      Object.entries(formData.skills).forEach(([cat, arr]) => {
        newCategories[cat] = [...(arr || [])];
      });
      // Add new skills from AI that don't exist yet
      const newSkillsFlat = (enhancements.skills || []).filter(
        s => !existingSkillMap[s.toLowerCase()]
      );
      const categorizedNew = categorizeSkillsHelper(newSkillsFlat);
      Object.entries(categorizedNew).forEach(([cat, arr]) => {
        newCategories[cat] = [...newCategories[cat], ...arr];
      });
      mergedSkills = newCategories;
    }

    const enhancedFormData = {
      ...formData,
      title: selectedSections.title && enhancements.title ? stripMarkdown(enhancements.title) : formData.title,
      summary: selectedSections.summary && enhancements.summary ? stripMarkdown(enhancements.summary) : formData.summary,
      skills: mergedSkills,
      experience: selectedSections.experience && enhancements.experience
        ? enhancements.experience.map((e) => ({ ...e, description: stripMarkdown(e?.description) }))
        : formData.experience,
      education: selectedSections.education && enhancements.education ? enhancements.education : formData.education,
      projects: selectedSections.projects && enhancements.projects
        ? enhancements.projects.map((p) => ({ ...p, description: stripMarkdown(p?.description) }))
        : formData.projects
    };

    setFormData(enhancedFormData);
    setShowEnhancementDialog(false);
    setEnhancements(null);
    try { sessionStorage.removeItem('profileai_enhancements'); } catch (_) {}

    if (saveImmediately) {
      setLoading(true);
      setError('');
      try {
        await profileAPI.createOrUpdateProfile(enhancedFormData);
        await refreshUser();
        try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
        setSuccess('🎉 Profile enhanced and saved successfully!');
      } catch (err) {
        setError(extractApiError(err, 'Failed to save enhanced profile'));
      } finally {
        setLoading(false);
      }
    } else {
      setSuccess('AI enhancements applied! Review the changes and save when ready.');
    }
  };

  // Tailor profile for specific job, Step 0: Check for existing tailored profile
  const handleTailorForJob = async () => {
    if (!requireAuthForAction()) return;
    if (!jobDescription.trim()) {
      setError('Please paste a job description first');
      return;
    }

    setError('');

    // Check if a tailored profile already exists for a similar job
    try {
      const existingRes = await tailoredProfileAPI.getAll();
      const existing = existingRes.data?.tailoredProfiles || existingRes.data || [];
      const jobDescLower = jobDescription.toLowerCase();
      const match = existing.find(tp => {
        const title = (tp.jobTitle || '').toLowerCase();
        const company = (tp.companyName || '').toLowerCase();
        // Match if job title appears in description or matches directly
        return title && (jobDescLower.includes(title) || title.includes(formData.title?.toLowerCase() || ''));
      });
      if (match) {
        setExistingTailorJob(match);
        setShowRetailorConfirm(true);
        return;
      }
    } catch (_) {
      // If check fails, proceed anyway
    }

    await proceedWithTailor();
  };

  // Step 1: Analyze gaps
  const proceedWithTailor = async () => {
    if (!requireAuthForAction()) return;
    setShowRetailorConfirm(false);
    setExistingTailorJob(null);
    setAnalyzingGaps(true);

    try {

      const response = await profileAPI.analyzeGaps({ profileData, jobDescription });
      
      if (response.data.success && response.data.gaps?.length > 0) {
        setDetectedGaps(response.data.gaps);
        setSatisfiedAlternatives(response.data.satisfiedAlternatives || []);
        setShowGapReview(true);
      } else {
        // No gaps found, proceed directly to tailoring
        await doTailoring(profileData, null);
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setLimitInfo(parseLimitError(err) || { featureType: err.response?.data?.feature || 'tailor_profile', upgradeRequired: true, buyMoreUrl: '/pricing' });
      } else {
        // If gap analysis fails, fall back to direct tailoring
        console.warn('Gap analysis failed, proceeding to tailor directly:', err);
        await doTailoring(profileData, null);
      }
    } finally {
      setAnalyzingGaps(false);
    }
  };

  // Step 2: After gap review, proceed with tailoring
  const handleGapReviewContinue = async (selections) => {
    setGapSelections(selections);
    setShowGapReview(false);

    await doTailoring(profileData, {
      acceptedGaps: selections.acceptedGaps,
      skippedGaps: selections.skippedGaps,
      acceptedGapObjects: selections.acceptedGapObjects
    }, selections.acceptedGapObjects);
  };

  // Core tailoring logic
  const doTailoring = async (profileData, gapSelectionsParam, acceptedGapObjects = null) => {
    setTailoring(true);
    setError('');

    try {
      const response = await profileAPI.tailorProfileForJob({ 
        profileData, 
        jobDescription,
        gapSelections: gapSelectionsParam
      });
      
      if (response.data.success) {
        const tailored = response.data.data;
        // Attach gap info for saving later
        if (acceptedGapObjects) {
          tailored._skillGaps = acceptedGapObjects;
          tailored._learningPlan = {
            acceptedGaps: gapSelectionsParam?.acceptedGaps || [],
            skippedGaps: gapSelectionsParam?.skippedGaps || [],
            createdAt: new Date().toISOString()
          };
        }
        setTailoredProfile(tailored);
        setShowTailorDialog(true);
      } else {
        setError('Failed to tailor profile for job');
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setLimitInfo(parseLimitError(err) || { featureType: err.response?.data?.feature || 'tailor_profile', upgradeRequired: true, buyMoreUrl: '/pricing' });
      } else {
        setError(extractApiError(err, 'Failed to tailor profile for job'));
      }
    } finally {
      setTailoring(false);
    }
  };

  const applyTailoredProfile = async (saveImmediately = false) => {
    if (!tailoredProfile) return;

    const tailoredFormData = {
      ...formData,
      title: tailoredProfile.title || formData.title,
      summary: tailoredProfile.summary || formData.summary,
      skills: categorizeSkillsHelper(tailoredProfile.skills || Object.values(formData.skills).flat()),
      experience: tailoredProfile.experience || formData.experience,
      projects: tailoredProfile.projects || formData.projects
    };

    setFormData(tailoredFormData);
    setShowTailorDialog(false);
    setShowJobTailor(false);
    setJobDescription('');

    if (saveImmediately) {
      setLoading(true);
      setError('');
      try {
        await profileAPI.createOrUpdateProfile(tailoredFormData);
        setSuccess('🎯 Profile tailored for job and saved successfully!');
        setTimeout(() => navigate('/profile'), 2000);
      } catch (err) {
        setError(extractApiError(err, 'Failed to save tailored profile'));
        setLoading(false);
      }
    } else {
      setSuccess('Profile tailored for job! Review the changes and save when ready.');
    }
  };

  // Save as a separate tailored version without modifying original profile
  const saveTailoredVersion = async () => {
    if (!tailoredProfile) return;

    setSavingTailoredVersion(true);
    setError('');

    try {

      // Extract job title and company from the tailored profile
      const jobTitle = tailoredProfile.jobTitle || tailoredProfile.title || 'Untitled Position';
      const companyName = tailoredProfile.company || '';
      const matchScore = tailoredProfile.matchScore || null;

      const tailoredData = {
        title: tailoredProfile.title || formData.title,
        summary: tailoredProfile.summary || formData.summary,
        skills: tailoredProfile.skills || Object.values(formData.skills).flat(),
        experience: tailoredProfile.experience || formData.experience,
        education: formData.education,
        projects: tailoredProfile.projects || formData.projects,
        location: formData.location,
        phone: formData.phone,
        linkedinUrl: formData.linkedinUrl,
        githubUrl: formData.githubUrl,
        matchAnalysis: tailoredProfile.matchAnalysis || null,
        jobLevel: tailoredProfile.jobLevel || null,
        interviewPrep: tailoredProfile.interviewPrep || null
      };

      await tailoredProfileAPI.save({
        jobTitle,
        companyName,
        tailoredData,
        matchScore,
        skillGaps: tailoredProfile._skillGaps || [],
        learningPlan: tailoredProfile._learningPlan || null
      });

      setShowTailorDialog(false);
      setShowJobTailor(false);
      setJobDescription('');
      
      const companyText = companyName ? ` at ${companyName}` : '';
      setSuccess(`🎯 Saved tailored version "${jobTitle}"${companyText} as a separate profile! Original profile unchanged.`);
    } catch (err) {
      setError(extractApiError(err, 'Failed to save tailored version'));
    } finally {
      setSavingTailoredVersion(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Handle resume upload directly from edit profile page
  const handleResumeUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF or DOCX file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setUploadingResume(true);
    setError('');

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('resume', file);

      // Parsing itself is AI-free pattern matching, so it's safe to let
      // guests use it too — same as the entry-point upload in ProfileCreation.
      const response = isAuthenticated
        ? await profileAPI.uploadResume(formDataUpload)
        : await profileAPI.guestUploadResume(formDataUpload);

      if (response.data.success) {
        const data = response.data.data;
        let categorizedSkills = { core: [], technical: [], software: [], industry: [], soft: [] };
        if (data.skills) {
          if (Array.isArray(data.skills) && data.skills.length > 0) {
            categorizedSkills = categorizeSkillsHelper(data.skills);
          } else if (typeof data.skills === 'object' && !Array.isArray(data.skills) && Object.keys(data.skills).length > 0) {
            categorizedSkills = {
              core: data.skills.core || data.skills.frontend || [],
              technical: data.skills.technical || data.skills.backend || [],
              software: data.skills.software || data.skills.databases || [],
              industry: data.skills.industry || data.skills.cloud || [],
              soft: data.skills.soft || data.skills.tools || [],
            };
          }
        }
        // Apply parsed resume data to the form
        setFormData(prev => ({
          ...prev,
          title: data.title || prev.title,
          location: data.location || prev.location,
          phone: data.phone || prev.phone,
          linkedinUrl: data.linkedinUrl || prev.linkedinUrl,
          githubUrl: data.githubUrl || prev.githubUrl,
          summary: data.summary || prev.summary,
          skills: categorizedSkills || prev.skills,
          experience: data.experience && data.experience.length > 0 ? data.experience : prev.experience,
          education: data.education && data.education.length > 0 ? data.education : prev.education,
          projects: data.projects && data.projects.length > 0 ? data.projects : prev.projects,
        }));
        setHasResumeData(true);
        setSuccess('Resume parsed successfully! Review and edit the information below before saving.');
      } else {
        setError('Failed to parse resume. Please try again.');
      }
    } catch (err) {
      console.error('Error uploading resume:', err);
      setError(err.response?.data?.error || err.message || 'Failed to upload resume.');
    } finally {
      setUploadingResume(false);
      event.target.value = '';
    }
  };

  // Clear resume data and reset form
  const handleClearResumeData = () => {
    setFormData({
      title: '',
      location: '',
      phone: '',
      linkedinUrl: '',
      githubUrl: '',
      portfolioUrl: '',
      summary: '',
      profilePicture: '',
      coverImage: '',
      skills: {
        core: [],
        technical: [],
        software: [],
        industry: [],
        soft: []
      },
      experience: [],
      education: [],
      projects: [],
      isPublic: true
    });
    setHasResumeData(false);
    setSuccess('');
    // Clear the draft and location state
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    window.history.replaceState({}, document.title);
  };

  // Banner action: discard the locally-stored unsaved draft and revert the form
  // to whatever was loaded from the server. Does NOT touch saved profile data.
  const handleDiscardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    if (savedProfileSnapshotRef.current) {
      setFormData(savedProfileSnapshotRef.current);
    }
    setDraftRestored(false);
  };

  // Profile completion calculation. Uses the shared scorer so the Dashboard
  // "Complete your profile" checklist and this sidebar always stay in sync.
  // Placeholder strings used as AI prompt seeds (e.g. "Company Name", "Period",
  // "Degree", "Field") and obvious blanks do not count as a filled value.
  const profileCompletion = useMemo(() => computeProfileCompletion(formData), [formData]);

  // Per-section "has-content" status, used by the mobile pill nav status dots.
  const sectionStatus = useMemo(() => ({
    basic: !!formData.title,
    experience: formData.experience.length > 0,
    skills: Object.values(formData.skills).flat().length > 0,
    education: formData.education.length > 0,
    projects: formData.projects.length > 0,
  }), [formData]);

  // Scroll to section handler
  const scrollToSection = (sectionId, ref) => {
    setActiveSection(sectionId);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Track active section via IntersectionObserver for sticky nav highlight
  useEffect(() => {
    if (initialLoading) return;
    const sectionMap = [
      ['basic', basicInfoRef],
      ['skills', skillsRef],
      ['experience', experienceRef],
      ['projects', projectsRef],
      ['education', educationRef]
    ];
    const elements = sectionMap
      .map(([id, ref]) => (ref.current ? { id, el: ref.current } : null))
      .filter(Boolean);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = elements.find((s) => s.el === visible[0].target)?.id;
          if (id) setActiveSection(id);
        }
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 }
    );
    elements.forEach(({ el }) => observer.observe(el));
    return () => observer.disconnect();
  }, [initialLoading]);

  // Show loading state while fetching existing profile
  if (initialLoading) {
    return (
      <PageContainer>
        <Box sx={{ mt: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
          <CircularProgress size={40} sx={{ color: '#667eea' }} />
          <Typography sx={{ color: '#6b7280' }}>Loading your profile...</Typography>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {showCelebration && (
        <ProfileCelebration
          firstName={user?.firstName || user?.name?.split(' ')?.[0] || ''}
          completion={{ pct: profileCompletion.pct, label: profileCompletion.label }}
          counts={{
            skills: Object.values(formData.skills || {}).flat().filter(Boolean).length,
            experience: (formData.experience || []).filter((e) => e && (e.company || e.title)).length,
            education: (formData.education || []).filter((e) => e && (e.institution || e.degree)).length,
            projects: (formData.projects || []).filter((p) => p && p.title).length,
          }}
          publicProfileUrl={`${window.location.origin}/profile/${user?.slug || user?.username || user?.id || ''}`}
          onContinue={() => navigate('/profile')}
        />
      )}
      <ConfirmModal
        show={showGuestSignupPrompt}
        onClose={() => setShowGuestSignupPrompt(false)}
        onConfirm={() => navigate('/register?role=candidate')}
        variant="info"
        title={guestPromptReason === 'save' ? 'Your profile is ready to save' : 'Create a free account first'}
        message={
          guestPromptReason === 'save'
            ? "Nice work — that's a solid profile. Create a free account to save it; nothing you've entered is lost while you decide."
            : 'AI tools (enhancement, tailoring, suggestions) need a signed-in account. Your progress stays right here — sign up and pick up where you left off.'
        }
        confirmText="Sign Up"
        cancelText={guestPromptReason === 'save' ? 'Keep editing' : 'Maybe later'}
      />
      {/* AI Tools Bar - matches Dashboard */}
      <AIToolsBar>
        <AIToolsLeft>
          <MobileBackButton to="/profile" aria-label="Back to profile">
            <BackIcon />
          </MobileBackButton>
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
            <BreadcrumbLink to="/profile">
              <PersonIcon /> Profile
            </BreadcrumbLink>
            <BreadcrumbCurrent>{isExistingProfile ? 'Edit Profile' : 'Create Profile'}</BreadcrumbCurrent>
          </Breadcrumbs>
        </AIToolsLeft>
        <AIToolsButtons>
          {isAuthenticated && <AICreditsBadge style={{ marginRight: 8, alignSelf: 'center' }} />}
          <Tooltip title="Show the AI features tour again">
            <AIButton
              onClick={() => setShowWelcome(true)}
              $mobileHide
              type="button"
            >
              <HelpIcon /> <HideOnMobile>Show me how</HideOnMobile>
            </AIButton>
          </Tooltip>
          <AIButton
            as="label"
            htmlFor="resume-upload-edit"
            style={{ cursor: uploadingResume ? 'wait' : 'pointer' }}
            title="Upload a PDF or DOCX resume to populate your profile"
            $mobileHide
          >
            <input
              type="file"
              id="resume-upload-edit"
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
              onChange={handleResumeUpload}
              disabled={uploadingResume}
            />
            {uploadingResume ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
            {uploadingResume ? 'Uploading...' : <>Upload<HideOnMobile> Resume</HideOnMobile></>}
          </AIButton>
          {hasResumeData && (
            <AIButton
              onClick={() => setDeleteConfirm({ open: true, type: 'resume', index: -1, label: 'all imported resume data' })}
              title="Clear imported resume data"
              $mobileHide
            >
              <DeleteIcon /> Clear Resume
            </AIButton>
          )}
          <Tooltip title="Rewrite your profile with AI">
            <span>
              <AIButton
                onClick={() => setShowEnhancePrompt(true)}
                disabled={enhancing || gettingSuggestions || !formData.title}
                $mobileHide
              >
                {enhancing ? <CircularProgress size={16} color="inherit" /> : <AIIcon />}
                {enhancing ? 'Enhancing...' : 'Enhance'}
              </AIButton>
            </span>
          </Tooltip>
          <Tooltip title="Tailor your profile to a job description">
            <span>
              <AIButton
                onClick={() => setShowJobTailor(!showJobTailor)}
                disabled={!formData.title}
                $mobileHide
              >
                <TailorIcon /> Tailor
              </AIButton>
            </span>
          </Tooltip>
          <Tooltip title="Costs 1 AI credit per use">
            <span>
              <AIButton
                onClick={handleGetSuggestions}
                disabled={enhancing || gettingSuggestions || !formData.title}
                $mobileHide
              >
                {gettingSuggestions ? <CircularProgress size={16} color="inherit" /> : <TipIcon />}
                {gettingSuggestions ? 'Getting Tips...' : <>Tips<HideOnMobile> · 1 credit</HideOnMobile></>}
              </AIButton>
            </span>
          </Tooltip>

          {/* Mobile-only: collapses the four buttons above into an overflow menu. */}
          <MobileAIMenuButton
            type="button"
            aria-label="More tools"
            aria-haspopup="menu"
            aria-expanded={aiMenuOpen}
            disabled={!formData.title && !uploadingResume}
            onClick={(e) => setAiMenuAnchor(e.currentTarget)}
          >
            <MoreVertIcon />
          </MobileAIMenuButton>

          <AIButton
            onClick={handleSubmit}
            disabled={loading || !formData.title}
            $mobilePrimary
          >
            {loading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            {loading ? 'Saving...' : 'Save'}
          </AIButton>
        </AIToolsButtons>

        {/* AI tools overflow menu, only triggered on mobile via MobileAIMenuButton. */}
        <Menu
          anchorEl={aiMenuAnchor}
          open={aiMenuOpen}
          onClose={closeAiMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: {
                mt: 1,
                minWidth: 220,
                borderRadius: 2,
                boxShadow: '0 12px 32px -8px rgba(15,23,42,0.18)',
                '& .MuiMenuItem-root': {
                  fontSize: 14,
                  py: 1.25,
                  gap: 1.25,
                  '& svg': { fontSize: 18, color: '#4f46e5' },
                },
              },
            },
          }}
        >
          <MenuItem
            component="label"
            htmlFor="resume-upload-edit-menu"
            disabled={uploadingResume}
          >
            <input
              type="file"
              id="resume-upload-edit-menu"
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
              onChange={(e) => {
                closeAiMenu();
                handleResumeUpload(e);
              }}
              disabled={uploadingResume}
            />
            {uploadingResume ? <CircularProgress size={16} /> : <UploadFileIcon />}
            {uploadingResume ? 'Uploading…' : 'Upload Resume'}
          </MenuItem>
          {hasResumeData && (
            <MenuItem
              onClick={() => {
                closeAiMenu();
                setDeleteConfirm({ open: true, type: 'resume', index: -1, label: 'all imported resume data' });
              }}
            >
              <DeleteIcon /> Clear Resume
            </MenuItem>
          )}
          <MenuItem
            disabled={enhancing || gettingSuggestions || !formData.title}
            onClick={() => {
              closeAiMenu();
              setShowEnhancePrompt(true);
            }}
          >
            {enhancing ? <CircularProgress size={16} /> : <AIIcon />}
            {enhancing ? 'Enhancing…' : 'Enhance'}
          </MenuItem>
          <MenuItem
            disabled={!formData.title}
            onClick={() => {
              closeAiMenu();
              setShowJobTailor((v) => !v);
            }}
          >
            <TailorIcon /> Tailor
          </MenuItem>
          <MenuItem
            disabled={enhancing || gettingSuggestions || !formData.title}
            onClick={() => {
              closeAiMenu();
              handleGetSuggestions();
            }}
          >
            {gettingSuggestions ? <CircularProgress size={16} /> : <TipIcon />}
            {gettingSuggestions ? 'Getting Tips…' : 'Tips'}
          </MenuItem>
        </Menu>
      </AIToolsBar>

      <FormContainer>
        {/* Sidebar */}
        <Sidebar>
          <SidebarCard>
            <SidebarTitle>Profile Completion</SidebarTitle>
            <ProgressSection>
              <LinearProgress 
                variant="determinate" 
                value={profileCompletion.pct} 
                sx={{ 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: '#f3f4f6',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                  }
                }} 
              />
              <ProgressLabel>
                <span style={{ color: '#6b7280' }}>{profileCompletion.label}</span>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <span style={{ color: '#1a1a2e', fontWeight: 600 }}>{profileCompletion.pct}%</span>
                  {profileCompletion.missing.length > 0 && (
                    <Tooltip
                      arrow
                      placement="top"
                      enterTouchDelay={0}
                      leaveTouchDelay={4000}
                      componentsProps={{
                        tooltip: {
                          sx: {
                            bgcolor: '#1a1a2e',
                            color: '#fff',
                            p: 1.25,
                            maxWidth: 280,
                            borderRadius: 1.5,
                            fontSize: 12,
                          },
                        },
                        arrow: { sx: { color: '#1a1a2e' } },
                      }}
                      title={
                        <Box>
                          <Box sx={{ fontWeight: 700, fontSize: 12, mb: 0.75 }}>
                            Boost your profile
                          </Box>
                          <Box component="ul" sx={{ m: 0, pl: 0, listStyle: 'none' }}>
                            {profileCompletion.missing.map((item) => {
                              const refMap = {
                                basic: basicInfoRef,
                                skills: skillsRef,
                                experience: experienceRef,
                                education: educationRef,
                                projects: projectsRef,
                              };
                              return (
                                <Box
                                  key={item.key}
                                  component="li"
                                  onClick={() => scrollToSection(item.section, refMap[item.section])}
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 1.5,
                                    py: 0.5,
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    lineHeight: 1.35,
                                    '&:hover': { color: '#a78bfa' },
                                  }}
                                >
                                  <span>{item.label}</span>
                                  <Box
                                    component="span"
                                    sx={{
                                      flexShrink: 0,
                                      fontWeight: 700,
                                      color: '#a78bfa',
                                      fontSize: 11,
                                    }}
                                  >
                                    +{item.gainPct}%
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      }
                    >
                      <InfoOutlinedIcon
                        aria-label="What's left to complete"
                        sx={{
                          fontSize: 16,
                          color: '#9ca3af',
                          cursor: 'help',
                          '&:hover': { color: '#667eea' },
                        }}
                      />
                    </Tooltip>
                  )}
                </Box>
              </ProgressLabel>
            </ProgressSection>
            <NavItems>
              <NavItem $active={activeSection === 'basic'} onClick={() => scrollToSection('basic', basicInfoRef)}>
                <BadgeIcon /> Basic Info
              </NavItem>
              <NavItem $active={activeSection === 'experience'} onClick={() => scrollToSection('experience', experienceRef)}>
                <BusinessCenterIcon /> Experience
              </NavItem>
              <NavItem $active={activeSection === 'skills'} onClick={() => scrollToSection('skills', skillsRef)}>
                <StarsIcon /> Skills & Expertise
              </NavItem>
              <NavItem $active={activeSection === 'education'} onClick={() => scrollToSection('education', educationRef)}>
                <SchoolIcon /> Education
              </NavItem>
              <NavItem $active={activeSection === 'projects'} onClick={() => scrollToSection('projects', projectsRef)}>
                <WorkIcon /> Projects
              </NavItem>
            </NavItems>
          </SidebarCard>
        </Sidebar>

        {/* Main Content */}
        <MainContent>

        {/* Mobile-only section nav. Replaces the Profile Completion sidebar card on small screens. */}
        <MobileSectionNav role="navigation" aria-label="Profile sections">
          <MobileSectionPills>
            <MobileSectionPill
              type="button"
              $active={activeSection === 'basic'}
              onClick={() => scrollToSection('basic', basicInfoRef)}
            >
              <span className={`status-dot${sectionStatus.basic ? ' complete' : ''}`} />
              Basic
            </MobileSectionPill>
            <MobileSectionPill
              type="button"
              $active={activeSection === 'experience'}
              onClick={() => scrollToSection('experience', experienceRef)}
            >
              <span className={`status-dot${sectionStatus.experience ? ' complete' : ''}`} />
              Experience
            </MobileSectionPill>
            <MobileSectionPill
              type="button"
              $active={activeSection === 'skills'}
              onClick={() => scrollToSection('skills', skillsRef)}
            >
              <span className={`status-dot${sectionStatus.skills ? ' complete' : ''}`} />
              Skills
            </MobileSectionPill>
            <MobileSectionPill
              type="button"
              $active={activeSection === 'education'}
              onClick={() => scrollToSection('education', educationRef)}
            >
              <span className={`status-dot${sectionStatus.education ? ' complete' : ''}`} />
              Education
            </MobileSectionPill>
            <MobileSectionPill
              type="button"
              $active={activeSection === 'projects'}
              onClick={() => scrollToSection('projects', projectsRef)}
            >
              <span className={`status-dot${sectionStatus.projects ? ' complete' : ''}`} />
              Projects
            </MobileSectionPill>
          </MobileSectionPills>
          <MobileCompletionBadge aria-label={`Profile ${profileCompletion.pct}% complete`}>
            <div className="completion-bar">
              <div className="completion-fill" style={{ width: `${profileCompletion.pct}%` }} />
            </div>
            <span className="completion-pct">{profileCompletion.pct}%</span>
          </MobileCompletionBadge>
        </MobileSectionNav>

        {error && <Alert severity="error" sx={{ mb: 2, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', '& .MuiAlert-icon': { color: '#dc2626' } }}>{error}</Alert>}

        {/* Slim banner, only the draft-restored case. Replaces the previous full-width green Alert. */}
        {draftRestored && (
          <DraftRestoredBanner role="status">
            <span className="draft-icon" aria-hidden="true">
              <CheckIcon fontSize="inherit" />
            </span>
            <span className="draft-text">
              Restored unsaved changes from your last session.
            </span>
            <span className="draft-actions">
              <button
                type="button"
                className="draft-action"
                onClick={handleDiscardDraft}
              >
                Discard draft
              </button>
              <button
                type="button"
                className="draft-action dismiss"
                aria-label="Dismiss"
                onClick={() => setDraftRestored(false)}
              >
                <CloseIcon fontSize="inherit" />
              </button>
            </span>
          </DraftRestoredBanner>
        )}

        {/* Real success messages (e.g. "Profile saved!") still get the prominent Alert. */}
        {success && (
          <Alert
            severity="success"
            sx={{ mb: 2, background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', '& .MuiAlert-icon': { color: '#059669' } }}
            action={
              <IconButton
                aria-label="Dismiss"
                size="small"
                onClick={() => setSuccess('')}
                sx={{ color: '#065f46' }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            {success}
          </Alert>
        )}

        {/* Job Tailor Section */}
        <Collapse in={showJobTailor}>
          <Paper 
            sx={{ 
              p: 3, 
              mb: 3, 
              background: '#ecfdf5',
              border: '1px solid #6ee7b7',
              color: '#1a1a2e',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(17, 153, 142, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <WorkIcon sx={{ fontSize: 24, color: '#38ef7d' }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight="bold" sx={{ color: '#1a1a2e' }}>
                  🎯 Tailor Profile for a Specific Job
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                  Paste a job description and AI will customize your profile to match perfectly.
                </Typography>
              </Box>
            </Box>
            
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Example: We are looking for an experienced Senior UI Engineer with React and Tailwind expertise..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              sx={{
                bgcolor: 'white',
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  color: '#1a1a2e',
                  transition: 'box-shadow 0.15s ease-in-out',
                  '& fieldset': {
                    borderColor: '#d1d5db',
                    borderWidth: '1px',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(17, 153, 142, 0.5)',
                    borderWidth: '1px',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#11998e',
                    borderWidth: '1px',
                  },
                  '&.Mui-focused': {
                    boxShadow: '0 0 0 3px rgba(17, 153, 142, 0.15)',
                  },
                },
                '& .MuiInputBase-input::placeholder': {
                  color: '#9ca3af',
                },
              }}
            />
            
            <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={tailoring ? <CircularProgress size={20} color="inherit" /> : <AIIcon />}
                onClick={handleTailorForJob}
                disabled={tailoring || !jobDescription.trim() || !formData.title}
                sx={{
                  bgcolor: '#11998e',
                  color: 'white',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: '#0e8577',
                  },
                  '&:disabled': {
                    bgcolor: 'rgba(17, 153, 142, 0.3)',
                    color: '#9ca3af',
                  }
                }}
              >
                {tailoring ? 'Tailoring...' : '✨ Tailor My Profile'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setShowJobTailor(false);
                  setJobDescription('');
                }}
                sx={{
                  borderColor: '#d1d5db',
                  color: '#4b5563',
                  '&:hover': {
                    borderColor: '#9ca3af',
                    bgcolor: 'white',
                  }
                }}
              >
                Cancel
              </Button>
              {!tailoring && (!jobDescription.trim() || !formData.title) && (
                <Typography variant="caption" sx={{ color: '#6b7280', flexBasis: '100%', mt: 0.5 }}>
                  {!formData.title
                    ? 'Add a Professional Title above to continue.'
                    : 'Paste a job description to continue.'}
                </Typography>
              )}
              {jobDescription.trim().length > 0 && jobDescription.trim().length < 50 && (
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Need at least 50 characters ({50 - jobDescription.trim().length} more)
                </Typography>
              )}
            </Box>
          </Paper>
        </Collapse>

        {/* Suggestions Panel - Shows after getting tips */}
        <Collapse in={showSuggestions && suggestions}>
          <Paper sx={{ p: 3, mb: 3, bgcolor: '#eef2ff', border: '1px solid rgba(102, 126, 234, 0.25)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#667eea' }} fontWeight="bold">
                💡 AI Improvement Suggestions
              </Typography>
              <Button size="small" sx={{ color: '#6b7280' }} onClick={() => setShowSuggestions(false)}>
                Hide
              </Button>
            </Box>
            
            {suggestions?.generalTips?.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: '#1f2937' }}>
                  General Tips:
                </Typography>
                <List dense>
                  {suggestions.generalTips.map((tip, i) => (
                    <ListItem key={i}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <CheckIcon sx={{ color: '#34d399' }} fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={tip} sx={{ '& .MuiListItemText-primary': { color: '#4b5563' } }} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {suggestions?.summaryTips?.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: '#1f2937' }}>
                  Summary Improvements:
                </Typography>
                {suggestions.summaryTips.map((tip, i) => (
                  <Alert key={i} severity="info" sx={{ mb: 1, bgcolor: '#eef2ff', border: '1px solid rgba(102, 126, 234, 0.3)', color: '#374151', '& .MuiAlert-icon': { color: '#667eea' } }}>
                    <strong style={{ color: '#111827' }}>Issue:</strong> {tip.current}<br />
                    <strong style={{ color: '#111827' }}>Suggestion:</strong> {tip.suggestion}
                  </Alert>
                ))}
              </Box>
            )}

            {suggestions?.strengthsToHighlight?.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: '#1f2937' }}>
                  Strengths to Highlight:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {suggestions.strengthsToHighlight.map((strength, i) => (
                    <Chip key={i} label={strength} sx={{ bgcolor: 'rgba(16, 185, 129, 0.12)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)' }} variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}

            {suggestions?.missingElements?.length > 0 && (
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: '#1f2937' }}>
                  Consider Adding:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {suggestions.missingElements.map((element, i) => (
                    <Chip key={i} label={element} sx={{ bgcolor: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.3)' }} variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>
        </Collapse>

        <form onSubmit={handleSubmit}>
          {validationSummary.length > 0 && (
            <Alert
              severity="error"
              sx={{ mb: 2, borderRadius: 2 }}
              role="alert"
              aria-live="assertive"
              onClose={() => setValidationSummary([])}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Please fix the following before saving:
              </Typography>
              <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
                {validationSummary.map((v) => (
                  <li key={v.name}>
                    <Typography variant="body2">
                      <strong>{v.label}:</strong> {v.message}
                    </Typography>
                  </li>
                ))}
              </Box>
            </Alert>
          )}
          <Paper ref={basicInfoRef} sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 1.5, sm: 3 }, background: 'white', border: '1px solid #e5e7eb', borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#1a1a2e', fontWeight: 600, mb: { xs: 1.5, sm: 3 } }}>Basic Information</Typography>

            {/* Profile Picture - centered above fields */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 1.5, sm: 3 } }}>
              <ProfilePictureUpload>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="profile-picture-upload"
                  type="file"
                  onChange={handleProfilePictureUpload}
                  disabled={uploadingImage}
                />
                <label htmlFor="profile-picture-upload" style={{ position: 'relative', cursor: 'pointer' }}>
                  <ProfileAvatar
                    src={resolveImageUrl(formData.profilePicture)}
                    alt="Profile Picture"
                  >
                    {!formData.profilePicture && <CameraIcon sx={{ fontSize: 40, color: '#667eea' }} />}
                  </ProfileAvatar>
                  <AvatarOverlay>
                    {uploadingImage ? (
                      <CircularProgress size={18} sx={{ color: '#1a1a2e' }} />
                    ) : (
                      <CameraIcon />
                    )}
                  </AvatarOverlay>
                </label>
                <UploadPhotoText>
                  {uploadingImage ? 'Uploading...' : 'Upload Photo'}
                </UploadPhotoText>
                <UploadPhotoHint>
                  JPG, PNG, GIF or WebP (max 5MB)
                </UploadPhotoHint>
              </ProfilePictureUpload>
            </Box>
            
            {/* Basic Info Fields - full width */}
            <Grid container spacing={{ xs: 1.5, sm: 2.5 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Professional Title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  inputProps={{ maxLength: FIELD_LIMITS.title, 'aria-invalid': !!fieldErrors.title, 'aria-describedby': fieldErrors.title ? 'title-error' : undefined }}
                  error={!!fieldErrors.title}
                  helperText={fieldErrors.title || `${formData.title?.length || 0}/${FIELD_LIMITS.title}`}
                  FormHelperTextProps={{ id: 'title-error' }}
                  placeholder="e.g., Senior Manager, Marketing Director, Registered Nurse"
                  sx={darkTextFieldSx}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., San Francisco, CA"
                  sx={darkTextFieldSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LocationIcon sx={{ color: '#9ca3af', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  type="tel"
                  inputMode="tel"
                  inputProps={{ 'aria-invalid': !!fieldErrors.phone, 'aria-describedby': fieldErrors.phone ? 'phone-error' : undefined }}
                  error={!!fieldErrors.phone}
                  helperText={fieldErrors.phone || ''}
                  FormHelperTextProps={{ id: 'phone-error' }}
                  placeholder="e.g., +1 555 123 4567"
                  sx={darkTextFieldSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon sx={{ color: '#9ca3af', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="LinkedIn URL"
                  name="linkedinUrl"
                  value={formData.linkedinUrl}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  type="url"
                  inputMode="url"
                  inputProps={{ 'aria-invalid': !!fieldErrors.linkedinUrl, 'aria-describedby': fieldErrors.linkedinUrl ? 'linkedinUrl-error' : undefined }}
                  error={!!fieldErrors.linkedinUrl}
                  helperText={fieldErrors.linkedinUrl || ''}
                  FormHelperTextProps={{ id: 'linkedinUrl-error' }}
                  placeholder="https://linkedin.com/in/your-profile"
                  sx={darkTextFieldSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkedInIcon sx={{ color: '#9ca3af', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="GitHub URL"
                  name="githubUrl"
                  value={formData.githubUrl}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  type="url"
                  inputMode="url"
                  inputProps={{ 'aria-invalid': !!fieldErrors.githubUrl, 'aria-describedby': fieldErrors.githubUrl ? 'githubUrl-error' : undefined }}
                  error={!!fieldErrors.githubUrl}
                  helperText={fieldErrors.githubUrl || ''}
                  FormHelperTextProps={{ id: 'githubUrl-error' }}
                  placeholder="https://github.com/your-username"
                  sx={darkTextFieldSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <GitHubIcon sx={{ color: '#9ca3af', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                {!formData.summary && (formData.experience?.length || 0) > 0 && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      mb: 1.25,
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px dashed #c7d2fe',
                      backgroundColor: '#f5f3ff',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                      <AIIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ color: '#4338ca', fontSize: 12.75, fontWeight: 500 }}>
                        Don't know what to write? AI can draft a summary using your experience and target role.
                      </Typography>
                    </Box>
                    <Tooltip title="Opens Enhance with Summary selected · 1 credit">
                      <span>
                        <Button
                          size="small"
                          onClick={() => setShowEnhancePrompt(true)}
                          disabled={!formData.title || enhancing}
                          startIcon={<AIIcon sx={{ fontSize: 16 }} />}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: 12.5,
                            px: 1.5,
                            borderRadius: 1.5,
                            color: '#fff',
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                            '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' },
                            '&.Mui-disabled': { background: '#e2e8f0', color: '#94a3b8' },
                          }}
                        >
                          Draft for me
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                )}
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  maxRows={10}
                  label="Professional Summary"
                  name="summary"
                  value={formData.summary}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  inputProps={{ maxLength: FIELD_LIMITS.summary, 'aria-invalid': !!fieldErrors.summary, 'aria-describedby': fieldErrors.summary ? 'summary-error' : undefined }}
                  error={!!fieldErrors.summary}
                  helperText={fieldErrors.summary || `${formData.summary?.length || 0}/${FIELD_LIMITS.summary}`}
                  FormHelperTextProps={{ id: 'summary-error' }}
                  placeholder="Brief overview of your experience and expertise..."
                  sx={darkTextFieldSx}
                />
                <InlineAIEnhanceButton
                  loading={enhancingField === 'summary'}
                  disabled={(formData.summary?.length || 0) < 10}
                  helperText={
                    (formData.summary?.length || 0) < 10
                      ? 'Write a few words first, then AI will rewrite with sharper verbs and tone.'
                      : 'Polish tone, verbs and metrics — AI keeps your facts.'
                  }
                  onClick={() => handleEnhanceField('summary', 'summary', formData.summary, {}, (enhanced) => setFormData(prev => ({ ...prev, summary: enhanced })), 'professional summary')}
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper ref={skillsRef} sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 1.5, sm: 3 }, background: 'white', border: '1px solid #e5e7eb', borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Typography variant="h6" sx={{ color: '#1a1a2e', fontWeight: 600, mb: { xs: 1.5, sm: 2 } }}>Skills & Expertise</Typography>

            {/* Single unified input + optional category override. The "Auto" choice
                runs categorizeSkillsHelper; selecting a category bypasses it. */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
              <TextField
                fullWidth
                size="small"
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkillUnified(newSkillInput, newSkillCategory);
                  }
                }}
                placeholder="Type a skill and press Enter (e.g., React, Excel, Leadership)"
                sx={darkTextFieldSx}
              />
              <TextField
                size="small"
                select
                label="Category"
                value={newSkillCategory}
                onChange={(e) => setNewSkillCategory(e.target.value)}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                sx={{ ...darkTextFieldSx, minWidth: 150 }}
              >
                <option value="auto">Auto</option>
                <option value="core">Core</option>
                <option value="technical">Technical</option>
                <option value="software">Software & Tools</option>
                <option value="industry">Industry</option>
                <option value="soft">Soft skills</option>
              </TextField>
              <IconButton
                onClick={() => handleAddSkillUnified(newSkillInput, newSkillCategory)}
                disabled={!newSkillInput.trim()}
                sx={{ color: '#667eea', alignSelf: 'flex-start', mt: 0.25 }}
                aria-label="Add skill"
              >
                <AddIcon />
              </IconButton>
            </Box>

            {/* AI suggest skills entry-point. Reuses the main Enhance modal which
                already has a Skills section toggle and the right context. */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                mb: 2,
                p: 1.5,
                borderRadius: 2,
                border: '1px dashed #c7d2fe',
                backgroundColor: '#f5f3ff',
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                <AIIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: '#4338ca', fontSize: 12.75, fontWeight: 500 }}>
                  Not sure what to add? AI can suggest skills based on your role and experience.
                </Typography>
              </Box>
              <Tooltip title={!formData.title ? 'Add a target role first' : 'Opens Enhance with Skills selected · 1 credit'}>
                <span>
                  <Button
                    size="small"
                    onClick={() => setShowEnhancePrompt(true)}
                    disabled={!formData.title || enhancing}
                    startIcon={<AIIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 12.5,
                      px: 1.5,
                      borderRadius: 1.5,
                      color: '#fff',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                      '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' },
                      '&.Mui-disabled': { background: '#e2e8f0', color: '#94a3b8' },
                    }}
                  >
                    Suggest with AI
                  </Button>
                </span>
              </Tooltip>
            </Box>

            {/* Flat list of all skills, grouped by auto-category with thin labels.
                Empty categories are skipped, so users only see what they have. */}
            {Object.entries(formData.skills).map(([category, skills]) => (
              skills && skills.length > 0 ? (
                <Box key={category} sx={{ mb: 1.5 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mb: 0.75,
                      color: '#9ca3af',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {category === 'core' ? 'Core' :
                     category === 'technical' ? 'Technical' :
                     category === 'software' ? 'Software & Tools' :
                     category === 'industry' ? 'Industry' :
                     category === 'soft' ? 'Soft skills' : category}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {skills.map((skill, index) => (
                      <Chip
                        key={`${category}-${index}`}
                        label={skill}
                        onClick={(e) => setSkillMenu({ anchorEl: e.currentTarget, category, index })}
                        onDelete={() => handleDeleteSkill(category, index)}
                        deleteIcon={
                          <CloseIcon
                            aria-label={`Remove ${skill}`}
                            sx={{ fontSize: 18, p: '3px', borderRadius: '50%' }}
                          />
                        }
                        size="small"
                        sx={{
                          bgcolor: 'rgba(102, 126, 234, 0.10)',
                          color: '#4338ca',
                          fontWeight: 500,
                          height: 28,
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease, color 0.15s ease',
                          '& .MuiChip-label': { px: 1.25 },
                          '& .MuiChip-deleteIcon': {
                            color: 'rgba(67, 56, 202, 0.5)',
                            mr: 0.5,
                            width: 22,
                            height: 22,
                            '&:hover': { color: '#b91c1c' },
                          },
                          '&:hover': {
                            bgcolor: 'rgba(102, 126, 234, 0.18)',
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              ) : null
            ))}

            {/* Empty hint shown only when truly empty, replaces the dashed empty-state card. */}
            {Object.values(formData.skills).every((arr) => !arr || arr.length === 0) && (
              <Typography variant="caption" sx={{ display: 'block', color: '#9ca3af', fontSize: 12, mt: 0.5 }}>
                We'll auto-sort skills into Technical / Soft / Software / Industry / Core as you add them.
              </Typography>
            )}

            {/* Per-chip "Move to category" menu. Anchored to the chip the user
                clicked. The X icon on the chip still deletes directly. */}
            <Menu
              anchorEl={skillMenu.anchorEl}
              open={Boolean(skillMenu.anchorEl)}
              onClose={() => setSkillMenu({ anchorEl: null, category: null, index: null })}
            >
              {[
                ['core', 'Core'],
                ['technical', 'Technical'],
                ['software', 'Software & Tools'],
                ['industry', 'Industry'],
                ['soft', 'Soft skills'],
              ].map(([key, label]) => (
                <MenuItem
                  key={key}
                  selected={skillMenu.category === key}
                  disabled={skillMenu.category === key}
                  onClick={() => {
                    moveSkillToCategory(skillMenu.category, skillMenu.index, key);
                    setSkillMenu({ anchorEl: null, category: null, index: null });
                  }}
                >
                  Move to {label}
                </MenuItem>
              ))}
              <MenuItem
                onClick={() => {
                  if (skillMenu.category != null && skillMenu.index != null) {
                    handleDeleteSkill(skillMenu.category, skillMenu.index);
                  }
                  setSkillMenu({ anchorEl: null, category: null, index: null });
                }}
                sx={{ color: '#b91c1c' }}
              >
                Remove skill
              </MenuItem>
            </Menu>
          </Paper>

          <Paper ref={experienceRef} sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 1.5, sm: 3 }, background: 'white', border: '1px solid #e5e7eb', borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#1a1a2e', fontWeight: 600 }}>Experience</Typography>
              <Button startIcon={<AddIcon />} onClick={handleAddExperience} sx={{ color: '#667eea' }}>
                Add Experience
              </Button>
            </Box>
            {formData.experience.length === 0 && (
              <Box
                sx={{
                  p: 3,
                  borderRadius: 2,
                  border: '1.5px dashed #c7d2fe',
                  backgroundColor: '#f8faff',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <BusinessCenterIcon sx={{ fontSize: 32, color: '#6366f1' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
                  Add your first role
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 420 }}>
                  Experience is the foundation of every AI feature — Enhance,
                  Tailor and Tips all need at least one role to give you great
                  results.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddExperience}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2,
                      backgroundColor: '#4338ca',
                      '&:hover': { backgroundColor: '#3730a3' },
                    }}
                  >
                    Add experience
                  </Button>
                  <Button
                    component="label"
                    htmlFor="resume-upload-experience-empty"
                    startIcon={<UploadFileIcon />}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: 2,
                      color: '#4338ca',
                    }}
                  >
                    Upload resume instead
                    <input
                      type="file"
                      id="resume-upload-experience-empty"
                      accept=".pdf,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={handleResumeUpload}
                      disabled={uploadingResume}
                    />
                  </Button>
                </Box>
              </Box>
            )}
            {formData.experience.map((exp, index) => (
              <Box key={index} sx={{ mb: 3, p: 2, bgcolor: '#fafbfc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: '#374151', fontWeight: 600 }}>
                    Experience {index + 1}
                  </Typography>
                  <Tooltip title="Remove this experience">
                    <IconButton
                      size="small"
                      onClick={() => setDeleteConfirm({ open: true, type: 'experience', index, label: exp.title || exp.company || `Experience ${index + 1}` })}
                      sx={{ color: 'rgba(239, 68, 68, 0.7)' }}
                      aria-label="Remove experience"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Company"
                      value={exp.company}
                      onChange={(e) => handleExperienceChange(index, 'company', e.target.value)}
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Job Title"
                      value={exp.title}
                      onChange={(e) => handleExperienceChange(index, 'title', e.target.value)}
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      select
                      label="Employment Type"
                      value={exp.employmentType || ''}
                      onChange={(e) => handleExperienceChange(index, 'employmentType', e.target.value)}
                      sx={darkTextFieldSx}
                      InputLabelProps={{ shrink: true }}
                      SelectProps={{ native: true }}
                    >
                      <option value="">Select type</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Freelance">Freelance</option>
                      <option value="Internship">Internship</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Location"
                      value={exp.location || ''}
                      onChange={(e) => handleExperienceChange(index, 'location', e.target.value)}
                      placeholder="e.g., San Francisco, CA or Remote"
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="month"
                      label="Start Date"
                      value={toIsoMonth(exp.startDate)}
                      onChange={(e) => handleExperienceChange(index, 'startDate', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      helperText={!toIsoMonth(exp.startDate) && exp.startDate ? `Saved as: ${exp.startDate}` : ''}
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    {isPresentValue(exp.endDate) ? (
                      // When the candidate currently works here, replace the
                      // disabled empty End Date input with a clear "Present"
                      // pill. Avoids the confusing "blank but disabled" field
                      // and lets the checkbox act as the single toggle.
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          height: 40,
                          px: 1.5,
                          borderRadius: 1,
                          border: '1px solid #c7d2fe',
                          background: 'linear-gradient(135deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ color: '#1f2937', fontWeight: 600 }}>
                            Present
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            · ongoing role
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          onClick={() => handleExperienceChange(index, 'endDate', '')}
                          sx={{
                            textTransform: 'none',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#4f46e5',
                            minWidth: 'auto',
                            px: 1,
                            '&:hover': { background: 'rgba(79,70,229,0.08)' },
                          }}
                        >
                          Set end date
                        </Button>
                      </Box>
                    ) : (
                      <TextField
                        fullWidth
                        size="small"
                        type="month"
                        label="End Date"
                        value={toIsoMonth(exp.endDate)}
                        onChange={(e) => handleExperienceChange(index, 'endDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        helperText={!toIsoMonth(exp.endDate) && exp.endDate ? `Saved as: ${exp.endDate}` : ''}
                        sx={darkTextFieldSx}
                      />
                    )}
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isPresentValue(exp.endDate)}
                          onChange={(e) => handleExperienceChange(index, 'endDate', e.target.checked ? 'Present' : '')}
                          size="small"
                          sx={{ color: '#9ca3af', '&.Mui-checked': { color: '#667eea' } }}
                        />
                      }
                      label={<Typography variant="caption" sx={{ color: '#6b7280' }}>I currently work here</Typography>}
                      sx={{ ml: 0, mt: 0.5 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      size="small"
                      label="Description & Achievements"
                      value={exp.description}
                      onChange={(e) => handleExperienceChange(index, 'description', e.target.value)}
                      placeholder="Describe your responsibilities, achievements, and impact..."
                      inputProps={{ maxLength: FIELD_LIMITS.experienceDescription }}
                      helperText={`${exp.description?.length || 0}/${FIELD_LIMITS.experienceDescription}`}
                      sx={darkTextFieldSx}
                    />
                    <InlineAIEnhanceButton
                      loading={enhancingField === `exp-${index}`}
                      disabled={(exp.description?.length || 0) < 10}
                      helperText={
                        (exp.description?.length || 0) < 10
                          ? 'Draft a sentence or two — AI will turn it into impact-driven bullets.'
                          : 'Rewrite as STAR-style bullets with stronger verbs and metrics.'
                      }
                      onClick={() => handleEnhanceField(`exp-${index}`, 'experience', exp.description, { company: exp.company, title: exp.title, period: formatDateRange(exp.startDate, exp.endDate) || exp.period }, (enhanced) => handleExperienceChange(index, 'description', enhanced), `${exp.title || 'experience'} description`)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Skills (comma-separated)"
                      value={(exp.skills || []).join(', ')}
                      onChange={(e) => handleExperienceChange(index, 'skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="e.g., React, Node.js, AWS"
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Paper>

          <Paper ref={educationRef} sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 1.5, sm: 3 }, background: 'white', border: '1px solid #e5e7eb', borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#1a1a2e', fontWeight: 600 }}>Education</Typography>
              <Button startIcon={<AddIcon />} onClick={handleAddEducation} sx={{ color: '#667eea' }}>
                Add Education
              </Button>
            </Box>
            {formData.education.map((edu, index) => (
              <Box key={index} sx={{ mb: 2, p: 2, bgcolor: '#fafbfc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                  <Tooltip title="Remove this education entry">
                    <IconButton
                      size="small"
                      onClick={() => setDeleteConfirm({ open: true, type: 'education', index, label: edu.degree || edu.institution || `Education ${index + 1}` })}
                      sx={{ color: 'rgba(239, 68, 68, 0.7)' }}
                      aria-label="Remove education"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Degree/Program"
                      value={edu.degree}
                      onChange={(e) => handleEducationChange(index, 'degree', e.target.value)}
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Institution"
                      value={edu.institution}
                      onChange={(e) => handleEducationChange(index, 'institution', e.target.value)}
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Field of Study"
                      value={edu.fieldOfStudy || edu.field || edu.major || ''}
                      onChange={(e) => handleEducationChange(index, 'fieldOfStudy', e.target.value)}
                      placeholder="e.g., Computer Science"
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Location"
                      value={edu.location || ''}
                      onChange={(e) => handleEducationChange(index, 'location', e.target.value)}
                      placeholder="e.g., Berkeley, CA"
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="month"
                      label="Start Date"
                      value={toIsoMonth(edu.startDate)}
                      onChange={(e) => handleEducationChange(index, 'startDate', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      helperText={!toIsoMonth(edu.startDate) && edu.startDate ? `Saved as: ${edu.startDate}` : ''}
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="month"
                      label="End Date"
                      value={isPresentValue(edu.endDate) ? '' : toIsoMonth(edu.endDate)}
                      onChange={(e) => handleEducationChange(index, 'endDate', e.target.value)}
                      disabled={isPresentValue(edu.endDate)}
                      InputLabelProps={{ shrink: true }}
                      helperText={isPresentValue(edu.endDate) ? 'Currently enrolled' : (!toIsoMonth(edu.endDate) && edu.endDate ? `Saved as: ${edu.endDate}` : (edu.year ? `Legacy year: ${edu.year}` : ''))}
                      sx={darkTextFieldSx}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isPresentValue(edu.endDate)}
                          onChange={(e) => handleEducationChange(index, 'endDate', e.target.checked ? 'Present' : '')}
                          size="small"
                          sx={{ color: '#9ca3af', '&.Mui-checked': { color: '#667eea' } }}
                        />
                      }
                      label={<Typography variant="caption" sx={{ color: '#6b7280' }}>Currently enrolled</Typography>}
                      sx={{ ml: 0, mt: -1 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="GPA"
                      value={edu.gpa || ''}
                      onChange={(e) => handleEducationChange(index, 'gpa', e.target.value)}
                      placeholder="e.g., 3.8/4.0"
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Honors / Awards"
                      value={edu.honors || ''}
                      onChange={(e) => handleEducationChange(index, 'honors', e.target.value)}
                      placeholder="e.g., Magna Cum Laude, Dean's List"
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      size="small"
                      label="Description / Coursework"
                      value={edu.description || ''}
                      onChange={(e) => handleEducationChange(index, 'description', e.target.value)}
                      placeholder="Relevant coursework, thesis, activities, or extracurriculars..."
                      sx={darkTextFieldSx}
                    />
                    <InlineAIEnhanceButton
                      loading={enhancingField === `edu-${index}`}
                      disabled={(edu.description?.length || 0) < 10}
                      label="Polish description"
                      helperText={
                        (edu.description?.length || 0) < 10
                          ? 'Add coursework, thesis or activities \u2014 AI will tighten the wording.'
                          : 'Rewrite for clarity and recruiter-friendly tone.'
                      }
                      onClick={() => handleEnhanceField(`edu-${index}`, 'summary', edu.description, { degree: edu.degree, institution: edu.institution, fieldOfStudy: edu.fieldOfStudy }, (enhanced) => handleEducationChange(index, 'description', enhanced), `${edu.degree || 'education'} description`)}
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Paper>

          <Paper ref={projectsRef} sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 1.5, sm: 3 }, background: 'white', border: '1px solid #e5e7eb', borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#1a1a2e', fontWeight: 600 }}>Projects</Typography>
              <Button startIcon={<AddIcon />} onClick={handleAddProject} sx={{ color: '#667eea' }}>
                Add Project
              </Button>
            </Box>
            {formData.projects.map((project, index) => (
              <Box key={index} sx={{ mb: 3, p: 2, bgcolor: '#fafbfc', borderRadius: 2, border: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#667eea' }}>
                    Project {index + 1}
                  </Typography>
                  <Tooltip title="Remove this project">
                    <IconButton
                      size="small"
                      onClick={() => setDeleteConfirm({ open: true, type: 'project', index, label: project.title || project.name || `Project ${index + 1}` })}
                      sx={{ color: 'rgba(239, 68, 68, 0.7)' }}
                      aria-label="Remove project"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Project Title"
                      value={project.title}
                      onChange={(e) => handleProjectChange(index, 'title', e.target.value)}
                      placeholder="e.g., AI-Powered Task Manager"
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Your Role"
                      value={project.role || ''}
                      onChange={(e) => handleProjectChange(index, 'role', e.target.value)}
                      placeholder="e.g., Project Lead, Team Member, Consultant"
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      size="small"
                      label="Description"
                      value={project.description}
                      onChange={(e) => handleProjectChange(index, 'description', e.target.value)}
                      placeholder="Describe the project, your contributions, and achievements..."
                      inputProps={{ maxLength: FIELD_LIMITS.projectDescription }}
                      helperText={`${project.description?.length || 0}/${FIELD_LIMITS.projectDescription}`}
                      sx={darkTextFieldSx}
                    />
                    <InlineAIEnhanceButton
                      loading={enhancingField === `proj-${index}`}
                      disabled={(project.description?.length || 0) < 10}
                      helperText={
                        (project.description?.length || 0) < 10
                          ? 'Add a quick description — AI will sharpen scope, role and outcomes.'
                          : 'Tighten copy and highlight the technical impact.'
                      }
                      onClick={() => handleEnhanceField(`proj-${index}`, 'project', project.description, { title: project.title, role: project.role, technologies: project.technologies }, (enhanced) => handleProjectChange(index, 'description', enhanced), `${project.title || 'project'} description`)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Live Demo URL"
                      name={`projects.${index}.url`}
                      value={project.url || ''}
                      onChange={(e) => handleProjectChange(index, 'url', e.target.value)}
                      onBlur={(e) => handleProjectUrlBlur(index, 'url', e.target.value)}
                      type="url"
                      inputMode="url"
                      placeholder="https://myproject.com"
                      inputProps={{
                        'aria-invalid': !!fieldErrors[`projects.${index}.url`],
                        'aria-describedby': fieldErrors[`projects.${index}.url`]
                          ? `projects-${index}-url-error`
                          : undefined,
                      }}
                      error={!!fieldErrors[`projects.${index}.url`]}
                      helperText={fieldErrors[`projects.${index}.url`] || ''}
                      FormHelperTextProps={{ id: `projects-${index}-url-error` }}
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="GitHub / Source Code URL"
                      name={`projects.${index}.githubUrl`}
                      value={project.githubUrl || ''}
                      onChange={(e) => handleProjectChange(index, 'githubUrl', e.target.value)}
                      onBlur={(e) => handleProjectUrlBlur(index, 'githubUrl', e.target.value)}
                      type="url"
                      inputMode="url"
                      placeholder="https://github.com/user/project"
                      inputProps={{
                        'aria-invalid': !!fieldErrors[`projects.${index}.githubUrl`],
                        'aria-describedby': fieldErrors[`projects.${index}.githubUrl`]
                          ? `projects-${index}-githubUrl-error`
                          : undefined,
                      }}
                      error={!!fieldErrors[`projects.${index}.githubUrl`]}
                      helperText={fieldErrors[`projects.${index}.githubUrl`] || ''}
                      FormHelperTextProps={{ id: `projects-${index}-githubUrl-error` }}
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Project Image URL"
                      name={`projects.${index}.imageUrl`}
                      value={project.imageUrl || ''}
                      onChange={(e) => handleProjectChange(index, 'imageUrl', e.target.value)}
                      onBlur={(e) => handleProjectUrlBlur(index, 'imageUrl', e.target.value)}
                      type="url"
                      inputMode="url"
                      placeholder="https://example.com/project-screenshot.png"
                      inputProps={{
                        'aria-invalid': !!fieldErrors[`projects.${index}.imageUrl`],
                        'aria-describedby': fieldErrors[`projects.${index}.imageUrl`]
                          ? `projects-${index}-imageUrl-error`
                          : undefined,
                      }}
                      error={!!fieldErrors[`projects.${index}.imageUrl`]}
                      helperText={
                        fieldErrors[`projects.${index}.imageUrl`] ||
                        'Add a screenshot or preview image of your project'
                      }
                      FormHelperTextProps={{ id: `projects-${index}-imageUrl-error` }}
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="month"
                      label="Start Date"
                      value={toIsoMonth(project.startDate)}
                      onChange={(e) => handleProjectChange(index, 'startDate', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      helperText={!toIsoMonth(project.startDate) && project.startDate ? `Saved as: ${project.startDate}` : ''}
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="month"
                      label="End Date"
                      value={isPresentValue(project.endDate) ? '' : toIsoMonth(project.endDate)}
                      onChange={(e) => handleProjectChange(index, 'endDate', e.target.value)}
                      disabled={isPresentValue(project.endDate)}
                      InputLabelProps={{ shrink: true }}
                      helperText={isPresentValue(project.endDate) ? 'Currently in progress' : (!toIsoMonth(project.endDate) && project.endDate ? `Saved as: ${project.endDate}` : '')}
                      sx={darkTextFieldSx}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isPresentValue(project.endDate)}
                          onChange={(e) => handleProjectChange(index, 'endDate', e.target.checked ? 'Present' : '')}
                          size="small"
                          sx={{ color: '#9ca3af', '&.Mui-checked': { color: '#667eea' } }}
                        />
                      }
                      label={<Typography variant="caption" sx={{ color: '#6b7280' }}>Currently in progress</Typography>}
                      sx={{ ml: 0, mt: -1 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Tools & Technologies Used"
                      value={Array.isArray(project.technologies) ? project.technologies.join(', ') : (project.technologies || '')}
                      onChange={(e) => handleProjectChange(index, 'technologies', e.target.value.split(',').map(t => t.trim()).filter(t => t))}
                      placeholder="Excel, Salesforce, AutoCAD, SAP (comma separated)"
                      helperText="Separate technologies with commas"
                      sx={darkTextFieldSx}
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
            {formData.projects.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4, color: '#9ca3af' }}>
                <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                  No projects added yet. Click "Add Project" to showcase your work!
                </Typography>
              </Box>
            )}
          </Paper>

          {(() => {
            // Bottom bar is context-aware:
            //   \u2022 No unsaved changes \u2192 single \"Back to Profile\" link (Save is hidden, Cancel is meaningless).
            //   \u2022 Unsaved changes      \u2192 Cancel + Save Changes pair.
            const dirty = isFormDirty();
            return (
          <Box sx={{ 
            display: 'flex', 
            gap: 2, 
            justifyContent: 'flex-end',
            '@media (max-width: 768px)': {
              // Sticky footer on mobile so the primary action is always
              // reachable without scrolling. The top-bar Save is hidden on
              // mobile (see AIButton $mobilePrimary in styled.ts) \u2014 this
              // sticky bar is the single canonical save/exit action there.
              position: 'sticky',
              bottom: 0,
              zIndex: 20,
              marginLeft: -2,
              marginRight: -2,
              padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(8px)',
              borderTop: '1px solid #e5e7eb',
              boxShadow: '0 -8px 20px -12px rgba(15, 23, 42, 0.18)',
              flexDirection: 'row',
              gap: 2,
              width: 'auto',
              '& button': {
                flex: 1
              }
            }
          }}>
            {!dirty ? (
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/profile')}
                disabled={loading || enhancing}
                startIcon={<BackIcon />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: 16,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)'
                  }
                }}
              >
                Back to Profile
              </Button>
            ) : (
              <>
            <Button
              variant="outlined"
              size="large"
              onClick={handleCancel}
              disabled={loading || enhancing}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontSize: 16,
                fontWeight: 600,
                borderColor: '#d1d5db',
                color: '#6b7280',
                '&:hover': {
                  borderColor: '#9ca3af',
                  background: 'white'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading || enhancing}
              startIcon={!loading && <SaveIcon />}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)'
                }
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#1a1a2e' }} /> : 'Save Changes'}
            </Button>
              </>
            )}
          </Box>
            );
          })()}
        </form>

        {/* Discard changes confirmation */}
        <Dialog
          open={discardDialogOpen}
          onClose={() => setDiscardDialogOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Discard changes?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#4b5563' }}>
              You have unsaved edits to your profile. If you leave now, your changes will be lost.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setDiscardDialogOpen(false)}
              variant="outlined"
              sx={{ textTransform: 'none', borderRadius: 2, color: '#374151', borderColor: '#d1d5db' }}
            >
              Keep editing
            </Button>
            <Button
              onClick={confirmDiscard}
              variant="contained"
              color="error"
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}
            >
              Discard changes
            </Button>
          </DialogActions>
        </Dialog>

        {/* Unified delete confirmation for Experience/Project/Education */}
        <Dialog
          open={deleteConfirm.open}
          onClose={() => setDeleteConfirm({ open: false, type: '', index: -1, label: '' })}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Remove this entry?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#4b5563' }}>
              {deleteConfirm.label
                ? <>You're about to remove <strong>{deleteConfirm.label}</strong>. This can't be undone until you re-add it.</>
                : <>This entry will be removed from your profile.</>}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setDeleteConfirm({ open: false, type: '', index: -1, label: '' })}
              variant="outlined"
              sx={{ textTransform: 'none', borderRadius: 2, color: '#374151', borderColor: '#d1d5db' }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const { type, index } = deleteConfirm;
                if (type === 'experience') handleDeleteExperience(index);
                else if (type === 'project') handleDeleteProject(index);
                else if (type === 'education') handleDeleteEducation(index);
                else if (type === 'resume') handleClearResumeData();
                setDeleteConfirm({ open: false, type: '', index: -1, label: '' });
              }}
              variant="contained"
              color="error"
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}
            >
              Remove
            </Button>
          </DialogActions>
        </Dialog>

        {/* Enhance Prompt Modal with section suggestions */}
        <EnhancePromptModal
          open={showEnhancePrompt}
          onClose={() => setShowEnhancePrompt(false)}
          onEnhance={(combinedPrompt) => handleEnhanceWithAI(combinedPrompt)}
          formData={formData}
          onGoToExperience={scrollToExperience}
        />

        {/* First-time welcome onboarding */}
        <ProfileWelcomeOnboardingModal
          open={showWelcome}
          onClose={handleWelcomeClose}
          onResumeParsed={handleWelcomeResumeParsed}
          userName={user?.firstName || user?.name?.split(' ')?.[0]}
        />

        {/* Enhancement Preview Dialog */}
        <EnhancementPreviewModal
          open={showEnhancementDialog}
          onClose={() => { setShowEnhancementDialog(false); setEnhancements(null); }}
          onApply={applyEnhancements}
          enhancements={enhancements}
          originalData={formData}
          saving={loading}
        />

        {/* 5.3: Per-section enhance Old vs New diff dialog */}
        <Dialog
          open={!!enhancePreview}
          onClose={rejectEnhancePreview}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700 }}>
            Review AI enhancement
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Review the changes before they replace your {enhancePreview?.label || 'text'}.
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            {enhancePreview?.hallucinationFlags?.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                The AI may have introduced content not present in your original text. Please verify before accepting:
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {enhancePreview.hallucinationFlags.slice(0, 5).map((flag, i) => (
                    <li key={i}><Typography variant="caption">{flag.content || flag}</Typography></li>
                  ))}
                </Box>
              </Alert>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <Box>
                <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700 }}>Your text</Typography>
                <Box sx={{ mt: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: '#fafafa', whiteSpace: 'pre-wrap', fontSize: 14, maxHeight: 360, overflow: 'auto' }}>
                  {enhancePreview?.original}
                </Box>
              </Box>
              <Box>
                <Typography variant="overline" sx={{ color: '#667eea', fontWeight: 700 }}>AI suggestion</Typography>
                <Box sx={{ mt: 1, p: 2, border: '1px solid #c7d2fe', borderRadius: 1, bgcolor: '#f5f7ff', whiteSpace: 'pre-wrap', fontSize: 14, maxHeight: 360, overflow: 'auto' }}>
                  {enhancePreview?.enhanced}
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={rejectEnhancePreview}>Reject</Button>
            <Button onClick={acceptEnhancePreview} variant="contained" sx={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
              Accept &amp; replace
            </Button>
          </DialogActions>
        </Dialog>

        {/* Job Tailor Preview Dialog */}
        <Dialog 
          open={showTailorDialog} 
          onClose={() => setShowTailorDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <WorkIcon sx={{ color: '#11998e' }} />
              <Box>
                <Typography variant="h6">🎯 Job-Tailored Profile Preview</Typography>
                {tailoredProfile && (tailoredProfile.jobTitle || tailoredProfile.company) && (
                  <Typography variant="body2" color="text.secondary">
                    {tailoredProfile.jobTitle && <strong>{tailoredProfile.jobTitle}</strong>}
                    {tailoredProfile.jobTitle && tailoredProfile.company && ' at '}
                    {tailoredProfile.company && <span>{tailoredProfile.company}</span>}
                  </Typography>
                )}
              </Box>
              <Chip 
                label="Customized for Job" 
                size="small" 
                sx={{ ml: 'auto', bgcolor: '#11998e', color: 'white' }}
              />
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {tailoredProfile && (
              <Box>
                {/* Match Analysis */}
                {tailoredProfile.matchAnalysis && (
                  <Paper sx={{ p: 2, mb: 3, background: 'linear-gradient(135deg, #11998e15 0%, #38ef7d15 100%)', border: '2px solid #11998e' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Typography variant="h6" sx={{ color: '#11998e' }}>
                        Match Score: {tailoredProfile.matchAnalysis.matchScore}%
                      </Typography>
                      <Box sx={{ flex: 1, height: 10, bgcolor: 'grey.200', borderRadius: 5 }}>
                        <Box 
                          sx={{ 
                            width: `${tailoredProfile.matchAnalysis.matchScore}%`, 
                            height: '100%', 
                            bgcolor: tailoredProfile.matchAnalysis.matchScore >= 70 ? '#11998e' : tailoredProfile.matchAnalysis.matchScore >= 50 ? '#f39c12' : '#e74c3c',
                            borderRadius: 5,
                            transition: 'width 0.5s ease'
                          }} 
                        />
                      </Box>
                    </Box>
                    
                    {tailoredProfile.matchAnalysis.strongMatches?.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="success.dark">
                          ✅ Strong Matches:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {tailoredProfile.matchAnalysis.strongMatches.map((match, i) => (
                            <Chip key={i} label={match} size="small" color="success" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {tailoredProfile.matchAnalysis.partialMatches?.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="warning.dark">
                          🔶 Partial Matches:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {tailoredProfile.matchAnalysis.partialMatches.map((match, i) => (
                            <Chip key={i} label={match} size="small" color="warning" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {tailoredProfile.matchAnalysis.gaps?.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="error.dark">
                          ❌ Gaps to Address:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {tailoredProfile.matchAnalysis.gaps.map((gap, i) => (
                            <Chip key={i} label={gap} size="small" color="error" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {tailoredProfile.matchAnalysis.recommendations?.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          💡 Recommendations:
                        </Typography>
                        <List dense>
                          {tailoredProfile.matchAnalysis.recommendations.map((rec, i) => (
                            <ListItem key={i} sx={{ py: 0 }}>
                              <ListItemIcon sx={{ minWidth: 24 }}>
                                <TipIcon fontSize="small" color="primary" />
                              </ListItemIcon>
                              <ListItemText primary={rec} primaryTypographyProps={{ variant: 'body2' }} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Paper>
                )}

                {/* Tailored Title */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ color: '#11998e' }} gutterBottom fontWeight="bold">
                    Tailored Professional Title
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                          ORIGINAL
                        </Typography>
                        <Typography variant="body1">{formData.title}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 2, bgcolor: '#11998e15', border: '2px solid #11998e' }}>
                        <Typography variant="caption" sx={{ color: '#11998e' }} display="block" gutterBottom fontWeight="bold">
                          🎯 TAILORED
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">{tailoredProfile.title}</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>

                {/* Tailored Summary */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ color: '#11998e' }} gutterBottom fontWeight="bold">
                    Tailored Summary
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 2, bgcolor: 'grey.100', height: '100%' }}>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                          ORIGINAL
                        </Typography>
                        <Typography variant="body2">{formData.summary || '(No summary)'}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 2, bgcolor: '#11998e15', border: '2px solid #11998e', height: '100%' }}>
                        <Typography variant="caption" sx={{ color: '#11998e' }} display="block" gutterBottom fontWeight="bold">
                          🎯 TAILORED
                        </Typography>
                        <Typography variant="body2">{tailoredProfile.summary}</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>

                {/* Tailored Skills */}
                {tailoredProfile.skills?.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ color: '#11998e' }} gutterBottom fontWeight="bold">
                      Prioritized Skills for This Job ({tailoredProfile.skills.length})
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: '#11998e15', border: '2px solid #11998e' }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {tailoredProfile.skills.map((skill, i) => (
                          <Chip 
                            key={i} 
                            label={skill} 
                            size="small" 
                            sx={{ 
                              bgcolor: i < 5 ? '#11998e' : 'transparent',
                              color: i < 5 ? 'white' : '#11998e',
                              border: i < 5 ? 'none' : '1px solid #11998e'
                            }}
                          />
                        ))}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Top skills highlighted in green match job requirements
                      </Typography>
                    </Paper>
                  </Box>
                )}

                {/* Tailored Experience */}
                {tailoredProfile.experience?.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Box 
                      sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mb: 1 }}
                      onClick={() => toggleSection('tailoredExperience')}
                    >
                      <Typography variant="subtitle2" sx={{ color: '#11998e' }} fontWeight="bold">
                        Tailored Experience ({tailoredProfile.experience.length} entries)
                      </Typography>
                      {expandedSections.tailoredExperience ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </Box>
                    <Collapse in={expandedSections.tailoredExperience}>
                      {tailoredProfile.experience.map((exp, i) => (
                        <Paper key={i} sx={{ p: 2, mt: 1, bgcolor: '#11998e15', border: '1px solid #11998e' }}>
                          <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#11998e' }}>
                            {exp.title} at {exp.company}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateRange(exp.startDate, exp.endDate) || exp.period}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {exp.description}
                          </Typography>
                        </Paper>
                      ))}
                    </Collapse>
                  </Box>
                )}

                {/* Changelog - What was modified */}
                {tailoredProfile.changelog?.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ color: '#6366f1' }} gutterBottom fontWeight="bold">
                      📝 Changes Made
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: '#f5f3ff', border: '1px solid #6366f1' }}>
                      {tailoredProfile.changelog.map((entry, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: i < tailoredProfile.changelog.length - 1 ? 1 : 0 }}>
                          <Chip
                            label={entry.section}
                            size="small"
                            sx={{ 
                              bgcolor: entry.action === 'auto_injected' ? '#fef3c7' : '#dbeafe',
                              color: entry.action === 'auto_injected' ? '#92400e' : '#1e40af',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              minWidth: 80
                            }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {entry.detail}
                          </Typography>
                        </Box>
                      ))}
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block', fontStyle: 'italic' }}>
                        ✅ No existing skills were replaced, only additions were made.
                      </Typography>
                    </Paper>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Button onClick={() => setShowTailorDialog(false)} color="inherit">
              Cancel
            </Button>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button 
                variant="outlined" 
                onClick={saveTailoredVersion}
                disabled={savingTailoredVersion}
                startIcon={savingTailoredVersion ? <CircularProgress size={20} color="inherit" /> : <BookmarkAddIcon />}
                sx={{ borderColor: '#6366f1', color: '#6366f1' }}
              >
                {savingTailoredVersion ? 'Saving...' : 'Save as New Version'}
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => applyTailoredProfile(false)}
                startIcon={<CheckIcon />}
                sx={{ borderColor: '#11998e', color: '#11998e' }}
              >
                Apply & Review
              </Button>
              <Button 
                variant="contained" 
                onClick={() => applyTailoredProfile(true)}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                }}
              >
                {loading ? 'Saving...' : 'Apply & Save Profile'}
              </Button>
            </Box>
          </DialogActions>
        </Dialog>
      </MainContent>
      </FormContainer>
      
      {/* AI Processing Modals */}
      <AIProcessingModal 
        open={enhancing}
        onCancel={() => { enhanceAbortRef.current?.abort(); }}
        title="AI Enhancing Profile"
        subtitle="AI is analyzing your profile and generating professional insights..."
        type="enhance"
      />
      
      <AIProcessingModal 
        open={gettingSuggestions}
        onCancel={() => { suggestionsAbortRef.current?.abort(); }}
        title="AI Generating Suggestions"
        subtitle="AI is analyzing your career path and generating personalized suggestions..."
        type="suggestions"
      />
      
      {/* Out-of-credits modal, driven by the limiter's own 429 payload */}
      <LimitReachedModal
        limit={limitInfo}
        onClose={() => setLimitInfo(null)}
      />

      {/* Gap Review Dialog (Step 1 of tailoring) */}
      <GapReviewDialog
        open={showGapReview}
        onClose={() => setShowGapReview(false)}
        gaps={detectedGaps}
        satisfiedAlternatives={satisfiedAlternatives}
        onContinue={handleGapReviewContinue}
        loading={tailoring}
      />

      {/* Gap Analysis Processing Modal */}
      <AIProcessingModal 
        open={analyzingGaps}
        title="Analyzing Skill Gaps"
        subtitle="AI is comparing your profile against the job requirements..."
        type="gaps"
      />

      {/* Re-tailor Confirmation Dialog */}
      <Dialog 
        open={showRetailorConfirm} 
        onClose={() => setShowRetailorConfirm(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span>📋</span> Already Tailored
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            You already have a tailored resume for{' '}
            <strong>{existingTailorJob?.jobTitle || 'this position'}</strong>
            {existingTailorJob?.companyName ? ` at ${existingTailorJob.companyName}` : ''}.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You can keep your existing version and save your tailoring limit for another job, or tailor again with a fresh analysis.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button 
            onClick={() => setShowRetailorConfirm(false)} 
            variant="outlined"
            color="success"
          >
            Keep Existing
          </Button>
          <Button 
            onClick={proceedWithTailor} 
            variant="contained"
            sx={{ 
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              color: 'white'
            }}
          >
            Tailor Again
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save toast */}
      <Snackbar
        open={saveToast.open}
        autoHideDuration={3000}
        onClose={() => setSaveToast({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSaveToast({ open: false, message: '' })}
          sx={{ fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
        >
          {saveToast.message || 'Profile saved'}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
};

export default ProfileForm;
