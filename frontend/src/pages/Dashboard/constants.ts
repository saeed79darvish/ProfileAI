// Constants for Dashboard (no colors, those belong in styled.ts)

export const ROUTES = {
  RECRUITER_DASHBOARD: '/recruiter/dashboard',
  ADMIN: '/admin',
  PROFILE_CREATE: '/profile/create-form',
  ONBOARDING: '/onboarding',
  PROFILE_EDIT: '/profile/edit',
  LOGIN: '/login',
  FEED: '/feed',
} as const;

export const ALLOWED_RESUME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export const TIMINGS = {
  EXTENSION_DETECT_1: 1000,
  EXTENSION_DETECT_2: 3000,
  EXTENSION_DETECT_3: 6000,
} as const;

export const LIMITS = {
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,
  MIN_JOB_DESC_LENGTH: 50,
  EXPERIENCE_TRUNCATION: 200,
  TAILORED_PROFILES: 3,
  EXPERIENCE_ITEMS: 3,
  SKILL_GAPS: 6,
  POST_CONTENT_TRUNCATION: 120,
} as const;

export interface ExtensionStepData {
  title: string;
  description: string;
  detail: string;
}

export const EXTENSION_STEPS_DATA: ExtensionStepData[] = [
  {
    title: 'Install the Chrome Extension',
    description: 'Get ProfileAI for Chrome to autofill job applications across 15+ platforms with one click.',
    detail: 'Open Chrome Web Store or load in Developer Mode from chrome://extensions.',
  },
  {
    title: 'Sign In & Sync Your Profile',
    description: 'Your skills, experience, and resume data sync instantly to the extension.',
    detail: 'Click the extension icon and log in with your ProfileAI credentials.',
  },
  {
    title: 'One-Click Autofill Applications',
    description: 'LinkedIn, Greenhouse, Lever, Workday and 10+ more, fill any form instantly.',
    detail: 'Click the floating button on any job page, hit Autofill, review & submit.',
  },
  {
    title: 'AI Tailoring & Keyword Match',
    description: 'Get real-time keyword match scores and tailor your resume per job automatically.',
    detail: 'The side panel shows missing skills, match percentage, and lets you download tailored resumes.',
  },
];
