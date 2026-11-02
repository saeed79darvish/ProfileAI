// Constants for PublicProfile

export const ROUTES = {
  BROWSE: '/browse',
  FEED: '/feed',
  MESSAGES: '/messages',
  PRIVACY: '/privacy',
  TERMS: '/terms',
  messageUser: (id: string | number) => `/messages?userId=${id}`,
  scheduleInterview: (id: string | number) => `/recruiter/schedule-interview?candidateId=${id}`,
  messagesConversation: (id: string | number) => `/messages/${id}`,
  registerRef: (id: string | number) => `/register?ref=${id}`,
} as const;

export const LIMITS = {
  TECHNOLOGIES_PER_PROJECT: 3,
  SKILLS_DESKTOP: 6,
  SKILLS_DESKTOP_EXTRA: 12,
  SKILLS_MOBILE: 10,
  EXPERIENCE_SKILLS: 4,
  PROJECTS: 4,
  RECENT_POSTS: 3,
  POST_CONTENT_TRUNCATION: 60,
} as const;

export const DEFAULTS = {
  SKILL_PROGRESS: 85,
} as const;

export const ANIMATION = {
  STAGGER_DELAY: 100,
  BASE_FADE_TIMEOUT: 500,
} as const;
