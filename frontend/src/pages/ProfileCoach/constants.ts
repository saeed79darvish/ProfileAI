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


import { COMPARE_FEATURES } from '../Pricing/constants';

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
  POST_CALL_IMPORT_CHOICES,
  VOICE_OFFER_STEP,
  voiceAgenda,
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
  DICTATE_START: 'Speak your answer',
  DICTATE_STOP: 'Stop listening',
  DICTATE_TRANSCRIBING: 'Writing down what you said...',
  CLEAR_INPUT: 'Clear',
  ATTACH_REMOVE: 'Remove this file',
  ATTACH_RESUME: 'Attach your resume (PDF or Word)',
  DROP_TITLE: 'Drop your resume here',
  DROP_SUB: 'PDF or Word. I will read it and fill in your profile.',
  IMPORT_ASKED: 'Sure. Pick one and I will read it.',
  CLEAR_INPUT_LABEL: 'Clear the text box',
  DICTATE_UNSUPPORTED: 'This browser cannot do speech input. Try Chrome.',
  DICTATE_DENIED: 'I cannot hear the microphone. Allow access in your browser settings, or just type.',
  DICTATE_FAILED: 'The microphone stopped working. Try again, or just type.',
  SKIP: 'Skip for now',

  /* ─── Talking to Remi ─── */
  VOICE_OFFER: 'This next part is easier said than typed: your recent role and what you did there. Want to just talk it through? A few minutes, and I will check the names and dates with you after. Or we can keep typing.',
  VOICE_START: 'Talk it through',
  VOICE_HINT: 'Say anything: what you do, where, how long.',
  VOICE_HINT_IMPORTED: 'Remi has read your resume. Talk about what you want next.',
  VOICE_OFFER_REVIEW: 'That is my read. Let us talk it through: under 5 minutes on your headline, your summary and your recent jobs, and what you want next. Then I will show you everything on screen. Or type it instead, if you prefer.',
  VOICE_KEEP_TYPING: 'Keep typing',
  VOICE_SHARE: 'Share a photo or document',
  VOICE_SHARING: 'Sending it over…',
  VOICE_SHARE_FAILED: 'I could not open that file. A photo, PDF or Word document works.',
  VOICE_MUTE: 'Mute your microphone',
  VOICE_UNMUTE: 'Unmute',
  VOICE_MUTED: 'Muted. Tap the microphone when you want to speak.',
  VOICE_CONNECTING: 'Connecting. Allow the microphone when your browser asks.',
  VOICE_LIVE: 'Listening. Talk normally, and close this when you are done.',
  VOICE_END: 'End call',
  VOICE_DONE: 'Thanks. I have put what you told me into your profile.',
  VOICE_DONE_TALK: 'Thanks for talking it through. I have kept that in mind.',
  VOICE_HANDOVER: 'One last thing, and it is easier here than out loud: if you have a resume or a LinkedIn profile, send it over and I will fill in anything we missed.',
  VOICE_NOTHING: 'We got cut off before I caught anything. We can keep going here instead.',
  VOICE_DROPPED: 'The call dropped on my side. Want to try again, or keep going here?',
  VOICE_RETRY_CHIP: 'Call again',
  VOICE_CHAT_CHIP: 'Keep going in chat',
  VOICE_MIC_DENIED: 'Your browser is blocking the microphone. Allow it in the address bar, or we can keep typing.',
  VOICE_FAILED: 'I could not start the call. We can keep going here instead.',
  VOICE_SIGNED_OUT: "You've had today's free call. A free account keeps the conversation going, and I will keep everything you have told me so far.",
  VOICE_SIGNIN: 'Sign in',
  VOICE_REGISTER: 'Create a free account',
  LOGIN: 'Log in',

  /* The coach has a name.
   *
   * "Hi, I am your ProfilleAI coach" is a product describing itself, and it
   * sets the register for everything after it. A name does more for the
   * feeling that somebody is on the other end than any avatar can.
   *
   * Remi: short, warm, says the same in most languages, and not already worn
   * by an assistant people know. Gender-neutral on purpose — this one talks
   * to a nurse, an electrician and a staff engineer in the same afternoon,
   * and none of them should have to picture anybody in particular.
   *
   * It is a name, not a disguise. The line below says career coach, the
   * answer to "are you a real person?" is no, and the prompt is explicit
   * about never claiming otherwise. */
  COACH_NAME: 'Remi',
  // Remi has already said hello in the intro — this is the handover into the
  // questions, not a second introduction.
  GREETING: "Let's build your profile.",
  GREETING_SUB:
    'A few minutes of questions. Answer by tapping, typing, or the mic.',

  INPUT_PLACEHOLDER: 'Type your answer',
  INPUT_PLACEHOLDER_VOICE: 'Type your answer, or tap the mic to talk',
  // A phone's box fits about twenty characters; the long one wrapped and was cut in half.
  INPUT_PLACEHOLDER_VOICE_SHORT: 'Type or tap the mic',
  INPUT_PLACEHOLDER_CHIPS: 'Tap an option above',
  // After a call: the facts speech gets wrong, read back once.
  CHECK_TITLE: 'Quick check before I save this. Speech gets names and dates wrong, so fix anything that is off.',
  CHECK_DONE: 'Looks right',
  CHECK_EDIT: 'Fix',
  CHECK_SAVE: 'Save',
  CHECK_CANCEL: 'Cancel',
  INPUT_PLACEHOLDER_MULTI: 'Tap the ones that fit, or type them',
  MULTI_DONE: (n: number) => `Continue (${n})`,
  CHIP_REMOVE: 'tap to remove',
  STEPS_SHOW: 'Show your profile steps',
  STEPS_HIDE: 'Hide your profile steps',
  STEPS_CLOSE: 'Close',
  NUDGE_CHIPS: 'I did not quite catch that. Pick one below, or say it in your own words.',
  NUDGE_TEXT: 'I did not quite catch that. A line or two in your own words is plenty, or skip it.',
  SEND: 'Send',
  // Their voice answer in the chat while its words are being written out.
  VOICE_PENDING: '…',
  FOOTER: 'The coach fills your profile as you answer. You can edit everything before publishing.',

  SKIP_CHIP: 'Skip this',

  PANEL_TITLE: 'PROFILE STRENGTH',
  PANEL_ENCOURAGE: 'Keep going. Each answer adds to this.',

  THINKING: 'Thinking',
  // Offered, not done to them. A silent restore after a deliberate refresh
  // is the product arguing with the person about what they just did.
  RESUME_OFFER: 'You have a conversation from earlier. Pick it up, or start fresh?',
  RESUME_CHIP: 'Pick up where we left off',
  FRESH_CHIP: 'Start fresh',
  RESUMED: 'Picked up where you left off.',
  // The per-conversation ceiling on answered asides. Generous for a person,
  // closed to a script.
  ASIDE_LIMIT_HIT:
    'Let us get your profile finished first. Once it is built, you can ask me anything about it.',
  CHANGE_ANSWER: 'Change this',
  // Someone said hello, or asked something, instead of answering. Neither is
  // an answer, and neither should land on their profile.
  GREETING_BACK: 'Hello. Whenever you are ready:',
  ASIDE_FALLBACK:
    'I cannot answer that one, sorry. You can skip anything you would rather not answer, and edit everything at the end.',
  ASIDE_BACK: 'Back to it:',
  // Typed during the intro, which is a slideshow with nothing to answer yet.
  INTRO_HELLO: 'Hello. Have a look, or tap Continue whenever you want to start.',
  INTRO_START: 'Let us get straight into it.',
  INTRO_START_SECTOR: (label: string) => `${label}, got it. Let us do the rest.`,
  ACK_DEFAULT: 'Got it.',

  FINISH_TITLE: 'That is everything I need.',
  FINISH_SUB: 'Building your profile now.',
  FINISH_CTA: 'Review my profile',

  UPLOAD_PROMPT: 'Great. Pick your resume file and I will read it.',
  UPLOAD_DONE: 'Read it. I filled in what I found. Let me just check the gaps.',
  UPLOAD_FAILED: 'I could not read that file. Try another one, or we can keep chatting.',
  UPLOAD_NO_TEXT: 'That PDF looks like a scan with no text I can read. Try another file, or we can keep chatting.',
  UPLOAD_PASSWORD: 'That PDF is password-protected, so I cannot open it. Try another file, or we can keep chatting.',
  UPLOAD_UNREADABLE: 'Could not read this one',
  UPLOAD_CANCELLED: 'No problem. Pick another file, or we can just keep talking.',
  LINKEDIN_PROMPT: 'Let us pull it in from LinkedIn.',
  IMPORT_CANCELLED: 'No problem. Try one of these, or we can just keep talking.',
  LINKEDIN_URL_PDF: 'I saved your link, but LinkedIn did not let me read the profile. The PDF always works: on your LinkedIn profile choose More, then Save to PDF, and add the file here with the + button or drop it in.',
  LINKEDIN_URL_ASK: 'Paste your LinkedIn profile URL here. It looks like linkedin.com/in/your-name.',
  LINKEDIN_URL_FAILED: 'I could not read that profile. You can try again, or save it from LinkedIn as a PDF (More, then Save to PDF) and add it with the + button.',
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
  { key: 'location', label: 'LOCATION', hint: 'Where you are based' },
  { key: 'lookingFor', label: 'LOOKING FOR', hint: 'Role type and work style' },
  { key: 'skills', label: 'SKILLS', hint: 'What recruiters search on' },
  { key: 'exp', label: 'EXPERIENCE', hint: 'Your recent role, in bullets' },
  // Shown to whoever the coach asks — see visiblePanelItems.
  { key: 'proj', label: 'PROJECTS', hint: 'Work you can point at. Optional if you have a job.' },
  { key: 'edu', label: 'EDUCATION', hint: 'Degree, bootcamp or certs' },
] as const;

/* ─── The closing sequence ───────────────────────────────────────
   Copy for the review, the target read, the finished resume, the
   product tour and the sign-up ask. */

export const COACH_TEXT = {
  REVIEW_THINKING: 'Reading it properly, give me a second.',
  REVIEW_WORKING: 'What is working',
  REVIEW_FIX: 'What I would fix',
  FIX_INTRO: 'Here is how I would sharpen your profile for that. Untick anything you would rather keep as it is.',
  FIX_TITLE: 'Suggested changes',
  FIX_HEADLINE: 'Headline',
  FIX_SUMMARY: 'Summary',
  FIX_SKILLS: 'Skills your experience already shows',
  FIX_ROLE: (title: string, company: string) => [title, company].filter(Boolean).join(' at '),
  FIX_APPLY: (n: number) => (n ? `Apply ${n} change${n === 1 ? '' : 's'}` : 'Continue'),
  FIX_KEEP: 'Keep mine',
  FIX_APPLIED: (n: number) => `Applied ${n} change${n === 1 ? '' : 's'}`,
  FIX_DONE: 'Done. Your profile has the new version.',
  FIX_AUTO: 'I have sharpened your headline, summary and bullets with what you told me. Here is how it all comes together.',
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
    'This is what we have so far. It is a real start, but it is thin. The gaps below are what to fill in next.',
  RESUME_CARD_TITLE: 'Your profile',

  TOUR_INTRO: 'That is yours now. Here is what you can do with it.',
  TOUR_CONTINUE: 'Got it, what now?',

  CONVERT_TITLE: 'Save it to your account',
  CONVERT_BODY:
    'Your profile is only in this browser right now, so it is gone if you clear it or switch devices. Creating a free account keeps it, publishes your portfolio, and turns on the tools above.',
  CONVERT_CTA: 'Create my free account',
  CONVERT_SIGNIN: 'I already have an account',
  CONVERT_NOTE: 'Free. No card. Takes about twenty seconds.',
} as const;

// The product tour shown in the chat once the profile is built. Every claim
// here maps to a feature that actually ships, and every number is read from
// COMPARE_FEATURES in pages/Pricing/constants.ts so the two cannot drift. Do
// not add aspirational entries: this is the first thing a new user is told
// the product does, and it sets what they then go looking for.
//
// Two tiers, free first. The profile they just built is the point of the
// moment; the paid part is one quiet panel underneath, not a paywall.
const planCell = (name: string, plan: 'free' | 'pro' | 'proPlus'): string => {
  const row = COMPARE_FEATURES.find((f) => f.name === name);
  const value = row?.[plan];
  return typeof value === 'string' ? value : '';
};

export const TOUR_TEXT = {
  READY: 'Your profile is ready',
  READY_SUB: 'Here is what it does for you from today.',
  FREE_LABEL: 'Free with your account, no card needed',
  // Exact allowances, so nobody wonders what the catch is.
  INCLUDED_LABEL: 'Also free, every account',
  MORE: 'Need more later? Pro raises the limits.',
  COMPARE: 'Compare plans',
  OUTRO: 'Everything here runs off the profile you just built, so the more of it is true and specific, the better it all works.',
} as const;

export const TOUR_FREE = [
  {
    id: 'jobs',
    icon: 'work',
    title: 'Jobs picked for you',
    body: 'Recommendations matched to this profile from a large, fresh list of openings, with a match score on every one.',
  },
  {
    id: 'portfolio',
    icon: 'public',
    title: 'A public portfolio',
    body: 'Your own page to send any recruiter or hiring manager. It keeps working while you are not applying.',
  },
  {
    id: 'extension',
    icon: 'extension',
    title: 'The browser extension',
    body: 'On any job page it shows how well you match and fills in the application from your profile.',
  },
] as const;

// What the free plan includes, word for word from the pricing table.
export const TOUR_ALLOWANCES = [
  { id: 'tailor', label: 'Tailored resumes', value: planCell('Resume Tailoring', 'free') },
  { id: 'letter', label: 'Cover letters', value: planCell('AI Cover Letter', 'free') },
  { id: 'autofill', label: 'Application autofill', value: planCell('Extension autofill', 'free') },
  { id: 'match', label: 'Job match scores', value: planCell('Job match score', 'free') },
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
  /* How much longer than the typing pause a question waits for its
     suggested answers. A model reply usually lands within it; past it the
     field's own list is shown rather than keep someone waiting. */
  SUGGEST_GRACE_MS: 1800,
} as const;

