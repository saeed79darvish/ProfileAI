import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Typography,
  TextField,
  Autocomplete,
  Slider,
  InputAdornment,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  ArrowForward as ArrowIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
  WorkOutline as WorkIcon,
  LaptopMac as RemoteIcon,
  Business as OnsiteIcon,
  Groups as HybridIcon,
  TuneOutlined as FlexIcon,
  CheckCircle as CheckIcon,
  Close as CloseIcon,
  LocationOn as LocationIcon,
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  School as SchoolIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import ProjectIdeasModal from '../../components/ProjectIdeasModal';
import { profileAPI } from '../../services/api';
import {
  fadeIn,
  slideInRight,
  slideInLeft,
  pulse,
  PageContainer,
  TopBar,
  Logo,
  SkipLink,
  MainContent,
  StepIndicator,
  StepDot,
  StepLine,
  StepLabel,
  WizardCard,
  StepContent,
  TipBubble,
  Pill,
  SelectionCard,
  CardIcon,
  WorkSetupGrid,
  WorkCard,
  SkillChipGrid,
  SkillChip,
  SelectedSkillsArea,
  SelectedTag,
  CategoryLabel,
  SalaryDisplay,
  NavRow,
  NavButton,
  FinishButton
} from './styled';
import { ROUTES, STEPS, EXPERIENCE_LEVELS, EMPLOYMENT_TYPES, AVAILABILITY_OPTIONS, AI_TIPS, LIMITS, LOCALSTORAGE_KEY, TEXT, JOB_SECTORS, SECTOR_TITLES, ALL_TITLES, SECTOR_SKILLS, ALL_SKILLS, CAREER_STAGES } from './constants';
import { getSectorProfile, getStageCopy } from './sectorProfiles';
import { mapWizardExperienceToEditor, mapWizardProjectToEditor, wizardDataToProfileShape } from './handoff';
import { validateHttpUrl } from '@/utils/urlValidation';
import { validateYear, validateYearRange } from './yearValidation';
import { computeProfileCompletion } from '@/hooks/useProfileCompletion';
import useAICredits from '@/hooks/useAICredits';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmModal from '@/components/ConfirmModal';
import BrandWordmark from '@/components/BrandWordmark';
import AICreditsBadge from '@/components/AICreditsBadge';

const POPULAR_LOCATIONS = [
  // United States
  'San Francisco, CA', 'New York, NY', 'Los Angeles, CA', 'Seattle, WA', 'Austin, TX',
  'Chicago, IL', 'Boston, MA', 'Denver, CO', 'San Diego, CA', 'Portland, OR',
  'Miami, FL', 'Atlanta, GA', 'Dallas, TX', 'Houston, TX', 'Phoenix, AZ',
  'Philadelphia, PA', 'San Jose, CA', 'Washington, DC', 'Minneapolis, MN', 'Nashville, TN',
  'Raleigh, NC', 'Charlotte, NC', 'Salt Lake City, UT', 'Detroit, MI', 'Pittsburgh, PA',
  'Indianapolis, IN', 'Columbus, OH', 'Orlando, FL', 'Tampa, FL', 'Las Vegas, NV',
  'Sacramento, CA', 'Kansas City, MO', 'Baltimore, MD', 'Milwaukee, WI', 'St. Louis, MO',
  // Canada
  'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada', 'Calgary, Canada', 'Ottawa, Canada',
  // United Kingdom
  'London, UK', 'Manchester, UK', 'Edinburgh, UK', 'Birmingham, UK', 'Bristol, UK', 'Cambridge, UK',
  // Europe
  'Berlin, Germany', 'Munich, Germany', 'Hamburg, Germany', 'Amsterdam, Netherlands',
  'Paris, France', 'Dublin, Ireland', 'Zurich, Switzerland', 'Stockholm, Sweden',
  'Barcelona, Spain', 'Madrid, Spain', 'Lisbon, Portugal', 'Copenhagen, Denmark',
  'Oslo, Norway', 'Helsinki, Finland', 'Vienna, Austria', 'Brussels, Belgium',
  'Milan, Italy', 'Prague, Czech Republic', 'Warsaw, Poland', 'Budapest, Hungary',
  // Asia-Pacific
  'Singapore', 'Tokyo, Japan', 'Sydney, Australia', 'Melbourne, Australia',
  'Bangalore, India', 'Mumbai, India', 'Hyderabad, India', 'Delhi, India',
  'Hong Kong', 'Seoul, South Korea', 'Shanghai, China', 'Beijing, China',
  'Taipei, Taiwan', 'Auckland, New Zealand',
  // Middle East & Africa
  'Dubai, UAE', 'Tel Aviv, Israel', 'Riyadh, Saudi Arabia', 'Cape Town, South Africa',
  'Nairobi, Kenya', 'Lagos, Nigeria',
  // Latin America
  'São Paulo, Brazil', 'Mexico City, Mexico', 'Buenos Aires, Argentina',
  'Bogotá, Colombia', 'Santiago, Chile', 'Lima, Peru',
  // Remote
  'Remote', 'Remote (US)', 'Remote (EU)', 'Remote (Worldwide)',
];

const WORK_SETUPS = [
  { id: 'remote', label: 'Remote', sub: 'Work from anywhere', Icon: RemoteIcon },
  { id: 'hybrid', label: 'Hybrid', sub: 'Mix of office & remote', Icon: HybridIcon },
  { id: 'onsite', label: 'On-Site', sub: 'Office-based', Icon: OnsiteIcon },
  { id: 'flexible', label: 'Flexible', sub: 'No preference', Icon: FlexIcon }
];

const StyledInput = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '14px',
    fontSize: '15px',
    background: '#fafbfd',
    '& fieldset': { borderColor: '#e4e7f0' },
    '&:hover fieldset': { borderColor: '#b0b8d4' },
    '&.Mui-focused fieldset': {
      borderColor: '#667eea',
      borderWidth: '2px'
    }
  }
};

const DEFAULT_DATA = {
  sector: '',
  title: '',
  experienceLevel: '',
  employmentTypes: [],
  // Multi-select: candidates often want both Remote and Hybrid, or any
  // combination. 'flexible' is mutually-exclusive with the rest — selecting
  // it means "no preference" and clears any specific picks.
  workSetups: [],
  location: '',
  skills: [],
  salaryMin: 60000,
  availability: '',
  // New-in-v2: optional resume sections collected during the wizard so
  // candidates of any stage (new grads, career changers, experienced)
  // arrive at the profile form with a real starting draft.
  careerStage: '',          // see CAREER_STAGES — gates the Experience step
  experience: [],           // [{ title, company, startDate, endDate, description }]
  education: [],            // [{ degree, fieldOfStudy, institution, startDate, endDate }]
  projects: [],             // [{ title, role, description, url }]
  // Auto-discovery: candidates can hand the AI agent a single URL so it can
  // surface their best public work and recommend projects to add. GitHub for
  // tech roles, generic portfolio link for everyone else.
  githubUsername: '',
  portfolioUrl: '',
};

// Empty entry templates kept in one place so Add buttons and migrations stay
// in sync with whatever fields the ProfileForm expects.
const EMPTY_EXPERIENCE = { title: '', company: '', startDate: '', endDate: '', current: false, description: '' };
const EMPTY_EDUCATION = { degree: '', fieldOfStudy: '', institution: '', startDate: '', endDate: '' };
const EMPTY_PROJECT = { title: '', role: '', description: '', url: '' };

// Backwards-compat: earlier builds stored workSetup as a single string.
// Coerce any persisted value into the new array shape so a returning user
// doesn't lose their pick.
const normalizeData = (raw) => {
  if (!raw || typeof raw !== 'object') return DEFAULT_DATA;
  const merged = { ...DEFAULT_DATA, ...raw };
  if (typeof raw.workSetup === 'string' && raw.workSetup) {
    merged.workSetups = [raw.workSetup];
  }
  if (!Array.isArray(merged.workSetups)) merged.workSetups = [];
  if (!Array.isArray(merged.employmentTypes)) merged.employmentTypes = [];
  if (!Array.isArray(merged.skills)) merged.skills = [];
  if (!Array.isArray(merged.experience)) merged.experience = [];
  if (!Array.isArray(merged.education)) merged.education = [];
  if (!Array.isArray(merged.projects)) merged.projects = [];
  if (typeof merged.careerStage !== 'string') merged.careerStage = '';
  if (typeof merged.githubUsername !== 'string') merged.githubUsername = '';
  if (typeof merged.portfolioUrl !== 'string') merged.portfolioUrl = '';
  delete merged.workSetup;

  // Cross-sector contamination cleanup. If the persisted sector is, say,
  // 'marketing' but the stored skills / projects / title came from a
  // previous 'tech' session (because the user changed industry on a fresh
  // load and our earlier code skipped the wipe on first pick), drop the
  // mismatched bits so the wizard never opens with a Frontend project
  // sitting in a Campaigns step.
  if (merged.sector && SECTOR_SKILLS[merged.sector]) {
    const sectorSkillSet = new Set(Object.values(SECTOR_SKILLS[merged.sector]).flat());
    if (sectorSkillSet.size > 0 && merged.skills.length > 0) {
      const filtered = merged.skills.filter((s) => sectorSkillSet.has(s));
      if (filtered.length !== merged.skills.length) merged.skills = filtered;
    }
  }
  if (merged.sector && SECTOR_TITLES[merged.sector]) {
    const allSectorTitles = Object.values(SECTOR_TITLES).flat();
    if (
      merged.title &&
      allSectorTitles.includes(merged.title) &&
      !SECTOR_TITLES[merged.sector].includes(merged.title)
    ) {
      merged.title = '';
    }
  }
  // Projects are the loudest mismatch — a Frontend developer entry in a
  // Marketing flow. Heuristic: if any project references github.com / a
  // tech-only role keyword, and sector is not tech, drop the lot. Better
  // to start clean than confuse the candidate.
  if (merged.sector && merged.sector !== 'tech' && merged.projects.length > 0) {
    const techSignal = /github\.com|frontend|backend|fullstack|full-stack|developer|engineer|react|vue|angular|node\.?js|python|django|kubernetes|docker/i;
    const hasTechSignal = merged.projects.some(p =>
      techSignal.test(`${p.title || ''} ${p.role || ''} ${p.description || ''} ${p.url || ''}`)
    );
    if (hasTechSignal) merged.projects = [];
  }

  return merged;
};

const JobPreferencesWizard = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  // Everything in this wizard is client-side form-filling except the
  // optional "AI Draft" button below — a guest who clicks it sees a
  // sign-up prompt instead of hitting an auth wall.
  const [showGuestSignupPrompt, setShowGuestSignupPrompt] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [animDir, setAnimDir] = useState('right');
  const [skillSearch, setSkillSearch] = useState('');
  // Boost modal: auto-opens once per careerStage selection. We also track
  // the last stage we opened for so switching back and forth doesn't spam
  // the user with the same modal.
  const [ideasOpen, setIdeasOpen] = useState(false);
  // Per-row AI draft loading flags. Keyed as `${field}-${index}` so each
  // textarea has its own spinner / disabled state.
  const [aiDraftKey, setAiDraftKey] = useState(null);
  const [aiDraftError, setAiDraftError] = useState('');

  // Live AI credits for the AI Draft buttons. Pulled from the same source
  // the AICreditsBadge displays so the button's disabled state and the
  // header counter always agree. When out of credits the buttons grey out
  // proactively instead of letting users click and hit the paywall.
  const aiCredits = useAICredits('profile_enhance');
  const outOfAICredits =
    !aiCredits.loading && !aiCredits.isUnlimited && aiCredits.remaining === 0;
  const aiPeriodSuffix = aiCredits.period === 'month' ? 'this month' : 'this week';
  const aiDraftTooltip = outOfAICredits
    ? `No AI credits left ${aiPeriodSuffix}`
    : aiCredits.isUnlimited
      ? 'Unlimited AI (Pro)'
      : `Costs 1 AI credit · ${aiCredits.remaining ?? '…'} left ${aiPeriodSuffix}`;
  const aiOutOfCreditsHelper = `Out of AI credits ${aiPeriodSuffix}. Upgrade or wait for the reset.`;

  // URL validation errors for inline display. Keys: `portfolio` for the
  // Step 5 portfolio link, `projects.${idx}.url` for each project row.
  // Empty when no errors. Cleared on field edit, set on blur, and
  // re-checked at Finish time as a guard against bypass via skipping
  // blur events.
  const [urlErrors, setUrlErrors] = useState({});

  // Education year validation errors. Keys: `education.${idx}.startDate`
  // and `education.${idx}.endDate`. Same blur-vs-finish semantics as the
  // URL errors above.
  const [yearErrors, setYearErrors] = useState({});

  // Hydrate from localStorage so a user who refreshed or came back from
  // the form/skip flow doesn't have to re-enter everything.
  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_KEY);
      if (raw) return normalizeData(JSON.parse(raw));
    } catch { /* corrupt JSON / private mode — fall through */ }
    return DEFAULT_DATA;
  });

  // Derive titles and skills from selected sector
  const activeTitles = data.sector ? (SECTOR_TITLES[data.sector] || ALL_TITLES) : ALL_TITLES;
  const activeSkillMap = data.sector ? (SECTOR_SKILLS[data.sector] || ALL_SKILLS) : ALL_SKILLS;

  // Update helpers
  const set = useCallback((field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleArrayItem = useCallback((field, item) => {
    setData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }));
  }, []);

  // Work setup is multi-select but 'flexible' (no preference) is mutually
  // exclusive with the specific options. Selecting flexible clears the
  // others; selecting any specific option clears flexible.
  const toggleWorkSetup = useCallback((id) => {
    setData(prev => {
      const current = prev.workSetups || [];
      if (current.includes(id)) {
        return { ...prev, workSetups: current.filter(i => i !== id) };
      }
      if (id === 'flexible') {
        return { ...prev, workSetups: ['flexible'] };
      }
      const next = current.filter(i => i !== 'flexible');
      return { ...prev, workSetups: [...next, id] };
    });
  }, []);

  // Persist progress to localStorage on every change so refresh / back-nav
  // / Skip-for-now doesn't drop the user's work.
  useEffect(() => {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
    } catch { /* quota / private mode — ignore */ }
  }, [data]);

  // Navigation
  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      setAnimDir('right');
      setCurrentStep(s => s + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setAnimDir('left');
      setCurrentStep(s => s - 1);
    } else {
      // On the first step, go back to the upload-resume / start-from-scratch
      // choice screen.
      navigate('/profile/create');
    }
  };

  const handleSkip = () => {
    navigate('/profile/create-form');
  };

  // Derived URL errors over the whole wizard. Same pattern as
  // `yearErrorsAll`: a memo of the live data is the source of truth for
  // gating Continue / Finish, while `urlErrors` (state) is what surfaces
  // inline on blur. Computing from `data` means a freshly-typed bad URL
  // blocks Continue even before the input has blurred, so users can't
  // click through a stale-state window.
  const urlErrorsAll = useMemo(() => {
    const errs = {};
    const sp = getSectorProfile(data.sector);
    // Portfolio URL is only validated when the field is in URL mode. In
    // 'githubUsername' mode the wizard's handoff strips a github URL down
    // to a bare username, so either input shape is fine.
    if (sp.portfolio.field !== 'githubUsername') {
      const msg = validateHttpUrl(data.portfolioUrl, { fieldLabel: 'Portfolio URL' });
      if (msg) errs.portfolio = msg;
    }
    (data.projects || []).forEach((p, idx) => {
      const msg = validateHttpUrl(p?.url, { fieldLabel: 'Project URL' });
      if (msg) errs[`projects.${idx}.url`] = msg;
    });
    return errs;
  }, [data]);

  // Helper used by onChange to clear a single key as soon as the user
  // edits the field; re-validation happens on blur.
  const clearUrlError = useCallback((key) => {
    setUrlErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // onBlur handler used by every URL input in the wizard.
  const handleUrlBlur = useCallback((key, value, opts) => {
    const msg = validateHttpUrl(value, opts);
    setUrlErrors((prev) => {
      const next = { ...prev };
      if (msg) next[key] = msg;
      else delete next[key];
      return next;
    });
  }, []);

  // Education year validation. Same pattern as the URL validators:
  // `yearErrorsAll` is the derived truth used to gate Continue / Finish,
  // while `yearErrors` is the state that surfaces inline on blur.
  const yearErrorsAll = useMemo(() => {
    const errs = {};
    (data.education || []).forEach((edu, idx) => {
      const startKey = `education.${idx}.startDate`;
      const endKey = `education.${idx}.endDate`;
      const startMsg = validateYear(edu.startDate, { fieldLabel: 'Start year' });
      const endMsg = validateYear(edu.endDate, { fieldLabel: 'End year' });
      if (startMsg) errs[startKey] = startMsg;
      if (endMsg) errs[endKey] = endMsg;
      // Only run the cross-field check when both per-field shapes are
      // fine — otherwise the per-field message owns the surfacing.
      if (!startMsg && !endMsg) {
        const rangeMsg = validateYearRange(edu.startDate, edu.endDate);
        if (rangeMsg) errs[endKey] = rangeMsg;
      }
    });
    return errs;
  }, [data.education]);

  const clearYearError = useCallback((key) => {
    setYearErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // Re-validate both start and end on every blur so a fixed end clears a
  // stale range error, and so the cross-field rule is always evaluated
  // off the latest values for the row.
  const handleYearBlur = useCallback((idx, field, value) => {
    setYearErrors((prev) => {
      const next = { ...prev };
      const startKey = `education.${idx}.startDate`;
      const endKey = `education.${idx}.endDate`;
      const row = data.education?.[idx] || {};
      const startValue = field === 'startDate' ? value : row.startDate;
      const endValue = field === 'endDate' ? value : row.endDate;
      const startMsg = validateYear(startValue, { fieldLabel: 'Start year' });
      const endMsg = validateYear(endValue, { fieldLabel: 'End year' });
      if (startMsg) next[startKey] = startMsg;
      else delete next[startKey];
      if (endMsg) next[endKey] = endMsg;
      else delete next[endKey];
      if (!startMsg && !endMsg) {
        const rangeMsg = validateYearRange(startValue, endValue);
        if (rangeMsg) next[endKey] = rangeMsg;
      }
      return next;
    });
  }, [data.education]);

  const handleFinish = () => {
    // Guard: block navigation if any URL field is invalid. Bounce the
    // user back to the Projects step (index 5) where every URL input
    // lives, and surface the field-level errors so they can fix them.
    if (Object.keys(urlErrorsAll).length > 0) {
      setUrlErrors(urlErrorsAll);
      setAnimDir('left');
      setCurrentStep(5);
      // Focus the first invalid field once the step renders.
      const firstKey = Object.keys(urlErrorsAll)[0];
      setTimeout(() => {
        const selector = `[name="${firstKey.replace(/\./g, '\\.')}"]`;
        const el = document.querySelector(selector);
        if (el && typeof el.focus === 'function') el.focus({ preventScroll: false });
      }, 250);
      return;
    }

    // Same guard for education year errors — bounce to step 4 if any.
    if (Object.keys(yearErrorsAll).length > 0) {
      setYearErrors(yearErrorsAll);
      setAnimDir('left');
      setCurrentStep(4);
      const firstKey = Object.keys(yearErrorsAll)[0];
      setTimeout(() => {
        const selector = `[name="${firstKey.replace(/\./g, '\\.')}"]`;
        const el = document.querySelector(selector);
        if (el && typeof el.focus === 'function') el.focus({ preventScroll: false });
      }, 250);
      return;
    }

    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore quota / private-mode errors
    }

    // Strip empty rows so the ProfileForm doesn't render a bunch of blank
    // cards when the candidate skipped a section. Experience rows are then
    // transformed via mapWizardExperienceToEditor so currently-working
    // state and a default employmentType survive the handoff.
    const experiencePrefs = {
      employmentTypes: data.employmentTypes,
      careerStage: data.careerStage,
    };
    const cleanedExperience = (data.experience || [])
      .filter(
        (e) => (e.title || '').trim() || (e.company || '').trim() || (e.description || '').trim()
      )
      .map((row) => mapWizardExperienceToEditor(row, experiencePrefs));
    const cleanedEducation = (data.education || []).filter(
      (e) => (e.degree || '').trim() || (e.institution || '').trim() || (e.fieldOfStudy || '').trim()
    );
    const cleanedProjects = (data.projects || [])
      .filter(
        (p) => (p.title || '').trim() || (p.description || '').trim()
      )
      .map(mapWizardProjectToEditor);

    // Navigate to ProfileForm with pre-filled data (matching resumeData shape)
    navigate('/profile/create-form', {
      state: {
        source: 'wizard',
        resumeData: {
          title: data.title,
          location: data.location,
          skills: data.skills,
          summary: '',
          experience: cleanedExperience,
          education: cleanedEducation,
          projects: cleanedProjects,
          // Passed through so the ProfileForm / agent can surface
          // recommended projects later. Normalised to a bare username so
          // the backend can build the GitHub API URL itself.
          github: (data.githubUsername || '').trim().replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\/$/, ''),
          portfolioUrl: (data.portfolioUrl || '').trim(),
        }
      }
    });
  };

  // Filtered skills for search
  const filteredSkills = useMemo(() => {
    if (!skillSearch.trim()) return activeSkillMap;
    const q = skillSearch.toLowerCase();
    const result = {};
    Object.entries(activeSkillMap).forEach(([cat, skills]) => {
      const filtered = skills.filter(s => s.toLowerCase().includes(q));
      if (filtered.length) result[cat] = filtered;
    });
    return result;
  }, [skillSearch, activeSkillMap]);

  // Step validity
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: return data.title.trim().length > 0;
      case 1: return data.employmentTypes.length > 0 || data.workSetups.length > 0;
      case 2: return true; // skills are optional
      case 3: return true; // experience optional — branched by careerStage
      case 4: return Object.keys(yearErrorsAll).length === 0; // years must validate
      case 5: return Object.keys(urlErrorsAll).length === 0; // portfolio + project URLs must validate
      case 6: return true;
      default: return true;
    }
  }, [currentStep, data, yearErrorsAll, urlErrorsAll]);

  // Live profile-completion score. Single source of truth shared with the
  // editor sidebar, the success modal, and the Dashboard card via
  // computeProfileCompletion. Wizard state is adapted to the Profile
  // shape the rubric expects (no summary / photo at this stage — those
  // are added in the editor and correctly cost ~22% here).
  const profileStrength = useMemo(
    () => computeProfileCompletion(wizardDataToProfileShape(data)),
    [data],
  );

  // Helpers for repeating sections — Experience / Education / Projects.
  const addRow = useCallback((field, template) => {
    setData(prev => ({ ...prev, [field]: [...(prev[field] || []), { ...template }] }));
  }, []);
  const removeRow = useCallback((field, index) => {
    setData(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index),
    }));
  }, []);
  const updateRow = useCallback((field, index, key, value) => {
    setData(prev => {
      const next = [...(prev[field] || [])];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, [field]: next };
    });
  }, []);

  /**
   * AI Draft helper — calls /api/profiles/enhance-text to turn a one-liner
   * into a polished bullet list. Used by both Experience and Project
   * description textareas so candidates don't stare at a blank box.
   *
   * @param {'experience'|'project'} type
   * @param {'experience'|'projects'} field  — array key in `data`
   * @param {number} index                   — row position
   * @param {object} ctx                     — title / company / role context
   */
  const draftWithAI = useCallback(async (type, field, index, ctx = {}) => {
    if (!isAuthenticated) {
      setShowGuestSignupPrompt(true);
      return;
    }
    const row = data[field]?.[index];
    const text = (row?.description || '').trim();
    if (!text || text.length < 10) {
      setAiDraftError('Write at least 10 characters first — even a rough sentence is enough.');
      return;
    }
    const key = `${field}-${index}`;
    setAiDraftKey(key);
    setAiDraftError('');
    try {
      const res = await profileAPI.enhanceText(text, type, ctx);
      const enhanced = res?.data?.enhancedText || res?.data?.data?.enhancedText;
      if (enhanced && typeof enhanced === 'string') {
        updateRow(field, index, 'description', enhanced);
      } else {
        setAiDraftError("AI couldn't improve that — try adding more detail.");
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'AI draft failed. Please try again.';
      setAiDraftError(msg);
    } finally {
      setAiDraftKey(null);
    }
  }, [data, updateRow, isAuthenticated]);

  /**
   * One-click skills baseline — picks the top N skills from the currently
   * filtered sector map and toggles them into the selection. We dedupe so
   * a second click doesn't remove what the user already has.
   */
  const suggestSkillsForRole = useCallback((count = 8) => {
    const flat = Object.values(activeSkillMap).flat();
    const additions = [];
    for (const sk of flat) {
      if (additions.length + data.skills.length >= count) break;
      if (!data.skills.includes(sk)) additions.push(sk);
    }
    if (additions.length === 0) return;
    setData(prev => ({ ...prev, skills: [...prev.skills, ...additions] }));
  }, [activeSkillMap, data.skills]);

  const formatSalary = (v) => {
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
    return `$${v}`;
  };

  /* ─── STEP RENDERERS ─── */

  const renderStepIdentity = () => (
    <StepContent $dir={animDir} key="step-0">
      <TipBubble>
        <Avatar
          sx={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            fontSize: 12
          }}
        >
          <AIIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Typography sx={{ fontSize: 13, color: '#555c72' }}>
          {AI_TIPS[0]}
        </Typography>
      </TipBubble>

      <Typography
        sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 700, color: '#1a1a2e', mb: 1 }}
      >
        What industry are you in?
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: 2 }}>
        Pick your sector so we can suggest the right roles and skills.
      </Typography>

      {/* Sector selection */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px', mb: 4 }}>
        {JOB_SECTORS.map(sec => (
          <Pill
            key={sec.id}
            $selected={data.sector === sec.id}
            onClick={() => {
              if (data.sector === sec.id) return;
              set('sector', sec.id);
              // Reset title if it was from a different sector's suggestions
              if (data.title && SECTOR_TITLES[sec.id] && !SECTOR_TITLES[sec.id].includes(data.title)) {
                const wasFromSuggestion = Object.values(SECTOR_TITLES).flat().includes(data.title);
                if (wasFromSuggestion) set('title', '');
              }
              // Drop skills that don't belong to the new sector's catalog.
              // No prevSector guard — even on the first pick of a session
              // (when sector was '' from a fresh hydrate) the user could
              // have inherited stale skills from a previous session, so we
              // always re-validate against the new catalog.
              if (data.skills.length > 0) {
                const newCatalog = new Set(Object.values(SECTOR_SKILLS[sec.id] || {}).flat());
                if (newCatalog.size > 0) {
                  const filtered = data.skills.filter((s) => newCatalog.has(s));
                  if (filtered.length !== data.skills.length) {
                    setData(prev => ({ ...prev, skills: filtered }));
                  }
                }
              }
              // Projects copy + nouns are sector-specific (Campaigns vs
              // Repos vs Matters vs Deals). Always wipe on sector change
              // so a 'Frontend developer / React + Tailwind' project never
              // shows up in a Marketing flow.
              if ((data.projects?.length || 0) > 0) {
                setData(prev => ({ ...prev, projects: [] }));
              }
            }}
          >
            {sec.icon} {sec.label}
          </Pill>
        ))}
      </Box>

      {/* Role / Title */}
      <Typography
        sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 700, color: '#1a1a2e', mb: 1 }}
      >
        What best describes your role?
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: 3 }}>
        This becomes your profile headline, make it count.
      </Typography>

      <TextField
        fullWidth
        placeholder={data.sector === 'marketing' ? 'e.g. Digital Marketing Manager' : data.sector === 'healthcare' ? 'e.g. Registered Nurse' : data.sector === 'finance' ? 'e.g. Financial Analyst' : data.sector === 'design' ? 'e.g. Senior UX Designer' : data.sector === 'education' ? 'e.g. Curriculum Developer' : data.sector === 'sales' ? 'e.g. Account Executive' : 'e.g. Senior Frontend Developer'}
        value={data.title}
        onChange={e => set('title', e.target.value)}
        sx={{ ...StyledInput, mb: 3 }}
      />

      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8b90a3', letterSpacing: 0.5, mb: 1.5, textTransform: 'uppercase' }}>
        Popular titles{data.sector ? ` in ${JOB_SECTORS.find(s => s.id === data.sector)?.label || 'your field'}` : ''}, tap to use
      </Typography>
      <SkillChipGrid>
        {activeTitles.slice(0, 18).map(t => (
          <SkillChip
            key={t}
            $selected={data.title === t}
            onClick={() => set('title', t)}
          >
            {t}
          </SkillChip>
        ))}
      </SkillChipGrid>

      {/* Experience level */}
      <Typography
        sx={{ fontSize: 12, fontWeight: 700, color: '#8b90a3', letterSpacing: 0.5, mt: 4, mb: 1.5, textTransform: 'uppercase' }}
      >
        Experience level
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {EXPERIENCE_LEVELS.map(lv => (
          <SelectionCard
            key={lv.id}
            $selected={data.experienceLevel === lv.id}
            onClick={() => set('experienceLevel', lv.id)}
          >
            <CardIcon $selected={data.experienceLevel === lv.id}>
              {lv.icon}
            </CardIcon>
            <Box>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: 14.5,
                  color: data.experienceLevel === lv.id ? 'white' : '#1a1a2e'
                }}
              >
                {lv.label}
              </Typography>
              <Typography
                sx={{
                  fontSize: 12,
                  color: data.experienceLevel === lv.id ? 'rgba(255,255,255,0.75)' : '#999'
                }}
              >
                {lv.sub}
              </Typography>
            </Box>
            {data.experienceLevel === lv.id && (
              <CheckIcon sx={{ ml: 'auto', fontSize: 20, color: 'white' }} />
            )}
          </SelectionCard>
        ))}
      </Box>
    </StepContent>
  );

  const renderStepPreferences = () => (
    <StepContent $dir={animDir} key="step-1">
      <TipBubble>
        <Avatar
          sx={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            fontSize: 12
          }}
        >
          <AIIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Typography sx={{ fontSize: 13, color: '#555c72' }}>
          {AI_TIPS[1]}
        </Typography>
      </TipBubble>

      <Typography
        sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 700, color: '#1a1a2e', mb: 1 }}
      >
        What kind of opportunities?
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: 3 }}>
        Select all that apply, we'll tailor your job feed.
      </Typography>

      {/* Employment types */}
      <Typography
        sx={{ fontSize: 12, fontWeight: 700, color: '#8b90a3', letterSpacing: 0.5, mb: 1.5, textTransform: 'uppercase' }}
      >
        Role type
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px', mb: 4 }}>
        {EMPLOYMENT_TYPES.map(et => (
          <Pill
            key={et.id}
            $selected={data.employmentTypes.includes(et.id)}
            onClick={() => toggleArrayItem('employmentTypes', et.id)}
          >
            {et.icon} {et.label}
          </Pill>
        ))}
      </Box>

      {/* Work Setup */}
      <Typography
        sx={{ fontSize: 12, fontWeight: 700, color: '#8b90a3', letterSpacing: 0.5, mb: 0.5, textTransform: 'uppercase' }}
      >
        Preferred work arrangement
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: '#9aa0b4', mb: 1.5 }}>
        Pick all that work for you — e.g. Remote + Hybrid.
      </Typography>
      <WorkSetupGrid>
        {WORK_SETUPS.map(ws => {
          const selected = data.workSetups.includes(ws.id);
          return (
            <WorkCard
              key={ws.id}
              $selected={selected}
              role="checkbox"
              aria-checked={selected}
              onClick={() => toggleWorkSetup(ws.id)}
            >
              {selected && (
                <CheckIcon
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    fontSize: 18,
                    color: 'white',
                    background: 'rgba(255,255,255,0.18)',
                    borderRadius: '50%',
                    p: '2px'
                  }}
                />
              )}
              <ws.Icon />
              <Typography
                sx={{
                  fontWeight: 600, fontSize: 14,
                  color: selected ? 'white' : '#1a1a2e'
                }}
              >
                {ws.label}
              </Typography>
              <Typography
                sx={{
                  fontSize: 11.5,
                  color: selected ? 'rgba(255,255,255,0.7)' : '#999'
                }}
              >
                {ws.sub}
              </Typography>
            </WorkCard>
          );
        })}
      </WorkSetupGrid>

      {/* Location */}
      <Typography
        sx={{ fontSize: 12, fontWeight: 700, color: '#8b90a3', letterSpacing: 0.5, mt: 4, mb: 1.5, textTransform: 'uppercase' }}
      >
        Your location
      </Typography>
      <Autocomplete
        freeSolo
        options={POPULAR_LOCATIONS}
        value={data.location || ''}
        onChange={(_, newValue) => set('location', newValue || '')}
        onInputChange={(_, newInputValue, reason) => {
          if (reason === 'input') set('location', newInputValue);
        }}
        filterOptions={(options, { inputValue }) => {
          const q = inputValue.toLowerCase().trim();
          if (!q) return options.slice(0, 10);
          return options.filter(opt => opt.toLowerCase().includes(q)).slice(0, 10);
        }}
        renderOption={(props, option) => (
          <li {...props} key={option}>
            <LocationIcon sx={{ fontSize: 18, color: '#667eea', mr: 1.5, flexShrink: 0 }} />
            {option}
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            fullWidth
            placeholder="e.g. San Francisco, CA or London, UK"
            sx={StyledInput}
          />
        )}
        componentsProps={{
          paper: {
            sx: {
              borderRadius: '14px',
              mt: 0.5,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              '& .MuiAutocomplete-option': {
                fontSize: '14px',
                py: 1.2,
                '&:hover': { background: '#f0f2ff' },
                '&[aria-selected="true"]': { background: '#e8ebff' },
              },
            },
          },
        }}
      />
    </StepContent>
  );

  const renderStepSkills = () => {
    const sp = getSectorProfile(data.sector);
    // Custom-skill affordance. The wizard's catalog is curated per sector,
    // but the editor accepts arbitrary skills — mirror that here so a
    // search like "Selenium" / "Cypress" isn't a dead end. Dedup is
    // case-insensitive to match the editor's `handleAddSkillUnified`.
    const trimmedQuery = skillSearch.trim();
    const noResults = trimmedQuery.length > 0 && Object.keys(filteredSkills).length === 0;
    const alreadyAdded = trimmedQuery.length > 0 && data.skills.some(
      (s) => String(s).toLowerCase() === trimmedQuery.toLowerCase(),
    );
    const handleAddCustomSkill = () => {
      if (!trimmedQuery || alreadyAdded) return;
      setData((prev) => ({ ...prev, skills: [...prev.skills, trimmedQuery] }));
      setSkillSearch('');
    };
    return (
    <StepContent $dir={animDir} key="step-2">
      <TipBubble>
        <Avatar
          sx={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            fontSize: 12
          }}
        >
          <AIIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Typography sx={{ fontSize: 13, color: '#555c72' }}>
          {AI_TIPS[2]}
        </Typography>
      </TipBubble>

      <Typography
        sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 700, color: '#1a1a2e', mb: 1 }}
      >
        {sp.skills.headline}
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: 2 }}>
        {data.sector
          ? sp.skills.blurb
          : 'Select all that apply, you can always edit these later.'}
      </Typography>

      {/* Selected skills */}
      <SelectedSkillsArea>
        {data.skills.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: '#b0b5c4', fontStyle: 'italic' }}>
            Tap skills below to add them here...
          </Typography>
        ) : (
          data.skills.map(sk => (
            <SelectedTag key={sk}>
              {sk}
              <CloseIcon onClick={() => toggleArrayItem('skills', sk)} />
            </SelectedTag>
          ))
        )}
      </SelectedSkillsArea>

      {/* One-click baseline — picks the top sector-relevant skills the
          candidate hasn't already added. Zero AI calls, instant value,
          gets new grads to a "good enough" baseline in one tap. */}
      {data.sector && data.skills.length < 5 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            p: 1.5,
            mb: 2,
            borderRadius: 2,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
            border: '1px dashed rgba(99,102,241,0.4)',
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <AIIcon sx={{ fontSize: 18, color: '#6366f1', flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12.5, color: '#475569', fontWeight: 500 }}>
              {sp.skills.autoAddCta} for{' '}
              <strong>{JOB_SECTORS.find(s => s.id === data.sector)?.label || 'your field'}</strong>.
            </Typography>
          </Box>
          <NavButton
            $primary
            type="button"
            onClick={() => suggestSkillsForRole(8)}
            style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}
          >
            <AIIcon style={{ fontSize: 14 }} /> Auto-add top 8
          </NavButton>
        </Box>
      )}

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search skills..."
        value={skillSearch}
        onChange={e => setSkillSearch(e.target.value)}
        onKeyDown={(e) => {
          // Enter on a no-match query is a fast path to add the typed
          // skill as a custom entry.
          if (e.key === 'Enter' && noResults && !alreadyAdded) {
            e.preventDefault();
            handleAddCustomSkill();
          }
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 20, color: '#b0b8d4' }} />
            </InputAdornment>
          )
        }}
        sx={{ ...StyledInput, mb: 2 }}
      />

      {/* Skill categories */}
      <Box sx={{ maxHeight: 300, overflowY: 'auto', pr: 1 }}>
        {noResults ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1.25,
              p: 3,
              borderRadius: 2,
              border: '1px dashed #d4d9e6',
              background: '#fafbfd',
              textAlign: 'center',
            }}
          >
            {alreadyAdded ? (
              <Typography sx={{ fontSize: 13, color: '#7a7f96' }}>
                <strong>&ldquo;{trimmedQuery}&rdquo;</strong> is already in your skills.
              </Typography>
            ) : (
              <>
                <Typography sx={{ fontSize: 13, color: '#7a7f96' }}>
                  No matches in our list. Don&rsquo;t see your skill? Add it anyway.
                </Typography>
                <NavButton
                  $primary
                  type="button"
                  onClick={handleAddCustomSkill}
                  style={{ padding: '6px 14px', fontSize: 12.5 }}
                >
                  <AddIcon style={{ fontSize: 16 }} /> Add &ldquo;{trimmedQuery}&rdquo; as a skill
                </NavButton>
              </>
            )}
          </Box>
        ) : (
          Object.entries(filteredSkills).map(([cat, skills]) => (
            <div key={cat}>
              <CategoryLabel>{cat}</CategoryLabel>
              <SkillChipGrid>
                {skills.map(sk => (
                  <SkillChip
                    key={sk}
                    $selected={data.skills.includes(sk)}
                    onClick={() => toggleArrayItem('skills', sk)}
                  >
                    {data.skills.includes(sk) && <CheckIcon />}
                    {sk}
                  </SkillChip>
                ))}
              </SkillChipGrid>
            </div>
          ))
        )}
      </Box>
    </StepContent>
  );
  };

  const renderStepAvailability = () => (
    <StepContent $dir={animDir} key="step-6">
      <TipBubble>
        <Avatar
          sx={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            fontSize: 12
          }}
        >
          <AIIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Typography sx={{ fontSize: 13, color: '#555c72' }}>
          {AI_TIPS[6]}
        </Typography>
      </TipBubble>

      <Typography
        sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 700, color: '#1a1a2e', mb: 1 }}
      >
        Almost done, a few last details
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: 3 }}>
        This helps us find the right opportunities for you.
      </Typography>

      {/* Salary */}
      <Typography
        sx={{ fontSize: 12, fontWeight: 700, color: '#8b90a3', letterSpacing: 0.5, mb: 1.5, textTransform: 'uppercase' }}
      >
        Minimum expected salary (annual, USD)
      </Typography>
      <SalaryDisplay>
        <Typography sx={{ fontSize: 13, color: '#7a7f96' }}>At least</Typography>
        <Typography
          sx={{
            fontSize: '2rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.2
          }}
        >
          {formatSalary(data.salaryMin)}
        </Typography>
        <Typography sx={{ fontSize: 12, color: '#aab0c0' }}>USD per year</Typography>
      </SalaryDisplay>

      <Box sx={{ px: 2, mb: 4 }}>
        <Slider
          value={data.salaryMin}
          onChange={(_, v) => set('salaryMin', v)}
          min={0}
          max={300000}
          step={5000}
          sx={{
            color: '#667eea',
            '& .MuiSlider-thumb': {
              width: 20,
              height: 20,
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              '&:hover': { boxShadow: '0 0 0 8px rgba(102,126,234,0.15)' }
            },
            '& .MuiSlider-track': {
              background: 'linear-gradient(90deg, #667eea, #764ba2)',
              border: 'none'
            },
            '& .MuiSlider-rail': { background: '#e4e7f0', opacity: 1 }
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 11, color: '#aab0c0' }}>$0</Typography>
          <Typography sx={{ fontSize: 11, color: '#aab0c0' }}>$300k+</Typography>
        </Box>
      </Box>

      {/* Availability */}
      <Typography
        sx={{ fontSize: 12, fontWeight: 700, color: '#8b90a3', letterSpacing: 0.5, mb: 1.5, textTransform: 'uppercase' }}
      >
        Job search status
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {AVAILABILITY_OPTIONS.map(opt => (
          <SelectionCard
            key={opt.id}
            $selected={data.availability === opt.id}
            onClick={() => set('availability', opt.id)}
          >
            <CardIcon $selected={data.availability === opt.id}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: data.availability === opt.id ? 'white' : opt.color
                }}
              />
            </CardIcon>
            <Box>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: 14.5,
                  color: data.availability === opt.id ? 'white' : '#1a1a2e'
                }}
              >
                {opt.label}
              </Typography>
              <Typography
                sx={{
                  fontSize: 12,
                  color: data.availability === opt.id ? 'rgba(255,255,255,0.75)' : '#999'
                }}
              >
                {opt.sub}
              </Typography>
            </Box>
            {data.availability === opt.id && (
              <CheckIcon sx={{ ml: 'auto', fontSize: 20, color: 'white' }} />
            )}
          </SelectionCard>
        ))}
      </Box>
    </StepContent>
  );

  /* ─── NEW: Experience step ──────────────────────────────────────────
     Branched by careerStage. Candidates pick how they describe themselves
     first; experienced ones get an Add-Experience form, while new grads /
     self-taught see a message nudging them to the Projects step instead.
  */
  const inputSx = StyledInput;
  const showExperienceForm = ['experienced', 'internship', 'career_change'].includes(data.careerStage);

  const renderStepExperience = () => {
    const sp = getSectorProfile(data.sector);
    return (
    <StepContent $dir={animDir} key="step-3">
      <TipBubble>
        <Avatar sx={{ width: 28, height: 28, background: 'linear-gradient(135deg, #667eea, #764ba2)', fontSize: 12 }}>
          <AIIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Typography sx={{ fontSize: 13, color: '#555c72' }}>{AI_TIPS[3]}</Typography>
      </TipBubble>

      <Typography sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 700, color: '#1a1a2e', mb: 1 }}>
        {sp.experience.headline}
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: 3 }}>
        {sp.experience.blurb}
      </Typography>

      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8b90a3', letterSpacing: 0.5, mb: 1.5, textTransform: 'uppercase' }}>
        Which one describes you best?
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px', mb: 3 }}>
        {CAREER_STAGES.map((cs) => (
          <SelectionCard
            key={cs.id}
            $selected={data.careerStage === cs.id}
            onClick={() => set('careerStage', cs.id)}
          >
            <CardIcon $selected={data.careerStage === cs.id}>{cs.icon}</CardIcon>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: 14.5, color: data.careerStage === cs.id ? 'white' : '#1a1a2e' }}>
                {cs.label}
              </Typography>
              <Typography sx={{ fontSize: 12, color: data.careerStage === cs.id ? 'rgba(255,255,255,0.75)' : '#999' }}>
                {cs.sub}
              </Typography>
            </Box>
            {data.careerStage === cs.id && <CheckIcon sx={{ ml: 'auto', fontSize: 20, color: 'white' }} />}
          </SelectionCard>
        ))}
      </Box>

      {!data.careerStage && (
        <Box sx={{ p: 2, borderRadius: 2, background: '#f5f3ff', border: '1px dashed #c7d2fe' }}>
          <Typography sx={{ fontSize: 13, color: '#4338ca' }}>
            Pick the option that fits you and we'll only show the right next step.
          </Typography>
        </Box>
      )}

      {!showExperienceForm && data.careerStage && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ p: 2, borderRadius: 2, background: '#ecfeff', border: '1px solid #a5f3fc' }}>
            <Typography sx={{ fontSize: 13.5, color: '#0e7490', fontWeight: 600, mb: 0.5 }}>
              {getStageCopy(data.careerStage).noWorkHistoryCalloutTitle || 'Great — no work history needed.'}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: '#0e7490' }}>
              {getStageCopy(data.careerStage).noWorkHistoryCalloutBody || "We'll highlight your Education and Projects instead. Click Continue to move on."}
            </Typography>
          </Box>
        </Box>
      )}

      {showExperienceForm && (
        <>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8b90a3', letterSpacing: 0.5, mt: 2, mb: 1.5, textTransform: 'uppercase' }}>
            Your {sp.experience.roleNoun}s
          </Typography>
          {data.experience.length === 0 ? (
            <Box sx={{ p: 2.5, borderRadius: 2, border: '1px dashed #c7d2fe', background: '#fafbfd', textAlign: 'center' }}>
              <WorkIcon sx={{ fontSize: 32, color: '#a5b4fc', mb: 1 }} />
              <Typography sx={{ fontSize: 13, color: '#7a7f96', mb: 1.5 }}>
                {getStageCopy(data.careerStage).experienceEmptyNudge || `Add your most recent ${sp.experience.roleNoun} first. Even one entry unlocks AI tailoring.`}
              </Typography>
              <NavButton $primary onClick={() => addRow('experience', EMPTY_EXPERIENCE)}>
                <AddIcon /> Add {sp.experience.roleNoun}
              </NavButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {data.experience.map((exp, idx) => (
                <Box key={idx} sx={{ p: 2, borderRadius: 2, border: '1px solid #e4e7f0', background: '#fff' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#667eea', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      {sp.experience.roleNoun} #{idx + 1}
                    </Typography>
                    <NavButton
                      onClick={() => removeRow('experience', idx)}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      aria-label={`Remove ${sp.experience.roleNoun}`}
                    >
                      <DeleteIcon style={{ fontSize: 16 }} /> Remove
                    </NavButton>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                    <TextField fullWidth size="small" placeholder={sp.experience.titlePlaceholder} value={exp.title} onChange={(e) => updateRow('experience', idx, 'title', e.target.value)} sx={inputSx} />
                    <TextField fullWidth size="small" placeholder={sp.experience.companyPlaceholder} value={exp.company} onChange={(e) => updateRow('experience', idx, 'company', e.target.value)} sx={inputSx} />
                    <TextField fullWidth size="small" placeholder="Start (e.g. Jan 2022)" value={exp.startDate} onChange={(e) => updateRow('experience', idx, 'startDate', e.target.value)} sx={inputSx} />
                    <TextField fullWidth size="small" placeholder={exp.current ? 'Present' : 'End (e.g. Dec 2024)'} value={exp.current ? 'Present' : exp.endDate} onChange={(e) => updateRow('experience', idx, 'endDate', e.target.value)} disabled={exp.current} sx={inputSx} />
                  </Box>
                  <Box sx={{ mt: 1 }}>
                    <label style={{ fontSize: 12.5, color: '#7a7f96', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={!!exp.current}
                        onChange={(e) => {
                          updateRow('experience', idx, 'current', e.target.checked);
                          if (e.target.checked) updateRow('experience', idx, 'endDate', '');
                        }}
                      />
                      I currently work here
                    </label>
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={5}
                    placeholder={sp.experience.descriptionPlaceholder}
                    value={exp.description}
                    onChange={(e) => updateRow('experience', idx, 'description', e.target.value)}
                    sx={{ ...inputSx, mt: 1.5 }}
                  />
                  {/* AI Draft button — turns a one-liner into polished
                      STAR-style bullets via the same /enhance-text endpoint
                      the profile form uses. Disabled until 10+ chars so the
                      backend validator doesn't reject it. We pass
                      sp.experience.aiContextHint so the rewrite is voiced
                      for the candidate's industry (latency for tech, ACV
                      for sales, jurisdiction for legal, etc.). */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.75, gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 11.5, color: (exp.description?.length || 0) < 10 ? '#94a3b8' : outOfAICredits ? '#dc2626' : '#6366f1', fontWeight: 500 }}>
                      {(exp.description?.length || 0) < 10
                        ? 'Add 10+ characters to unlock AI Draft.'
                        : outOfAICredits
                          ? aiOutOfCreditsHelper
                          : sp.experience.descriptionHelper}
                    </Typography>
                    <Tooltip title={aiDraftTooltip}>
                      <span>
                        <NavButton
                          $primary
                          type="button"
                          disabled={(exp.description?.length || 0) < 10 || aiDraftKey === `experience-${idx}` || outOfAICredits}
                          onClick={() => draftWithAI('experience', 'experience', idx, { company: exp.company, title: exp.title, sector: data.sector, hint: sp.experience.aiContextHint })}
                          style={{ padding: '6px 12px', fontSize: 12 }}
                        >
                          {aiDraftKey === `experience-${idx}` ? (
                            <><CircularProgress size={12} sx={{ color: 'inherit' }} /> Drafting…</>
                          ) : (
                            <><AIIcon style={{ fontSize: 14 }} /> AI Draft</>
                          )}
                        </NavButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              ))}
              <NavButton onClick={() => addRow('experience', EMPTY_EXPERIENCE)} style={{ alignSelf: 'flex-start' }}>
                <AddIcon /> Add another {sp.experience.roleNoun}
              </NavButton>
            </Box>
          )}
        </>
      )}
    </StepContent>
    );
  };

  const renderStepEducation = () => {
    const sp = getSectorProfile(data.sector);
    return (
    <StepContent $dir={animDir} key="step-4">
      <TipBubble>
        <Avatar sx={{ width: 28, height: 28, background: 'linear-gradient(135deg, #667eea, #764ba2)', fontSize: 12 }}>
          <AIIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Typography sx={{ fontSize: 13, color: '#555c72' }}>{AI_TIPS[4]}</Typography>
      </TipBubble>

      <Typography sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 700, color: '#1a1a2e', mb: 1 }}>
        {sp.education.headline}
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: sp.education.licenseHint ? 1.5 : 3 }}>
        {sp.education.blurb}
      </Typography>
      {sp.education.licenseHint && (
        <Box sx={{ p: 1.5, mb: 2.5, borderRadius: 2, background: '#fef3c7', border: '1px solid #fde68a' }}>
          <Typography sx={{ fontSize: 12.5, color: '#92400e' }}>
            {sp.education.licenseHint}
          </Typography>
        </Box>
      )}

      {data.education.length === 0 ? (
        <Box sx={{ p: 2.5, borderRadius: 2, border: '1px dashed #c7d2fe', background: '#fafbfd', textAlign: 'center' }}>
          <SchoolIcon sx={{ fontSize: 32, color: '#a5b4fc', mb: 1 }} />
          <Typography sx={{ fontSize: 13, color: '#7a7f96', mb: 1.5 }}>
            Add a degree, bootcamp or certification. You can skip if you'd rather add it later.
          </Typography>
          <NavButton $primary onClick={() => addRow('education', EMPTY_EDUCATION)}>
            <AddIcon /> Add education
          </NavButton>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {data.education.map((edu, idx) => (
            <Box key={idx} sx={{ p: 2, borderRadius: 2, border: '1px solid #e4e7f0', background: '#fff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#667eea', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Entry #{idx + 1}
                </Typography>
                <NavButton onClick={() => removeRow('education', idx)} style={{ padding: '4px 10px', fontSize: 12 }} aria-label="Remove education">
                  <DeleteIcon style={{ fontSize: 16 }} /> Remove
                </NavButton>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <TextField fullWidth size="small" placeholder="Degree (e.g. B.S.)" value={edu.degree} onChange={(e) => updateRow('education', idx, 'degree', e.target.value)} sx={inputSx} />
                <TextField fullWidth size="small" placeholder="Field of study" value={edu.fieldOfStudy} onChange={(e) => updateRow('education', idx, 'fieldOfStudy', e.target.value)} sx={inputSx} />
                <TextField fullWidth size="small" placeholder={sp.education.institutionPlaceholder} value={edu.institution} onChange={(e) => updateRow('education', idx, 'institution', e.target.value)} sx={inputSx} />
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    name={`education.${idx}.startDate`}
                    type="text"
                    inputMode="numeric"
                    placeholder="Start year"
                    value={edu.startDate}
                    inputProps={{ maxLength: 4, pattern: '\\d{4}', inputMode: 'numeric' }}
                    onChange={(e) => {
                      updateRow('education', idx, 'startDate', e.target.value);
                      clearYearError(`education.${idx}.startDate`);
                      // A change to start can also resolve a stale range
                      // error reported under the end field; clear that
                      // optimistically and let onBlur re-evaluate.
                      clearYearError(`education.${idx}.endDate`);
                    }}
                    onBlur={(e) => handleYearBlur(idx, 'startDate', e.target.value)}
                    error={!!yearErrors[`education.${idx}.startDate`]}
                    helperText={yearErrors[`education.${idx}.startDate`] || ''}
                    sx={inputSx}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    name={`education.${idx}.endDate`}
                    type="text"
                    inputMode="numeric"
                    placeholder="End year"
                    value={edu.endDate}
                    inputProps={{ maxLength: 4, pattern: '\\d{4}', inputMode: 'numeric' }}
                    onChange={(e) => {
                      updateRow('education', idx, 'endDate', e.target.value);
                      clearYearError(`education.${idx}.endDate`);
                    }}
                    onBlur={(e) => handleYearBlur(idx, 'endDate', e.target.value)}
                    error={!!yearErrors[`education.${idx}.endDate`]}
                    helperText={yearErrors[`education.${idx}.endDate`] || ''}
                    sx={inputSx}
                  />
                </Box>
              </Box>
            </Box>
          ))}
          <NavButton onClick={() => addRow('education', EMPTY_EDUCATION)} style={{ alignSelf: 'flex-start' }}>
            <AddIcon /> Add another
          </NavButton>
        </Box>
      )}
    </StepContent>
    );
  };

  const renderStepProjects = () => {
    // Sector-driven copy / nomenclature / portfolio input. A Lawyer
    // sees "Matters & publications" with a state-bar link; a Designer
    // sees "Case studies" with Behance/Dribbble; a Salesperson sees
    // "Notable deals & playbooks" with LinkedIn. Defaults are neutral
    // for the "no sector chosen yet" case.
    const sp = getSectorProfile(data.sector);
    const isGithubField = sp.portfolio.field === 'githubUsername';
    const portfolioValue = isGithubField ? data.githubUsername : data.portfolioUrl;
    const setPortfolio = (v) => set(sp.portfolio.field, v);

    // Pick the right tip for the user's situation. AI_TIPS[5] is the
    // new-grad framing ("No work history yet? Side projects are how new
    // grads stand out.") which made no sense for a self-identified
    // experienced candidate. Logic:
    //   - careerStage === 'new_grad'                  → new-grad copy
    //   - has ≥1 experience entry                     → work-history copy
    //   - careerStage === 'experienced' (even if 0)   → work-history copy
    //   - otherwise (zero roles, no stage chosen)     → new-grad copy
    const hasWorkHistory = (data.experience || []).length > 0;
    const isNewGrad = data.careerStage === 'new_grad';
    const claimsExperience = data.careerStage === 'experienced';
    const useNewGradTip = isNewGrad || (!hasWorkHistory && !claimsExperience);
    const projectsTip = useNewGradTip
      ? AI_TIPS[5]
      : 'Highlight 1–3 projects with measurable impact — it’s how recruiters see what you’ve actually shipped.';

    return (
    <StepContent $dir={animDir} key="step-5">
      <TipBubble>
        <Avatar sx={{ width: 28, height: 28, background: 'linear-gradient(135deg, #667eea, #764ba2)', fontSize: 12 }}>
          <AIIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Typography sx={{ fontSize: 13, color: '#555c72' }}>{projectsTip}</Typography>
      </TipBubble>

      <Typography sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 700, color: '#1a1a2e', mb: 1 }}>
        {sp.projects.headline}
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: 3 }}>
        {sp.projects.blurb}
        {getStageCopy(data.careerStage).projectsSpotlight && (
          <> <strong style={{ color: '#4338ca' }}>{getStageCopy(data.careerStage).projectsSpotlight}</strong></>
        )}
      </Typography>

      {/* Sector-aware AI-agent portfolio panel. Tech / data ask for a
          GitHub handle; design asks for Behance/Dribbble; legal asks
          for a bar / SSRN URL; everyone else gets a generic portfolio /
          LinkedIn URL. All driven by sectorProfiles.ts. */}
      <Box sx={{ p: 2, mb: 2.5, borderRadius: 2, background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', border: '1px solid #ddd6fe' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <AIIcon sx={{ fontSize: 18, color: '#6366f1' }} />
          <Typography sx={{ fontSize: 13.5, color: '#4338ca', fontWeight: 700 }}>
            {sp.agentTitle}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 12.5, color: '#4338ca', mb: 1.25, lineHeight: 1.5 }}>
          {sp.agentBlurb}
        </Typography>
        <TextField
          fullWidth
          size="small"
          name="portfolio"
          type={isGithubField ? 'text' : 'url'}
          inputMode={isGithubField ? 'text' : 'url'}
          placeholder={sp.portfolio.placeholder}
          value={portfolioValue}
          onChange={(e) => {
            setPortfolio(e.target.value);
            if (!isGithubField) clearUrlError('portfolio');
          }}
          onBlur={(e) => {
            // Skip URL validation in githubUsername mode — the handoff
            // accepts either a bare handle or a full URL and normalises it.
            if (isGithubField) return;
            handleUrlBlur('portfolio', e.target.value, { fieldLabel: 'Portfolio URL' });
          }}
          error={!isGithubField && !!urlErrors.portfolio}
          helperText={!isGithubField ? (urlErrors.portfolio || '') : ''}
          InputProps={sp.portfolio.prefix ? {
            startAdornment: (
              <InputAdornment position="start">
                <Typography sx={{ fontSize: 13, color: '#6366f1', fontWeight: 600 }}>{sp.portfolio.prefix}</Typography>
              </InputAdornment>
            ),
          } : undefined}
          sx={inputSx}
        />
        <Typography sx={{ fontSize: 11.5, color: '#6366f1', mt: 0.75 }}>
          {sp.portfolio.helper}
        </Typography>
      </Box>

      {data.projects.length === 0 ? (
        <Box sx={{ p: 2.5, borderRadius: 2, border: '1px dashed #c7d2fe', background: '#fafbfd', textAlign: 'center' }}>
          <CodeIcon sx={{ fontSize: 32, color: '#a5b4fc', mb: 1 }} />
          <Typography sx={{ fontSize: 13, color: '#7a7f96', mb: 1.5 }}>
            Add at least one {sp.projects.noun.toLowerCase()} to give AI something to tailor against.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            <NavButton $primary onClick={() => addRow('projects', EMPTY_PROJECT)}>
              <AddIcon /> Add manually
            </NavButton>
            <NavButton
              type="button"
              onClick={() => setIdeasOpen(true)}
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none' }}
            >
              <AIIcon style={{ fontSize: 14 }} /> Suggest ideas with AI
            </NavButton>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 1.25 }}>
            Nothing yet? AI will recommend recruiter-loved {sp.projects.nounPlural.toLowerCase()} you can ship this month.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {data.projects.map((p, idx) => (
            <Box key={idx} sx={{ p: 2, borderRadius: 2, border: '1px solid #e4e7f0', background: '#fff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#667eea', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {sp.projects.noun} #{idx + 1}
                </Typography>
                <NavButton onClick={() => removeRow('projects', idx)} style={{ padding: '4px 10px', fontSize: 12 }} aria-label="Remove">
                  <DeleteIcon style={{ fontSize: 16 }} /> Remove
                </NavButton>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <TextField fullWidth size="small" placeholder={sp.projects.titlePlaceholder} value={p.title} onChange={(e) => updateRow('projects', idx, 'title', e.target.value)} sx={inputSx} />
                <TextField fullWidth size="small" placeholder={sp.projects.rolePlaceholder} value={p.role} onChange={(e) => updateRow('projects', idx, 'role', e.target.value)} sx={inputSx} />
              </Box>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={5}
                placeholder={sp.projects.descriptionPlaceholder}
                value={p.description}
                onChange={(e) => updateRow('projects', idx, 'description', e.target.value)}
                sx={{ ...inputSx, mt: 1.5 }}
              />
              {/* AI Draft on project descriptions — same pattern as
                  Experience. Helps candidates turn a rough sentence into
                  a recruiter-friendly bullet (problem / approach / result). */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.75, gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 11.5, color: (p.description?.length || 0) < 10 ? '#94a3b8' : outOfAICredits ? '#dc2626' : '#6366f1', fontWeight: 500 }}>
                  {(p.description?.length || 0) < 10
                    ? 'Add 10+ characters to unlock AI Draft.'
                    : outOfAICredits
                      ? aiOutOfCreditsHelper
                      : 'AI rewrites as problem → approach → impact.'}
                </Typography>
                <Tooltip title={aiDraftTooltip}>
                  <span>
                    <NavButton
                      $primary
                      type="button"
                      disabled={(p.description?.length || 0) < 10 || aiDraftKey === `projects-${idx}` || outOfAICredits}
                      onClick={() => draftWithAI('project', 'projects', idx, { title: p.title, role: p.role })}
                      style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                      {aiDraftKey === `projects-${idx}` ? (
                        <><CircularProgress size={12} sx={{ color: 'inherit' }} /> Drafting…</>
                      ) : (
                        <><AIIcon style={{ fontSize: 14 }} /> AI Draft</>
                      )}
                    </NavButton>
                  </span>
                </Tooltip>
              </Box>
              <TextField
                fullWidth
                size="small"
                name={`projects.${idx}.url`}
                type="url"
                inputMode="url"
                placeholder={sp.projects.urlPlaceholder}
                value={p.url}
                onChange={(e) => {
                  updateRow('projects', idx, 'url', e.target.value);
                  clearUrlError(`projects.${idx}.url`);
                }}
                onBlur={(e) =>
                  handleUrlBlur(`projects.${idx}.url`, e.target.value, { fieldLabel: 'Project URL' })
                }
                error={!!urlErrors[`projects.${idx}.url`]}
                helperText={urlErrors[`projects.${idx}.url`] || ''}
                sx={{ ...inputSx, mt: 1.5 }}
              />
            </Box>
          ))}
          <NavButton onClick={() => addRow('projects', EMPTY_PROJECT)} style={{ alignSelf: 'flex-start' }}>
            <AddIcon /> Add another {sp.projects.noun.toLowerCase()}
          </NavButton>
        </Box>
      )}
    </StepContent>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: return renderStepIdentity();
      case 1: return renderStepPreferences();
      case 2: return renderStepSkills();
      case 3: return renderStepExperience();
      case 4: return renderStepEducation();
      case 5: return renderStepProjects();
      case 6: return renderStepAvailability();
      default: return null;
    }
  };

  /* ─── RENDER ─── */
  return (
    <PageContainer>
      <TopBar>
        <Logo onClick={() => navigate('/')}>
          <AIIcon />
          <Typography
            component="span"
            sx={{
              fontWeight: 900,
              fontSize: '1.25rem',
              letterSpacing: '-0.02em',
              color: '#1a1a2e',
              lineHeight: 1,
            }}
          >
            <BrandWordmark accentColor="#6366f1" />
          </Typography>
        </Logo>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AICreditsBadge />
          <SkipLink onClick={handleSkip}>
            Skip for now →
          </SkipLink>
        </Box>
      </TopBar>

      <MainContent>
        {/* Profile-strength meter — live signal of how close they are
            to a recruiter-ready profile. Turns "step 4 of 7" anxiety
            into momentum. */}
        <Box
          sx={{
            mb: 2.5,
            p: 1.75,
            borderRadius: 2,
            border: '1px solid #e4e7f0',
            backgroundColor: '#fff',
            boxShadow: '0 4px 14px -10px rgba(15,23,42,0.18)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75, gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 12, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Profile strength
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: profileStrength.color }}>
                {profileStrength.label}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: '#94a3b8', fontWeight: 600 }}>
                · {profileStrength.pct}%
              </Typography>
            </Box>
          </Box>
          <Box sx={{ position: 'relative', height: 6, borderRadius: 999, backgroundColor: '#eef2f7', overflow: 'hidden' }}>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                width: `${profileStrength.pct}%`,
                background: `linear-gradient(90deg, ${profileStrength.color}, ${profileStrength.color}cc)`,
                borderRadius: 999,
                transition: 'width 0.5s cubic-bezier(.4,0,.2,1)',
              }}
            />
          </Box>
        </Box>

        {/* Step indicator */}
        <StepIndicator>
          {STEPS.map((step, i) => (
            <React.Fragment key={step.id}>
              {i > 0 && <StepLine $done={i <= currentStep} />}
              <StepDot
                $state={
                  i < currentStep
                    ? 'completed'
                    : i === currentStep
                      ? 'active'
                      : 'upcoming'
                }
              >
                {i < currentStep ? (
                  <CheckIcon sx={{ fontSize: 18 }} />
                ) : (
                  i + 1
                )}
                <StepLabel $active={i === currentStep}>
                  {step.label}
                </StepLabel>
              </StepDot>
            </React.Fragment>
          ))}
        </StepIndicator>

        {/* Wizard card */}
        <WizardCard>
          {renderStep()}

          {/* Inline AI error surface — only shows when an /enhance-text
              call fails or the user clicked Draft on too-short text. */}
          {aiDraftError && (
            <Box
              sx={{
                mt: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Typography sx={{ fontSize: 12.5, color: '#b91c1c' }}>
                {aiDraftError}
              </Typography>
              <Button
                size="small"
                onClick={() => setAiDraftError('')}
                sx={{ textTransform: 'none', color: '#b91c1c', minWidth: 0, fontWeight: 700, fontSize: 12 }}
              >
                Dismiss
              </Button>
            </Box>
          )}

          <NavRow>
            <NavButton onClick={goBack}>
              <BackIcon /> Back
            </NavButton>

            {currentStep < STEPS.length - 1 ? (
              <NavButton $primary onClick={goNext} disabled={!canProceed}>
                Continue <ArrowIcon />
              </NavButton>
            ) : (
              <FinishButton $primary onClick={handleFinish}>
                Build My Profile <ArrowIcon />
              </FinishButton>
            )}
          </NavRow>
        </WizardCard>
      </MainContent>

      {/* AI project ideas \u2014 sector-curated recruiter-loved portfolio
          projects. One click adds it to the projects array. */}
      <ProjectIdeasModal
        open={ideasOpen}
        onClose={() => setIdeasOpen(false)}
        sector={data.sector}
        onAdd={(project) => {
          setData(prev => ({ ...prev, projects: [...(prev.projects || []), project] }));
          setIdeasOpen(false);
        }}
      />
      <ConfirmModal
        show={showGuestSignupPrompt}
        onClose={() => setShowGuestSignupPrompt(false)}
        onConfirm={() => navigate('/register?role=candidate')}
        variant="info"
        title="Create a free account first"
        message="AI Draft needs a signed-in account. Your progress here stays right where it is — sign up and pick up where you left off."
        confirmText="Sign Up"
        cancelText="Maybe later"
      />
    </PageContainer>
  );
};

export default JobPreferencesWizard;

/* ═══════════════════════════════════════════════════════
   DATA & CONSTANTS
   ═══════════════════════════════════════════════════════ */

// Popular titles are now dynamic based on selected sector
// See: ../constants/jobSectors.js

// Skill suggestions are now dynamic based on selected sector
// See: ../constants/jobSectors.js
