// Constants for RecruiterProfileForm

export const ROUTES = {
  RECRUITER_DASHBOARD: '/recruiter/dashboard',
} as const;

export const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
] as const;

export const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Retail',
  'Manufacturing',
  'Consulting',
  'Media & Entertainment',
  'Real Estate',
  'Transportation',
  'Energy',
  'Hospitality',
  'Telecommunications',
  'Non-Profit',
  'Government',
  'Other',
] as const;

export const TIMINGS = {
  SUCCESS_DISMISS: 3000,
} as const;

export const VALIDATION = {
  MIN_TEXT_LENGTH: 10,
} as const;

export const AVATAR_SIZE = 150;
