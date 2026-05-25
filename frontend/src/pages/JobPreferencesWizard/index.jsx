import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Typography,
  TextField,
  Autocomplete,
  Slider,
  InputAdornment,
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
  LocationOn as LocationIcon
} from '@mui/icons-material';
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
import { ROUTES, STEPS, EXPERIENCE_LEVELS, EMPLOYMENT_TYPES, AVAILABILITY_OPTIONS, AI_TIPS, LIMITS, LOCALSTORAGE_KEY, TEXT, JOB_SECTORS, SECTOR_TITLES, ALL_TITLES, SECTOR_SKILLS, ALL_SKILLS } from './constants';

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

const JobPreferencesWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [animDir, setAnimDir] = useState('right');
  const [skillSearch, setSkillSearch] = useState('');

  const [data, setData] = useState({
    sector: '',
    title: '',
    experienceLevel: '',
    employmentTypes: [],
    workSetup: '',
    location: '',
    skills: [],
    salaryMin: 60000,
    availability: ''
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

    // Navigate to ProfileForm with pre-filled data (matching resumeData shape)
    navigate('/profile/create-form', {
      state: {
        source: 'wizard',
        resumeData: {
          title: data.title,
          location: data.location,
          skills: data.skills,
          summary: '',
          experience: [],
          education: [],
          projects: []
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
      case 1: return data.employmentTypes.length > 0 || data.workSetup;
      case 2: return true; // skills are optional
      case 3: return true;
      default: return true;
    }
  }, [currentStep, data]);

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
        sx={{ fontSize: 12, fontWeight: 700, color: '#8b90a3', letterSpacing: 0.5, mb: 1.5, textTransform: 'uppercase' }}
      >
        Preferred work arrangement
      </Typography>
      <WorkSetupGrid>
        {WORK_SETUPS.map(ws => (
          <WorkCard
            key={ws.id}
            $selected={data.workSetup === ws.id}
            onClick={() => set('workSetup', ws.id)}
          >
            <ws.Icon />
            <Typography
              sx={{
                fontWeight: 600, fontSize: 14,
                color: data.workSetup === ws.id ? 'white' : '#1a1a2e'
              }}
            >
              {ws.label}
            </Typography>
            <Typography
              sx={{
                fontSize: 11.5,
                color: data.workSetup === ws.id ? 'rgba(255,255,255,0.7)' : '#999'
              }}
            >
              {ws.sub}
            </Typography>
          </WorkCard>
        ))}
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
    <StepContent $dir={animDir} key="step-3">
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
          {AI_TIPS[3]}
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

  const renderStep = () => {
    switch (currentStep) {
      case 0: return renderStepIdentity();
      case 1: return renderStepPreferences();
      case 2: return renderStepSkills();
      case 3: return renderStepAvailability();
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
