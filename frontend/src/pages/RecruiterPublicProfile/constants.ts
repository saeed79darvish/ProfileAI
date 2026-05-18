export const ROUTES = {
  JOBS: '/jobs',
  MESSAGES_CONVERSATION: (id: string | number) => `/messages/${id}`,
  COMPANY: (slug: string) => `/company/${slug}`,
  NETWORK: (id: string | number) => `/network/${id}`,
} as const;

export const TEXT = {
  LOADING: 'Loading Profile...',
  ERROR_LOADING: 'Failed to load profile',
  NOT_FOUND: 'Profile not found',
  NOT_FOUND_MESSAGE: "The profile you're looking for doesn't exist or has been removed.",
  BACK_TO_JOBS: 'Back to Jobs',
  ROLE_CHIP: 'Recruiter',
  DEFAULT_NAME: 'Recruiter',
  ABOUT_PREFIX: 'About',
  ABOUT_COMPANY: (name: string) => `About ${name}`,
  EMPLOYEES_SUFFIX: 'employees',
  FOLLOWERS: 'Followers',
  FOLLOWING: 'Following',
  CONTACT_INFO: 'Contact Information',
  MESSAGE: 'Message',
  WEBSITE: 'Website',
  COMPANY_PAGE: 'Company Page',
  LINKEDIN: 'LinkedIn Profile',
} as const;

export const LOADING_SPINNER_SIZE = 60;
