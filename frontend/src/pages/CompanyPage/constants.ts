// Constants for CompanyPage

export const ROUTES = {
  MESSAGES: '/messages',
  JOB_DETAIL: (id: string | number) => `/jobs/${id}`,
  COMPANY: (slug: string) => `/company/${slug}`,
} as const;

export const JOB_COLORS = [
  { bg: '#EEF2FF', color: '#4F46E5' },
  { bg: '#FEF3C7', color: '#D97706' },
  { bg: '#D1FAE5', color: '#059669' },
  { bg: '#FEE2E2', color: '#DC2626' },
  { bg: '#E0E7FF', color: '#4338CA' },
] as const;

export const LIMITS = {
  RECENT_JOBS: 5,
  LOGO_SIZE: 104,
  BANNER_HEIGHT_MD: 191,
  BANNER_HEIGHT_XS: 150,
  RECRUITER_AVATAR: 64,
  SIMILAR_AVATAR: 28,
  POST_IMAGE_MAX_HEIGHT: 400,
  DECORATIVE_ICON_SIZE: 120,
  MS_PER_DAY: 1000 * 60 * 60 * 24,
} as const;

export const FALLBACKS = {
  FOUNDED_DATE: 'December 2025',
  TECH_STACK: ['React', 'Node.js', 'Python', 'AWS'],
  DESCRIPTION: 'No description available.',
} as const;

export const SIMILAR_COMPANIES = [
  { name: 'TechFlow Inc.', industry: 'Technology' },
  { name: 'Global Hire', industry: 'Recruitment' },
  { name: 'NextStep AI', industry: 'AI/ML' },
] as const;

export const TABS = ['Overview', 'Jobs', 'Posts', 'Team'] as const;

export const TEXT = {
  LINK_COPIED: 'Link copied to clipboard!',
  NOT_FOUND: 'Company not found',
  NO_JOBS: 'No job openings at the moment',
  NO_POSTS: 'No posts yet',
  FOLLOW: 'Follow',
  MESSAGE: 'Message',
  VISIT_WEBSITE: 'Visit website',
  SIMILAR_TITLE: 'SIMILAR COMPANIES',
  TECH_STACK: 'TECH STACK',
  INDUSTRY: 'INDUSTRY',
  HEADQUARTERS: 'HEADQUARTERS',
  FOUNDED: 'FOUNDED',
  WEBSITE: 'WEBSITE',
  RECENT_JOBS: 'Recent Job Openings',
  VIEW_ALL_JOBS: 'View all jobs',
  APPLY: 'Apply',
  MEET_RECRUITERS: 'Meet the Recruiters',
  TEAM_MEMBERS: 'Team Members',
  ABOUT_TEAM: 'About Our Recruiting Team',
  COMPANY_DETAILS: 'Company Details',
} as const;
