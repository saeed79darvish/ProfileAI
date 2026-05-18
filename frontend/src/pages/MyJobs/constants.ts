// Constants for MyJobs

export const ROUTES = {
  APPLYPILOT: '/applypilot',
} as const;

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  applied: { label: 'Applied', color: '#667eea', bg: '#eef0ff', icon: '📤' },
  screening: { label: 'Screening', color: '#f59e0b', bg: '#fef3c7', icon: '📋' },
  interviewing: { label: 'Interviewing', color: '#8b5cf6', bg: '#ede9fe', icon: '🎯' },
  offer: { label: 'Offer', color: '#10b981', bg: '#d1fae5', icon: '🎉' },
  rejected: { label: 'Rejected', color: '#ef4444', bg: '#fee2e2', icon: '❌' },
  withdrawn: { label: 'Withdrawn', color: '#6b7280', bg: '#f3f4f6', icon: '↩️' },
  no_response: { label: 'No Response', color: '#9ca3af', bg: '#f9fafb', icon: '⏳' },
};

export const KANBAN_COLUMNS = ['applied', 'screening', 'interviewing', 'offer'] as const;

export const ARCHIVE_STATUSES = ['rejected', 'withdrawn', 'no_response'] as const;

export const COMPANY_COLORS = [
  { color: '#667eea', bg: '#eef0ff' },
  { color: '#10b981', bg: '#d1fae5' },
  { color: '#f59e0b', bg: '#fef3c7' },
  { color: '#ef4444', bg: '#fee2e2' },
  { color: '#8b5cf6', bg: '#ede9fe' },
  { color: '#06b6d4', bg: '#cffafe' },
  { color: '#ec4899', bg: '#fce7f3' },
] as const;

export const TIMINGS = {
  SEARCH_DEBOUNCE: 400,
  SNACKBAR_DURATION: 3000,
  MS_PER_DAY: 1000 * 60 * 60 * 24,
} as const;

export const LIMITS = {
  DAY_THRESHOLD: 7,
  WEEK_THRESHOLD: 30,
  CONTEXT_MENU_MIN_WIDTH: 180,
  DETAIL_AVATAR_SIZE: 42,
} as const;

export const TEXT = {
  PAGE_TITLE: 'My Jobs',
  SUBTITLE: 'Track every job you\'ve applied to',
  SUBTITLE_PILOT: 'Track every job you\'ve applied to with ApplyPilot',
  EMPTY_TITLE: 'No applications yet',
  EMPTY_DESC: 'Install the ApplyPilot Chrome extension and every job you apply to will automatically appear here. You can also add applications manually.',
  GET_APPLYPILOT: 'Get ApplyPilot',
  ADD_MANUALLY: 'Add Manually',
  ADD_APP: 'Add Application',
  EDIT_APP: 'Edit Application',
  SAVE_CHANGES: 'Save Changes',
  LOAD_ERROR: 'Failed to load applications',
  STATUS_ERROR: 'Failed to update status',
  REMOVED: 'Application removed',
  DELETE_ERROR: 'Failed to delete',
  ADDED: 'Application added!',
  DUPLICATE: 'Already tracking this application',
  ADD_ERROR: 'Failed to add application',
  UPDATED: 'Application updated',
  UPDATE_ERROR: 'Failed to update',
  DELETE_CONFIRM: 'Delete Application?',
  SEARCH_PLACEHOLDER: 'Search by company or job title...',
  VIEW_POSTING: 'View original posting',
  MOVE_TO: 'MOVE TO',
  MOVE_TO_MENU: 'Move to...',
  CANCEL: 'Cancel',
  DELETE: 'Delete',
  NOTES: 'Notes',
} as const;
