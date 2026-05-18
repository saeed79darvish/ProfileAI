export const ROUTES = {
  RECRUITER_JOBS: '/recruiter/jobs',
} as const;

export const TEXT = {
  PAGE_TITLE: 'Configure Application Form',
  BACK_LABEL: 'Back to Jobs',
  CANCEL: 'Cancel',
  SAVE: 'Save & Continue',
  SAVING: 'Saving...',
  LOADING_TITLE: 'Loading...',
  LOADING_MESSAGE: 'Loading application form builder...',
  TEMPLATE_PANEL_TITLE: 'Choose a Template',
  TEMPLATE_PANEL_DESC: 'Select a pre-built template or start from scratch',
  QUESTIONS_PANEL_TITLE: 'Application Questions',
  EMPTY_TITLE: 'No questions yet',
  EMPTY_DESC: 'Select a template to get started',
  REQUIRED_BADGE: 'Required',
  SAVE_ERROR: 'Failed to save application form',
  QUESTIONS_SUFFIX: 'questions',
  CONFIGURED_SUFFIX: 'configured',
  QUESTION_SINGULAR: 'question',
  QUESTION_PLURAL: 'questions',
  ERROR_FETCH: 'Error fetching data:',
  ERROR_SAVE: 'Error saving application form:',
} as const;

export const formatQuestionCount = (count: number): string =>
  `${count} ${count !== 1 ? TEXT.QUESTION_PLURAL : TEXT.QUESTION_SINGULAR} ${TEXT.CONFIGURED_SUFFIX}`;

export const formatTemplateQuestionCount = (count: number): string =>
  `${count} ${TEXT.QUESTIONS_SUFFIX}`;
