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
import { externalJobAPI, profileAPI, careerContextAPI } from '@/services/api';
import { jobFiltersFrom, employmentTypeLabel, locationTypeLabel } from '@/utils/jobPreferences';
import { useJobMatches, scoreJob } from '@/utils/jobMatchStore';
import { matchTier, orderByMatch, matchLists } from '@/utils/jobMatchScore';
import { hasReturningUser } from '@/utils/returningUser';
import { setCoachReturn } from '@/utils/coachReturn';

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

// One spelling for compound role words, so "Front/End UI Architect" is read
// as "Frontend", not "Front" + "End". Mirrors backend utils/roleQuery.js.
const ROLE_COMPOUNDS = [
  { re: /\bfront[\s\-/_.]*end\b/gi, word: 'Frontend' },
  { re: /\bback[\s\-/_.]*end\b/gi, word: 'Backend' },
  { re: /\bfull[\s\-/_.]*stack\b/gi, word: 'Fullstack' },
  { re: /\bdev[\s\-/_.]*ops\b/gi, word: 'DevOps' },
  { re: /\bml[\s\-/_.]*ops\b/gi, word: 'MLOps' },
  { re: /\be[\s\-]*commerce\b/gi, word: 'Ecommerce' },
];
const normalizeRoleCompounds = (text) => ROLE_COMPOUNDS.reduce((out, { re, word }) => out.replace(re, word), String(text || ''));

// "Architect" beside an engineer word is dropped; after a software surface it
// means that surface's engineer ("Frontend UI Architect" → frontend jobs).
const SOFTWARE_SURFACE_WORDS = new Set([
  'frontend', 'backend', 'fullstack', 'ui', 'web', 'mobile', 'ios', 'android',
  'react', 'javascript', 'typescript', 'node', 'node.js',
]);
const settleArchitect = (words) => {
  const at = words.findIndex((w) => /^architect(ure)?$/i.test(w));
  if (at === -1) return words;
  if (words.some((w) => /^(engineer|developer|programmer)$/i.test(w))) return words.filter((_, i) => i !== at);
  if (words.slice(0, at).some((w) => SOFTWARE_SURFACE_WORDS.has(w.toLowerCase()))) {
    return words.map((w, i) => (i === at ? 'Engineer' : w));
  }
  return words;
};

// Words that describe seniority rather than the role itself. The jobs API ANDs
// every search token, and most postings don't repeat the candidate's exact
// level in the title, so keeping these only shrinks the result set.
const SENIORITY_WORD_RE = /^(?:senior|sr\.?|junior|jr\.?|staff|principal|chief|head|entry|mid|associate|intern|interim|lead|vp|vice|president|deputy|assistant|level)$/i;
// Filler that appears in a person's title but rarely in the postings they want
// ("Frontend Software Engineer" should still match a "Frontend Engineer" role).
const ROLE_FILLER_RE = /^(?:full[-\s]?stack|fullstack|software|web|technical|technology|digital|global|of|the|and|for|i{1,3}|iv|v)$/i;
// Nouns that name a role family. Used to locate the anchor token when a title
// is long enough that we have to drop something.
const ROLE_FAMILY_WORDS = new Set([
  'engineer', 'engineering', 'developer', 'programmer', 'architect', 'scientist',
  'analyst', 'designer', 'manager', 'director', 'consultant', 'specialist',
  'administrator', 'researcher', 'recruiter', 'marketer', 'writer', 'strategist',
  'accountant', 'technician', 'nurse', 'teacher', 'producer', 'editor', 'planner',
]);

/**
 * Turn a candidate's profile title/headline into a short jobs-search query.
 *
 * The backend requires EVERY token to hit a job's title/company/department, so
 * one stray token silently empties the feed. Two rules keep the query usable:
 *
 *   1. Cut the employer clause. "Frontend Engineer at Equinix" says where the
 *      candidate works, not what they want to find — keeping "Equinix" searched
 *      for frontend roles *at Equinix* and returned nothing. Everything from
 *      the first separator onward is dropped.
 *   2. Reduce by dropping seniority and filler words, not by taking an
 *      arbitrary token pair. Only when a title is still longer than three
 *      words do we fall back to "first word + role-family noun".
 *
 * Returns '' when nothing usable survives, in which case the caller skips
 * seeding entirely rather than searching for a fragment.
 */
export function deriveRoleQuery(rawTitle) {
  const text = String(rawTitle || '').trim();
  if (!text) return '';

  // Employer / location clause: " at Equinix", " @ Stripe", " | Acme",
  // " - Acme", " , Acme". Also drop parenthetical asides like "(Contract)".
  const head = normalizeRoleCompounds(text).split(/\s+(?:at|@|\||·|•|—|–)\s+|\s*,\s+|\s+-\s+/i)[0]
    .replace(/[([{].*?[)\]}]/g, ' ');

  const tokens = head
    .split(/[\s/]+/)
    .map((t) => t.replace(/[^A-Za-z0-9+#.-]/g, '').replace(/^[.-]+|[.-]+$/g, ''))
    .filter(Boolean);

  // Seniority always goes. Filler only goes while at least two words remain —
  // "Frontend Software Engineer" should shed "Software", but "Staff Software
  // Engineer" must not be reduced all the way to a bare "Engineer".
  const meaningful = settleArchitect(tokens.filter((t) => !SENIORITY_WORD_RE.test(t)));
  for (let i = meaningful.length - 1; i >= 0 && meaningful.length > 2; i--) {
    if (ROLE_FILLER_RE.test(meaningful[i])) meaningful.splice(i, 1);
  }
  // Everything was seniority/filler ("Senior Staff") — nothing to search for.
  if (meaningful.length === 0) return '';
  // Short enough to use as-is. Three tokens is the sweet spot: it keeps
  // genuinely multi-word roles intact ("Machine Learning Engineer") instead of
  // truncating them into something meaningless ("Learning Engineer").
  if (meaningful.length <= 3) return meaningful.join(' ').slice(0, 80);

  // Still long: anchor on the last role-family noun and keep the leading
  // specialty word with it ("Frontend Platform Growth Engineer" →
  // "Frontend Engineer").
  let familyIdx = -1;
  for (let i = meaningful.length - 1; i >= 0; i--) {
    if (ROLE_FAMILY_WORDS.has(meaningful[i].toLowerCase())) { familyIdx = i; break; }
  }
  if (familyIdx <= 0) return meaningful.slice(0, 2).join(' ').slice(0, 80);
  return `${meaningful[0]} ${meaningful[familyIdx]}`.slice(0, 80);
}

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
  // Jobs the user OPENED or began but never confirmed applying to. Deliberately
  // separate from appliedJobs: tapping "Apply" only opens the company's ATS in
  // a new tab, so treating that as an application overstated what we know and
  // badged jobs the user never applied to. These render as "Started" and get a
  // one-tap confirmation prompt instead.
  const [startedJobs, setStartedJobs] = useState(new Set());
  // Per-session "not yet" dismissals for the confirmation prompt, so declining
  // once doesn't nag on every re-render. Not persisted — a later visit may be
  // exactly when they HAVE finished applying.
  const [dismissedApplyPrompts, setDismissedApplyPrompts] = useState(new Set());
  const [savingJob, setSavingJob] = useState(null);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [selectedJobForAgent, setSelectedJobForAgent] = useState(null);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchDialogJob, setMatchDialogJob] = useState(null);
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
  // Real match scores — each requirement in the posting graded against the
  // stored profile — for the jobs on screen. Stored ones load free; a job
  // without one shows no percentage rather than a guessed one.
  const jobMatchScores = useJobMatches(
    isAuthenticated ? [...externalJobs.map((j) => j.id), selectedJob?._isExternal ? selectedJob.id : null].filter(Boolean) : [],
  );
  const [scoringTop, setScoringTop] = useState(false);
  const [scoringDialog, setScoringDialog] = useState(false);
  const [externalJobsLoading, setExternalJobsLoading] = useState(false);
  // Separate spinner state for "Load more" so the existing list doesn't
  // disappear under the user when fetching the next page.
  const [loadingMoreExternal, setLoadingMoreExternal] = useState(false);
  const [externalJobsPagination, setExternalJobsPagination] = useState({ total: 0, page: 1, pages: 1 });
  // { from, to } when the typed search matched nothing and the server ran a
  // wider one; said above the list so the change is never silent.
  const [searchRelaxed, setSearchRelaxed] = useState(null);
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
  // Sort mode for the External tab list.
  //
  //   recommended (default) — ordered by profile fit, with recency as a
  //                           secondary term. Dates will NOT be monotonic.
  //   recent                — strictly newest first.
  //
  // The in-page toggle is back. It was removed on the assumption that
  // "recommended" was recency-ordered anyway, but the ranking is now dominated
  // by relevance, so a user wanting date order had no way to ask for it and
  // the out-of-order dates looked like a bug. Initial value still comes from
  // ?sort= so deep links keep working.
  const [sortMode, setSortMode] = useState(() => {
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
    startup: searchParams.get('startup') === 'true',
    hideStale: searchParams.get('hideStale') === 'true'
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
  // The candidate's role, sent to the API as a RANKING signal (`roleHint`)
  // rather than typed into the search box as a filter. Kept separate from
  // `searchQuery` precisely so the two can never be confused: anything in the
  // search box is a hard title filter the user asked for, while this only
  // reorders results. Cleared by the "show everything" affordance on the chip.
  const [roleHint, setRoleHint] = useState('');
  // Tracks whether we've already auto-applied the detected role to the
  // search input. Prevents us from re-filling after the user clears it.
  const roleAutoAppliedRef = useRef(false);
  // Same idea for the location filter: only auto-seed it once, never
  // re-apply if the candidate clears it (otherwise their "remote-anywhere"
  // intent is silently overridden on every render).
  const locationAutoAppliedRef = useRef(false);
  // Set once the candidate has overridden a profile-derived filter — by
  // clearing it, resetting the filters, or having the auto-relax widen it.
  // Sent to the API as `seed=0` so the server stops re-applying the seed it
  // would otherwise fill in on every request with an empty query.
  const seedOptOutRef = useRef(false);

  // Disclosure banner state (Fix 6.1). When the page auto-applies a role
  // or location from the candidate's profile we surface a one-line
  // "Personalized for you" banner with a [Show all jobs] escape hatch so
  // the candidate understands *why* the result set is narrower than the
  // corpus total. The state holds the *values* we seeded so we can
  // (a) detect when the user has edited them (banner self-dismisses), and
  // (b) restore the corpus view on demand.
  const [autoSeeded, setAutoSeeded] = useState({ role: null, location: null });
  // Set when a seeded filter had to be dropped because it produced an empty
  // feed (see the auto-relax step in fetchExternalJobs). Drives the one-line
  // explanation above the list so the widening never looks like a glitch.
  const [seedRelaxNotice, setSeedRelaxNotice] = useState(null);
  // Mirror of `autoSeeded` for the fetch callback, which must read the current
  // value without re-subscribing on every change.
  const autoSeededRef = useRef({ role: null, location: null });
  useEffect(() => { autoSeededRef.current = autoSeeded; }, [autoSeeded]);
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

  // The profile fetch below still runs — the page needs the candidate's skills
  // for the gap analysis — but nothing waits on it any more. Role and location
  // seeding moved to the server (see the appliedSeeds handler in
  // fetchExternalJobs), so the jobs list no longer sits behind a round-trip
  // for the largest JSON payload the API serves.

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
      // Kept for the "showing X roles" chip copy only. The RANKING hint is
      // derived server-side now; setting it here too would send a redundant
      // roleHint param and re-fire the fetch for no change in result.
      const role = deriveRoleQuery(res.data?.title || res.data?.headline);
      if (role) {
        // NOTE: the role is NOT typed into the search box. It goes to the API
        // as `roleHint`, which ranks rather than filters. Putting it in the
        // search box made it a hard AND filter on job titles, and most jobs a
        // frontend candidate wants are titled plain "Software Engineer" — in
        // one measured week, 743 San Francisco jobs were posted, 311 had
        // "engineer" in the title, only 4 had "frontend", and 1 had both. The
        // page looked empty and stale even though the corpus was healthy.
        setDetectedRole(role);
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
      // Location seeding moved to the server. Applying it here meant the jobs
      // request had to wait for this profile fetch before it could run — the
      // waterfall that made the page feel slow. The API now seeds it from the
      // profile row it already caches and tells us what it did, so the chip is
      // set from the list response instead of from here.

      // NOTE: we deliberately do NOT auto-seed the EXPERIENCE filter.
      // Role + location already narrow the feed; adding seniority as a third
      // hard AND-filter is what turned a first visit into "No jobs match your
      // filters" over a 70k-job corpus. Seniority is handled by the server
      // instead: the default ranking adds a level-fit term (see
      // backend/services/jobSeniorityFit.js) using the career stage and level
      // the candidate gave the coach, or their years and title when they gave
      // none, and leaves internships out for senior candidates. It is a
      // ranking signal, not a filter, so nothing here needs to send it. The
      // filter stays available as an explicit user choice in the chip row.
    }).catch(() => {});
  }, [isAuthenticated]);

  // Saved work preferences as default filters.
  //
  // The coach asks how someone wants to work (remote, hybrid, on-site) and
  // what kind of work (full-time, contract...). Those answers are stored on
  // the career context and used to be applied exactly once, in the matches
  // pop-up after onboarding; every later visit to this page ignored them. Now
  // a signed-in candidate landing here with no filters in the URL gets them
  // pre-applied as ordinary filters: visible as chips, cleared like any other.
  //
  // Applied once per tab session. Once applied they live in the URL, so a
  // reload keeps them; once the candidate clears or changes them, the
  // session flag stops them coming back. A new tab starts fresh, which is the
  // same "every fresh visit re-personalizes" rule the role and location seeds
  // follow.
  const SAVED_PREFS_KEY = 'jobs.savedPrefsApplied';
  // The filters we applied from preferences, so their chips can say so.
  const [prefFilters, setPrefFilters] = useState({});
  const prefFiltersRef = useRef({});
  // Role the candidate is aiming for, as the server ranked on it (appliedSeeds).
  const [targetRoleHint, setTargetRoleHint] = useState('');
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const FILTER_KEYS = ['search', 'locationType', 'location', 'datePosted', 'experienceLevel', 'company',
      'department', 'employmentType', 'salary', 'skills', 'startup', 'hideStale'];
    if (FILTER_KEYS.some((k) => searchParams.get(k))) return undefined;
    let alreadyApplied = false;
    try { alreadyApplied = sessionStorage.getItem(SAVED_PREFS_KEY) === '1'; } catch { /* storage blocked: apply */ }
    if (alreadyApplied) return undefined;
    let cancelled = false;
    careerContextAPI.get().then((res) => {
      if (cancelled) return;
      const prefs = jobFiltersFrom(res.data?.context?.constraints || {});
      try { sessionStorage.setItem(SAVED_PREFS_KEY, '1'); } catch { /* best effort */ }
      if (!Object.keys(prefs).length) return;
      prefFiltersRef.current = prefs;
      setPrefFilters(prefs);
      setFilters((prev) => {
        // Never over a filter the candidate set while this was in flight.
        const next = { ...prev };
        if (prefs.locationType && !prev.locationType) next.locationType = prefs.locationType;
        if (prefs.employmentType && !prev.employmentType) next.employmentType = prefs.employmentType;
        // Someone who wants remote work does not want it limited to their
        // city. Drop the city only when it was our seed, never one they chose.
        if (next.locationType === 'remote' && prev.location
          && prev.location === autoSeededRef.current.location) {
          next.location = '';
        }
        return next;
      });
      if (prefs.locationType === 'remote' && autoSeededRef.current.location) {
        setAutoSeeded((prev) => ({ ...prev, location: null }));
      }
    }).catch(() => { /* preferences are a nicety; the page works without them */ });
    return () => { cancelled = true; };
    // Mount-time decision only: re-running on every URL change would re-apply
    // preferences the candidate just cleared.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        hideStale: filters.hideStale ? 'true' : '',
        // Persist sort only when it deviates from the default so a clean URL
        // stays clean. The default is 'recommended', NOT 'recent' — this
        // previously tested against 'recent', which meant picking "Newest"
        // stripped ?sort= from the URL and the page reverted to recommended on
        // the next load, i.e. the one choice a user could make did not stick.
        sort: sortMode && sortMode !== 'recommended' ? sortMode : '',
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
    // sortMode belongs here too: without it, toggling the sort never reached
    // the address bar, so the choice was invisible to reloads and shared links.
  }, [filters, debouncedSearch, sortMode, setSearchParams]);

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
      // Ranking-only signal, and only when the user hasn't typed a query of
      // their own — an explicit search must never be diluted by our guess.
      else if (roleHint) params.roleHint = roleHint;
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
      if (debouncedFilters.hideStale) params.hideStale = 'true';
      // The server fills in role + location from the profile unless we opt out.
      // We opt out once the user has dismissed personalization or cleared a
      // seeded filter themselves — otherwise the seed would come straight back
      // on the next fetch. Sending an explicit empty `location` is not enough:
      // the server distinguishes "not supplied" from "supplied as empty", and
      // an untouched page supplies nothing.
      if (autoSeedDismissedRef.current || seedOptOutRef.current) params.seed = '0';
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
      if (!append) setSearchRelaxed(response.data.searchRelaxed || null);

      // Reflect the filters the SERVER applied from the candidate's profile.
      // These are real, active filters — the candidate has to be able to see
      // and remove them — so the chips are set from the response rather than
      // from a separate profile fetch the list used to wait on.
      const seeds = response.data.appliedSeeds;
      if (seeds && !append) {
        if (seeds.roleHint && !roleAutoAppliedRef.current) {
          roleAutoAppliedRef.current = true;
          setRoleHint(seeds.roleHint);
          setAutoSeeded(prev => ({ ...prev, role: seeds.roleHint }));
        }
        if (seeds.targetRole) setTargetRoleHint(seeds.targetRole);
        // A saved remote preference that landed before this response wins over
        // the city seed, for the reason given where preferences are applied.
        if (seeds.location && !locationAutoAppliedRef.current
          && prefFiltersRef.current.locationType !== 'remote') {
          locationAutoAppliedRef.current = true;
          setLocationInput(seeds.location);
          // `filters` only — NOT `debouncedFilters`. Writing the seed into the
          // value the fetch reads would make this look like a user-changed
          // filter and immediately re-fire the request we just answered, which
          // is the exact double-fetch removing the gate was meant to avoid.
          // The server already applied it; the chip just has to show it.
          setFilters(prev => (prev.location ? prev : { ...prev, location: seeds.location }));
          setAutoSeeded(prev => ({ ...prev, location: seeds.location }));
        }
      }

      // --- Auto-relax: never show an empty feed built from OUR guesses ---
      // The role and location seeds come from the candidate's profile, not
      // from anything they typed, and both are hard AND-filters server-side.
      // A stale profile location or an unusual title therefore produced "No
      // jobs match your filters" on a first visit over a 70k-job corpus, with
      // nothing on screen explaining why. When a seeded query comes back empty
      // we drop the seeds one at a time (least valuable first) and let the
      // fetch effect re-run. Anything the user typed themselves is never
      // touched, and each seed is relaxed at most once because clearing it
      // also clears it from `autoSeeded`.
      const seeded = autoSeededRef.current;
      const isEmptyFirstPage =
        !append && page === 1 && (response.data.pagination?.total || 0) === 0;
      // The location seed is applied by the SERVER now, so widening means
      // telling it to stop seeding (seed=0) rather than clearing a local
      // filter value — the filter was never ours to clear. Flipping the ref
      // and clearing the chip is enough to make the next fetch unseeded.
      if (isEmptyFirstPage && seeded.location && !seedOptOutRef.current) {
        // eslint-disable-next-line no-console
        console.debug('[Jobs] Seeded location produced 0 results — widening:', seeded.location);
        seedOptOutRef.current = true;
        locationAutoAppliedRef.current = false;
        setAutoSeeded(prev => ({ ...prev, location: null }));
        setSeedRelaxNotice({ kind: 'location', value: seeded.location });
        setLocationInput('');
        setFilters(prev => ({ ...prev, location: '' }));
        setDebouncedFilters(prev => ({ ...prev, location: '' }));
        return;
      }
      // The role is a ranking hint, not a filter, so it can no longer empty
      // the feed on its own — but drop it anyway if we somehow land on zero,
      // so the user is never left staring at nothing we caused.
      if (isEmptyFirstPage && seeded.role && !seedOptOutRef.current) {
        // eslint-disable-next-line no-console
        console.debug('[Jobs] Widening: dropping seeded role hint', seeded.role);
        seedOptOutRef.current = true;
        roleAutoAppliedRef.current = false;
        setAutoSeeded(prev => ({ ...prev, role: null }));
        setSeedRelaxNotice({ kind: 'role', value: seeded.role });
        setRoleHint('');
        return;
      }

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
            postedAt: j.effectivePostedAt || j.postedAt || j.createdAt,
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
          // Jobs opened or begun but never confirmed. Kept apart from applied
          // so the card can prompt "did you finish?" rather than assert it.
          const startedIds = res.data.startedExternalJobIds || [];
          if (startedIds.length > 0) {
            setStartedJobs(prev => new Set([...prev, ...startedIds]));
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
  }, [debouncedSearch, roleHint, debouncedFilters, isAuthenticated, sortMode]);

  useEffect(() => {
    if (activeTab !== 'external') return;
    // No gate. The jobs request used to wait for getMyProfile() so the page
    // could read the candidate's title and location, reduce the title to a
    // role, and only then ask for jobs — putting a full profile round-trip
    // (experience, skills, projects, summary: the largest JSON the API serves)
    // in front of every jobs page load, with checkSaved/checkApplied queued
    // behind the list for a third hop.
    //
    // The server now derives both seeds itself from the profile row it already
    // caches for ranking, and reports what it applied as `appliedSeeds` on the
    // response. So the first paint costs one request instead of two round
    // trips, and the chips still show the candidate exactly which filters are
    // on. See the appliedSeeds handler in fetchExternalJobs.
    fetchExternalJobs();
  }, [activeTab, fetchExternalJobs]);

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
    // When the deep link asks to tailor/write-a-cover-letter straight away
    // (e.g. from the daily job-match digest email, or the "email me this
    // link" CTA on the mobile desktop-nudge dialog: /jobs?externalJobId=…
    // &tailor=1 or &coverletter=1), capture the flag now so we can fire the
    // action once the job is selected and the InlineJobAITools panel has
    // mounted.
    const wantTailor = searchParams.get('tailor') === '1';
    const wantCoverLetter = searchParams.get('coverletter') === '1';
    externalJobAPI.getById(externalJobIdParam).then(response => {
      const job = { ...response.data, _isExternal: true };
      pinnedJobRef.current = job;
      setSelectedJob(job);
      setActiveTab('external');
      setExternalJobs(prev => [job, ...prev.filter(j => j.id !== job.id)]);
      if (wantTailor || wantCoverLetter) {
        // Give InlineJobAITools time to mount with the selected job before
        // dispatching — mirrors the 500ms delay used by the match dialog's
        // "Tailor Resume" button above.
        setTimeout(() => {
          const eventName = wantTailor ? 'trigger-tailor-resume' : 'trigger-cover-letter';
          window.dispatchEvent(new CustomEvent(eventName, { detail: { jobId: job.id } }));
        }, 600);
      }
    }).catch(() => {});
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('externalJobId');
    newParams.delete('tailor');
    newParams.delete('coverletter');
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


  // List payloads carry only a ~300-char preview of `description` (the API
  // truncates it — see truncateListDescriptions in
  // backend/routes/externalJobs.js) and never carry `descriptionHtml` at all,
  // so an external job taken straight from the list has to be hydrated from
  // GET /external-jobs/:id before the detail panel shows its full text.
  //
  // Every other external-job selection path already does this. The Saved tab
  // was the exception: it mixes external jobs into `filteredJobs` and routes
  // them through handleJobClick, which used to set the list copy and stop —
  // leaving a saved job's description clipped at the preview.
  //
  // Race-guarded: if the user clicks a different job before this resolves,
  // the stale response is dropped rather than overwriting the new selection.
  const hydrateSelectedExternalJob = (job) => {
    if (!job?.id) return;
    externalJobAPI.getById(job.id).then((response) => {
      setSelectedJob((prev) => (
        prev?.id === job.id
          ? {
              ...response.data,
              // The by-id endpoint doesn't compute relevanceScore, so carry
              // the ranked value over or the match badge resets on click.
              relevanceScore: response.data.relevanceScore ?? job.relevanceScore,
              _isExternal: true,
            }
          : prev
      ));
    }).catch(() => {});
  };

  const handleJobClick = (job) => {
    setSelectedJob(job);
    if (job?._isExternal) hydrateSelectedExternalJob(job);
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

  // Record that the user OPENED an external job's application page when they
  // tap "Apply Now". The real application happens off-site on the company ATS
  // (we open it in a new tab) and we never see whether they submitted, so this
  // is intent only — the job moves into `startedJobs`, not `appliedJobs`.
  // It becomes a real application when they confirm (see confirmExternalApplied)
  // or when the extension / ApplyPilot observes an actual submission.
  // Optimistic + fire-and-forget; a 409 means it's already recorded.
  const markExternalApplied = (jobId) => {
    if (!jobId || !isAuthenticated) return;
    if (appliedJobs.has(jobId) || startedJobs.has(jobId)) return;
    setStartedJobs(prev => new Set([...prev, jobId]));
    externalJobAPI.markApplied(jobId).catch(err => {
      if (err?.response?.status === 409) return; // already recorded — fine
      console.warn('Failed to record external application:', err?.response?.status, err?.message);
      setStartedJobs(prev => {
        const s = new Set(prev);
        s.delete(jobId);
        return s;
      });
    });
  };

  // The user answering "yes, I finished applying". This is the only completion
  // signal we get from candidates without the Chrome extension, so it's what
  // turns a started job into a genuine application.
  const confirmExternalApplied = (jobId) => {
    if (!jobId || !isAuthenticated) return;
    setAppliedJobs(prev => new Set([...prev, jobId]));
    setStartedJobs(prev => {
      const s = new Set(prev);
      s.delete(jobId);
      return s;
    });
    externalJobAPI.confirmApplied(jobId).catch(err => {
      console.warn('Failed to confirm application:', err?.response?.status, err?.message);
      // Roll back so the user can retry rather than silently believing it stuck.
      setAppliedJobs(prev => {
        const s = new Set(prev);
        s.delete(jobId);
        return s;
      });
      setStartedJobs(prev => new Set([...prev, jobId]));
      toast?.error?.('Could not save that. Please try again.');
    });
  };

  // "Not yet" — keep the row as started, just stop asking on this render pass.
  const dismissApplyPrompt = (jobId) => {
    setDismissedApplyPrompts(prev => new Set([...prev, jobId]));
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
    // Touching a filter the server seeded means the candidate is overriding our
    // guess. Opt out of seeding so it isn't silently re-applied on the next
    // request — without this, clearing the location chip would put it straight
    // back, which is the behaviour the client-side version was careful to avoid.
    if (key === 'location' || key === 'locationType') seedOptOutRef.current = true;
    setFilters(prev => ({ ...prev, [key]: value }));
    setOpenDropdown(null);
    // The candidate is steering now; the auto-widen explanation is stale.
    setSeedRelaxNotice(null);
  };

  const clearFilters = () => {
    // Reset every filter, the debounced mirror, the Location popover's
    // draft input, *and* the search query. Also flips the user back to
    // the Discover tab so a reset from Saved/Applied lands them on a
    // populated surface rather than an empty user-scoped list. The URL
    // sync effect picks all of this up and strips every owned param.
    // A reset is an explicit "show me everything", so profile seeding stops too.
    seedOptOutRef.current = true;
    const empty = { locationType: '', location: '', datePosted: '', experienceLevel: '', company: '', department: '', employmentType: '', salary: '', skills: '', startup: false, hideStale: false };
    setFilters(empty);
    setDebouncedFilters(empty);
    setLocationInput('');
    setSearchQuery('');
    setDebouncedSearch('');
    setOpenDropdown(null);
    setActiveTab('external');
    setSeedRelaxNotice(null);
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
    const anchor = job?.effectivePostedAt || job?.postedAt || job?.createdAt;
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

  // What a card's match badge says. The percentage is the real match score
  // (utils/jobMatchScore) or nothing. It used to come from search relevance,
  // which saturates whenever a title contains the search words — every
  // "Frontend Engineer" title read "100% · Excellent match". A job that only
  // matches the search says so, without a number.
  const formatMatchBadge = (job) => {
    const ai = jobMatchScores[job?.id];
    const tier = matchTier(ai?.score);
    if (tier) {
      const pct = Math.round(ai.score);
      return { text: `${pct}% · ${tier.label}`, mobile: `${pct}%`, tier: tier.tier };
    }
    if ((job?.relevanceScore || 0) >= 50) return { text: 'Matches your search', mobile: null, tier: 'search' };
    return null;
  };
  const MATCH_BADGE_TITLE = 'Your match score: each requirement in the posting checked against your profile. Click for the breakdown.';

  const handleMatchClick = (e, job) => {
    e?.stopPropagation();
    setMatchDialogJob(job);
    setMatchDialogOpen(true);
  };

  /** One AI read for one job. Spends one job-match allowance. */
  const handleScoreJob = async (job) => {
    if (!job?.id) return;
    setScoringDialog(true);
    try {
      await scoreJob(job.id);
    } catch (err) {
      toast?.error?.(err.message);
    } finally {
      setScoringDialog(false);
    }
  };

  /**
   * Scores the top five jobs on screen that have no score yet, three at a
   * time. An allowance running out stops the batch with the server's message
   * instead of failing the rest one by one.
   */
  const handleScoreTop = async () => {
    const ordered = sortMode === 'recommended' ? orderByMatch(externalJobs, jobMatchScores) : externalJobs;
    const todo = ordered.filter((j) => !jobMatchScores[j.id]).slice(0, 5);
    if (todo.length === 0) {
      toast?.info?.('The top jobs already have a match score.');
      return;
    }
    setScoringTop(true);
    let done = 0;
    let stopped = null;
    const queue = [...todo];
    const worker = async () => {
      while (queue.length && !stopped) {
        const job = queue.shift();
        try {
          await scoreJob(job.id);
          done += 1;
        } catch (err) {
          if (err.status === 429 || err.status === 403) stopped = err.message;
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setScoringTop(false);
    if (stopped) toast?.error?.(stopped);
    else if (done > 0) toast?.success?.(`Scored ${done} job${done === 1 ? '' : 's'}`);
    else toast?.error?.('The match scores could not be computed. Please try again.');
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
              <a href={selectedJob.applyUrl} target="_blank" rel="noopener noreferrer" className="job-detail-apply-btn"
                onClick={() => selectedJob._isExternal && markExternalApplied(selectedJob.id)}>
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
            {/* Completion prompt. The application itself happens on the
                company's site, so this question is the only way to learn the
                outcome for candidates without the Chrome extension — and
                asking is far better than the old behaviour of assuming a click
                meant they applied. Shown only for jobs they actually opened,
                and only until they answer. */}
            {!appliedJobs.has(selectedJob.id)
              && startedJobs.has(selectedJob.id)
              && !dismissedApplyPrompts.has(selectedJob.id) && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 8,
                background: '#FFFAEB',
                border: '1px solid #FEDF89',
                color: '#B54708',
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                Did you finish applying?
                <button
                  type="button"
                  onClick={() => confirmExternalApplied(selectedJob.id)}
                  style={{
                    padding: '3px 10px', borderRadius: 6, border: 'none',
                    background: '#067647', color: 'white',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => dismissApplyPrompt(selectedJob.id)}
                  style={{
                    padding: '3px 10px', borderRadius: 6,
                    border: '1px solid #FEDF89', background: 'white',
                    color: '#B54708', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Not yet
                </button>
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
                  <div className="job-detail-ai-subtitle">Free with your ProfilleAI profile</div>
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
              {/* Every tool here runs on a profile, so the way in is the
                  coach, which builds one and asks for the account at the end.
                  It brings them back to this job once the profile is up. A
                  browser that has had an account is steered to sign in. */}
              {hasReturningUser() ? (
                <>
                  <button
                    type="button"
                    className="job-detail-ai-teaser-cta"
                    onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/jobs/${selectedJob.id}`)}`)}
                  >
                    Sign in to unlock AI tools
                  </button>
                  <button
                    type="button"
                    className="job-detail-ai-teaser-signin"
                    onClick={() => { setCoachReturn(`/jobs/${selectedJob.id}`); navigate('/profile/create'); }}
                  >
                    New here? Build your profile
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="job-detail-ai-teaser-cta"
                    onClick={() => { setCoachReturn(`/jobs/${selectedJob.id}`); navigate('/profile/create'); }}
                  >
                    Build your profile free
                  </button>
                  <button
                    type="button"
                    className="job-detail-ai-teaser-signin"
                    onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/jobs/${selectedJob.id}`)}`)}
                  >
                    Already have an account? Sign in
                  </button>
                </>
              )}
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
              {/* Personalization chip. This is now the ONLY place the seeded
                  role is visible: it is a ranking signal, not a filter, so
                  showing it inside the search box would imply results are
                  restricted to that title when they are not. Dismissing it
                  drops the hint and returns the feed to pure recency. */}
              {detectedRole && roleHint && !searchQuery && (
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
                    Ranked for <strong>{detectedRole}</strong>
                    {targetRoleHint && <> and <strong>{targetRoleHint}</strong></>}
                  </span>
                  <button
                    type="button"
                    onClick={() => { seedOptOutRef.current = true; setRoleHint(''); setTargetRoleHint(''); setAutoSeeded(prev => ({ ...prev, role: null })); }}
                    aria-label="Stop ranking by my role"
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
                  {/* Hide listings our ghost-job scoring says are probably not
                      live vacancies. Opt-in, never the default: the score is a
                      judgement call, and hiding a slow-to-fill role the
                      candidate actually wanted is worse than showing it with a
                      caveat. See backend services/ghostJobDetector.js. */}
                  <FilterChip
                    $active={!!filters.hideStale}
                    onClick={() => handleFilterChange('hideStale', !filters.hideStale)}
                    title="Hide postings that look like they aren't actively hiring: talent-pool and pipeline ads, roles listed for months, and listings whose date keeps being refreshed"
                  >
                    👻 Hide ghost jobs {filters.hideStale && '✓'}
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

                  {/* Work type and job type. Their dropdowns were taken out of
                      this row on purpose, but the filters still exist: saved
                      preferences and the onboarding pop-up set them, and a deep
                      link can carry them. A filter that narrows the list has to
                      be visible and removable, so each shows as a chip while it
                      is active, and only then. */}
                  {filters.locationType && (
                    <FilterChip
                      $active
                      onClick={() => handleFilterChange('locationType', '')}
                      title={prefFilters.locationType === filters.locationType
                        ? 'From your saved work preferences. Click to show every work type.'
                        : 'Click to show every work type.'}
                      aria-label={`Remove the ${locationTypeLabel(filters.locationType)} filter`}
                    >
                      {locationTypeLabel(filters.locationType)} <CloseIcon style={{ fontSize: 14, marginLeft: 2 }} />
                    </FilterChip>
                  )}
                  {filters.employmentType && (
                    <FilterChip
                      $active
                      onClick={() => handleFilterChange('employmentType', '')}
                      title={prefFilters.employmentType === filters.employmentType
                        ? 'From your saved work preferences. Click to show every job type.'
                        : 'Click to show every job type.'}
                      aria-label={`Remove the ${employmentTypeLabel(filters.employmentType)} filter`}
                    >
                      {employmentTypeLabel(filters.employmentType)} <CloseIcon style={{ fontSize: 14, marginLeft: 2 }} />
                    </FilterChip>
                  )}

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

                  {/* The sort control lives in the results header below, not
                      in this chip row — it reports on the list rather than
                      filtering it. "Best match" now genuinely is banded
                      (relevance band, newest first within the band), which this
                      comment claimed long before the SQL did it. */}

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
                {/* One-line explanation when a profile-seeded filter had to be
                    dropped because it returned nothing. Without this the feed
                    silently widens and the candidate can't tell whether the
                    page ignored their profile or simply found nothing. */}
                {seedRelaxNotice && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', marginBottom: 10,
                    background: '#F9F5FF', border: '1px solid #E9D7FE',
                    borderRadius: 8, fontSize: 12.5, color: '#53389E',
                    lineHeight: 1.4,
                  }}>
                    <AutoAwesomeIcon style={{ fontSize: 14, flexShrink: 0 }} />
                    <span>
                      {seedRelaxNotice.kind === 'location'
                        ? `No jobs near "${seedRelaxNotice.value}" right now, so we widened the search to all locations.`
                        : `No open roles matched "${seedRelaxNotice.value}" from your profile, so we're showing a broader set.`}
                    </span>
                  </div>
                )}
                {/* Result count header, plus the sort toggle. */}
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
                      {isAuthenticated && externalJobs.length > 0 && (
                        <button
                          type="button"
                          onClick={handleScoreTop}
                          disabled={scoringTop}
                          title="Scores the top 5 jobs that don't have a match score yet: each requirement checked against your profile. Uses 1 job-match credit each; scores you already have are free."
                          style={{
                            marginLeft: 10, padding: '3px 9px', borderRadius: 999,
                            fontSize: 11, fontWeight: 600, cursor: scoringTop ? 'default' : 'pointer',
                            border: '1px solid #E9D5FF', background: '#F9F5FF', color: '#6941C6',
                            opacity: scoringTop ? 0.7 : 1,
                          }}
                        >
                          {scoringTop ? 'Scoring…' : 'Score top 5'}
                        </button>
                      )}
                    </div>
                    {/* Real control, not a caption. "Best match" is banded:
                        relevance decides the band, and within a band the newest
                        job is on top, so dates descend as you scan instead of
                        interleaving. Before banding this ordering was a single
                        continuous score where freshness could contribute at most
                        0.2, so dates genuinely went 2d, 4d, 3d and correct
                        behaviour read as broken sorting. "Newest" remains strict
                        date order for anyone who wants only that. */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      {[
                        { key: 'recommended', label: 'Best match', title: 'Grouped by how well each job fits your profile, newest first within each group' },
                        { key: 'recent', label: 'Newest', title: 'Ordered strictly by posting date, newest first' },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          title={opt.title}
                          onClick={() => setSortMode(opt.key)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
                            fontSize: 11, fontWeight: 600,
                            border: '1px solid ' + (sortMode === opt.key ? '#7C3AED' : '#E4E7EC'),
                            background: sortMode === opt.key ? '#F4EBFF' : 'white',
                            color: sortMode === opt.key ? '#5B21B6' : '#667085',
                          }}
                        >
                          {opt.key === 'recent' && <AccessTimeIcon style={{ fontSize: 12 }} />}
                          {opt.label}
                        </button>
                      ))}
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
                  {searchRelaxed && (
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#667085' }}>
                      No titles match &ldquo;{searchRelaxed.from}&rdquo;. Showing jobs for &ldquo;{searchRelaxed.to}&rdquo;.
                    </p>
                  )}
                  <JobsGrid>
                    {(() => {
                      let lastSection = null;
                      // "Best match": real scores lead or trail, unscored jobs keep the
                      // server's relevance order between them (utils/jobMatchScore).
                      const ordered = sortMode === 'recommended' ? orderByMatch(externalJobs, jobMatchScores) : externalJobs;
                      return ordered.map(job => {
                        const aiMatch = jobMatchScores[job.id];
                        const matchLevel = getMatchLevel(aiMatch ? aiMatch.score : 0);
                        const jobSkillsPreview = Array.isArray(job.skills) ? job.skills : [];
                        const visibleSkills = jobSkillsPreview.slice(0, 3);
                        const remainingCount = Math.max(0, jobSkillsPreview.length - 3);
                        const pct = aiMatch ? Math.round(aiMatch.score) : 0;

                        // Determine section group for mobile headers
                        let sectionLabel = null;
                        const currentSection = pct >= 70 ? 'strong' : pct >= 50 ? 'good' : 'other';
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
                                  {/* ✓ Applied — a CONFIRMED application:
                                      ApplyPilot submitted, the extension saw a
                                      real submit, or the user told us. */}
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
                                  {/* Ghost-job caveat. Shown rather than the
                                      job being hidden: we cannot distinguish a
                                      genuine slow-to-fill role from a pipeline
                                      ad with certainty, so the candidate gets
                                      the reason and decides. */}
                                  {job.ghostScore >= 50 && (
                                    <span
                                      title={(job.ghostReasons || []).join(' · ') || 'May not be actively hiring'}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 3,
                                        padding: '2px 8px', borderRadius: 999,
                                        background: '#FFFAEB', color: '#B54708',
                                        fontSize: 10, fontWeight: 700,
                                        letterSpacing: '0.04em', textTransform: 'uppercase',
                                      }}
                                    >
                                      May not be hiring
                                    </span>
                                  )}
                                  {/* Started — the user opened this job's
                                      application page but we never saw them
                                      submit. Deliberately NOT "Applied": the
                                      submission happens on the company's site
                                      where we have no visibility, and claiming
                                      otherwise is what made applied counts
                                      untrustworthy. */}
                                  {!appliedJobs.has(job.id) && startedJobs.has(job.id) && (
                                    <span
                                      title="You opened this application. Tell us if you finished so we can track it."
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3,
                                        padding: '2px 8px',
                                        borderRadius: 999,
                                        background: '#F2F4F7',
                                        color: '#475467',
                                        fontSize: 10,
                                        fontWeight: 700,
                                        letterSpacing: '0.04em',
                                        textTransform: 'uppercase',
                                      }}
                                    >
                                      Started
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
                                    const badge = formatMatchBadge(job);
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
                                  const badge = formatMatchBadge(job);
                                  if (!badge || !badge.mobile) return null;
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
          {selectedJob?._isExternal && isAuthenticated && (() => {
            // The real match score, or an offer to compute it — never a number
            // derived from search relevance or skill-word overlap.
            const ai = jobMatchScores[selectedJob.id];
            const tier = matchTier(ai?.score);
            if (!tier) {
              return (
                <MobileMatchCardV2>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#101828', marginBottom: 4 }}>No match score yet</div>
                  <div style={{ fontSize: 12.5, color: '#667085', lineHeight: 1.5, marginBottom: 10 }}>
                    Checks each requirement in this posting against your profile. Uses 1 job-match credit.
                  </div>
                  <button type="button"
                    onClick={() => handleScoreJob(selectedJob)}
                    disabled={scoringDialog}
                    style={{ padding: '7px 14px', background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: scoringDialog ? 0.7 : 1 }}
                  >
                    {scoringDialog ? 'Checking each requirement…' : 'Get my match score'}
                  </button>
                </MobileMatchCardV2>
              );
            }
            const score = Math.round(ai.score);
            const tailoredScore = Math.max(score, Math.round(ai.projectedScore || score));
            const aiGaps = matchLists(ai).gaps;
            return (
              <MobileMatchCardV2>
                <MobileMatchTopRow>
                  <MobileMatchRingV2>
                    <svg viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="36" cy="36" r="30" fill="none" stroke="#EAECF0" strokeWidth="6" />
                      <circle
                        cx="36" cy="36" r="30" fill="none"
                        stroke={tier.color}
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
                      <span className="match-label">{tier.label}</span>
                      {tailoredScore > score && <span className="tailor-badge">→ ~{tailoredScore}% if tailored</span>}
                    </div>
                    <div className="match-sub">
                      {tier.advice}{aiGaps.length > 0 ? ` ${aiGaps.length} requirement${aiGaps.length !== 1 ? 's' : ''} not on your resume.` : ''}
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
              <InlineJobAITools job={selectedJob} renderMobileGateUI />
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
                      onClick={() => selectedJob._isExternal && markExternalApplied(selectedJob.id)}
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

            {/* Score: the AI read of the requirements, or an offer to run it */}
            {matchDialogJob && (() => {
              const ai = jobMatchScores[matchDialogJob.id];
              const tier = matchTier(ai?.score);
              if (!tier) {
                return (
                  <div style={{ padding: '18px 20px', background: '#F9FAFB', borderRadius: 12, border: '1px solid #EAECF0' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#101828', marginBottom: 6 }}>No match score yet</div>
                    <div style={{ fontSize: 13, color: '#667085', lineHeight: 1.6, marginBottom: 14 }}>
                      This job is listed because it matches your search. To see how well it fits your resume,
                      ProfilleAI checks each requirement in the posting against your profile. It takes about
                      15 seconds and uses 1 job-match credit.
                    </div>
                    <button type="button"
                      onClick={() => handleScoreJob(matchDialogJob)}
                      disabled={scoringDialog}
                      style={{ padding: '8px 18px', background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: scoringDialog ? 'default' : 'pointer', opacity: scoringDialog ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <AutoAwesomeIcon style={{ fontSize: 14 }} /> {scoringDialog ? 'Checking each requirement…' : 'Get my match score'}
                    </button>
                  </div>
                );
              }
              const pct = Math.round(ai.score);
              const lists = matchLists(ai);
              const chip = (bg, color, border) => ({ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: bg, color, border: `1px solid ${border}`, lineHeight: 1.4 });
              const group = (title, color, icon, items, style) => items.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color, marginBottom: 8 }}>
                    {icon} {title} ({items.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map((r, i) => <span key={i} title={r.evidence || undefined} style={style}>{r.requirement}</span>)}
                  </div>
                </div>
              );
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px', background: '#F9FAFB', borderRadius: 12, marginBottom: 20, border: '1px solid #EAECF0' }}>
                    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                      <svg width="72" height="72" viewBox="0 0 72 72">
                        <circle cx="36" cy="36" r="30" fill="none" stroke="#EAECF0" strokeWidth="6" />
                        <circle cx="36" cy="36" r="30" fill="none" stroke={tier.color} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 30} strokeDashoffset={2 * Math.PI * 30 * (1 - pct / 100)} transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                      </svg>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#101828' }}>{pct}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#98A2B3' }}>%</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: tier.color, marginBottom: 4 }}>{tier.label} — {tier.advice}</div>
                      {ai.verdict && <div style={{ fontSize: 13, color: '#667085', lineHeight: 1.5 }}>{ai.verdict}</div>}
                    </div>
                  </div>

                  {lists.knockouts.length > 0 && (
                    <div style={{ marginBottom: 16, padding: '12px 14px', background: '#FEF3F2', borderRadius: 10, border: '1px solid #FECDCA' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#B42318', marginBottom: 6 }}>Likely to fail screening</div>
                      {lists.knockouts.map((b, i) => (
                        <div key={i} style={{ fontSize: 12.5, color: '#7A271A', lineHeight: 1.5, marginTop: i ? 6 : 0 }}>
                          <strong>{b.requirement}</strong>{b.why ? ` — ${b.why}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                  {group('You meet', '#027A48', <CheckCircleOutlineIcon style={{ fontSize: 16 }} />, lists.met, chip('#ECFDF3', '#027A48', '#A6F4C5'))}
                  {group('Partly shown on your resume', '#B54708', <WarningAmberIcon style={{ fontSize: 16 }} />, lists.partial, chip('#FFFAEB', '#B54708', '#FEDF89'))}
                  {group('Not on your resume', '#B42318', <CloseIcon style={{ fontSize: 16 }} />, lists.gaps, chip('#FEF3F2', '#B42318', '#FECDCA'))}

                  {/* Tailor Resume CTA */}
                  <div style={{ padding: '16px 18px', background: 'linear-gradient(135deg, #F9F5FF, #F0F4FF)', borderRadius: 12, border: '1px solid #E9D5FF' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <AutoAwesomeIcon style={{ fontSize: 18, color: '#7C3AED' }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1D2939' }}>
                        Improve your match{typeof ai.projectedScore === 'number' && ai.projectedScore > pct ? ` — tailoring can reach ~${Math.round(ai.projectedScore)}%` : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#475467', lineHeight: 1.6, marginBottom: 12 }}>
                      <strong>Tailor Resume</strong> rewords your resume to surface experience you already have for the items marked "partly shown". Gaps you don't have stay gaps.
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button"
                        onClick={() => {
                          setMatchDialogOpen(false);
                          if (matchDialogJob) setSelectedJob({ ...matchDialogJob, _isExternal: true });
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
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

export default CandidateJobs;
