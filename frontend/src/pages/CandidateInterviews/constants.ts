// Constants for CandidateInterviews

export const QUICK_TIME_SLOTS = [
  { label: '9:00 AM', value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
  { label: '11:00 AM', value: '11:00' },
  { label: '2:00 PM', value: '14:00' },
  { label: '3:00 PM', value: '15:00' },
  { label: '4:00 PM', value: '16:00' },
] as const;

export const SCORE_THRESHOLDS = {
  HIGH: 80,
  MEDIUM: 60,
  LOW: 40,
} as const;

export const TIMINGS = {
  COUNTDOWN_INTERVAL: 1000,
  TOAST_DISMISS: 5000,
} as const;

export const LIMITS = {
  IMPORTANT_GAPS: 3,
} as const;
