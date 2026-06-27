import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { useApplyPilotConfig, saveApplyPilotConfig } from '../../hooks/useApplyPilot';
import { profileAPI, applyPilotAPI } from '../../services/api';

const SENIORITY = ['Junior', 'Mid', 'Senior', 'Staff+', 'Principal', 'Lead / EM'];
const INDUSTRY_OPTIONS = [
  'Fintech', 'Infrastructure', 'Dev tools',
  'AI / ML', 'Healthcare', 'E-commerce',
  'Gaming', 'Media',
];

// Family-aware title suggestions. The wizard used to hardcode an
// SRE/Platform pool which felt off-brand for any candidate whose
// profile didn't already say "SRE". Instead we pick a small family
// of synonyms relevant to the candidate's actual title so the
// unchecked suggestion chips read as personalised.
const TITLE_FAMILIES = {
  frontend: [
    'Senior Frontend Engineer', 'Staff Frontend Engineer',
    'UI Engineer', 'Web Engineer', 'React Engineer',
    'Senior Software Engineer', 'Frontend Platform Lead',
  ],
  backend: [
    'Senior Backend Engineer', 'Staff Backend Engineer',
    'Senior Software Engineer', 'Staff Software Engineer',
    'API Engineer', 'Platform Engineer',
  ],
  fullstack: [
    'Senior Full-Stack Engineer', 'Staff Full-Stack Engineer',
    'Senior Software Engineer', 'Product Engineer',
    'Senior Frontend Engineer', 'Senior Backend Engineer',
  ],
  mobile: [
    'Senior iOS Engineer', 'Senior Android Engineer',
    'Staff Mobile Engineer', 'Senior Mobile Engineer',
    'React Native Engineer',
  ],
  data: [
    'Senior Data Engineer', 'Staff Data Engineer',
    'Senior Analytics Engineer', 'Senior ML Engineer',
    'Senior Software Engineer',
  ],
  ml: [
    'Senior ML Engineer', 'Staff ML Engineer',
    'Senior Machine Learning Engineer', 'Applied Scientist',
    'Senior Data Scientist',
  ],
  infra: [
    'Senior SRE', 'Staff SRE', 'Platform Engineer',
    'Infrastructure Engineer', 'DevOps Engineer',
    'Cloud Engineer', 'Reliability Lead',
  ],
  security: [
    'Senior Security Engineer', 'Staff Security Engineer',
    'Application Security Engineer', 'Cloud Security Engineer',
    'Security Architect',
  ],
  pm: [
    'Senior Product Manager', 'Staff Product Manager',
    'Group Product Manager', 'Principal Product Manager',
  ],
  design: [
    'Senior Product Designer', 'Staff Product Designer',
    'Lead UX Designer', 'Design Lead',
  ],
  generic: [
    'Senior Software Engineer', 'Staff Software Engineer',
    'Senior Engineer', 'Lead Engineer', 'Product Engineer',
  ],
};

function detectTitleFamily(profileTitle) {
  const t = String(profileTitle || '').toLowerCase();
  if (!t) return 'generic';
  if (/(front[\s-]?end|ui engineer|react|vue|angular|web (eng|dev))/.test(t)) return 'frontend';
  if (/(back[\s-]?end|api engineer)/.test(t)) return 'backend';
  if (/(full[\s-]?stack|product engineer)/.test(t)) return 'fullstack';
  if (/(ios|android|mobile|react native|flutter)/.test(t)) return 'mobile';
  if (/(ml engineer|machine learning|applied scientist|data scientist)/.test(t)) return 'ml';
  if (/(data engineer|analytics engineer|bi engineer|etl)/.test(t)) return 'data';
  if (/(sre|site reliability|devops|platform engineer|infrastructure|cloud engineer|reliability)/.test(t)) return 'infra';
  if (/(security engineer|appsec|infosec|security architect)/.test(t)) return 'security';
  if (/(product manager|\bpm\b|group pm)/.test(t)) return 'pm';
  if (/(product designer|ux designer|design lead|ui designer)/.test(t)) return 'design';
  return 'generic';
}

const DEFAULT_TITLE_POOL = TITLE_FAMILIES.generic;

const WORK_STYLES = [
  { key: 'Remote', ico: '🏠', title: 'Remote', desc: 'Fully remote, timezone overlap only.' },
  { key: 'Hybrid', ico: '🏙', title: 'Hybrid', desc: 'A few days in a specific office.' },
  { key: 'On-site', ico: '🏢', title: 'On-site', desc: 'Full-time in-office role.' },
];

const DEFAULT_LOCATIONS = [
  'Toronto, CA',
  'Remote · North America',
  'Remote · EMEA overlap',
  'New York, US',
  'San Francisco, US',
];

const COMPANY_SIZES = [
  'Seed · 1–50',
  'Growth · 51–500',
  'Scale · 501–5k',
  'Enterprise · 5k+',
];

const WORK_AUTH_OPTIONS = [
  { key: 'citizen', title: 'Citizen / permanent resident', desc: "No sponsorship needed for the countries you've selected." },
  { key: 'visa',    title: 'On a work visa',                desc: 'Authorized but may need transfer. The pilot will flag visa-dependent postings.' },
  { key: 'need',    title: 'Need sponsorship',              desc: 'The pilot will skip postings that refuse sponsorship.' },
];

const RELOCATE_OPTIONS = [
  { key: 'yes',     label: 'Yes, open to it' },
  { key: 'depends', label: 'Depends on the role' },
  { key: 'no',      label: 'No, remote or current city only' },
];

const NOTICE_OPTIONS = ['Immediate', '2 weeks', '4 weeks', '6+ weeks'];
const EDUCATION_OPTIONS = ['High school', 'Associate', 'Bachelor\u2019s', 'Master\u2019s', 'PhD'];

// Voluntary EEO disclosures. These are only used when an application
// asks, the pilot leaves them blank when forms don't ask. "Decline"
// is always a first-class answer.
const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Non-binary',
  'Prefer to self-describe',
  'Decline to answer',
];

const ETHNICITY_OPTIONS = [
  'Hispanic or Latino',
  'White',
  'Black or African American',
  'Asian',
  'Native Hawaiian or Other Pacific Islander',
  'American Indian or Alaska Native',
  'Two or More Races',
];

const VETERAN_OPTIONS = [
  { key: 'protected',     label: 'I am a protected veteran' },
  { key: 'not_protected', label: 'I am not a protected veteran' },
  { key: 'decline',       label: 'Decline to answer' },
];

const DISABILITY_OPTIONS = [
  { key: 'yes',     label: 'Yes, I have a disability (or have a record/history of one)' },
  { key: 'no',      label: 'No, I do not have a disability' },
  { key: 'decline', label: 'Prefer not to answer' },
];

const SCHEDULE_OPTIONS = [
  {
    key: 'business',
    title: 'Business hours',
    desc: 'Weekdays, 9am–5pm in your local timezone. Mirrors how recruiters actually read their queue.',
    badge: '9–5',
  },
  {
    key: 'extended',
    title: 'Extended hours',
    desc: 'Every day, 8am–10pm local. Faster coverage on fresh postings without pinging you at odd hours.',
    badge: '14h · every day',
  },
  {
    key: 'always',
    title: 'Always on',
    desc: 'Scan and prep around the clock. Your daily cap still applies, so nothing runs away.',
    badge: '24/7',
  },
];

const KEYWORD_FILTERS = [
  'Contract only',
  'Unpaid / internship',
  'Commission only',
  'Crypto / Web3',
  'Must relocate',
];

const MIN_SALARY = 100;
const MAX_SALARY = 300;
const SALARY_STEP = 5;

const MIN_DAILY_CAP = 5;
const MAX_DAILY_CAP = 60;

// Roughly estimate years of experience from a profile.experience array.
const estimateYearsExp = (experience) => {
  if (!Array.isArray(experience) || !experience.length) return '';
  let months = 0;
  for (const e of experience) {
    const start = e?.startDate ? new Date(e.startDate) : null;
    const end = e?.endDate ? new Date(e.endDate) : new Date();
    if (!start || isNaN(start)) continue;
    const delta = (end - start) / (1000 * 60 * 60 * 24 * 30.44);
    if (delta > 0) months += delta;
  }
  if (!months) return '';
  return String(Math.max(1, Math.round(months / 12)));
};

const fmtSalary = (k) => {
  if (k >= MAX_SALARY) return `$${MAX_SALARY}k+`;
  return `$${k.toLocaleString()},000`;
};

const SetupPage = () => {
  const navigate = useNavigate();
  const { data: savedConfig } = useApplyPilotConfig();

  const [step, setStep] = useState(1);

  // Chips / selections
  const [titlePool, setTitlePool] = useState(DEFAULT_TITLE_POOL);
  const [roleTitles, setRoleTitles] = useState([]);
  const [seniority, setSeniority] = useState([]);
  const [industries, setIndustries] = useState([]);

  // Step 2 state, start maximally-open; profile or user narrows from here.
  const [workstyle, setWorkstyle] = useState(['Remote', 'Hybrid', 'On-site']);
  const [locationPool, setLocationPool] = useState(DEFAULT_LOCATIONS);
  const [locations, setLocations] = useState([]);
  const [salaryFloorK, setSalaryFloorK] = useState(150);
  const [skipUnlistedComp, setSkipUnlistedComp] = useState(false);
  const [companySize, setCompanySize] = useState([]);

  // Step 3 state, canned answers the pilot uses when filling out
  // applications that ask the usual stuff (work auth, relocation, etc.)
  // workAuth must be deliberately chosen, we never default it because
  // it gates downstream auto-submit logic (visa-required postings etc.).
  const [workAuth, setWorkAuth] = useState('');
  const [workAuthError, setWorkAuthError] = useState(false);
  const [relocate, setRelocate] = useState('depends');
  const [yearsExp, setYearsExp] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('2 weeks');
  const [education, setEducation] = useState('Bachelor\u2019s');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Voluntary EEO disclosures, only used when applications ask.
  const [genderIdentity, setGenderIdentity] = useState('');
  const [ethnicity, setEthnicity] = useState([]);
  const [veteran, setVeteran] = useState('');
  const [disability, setDisability] = useState('');

  // Step 4 state, pacing & guardrails. Review is always mandatory in
  // ApplyPilot, so this step is only about how the pilot paces itself
  // and which postings it should skip outright.
  const [dailyCap, setDailyCap] = useState(20);
  const [matchThreshold, setMatchThreshold] = useState(70);
  const [allowFederal, setAllowFederal] = useState(false);
  const [scheduleMode, setScheduleMode] = useState('extended');
  const [blockedCompanies, setBlockedCompanies] = useState([]);
  const [blockedKeywords, setBlockedKeywords] = useState([]);
  const [addingBlocked, setAddingBlocked] = useState(false);
  const [newBlocked, setNewBlocked] = useState('');

  // Candidate profile (for smart prefill). We keep it in state so the
  // hydration effect below can decide which fields were genuinely
  // "from your profile" vs default-seeded vs saved.
  const [profile, setProfile] = useState(null);
  const [profilePrefilled, setProfilePrefilled] = useState({
    titles: [],
    location: null,
    linkedin: false,
    github: false,
    portfolio: false,
    phone: false,
    yearsExp: false,
  });

  // Add-custom inline fields
  const [addingTitle, setAddingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [addingIndustry, setAddingIndustry] = useState(false);
  const [newIndustry, setNewIndustry] = useState('');
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState('');

  // Save state
  const [savedAt, setSavedAt] = useState(null);
  const hydratedRef = useRef(false);
  const profileResolvedRef = useRef(false);
  // Skips the first autosave tick after hydration so that defaults and
  // profile-prefilled values don't get persisted as if the user had typed
  // them. The user has to actually touch something before we write.
  const skipNextSaveRef = useRef(false);

  // Load candidate profile once so we can prefill intelligently.
  useEffect(() => {
    let cancelled = false;
    profileAPI.getMyProfile()
      .then((res) => { if (!cancelled) setProfile(res?.data || null); })
      .catch(() => { if (!cancelled) setProfile(null); })
      .finally(() => { if (!cancelled) profileResolvedRef.current = true; });
    return () => { cancelled = true; };
  }, []);

  // Applies profile-derived + saved values to all fields. Used for initial
  // hydration and also for the "Reset with my profile" action below.
  const applyHydration = useCallback((savedConfigArg, profileArg, { resetFromProfile = false } = {}) => {
    const c = resetFromProfile ? {} : (savedConfigArg?.config?.criteria || {});
    const d = resetFromProfile ? {} : (savedConfigArg?.config?.demographics || {});
    const p = resetFromProfile ? {} : (savedConfigArg?.config?.profile || {});
    const r = resetFromProfile ? {} : (savedConfigArg?.config?.rails || {});
    const prefill = {
      titles: [], location: null,
      linkedin: false, github: false, portfolio: false, phone: false, yearsExp: false,
    };

    // ── Role titles ────────────────────────────────────────────────
    const profileTitle = profileArg?.title?.trim();
    // Derive a family-specific pool from the candidate's profile title
    // (frontend / backend / mobile / ml / infra / ...). When the title
    // doesn't map to a known family the generic SWE pool is used. This
    // keeps the suggestion chips relevant instead of always showing
    // SRE/Platform roles to people who aren't infra candidates.
    const family = detectTitleFamily(profileTitle);
    let mergedTitlePool = [...(TITLE_FAMILIES[family] || TITLE_FAMILIES.generic)];
    if (profileTitle) {
      mergedTitlePool = Array.from(new Set([profileTitle, ...mergedTitlePool]));
      prefill.titles = [profileTitle];
    }
    if (Array.isArray(c.roleTitles) && c.roleTitles.length) {
      mergedTitlePool = Array.from(new Set([...mergedTitlePool, ...c.roleTitles]));
      setRoleTitles(c.roleTitles);
    } else if (profileTitle) {
      // Fresh setup + profile title → preselect just the profile title.
      // We no longer inject default picks so it feels personalised, not generic.
      setRoleTitles([profileTitle]);
    } else {
      setRoleTitles([]);
    }
    setTitlePool(mergedTitlePool);

    setSeniority(Array.isArray(c.seniority) && c.seniority.length ? c.seniority : []);
    setIndustries(Array.isArray(c.industries) && c.industries.length ? c.industries : []);
    setWorkstyle(
      Array.isArray(c.workstyle) && c.workstyle.length
        ? c.workstyle
        // Open-by-default: assume any arrangement until the user narrows.
        : ['Remote', 'Hybrid', 'On-site'],
    );

    // ── Locations ──────────────────────────────────────────────────
    const profileLoc = profileArg?.location?.trim();
    let mergedLocPool = [...DEFAULT_LOCATIONS];
    if (profileLoc) {
      mergedLocPool = Array.from(new Set([profileLoc, ...mergedLocPool]));
      prefill.location = profileLoc;
    }
    if (Array.isArray(c.locations) && c.locations.length) {
      mergedLocPool = Array.from(new Set([...mergedLocPool, ...c.locations]));
      setLocations(c.locations);
    } else if (profileLoc) {
      setLocations([profileLoc]);
    } else {
      setLocations([]);
    }
    setLocationPool(mergedLocPool);

    setSalaryFloorK(typeof c.salaryFloorK === 'number' ? c.salaryFloorK : 150);
    setSkipUnlistedComp(typeof c.skipUnlistedComp === 'boolean' ? c.skipUnlistedComp : false);
    setCompanySize(Array.isArray(c.companySize) && c.companySize.length ? c.companySize : []);

    // ── Step 3 ─────────────────────────────────────────────────────
    // Only seed if the user previously answered, never auto-pick.
    setWorkAuth(d.workAuthorization || '');
    setWorkAuthError(false);
    if (p.relocationWillingness === true) setRelocate('yes');
    else if (p.relocationWillingness === false) setRelocate('no');
    else setRelocate('depends');

    const est = estimateYearsExp(profileArg?.experience);
    if (est) { setYearsExp(est); prefill.yearsExp = true; }
    else setYearsExp('');

    setNoticePeriod(p.noticePeriod || '2 weeks');
    setEducation('Bachelor\u2019s');

    if (p.linkedinUrl) setLinkedinUrl(p.linkedinUrl);
    else if (profileArg?.linkedinUrl) { setLinkedinUrl(profileArg.linkedinUrl); prefill.linkedin = true; }
    else setLinkedinUrl('');

    if (p.githubUrl) setGithubUrl(p.githubUrl);
    else if (profileArg?.githubUrl) { setGithubUrl(profileArg.githubUrl); prefill.github = true; }
    else setGithubUrl('');

    if (p.portfolioUrl) setPortfolioUrl(p.portfolioUrl);
    else if (profileArg?.portfolioUrl) { setPortfolioUrl(profileArg.portfolioUrl); prefill.portfolio = true; }
    else setPortfolioUrl('');

    if (p.phone) setPhoneNumber(p.phone);
    else if (profileArg?.phone) { setPhoneNumber(profileArg.phone); prefill.phone = true; }
    else setPhoneNumber('');

    // EEO disclosures
    setGenderIdentity(d.genderIdentity || '');
    setEthnicity(Array.isArray(d.ethnicity) ? d.ethnicity : []);
    setVeteran(d.veteran || '');
    setDisability(d.disability || '');

    // ── Step 4 ─────────────────────────────────────────────────────
    setDailyCap(typeof c.dailyLimit === 'number' ? c.dailyLimit : 20);
    setMatchThreshold(typeof c.matchThreshold === 'number' ? c.matchThreshold : 70);
    setAllowFederal(c.allowFederal === true);
    setScheduleMode('extended');
    setBlockedCompanies(Array.isArray(r.blockedCompanies) ? r.blockedCompanies : []);
    setBlockedKeywords([]);

    setProfilePrefilled(prefill);
  }, []);

  // Hydrate once. Wait for BOTH the saved-config fetch AND the profile
  // fetch to resolve, otherwise if savedConfig arrives first we miss
  // the chance to seed from the profile.
  useEffect(() => {
    if (hydratedRef.current) return;
    if (savedConfig === undefined) return;
    if (!profileResolvedRef.current) return;
    applyHydration(savedConfig, profile);
    skipNextSaveRef.current = true;
    hydratedRef.current = true;
  }, [savedConfig, profile, applyHydration]);

  // User-invoked "Reset to my profile defaults", wipes local state to
  // pure profile-derived + safe defaults, then autosave will persist it.
  const resetToProfileDefaults = useCallback(() => {
    applyHydration(null, profile, { resetFromProfile: true });
    // This reset IS a user action, so let it save.
    skipNextSaveRef.current = false;
  }, [applyHydration, profile]);

  // Autosave (debounced)
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (!hydratedRef.current) return;
    // Hydration sets a bunch of state in one render; swallow the tick it
    // triggers so profile/default values don't get persisted as if the
    // user had typed them.
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveApplyPilotConfig({
          criteria: {
            roleTitles,
            seniority,
            industries,
            workstyle,
            locations,
            salaryFloorK,
            companySize,
            dailyLimit: dailyCap,
            matchThreshold,
            allowFederal,
          },
          demographics: {
            workAuthorization: workAuth || null,
            genderIdentity: genderIdentity || null,
            ethnicity: ethnicity.length ? ethnicity : null,
            veteran: veteran || null,
            disability: disability || null,
          },
          profile: {
            linkedinUrl: linkedinUrl || null,
            githubUrl: githubUrl || null,
            portfolioUrl: portfolioUrl || null,
            phone: phoneNumber || null,
            noticePeriod: noticePeriod || null,
            relocationWillingness:
              relocate === 'yes' ? true : relocate === 'no' ? false : null,
          },
          rails: {
            blockedCompanies,
          },
        });
        setSavedAt(new Date());
      } catch {
        /* swallow, the indicator just won't update */
      }
    }, 600);
    return () => clearTimeout(saveTimerRef.current);
  }, [
    roleTitles, seniority, industries,
    workstyle, locations, salaryFloorK, companySize,
    workAuth, relocate, noticePeriod,
    linkedinUrl, githubUrl, portfolioUrl, phoneNumber,
    genderIdentity, ethnicity, veteran, disability,
    dailyCap, matchThreshold, allowFederal, blockedCompanies,
  ]);

  const toggle = useCallback((arr, setArr, value) => {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }, []);

  const addCustomTitle = () => {
    const v = newTitle.trim();
    if (!v) { setAddingTitle(false); return; }
    setTitlePool((p) => (p.includes(v) ? p : [...p, v]));
    setRoleTitles((p) => (p.includes(v) ? p : [...p, v]));
    setNewTitle('');
    setAddingTitle(false);
  };

  const addCustomIndustry = () => {
    const v = newIndustry.trim();
    if (!v) { setAddingIndustry(false); return; }
    setIndustries((p) => (p.includes(v) ? p : [...p, v]));
    setNewIndustry('');
    setAddingIndustry(false);
  };

  const addCustomLocation = () => {
    const v = newLocation.trim();
    if (!v) { setAddingLocation(false); return; }
    setLocationPool((p) => (p.includes(v) ? p : [...p, v]));
    setLocations((p) => (p.includes(v) ? p : [...p, v]));
    setNewLocation('');
    setAddingLocation(false);
  };

  const bumpSalary = (delta) => {
    setSalaryFloorK((k) => {
      const next = Math.round((k + delta) / SALARY_STEP) * SALARY_STEP;
      return Math.min(MAX_SALARY, Math.max(MIN_SALARY, next));
    });
  };

  const industryPool = useMemo(() => {
    const custom = industries.filter((i) => !INDUSTRY_OPTIONS.includes(i));
    return [...INDUSTRY_OPTIONS, ...custom];
  }, [industries]);

  // Employers we pulled off the candidate's profile. Shown as quick-pick
  // chips in the "never apply to" list so they don't accidentally get
  // pinged by the pilot.
  const employerSuggestions = useMemo(() => {
    const exp = Array.isArray(profile?.experience) ? profile.experience : [];
    const names = exp
      .map((e) => (e?.company || e?.employer || e?.organization || '').trim())
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [profile]);

  const blockedCompanyPool = useMemo(() => (
    Array.from(new Set([...employerSuggestions, ...blockedCompanies]))
  ), [employerSuggestions, blockedCompanies]);

  const addBlockedCompany = () => {
    const v = newBlocked.trim();
    if (!v) { setAddingBlocked(false); return; }
    setBlockedCompanies((p) => (p.includes(v) ? p : [...p, v]));
    setNewBlocked('');
    setAddingBlocked(false);
  };

  const scheduleSummary = scheduleMode === 'business'
    ? 'during weekday business hours'
    : scheduleMode === 'always'
      ? 'around the clock'
      : 'through your extended waking hours';

  const handleNext = () => {
    // Step 3 → 4: work authorization is required because the submit
    // pipeline uses it to skip postings that refuse sponsorship etc.
    // Guard against legacy / unknown values too, if the stored value
    // doesn't match one of WORK_AUTH_OPTIONS, no radio shows selected,
    // and a truthy-but-unmatched value would silently bypass the gate.
    const workAuthValid = WORK_AUTH_OPTIONS.some((o) => o.key === workAuth);
    if (step === 3 && !workAuthValid) {
      setWorkAuthError(true);
      // Scroll the field into view so the error is obvious.
      try {
        document.getElementById('work-auth-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } catch { /* no-op */ }
      return;
    }
    if (step < 4) setStep(step + 1);
    else navigate('/applypilot/dashboard');
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleExit = () => navigate('/applypilot/dashboard');

  return (
    <Page>
      <SaveHint>
        {savedAt ? 'Saved automatically' : 'Your changes autosave'}
      </SaveHint>

      <Progress>
        {[1, 2, 3, 4].map((n) => {
          const isDone = n < step;
          // Every dot is clickable, backward freely, forward as long
          // as no required field on the steps we're skipping over is
          // missing. Today the only hard gate is `workAuth` on step 3,
          // so jumping from 1/2/3 → 4 with empty workAuth re-uses the
          // same validation the Next button does.
          const handleDotClick = () => {
            if (n === step) return;
            // Same gate as handleNext, don't let the user reach step 4
            // until workAuth matches one of the known option keys.
            const workAuthValid = WORK_AUTH_OPTIONS.some((o) => o.key === workAuth);
            if (n > step && step <= 3 && n === 4 && !workAuthValid) {
              setStep(3);
              setWorkAuthError(true);
              try {
                document.getElementById('work-auth-section')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });
              } catch { /* no-op */ }
              return;
            }
            setStep(n);
          };
          return (
            <ProgressItem key={n}>
              <Bubble
                $active={n === step}
                $done={isDone}
                $clickable={n !== step}
                onClick={handleDotClick}
                title={n === step ? undefined : `Go to step ${n}`}
                aria-label={n === step ? `Step ${n} (current)` : `Go to step ${n}`}
                aria-current={n === step ? 'step' : undefined}
              >
                {n}
              </Bubble>
              {n < 4 && <ProgressLine $done={isDone} />}
            </ProgressItem>
          );
        })}
      </Progress>

      <Layout>
        <Main>
          {step < 4 && profile && (profile.title || profile.location) && (
            <ProfileBanner>
              <ProfileBannerText>
                <span aria-hidden>✨</span>
                <span>
                  We can pre-fill this setup from your profile
                  {profile.title ? <>, <b>{profile.title}</b></> : null}
                  {profile.location ? <>, based in <b>{profile.location}</b></> : null}.
                </span>
              </ProfileBannerText>
              <ProfileBannerBtn type="button" onClick={resetToProfileDefaults}>
                Use my profile defaults
              </ProfileBannerBtn>
            </ProfileBanner>
          )}
          {step === 1 && (
            <>
              <H1>What roles are you targeting?</H1>
              <Lede>
                We&apos;ll scout these titles plus common synonyms. Start with 2–5, you can tune later.
              </Lede>

              <Section>
                <SectionHead>
                  <h3>Role titles</h3>
                  <span>
                    {profilePrefilled.titles.length
                      ? 'We pulled your current title, tap to keep/remove.'
                      : 'Pulled from your resume, tap to keep/remove.'}
                  </span>
                </SectionHead>
                <ChipRow>
                  {titlePool.map((t) => {
                    const on = roleTitles.includes(t);
                    const fromProfile = profilePrefilled.titles.includes(t);
                    return (
                      <Chip
                        key={t}
                        $on={on}
                        onClick={() => toggle(roleTitles, setRoleTitles, t)}
                        title={fromProfile ? 'From your profile' : undefined}
                      >
                        {on && <span className="check">✓</span>}
                        {fromProfile && <FromProfileStar aria-hidden>✦</FromProfileStar>}
                        {t}
                      </Chip>
                    );
                  })}
                  {addingTitle ? (
                    <InlineInput
                      autoFocus
                      value={newTitle}
                      placeholder="e.g. Backend Engineer"
                      onChange={(e) => setNewTitle(e.target.value)}
                      onBlur={addCustomTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addCustomTitle();
                        if (e.key === 'Escape') { setNewTitle(''); setAddingTitle(false); }
                      }}
                    />
                  ) : (
                    <ChipDashed onClick={() => setAddingTitle(true)}>
                      + Add custom title
                    </ChipDashed>
                  )}
                </ChipRow>

                <Tip>
                  <span aria-hidden>💡</span>
                  <span>
                    Adding synonyms like <b>&quot;SWE II&quot;</b> or <b>&quot;Backend Engineer&quot;</b> helps the
                    agent find 3× more matches you&apos;d actually want.
                  </span>
                </Tip>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Seniority fit</h3>
                  <span>Pick every level you&apos;re open to.</span>
                </SectionHead>
                <ChipRow>
                  {SENIORITY.map((s) => {
                    const on = seniority.includes(s);
                    return (
                      <Chip
                        key={s}
                        $on={on}
                        onClick={() => toggle(seniority, setSeniority, s)}
                      >
                        {on && <span className="check">✓</span>}
                        {s}
                      </Chip>
                    );
                  })}
                </ChipRow>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Industries you&apos;d consider</h3>
                  <span>Leave blank to consider all industries.</span>
                </SectionHead>
                <ChipRow>
                  {industryPool.map((i) => {
                    const on = industries.includes(i);
                    return (
                      <Chip
                        key={i}
                        $on={on}
                        onClick={() => toggle(industries, setIndustries, i)}
                      >
                        {on && <span className="check">✓</span>}
                        {i}
                      </Chip>
                    );
                  })}
                  {addingIndustry ? (
                    <InlineInput
                      autoFocus
                      value={newIndustry}
                      placeholder="e.g. Climate tech"
                      onChange={(e) => setNewIndustry(e.target.value)}
                      onBlur={addCustomIndustry}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addCustomIndustry();
                        if (e.key === 'Escape') { setNewIndustry(''); setAddingIndustry(false); }
                      }}
                    />
                  ) : (
                    <ChipDashed onClick={() => setAddingIndustry(true)}>
                      + Add industry
                    </ChipDashed>
                  )}
                </ChipRow>
              </Section>
            </>
          )}

          {step === 2 && (
            <>
              <H1>Where should we look, and what&apos;s your floor?</H1>
              <Lede>
                The pilot narrows your queue to roles that fit your life and pay enough to matter.
                Tune it later as you learn what you actually want.
              </Lede>

              <Section>
                <SectionHead>
                  <h3>Work style</h3>
                  <span>Pick any that work, multi-select.</span>
                </SectionHead>
                <WorkStyleGrid>
                  {WORK_STYLES.map((w) => {
                    const on = workstyle.includes(w.key);
                    return (
                      <WorkStyleCard
                        key={w.key}
                        $on={on}
                        onClick={() => toggle(workstyle, setWorkstyle, w.key)}
                      >
                        <WsCheck $on={on}>{on && '✓'}</WsCheck>
                        <WsEmoji aria-hidden>{w.ico}</WsEmoji>
                        <WsTitle>{w.title}</WsTitle>
                        <WsDesc>{w.desc}</WsDesc>
                      </WorkStyleCard>
                    );
                  })}
                </WorkStyleGrid>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Location &amp; timezone</h3>
                  <span>
                    {profilePrefilled.location
                      ? 'Pulled your home city from your profile, add more if you\u2019d like.'
                      : 'Where you\u2019re willing to be, or which timezones you can overlap.'}
                  </span>
                </SectionHead>
                <ChipRow>
                  {locationPool.map((l) => {
                    const on = locations.includes(l);
                    const fromProfile = profilePrefilled.location === l;
                    return (
                      <Chip
                        key={l}
                        $on={on}
                        onClick={() => toggle(locations, setLocations, l)}
                        title={fromProfile ? 'From your profile' : undefined}
                      >
                        {on && <span className="check">✓</span>}
                        {fromProfile && <FromProfileStar aria-hidden>✦</FromProfileStar>}
                        {l}
                      </Chip>
                    );
                  })}
                  {addingLocation ? (
                    <InlineInput
                      autoFocus
                      value={newLocation}
                      placeholder="e.g. Remote · UK"
                      onChange={(e) => setNewLocation(e.target.value)}
                      onBlur={addCustomLocation}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addCustomLocation();
                        if (e.key === 'Escape') { setNewLocation(''); setAddingLocation(false); }
                      }}
                    />
                  ) : (
                    <ChipDashed onClick={() => setAddingLocation(true)}>
                      + Add location
                    </ChipDashed>
                  )}
                </ChipRow>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Salary floor</h3>
                  <span>We&apos;ll skip postings below this number.</span>
                </SectionHead>
                <SalaryCard>
                  <SalaryTop>
                    <SalaryValueBlock>
                      <SalaryValue>{fmtSalary(salaryFloorK)}</SalaryValue>
                      <SalaryMeta>USD base · /year</SalaryMeta>
                    </SalaryValueBlock>
                    <SalarySteppers>
                      <StepBtn type="button" onClick={() => bumpSalary(-SALARY_STEP)} aria-label="Decrease">−</StepBtn>
                      <StepBtn type="button" onClick={() => bumpSalary(SALARY_STEP)} aria-label="Increase">+</StepBtn>
                    </SalarySteppers>
                  </SalaryTop>

                  <SalarySlider
                    type="range"
                    min={MIN_SALARY}
                    max={MAX_SALARY}
                    step={SALARY_STEP}
                    value={salaryFloorK}
                    onChange={(e) => setSalaryFloorK(Number(e.target.value))}
                    style={{
                      background: `linear-gradient(to right, ${BRAND} 0%, ${BRAND} ${((salaryFloorK - MIN_SALARY) / (MAX_SALARY - MIN_SALARY)) * 100}%, ${LINE} ${((salaryFloorK - MIN_SALARY) / (MAX_SALARY - MIN_SALARY)) * 100}%, ${LINE} 100%)`,
                    }}
                  />
                  <SalaryTicks>
                    <span>$100k</span>
                    <span>$150k</span>
                    <span>$200k</span>
                    <span>$250k</span>
                    <span>$300k+</span>
                  </SalaryTicks>

                  <ToggleRow onClick={() => setSkipUnlistedComp((v) => !v)}>
                    <Switch $on={skipUnlistedComp}><Knob $on={skipUnlistedComp} /></Switch>
                    <span>Also skip postings that don&apos;t list comp</span>
                  </ToggleRow>
                </SalaryCard>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Company size</h3>
                  <span>Any mix, the agent can bias toward what you pick.</span>
                </SectionHead>
                <ChipRow>
                  {COMPANY_SIZES.map((c) => {
                    const on = companySize.includes(c);
                    return (
                      <Chip
                        key={c}
                        $on={on}
                        onClick={() => toggle(companySize, setCompanySize, c)}
                      >
                        {on && <span className="check">✓</span>}
                        {c}
                      </Chip>
                    );
                  })}
                </ChipRow>
              </Section>
            </>
          )}
          {step === 3 && (
            <>
              <H1>The questions every application asks.</H1>
              <Lede>
                These are the usual blockers, work eligibility, notice period, links to your work.
                Answer them once here and the pilot fills them in on every application for you.
              </Lede>

              <Section id="work-auth-section">
                <SectionHead>
                  <h3>
                    Work authorization{' '}
                    <span style={{ color: '#C2371D', fontWeight: 700 }} aria-hidden>*</span>
                  </h3>
                  <span>Relative to the locations you picked in Step 2.</span>
                </SectionHead>
                <StackedChoices
                  style={workAuthError ? { outline: '2px solid #E76F4F', outlineOffset: 4, borderRadius: 12 } : undefined}
                >
                  {WORK_AUTH_OPTIONS.map((o) => {
                    const on = workAuth === o.key;
                    return (
                      <ChoiceCard
                        key={o.key}
                        $on={on}
                        onClick={() => { setWorkAuth(o.key); setWorkAuthError(false); }}
                      >
                        <ChoiceRadio $on={on}>{on && <span />}</ChoiceRadio>
                        <div>
                          <ChoiceTitle>{o.title}</ChoiceTitle>
                          <ChoiceDesc>{o.desc}</ChoiceDesc>
                        </div>
                      </ChoiceCard>
                    );
                  })}
                </StackedChoices>
                {workAuthError && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: '#C2371D',
                      fontWeight: 600,
                    }}
                  >
                    Pick one, the pilot uses this to filter postings that need sponsorship.
                  </div>
                )}
              </Section>

              <Section>
                <SectionHead>
                  <h3>Willing to relocate?</h3>
                  <span>The pilot will prioritise postings that match your answer.</span>
                </SectionHead>
                <ChipRow>
                  {RELOCATE_OPTIONS.map((o) => {
                    const on = relocate === o.key;
                    return (
                      <Chip
                        key={o.key}
                        $on={on}
                        onClick={() => setRelocate(o.key)}
                      >
                        {on && <span className="check">✓</span>}
                        {o.label}
                      </Chip>
                    );
                  })}
                </ChipRow>
              </Section>

              <TwoCol>
                <Section>
                  <SectionHead>
                    <h3>Years of experience</h3>
                    <span>
                      {profilePrefilled.yearsExp
                        ? 'Estimated from your experience \u2014 adjust if needed.'
                        : 'Total, rounded.'}
                    </span>
                  </SectionHead>
                  <NumInput
                    type="number"
                    min={0}
                    max={60}
                    value={yearsExp}
                    placeholder="e.g. 8"
                    onChange={(e) => setYearsExp(e.target.value)}
                  />
                </Section>

                <Section>
                  <SectionHead>
                    <h3>Notice period</h3>
                    <span>How soon can you start?</span>
                  </SectionHead>
                  <ChipRow>
                    {NOTICE_OPTIONS.map((n) => {
                      const on = noticePeriod === n;
                      return (
                        <Chip
                          key={n}
                          $on={on}
                          onClick={() => setNoticePeriod(n)}
                        >
                          {on && <span className="check">✓</span>}
                          {n}
                        </Chip>
                      );
                    })}
                  </ChipRow>
                </Section>
              </TwoCol>

              <Section>
                <SectionHead>
                  <h3>Highest education</h3>
                  <span>Used when an application requires it.</span>
                </SectionHead>
                <ChipRow>
                  {EDUCATION_OPTIONS.map((e) => {
                    const on = education === e;
                    return (
                      <Chip
                        key={e}
                        $on={on}
                        onClick={() => setEducation(e)}
                      >
                        {on && <span className="check">✓</span>}
                        {e}
                      </Chip>
                    );
                  })}
                </ChipRow>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Links &amp; phone</h3>
                  <span>Leave blank to skip, applications that require them will become blockers.</span>
                </SectionHead>
                <FieldGrid>
                  <Field>
                    <FieldLabel>
                      LinkedIn URL
                      {profilePrefilled.linkedin && <FromProfileTag>from your profile</FromProfileTag>}
                    </FieldLabel>
                    <TextInput
                      type="url"
                      placeholder="https://linkedin.com/in/…"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>
                      GitHub URL
                      {profilePrefilled.github && <FromProfileTag>from your profile</FromProfileTag>}
                    </FieldLabel>
                    <TextInput
                      type="url"
                      placeholder="https://github.com/…"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>
                      Portfolio / personal site
                      {profilePrefilled.portfolio && <FromProfileTag>from your profile</FromProfileTag>}
                    </FieldLabel>
                    <TextInput
                      type="url"
                      placeholder="https://…"
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>
                      Phone number
                      {profilePrefilled.phone && <FromProfileTag>from your profile</FromProfileTag>}
                    </FieldLabel>
                    <TextInput
                      type="tel"
                      placeholder="+1 555 555 5555"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </Field>
                </FieldGrid>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Voluntary disclosures (EEO)</h3>
                  <span>
                    Optional. Many US applications include these questions for federal
                    reporting. The pilot only uses your answers when a form asks &mdash;
                    leave any of them blank to skip.
                  </span>
                </SectionHead>

                <FieldLabel>Gender identity</FieldLabel>
                <ChipRow>
                  {GENDER_OPTIONS.map((g) => {
                    const on = genderIdentity === g;
                    return (
                      <Chip
                        key={g}
                        $on={on}
                        onClick={() => setGenderIdentity(on ? '' : g)}
                      >
                        {on && <span className="check">&#10003;</span>}
                        {g}
                      </Chip>
                    );
                  })}
                </ChipRow>

                <FieldLabel style={{ marginTop: 16 }}>
                  Race / ethnicity <span style={{ opacity: 0.6, fontWeight: 400 }}>(select all that apply)</span>
                </FieldLabel>
                <ChipRow>
                  {ETHNICITY_OPTIONS.map((e) => {
                    const on = ethnicity.includes(e);
                    return (
                      <Chip
                        key={e}
                        $on={on}
                        onClick={() => toggle(ethnicity, setEthnicity, e)}
                      >
                        {on && <span className="check">&#10003;</span>}
                        {e}
                      </Chip>
                    );
                  })}
                  <Chip
                    $on={ethnicity.includes('Decline to answer')}
                    onClick={() => setEthnicity(
                      ethnicity.includes('Decline to answer') ? [] : ['Decline to answer']
                    )}
                  >
                    {ethnicity.includes('Decline to answer') && <span className="check">&#10003;</span>}
                    Decline to answer
                  </Chip>
                </ChipRow>

                <FieldLabel style={{ marginTop: 16 }}>Veteran status</FieldLabel>
                <ChipRow>
                  {VETERAN_OPTIONS.map((o) => {
                    const on = veteran === o.key;
                    return (
                      <Chip
                        key={o.key}
                        $on={on}
                        onClick={() => setVeteran(on ? '' : o.key)}
                      >
                        {on && <span className="check">&#10003;</span>}
                        {o.label}
                      </Chip>
                    );
                  })}
                </ChipRow>

                <FieldLabel style={{ marginTop: 16 }}>Disability status</FieldLabel>
                <ChipRow>
                  {DISABILITY_OPTIONS.map((o) => {
                    const on = disability === o.key;
                    return (
                      <Chip
                        key={o.key}
                        $on={on}
                        onClick={() => setDisability(on ? '' : o.key)}
                      >
                        {on && <span className="check">&#10003;</span>}
                        {o.label}
                      </Chip>
                    );
                  })}
                </ChipRow>
              </Section>

              <Tip>
                <span aria-hidden>🛡</span>
                <span>
                  If an application asks something unusual, the pilot <b>pauses and asks you</b> &mdash;
                  it won&apos;t guess on custom questions.
                </span>
              </Tip>
            </>
          )}
          {step === 4 && (
            <>
              <H1>Pacing &amp; guardrails.</H1>
              <Lede>
                You approve every application before it ships, this step is about
                <b> how fast the pilot moves</b> and <b>what it avoids</b>. Change any time from
                your dashboard.
              </Lede>

              <MandatoryReviewBanner>
                <span aria-hidden>🛡</span>
                <span>
                  <b>You always review and approve.</b> Nothing is ever sent without your tap —
                  ApplyPilot queues, drafts, and pauses, but never auto-submits.
                </span>
              </MandatoryReviewBanner>

              <Section>
                <SectionHead>
                  <h3>Daily cap</h3>
                  <span>Most applications the pilot can queue for your review in 24h.</span>
                </SectionHead>
                <SalaryCard>
                  <SalaryTop>
                    <SalaryValueBlock>
                      <SalaryValue>{dailyCap}</SalaryValue>
                      <SalaryMeta>applications queued / day</SalaryMeta>
                    </SalaryValueBlock>
                    <SalarySteppers>
                      <StepBtn
                        type="button"
                        onClick={() => setDailyCap((n) => Math.max(MIN_DAILY_CAP, n - 1))}
                        aria-label="Decrease by 1"
                      >−</StepBtn>
                      <StepBtn
                        type="button"
                        onClick={() => setDailyCap((n) => Math.min(MAX_DAILY_CAP, n + 1))}
                        aria-label="Increase by 1"
                      >+</StepBtn>
                    </SalarySteppers>
                  </SalaryTop>

                  <SalarySlider
                    type="range"
                    min={MIN_DAILY_CAP}
                    max={MAX_DAILY_CAP}
                    step={1}
                    value={dailyCap}
                    onChange={(e) => setDailyCap(Number(e.target.value))}
                    style={{
                      background: `linear-gradient(to right, ${BRAND} 0%, ${BRAND} ${((dailyCap - MIN_DAILY_CAP) / (MAX_DAILY_CAP - MIN_DAILY_CAP)) * 100}%, ${LINE} ${((dailyCap - MIN_DAILY_CAP) / (MAX_DAILY_CAP - MIN_DAILY_CAP)) * 100}%, ${LINE} 100%)`,
                    }}
                  />
                  <SalaryTicks>
                    <span>5</span><span>20</span><span>40</span><span>60</span>
                  </SalaryTicks>
                </SalaryCard>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Minimum match score</h3>
                  <span>
                    Only queue jobs scoring at or above this percentage. Higher = fewer but
                    sharper matches; lower = more volume, more variety.
                  </span>
                </SectionHead>
                <SalaryCard>
                  <SalaryTop>
                    <SalaryValueBlock>
                      <SalaryValue>{matchThreshold}%</SalaryValue>
                      <SalaryMeta>match floor</SalaryMeta>
                    </SalaryValueBlock>
                    <SalarySteppers>
                      <StepBtn
                        type="button"
                        onClick={() => setMatchThreshold((n) => Math.max(40, n - 5))}
                        aria-label="Decrease by 5"
                      >
                        −
                      </StepBtn>
                      <StepBtn
                        type="button"
                        onClick={() => setMatchThreshold((n) => Math.min(95, n + 5))}
                        aria-label="Increase by 5"
                      >
                        +
                      </StepBtn>
                    </SalarySteppers>
                  </SalaryTop>
                  <SalarySlider
                    type="range"
                    min={40}
                    max={95}
                    step={5}
                    value={matchThreshold}
                    onChange={(e) => setMatchThreshold(Number(e.target.value))}
                    style={{
                      background: `linear-gradient(to right, ${BRAND} 0%, ${BRAND} ${((matchThreshold - 40) / (95 - 40)) * 100}%, ${LINE} ${((matchThreshold - 40) / (95 - 40)) * 100}%, ${LINE} 100%)`,
                    }}
                  />
                  <SalaryTicks>
                    <span>40%</span><span>60%</span><span>75%</span><span>95%</span>
                  </SalaryTicks>
                </SalaryCard>
                <MatchTip>
                  <b>How match score relates to interview chances:</b>
                  <ul>
                    <li><b>85–95%</b> &mdash; Strong fit. Highest reply &amp; interview rates, but very few jobs clear this bar.</li>
                    <li><b>70–84%</b> &mdash; Solid fit. Good balance of volume and reply rate. Recommended for most candidates.</li>
                    <li><b>55–69%</b> &mdash; Stretch fit. More volume, lower reply rate. Useful when the market is tight.</li>
                    <li><b>40–54%</b> &mdash; Wide net. Maximum volume, expect more rejections. Try if you&apos;re early career or pivoting.</li>
                  </ul>
                </MatchTip>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Federal &amp; clearance jobs</h3>
                  <span>
                    Many U.S. federal / defense roles require citizenship or active security
                    clearance. Skip them unless you qualify.
                  </span>
                </SectionHead>
                <StackedChoices>
                  <ChoiceCard
                    $on={!allowFederal}
                    onClick={() => setAllowFederal(false)}
                  >
                    <ChoiceRadio $on={!allowFederal}>{!allowFederal && <span />}</ChoiceRadio>
                    <div style={{ flex: 1 }}>
                      <ChoiceTitle>Skip federal &amp; clearance roles</ChoiceTitle>
                      <ChoiceDesc>
                        Recommended. Filters out postings mentioning &quot;security clearance&quot;,
                        &quot;TS/SCI&quot;, &quot;U.S. citizens only&quot;, federal contractors, etc.
                      </ChoiceDesc>
                    </div>
                  </ChoiceCard>
                  <ChoiceCard
                    $on={allowFederal}
                    onClick={() => setAllowFederal(true)}
                  >
                    <ChoiceRadio $on={allowFederal}>{allowFederal && <span />}</ChoiceRadio>
                    <div style={{ flex: 1 }}>
                      <ChoiceTitle>Include federal &amp; clearance roles</ChoiceTitle>
                      <ChoiceDesc>
                        I&apos;m a U.S. citizen and open to federal, DoD, or clearance-required
                        roles. Show them in my queue.
                      </ChoiceDesc>
                    </div>
                  </ChoiceCard>
                </StackedChoices>
              </Section>

              <Section>
                <SectionHead>
                  <h3>When should the pilot work?</h3>
                  <span>Discovery and prep only, nothing ships regardless.</span>
                </SectionHead>
                <StackedChoices>
                  {SCHEDULE_OPTIONS.map((m) => {
                    const on = scheduleMode === m.key;
                    return (
                      <ChoiceCard
                        key={m.key}
                        $on={on}
                        onClick={() => setScheduleMode(m.key)}
                      >
                        <ChoiceRadio $on={on}>{on && <span />}</ChoiceRadio>
                        <div style={{ flex: 1 }}>
                          <ChoiceTitle>
                            {m.title}
                            <ModeBadge $tone={m.key}>{m.badge}</ModeBadge>
                          </ChoiceTitle>
                          <ChoiceDesc>{m.desc}</ChoiceDesc>
                        </div>
                      </ChoiceCard>
                    );
                  })}
                </StackedChoices>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Never apply to these companies</h3>
                  <span>
                    {employerSuggestions.length
                      ? 'We pulled your employers from your profile, tap any to block.'
                      : 'Useful for your current or previous employers.'}
                  </span>
                </SectionHead>
                <ChipRow>
                  {blockedCompanyPool.map((c) => {
                    const on = blockedCompanies.includes(c);
                    const fromProfile = employerSuggestions.includes(c);
                    return (
                      <Chip
                        key={c}
                        $on={on}
                        onClick={() => toggle(blockedCompanies, setBlockedCompanies, c)}
                        title={fromProfile ? 'From your profile' : undefined}
                      >
                        {on && <span className="check">✓</span>}
                        {fromProfile && <FromProfileStar aria-hidden>✦</FromProfileStar>}
                        {c}
                      </Chip>
                    );
                  })}
                  {addingBlocked ? (
                    <InlineInput
                      autoFocus
                      value={newBlocked}
                      placeholder="e.g. Acme Corp"
                      onChange={(e) => setNewBlocked(e.target.value)}
                      onBlur={addBlockedCompany}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addBlockedCompany();
                        if (e.key === 'Escape') { setNewBlocked(''); setAddingBlocked(false); }
                      }}
                    />
                  ) : (
                    <ChipDashed onClick={() => setAddingBlocked(true)}>
                      + Add company
                    </ChipDashed>
                  )}
                </ChipRow>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Deal-breaker keywords</h3>
                  <span>Postings mentioning any of these get skipped before they reach your queue.</span>
                </SectionHead>
                <ChipRow>
                  {KEYWORD_FILTERS.map((k) => {
                    const on = blockedKeywords.includes(k);
                    return (
                      <Chip
                        key={k}
                        $on={on}
                        onClick={() => toggle(blockedKeywords, setBlockedKeywords, k)}
                      >
                        {on && <span className="check">✓</span>}
                        {k}
                      </Chip>
                    );
                  })}
                </ChipRow>
              </Section>

              <Section>
                <SectionHead>
                  <h3>Here&apos;s the plan</h3>
                  <span>Your pilot&apos;s instructions in one sentence.</span>
                </SectionHead>
                <SummaryCard>
                  <SummaryLine>
                    Your pilot will scout <b>{roleTitles.length || '—'}</b> titles across{' '}
                    <b>{locations.length || '—'}</b> locations {scheduleSummary}, queue up to{' '}
                    <b>{dailyCap}</b> strong matches/day for your review, and skip anything from{' '}
                    <b>{blockedCompanies.length}</b> blocked companies
                    {blockedKeywords.length > 0 && <> or mentioning <b>{blockedKeywords.length}</b> deal-breakers</>}.
                  </SummaryLine>
                  <SummaryGrid>
                    <SummaryItem>
                      <SummaryK>Titles</SummaryK>
                      <SummaryV>{roleTitles.length}</SummaryV>
                    </SummaryItem>
                    <SummaryItem>
                      <SummaryK>Locations</SummaryK>
                      <SummaryV>{locations.length}</SummaryV>
                    </SummaryItem>
                    <SummaryItem>
                      <SummaryK>Salary floor</SummaryK>
                      <SummaryV>{fmtSalary(salaryFloorK)}</SummaryV>
                    </SummaryItem>
                    <SummaryItem>
                      <SummaryK>Queued / day</SummaryK>
                      <SummaryV>{dailyCap}</SummaryV>
                    </SummaryItem>
                  </SummaryGrid>
                </SummaryCard>
              </Section>
            </>
          )}
        </Main>

        <Aside>
          <LiveMatchesCard
            step={step}
            criteriaCount={roleTitles.length + seniority.length + industries.length}
            roleTitles={roleTitles}
            seniority={seniority}
            industries={industries}
            workstyle={workstyle}
            locations={locations}
            salaryFloorK={salaryFloorK}
            allowFederal={allowFederal}
          />
        </Aside>
      </Layout>

      <Footer>
        <FooterLeft>
          <span aria-hidden>🗐</span> Your changes autosave
        </FooterLeft>
        <FooterRight>
          {step > 1 && (
            <BackBtn onClick={handleBack} aria-label="Go back to previous step">
              Back
            </BackBtn>
          )}
          <ExitBtn onClick={handleExit}>
            <FullLabel>Save &amp; exit</FullLabel>
            <ShortLabel>Save</ShortLabel>
          </ExitBtn>
          <NextBtn onClick={handleNext}>
            {step === 1 && (<><FullLabel>Next: where &amp; pay</FullLabel><ShortLabel>Next ›</ShortLabel></>)}
            {step === 2 && (<><FullLabel>Next: application answers</FullLabel><ShortLabel>Next ›</ShortLabel></>)}
            {step === 3 && (<><FullLabel>Next: pacing &amp; guardrails</FullLabel><ShortLabel>Next ›</ShortLabel></>)}
            {step === 4 && (<><FullLabel>Finish &amp; go to dashboard</FullLabel><ShortLabel>Finish</ShortLabel></>)}
          </NextBtn>
        </FooterRight>
      </Footer>
    </Page>
  );
};

export default SetupPage;

/* ─────────────────────────── Live Matches Card ─────────────────────────── */

const LiveMatchesCard = ({
  step,
  criteriaCount,
  roleTitles = [],
  seniority = [],
  industries = [],
  workstyle = [],
  locations = [],
  salaryFloorK = 180,
  allowFederal = false,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [corpus, setCorpus] = useState(null);

  // Probe corpus health once on mount. If the external-jobs sync hasn't
  // run on this host (or hasn't run recently enough to clear the
  // 60d/14d freshness gate), total=0 isn't about the user's criteria —
  // it's about missing data. Show that distinction explicitly instead
  // of telling them to relax filters they didn't get wrong.
  useEffect(() => {
    let cancelled = false;
    applyPilotAPI.corpusStatus()
      .then(res => { if (!cancelled) setCorpus(res.data); })
      .catch(() => { if (!cancelled) setCorpus(null); });
    return () => { cancelled = true; };
  }, []);

  // Debounced fetch, re-runs whenever any criterion changes. We don't
  // care about race conditions on stale responses (last-write-wins is
  // fine for a counter), but we do skip if the component unmounts.
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await applyPilotAPI.matchPreview({
          roleTitles,
          seniority,
          industries,
          workstyle: workstyle.map(w => w.toLowerCase().replace(/[^a-z]/g, '')),
          locations,
          salaryFloorK,
          allowFederal,
        });
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) setData(null);
        console.warn('[applypilot] match-preview failed:', e?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [
    JSON.stringify(roleTitles),
    JSON.stringify(seniority),
    JSON.stringify(industries),
    JSON.stringify(workstyle),
    JSON.stringify(locations),
    salaryFloorK,
    allowFederal,
  ]);

  const total = data?.total ?? 0;
  const delta = data?.delta ?? 0;
  const stats = data?.stats || [];
  const trend = data?.trend?.length ? data.trend : [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const maxTrend = Math.max(1, ...trend);
  const bars = trend.map(v => Math.max(8, Math.round((v / maxTrend) * 100)));

  // Prefix the live count so the aside heading reads as a complete
  // sentence ("34 roles match your criteria"). The big number below
  // restates it visually but the heading was reading as a fragment
  // without the leading value.
  const countPrefix = loading && total === 0 ? '…' : String(total);
  const title = step === 2
    ? `${countPrefix} roles narrow with your filters`
    : `${countPrefix} roles match your criteria`;

  // Three states for the empty-result message:
  //   corpus.status === 'empty'  → no jobs ingested on this host yet
  //   corpus.status === 'stale'  → jobs exist but none within the 60d/14d
  //                                 freshness window match-preview enforces
  //   total === 0 (corpus ok)    → criteria genuinely too strict
  const corpusStatus = corpus?.status;
  const showCorpusBanner = total === 0 && (corpusStatus === 'empty' || corpusStatus === 'stale');
  const note = total === 0
    ? (corpusStatus === 'empty'
        ? 'No jobs indexed yet — the job-board sync hasn\u2019t populated the corpus on this environment. Matches will appear once it runs.'
        : corpusStatus === 'stale'
          ? 'No fresh postings in the index. Recent jobs will appear after the next sync (every 15 min).'
          : 'No matching postings yet. Try adding more role titles or relaxing your filters.')
    : 'Counter reflects live ExternalJob data. Only postings ApplyPilot can actually auto-submit are counted.';

  return (
    <>
      <AsideTitle>{title}</AsideTitle>
      {showCorpusBanner && (
        <CorpusBanner>
          <b>{corpusStatus === 'empty' ? 'Job index is empty' : 'Job index is stale'}</b>
          <span>
            {corpusStatus === 'empty'
              ? 'Your criteria aren\u2019t the problem — no jobs have been ingested yet. ApplyPilot will start matching as soon as the sync runs.'
              : 'No postings within the freshness window. The next external-jobs sync will repopulate.'}
          </span>
        </CorpusBanner>
      )}
      <Card>
        <CardHead>
          <span className="label">LIVE MATCHES</span>
          <span className="status">
            <Pulse /> {loading ? 'UPDATING' : 'LIVE'}
          </span>
        </CardHead>

        <Big>
          {total}
          {delta > 0 && <sup>+{delta}</sup>}
        </Big>

        <BarChart>
          {bars.map((h, i) => (
            <Bar key={i} style={{ height: `${h}%` }} />
          ))}
        </BarChart>

        <StatList>
          {stats.map((s) => (
            <li key={s.label}><span>{s.label}</span><b>{s.value}</b></li>
          ))}
        </StatList>

        <Note>{note}</Note>
      </Card>
    </>
  );
};

/* ─────────────────────────────── styles ─────────────────────────────── */

const BRAND = '#6C5CE7';
const BRAND_DK = '#5948C9';
const BRAND_50 = '#EFECFB';
const INK = '#17152A';
const INK_SOFT = '#2D2A3E';
const MUTED = '#6B6787';
const LINE = '#E4DFF5';
const GOOD = '#22C55E';
const BG = '#F7F6FB';
const CARD_BG = '#FFFFFF';

const Page = styled.div`
  background: ${BG};
  padding: 22px 32px 160px;
  position: relative;
  min-height: calc(100vh - 120px);

  @media (max-width: 768px) {
    padding: 18px 18px 180px;
  }
`;

const SaveHint = styled.div`
  position: absolute;
  top: 22px;
  right: 32px;
  font-size: 13px;
  color: ${MUTED};
  @media (max-width: 768px) { display: none; }
`;

const Progress = styled.ol`
  list-style: none;
  padding: 0;
  margin: 12px 0 34px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  max-width: 1180px;
`;

const ProgressItem = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Bubble = styled.span`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  color: ${(p) => (p.$active ? '#fff' : p.$done ? '#fff' : MUTED)};
  background: ${(p) => (p.$active ? BRAND : p.$done ? BRAND : '#F4F2FB')};
  border: 1px solid ${(p) => (p.$active || p.$done ? BRAND : LINE)};
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:hover {
    ${(p) => p.$clickable && `
      transform: scale(1.08);
      box-shadow: 0 4px 12px rgba(108, 92, 231, 0.35);
    `}
  }
`;

const ProgressLine = styled.span`
  flex: 1;
  height: 2px;
  background: ${(p) => (p.$done ? BRAND : LINE)};
  border-radius: 2px;
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 40px;
  max-width: 1400px;

  @media (max-width: 1060px) {
    grid-template-columns: 1fr;
  }
`;

const Main = styled.div`
  min-width: 0;
`;

const Aside = styled.aside`
  @media (min-width: 1061px) {
    position: sticky;
    top: 90px;
    align-self: flex-start;
  }
`;

const H1 = styled.h1`
  margin: 0 0 8px;
  font-size: clamp(28px, 3vw, 36px);
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.02em;
  line-height: 1.15;
`;

const Lede = styled.p`
  margin: 0 0 36px;
  font-size: 15px;
  color: ${MUTED};
  line-height: 1.6;
`;

const Section = styled.div`
  margin-bottom: 30px;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    color: ${INK};
    letter-spacing: -0.01em;
  }
  span {
    font-size: 13px;
    color: ${MUTED};
  }
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  background: ${(p) => (p.$on ? BRAND_50 : '#FFFFFF')};
  color: ${(p) => (p.$on ? BRAND_DK : INK_SOFT)};
  border: 1px solid ${(p) => (p.$on ? '#D7CFF5' : LINE)};
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  .check {
    font-size: 12px;
    color: ${BRAND};
    font-weight: 800;
  }
  &:hover {
    background: ${(p) => (p.$on ? '#E7E1F9' : '#F4F2FB')};
  }
`;

const ChipDashed = styled.button`
  padding: 9px 16px;
  background: transparent;
  border: 1px dashed ${LINE};
  border-radius: 999px;
  color: ${BRAND};
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: ${BRAND_50}; }
`;

const InlineInput = styled.input`
  padding: 9px 16px;
  border: 1px solid ${BRAND};
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 600;
  outline: none;
  min-width: 170px;
`;

const Tip = styled.div`
  margin-top: 18px;
  background: #FDFCF5;
  border: 1px solid #EFE7B8;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  font-size: 13.5px;
  line-height: 1.55;
  color: ${INK_SOFT};
  b { color: ${INK}; font-weight: 700; }
`;

const Placeholder = styled.div`
  padding: 60px 40px;
  text-align: center;
  color: ${MUTED};
  background: ${CARD_BG};
  border: 1px dashed ${LINE};
  border-radius: 16px;
  font-size: 14px;
`;

/* ── Step 2, work style cards ── */

const WorkStyleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const WorkStyleCard = styled.button`
  position: relative;
  text-align: left;
  background: ${(p) => (p.$on ? BRAND_50 : CARD_BG)};
  border: 1px solid ${(p) => (p.$on ? '#C5B8F2' : LINE)};
  border-radius: 14px;
  padding: 18px 18px 16px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  box-shadow: ${(p) => (p.$on ? '0 4px 14px rgba(108, 92, 231, 0.12)' : 'none')};
  &:hover {
    background: ${(p) => (p.$on ? '#E7E1F9' : '#F4F2FB')};
  }
`;

const WsCheck = styled.span`
  position: absolute;
  top: 14px;
  right: 14px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid ${(p) => (p.$on ? BRAND : LINE)};
  background: ${(p) => (p.$on ? BRAND : '#FFFFFF')};
  color: #FFFFFF;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
`;

const WsEmoji = styled.div`
  font-size: 30px;
  line-height: 1;
  margin-bottom: 14px;
`;

const WsTitle = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.01em;
  margin-bottom: 4px;
`;

const WsDesc = styled.div`
  font-size: 13px;
  color: ${MUTED};
  line-height: 1.5;
`;

/* ── Step 2, salary card ── */

const SalaryCard = styled.div`
  background: ${CARD_BG};
  border: 1px solid ${LINE};
  border-radius: 14px;
  padding: 22px 24px;
`;

const SalaryTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
`;

const SalaryValueBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SalaryValue = styled.div`
  font-size: 40px;
  font-weight: 800;
  color: ${BRAND};
  letter-spacing: -0.03em;
  line-height: 1;
`;

const SalaryMeta = styled.div`
  font-size: 12.5px;
  color: ${MUTED};
`;

const SalarySteppers = styled.div`
  display: flex;
  gap: 8px;
`;

const StepBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid ${LINE};
  background: #FFFFFF;
  color: ${INK};
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  display: grid;
  place-items: center;
  line-height: 1;
  &:hover { background: #F4F2FB; }
`;

const SalarySlider = styled.input`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  outline: none;
  margin: 0 0 8px;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #FFFFFF;
    border: 3px solid ${BRAND};
    box-shadow: 0 2px 6px rgba(108, 92, 231, 0.35);
    cursor: pointer;
  }
  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #FFFFFF;
    border: 3px solid ${BRAND};
    box-shadow: 0 2px 6px rgba(108, 92, 231, 0.35);
    cursor: pointer;
  }
`;

const SalaryTicks = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: ${MUTED};
  margin-bottom: 18px;
`;

const MatchTip = styled.div`
  margin-top: 14px;
  padding: 14px 16px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 12px;
  font-size: 13px;
  color: ${INK_SOFT};
  line-height: 1.55;

  b {
    color: ${INK};
  }

  ul {
    margin: 8px 0 0;
    padding-left: 18px;
  }

  li {
    margin-bottom: 4px;
  }
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid ${LINE};
  font-size: 13.5px;
  color: ${INK_SOFT};
  cursor: pointer;
  user-select: none;

  > span:last-child {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;

const Switch = styled.span`
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: ${(p) => (p.$on ? BRAND : '#D8D4EA')};
  position: relative;
  transition: background 0.15s;
  flex-shrink: 0;
`;

const Knob = styled.span`
  position: absolute;
  top: 2px;
  left: ${(p) => (p.$on ? '18px' : '2px')};
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: left 0.15s;
`;

/* ── Step 3, application answers ── */

const StackedChoices = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ChoiceCard = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  text-align: left;
  padding: 14px 16px;
  background: ${(p) => (p.$on ? BRAND_50 : CARD_BG)};
  border: 1px solid ${(p) => (p.$on ? '#C5B8F2' : LINE)};
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  box-shadow: ${(p) => (p.$on ? '0 4px 14px rgba(108, 92, 231, 0.12)' : 'none')};
  &:hover {
    background: ${(p) => (p.$on ? '#E7E1F9' : '#F4F2FB')};
  }
`;

const ChoiceRadio = styled.span`
  flex-shrink: 0;
  margin-top: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid ${(p) => (p.$on ? BRAND : LINE)};
  background: #FFFFFF;
  display: grid;
  place-items: center;
  span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${BRAND};
  }
`;

const ChoiceTitle = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${INK};
  letter-spacing: -0.01em;
  margin-bottom: 3px;
`;

const ChoiceDesc = styled.div`
  font-size: 13px;
  color: ${MUTED};
  line-height: 1.5;
`;

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
    gap: 0;
  }
`;

const TextInput = styled.input`
  width: 100%;
  padding: 11px 14px;
  border: 1px solid ${LINE};
  border-radius: 10px;
  font-size: 14px;
  color: ${INK};
  background: #FFFFFF;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  &::placeholder { color: #B7B2CC; }
  &:focus {
    border-color: ${BRAND};
    box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.15);
  }
`;

const NumInput = styled(TextInput)`
  max-width: 160px;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FieldLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: ${MUTED};
`;

const FromProfileStar = styled.span`
  color: ${BRAND};
  font-size: 10px;
  line-height: 1;
  margin-right: 2px;
`;

const ProfileBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  margin: 0 0 22px;
  background: ${BRAND_50};
  border: 1px solid #D7CFF5;
  border-radius: 12px;

  @media (max-width: 560px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const ProfileBannerText = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  color: ${INK_SOFT};
  line-height: 1.5;
  b { color: ${INK}; font-weight: 700; }
`;

const ProfileBannerBtn = styled.button`
  flex-shrink: 0;
  background: #FFFFFF;
  color: ${BRAND_DK};
  border: 1px solid #C5B8F2;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: #F4F0FF; }
`;

const FromProfileTag = styled.span`
  background: ${BRAND_50};
  color: ${BRAND_DK};
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: none;
`;

/* ── Step 4, review rails ── */

const ModeBadge = styled.span`
  display: inline-block;
  margin-left: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.3px;
  vertical-align: 2px;
  background: ${(p) =>
    p.$tone === 'business' ? '#E8F7EC' :
    p.$tone === 'extended' ? BRAND_50 :
    p.$tone === 'always'   ? '#FEF2E3' :
    '#F4F2FB'};
  color: ${(p) =>
    p.$tone === 'business' ? '#1F8A3C' :
    p.$tone === 'extended' ? BRAND_DK :
    p.$tone === 'always'   ? '#B86410' :
    INK_SOFT};
`;

const MandatoryReviewBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin: 0 0 24px;
  background: #F1FBF3;
  border: 1px solid #C7E8CE;
  border-radius: 12px;
  font-size: 13.5px;
  line-height: 1.5;
  color: ${INK_SOFT};
  b { color: #1F8A3C; font-weight: 800; }
`;

const SummaryCard = styled.div`
  background: ${CARD_BG};
  border: 1px solid ${LINE};
  border-radius: 14px;
  padding: 20px 22px;
`;

const SummaryLine = styled.p`
  margin: 0 0 18px;
  font-size: 15px;
  line-height: 1.55;
  color: ${INK_SOFT};
  b { color: ${INK}; font-weight: 800; }
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid ${LINE};

  @media (max-width: 720px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const SummaryItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SummaryK = styled.div`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: ${MUTED};
`;

const SummaryV = styled.div`
  font-size: 18px;
  font-weight: 800;
  color: ${INK};
  letter-spacing: -0.01em;
`;

/* ── Aside ── */

const AsideTitle = styled.div`
  font-size: 12px;
  color: ${MUTED};
  margin: 0 0 10px 4px;
`;

const Card = styled.div`
  background: ${CARD_BG};
  border: 1px solid ${LINE};
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 4px 14px rgba(23, 21, 42, 0.04);
`;

const CorpusBanner = styled.div`
  background: #FFF7E6;
  border: 1px solid #F2C572;
  color: #6B4A0F;
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  line-height: 1.4;

  b { color: #5A3D08; font-size: 13px; }
  span { color: #6B4A0F; }
`;

const CardHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  .label { color: ${MUTED}; }
  .status {
    color: ${GOOD};
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
`;

const pulse = keyframes`
  0% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
  100% { opacity: 0.4; transform: scale(0.8); }
`;

const Pulse = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${GOOD};
  animation: ${pulse} 1.4s infinite ease-in-out;
`;

const Big = styled.div`
  margin: 14px 0 10px;
  font-size: 54px;
  font-weight: 800;
  color: ${BRAND};
  letter-spacing: -0.03em;
  line-height: 1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  sup {
    font-size: 15px;
    font-weight: 700;
    color: ${GOOD};
    margin-top: 6px;
  }
`;

const BarChart = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 90px;
  margin: 10px 0 18px;
`;

const Bar = styled.div`
  flex: 1;
  background: linear-gradient(180deg, #8874EE 0%, ${BRAND} 100%);
  border-radius: 5px 5px 0 0;
`;

const StatList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid ${LINE};
    font-size: 13.5px;
    span { color: ${MUTED}; }
    b { color: ${INK_SOFT}; font-weight: 700; }
    &:last-child { border-bottom: 0; }
  }
`;

const Note = styled.div`
  background: ${BRAND_50};
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 12.5px;
  color: #534793;
  line-height: 1.5;
`;

/* ── Footer ── */

const Footer = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(8px);
  border-top: 1px solid ${LINE};
  padding: 14px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  z-index: 40;

  @media (max-width: 768px) {
    padding: 12px 16px;
  }
`;

const FooterLeft = styled.div`
  color: ${MUTED};
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  @media (max-width: 520px) { display: none; }
`;

const FooterRight = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
`;

const ExitBtn = styled.button`
  background: #FFFFFF;
  color: ${INK_SOFT};
  border: 1px solid ${LINE};
  border-radius: 10px;
  padding: 11px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  &:hover { background: #F4F2FB; }
`;

const BackBtn = styled.button`
  background: #FFFFFF;
  color: ${BRAND};
  border: 1px solid ${BRAND};
  border-radius: 10px;
  padding: 11px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
  white-space: nowrap;
  &:hover { background: #EFECFB; }
`;

const NextBtn = styled.button`
  background: ${BRAND};
  color: #FFFFFF;
  border: 0;
  border-radius: 10px;
  padding: 11px 22px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 6px 18px rgba(108, 92, 231, 0.28);
  &:hover { background: ${BRAND_DK}; }
`;

const FullLabel = styled.span`
  @media (max-width: 480px) { display: none; }
`;

const ShortLabel = styled.span`
  display: none;
  @media (max-width: 480px) { display: inline; }
`;
