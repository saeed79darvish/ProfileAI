// Constants for CandidateJobs

export const ROUTES = {
  LOGIN: '/login',
  AGENT_ARENA: (id: string | number) => `/agent-arena/${id}`,
} as const;

export const WITHDRAWABLE_STATUSES = [
  'submitted',
  'under_review',
  'screening',
  'shortlisted',
  'interview_scheduled',
] as const;

export const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  submitted: { bg: '#E0F2FE', color: '#0369A1', label: 'Submitted' },
  under_review: { bg: '#FEF3C7', color: '#B45309', label: 'Under Review' },
  screening: { bg: '#E0E7FF', color: '#4338CA', label: 'Screening' },
  shortlisted: { bg: '#D1FAE5', color: '#047857', label: 'Shortlisted' },
  interview_scheduled: { bg: '#DDD6FE', color: '#7C3AED', label: 'Interview Scheduled' },
  offered: { bg: '#D1FAE5', color: '#047857', label: 'Offer Received' },
  rejected: { bg: '#FEE2E2', color: '#B91C1C', label: 'Not Selected' },
  withdrawn: { bg: '#F3F4F6', color: '#6B7280', label: 'Withdrawn' },
};

export const THRESHOLDS = {
  SALARY_K_DIVISOR: 1000,
  MS_PER_DAY: 1000 * 60 * 60 * 24,
  DAYS_THRESHOLD: 7,
  WEEKS_THRESHOLD: 30,
  MOBILE_BREAKPOINT: 1024,
} as const;

/**
 * Salary filter quick-options (used by the Salary filter chip below).
 * Stored as raw numbers so we can pass them straight to the
 * salaryMin / salaryMax query params on /api/jobs.
 */
export const SALARY_OPTIONS: ReadonlyArray<{ label: string; min: number | null; max: number | null; value: string }> = [
  { value: '50k+',   label: '$50k+',         min: 50000,  max: null },
  { value: '80k+',   label: '$80k+',         min: 80000,  max: null },
  { value: '100k+',  label: '$100k+',        min: 100000, max: null },
  { value: '150k+',  label: '$150k+',        min: 150000, max: null },
  { value: '200k+',  label: '$200k+',        min: 200000, max: null },
];

export const TEXT = {
  PAGE_TITLE: 'Jobs',
  POSITIONS_AVAILABLE: 'positions available',
  SEARCH_PLACEHOLDER: 'Search jobs, skills...',
  FILTERS: 'Filters',
  FILTER_JOBS: 'Filter Jobs',
  CLEAR_FILTERS: 'Clear all filters',
  ALL_LOCATIONS: 'All locations',
  ALL_TYPES: 'All types',
  ALL_EMPLOYMENT: 'All employment types',
  ALL_LEVELS: 'All levels',
  TAB_ALL: 'All Jobs',
  TAB_SAVED: 'Saved',
  TAB_APPLICATIONS: 'My Applications',
  BADGE_AVAILABLE: 'AVAILABLE',
  BADGE_NEW: 'NEW TODAY',
  LOADING_APPS: 'Loading applications...',
  LOADING_JOBS: 'Loading jobs...',
  NO_APPLICATIONS: 'No applications yet',
  NO_JOBS: 'No jobs found',
  APPLY_TO_TRACK: 'Apply to jobs to track them here',
  COMPETITIVE_SALARY: 'Competitive',
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
  WITHDRAW: 'Withdraw Application',
  WITHDRAWING: 'Withdrawing...',
  WITHDRAW_CONFIRM: 'Withdraw Application?',
  WITHDRAW_WARNING: 'This action cannot be undone.',
  WITHDRAW_ERROR: 'Failed to withdraw application',
} as const;
