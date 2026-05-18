export const TEXT = {
  PAGE_TITLE: 'Interview Calendar',
  TODAY_BUTTON: 'Today',
  UPCOMING_TITLE: 'Upcoming Interviews',
  EMPTY_TITLE: 'No upcoming interviews',
  EMPTY_DESCRIPTION: 'Schedule interviews with candidates to see them here',
  SIDEBAR_TITLE: 'Interview Details',
  LABELS: {
    POSITION: 'Position',
    DATE_TIME: 'Date & Time',
    FORMAT: 'Format',
    INTERVIEW_TYPE: 'Interview Type',
    NOTES: 'Notes',
  },
  JOIN_MEETING: 'Join Meeting',
  DEFAULT_FORMAT: 'Video Call',
} as const;

export const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const UPCOMING_INTERVIEWS_LIMIT = 5;

export const DEFAULT_PHONE_SCREENING_DURATION = 15;

export const DATE_LOCALE = 'en-US';

export const TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
};

export const MONTH_YEAR_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'long',
  year: 'numeric',
};
