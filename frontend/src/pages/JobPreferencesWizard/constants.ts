// Constants for JobPreferencesWizard

export const ROUTES = {
  PROFILE_CREATE_FORM: '/profile/create-form',
  HOME: '/',
} as const;

export const STEPS = [
  { id: 'identity', label: 'Industry & Role' },
  { id: 'preferences', label: 'Opportunity Type' },
  { id: 'skills', label: 'Skills' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'projects', label: 'Projects' },
  { id: 'final', label: 'Final Details' },
] as const;

export const EXPERIENCE_LEVELS = [
  { id: 'entry', label: 'Entry Level', sub: '0-2 years', icon: '🌱' },
  { id: 'mid', label: 'Mid Level', sub: '3-5 years', icon: '🚀' },
  { id: 'senior', label: 'Senior', sub: '6-10 years', icon: '⭐' },
  { id: 'lead', label: 'Lead/Manager', sub: '10+ years', icon: '👑' },
  { id: 'executive', label: 'Executive', sub: 'C-suite', icon: '💎' },
] as const;

export const AVAILABILITY_OPTIONS = [
  { id: 'immediately', label: 'Immediately', sub: 'Ready to start now', color: '#22c55e' },
  { id: '2_weeks', label: 'In 2 weeks', sub: 'Wrapping up current role', color: '#f59e0b' },
  { id: '1_month', label: 'In 1 month+', sub: 'Open but not urgent', color: '#ef4444' },
  { id: 'casually_browsing', label: 'Casually browsing', sub: 'Just exploring options', color: '#6366f1' },
] as const;

export const AI_TIPS = [
  'A clear title helps recruiters find you 3x faster!',
  'Candidates who specify role type get 40% more relevant matches.',
  'Adding at least 5 skills doubles your profile visibility.',
  'Even one role with metrics beats five vague entries.',
  'Education matters — even bootcamps and online courses count.',
  "No work history yet? Side projects are how new grads stand out.",
  'Complete profiles get 5x more recruiter views!',
] as const;

// Branching question on the Experience step. Lets new grads / career changers
// skip the work-history form and jump straight to Projects + Education.
export const LIMITS = {
  DEFAULT_SALARY_MIN: 60000,
  SALARY_MAX: 300000,
  SALARY_STEP: 5000,
  SALARY_K_THRESHOLD: 1000,
  ACTIVE_TITLES_LIMIT: 18,
  SCROLL_MAX_HEIGHT: 300,
  AUTOCOMPLETE_LIMIT: 10,
  TIP_AVATAR_SIZE: 28,
} as const;

export const LOCALSTORAGE_KEY = 'profileai_job_preferences' as const;

export const TEXT = {
  LOGO: 'ProfilleAI',
  SKIP: 'Skip for now \u2192',
  STEP_INDUSTRY: 'What industry are you in?',
  STEP_ROLE: 'What best describes your role?',
  STEP_OPPORTUNITY: 'What kind of opportunities?',
  STEP_SKILLS: 'What are your top skills?',
  STEP_EXPERIENCE: 'Tell us about your work experience',
  STEP_EDUCATION: 'Your education',
  STEP_PROJECTS: 'Projects you\u2019ve worked on',
  STEP_FINAL: 'Almost done \u2014 a few last details',
  BUILD_PROFILE: 'Build My Profile',
  CONTINUE: 'Continue',
  BACK: 'Back',
  SKIP_STEP: 'Skip this step',
  SEARCH_SKILLS: 'Search skills...',
  TAP_SKILLS: 'Tap skills below to add them here...',
  SALARY_UNIT: 'USD per year',
} as const;

/* ─── Sector / Title / Skill data ─────────────────────────────────
   Moved to src/data/jobTaxonomy.js when ProfileCoach became a second
   consumer. Re-exported here so existing imports from this module keep
   working unchanged. */
export {
  JOB_SECTORS,
  SECTOR_TITLES,
  ALL_TITLES,
  SECTOR_SKILLS,
  ALL_SKILLS,
  EMPLOYMENT_TYPES,
  CAREER_STAGES,
} from '../../data/jobTaxonomy.js';

export type SkillCategoryMap = Record<string, string[]>;
