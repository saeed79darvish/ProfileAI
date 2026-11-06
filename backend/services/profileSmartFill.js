/**
 * Smart add for the profile editor: one free sentence in, every field of one
 * education / experience / project entry out (or a list of skills).
 *
 * The person types or dictates "UC Santa Cruz Silicon Valley software
 * engineering"; the model splits it into the fields the form already has, and
 * the page puts them in the real inputs for review. Nothing is saved here.
 *
 * The prompt is deliberately strict about invention: a field that was not said
 * (and cannot be known from a well known name) stays empty, because the person
 * reviews what is filled but rarely notices what was made up.
 */

const { parseModelJson } = require('./answerMemoryService');

const KINDS = ['education', 'experience', 'project', 'skills'];
const MIN_CHARS = 3;
const MAX_CHARS = 4000;

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];

const FIELD_LIMITS = {
  short: 160,
  experienceDescription: 2000,
  projectDescription: 1500,
  educationDescription: 1000,
};

const SCHEMAS = {
  education: `{
  "institution": "school or university name, as people write it on a resume",
  "degree": "degree or program, e.g. B.S., M.S., Bootcamp, Certificate. Empty when not stated",
  "fieldOfStudy": "major or subject, e.g. Software Engineering",
  "location": "City, State/Country. Empty unless stated or the school has one obvious campus city",
  "startDate": "YYYY-MM or YYYY, empty when not stated",
  "endDate": "YYYY-MM or YYYY, or Present when currently enrolled, empty when not stated",
  "gpa": "only when stated",
  "honors": "only when stated",
  "description": "coursework, thesis or activities, only when stated"
}`,
  experience: `{
  "company": "employer name",
  "title": "job title",
  "employmentType": "one of Full-time, Part-time, Contract, Freelance, Internship, or empty when not stated",
  "location": "City, State/Country or Remote. Empty unless stated",
  "startDate": "YYYY-MM or YYYY, empty when not stated",
  "endDate": "YYYY-MM or YYYY, or Present when the person still works there, empty when not stated",
  "description": "what they did, as short bullet lines each starting with a bullet character and a plain action verb. Only what was said",
  "skills": ["tools, languages and technologies named in the text. Never add ones that were not named"]
}`,
  project: `{
  "title": "project name",
  "role": "the person's role, only when stated",
  "description": "what it is and what they did, short bullet lines or a short paragraph. Only what was said",
  "technologies": ["tools, languages and technologies named in the text"],
  "url": "live link, only when stated",
  "githubUrl": "source code link, only when stated",
  "startDate": "YYYY-MM or YYYY, empty when not stated",
  "endDate": "YYYY-MM or YYYY, or Present when ongoing, empty when not stated"
}`,
  skills: `{
  "skills": ["each distinct skill, tool, language or technology named, properly capitalised, no duplicates"]
}`,
};

const NOUN = {
  education: 'an education entry',
  experience: 'a work experience entry',
  project: 'a project entry',
  skills: 'a list of skills',
};

function buildPrompt(kind, text, { today = new Date() } = {}) {
  const day = today.toISOString().slice(0, 10);
  return `You fill in a resume form. Someone typed or dictated a short free-form note about ${NOUN[kind]}. Split it into the form fields.

Today is ${day}. "Last year", "since March" and similar are relative to that date.

Note (it may have speech recognition mistakes in names, so fix obvious ones):
"""
${text}
"""

Return ONLY a JSON object, no prose and no code fence, in exactly this shape:
${SCHEMAS[kind]}

Rules:
- Use only what the note says. Never invent a degree level, dates, a title, metrics, tools or an employer. A field that was not said is an empty string (or an empty list).
- You may complete a well known name to its proper form ("UC Santa Cruz" to "University of California, Santa Cruz") and fill a location only when the organisation clearly has one main place.
- Dates: YYYY-MM when the month is known, YYYY when only the year is. Use "Present" for current. Never output a range inside one field.
- Plain text. No markdown, no em dashes, no arrow characters.`;
}

const clip = (value, max) => String(value == null ? '' : value)
  .replace(/[—–]/g, ' - ')
  .replace(/[←-⇿⟵-⟷]/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .trim()
  .slice(0, max);

const clipBlock = (value, max) => String(value == null ? '' : value)
  .replace(/\r/g, '')
  .replace(/[—–]/g, ' - ')
  .replace(/[←-⇿⟵-⟷]/g, ' ')
  .replace(/^[ \t]*[-*]\s+/gm, '• ')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
  .slice(0, max);

/** "YYYY-MM" or "YYYY" or "Present"; anything else (including a range) is dropped. */
function cleanDate(value) {
  const s = String(value == null ? '' : value).trim();
  if (/^(present|current|now|ongoing)$/i.test(s)) return 'Present';
  const ym = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (ym) {
    const month = Number(ym[2]);
    return month >= 1 && month <= 12 ? `${ym[1]}-${String(month).padStart(2, '0')}` : ym[1];
  }
  if (/^\d{4}$/.test(s) && Number(s) >= 1950 && Number(s) <= 2100) return s;
  return '';
}

/** A start after its own end is a mishearing; keep neither rather than a backwards range. */
function orderedDates(startDate, endDate) {
  if (startDate && endDate && endDate !== 'Present' && startDate.slice(0, 4) > endDate.slice(0, 4)) {
    return { startDate: '', endDate: '' };
  }
  return { startDate, endDate };
}

function cleanEmploymentType(value) {
  const s = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  const map = {
    fulltime: 'Full-time',
    parttime: 'Part-time',
    contract: 'Contract',
    contractor: 'Contract',
    freelance: 'Freelance',
    freelancer: 'Freelance',
    internship: 'Internship',
    intern: 'Internship',
  };
  const hit = map[s];
  return hit && EMPLOYMENT_TYPES.includes(hit) ? hit : '';
}

function cleanList(value, { max = 40, each = 60 } = {}) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const s = clip(item, each);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeItem(kind, raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (kind === 'skills') return { skills: cleanList(r.skills) };

  const dates = orderedDates(cleanDate(r.startDate), cleanDate(r.endDate));
  if (kind === 'education') {
    const fieldOfStudy = clip(r.fieldOfStudy || r.field || r.major, FIELD_LIMITS.short);
    return {
      institution: clip(r.institution || r.school, FIELD_LIMITS.short),
      degree: clip(r.degree, FIELD_LIMITS.short),
      fieldOfStudy,
      field: fieldOfStudy,
      location: clip(r.location, FIELD_LIMITS.short),
      ...dates,
      gpa: clip(r.gpa, 20),
      honors: clip(r.honors, FIELD_LIMITS.short),
      description: clipBlock(r.description, FIELD_LIMITS.educationDescription),
    };
  }
  if (kind === 'experience') {
    return {
      company: clip(r.company, FIELD_LIMITS.short),
      title: clip(r.title, FIELD_LIMITS.short),
      employmentType: cleanEmploymentType(r.employmentType),
      location: clip(r.location, FIELD_LIMITS.short),
      ...dates,
      description: clipBlock(r.description, FIELD_LIMITS.experienceDescription),
      skills: cleanList(r.skills),
    };
  }
  return {
    title: clip(r.title || r.name, FIELD_LIMITS.short),
    role: clip(r.role, FIELD_LIMITS.short),
    description: clipBlock(r.description, FIELD_LIMITS.projectDescription),
    technologies: cleanList(r.technologies),
    url: clip(r.url, 300),
    githubUrl: clip(r.githubUrl, 300),
    ...dates,
  };
}

/** True when the parse produced nothing worth putting in the form. */
function isEmptyResult(kind, item) {
  if (kind === 'skills') return !item.skills.length;
  const skip = new Set(['field']);
  return Object.entries(item).every(([key, value]) => skip.has(key)
    || (Array.isArray(value) ? value.length === 0 : !value));
}

class SmartFillError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * @param {object} args
 * @param {string} args.kind one of KINDS
 * @param {string} args.text the person's sentence or dictation
 * @param {(prompt: string, opts: object) => Promise<string>} args.generateText
 * @param {(text: string) => any} [args.repair] defaults to repairTruncatedJSON
 */
async function smartFill({ kind, text, generateText, repair, today }) {
  if (!KINDS.includes(kind)) {
    throw new SmartFillError(400, 'bad_kind', `kind must be one of ${KINDS.join(', ')}`);
  }
  const note = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
  if (note.length < MIN_CHARS) {
    throw new SmartFillError(400, 'text_required', 'Say or type a few words about it first.');
  }
  let raw;
  try {
    raw = await generateText(buildPrompt(kind, note, { today }), { maxTokens: kind === 'skills' ? 600 : 1500, temperature: 0.2 });
  } catch (err) {
    throw new SmartFillError(502, 'ai_unavailable', 'The assistant could not read that. Try again.');
  }
  const parsed = parseModelJson(raw, repair);
  const item = normalizeItem(kind, parsed);
  if (!parsed || isEmptyResult(kind, item)) {
    throw new SmartFillError(422, 'nothing_found', 'Could not find any details in that. Add a few more words.');
  }
  return { kind, item };
}

module.exports = {
  KINDS,
  EMPLOYMENT_TYPES,
  buildPrompt,
  cleanDate,
  cleanList,
  normalizeItem,
  isEmptyResult,
  smartFill,
  SmartFillError,
};
