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
  EXTENSION: '/extension',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  // A shared, public portfolio is /profile/<user id>.
  PUBLIC_PROFILE: (id: string) => `/profile/${id}`,
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
  DICTATE_UNSUPPORTED: 'This browser cannot do speech input — try Chrome',
  DICTATE_DENIED: 'I cannot hear the microphone. Allow access in your browser settings, or just type.',
  DICTATE_FAILED: 'The microphone stopped working. Try again, or just type.',
  SKIP: 'Skip for now',

  /* ─── Talking to Remi ─── */
  VOICE_OFFER: 'I have the facts down. The rest is the part people never write well in a box — what you actually want next, and what is in the way. A few minutes out loud and I will have it. Or we can keep typing, which is completely fine.',
  VOICE_START: 'Talk it through',
  VOICE_KEEP_TYPING: 'Keep typing',
  VOICE_MUTE: 'Mute your microphone',
  VOICE_UNMUTE: 'Unmute',
  VOICE_MUTED: 'Muted. Tap the microphone when you want to speak.',
  VOICE_CONNECTING: 'Connecting — allow the microphone when your browser asks.',
  VOICE_LIVE: 'Listening. Talk normally — close this when you are done.',
  VOICE_END: 'End call',
  VOICE_DONE: 'Thanks — I have put what you told me into your profile.',
  VOICE_HANDOVER: 'One last thing, and it is easier here than out loud: if you have a resume or a LinkedIn profile, send it over and I will fill in anything we missed.',
  VOICE_NOTHING: 'We got cut off before I caught anything. We can keep going here instead.',
  VOICE_MIC_DENIED: 'Your browser is blocking the microphone. Allow it in the address bar, or we can keep typing.',
  VOICE_FAILED: 'I could not start the call. We can keep going here instead.',
  VOICE_SIGNED_OUT: 'Talking it through with me is free with an account, up to 10 minutes to start. It takes about twenty seconds to make one, and I will keep everything you have told me so far.',
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
    'A few minutes. Tap, type, or use the mic. You can edit everything at the end.',

  INPUT_PLACEHOLDER: 'Type your answer',
  INPUT_PLACEHOLDER_VOICE: 'Type your answer, or tap the mic to talk',
  SEND: 'Send',
  FOOTER: 'The coach fills your profile as you answer. You can edit everything before publishing.',

  SKIP_CHIP: 'Skip this',
  // The confirm on a multi-select. "That is everything" answered a question
  // nobody asked — the question was what work you want, not whether you were
  // finished listing it.
  DONE_CHIP: 'Continue',

  PANEL_TITLE: 'PROFILE STRENGTH',

  THINKING: 'Thinking',
  // Offered, not done to them. A silent restore after a deliberate refresh
  // is the product arguing with the person about what they just did.
  RESUME_OFFER: 'You have a conversation from earlier. Pick it up, or start fresh?',
  RESUME_CHIP: 'Pick up where we left off',
  FRESH_CHIP: 'Start fresh',
  RESUMED: 'Picked up where you left off.',
  START_OVER: 'Start over',
  // The live preview's empty states: what each part will hold, in the same
  // place it will appear.
  PREVIEW_HEADLINE: 'Your headline',
  PREVIEW_META: 'Location and the work you want',
  PREVIEW_EXPERIENCE: 'Your recent role, with the bullets I write as you talk',
  PREVIEW_SKILLS: 'What recruiters search on',
  PREVIEW_EDUCATION: 'Degree, bootcamp or certificates',
  QUESTIONS_LEFT: (n: number) => (n <= 0
    ? 'Almost done'
    : `About ${n} question${n === 1 ? '' : 's'} left, roughly ${Math.max(1, Math.round(n * 0.4))} min`),

  // One title question; field and level are read off it and shown back.
  TITLE_ACK: (title: string, field: string, level: string) =>
    [title, [level, field].filter(Boolean).join(', ')].filter(Boolean).join('. ') + '.',
  EDIT_FIELD: (field: string) => (field ? `Field: ${field}` : 'Set field'),
  EDIT_LEVEL: (level: string) => (level ? `Level: ${level}` : 'Set level'),
  EDIT_PICK_FIELD: 'Which field fits best?',
  EDIT_PICK_LEVEL: 'Which level fits best?',
  EDIT_DONE: 'Updated.',

  // Facts read back before they land on a resume.
  CONFIRM_ROLE: (line: string) => `${line}. Right?`,
  CONFIRM_BULLETS: 'Here is how that reads on your resume. Keep it?',
  CONFIRM_YES: 'Looks right',
  CONFIRM_FIX: 'Fix it',
  FIX_ROLE: 'What should it say? Something like "Acme, 2020 to now".',
  FIX_BULLETS: 'Tell me what to change, or say it again the way you want it.',

  // Dictation, made visible: the words land in the box as you speak, and
  // nothing is sent until you send it.
  LISTENING: 'Listening. Your words appear in the box. Tap the mic to stop, then edit and send.',

  // Pasting, the fallback for any file we could not read.
  PASTE_PROMPT: 'Paste your resume below. All of it, formatting and all, is fine.',
  PASTE_PLACEHOLDER: 'Paste your resume text here',
  PASTE_CTA: 'Read it',
  PASTE_TOO_SHORT: 'That is a bit short to be a resume. Paste the whole thing?',
  UPLOAD_NO_TEXT: 'That PDF looks like a scan, so there is no text in it for me to read. Paste the text instead, or try another file.',
  UPLOAD_PASSWORD: 'That PDF is password-protected, so I cannot open it. Paste the text instead, or try another file.',
  // The per-conversation ceiling on answered asides. Generous for a person,
  // closed to a script.
  ASIDE_LIMIT_HIT:
    'Let us get your profile finished first — once it is built you can ask me anything about it.',
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
  INTRO_START_SECTOR: (label: string) => `${label} — got it. Let us do the rest.`,
  ACK_DEFAULT: 'Got it.',

  FINISH_TITLE: 'That is everything I need.',
  FINISH_SUB: 'Building your profile now.',
  FINISH_CTA: 'Review my profile',

  UPLOAD_PROMPT: 'Great — pick your resume file and I will read it.',
  UPLOAD_DONE: 'Read it. Here is what I found. If anything is wrong, tell me and I will fix it.',
  UPLOAD_FAILED: 'I could not read that file. Paste the text instead, or try another one.',
  UPLOAD_UNREADABLE: 'Could not read this one',
  UPLOAD_CANCELLED: 'No problem — pick another file, or we can just keep talking.',
  LINKEDIN_PROMPT: 'Let us pull it in from LinkedIn.',
  IMPORT_CANCELLED: 'No problem — try one of these, or we can just keep talking.',
  LINKEDIN_DONE: 'Imported. Here is what came across. If anything is wrong, tell me and I will fix it.',
  PASTE_DONE: 'Read it. Here is what I found. If anything is wrong, tell me and I will fix it.',

  // The whole conversation is free and needs no account — the ask comes at
  // the end, once there is a finished profile to save. This prompt is only
  // for LinkedIn URL import, which is a paid external lookup per call and so
  // genuinely cannot be handed to anonymous visitors.
  LINKEDIN_GATE_TITLE: 'That one needs an account',
  LINKEDIN_GATE_BODY:
    'Pulling your profile straight from LinkedIn uses a paid lookup, so it needs a real account. The "Save to PDF" option in the same window is free and imports just as much.',
  LINKEDIN_GATE_CONFIRM: 'Create free account',
  LINKEDIN_GATE_CANCEL: 'Use the PDF option',

  ERROR_NO_LINK: "That does not look like a link — paste the whole address, or skip this one.",
  ERROR_GENERIC: 'Something went wrong on my end. Try that again?',
  ERROR_FILE_TYPE: 'Please upload a PDF or DOCX file',
  ERROR_FILE_SIZE: 'File size must be less than 5MB',
} as const;

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

  CONVERT_TITLE: 'Save your profile',
  CONVERT_BODY:
    'Your profile is only in this browser right now, so it is gone if you clear it or switch devices. A free account keeps it, publishes your portfolio, and lets you download your resumes.',
  CONVERT_BODY_TAILORED:
    'Save it to download your tailored resume. A free account also keeps your profile and publishes your portfolio.',
  CONVERT_GOOGLE: 'Continue with Google',
  CONVERT_EMAIL: 'Use email instead',
  CONVERT_SIGNIN: 'I already have an account',
  CONVERT_TERMS_PRE: 'By continuing you agree to the ',
  CONVERT_TERMS: 'Terms',
  CONVERT_TERMS_AND: ' and ',
  CONVERT_PRIVACY: 'Privacy Policy',
  CONVERT_NOTE: 'Free. No card.',
  CONVERT_FAILED: 'That did not go through. Try again, or use email instead.',
  CONVERT_HAS_PROFILE: 'You already have a profile on this account, so I have not overwritten it. Opening the editor so you can merge what we just built.',

  SAVE_DONE: 'Saved. Your profile is live.',
  SAVE_FAILED: 'I could not save that just now. Opening the editor, where you can save it yourself.',

  // The free tailored resume, inside onboarding.
  TAILOR_PLACEHOLDER: 'Paste a job link or the full job description',
  TAILOR_CTA: 'Tailor my resume',
  TAILOR_SKIP: 'Not now',
  TAILOR_WORKING: 'Reading the posting and tailoring your resume to it.',
  TAILOR_TOO_SHORT: 'Paste the link, or the whole description: that is too short to tailor against.',
  TAILOR_URL_FAILED: 'I could not read that page. Paste the job description instead.',
  TAILOR_FAILED: 'That did not work on my side. Try again, or skip it for now.',
  TAILOR_LIMIT: 'You have used the free tailoring for today. Save your profile and you can tailor more.',
  TAILOR_DONE: (score: number | null, role: string) =>
    score === null
      ? `Done. Here is your resume, tailored${role ? ` for ${role}` : ''}.`
      : `Done. You match ${score}%${role ? ` of what ${role} asks for` : ' of what it asks for'}. Here is your tailored resume.`,
  MATCH_TITLE: 'Match',
  MATCH_STRENGTHS: 'Where you are strong',
  MATCH_GAPS: 'What it asks for that you have not shown',
  TAILORED_TITLE: 'Tailored resume',

  NEXT_TITLE: 'Where to go from here',
  NEXT_PORTFOLIO: 'View my portfolio',
  NEXT_COPY_LINK: 'Copy my portfolio link',
  NEXT_COPIED: 'Link copied',
  NEXT_EXTENSION: 'Get the browser extension',
  NEXT_EXTENSION_WHY: 'It fills in applications and scores every job you open against this profile.',
  NEXT_EDIT: 'Edit my profile',
} as const;

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

