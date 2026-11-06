import type { DetailSource, LearnedFrom, LearnedItem } from './types';
import { cleanOptionTexts, isPlaceholderOption, isSensitiveQuestion } from './match';

/** What we send to the server when the person answers a question. */
export interface LearnPayload {
  question: string;
  answer: string;
  kind: 'choice' | 'text';
  options?: string[];
  company?: string;
  jobTitle?: string;
}

export interface LearnInput {
  question: string;
  answer: string;
  kind: 'choice' | 'text';
  options?: string[];
  company?: string;
  jobTitle?: string;
  /** Page learning: the element type, so passwords and long text are never read. */
  inputType?: string;
  tag?: string;
  /** Page learning: name, id and autocomplete joined, to spot name/email/phone style fields. */
  fieldHints?: string;
}

export type LearnDecision =
  | { learn: true; payload: LearnPayload }
  | { learn: false; reason: string };

export const MAX_TEXT_LEARN_CHARS = 80;

/** Fields that hold who the person is, not a kind of question to remember. */
const PERSONAL_FIELD = [
  /pass(word|code)/, /e-?mail/, /phone|mobile|telephone|\btel\b|cell/, /\b(first|last|full|legal|middle|preferred|given|family)[ _-]?name\b/,
  /^\s*(your )?name\s*\*?\s*$/, /address|street|zip|postal|postcode/, /\bssn\b|social security/, /linkedin|github|portfolio|website|\burl\b/,
  /card number|cvv|iban|routing number|account number/,
];

export function isPersonalField(question: string, hints = ''): boolean {
  const q = `${question || ''} ${hints || ''}`.toLowerCase();
  return PERSONAL_FIELD.some((r) => r.test(q));
}

/**
 * Decides whether an answer the person just gave is worth remembering. Pure:
 * the caller reads the page, this applies the rules. Nothing sensitive, nothing
 * about who they are, nothing long, nothing the server would have to guess.
 */
export function decideLearn(input: LearnInput): LearnDecision {
  const question = (input.question || '').replace(/[*✱]/g, '').replace(/\s+/g, ' ').trim();
  const answer = (input.answer || '').replace(/\s+/g, ' ').trim();
  if (question.length < 4) return { learn: false, reason: 'no question' };
  if (question.length > 300) return { learn: false, reason: 'question too long' };
  if (!answer) return { learn: false, reason: 'no answer' };
  if (isPlaceholderOption(answer)) return { learn: false, reason: 'placeholder' };
  if ((input.tag || '').toLowerCase() === 'textarea') return { learn: false, reason: 'long text' };
  const type = (input.inputType || '').toLowerCase();
  if (['password', 'email', 'tel', 'file', 'hidden', 'url', 'search', 'number', 'date'].includes(type)) return { learn: false, reason: 'personal field' };
  if (isSensitiveQuestion(question)) return { learn: false, reason: 'sensitive' };
  if (isPersonalField(question, input.fieldHints)) return { learn: false, reason: 'personal field' };
  if (input.kind === 'text' && answer.length > MAX_TEXT_LEARN_CHARS) return { learn: false, reason: 'long text' };
  if (input.kind === 'choice' && answer.length > 200) return { learn: false, reason: 'long answer' };
  const options = cleanOptionTexts(input.options || []).slice(0, 40);
  return {
    learn: true,
    payload: {
      question,
      answer,
      kind: input.kind,
      ...(options.length ? { options } : {}),
      ...(input.company ? { company: input.company.trim().slice(0, 120) } : {}),
      ...(input.jobTitle ? { jobTitle: input.jobTitle.trim().slice(0, 160) } : {}),
    },
  };
}

/** Facts and learned answers fill without asking. */
export function isMemorySource(source: DetailSource | string | null | undefined): boolean {
  return source === 'fact' || source === 'learned';
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 3).trimEnd()}...` : s);

/** "You answered Yes to 'Are you open to relocation?' at Anthropic." */
export function youAnsweredLine(answer: string, from?: LearnedFrom | null): string {
  const a = (answer || '').trim();
  const q = (from?.question || '').trim();
  if (!q) return a ? `You answered ${clip(a, 80)} before.` : '';
  const company = (from?.company || '').trim();
  return `You answered ${clip(a, 80)} to '${clip(q, 110)}'${company ? ` at ${company}` : ''}.`;
}

/** The label of the one-tap button for a stored answer that did not map to the options. */
export function useSuggestionLabel(suggestion: string): string {
  return `Use ${clip((suggestion || '').trim(), 40)}`;
}

export interface ReviewEntry { id: string; fromMemory: boolean }

/** Reused answers first, then the ones that still need the person. Order inside each group is kept. */
export function buildReviewList<T extends ReviewEntry>(entries: T[]): { reused: T[]; rest: T[] } {
  const reused: T[] = [];
  const rest: T[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    (e.fromMemory ? reused : rest).push(e);
  }
  return { reused, rest };
}

/** The toast after Quick Fill, or '' when nothing was reused. */
export function reusedToast(n: number): string {
  return n > 0 ? `Filled ${n} from your earlier answers. Review them.` : '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatLearnedDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Anthropic, Nov 6, 2026" for the manage list. */
export function learnedMeta(item: Pick<LearnedItem, 'company' | 'updatedAt' | 'createdAt'>): string {
  return [item.company || '', formatLearnedDate(item.updatedAt || item.createdAt)].filter(Boolean).join(', ');
}

const normQ = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export type SavedRow =
  | { type: 'learned'; id: string; question: string; answer: string; meta: string }
  | { type: 'local'; id: string; question: string; answer: string; meta: '' };

/** Learned answers first, then the older on-device ones the server already covers are dropped. */
export function buildSavedRows(learned: LearnedItem[], local: Record<string, string>): SavedRow[] {
  const sorted = [...(learned || [])].sort((a, b) =>
    String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  const known = new Set(sorted.map((l) => normQ(l.question)));
  const rows: SavedRow[] = sorted.map((l) => ({ type: 'learned', id: l.id, question: l.question, answer: l.answer, meta: learnedMeta(l) }));
  for (const [question, answer] of Object.entries(local || {})) {
    if (known.has(normQ(question))) continue;
    rows.push({ type: 'local', id: question, question, answer, meta: '' });
  }
  return rows;
}
