/**
 * The pure logic behind the side panel's "Tailor for this job" flow.
 *
 * This is a port of the decision-making in the web app's JobTailorFlow.jsx
 * (frontend/src/components/JobTailorFlow.jsx), kept free of React and of any
 * chrome.* API so it can be unit tested in node (tests/tailorLogic.test.mjs).
 *
 * What lives here: which gaps are asked as questions, how the plan is built,
 * what the tailoring request carries, how the before/after change list is
 * derived (only real diffs, with a human reason, never the model's internal
 * notes), how a kept/skipped selection is applied to the tailored copy, and the
 * keyword and requirement counts that the Fit and Review screens must keep
 * consistent with each other.
 */

// --- shapes -----------------------------------------------------------------

export interface MatchRequirement {
  requirement?: string;
  type?: string;
  hardness?: 'must' | 'nice' | string;
  coverage?: 'strong' | 'partial' | 'none' | string;
  evidence?: string;
  note?: string;
}

export interface MatchResult {
  score: number;
  requirements: MatchRequirement[];
  components?: {
    requiredYears?: number;
    candidateYears?: number;
    [key: string]: unknown;
  };
  surfaceable?: string[];
  [key: string]: unknown;
}

export type Answer = 'yes' | 'no' | undefined;

export interface PlanOption {
  id: string;
  label: string;
  on: boolean;
  excludes?: string;
}

export interface PlanSection {
  key: 'title' | 'summary' | 'skills' | 'experience';
  label: string;
  options: PlanOption[];
}

export interface Change {
  id: string;
  section: 'title' | 'summary' | 'skills' | 'experience';
  index?: number;
  label: string;
  before: string;
  after: string;
  reason: string;
}

export interface LimitInfo {
  error: string;
  message: string;
  featureType: string | null;
  usage: Record<string, any>;
  resetAt: string | null;
  upgradeRequired: boolean;
  creditPacksAvailable: boolean;
  buyMoreUrl: string;
}

// --- constants --------------------------------------------------------------

export const STEPS = ['Fit', 'Plan', 'Review', 'Apply'] as const;

/** Years come from the dates on the roles, a degree from Education, the job
 *  family from the titles: saying "I have this" cannot add any of them. */
export const UNASKED_TYPES = new Set(['responsibility', 'experience_years', 'education', 'title']);

export const PROGRESS = [
  'Reading the job post',
  'Applying your answers',
  'Rewriting each section',
  'Checking keywords & length',
];
export const PROGRESS_AT = [3000, 9000, 30000];

export const REFINE_OPTIONS: Record<string, string[]> = {
  title: ['Shorter', 'Match job title exactly'],
  summary: ['Shorter', 'Add a metric', 'More job keywords'],
  skills: ['Fewer skills', 'Job keywords first'],
  experience: ['Shorter', 'Add a metric', 'Lead with impact'],
};

export const REFINE_PLACEHOLDER: Record<string, string> = {
  title: 'e.g. keep "Frontend" first',
  summary: 'e.g. mention the checkout redesign',
  skills: 'e.g. drop jQuery',
  experience: 'e.g. lead with the load-time win',
};

const SENIOR_WORD = /\b(staff|lead|principal|senior|head|director)\b/i;

// --- small helpers ----------------------------------------------------------

export const label = (r: MatchRequirement | null | undefined): string =>
  String(r?.requirement || '').trim();

export function flatSkills(skills: unknown): string[] {
  const list: unknown[] = Array.isArray(skills)
    ? skills
    : skills && typeof skills === 'object'
      ? Object.values(skills as Record<string, unknown>).flat()
      : [];
  return list
    .map((s) => (typeof s === 'string' ? s : (s as { name?: string } | null)?.name || ''))
    .filter(Boolean) as string[];
}

const squash = (s: unknown): string => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
export const same = (a: unknown, b: unknown): boolean => squash(a) === squash(b);

export const lowerFirst = (s: string): string =>
  s && /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The text of a resume the keyword counts read. */
export function resumeText(p: any = {}): string {
  return [
    p.title,
    p.summary,
    flatSkills(p.skillsGrouped || p.skills).join(', '),
    ...(p.experience || []).map((e: any) => `${e?.title || ''} ${e?.description || ''}`),
    ...(p.projects || []).map((x: any) => `${x?.title || x?.name || ''} ${x?.description || ''}`),
  ].join('\n').toLowerCase();
}

/** How many of the job's keywords appear in `text` (already lower-cased). */
export function countKeywords(keywords: string[], text: string): number {
  return (keywords || []).filter((k) => {
    const kw = String(k || '').trim().toLowerCase();
    if (!kw) return false;
    return new RegExp(`(^|[^a-z0-9+#])${escapeRe(kw)}($|[^a-z0-9+#])`).test(text);
  }).length;
}

// --- Fit --------------------------------------------------------------------

/** Requirements that count toward the score (responsibilities carry no weight). */
export function scoredRequirements(match: MatchResult | null | undefined): MatchRequirement[] {
  return (match?.requirements || []).filter((r) => label(r) && r.type !== 'responsibility');
}

export function coveredRequirements(match: MatchResult | null | undefined): MatchRequirement[] {
  return scoredRequirements(match).filter((r) => r.coverage === 'strong');
}

/** The gaps asked as plain questions: required ones first, never the kinds a
 *  yes cannot change. */
export function questionsFor(match: MatchResult | null | undefined): MatchRequirement[] {
  return scoredRequirements(match)
    .filter((r) => r.coverage !== 'strong' && !UNASKED_TYPES.has(String(r.type)))
    .sort((a, b) => (a.hardness === 'must' ? 0 : 1) - (b.hardness === 'must' ? 0 : 1));
}

export function confirmedRequirements(questions: MatchRequirement[], answers: Record<string, Answer>): MatchRequirement[] {
  return questions.filter((r) => answers[label(r)] === 'yes');
}

/** The sentence under the score when the candidate is far above the ask. */
export function seniorityNote(match: MatchResult | null | undefined, profileTitle: string | undefined): string {
  const c = match?.components || {};
  const over = !!(c.requiredYears && c.candidateYears && c.candidateYears >= c.requiredYears * 2);
  if (!over) return '';
  const word = (SENIOR_WORD.exec(profileTitle || '') || [])[1];
  const phrase = word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()} wording` : 'senior wording';
  return `This role asks for ${c.requiredYears}+ years and you have about ${Math.round(Number(c.candidateYears))}. We'll keep your experience but tone down ${phrase}.`;
}

export function isOverqualified(match: MatchResult | null | undefined): boolean {
  const c = match?.components || {};
  return !!(c.requiredYears && c.candidateYears && c.candidateYears >= c.requiredYears * 2);
}

export function noteFor(r: MatchRequirement): string {
  if (r.note) return r.note;
  if (r.coverage === 'partial' && r.evidence) return `Partly shown: ${String(r.evidence).replace(/^\[\d+\]\s*/, '')}`;
  return 'Not mentioned anywhere on your resume.';
}

/**
 * Requirement coverage before and after, from the same scored list so the two
 * numbers can never disagree about the total. `confirmed` are the labels the
 * candidate said yes to; `surfaceable` are the ones tailoring can bring out of
 * work already on the resume.
 */
export function coverageCounts(
  match: MatchResult | null | undefined,
  confirmed: string[],
  surfaceable: string[] = [],
): { total: number; before: number; after: number; gapsBefore: number; gapsAfter: number } {
  const scored = scoredRequirements(match);
  const total = scored.length;
  const before = scored.filter((r) => r.coverage === 'strong').length;
  const lift = new Set([...confirmed, ...surfaceable].map(String));
  const after = scored.filter((r) => r.coverage === 'strong' || lift.has(label(r))).length;
  return { total, before, after, gapsBefore: total - before, gapsAfter: total - after };
}

/**
 * The score shown after tailoring. The rescore counts a superset of what the
 * Fit step counted, so it cannot honestly be lower than the score the
 * candidate already saw; if the number that comes back is lower anyway, it is
 * a rounding or a stale read, and showing it would read as tailoring having
 * made the resume worse. Null while the rescore is outstanding.
 */
export function displayAfterScore(rescored: number | null | undefined, atFit: number | null | undefined, original: number | null | undefined): number | null {
  if (rescored == null || !Number.isFinite(Number(rescored))) return null;
  const floor = Math.max(Number(atFit) || 0, Number(original) || 0);
  return Math.max(Number(rescored), floor);
}

/** The labels sent to the rescore: what was confirmed plus what tailoring can surface. */
export function rescoreLabels(confirmed: string[], surfaceable: string[] | undefined): string[] {
  return [...new Set([...confirmed, ...(surfaceable || [])])];
}

// --- Plan -------------------------------------------------------------------

export function defaultPages(profile: any): 1 | 2 {
  return (profile?.experience || []).length > 4 ? 2 : 1;
}

export function buildPlan(opts: {
  profile: any;
  job: { title?: string; company?: string } | null | undefined;
  match: MatchResult | null | undefined;
  confirmed: MatchRequirement[];
  pages: number;
}): PlanSection[] {
  const { profile, job, match, confirmed, pages } = opts;
  const covered = coveredRequirements(match);
  // A theme to open on ("consumer-facing product impact"); a tool name is not
  // one, and keeps its capitals.
  const lead = [...confirmed, ...covered].find(
    (r) => ['domain', 'experience', 'soft'].includes(String(r.type)) && label(r).length <= 34,
  );
  const titleMatches = same(profile?.title, job?.title);
  const yesSkills = confirmed.filter((r) => r.type === 'skill');
  const skillCount = flatSkills(profile?.skills).length;
  const overqualified = isOverqualified(match);
  return [
    {
      key: 'title',
      label: 'Title',
      options: [
        { id: 'match', label: 'Match job title', on: !titleMatches, excludes: 'keep' },
        { id: 'keep', label: 'Keep current title', on: titleMatches, excludes: 'match' },
        ...(overqualified ? [{ id: 'tone', label: 'Tone down seniority', on: true }] : []),
      ],
    },
    {
      key: 'summary',
      label: 'Summary',
      options: [
        { id: 'lead', label: lead ? `Lead with ${lowerFirst(label(lead))}` : 'Lead with what this job wants most', on: true },
        { id: 'keywords', label: 'Use job keywords', on: true },
        { id: 'short', label: 'Keep to 3 lines', on: true },
        ...(job?.company ? [{ id: 'company', label: `Mention ${job.company}`, on: false }] : []),
      ],
    },
    {
      key: 'skills',
      label: 'Skills',
      options: [
        { id: 'order', label: 'Order by job relevance', on: true },
        ...(skillCount > 15 ? [{ id: 'trim', label: 'Trim to 15', on: true }] : []),
        ...(yesSkills.length ? [{ id: 'confirmed', label: 'Add confirmed skills', on: true }] : []),
      ],
    },
    {
      key: 'experience',
      label: 'Experience',
      options: [
        { id: 'rewrite', label: 'Rewrite bullets for this job', on: true },
        { id: 'metrics', label: 'Lead with results and metrics', on: true },
        { id: 'cut', label: 'Cut unrelated bullets', on: pages === 1 },
      ],
    },
  ];
}

/** Match and Keep are a pair: one of them is always on. */
export function toggleOption(plan: PlanSection[], sectionKey: string, id: string): PlanSection[] {
  return plan.map((s) => {
    if (s.key !== sectionKey) return s;
    const target = s.options.find((o) => o.id === id);
    if (!target) return s;
    if (target.excludes && target.on) return s;
    return {
      ...s,
      options: s.options.map((o) => {
        if (o.id === id) return { ...o, on: !o.on };
        if (!target.on && target.excludes === o.id) return { ...o, on: false };
        return o;
      }),
    };
  });
}

// --- the tailoring request --------------------------------------------------

export function buildGapSelections(confirmed: MatchRequirement[], proof: Record<string, string>) {
  if (!confirmed.length) return undefined;
  const yesSkills = confirmed.filter((r) => r.type === 'skill');
  const evidence = (r: MatchRequirement) => String(proof[label(r)] || '').trim();
  return {
    acceptedGaps: yesSkills.map(label),
    skippedGaps: [] as string[],
    acceptedGapObjects: yesSkills.map((r) => ({
      skill: label(r),
      type: r.hardness === 'must' ? 'required' : 'nice_to_have',
      severity: r.hardness === 'must' ? 'critical' : 'nice_to_have',
      customPrompt: evidence(r),
      status: 'pending',
    })),
    confirmedEvidence: confirmed.map((r) => ({
      requirement: label(r),
      evidence: evidence(r) || 'Confirmed by the candidate; no details given.',
    })),
  };
}

export function buildTailorSettings(plan: PlanSection[], pages: number, notes: Record<string, string>) {
  const on = (key: string) => (plan.find((s) => s.key === key)?.options || []).filter((o) => o.on);
  const has = (key: string, id: string) => on(key).some((o) => o.id === id);
  return {
    tone: 'professional',
    summaryLines: has('summary', 'short') ? 3 : undefined,
    maxSkills: has('skills', 'trim') ? 15 : undefined,
    experienceLines: pages === 1 ? 3 : 5,
    pages,
    plan: {
      title: on('title').map((o) => o.label),
      summary: on('summary').map((o) => o.label),
      skills: on('skills').map((o) => o.label),
      experience: on('experience').map((o) => o.label),
      keepTitle: has('title', 'keep'),
    },
    sectionNotes: notes,
  };
}

/** Gaps that remain after the candidate's answers, as saved on the record. */
export function stillMissing(match: MatchResult | null | undefined, answers: Record<string, Answer>) {
  return scoredRequirements(match)
    .filter((r) => r.coverage !== 'strong' && answers[label(r)] !== 'yes')
    .map((r) => ({
      skill: label(r),
      severity: r.hardness === 'must' ? 'critical' : 'nice_to_have',
      status: 'pending',
    }));
}

// --- Review: the change list ------------------------------------------------

/** Actions that describe the engine repairing itself, not a choice made for this job. */
const INTERNAL_ACTIONS = /corrected|restored|reconciled|repair|tenure|foundation|drift|enforce/i;
/** Model bookkeeping that is never a reason a person should read. */
const INTERNAL_NOTE = /^\s*[A-Z][A-Z_ ]{3,}\s*:|originals?\s+restored|copied from|omitted per|per preference|left unchanged|unchanged from|no change|repetition/i;

/** The model's changelog note for a section, only when it reads as a reason. */
export function changelogReason(changelog: unknown, keys: string[]): string {
  const hit = (Array.isArray(changelog) ? changelog : []).find((c: any) => c
    && keys.includes(String(c.section || '').toLowerCase())
    && !INTERNAL_ACTIONS.test(String(c.action || ''))
    && typeof c.detail === 'string'
    && c.detail.trim().length > 8
    && c.detail.length < 160
    && !INTERNAL_NOTE.test(c.detail));
  if (!hit) return '';
  const d = hit.detail.trim().replace(/\s+/g, ' ');
  return /[.!?]$/.test(d) ? d : `${d}.`;
}

/**
 * The tailored copy's changes, one card per section (one per role for
 * Experience). Only real before/after differences appear: an entry the model
 * logged but left identical is not a change and is not counted.
 */
export function buildChanges(original: any, tailored: any, jobKeywords: string[] = []): Change[] {
  const out: Change[] = [];
  if (!original || !tailored) return out;
  const log = tailored.changelog;
  const usesKeywords = (text: unknown) => countKeywords(jobKeywords, String(text || '').toLowerCase());

  const beforeTitle = String(original.title || original.headline || '').trim();
  if (tailored.title && !same(beforeTitle, tailored.title)) {
    out.push({
      id: 'title', section: 'title', label: 'Title',
      before: beforeTitle, after: String(tailored.title).trim(),
      reason: changelogReason(log, ['title', 'headline']) || 'Matches the title on the posting.',
    });
  }

  if (tailored.summary && !same(original.summary, tailored.summary)) {
    const n = usesKeywords(tailored.summary);
    out.push({
      id: 'summary', section: 'summary', label: 'Summary',
      before: String(original.summary || '').trim(), after: String(tailored.summary).trim(),
      reason: changelogReason(log, ['summary']) || (n ? `Uses ${n} of the job's keywords.` : 'Rewritten for this job.'),
    });
  }

  const beforeSkills = flatSkills(original.skills);
  const afterSkills = flatSkills(tailored.skillsGrouped || tailored.skills);
  if (afterSkills.length && !same(beforeSkills.join(', '), afterSkills.join(', '))) {
    out.push({
      id: 'skills', section: 'skills', label: 'Skills',
      before: beforeSkills.join(', '), after: afterSkills.join(', '),
      reason: changelogReason(log, ['skills']) || `${afterSkills.length} skills, ordered for this job.`,
    });
  }

  (tailored.experience || []).forEach((role: any, i: number) => {
    const was = (original.experience || [])[i];
    if (!role || !was || same(was.description, role.description)) return;
    out.push({
      id: `exp-${i}`, section: 'experience', index: i,
      label: [role.title || was.title, role.company || was.company].filter(Boolean).join(' · ') || `Role ${i + 1}`,
      before: String(was.description || '').trim(), after: String(role.description || '').trim(),
      reason: changelogReason(log, [`experience_${i + 1}`])
        || (i === 0 ? changelogReason(log, ['experience']) : '')
        || 'Rewritten for this job.',
    });
  });

  return out;
}

/** The changes with any refinement the candidate asked for shown as the "after". */
export function applyOverrides(changes: Change[], overrides: Record<string, string>): Change[] {
  return changes.map((ch) => (overrides[ch.id] !== undefined ? { ...ch, after: overrides[ch.id] } : ch));
}

/** Every change starts kept. */
export function initialKept(changes: Change[]): Record<string, boolean> {
  return Object.fromEntries(changes.map((ch) => [ch.id, true]));
}

export function keptCount(changes: Change[], kept: Record<string, boolean>): number {
  return changes.filter((ch) => kept[ch.id]).length;
}

/**
 * The tailored copy with skipped sections put back to the original and
 * refinements applied. Never mutates its inputs.
 */
export function buildCopy(
  tailored: any,
  profile: any,
  changes: Change[],
  kept: Record<string, boolean>,
  overrides: Record<string, string> = {},
): any {
  const out: any = { ...tailored, experience: (tailored.experience || []).map((e: any) => ({ ...e })) };
  for (const ch of changes) {
    const isKept = !!kept[ch.id];
    const after = overrides[ch.id] !== undefined ? overrides[ch.id] : ch.after;
    if (ch.section === 'title') {
      out.title = isKept ? after : ch.before;
    } else if (ch.section === 'summary') {
      out.summary = isKept ? after : ch.before;
    } else if (ch.section === 'skills') {
      if (!isKept) {
        out.skills = profile?.skills;
        delete out.skillsGrouped;
      } else if (overrides[ch.id] !== undefined) {
        out.skills = after.split(',').map((s) => s.trim()).filter(Boolean);
        delete out.skillsGrouped;
      }
    } else if (ch.section === 'experience' && ch.index !== undefined && out.experience[ch.index]) {
      out.experience[ch.index].description = isKept ? after : ch.before;
    }
  }
  return out;
}

/** The instructions body for a single-section rewrite (regenerate-sections). */
export function buildRefineRequest(
  copy: any,
  change: Change,
  text: string,
  jobTitle: string | undefined,
  company: string,
) {
  const context = ` This resume is tailored for the ${jobTitle || ''} role at ${company}.`;
  const role = change.section === 'experience' && change.index !== undefined ? copy.experience[change.index] : null;
  const instructions = change.section === 'experience'
    ? { experience: `Rewrite ONLY entry ${(change.index || 0) + 1} ("${role?.title || ''}" at ${role?.company || ''}) and return every other entry exactly as given. ${text}.${context}` }
    : { [change.section]: `${text}.${context}` };
  return {
    profileData: {
      title: copy.title,
      summary: copy.summary,
      skills: flatSkills(copy.skillsGrouped || copy.skills),
      experience: copy.experience,
    },
    instructions,
  };
}

/** The refined text for one section out of a regenerate-sections response. */
export function pickRefined(data: any, change: Change): string {
  const d = data || {};
  const next = change.section === 'experience'
    ? d.experience?.[change.index ?? 0]?.description
    : change.section === 'skills'
      ? flatSkills(d.skills).join(', ')
      : d[change.section];
  return typeof next === 'string' ? next.trim() : '';
}

// --- usage limit ------------------------------------------------------------

/** The limit payload when a response is a 429 rate-limit rejection, else null. */
export function parseLimit(status: number, body: any): LimitInfo | null {
  if (status !== 429 || !body || typeof body !== 'object') return null;
  return {
    error: body.error || 'Limit reached',
    message: body.message || '',
    featureType: body.featureType || null,
    usage: body.usage || {},
    resetAt: body.resetAt || null,
    upgradeRequired: Boolean(body.upgradeRequired),
    creditPacksAvailable: Boolean(body.creditPacksAvailable),
    buyMoreUrl: body.buyMoreUrl || '/pricing',
  };
}

/** "1 Sep": formatted in UTC because resetAt is a calendar boundary at midnight UTC. */
export function formatReset(resetAt: string | null | undefined): string | null {
  if (!resetAt) return null;
  const d = new Date(resetAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** What the limit screen says: a headline and one supporting line. */
export function limitCopy(limit: LimitInfo): { title: string; body: string } {
  const reset = formatReset(limit.resetAt);
  const base = limit.message || 'You have used everything included in your plan for this.';
  return {
    title: limit.upgradeRequired ? 'Upgrade to keep tailoring' : 'You have reached your limit',
    body: reset && !/reset|renew/i.test(base) ? `${base} Your allowance renews on ${reset}.` : base,
  };
}

// --- apply ------------------------------------------------------------------

/** A short name for the platform an application page is on. */
export function platformOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/** The elapsed-time progress index: how many of the progress lines are done. */
export function progressIndex(elapsedMs: number): number {
  return PROGRESS_AT.filter((ms) => elapsedMs >= ms).length;
}
