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
import { normalizeEducationRows } from '../../utils/education.js';
// The same formatter ProfileForm, the dashboard and the public profile use, so
// a date reads identically wherever the person sees it.
import { formatDateRange } from '../../utils/dateRange.js';

const norm = (s) => String(s || '').toLowerCase().trim();

export const LIMITS = {
  SKILL_CHIPS: 24,
  TITLE_CHIPS: 8,
  MAX_ANSWER_CHARS: 2000,
};

/* ─── Chip sets the ladder refers to by name ──────────────────── */

export const SENIORITY_LEVELS = [
  { id: 'ic', label: 'Individual Contributor' },
  { id: 'lead', label: 'Team Lead' },
  { id: 'manager', label: 'Manager' },
  { id: 'director', label: 'Director' },
  { id: 'head', label: 'Head of Department' },
  { id: 'consultant', label: 'Consultant' },
];

export const WORK_STYLES = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On-site' },
  // "I don't mind" is a real answer, and forcing a preference someone does
  // not have narrows their job matches for no reason.
  { id: 'flexible', label: 'Flexible' },
];

export const IMPORT_CHOICES = [
  { id: 'resume', label: 'Upload my resume' },
  { id: 'linkedin', label: 'Import from LinkedIn' },
  { id: 'chat', label: 'Keep chatting' },
];

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
  {
    id: 'sector',
    question: "Let's start broad — which field are you in?",
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
    question: 'Got it. What do you actually do day to day?',
    hint: 'This becomes your profile headline, so pick the closest match.',
    kind: 'chips',
    chipSet: 'levels',
    freeText: true,
    aiStep: null,
    assign: 'level',
  },
  {
    id: 'title',
    question: "And what's your job title?",
    hint: 'Pick the closest one or type your own — this is what recruiters search.',
    kind: 'chips',
    chipSet: 'titles',
    freeText: true,
    // A typed job title is already the answer. No model needed, which also
    // means a guest can get this far without hitting the sign-up prompt.
    aiStep: null,
    assign: 'title',
  },
  {
    id: 'importOffer',
    question: 'Quick shortcut before we go on — do you have a resume or a LinkedIn profile?',
    hint: 'I can fill in most of the rest from either one. Or we just keep talking.',
    kind: 'branch',
    chipSet: 'importChoices',
    freeText: false,
    aiStep: null,
    assign: null,
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
    question: 'Remote, hybrid, or on-site?',
    hint: 'Pick Flexible if you are open to any of them.',
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
    question: 'Tell me about your most recent role — where was it, and when?',
    hint: 'Something like "Product manager at Acme, 2022 to now" is plenty.',
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
    question: 'What did you actually do there?',
    hint: "Just talk normally — I'll turn it into resume bullets.",
    kind: 'text',
    chipSet: null,
    freeText: true,
    aiStep: 'bullets',
    assign: null,
    skipIf: 'noWorkHistory',
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
    question: 'How about education — degree, bootcamp, certificates?',
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
    question: 'Last one — where are you based?',
    hint: 'City and country is enough.',
    kind: 'text',
    chipSet: null,
    freeText: true,
    aiStep: 'location',
    assign: null,
    optional: true,
  },
  {
    id: 'target',
    question: 'Now the part that actually matters — what are you aiming for next?',
    hint: 'Pick the closest, or tell me in your own words. I will tell you honestly how far it is.',
    kind: 'chips',
    chipSet: 'targets',
    freeText: true,
    // Whatever they type IS the target; no extraction needed.
    aiStep: null,
    assign: 'target',
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
  phone: '',
  // Set when a resume or LinkedIn import seeded the draft — the coach then
  // asks only about what the import left empty.
  importedFrom: null,
  // What they want next, and the coach's read on how far away it is.
  target: '',
  assessment: null,
  review: null,
});

/* ─── Chips ──────────────────────────────────────────────────── */

/**
 * Resolve a step's `chipSet` name into actual chips. Dynamic sets depend on
 * the sector chosen earlier; an unknown sector falls back to the union list
 * so the person is never shown an empty chip row.
 *
 * @returns {{id: string, label: string}[]}
 */
export const getChips = (step, draft = {}) => {
  if (!step || !step.chipSet) return [];
  switch (step.chipSet) {
    case 'sectors':
      return JOB_SECTORS.map((s) => ({ id: s.id, label: s.label }));
    case 'levels':
      return SENIORITY_LEVELS.map((l) => ({ id: l.id, label: l.label }));
    case 'titles': {
      const titles = SECTOR_TITLES[draft.sector] || [];
      return titles.slice(0, LIMITS.TITLE_CHIPS).map((t) => ({ id: t, label: t }));
    }
    case 'employmentTypes':
      return EMPLOYMENT_TYPES.map((t) => ({ id: t.id, label: t.label }));
    case 'workStyles':
      return WORK_STYLES.map((w) => ({ id: w.id, label: w.label }));
    case 'careerStages':
      return CAREER_STAGES.map((c) => ({ id: c.id, label: c.label }));
    case 'skills': {
      const map = SECTOR_SKILLS[draft.sector] || ALL_SKILLS;
      const flat = Object.values(map).flat();
      // De-dupe: several sectors list the same skill under two headings.
      return Array.from(new Set(flat))
        .slice(0, LIMITS.SKILL_CHIPS)
        .map((s) => ({ id: s, label: s }));
    }
    case 'targets': {
      // Their own sector's titles, minus the one they already hold — offering
      // someone their current job as a target reads as not having listened.
      const titles = (SECTOR_TITLES[draft.sector] || []).filter(
        (t) => norm(t) !== norm(draft.title)
      );
      return titles.slice(0, LIMITS.TITLE_CHIPS).map((t) => ({ id: t, label: t }));
    }
    case 'importChoices':
      return IMPORT_CHOICES.map((c) => ({ id: c.id, label: c.label }));
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
export const matchSector = (text) => {
  const t = norm(text);
  if (!t) return null;

  for (const sector of JOB_SECTORS) {
    // "Tech & Engineering" → ["tech", "engineering"]
    const words = sector.label.split('&').map((w) => norm(w)).filter(Boolean);
    if (words.some((w) => w.length > 2 && t.includes(w))) return { sector: sector.id };
  }

  for (const [sectorId, titles] of Object.entries(SECTOR_TITLES)) {
    const hit = titles.find((title) => t.includes(norm(title)));
    if (hit) return { sector: sectorId, title: hit };
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
export const needsAI = (step, text, draft = {}) => {
  if (!step || !step.aiStep) return false;
  const typed = String(text || '').trim();
  if (!typed) return false;

  if (step.id === 'sector') return !matchSector(typed);
  if (step.id === 'skills') return parseSkillList(typed).length === 0;

  const chips = getChips(step, draft);
  if (chips.length && matchChip(typed, chips)) return false;

  return true;
};

/* ─── Ladder navigation ──────────────────────────────────────── */

const SKIP_PREDICATES = {
  // Students, new grads and self-taught changers may have no employer to
  // name. The editor still lets them add one later.
  noWorkHistory: (draft) =>
    draft.careerStage === 'new_grad' || draft.careerStage === 'student',
  // Nothing was imported, so there is no document to react to.
  noImport: (draft) => !draft.importedFrom,
  // They skipped the target question; assessing an unstated goal would mean
  // inventing one for them.
  noTarget: (draft) => !String(draft.target || '').trim(),
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
export const nextStepIndex = (fromIndex, draft = {}) => {
  for (let i = fromIndex + 1; i < LADDER.length; i += 1) {
    const step = LADDER[i];
    if (shouldSkip(step, draft)) continue;
    if (isAlreadyAnswered(step, draft)) continue;
    return i;
  }
  return -1;
};

/**
 * True when an import already filled what this step asks for. Re-asking a
 * question the uploaded resume just answered is the fastest way to make an
 * import feel pointless, so the coach jumps over those.
 */
export const isAlreadyAnswered = (step, draft = {}) => {
  if (!draft.importedFrom) return false;
  switch (step.id) {
    case 'title':
      return !!draft.title;
    case 'currentRole':
    case 'achievements':
      return Array.isArray(draft.experience) && draft.experience.length > 0;
    case 'skills':
      return Array.isArray(draft.skills) && draft.skills.length > 0;
    case 'education':
      return Array.isArray(draft.education) && draft.education.length > 0;
    case 'location':
      return !!draft.location;
    // The import can't know what someone WANTS next — always still asked.
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
export const mergeInterpreted = (draft, stepId, fields = {}, { intoLatest = false } = {}) => {
  const next = { ...draft };
  switch (stepId) {
    case 'currentRole': {
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
    case 'probe': {
      const newBullets = (fields.bullets || []).filter(Boolean);
      if (newBullets.length && (draft.experience || []).length) {
        const [head, ...rest] = draft.experience;
        const existing = String(head.description || '').trim();
        const added = newBullets.map((b) => `• ${b}`).join('\n');
        next.experience = [{ ...head, description: existing ? `${existing}\n${added}` : added }, ...rest];
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
      if (fields.location) next.location = fields.location;
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

  const education = (draft.education || []).filter((e) => e && (e.institution || e.degree));
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
  const level = SENIORITY_LEVELS.find((l) => l.id === draft.level);
  if (!level) return title;
  // Only prefix ranks that read naturally in front of a title. "Individual
  // Contributor Frontend Developer" is not a job anyone has.
  const PREFIXABLE = { lead: 'Lead', manager: 'Manager', director: 'Director' };
  const prefix = PREFIXABLE[level.id];
  if (!prefix) return title;
  if (norm(title).includes(norm(prefix))) return title;
  // "Manager" and "Director" read better appended than prefixed.
  return prefix === 'Lead' ? `${prefix} ${title}` : `${title} (${prefix})`;
};

/**
 * Map the conversation draft into the `resumeData` shape ProfileForm reads
 * from `location.state`. Reuses the wizard's row mappers so the coach
 * inherits the fixes made there (the "Present" sentinel, project URL
 * routing) instead of re-earning those bugs.
 */
export const draftToResumeData = (draft = {}) => ({
  title: buildTitle(draft),
  location: draft.location || '',
  phone: draft.phone || '',
  linkedinUrl: draft.linkedinUrl || '',
  githubUrl: draft.githubUrl || '',
  summary: draft.summary || '',
  // Flat array — ProfileForm categorises it on the way in.
  skills: draft.skills || [],
  experience: (draft.experience || []).map((row) =>
    mapWizardExperienceToEditor(row, {
      employmentTypes: draft.roleTypes || [],
      careerStage: draft.careerStage || '',
    })
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
  experience: draft.experience || [],
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
export const panelState = (draft = {}, rubricItems = []) => {
  const byKey = Object.fromEntries(rubricItems.map((i) => [i.key, i.done]));
  return {
    title: !!byKey.title,
    lookingFor: !!(draft.roleTypes || []).length || !!draft.workStyle,
    skills: !!byKey.skills,
    exp: !!byKey.exp,
    edu: !!byKey.edu,
  };
};
