// Constants for JobDetail

export const ROUTES = {
  BROWSE: '/browse',
  JOBS: '/jobs',
  APPLY: (id: string | number) => `/jobs/${id}/apply`,
  AGENT_ARENA: (id: string | number) => `/agent-arena/${id}`,
  APPLICATION_FORM: (id: string | number) => `/recruiter/jobs/${id}/application-form`,
  EDIT_JOB: '/recruiter/jobs',
  PROFILE: (id: string | number) => `/profile/${id}`,
  MESSAGE: (id: string | number) => `/messages?userId=${id}`,
  SCHEDULE_INTERVIEW: (candidateId: string | number, jobId: string | number) =>
    `/recruiter/schedule-interview?candidateId=${candidateId}&jobId=${jobId}`,
  COMPANY: (slug: string) => `/company/${slug}`,
  RECRUITER: (id: string | number) => `/recruiter/${id}`,
} as const;

export const WORK_TYPES: Record<string, string> = {
  onsite: 'On-site',
  remote: 'Remote',
  hybrid: 'Hybrid',
};

export const EMPLOYMENT_TYPES: Record<string, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
};

export const LEVELS: Record<string, string> = {
  entry: 'Entry Level',
  mid: 'Mid Level',
  senior: 'Senior Level',
  lead: 'Lead / Manager',
  executive: 'Executive',
};

export const TIMINGS = {
  SCREENING_POLL_INTERVAL: 5000,
} as const;

export const TEXT = {
  NOT_FOUND_TITLE: 'Job Not Found',
  NOT_FOUND_DESC: 'This job listing does not exist or has been removed.',
  LOAD_ERROR: 'Unable to load job details. Please try again later.',
  LINK_COPIED: 'Link copied to clipboard!',
  BROWSE_OTHER: 'Browse Other Jobs',
  CHOOSE_METHOD: 'Choose Application Method',
  TRADITIONAL: 'Traditional Application',
  AI_AGENT: 'AI Agent Application',
  APPLY_NOW: 'Apply Now',
  START_AI: 'Start AI Automation',
  APP_FORM: 'Application Form',
  EDIT_JOB: 'Edit Job',
  REQUIRED_SKILLS: 'Required Skills',
  ABOUT_ROLE: 'About This Role',
  REQUIREMENTS: 'Requirements',
  BENEFITS: 'Benefits & Perks',
  LOADING: 'Loading job details...',
  REFRESH: 'Refresh Page',
  ERROR_TITLE: 'Something went wrong',
  ERROR_DESC: 'There was an error loading this job. Please try refreshing the page.',
  NO_SHORTLISTED: 'No candidates were shortlisted. Try adjusting job requirements or skills.',
  SCREENING_ERROR: 'Failed to start AI screening',
  QUICK_SUBMISSION: 'Quick submission',
  FULL_CONTROL: 'Full control',
  DIRECT_CONTACT: 'Direct contact',
  AUTO_NEGOTIATION: 'Automated negotiation',
  AVAILABILITY_24_7: '24/7 availability',
  BEST_TERMS: 'Best terms',
  REAL_TIME: 'Real-time updates',
} as const;
