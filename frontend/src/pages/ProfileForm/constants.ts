// Constants for ProfileForm

export const ROUTES = {
  PROFILE: '/profile',
} as const;

export const SOFTWARE_KEYWORDS = [
  'excel', 'word', 'powerpoint', 'outlook', 'google', 'microsoft', 'salesforce',
  'sap', 'quickbooks', 'zoom', 'slack', 'jira', 'asana', 'photoshop',
  'illustrator', 'figma', 'autocad',
];

export const TECHNICAL_KEYWORDS = [
  'react', 'python', 'java', 'sql', 'aws', 'docker', 'analysis', 'engineering',
  'programming', 'data', 'machine learning', 'cad', 'plc', 'mechanical',
  'electrical', 'testing', 'quality',
];

export const SOFT_SKILL_KEYWORDS = [
  'communication', 'leadership', 'teamwork', 'problem', 'critical',
  'time management', 'adaptability', 'collaboration', 'presentation',
  'negotiation', 'customer service', 'conflict resolution',
];

export const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const ALLOWED_RESUME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export const TIMINGS = {
  DRAFT_DEBOUNCE: 1000,
  ENHANCE_PROMPT_DELAY: 300,
  AUTO_SUGGEST_DELAY: 500,
  SUCCESS_DISMISS: 4000,
  NAVIGATE_AFTER_SAVE: 1500,
  NAVIGATE_AFTER_TAILOR: 2000,
} as const;

export const LIMITS = {
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,
  MIN_ENHANCE_CHARS: 10,
  MIN_JOB_DESC_LENGTH: 50,
} as const;
