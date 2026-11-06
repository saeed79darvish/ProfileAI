/**
 * Answer memory catalog: the single source of truth for the facts and stories
 * ProfilleAI remembers about a person so it can answer application questions
 * on their behalf. Clients fetch it from GET /api/career-context/answer-catalog
 * and never keep their own copy.
 *
 * A fact answers one kind of form question deterministically (no model).
 * A story is free text that feeds the model for open-ended questions.
 * Sensitive / demographic questions are recognised so they can be left blank.
 */

const YESNO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];

/* Order matters: the first fact whose pattern matches wins, so the narrower
   sponsorship questions come before the general work-authorization one. */
const FACTS = [
  {
    id: 'sponsorshipFuture',
    label: 'Visa sponsorship in the future',
    ask: 'Will you need a company to sponsor your work visa at some point in the future?',
    type: 'yesno',
    choices: YESNO,
    detect: [
      'in the future.{0,60}(sponsor|visa)',
      '(sponsor|visa).{0,60}in the future',
      'now or (in )?the future',
      'future.{0,40}require.{0,40}(sponsor|visa)',
    ],
  },
  {
    id: 'sponsorshipNow',
    label: 'Visa sponsorship now',
    ask: 'Do you need a company to sponsor your work visa right now?',
    type: 'yesno',
    choices: YESNO,
    detect: ['sponsor', '\\bh-?1b\\b', 'visa (status|support)'],
  },
  {
    id: 'workAuthorization',
    label: 'Work authorization',
    ask: 'Do you need a company to sponsor your work visa, now or later?',
    type: 'choice',
    choices: [
      { value: 'authorized_no_sponsorship', label: 'I can work here and will not need sponsorship' },
      { value: 'needs_sponsorship_now', label: 'I need sponsorship now' },
      { value: 'needs_sponsorship_future', label: 'I will need sponsorship later' },
    ],
    detect: [
      'authori[sz]ed to work',
      'legally authori[sz]ed',
      'work authori[sz]ation',
      'eligib\\w*.{0,30}to work',
      'right to work',
      'legally (able|permitted|entitled) to work',
    ],
  },
  {
    id: 'openToRelocation',
    label: 'Open to relocation',
    ask: 'Are you open to relocating for a job?',
    type: 'choice',
    choices: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'depends', label: 'It depends' },
    ],
    detect: ['relocat'],
  },
  {
    id: 'officeComfort',
    label: 'Working in an office',
    ask: 'How much are you willing to work in person at an office?',
    type: 'choice',
    choices: [
      { value: 'remote_only', label: 'Remote only' },
      { value: 'hybrid_ok', label: 'Hybrid is fine' },
      { value: 'onsite_ok', label: 'Fully on-site is fine' },
    ],
    detect: [
      'in[- ]person',
      'in[- ]office',
      'on-?site',
      '\\bhybrid\\b',
      '\\d+\\s*%.{0,40}(time|office|onsite|on-site|in person)',
      'work(ing)? from (the |an )?office',
    ],
  },
  {
    id: 'noticePeriod',
    label: 'Notice period',
    ask: 'How much notice do you need to give your current employer?',
    type: 'text',
    detect: ['notice period', 'how much notice'],
  },
  {
    id: 'earliestStart',
    label: 'Earliest start date',
    ask: 'When is the earliest you could start a new job?',
    type: 'text',
    detect: [
      'earliest.{0,30}start',
      'start date',
      'when (can|could|would|will) you (start|begin|join)',
      'available to (start|join|begin)',
      'availability to (start|join)',
      'when are you available',
    ],
  },
  {
    id: 'salaryExpectation',
    label: 'Salary expectation',
    ask: 'What salary or pay range are you looking for?',
    type: 'text',
    detect: [
      'salary',
      '(compensation|pay|wage) expectation',
      'expected (pay|compensation|wage)',
      'desired (pay|compensation|wage)',
      'pay range',
      'compensation (range|requirement)',
    ],
  },
  {
    id: 'willingToTravel',
    label: 'Willingness to travel',
    ask: 'How much travel for work are you comfortable with?',
    type: 'text',
    detect: ['travel'],
  },
  {
    id: 'howHeard',
    label: 'How you heard about jobs',
    ask: 'Where do you usually hear about jobs, or where did you find this one?',
    type: 'text',
    detect: [
      'how did you (hear|find|learn)',
      'where did you (hear|find|learn|see)',
      'how.{0,20}hear about',
      'referral source',
    ],
  },
];

const STORIES = [
  {
    id: 'motivation', label: 'What motivates you', ask: 'What motivates you in your work?',
    detect: ['motivat', 'why (do you want|are you interested|did you apply|are you applying)', 'why .{0,30}(this|our) (role|company|position|team)'],
  },
  {
    id: 'idealRole', label: 'Your ideal role', ask: 'What would your ideal role look like?',
    detect: ['ideal (role|job|position)', 'what are you looking for', 'looking for in (your )?next'],
  },
  {
    id: 'careerGoals', label: 'Your career goals', ask: 'Where do you want your career to go?',
    detect: ['career goal', 'long[- ]term goal', '(five|5|three|3|ten|10) years', 'where do you see yourself'],
  },
  {
    id: 'proudestAchievement', label: 'Your proudest achievement', ask: 'What is the thing at work you are proudest of?',
    detect: ['proud', 'achievement', 'accomplish'],
  },
  {
    id: 'uniqueStrength', label: 'What sets you apart', ask: 'What do you do better than most people?',
    detect: ['strength', 'sets you apart', 'what makes you (unique|different|stand out)', 'stand out', 'unique'],
  },
  {
    id: 'workStyle', label: 'How you like to work', ask: 'How do you like to work, and with whom?',
    detect: ['work(ing)? style', 'how do you (like to )?work', 'collaborat', 'values'],
  },
  {
    id: 'idealTeam', label: 'Your ideal team', ask: 'What kind of team or culture brings out your best?',
    detect: ['ideal team', 'team culture', 'company culture', 'what kind of (team|culture|environment)'],
  },
  {
    id: 'dealBreakers', label: 'Deal breakers', ask: 'Is there anything you want to avoid in your next job?',
    detect: ['deal[- ]?breaker', 'want to avoid', 'avoid in'],
  },
];

/* Questions that are never stored or auto-answered. The person fills these in. */
const SENSITIVE_DETECT = [
  '\\bgender\\b', '\\bsex\\b', 'pronoun', 'transgender',
  '\\brace\\b', 'racial', 'ethnic', 'hispanic', 'latin[oax]',
  '\\bveteran', 'military (status|service)', 'protected veteran',
  'disabilit', 'disabled', 'chronic condition',
  '\\bage\\b', 'years old', 'date of birth', 'birth ?date', '\\bdob\\b',
  'religio', 'sexual orientation', 'lgbt',
  'criminal', 'convict', 'felony', 'arrest',
  'marital', 'pregnan', 'citizenship status of your parents',
];

const compile = (sources) => sources.map((s) => new RegExp(s, 'i'));
const FACT_RE = FACTS.map((f) => ({ id: f.id, res: compile(f.detect) }));
const STORY_RE = STORIES.map((s) => ({ id: s.id, res: compile(s.detect) }));
const SENSITIVE_RE = compile(SENSITIVE_DETECT);

const factById = (id) => FACTS.find((f) => f.id === id) || null;
const storyById = (id) => STORIES.find((s) => s.id === id) || null;

/** What GET /answer-catalog returns. Story detect patterns stay server side. */
const publicCatalog = () => ({
  facts: FACTS.map((f) => ({
    id: f.id, label: f.label, ask: f.ask, type: f.type,
    ...(f.choices ? { choices: f.choices } : {}),
    detect: f.detect,
  })),
  stories: STORIES.map(({ id, label, ask }) => ({ id, label, ask })),
});

/**
 * Which fact a form question is asking for.
 * @returns {string|{sensitive:true}|null} a fact id, {sensitive:true}, or null
 */
function detectFact(questionText) {
  const q = String(questionText || '');
  if (!q.trim()) return null;
  if (SENSITIVE_RE.some((re) => re.test(q))) return { sensitive: true };
  for (const f of FACT_RE) if (f.res.some((re) => re.test(q))) return f.id;
  return null;
}

/** Which story an open-ended question draws on, or null. */
function detectStory(questionText) {
  const q = String(questionText || '');
  for (const s of STORY_RE) if (s.res.some((re) => re.test(q))) return s.id;
  return null;
}

/* ---------- facts to option text ---------- */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9%+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const optText = (o) => (typeof o === 'string' ? o : (o && (o.text || o.label || o.value)) || '');
const factValueOf = (v) => (v && typeof v === 'object' ? String(v.value ?? '') : String(v ?? ''));

const NEG_RE = /\b(not|no|never|without|don t|do not|won t|will not|cannot|can t|none)\b/;

/** 'yes' | 'no' | null for an option's meaning as an answer. */
function polarity(option) {
  const n = norm(option);
  if (!n) return null;
  if (/^(yes|y|sure|i do|i am|i will|i can|i would)\b/.test(n) && !NEG_RE.test(n.replace(/^yes\b/, ''))) return 'yes';
  if (/^(no|n|nope)\b/.test(n)) return 'no';
  if (/prefer not|decline|rather not|not (say|disclose)/.test(n)) return null;
  if (NEG_RE.test(n)) return 'no';
  if (/\b(require|need|authori[sz]ed|eligible|willing|open|comfortable|able|yes)\b/.test(n)) return 'yes';
  return null;
}

const pickByPolarity = (options, want) => {
  const matches = options.filter((o) => polarity(optText(o)) === want);
  if (!matches.length) return null;
  // Prefer the bare "Yes"/"No" when a form offers both a bare and a sentence option.
  const bare = matches.find((o) => /^(yes|no)$/.test(norm(optText(o))));
  return optText(bare || matches[0]);
};

const pickByText = (options, value) => {
  const v = norm(value);
  if (!v) return null;
  const list = options.map((o) => ({ o: optText(o), n: norm(optText(o)) })).filter((x) => x.n);
  const exact = list.find((x) => x.n === v);
  if (exact) return exact.o;
  const part = list.find((x) => x.n.length >= 3 && (x.n.includes(v) || v.includes(x.n)));
  return part ? part.o : null;
};

const pickOther = (options) => {
  const other = options.find((o) => /^other\b/.test(norm(optText(o))));
  return other ? optText(other) : null;
};

/* How much in-person time a question asks for: 'onsite' (most of the week),
   'hybrid' (some of it), 'any'. */
function officeDemand(questionText) {
  const q = String(questionText || '').toLowerCase();
  const pct = q.match(/(\d{1,3})\s*%/);
  if (pct) return Number(pct[1]) >= 80 ? 'onsite' : 'hybrid';
  if (/(four|five|4|5) days|full[- ]time (in|at)|100%|every day|fully (on-?site|in[- ]office)/.test(q)) return 'onsite';
  if (/hybrid|days a week|days per week|two|three|2|3|occasional|some/.test(q)) return 'hybrid';
  return 'hybrid';
}

/**
 * Closest option text for a stored fact, or null when no option fits.
 * Deterministic: no model, no guessing.
 *
 * @param {string} factId
 * @param {string|{value:string}} factValue
 * @param {Array<string|{text:string}>} options
 * @param {string} [questionText] sharpens officeComfort ("25% of the time")
 */
function mapFactToOption(factId, factValue, options, questionText = '') {
  const opts = (Array.isArray(options) ? options : []).filter((o) => optText(o).trim());
  const value = factValueOf(factValue).trim();
  if (!opts.length || !value) return null;

  switch (factId) {
    case 'sponsorshipNow':
    case 'sponsorshipFuture': {
      if (value !== 'yes' && value !== 'no') return null;
      return pickByPolarity(opts, value);
    }
    case 'workAuthorization': {
      // The form asks "are you authorized to work here?" Only a clear yes is known.
      if (value !== 'authorized_no_sponsorship') return null;
      const sentence = opts.find((o) => /authori[sz]ed|eligible|citizen|permanent resident/.test(norm(optText(o))) && !/\b(not|no)\b/.test(norm(optText(o)).replace(/without|no sponsor/g, '')));
      return pickByPolarity(opts, 'yes') || (sentence ? optText(sentence) : null);
    }
    case 'openToRelocation': {
      if (value === 'yes' || value === 'no') return pickByPolarity(opts, value);
      return null; // "depends" is the person's call per job
    }
    case 'officeComfort': {
      const named = (re) => opts.find((o) => re.test(norm(optText(o))));
      const hasNamed = named(/\b(remote|hybrid|on ?site|in office)\b/);
      if (hasNamed && !pickByPolarity(opts, 'yes') && !pickByPolarity(opts, 'no')) {
        const hit = value === 'remote_only' ? named(/\bremote\b/)
          : value === 'hybrid_ok' ? named(/\bhybrid\b/)
            : named(/\b(on ?site|in office)\b/);
        return hit ? optText(hit) : null;
      }
      const demand = officeDemand(questionText);
      if (value === 'remote_only') return pickByPolarity(opts, 'no');
      if (value === 'onsite_ok') return pickByPolarity(opts, 'yes');
      if (value === 'hybrid_ok') return demand === 'onsite' ? null : pickByPolarity(opts, 'yes');
      return null;
    }
    case 'willingToTravel': {
      const n = norm(value);
      if (/^(yes|sure|happy|ok|okay)\b/.test(n)) { const y = pickByPolarity(opts, 'yes'); if (y) return y; }
      if (/^(no|none|never)\b/.test(n) || /no travel/.test(n)) { const x = pickByPolarity(opts, 'no'); if (x) return x; }
      return pickByText(opts, value);
    }
    case 'howHeard':
      return pickByText(opts, value) || pickOther(opts);
    case 'noticePeriod':
    case 'earliestStart':
    case 'salaryExpectation':
      return pickByText(opts, value);
    default:
      return null;
  }
}

/** The text to put in a free-text field for a stored fact, or '' when none. */
function factToText(factId, factValue, note = '') {
  const value = factValueOf(factValue).trim();
  if (!value) return '';
  const fact = factById(factId);
  if (!fact) return '';
  if (factId === 'workAuthorization') return value === 'authorized_no_sponsorship' ? 'Yes' : '';
  if (fact.type === 'yesno') return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : '';
  if (fact.type === 'choice') {
    const choice = fact.choices.find((c) => c.value === value);
    if (!choice) return '';
    if (value === 'depends' && note) return String(note).trim();
    return choice.label;
  }
  return value;
}

/**
 * Every fact we can state from what the person told us, including the ones
 * implied by work authorization. Returns { [factId]: { value, note?, derived? } }.
 * @param {{answerFacts?: object}} memory
 */
function deriveFacts(memory) {
  const stored = (memory && memory.answerFacts) || {};
  const out = {};
  for (const [id, entry] of Object.entries(stored)) {
    const value = factValueOf(entry).trim();
    if (value) out[id] = { value, ...(entry && entry.note ? { note: entry.note } : {}) };
  }
  const auth = out.workAuthorization && out.workAuthorization.value;
  const implied = {
    authorized_no_sponsorship: { sponsorshipNow: 'no', sponsorshipFuture: 'no' },
    needs_sponsorship_now: { sponsorshipNow: 'yes', sponsorshipFuture: 'yes' },
    needs_sponsorship_future: { sponsorshipNow: 'no', sponsorshipFuture: 'yes' },
  }[auth];
  if (implied) {
    for (const [id, value] of Object.entries(implied)) {
      if (!out[id]) out[id] = { value, derived: true };
    }
  }
  return out;
}

/** Fact shape the client shows when it must ask the person. */
const needsFactOf = (factId) => {
  const f = factById(factId);
  if (!f) return null;
  return { id: f.id, label: f.label, ask: f.ask, type: f.type, ...(f.choices ? { choices: f.choices } : {}) };
};

module.exports = {
  FACTS, STORIES, publicCatalog, factById, storyById,
  detectFact, detectStory, mapFactToOption, polarityOf: polarity, factToText, deriveFacts, needsFactOf,
};
