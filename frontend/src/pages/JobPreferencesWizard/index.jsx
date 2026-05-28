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
  Code as CodeIcon,
  RocketLaunch as RocketIcon
} from '@mui/icons-material';
import NoExperienceBoostModal from '../../components/NoExperienceBoostModal';
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
  return merged;
};

const JobPreferencesWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [animDir, setAnimDir] = useState('right');
  const [skillSearch, setSkillSearch] = useState('');
  // Boost modal: auto-opens once per careerStage selection. We also track
  // the last stage we opened for so switching back and forth doesn't spam
  // the user with the same modal.
  const [boostOpen, setBoostOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [lastBoostStage, setLastBoostStage] = useState(null);
  // Per-row AI draft loading flags. Keyed as `${field}-${index}` so each
  // textarea has its own spinner / disabled state.
  const [aiDraftKey, setAiDraftKey] = useState(null);
  const [aiDraftError, setAiDraftError] = useState('');

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
    }
  };

  const handleSkip = () => {
    navigate('/profile/create-form');
  };

  const handleFinish = () => {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore quota / private-mode errors
    }

    // Strip empty rows so the ProfileForm doesn't render a bunch of blank
    // cards when the candidate skipped a section.
    const cleanedExperience = (data.experience || []).filter(
      (e) => (e.title || '').trim() || (e.company || '').trim() || (e.description || '').trim()
    );
    const cleanedEducation = (data.education || []).filter(
      (e) => (e.degree || '').trim() || (e.institution || '').trim() || (e.fieldOfStudy || '').trim()
    );
    const cleanedProjects = (data.projects || []).filter(
      (p) => (p.title || '').trim() || (p.description || '').trim()
    );

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
      case 4: return true; // education optional
      case 5: return true; // projects optional
      case 6: return true;
      default: return true;
    }
  }, [currentStep, data]);

  // Live profile-strength score. 7 signals × ~14% each. Used in the meter
  // at the top of the wizard so candidates can see momentum build as they
  // fill things in — turns a long form into a progress game.
  const profileStrength = useMemo(() => {
    const signals = [
      !!data.title.trim(),                                  // role
      !!data.sector,                                        // industry
      data.employmentTypes.length + data.workSetups.length > 0,
      data.skills.length >= 3,                              // some skills
      data.experience.length > 0 || data.careerStage !== '',// stage chosen
      data.education.length > 0,                            // education
      data.projects.length > 0 || !!data.githubUsername || !!data.portfolioUrl,
    ];
    const pct = Math.round((signals.filter(Boolean).length / signals.length) * 100);
    const tier = pct >= 85 ? { label: 'Outstanding', color: '#16a34a' }
      : pct >= 60 ? { label: 'Strong', color: '#6366f1' }
      : pct >= 35 ? { label: 'Building', color: '#f59e0b' }
      : { label: 'Just starting', color: '#94a3b8' };
    return { pct, ...tier };
  }, [data]);

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

  // Auto-open the growth-playbook modal the first time a user picks any of
  // the no-traditional-experience career stages. We avoid re-opening when
  // they toggle between the same set of stages so it never feels naggy.
  const NO_EXP_STAGES = ['new_grad', 'self_taught', 'internship', 'career_change'];
  useEffect(() => {
    if (
      NO_EXP_STAGES.includes(data.careerStage) &&
      data.careerStage !== lastBoostStage
    ) {
      setBoostOpen(true);
      setLastBoostStage(data.careerStage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.careerStage]);

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
  }, [data, updateRow]);

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
              set('sector', sec.id);
              // Reset title if it was from a different sector's suggestions
              if (data.title && SECTOR_TITLES[sec.id] && !SECTOR_TITLES[sec.id].includes(data.title)) {
                // Keep custom-typed titles, only clear if it was a suggested title from another sector
                const wasFromSuggestion = Object.values(SECTOR_TITLES).flat().includes(data.title);
                if (wasFromSuggestion) set('title', '');
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

  const renderStepSkills = () => (
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
        What are your top skills?
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: 2 }}>
        {data.sector
          ? `Showing skills for ${JOB_SECTORS.find(s => s.id === data.sector)?.label || 'your field'}, you can always search for more.`
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
              Don&apos;t know where to start? Add the most-requested skills for{' '}
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
        {Object.entries(filteredSkills).map(([cat, skills]) => (
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
        ))}
      </Box>
    </StepContent>
  );

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

  const renderStepExperience = () => (
    <StepContent $dir={animDir} key="step-3">
      <TipBubble>
        <Avatar sx={{ width: 28, height: 28, background: 'linear-gradient(135deg, #667eea, #764ba2)', fontSize: 12 }}>
          <AIIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Typography sx={{ fontSize: 13, color: '#555c72' }}>{AI_TIPS[3]}</Typography>
      </TipBubble>

      <Typography sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 700, color: '#1a1a2e', mb: 1 }}>
        Tell us about your work experience
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: 3 }}>
        We'll use this to power the Tailor and Enhance AI features. Don't worry — you can edit everything later.
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
              Great — no work history needed.
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: '#0e7490' }}>
              We'll highlight your Education and Projects instead, which is exactly what hiring managers look at for {data.careerStage === 'new_grad' ? 'new grads' : data.careerStage === 'self_taught' ? 'self-taught candidates' : 'career changers'}. Click Continue to move on.
            </Typography>
          </Box>

          {/* Re-open the growth playbook modal. We auto-open it once on
              first stage selection (see useEffect above); this button lets
              the candidate come back to it without leaving the wizard. */}
          <Box
            role="button"
            tabIndex={0}
            onClick={() => setBoostOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setBoostOpen(true);
              }
            }}
            sx={{
              p: 2,
              borderRadius: 2,
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
              border: '1px solid #ddd6fe',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: '#a5b4fc', boxShadow: '0 4px 12px -6px rgba(99,102,241,0.3)' },
              '&:focus-visible': { outline: '2px solid #6366f1', outlineOffset: 2 },
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <RocketIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13.5, color: '#4338ca', fontWeight: 700 }}>
                Want to gain real experience fast?
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: '#4338ca' }}>
                Open our 5-step growth playbook — curated paths that count as real roles.
              </Typography>
            </Box>
            <ArrowIcon sx={{ color: '#6366f1', flexShrink: 0 }} />
          </Box>
        </Box>
      )}

      {showExperienceForm && (
        <>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8b90a3', letterSpacing: 0.5, mt: 2, mb: 1.5, textTransform: 'uppercase' }}>
            Your roles
          </Typography>
          {data.experience.length === 0 ? (
            <Box sx={{ p: 2.5, borderRadius: 2, border: '1px dashed #c7d2fe', background: '#fafbfd', textAlign: 'center' }}>
              <WorkIcon sx={{ fontSize: 32, color: '#a5b4fc', mb: 1 }} />
              <Typography sx={{ fontSize: 13, color: '#7a7f96', mb: 1.5 }}>
                Add your most recent role first. Even one entry unlocks AI tailoring.
              </Typography>
              <NavButton $primary onClick={() => addRow('experience', EMPTY_EXPERIENCE)}>
                <AddIcon /> Add experience
              </NavButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {data.experience.map((exp, idx) => (
                <Box key={idx} sx={{ p: 2, borderRadius: 2, border: '1px solid #e4e7f0', background: '#fff' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#667eea', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      Role #{idx + 1}
                    </Typography>
                    <NavButton
                      onClick={() => removeRow('experience', idx)}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      aria-label="Remove role"
                    >
                      <DeleteIcon style={{ fontSize: 16 }} /> Remove
                    </NavButton>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                    <TextField fullWidth size="small" placeholder="Job title (e.g. Senior Frontend Engineer)" value={exp.title} onChange={(e) => updateRow('experience', idx, 'title', e.target.value)} sx={inputSx} />
                    <TextField fullWidth size="small" placeholder="Company" value={exp.company} onChange={(e) => updateRow('experience', idx, 'company', e.target.value)} sx={inputSx} />
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
                    placeholder="What did you do? Highlight one or two impactful things — AI will polish later."
                    value={exp.description}
                    onChange={(e) => updateRow('experience', idx, 'description', e.target.value)}
                    sx={{ ...inputSx, mt: 1.5 }}
                  />
                  {/* AI Draft button — turns a one-liner into polished
                      STAR-style bullets via the same /enhance-text endpoint
                      the profile form uses. Disabled until 10+ chars so the
                      backend validator doesn't reject it. */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.75, gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 11.5, color: (exp.description?.length || 0) < 10 ? '#94a3b8' : '#6366f1', fontWeight: 500 }}>
                      {(exp.description?.length || 0) < 10
                        ? 'Add 10+ characters to unlock AI Draft.'
                        : 'AI rewrites as impact-driven bullets — keeps your facts.'}
                    </Typography>
                    <Tooltip title="Costs 1 AI credit">
                      <span>
                        <NavButton
                          $primary
                          type="button"
                          disabled={(exp.description?.length || 0) < 10 || aiDraftKey === `experience-${idx}`}
                          onClick={() => draftWithAI('experience', 'experience', idx, { company: exp.company, title: exp.title })}
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
                <AddIcon /> Add another role
              </NavButton>
            </Box>
          )}
        </>
      )}
    </StepContent>
  );

  const renderStepEducation = () => (
    <StepContent $dir={animDir} key="step-4">
      <TipBubble>
        <Avatar sx={{ width: 28, height: 28, background: 'linear-gradient(135deg, #667eea, #764ba2)', fontSize: 12 }}>
          <AIIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Typography sx={{ fontSize: 13, color: '#555c72' }}>{AI_TIPS[4]}</Typography>
      </TipBubble>

      <Typography sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 700, color: '#1a1a2e', mb: 1 }}>
        Your education
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: 3 }}>
        Degree, bootcamp, certification — all of it counts. Recruiters scan for fit and credibility here.
      </Typography>

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
                <TextField fullWidth size="small" placeholder="Degree (e.g. B.S. Computer Science)" value={edu.degree} onChange={(e) => updateRow('education', idx, 'degree', e.target.value)} sx={inputSx} />
                <TextField fullWidth size="small" placeholder="Field of study" value={edu.fieldOfStudy} onChange={(e) => updateRow('education', idx, 'fieldOfStudy', e.target.value)} sx={inputSx} />
                <TextField fullWidth size="small" placeholder="Institution" value={edu.institution} onChange={(e) => updateRow('education', idx, 'institution', e.target.value)} sx={inputSx} />
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <TextField fullWidth size="small" placeholder="Start year" value={edu.startDate} onChange={(e) => updateRow('education', idx, 'startDate', e.target.value)} sx={inputSx} />
                  <TextField fullWidth size="small" placeholder="End year" value={edu.endDate} onChange={(e) => updateRow('education', idx, 'endDate', e.target.value)} sx={inputSx} />
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

  const renderStepProjects = () => (
    <StepContent $dir={animDir} key="step-5">
      <TipBubble>
        <Avatar sx={{ width: 28, height: 28, background: 'linear-gradient(135deg, #667eea, #764ba2)', fontSize: 12 }}>
          <AIIcon sx={{ fontSize: 16 }} />
        </Avatar>
        <Typography sx={{ fontSize: 13, color: '#555c72' }}>{AI_TIPS[5]}</Typography>
      </TipBubble>

      <Typography sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 700, color: '#1a1a2e', mb: 1 }}>
        Projects you've worked on
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#7a7f96', mb: 3 }}>
        Side projects, school work, open source, hackathons — anything that shows what you can build.
        {['new_grad', 'self_taught', 'career_change'].includes(data.careerStage) && (
          <> <strong style={{ color: '#4338ca' }}>This is your spotlight if you don't have much work history yet.</strong></>
        )}
      </Typography>

      {/* AI agent project-discovery panel. For tech sectors we ask for a
          GitHub username so the agent can scan public repos and recommend
          which ones to feature. For every other sector we ask for a single
          portfolio / Behance / Dribbble / personal-site URL it can crawl. */}
      <Box sx={{ p: 2, mb: 2.5, borderRadius: 2, background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', border: '1px solid #ddd6fe' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <AIIcon sx={{ fontSize: 18, color: '#6366f1' }} />
          <Typography sx={{ fontSize: 13.5, color: '#4338ca', fontWeight: 700 }}>
            Let our AI agent find your best work
          </Typography>
        </Box>
        {data.sector === 'tech' || ['data', 'product'].includes(data.sector) ? (
          <>
            <Typography sx={{ fontSize: 12.5, color: '#4338ca', mb: 1.25, lineHeight: 1.5 }}>
              Drop your GitHub username — the agent will scan your public repos and suggest the top projects to feature (stars, recency, README quality, language match with your target role).
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="github.com/your-username  or just  your-username"
              value={data.githubUsername}
              onChange={(e) => set('githubUsername', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ fontSize: 13, color: '#6366f1', fontWeight: 600 }}>github.com/</Typography>
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
            <Typography sx={{ fontSize: 11.5, color: '#6366f1', mt: 0.75 }}>
              Optional. We only read public repos — nothing is changed or committed.
            </Typography>
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: 12.5, color: '#4338ca', mb: 1.25, lineHeight: 1.5 }}>
              Share your portfolio, personal site, Behance, Dribbble, Medium or any link that showcases your work. The agent will review it and recommend which projects to feature here.
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="https://your-portfolio.com"
              value={data.portfolioUrl}
              onChange={(e) => set('portfolioUrl', e.target.value)}
              sx={inputSx}
            />
            <Typography sx={{ fontSize: 11.5, color: '#6366f1', mt: 0.75 }}>
              Optional. Public pages only — the agent reads, never posts.
            </Typography>
          </>
        )}
      </Box>

      {data.projects.length === 0 ? (
        <Box sx={{ p: 2.5, borderRadius: 2, border: '1px dashed #c7d2fe', background: '#fafbfd', textAlign: 'center' }}>
          <CodeIcon sx={{ fontSize: 32, color: '#a5b4fc', mb: 1 }} />
          <Typography sx={{ fontSize: 13, color: '#7a7f96', mb: 1.5 }}>
            Add at least one project to give AI something to tailor against.
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
            No projects yet? AI will recommend recruiter-loved ones you can build this weekend.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {data.projects.map((p, idx) => (
            <Box key={idx} sx={{ p: 2, borderRadius: 2, border: '1px solid #e4e7f0', background: '#fff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#667eea', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Project #{idx + 1}
                </Typography>
                <NavButton onClick={() => removeRow('projects', idx)} style={{ padding: '4px 10px', fontSize: 12 }} aria-label="Remove project">
                  <DeleteIcon style={{ fontSize: 16 }} /> Remove
                </NavButton>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <TextField fullWidth size="small" placeholder="Project title" value={p.title} onChange={(e) => updateRow('projects', idx, 'title', e.target.value)} sx={inputSx} />
                <TextField fullWidth size="small" placeholder="Your role (e.g. Sole developer)" value={p.role} onChange={(e) => updateRow('projects', idx, 'role', e.target.value)} sx={inputSx} />
              </Box>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={5}
                placeholder="What is it? What did you build? What was the impact?"
                value={p.description}
                onChange={(e) => updateRow('projects', idx, 'description', e.target.value)}
                sx={{ ...inputSx, mt: 1.5 }}
              />
              {/* AI Draft on project descriptions — same pattern as
                  Experience. Helps candidates turn a rough sentence into
                  a recruiter-friendly bullet (problem / approach / result). */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.75, gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 11.5, color: (p.description?.length || 0) < 10 ? '#94a3b8' : '#6366f1', fontWeight: 500 }}>
                  {(p.description?.length || 0) < 10
                    ? 'Add 10+ characters to unlock AI Draft.'
                    : 'AI rewrites as problem → approach → impact.'}
                </Typography>
                <Tooltip title="Costs 1 AI credit">
                  <span>
                    <NavButton
                      $primary
                      type="button"
                      disabled={(p.description?.length || 0) < 10 || aiDraftKey === `projects-${idx}`}
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
                placeholder="Link (GitHub, live demo, write-up)"
                value={p.url}
                onChange={(e) => updateRow('projects', idx, 'url', e.target.value)}
                sx={{ ...inputSx, mt: 1.5 }}
              />
            </Box>
          ))}
          <NavButton onClick={() => addRow('projects', EMPTY_PROJECT)} style={{ alignSelf: 'flex-start' }}>
            <AddIcon /> Add another project
          </NavButton>
        </Box>
      )}
    </StepContent>
  );

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
            sx={{
              fontWeight: 700,
              fontSize: '1.1rem',
              letterSpacing: '-0.3px',
              color: '#1a1a2e'
            }}
          >
            ProfilleAI
          </Typography>
        </Logo>
        <SkipLink onClick={handleSkip}>
          Skip for now →
        </SkipLink>
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
            {currentStep > 0 ? (
              <NavButton onClick={goBack}>
                <BackIcon /> Back
              </NavButton>
            ) : (
              <div />
            )}

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

      {/* Growth playbook \u2014 auto-opens once when a no-experience career
          stage is selected, re-openable from the Experience step card. */}
      <NoExperienceBoostModal
        open={boostOpen}
        onClose={() => setBoostOpen(false)}
        careerStage={data.careerStage}
        onOpenProjectIdeas={() => setIdeasOpen(true)}
      />

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
