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

export const ANSWERS_TEXT = {
  TITLE: 'Answers I can give for you',
  PRIVACY: 'This stays private. We never share it, and we only use it to answer the custom questions on your applications.',
  INTRO: 'The extension and the application helper use these to answer custom questions the way you would. They are never guessed. If something is missing here, you are asked instead.',
  EMPTY_TITLE: 'Nothing saved yet',
  EMPTY_BODY: 'Application forms ask the same things again and again: do you need sponsorship, can you relocate, when can you start, what pay do you want. Tell us once and we can answer them for you. Five quick questions cover most of it.',
  EMPTY_CTA: 'Answer the five key questions',
  ADD: 'Add an answer',
  HIDE: 'Hide',
  NOT_ANSWERED: 'Not answered',
  FACTS: 'Facts',
  STORIES: 'In your own words',
  EDIT: 'Edit',
  DELETE: 'Delete',
  SAVE: 'Save',
  CANCEL: 'Cancel',
  DELETE_ALL: 'Delete all of it',
  DELETE_ALL_TITLE: 'Delete all your saved answers?',
  DELETE_ALL_BODY: 'Every fact and story saved for application questions is removed. Your goals, profile and resume are not affected. This cannot be undone.',
  DELETE_ALL_CONFIRM: 'Delete all of it',
  YES: 'Yes',
  NO: 'No',
} as const;
