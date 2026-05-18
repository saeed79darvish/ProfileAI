export const ROUTES = {
  INTERVIEWS: '/interviews',
  RECRUITER_JOBS: '/recruiter/jobs',
  RECRUITER_JOB_APPLICATIONS: (jobId: string | number) => `/recruiter/jobs/${jobId}/applications`,
  JOBS: '/jobs',
  MESSAGES: '/messages',
  MESSAGES_CONVERSATION: (id: string | number) => `/messages/${id}`,
  AGENT_ARENA: '/agent-arena',
  AGENT_ARENA_DETAIL: (id: string | number) => `/agent-arena/${id}`,
  PROFILE: (id: string | number) => `/profile/${id}`,
  NETWORK: '/network',
  FEED: '/feed',
  FEED_POST: (postId: string | number) => `/feed?post=${postId}`,
} as const;

export const TEXT = {
  PAGE_TITLE: 'Notifications',
  ALL_READ: 'All caught up!',
  ERROR_LOADING: 'Failed to load notifications',
  EMPTY_UNREAD: 'No unread notifications',
  EMPTY_ALL: 'No notifications yet',
  TOOLTIPS: {
    MARK_ALL_READ: 'Mark all as read',
    CLEAR_ALL: 'Clear all',
  },
  TABS: {
    ALL: 'All',
    UNREAD: 'Unread',
  },
  MENU: {
    MARK_READ: 'Mark as read',
    DELETE: 'Delete',
  },
  LOAD_MORE: 'Load More',
} as const;

export const NOTIFICATION_CONFIG = {
  interview_scheduled: { color: '#4caf50', label: 'Interview' },
  interview_updated: { color: '#2196f3', label: 'Interview Updated' },
  interview_cancelled: { color: '#f44336', label: 'Interview Cancelled' },
  interview_reminder: { color: '#ff9800', label: 'Reminder' },
  application_received: { color: '#9c27b0', label: 'Application' },
  application_status: { color: '#3f51b5', label: 'Status Update' },
  message_received: { color: '#00bcd4', label: 'Message' },
  agent_update: { color: '#673ab7', label: 'Agent Arena' },
  agent_completed: { color: '#4caf50', label: 'Negotiation Complete' },
  follow_new: { color: '#e91e63', label: 'New Follower' },
  post_like: { color: '#ff5722', label: 'Post Liked' },
  post_comment: { color: '#795548', label: 'New Comment' },
  system: { color: '#607d8b', label: 'System' },
} as const;

export const PAGE_SIZE = 20;

export const TAB_INDEX = {
  ALL: 0,
  UNREAD: 1,
} as const;
