// Constants for RecruiterTools

export const ROUTES = {
  BROWSE: '/browse',
  PROFILE: (id: string | number) => `/profile/${id}`,
  RECRUITER_TOOLS: (id: string | number) => `/recruiter-tools/${id}`,
} as const;

export const THRESHOLDS = {
  TOP_SKILLS: 10,
  SKILLS_SLICE: 5,
  CULTURE_FIT_HIGH: 80,
} as const;

export const DEFAULTS = {
  OUTREACH_TONE: 'professional',
  CURRENCY: 'USD',
  COMPANY_VALUES: 'Innovation, collaboration, continuous learning, work-life balance, diversity and inclusion',
} as const;

export const TEXT = {
  PAGE_TITLE: 'Recruiter AI Tools',
  EMPTY_STATE: 'Select a candidate profile from Browse Profiles to get started.',
  BROWSE_PROFILES: 'Browse Profiles',
  BACK_TO_PROFILES: 'Back to Profiles',
  VIEW_FULL_PROFILE: 'View Full Profile',
  LOADING: 'Loading candidate…',
  LOAD_ERROR: 'Failed to load profile',
  INTERVIEW_ERROR: 'Failed to generate interview questions',
  SALARY_ERROR: 'Failed to predict salary',
  OUTREACH_ERROR: 'Failed to generate outreach message',
  SKILL_GAP_ERROR: 'Failed to analyze skill gaps',
  CULTURE_FIT_ERROR: 'Failed to predict culture fit',
  COMPARE_ERROR: 'Failed to compare candidates',
  TAB_INTERVIEW: 'AI-Generated Interview Questions',
  TAB_SALARY: 'AI Salary Range Prediction',
  TAB_OUTREACH: 'Personalized Outreach Generator',
  TAB_SKILL_GAP: 'Skill Gap Analysis',
  TAB_CULTURE_FIT: 'Culture Fit Prediction',
  TAB_COMPARE: 'AI Candidate Comparison',
} as const;
