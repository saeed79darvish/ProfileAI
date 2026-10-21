export const TEXT = {
  BACK: 'Back to my profile',
  TITLE: 'What ProfilleAI knows about you',
  INTRO:
    'What the coach has kept from your conversations, beyond your resume. Only you can see this. The coach reads it so it never asks you the same thing twice. Edit or delete anything here.',
  GOALS: 'Your goals',
  CONSTRAINTS: 'What your search has to fit',
  ASSESSMENT: "The coach's assessment",
  CALLS: 'Voice conversations',
  CALLS_NOTE: 'A short summary of each call. The recording and the full transcript are never kept.',
  NO_CALLS: 'No voice conversations yet.',
  EMPTY: 'Nothing yet',
  EDIT: 'Edit',
  DELETE: 'Delete',
  DELETE_CALL: 'Delete this summary',
  SAVE: 'Save',
  CANCEL: 'Cancel',
  CLEAR: 'Delete everything here',
  CLEAR_TITLE: 'Delete everything ProfilleAI knows about you?',
  CLEAR_BODY:
    'Your goals, constraints, the assessment and every call summary are removed. Your profile and resume are not affected. This cannot be undone.',
  CLEAR_CONFIRM: 'Delete everything',
  LOAD_FAILED: 'We could not load this just now. Try again in a moment.',
  SAVE_FAILED: 'That did not save. Try again.',
} as const;

export const FIELDS = [
  { key: 'target', label: 'Role you are aiming for', multiline: false },
  { key: 'targetWhy', label: 'Why that role', multiline: true },
  { key: 'targetBlocker', label: 'What is in the way', multiline: true },
] as const;

export const CONSTRAINT_FIELDS = [
  { key: 'location', label: 'Location' },
  { key: 'workStyle', label: 'Remote, hybrid or on-site' },
  { key: 'roleTypes', label: 'Kind of work' },
  { key: 'salary', label: 'Pay' },
  { key: 'noticePeriod', label: 'When you can start' },
] as const;
