// Constants for JobApplication

export const ROUTES = {
  JOBS: '/jobs',
  JOB_DETAIL: (id: string | number) => `/jobs/${id}`,
} as const;

export const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
  apr: '04', april: '04', may: '05', jun: '06', june: '06',
  jul: '07', july: '07', aug: '08', august: '08', sep: '09', september: '09',
  oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
};

export const VALID_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  SNACKBAR_DURATION: 6000,
  EDUCATION_ID_OFFSET: 100,
} as const;

export const TEXT = {
  INVALID_FILE: 'Please upload a PDF or Word document',
  FILE_TOO_LARGE: 'File size must be less than 5MB',
  NOT_FOUND: 'Job not found',
  SUCCESS_TITLE: 'Application Submitted!',
  BROWSE_JOBS: 'Browse More Jobs',
  GO_TO_PROFILE: 'Go to Profile',
  APPLY_TITLE: 'Apply for Position',
  APPLY_SUBTITLE: 'Submit your application and stand out from the crowd',
  COVER_LETTER: 'Cover Letter *',
  RESUME_LABEL: 'Resume / CV',
  ADDITIONAL_QUESTIONS: 'Additional Questions',
  COVER_LETTER_PLACEHOLDER: "Tell us why you're a great fit for this role...",
  RESUME_UPLOAD_HINT: 'Click to upload your resume (PDF or Word, max 5MB)',
  SMART_PARSER: 'Smart Resume Parser',
  PARSING: 'Analyzing your resume with AI...',
  NO_AUTOFILL: "No, I'll fill it manually",
  YES_AUTOFILL: 'Yes, auto-fill form',
  PARSE_FAIL_EXTRACT: 'Could not extract information from resume. Please fill the form manually.',
  PARSE_FAIL: 'Failed to parse resume. You can still fill the form manually.',
  SUBMIT_ERROR: 'Failed to submit application. Please try again.',
  CURRENTLY_WORKING: 'Currently working here',
  LOADING: 'Loading job details...',
  PARSING_RESUME: 'Parsing Resume',
  SUBMITTING: 'Submitting Application',
} as const;
