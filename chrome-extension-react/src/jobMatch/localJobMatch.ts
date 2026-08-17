/**
 * On-device job match scoring.
 *
 * This replaces the /profiles/job-match AI call for the extension's match card.
 * The score is instant, costs no AI run, and can't fail on a quota or a network
 * blip — but only because it does the same three jobs the model was doing,
 * rather than falling back to vocabulary overlap:
 *
 *   1. READ the posting into discrete requirements, each with a hardness
 *      (required vs preferred) and a type (skill, years, degree, duty…).
 *   2. LOOK for evidence of each one in the profile, and grade how good that
 *      evidence is — a skill named in a current role is not the same claim as
 *      one sitting in a skills list.
 *   3. JUDGE the fit dimensions: is this even the same kind of job, does the
 *      candidate's experience clear the stated bar, is the match current.
 *
 * The arithmetic in `scoreLocalMatch` is a deliberate mirror of the server's
 * services/resume/jobMatchScore.js — same weights, same coverage credit, same
 * blocker cap, same projection rule. The two must stay in step: a user who sees
 * 71% here and 84% on the web would rightly conclude one of them is made up.
 *
 * Where this is weaker than the model, and knowingly so:
 *   - Requirement extraction is structural. A posting written as one long
 *     paragraph with no headings and no bullets yields little, and the caller
 *     is told (`unscorable`) rather than handed a number built from nothing.
 *   - Evidence matching is lexical. It reads "React" in a role description as
 *     evidence for React; it cannot tell that "rebuilt our component library"
 *     evidences design systems.
 *   - Role fit comes from job titles and, failing that, from how much of the
 *     posting's stack the candidate actually has.
 */

export type Hardness = 'must' | 'nice';
export type Coverage = 'strong' | 'partial' | 'none';
export type RequirementType =
  | 'skill'
  | 'experience_years'
  | 'credential'
  | 'education'
  | 'title'
  | 'domain'
  | 'soft'
  | 'responsibility';

export interface LocalRequirement {
  requirement: string;
  type: RequirementType;
  hardness: Hardness;
  coverage: Coverage;
  evidence: string;
  hasRelatedEvidence: boolean;
  whyBlocking?: string;
}

/** The vocabulary and matching rules, supplied by the caller so the job-page
 *  scan and this scorer can never drift onto two different keyword lists. */
export interface Vocabulary {
  /** Every spelling, including aliases — `canonical` collapses them, so both
   *  sides of a comparison land on the same term without a separate lookup. */
  keywords: readonly string[];
  canonical: (kw: string) => string;
  contains: (text: string, kw: string) => boolean;
}

export interface LocalMatchInput {
  jobDescription: string;
  jobTitle?: string;
  profile: any;
  vocab: Vocabulary;
}

// --- 1. reading the posting -------------------------------------------------

type SectionKind = 'must' | 'nice' | 'duty' | 'ignore' | 'unknown';

/**
 * Headings postings actually use. Order matters where they overlap: "Preferred
 * Qualifications" has to be read as preferred, not as a requirements section,
 * so the nice patterns are tested first.
 */
const HEADINGS: Array<{ kind: SectionKind; re: RegExp }> = [
  {
    kind: 'ignore',
    re: /\b(benefits?|perks?|compensation|salary|pay range|equal opportunity|eeo|e\.e\.o|about (?:us|the company|our)|our (?:mission|values|culture|team)|why (?:join|work)|how to apply|application process|interview process|what we offer|diversity)\b/i,
  },
  {
    kind: 'nice',
    re: /\b(preferred|nice[-\s]to[-\s]have|bonus|pluses|a plus|desirable|desired|good to have|extra credit|additional qualifications|even better|stand ?out)\b/i,
  },
  {
    kind: 'must',
    re: /\b(requirements?|qualifications?|basic qualifications|minimum qualifications|must[-\s]haves?|what you(?:'|’)?ll need|what we(?:'|’)?re looking for|who you are|skills? (?:&|and) experience|your (?:background|experience)|you (?:have|bring))\b/i,
  },
  {
    kind: 'duty',
    re: /\b(responsibilities|what you(?:'|’)?ll (?:do|be doing)|day[-\s]to[-\s]day|your impact|in this role|the opportunity|scope)\b/i,
  },
];

/**
 * "About the job" is LinkedIn's own label for the whole description, and
 * "About the role" is how most postings open. Treating them as a duties
 * heading put every line that followed into duty mode — which is to say, at
 * zero weight — so a posting that never wrote a literal "Requirements:"
 * heading had nothing left to score and came back unscorable. They name the
 * document, not a section, so they set no section at all.
 */
const PREAMBLE_HEADING = /^\s*about\s+(?:the\s+)?(?:job|role|position|opportunity)\b/i;

const BULLET = /^[\s]*(?:[•·▪‣◦*\-–—]|\(?\d{1,2}[.)])\s+/;

/**
 * A heading is a short line that names a section — with or without the colon,
 * because plenty of postings style them as bold text with no punctuation.
 */
function headingKind(line: string): SectionKind | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 70) return null;
  if (BULLET.test(line)) return null;
  // A line ending in a colon, or a short line of few words, is heading-shaped.
  const looksLikeHeading = /:\s*$/.test(trimmed) || trimmed.split(/\s+/).length <= 7;
  if (!looksLikeHeading) return null;
  // Checked before the section patterns: a preamble must not be mistaken for
  // the duties section it usually sits above.
  if (PREAMBLE_HEADING.test(trimmed)) return null;
  for (const { kind, re } of HEADINGS) {
    if (re.test(trimmed)) return kind;
  }
  return null;
}

/** Inline cues that override an ambiguous section. */
const NICE_CUE = /\b(preferred|nice to have|a plus|bonus|ideally|desirable|would be great|not required)\b/i;
const MUST_CUE = /\b(must have|required|require[sd]?|essential|minimum|at least|\d+\+?\s*years?)\b/i;
const REQUIREMENT_CUE =
  /\b(experience|proficien\w+|expertise|knowledge|familiar\w*|background|degree|certif\w+|years?|ability to|skilled|strong|demonstrated|proven|track record|fluent)\b/i;

/**
 * Phrasing that asks something of the candidate rather than describing the
 * work. Deliberately narrower than REQUIREMENT_CUE: that one matches bare
 * "strong" and "ability to", which a duty line ("Drive strong collaboration")
 * hits just as easily. These forms only appear when a posting is stating what
 * it wants you to already have.
 */
const ASK_PHRASING =
  /\b(?:experience\s+(?:with|in|of|building|working)|proficien\w+\s+(?:with|in)|expertise\s+in|(?:deep|solid|strong|working)\s+(?:knowledge|understanding|grasp)\s+of|knowledge\s+of|familiar\w*\s+with|background\s+in|comfortable\s+with|fluent\s+in|hands[-\s]on\s+with|must\s+have|required|you\s+(?:have|bring|know)|we(?:'|’)?re\s+looking\s+for)\b/i;

/** Bare imperatives — how a duty reads when it isn't under a duties heading. */
const DUTY_OPENER =
  /^(participate|attend|collaborate|partner|mentor|coach|contribute|help|support|assist|coordinate|communicate|engage|join|liaise|represent|advocate|champion|foster|drive|own|lead|manage|maintain|monitor|respond|triage|review|report|present|document|iterate|ship|deliver|work)\b/i;

const MAX_LABEL = 72;

/** Trims a bullet down to something that fits a card without losing the point. */
function toLabel(raw: string): string {
  let text = raw.replace(BULLET, '').trim();
  text = text.replace(/\s+/g, ' ');
  // Postings love "Experience with X, including a, b and c" — the clause after
  // the first comma is nearly always elaboration.
  if (text.length > MAX_LABEL) {
    const cut = text.slice(0, MAX_LABEL);
    const lastBreak = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf(' — '), cut.lastIndexOf('; '));
    text = (lastBreak > 28 ? cut.slice(0, lastBreak) : cut).trim();
  }
  text = text.replace(/[.,;:]+$/, '').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface RawLine {
  text: string;
  section: SectionKind;
}

/**
 * Walks the posting and collects the lines that state something checkable.
 *
 * Bullets are trusted; unbulleted prose has to carry a requirement cue to be
 * picked up, because otherwise every sentence of company blurb becomes a
 * requirement the candidate is then judged against.
 */
function collectLines(jobDescription: string): RawLine[] {
  const lines = jobDescription.split(/\r?\n/);
  const out: RawLine[] = [];
  let section: SectionKind = 'unknown';

  for (const line of lines) {
    const kind = headingKind(line);
    if (kind) {
      section = kind;
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 12) continue;
    if (section === 'ignore') continue;

    const bulleted = BULLET.test(line);
    if (!bulleted && !REQUIREMENT_CUE.test(trimmed)) continue;
    // A wall of prose isn't a requirement even when it mentions "experience".
    if (!bulleted && trimmed.length > 220) continue;

    // Long bullets sometimes pack two requirements behind a semicolon.
    const parts = bulleted && trimmed.includes('; ') ? trimmed.split('; ') : [trimmed];
    for (const part of parts) {
      const label = toLabel(part);
      if (label.length < 8) continue;
      out.push({ text: label, section });
    }
  }
  return out;
}

// --- 2. classifying what each line is ---------------------------------------

const YEARS_RE = /(\d{1,2})\s*(?:\+|-|–|to)?\s*(\d{1,2})?\s*\+?\s*years?/i;
const DEGREE_RE = /\b(bachelor'?s?|master'?s?|ba|bs|b\.s|m\.s|ms|mba|phd|ph\.d|doctorate|degree|diploma)\b/i;
const CREDENTIAL_RE = /\b(certif\w+|licen[cs]\w+|clearance|accredit\w+|pmp|cpa|cissp|cfa|scrum master)\b/i;
const TITLE_RE = /\b(?:experience|worked|working|has been)\s+(?:as|in the role of)\s+an?\s+([a-z\s]{3,30})/i;
const SOFT_RE =
  /\b(communicat\w+|collaborat\w+|teamwork|team player|interpersonal|ownership|self[-\s]starter|detail[-\s]oriented|attention to detail|problem[-\s]solv\w+|critical thinking|adaptab\w+|curious|curiosity|passion\w*|proactive|autonom\w+|organiz\w+ skills|time management|written and verbal|stakeholder management)\b/i;
const DOMAIN_RE =
  /\b(fintech|financial services|healthcare|health tech|insurtech|e[-\s]?commerce|retail|saas|b2b|b2c|marketplace|gaming|edtech|adtech|logistics|supply chain|telecom|automotive|aerospace|biotech|pharma|govern\w+|public sector|non[-\s]?profit|media|travel|real estate|cyber\s?security)\b/i;

function classifyType(text: string, section: SectionKind): RequirementType {
  if (YEARS_RE.test(text) && /\byears?\b/i.test(text)) return 'experience_years';
  if (DEGREE_RE.test(text)) return 'education';
  if (CREDENTIAL_RE.test(text)) return 'credential';
  if (TITLE_RE.test(text)) return 'title';
  // A duties heading is authoritative for lines that read like duties; outside
  // one, a bare imperative is the tell ("Participate in on-call rotations" vs
  // "Experience with on-call"). But plenty of postings list what they want
  // from you underneath a duties heading, and "Experience with Kubernetes" is
  // a requirement wherever it appears — so explicit requirement phrasing
  // outranks the section it sits in.
  if (!ASK_PHRASING.test(text) && (section === 'duty' || (section === 'unknown' && DUTY_OPENER.test(text)))) {
    return 'responsibility';
  }
  if (DOMAIN_RE.test(text)) return 'domain';
  if (SOFT_RE.test(text)) return 'soft';
  return 'skill';
}

/** Types that are a requirement by their nature, heading or no heading. */
const HARD_BY_NATURE = new Set<RequirementType>([
  'experience_years',
  'education',
  'credential',
  'title',
]);

function classifyHardness(text: string, section: SectionKind, type: RequirementType): Hardness {
  if (NICE_CUE.test(text)) return 'nice';
  if (section === 'nice') return 'nice';
  if (section === 'must') return 'must';
  if (MUST_CUE.test(text)) return 'must';
  // Duties are excluded from the score anyway; bucket them as must so they
  // still appear in the read of the posting.
  if (section === 'duty') return 'must';
  // No heading to go on. A line that asks for something outright, or that is a
  // requirement by nature (years, a degree, a licence), is a requirement — the
  // company simply didn't write "Requirements:" above it. Defaulting these to
  // "nice" scored an unheaded posting 89% where the identical bullets under a
  // heading scored 49%.
  return ASK_PHRASING.test(text) || HARD_BY_NATURE.has(type) ? 'must' : 'nice';
}

// --- 3. the profile side ----------------------------------------------------

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
/** A role this recent counts as current practice. */
const RECENT_YEARS = 4;

interface ProfileIndex {
  /** Canonical terms explicitly claimed in the skills list. */
  skillTerms: Set<string>;
  /** Canonical terms demonstrated in a current or recent role. */
  recentTerms: Set<string>;
  /** Canonical terms only found in roles that ended a while ago. */
  datedTerms: Set<string>;
  /** Where a term was found, for the evidence citation. */
  sources: Map<string, string>;
  titles: string[];
  years: number | null;
  allText: string;
  education: string;
}

function roleText(role: any): string {
  return [
    role?.title || role?.position || '',
    role?.company || '',
    role?.description || '',
    ...(Array.isArray(role?.achievements) ? role.achievements : []),
    ...(Array.isArray(role?.skills)
      ? role.skills.map((s: any) => (typeof s === 'string' ? s : s?.name || ''))
      : []),
  ]
    .join(' ')
    .toLowerCase();
}

function isRecent(role: any): boolean {
  if (role?.current) return true;
  const end = Date.parse(role?.endDate || '');
  if (!Number.isFinite(end)) return true; // no end date reads as ongoing
  return Date.now() - end < RECENT_YEARS * MS_PER_YEAR;
}

/**
 * Total years of experience from the profile's own dates, merging overlapping
 * roles. The naive sum counts a contract held alongside a staff job twice, and
 * two years of double-counting moves someone a whole seniority band.
 */
function candidateYears(experience: any[]): number | null {
  if (!Array.isArray(experience) || experience.length === 0) return null;
  const now = Date.now();
  const spans: Array<[number, number]> = [];
  for (const role of experience) {
    const start = Date.parse(role?.startDate || '');
    if (!Number.isFinite(start)) continue;
    const rawEnd = role?.current ? now : Date.parse(role?.endDate || '');
    const end = Number.isFinite(rawEnd) ? Math.min(rawEnd, now) : now;
    if (end > start) spans.push([start, end]);
  }
  if (spans.length === 0) return null;
  spans.sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let cursor = spans[0][0];
  for (const [start, end] of spans) {
    const from = Math.max(start, cursor);
    if (end > from) {
      covered += end - from;
      cursor = end;
    }
  }
  return covered / MS_PER_YEAR;
}

function indexProfile(profile: any, vocab: Vocabulary, flatSkills: string[]): ProfileIndex {
  const skillTerms = new Set<string>();
  const recentTerms = new Set<string>();
  const datedTerms = new Set<string>();
  const sources = new Map<string, string>();

  const skillBlob = flatSkills.join(' | ');
  for (const keyword of vocab.keywords) {
    if (vocab.contains(skillBlob, keyword)) {
      const canonical = vocab.canonical(keyword);
      skillTerms.add(canonical);
      if (!sources.has(canonical)) sources.set(canonical, 'your skills list');
    }
  }

  const experience = Array.isArray(profile?.experience) ? profile.experience : [];
  experience.forEach((role: any, i: number) => {
    const text = roleText(role);
    const recent = isRecent(role);
    const where = `[${i + 1}] ${role?.title || role?.position || 'Role'}${role?.company ? ` at ${role.company}` : ''}`;
    for (const keyword of vocab.keywords) {
      // Two-letter terms ("ai", "go", "ux") hit far too easily inside prose
      // like "go-to-market", so only an explicit skills entry claims them.
      if (keyword.length <= 2) continue;
      if (!vocab.contains(text, keyword)) continue;
      const canonical = vocab.canonical(keyword);
      (recent ? recentTerms : datedTerms).add(canonical);
      // A recent role is the better citation, so it wins over a dated one.
      if (recent || !sources.has(canonical)) sources.set(canonical, where);
    }
  });

  const titles = [
    profile?.title || profile?.headline || '',
    ...experience.map((r: any) => r?.title || r?.position || ''),
  ]
    .filter(Boolean)
    .map((t: string) => t.toLowerCase());

  const education = (Array.isArray(profile?.education) ? profile.education : [])
    .map((e: any) => [e?.degree, e?.field, e?.school].filter(Boolean).join(' '))
    .join(' | ')
    .toLowerCase();

  const allText = [
    profile?.summary || '',
    skillBlob,
    education,
    ...(Array.isArray(profile?.certifications)
      ? profile.certifications.map((c: any) => (typeof c === 'string' ? c : c?.name || ''))
      : []),
    ...experience.map(roleText),
    ...(Array.isArray(profile?.projects)
      ? profile.projects.map((p: any) => `${p?.title || ''} ${p?.description || ''}`)
      : []),
  ]
    .join(' \n ')
    .toLowerCase();

  return {
    skillTerms,
    recentTerms,
    datedTerms,
    sources,
    titles,
    years: candidateYears(experience),
    allText,
    education,
  };
}

// --- 4. evidence ------------------------------------------------------------

/**
 * Skill families, used for one job only: deciding whether a gap is one that
 * rewording could close. Someone who knows Vue and is asked for React has
 * genuinely adjacent experience; someone with neither does not, and promising
 * that tailoring closes it would be a lie the tailoring prompt then refuses to
 * tell.
 */
const SKILL_FAMILIES: string[][] = [
  ['react', 'angular', 'vue', 'svelte', 'ember'],
  ['next.js', 'nuxt', 'gatsby', 'remix'],
  ['node.js', 'django', 'flask', 'rails', 'laravel', 'spring', 'express', '.net'],
  ['aws', 'azure', 'gcp', 'google cloud'],
  ['kubernetes', 'docker', 'terraform', 'ansible', 'helm'],
  ['postgresql', 'mysql', 'mongodb', 'dynamodb', 'redis', 'sql server', 'oracle'],
  ['jest', 'cypress', 'playwright', 'selenium', 'vitest', 'mocha', 'unit testing'],
  ['python', 'ruby', 'go', 'java', 'c#', 'php', 'rust', 'kotlin', 'scala'],
  ['javascript', 'typescript'],
  ['graphql', 'rest', 'grpc'],
  ['figma', 'sketch', 'adobe xd'],
  ['ci/cd', 'jenkins', 'github actions', 'circleci', 'gitlab ci'],
  ['machine learning', 'ai', 'nlp', 'deep learning', 'data science'],
];

const familyOf = (term: string): string[] | null =>
  SKILL_FAMILIES.find((family) => family.includes(term)) || null;

/** Canonical vocabulary terms named in a requirement. */
function termsIn(text: string, vocab: Vocabulary): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const keyword of vocab.keywords) {
    if (vocab.contains(lower, keyword)) found.add(vocab.canonical(keyword));
  }
  return Array.from(found);
}

/** Does the profile hold this term, and how well? */
function termCoverage(term: string, idx: ProfileIndex): Coverage {
  if (idx.recentTerms.has(term)) return 'strong';
  // An explicit skills entry is a claim without a demonstration; a term only
  // present in a role that ended years ago is a demonstration that has aged.
  if (idx.skillTerms.has(term) || idx.datedTerms.has(term)) return 'partial';
  return 'none';
}

const EDUCATION_LEVELS = ['diploma', 'bachelor', 'master', 'phd'];

function educationLevel(text: string): number {
  if (/\b(phd|ph\.d|doctorate)\b/i.test(text)) return 3;
  if (/\b(master'?s?|ms|m\.s|mba)\b/i.test(text)) return 2;
  if (/\b(bachelor'?s?|ba|bs|b\.s|undergraduate)\b/i.test(text)) return 1;
  return 0;
}

/**
 * Grades one requirement against the profile.
 *
 * Each type is judged on its own terms. Lumping them together was what let a
 * years-minimum be "matched" because the words "years" and "experience"
 * appeared in a role description.
 */
function gradeRequirement(
  req: { text: string; type: RequirementType; hardness: Hardness },
  idx: ProfileIndex,
  vocab: Vocabulary,
  statedYears: number | null,
): LocalRequirement {
  const base = {
    requirement: req.text,
    type: req.type,
    hardness: req.hardness,
    hasRelatedEvidence: false,
  };

  // Duties carry no weight in the score, so they are recorded and left alone.
  if (req.type === 'responsibility') {
    return { ...base, coverage: 'none', evidence: '' };
  }

  if (req.type === 'experience_years') {
    const need = Number(req.text.match(YEARS_RE)?.[1]) || statedYears;
    if (!need || idx.years === null) {
      return { ...base, coverage: 'partial', evidence: 'Could not read dates to check this' };
    }
    if (idx.years < need * 0.8) {
      return {
        ...base,
        coverage: 'none',
        evidence: '',
        whyBlocking: `Your profile shows ${idx.years.toFixed(1)} years against the ${need} this posting requires.`,
      };
    }

    // A years minimum is almost always a minimum *in something* — "5+ years in
    // B2B marketing", not five years of anything. Total tenure alone was
    // crediting a frontend engineer for a marketing role's years requirement,
    // so the subject of the sentence has to be evidenced too.
    const subjects = termsIn(req.text, vocab);
    const evidenced = subjects.filter((t) => termCoverage(t, idx) !== 'none');
    if (subjects.length > 0 && evidenced.length === 0) {
      return {
        ...base,
        coverage: 'none',
        evidence: '',
        whyBlocking: `The ${need}-year minimum is specifically in ${subjects.slice(0, 2).join(', ')}, which your profile doesn't evidence.`,
      };
    }

    const shortOnYears = idx.years < need;
    const partialSubject = subjects.length > 0 && evidenced.length < subjects.length;
    if (shortOnYears || partialSubject) {
      return {
        ...base,
        coverage: 'partial',
        evidence: shortOnYears
          ? `${idx.years.toFixed(1)} years — just under the ${need} asked for`
          : `${idx.years.toFixed(1)} years, partly in ${evidenced.slice(0, 2).join(', ')}`,
      };
    }
    return {
      ...base,
      coverage: 'strong',
      evidence: `${idx.years.toFixed(1)} years across your roles${evidenced.length ? `, including ${evidenced.slice(0, 2).join(', ')}` : ''}`,
    };
  }

  if (req.type === 'education') {
    const need = educationLevel(req.text);
    const have = educationLevel(idx.education);
    if (!idx.education) {
      return {
        ...base,
        coverage: 'none',
        evidence: '',
        whyBlocking: 'Your profile lists no education and this posting states a degree requirement.',
      };
    }
    if (have < need) {
      return {
        ...base,
        coverage: 'partial',
        evidence: `Your education is below the ${EDUCATION_LEVELS[need] || 'stated'} level asked for`,
      };
    }
    // The level is only half of it. "Bachelor's in Marketing" was reading as
    // fully met by a CS degree, because nothing looked at the field. Whether
    // two fields are "related" is not a call this can make, so a named field
    // that doesn't appear in the profile's education is partial credit.
    const field = req.text
      .replace(/^.*?\b(?:in|of)\b/i, '')
      .replace(/\bor\b.*$/i, '')
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((w) => w.length > 3 && !/^(field|degree|related|similar|equivalent|discipline|study|studies)$/.test(w));
    if (field.length > 0 && !field.some((w) => idx.education.includes(w))) {
      return {
        ...base,
        coverage: 'partial',
        evidence: `Degree level met, but in a different field to the ${field[0]} asked for`,
      };
    }
    return { ...base, coverage: 'strong', evidence: `Your education: ${idx.education.slice(0, 60)}` };
  }

  if (req.type === 'credential') {
    // The credential's own name is the thing to look for, minus the noise words.
    const name = req.text
      .toLowerCase()
      .replace(/\b(required|preferred|must have|or equivalent|a plus|certification|certified)\b/g, '')
      .replace(/[^a-z0-9+#.\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const hit = name.find((w) => idx.allText.includes(w));
    if (hit && CREDENTIAL_RE.test(idx.allText)) {
      return { ...base, coverage: 'strong', evidence: `"${hit}" appears in your profile` };
    }
    return {
      ...base,
      coverage: 'none',
      evidence: '',
      whyBlocking: 'Certifications and clearances are checked literally; this one is not in your profile.',
    };
  }

  if (req.type === 'title') {
    const wanted = (req.text.match(TITLE_RE)?.[1] || '').trim().toLowerCase();
    const words = wanted.split(/\s+/).filter((w) => w.length > 3);
    const held = idx.titles.some((t) => words.length > 0 && words.every((w) => t.includes(w)));
    if (held) return { ...base, coverage: 'strong', evidence: `You have held the title "${wanted}"` };
    const partial = idx.titles.some((t) => words.some((w) => t.includes(w)));
    return partial
      ? { ...base, coverage: 'partial', evidence: 'A related title appears in your history', hasRelatedEvidence: true }
      : { ...base, coverage: 'none', evidence: '', whyBlocking: `The posting screens on having worked as a ${wanted}.` };
  }

  // skill / domain / soft — all judged on the terms named in the line.
  const terms = termsIn(req.text, vocab);

  // Soft requirements never resolve to a gap. No screen rejects a resume for
  // not containing the word "communication", and a profile that doesn't happen
  // to use the posting's wording for it is not evidence of the opposite. They
  // are a quarter-weight dimension, so the generous read is cheap — and listing
  // "Excellent written and verbal communication skills" as something to go fix
  // is advice nobody can act on.
  if (req.type === 'soft') {
    const words = req.text.toLowerCase().split(/\s+/).filter((w) => w.length > 5);
    const found =
      terms.some((t) => termCoverage(t, idx) !== 'none') || words.some((w) => idx.allText.includes(w));
    return found
      ? { ...base, coverage: 'strong', evidence: 'Reflected in your profile wording' }
      : { ...base, coverage: 'partial', evidence: 'Not stated either way in your profile' };
  }

  if (terms.length === 0) {
    // Nothing in our vocabulary, so fall back to the words themselves.
    const words = req.text.toLowerCase().split(/\s+/).filter((w) => w.length > 5);
    const hits = words.filter((w) => idx.allText.includes(w)).length;
    if (words.length > 0 && hits / words.length >= 0.5) {
      return { ...base, coverage: 'partial', evidence: 'Wording overlaps your profile' };
    }
    return { ...base, coverage: 'none', evidence: '', hasRelatedEvidence: false };
  }

  const graded = terms.map((term) => ({ term, coverage: termCoverage(term, idx) }));
  const strong = graded.filter((g) => g.coverage === 'strong');
  const partial = graded.filter((g) => g.coverage === 'partial');
  const cite = (list: typeof graded) =>
    list
      .slice(0, 2)
      .map((g) => `${g.term} — ${idx.sources.get(g.term) || 'your profile'}`)
      .join('; ');

  if (strong.length === terms.length) {
    return { ...base, coverage: 'strong', evidence: cite(strong) };
  }
  if (strong.length > 0) {
    // Some of what the line asks for is demonstrated and some isn't — that is
    // exactly what partial credit is for.
    return { ...base, coverage: 'partial', evidence: cite(strong) };
  }
  if (partial.length > 0) {
    return { ...base, coverage: 'partial', evidence: cite(partial) };
  }

  // Nothing. Is any of it adjacent to something the candidate does have?
  const related = terms.some((term) => {
    const family = familyOf(term);
    if (!family) return false;
    return family.some(
      (sibling) => sibling !== term && (idx.recentTerms.has(sibling) || idx.skillTerms.has(sibling)),
    );
  });

  return {
    ...base,
    coverage: 'none',
    evidence: '',
    hasRelatedEvidence: related,
    whyBlocking:
      req.hardness === 'must'
        ? `${terms.slice(0, 2).join(', ')} is listed as required and does not appear in your profile.`
        : undefined,
  };
}

// --- 5. the fit dimensions --------------------------------------------------

/** Role families, and which of them a screener would consider adjacent. */
const ROLE_FAMILIES: Record<string, RegExp> = {
  engineering: /\b(engineer|developer|programmer|swe|sde|architect|coder)\b/,
  platform: /\b(devops|sre|site reliability|platform|infrastructure|cloud engineer)\b/,
  qa: /\b(qa|quality assurance|sdet|test engineer|tester)\b/,
  data: /\b(data scientist|data analyst|data engineer|machine learning|ml engineer|analytics engineer)\b/,
  design: /\b(designer|ux|ui|user experience|user interface|creative)\b/,
  product: /\b(product manager|product owner|pm\b|product lead|program manager|technical program)\b/,
  marketing: /\b(marketing|growth|seo|content|brand|demand gen|communications)\b/,
  sales: /\b(sales|account executive|business development|account manager|solutions consultant)\b/,
  support: /\b(support|customer success|customer service|helpdesk)\b/,
  finance: /\b(finance|accountant|accounting|controller|financial analyst)\b/,
  people: /\b(recruiter|talent|human resources|hr\b|people ops)\b/,
  management: /\b(engineering manager|director|vp\b|head of|chief|cto|ceo)\b/,
};

/** Pairs a screener treats as a short hop rather than a career change. */
const ADJACENT: Array<[string, string]> = [
  ['engineering', 'platform'],
  ['engineering', 'qa'],
  ['engineering', 'data'],
  ['engineering', 'management'],
  ['design', 'product'],
  ['product', 'management'],
  ['marketing', 'sales'],
  ['sales', 'support'],
  ['data', 'finance'],
];

function familyFromTitle(title: string): string | null {
  const lower = ` ${title.toLowerCase()} `;
  // Most specific first: "engineering manager" is management, not engineering.
  for (const key of ['management', 'platform', 'qa', 'data', 'product', 'design']) {
    if (ROLE_FAMILIES[key].test(lower)) return key;
  }
  for (const [key, re] of Object.entries(ROLE_FAMILIES)) {
    if (re.test(lower)) return key;
  }
  return null;
}

interface RoleFit {
  value: number;
  basis: string;
}

/**
 * Whether this is the same kind of work.
 *
 * This multiplies the whole score, so it is the dimension that stops a
 * respectable-looking number appearing on an application nobody would advance.
 * When titles can't settle it, how much of the posting's actual stack the
 * candidate holds is a better signal than any fixed default.
 */
function judgeRoleFit(jobTitle: string, idx: ProfileIndex, skillCoverage: number): RoleFit {
  const wanted = familyFromTitle(jobTitle || '');
  const held = idx.titles.map(familyFromTitle).filter(Boolean) as string[];

  if (!wanted || held.length === 0) {
    // Nothing to compare. Rather than invent a penalty or wave it through, read
    // it off the evidence: someone holding most of the required stack plainly
    // does this work.
    return { value: 0.7 + 0.3 * skillCoverage, basis: 'inferred from your skill overlap' };
  }
  if (held.includes(wanted)) return { value: 1, basis: 'same role family' };
  if (held.some((h) => ADJACENT.some(([a, b]) => (a === h && b === wanted) || (b === h && a === wanted)))) {
    return { value: 0.7, basis: `adjacent move from ${held[0]} to ${wanted}` };
  }
  return { value: 0.2, basis: `different function — ${held[0]} to ${wanted}` };
}

/** The years minimum the posting states, if it states one. Highest wins: a JD
 *  asking "8+ years engineering, 2+ years Kubernetes" screens on the 8. */
function requiredYears(requirements: Array<{ text: string }>): number | null {
  let max: number | null = null;
  for (const r of requirements) {
    const matches = r.text.matchAll(/(\d{1,2})\s*(?:\+|-|–|to)?\s*(\d{1,2})?\s*\+?\s*years?/gi);
    for (const m of matches) {
      const low = Number(m[1]);
      if (!Number.isFinite(low) || low <= 0 || low > 40) continue;
      if (max === null || low > max) max = low;
    }
  }
  return max;
}

/** Over-qualification counts against the match: it is routinely screened out,
 *  and calling it a perfect fit misleads the user about what will happen. */
function seniorityFitFrom(years: number | null, required: number | null): number | null {
  if (years === null || required === null) return null;
  const ratio = years / required;
  if (ratio >= 3) return 0.4;
  if (ratio >= 2) return 0.7;
  if (ratio >= 1) return 1;
  if (ratio >= 0.8) return 0.8;
  if (ratio >= 0.6) return 0.5;
  if (ratio >= 0.4) return 0.25;
  return 0.1;
}

/** How much of the match rests on current practice rather than old roles. */
function judgeRecency(requirements: LocalRequirement[], idx: ProfileIndex, vocab: Vocabulary): number {
  let recent = 0;
  let total = 0;
  for (const r of requirements) {
    if (r.coverage === 'none' || r.type !== 'skill') continue;
    for (const term of termsIn(r.requirement, vocab)) {
      if (!idx.recentTerms.has(term) && !idx.datedTerms.has(term)) continue;
      total += 1;
      if (idx.recentTerms.has(term)) recent += 1;
    }
  }
  // Nothing datable — don't invent a penalty from missing information.
  return total === 0 ? 1 : recent / total;
}

// --- 6. the arithmetic (mirrors backend/services/resume/jobMatchScore.js) ----

const WEIGHTS = { must: 0.55, nice: 0.15 };
const COVERAGE_CREDIT: Record<Coverage, number> = { strong: 1, partial: 0.5, none: 0 };
const TYPE_WEIGHT: Record<RequirementType, number> = {
  skill: 1,
  experience_years: 1,
  credential: 1,
  education: 1,
  title: 1,
  domain: 0.75,
  soft: 0.25,
  responsibility: 0,
};
const SENIORITY_FLOOR = 0.7;
const RECENCY_FLOOR = 0.85;
const BLOCKED_SCORE_CAP = 49;
const SCREENABLE_TYPES = new Set<RequirementType>([
  'skill',
  'credential',
  'experience_years',
  'title',
  'education',
]);

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const modulate = (floor: number, value: number) => floor + (1 - floor) * clamp01(value);

interface CoverageResult {
  ratio: number | null;
  counted: number;
  strong: number;
  partial: number;
}

/** Type-weighted coverage. A null ratio means "nothing to measure here", which
 *  drops the dimension rather than crediting it with full marks. */
function coverageOf(requirements: LocalRequirement[]): CoverageResult {
  let earned = 0;
  let weight = 0;
  let counted = 0;
  let strong = 0;
  let partial = 0;
  for (const r of requirements) {
    const w = TYPE_WEIGHT[r.type] ?? 1;
    if (w <= 0) continue;
    weight += w;
    earned += w * COVERAGE_CREDIT[r.coverage];
    counted += 1;
    if (r.coverage === 'strong') strong += 1;
    else if (r.coverage === 'partial') partial += 1;
  }
  if (weight === 0) return { ratio: null, counted: 0, strong: 0, partial: 0 };
  return { ratio: clamp01(earned / weight), counted, strong, partial };
}

function weightedAverage(parts: Array<{ weight: number; value: number | null }>): number {
  const live = parts.filter((p) => typeof p.value === 'number') as Array<{ weight: number; value: number }>;
  const total = live.reduce((sum, p) => sum + p.weight, 0);
  if (total === 0) return 0;
  return live.reduce((sum, p) => sum + p.weight * p.value, 0) / total;
}

const isSurfaceable = (r: LocalRequirement) =>
  r.coverage === 'partial' || (r.coverage === 'none' && r.hasRelatedEvidence);

// --- 7. the verdict sentence ------------------------------------------------

function buildVerdict(args: {
  score: number;
  coverage: number;
  roleFit: RoleFit;
  seniorityFit: number | null;
  years: number | null;
  required: number | null;
  blockers: Array<{ requirement: string }>;
  strongTerms: string[];
}): string {
  const { roleFit, seniorityFit, years, required, blockers, strongTerms, coverage } = args;

  if (roleFit.value <= 0.35) {
    return `This is a different kind of role from your background (${roleFit.basis}) — the overlap in wording won't get past a screen.`;
  }
  if (blockers.length > 0) {
    const first = blockers[0].requirement;
    return `Capped by a required item you can't evidence: ${first}${blockers.length > 1 ? ` (and ${blockers.length - 1} more)` : ''}.`;
  }
  if (seniorityFit !== null && seniorityFit < 0.6 && years !== null && required !== null) {
    return years < required
      ? `Your ${years.toFixed(1)} years sits under the ${required} this posting asks for, which is the main drag on the score.`
      : `At ${years.toFixed(1)} years you are well over the ${required} asked for — over-qualification gets screened out too.`;
  }
  if (coverage >= 0.85) {
    const named = strongTerms.slice(0, 3).join(', ');
    return `Strong on what this posting actually asks for${named ? ` (${named})` : ''}, with only minor gaps left.`;
  }
  if (coverage >= 0.6) {
    return 'You cover most of the requirements; the remaining gaps are what a screener would ask about.';
  }
  // Deliberately "asks for" rather than "requires" — a posting whose only list
  // is a preferred-qualifications section has no requirements to fall short of.
  return 'You can evidence less than half of what this posting asks for.';
}

// --- 8. entry point ---------------------------------------------------------

export interface LocalMatchResult {
  matchScore: number;
  projectedScore: number;
  present: string[];
  partial: string[];
  missing: string[];
  totalKeywords: number;
  source: 'local';
  provisional: false;
  priorities: Record<string, 'high' | 'medium' | 'low'>;
  blockers: Array<{ requirement: string; type: string; why: string }>;
  components: Record<string, any>;
  verdict: string;
  requirements: LocalRequirement[];
}

/** Returned instead of a score when the posting can't be read into
 *  requirements — a number built from nothing is worse than no number. */
export interface LocalMatchFailure {
  unscorable: string;
}

export function analyzeJobMatchLocally(
  input: LocalMatchInput,
): LocalMatchResult | LocalMatchFailure {
  const { jobDescription, jobTitle, profile, vocab } = input;

  const lines = collectLines(jobDescription || '');
  const classified = lines.map((line) => {
    // Type first: whether a line is a hard requirement depends on what kind of
    // requirement it is, not only on the heading it sits under.
    const type = classifyType(line.text, line.section);
    return {
      text: line.text,
      type,
      hardness: classifyHardness(line.text, line.section, type),
    };
  });

  // Duties are read but carry no weight, so a posting that is all duties has
  // nothing to score against.
  const scoreable = classified.filter((r) => (TYPE_WEIGHT[r.type] ?? 1) > 0);
  if (scoreable.length < 3) {
    return {
      unscorable:
        'This page does not spell out its requirements in a form we can read on-device — no bulleted requirements or qualifications section was found.',
    };
  }

  const flatSkills = flattenSkillsLocal(profile?.skills);
  const idx = indexProfile(profile, vocab, flatSkills);
  const stated = requiredYears(classified);

  const requirements = classified.map((r) => gradeRequirement(r, idx, vocab, stated));

  const must = requirements.filter((r) => r.hardness === 'must');
  const nice = requirements.filter((r) => r.hardness !== 'must');
  const mustCoverage = coverageOf(must);
  const niceCoverage = coverageOf(nice);
  const coverage = weightedAverage([
    { weight: WEIGHTS.must, value: mustCoverage.ratio },
    { weight: WEIGHTS.nice, value: niceCoverage.ratio },
  ]);

  // Role fit needs a coverage figure and coverage needs grading, so this runs
  // after: skill-only coverage is the honest input, since matching a posting's
  // soft skills says nothing about being the right kind of candidate for it.
  const skillOnly = coverageOf(requirements.filter((r) => r.type === 'skill'));
  const roleFit = judgeRoleFit(jobTitle || '', idx, skillOnly.ratio ?? 0);
  const derivedSeniority = seniorityFitFrom(idx.years, stated);
  // With no stated minimum there is nothing to check the profile against, so
  // the dimension is dropped rather than guessed at.
  const seniorityFit = derivedSeniority;
  const recency = judgeRecency(requirements, idx, vocab);

  const modifiers =
    roleFit.value *
    (seniorityFit === null ? 1 : modulate(SENIORITY_FLOOR, seniorityFit)) *
    modulate(RECENCY_FLOOR, recency);

  const raw = Math.round(100 * coverage * modifiers);

  const blockers = must
    .filter((r) => r.coverage === 'none' && SCREENABLE_TYPES.has(r.type))
    .map((r) => ({
      requirement: r.requirement,
      type: r.type,
      why: r.whyBlocking || 'Listed as required and absent from your profile.',
    }));

  const score = blockers.length > 0 ? Math.min(raw, BLOCKED_SCORE_CAP) : raw;

  // Projection: re-score with only the surfaceable gaps closed. Role fit,
  // seniority and recency are untouched — a rewrite doesn't change what job
  // family someone comes from and can't add years to a career.
  const projected = requirements.map((r) =>
    isSurfaceable(r) ? { ...r, coverage: 'strong' as Coverage } : r,
  );
  const projectedCoverage = weightedAverage([
    { weight: WEIGHTS.must, value: coverageOf(projected.filter((r) => r.hardness === 'must')).ratio },
    { weight: WEIGHTS.nice, value: coverageOf(projected.filter((r) => r.hardness !== 'must')).ratio },
  ]);
  const projectedBlockers = projected.filter(
    (r) => r.hardness === 'must' && r.coverage === 'none' && SCREENABLE_TYPES.has(r.type),
  );
  const projectedRaw = Math.min(95, Math.round(100 * projectedCoverage * modifiers));
  const projectedScore = Math.max(
    score,
    projectedBlockers.length > 0 ? Math.min(projectedRaw, BLOCKED_SCORE_CAP) : projectedRaw,
  );

  // Lists for the card. Responsibilities are left out: the score excludes them,
  // so showing them as gaps would hand the user work no screen checks.
  const scored = requirements.filter((r) => (TYPE_WEIGHT[r.type] ?? 1) > 0);
  const byHardness = (list: LocalRequirement[]) => [
    ...list.filter((r) => r.hardness === 'must'),
    ...list.filter((r) => r.hardness !== 'must'),
  ];
  const label = (r: LocalRequirement) => r.requirement;
  const present = byHardness(scored.filter((r) => r.coverage === 'strong')).map(label).slice(0, 24);
  const partial = byHardness(scored.filter((r) => r.coverage === 'partial')).map(label).slice(0, 12);
  const uncovered = byHardness(scored.filter((r) => r.coverage === 'none'));
  const missing = uncovered.map(label).slice(0, 16);

  const blockerSet = new Set(blockers.map((b) => b.requirement.toLowerCase()));
  const priorities: Record<string, 'high' | 'medium' | 'low'> = {};
  for (const r of uncovered) {
    const key = r.requirement.toLowerCase();
    priorities[key] = blockerSet.has(key) ? 'high' : r.hardness === 'must' ? 'medium' : 'low';
  }

  const strongTerms = Array.from(
    new Set(
      scored
        .filter((r) => r.coverage === 'strong' && r.type === 'skill')
        .flatMap((r) => termsIn(r.requirement, vocab)),
    ),
  );

  return {
    matchScore: score,
    projectedScore,
    present,
    partial,
    missing,
    totalKeywords: scored.length,
    source: 'local',
    provisional: false,
    priorities,
    blockers,
    components: {
      roleFit: Number(roleFit.value.toFixed(2)),
      roleFitBasis: roleFit.basis,
      coverage: Number(coverage.toFixed(2)),
      mustCoverage: mustCoverage.ratio === null ? null : Number(mustCoverage.ratio.toFixed(2)),
      niceCoverage: niceCoverage.ratio === null ? null : Number(niceCoverage.ratio.toFixed(2)),
      seniorityFit: seniorityFit === null ? null : Number(seniorityFit.toFixed(2)),
      recency: Number(recency.toFixed(2)),
      mustCount: mustCoverage.counted,
      niceCount: niceCoverage.counted,
      strongCount: mustCoverage.strong + niceCoverage.strong,
      partialCount: mustCoverage.partial + niceCoverage.partial,
      scoredCount: scored.length,
      unscoredCount: requirements.length - scored.length,
      seniorityBasis: derivedSeniority === null ? 'unstated' : 'dates',
      candidateYears: idx.years === null ? null : Number(idx.years.toFixed(1)),
      requiredYears: stated,
      cappedByBlockers: blockers.length > 0 && raw > BLOCKED_SCORE_CAP,
    },
    verdict: buildVerdict({
      score,
      coverage,
      roleFit,
      seniorityFit,
      years: idx.years,
      required: stated,
      blockers,
      strongTerms,
    }),
    requirements,
  };
}

/** Local copy of the skills flattener — kept here so this module has no
 *  dependency on the service worker it runs inside. */
function flattenSkillsLocal(skills: any): string[] {
  if (!skills) return [];
  if (Array.isArray(skills)) {
    return skills
      .map((s: any) => (typeof s === 'string' ? s : s?.name || s?.skill || '').toLowerCase())
      .filter(Boolean);
  }
  if (typeof skills === 'string') {
    return skills.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  if (typeof skills === 'object') {
    const all: string[] = [];
    for (const value of Object.values(skills)) {
      if (Array.isArray(value)) {
        value.forEach((s: any) => {
          const name = (typeof s === 'string' ? s : s?.name || s?.skill || '').toLowerCase();
          if (name) all.push(name);
        });
      } else if (typeof value === 'string') {
        all.push(value.toLowerCase());
      }
    }
    return all;
  }
  return [];
}
