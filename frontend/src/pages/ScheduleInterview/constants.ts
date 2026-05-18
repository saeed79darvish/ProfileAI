export const ROUTES = {
  DASHBOARD: '/profile',
  CALENDAR: '/recruiter/calendar',
} as const;

export const TEXT = {
  BREADCRUMB_DASHBOARD: 'Dashboard',
  BREADCRUMB_CALENDAR: 'Calendar',
  BREADCRUMB_SCHEDULE: 'Schedule Interview',
  HERO_TITLE: 'Schedule Interview',
  HERO_SUBTITLE: 'Propose interview times for the candidate to choose from',
  ERROR_MISSING: 'Missing candidate or job information',
  ERROR_LOAD: 'Failed to load candidate or job information',
  LOADING: 'Loading interview details...',
  SECTION_CANDIDATE: 'Candidate',
  SECTION_POSITION: 'Position',
  SECTION_SETTINGS: 'Interview Settings',
  SECTION_SLOTS: 'Proposed Time Slots',
  SECTION_NOTES: 'Notes for Candidate',
  LABEL_TYPE: 'Interview Type',
  LABEL_FORMAT: 'Format',
  LABEL_DURATION: 'Duration (minutes)',
  ADD_SLOT: 'Add Another Time Slot',
  AI_SCREENING_TITLE: 'Agent AI Call Settings',
  AI_SCREENING_ALT: 'AI Phone Screening',
  BADGE_NEW: 'NEW',
  LABEL_SCREENING_DURATION: 'Screening Duration',
  NOTES_PLACEHOLDER: 'Add any instructions or information for the candidate (optional)',
  BUTTON_SENDING: 'Sending...',
  BUTTON_SUBMIT: 'Send Interview Request',
  ERROR_NO_SLOTS: 'Please add at least one time slot',
  ERROR_SCHEDULE: 'Failed to schedule interview',
  SUCCESS: 'Interview scheduled successfully! The candidate will be notified.',
  NO_HEADLINE: 'No headline',
} as const;

export const INTERVIEW_TYPES = [
  { value: 'screening', label: 'Initial Screening' },
  { value: 'technical', label: 'Technical Interview' },
  { value: 'behavioral', label: 'Behavioral Interview' },
  { value: 'final', label: 'Final Round' },
  { value: 'other', label: 'Other' },
] as const;

export const FORMAT_OPTIONS = [
  { value: 'video', label: 'Video Call' },
  { value: 'phone', label: 'Phone' },
  { value: 'in_person', label: 'In Person' },
  { value: 'ai_agent', label: 'Agent AI Call' },
] as const;

export const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 90, label: '90 minutes' },
] as const;

export const SCREENING_DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
] as const;

export const DEFAULTS = {
  DURATION: 30,
  PHONE_SCREENING_DURATION: 15,
} as const;
