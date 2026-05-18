// Constants for RecruiterJobs

export const ROUTES = {
  viewJob: (id: string | number) => `/jobs/${id}`,
  jobApplications: (id: string | number) => `/recruiter/jobs/${id}/applications`,
  applicationForm: (id: string | number) => `/recruiter/jobs/${id}/application-form`,
  candidateProfile: (id: string | number) => `/profile/${id}`,
  messageCandidate: (id: string | number) => `/messages?userId=${id}`,
  scheduleInterview: (candidateId: string | number, jobId: string | number) => `/recruiter/schedule-interview?candidateId=${candidateId}&jobId=${jobId}`,
} as const;

export const SECTION_PATTERNS = [
  /^about\s+(the\s+)?(role|position|opportunity)/i,
  /^what\s+you('ll|'ll|\s+will)\s+(do|be\s+doing)/i,
  /^(key\s+)?responsibilities/i,
  /^what\s+we('re|'re|\s+are)\s+looking\s+for/i,
  /^requirements?/i,
  /^qualifications?/i,
  /^nice\s+to\s+have/i,
  /^preferred\s+(qualifications?|skills?)/i,
  /^why\s+(join\s+us|work\s+(here|with\s+us))/i,
  /^benefits?\s*(&|and)?\s*perks?/i,
  /^(what\s+we\s+offer|our\s+offer)/i,
  /^education\s*(&|and)?\s*experience/i,
  /^technical\s+skills?/i,
  /^soft\s+skills?/i,
  /^certifications?/i,
  /^health\s*(&|and)?\s*wellness/i,
  /^work[\s-]life\s+balance/i,
  /^growth\s*(&|and)?\s*development/i,
  /^compensation\s*(&|and)?\s*perks?/i,
  /^culture\s*(&|and)?\s*fun/i,
  /^team\s*(&|and)?\s*culture/i,
];

export const TIMINGS = {
  SCREENING_POLL_INTERVAL: 5000,
  TOAST_DISMISS: 3000,
} as const;

export const LIMITS = {
  SKILLS_DISPLAY: 5,
} as const;
