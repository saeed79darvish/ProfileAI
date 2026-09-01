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
  // Where a finished profile lands. This is the candidate's own portfolio
  // view, which is the thing the whole conversation was building toward.
  PORTFOLIO: '/profile',
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
  UPLOAD_UNREADABLE: 'Could not read this one',
  UPLOAD_CANCELLED: 'No problem. Pick another option above, or we can keep chatting.',
  LINKEDIN_PROMPT: 'Let us pull it in from LinkedIn.',
  LINKEDIN_DONE: 'Imported. Let me fill the gaps it left.',

  // The whole conversation is free and needs no account — the ask comes at
  // the end, once there is a finished profile to save. This prompt is only
  // for LinkedIn URL import, which is a paid external lookup per call and so
  // genuinely cannot be handed to anonymous visitors.
  LINKEDIN_GATE_TITLE: 'That one needs an account',
  LINKEDIN_GATE_BODY:
    'Pulling your profile straight from LinkedIn uses a paid lookup, so it needs a real account. The "Save to PDF" option in the same window is free and imports just as much.',
  LINKEDIN_GATE_CONFIRM: 'Create free account',
  LINKEDIN_GATE_CANCEL: 'Use the PDF option',

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

/* ─── The closing sequence ───────────────────────────────────────
   Copy for the review, the target read, the finished resume, the
   product tour and the sign-up ask. */

export const COACH_TEXT = {
  REVIEW_THINKING: 'Reading it properly, give me a second.',
  REVIEW_WORKING: 'What is working',
  REVIEW_FIX: 'What I would fix',
  REVIEW_PROBE_INTRO: 'Two quick questions and I can fix most of that.',

  ASSESS_THINKING: 'Checking what is actually out there for that.',
  ASSESS_TITLE: 'Your target',
  ASSESS_WHY: 'Why',
  ASSESS_CLOSES: 'What closes the gap',
  ASSESS_OPENINGS: (n: number) => `${n} live ${n === 1 ? 'opening' : 'openings'} in our job data right now`,
  // Labelled by what was actually counted. Saying "near you or remote" to
  // someone who asked for on-site describes a number we did not measure.
  ASSESS_NEARBY: (n: number, kind?: string | null) => {
    if (n === 0) {
      if (kind === 'remote') return 'none of them remote';
      if (kind === 'local') return 'none in your area';
      return 'none near you';
    }
    if (kind === 'remote') return `${n} of them remote`;
    if (kind === 'local') return `${n} of them in your area`;
    return `${n} of them near you or remote`;
  },
  EFFORT: { quick: 'Quick win', weeks: 'A few weeks', months: 'Longer play' },

  BUILD_THINKING: 'Putting it together.',
  BUILD_DONE: 'Done. This is your profile.',
  BUILD_INCOMPLETE:
    'This is what we have so far. It is a real start, but it is thin — the gaps below are what to fill in next.',
  RESUME_CARD_TITLE: 'Your profile',

  TOUR_INTRO: 'That is yours now. Here is what you can do with it.',
  TOUR_CONTINUE: 'Got it, what now?',
  TOUR_OUTRO:
    'All of it runs off the profile you just built. The more of it is true and specific, the better everything above works.',

  CONVERT_TITLE: 'Save it to your account',
  CONVERT_BODY:
    'Your profile lives in this browser right now, so it disappears if you close the tab. Creating a free account saves it, publishes your portfolio, and turns on the tools above.',
  CONVERT_CTA: 'Create my free account',
  CONVERT_SIGNIN: 'I already have an account',
  CONVERT_NOTE: 'Free. No card. Takes about twenty seconds.',
} as const;

// The product tour shown in the chat once the profile is built. Every claim
// here maps to a feature that actually ships — see COMPARE_FEATURES in
// pages/Pricing/constants.ts. Do not add aspirational entries: this is the
// first thing a new user is told the product does, and it sets what they
// then go looking for.
export const TOUR_CARDS = [
  {
    id: 'tailor',
    icon: 'tune',
    title: 'Tailor it to any job',
    body: 'Paste a posting and your resume gets rewritten for that specific role, using only what is already true about you. Most people send the same resume everywhere; this is the part that changes replies.',
  },
  {
    id: 'extension',
    icon: 'extension',
    title: 'The browser extension',
    body: 'On a job page it reads the posting, shows how well your profile matches it, and fills the application from what you just built. You stop retyping the same details into every form.',
  },
  {
    id: 'letter',
    icon: 'mail',
    title: 'Cover letters that are not generic',
    body: 'Drafted from your profile and the posting together, so it references your actual work rather than restating the job description back at them.',
  },
  {
    id: 'portfolio',
    icon: 'public',
    title: 'A portfolio recruiters can find',
    body: 'Your profile becomes a public page you can send anyone, and recruiters searching for your skills can find it. It works while you are not applying.',
  },
] as const;

// Narration while the resume is parsed. Parsing takes several seconds and a
// typing indicator alone reads as the page having stalled — people re-click
// the upload button. Each line names something the parser is genuinely doing,
// in order, so the wait is legible rather than decorative.
export const UPLOAD_STEPS = [
  'Reading the file',
  'Pulling out your roles',
  'Finding your skills',
  'Checking the dates',
  'Almost there',
] as const;

export const UPLOAD_STEP_MS = 1400;

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
