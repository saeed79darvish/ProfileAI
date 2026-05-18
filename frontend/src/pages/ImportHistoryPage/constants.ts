export const ROUTES = {
  BACK: '/recruiter/jobs',
  JOB_APPLICATIONS: (jobId: string | number) => `/recruiter/jobs/${jobId}/applications`,
} as const;

export const TEXT = {
  PAGE_TITLE: 'Import History',
  BACK_BUTTON: 'Back to Jobs',
  SEARCH_PLACEHOLDER: 'Search imports...',
  DOWNLOAD_TEMPLATE: 'Download CSV Template',
  TEMPLATE_FILENAME: 'candidate_import_template.csv',
  VIEW_APPLICATIONS: 'View Applications',
  DELETE: 'Delete',
  DELETING: 'Deleting...',
  DIRECT_IMPORT: 'Direct import',
  EMPTY_TITLE: 'No imports found',
  EMPTY_DESCRIPTION: 'Import candidates from the job posting page to see them here.',
  CONFIRM_DELETE: 'Are you sure you want to delete this import? This will not remove candidates that were already added.',
  TOAST: {
    LOAD_ERROR: 'Failed to load import history',
    DELETE_SUCCESS: 'Import deleted successfully',
    DELETE_ERROR: 'Failed to delete import',
    TEMPLATE_SUCCESS: 'Template downloaded!',
    TEMPLATE_ERROR: 'Failed to download template',
  },
  STAT_LABELS: {
    CANDIDATES_IMPORTED: 'Candidates Imported',
    TOTAL_IMPORTS: 'Total Imports',
    COMPLETED: 'Completed',
    PROCESSING: 'Processing',
  },
  IMPORT_STAT_LABELS: {
    TOTAL: 'Total',
    SUCCESSFUL: 'Successful',
    DUPLICATES: 'Duplicates',
    FAILED: 'Failed',
  },
} as const;

export const FILTER_TYPES = {
  ALL: 'all',
  CSV: 'csv',
  LINKEDIN: 'linkedin',
  EMAIL: 'email',
} as const;

export const FILTER_OPTIONS = [
  { key: FILTER_TYPES.ALL, label: 'All' },
  { key: FILTER_TYPES.CSV, label: 'CSV' },
  { key: FILTER_TYPES.LINKEDIN, label: 'LinkedIn' },
  { key: FILTER_TYPES.EMAIL, label: 'Email' },
] as const;

export const TOAST_DURATION_MS = 3000;

export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export const DATE_LOCALE = 'en-US';
