import type { WordHint } from './types';

export function countWords(text: string): number {
  const t = (text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

const NUM = '(\\d{1,5})';

/**
 * Reads a length limit out of the helper text a form shows under a question,
 * e.g. "200-400 words", "up to 300 words", "at least 100 words". Returns null
 * when the text states no word limit. Character limits are ignored.
 */
export function parseWordHint(text: string | null | undefined): WordHint | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/[–—]/g, '-').replace(/,/g, '');
  let m = t.match(new RegExp(`${NUM}\\s*(?:-|to)\\s*${NUM}\\s*words?`));
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a > 0 && b >= a) return { min: a, max: b };
  }
  m = t.match(new RegExp(`(?:up to|max(?:imum)?(?: of)?|no more than|under|within|fewer than|less than|limit(?:ed)? to)\\s*${NUM}\\s*words?`));
  if (m) return { min: 0, max: parseInt(m[1], 10) };
  m = t.match(new RegExp(`${NUM}\\s*words?\\s*(?:or (?:less|fewer)|max(?:imum)?)`));
  if (m) return { min: 0, max: parseInt(m[1], 10) };
  m = t.match(new RegExp(`(?:at least|min(?:imum)?(?: of)?|no fewer than|more than)\\s*${NUM}\\s*words?`));
  if (m) return { min: parseInt(m[1], 10), max: 0 };
  m = t.match(new RegExp(`${NUM}\\s*words?\\s*(?:or more|minimum)`));
  if (m) return { min: parseInt(m[1], 10), max: 0 };
  m = t.match(new RegExp(`(?:in|about|around|approximately)\\s*${NUM}\\s*words?`));
  if (m) return { min: 0, max: parseInt(m[1], 10) };
  return null;
}

export type WordTone = 'ok' | 'under' | 'over' | 'plain';

export interface WordStatus {
  count: number;
  tone: WordTone;
  label: string;
}

/** The text the counter shows under an answer, with a tone for colouring. */
export function wordStatus(text: string, hint: WordHint | null | undefined): WordStatus {
  const count = countWords(text);
  const noun = (n: number) => (n === 1 ? 'word' : 'words');
  if (!hint || (!hint.min && !hint.max)) {
    return { count, tone: 'plain', label: `${count} ${noun(count)}` };
  }
  const range = hint.min && hint.max ? `${hint.min} to ${hint.max}` : hint.max ? `up to ${hint.max}` : `at least ${hint.min}`;
  if (hint.max && count > hint.max) {
    return { count, tone: 'over', label: `${count} ${noun(count)}, ${count - hint.max} over the limit` };
  }
  if (hint.min && count < hint.min) {
    return { count, tone: 'under', label: `${count} ${noun(count)}, the form asks for ${range}` };
  }
  return { count, tone: 'ok', label: `${count} ${noun(count)}, the form asks for ${range}` };
}
