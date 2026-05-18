// Constants for RecruiterDashboard

export const ROUTES = {
  PROFILE: '/profile',
  RECRUITER_ONBOARDING: '/recruiter/onboarding',
  RECRUITER_JOBS: '/recruiter/jobs',
  BROWSE: '/browse',
  PRICING: '/pricing',
  RECRUITER_PROFILE: '/recruiter/profile',
  MESSAGES: '/messages',
  CANDIDATE_PROFILE: (id: string | number) => `/profile/${id}`,
} as const;

export const LIMITS = {
  JOBS_SIDEBAR: 5,
  TOP_CANDIDATES: 6,
  SKILLS_SLICE: 3,
  SIDEBAR_WIDTH: 280,
  CHART_HEIGHT: 250,
} as const;

export const QUOTAS = {
  AI_ENHANCEMENTS: { used: 0, total: 3 },
  SMART_MATCHES: { used: 0, total: 10 },
} as const;

export const CHART_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const TEXT = {
  PAGE_TITLE: 'Recruiter Dashboard',
  POST_NEW_JOB: 'Post New Job',
  AI_SMART_MATCH: 'AI Smart Match',
  ACTIVE_JOBS: 'Active Jobs',
  NO_ACTIVE_JOBS: 'No active jobs yet',
  POST_FIRST: 'Post your first job',
  UPGRADE_TO_PRO: 'Upgrade to Pro',
  UPGRADE_DESC: 'Unlock unlimited AI matching and advanced analytics',
  VIEW_PLANS: 'View Plans',
  PROFILE_VIEWS: 'Profile Views',
  NEW_MATCHES: 'New Matches',
  JOB_POSTS: 'Job Posts',
  MESSAGES_LABEL: 'Messages',
  ANALYTICS_TITLE: 'Profile Views Analytics',
  ANALYTICS_PERIOD: 'Last 7 days',
  TOP_CANDIDATES: 'Top Matched Candidates',
  VIEW_ALL: 'View All',
  LOADING_CANDIDATES: 'Loading candidates...',
  NO_CANDIDATES: 'No candidates found yet',
  BROWSE_PROFILES: 'Browse Profiles',
  CONTACT: 'Contact',
  SUBSCRIPTION: 'Subscription',
  AI_ENHANCEMENTS: 'AI Enhancements',
  SMART_MATCHES: 'Smart Matches',
  QUICK_STATS: 'Quick Stats',
  SAVED_CANDIDATES: 'Saved Candidates',
  SEARCHES_TODAY: 'Searches Today',
  CONNECTIONS: 'Connections',
  GETTING_STARTED: 'Getting Started',
  SETUP_COMPANY: 'Set up company profile',
  BROWSE_CANDIDATES: 'Browse candidates',
  FIRST_MESSAGE: 'Send your first message',
} as const;
