// Constants for JobApplications

export const ROUTES = {
  BACK_TO_JOBS: '/recruiter/jobs',
  CANDIDATE_PROFILE: (id: string | number) => `/profile/${id}`,
  SCHEDULE_INTERVIEW: (candidateId: string | number, jobId: string | number) =>
    `/recruiter/interviews/schedule?candidateId=${candidateId}&jobId=${jobId}`,
  MESSAGE_CANDIDATE: (id: string | number) => `/messages?userId=${id}`,
} as const;

export const CUSTOM_LABELS: Record<string, string> = {
  coverLetter: 'Cover Letter',
  expectedSalary: 'Expected Salary',
  yearsOfExperience: 'Years of Experience',
  startDate: 'Available Start Date',
  noticePeriod: 'Notice Period',
  workAuthorization: 'Work Authorization',
  willingToRelocate: 'Willing to Relocate',
  linkedinUrl: 'LinkedIn Profile',
  portfolioUrl: 'Portfolio URL',
  githubUrl: 'GitHub Profile',
  phoneNumber: 'Phone Number',
  currentCompany: 'Current Company',
  currentTitle: 'Current Title',
  educationLevel: 'Education Level',
  referralSource: 'How did you hear about us?',
};

export const STATUS_OPTIONS = [
  'submitted',
  'under_review',
  'shortlisted',
  'interview_scheduled',
  'rejected',
  'withdrawn',
] as const;

export const THRESHOLDS = {
  EXCELLENT_MATCH: 80,
  GOOD_MATCH: 60,
  COVER_LETTER_PREVIEW: 300,
  VISIBLE_ANSWERS: 3,
  MODAL_SKILLS_LIMIT: 10,
} as const;

export const TEXT = {
  LOADING: 'Loading applications...',
  LOAD_ERROR: 'Failed to load applications',
  STATUS_ERROR: 'Failed to update status',
  SEARCH_PLACEHOLDER: 'Search by name or email...',
  EMPTY_TITLE: 'No Applications Yet',
  EMPTY_DESC: 'No candidates have applied for this position yet. Share your job listing to attract more applicants.',
  EMPTY_FILTERED: 'No applications match your current filters.',
  MODAL_TITLE: 'Application Details',
  APPLICATION_INFO: 'Application Info',
  APPLICATION_ANSWERS: 'Application Answers',
  COVER_LETTER: 'Cover Letter',
  AI_MATCH_SCORE: 'AI Match Score',
  AI_ANALYSIS: 'AI Analysis',
  RECRUITER_NOTES: 'Recruiter Notes',
  VIEW_PROFILE: 'View Full Profile',
  MESSAGE: 'Message Candidate',
  SCHEDULE: 'Schedule Interview',
  VIEW_RESUME: 'View/Download Resume',
  EXCELLENT: 'Excellent Match',
  GOOD: 'Good Match',
  FAIR: 'Fair Match',
  NO_HEADLINE: 'No headline',
  NOT_PROVIDED: 'Not provided',
  COMPLEX_VALUE: 'Complex value',
} as const;
