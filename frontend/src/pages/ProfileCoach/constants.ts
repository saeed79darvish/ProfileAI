// Constants for ProfileCoach — the conversational profile builder that
// replaced the three-choice-cards page and the 7-step wizard.
//
// Copy and configuration. The question ladder itself is in ./coachLogic.js.
//
// That ladder lives on the client on purpose: chip answers are then resolved
// locally, cost no AI call, and work for a signed-out visitor. The model is
// only involved when someone types something a chip can't express. See
// backend/services/profileCoachService.js for the server half, and why the
// *field schemas* live there instead.


export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  CREATE_FORM: '/profile/create-form',
} as const;

export const LOCALSTORAGE_KEY = 'profileai_coach_conversation' as const;

/* The ladder, the chip sets and every pure transform live in ./coachLogic.js
   — plain JS so `node --test` can exercise them. Re-exported here so the page
   imports its vocabulary from one place. */
export {
  LADDER,
  SENIORITY_LEVELS,
  WORK_STYLES,
  IMPORT_CHOICES,
  LIMITS,
} from './coachLogic.js';
export {
  JOB_SECTORS,
  SECTOR_TITLES,
  SECTOR_SKILLS,
  ALL_SKILLS,
  EMPLOYMENT_TYPES,
  CAREER_STAGES,
} from '../../data/jobTaxonomy.js';

/* ─── Copy ────────────────────────────────────────────────────── */

export const TEXT = {
  LOGO: 'ProfilleAI',
  VOICE_ON: 'Voice on',
  VOICE_OFF: 'Voice off',
  // v1 ships without voice. The button stays visible but disabled so the
  // affordance is discoverable and the layout does not shift when it lands.
  VOICE_COMING_SOON: 'Voice answers are coming soon',
  SKIP: 'Skip for now',
  LOGIN: 'Log in',

  GREETING: 'Hi, I am your ProfilleAI coach.',
  GREETING_SUB:
    'I will build your profile from a short conversation — about two minutes. Answer by tapping or typing.',

  INPUT_PLACEHOLDER: 'Type your answer',
  INPUT_PLACEHOLDER_VOICE: 'Type your answer, or tap the mic to talk',
  SEND: 'Send',
  FOOTER: 'The coach fills your profile as you answer. You can edit everything before publishing.',

  SKIP_CHIP: 'Skip this',
  DONE_CHIP: 'That is everything',

  PANEL_TITLE: 'PROFILE STRENGTH',
  PANEL_ENCOURAGE: 'Keep going — each answer adds to this.',

  THINKING: 'Thinking',
  ACK_DEFAULT: 'Got it.',

  FINISH_TITLE: 'That is everything I need.',
  FINISH_SUB: 'Building your profile now.',
  FINISH_CTA: 'Review my profile',

  UPLOAD_PROMPT: 'Great — pick your resume file and I will read it.',
  UPLOAD_DONE: 'Read it. I filled in what I found — let me just check the gaps.',
  UPLOAD_FAILED: 'I could not read that file. Try another one, or we can keep chatting.',
  UPLOAD_CANCELLED: 'No problem. Pick another option above, or we can keep chatting.',
  LINKEDIN_PROMPT: 'Let us pull it in from LinkedIn.',
  LINKEDIN_DONE: 'Imported. Let me fill the gaps it left.',

  AI_GATE_TITLE: 'Create a free account to keep typing',
  AI_GATE_BODY:
    'Tapping the suggestions is always free. Understanding answers you type takes AI, so that part needs an account — it takes a few seconds and your answers so far are saved.',
  AI_GATE_CONFIRM: 'Create free account',
  AI_GATE_CANCEL: 'Keep tapping instead',

  ERROR_GENERIC: 'Something went wrong on my end. Try that again?',
  ERROR_FILE_TYPE: 'Please upload a PDF or DOCX file',
  ERROR_FILE_SIZE: 'File size must be less than 5MB',
} as const;

// The right-rail checklist. Mirrors the Figma panel; `key` maps onto the
// canonical rubric in hooks/useProfileCompletion.js so this meter and the
// editor's sidebar never disagree.
export const PANEL_ITEMS = [
  { key: 'title', label: 'HEADLINE', hint: 'Your role and level' },
  { key: 'lookingFor', label: 'LOOKING FOR', hint: 'Role type and work style' },
  { key: 'skills', label: 'SKILLS', hint: 'What recruiters search on' },
  { key: 'exp', label: 'EXPERIENCE', hint: 'Your recent role, in bullets' },
  { key: 'edu', label: 'EDUCATION', hint: 'Degree, bootcamp or certs' },
] as const;

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
] as const;

export const VALIDATION = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
} as const;

export const TIMING = {
  // How long the coach "thinks" before a scripted reply. Instant replies to
  // a tapped chip read as a form; this is the smallest delay that reads as
  // someone answering you.
  ACK_MS: 420,
  TYPING_MS: 650,
} as const;
