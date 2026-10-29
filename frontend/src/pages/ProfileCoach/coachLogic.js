/**
 * coachLogic — the pure decision layer behind ProfileCoach.
 *
 * Holds the question ladder and every transform that decides what the coach
 * asks next, what a chip means, whether an answer needs the model at all,
 * and what the finished draft hands to the editor. index.jsx keeps only
 * React state and API calls.
 *
 * Plain JS, like JobPreferencesWizard/handoff.js, so `node --test` can run
 * it directly — this file holds the parts that are worth testing.
 */

import {
  JOB_SECTORS,
  PRIMARY_SECTORS,
  SECTOR_EVIDENCE,
  DEFAULT_EVIDENCE,
  SECTOR_TITLES,
  SECTOR_SKILLS,
  ALL_SKILLS,
  EMPLOYMENT_TYPES,
  CAREER_STAGES,
} from '../../data/jobTaxonomy.js';
import {
  mapWizardExperienceToEditor,
  mapWizardProjectToEditor,
} from '../JobPreferencesWizard/handoff.js';
import { normalizeEducationRows, textOf } from '../../utils/education.js';
import { COMPLETION_TIERS } from '../../hooks/useProfileCompletion.js';
// The same formatter ProfileForm, the dashboard and the public profile use, so
// a date reads identically wherever the person sees it.
import { formatDateRange } from '../../utils/dateRange.js';

const norm = (s) => String(s || '').toLowerCase().trim();

export const LIMITS = {
  SKILL_CHIPS: 24,
  // Deliberately short. These are a shortcut for the common case, not a
  // catalogue — nine rows of near-identical titles is worse than typing.
  TITLE_CHIPS: 6,
  MAX_ANSWER_CHARS: 2000,
};

/* ─── Chip sets the ladder refers to by name ──────────────────── */

/* ─── Levels ──────────────────────────────────────────────────

   What "one rung up" is called depends entirely on the trade. An
   electrician is an apprentice then a journeyman then a foreman; a nurse is
   an aide then licensed then charge; a line cook is crew then shift lead.
   Offering all of them "Individual Contributor / Director / Head of
   Department" asked them to translate their own career into a software
   company's org chart, and the honest answer was none of the above.

   Ids stay canonical across every sector — only the labels change — so a
   stored draft keeps meaning the same thing, and buildTitle() below can
   reason about rank without knowing the sector. `prefix`/`suffix` are how a
   rung joins the job title: "Senior Nurse", "Master Electrician",
   "Product Manager (Manager)" — and a rung with neither is one that does not
   belong in a headline. */

const L = (id, label, extra = {}) => ({ id, label, ...extra });

const DEFAULT_LEVELS = [
  L('entry', 'Junior / Entry level', { prefix: 'Junior' }),
  L('ic', 'Mid-level'),
  L('senior', 'Senior', { prefix: 'Senior' }),
  L('lead', 'Team Lead', { prefix: 'Lead' }),
  L('manager', 'Manager', { suffix: 'Manager' }),
  L('director', 'Director', { suffix: 'Director' }),
  L('head', 'Head of Department'),
  L('consultant', 'Freelance / Consultant'),
];

/* Tech and its neighbours are the sectors where the senior individual
   contributor track is a real, named ladder rather than a consolation for
   not managing — Staff and Principal sit above Senior and beside Manager,
   not below it. Offering them matters: a Staff Engineer who has to answer
   "Senior" or "Manager" is misfiled either way. */
const IC_TRACK_LEVELS = [
  L('entry', 'Junior / Entry level', { prefix: 'Junior' }),
  L('ic', 'Mid-level'),
  L('senior', 'Senior', { prefix: 'Senior' }),
  L('staff', 'Staff', { prefix: 'Staff' }),
  L('principal', 'Principal', { prefix: 'Principal' }),
  L('lead', 'Team Lead', { prefix: 'Lead' }),
  L('manager', 'Manager', { suffix: 'Manager' }),
  L('director', 'Director', { suffix: 'Director' }),
  L('head', 'Head of Department'),
  L('consultant', 'Freelance / Consultant'),
];

const LEVELS_BY_SECTOR = {
  tech: IC_TRACK_LEVELS,
  data: IC_TRACK_LEVELS,
  design: IC_TRACK_LEVELS,
  product: IC_TRACK_LEVELS,
  trades: [
    L('entry', 'Apprentice', { prefix: 'Apprentice' }),
    L('ic', 'Qualified tradesperson'),
    L('senior', 'Master / Licensed', { prefix: 'Master' }),
    L('lead', 'Foreman / Crew lead', { prefix: 'Lead' }),
    L('manager', 'Site / Project manager', { suffix: 'Site Manager' }),
    L('owner', 'Self-employed / Contractor'),
  ],
  healthcare: [
    L('entry', 'Assistant / Aide'),
    L('ic', 'Licensed clinician'),
    L('senior', 'Senior / Specialist', { prefix: 'Senior' }),
    L('lead', 'Charge / Lead clinician', { prefix: 'Lead' }),
    L('manager', 'Department manager', { suffix: 'Manager' }),
    L('director', 'Clinical director', { suffix: 'Director' }),
    L('consultant', 'Locum / Agency'),
  ],
  hospitality: [
    L('entry', 'Crew / Associate'),
    L('senior', 'Experienced / Senior', { prefix: 'Senior' }),
    L('lead', 'Shift lead', { prefix: 'Lead' }),
    L('manager', 'Assistant manager', { suffix: 'Assistant Manager' }),
    L('director', 'General manager', { suffix: 'General Manager' }),
    L('owner', 'Owner / Franchisee'),
  ],
  education: [
    L('entry', 'Assistant / Aide'),
    L('ic', 'Teacher / Instructor'),
    L('senior', 'Senior / Lead teacher', { prefix: 'Senior' }),
    L('lead', 'Department head'),
    L('manager', 'Principal / Administrator'),
    L('consultant', 'Tutor / Freelance'),
  ],
  logistics: [
    L('entry', 'Operator / Associate'),
    L('senior', 'Senior / Certified', { prefix: 'Senior' }),
    L('lead', 'Team lead', { prefix: 'Lead' }),
    L('manager', 'Supervisor', { suffix: 'Supervisor' }),
    L('director', 'Site / Depot manager', { suffix: 'Site Manager' }),
    L('owner', 'Owner-operator'),
  ],
  manufacturing: [
    L('entry', 'Operator / Associate'),
    L('senior', 'Senior / Certified', { prefix: 'Senior' }),
    L('lead', 'Team lead', { prefix: 'Lead' }),
    L('manager', 'Shift supervisor', { suffix: 'Supervisor' }),
    L('director', 'Plant manager', { suffix: 'Plant Manager' }),
  ],
  engineering: [
    L('entry', 'Junior engineer', { prefix: 'Junior' }),
    L('ic', 'Engineer'),
    L('senior', 'Senior engineer', { prefix: 'Senior' }),
    L('staff', 'Staff engineer', { prefix: 'Staff' }),
    L('principal', 'Principal engineer', { prefix: 'Principal' }),
    L('lead', 'Lead engineer', { prefix: 'Lead' }),
    L('manager', 'Engineering manager', { suffix: 'Manager' }),
    L('consultant', 'Consultant'),
  ],
  science: [
    L('entry', 'Technician / Assistant'),
    L('ic', 'Scientist / Researcher'),
    L('senior', 'Senior scientist', { prefix: 'Senior' }),
    L('lead', 'Principal investigator', { prefix: 'Principal' }),
    L('manager', 'Lab / R&D manager', { suffix: 'Manager' }),
  ],
  socialcare: [
    L('entry', 'Support worker'),
    L('ic', 'Practitioner / Case manager'),
    L('senior', 'Senior practitioner', { prefix: 'Senior' }),
    L('lead', 'Team lead', { prefix: 'Lead' }),
    L('manager', 'Service manager', { suffix: 'Manager' }),
    L('director', 'Program director', { suffix: 'Director' }),
  ],
  publicservice: [
    L('entry', 'Officer / Coordinator'),
    L('senior', 'Senior officer', { prefix: 'Senior' }),
    L('lead', 'Team lead', { prefix: 'Lead' }),
    L('manager', 'Manager', { suffix: 'Manager' }),
    L('director', 'Director', { suffix: 'Director' }),
  ],
  admin: [
    L('entry', 'Assistant'),
    L('ic', 'Coordinator'),
    L('senior', 'Senior / Executive assistant', { prefix: 'Senior' }),
    L('lead', 'Team lead', { prefix: 'Lead' }),
    L('manager', 'Office manager', { suffix: 'Office Manager' }),
  ],
  sales: [
    L('entry', 'Junior rep', { prefix: 'Junior' }),
    L('ic', 'Rep / Account executive'),
    L('senior', 'Senior rep / AE', { prefix: 'Senior' }),
    L('lead', 'Team lead', { prefix: 'Lead' }),
    L('manager', 'Sales manager', { suffix: 'Manager' }),
    L('director', 'Sales director', { suffix: 'Director' }),
    L('head', 'VP of Sales'),
  ],
  support: [
    L('entry', 'Agent / Rep'),
    L('ic', 'Specialist'),
    L('senior', 'Senior specialist', { prefix: 'Senior' }),
    L('lead', 'Team lead', { prefix: 'Lead' }),
    L('manager', 'Support manager', { suffix: 'Manager' }),
    L('head', 'Head of Customer Experience'),
  ],
  realestate: [
    L('entry', 'Junior agent', { prefix: 'Junior' }),
    L('ic', 'Agent'),
    L('senior', 'Senior agent', { prefix: 'Senior' }),
    L('lead', 'Team lead', { prefix: 'Lead' }),
    L('manager', 'Broker / Principal'),
    L('owner', 'Owner / Self-employed'),
  ],
  personal: [
    L('entry', 'Assistant / Junior', { prefix: 'Junior' }),
    L('ic', 'Practitioner / Stylist'),
    L('senior', 'Senior / Master', { prefix: 'Senior' }),
    L('manager', 'Salon / Studio manager', { suffix: 'Manager' }),
    L('owner', 'Owner / Self-employed'),
  ],
  agriculture: [
    L('entry', 'Farm worker'),
    L('senior', 'Experienced / Certified', { prefix: 'Senior' }),
    L('lead', 'Lead hand', { prefix: 'Lead' }),
    L('manager', 'Farm / Site manager', { suffix: 'Manager' }),
    L('owner', 'Owner / Operator'),
  ],
};

/** The rungs to offer someone in this sector. */
export const levelsFor = (sector) => LEVELS_BY_SECTOR[sector] || DEFAULT_LEVELS;

// Kept for the wizard and anything else importing the office-job ladder.
export const SENIORITY_LEVELS = DEFAULT_LEVELS;

export const WORK_STYLES = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On-site' },
  // "I don't mind" is a real answer, and forcing a preference someone does
  // not have narrows their job matches for no reason.
  { id: 'flexible', label: 'Flexible' },
];

/* ─── Questions in the terms of their own trade ─────────────────

   "Remote, hybrid, or on-site?" asked of an electrician offers them a job
   that does not exist. Where the work happens at a place — a site, a
   kitchen, a factory floor, a ward, a classroom — the real question is how
   far they will go for it, and the options say so.

   The ids stay the four the rest of the app understands (coachMarket counts
   openings by them): close to home is on-site in their city, travelling is
   flexible about where, a site-and-office mix is hybrid. Only the words
   change, never what is stored. */
const SITE_BASED = new Set(['trades', 'manufacturing', 'hospitality']);
const MOSTLY_IN_PERSON = new Set(['healthcare', 'education']);

const WORK_STYLES_BY_SECTOR = {
  trades: [
    { id: 'onsite', label: 'Close to home' },
    { id: 'flexible', label: 'Happy to travel between sites' },
    { id: 'hybrid', label: 'Mix of site and office' },
  ],
  manufacturing: [
    { id: 'onsite', label: 'Close to home' },
    { id: 'flexible', label: 'Happy to travel or relocate' },
    { id: 'hybrid', label: 'Mix of floor and office' },
  ],
  hospitality: [
    { id: 'onsite', label: 'Close to home' },
    { id: 'flexible', label: 'Happy to travel or relocate' },
  ],
  healthcare: [
    { id: 'onsite', label: 'In person, close to home' },
    { id: 'flexible', label: 'Happy to travel' },
    { id: 'hybrid', label: 'Some remote or telehealth' },
    { id: 'remote', label: 'Fully remote' },
  ],
  education: [
    { id: 'onsite', label: 'In person, close to home' },
    { id: 'flexible', label: 'Happy to travel' },
    { id: 'hybrid', label: 'Some online teaching' },
    { id: 'remote', label: 'Fully online' },
  ],
};

export const workStylesFor = (draft = {}) => WORK_STYLES_BY_SECTOR[draft.sector] || WORK_STYLES;

export const workStyleQuestion = (draft = {}) => {
  if (SITE_BASED.has(draft.sector)) return 'Where are you happy to work?';
  if (MOSTLY_IN_PERSON.has(draft.sector)) return 'In person, or some remote?';
  return 'Remote, hybrid, or on-site?';
};

export const workStyleHint = (draft = {}) => (
  SITE_BASED.has(draft.sector) || MOSTLY_IN_PERSON.has(draft.sector)
    ? 'Pick the closest. It decides which jobs I count as near you.'
    : 'Pick Flexible if you are open to any of them.'
);

/* The kinds of work worth offering. A trade has apprenticeships, not
   internships; a restaurant hires for the season. */
const EMPLOYMENT_SWAPS = {
  trades: { internship: { id: 'apprenticeship', label: 'Apprenticeship' } },
  manufacturing: { internship: { id: 'apprenticeship', label: 'Apprenticeship' } },
  hospitality: { internship: { id: 'seasonal', label: 'Seasonal' } },
  healthcare: { internship: { id: 'internship', label: 'Placement or residency' } },
};

export const employmentTypesFor = (draft = {}) => {
  const swaps = EMPLOYMENT_SWAPS[draft.sector] || {};
  return EMPLOYMENT_TYPES.map((t) => swaps[t.id] || { id: t.id, label: t.label });
};

// Same ids, their words: the ids drive which questions follow.
const CAREER_STAGE_LABELS = {
  trades: { internship: 'Apprenticeship so far', new_grad: 'Just finished trade school', self_taught: 'Learned on the job' },
  manufacturing: { internship: 'Apprenticeship so far', self_taught: 'Learned on the job' },
  healthcare: { internship: 'Clinical placements so far', new_grad: 'Newly qualified' },
  hospitality: { self_taught: 'Learned on the job' },
};

/* The stepId on the resume offer. Not a ladder step — it is a question about
   the conversation rather than one inside it. */
export const RESUME_CHOICE = '__resume_choice';

/* The one-time offer to talk instead of type. Its own stepId for the same
   reason as the resume choice: it is a question about how the conversation
   runs, not a question inside it. */
export const VOICE_CHOICE = '__voice_choice';

/* Offered after someone signed out asks to talk. Its own stepId so the two
   buttons route to auth instead of into the ladder. */
export const VOICE_SIGNIN_CHOICE = '__voice_signin';

// Not an answer either: it hands the person the keyboard. The chip row is a
// shortcut, never the whole answer space — most job titles are not on it.
export const CUSTOM_ANSWER_CHIP = { id: '__custom', label: 'Type my own' };

// Not an answer: tapping it re-renders the same question with every sector.
// The `__` prefix is what keeps it out of local answer matching.
export const MORE_SECTORS_CHIP = { id: '__more_sectors', label: 'More fields' };

/**
 * The sector chips. 26 at once is a wall rather than a question, so the
 * first screen is the primary set — chosen to span the labour market, not
 * to rank it — and the rest are one tap behind "More fields".
 */
/* The way out at the end of the full list. Twenty-six fields still miss
   people (aviation, the arts, the military), and with no chip for them the
   only path was noticing that the text box would take an answer. Same id
   as "Type my own", so it hands over the keyboard the same way. */
export const FIELD_NOT_LISTED_CHIP = { id: CUSTOM_ANSWER_CHIP.id, label: "My field isn't listed" };

export const sectorChips = (expanded = false) => {
  const chips = (expanded ? JOB_SECTORS : PRIMARY_SECTORS)
    .map((s) => ({ id: s.id, label: s.label }));
  chips.push(expanded ? { ...FIELD_NOT_LISTED_CHIP } : { ...MORE_SECTORS_CHIP });
  return chips;
};

/**
 * A typed field: one of ours if it matches, otherwise taken as said. Before
 * this, "Aviation" matched nothing, the model could not map it either, and
 * the field chips came back with no way past them.
 */
/* Words that mark a sentence as someone talking, not naming a field.
   "So hey, so let's talk." passed the title check (no "I'm", six words or
   fewer) and became the field "So Hey, So Let's Talk.", and the coach moved
   on to asking their level. */
const CHATTY = /\b(hey|hi|hello|yo|let'?s|talk|chat|speak|call|start|begin|so|ok|okay|please|thanks|thank|what|why|how|who|where|when|which|can|could|would|should|will|tell|about|yourself|you|question|profile|resume|cv)\b/i;

/* A field nobody listed is taken as typed only when it reads like the name
   of one: a few words, no sentence punctuation, nothing conversational.
   Everything else goes to the coach, which can tell "Aviation" from "hey". */
export const looksLikeFieldName = (text) => {
  const typed = String(text || '').trim();
  if (!typed || !looksLikeTitle(typed)) return false;
  if (typed.split(/\s+/).length > 4) return false;
  if (/[?!]/.test(typed) || /[.,;:]\s*\S/.test(typed)) return false;
  return !CHATTY.test(typed);
};

export const fieldFromText = (text) => {
  const typed = String(text || '').trim();
  const matched = matchSector(typed);
  if (matched) return { sector: matched.sector, title: matched.title || '' };
  if (!looksLikeFieldName(typed)) return null;
  return { sector: normalizeTitle(typed.replace(/[.\s]+$/, '')), title: '' };
};

/* Why someone wants the next job, and what they think is stopping them.
   These are the two questions a careers adviser asks and a form never does,
   and the answers change what "how far away is it?" even means: scope and
   stability are not the same ask, even about the same job title.

   Chips because most people recognise their reason faster than they can
   phrase it, free text because the real answer is often none of these. Both
   are stored verbatim and spent inside the assessment call that already runs
   — the understanding costs no extra model call, only a better prompt. */

export const TARGET_MOTIVES = [
  { id: 'scope', label: 'Bigger scope or impact' },
  { id: 'money', label: 'Better pay' },
  { id: 'lead', label: 'I want to lead' },
  { id: 'craft', label: 'Go deeper on the craft' },
  { id: 'domain', label: 'Move into a new field' },
  { id: 'balance', label: 'Better balance' },
  { id: 'stability', label: 'More stability' },
  { id: 'stuck', label: 'I have outgrown this one' },
];

export const TARGET_BLOCKERS = [
  { id: 'experience', label: 'Not enough experience yet' },
  { id: 'skill', label: 'Missing a specific skill' },
  { id: 'paper', label: 'It is not on paper anywhere' },
  { id: 'chance', label: 'Nobody gives me the first shot' },
  { id: 'credential', label: 'I need a qualification' },
  { id: 'switch', label: 'Coming from a different field' },
  { id: 'unsure', label: 'Honestly, I am not sure' },
];

export const IMPORT_CHOICES = [
  { id: 'resume', label: 'Upload my resume' },
  { id: 'linkedin', label: 'Import from LinkedIn' },
  { id: 'chat', label: "No, let's just chat" },
];

/* "Just chat" can mean "not right now" or "I have nothing to upload", and
   reading it as the first had the offer coming back after every call. So it
   is asked once more at most, and that second time it carries the plain
   answer, which settles it for good. */
export const NO_RESUME_CHIP = { id: 'none', label: "I don't have a resume" };
export const SECOND_IMPORT_CHOICES = [
  { id: 'resume', label: 'Upload my resume' },
  { id: 'linkedin', label: 'Import from LinkedIn' },
  NO_RESUME_CHIP,
];
// How many times the offer may be passed on before it stops being made.
export const IMPORT_OFFER_LIMIT = 2;

/* The same three, offered again after a file was refused. Same ids, so the
   answer handling does not care which row a chip came from — only the first
   label changes, because "upload my resume" is odd advice to someone who just
   did exactly that. */
export const RETRY_IMPORT_CHOICES = [
  { id: 'resume', label: 'Try another file' },
  { id: 'linkedin', label: 'Import from LinkedIn' },
  { id: 'chat', label: "No, let's just chat" },
];

/* Where the talk-or-type invitation belongs.
   Everything before this step is facts a button answers faster and more
   accurately than speech. Everything from here is why — what they want, what
   is in the way — which is the part nobody writes well in a text box. */
/* Moved up to the recent-role question: describing a job and what you did
   there is the first answer that is easier said than typed. The facts
   speech gets wrong (names, dates) are checked on one card after the call. */
export const VOICE_OFFER_STEP = 'currentRole';

/* What the call is actually for.
   Not the same list as missingFields. That one is the written checklist and
   includes things a call should never spend a minute on — a location, a
   school name. This is the subset a conversation is better at, plus whatever
   the typed flow genuinely did not get. Order matters: the model works down
   it, so the two "why" questions come first. */
/* Where the job can be done from, asked the way that fits the field: a
   trade is never asked whether it wants to work remotely. */
const workStyleAgendaItem = (draft = {}) => {
  if (SITE_BASED.has(draft.sector)) return 'where they are happy to work: close to home, or travelling between sites (this work is on site; never ask about remote)';
  if (MOSTLY_IN_PERSON.has(draft.sector)) return 'whether they want fully in-person work or some remote';
  return 'remote, hybrid or on-site, or flexible';
};

/* After an import the call is the review itself, section by section, in
   the order a recruiter reads: headline, summary, then the recent jobs,
   weakest first. Short: one question per section. */
const importAgenda = (draft = {}) => {
  const agenda = [];
  if (draft.title) agenda.push(`their headline: is "${draft.title}" the job title they want recruiters to find them by`);
  const summary = String(draft.summary || '').trim();
  agenda.push(summary.length < 120
    ? 'their summary: in a sentence or two, what they do and what they are best at'
    : 'their summary: one thing it is missing that they would want a recruiter to know');
  const roles = (draft.experience || []).slice(0, 3).map((r, i) => ({ r, i, weak: !/\d/.test(String(r.description || '')) || linesOf(r.description).length < 2 }));
  roles.sort((a, b) => Number(b.weak) - Number(a.weak) || a.i - b.i);
  for (const { r } of roles) {
    agenda.push(`their job as ${[r.title, r.company].filter(Boolean).join(' at ')}: what they actually did there and what changed because of it, with a number if there is one (record it with company "${r.company || ''}")`);
  }
  for (const probe of (draft.review?.probes || []).slice(0, 2)) agenda.push(`a gap in their resume: ${probe}`);
  if (!draft.target) agenda.push('what role they want next, and why');
  else if (!draft.targetWhy) agenda.push(`why they want ${draft.target} next`);
  if (!(draft.roleTypes || []).length) agenda.push('full-time, contract, or open to either');
  if (!draft.workStyle) agenda.push(workStyleAgendaItem(draft));
  return agenda;
};

/* The chat path's short call: the facts are typed in already, so this is
   only what a conversation gets better than a form. Two or three minutes. */
const talkAgenda = (draft = {}) => {
  const agenda = [];
  if (draft.target && !draft.targetWhy) agenda.push(`why they want ${draft.target} next`);
  else if (!draft.target) agenda.push('what role they want next, and why');
  if (!draft.targetBlocker) agenda.push('what they think is standing in the way of it');
  agenda.push('what matters most to them in the next team or company');
  agenda.push('anything that would rule a job out for them (commute, travel, pay, hours)');
  agenda.push('one thing they are proud of that is not on their profile yet');
  return agenda;
};

export const voiceAgenda = (draft = {}) => {
  if (draft.talkCall) return talkAgenda(draft);
  if (draft.importedFrom && (draft.experience || []).length) return importAgenda(draft);
  const agenda = [];
  /* After an import, the call is the review's follow-ups said out loud:
     the gaps the review found, then what a resume cannot say. */
  for (const probe of (draft.review?.probes || []).slice(0, 3)) {
    agenda.push(`ask about this gap in their resume: ${probe}`);
  }
  // Offered at the role question, so a call with no role yet starts there.
  if (!(draft.experience || []).length && !['new_grad', 'student'].includes(draft.careerStage)) {
    agenda.push('their most recent role: where, what title, and roughly when');
    agenda.push('what they actually did there that they are proudest of');
  }
  if (!draft.target) agenda.push('what they want to do next');
  if (!draft.targetWhy) agenda.push('why that, and what is pulling them toward it');
  if (!draft.targetBlocker) agenda.push('what they think is standing in the way');
  const written = missingFields(draft).filter(
    (m) => !/where they are based|education|the role they want next/.test(m)
  );
  return [...agenda, ...written];
};

/* Offered when they ask for it mid-conversation ("can I upload my resume?").
   The third chip goes back to the question they were on, so it says so. */
export const ASKED_IMPORT_CHOICES = [
  { id: 'resume', label: 'Upload my resume' },
  { id: 'linkedin', label: 'Import from LinkedIn' },
  { id: 'chat', label: 'Not now' },
];

/* Offered when a call hands back to the screen. "Try another file" would be
   nonsense to someone who has not touched a file yet, and the third option
   has to say the conversation continues rather than ends — they just spent
   five minutes talking and are owed the rest of it. */
export const POST_CALL_IMPORT_CHOICES = [
  { id: 'resume', label: 'Upload my resume' },
  { id: 'linkedin', label: 'Import from LinkedIn' },
  { id: 'chat', label: 'Not now' },
  NO_RESUME_CHIP,
];

/* The evidence probe, in the units of the person's own trade. See
   SECTOR_EVIDENCE for why it is not one question for everybody. */
export const evidenceProbe = (draft = {}) =>
  SECTOR_EVIDENCE[draft.sector] || DEFAULT_EVIDENCE;

/**
 * A step's question, which for the evidence probe depends on who is being
 * asked. Everything the page does with `step.question` goes through here.
 */
export const questionText = (step, draft = {}) =>
  (typeof step?.question === 'function' ? step.question(draft) : step?.question || '');

/** The grey line under a question, which can also depend on who is asked. */
export const hintText = (step, draft = {}) =>
  (typeof step?.hint === 'function' ? step.hint(draft) : step?.hint || '');

/* ─── The ladder ──────────────────────────────────────────────

   Each step declares:
     id        stable key; also the `stepId` sent to /coach/interpret
     question  the coach's bubble
     hint      the grey sub-line under it
     kind      'chips'  pick exactly one, then advance
               'multi'  pick several, then confirm
               'text'   free text only (no chips offered)
               'branch' a chip choice that changes the route, not the draft
     chipSet   name resolved by getChips() below — dynamic sets (titles,
               skills) depend on the sector picked earlier
     freeText  whether typing is accepted here at all
     aiStep    stepId for /coach/interpret; null means free text is taken
               verbatim and needs no model (a typed job title IS the value)
     assign    where a chip's value lands in the draft
     skipIf    predicate name resolved below
     optional  offers a "Skip" chip and can be left empty
*/

export const LADDER = [
  /* First, what they already have. A resume or LinkedIn answers most of
     what follows, so it is asked before anything else rather than after
     three questions it would have answered. "I don't have one" goes on to
     the questions. */
  {
    id: 'importOffer',
    // Asked a second time (after a call, usually) only if passed on once.
    question: (draft) => (draft.importDeclines
      ? 'One more time before we go on: do you have a resume or a LinkedIn profile I can read?'
      : 'Let us start with what you already have. Do you have a resume or your LinkedIn?'),
    hint: (draft) => (draft.importDeclines
      ? 'If not, just say so and I will not ask again. We will build it together.'
      : 'Upload it and I will do most of the work. No resume is fine too, we will build it together.'),
    kind: 'branch',
    chipSet: 'importChoices',
    // Typing here is choosing to chat; see submitText.
    freeText: true,
    aiStep: null,
    assign: null,
  },
  {
    id: 'sector',
    question: "Let's start broad. Which field are you in?",
    hint: 'Tap one, or just tell me in your own words.',
    kind: 'chips',
    chipSet: 'sectors',
    freeText: true,
    // Free text here is matched locally against sector names and the known
    // job-title list first (see matchSector in ./utils). Only a genuinely
    // unrecognisable answer falls through to the model.
    aiStep: 'title',
    assign: 'sector',
  },
  {
    id: 'level',
    question: 'Got it. And what level are you at?',
    hint: 'Roughly where you sit. It goes into your headline, and your job title is next.',
    kind: 'chips',
    chipSet: 'levels',
    freeText: true,
    aiStep: null,
    assign: 'level',
  },
  {
    id: 'title',
    question: "And what's your job title?",
    hint: 'Pick the closest one or type your own. This is what recruiters search.',
    kind: 'chips',
    chipSet: 'titles',
    freeText: true,
    /* A typed job title is already the answer, so the common case costs no
       model call and a guest can walk straight past it. But "I'm not sure
       what to put here" is not a job title, and taking every string verbatim
       is how that sentence ended up in someone's headline. Anything that does
       not read like a title goes to the model, which either finds the title
       inside the sentence or asks again. See looksLikeTitle. */
    aiStep: 'title',
    assign: 'title',
  },
  {
    /* After the first document, ask for the other one. A resume says what
       they did; LinkedIn adds what the resume left out, and the two
       together are the fullest picture anyone hands over. Asked once, and
       not at all once both kinds are in. */
    id: 'moreSources',
    question: (draft) => (sourcesOf(draft).includes('resume')
      ? 'Got it. Do you have your LinkedIn too? Your resume and LinkedIn together give me the full picture.'
      : 'Got it. Do you have a resume too? Together with LinkedIn it gives me the full picture.'),
    hint: '',
    kind: 'branch',
    chipSet: 'moreSources',
    freeText: true,
    aiStep: null,
    assign: null,
    skipIf: 'noImport',
  },
  {
    id: 'review',
    question: 'Give me a second, I am reading it properly.',
    hint: '',
    // A "run" step performs work and reports back instead of asking anything.
    kind: 'run',
    runs: 'review',
    chipSet: null,
    freeText: false,
    aiStep: null,
    assign: null,
    // Only worth doing when there is a document to react to. Reviewing a
    // profile the person has not built yet is just describing an empty page.
    skipIf: 'noImport',
  },
  {
    /* How to do the rest: one choice, once. Voice runs the whole thing to
       the preview; chat types it, with a short call offered near the end.
       Offering a call at several points, as before, mixed the two and left
       people unsure which mode they were in. Skipped silently when a call
       is not possible right now (see askStep). */
    id: 'mode',
    question: (draft) => (draft.importedFrom
      ? 'That is my read. How would you like to finish? We can talk it through, under 5 minutes, or carry on here in the chat.'
      : 'How would you like to do the rest? We can talk it through, about 5 minutes, or carry on here in the chat.'),
    hint: '',
    kind: 'branch',
    chipSet: 'mode',
    freeText: true,
    aiStep: null,
    assign: null,
  },
  {
    id: 'lookingFor',
    question: 'What kind of work are you looking for?',
    hint: 'Pick as many as apply.',
    kind: 'multi',
    chipSet: 'employmentTypes',
    freeText: false,
    aiStep: null,
    assign: 'roleTypes',
  },
  {
    id: 'workStyle',
    question: (draft) => workStyleQuestion(draft),
    hint: (draft) => workStyleHint(draft),
    kind: 'chips',
    chipSet: 'workStyles',
    freeText: false,
    aiStep: null,
    assign: 'workStyle',
  },
  {
    id: 'careerStage',
    question: 'Where are you in your career right now?',
    hint: 'This decides what I ask next, so pick honestly.',
    kind: 'chips',
    chipSet: 'careerStages',
    freeText: false,
    aiStep: null,
    assign: 'careerStage',
  },
  {
    id: 'currentRole',
    // A story question: offers "Say it instead" when the browser can listen.
    story: true,
    question: 'Tell me about your most recent role. Where was it, and when?',
    // Their own title: a designer was shown "Product manager at Acme".
    hint: (draft) => `Something like "${draft.title || 'Product manager'} at Acme, 2022 to now" is plenty.`,
    kind: 'text',
    chipSet: null,
    freeText: true,
    aiStep: 'currentRole',
    assign: null,
    // Students and new grads have no role to describe — asking anyway is how
    // a builder makes someone feel unqualified on question seven.
    skipIf: 'noWorkHistory',
    // Skippable because it has no chips: describing a role is prose, which is
    // the one thing a signed-out visitor can't spend. Without a skip they'd
    // hit the sign-up prompt with no way past it. The editor still asks.
    optional: true,
  },
  {
    id: 'achievements',
    story: true,
    question: 'What did you actually do there?',
    hint: "Just talk normally. I'll turn it into resume bullets.",
    kind: 'text',
    chipSet: null,
    freeText: true,
    aiStep: 'bullets',
    assign: null,
    skipIf: 'noWorkHistory',
    optional: true,
  },
  {
    id: 'previousRole',
    question: 'Anywhere before that?',
    hint: 'Role, company and roughly when is plenty. Skip if that is your whole history.',
    kind: 'text',
    chipSet: null,
    freeText: true,
    // Same shape as the current role, so it reuses that schema rather than
    // teaching the server a second way to describe a job.
    aiStep: 'currentRole',
    assign: null,
    // Only worth asking someone who named a first one. A work history of one
    // job is a fragment; of two it is a trajectory, which is what the
    // assessment and the summary are both trying to read.
    skipIf: 'noFirstRole',
    optional: true,
  },
  {
    id: 'projects',
    question: 'Then tell me about something you built, ran or organised.',
    hint: 'A side project, a course project, something at a volunteer job. What it was and what you did.',
    kind: 'text',
    chipSet: null,
    freeText: true,
    aiStep: 'projects',
    assign: null,
    // Asked of whoever reached here with nothing in their experience: no work
    // history, or they skipped the role questions. Those people were walking
    // out with an empty experience section, which is the section recruiters
    // read first. Not asked of someone who already named a job — the
    // conversation has to end eventually, and the editor can add more.
    skipIf: 'projectsCovered',
    optional: true,
  },
  {
    id: 'evidence',
    question: (draft) => evidenceProbe(draft),
    hint: 'One line is enough. This is the part recruiters actually read.',
    kind: 'text',
    chipSet: null,
    freeText: true,
    // The same schema the resume review's probes use: whatever this answer
    // evidences becomes bullets on the role, and any tool named in passing
    // becomes a skill.
    aiStep: 'probe',
    assign: null,
    skipIf: 'nothingToQuantify',
    optional: true,
  },
  {
    id: 'skills',
    question: "What are you good at? Tap everything that fits.",
    hint: 'These are literally what recruiters filter on, so be generous.',
    kind: 'multi',
    chipSet: 'skills',
    freeText: true,
    aiStep: 'skills',
    assign: 'skills',
  },
  {
    id: 'education',
    question: 'How about education? A degree, a bootcamp, certificates.',
    hint: 'One line is fine. Skip it if it is not relevant to you.',
    kind: 'text',
    chipSet: null,
    freeText: true,
    aiStep: 'education',
    assign: null,
    optional: true,
  },
  {
    id: 'location',
    question: 'Where are you based?',
    hint: 'City and country is enough.',
    kind: 'text',
    chipSet: null,
    freeText: true,
    aiStep: 'location',
    assign: null,
    optional: true,
  },
  {
    id: 'links',
    question: 'Anywhere someone can see your work?',
    hint: 'LinkedIn, GitHub, a portfolio. Paste any of them in one go, or skip if you would rather not.',
    kind: 'text',
    chipSet: null,
    freeText: true,
    // No model needed: a URL is already the answer, and which kind it is can
    // be read off the domain.
    aiStep: null,
    assign: null,
    optional: true,
  },
  {
    id: 'target',
    question: 'Now the part that actually matters. What are you aiming for next?',
    hint: 'Pick the closest, or tell me in your own words. I will tell you honestly how far it is.',
    kind: 'chips',
    chipSet: 'targets',
    freeText: true,
    // Whatever they type IS the target; no extraction needed.
    aiStep: null,
    assign: 'target',
  },
  {
    id: 'targetWhy',
    question: 'What is pulling you toward that?',
    hint: 'Tap the closest, or say it in your own words. It changes what good advice looks like.',
    kind: 'chips',
    chipSet: 'targetMotives',
    freeText: true,
    // Stored as said. It is spent inside the assessment call that already
    // runs, so understanding it costs a better prompt rather than a new call.
    aiStep: null,
    assign: 'targetWhy',
    skipIf: 'noTarget',
    optional: true,
  },
  {
    id: 'targetBlocker',
    question: 'And what do you think is in the way?',
    hint: 'I will tell you straight whether it is really the obstacle.',
    kind: 'chips',
    chipSet: 'targetBlockers',
    freeText: true,
    aiStep: null,
    assign: 'targetBlocker',
    skipIf: 'noTarget',
    optional: true,
  },
  {
    id: 'assess',
    question: 'Let me look at what is actually out there for that.',
    hint: '',
    kind: 'run',
    runs: 'assess',
    chipSet: null,
    freeText: false,
    aiStep: null,
    assign: null,
    skipIf: 'noTarget',
  },
  {
    /* The chat path's short call: near the end, once the facts are in, a
       few questions only a conversation gets (why, what is in the way, what
       matters in the next team). Not on the voice path, which was a call. */
    id: 'talkOffer',
    question: 'Almost done. Want to talk for 2 or 3 minutes? A few questions so I understand you better and find the jobs that fit you best.',
    hint: '',
    kind: 'branch',
    chipSet: 'talkOffer',
    freeText: true,
    aiStep: null,
    assign: null,
  },
  {
    /* The review's advice, done: a new headline, summary, bullets and
       skills, aimed at the goal they just named. Shown as one card; each
       change can be dropped, nothing lands without "Apply". Imports only:
       there is no document to improve on the from-scratch path. */
    id: 'fix',
    question: 'Now let me put that into your profile.',
    hint: '',
    kind: 'run',
    runs: 'fix',
    chipSet: null,
    freeText: false,
    aiStep: null,
    assign: null,
    skipIf: 'noImport',
  },
  {
    id: 'build',
    question: 'Right. Let me put your profile together.',
    hint: '',
    kind: 'run',
    runs: 'build',
    chipSet: null,
    freeText: false,
    aiStep: null,
    assign: null,
  },
  {
    id: 'tour',
    question: 'That is your profile. Here is what it unlocks.',
    hint: '',
    kind: 'tour',
    chipSet: null,
    freeText: false,
    aiStep: null,
    assign: null,
  },
  {
    id: 'convert',
    question: 'One last thing.',
    hint: '',
    kind: 'convert',
    chipSet: null,
    freeText: false,
    aiStep: null,
    assign: null,
  },
];

/** A fresh, empty draft. Every key the ladder can write is declared here so
 *  the shape never depends on how far someone got. */
export const emptyDraft = () => ({
  sector: '',
  level: '',
  title: '',
  roleTypes: [],
  workStyle: '',
  careerStage: '',
  location: '',
  summary: '',
  skills: [],
  experience: [],
  education: [],
  projects: [],
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  phone: '',
  // Set when a resume or LinkedIn import seeded the draft — the coach then
  // asks only about what the import left empty.
  importedFrom: null,
  // The upload offer: how often it was passed on, and whether they said
  // they have nothing to upload. Either stops it being asked again.
  importDeclines: 0,
  noResume: false,
  // The same, for a paragraph someone typed, dictated, or said on a call.
  spokenIntake: false,
  // What they want next, and the coach's read on how far away it is.
  target: '',
  targetWhy: '',
  targetBlocker: '',
  assessment: null,
  review: null,
});

/* ─── Surviving a reload ──────────────────────────────────────

   Seventeen questions is a long way to walk, and a refresh, a back-swipe on
   a phone or a dropped connection took all of it — with nothing on the
   server to fall back on for a signed-out visitor, which is most of them.
   The key was declared in constants.ts from the start and never used.

   Kept deliberately dumb: the transcript and the draft, a version, and a
   timestamp. Anything the shape of which changes is caught by the version
   and thrown away rather than restored into a page that cannot render it. */

export const CONVERSATION_KEY = 'profileai_coach_conversation';
// 2: v1 transcripts accumulated a "welcome back" line on every reload,
// because the line was saved into the transcript it was announcing. Those
// are not worth migrating — bumping the version drops them.
// 4: v3 conversations were saved by a different question order; their
// stepIndex points at the wrong question here.
// 5: the resume question moved to the front, so saved step numbers shifted.
const CONVERSATION_VERSION = 5;
// Long enough to survive a phone call, a closed laptop or a commute; short
// enough that a half-finished conversation from a fortnight ago does not
// ambush someone who came back to start again.
const CONVERSATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// A transcript this size means something has gone wrong; do not fill their
// storage quota with it.
const CONVERSATION_MAX_BYTES = 256 * 1024;

export const serializeConversation = ({ draft, stepIndex, messages } = {}) => JSON.stringify({
  v: CONVERSATION_VERSION,
  at: Date.now(),
  stepIndex: Number.isInteger(stepIndex) ? stepIndex : -1,
  draft: draft || emptyDraft(),
  // Anything said *about* the restore is not part of the conversation. Saving
  // the "welcome back" line meant the next reload restored it and added
  // another, and the greeting bred once per refresh.
  messages: (Array.isArray(messages) ? messages : []).filter((m) => !m.ephemeral),
});

/**
 * @returns {{draft, stepIndex, messages}|null} null whenever there is any
 * doubt — a bad restore is worse than a fresh start, because it strands
 * someone in a conversation whose controls no longer work.
 */
export const parseConversation = (raw, now = Date.now()) => {
  if (!raw) return null;
  let saved;
  try { saved = JSON.parse(raw); } catch { return null; }
  if (!saved || saved.v !== CONVERSATION_VERSION) return null;
  if (!Number.isFinite(saved.at) || now - saved.at > CONVERSATION_MAX_AGE_MS) return null;
  if (!Array.isArray(saved.messages) || !saved.messages.length) return null;
  if (!saved.draft || typeof saved.draft !== 'object') return null;
  // Nothing to come back to: the intro alone is not a conversation worth
  // restoring, and restoring it would just replay the slideshow.
  const answered = saved.messages.some((m) => m.role === 'me');
  if (!answered) return null;
  return {
    // Rows saved before the model's odd shapes were cleaned up get cleaned here.
    draft: { ...emptyDraft(), ...saved.draft, education: normalizeEducationRows(saved.draft.education || []) },
    stepIndex: Number.isInteger(saved.stepIndex) ? saved.stepIndex : -1,
    messages: saved.messages,
  };
};

export const saveConversation = (state) => {
  try {
    const raw = serializeConversation(state);
    if (raw.length > CONVERSATION_MAX_BYTES) return;
    localStorage.setItem(CONVERSATION_KEY, raw);
  } catch { /* private mode, or a full quota — losing the backup is not fatal */ }
};

export const loadConversation = () => {
  try { return parseConversation(localStorage.getItem(CONVERSATION_KEY)); } catch { return null; }
};

export const clearConversation = () => {
  try { localStorage.removeItem(CONVERSATION_KEY); } catch { /* nothing to clear */ }
};

/* ─── Chips ──────────────────────────────────────────────────── */

/**
 * Resolve a step's `chipSet` name into actual chips. Dynamic sets depend on
 * the sector chosen earlier; an unknown sector falls back to the union list
 * so the person is never shown an empty chip row.
 *
 * @returns {{id: string, label: string}[]}
 */
/* The title chips have to agree with the rank just given, and there are two
   ways to get that wrong.

   Offering "Frontend Developer" next to "Senior Frontend Engineer" is the
   same role twice, ranked inconsistently, and asks which of the two the
   person is. Offering only bare roles after they answered "Staff" is worse in
   a different way: nothing on screen acknowledges the answer, so the
   conversation reads as having forgotten it.

   So: strip the rank out of the raw list, de-duplicate what that collapses
   ("Senior Backend Engineer" and "Backend Developer" are two distinct roles,
   not four), then put the rank they actually gave back on every chip. A Staff
   engineer is offered Staff titles, a master electrician Master ones, because
   that is what those people write on a resume.

   Only rungs that read as part of a title get applied. "Mid-level" and
   "Qualified tradesperson" describe standing, not a job, and rungs like
   Manager pull their weight through the leadership titles that sort to the
   front instead. */

const RANK_PREFIX = /^(senior|sr\.?|junior|jr\.?|lead|principal|staff|associate|apprentice|master|trainee)\s+/i;
const LEADERSHIP = /(manager|director|head of|vp of|chief|president|partner|supervisor|foreman|principal investigator|broker)/i;
const MANAGING_LEVELS = new Set(['lead', 'manager', 'director', 'head', 'owner']);

/* A typed job title goes straight onto the profile as the headline, which
   means it is read by recruiters exactly as it was typed at speed into a
   chat box. "staff data analysis" is the right answer badly dressed, and
   shouting it back as the headline is the profile's first impression.

   Casing only. Fixing the words — "analysis" is not the job, "Analyst" is —
   means guessing at what someone meant about their own career, and being
   wrong about that is worse than being scruffy. Acronyms people actually use
   keep their capitals, because "Qa Engineer" and "Ui Designer" read as
   carelessness by the person, not by us. */

const TITLE_ACRONYMS = new Set([
  'it', 'qa', 'ux', 'ui', 'hr', 'pm', 'sre', 'ai', 'ml', 'bi', 'seo', 'sem',
  'cnc', 'hvac', 'cdl', 'rn', 'cna', 'emt', 'cpa', 'ceo', 'cfo', 'cto', 'cmo',
  'coo', 'cio', 'vp', 'sdr', 'ae', 'api', 'erp', 'crm', 'hgv',
]);

// Names that are neither lowercase nor all-caps, and that people type flat.
const TITLE_SPELLINGS = {
  ios: 'iOS', macos: 'macOS', javascript: 'JavaScript', typescript: 'TypeScript',
  github: 'GitHub', nodejs: 'Node.js', 'c#': 'C#', devops: 'DevOps',
  postgresql: 'PostgreSQL', mysql: 'MySQL', aws: 'AWS', saas: 'SaaS',
};

// Words that stay lowercase inside a title, never at the start of one.
const TITLE_MINOR = new Set(['of', 'at', 'in', 'on', 'and', 'the', 'for', 'to', 'a', 'an']);

/* Links arrive as whatever someone pastes: three URLs on one line, with or
   without https://, sometimes with a trailing comma. Which field each one
   belongs in is written on the domain, so this needs no model — and anything
   we cannot place is kept as the portfolio rather than dropped, because a
   link someone bothered to paste is never noise. */
export const parseLinks = (text) => {
  const found = String(text || '').match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s,;]*)?/gi) || [];
  const out = {};
  for (const raw of found) {
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = url.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
    if (host.includes('linkedin.')) { out.linkedinUrl = out.linkedinUrl || url; continue; }
    if (host.includes('github.') || host.includes('gitlab.')) { out.githubUrl = out.githubUrl || url; continue; }
    out.portfolioUrl = out.portfolioUrl || url;
  }
  return out;
};

export const normalizeTitle = (text) => {
  const words = String(text || '').trim().replace(/\s+/g, ' ').split(' ');
  return words
    .map((word, i) => {
      const bare = word.toLowerCase();
      // Anything capitalised deliberately (iOS, eBay, McDonald's) is left
      // exactly as typed — the person knows their own field better than we do.
      if (word !== bare && word !== word.toUpperCase()) return word;
      if (TITLE_SPELLINGS[bare]) return TITLE_SPELLINGS[bare];
      if (TITLE_ACRONYMS.has(bare)) return word.toUpperCase();
      if (i > 0 && TITLE_MINOR.has(bare)) return bare;
      // Hyphens, slashes and brackets start new words: "full-stack" →
      // "Full-Stack", "developer (ios)" → "Developer (iOS)" via the map above.
      return bare.replace(/(^|[-/(])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ');
};

export const titleChips = (sector, level) => {
  const seen = new Set();
  const roles = [];

  for (const title of SECTOR_TITLES[sector] || []) {
    const base = title.replace(RANK_PREFIX, '').trim();
    // "Frontend Developer" and "Frontend Engineer" are one job spelled two
    // ways; offering both asks the person to choose between synonyms.
    const key = norm(base).replace(/\bdeveloper\b/g, 'engineer');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    roles.push({ label: base, leadership: LEADERSHIP.test(base) });
  }

  // Stable sort: the sector's own ordering survives inside each group.
  const wantsLeadership = MANAGING_LEVELS.has(level);
  roles.sort((a, b) => Number(b.leadership === wantsLeadership) - Number(a.leadership === wantsLeadership));

  const rank = levelsFor(sector).find((l) => l.id === level);
  const ranked = (label) => {
    if (!rank?.prefix) return label;
    // A leadership title carries its own rank — "Staff Engineering Manager"
    // is not a job, and neither is "Senior Senior Engineer".
    if (LEADERSHIP.test(label) || norm(label).includes(norm(rank.prefix))) return label;
    return `${rank.prefix} ${label}`;
  };

  return roles.slice(0, LIMITS.TITLE_CHIPS).map((r) => {
    const label = ranked(r.label);
    return { id: label, label };
  });
};

/* "What are you aiming for next?" was answered with the person's own rank
   applied to their neighbours' jobs: a Staff Frontend Developer was offered
   Staff Backend Developer, Staff Full Stack Developer, Staff Frontend
   Engineer. Those are sideways, and reading them back as ambition is how a
   product tells someone it has not been listening.

   Next means one of three real things, in the order people actually weigh
   them: the next rung on the track they are already on, the management
   branch, and only then a lateral move into a neighbouring role. The last of
   those is a genuine answer — plenty of people do want the same rank in a
   different specialism — it is just nobody's first thought. */

export const targetChips = (draft = {}) => {
  const { sector, level, title } = draft;
  const current = String(title || '').trim();
  const base = current.replace(RANK_PREFIX, '').trim();
  const levels = levelsFor(sector);
  const at = levels.findIndex((l) => l.id === level);

  const out = [];
  const add = (label) => {
    const clean = String(label || '').trim();
    if (!clean || norm(clean) === norm(current)) return;
    if (out.some((o) => norm(o) === norm(clean))) return;
    out.push(clean);
  };

  /* 1. Up their own track — but only as far as anyone can actually see.
        Offering "Principal Frontend Developer" to someone who just said
        entry level is flattery, and flattery is the failure mode career
        products die of. Two rungs is a real horizon; eight is a fantasy. */
  if (base && at >= 0) {
    for (const rung of levels.slice(at + 1, at + 3)) {
      if (rung.prefix) add(`${rung.prefix} ${base}`);
    }
  }

  /* 2. The management branch, in their sector's own words — offered to
        people who are within sight of it. "Engineering Manager" is the same
        fantasy as "Principal" when someone has just said entry level, and
        two fantasies do not make a career plan. */
  if (at >= 2) {
    for (const sectorTitle of SECTOR_TITLES[sector] || []) {
      if (LEADERSHIP.test(sectorTitle)) add(sectorTitle);
    }
  }

  // 3. Sideways, but only into a related role. The sector list is not ranked,
  //    so an unfiltered sweep offers a nurse "Medical Assistant" as an
  //    ambition — a step down, read back as a goal. Sharing a real word with
  //    the job they do is a cheap, honest test of "related": Backend
  //    Developer for a Frontend Developer, Nurse Practitioner for a nurse,
  //    nothing at all for a Server.
  const words = new Set(
    norm(base).split(/[^a-z]+/).filter((w) => w.length > 3)
  );
  const related = (label) => norm(label).split(/[^a-z]+/).some((w) => words.has(w));
  for (const chip of titleChips(sector, level)) {
    if (related(chip.label)) add(chip.label);
  }

  // A director on the top rung of a short ladder can run out of honest
  // suggestions. Better a wider list than three chips and a dead end.
  if (out.length < 3) {
    for (const chip of titleChips(sector, level)) add(chip.label);
  }

  return out.slice(0, LIMITS.TITLE_CHIPS).map((label) => ({ id: label, label }));
};

/* Someone who just said Principal is not offered "I'm a new grad". */
const SENIOR_LEVELS = new Set(['senior', 'staff', 'principal', 'lead', 'manager', 'director', 'head', 'owner']);
export const careerStageChips = (draft = {}) => CAREER_STAGES
  .filter((c) => !SENIOR_LEVELS.has(draft.level) || !['new_grad', 'internship'].includes(c.id))
  .map((c) => ({ id: c.id, label: CAREER_STAGE_LABELS[draft.sector]?.[c.id] || c.label }));

/* Steps that announce or show something rather than ask: never a question
   the model can ask on the page's behalf. */
export const NOT_ASKED_KINDS = new Set(['run', 'tour', 'convert']);

/* Questions whose answer is the person's own words (a title, a role, their
   skills), so the model's suggestions, written from what they have said,
   fit better than a list by field. The rest have fixed answers the profile
   stores as ids (full-time, remote), and keep them. */
export const OPEN_CHIP_SETS = new Set(['titles', 'targets', 'skills']);

/**
 * The model's suggested answers as chips for a step, or undefined to keep
 * the step's own. Only open questions take them; "Type my own" stays where
 * the step had it.
 */
export const suggestionChips = (step, suggestions = []) => {
  if (!step || !OPEN_CHIP_SETS.has(step.chipSet) || !suggestions.length) return undefined;
  const chips = suggestions.map((label) => ({ id: label, label }));
  return step.chipSet === 'skills' ? chips : [...chips, { ...CUSTOM_ANSWER_CHIP }];
};

export const getChips = (step, draft = {}) => {
  if (!step || !step.chipSet) return [];
  switch (step.chipSet) {
    case 'sectors':
      return sectorChips(false);
    case 'levels':
      return levelsFor(draft.sector).map((l) => ({ id: l.id, label: l.label }));
    case 'titles':
      return [...titleChips(draft.sector, draft.level), { ...CUSTOM_ANSWER_CHIP }];
    case 'employmentTypes':
      return employmentTypesFor(draft);
    case 'workStyles':
      return workStylesFor(draft).map((w) => ({ id: w.id, label: w.label }));
    case 'careerStages':
      return careerStageChips(draft);
    case 'skills': {
      const map = SECTOR_SKILLS[draft.sector] || ALL_SKILLS;
      const flat = Object.values(map).flat();
      // De-dupe: several sectors list the same skill under two headings.
      return Array.from(new Set(flat))
        .slice(0, LIMITS.SKILL_CHIPS)
        .map((s) => ({ id: s, label: s }));
    }
    case 'targets':
      return [...targetChips(draft), { ...CUSTOM_ANSWER_CHIP }];
    case 'targetMotives':
      return TARGET_MOTIVES.map((m) => ({ id: m.label, label: m.label }));
    case 'targetBlockers':
      return TARGET_BLOCKERS.map((b) => ({ id: b.label, label: b.label }));
    case 'importChoices':
      return (draft.importDeclines ? SECOND_IMPORT_CHOICES : IMPORT_CHOICES).map((c) => ({ id: c.id, label: c.label }));
    case 'moreSources':
      return sourcesOf(draft).includes('resume') ? MORE_FROM_LINKEDIN : MORE_FROM_RESUME;
    case 'mode':
      return MODE_CHOICES;
    case 'talkOffer':
      return TALK_OFFER_CHOICES;
    default:
      return [];
  }
};

/* ─── Local answer matching (the no-AI path) ─────────────────── */

/**
 * Try to resolve free text to a sector without calling the model.
 *
 * Two passes: the sector's own words ("design", "marketing"), then the known
 * job titles ("software engineer" → tech). This is what makes the Figma's
 * "I'm a software engineer" quick-reply free for a signed-out visitor.
 *
 * @returns {{sector: string, title?: string}|null}
 */
/* Whole words only.
   The alias lists contain short, legitimate ones — "pr", "it", "hr", "ae" —
   and a plain substring test finds "pr" inside "profileai", which is how
   "how profileai helps me" came back as Media, Writing & PR and started
   building someone a journalism profile. */
const containsPhrase = (haystack, phrase) => {
  const needle = norm(phrase);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Letters, digits, + and # are word characters here, so "c++" and "c#"
  // survive and "pr" does not match inside "profileai".
  return new RegExp(`(^|[^a-z0-9+#])${escaped}([^a-z0-9+#]|$)`, 'i').test(haystack);
};

export const matchSector = (text) => {
  const t = norm(text);
  if (!t) return null;

  // Titles first, longest first: "Senior Data Analyst" is better evidence
  // than the word "data", and the specific title is worth keeping.
  const titled = Object.entries(SECTOR_TITLES)
    .flatMap(([sectorId, titles]) => titles.map((title) => ({ sectorId, title })))
    .sort((a, b) => b.title.length - a.title.length)
    .find(({ title }) => containsPhrase(t, title));
  if (titled) return { sector: titled.sectorId, title: titled.title };

  // Then how people actually describe their field — "I'm an electrician",
  // "I work in a call center" — which is rarely the label we wrote.
  const aliased = JOB_SECTORS
    .flatMap((sector) => (sector.aliases || []).map((alias) => ({ sector, alias })))
    .sort((a, b) => b.alias.length - a.alias.length)
    .find(({ alias }) => containsPhrase(t, alias));
  if (aliased) return { sector: aliased.sector.id };

  for (const sector of JOB_SECTORS) {
    // "Design & Creative" → ["design", "creative"]
    const words = sector.label.split('&').map((w) => norm(w)).filter(Boolean);
    if (words.some((w) => w.length > 2 && containsPhrase(t, w))) return { sector: sector.id };
  }

  return null;
};

/**
 * Match free text against a chip set, so typing "manager" where chips were
 * offered doesn't burn an AI call. Exact-ish match only — a fuzzy guess that
 * silently picks the wrong chip is worse than asking the model.
 */
export const matchChip = (text, chips) => {
  const t = norm(text);
  if (!t) return null;
  // Control chips ("More fields") are not answers — typing their label must
  // not assign one as the person's sector.
  chips = (chips || []).filter((c) => !String(c.id).startsWith('__'));
  return (
    chips.find((c) => norm(c.label) === t) ||
    chips.find((c) => norm(c.label).includes(t) && t.length > 3) ||
    null
  );
};

/**
 * Every skill the taxonomy knows, indexed by its lowercase form, so a typed
 * or transcribed skill can be restored to the spelling the chips use.
 * Guessing casing from shape does not work — "wms" wants WMS but "git" wants
 * Git, and no rule separates them. A lookup does.
 */
const CANONICAL_SKILLS = (() => {
  const index = new Map();
  const add = (name) => {
    const key = String(name).toLowerCase();
    if (!index.has(key)) index.set(key, name);
  };
  Object.values(SECTOR_SKILLS).forEach((groups) => Object.values(groups).flat().forEach(add));
  Object.values(ALL_SKILLS).flat().forEach(add);
  return index;
})();

/**
 * Tidy the casing of a skill without mangling the ones that carry their own.
 *
 * People type "excel, route planning"; the chip vocabulary and every recruiter
 * filter show "Excel", "Route Planning". Three passes, most reliable first:
 * a known skill takes the taxonomy's spelling, anything already mixed-case is
 * left alone ("iOS", "PostgreSQL", ".NET"), and the rest gets title case.
 */
export const normalizeSkill = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return '';
  const known = CANONICAL_SKILLS.get(value.toLowerCase());
  if (known) return known;
  if (value !== value.toLowerCase()) return value;
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
};

/**
 * Split a typed skills answer on the separators people actually use.
 * Skills are short proper nouns, so this is reliable enough to skip the
 * model for the common "react, node, postgres" case.
 */
export const parseSkillList = (text) => {
  const parts = String(text || '')
    .split(/[,;\n]|\band\b|\/|\|/i)
    .map((s) => normalizeSkill(s))
    .filter((s) => s && s.length <= 40);
  return Array.from(new Set(parts));
};

/**
 * Does this step's free text need the model at all?
 *
 * Answering no is the difference between a guest completing the ladder and a
 * guest hitting a sign-up wall, so each `false` here is deliberate:
 *   - no aiStep declared → the raw text IS the value
 *   - the text matched a chip locally
 *   - a skills answer that split cleanly into a list
 */
/* ─── Is that an answer, or is it talking to me? ───────────────

   The title step takes what you type as your title, because a typed job
   title is already the answer and routing it through a model would spend a
   call to learn nothing. The same shortcut stored "Hi" as someone's level and
   "I have a question?" as their job title, which then went into the headline
   a recruiter reads. Every free-text step has the same hole, including the
   ones that do call the model: "what do you mean?" reaches an extractor
   looking for an employer, and it will find one.

   So before any step sees the text: is this an answer at all? Greetings and
   questions are cheap and unambiguous to spot, and being wrong is not
   symmetrical — treating a real answer as chatter costs one extra exchange,
   while treating chatter as an answer silently corrupts the profile. */

const GREETINGS = /^(hi|hey|hello|yo|hiya|sup|howdy|good (morning|afternoon|evening)|salam|salaam|bonjour|hola)( there| again| all| everyone)?[\s!.,]*$/i;

// Openers that make something a question even without a question mark.
const QUESTION_OPENERS = /^(what|why|how|who|where|when|which|can you|can i|could you|do you|does it|did you|is this|is it|are you|are we|will you|would you|should i|tell me about you|explain)\b/i;

/* The same thing, anywhere in the sentence. People do not open with the
   question — they open with manners. "Hey I hope you're doing great so I have
   a question about the portfolio, what does the portfolio do for me" was read
   as an answer and filed, because every pattern here was anchored to the
   start of the string. Politeness should not cost someone an answer. */
const QUESTION_ANYWHERE = /\b(i have a question|i've got a question|quick question|can you tell me|tell me more about|what (is|are|does|do|can|happens|kind of)|how (do|does|did|can|long|much|many)|why (do|does|is|are|would)|do i need|do you (have|offer|support)|is there|are there|what if)\b/i;

/* Things people say to a chat box that are about the conversation rather
   than in it. Every one of these was being stored as the answer — typed at
   the job-title question, "I'm not sure what to put here" became someone's
   headline. A regex will never catch all of it, but it can catch the dozen
   phrases that make up most of it. */
const META = /^(i have a question|i've got a question|question|help|help me|wait|hold on|stop|idk|i don'?t know|no idea|what do you mean|huh|\?+)\b/i;

// Uncertainty, anywhere in the sentence. The coach has something genuinely
// useful to say here — that it is fine to skip, and what happens if they do.
const UNSURE = /\b(not sure|don'?t know|do not know|no idea|dunno|unsure|not certain|what should i (put|write|say))\b/i;

/* Talking about the conversation itself: complaints, corrections, nudges.
   These need a person's answer, never a filing. */
const ABOUT_THE_CHAT = /\b(already told you|you (just )?asked|asked (me )?that|not what i meant|tell me more|what do you mean|repeat that|go back|start over)\b/i;

/* Bare acknowledgements. Not answers to anything, and as a job title they are
   absurd — "Ok" is nobody's headline. */
const ACK = /^(ok|okay|k|yes|yeah|yep|yup|no|nope|sure|fine|right|thanks|thank you|cool|got it|alright)\b[\s!.,]*$/i;

/* Asking whether they may ask. The coach answers "Of course, go ahead." and
   then has to actually wait — which cannot be inferred from the reply, since
   that sentence has no question mark in it. Read it off the question instead:
   deterministic, and true regardless of how the model phrases the yes. */
const PERMISSION = /^(can|could|may) i ask\b|\bquick question first\b|\bone question first\b|\bbefore we (start|continue|go on)\b.*\?$/i;

// Asking for help is asking a question, however it is phrased.
const HELP = /\b(i need help|need some help|can you help|could you help|help me|not sure what you (mean|want))\b/i;

/* Typing the skip out loud. The chip is right there, but people type it —
   and "Skip" is not a job title. */
const SKIP_WORD = /^(skip|skip this|skip it|next|pass|later|not now|no thanks)\b[\s!.,]*$/i;

/**
 * @returns {'answer'|'greeting'|'question'|'skip'|'ack'|'permission'} what they are doing
 */
export const readsAsAnswer = (text, step, draft = {}) => {
  const typed = String(text || '').trim();
  if (!typed) return 'answer';

  if (GREETINGS.test(typed)) return 'greeting';
  if (SKIP_WORD.test(typed)) return 'skip';
  if (PERMISSION.test(typed)) return 'permission';
  if (META.test(typed) || UNSURE.test(typed) || ABOUT_THE_CHAT.test(typed) || HELP.test(typed)) return 'question';
  /* "Ok" is not an answer to anything, but it is not worth a model call
     either — there is nothing in it to respond to. Its own intent, handled
     locally and free. A greeting is different: someone saying hello to a
     coach deserves a coach saying hello back, and at roughly a tenth of a
     cent that is the cheapest warmth in the product. */
  if (ACK.test(typed)) return 'ack';

  // A chip label is that chip, whatever punctuation came with it.
  if (step && matchChip(typed, getChips(step, draft))) return 'answer';

  const words = typed.split(/\s+/).length;

  // Asked somewhere in the middle of a polite sentence.
  if (QUESTION_ANYWHERE.test(typed)) return 'question';

  // A question mark on its own does not make a question: "Product Manager?"
  // is someone hedging about their own title, and answering it with an
  // explanation of the product would be absurd. It takes an opener, or
  // enough words that it cannot be a hedged job title.
  if (typed.endsWith('?') && (QUESTION_OPENERS.test(typed) || words >= 5)) return 'question';
  if (QUESTION_OPENERS.test(typed) && words <= 14) return 'question';

  return 'answer';
};

/* Does this read like a job title, or like someone talking?
   Titles are short noun phrases. Sentences about oneself are not, and the
   giveaway is nearly always a first-person verb: "I work in", "I'm not
   sure", "I need help". */
const NOT_A_TITLE = /\b(i am|i'?m|i work|i need|i want|i have|i do|i think|i guess|my |can you|help|sure|know)\b/i;

export const looksLikeTitle = (text) => {
  const typed = String(text || '').trim();
  if (!typed) return false;
  const words = typed.split(/\s+/);
  // Six words covers "Senior Director of Product Marketing, EMEA".
  if (words.length > 6) return false;
  if (NOT_A_TITLE.test(typed)) return false;
  return true;
};

export const needsAI = (step, text, draft = {}) => {
  if (!step || !step.aiStep) return false;
  const typed = String(text || '').trim();
  if (!typed) return false;

  if (step.id === 'sector') return !matchSector(typed);
  if (step.id === 'skills') return parseSkillList(typed).length === 0;
  // A plain title is taken as typed; a sentence goes to the model to have the
  // title pulled out of it, or to be asked again.
  if (step.id === 'title') return !looksLikeTitle(typed);

  const chips = getChips(step, draft);
  if (chips.length && matchChip(typed, chips)) return false;

  return true;
};

/* ─── Changing your mind ──────────────────────────────────────

   The transcript is append-only, so a mis-tapped sector poisoned every
   question after it — titles, skills, the target ladder — with no way back
   short of abandoning the conversation. Chat interfaces get away with that
   when the stakes are a reply; here the stakes are the profile.

   Only chip answers can be rewound. A step that writes prose through the
   model puts it into experience rows and skill lists, and untangling which
   row came from which sentence is guesswork — those stay editable where
   they were always editable, in the editor at the end. */

export const canRewind = (step) => !!(step && step.assign && step.chipSet);

/**
 * The draft with this step's answer, and everything downstream of it,
 * forgotten. Changing your sector has to forget the job title you picked
 * out of the old sector's list, or the correction leaves a worse mess than
 * the mistake.
 */
export const draftRewoundTo = (draft, stepId) => {
  const at = LADDER.findIndex((s) => s.id === stepId);
  if (at < 0) return draft;
  // Downstream in the order this conversation actually walked: after an
  // import the goal comes before the preferences, not after them.
  const order = ladderOrder(draft);
  const from = order.indexOf(at);
  const downstream = from >= 0 ? order.slice(from).map((i) => LADDER[i]) : LADDER.slice(at);
  const blank = emptyDraft();
  const next = { ...draft };
  for (const step of downstream) {
    if (step.assign) next[step.assign] = blank[step.assign];
  }
  return next;
};

/* ─── What the profile still needs ───────────────────────────

   The checklist handed to the model each turn. It stays on our side: the
   model decides how to ask and how to respond, never what a profile
   requires. Phrased as things a person would say, because that is what the
   model has to turn back into a question. */

export const missingFields = (draft = {}) => {
  const missing = [];
  if (!draft.sector) missing.push('what field they work in');
  if (!draft.title) missing.push('their job title');
  if (!draft.level) missing.push('how senior they are');
  if (!(draft.roleTypes || []).length) missing.push('the kind of work they want: full-time, contract, and so on');
  if (!draft.workStyle) {
    missing.push(SITE_BASED.has(draft.sector)
      ? 'whether they want work close to home or are happy to travel for it (this work is done on site, never remote)'
      : 'remote, hybrid or on-site');
  }
  if (!(draft.experience || []).length && !(draft.projects || []).length) {
    missing.push('their most recent role, or a project if they have no job to name');
  } else if (!String((draft.experience || [])[0]?.description || '').trim()) {
    missing.push('what they actually did in that role, in concrete terms');
  }
  if (!(draft.skills || []).length) missing.push('what they are good at');
  if (!(draft.education || []).length) missing.push('education, a bootcamp or certifications');
  if (!draft.location) missing.push('where they are based');
  if (!draft.target) missing.push('the role they want next');
  return missing;
};

/* ─── Ladder navigation ──────────────────────────────────────── */

const SKIP_PREDICATES = {
  // Students, new grads and self-taught changers may have no employer to
  // name. The editor still lets them add one later.
  noWorkHistory: (draft) =>
    draft.careerStage === 'new_grad' || draft.careerStage === 'student',
  /* Nothing to pin a number to — no job and no project — so there is nothing
     to probe. Also skipped for anyone who already answered in numbers: asking
     someone who wrote "cut deploy time from 40 minutes to 6" to quantify it
     reads as not having read their answer. */
  nothingToQuantify: (draft) => {
    const latest = (draft.experience || [])[0] || (draft.projects || [])[0];
    if (!latest) return true;
    return /\d/.test(String(latest.description || ''));
  },
  // Nothing to be "before", so there is nothing to ask.
  noFirstRole: (draft) => !(draft.experience || []).length,
  /* Projects are for whoever has nothing else to show — and for anyone
     whose job history is in the field they are leaving. A career changer's
     employer is the old career; the portfolio work in the new one is exactly
     what is missing, and asking only the unemployed for it was how we
     managed to skip the people who need it most. */
  projectsCovered: (draft) => (draft.experience || []).length > 0
    && !['career_change', 'self_taught'].includes(draft.careerStage),
  // Nothing was imported, so there is no document to react to.
  noImport: (draft) => !draft.importedFrom,
  // They skipped the target question; assessing an unstated goal would mean
  // inventing one for them.
  noTarget: (draft) => !String(draft.target || '').trim(),
};

/* Where someone is in their career, read off the jobs already in the draft.
   A resume with three full-time roles on it has answered "do you have work
   experience?", and asking anyway after the coach has just reviewed it reads
   as not having looked. Only the plain cases are inferred: a career changer
   cannot be told apart from anyone else by a job list, so with no roles, or
   only internships, it is asked or left as it was. */
const INTERNSHIP = /\b(intern|internship|co-?op|trainee|apprentice)\b/i;
export const inferredCareerStage = (draft = {}) => {
  if (draft.careerStage) return draft.careerStage;
  const roles = (draft.experience || []).filter((r) => r && (r.title || r.company));
  if (!roles.length) return '';
  return roles.every((r) => INTERNSHIP.test(String(r.title || ''))) ? 'internship' : 'experienced';
};

export const shouldSkip = (step, draft = {}) => {
  if (!step || !step.skipIf) return false;
  const predicate = SKIP_PREDICATES[step.skipIf];
  return predicate ? !!predicate(draft) : false;
};

/**
 * Index of the next step to ask, skipping any whose `skipIf` fires and any
 * the import already answered. Returns -1 when the conversation is done.
 */
/* The order once a resume or LinkedIn is in, with work history on it.
   The review has just told them where they stand, so the goal comes
   straight after it: that is what the rest of the conversation fixes the
   profile toward. The questions that ask for work history (the role, what
   they did, the one before, projects, a number) are left out: the document
   answered them, and the review's own follow-ups cover its gaps. Asking
   "tell me about your most recent role" after reading it is what made the
   import feel pointless. Steps not named here are not asked on this path. */
/** The profile URL in a message, if it has a LinkedIn one ("linkedin.com/in/..."). */
export const linkedinProfileUrl = (text = '') => {
  const m = String(text).match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/i);
  if (!m) return '';
  return /^https?:/i.test(m[0]) ? m[0] : `https://${m[0]}`;
};

/** Every change on a fix card, as the keys its toggles use. */
export const fixKeys = (plan = {}) => [
  ...(plan.headline ? ['headline'] : []),
  ...(plan.summary ? ['summary'] : []),
  ...(plan.roles || []).map((r) => `role:${r.index}`),
  ...(plan.skills || []).map((s) => `skill:${s}`),
];

/** The draft with the picked changes from a fix card applied. */
export const applyFixPlan = (draft = {}, plan = {}, picked = []) => {
  const on = new Set(picked);
  const next = { ...draft, fixDone: true };
  if (plan.headline && on.has('headline')) next.title = plan.headline;
  if (plan.summary && on.has('summary')) next.summary = plan.summary;
  const roles = (plan.roles || []).filter((r) => on.has(`role:${r.index}`));
  if (roles.length) {
    next.experience = (draft.experience || []).map((row, i) => {
      const fix = roles.find((r) => r.index === i);
      return fix ? { ...row, description: fix.bullets.join('\n') } : row;
    });
  }
  const skills = (plan.skills || []).filter((s) => on.has(`skill:${s}`));
  if (skills.length) {
    const have = new Set((draft.skills || []).map((s) => String(s).toLowerCase()));
    next.skills = [...(draft.skills || []), ...skills.filter((s) => !have.has(s.toLowerCase()))];
  }
  return next;
};

export const IMPORT_ORDER = [
  'importOffer', 'moreSources', 'sector', 'title',
  'review', 'mode',
  'target', 'targetWhy', 'targetBlocker', 'assess',
  'lookingFor', 'workStyle', 'careerStage',
  'skills', 'education', 'location', 'links',
  'talkOffer', 'fix',
  'build', 'tour', 'convert',
];

/* After choosing voice, nothing more is asked in the chat: the call
   covered it. What is left is the work that turns it into the preview. */
const VOICE_FINISH = new Set(['importOffer', 'moreSources', 'review', 'mode', 'assess', 'fix', 'build', 'tour', 'convert']);

const DEFAULT_ORDER = LADDER.map((_, i) => i);
const IMPORT_ORDER_INDICES = IMPORT_ORDER
  .map((id) => LADDER.findIndex((s) => s.id === id))
  .filter((i) => i >= 0);

/** Which order the ladder walks in for this draft, as LADDER indices. */
export const ladderOrder = (draft = {}) => {
  const order = draft.importedFrom && (draft.experience || []).length ? IMPORT_ORDER_INDICES : DEFAULT_ORDER;
  return draft.mode === 'voice' ? order.filter((i) => VOICE_FINISH.has(LADDER[i].id)) : order;
};

export const nextStepIndex = (fromIndex, draft = {}) => {
  const order = ladderOrder(draft);
  let at = fromIndex < 0 ? -1 : order.indexOf(fromIndex);
  if (fromIndex >= 0 && at === -1) {
    // Asked before the import changed the order: carry on from where that
    // step would have sat.
    const after = order.findIndex((i) => i > fromIndex);
    at = after === -1 ? order.length : after - 1;
  }
  for (let p = at + 1; p < order.length; p += 1) {
    const step = LADDER[order[p]];
    if (shouldSkip(step, draft)) continue;
    if (isAlreadyAnswered(step, draft)) continue;
    return order[p];
  }
  return -1;
};

/**
 * True when an import already filled what this step asks for. Re-asking a
 * question the uploaded resume just answered is the fastest way to make an
 * import feel pointless, so the coach jumps over those.
 */
export const isAlreadyAnswered = (step, draft = {}) => {
  // Spoken intake counts like an import: both arrive with answers already in
  // hand, and re-asking for them is what makes either feel pointless.
  /* Anything the person has already said, however they said it.
     These are not gated on an import. The ladder normally walks forward and
     visits each step once, but it does not always: a call hands back
     part-way down, and the upload offer that follows re-enters the ladder
     from its own position. Somebody who picked "full-time" from a row of
     chips, talked for two minutes, and was then asked whether they want
     full-time or part-time has every reason to think nothing they said was
     heard. If the answer is in the draft, the question is answered. */
  switch (step.id) {
    case 'sector':
      return !!draft.sector;
    case 'level':
      return !!draft.level;
    // Once a resume or LinkedIn is in, neither the offer to upload one nor
    // the review of it comes round again. After a call the ladder restarts
    // from the top, and it asked "do you have a resume?" of someone who had
    // just uploaded one.
    // Nor once they have said they have none, or passed on it twice.
    case 'importOffer':
      return !!draft.importedFrom || !!draft.noResume
        || (draft.importDeclines || 0) >= IMPORT_OFFER_LIMIT;
    case 'moreSources':
      return !!draft.sourcesDone || new Set(sourcesOf(draft)).size >= 2;
    case 'mode':
      return !!draft.mode;
    case 'talkOffer':
      return !!draft.talkOfferDone || draft.mode === 'voice';
    case 'review':
      return !!draft.review;
    case 'lookingFor':
      return Array.isArray(draft.roleTypes) && draft.roleTypes.length > 0;
    case 'workStyle':
      return !!draft.workStyle;
    case 'careerStage':
      return !!inferredCareerStage(draft);
    // A link from the resume, the call, or typed earlier: the question about
    // where their work can be seen has its answer.
    case 'links':
      return !!(draft.linkedinUrl || draft.githubUrl || draft.portfolioUrl);
    case 'target':
      return !!draft.target;
    case 'targetWhy':
      return !!draft.targetWhy;
    case 'targetBlocker':
      return !!draft.targetBlocker;
    case 'assess':
      return !!draft.assessment;
    case 'fix':
      return !!draft.fixDone;
    default:
      break;
  }

  /* The rest only count as answered when they arrived in bulk — from an
     import or from a call. These are the steps that ask for detail, and a
     thin value scraped off a resume is still worth going back over. */
  if (!draft.importedFrom && !draft.spokenIntake) return false;
  switch (step.id) {
    case 'title':
      return !!draft.title;
    case 'currentRole':
      return Array.isArray(draft.experience) && draft.experience.length > 0;
    // Having a job is not having said what you did there: the achievement
    // question was skipped for anyone whose role came in through the chat.
    case 'achievements':
      return !!String((draft.experience || [])[0]?.description || '').trim();
    // A resume lists the earlier roles too.
    case 'previousRole':
      return !!draft.importedFrom && Array.isArray(draft.experience) && draft.experience.length > 0;
    case 'skills':
      return Array.isArray(draft.skills) && draft.skills.length > 0;
    case 'education':
      return Array.isArray(draft.education) && draft.education.length > 0;
    case 'location':
      return !!draft.location;
    default:
      return false;
  }
};

/* ─── Draft assembly ─────────────────────────────────────────── */

/** Apply a chip choice or extracted fields onto the draft, immutably. */
export const applyToDraft = (draft, patch = {}) => ({ ...draft, ...patch });

/**
 * Merge the fields /coach/interpret returned for one step into the draft.
 * Steps that map onto array rows (a role, a school) build the row here so
 * the page never has to know the editor's schema.
 *
 * `intoLatest` is set when the answer is completing a follow-up ("which
 * company?"). Without it the second half of one answer would prepend a
 * separate half-empty row instead of finishing the first.
 */
/* ─── One paragraph, many fields ──────────────────────────────

   The counterpart to the `braindump` schema on the server. Everything a
   person said in one go, spread across the draft — and a flag saying the
   conversation should now skip whatever it covered, the same way it skips
   after a resume import.

   Every field is treated as optional and additive: a paragraph that mentions
   only skills fills in skills and leaves the rest for the coach to ask. What
   is already in the draft wins, because a tapped chip is a deliberate answer
   and a parsed phrase is an inference. */

// "ten years in", "senior", "staff" — mapped onto the rung ids the ladder
// uses. Loose on purpose: this is a hint, and the headline question that
// follows is where it gets confirmed.
const SENIORITY_HINTS = [
  [/\b(apprentice|trainee)\b/i, 'entry'],
  [/\b(junior|entry|graduate|new grad|newly qualified)\b/i, 'entry'],
  [/\b(principal)\b/i, 'principal'],
  [/\b(staff)\b/i, 'staff'],
  [/\b(senior|sr\.?|master|charge)\b/i, 'senior'],
  [/\b(lead|foreman|supervisor)\b/i, 'lead'],
  [/\b(head of|vp|chief)\b/i, 'head'],
  [/\b(director)\b/i, 'director'],
  [/\b(manager|managing)\b/i, 'manager'],
  [/\b(mid|intermediate)\b/i, 'ic'],
  [/\b(freelance|contractor|consultant|self.?employed)\b/i, 'consultant'],
];

const seniorityFrom = (said, sector) => {
  const text = String(said || '');
  const rungs = levelsFor(sector).map((l) => l.id);
  for (const [pattern, id] of SENIORITY_HINTS) {
    if (pattern.test(text) && rungs.includes(id)) return id;
  }
  return '';
};

/* "Acme", "Acme Inc.", "acme test co" — the same employer as people retype
   it. Legal suffixes and punctuation are noise for this comparison. */
const companyKey = (name) => norm(name)
  .replace(/[.,]/g, '')
  .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|gmbh|plc)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export const sameCompany = (a, b) => {
  const ka = companyKey(a);
  return !!ka && ka === companyKey(b);
};

/* Fill what the row is missing, never overwrite what it has: the first time
   someone stated a fact is the deliberate one. Bullets are appended, once. */
const mergeRole = (row, fields, bullets) => {
  const endDate = row.endDate || fields.endDate || '';
  const existing = String(row.description || '').trim();
  const have = new Set(existing.split('\n').map((l) => norm(l.replace(/^[•\-*]\s*/, ''))));
  const added = bullets.filter((b) => !have.has(norm(b))).map((b) => `• ${b}`).join('\n');
  return {
    ...row,
    title: row.title || fields.title || '',
    company: row.company || fields.company || '',
    startDate: row.startDate || fields.startDate || '',
    endDate,
    current: !endDate || /present|now|current/i.test(endDate),
    description: [existing, added].filter(Boolean).join('\n'),
  };
};

/* A place is not a job title. "seattle, wa" cased as a title came out
   "Seattle, Wa" — the state code is an abbreviation, and so is "uk". */
const PLACE_CODES = new Set(['uk', 'usa', 'us', 'uae', 'nyc', 'eu', 'dc']);
export const normalizePlace = (text) => String(text || '').trim().replace(/\s+/g, ' ')
  .split(/\s*,\s*/)
  .filter(Boolean)
  .map((part, i) => (((i > 0 && /^[a-z]{2}$/i.test(part)) || PLACE_CODES.has(part.toLowerCase()))
    ? part.toUpperCase()
    : normalizeTitle(part)))
  .join(', ');

/* What the model sends is not always the shape the tool asked for: a school
   came back as { name, graduationYear, field }, and as a list of them. Each
   school object becomes its own education row; every other field that should
   be text is made text. */
const STRING_FIELDS = ['title', 'seniority', 'field', 'company', 'previousCompany', 'startDate', 'endDate',
  'school', 'degree', 'location', 'roleType', 'workStyle', 'target', 'graduationYear'];
const schoolRowsOf = (school) => (Array.isArray(school) ? school : [school])
  .filter((s) => s && typeof s === 'object')
  .map((s) => ({
    institution: textOf(s.name || s.institution || s.school),
    degree: textOf(s.degree),
    fieldOfStudy: textOf(s.field || s.fieldOfStudy || s.major),
    endDate: textOf(s.graduationYear || s.endDate || s.year).match(/\b(19|20)\d{2}\b/)?.[0] || '',
  }))
  .filter((r) => r.institution || r.degree);

export const applyBraindump = (draft = {}, rawFields = {}) => {
  const fields = { ...rawFields };
  const extraSchools = schoolRowsOf(fields.school);
  if (extraSchools.length) delete fields.school;
  STRING_FIELDS.forEach((k) => {
    if (fields[k] !== undefined && fields[k] !== null && typeof fields[k] !== 'string') fields[k] = textOf(fields[k]);
  });
  ['bullets', 'skills'].forEach((k) => {
    if (fields[k] !== undefined) fields[k] = (Array.isArray(fields[k]) ? fields[k] : [fields[k]]).map(textOf).filter(Boolean);
  });
  const next = { ...draft, spokenIntake: true };
  if (extraSchools.length) {
    const known = new Set((draft.education || []).map((r) => norm(textOf(r.institution))));
    const fresh = extraSchools.filter((r) => !known.has(norm(r.institution)));
    next.education = normalizeEducationRows([...fresh, ...(draft.education || [])]);
  }

  // Field first: it decides which rungs and titles the rest is read against.
  const matched = fields.field ? matchSector(fields.field) : null;
  if (!next.sector && matched?.sector) next.sector = matched.sector;
  /* A field the model heard that is not one of ours ("aviation", "marine
     biology") is kept as said, the same as typing it at the field question. */
  if (!next.sector && fields.field && !matched && looksLikeTitle(fields.field)) {
    next.sector = normalizeTitle(String(fields.field));
  }
  if (!next.sector && fields.title) {
    const fromTitle = matchSector(fields.title);
    if (fromTitle?.sector) next.sector = fromTitle.sector;
  }

  if (!next.title && fields.title) next.title = normalizeTitle(fields.title);
  if (!next.level) next.level = seniorityFrom(fields.seniority || fields.title, next.sector);
  // Cased on the way in: this answer skips the location question that would
  // otherwise have tidied it, and "san francisco" is someone's profile.
  if (!next.location && fields.location) next.location = normalizePlace(fields.location);

  /* Every turn runs through here, and the model repeats what it already
     knows: "Acme, 2021 to now" on the role answer, then Acme again with the
     bullets from the next one. Prepending a row each time put the same job
     on the profile twice, the second one empty, and the review then told the
     person their resume had a duplicate. A company already on the profile is
     that row, updated; bullets with no company belong to the latest role. */
  const bullets = (fields.bullets || []).filter(Boolean);
  if (fields.company || bullets.length) {
    const rows = [...(next.experience || [])];
    const at = fields.company
      ? rows.findIndex((r) => sameCompany(r.company, fields.company))
      : (rows.length ? 0 : -1);
    if (at >= 0) {
      rows[at] = mergeRole(rows[at], fields, bullets);
      next.experience = rows;
    } else if (fields.company || next.title || fields.title) {
      /* The title said for this role, not the headline: "Lead Product
         Designer at Acme" was filed as "Principal Product Designer". */
      next.experience = [mergeRole({
        title: fields.title || next.title || '', company: '', startDate: '', endDate: '', current: false, description: '',
      }, fields, bullets), ...rows];
    }
  }

  // An earlier employer with nothing else said about it is still a row worth
  // having — the editor can fill in the rest, and two roles read as a career
  // where one reads as a fragment. Once, though.
  if (fields.previousCompany
    && !(next.experience || []).some((r) => sameCompany(r.company, fields.previousCompany))) {
    next.experience = [...(next.experience || []), {
      title: '', company: fields.previousCompany, startDate: '', endDate: '', current: false, description: '',
    }];
  }

  const skills = (fields.skills || []).map(normalizeSkill).filter(Boolean);
  if (skills.length) next.skills = Array.from(new Set([...(draft.skills || []), ...skills]));

  /* The year they finished was said and then dropped: there was nowhere to
     put it. A school already on the profile is that row, filled in. */
  const gradYear = String(fields.graduationYear || '').match(/\b(19|20)\d{2}\b/)?.[0] || '';
  if (fields.school || fields.degree || gradYear) {
    const rows = [...(next.education || [])];
    const at = rows.findIndex((r) => (fields.school && norm(r.institution) === norm(fields.school))
      || (!fields.school && fields.degree && norm(r.degree) === norm(fields.degree)));
    const target = at >= 0 ? at : (!fields.school && !fields.degree && rows.length ? 0 : -1);
    if (target >= 0) {
      const row = rows[target];
      rows[target] = {
        ...row,
        institution: row.institution || fields.school || '',
        degree: row.degree || fields.degree || '',
        endDate: row.endDate || gradYear,
      };
      next.education = normalizeEducationRows(rows);
    } else if (fields.school || fields.degree) {
      next.education = normalizeEducationRows([
        { institution: fields.school || '', degree: fields.degree || '', fieldOfStudy: '', endDate: gradYear },
        ...rows,
      ]);
    }
  }

  return next;
};

export const mergeInterpreted = (draft, stepId, fields = {}, { intoLatest = false, append = false } = {}) => {
  const next = { ...draft };
  switch (stepId) {
    case 'currentRole': {
      if (append) {
        const rows = draft.experience || [];
        const row = {
          title: fields.title || '',
          company: fields.company || '',
          startDate: fields.startDate || '',
          endDate: fields.endDate || '',
          current: /present|now|current/i.test(fields.endDate || ''),
          description: '',
        };
        // A clarifying answer belongs to the row that turn started — the one
        // at the end — not to the job they still hold at the top.
        if (intoLatest && rows.length > 1) {
          const last = rows[rows.length - 1];
          next.experience = [...rows.slice(0, -1), {
            ...last,
            title: row.title || last.title,
            company: row.company || last.company,
            startDate: row.startDate || last.startDate,
            endDate: row.endDate || last.endDate,
            current: row.current,
          }];
          break;
        }
        next.experience = [...rows, row];
        break;
      }
      if (intoLatest && (draft.experience || []).length) {
        const [head, ...rest] = draft.experience;
        const endDate = fields.endDate || head.endDate || '';
        next.experience = [{
          ...head,
          title: fields.title || head.title,
          company: fields.company || head.company,
          startDate: fields.startDate || head.startDate,
          endDate,
          current: !endDate || /present|now|current/i.test(endDate),
        }, ...rest];
        break;
      }
      const row = {
        title: fields.title || draft.title || '',
        company: fields.company || '',
        startDate: fields.startDate || '',
        endDate: fields.endDate || '',
        // "Present" is what the editor keys its ongoing-role pill off — see
        // the note in JobPreferencesWizard/handoff.js.
        current: !fields.endDate || /present|now|current/i.test(fields.endDate),
        description: '',
      };
      next.experience = [row, ...(draft.experience || [])];
      if (!next.title && fields.title) next.title = fields.title;
      break;
    }
    case 'projects': {
      const name = String(fields.projectName || fields.name || '').trim();
      if (!name) break;
      const row = {
        title: name,
        role: fields.role || '',
        description: fields.description || '',
        url: fields.url || '',
        technologies: Array.isArray(fields.technologies) ? fields.technologies : [],
      };
      if (intoLatest && (draft.projects || []).length) {
        const [head, ...rest] = draft.projects;
        next.projects = [{ ...head, ...row, description: row.description || head.description }, ...rest];
        break;
      }
      next.projects = [row, ...(draft.projects || [])];
      // Tools named while describing a project are skills, and asking for
      // them again three questions later reads as not having listened.
      if (row.technologies.length) {
        next.skills = Array.from(new Set([...(draft.skills || []), ...row.technologies]));
      }
      break;
    }
    case 'education': {
      if (intoLatest && (draft.education || []).length) {
        const [head, ...rest] = draft.education;
        next.education = normalizeEducationRows([{
          ...head,
          institution: fields.school || head.institution,
          degree: fields.degree || head.degree,
          fieldOfStudy: fields.field || head.fieldOfStudy,
          endDate: fields.endDate || head.endDate,
        }, ...rest]);
        break;
      }
      // The prompt asks for "school" because that is what people say; the
      // editor reads `institution`. normalizeEducationRows owns that mapping
      // for every producer, so the coach routes through it too rather than
      // inventing a sixth spelling.
      next.education = normalizeEducationRows([
        {
          institution: fields.school || '',
          degree: fields.degree || '',
          fieldOfStudy: fields.field || '',
          startDate: '',
          endDate: fields.endDate || '',
        },
        ...(draft.education || []),
      ]);
      break;
    }
    // A probe answer is a story about their work. Whatever it evidences gets
    // used: bullets land on the role they were just talking about, tools join
    // the skills list. Either may be empty and that is fine.
    case 'braindump':
      return applyBraindump(draft, fields);
    case 'probe': {
      const newBullets = (fields.bullets || []).filter(Boolean);
      const append = (row) => {
        const existing = String(row.description || '').trim();
        const added = newBullets.map((b) => `• ${b}`).join('\n');
        return { ...row, description: existing ? `${existing}\n${added}` : added };
      };
      if (newBullets.length && (draft.experience || []).length) {
        const [head, ...rest] = draft.experience;
        next.experience = [append(head), ...rest];
      } else if (newBullets.length && (draft.projects || []).length) {
        // No job to hang it on: someone whose work is a project said something
        // worth keeping, and dropping it would be the worst of both.
        const [head, ...rest] = draft.projects;
        next.projects = [append(head), ...rest];
      }
      const probeSkills = (fields.skills || []).map(normalizeSkill).filter(Boolean);
      if (probeSkills.length) {
        next.skills = Array.from(new Set([...(draft.skills || []), ...probeSkills]));
      }
      break;
    }
    case 'skills': {
      const merged = new Set([
        ...(draft.skills || []),
        ...(fields.skills || []).map(normalizeSkill).filter(Boolean),
      ]);
      next.skills = Array.from(merged);
      break;
    }
    case 'location':
      if (fields.location) next.location = normalizePlace(fields.location);
      break;
    case 'title':
      if (fields.title) next.title = fields.title;
      break;
    case 'lookingFor':
      if (fields.roleType) next.roleTypes = [fields.roleType];
      if (fields.workStyle) next.workStyle = fields.workStyle;
      break;
    default:
      break;
  }
  return next;
};

/** Attach generated bullets to the most recent experience row. */
export const attachBullets = (draft, bullets = [], fallbackText = '') => {
  const experience = [...(draft.experience || [])];
  if (!experience.length) return draft;
  const description = bullets.length
    ? bullets.map((b) => `• ${b}`).join('\n')
    : String(fallbackText || '').trim();
  experience[0] = { ...experience[0], description };
  return { ...draft, experience };
};

/**
 * Seed the draft from a parsed resume / LinkedIn import. The parser returns
 * the flat "resumeData" shape, which is already close to what we keep — the
 * only real work is not clobbering answers the person already gave us by
 * hand before choosing to import.
 */
/* What they have handed over so far: 'resume' and/or 'linkedin'. */
export const sourcesOf = (draft = {}) => (
  draft.sources || (draft.importedFrom ? [draft.importedFrom] : [])
);

export const MODE_CHOICES = [
  { id: 'voice', label: 'Talk it through' },
  { id: 'chat', label: 'Continue in chat' },
];
export const TALK_OFFER_CHOICES = [
  { id: 'voice', label: "Sure, let's talk" },
  { id: 'skip', label: 'Skip, show my resume' },
];

export const MORE_FROM_LINKEDIN = [
  { id: 'pdf', label: 'Add my LinkedIn PDF' },
  { id: 'url', label: 'Paste my LinkedIn URL' },
  { id: 'done', label: "That's everything" },
];
export const MORE_FROM_RESUME = [
  { id: 'pdf', label: 'Upload my resume' },
  { id: 'done', label: "That's everything" },
];

const yearOf = (d) => String(d || '').slice(0, 4);
const linesOf = (text) => String(text || '').split('\n')
  .map((l) => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean);

/**
 * A second document on top of the first. seedFromImport keeps whatever the
 * draft already has, which is right for the first import over chat answers
 * and wrong here: a LinkedIn import after a resume was ignored outright, its
 * roles and all. Here the two are combined. The same job is one row, filled
 * from both: same company, and the same title or the same start year
 * (LinkedIn often has only "2022" where the resume says "2022-03"). Jobs on
 * only one of them are kept, newest first. Skills and schools are combined,
 * and the fuller summary wins.
 */
export const mergeImport = (draft = {}, parsed = {}, source = 'resume') => {
  if (!draft.importedFrom) return { ...seedFromImport(draft, parsed, source), sources: [source] };
  const experience = [...(draft.experience || [])];
  for (const row of parsed.experience || []) {
    if (!row || !(row.title || row.company)) continue;
    const at = experience.findIndex((r) => sameCompany(r.company, row.company)
      && (norm(r.title) === norm(row.title) || (yearOf(r.startDate) && yearOf(r.startDate) === yearOf(row.startDate))));
    if (at < 0) experience.push(row);
    else experience[at] = mergeRole(experience[at], row, linesOf(row.description));
  }
  const newest = (r) => (r.current ? '9999' : String(r.endDate || r.startDate || ''));
  experience.sort((a, b) => newest(b).localeCompare(newest(a)));

  const skillKey = new Set((draft.skills || []).map((s) => norm(s)));
  const skills = [...(draft.skills || []), ...(parsed.skills || []).filter((s) => s && !skillKey.has(norm(s)))];
  const schools = [...(draft.education || [])];
  for (const row of normalizeEducationRows(parsed.education || [])) {
    if (!schools.some((e) => norm(e.institution) === norm(row.institution))) schools.push(row);
  }
  const summary = String(parsed.summary || '').length > String(draft.summary || '').length ? parsed.summary : draft.summary;

  return {
    ...draft,
    title: draft.title || parsed.title || '',
    location: draft.location || parsed.location || '',
    phone: draft.phone || parsed.phone || '',
    linkedinUrl: draft.linkedinUrl || parsed.linkedinUrl || '',
    githubUrl: draft.githubUrl || parsed.githubUrl || '',
    summary: summary || '',
    skills,
    experience,
    education: schools,
    projects: (draft.projects || []).length ? draft.projects : (parsed.projects || []),
    sources: [...new Set([...sourcesOf(draft), source])],
  };
};

export const seedFromImport = (draft, parsed = {}, source = 'resume') => ({
  ...draft,
  title: draft.title || parsed.title || '',
  location: draft.location || parsed.location || '',
  phone: draft.phone || parsed.phone || '',
  linkedinUrl: draft.linkedinUrl || parsed.linkedinUrl || '',
  githubUrl: draft.githubUrl || parsed.githubUrl || '',
  summary: draft.summary || parsed.summary || '',
  skills: (draft.skills || []).length ? draft.skills : (parsed.skills || []),
  experience: (draft.experience || []).length ? draft.experience : (parsed.experience || []),
  education: (draft.education || []).length
    ? draft.education
    : normalizeEducationRows(parsed.education || []),
  projects: (draft.projects || []).length ? draft.projects : (parsed.projects || []),
  importedFrom: source,
});


/**
 * Whether typed input is accepted right now.
 *
 * The composer's enabled state and the submit handler's guard both call this.
 * They used to compute it separately and drifted: a probe question belongs to
 * the `review` step, which asks nothing itself and so declares
 * freeText: false — so the input accepted text while the send button silently
 * did nothing. One predicate, both callers.
 */
export const canAnswer = (step, probing) => !!probing || !!step?.freeText;

/* ─── The closing sequence ───────────────────────────────────── */

/**
 * Rows for the resume card rendered in the chat. The point of showing it is
 * that the person recognises their own working life in it, so this deliberately
 * mirrors the real resume's section order rather than the draft's key order.
 */
export const resumeSections = (draft = {}) => {
  const sections = [];
  const summary = String(draft.summary || '').trim();
  if (summary) sections.push({ key: 'summary', label: 'Summary', kind: 'text', body: summary });

  const skills = draft.skills || [];
  if (skills.length) sections.push({ key: 'skills', label: 'Skills', kind: 'chips', items: skills });

  const experience = (draft.experience || []).filter((r) => r && (r.title || r.company));
  if (experience.length) {
    sections.push({
      key: 'experience',
      label: 'Experience',
      kind: 'entries',
      items: experience.map((r) => ({
        heading: [r.title, r.company].filter(Boolean).join(' · '),
        meta: formatDateRange(r.startDate, r.endDate),
        lines: String(r.description || '')
          .split('\n')
          .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
          .filter(Boolean),
      })),
    });
  }

  const projects = (draft.projects || []).filter((p) => p && p.title);
  if (projects.length) {
    sections.push({
      key: 'projects',
      label: 'Projects',
      kind: 'entries',
      items: projects.map((p) => ({
        heading: p.title,
        meta: p.role || '',
        lines: [String(p.description || '').trim()].filter(Boolean),
      })),
    });
  }

  const education = normalizeEducationRows(draft.education || []).filter((e) => e && (e.institution || e.degree));
  if (education.length) {
    sections.push({
      key: 'education',
      label: 'Education',
      kind: 'entries',
      items: education.map((e) => ({
        heading: [e.degree, e.fieldOfStudy].filter(Boolean).join(', ') || e.institution,
        meta: [e.institution, e.endDate].filter(Boolean).join(' · '),
        lines: [],
      })),
    });
  }

  return sections;
};

/**
 * Whether the draft is worth showing off yet.
 *
 * Used to decide whether the build phase presents the profile as finished or
 * as "here is what is still missing". Telling someone their profile is ready
 * when it has one role and no skills is the kind of thing that costs trust the
 * first time they show it to anyone.
 */
export const isPresentable = (draft = {}) => {
  const skills = draft.skills || [];
  const hasEvidence = (draft.experience || []).length > 0 || (draft.projects || []).length > 0;
  return !!(String(draft.title || '').trim() && skills.length >= 3 && hasEvidence);
};

/* ─── Handoff to the editor ──────────────────────────────────── */

/**
 * Build the headline the profile leads with. The Figma promises the level
 * question "becomes your profile headline", so it has to actually show up:
 * "Senior Product Manager" beats "Product Manager" alone, but we never
 * duplicate a level the title already states.
 */
export const buildTitle = (draft = {}) => {
  const title = String(draft.title || '').trim();
  if (!title) return '';
  const level = levelsFor(draft.sector).find((l) => l.id === draft.level);
  if (!level) return title;

  // A rung joins the title the way its own sector says it — "Master
  // Electrician", not "Senior Electrician"; "Charge Nurse", not "Lead Nurse
  // (Manager)". Rungs with neither prefix nor suffix ("Mid-level",
  // "Qualified tradesperson") are descriptions of standing, not of a job:
  // "Mid-level Frontend Developer" is not a role anyone holds.
  if (level.prefix) {
    return norm(title).includes(norm(level.prefix)) ? title : `${level.prefix} ${title}`;
  }
  if (level.suffix) {
    return norm(title).includes(norm(level.suffix)) ? title : `${title} (${level.suffix})`;
  }
  return title;
};

/**
 * Map the conversation draft into the `resumeData` shape ProfileForm reads
 * from `location.state`. Reuses the wizard's row mappers so the coach
 * inherits the fixes made there (the "Present" sentinel, project URL
 * routing) instead of re-earning those bugs.
 */
/* The same job twice — same company, same start — merged into one row.
   Drafts saved before the duplicate fix still hold them. */
export const dedupeExperience = (rows = []) => {
  const out = [];
  for (const row of rows) {
    if (!row) continue;
    const at = out.findIndex((r) => sameCompany(r.company, row.company)
      && (!r.startDate || !row.startDate || String(r.startDate) === String(row.startDate))
      && (!r.title || !row.title || norm(r.title) === norm(row.title)));
    if (at < 0) { out.push(row); continue; }
    const bullets = String(row.description || '').split('\n')
      .map((l) => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean);
    out[at] = mergeRole(out[at], row, bullets);
  }
  return out;
};

export const draftToResumeData = (draft = {}) => ({
  title: buildTitle(draft),
  location: draft.location || '',
  phone: draft.phone || '',
  linkedinUrl: draft.linkedinUrl || '',
  githubUrl: draft.githubUrl || '',
  portfolioUrl: draft.portfolioUrl || '',
  summary: draft.summary || '',
  // Flat array — ProfileForm categorises it on the way in.
  skills: draft.skills || [],
  /* No employment type: the coach asks what work they want NEXT, and
     copying that onto every past role put "Full-time" on jobs nobody
     described. */
  experience: dedupeExperience(draft.experience || []).map((row) =>
    mapWizardExperienceToEditor(row, {})
  ),
  education: draft.education || [],
  projects: (draft.projects || []).map(mapWizardProjectToEditor),
});

/**
 * Adapter onto the canonical completion rubric (hooks/useProfileCompletion),
 * so the coach's meter, the editor sidebar and the dashboard card all report
 * the same number for the same profile.
 *
 * The coach never collects a photo, and only collects a summary at the very
 * end — both come through empty for most of the conversation, which
 * correctly keeps a mid-conversation profile under 100%.
 */
export const draftToProfileShape = (draft = {}) => ({
  title: buildTitle(draft),
  location: draft.location || '',
  summary: draft.summary || '',
  profilePicture: '',
  skills: draft.skills || [],
  experience: dedupeExperience(draft.experience || []),
  education: draft.education || [],
  projects: draft.projects || [],
  linkedinUrl: draft.linkedinUrl || '',
  githubUrl: draft.githubUrl || '',
});

/**
 * Per-item state for the right-rail panel. `lookingFor` has no equivalent in
 * the shared rubric (it's a preference, not profile content), so it's scored
 * here; everything else defers to the rubric's own `done` flags.
 */
/**
 * The strength meter, scored against what this conversation can actually
 * fill in.
 *
 * The canonical rubric has nine items and the coach asks for seven of them:
 * it never asks for a photo, and it only asks for projects when there is no
 * job to talk about. So answering every single question landed on 78% and
 * the word "Intermediate" — a progress bar whose best outcome is a B minus,
 * shown for the whole flow. The editor's rubric is untouched; this only
 * re-scores it over the items that are in play for this person.
 */
export const coachCompletion = (completion, draft = {}) => {
  const hasExperience = (draft.experience || []).length > 0;
  const hasProjects = (draft.projects || []).length > 0;

  const applicable = (completion.items || []).filter((item) => {
    if (item.key === 'photo') return false;
    // Never asked of someone with a job; never counted against them either.
    if (item.key === 'proj' && hasExperience) return false;
    // They were asked for projects instead — do not dock them twice.
    if (item.key === 'exp' && !hasExperience && hasProjects) return false;
    return true;
  });

  if (!applicable.length) return completion;

  const done = applicable.filter((i) => i.done).length;
  const pct = Math.round((done / applicable.length) * 100);
  const tier = COMPLETION_TIERS.find((t) => pct >= t.min) || COMPLETION_TIERS[COMPLETION_TIERS.length - 1];
  return { ...completion, items: applicable, pct, label: tier.label, color: tier.color };
};

export const panelState = (draft = {}, rubricItems = []) => {
  const byKey = Object.fromEntries(rubricItems.map((i) => [i.key, i.done]));
  return {
    title: !!byKey.title,
    location: !!byKey.location,
    lookingFor: !!(draft.roleTypes || []).length || !!draft.workStyle,
    skills: !!byKey.skills,
    exp: !!byKey.exp,
    proj: !!byKey.proj,
    edu: !!byKey.edu,
  };
};

/**
 * Which rows of the checklist to show this person.
 *
 * Projects only appear for the people the conversation actually asks: someone
 * with no job to name, or anyone who has already described one. Showing the
 * row to everyone would list a box the coach never offers to tick, and
 * hiding it from a new grad was worse — they answered the projects question
 * and watched nothing light up, with EXPERIENCE greyed out above it for a job
 * they have not had yet.
 */
/* Every row stays. Hiding Projects the moment a job was named made the
   checklist shrink from six rows to five with no explanation; it now says
   instead that projects are optional alongside a job. */
export const visiblePanelItems = (draft = {}, items = []) => items;

/* Preferences are stored as ids ("full-time") and were shown as ids next to
   the labels the person tapped ("Full-time"). One lookup for display. */
export const preferenceLabels = (draft = {}) => {
  // In the words they were offered: "Close to home", not "On-site".
  const types = (draft.roleTypes || []).map(
    (id) => employmentTypesFor(draft).find((t) => t.id === id)?.label || id
  );
  const style = workStylesFor(draft).find((w) => w.id === draft.workStyle)?.label || draft.workStyle || '';
  return [...types, style].filter(Boolean).join(', ');
};

/* ─── Speaking instead of typing ──────────────────────────── */

/* Not an answer: it starts the microphone on a story question. */
export const SAY_IT_CHIP = { id: '__say_it', label: 'Say it instead' };

/* Years worked out in code, never by the model, so a misheard "2012" for
   "2021" shows up as an obviously wrong number of years. */
const isOngoing = (value) => !value || /present|now|current|ongoing|today/i.test(String(value));

export const yearsBetween = (start, end, now = new Date()) => {
  const parse = (v) => {
    const s = String(v || '');
    const iso = s.match(/^(\d{4})-(\d{1,2})/);
    if (iso) return { y: Number(iso[1]), m: Number(iso[2]) };
    const y = s.match(/\b(19|20)\d{2}\b/);
    return y ? { y: Number(y[0]), m: null } : null;
  };
  const from = parse(start);
  const to = isOngoing(end) ? { y: now.getFullYear(), m: now.getMonth() + 1 } : parse(end);
  if (!from || !to) return null;
  let years = to.y - from.y;
  if (from.m && to.m && to.m < from.m) years -= 1;
  return Math.max(0, years);
};

/** "2021 to now (5 yrs)". */
export const roleConfirmText = (row = {}, now = new Date()) => {
  const start = String(row.startDate || '').match(/\b(19|20)\d{2}\b/)?.[0] || '';
  if (!start) return '';
  const ongoing = row.current || isOngoing(row.endDate);
  const end = ongoing ? 'now' : (String(row.endDate || '').match(/\b(19|20)\d{2}\b/)?.[0] || '?');
  const years = yearsBetween(row.startDate, ongoing ? 'present' : row.endDate, now);
  const length = years === null ? '' : years < 1 ? ' (under a year)' : ` (${years} yr${years === 1 ? '' : 's'})`;
  return `${start} to ${end}${length}`;
};

/* ─── The check after a call ───────────────────────────────

   Speech gets names and dates wrong ("Acne", "2012" for "2021"), and on a
   resume that is the mistake that matters. After a call, the facts it heard
   are listed once, each fixable in place. Not after every answer: reading
   everything back made the conversation feel like a form. */

const ROLE_KEYS = ['title', 'company'];
const DATE_KEYS = ['startDate', 'endDate'];
const EDU_KEYS = ['school', 'degree', 'graduationYear'];

/**
 * @param {object} draft
 * @param {Set<string>|string[]} heard the learned-field keys the call produced
 * @returns {{kind: string, label: string, text: string}[]}
 */
export const checkLines = (draft = {}, heard = []) => {
  const keys = new Set(heard);
  const lines = [];
  const row = (draft.experience || [])[0];
  if (row && ROLE_KEYS.some((k) => keys.has(k))) {
    const text = [row.title, row.company].filter(Boolean).join(' · ');
    if (text) lines.push({ kind: 'role', label: 'Role', text });
  }
  if (row && DATE_KEYS.some((k) => keys.has(k)) && row.startDate) {
    lines.push({ kind: 'dates', label: 'Dates', text: roleConfirmText({ startDate: row.startDate, endDate: row.endDate, current: row.current }) });
  }
  const edu = (draft.education || [])[0];
  if (edu && EDU_KEYS.some((k) => keys.has(k))) {
    const text = [edu.degree, edu.institution, edu.endDate].filter(Boolean).join(' · ');
    if (text) lines.push({ kind: 'education', label: 'Education', text });
  }
  if (keys.has('location') && draft.location) lines.push({ kind: 'location', label: 'Location', text: draft.location });
  if (keys.has('skills') && (draft.skills || []).length) {
    lines.push({ kind: 'skills', label: 'Skills', text: draft.skills.join(', ') });
  }
  return lines;
};

const YEAR = /\b(19|20)\d{2}\b/g;
const parts = (text) => String(text || '').split(/\s*[·,|]\s*|\s+at\s+/i).map((p) => p.trim()).filter(Boolean);

/** A corrected line, written back over what the call heard. */
export const applyCheckEdit = (draft = {}, kind, text) => {
  const next = { ...draft };
  const rows = [...(draft.experience || [])];
  if (kind === 'role' && rows.length) {
    const [title, ...rest] = parts(text);
    rows[0] = { ...rows[0], title: title || rows[0].title, company: rest.join(', ') || rows[0].company };
    next.experience = rows;
  }
  if (kind === 'dates' && rows.length) {
    const years = String(text).match(YEAR) || [];
    const ongoing = /now|present|current|today/i.test(text);
    if (years[0]) {
      rows[0] = {
        ...rows[0],
        startDate: years[0],
        endDate: ongoing ? 'Present' : (years[1] || ''),
        current: ongoing || !years[1],
      };
      next.experience = rows;
    }
  }
  if (kind === 'education' && (draft.education || []).length) {
    const year = (String(text).match(YEAR) || [])[0] || '';
    const words = parts(String(text).replace(YEAR, '')).filter(Boolean);
    const [degree = '', institution = ''] = words;
    next.education = normalizeEducationRows([
      { ...draft.education[0], degree: degree || draft.education[0].degree, institution: institution || draft.education[0].institution, endDate: year || draft.education[0].endDate },
      ...draft.education.slice(1),
    ]);
  }
  if (kind === 'location') next.location = normalizePlace(text);
  if (kind === 'skills') next.skills = parseSkillList(text);
  return next;
};

/* ─── What we know about them ─────────────────────────────── */

/**
 * The coaching facts in a draft, in the shape the CareerContext record
 * takes. Only what was said: empty fields are left out so a merge never
 * blanks something the record already holds.
 */
export const careerContextOf = (draft = {}) => {
  const out = {};
  if (String(draft.target || '').trim()) out.target = draft.target;
  if (String(draft.targetWhy || '').trim()) out.targetWhy = draft.targetWhy;
  if (String(draft.targetBlocker || '').trim()) out.targetBlocker = draft.targetBlocker;
  if (draft.assessment) out.assessment = draft.assessment;
  const constraints = {};
  if (draft.location) constraints.location = draft.location;
  if (draft.workStyle) constraints.workStyle = draft.workStyle;
  if ((draft.roleTypes || []).length) constraints.roleTypes = draft.roleTypes;
  if (Object.keys(constraints).length) out.constraints = constraints;
  return out;
};

/** A saved record seeds a new conversation, so nothing it holds is asked again. */
export const seedFromCareerContext = (draft = {}, context = {}) => ({
  ...draft,
  target: draft.target || context.target || '',
  targetWhy: draft.targetWhy || context.targetWhy || '',
  targetBlocker: draft.targetBlocker || context.targetBlocker || '',
  workStyle: draft.workStyle || context.constraints?.workStyle || '',
  roleTypes: (draft.roleTypes || []).length ? draft.roleTypes : (context.constraints?.roleTypes || []),
  // Already assessed once: not re-run (it is the one paid step in here).
  assessment: draft.assessment || context.assessment || null,
});
