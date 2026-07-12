import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { jobAPI } from '@/services/api';
import { Dialog, DialogContent, Skeleton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import SendIcon from '@mui/icons-material/Send';
import WorkIcon from '@mui/icons-material/Work';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import PublicIcon from '@mui/icons-material/Public';
import LaunchIcon from '@mui/icons-material/Launch';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DescriptionIcon from '@mui/icons-material/Description';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import LanguageIcon from '@mui/icons-material/Language';
import CategoryIcon from '@mui/icons-material/Category';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import ShareIcon from '@mui/icons-material/Share';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import IosShareIcon from '@mui/icons-material/IosShare';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import AddIcon from '@mui/icons-material/Add';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import JobDetailView from '@/components/JobDetailView';
import InlineJobAITools from '@/components/InlineJobAITools';
import AgentNegotiationModal from '@/components/AgentNegotiationModal';

// Alias icons
const TrendingIcon = TrendingUpIcon;
const CompanyIcon = BusinessIcon;
const LocationIcon = LocationOnIcon;
const BackIcon = ArrowBackIcon;

import {
  PageContainer,
  SplitContainer,
  LeftPanel,
  RightPanel,
  SidebarPanel,
  Container,
  Header,
  Title,
  Subtitle,
  SearchSection,
  SearchInputWrapper,
  SearchInput,
  SearchIconWrapper,
  SearchClearButton,
  FiltersRow,
  FilterButtonsRow,
  FilterChip,
  TabsContainer,
  Tab,
  StatsRow,
  StatCard,
  StatInfo,
  StatValue,
  StatLabel,
  JobsGrid,
  JobCard,
  JobHeader,
  JobInfo,
  JobTitle,
  CompanyName,
  Location,
  SaveButton,
  JobTags,
  Tag,
  JobFooter,
  Salary,
  PostedTime,
  MatchBadge,
  AgentButton,
  LoadingContainer,
  EmptyState,
  JobCardSkeleton,
  SkeletonBody,
  SkeletonTagRow,
  SkeletonFooter,
  SidebarCard,
  SidebarTitle,
  SkillChip,
  CompanyInfoRow,
  SimilarRoleCard,
  MobileSelectedJobCard,
  MobileJobHeader,
  MobileHeaderTitle,
  MobileHeaderActions,
  BackButton,
  MobileJobContent,
  MobileMatchCard,
  MobileMatchHeader,
  MobileMatchRing,
  MobileMatchInfo,
  MobileMatchLabel,
  MobileMatchSub,
  MobileTailorBadge,
  MobileMatchButtons,
  MobileMatchBtn,
  MobileAIToolsScroll,
  MobileAIToolCard,
  MobileStickyFooter,
  MobileFooterBookmark,
  MobileFooterApply,
  MobileFooterTailor,
  MobileCardSkills,
  MobileSkillDot,
  MobileCardActions,
  MobileCardActionLeft,
  MobileCardActionRight,
  MobileCardBtn,
  MobileCardMeta,
  MobileSectionHeader,
  MobileSectionDot,
  MobileMoreOpportunities,
  MobileMoreHeader,
  MobileMoreTitle,
  MobileViewAll,
  MobileJobsList,
  MobileJobItem,
  MobileJobIcon,
  MobileJobInfo,
  MobileJobTitle,
  MobileJobCompany,
  MobileJobMeta,
  MobileJobTime,
  ExternalJobDescriptionStyles,
  MobileDetailCompanyRow,
  MobileDetailTitle,
  MobileDetailTags,
  MobileDetailTag,
  MobileMatchCardV2,
  MobileMatchTopRow,
  MobileMatchRingV2,
  MobileMatchDetails,
  MobileGapDivider,
  MobileGapToggle,
  MobileGapList,
  MobileGapItem,
  MobileSection,
  MobileSectionTitle,
  MobileSectionBody,
  MobileReadMore,
  MobileSkillsHeader,
  MobileSkillGroup,
  MobileSkillGroupLabel,
  MobileSkillChips,
  MobileSkillChip,
  MobileBenefitsGrid,
  MobileBenefitChip,
  MobileSimilarScroll,
  MobileSimilarCard,
  MobileStickyFooterV2,
  MobileFooterToolsRow,
  MobileFooterToolBtn,
  MobileFooterActionsRow,
  MobileFooterTailorV2,
} from './styled';
import { ROUTES, WITHDRAWABLE_STATUSES, STATUS_CONFIG, THRESHOLDS, TEXT, SALARY_OPTIONS } from './constants';
import { formatSalary, formatTimeAgo, formatJobPostedTime } from './utils';
import { externalJobAPI, profileAPI } from '@/services/api';

// Company name -> domain mapping for logo resolution
const COMPANY_DOMAINS = {
  'airbnb': 'airbnb.com', 'coinbase': 'coinbase.com', 'stripe': 'stripe.com',
  'discord': 'discord.com', 'figma': 'figma.com', 'datadog': 'datadoghq.com',
  'mongodb': 'mongodb.com', 'cloudflare': 'cloudflare.com', 'twitch': 'twitch.tv',
  'pinterest': 'pinterest.com', 'lyft': 'lyft.com', 'robinhood': 'robinhood.com',
  'airtable': 'airtable.com', 'gitlab': 'gitlab.com', 'elastic': 'elastic.co',
  'databricks': 'databricks.com', 'okta': 'okta.com', 'pagerduty': 'pagerduty.com',
  'cockroachdb': 'cockroachlabs.com', 'cockroach labs': 'cockroachlabs.com',
  'brex': 'brex.com', 'verkada': 'verkada.com', 'gusto': 'gusto.com',
  'anthropic': 'anthropic.com', 'duolingo': 'duolingo.com', 'asana': 'asana.com',
  'dropbox': 'dropbox.com', 'twilio': 'twilio.com', 'spacex': 'spacex.com',
  'reddit': 'reddit.com', 'instacart': 'instacart.com', 'samsara': 'samsara.com',
  'chime': 'chime.com', 'flexport': 'flexport.com', 'coupang': 'coupang.com',
  'anduril': 'anduril.com', 'anduril industries': 'anduril.com',
  'scale ai': 'scale.com', 'scale': 'scale.com', 'plaid': 'plaid.com',
  'netflix': 'netflix.com', 'google': 'google.com', 'meta': 'meta.com',
  'apple': 'apple.com', 'amazon': 'amazon.com', 'microsoft': 'microsoft.com',
  'spotify': 'spotify.com', 'uber': 'uber.com', 'snap': 'snap.com',
  'snapchat': 'snap.com', 'doordash': 'doordash.com', 'notion': 'notion.so',
  'vercel': 'vercel.com', 'hashicorp': 'hashicorp.com', 'postman': 'postman.com',
  'openai': 'openai.com', 'deel': 'deel.com', 'ramp': 'ramp.com',
  'cohere': 'cohere.com', 'clickup': 'clickup.com', 'replit': 'replit.com',
  'perplexity': 'perplexity.ai', 'supabase': 'supabase.com', 'linear': 'linear.app',
  'clerk': 'clerk.com', 'neon': 'neon.tech', 'render': 'render.com',
  'railway': 'railway.app', 'resend': 'resend.com',
};

// Convert markdown-style plain text to HTML
const markdownToHtml = (text) => {
  if (!text) return '';
  let html = text
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold: **** or ** or __
    .replace(/\*{4}(.+?)\*{4}/g, '<strong>$1</strong>')
    .replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: * or _
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    // Headers: ## at start of line
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Normalize unicode bullet glyphs that often appear inline (e.g. "text\u2022 next")
    // by forcing them onto their own line so the list rule below picks them up.
    .replace(/\s*[\u2022\u25CF\u25E6\u2219\u00B7]\s*/g, '\n\u2022 ')
    // Bullet lists: lines starting with \u2022, - or * (at start of line)
    .replace(/^\s*[\u2022*-]\s+(.+)$/gm, '<li>$1</li>')
    // Inline dashes used as bullets (common in job descriptions): " - Item"
    .replace(/ - /g, '\n<li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>[^]*?(?:\n|$))+)/g, (match) => `<ul>${match}</ul>`)
    // Paragraphs: double newlines
    .replace(/\n{2,}/g, '</p><p>')
    // Single newlines become <br>
    .replace(/\n/g, '<br>');
  return `<p>${html}</p>`;
};

// Check if a string contains actual HTML tags (not just markdown)
const isHtml = (str) => /<\/?[a-z][\s\S]*>/i.test(str);

// Get the rendered description HTML, handles both real HTML and markdown-in-descriptionHtml
const getDescriptionHtml = (job) => {
  if (job.descriptionHtml && isHtml(job.descriptionHtml)) {
    return DOMPurify.sanitize(job.descriptionHtml);
  }
  // descriptionHtml is set but contains markdown, or only plain description exists
  return markdownToHtml(job.descriptionHtml || job.description || '');
};

const getCompanyLogoUrl = (companyName) => {
  if (!companyName) return null;
  const key = companyName.toLowerCase().trim();
  const domain = COMPANY_DOMAINS[key];
  if (domain) return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  const guess = key.replace(/[^a-z0-9]/g, '') + '.com';
  return `https://icons.duckduckgo.com/ip3/${guess}.ico`;
};

const CompanyLogo = ({ company, logoUrl: directLogoUrl, size = 48 }) => {
  const [imgError, setImgError] = React.useState(false);
  // Prefer direct logoUrl from companyInfo, fallback to Clearbit
  const logoUrl = directLogoUrl || getCompanyLogoUrl(company);
  const hue = (company || '').charCodeAt(0) * 37 % 360;

  if (!imgError && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={company}
        onError={() => setImgError(true)}
        style={{
          width: size, height: size, borderRadius: 10, objectFit: 'contain',
          border: '1px solid rgba(0,0,0,0.06)', background: 'white', flexShrink: 0,
          padding: 3
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: `hsl(${hue}, 40%, 50%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontSize: size * 0.42, fontWeight: 700,
      border: '1px solid rgba(0,0,0,0.06)'
    }}>
      {(company || 'C')[0]}
    </div>
  );
};

// Source label map
const SOURCE_LABELS = {
  greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby',
  remoteok: 'RemoteOK', adzuna: 'Adzuna', jsearch: 'Google Jobs',
  theirstack: 'TheirStack', wwr: 'WWRemotely',
  hn_hiring: 'HN: Who is Hiring'
};

const CandidateJobs = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const searchTimerRef = useRef(null);
  // External job saves now live in the polymorphic SavedJob table — see
  // backend/scripts/migrations/addExternalJobSaves.js. The previous
  // localStorage workaround has been removed; saves persist across devices.
  // Legacy: any IDs stored under the old localStorage key are migrated
  // into the backend on first mount (see useEffect below).
  const LEGACY_EXTERNAL_SAVED_KEY = 'profileai.savedExternalJobIds';

  const [savedJobs, setSavedJobs] = useState(new Set());
  // Job ids (internal + external) the user already applied to. External ids
  // come from /external-jobs/check-applied (ApplyPilot submissions +
  // extension-tracked applications); internal ids from my-applications.
  const [appliedJobs, setAppliedJobs] = useState(new Set());
  const [savingJob, setSavingJob] = useState(null);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [selectedJobForAgent, setSelectedJobForAgent] = useState(null);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchDialogJob, setMatchDialogJob] = useState(null);
  const [matchBreakdown, setMatchBreakdown] = useState(null);
  // Default to the Discover tab so candidates land on the populated external
  // job corpus instead of the (typically empty) internal recruiter postings.
  // The "All" tab only contains jobs posted directly via /api/jobs, which is
  // 0 on a fresh deployment and made the page look broken.
  const [activeTab, setActiveTab] = useState('external');
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [myApplications, setMyApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [applicationToWithdraw, setApplicationToWithdraw] = useState(null);
  const [externalJobs, setExternalJobs] = useState([]);
  const [externalJobsLoading, setExternalJobsLoading] = useState(false);
  // Separate spinner state for "Load more" so the existing list doesn't
  // disappear under the user when fetching the next page.
  const [loadingMoreExternal, setLoadingMoreExternal] = useState(false);
  const [externalJobsPagination, setExternalJobsPagination] = useState({ total: 0, page: 1, pages: 1 });
  // (The "Recommended for you" rail was removed in favor of unifying the
  // signal into the main list — fresh + relevant jobs now sort to the top
  // automatically. The /external-jobs/recommended endpoint is still
  // available on the backend for any future integration.)
  // Skill filter — typeahead dropdown state + cached corpus skills list.
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [corpusSkills, setCorpusSkills] = useState([]);
  const [corpusSkillsLoaded, setCorpusSkillsLoaded] = useState(false);
  // Corpus health probe — used by the empty state to distinguish "no jobs
  // in DB" (sync misconfigured / cron disabled) from "no matches for these
  // filters" (user filtering too aggressively). Loaded once per session.
  const [corpusTotal, setCorpusTotal] = useState(null);
  // Sort mode for the External tab list. The user-facing Sort chip was
  // removed — jobs are always ordered by the profile-aware "Recommended"
  // ranking (relevance band + latest-posted within the band). We still read
  // ?sort=recent from the URL so deep links / shared recency views keep
  // working, but there's no in-page toggle (hence no setter).
  const [sortMode] = useState(() => {
    const v = searchParams.get('sort');
    return (v === 'recent' || v === 'recommended') ? v : 'recommended';
  });
  const [filters, setFilters] = useState({
    locationType: searchParams.get('locationType') || '',
    location: searchParams.get('location') || '',
    datePosted: searchParams.get('datePosted') || '',
    experienceLevel: searchParams.get('experienceLevel') || '',
    company: searchParams.get('company') || '',
    department: searchParams.get('department') || '',
    employmentType: searchParams.get('employmentType') || '',
    salary: searchParams.get('salary') || '', // matches SALARY_OPTIONS[].value, e.g. '100k+'
    // CSV of skill tokens — backed by the GIN index on ExternalJobs.skills.
    // Sent to the API as ?skills=react,nodejs (AND semantics on server).
    skills: searchParams.get('skills') || '',
    // Boolean toggle: limit list to startups (HN postings + small / early-
    // stage companies). Sent to the API as ?startup=true.
    startup: searchParams.get('startup') === 'true'
  });
  // `filters` updates instantly so chips/dropdowns highlight on click.
  // `debouncedFilters` is what the network requests read — toggling several
  // filters in a row coalesces into a single fetch (250ms window).
  const [debouncedFilters, setDebouncedFilters] = useState(() => ({
    locationType: searchParams.get('locationType') || '',
    location: searchParams.get('location') || '',
    datePosted: searchParams.get('datePosted') || '',
    experienceLevel: searchParams.get('experienceLevel') || '',
    company: searchParams.get('company') || '',
    department: searchParams.get('department') || '',
    employmentType: searchParams.get('employmentType') || '',
    salary: searchParams.get('salary') || '',
    skills: searchParams.get('skills') || '',
    startup: searchParams.get('startup') === 'true'
  }));
  const filterTimerRef = useRef(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [locationInput, setLocationInput] = useState(searchParams.get('location') || '');
  // The Location popover's text input is a draft buffer (the committed
  // value lives on `filters.location`). If `filters.location` changes
  // through any other path — Reset, search-clear, URL deep-link,
  // profile auto-seed — we have to push that change into the draft so
  // the popover doesn't render a stale "San Francisco" after the chip
  // has already been removed.
  useEffect(() => {
    setLocationInput(prev => (prev === (filters.location || '') ? prev : (filters.location || '')));
  }, [filters.location]);
  const pinnedJobRef = useRef(null); // Job from global search to pin at top of list

  // AbortControllers for in-flight job fetches. We cancel the prior
  // request before kicking off a new one when the user types a new
  // search term, toggles a filter, or navigates away. Without this,
  // a slow earlier response can land AFTER a faster newer one and
  // overwrite the UI with stale results — and unmount setState
  // warnings if the user navigates off the page mid-fetch.
  const jobsAbortRef = useRef(null);
  const externalJobsAbortRef = useRef(null);

  // Mobile job detail states
  const [mobileDescExpanded, setMobileDescExpanded] = useState(false);
  const [mobileGapOpen, setMobileGapOpen] = useState(false);
  const [mobileGapResult, setMobileGapResult] = useState(null);
  const [mobileGapLoading, setMobileGapLoading] = useState(false);
  const [userSkills, setUserSkills] = useState([]);
  // Role auto-detected from the candidate's profile (title || headline).
  // Used to seed the search box on first visit so users see jobs in their
  // own category by default, sorted most-recent-first.
  const [detectedRole, setDetectedRole] = useState('');
  // Tracks whether we've already auto-applied the detected role to the
  // search input. Prevents us from re-filling after the user clears it.
  const roleAutoAppliedRef = useRef(false);
  // Same idea for the location filter: only auto-seed it once, never
  // re-apply if the candidate clears it (otherwise their "remote-anywhere"
  // intent is silently overridden on every render).
  const locationAutoAppliedRef = useRef(false);
  // Same one-shot guard for the experience-level filter, inferred from the
  // candidate's profile title/headline (e.g. "Senior …" → senior level).
  const experienceAutoAppliedRef = useRef(false);

  // Disclosure banner state (Fix 6.1). When the page auto-applies a role
  // or location from the candidate's profile we surface a one-line
  // "Personalized for you" banner with a [Show all jobs] escape hatch so
  // the candidate understands *why* the result set is narrower than the
  // corpus total. The state holds the *values* we seeded so we can
  // (a) detect when the user has edited them (banner self-dismisses), and
  // (b) restore the corpus view on demand.
  const [autoSeeded, setAutoSeeded] = useState({ role: null, location: null, experience: null });
  // IN-MEMORY dismissal only. Clicking "Show all jobs" stops the auto-seed
  // for the CURRENT mount (so it doesn't immediately re-apply while they
  // browse), but we deliberately do NOT persist it: every fresh page load /
  // visit re-personalizes from the candidate's profile. Earlier versions
  // persisted this in localStorage (permanent) and then sessionStorage (whole
  // tab session) — both made a single "Show all jobs" click silently turn off
  // profile pre-filling on every later reload, which is exactly the "it only
  // works once" bug. We also proactively clear any legacy persisted flags so
  // already-affected browsers recover.
  const AUTO_SEED_DISMISS_KEY = 'jobs.autoSeedDismissed';
  const autoSeedDismissedRef = useRef(false);
  // One-time cleanup of the legacy persisted flags (permanent localStorage /
  // tab-session sessionStorage) left by older builds.
  useEffect(() => {
    try { localStorage.removeItem(AUTO_SEED_DISMISS_KEY); } catch {}
    try { sessionStorage.removeItem(AUTO_SEED_DISMISS_KEY); } catch {}
  }, []);

  // First-fetch gate. Authenticated users with a clean (filter-less) URL get
  // their role/location/experience pre-seeded from their profile AFTER an
  // async getMyProfile() call. Firing the jobs fetch on mount (before seeding)
  // wastes a slow unfiltered "recommended" request and then immediately
  // re-fetches once the seeds land. We instead hold the initial fetch until
  // `seedSettled` flips true (in the profile fetch's .finally). Anonymous
  // users, deep-links (URL already has a query), and dismissed-personalization
  // users bypass the gate and fetch immediately. See the fetch effect below.
  const initialUrlHasQueryRef = useRef(
    ['search', 'location', 'locationType', 'datePosted', 'experienceLevel', 'company', 'department', 'employmentType', 'salary', 'skills', 'startup']
      .some(k => searchParams.get(k))
  );
  const [seedSettled, setSeedSettled] = useState(false);

  // Fetch user skills + role once on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    profileAPI.getMyProfile().then(res => {
      const raw = res.data?.skills || {};
      let skills = [];
      if (Array.isArray(raw)) {
        skills = raw.map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase()).filter(Boolean);
      } else if (typeof raw === 'object' && raw !== null) {
        skills = Object.values(raw).flat().map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase()).filter(Boolean);
      }
      setUserSkills(skills);
      // Pull the candidate's current role from profile.title (preferred,
      // short & specific, e.g. "Senior Frontend Engineer") or headline as
      // a fallback. Then aggressively normalize so plainto_tsquery (which
      // ANDs every token) doesn't over-restrict the candidate's discovery
      // feed:
      //   1. Strip leading seniority prefixes ("Senior", "Staff", "Lead",
      //      "Principal", "Junior", "Mid", "Associate", etc.).
      //   2. Strip noise tokens like "Full-Stack" / "Fullstack" that
      //      wedge an extra AND-constraint into the search without
      //      identifying a role family.
      //   3. Keep at most TWO tokens — the first specialty word + the
      //      last role-family word (typically "Engineer", "Developer",
      //      "Manager", "Designer", "Scientist"). Examples:
      //        "Senior Frontend Full-Stack Software Engineer"
      //          → "Frontend Engineer"
      //        "Staff Software Engineer" → "Software Engineer"
      //        "Lead Backend Developer" → "Backend Developer"
      //        "Product Manager" → "Product Manager"
      //      This keeps results fresh (more matches) while still
      //      preserving the candidate's specialty.
      const SENIORITY_PREFIX_RE = /^(?:senior|sr\.?|junior|jr\.?|staff|lead|principal|chief|head\s+of|head|entry[-\s]?level|mid[-\s]?level|associate|intern|interim)\s+/i;
      const NOISE_TOKEN_RE = /^(?:full[-\s]?stack|fullstack)$/i;
      let role = String(res.data?.title || res.data?.headline || '').trim();
      role = role.replace(SENIORITY_PREFIX_RE, '').replace(SENIORITY_PREFIX_RE, '').trim();
      const tokens = role.split(/\s+/).filter(t => t && !NOISE_TOKEN_RE.test(t));
      if (tokens.length > 2) {
        // Specialty (first) + role family (last). Drops middle filler
        // like "Software" or "Web" that would AND-narrow the search.
        role = `${tokens[0]} ${tokens[tokens.length - 1]}`;
      } else {
        role = tokens.join(' ');
      }
      role = role.slice(0, 80);
      if (role) {
        setDetectedRole(role);
        // Apply the role to the search box synchronously HERE (rather than
        // deferring to the detectedRole effect below) so the very first jobs
        // fetch already carries it. Combined with the seedSettled gate, this
        // collapses the old "unfiltered recommended fetch → re-fetch with
        // seeds" waterfall into a single, faster filtered request.
        if (
          !roleAutoAppliedRef.current &&
          !autoSeedDismissedRef.current &&
          !searchParams.get('search') &&
          !searchQuery
        ) {
          roleAutoAppliedRef.current = true;
          setSearchQuery(role);
          setDebouncedSearch(role);
          setAutoSeeded(prev => ({ ...prev, role }));
        }
      }

      // Auto-seed the LOCATION filter from the candidate's profile so the
      // first jobs page they see is geographically relevant. Only when:
      //   - No ?location / ?locationType URL param (don't override deep
      //     links / shared filters).
      //   - User has not already typed something into the location box.
      //   - We haven't already auto-applied this session (clearing the
      //     filter must stay cleared).
      // Strategy: use the first comma-separated chunk ("San Francisco, CA"
      // → "San Francisco") so the substring filter on the API still hits
      // jobs labelled "San Francisco Bay Area", "San Francisco, USA",
      // "Remote – San Francisco", etc. Country / region get dropped to
      // avoid over-restricting.
      const profileLocationRaw = String(res.data?.location || '').trim();
      if (
        profileLocationRaw &&
        !locationAutoAppliedRef.current &&
        !autoSeedDismissedRef.current &&
        !searchParams.get('location') &&
        !searchParams.get('locationType')
      ) {
        const seededLocation = profileLocationRaw.split(',')[0].trim();
        if (seededLocation) {
          locationAutoAppliedRef.current = true;
          setLocationInput(seededLocation);
          setFilters(prev => ({ ...prev, location: seededLocation }));
          setDebouncedFilters(prev => ({ ...prev, location: seededLocation }));
          setAutoSeeded(prev => ({ ...prev, location: seededLocation }));
          // eslint-disable-next-line no-console
          console.debug('[Jobs] Auto-applied profile location to filter:', seededLocation);
        }
      }

      // Auto-seed the EXPERIENCE filter from the candidate's profile title /
      // headline so the first feed matches their seniority. Same one-shot,
      // never-override rules as the location seed. We only seed a *clear*
      // signal (entry / senior / lead / executive) and deliberately skip the
      // ambiguous "mid" default — seeding mid would silently narrow the feed
      // for every untitled profile without the candidate ever asking for it.
      const profileTitleRaw = String(res.data?.title || res.data?.headline || '').toLowerCase();
      if (
        profileTitleRaw &&
        !experienceAutoAppliedRef.current &&
        !autoSeedDismissedRef.current &&
        !searchParams.get('experienceLevel')
      ) {
        let level = null;
        if (/\b(junior|jr\.?|entry|associate|intern)\b/.test(profileTitleRaw)) level = 'entry';
        else if (/\b(senior|sr\.?|staff|principal)\b/.test(profileTitleRaw)) level = 'senior';
        else if (/\b(lead|manager)\b/.test(profileTitleRaw)) level = 'lead';
        else if (/\b(director|vp|vice president|head of|chief|c-level)\b/.test(profileTitleRaw)) level = 'executive';
        if (level) {
          experienceAutoAppliedRef.current = true;
          setFilters(prev => ({ ...prev, experienceLevel: level }));
          setDebouncedFilters(prev => ({ ...prev, experienceLevel: level }));
          setAutoSeeded(prev => ({ ...prev, experience: level }));
          // eslint-disable-next-line no-console
          console.debug('[Jobs] Auto-applied profile experience to filter:', level);
        }
      }
    }).catch(() => {}).finally(() => {
      // Release the first-fetch gate once profile seeding has settled (or
      // failed). For authenticated users with a clean URL this guarantees the
      // initial fetch runs exactly once, with the seeded role/location/
      // experience already in place. See the seedSettled gate on the fetch
      // effect below.
      setSeedSettled(true);
    });
  }, [isAuthenticated]);

  // Auto-seed the search box with the detected role on first load.
  // Conditions:
  //   - User has a detected role from their profile
  //   - URL has no ?search param (we don't override deep links / shares)
  //   - searchQuery is currently empty (don't clobber what they typed)
  //   - We haven't already auto-applied (so clearing the role stays cleared)
  useEffect(() => {
    if (!detectedRole) return;
    if (roleAutoAppliedRef.current) return;
    if (autoSeedDismissedRef.current) return;
    if (searchParams.get('search')) return;
    if (searchQuery) return;
    roleAutoAppliedRef.current = true;
    setSearchQuery(detectedRole);
    setDebouncedSearch(detectedRole);
    setAutoSeeded(prev => ({ ...prev, role: detectedRole }));
    // eslint-disable-next-line no-console
    console.debug('[Jobs] Auto-applied detected role to search:', detectedRole);
  }, [detectedRole, searchParams, searchQuery]);

  // One-time migration: any external job IDs the user previously saved to
  // localStorage (before the polymorphic SavedJob backend existed) get
  // pushed up to the new endpoint, then the legacy key is cleared.
  // Failures are silent — we don't want a broken migration to block the page.
  useEffect(() => {
    if (!isAuthenticated) return;
    let raw = null;
    try { raw = localStorage.getItem(LEGACY_EXTERNAL_SAVED_KEY); } catch { return; }
    if (!raw) return;
    let ids = [];
    try { ids = JSON.parse(raw); } catch { ids = []; }
    if (!Array.isArray(ids) || ids.length === 0) {
      try { localStorage.removeItem(LEGACY_EXTERNAL_SAVED_KEY); } catch {}
      return;
    }
    Promise.allSettled(ids.map(id => externalJobAPI.save(id))).then(() => {
      try { localStorage.removeItem(LEGACY_EXTERNAL_SAVED_KEY); } catch {}
      // Reflect them locally so the bookmark icons render correctly until the
      // next external-jobs fetch hydrates from the server.
      setSavedJobs(prev => new Set([...prev, ...ids]));
    });
  }, [isAuthenticated]);

  // Reset mobile detail state when job changes & auto-fetch gaps
  useEffect(() => {
    setMobileDescExpanded(false);
    setMobileGapOpen(false);
    setMobileGapResult(null);
    setMobileGapLoading(false);
  }, [selectedJob?.id]);

  // Auto-fetch gap analysis when mobile detail opens
  useEffect(() => {
    if (selectedJob?._isExternal && isAuthenticated && !mobileGapResult && !mobileGapLoading) {
      fetchMobileGaps();
    }
  }, [selectedJob?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch gap analysis for mobile detail
  const fetchMobileGaps = useCallback(async () => {
    if (!selectedJob?._isExternal || !isAuthenticated || mobileGapResult || mobileGapLoading) return;
    try {
      setMobileGapLoading(true);
      const profileRes = await profileAPI.getMyProfile();
      const p = profileRes.data;
      const profileData = {
        title: p.title || '',
        summary: p.summary || '',
        skills: Array.isArray(p.skills) ? (typeof p.skills[0] === 'string' ? p.skills : p.skills.map(s => s.name || s)) : [],
        experience: p.experience || [],
      };
      const jobDesc = [selectedJob.title, selectedJob.description, selectedJob.requirements, ...(selectedJob.skills || [])].filter(Boolean).join('\n\n');
      const res = await profileAPI.analyzeGaps({ profileData, jobDescription: jobDesc });
      if (res.data.success) {
        setMobileGapResult({ gaps: res.data.gaps || [], satisfied: res.data.satisfiedAlternatives || [] });
      }
    } catch (err) {
      console.error('Mobile gap fetch failed:', err);
    } finally {
      setMobileGapLoading(false);
    }
  }, [selectedJob, isAuthenticated, mobileGapResult, mobileGapLoading]);

  // Fetch my applications
  const fetchMyApplications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setApplicationsLoading(true);
      const response = await jobAPI.getMyApplications();
      const apps = response.data.applications || response.data || [];
      setMyApplications(apps);
      // Feed internal job ids into the shared applied set so the Discover
      // list / detail pane can badge them too.
      setAppliedJobs(prev => {
        const s = new Set(prev);
        for (const app of apps) {
          const jid = app.jobId || app.job?.id;
          if (jid && app.status !== 'withdrawn') s.add(jid);
        }
        return s;
      });
    } catch (error) {
      console.error('Error fetching my applications:', error);
    } finally {
      setApplicationsLoading(false);
    }
  }, [isAuthenticated]);

  // Handle application withdrawal
  const handleWithdrawClick = (e, app) => {
    e.stopPropagation();
    setApplicationToWithdraw(app);
    setShowWithdrawConfirm(true);
  };

  const handleWithdrawConfirm = async () => {
    if (!applicationToWithdraw) return;
    try {
      setWithdrawingId(applicationToWithdraw.id);
      await jobAPI.withdrawApplication(applicationToWithdraw.id);
      setMyApplications(prev => prev.map(app =>
        app.id === applicationToWithdraw.id
          ? { ...app, status: 'withdrawn' }
          : app
      ));
      setShowWithdrawConfirm(false);
      setApplicationToWithdraw(null);
    } catch (error) {
      console.error('Error withdrawing application:', error);
      alert(error.response?.data?.message || 'Failed to withdraw application');
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleWithdrawCancel = () => {
    setShowWithdrawConfirm(false);
    setApplicationToWithdraw(null);
  };

  const canWithdraw = (status) => WITHDRAWABLE_STATUSES.includes(status);

  useEffect(() => {
    if (activeTab === 'applied' && myApplications.length === 0) {
      fetchMyApplications();
    }
  }, [activeTab, fetchMyApplications, myApplications.length]);

  // Sync URL params to state on direct navigation / deep links
  useEffect(() => {
    const search = searchParams.get('search') || '';
    const locationType = searchParams.get('locationType') || '';
    const location = searchParams.get('location') || '';
    const datePosted = searchParams.get('datePosted') || '';
    const experienceLevel = searchParams.get('experienceLevel') || '';
    const company = searchParams.get('company') || '';
    const department = searchParams.get('department') || '';
    const employmentType = searchParams.get('employmentType') || '';
    const salary = searchParams.get('salary') || '';
    const skills = searchParams.get('skills') || '';
    const startup = searchParams.get('startup') === 'true';
    if (search !== searchQuery) setSearchQuery(search);
    setFilters(prev => {
      const next = { locationType, location, datePosted, experienceLevel, company, department, employmentType, salary, skills, startup };
      if (JSON.stringify(prev) !== JSON.stringify(next)) return next;
      return prev;
    });
  }, [searchParams]);

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery]);

  // Single source of truth for state → URL.
  //
  // Every filter / search mutation flows back into the URL so:
  //   - hard refresh restores the exact view (URL → state effect above
  //     hydrates the same `filters` shape on mount)
  //   - copy/pasting the URL into a new tab reproduces the same results
  //   - browser back/forward replays history correctly
  //
  // We bail out when the computed querystring matches what's already in
  // the URL — that breaks the ping-pong with the URL→state effect, and
  // avoids spurious history entries when other code (e.g. clearing the
  // `externalJobId` param) calls setSearchParams.
  //
  // Uses `debouncedSearch` rather than `searchQuery` so we don't churn
  // the address bar on every keystroke.
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const owned = {
        search: debouncedSearch,
        locationType: filters.locationType,
        location: filters.location,
        datePosted: filters.datePosted,
        experienceLevel: filters.experienceLevel,
        company: filters.company,
        department: filters.department,
        employmentType: filters.employmentType,
        salary: filters.salary,
        skills: filters.skills,
        startup: filters.startup ? 'true' : '',
        // Only persist sort when it deviates from the default ('recent') so a
        // clean URL stays clean for the common case.
        sort: sortMode && sortMode !== 'recent' ? sortMode : '',
      };
      for (const [k, v] of Object.entries(owned)) {
        if (v) next.set(k, String(v));
        else next.delete(k);
      }
      if (next.toString() === new URLSearchParams(prev).toString()) return prev;
      return next;
    }, { replace: true });
    // setSearchParams is stable across renders but we depend on it for
    // exhaustive-deps; only `filters` and `debouncedSearch` actually
    // drive the URL write.
  }, [filters, debouncedSearch, setSearchParams]);

  // Debounce filter changes — toggling several chips in quick succession
  // coalesces into a single fetch. 250ms is enough to catch a "click chip A,
  // then chip B" sequence without making single-chip clicks feel laggy.
  useEffect(() => {
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => {
      setDebouncedFilters(prev => {
        // Skip identity-only updates so the fetch effect doesn't re-fire
        // when filters re-renders without a real value change.
        if (JSON.stringify(prev) === JSON.stringify(filters)) return prev;
        return filters;
      });
    }, 250);
    return () => clearTimeout(filterTimerRef.current);
  }, [filters]);

  // Fetch external jobs
  // Reads `debouncedFilters` (not `filters`) so that toggling several chips
  // in a row coalesces into a single network request. UI chips still read
  // `filters` directly so they highlight instantly.
  // When `append` is true (used by "Load more"), new jobs are concatenated
  // onto the existing list instead of replacing it.
  const fetchExternalJobs = useCallback(async (page = 1, { append = false } = {}) => {
    // Cancel any prior in-flight external-jobs request. Without this,
    // typing fast or rapidly toggling filters can race the responses
    // and overwrite the latest results with an older one.
    if (externalJobsAbortRef.current) {
      externalJobsAbortRef.current.abort();
    }
    const controller = new AbortController();
    externalJobsAbortRef.current = controller;
    try {
      // Show the inline "loading more" spinner instead of the full skeleton
      // when appending — the existing list shouldn't disappear under the user.
      if (append) setLoadingMoreExternal(true);
      else setExternalJobsLoading(true);
      const params = { page, limit: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (debouncedFilters.locationType) params.locationType = debouncedFilters.locationType;
      if (debouncedFilters.location) params.location = debouncedFilters.location;
      if (debouncedFilters.datePosted) params.datePosted = debouncedFilters.datePosted;
      if (debouncedFilters.experienceLevel) params.experienceLevel = debouncedFilters.experienceLevel;
      if (debouncedFilters.company) params.company = debouncedFilters.company;
      if (debouncedFilters.department) params.department = debouncedFilters.department;
      if (debouncedFilters.employmentType) params.employmentType = debouncedFilters.employmentType;
      if (debouncedFilters.salary) {
        const sal = SALARY_OPTIONS.find(s => s.value === debouncedFilters.salary);
        if (sal?.min != null) params.salaryMin = sal.min;
        if (sal?.max != null) params.salaryMax = sal.max;
      }
      if (debouncedFilters.skills) params.skills = debouncedFilters.skills;
      if (debouncedFilters.startup) params.startup = 'true';
      // Always send sort to the backend so the user's choice (incl. the new
      // default 'recent') is honored. Backend defaults to 'recommended' if
      // the param is missing, so we'd otherwise silently fall back.
      if (sortMode) params.sort = sortMode;
      const response = await externalJobAPI.getAll(params, { signal: controller.signal });
      let fetchedExtJobs = response.data.jobs || [];
      // Prepend pinned job from search if applicable (only on first page —
      // appended pages should never re-prepend the pinned job).
      //
      // IMPORTANT: do NOT inject the pinned job when the user has any
      // search/filter active. The pin originates from a global-search
      // deep-link, and the server has already applied the active filter
      // predicates to the rest of the list. Forcing the pinned card to
      // the top would leak a result that doesn't satisfy those filters
      // (e.g. a remote/mid-level role showing at #1 under On-site +
      // Entry-Level). The deep-linked job is still reachable via its
      // /jobs/:id detail URL.
      const hasActiveQuery = !!(
        debouncedSearch ||
        Object.values(debouncedFilters).some(v => v && v !== '')
      );
      if (!append && !hasActiveQuery) {
        const pinned = pinnedJobRef.current;
        if (pinned && pinned._isExternal) {
          fetchedExtJobs = [pinned, ...fetchedExtJobs.filter(j => j.id !== pinned.id)];
        }
      }
      if (append) {
        // De-dupe in case the same job appears across pages (rare but possible
        // when the corpus shifts between requests). Keeps the existing order.
        setExternalJobs(prev => {
          const seen = new Set(prev.map(j => j.id));
          return [...prev, ...fetchedExtJobs.filter(j => !seen.has(j.id))];
        });
      } else {
        setExternalJobs(fetchedExtJobs);
      }
      setExternalJobsPagination(response.data.pagination || { total: 0, page: 1, pages: 1 });

      // Log a compact view of params + top results so we can audit whether
      // recent-first ordering is actually holding under search/filters.
      // Lives behind console.debug so it's silent unless DevTools verbose
      // logging is enabled.
      try {
        // eslint-disable-next-line no-console
        console.debug('[Jobs] fetchExternalJobs result', {
          page,
          append,
          sort: sortMode,
          search: debouncedSearch || null,
          filters: Object.fromEntries(Object.entries(debouncedFilters).filter(([, v]) => v && v !== '')),
          total: response.data.pagination?.total,
          sortMethod: response.data.sortMethod,
          top: fetchedExtJobs.slice(0, 3).map(j => ({
            id: j.id,
            title: j.title,
            company: j.company || j.companyInfo?.name,
            postedAt: j.postedAt || j.createdAt,
          })),
        });
      } catch {}

      // Hydrate which of these external jobs the user has saved.
      // Backed by SavedJob.externalJobId (no longer localStorage).
      if (isAuthenticated && fetchedExtJobs.length > 0) {
        const ids = fetchedExtJobs.map(j => j.id);
        externalJobAPI.checkSaved(ids).then(res => {
          const savedIds = res.data.savedExternalJobIds || [];
          setSavedJobs(prev => new Set([...prev, ...savedIds]));
        }).catch(() => {});
        // And which ones they already applied to (ApplyPilot + extension).
        externalJobAPI.checkApplied(ids).then(res => {
          const appliedIds = res.data.appliedExternalJobIds || [];
          if (appliedIds.length > 0) {
            setAppliedJobs(prev => new Set([...prev, ...appliedIds]));
          }
        }).catch(() => {});
      }
    } catch (error) {
      // Axios surfaces aborted requests with code === 'ERR_CANCELED' or
      // name === 'CanceledError'. Either way, an abort is expected here
      // (user typed a new term / changed filters / left the page) and
      // should NOT be logged or flip any UI state — the newer request
      // will take it from here.
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      console.error('Error fetching external jobs:', error);
    } finally {
      // Only flip the loading flag for the controller that owns THIS
      // request. If a newer fetch has already replaced us, leave its
      // loading state alone — otherwise we'd flicker the spinner off
      // while the newer request is still in flight.
      if (externalJobsAbortRef.current === controller) {
        if (append) setLoadingMoreExternal(false);
        else setExternalJobsLoading(false);
      }
    }
  }, [debouncedSearch, debouncedFilters, isAuthenticated, sortMode]);

  useEffect(() => {
    if (activeTab !== 'external') return;
    // Hold the initial fetch only for the case where profile seeding WILL
    // change the query params (authenticated + clean URL + not dismissed).
    // Everyone else fetches immediately. Once seeding settles, seedSettled
    // flips and this effect re-runs once with the seeded params in place.
    const gateOpen =
      !isAuthenticated ||
      initialUrlHasQueryRef.current ||
      autoSeedDismissedRef.current ||
      seedSettled;
    if (gateOpen) fetchExternalJobs();
  }, [activeTab, fetchExternalJobs, isAuthenticated, seedSettled]);

  // Tracks whether the user has narrowed the list themselves; used by the
  // empty-state branch and any future surfaces that need to know "is this a
  // user-driven query".
  const hasActiveSearchOrFilter = !!(
    debouncedSearch ||
    Object.values(debouncedFilters).some(v => v && v !== '')
  );

  // Fetch jobs and saved status
  // Reads `debouncedFilters` (not `filters`) so that toggling several chips
  // in a row coalesces into a single network request. UI chips still read
  // `filters` directly so they highlight instantly.
  const fetchJobs = useCallback(async () => {
    if (jobsAbortRef.current) {
      jobsAbortRef.current.abort();
    }
    const controller = new AbortController();
    jobsAbortRef.current = controller;
    try {
      setLoading(true);
      const params = { status: 'active', limit: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (debouncedFilters.locationType) params.locationType = debouncedFilters.locationType;
      if (debouncedFilters.location) params.location = debouncedFilters.location;
      if (debouncedFilters.experienceLevel) params.experienceLevel = debouncedFilters.experienceLevel;
      if (debouncedFilters.employmentType) params.employmentType = debouncedFilters.employmentType;
      // datePosted was being silently dropped, backend at routes/jobs.js
      // supports it (day / 3days / week / 2weeks / month / 3months) but the
      // param wasn't forwarded, so the filter did nothing on the All Jobs tab.
      if (debouncedFilters.datePosted) params.datePosted = debouncedFilters.datePosted;
      if (debouncedFilters.salary) {
        const sal = SALARY_OPTIONS.find(s => s.value === debouncedFilters.salary);
        if (sal?.min != null) params.salaryMin = sal.min;
        if (sal?.max != null) params.salaryMax = sal.max;
      }
      const response = await jobAPI.getAll(params, { signal: controller.signal });
      let fetchedJobs = response.data.jobs || response.data || [];
      // Prepend pinned job from search if applicable.
      // Suppressed under any active search/filter — see the matching
      // comment in fetchExternalJobs for the rationale (don't leak a
      // deep-linked card past the active filter predicate).
      const hasActiveQuery = !!(
        debouncedSearch ||
        Object.values(debouncedFilters).some(v => v && v !== '')
      );
      const pinned = pinnedJobRef.current;
      if (!hasActiveQuery && pinned && !pinned._isExternal) {
        fetchedJobs = [pinned, ...fetchedJobs.filter(j => j.id !== pinned.id)];
      }
      setJobs(fetchedJobs);
      // Compact result log for sort/recency audit, mirrors fetchExternalJobs.
      try {
        // eslint-disable-next-line no-console
        console.debug('[Jobs] fetchJobs result', {
          search: debouncedSearch || null,
          filters: Object.fromEntries(Object.entries(debouncedFilters).filter(([, v]) => v && v !== '')),
          total: response.data.pagination?.total ?? fetchedJobs.length,
          top: fetchedJobs.slice(0, 3).map(j => ({
            id: j.id,
            title: j.title,
            company: j.company || j.recruiter?.recruiterProfile?.companyName,
            createdAt: j.createdAt,
          })),
        });
      } catch {}
      if (isAuthenticated && fetchedJobs.length > 0) {
        const jobIds = fetchedJobs.map(j => j.id);
        // Merge with any external saves already in state — these come from
        // the dedicated external-jobs check-saved endpoint (see fetchExternalJobs).
        jobAPI.checkSavedJobs(jobIds).then(savedResponse => {
          const apiIds = savedResponse.data.savedJobIds || [];
          setSavedJobs(prev => new Set([...prev, ...apiIds]));
        }).catch(() => {});
      }
    } catch (error) {
      // Aborts are expected — see fetchExternalJobs for the full rationale.
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      console.error('Error fetching jobs:', error);
    } finally {
      if (jobsAbortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, debouncedSearch, debouncedFilters]);

  useEffect(() => {
    // The Saved / Applied tabs render against the platform-jobs list
    // (cross-referenced with savedJobs / myApplications). Discover is
    // covered separately by fetchExternalJobs.
    if (activeTab === 'applied' || activeTab === 'saved') fetchJobs();
  }, [fetchJobs, activeTab]);

  useEffect(() => {
    if (activeTab === 'saved') fetchExternalJobs();
  }, [fetchExternalJobs, activeTab]);

  // Abort any in-flight job requests when the page unmounts. Prevents
  // late responses from triggering setState on a torn-down tree (which
  // logs a noisy React warning) and stops paying for HTTP work the user
  // no longer cares about.
  useEffect(() => {
    return () => {
      jobsAbortRef.current?.abort();
      externalJobsAbortRef.current?.abort();
    };
  }, []);

  // Handle externalJobId query param (from global search)
  const externalJobIdParam = searchParams.get('externalJobId');
  useEffect(() => {
    if (!externalJobIdParam) return;
    // When the deep link asks to tailor straight away (e.g. from the daily
    // job-match digest email: /jobs?externalJobId=…&tailor=1), capture the
    // flag now so we can fire the tailor action once the job is selected and
    // the InlineJobAITools panel has mounted.
    const wantTailor = searchParams.get('tailor') === '1';
    externalJobAPI.getById(externalJobIdParam).then(response => {
      const job = { ...response.data, _isExternal: true };
      pinnedJobRef.current = job;
      setSelectedJob(job);
      setActiveTab('external');
      setExternalJobs(prev => [job, ...prev.filter(j => j.id !== job.id)]);
      if (wantTailor) {
        // Give InlineJobAITools time to mount with the selected job before
        // dispatching — mirrors the 500ms delay used by the match dialog's
        // "Tailor Resume" button above.
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('trigger-tailor-resume', { detail: { jobId: job.id } }));
        }, 600);
      }
    }).catch(() => {});
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('externalJobId');
    newParams.delete('tailor');
    setSearchParams(newParams, { replace: true });
  }, [externalJobIdParam]);

  // Handle jobId query param (platform jobs from global search)
  const jobIdParam = searchParams.get('jobId');
  useEffect(() => {
    if (!jobIdParam) return;
    jobAPI.getById(jobIdParam).then(response => {
      const job = response.data;
      pinnedJobRef.current = job;
      setSelectedJob(job);
      // The dedicated 'all platform jobs' tab was removed (it was
      // effectively always empty on a fresh deployment and offered no
      // value over Discover). We still surface the deep-linked job in
      // the right-hand detail panel and prepend it to the platform-jobs
      // list so any Saved/Applied tab the user opens picks it up.
      setJobs(prev => [job, ...prev.filter(j => j.id !== job.id)]);
    }).catch(() => {});
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('jobId');
    setSearchParams(newParams, { replace: true });
  }, [jobIdParam]);

  // Auto-select first job on desktop
  useEffect(() => {
    if (!selectedJob && !pinnedJobRef.current && window.innerWidth > 1024) {
      if (activeTab === 'external' && externalJobs.length > 0) {
        // Render the right-hand detail panel immediately from the list
        // payload — the /external-jobs response already includes title,
        // company, description, requirements, skills, etc. (only the
        // heavy `descriptionHtml`, `metadata`, and `embedding` columns
        // are excluded). Waiting on a follow-up getById here was the
        // user-visible "detail loads slowly" — the panel sat empty
        // until that round-trip returned.
        //
        // We then enrich in the background to swap plain `description`
        // for the richer `descriptionHtml` once it arrives. The render
        // path tolerates both shapes (see getDescriptionHtml).
        const first = { ...externalJobs[0], _isExternal: true };
        setSelectedJob(first);
        externalJobAPI.getById(first.id).then(response => {
          // Only apply enrichment if the user hasn't navigated to a
          // different job in the meantime.
          setSelectedJob(prev => (
            prev?.id === first.id
              ? { ...response.data, _isExternal: true }
              : prev
          ));
        }).catch(() => {});
      } else if (jobs.length > 0) {
        setSelectedJob(jobs[0]);
      }
    }
  }, [jobs, externalJobs, selectedJob, activeTab]);

  // Clear stale selected job when it's no longer present in the current
  // filtered result set. Without this, narrowing filters down to zero
  // results still leaves the previously selected job's detail pane
  // rendered on the right — confusing because the list shows "No jobs
  // match your filters" while a full job description is on screen.
  // We never clear a pinned job (deep-link from global search) — that
  // one is intentionally surfaced regardless of filters.
  useEffect(() => {
    if (!selectedJob) return;
    if (pinnedJobRef.current && pinnedJobRef.current.id === selectedJob.id) return;
    // External tab: selectedJob must exist in externalJobs list.
    // Internal tabs: selectedJob must exist in jobs list.
    const list = activeTab === 'external' ? externalJobs : jobs;
    // While the list is still loading we have no signal to act on — skip.
    const isLoading = activeTab === 'external' ? externalJobsLoading : loading;
    if (isLoading) return;
    const stillPresent = list.some(j => j.id === selectedJob.id);
    if (!stillPresent) {
      setSelectedJob(null);
    }
  }, [selectedJob, jobs, externalJobs, activeTab, externalJobsLoading, loading]);


  const handleJobClick = (job) => {
    setSelectedJob(job);
    if (window.innerWidth <= 1024) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleSaveJob = async (e, jobId) => {
    e?.stopPropagation();
    if (!isAuthenticated) { navigate('/login'); return; }

    // Decide whether this id belongs to an external job. We check both the
    // currently-selected job and the externalJobs list since the click can
    // come from a card in the list or the detail pane.
    const isExternal =
      (selectedJob?.id === jobId && selectedJob?._isExternal) ||
      externalJobs.some(j => j.id === jobId);

    const wasSaved = savedJobs.has(jobId);
    // Optimistic UI update so the button responds immediately.
    setSavedJobs(prev => {
      const s = new Set(prev);
      if (wasSaved) s.delete(jobId); else s.add(jobId);
      return s;
    });
    setSavingJob(jobId);

    // ── External job: hit the dedicated /external-jobs/:id/save endpoint ──
    if (isExternal) {
      try {
        if (wasSaved) {
          await externalJobAPI.unsave(jobId);
          toast?.success?.('Removed from saved jobs');
        } else {
          await externalJobAPI.save(jobId);
          toast?.success?.('Job saved');
        }
      } catch (err) {
        // Revert optimistic update.
        setSavedJobs(prev => {
          const s = new Set(prev);
          if (wasSaved) s.add(jobId); else s.delete(jobId);
          return s;
        });
        const status = err?.response?.status;
        const msg = err?.response?.data?.message || err?.message || 'Failed to update saved job';
        console.error('Error toggling external save:', status, msg);
        toast?.error?.(msg);
      } finally {
        setSavingJob(null);
      }
      return;
    }

    // ── Platform job: hit the API as usual ──
    try {
      if (wasSaved) {
        await jobAPI.unsaveJob(jobId);
        toast?.success?.('Removed from saved jobs');
      } else {
        await jobAPI.saveJob(jobId);
        toast?.success?.('Job saved');
      }
    } catch (error) {
      // Revert optimistic update on failure.
      setSavedJobs(prev => {
        const s = new Set(prev);
        if (wasSaved) s.add(jobId); else s.delete(jobId);
        return s;
      });
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || error?.message || 'Failed to update saved job';
      console.error('Error toggling save:', status, msg, error?.response?.data);
      toast?.error?.(status === 404 ? "This job can't be saved yet." : msg);
    } finally {
      setSavingJob(null);
    }
  };

  const handleSendAgent = (e, job) => {
    e.stopPropagation();
    setSelectedJobForAgent(job);
    setAgentModalOpen(true);
  };

  const handleAgentSuccess = (negotiation) => {
    navigate(`/agent-arena/${negotiation.id}`);
  };

  const handleFilterChange = (key, value) => {
    // State change only — the centralized state→URL sync effect above
    // writes the new value into the address bar (with the boolean
    // `startup` toggle serialized as 'true' / removed when off).
    setFilters(prev => ({ ...prev, [key]: value }));
    setOpenDropdown(null);
  };

  const clearFilters = () => {
    // Reset every filter, the debounced mirror, the Location popover's
    // draft input, *and* the search query. Also flips the user back to
    // the Discover tab so a reset from Saved/Applied lands them on a
    // populated surface rather than an empty user-scoped list. The URL
    // sync effect picks all of this up and strips every owned param.
    const empty = { locationType: '', location: '', datePosted: '', experienceLevel: '', company: '', department: '', employmentType: '', salary: '', skills: '', startup: false };
    setFilters(empty);
    setDebouncedFilters(empty);
    setLocationInput('');
    setSearchQuery('');
    setDebouncedSearch('');
    setOpenDropdown(null);
    setActiveTab('external');
  };

  // Smart "broaden" for the empty state. Rather than dumping the candidate
  // back to an unfiltered corpus (which loses their role + location intent),
  // we relax the SINGLE most-restrictive filter at a time, in priority order.
  // Date is the worst offender — recent ingestion skews to a few role types,
  // so a narrow window like "past 3 days" can be genuinely empty for a given
  // specialty even though 30+ jobs exist this month. So we widen the date
  // first, then drop the startup/salary/skill/work-type narrowing, keeping
  // the candidate's role + location to the very end. Returns null when there's
  // nothing left to relax (caller falls back to "Clear all filters").
  const DATE_WIDEN_NEXT = { day: 'week', '3days': 'week', week: 'month', '2weeks': 'month', month: '3months' };
  const computeBroadenAction = () => {
    if (filters.datePosted && DATE_WIDEN_NEXT[filters.datePosted]) {
      const next = DATE_WIDEN_NEXT[filters.datePosted];
      const label = DATE_OPTIONS.find(o => o.value === next)?.label || 'a wider date range';
      return { label: `Show jobs from the ${label.replace(/^Past /, 'past ').toLowerCase()}`, apply: () => handleFilterChange('datePosted', next) };
    }
    if (filters.datePosted) {
      return { label: 'Show jobs from any date', apply: () => handleFilterChange('datePosted', '') };
    }
    if (filters.startup) {
      return { label: 'Include non-startup companies', apply: () => handleFilterChange('startup', false) };
    }
    if (filters.salary) {
      return { label: 'Remove the salary filter', apply: () => handleFilterChange('salary', '') };
    }
    if (filters.skills) {
      return { label: 'Remove the skills filter', apply: () => handleFilterChange('skills', '') };
    }
    if (filters.employmentType) {
      return { label: 'Remove the job-type filter', apply: () => handleFilterChange('employmentType', '') };
    }
    if (filters.locationType) {
      return { label: 'Include all work types', apply: () => handleFilterChange('locationType', '') };
    }
    if (filters.experienceLevel) {
      return { label: 'Include all experience levels', apply: () => handleFilterChange('experienceLevel', '') };
    }
    if (filters.location) {
      return { label: 'Search beyond ' + filters.location, apply: () => { setLocationInput(''); handleFilterChange('location', ''); } };
    }
    return null;
  };


  // True if the job was posted (or first seen by us) within the last 24 hours.
  // Drives the green ✨ NEW pill on cards. Uses the same COALESCE convention
  // as the date filter: real postedAt when available, else first-seen.
  const isFreshJob = (job) => {
    const anchor = job?.postedAt || job?.createdAt;
    if (!anchor) return false;
    const ageHours = (Date.now() - new Date(anchor).getTime()) / 36e5;
    return ageHours >= 0 && ageHours < 24;
  };

  // Skill filter helpers — `filters.skills` is a CSV like "react,nodejs".
  // Always lowercased for stable URL + server matching.
  const selectedSkills = filters.skills
    ? filters.skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : [];
  const toggleSkillFilter = (skill) => {
    const tok = String(skill).toLowerCase().trim();
    if (!tok) return;
    setFilters(prev => {
      const cur = prev.skills ? prev.skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
      const next = cur.includes(tok) ? cur.filter(s => s !== tok) : [...cur, tok];
      return { ...prev, skills: next.join(',') };
    });
  };
  const clearSkillFilters = () => {
    setFilters(prev => ({ ...prev, skills: '' }));
  };

  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Skill picker — close on outside click + lazy-load corpus skills the
  // first time the user opens it.
  const skillPickerRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (skillPickerRef.current && !skillPickerRef.current.contains(e.target)) {
        setSkillPickerOpen(false);
      }
    };
    if (skillPickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [skillPickerOpen]);

  useEffect(() => {
    if (!skillPickerOpen || corpusSkillsLoaded) return;
    externalJobAPI.getSkills('', 200).then(res => {
      setCorpusSkills(Array.isArray(res.data?.skills) ? res.data.skills : []);
      setCorpusSkillsLoaded(true);
    }).catch(() => { setCorpusSkillsLoaded(true); });
  }, [skillPickerOpen, corpusSkillsLoaded]);

  // Probe the corpus total once. Tells the empty state whether "0 jobs"
  // means the DB is empty (corpusTotal === 0) or just that the filters
  // exclude everything (corpusTotal > 0 && externalJobs.length === 0).
  useEffect(() => {
    if (corpusTotal !== null) return;
    if (activeTab !== 'external') return;
    externalJobAPI.getStats().then(res => {
      setCorpusTotal(typeof res.data?.totalJobs === 'number' ? res.data.totalJobs : 0);
    }).catch(() => { setCorpusTotal(0); });
  }, [activeTab, corpusTotal]);

  const hasActiveFilters = filters.locationType || filters.location || filters.datePosted || filters.experienceLevel || filters.company || filters.department || filters.employmentType || filters.salary || filters.skills || filters.startup;

  const DATE_OPTIONS = [
    { value: 'day', label: 'Past 24 hours', shortLabel: '24h' },
    { value: '3days', label: 'Past 3 days', shortLabel: '3d' },
    { value: 'week', label: 'Past week', shortLabel: '1w' },
    { value: '2weeks', label: 'Past 2 weeks', shortLabel: '2w' },
    { value: 'month', label: 'Past month', shortLabel: '1m' },
    { value: '3months', label: 'Past 3 months', shortLabel: '3m' },
  ];

  const EXPERIENCE_OPTIONS = [
    { value: 'entry', label: 'Entry Level' },
    { value: 'mid', label: 'Mid Level' },
    { value: 'senior', label: 'Senior Level' },
    { value: 'lead', label: 'Lead' },
    { value: 'executive', label: 'Executive' },
  ];

  const LOCATION_OPTIONS = [
    // Empty value = no work-type constraint (remote OR hybrid OR on-site).
    // Lets a candidate who is open to anything explicitly clear the filter
    // from inside the dropdown instead of hunting for the chip's ✕.
    { value: '', label: 'Flexible / Any' },
    { value: 'remote', label: 'Remote' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'onsite', label: 'On-site' },
  ];

  const EMPLOYMENT_TYPE_OPTIONS = [
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'internship', label: 'Internship' },
    { value: 'temporary', label: 'Temporary' },
  ];

  // Fetch company list for dropdown, lazy-loaded on first interaction
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [allCompanies, setAllCompanies] = useState([]);
  const companiesFetchedRef = useRef(false);
  const fetchCompaniesOnce = useCallback(() => {
    if (companiesFetchedRef.current) return;
    companiesFetchedRef.current = true;
    externalJobAPI.getCompanies().then(res => {
      const map = new Map();
      for (const c of (res.data.companies || [])) {
        const name = c.company;
        map.set(name, (map.get(name) || 0) + parseInt(c.jobCount || 0));
      }
      const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ value: name, label: `${name} (${count})` }));
      setAllCompanies(sorted);
    }).catch(() => {});
  }, []);

  const companyOptions = useMemo(() => {
    if (!companySearchQuery) return allCompanies.slice(0, 30);
    const q = companySearchQuery.toLowerCase();
    return allCompanies.filter(c => c.value.toLowerCase().includes(q)).slice(0, 30);
  }, [allCompanies, companySearchQuery]);

  // Fetch department list for dropdown, lazy-loaded on first interaction
  const [departmentSearchQuery, setDepartmentSearchQuery] = useState('');
  const [allDepartments, setAllDepartments] = useState([]);
  const departmentsFetchedRef = useRef(false);
  const fetchDepartmentsOnce = useCallback(() => {
    if (departmentsFetchedRef.current) return;
    departmentsFetchedRef.current = true;
    externalJobAPI.getDepartments().then(res => {
      const depts = (res.data.departments || []).map(d => ({
        value: d.department,
        label: `${d.department} (${d.jobCount})`
      }));
      setAllDepartments(depts);
    }).catch(() => {});
  }, []);

  const departmentOptions = useMemo(() => {
    if (!departmentSearchQuery) return allDepartments.slice(0, 30);
    const q = departmentSearchQuery.toLowerCase();
    return allDepartments.filter(d => d.value.toLowerCase().includes(q)).slice(0, 30);
  }, [allDepartments, departmentSearchQuery]);

  // Fetch location (city) list for dropdown, lazy-loaded on first interaction
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [allLocations, setAllLocations] = useState([]);
  const locationsFetchedRef = useRef(false);
  const fetchLocationsOnce = useCallback(() => {
    if (locationsFetchedRef.current) return;
    locationsFetchedRef.current = true;
    externalJobAPI.getLocations().then(res => {
      const locs = (res.data.locations || []).map(l => ({
        value: l.location,
        label: `${l.location} (${l.jobCount})`
      }));
      setAllLocations(locs);
    }).catch(() => {});
  }, []);

  const locationOptions = useMemo(() => {
    if (!locationSearchQuery) return allLocations.slice(0, 30);
    const q = locationSearchQuery.toLowerCase();
    return allLocations.filter(l => l.value.toLowerCase().includes(q)).slice(0, 30);
  }, [allLocations, locationSearchQuery]);

  // When on the Saved tab we need to merge platform + external jobs and
  // filter both by the savedJobs set. Other tabs continue to list platform
  // jobs only.
  const filteredJobs = (
    activeTab === 'saved'
      ? [
          ...jobs.map(j => ({ ...j, _isExternal: false })),
          ...externalJobs.map(j => ({ ...j, _isExternal: true })),
        ]
      : jobs
  ).filter(job => {
    if (activeTab === 'applied') return false;
    if (activeTab === 'external') return false;
    if (activeTab === 'saved' && !savedJobs.has(job.id)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matches =
        job.title?.toLowerCase().includes(query) ||
        job.company?.toLowerCase().includes(query) ||
        job.location?.toLowerCase().includes(query) ||
        job.skills?.some(skill => skill.toLowerCase().includes(query));
      if (!matches) return false;
    }
    if (filters.locationType && job.locationType !== filters.locationType) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    return STATUS_CONFIG[status] || { bg: '#F3F4F6', color: '#6B7280', label: status };
  };

  // Compute match level for card badges
  const getMatchLevel = (score) => {
    if (score >= 50) return 'high';
    if (score >= 25) return 'good';
    return null;
  };

  // Single source of truth for what the percentage on a match badge
  // means in words. The raw cosine-similarity score reads as "poor"
  // to candidates when it's 52% (in their head 90+ = good fit), even
  // though 52% pgvector similarity to their profile is actually a
  // reasonable signal. We bucket scores into named tiers and only
  // show the percentage when it's in territory where it reads as a
  // strength. Below "Possible match" we suppress the badge entirely
  // so weak signals don't drag the perceived quality of the list.
  //
  //   >=78  → "NN% · Excellent match"
  //   >=65  → "NN% · Strong match"
  //   >=50  → "Good match"           (no % — reads as middling)
  //   >=30  → "Possible match"       (no %)
  //   <30   → null                   (suppress badge)
  const formatMatchBadge = (rawScore) => {
    const pct = Math.round(rawScore || 0);
    if (pct >= 78) return { text: `${pct}% · Excellent match`, mobile: `${pct}%`, tier: 'excellent' };
    if (pct >= 65) return { text: `${pct}% · Strong match`,    mobile: `${pct}%`, tier: 'strong' };
    if (pct >= 50) return { text: 'Good match',                 mobile: 'Good',    tier: 'good' };
    if (pct >= 30) return { text: 'Possible match',             mobile: 'Maybe',   tier: 'possible' };
    return null;
  };
  // Tooltip copy reused on every match badge — spelled out once here so
  // tweaks don't drift between desktop / mobile renderings.
  const MATCH_BADGE_TITLE = 'Score blends how closely the job’s skills and description match your profile with how recently it was posted. Click to see why.';

  const getMatchColor = (score) => {
    if (score >= 70) return '#027A48';
    if (score >= 50) return '#6941C6';
    if (score >= 25) return '#B54708';
    return '#667085';
  };

  const handleMatchClick = async (e, job) => {
    e?.stopPropagation();
    setMatchDialogJob(job);
    setMatchDialogOpen(true);
    setMatchBreakdown(null);

    try {
      const profileRes = await profileAPI.getMyProfile();
      const p = profileRes.data;

      // Extract candidate skills
      const rawSkills = p.skills || [];
      let candidateSkills = [];
      if (Array.isArray(rawSkills)) {
        candidateSkills = rawSkills.map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase()).filter(Boolean);
      } else if (typeof rawSkills === 'object') {
        candidateSkills = Object.values(rawSkills).flat().map(s => (typeof s === 'string' ? s : '').toLowerCase()).filter(Boolean);
      }

      // Build job text for matching
      const jobText = [job.title || '', job.description || '', job.requirements || '', ...(Array.isArray(job.skills) ? job.skills : [])].join(' ').toLowerCase();

      // Match skills
      const matched = [];
      const unmatched = [];
      for (const skill of candidateSkills) {
        if (jobText.includes(skill)) {
          matched.push(skill);
        }
      }

      // Job required skills not in profile
      const jobSkills = Array.isArray(job.skills) ? job.skills : [];
      for (const js of jobSkills) {
        const jsLower = js.toLowerCase();
        if (!candidateSkills.some(cs => jsLower.includes(cs) || cs.includes(jsLower))) {
          unmatched.push(js);
        }
      }

      // Title match
      const profileTitle = (p.title || '').toLowerCase();
      const jobTitleLower = (job.title || '').toLowerCase();
      const profileTitleWords = profileTitle.split(/\s+/).filter(w => w.length > 2);
      const titleMatches = profileTitleWords.filter(w => jobTitleLower.includes(w));
      const titleMatchPct = profileTitleWords.length > 0 ? Math.round((titleMatches.length / profileTitleWords.length) * 100) : 0;

      // Location
      const pLoc = (p.location || '').toLowerCase();
      const jLoc = (job.location || '').toLowerCase();
      const locationType = job.locationType || '';
      let locationMatch = 'none';
      if (locationType === 'remote') locationMatch = 'remote';
      else if (pLoc && jLoc && (jLoc.includes(pLoc) || pLoc.includes(jLoc))) locationMatch = 'exact';
      else if (pLoc && jLoc) {
        const pParts = pLoc.split(/[,\s]+/).filter(Boolean);
        const jParts = jLoc.split(/[,\s]+/).filter(Boolean);
        if (pParts.some(pp => jParts.some(jp => jp.includes(pp) || pp.includes(jp)))) locationMatch = 'partial';
      }

      // Experience level, handle both startDate/endDate and period formats
      const expEntries = p.experience || [];
      let totalMonths = 0;
      for (const entry of expEntries) {
        let start = entry.startDate ? new Date(entry.startDate) : null;
        let end = entry.current ? new Date() : (entry.endDate ? new Date(entry.endDate) : null);

        // Fallback: parse "period" field (e.g. "2018 - Present", "Jan 2020 - Dec 2022")
        if (!start && entry.period) {
          const parts = entry.period.split(/\s*[-–—]\s*/);
          if (parts.length >= 1) {
            const yearMatch = parts[0].match(/(\d{4})/);
            if (yearMatch) start = new Date(yearMatch[1], 0);
          }
          if (parts.length >= 2) {
            if (/present|current|now/i.test(parts[1])) {
              end = new Date();
            } else {
              const yearMatch = parts[1].match(/(\d{4})/);
              if (yearMatch) end = new Date(yearMatch[1], 11);
            }
          }
        }

        if (start && end && !isNaN(start) && !isNaN(end)) totalMonths += Math.max(0, (end - start) / (1000 * 60 * 60 * 24 * 30));
      }
      const yearsExp = Math.round(totalMonths / 12);

      // Fall back to a locally-computed score when the server didn't return
      // a relevanceScore (e.g. job opened via direct link/detail fetch,
      // which doesn't carry the search-time ranking). Mirrors the fallback
      // used by the inline "Match Card V2" panel on the job detail view —
      // without this, the dialog showed "0%" while the panel right above it
      // showed a real score, for the same job.
      const serverScore = job.relevanceScore ? Math.round(job.relevanceScore) : 0;
      let effectiveScore = serverScore;
      if (!effectiveScore && matched.length > 0) {
        effectiveScore = Math.min(95, Math.round((matched.length / Math.max(candidateSkills.length, 1)) * 100));
      }

      setMatchBreakdown({
        matchedSkills: matched,
        missingSkills: unmatched,
        titleMatchPct,
        titleMatches,
        locationMatch,
        jobLocation: job.location,
        locationType,
        yearsExp,
        jobExpLevel: job.experienceLevel,
        effectiveScore,
      });
    } catch (err) {
      console.error('Failed to compute match breakdown:', err);
    }
  };

  // Extract company info, prefer companyInfo from API, fallback to metadata
  const getCompanyInfo = (job) => {
    if (!job) return {};
    const ci = job.companyInfo;
    if (ci) {
      return {
        size: ci.employeeCount,
        sizeRange: ci.employeeRange,
        industry: ci.industry,
        website: ci.website || (ci.domain ? `https://${ci.domain}` : null),
        funding: ci.fundingStage,
        logo: ci.logoUrl,
        headquarters: ci.headquarters,
        linkedinUrl: ci.linkedinUrl,
      };
    }
    // Fallback to job metadata for jobs not yet linked
    const m = job.metadata || {};
    return {
      size: m.company_employee_count,
      industry: m.company_industry,
      website: m.company_domain || m.employer_website,
      funding: m.company_funding_stage,
      logo: m.company_logo || m.employer_logo,
    };
  };

  // Get similar roles for sidebar
  const getSimilarJobs = useMemo(() => {
    if (!selectedJob) return [];
    const results = [];
    // First: same company, different job
    for (const j of externalJobs) {
      if (j.id !== selectedJob.id && j.company === selectedJob.company) {
        results.push(j);
        if (results.length >= 3) break;
      }
    }
    // If not enough, add others
    if (results.length < 3) {
      for (const j of externalJobs) {
        if (j.id !== selectedJob.id && j.company !== selectedJob.company) {
          results.push(j);
          if (results.length >= 3) break;
        }
      }
    }
    return results;
  }, [selectedJob, externalJobs]);

  // ── Render external job detail (shared by desktop + mobile) ──
  const renderExternalJobDetail = () => {
    if (!selectedJob?._isExternal) return null;
    const companyInfo = getCompanyInfo(selectedJob);
    return (
      <div className="job-detail-scroll">
        {/* Breadcrumb */}
        <div className="job-detail-breadcrumb">
          <div className="breadcrumb-links">
            <span>Jobs</span>
            <span className="breadcrumb-sep">›</span>
            {selectedJob.department && (
              <>
                <span>{selectedJob.department}</span>
                <span className="breadcrumb-sep">›</span>
              </>
            )}
            <span className="breadcrumb-current">{selectedJob.company}</span>
          </div>
          <div className="breadcrumb-actions">
            {selectedJob.applyUrl && (
              <button type="button" onClick={() => {
                const url = selectedJob.applyUrl;
                if (/^https?:\/\//i.test(url)) {
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              }} title="Open original listing">
                <OpenInNewIcon />
              </button>
            )}
            <button type="button" onClick={() => navigator.clipboard?.writeText(selectedJob.applyUrl || window.location.href)} title="Share">
              <ShareIcon />
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="job-detail-header">
          <div className="job-detail-hero">
            <CompanyLogo company={selectedJob.company} logoUrl={selectedJob.companyInfo?.logoUrl} size={56} />
            <div className="job-detail-hero-info">
              <h2 className="job-detail-title">{selectedJob.title}</h2>
              <div className="job-detail-company-line">
                <span className="job-detail-company-name">{selectedJob.company}</span>
                {selectedJob.location && (
                  <span className="job-detail-location">
                    &nbsp;· <LocationOnIcon /> {selectedJob.location}
                  </span>
                )}
              </div>
              <div className="job-detail-meta">
                {selectedJob.postedAt && <span>{formatTimeAgo(selectedJob.postedAt)}</span>}
                {selectedJob.department && <span>· {selectedJob.department}</span>}
                {companyInfo.industry && <span>· {companyInfo.industry}</span>}
                <span className={`job-detail-source-badge ${selectedJob.source}`}>
                  via {SOURCE_LABELS[selectedJob.source] || selectedJob.source}
                </span>
              </div>
            </div>
          </div>

          {/* Info chips */}
          <div className="job-detail-info-cards">
            {(selectedJob.salaryMin || selectedJob.salaryMax) && (
              <span className="job-detail-info-chip salary">
                <AttachMoneyIcon />
                {formatSalary(selectedJob.salaryMin, selectedJob.salaryMax, selectedJob.salaryCurrency)}
                {selectedJob.salaryPeriod ? ` / ${selectedJob.salaryPeriod}` : ''}
              </span>
            )}
            {selectedJob.employmentType && (
              <span className="job-detail-info-chip">
                <WorkOutlineIcon /> {selectedJob.employmentType}
              </span>
            )}
            {selectedJob.experienceLevel && (
              <span className="job-detail-info-chip">
                <SignalCellularAltIcon /> {selectedJob.experienceLevel}
              </span>
            )}
            {selectedJob.locationType && (
              <span className="job-detail-info-chip">
                <PublicIcon /> {selectedJob.locationType}
              </span>
            )}
            {companyInfo.sizeRange && (
              <span className="job-detail-info-chip">
                <PeopleOutlineIcon /> {companyInfo.sizeRange}
              </span>
            )}
            {companyInfo.funding && (
              <span className="job-detail-info-chip">
                <TrendingUpIcon /> {companyInfo.funding.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="job-detail-actions">
            {selectedJob.applyUrl && (
              <a href={selectedJob.applyUrl} target="_blank" rel="noopener noreferrer" className="job-detail-apply-btn">
                {appliedJobs.has(selectedJob.id) ? 'Apply Again' : 'Apply Now'} <LaunchIcon />
              </a>
            )}
            {appliedJobs.has(selectedJob.id) && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 14px',
                borderRadius: 8,
                background: '#ECFDF3',
                color: '#067647',
                fontSize: 14,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                <CheckIcon style={{ fontSize: 18 }} /> Applied
              </span>
            )}
            <button type="button"
              className="job-detail-save-btn"
              onClick={(e) => toggleSaveJob(e, selectedJob.id)}
              disabled={savingJob === selectedJob.id}
              aria-pressed={savedJobs.has(selectedJob.id)}
              style={savedJobs.has(selectedJob.id) ? { background: '#F4EBFF', borderColor: '#7C3AED', color: '#7C3AED' } : undefined}
            >
              {savedJobs.has(selectedJob.id) ? <BookmarkIcon /> : <BookmarkBorderIcon />}
              {savedJobs.has(selectedJob.id) ? 'Saved' : 'Save'}
            </button>
          </div>

          {/* AI Profile Match Card */}
          {selectedJob.similarityScore != null && selectedJob.similarityScore > 0 && (
            <div className="ai-match-card">
              <div className="ai-match-content">
                <div className="ai-match-title">
                  <AutoAwesomeIcon /> AI Profile Match
                </div>
                <div className="ai-match-desc">
                  Your profile matches this role based on your skills, experience, and career preferences.
                </div>
                <div className="ai-match-tags">
                  {selectedJob.skills?.slice(0, 3).map((s, i) => (
                    <span key={i} className="ai-match-tag">{s}</span>
                  ))}
                  {selectedJob.experienceLevel && (
                    <span className="ai-match-tag">{selectedJob.experienceLevel} Level</span>
                  )}
                </div>
              </div>
              <div className="ai-match-circle">
                <span className="match-pct">{Math.round(selectedJob.similarityScore * 100)}%</span>
              </div>
            </div>
          )}

          {/* AI Tools */}
          {isAuthenticated && (
            <div className="job-detail-ai-tools">
              <div className="job-detail-ai-header">
                <div className="job-detail-ai-icon">
                  <AutoAwesomeIcon />
                </div>
                <div>
                  <div className="job-detail-ai-title">AI Job Tools</div>
                  <div className="job-detail-ai-subtitle">Powered by ProfilleAI</div>
                </div>
              </div>
              <InlineJobAITools job={selectedJob} />
            </div>
          )}

          {/* AI Tools teaser for logged-out visitors — entice free sign-up */}
          {!isAuthenticated && (
            <div className="job-detail-ai-tools">
              <div className="job-detail-ai-header">
                <div className="job-detail-ai-icon">
                  <AutoAwesomeIcon />
                </div>
                <div>
                  <div className="job-detail-ai-title">AI Job Tools</div>
                  <div className="job-detail-ai-subtitle">Free with your ProfilleAI account</div>
                </div>
              </div>
              <div className="job-detail-ai-teaser-list">
                <div className="job-detail-ai-teaser-item">
                  <TrendingUpIcon />
                  <span><strong>See your match score</strong> for this job</span>
                </div>
                <div className="job-detail-ai-teaser-item">
                  <AutoAwesomeIcon />
                  <span><strong>Tailor your resume</strong> to this role in one click</span>
                </div>
                <div className="job-detail-ai-teaser-item">
                  <DescriptionIcon />
                  <span><strong>Generate a cover letter</strong> in seconds</span>
                </div>
                <div className="job-detail-ai-teaser-item">
                  <PsychologyIcon />
                  <span><strong>Spot skill gaps</strong> to close before applying</span>
                </div>
              </div>
              <button
                type="button"
                className="job-detail-ai-teaser-cta"
                onClick={() => navigate('/register')}
              >
                Sign up free to unlock AI tools <ArrowForwardIcon />
              </button>
              <button
                type="button"
                className="job-detail-ai-teaser-signin"
                onClick={() => navigate('/login')}
              >
                Already have an account? Sign in
              </button>
            </div>
          )}
        </div>

        <div className="job-detail-divider" />

        {/* Description */}
        <div className="job-detail-body">
          {/* About section card */}
          <div className="job-detail-section-card">
            <h3 className="job-detail-section-title">
              <span className="section-icon">🏢</span> About {selectedJob.company}
            </h3>
            <div
              className="external-job-description"
              dangerouslySetInnerHTML={{ __html: getDescriptionHtml(selectedJob) }}
            />
          </div>

          {/* Requirements card */}
          {selectedJob.requirements && (
            <div className="job-detail-section-card">
              <h3 className="job-detail-section-title sub">
                <span className="section-icon">📋</span> What you'll do
              </h3>
              <div
                className="external-job-description"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(selectedJob.requirements) }}
              />
            </div>
          )}

          {/* Skills card */}
          {selectedJob.skills?.length > 0 && (
            <div className="job-detail-section-card">
              <h3 className="job-detail-section-title sub">
                <span className="section-icon">🛠</span> Skills & Technologies
              </h3>
              <div className="job-detail-skills">
                {selectedJob.skills.map((skill, i) => (
                  <span key={i} className="job-detail-skill-tag">{skill}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Dropdown styles (reusable)
  const dropdownBtnStyle = (isActive) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
    background: isActive ? '#7C3AED' : 'white',
    color: isActive ? 'white' : '#344054',
    border: `1px solid ${isActive ? '#7C3AED' : '#D0D5DD'}`,
  });

  const dropdownMenuStyle = (align = 'left') => ({
    position: 'absolute', top: '100%', marginTop: 6,
    ...(align === 'right' ? { right: 0 } : { left: 0 }),
    background: 'white', borderRadius: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    border: '1px solid #EAECF0', zIndex: 100, minWidth: 180, padding: '4px 0',
    animation: 'fadeIn 0.15s ease'
  });

  const dropdownItemStyle = (isSelected) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '9px 16px', border: 'none', background: 'transparent',
    fontSize: 14, color: '#101828', cursor: 'pointer', textAlign: 'left',
    fontWeight: isSelected ? 600 : 400,
  });

  // Skeleton list shown while jobs are being fetched (uses MUI Skeleton for consistency).
  const JobsListSkeleton = ({ count = 6 }) => (
    <JobsGrid aria-busy="true" aria-label="Loading jobs">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i}>
          <Skeleton variant="rounded" width={44} height={44} sx={{ flexShrink: 0, borderRadius: '10px' }} animation="pulse" />
          <SkeletonBody>
            <Skeleton variant="text" width={`${55 + ((i * 7) % 30)}%`} height={18} animation="pulse" />
            <Skeleton variant="text" width="40%" height={14} animation="pulse" />
            <SkeletonTagRow>
              <Skeleton variant="rounded" width={56} height={18} sx={{ borderRadius: '999px' }} animation="pulse" />
              <Skeleton variant="rounded" width={72} height={18} sx={{ borderRadius: '999px' }} animation="pulse" />
              {i % 2 === 0 && <Skeleton variant="rounded" width={64} height={18} sx={{ borderRadius: '999px' }} animation="pulse" />}
            </SkeletonTagRow>
            <SkeletonFooter>
              <Skeleton variant="text" width={70} height={12} animation="pulse" />
              <Skeleton variant="rounded" width={60} height={22} sx={{ borderRadius: '999px' }} animation="pulse" />
            </SkeletonFooter>
          </SkeletonBody>
        </JobCardSkeleton>
      ))}
    </JobsGrid>
  );

  // Skeleton for the right pane while jobs are loading / no job selected yet.
  const JobDetailPaneSkeleton = () => (
    <div aria-busy="true" aria-label="Loading job details" style={{ padding: '28px 32px', maxWidth: 820, margin: '0 auto' }}>
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
        <Skeleton variant="text" width={44} height={18} animation="pulse" />
        <Skeleton variant="text" width={8} height={18} animation="pulse" />
        <Skeleton variant="text" width={170} height={18} animation="pulse" />
      </div>

      {/* Logo + title */}
      <div style={{ display: 'flex', gap: 18, marginBottom: 18 }}>
        <Skeleton variant="rounded" width={68} height={68} sx={{ borderRadius: '12px', flexShrink: 0 }} animation="pulse" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Skeleton variant="text" width="68%" height={34} animation="pulse" />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
            <Skeleton variant="text" width={180} height={18} animation="pulse" />
            <Skeleton variant="text" width={90} height={18} animation="pulse" />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
            <Skeleton variant="text" width={130} height={14} animation="pulse" />
            <Skeleton variant="rounded" width={90} height={20} sx={{ borderRadius: '6px' }} animation="pulse" />
          </div>
        </div>
      </div>

      {/* Meta chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        <Skeleton variant="rounded" width={96} height={36} sx={{ borderRadius: '10px' }} animation="pulse" />
        <Skeleton variant="rounded" width={88} height={36} sx={{ borderRadius: '10px' }} animation="pulse" />
        <Skeleton variant="rounded" width={100} height={36} sx={{ borderRadius: '10px' }} animation="pulse" />
        <Skeleton variant="rounded" width={96} height={36} sx={{ borderRadius: '10px' }} animation="pulse" />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Skeleton variant="rounded" width={148} height={44} sx={{ borderRadius: '10px' }} animation="pulse" />
        <Skeleton variant="rounded" width={110} height={44} sx={{ borderRadius: '10px' }} animation="pulse" />
      </div>

      {/* AI Job Tools card */}
      <div style={{ background: '#F9F5FF', border: '1px solid #E9D7FE', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: '10px' }} animation="pulse" />
          <div>
            <Skeleton variant="text" width={120} height={20} animation="pulse" />
            <Skeleton variant="text" width={140} height={14} animation="pulse" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Skeleton variant="rounded" width={150} height={40} sx={{ borderRadius: '10px' }} animation="pulse" />
          <Skeleton variant="rounded" width={150} height={40} sx={{ borderRadius: '10px' }} animation="pulse" />
          <Skeleton variant="rounded" width={150} height={40} sx={{ borderRadius: '10px' }} animation="pulse" />
        </div>
      </div>

      {/* About section */}
      <div style={{ background: 'white', border: '1px solid #EEF0F3', borderRadius: 12, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: '8px' }} animation="pulse" />
          <Skeleton variant="text" width={240} height={24} animation="pulse" />
        </div>
        <Skeleton variant="text" width="30%" height={16} animation="pulse" />
        <Skeleton variant="text" width="50%" height={20} animation="pulse" sx={{ marginBottom: '10px' }} />
        <Skeleton variant="text" width="35%" height={16} animation="pulse" />
        <Skeleton variant="text" width="25%" height={16} animation="pulse" sx={{ marginBottom: '10px' }} />
        <Skeleton variant="text" width="20%" height={20} animation="pulse" sx={{ marginTop: '10px' }} />
        <Skeleton variant="text" width="100%" height={16} animation="pulse" />
        <Skeleton variant="text" width="98%" height={16} animation="pulse" />
        <Skeleton variant="text" width="95%" height={16} animation="pulse" />
        <Skeleton variant="text" width="60%" height={16} animation="pulse" sx={{ marginBottom: '10px' }} />
        <Skeleton variant="text" width="30%" height={20} animation="pulse" sx={{ marginTop: '10px' }} />
        <Skeleton variant="text" width="100%" height={16} animation="pulse" />
        <Skeleton variant="text" width="92%" height={16} animation="pulse" />
        <Skeleton variant="text" width="88%" height={16} animation="pulse" />
      </div>
    </div>
  );

  // True while any jobs-list fetch is in progress and nothing is selected yet.
  const detailPaneLoading = !selectedJob && (loading || externalJobsLoading || applicationsLoading);

  return (
    <PageContainer>
      <SplitContainer>
        {/* ═══════ LEFT PANEL, Job List ═══════ */}
        <LeftPanel $hideOnMobile={selectedJob !== null}>
          <Container>
            <SearchSection>
              <SearchInputWrapper
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 14px',
                  border: '1.5px solid #EEF0F3',
                  borderRadius: 12,
                  background: 'white',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#C4B5FD'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(124,58,237,0.12), 0 1px 2px rgba(16,24,40,0.04)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#EEF0F3'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(16,24,40,0.04)'; }}
              >
                <SearchIcon style={{ fontSize: 20, color: '#98A2B3', flexShrink: 0 }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter jobs by title, skill, or company..."
                  aria-label="Filter jobs on this page"
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    background: 'transparent',
                    fontSize: 14,
                    color: '#101828',
                    fontFamily: 'inherit',
                    padding: 0,
                    minWidth: 0,
                  }}
                />
                {searchQuery && (
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); setSearchQuery(''); setDebouncedSearch(''); }}
                    aria-label="Clear filter"
                    style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#98A2B3', display: 'flex', alignItems: 'center', borderRadius: '50%', flexShrink: 0 }}
                  >
                    <CloseIcon style={{ fontSize: 18 }} />
                  </button>
                )}
              </SearchInputWrapper>
              {/* Auto-detected role hint — shown when we seeded the search
                  box from the user's profile. Compact one-line pill so the
                  list above the fold doesn't get pushed down. */}
              {detectedRole && searchQuery && searchQuery.trim().toLowerCase() === detectedRole.trim().toLowerCase() && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginTop: 6, padding: '4px 8px 4px 10px',
                    background: '#F5F3FF', border: '1px solid #E9D5FF',
                    borderRadius: 8, fontSize: 11.5, color: '#5B21B6',
                    fontWeight: 500, lineHeight: 1.3,
                    maxWidth: '100%',
                  }}
                >
                  <AutoAwesomeIcon style={{ fontSize: 12, flexShrink: 0 }} />
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    minWidth: 0, flex: 1,
                  }}>
                    Recent jobs for <strong>{detectedRole}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setDebouncedSearch(''); }}
                    aria-label="Clear role filter"
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      cursor: 'pointer', color: '#7C3AED', display: 'inline-flex',
                      alignItems: 'center', flexShrink: 0,
                    }}
                  >
                    <CloseIcon style={{ fontSize: 14 }} />
                  </button>
                </div>
              )}
            </SearchSection>

            {/* Tabs */}
            {isAuthenticated && (
              <TabsContainer>
                {/* The count next to each tab label is the *total* in that
                    bucket (corpus size for Discover, all saved jobs for
                    Saved, all applications for Applied) — it does NOT
                    react to the active search/filter chips. Showing the
                    filtered count here would force a second round-trip on
                    every chip toggle and would hide the population the
                    user is searching across. The filtered count is
                    displayed inline above the results list instead. */}
                <Tab $active={activeTab === 'external'} onClick={() => setActiveTab('external')} title="Total jobs available across all sources (not affected by filters)">
                  Discover <span data-count>{externalJobsPagination.total}</span>
                </Tab>
                <Tab $active={activeTab === 'saved'} onClick={() => setActiveTab('saved')} title="Jobs you've saved (total, not filtered)">
                  Saved <span data-count>{savedJobs.size}</span>
                </Tab>
                <Tab $active={activeTab === 'applied'} onClick={() => setActiveTab('applied')} title="Jobs you've applied to (total, not filtered)">
                  Applied <span data-count>{myApplications.length}</span>
                </Tab>
              </TabsContainer>
            )}


            {/* ─── Filter Dropdowns ─── */}
            {activeTab === 'external' && (
              <FiltersRow ref={dropdownRef}>
                <FilterButtonsRow>
                  {/* 🚀 Startups toggle — combines HN postings, small
                      companies (<500 employees), and early-stage funding
                      signals. Backend predicate at routes/externalJobs.js. */}
                  <FilterChip
                    $active={!!filters.startup}
                    onClick={() => handleFilterChange('startup', !filters.startup)}
                    title="Limit to startups: HN 'Who's Hiring' posts plus companies with <500 employees or early-stage funding"
                  >
                    🚀 Startups {filters.startup && '✓'}
                  </FilterChip>
                  {/* Location (city/country text search + list) */}
                  <div style={{ position: 'relative' }}>
                    <FilterChip
                      $active={!!filters.location}
                      onClick={() => {
                        const next = openDropdown === 'location' ? null : 'location';
                        setOpenDropdown(next);
                        if (next === 'location') fetchLocationsOnce();
                      }}
                    >
                      {filters.location || 'Location'} {filters.location ? <CloseIcon style={{ fontSize: 14, marginLeft: 2 }} onClick={(e) => { e.stopPropagation(); handleFilterChange('location', ''); setLocationInput(''); setLocationSearchQuery(''); }} /> : <KeyboardArrowDownIcon style={{ fontSize: 18 }} />}
                    </FilterChip>
                    {openDropdown === 'location' && (
                      <div style={{ ...dropdownMenuStyle(), minWidth: 260, maxWidth: 320 }}>
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #F2F4F7' }}>
                          <input
                            type="text"
                            placeholder="Search city, country..."
                            value={locationInput}
                            onChange={(e) => { setLocationInput(e.target.value); setLocationSearchQuery(e.target.value); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleFilterChange('location', locationInput);
                                setOpenDropdown(null);
                              }
                            }}
                            autoFocus
                            style={{
                              width: '100%', padding: '8px 10px', borderRadius: 6,
                              border: '1px solid #D0D5DD', fontSize: 13, outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
                          {allLocations.length === 0 ? (
                            <div style={{ padding: '12px 16px', fontSize: 13, color: '#667085' }}>
                              Loading locations…
                            </div>
                          ) : locationOptions.length === 0 ? (
                            <div style={{ padding: '12px 16px', fontSize: 13, color: '#667085' }}>
                              No matching locations
                            </div>
                          ) : (
                            locationOptions.map(opt => (
                              <button type="button"
                                key={opt.value}
                                style={dropdownItemStyle(filters.location === opt.value)}
                                onClick={() => {
                                  const nextVal = filters.location === opt.value ? '' : opt.value;
                                  handleFilterChange('location', nextVal);
                                  setLocationInput(nextVal);
                                  setLocationSearchQuery('');
                                  setOpenDropdown(null);
                                }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                                {filters.location === opt.value && <span>✓</span>}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Date Posted */}
                  <div style={{ position: 'relative' }}>
                    <FilterChip
                      $active={!!filters.datePosted}
                      onClick={() => setOpenDropdown(openDropdown === 'datePosted' ? null : 'datePosted')}
                    >
                      Date Posted {filters.datePosted ? `· ${DATE_OPTIONS.find(o => o.value === filters.datePosted)?.shortLabel || filters.datePosted}` : ''} <KeyboardArrowDownIcon style={{ fontSize: 18 }} />
                    </FilterChip>
                    {openDropdown === 'datePosted' && (
                      <div style={dropdownMenuStyle()}>
                        {DATE_OPTIONS.map(opt => (
                          <button type="button" key={opt.value} style={dropdownItemStyle(filters.datePosted === opt.value)} onClick={() => handleFilterChange('datePosted', filters.datePosted === opt.value ? '' : opt.value)}>
                            {opt.label} {filters.datePosted === opt.value && '✓'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sort chip removed — jobs are always ordered by the
                      profile-aware "Recommended" ranking (relevance band +
                      latest-posted within the band). sortMode stays
                      'recommended' by default; there's no user-facing toggle
                      so the candidate's latest, most-relevant jobs lead. */}

                  {/* Experience */}
                  <div style={{ position: 'relative' }}>
                    <FilterChip
                      $active={!!filters.experienceLevel}
                      onClick={() => setOpenDropdown(openDropdown === 'experienceLevel' ? null : 'experienceLevel')}
                    >
                      Experience {filters.experienceLevel ? `· ${EXPERIENCE_OPTIONS.find(o => o.value === filters.experienceLevel)?.label || filters.experienceLevel}` : ''} <KeyboardArrowDownIcon style={{ fontSize: 18 }} />
                    </FilterChip>
                    {openDropdown === 'experienceLevel' && (
                      <div style={dropdownMenuStyle()}>
                        {EXPERIENCE_OPTIONS.map(opt => (
                          <button type="button" key={opt.value} style={dropdownItemStyle(filters.experienceLevel === opt.value)} onClick={() => handleFilterChange('experienceLevel', filters.experienceLevel === opt.value ? '' : opt.value)}>
                            {opt.label} {filters.experienceLevel === opt.value && '✓'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Salary, translates to salaryMin / salaryMax on the API. */}
                  <div style={{ position: 'relative' }}>
                    <FilterChip
                      $active={!!filters.salary}
                      onClick={() => setOpenDropdown(openDropdown === 'salary' ? null : 'salary')}
                    >
                      Salary {filters.salary ? `· ${SALARY_OPTIONS.find(o => o.value === filters.salary)?.label || filters.salary}` : ''} <KeyboardArrowDownIcon style={{ fontSize: 18 }} />
                    </FilterChip>
                    {openDropdown === 'salary' && (
                      <div style={dropdownMenuStyle()}>
                        {SALARY_OPTIONS.map(opt => (
                          <button
                            type="button"
                            key={opt.value}
                            style={dropdownItemStyle(filters.salary === opt.value)}
                            onClick={() => handleFilterChange('salary', filters.salary === opt.value ? '' : opt.value)}
                          >
                            {opt.label} {filters.salary === opt.value && '✓'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {hasActiveFilters && (
                    <button type="button"
                      onClick={clearFilters}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'white', border: '1px solid #E4E7EC',
                        color: '#475467', fontSize: 12.5, fontWeight: 600,
                        cursor: 'pointer', padding: '6px 12px',
                        borderRadius: 999, minHeight: 32,
                      }}
                    >
                      <span aria-hidden="true" style={{ color: '#98A2B3' }}>✕</span> Reset
                    </button>
                  )}
                </FilterButtonsRow>
              </FiltersRow>
            )}

            {/* ─── Applied Tab ─── */}
            {activeTab === 'applied' ? (
              applicationsLoading ? (
                <JobsListSkeleton count={5} />
              ) : myApplications.length === 0 ? (
                <EmptyState>
                  <SendIcon />
                  <h3>No applications yet</h3>
                  <p>Apply to jobs to track them here</p>
                </EmptyState>
              ) : (
                <JobsGrid>
                  {myApplications.map(app => (
                    <JobCard
                      key={app.id}
                      onClick={() => app.job && handleJobClick(app.job)}
                      $selected={selectedJob?.id === app.job?.id}
                    >
                      <CompanyLogo company={app.job?.company} size={40} />
                      <JobInfo>
                        <JobTitle>{app.job?.title || 'Job'}</JobTitle>
                        <CompanyName>{app.job?.company || 'Company'}</CompanyName>
                        <JobTags>
                          <Tag>{app.job?.locationType || 'N/A'}</Tag>
                      <span style={{
                            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: getStatusBadge(app.status).bg,
                            color: getStatusBadge(app.status).color
                          }}>
                            {getStatusBadge(app.status).label}
                          </span>
                        </JobTags>
                        <JobFooter>
                          <PostedTime>
                            <AccessTimeIcon />
                            {new Date(app.createdAt).toLocaleDateString()}
                          </PostedTime>
                          {app.aiMatchScore && (
                            <MatchBadge $level={app.aiMatchScore >= 60 ? 'high' : 'good'}>
                              {app.aiMatchScore}% match
                            </MatchBadge>
                          )}
                        </JobFooter>
                        {canWithdraw(app.status) && (
                          <button type="button"
                            onClick={(e) => handleWithdrawClick(e, app)}
                            disabled={withdrawingId === app.id}
                            style={{
                              marginTop: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                              color: '#B91C1C', background: '#FEE2E2', border: 'none',
                              borderRadius: 8, cursor: withdrawingId === app.id ? 'not-allowed' : 'pointer',
                              opacity: withdrawingId === app.id ? 0.6 : 1, width: '100%'
                            }}
                          >
                            {withdrawingId === app.id ? 'Withdrawing...' : 'Withdraw'}
                          </button>
                        )}
                      </JobInfo>
                    </JobCard>
                  ))}
                </JobsGrid>
              )

            /* ─── External Jobs Tab ─── */
            ) : activeTab === 'external' ? (
              <>
                {/* Result count header. Sort dropdown removed — the page
                    always shows the best matches that were posted most
                    recently (backend 'recommended' mode = match × recency).
                    Power users can still override via ?sort= URL param. */}
                {externalJobsPagination.total > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '0 4px 10px',
                  }}>
                    <div style={{
                      fontSize: 12.5,
                      color: '#667085',
                      letterSpacing: '-0.01em',
                      fontWeight: 500,
                    }}>
                      <strong style={{ color: '#101828', fontWeight: 700 }}>
                        {externalJobsPagination.total.toLocaleString()}
                      </strong>{' '}jobs
                    </div>
                    <div
                      title="Freshest first — last hour, then last 24h, then this week, then older"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, color: '#667085', fontWeight: 500,
                      }}
                    >
                      <AccessTimeIcon style={{ fontSize: 12 }} />
                      {sortMode === 'recent'
                        ? 'Newest first'
                        : 'Freshest matches first'}
                    </div>
                  </div>
                )}
              {externalJobsLoading ? (
                <JobsListSkeleton count={6} />
              ) : externalJobs.length === 0 ? (
                // Two distinct empty states:
                //   - corpusTotal === 0  → backend has no jobs at all
                //     (sync cron disabled, fresh DB, or all sources errored)
                //   - corpusTotal > 0    → user's filters exclude everything
                // corpusTotal === null   → still loading the probe; treat as
                //                           the more user-fixable case.
                corpusTotal === 0 ? (
                  <EmptyState>
                    <PublicIcon />
                    <h3>No jobs in the index yet</h3>
                    <p>
                      We're rebuilding the job index. Check back in a few minutes,
                      or contact support if this persists.
                    </p>
                  </EmptyState>
                ) : (
                  <EmptyState>
                    <PublicIcon />
                    <h3>No jobs match your filters</h3>
                    <p>
                      {corpusTotal != null
                        ? `${corpusTotal.toLocaleString()} jobs available — try broadening your search.`
                        : 'Try removing a filter or broadening your search.'}
                    </p>
                    {(() => {
                      // Smart primary action: relax the single most-restrictive
                      // filter (date → startup → salary → … → location) so the
                      // candidate keeps their role/location intent. Falls back
                      // to "Clear all filters" when nothing is left to relax.
                      const broaden = computeBroadenAction();
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                          {broaden && (
                            <button
                              type="button"
                              onClick={broaden.apply}
                              style={{
                                padding: '8px 16px',
                                borderRadius: 8,
                                border: 'none',
                                background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
                                color: 'white',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {broaden.label}
                            </button>
                          )}
                          {hasActiveSearchOrFilter && (
                            <button
                              type="button"
                              onClick={() => {
                                clearFilters();
                                setSearchQuery('');
                                setDebouncedSearch('');
                              }}
                              style={{
                                padding: '8px 16px',
                                borderRadius: 8,
                                border: '1.5px solid #E4E7EC',
                                background: 'white',
                                color: '#475467',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Clear all filters
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </EmptyState>
                )
              ) : (
                <>
                  <JobsGrid>
                    {(() => {
                      let lastSection = null;
                      return externalJobs.map(job => {
                        const matchLevel = getMatchLevel(job.relevanceScore);
                        const jobSkillsPreview = Array.isArray(job.skills) ? job.skills : [];
                        const visibleSkills = jobSkillsPreview.slice(0, 3);
                        const remainingCount = Math.max(0, jobSkillsPreview.length - 3);
                        const pct = Math.round(job.relevanceScore || 0);

                        // Determine section group for mobile headers
                        let sectionLabel = null;
                        const currentSection = pct >= 78 ? 'strong' : pct >= 50 ? 'good' : 'other';
                        if (currentSection !== lastSection && pct > 0) {
                          lastSection = currentSection;
                          if (currentSection === 'strong') sectionLabel = { label: 'STRONG MATCHES', color: '#10B981' };
                          else if (currentSection === 'good') sectionLabel = { label: 'GOOD MATCHES', color: '#7C3AED' };
                        }

                        return (
                          <React.Fragment key={job.id}>
                            {sectionLabel && (
                              <MobileSectionHeader>
                                <MobileSectionDot $color={sectionLabel.color} />
                                {sectionLabel.label}
                              </MobileSectionHeader>
                            )}
                            <JobCard
                              onClick={async () => {
                                try {
                                  const response = await externalJobAPI.getById(job.id);
                                  // Preserve relevanceScore from the search result —
                                  // the by-id endpoint doesn't return it, but the
                                  // Match Analysis dialog (and badges) need it.
                                  setSelectedJob({
                                    ...response.data,
                                    relevanceScore: response.data.relevanceScore ?? job.relevanceScore,
                                    _isExternal: true,
                                  });
                                } catch {
                                  setSelectedJob({ ...job, _isExternal: true });
                                }
                              }}
                              $selected={selectedJob?.id === job.id}
                              $matchLevel={matchLevel}
                            >
                              <CompanyLogo company={job.company} logoUrl={job.companyInfo?.logoUrl} size={40} />
                              <JobInfo>
                                <JobTitle>{job.title}</JobTitle>
                                {/* Desktop company name */}
                                <CompanyName>{job.company}</CompanyName>
                                {/* Desktop tags */}
                                <JobTags>
                                  {/* ✓ Applied pill — user already applied via
                                      ApplyPilot or the Chrome extension. */}
                                  {appliedJobs.has(job.id) && (
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                      background: '#EFF8FF',
                                      color: '#175CD3',
                                      fontSize: 10,
                                      fontWeight: 700,
                                      letterSpacing: '0.04em',
                                      textTransform: 'uppercase',
                                    }}>
                                      ✓ Applied
                                    </span>
                                  )}
                                  {/* ✨ NEW pill for jobs <24h old. Same fresh
                                      flag drives the row-side accent. */}
                                  {isFreshJob(job) && (
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                      background: '#ECFDF3',
                                      color: '#067647',
                                      fontSize: 10,
                                      fontWeight: 700,
                                      letterSpacing: '0.04em',
                                      textTransform: 'uppercase',
                                    }}>
                                      ✨ New
                                    </span>
                                  )}
                                  {job.locationType && (
                                    <Tag $variant={job.locationType === 'remote' ? 'remote' : undefined}>
                                      {job.locationType}
                                    </Tag>
                                  )}
                                  {job.employmentType && <Tag>{job.employmentType}</Tag>}
                                  {(job.salaryMin || job.salaryMax) && (
                                    <Tag $variant="salary">
                                      {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                                    </Tag>
                                  )}
                                </JobTags>
                                {/* Matched-skills pill — surfaces WHY this job
                                    ranked. Profile skills ∩ job.skills, computed
                                    server-side per row. */}
                                {Array.isArray(job.matchedSkills) && job.matchedSkills.length > 0 && (
                                  <div style={{
                                    display: 'flex', flexWrap: 'wrap', gap: 4,
                                    marginTop: 6, alignItems: 'center',
                                    fontSize: 11, color: '#6941C6',
                                  }}>
                                    <span style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>Matches:</span>
                                    {job.matchedSkills.slice(0, 3).map(s => (
                                      <span
                                        key={`m-${s}`}
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: 999,
                                          background: '#F4EBFF',
                                          fontWeight: 500,
                                          letterSpacing: '-0.01em',
                                        }}
                                      >{s}</span>
                                    ))}
                                    {job.matchedSkills.length > 3 && (
                                      <span style={{ color: '#98A2B3', fontWeight: 500 }}>+{job.matchedSkills.length - 3} more</span>
                                    )}
                                  </div>
                                )}
                                {/* Mobile: Company · Location · Salary */}
                                <MobileCardMeta>
                                  {job.company}
                                  {job.locationType && (
                                    <><span className="meta-sep">·</span>{job.locationType}</>
                                  )}
                                  {(job.salaryMin || job.salaryMax) && (
                                    <><span className="meta-sep">·</span><span className="meta-salary">{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</span></>
                                  )}
                                </MobileCardMeta>
                                {/* Mobile skill chips */}
                                {visibleSkills.length > 0 && (
                                  <MobileCardSkills>
                                    {visibleSkills.map((s, i) => (
                                      <MobileSkillDot key={i} $matched>{s}</MobileSkillDot>
                                    ))}
                                    {remainingCount > 0 && (
                                      <MobileSkillDot>+{remainingCount} more</MobileSkillDot>
                                    )}
                                  </MobileCardSkills>
                                )}
                                {/* Desktop footer */}
                                <JobFooter>
                                  <PostedTime>
                                    <AccessTimeIcon />
                                    {formatJobPostedTime(job)}
                                  </PostedTime>
                                  {(() => {
                                    const badge = formatMatchBadge(job.relevanceScore);
                                    if (!badge) return null;
                                    return (
                                      <MatchBadge
                                        $level={matchLevel || 'default'}
                                        onClick={(e) => handleMatchClick(e, job)}
                                        style={{ cursor: 'pointer' }}
                                        title={MATCH_BADGE_TITLE}
                                      >
                                        {badge.text}
                                      </MatchBadge>
                                    );
                                  })()}
                                </JobFooter>
                                {/* Mobile match badge (positioned absolute top-right via CSS) */}
                                {(() => {
                                  const badge = formatMatchBadge(job.relevanceScore);
                                  if (!badge) return null;
                                  return (
                                    <MatchBadge
                                      $level={matchLevel || 'default'}
                                      onClick={(e) => handleMatchClick(e, job)}
                                      className="mobile-match-badge"
                                      title={MATCH_BADGE_TITLE}
                                    >
                                      {badge.mobile}
                                    </MatchBadge>
                                  );
                                })()}
                                {/* Mobile card footer: time + source | bookmark + dismiss + tailor */}
                                <MobileCardActions>
                                  <MobileCardActionLeft>
                                    <AccessTimeIcon />
                                    {formatJobPostedTime(job)}
                                    {job.source && (
                                      <><span className="meta-sep">·</span>{job.source}</>
                                    )}
                                  </MobileCardActionLeft>
                                  <MobileCardActionRight>
                                    <MobileCardBtn
                                      onClick={(e) => toggleSaveJob(e, job.id)}
                                      aria-pressed={savedJobs.has(job.id)}
                                      title={savedJobs.has(job.id) ? 'Unsave' : 'Save'}
                                    >
                                      {savedJobs.has(job.id) ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                                    </MobileCardBtn>
                                    <MobileCardBtn onClick={(e) => e.stopPropagation()}>
                                      <CloseIcon />
                                    </MobileCardBtn>
                                    <MobileCardBtn
                                      $variant="tailor"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        (async () => {
                                          try {
                                            const response = await externalJobAPI.getById(job.id);
                                            setSelectedJob({
                                              ...response.data,
                                              relevanceScore: response.data.relevanceScore ?? job.relevanceScore,
                                              _isExternal: true,
                                            });
                                          } catch {
                                            setSelectedJob({ ...job, _isExternal: true });
                                          }
                                          setTimeout(() => {
                                            window.dispatchEvent(new CustomEvent('trigger-tailor-resume'));
                                          }, 300);
                                        })();
                                      }}
                                    >
                                      <AutoAwesomeIcon style={{ fontSize: 14 }} /> Tailor
                                    </MobileCardBtn>
                                  </MobileCardActionRight>
                                </MobileCardActions>
                              </JobInfo>
                              <SaveButton
                                $saved={savedJobs.has(job.id)}
                                onClick={(e) => toggleSaveJob(e, job.id)}
                                aria-pressed={savedJobs.has(job.id)}
                                title={savedJobs.has(job.id) ? 'Unsave' : 'Save'}
                              >
                                {savedJobs.has(job.id) ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                              </SaveButton>
                            </JobCard>
                          </React.Fragment>
                        );
                      });
                    })()}
                  </JobsGrid>

                  {/* Load more — replaces the old prev/next pagination so
                      users can browse a long ranked list without losing
                      context. The visible count + total above keeps the
                      "where am I" signal that pagination used to provide. */}
                  {externalJobsPagination.page < externalJobsPagination.pages && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0 16px', marginTop: 4 }}>
                      <button type="button"
                        onClick={() => fetchExternalJobs(externalJobsPagination.page + 1, { append: true })}
                        disabled={loadingMoreExternal}
                        style={{
                          padding: '10px 22px', borderRadius: 10, border: '1.5px solid #E4E7EC',
                          fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
                          background: 'white',
                          cursor: loadingMoreExternal ? 'wait' : 'pointer',
                          transition: 'all 0.18s ease',
                          color: loadingMoreExternal ? '#98A2B3' : '#475467',
                          boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
                          minWidth: 200,
                        }}
                        onMouseOver={(e) => { if (!loadingMoreExternal) { e.currentTarget.style.borderColor = '#C4B5FD'; e.currentTarget.style.color = '#7C3AED'; } }}
                        onMouseOut={(e) => { if (!loadingMoreExternal) { e.currentTarget.style.borderColor = '#E4E7EC'; e.currentTarget.style.color = '#475467'; } }}
                      >
                        {loadingMoreExternal
                          ? 'Loading…'
                          : `Load more (${(externalJobsPagination.total - externalJobs.length).toLocaleString()} remaining)`}
                      </button>
                    </div>
                  )}
                </>
              )}
              </>

            /* ─── Regular / Saved Tab ─── */
            ) : (activeTab === 'saved' ? (loading || externalJobsLoading) : loading) ? (
              <JobsListSkeleton count={6} />
            ) : filteredJobs.length === 0 ? (
              <EmptyState>
                <WorkIcon />
                <h3>No jobs found</h3>
                <p>{activeTab === 'saved' ? 'Save jobs to see them here' : 'Try different search terms'}</p>
              </EmptyState>
            ) : (
              <JobsGrid>
                {filteredJobs.map(job => (
                  <JobCard
                    key={job.id}
                    onClick={() => handleJobClick(job)}
                    $selected={selectedJob?.id === job.id}
                  >
                    <CompanyLogo company={job.company} logoUrl={job.companyInfo?.logoUrl} size={40} />
                    <JobInfo>
                      <JobTitle>{job.title}</JobTitle>
                      <CompanyName>{job.company}</CompanyName>
                      <JobTags>
                        {job.locationType && <Tag>{job.locationType}</Tag>}
                      </JobTags>
                      <JobFooter>
                        <PostedTime>
                          <AccessTimeIcon />
                          {formatJobPostedTime(job)}
                        </PostedTime>
                      </JobFooter>
                    </JobInfo>
                    <SaveButton $saved={savedJobs.has(job.id)} onClick={(e) => toggleSaveJob(e, job.id)}>
                      {savedJobs.has(job.id) ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                    </SaveButton>
                  </JobCard>
                ))}
              </JobsGrid>
            )}
          </Container>
        </LeftPanel>

        {/* ═══════ CENTER PANEL, Job Detail ═══════ */}
        <RightPanel>
          <ExternalJobDescriptionStyles>
            {detailPaneLoading ? (
              <JobDetailPaneSkeleton />
            ) : selectedJob?._isExternal ? (
              renderExternalJobDetail()
            ) : selectedJob ? (
              <JobDetailView job={selectedJob} />
            ) : (
              <div className="job-detail-empty">
                <WorkOutlineIcon />
                <p className="empty-title">Select a job to view details</p>
                <p className="empty-subtitle">Click on any job from the list</p>
              </div>
            )}
          </ExternalJobDescriptionStyles>
        </RightPanel>

        {/* ═══════ RIGHT SIDEBAR ═══════ */}
        {selectedJob?._isExternal && (
          <SidebarPanel>
            {/* Required Skills */}
            {selectedJob.skills?.length > 0 && (
              <SidebarCard>
                <SidebarTitle>Required Skills</SidebarTitle>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedJob.skills.map((skill, i) => (
                    <SkillChip key={i}>{skill}</SkillChip>
                  ))}
                </div>
              </SidebarCard>
            )}

            {/* Company Overview */}
            <SidebarCard>
              <SidebarTitle>Company Overview</SidebarTitle>
              {(() => {
                const info = getCompanyInfo(selectedJob);
                return (
                  <>
                    {info.size && (
                      <CompanyInfoRow>
                        <div className="icon-circle"><PeopleOutlineIcon /></div>
                        <div className="info-content">
                          <div className="info-label">Size</div>
                          <div className="info-value">{info.sizeRange || `${info.size.toLocaleString()} employees`}</div>
                        </div>
                      </CompanyInfoRow>
                    )}
                    {info.industry && (
                      <CompanyInfoRow>
                        <div className="icon-circle"><CategoryIcon /></div>
                        <div className="info-content">
                          <div className="info-label">Industry</div>
                          <div className="info-value">{info.industry}</div>
                        </div>
                      </CompanyInfoRow>
                    )}
                    {info.headquarters && (
                      <CompanyInfoRow>
                        <div className="icon-circle"><LocationOnIcon /></div>
                        <div className="info-content">
                          <div className="info-label">Headquarters</div>
                          <div className="info-value">{info.headquarters}</div>
                        </div>
                      </CompanyInfoRow>
                    )}
                    {info.website && (
                      <CompanyInfoRow>
                        <div className="icon-circle"><LanguageIcon /></div>
                        <div className="info-content">
                          <div className="info-label">Website</div>
                          <a href={info.website.startsWith('http') ? info.website : `https://${info.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer">
                            {info.website.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      </CompanyInfoRow>
                    )}
                    {info.funding && (
                      <CompanyInfoRow>
                        <div className="icon-circle"><TrendingUpIcon /></div>
                        <div className="info-content">
                          <div className="info-label">Funding</div>
                          <div className="info-value">{info.funding.replace(/_/g, ' ')}</div>
                        </div>
                      </CompanyInfoRow>
                    )}
                    {info.linkedinUrl && (
                      <CompanyInfoRow>
                        <div className="icon-circle" style={{ background: '#0A66C2' }}><LanguageIcon /></div>
                        <div className="info-content">
                          <div className="info-label">LinkedIn</div>
                          <a href={info.linkedinUrl} target="_blank" rel="noopener noreferrer">View Profile</a>
                        </div>
                      </CompanyInfoRow>
                    )}
                    {!info.size && !info.industry && !info.website && !info.funding && !info.headquarters && (
                      <div style={{ color: '#98A2B3', fontSize: 13, padding: '8px 0' }}>
                        No additional company info available
                      </div>
                    )}
                  </>
                );
              })()}
            </SidebarCard>

            {/* Similar Roles */}
            {getSimilarJobs.length > 0 && (
              <SidebarCard>
                <SidebarTitle>Similar Roles</SidebarTitle>
                {getSimilarJobs.map(job => (
                  <SimilarRoleCard
                    key={job.id}
                    onClick={async () => {
                      try {
                        const response = await externalJobAPI.getById(job.id);
                        setSelectedJob({
                          ...response.data,
                          relevanceScore: response.data.relevanceScore ?? job.relevanceScore,
                          _isExternal: true,
                        });
                      } catch {
                        setSelectedJob({ ...job, _isExternal: true });
                      }
                    }}
                  >
                    <div className="similar-title">{job.title}</div>
                    <div className="similar-meta">
                      {job.company}
                      {job.location ? ` · ${job.location}` : ''}
                    </div>
                  </SimilarRoleCard>
                ))}
              </SidebarCard>
            )}
          </SidebarPanel>
        )}
      </SplitContainer>

      {/* Mobile Selected Job - Full Screen */}
      <MobileSelectedJobCard $show={selectedJob !== null}>
        <MobileJobHeader>
          <BackButton onClick={() => setSelectedJob(null)}>
            <BackIcon />
          </BackButton>
          <MobileHeaderTitle>Job details</MobileHeaderTitle>
        </MobileJobHeader>

        <MobileJobContent>
          {/* Company Row */}
          {selectedJob && (
            <MobileDetailCompanyRow>
              <CompanyLogo company={selectedJob.company} logoUrl={selectedJob.companyInfo?.logoUrl} size={44} />
              <div className="company-info">
                <div className="company-name">{selectedJob.company}</div>
                <div className="company-meta">
                  <LocationOnIcon />
                  {selectedJob.location || 'Remote'}
                  {selectedJob.postedAt && ` · ${formatTimeAgo(selectedJob.postedAt)}`}
                </div>
              </div>
            </MobileDetailCompanyRow>
          )}

          {/* Job Title */}
          {selectedJob && <MobileDetailTitle>{selectedJob.title}</MobileDetailTitle>}

          {/* Tags */}
          {selectedJob && (
            <MobileDetailTags>
              {(selectedJob.salaryMin || selectedJob.salaryMax) && (
                <MobileDetailTag $salary>
                  + {formatSalary(selectedJob.salaryMin, selectedJob.salaryMax, selectedJob.salaryCurrency)}
                </MobileDetailTag>
              )}
              {selectedJob.employmentType && <MobileDetailTag>{selectedJob.employmentType}</MobileDetailTag>}
              {selectedJob.experienceLevel && <MobileDetailTag>{selectedJob.experienceLevel}</MobileDetailTag>}
              {selectedJob.locationType && <MobileDetailTag>{selectedJob.locationType}</MobileDetailTag>}
              {selectedJob.source && (
                <MobileDetailTag $source>
                  via {SOURCE_LABELS[selectedJob.source] || selectedJob.source}
                </MobileDetailTag>
              )}
            </MobileDetailTags>
          )}

          {/* Match Card V2 */}
          {selectedJob?._isExternal && isAuthenticated && userSkills.length > 0 && (() => {
            const serverScore = selectedJob.relevanceScore ? Math.round(selectedJob.relevanceScore) : 0;
            // Compute local score if no server score
            let score = serverScore;
            const jobSkills = selectedJob.skills || [];
            const jobText = [selectedJob.title || '', selectedJob.description || '', selectedJob.requirements || '', ...jobSkills].join(' ').toLowerCase();
            const localMatched = userSkills.filter(us => jobText.includes(us));
            if (!score && localMatched.length > 0) {
              score = Math.min(95, Math.round((localMatched.length / Math.max(userSkills.length, 1)) * 100));
            }
            if (score <= 0) return null;
            const tailoredScore = Math.min(99, score + Math.round((100 - score) * 0.6));
            const localMissing = jobSkills.filter(s => !userSkills.some(us => us.includes(s.toLowerCase()) || s.toLowerCase().includes(us)));
            const localMatchedSkills = jobSkills.length - localMissing.length;
            return (
              <MobileMatchCardV2>
                <MobileMatchTopRow>
                  <MobileMatchRingV2>
                    <svg viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="36" cy="36" r="30" fill="none" stroke="#EAECF0" strokeWidth="6" />
                      <circle
                        cx="36" cy="36" r="30" fill="none"
                        stroke={score >= 70 ? '#7C3AED' : '#F59E0B'}
                        strokeWidth="6"
                        strokeDasharray={`${(score / 100) * 188.5} 188.5`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 800, color: '#101828'
                    }}>
                      {score}%
                    </span>
                  </MobileMatchRingV2>
                  <MobileMatchDetails>
                    <div className="match-title-row">
                      <span className="match-label">{score >= 70 ? 'Strong match' : 'Good match'}</span>
                      <span className="tailor-badge">→ {tailoredScore}% if tailored</span>
                    </div>
                    <div className="match-sub">
                      {localMissing.length > 0
                        ? <>{localMissing.length} skill{localMissing.length !== 1 ? 's' : ''} missing, {Math.max(localMissing.length, localMatchedSkills)} bullet{Math.max(localMissing.length, localMatchedSkills) !== 1 ? 's' : ''} to sharpen. Tap <strong>Tailor first</strong> below.</>
                        : <>Based on your skills, experience, and preferences.</>
                      }
                    </div>
                  </MobileMatchDetails>
                </MobileMatchTopRow>

                {/* Expandable gap section */}
                <MobileGapDivider />
                <MobileGapToggle
                  data-open={mobileGapOpen}
                  onClick={() => {
                    if (!mobileGapResult && !mobileGapLoading) fetchMobileGaps();
                    setMobileGapOpen(!mobileGapOpen);
                  }}
                >
                  See your gap
                  <KeyboardArrowDownIcon />
                </MobileGapToggle>
                <MobileGapList $open={mobileGapOpen}>
                  {mobileGapLoading && <div style={{ fontSize: 13, color: '#667085', padding: '8px 0' }}>Loading gap analysis...</div>}
                  {mobileGapResult && (
                    <>
                      {mobileGapResult.satisfied?.map((item, i) => (
                        <MobileGapItem key={`s-${i}`} $met>
                          <span className="gap-dot" />
                          <span style={{ flex: 1 }}>{typeof item === 'string' ? item : item.skill || item.requirement}</span>
                        </MobileGapItem>
                      ))}
                      {mobileGapResult.gaps.map((gap, i) => (
                        <MobileGapItem key={`g-${i}`}>
                          <span className="gap-dot" />
                          <span style={{ flex: 1 }}>{gap.skill || gap.requirement}</span>
                          <span className="gap-badge">MISSING</span>
                        </MobileGapItem>
                      ))}
                    </>
                  )}
                </MobileGapList>
              </MobileMatchCardV2>
            );
          })()}

          {/* About the Role */}
          {selectedJob?._isExternal && selectedJob.description && (
            <MobileSection>
              <MobileSectionTitle>About the role</MobileSectionTitle>
              <MobileSectionBody $collapsed={!mobileDescExpanded}>
                <div className="external-job-description" dangerouslySetInnerHTML={{ __html: getDescriptionHtml(selectedJob) }} />
              </MobileSectionBody>
              <MobileReadMore onClick={() => setMobileDescExpanded(!mobileDescExpanded)}>
                {mobileDescExpanded ? 'Show less' : 'Read more'}
              </MobileReadMore>
            </MobileSection>
          )}

          {/* Skills for this Role */}
          {selectedJob?._isExternal && (() => {
            const jobSkills = selectedJob.skills || [];
            if (jobSkills.length === 0) return null;

            const matched = [];
            const missing = [];
            for (const skill of jobSkills) {
              const sl = skill.toLowerCase();
              const isMatched = userSkills.some(us => sl.includes(us) || us.includes(sl));
              if (isMatched) matched.push(skill);
              else missing.push(skill);
            }
            const total = jobSkills.length;
            return (
              <MobileSection>
                <MobileSkillsHeader>
                  <MobileSectionTitle style={{ marginBottom: 0 }}>Skills for this role</MobileSectionTitle>
                  <span className="skills-count">{missing.length} missing of {total}</span>
                </MobileSkillsHeader>

                {missing.length > 0 && (
                  <MobileSkillGroup>
                    <MobileSkillGroupLabel $missing>
                      <span className="group-dot" />
                      Add to boost match
                      <span className="group-count">· {missing.length}</span>
                    </MobileSkillGroupLabel>
                    <MobileSkillChips>
                      {missing.map((skill, i) => (
                        <MobileSkillChip key={`miss-${i}`} $missing>+ {skill}</MobileSkillChip>
                      ))}
                    </MobileSkillChips>
                  </MobileSkillGroup>
                )}

                {matched.length > 0 && (
                  <MobileSkillGroup>
                    <MobileSkillGroupLabel>
                      <span className="group-dot" />
                      You already have
                      <span className="group-count">· {matched.length}</span>
                    </MobileSkillGroupLabel>
                    <MobileSkillChips>
                      {matched.map((skill, i) => (
                        <MobileSkillChip key={`have-${i}`}>{skill}</MobileSkillChip>
                      ))}
                    </MobileSkillChips>
                  </MobileSkillGroup>
                )}
              </MobileSection>
            );
          })()}

          {/* Benefits */}
          {selectedJob?._isExternal && (() => {
            // Extract benefits from description if possible, otherwise show common ones
            const desc = (selectedJob.description || '').toLowerCase();
            const benefitsList = [];
            if (desc.includes('health') || desc.includes('dental') || desc.includes('medical')) benefitsList.push({ icon: <AddIcon />, label: 'Health & dental' });
            if (desc.includes('pto') || desc.includes('vacation') || desc.includes('time off') || desc.includes('unlimited')) benefitsList.push({ icon: <EventNoteIcon />, label: 'Unlimited PTO' });
            if (desc.includes('401k') || desc.includes('401(k)') || desc.includes('retirement')) benefitsList.push({ icon: <ExpandMoreIcon />, label: '401(k) + match' });
            if (desc.includes('equity') || desc.includes('stock') || desc.includes('rsu') || desc.includes('options')) benefitsList.push({ icon: <RadioButtonUncheckedIcon />, label: 'Equity' });
            if (desc.includes('remote') || desc.includes('flexible') || desc.includes('hybrid')) benefitsList.push({ icon: <PublicIcon />, label: 'Remote / Flexible' });
            if (desc.includes('learning') || desc.includes('development') || desc.includes('education')) benefitsList.push({ icon: <AutoAwesomeIcon />, label: 'Learning budget' });
            if (benefitsList.length === 0) return null;
            return (
              <MobileSection>
                <MobileSectionTitle>Benefits</MobileSectionTitle>
                <MobileBenefitsGrid>
                  {benefitsList.map((b, i) => (
                    <MobileBenefitChip key={i}>
                      {b.icon}
                      {b.label}
                    </MobileBenefitChip>
                  ))}
                </MobileBenefitsGrid>
              </MobileSection>
            );
          })()}

          {/* Requirements text */}
          {selectedJob?._isExternal && selectedJob.requirements && (
            <MobileSection>
              <MobileSectionTitle>What you'll do</MobileSectionTitle>
              <MobileSectionBody>
                <div className="external-job-description" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedJob.requirements) }} />
              </MobileSectionBody>
            </MobileSection>
          )}

          {/* Similar Jobs */}
          {getSimilarJobs.length > 0 && (
            <MobileSection style={{ paddingBottom: 20 }}>
              <MobileSectionTitle>Similar jobs from your feed</MobileSectionTitle>
              <MobileSimilarScroll>
                {getSimilarJobs.map(job => (
                  <MobileSimilarCard
                    key={job.id}
                    onClick={async () => {
                      try {
                        const response = await externalJobAPI.getById(job.id);
                        setSelectedJob({
                          ...response.data,
                          relevanceScore: response.data.relevanceScore ?? job.relevanceScore,
                          _isExternal: true,
                        });
                      } catch {
                        setSelectedJob({ ...job, _isExternal: true });
                      }
                    }}
                  >
                    <div className="similar-company">{job.company}</div>
                    <div className="similar-title">{job.title}</div>
                    <div className="similar-footer">
                      {job.relevanceScore > 0 && <span className="similar-match">{Math.round(job.relevanceScore)}%</span>}
                      <span className="similar-meta">
                        {job.locationType || ''}{(job.salaryMin || job.salaryMax) ? ` · ${formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}` : ''}
                      </span>
                    </div>
                  </MobileSimilarCard>
                ))}
              </MobileSimilarScroll>
            </MobileSection>
          )}

          {/* Hidden InlineJobAITools (needed for tailor/cover letter actions) */}
          {isAuthenticated && selectedJob?._isExternal && (
            <div style={{ display: 'none' }}>
              <InlineJobAITools job={selectedJob} />
            </div>
          )}
        </MobileJobContent>

        {/* Mobile Sticky Footer V2 */}
        {selectedJob && (
          <MobileStickyFooterV2>
            <MobileFooterToolsRow>
              <MobileFooterToolBtn onClick={(e) => handleMatchClick(e, selectedJob)}>
                <SignalCellularAltIcon /> Analyze match
              </MobileFooterToolBtn>
              <MobileFooterToolBtn $pro onClick={() => {
                window.dispatchEvent(new CustomEvent('trigger-cover-letter', { detail: { jobId: selectedJob.id } }));
              }}>
                <DescriptionIcon /> Cover letter <span className="pro-badge">Pro</span>
              </MobileFooterToolBtn>
            </MobileFooterToolsRow>
            <MobileFooterActionsRow>
              {(() => {
                // Resolve the correct URL for this job:
                //   External jobs: applyUrl → sourceUrl → url (belt-and-braces)
                //   Internal jobs: navigate to the in-app application flow
                // The previous code only checked `selectedJob.url`, which
                // isn't a field on the ExternalJob model — the tap
                // silently fell through to navigate('/jobs/:id/apply'),
                // and for external jobs that route can't find a matching
                // internal job so it bounces the user back to /jobs (the
                // "back to job list" bug the user reported).
                const applyHref =
                  selectedJob.applyUrl ||
                  selectedJob.sourceUrl ||
                  selectedJob.url ||
                  null;

                if (applyHref) {
                  return (
                    // Render as a real anchor so mobile Safari/Chrome
                    // don't popup-block the tab and (worse) navigate the
                    // current frame away from the SPA.
                    <MobileFooterApply
                      as="a"
                      href={applyHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      {appliedJobs.has(selectedJob.id) ? 'Applied · Apply again' : 'Apply now'} <NorthEastIcon style={{ fontSize: 16 }} />
                    </MobileFooterApply>
                  );
                }
                return (
                  <MobileFooterApply onClick={() => navigate(`/jobs/${selectedJob.id}/apply`)}>
                    {appliedJobs.has(selectedJob.id) ? 'Applied · Apply again' : 'Apply now'} <NorthEastIcon style={{ fontSize: 16 }} />
                  </MobileFooterApply>
                );
              })()}
              <MobileFooterTailorV2 onClick={() => {
                window.dispatchEvent(new CustomEvent('trigger-tailor-resume', { detail: { jobId: selectedJob.id } }));
              }}>
                <AutoAwesomeIcon /> Tailor Resume
              </MobileFooterTailorV2>
            </MobileFooterActionsRow>
          </MobileStickyFooterV2>
        )}
      </MobileSelectedJobCard>

      {/* Agent Negotiation Modal */}
      <AgentNegotiationModal
        open={agentModalOpen}
        onClose={() => { setAgentModalOpen(false); setSelectedJobForAgent(null); }}
        initiatorType="candidate"
        jobData={selectedJobForAgent}
        onSuccess={handleAgentSuccess}
      />

      {/* Withdraw Confirmation Dialog */}
      <Dialog open={showWithdrawConfirm} onClose={handleWithdrawCancel} maxWidth="xs" fullWidth>
        <DialogContent>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CloseIcon style={{ fontSize: 28, color: '#B91C1C' }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#101828', marginBottom: 8 }}>
              Withdraw Application?
            </h3>
            <p style={{ fontSize: 14, color: '#667085', marginBottom: 4 }}>
              Are you sure you want to withdraw your application for
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#101828', marginBottom: 16 }}>
              {applicationToWithdraw?.job?.title} at {applicationToWithdraw?.job?.company}?
            </p>
            <p style={{ fontSize: 12, color: '#98A2B3' }}>This action cannot be undone.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="button"
              onClick={handleWithdrawCancel}
              style={{ flex: 1, padding: 12, fontSize: 14, fontWeight: 500, color: '#344054', background: '#F2F4F7', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >Cancel</button>
            <button type="button"
              onClick={handleWithdrawConfirm}
              disabled={withdrawingId}
              style={{
                flex: 1, padding: 12, fontSize: 14, fontWeight: 500, color: 'white',
                background: '#B91C1C', border: 'none', borderRadius: 8,
                cursor: withdrawingId ? 'not-allowed' : 'pointer',
                opacity: withdrawingId ? 0.7 : 1
              }}
            >{withdrawingId ? 'Withdrawing...' : 'Withdraw'}</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Match Analysis Dialog */}
      <Dialog open={matchDialogOpen} onClose={() => setMatchDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogContent style={{ padding: 0 }}>
          <div style={{ padding: '24px 28px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F9F5FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AutoAwesomeIcon style={{ fontSize: 20, color: '#7C3AED' }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#101828' }}>Match Analysis</div>
                  <div style={{ fontSize: 13, color: '#667085' }}>{matchDialogJob?.title} at {matchDialogJob?.company}</div>
                </div>
              </div>
              <button type="button" onClick={() => setMatchDialogOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#98A2B3' }}>
                <CloseIcon style={{ fontSize: 20 }} />
              </button>
            </div>

            {/* Score */}
            {matchDialogJob && (() => {
              // Prefer the locally-computed fallback score (matchBreakdown.effectiveScore)
              // over the raw server relevanceScore, which can be 0/missing when the
              // job wasn't opened from a search result (e.g. direct link). Falls back
              // to relevanceScore while matchBreakdown is still loading.
              const displayScore = matchBreakdown?.effectiveScore ?? (matchDialogJob.relevanceScore || 0);
              return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px', background: '#F9FAFB', borderRadius: 12, marginBottom: 20, border: '1px solid #EAECF0' }}>
                <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="#EAECF0" strokeWidth="6" />
                    <circle cx="36" cy="36" r="30" fill="none" stroke={getMatchColor(displayScore)} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 30} strokeDashoffset={2 * Math.PI * 30 * (1 - displayScore / 100)} transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#101828' }}>{Math.round(displayScore)}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#98A2B3' }}>%</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: getMatchColor(displayScore), marginBottom: 4 }}>
                    {displayScore >= 70 ? 'Excellent Match' : displayScore >= 50 ? 'Strong Match' : displayScore >= 25 ? 'Good Match' : 'Low Match'}
                  </div>
                  <div style={{ fontSize: 13, color: '#667085', lineHeight: 1.5 }}>
                    Based on your skills, experience, and career preferences.
                  </div>
                </div>
              </div>
              );
            })()}

            {/* Why this is a match */}
            {matchBreakdown ? (() => {
              const bd = matchBreakdown;
              const reasons = [];
              const details = [];

              // Title/Role
              if (bd.titleMatchPct >= 50) {
                reasons.push({ icon: '🎯', text: 'Your job title closely matches this role', detail: `Your profile title shares key terms with "${matchDialogJob?.title}", signaling strong role alignment to recruiters and ATS systems.`, color: '#027A48' });
              } else if (bd.titleMatchPct > 0) {
                reasons.push({ icon: '🎯', text: 'Your job title partially overlaps with this role', detail: 'Some keywords in your title match, but tailoring your resume headline could improve visibility.', color: '#D97706' });
              }

              // Skills
              if (bd.matchedSkills.length > 0 && bd.missingSkills.length === 0) {
                reasons.push({ icon: '⚡', text: `You have all ${bd.matchedSkills.length} key skills they require`, detail: 'Your skill set fully covers what this job asks for, a strong signal for both ATS screening and recruiter review.', color: '#027A48' });
              } else if (bd.matchedSkills.length > 0) {
                const total = bd.matchedSkills.length + bd.missingSkills.length;
                reasons.push({ icon: '⚡', text: `You match ${bd.matchedSkills.length} of ${total} required skills`, detail: `You cover most of the technical requirements. The ${bd.missingSkills.length} missing skill${bd.missingSkills.length > 1 ? 's' : ''} could be addressed by highlighting related experience in your resume.`, color: bd.missingSkills.length <= 2 ? '#027A48' : '#D97706' });
              }

              // Location
              if (bd.locationMatch === 'remote') {
                reasons.push({ icon: '📍', text: 'Remote position, open to your location', detail: 'This role supports remote work, so your current location is not a barrier.', color: '#027A48' });
              } else if (bd.locationMatch === 'exact') {
                reasons.push({ icon: '📍', text: `Located in ${bd.jobLocation}, matches your profile`, detail: 'Being in the same location gives you an advantage for onsite or hybrid positions.', color: '#027A48' });
              } else if (bd.locationMatch === 'partial') {
                reasons.push({ icon: '📍', text: `Near ${bd.jobLocation}, partial location match`, detail: 'You\'re in a nearby area. Consider mentioning willingness to relocate or commute in your application.', color: '#D97706' });
              } else if (bd.jobLocation) {
                reasons.push({ icon: '📍', text: `This role is in ${bd.jobLocation}`, detail: 'Your profile location doesn\'t match. If you\'re open to relocation, mention it in your cover letter.', color: '#667085' });
              }

              // Experience
              if (bd.jobExpLevel) {
                const levelLabels = { entry: 'Entry-level', mid: 'Mid-level', senior: 'Senior', lead: 'Lead/Staff', executive: 'Executive' };
                const levelYears = { entry: 2, mid: 5, senior: 8, lead: 12, executive: 15 };
                const expected = levelYears[bd.jobExpLevel] || 5;
                const label = levelLabels[bd.jobExpLevel] || bd.jobExpLevel;
                if (bd.yearsExp >= expected) {
                  reasons.push({ icon: '📊', text: `${bd.yearsExp} years experience, exceeds ${label} expectations`, detail: `This is a ${label} role typically seeking ${expected}+ years. Your ${bd.yearsExp} years of experience make you a strong candidate.`, color: '#027A48' });
                } else if (bd.yearsExp >= expected * 0.7) {
                  reasons.push({ icon: '📊', text: `${bd.yearsExp} years experience, fits this ${label} role`, detail: `This ${label} position typically expects around ${expected} years. Your experience is within range, focus on impact and achievements in your resume.`, color: '#027A48' });
                } else if (bd.yearsExp > 0) {
                  reasons.push({ icon: '📊', text: `${bd.yearsExp} years experience for a ${label} role (${expected}+ expected)`, detail: `You have less experience than typically expected. Highlight leadership, complex projects, and measurable impact to compensate.`, color: '#D97706' });
                }
              } else if (bd.yearsExp > 0) {
                reasons.push({ icon: '📊', text: `You bring ${bd.yearsExp} years of professional experience`, detail: 'No specific experience level was listed for this role, but your background adds credibility.', color: '#027A48' });
              }

              return (
                <div>
                  {/* Why it's a match, detailed */}
                  {reasons.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#344054', marginBottom: 10 }}>Why this is a match</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {reasons.map((r, i) => (
                          <div key={i} style={{ padding: '12px 14px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #EAECF0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                              <span style={{ fontSize: 16 }}>{r.icon}</span>
                              <span style={{ fontSize: 13, color: r.color, fontWeight: 600 }}>{r.text}</span>
                            </div>
                            <div style={{ fontSize: 12, color: '#667085', lineHeight: 1.6, paddingLeft: 26 }}>{r.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matched Skills */}
                  {bd.matchedSkills.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#027A48', marginBottom: 10 }}>
                        <CheckCircleOutlineIcon style={{ fontSize: 16 }} /> Your Matching Skills ({bd.matchedSkills.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {bd.matchedSkills.map((skill, i) => (
                          <span key={i} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#ECFDF3', color: '#027A48', border: '1px solid #A6F4C5', textTransform: 'capitalize' }}>{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Skills */}
                  {bd.missingSkills.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#B54708', marginBottom: 10 }}>
                        <WarningAmberIcon style={{ fontSize: 16 }} /> Skills to Develop ({bd.missingSkills.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {bd.missingSkills.map((skill, i) => (
                          <span key={i} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#FFFAEB', color: '#B54708', border: '1px solid #FEDF89' }}>{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tailor Resume CTA */}
                  <div style={{ padding: '16px 18px', background: 'linear-gradient(135deg, #F9F5FF, #F0F4FF)', borderRadius: 12, border: '1px solid #E9D5FF' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <AutoAwesomeIcon style={{ fontSize: 18, color: '#7C3AED' }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1D2939' }}>Improve Your Match</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#475467', lineHeight: 1.6, marginBottom: 12 }}>
                      Use <strong>Tailor Resume</strong> to automatically rewrite your profile for this role. It will analyze gaps between your experience and this job's requirements, then adjust your bullet points, skills, and summary to better align, helping you pass ATS filters and stand out to recruiters.
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button"
                        onClick={() => {
                          setMatchDialogOpen(false);
                          if (matchDialogJob) {
                            setSelectedJob({ ...matchDialogJob, _isExternal: true });
                          }
                        }}
                        style={{ padding: '8px 20px', background: 'white', color: '#344054', border: '1px solid #D0D5DD', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        View Job Details
                      </button>
                      <button type="button"
                        onClick={() => {
                          setMatchDialogOpen(false);
                          if (matchDialogJob) {
                            setSelectedJob({ ...matchDialogJob, _isExternal: true });
                            // Trigger tailoring after job is selected and InlineJobAITools mounts
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('trigger-tailor-resume', { detail: { jobId: matchDialogJob.id } }));
                            }, 500);
                          }
                        }}
                        style={{ padding: '8px 20px', background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <AutoAwesomeIcon style={{ fontSize: 14 }} /> Tailor Resume
                      </button>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#667085', fontSize: 13 }}>
                Loading breakdown...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

export default CandidateJobs;
