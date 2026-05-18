// Constants for MessagesPage

export const ROUTES = {
  MESSAGES: '/messages',
  INTERVIEWS: '/interviews',
  messagesConversation: (id: string | number) => `/messages/${id}`,
  recruiterProfile: (id: string | number) => `/recruiter/${id}`,
  candidateProfile: (id: string | number) => `/profile/${id}`,
} as const;

export const TIMINGS = {
  MESSAGE_POLL_INTERVAL: 5000,
  CONVERSATION_POLL_INTERVAL: 10000,
  SCROLL_THRESHOLD: 100,
  FADE_TIMEOUT: 300,
} as const;

export const TIME_THRESHOLDS = {
  MINUTES: 60,
  HOURS: 24,
} as const;
