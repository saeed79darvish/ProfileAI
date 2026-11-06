import type { AnswerCatalog, CatalogFact } from './types';

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Words a stored choice value is allowed to mean inside a dropdown option. */
const CHOICE_SYNONYMS: Record<string, string[]> = {
  authorized_no_sponsorship: ['authorized', 'no sponsorship', 'do not require', 'will not require', 'not require sponsorship'],
  needs_sponsorship_now: ['require sponsorship', 'need sponsorship', 'will require sponsorship'],
  needs_sponsorship_future: ['future'],
  remote_only: ['remote'],
  hybrid_ok: ['hybrid'],
  onsite_ok: ['on site', 'onsite', 'in office', 'in person'],
  depends: ['depends', 'maybe', 'open to discuss'],
};

function uniqueMatch(options: string[], test: (o: string) => boolean): string | null {
  const hits = options.filter(test);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Picks the dropdown option that a stored answer means, or null. Never guesses:
 * a match must be exact, or the only option that contains (or is contained in)
 * the answer, or the only option that uses a known synonym of the stored value.
 */
export function pickOption(
  options: string[],
  hint: { answer?: string | null; choiceValue?: string | null },
): string | null {
  const opts = (options || []).filter((o) => o && o.trim());
  if (opts.length === 0) return null;
  const answer = norm(hint.answer || '');
  const value = norm((hint.choiceValue || '').replace(/_/g, ' '));
  const wants = Array.from(new Set([answer, value].filter(Boolean)));

  for (const w of wants) {
    const exact = opts.find((o) => norm(o) === w);
    if (exact) return exact;
  }
  for (const w of wants) {
    if (w === 'yes' || w === 'no') {
      const hit = uniqueMatch(opts, (o) => {
        const n = norm(o);
        return n === w || n.startsWith(`${w} `);
      });
      if (hit) return hit;
    }
  }
  for (const w of wants) {
    if (w.length < 3) continue;
    const hit = uniqueMatch(opts, (o) => norm(o).includes(w));
    if (hit) return hit;
  }
  for (const w of wants) {
    const hit = uniqueMatch(opts, (o) => {
      const n = norm(o);
      return n.length >= 3 && w.includes(n);
    });
    if (hit) return hit;
  }
  const syn = CHOICE_SYNONYMS[(hint.choiceValue || '').trim()];
  if (syn) {
    const hit = uniqueMatch(opts, (o) => syn.some((s) => norm(o).includes(s)));
    if (hit) return hit;
  }
  return null;
}

const SENSITIVE = [
  /\b(gender|sex)\b/, /\brace\b|\bethnic/, /hispanic|latino|latinx/, /\bveteran\b|military/,
  /disabilit/, /\bage\b|date of birth|birth ?date/, /religio/, /sexual orientation|lgbt/,
  /criminal|convict|felony|arrest/, /pronoun/,
];

/** Demographic and similar questions are never answered for the person. */
export function isSensitiveQuestion(question: string): boolean {
  const q = (question || '').toLowerCase();
  return SENSITIVE.some((r) => r.test(q));
}

/** The catalog fact a form question asks about, or null. The longest match wins. */
export function matchFact(question: string, catalog: AnswerCatalog | null | undefined): CatalogFact | null {
  if (!catalog || !question || isSensitiveQuestion(question)) return null;
  let best: { fact: CatalogFact; len: number } | null = null;
  for (const fact of catalog.facts || []) {
    for (const src of fact.detect || []) {
      let re: RegExp;
      try { re = new RegExp(src, 'i'); } catch { continue; }
      const m = question.match(re);
      if (m && (!best || m[0].length > best.len)) best = { fact, len: m[0].length };
    }
  }
  return best ? best.fact : null;
}

/** Rows react-select shows when nothing is chosen: not real answers. */
export function isPlaceholderOption(text: string | null | undefined): boolean {
  const t = norm(text || '');
  if (!t) return true;
  return /^(select|choose|please select|please choose|pick one|pick an option|none selected)( an option| one)?$/.test(t)
    || /^select\b.*\.\.\.$/.test((text || '').trim().toLowerCase())
    || /^[-—– ]+$/.test((text || '').trim());
}

/** The real option texts, in order, with placeholders and repeats removed. */
export function cleanOptionTexts(texts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of texts) {
    const t = (raw || '').replace(/\s+/g, ' ').trim();
    if (!t || isPlaceholderOption(t) || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

/** 'yes' or 'no' when an option plainly means one of them, else null ("Maybe", "No preference"). */
export function optionYesNo(option: string | null | undefined): 'yes' | 'no' | null {
  const n = norm(option || '');
  if (n === 'yes' || n === 'no') return n;
  if (/^(yes|no)\b/.test(n) && !/^no (preference|answer|response|comment|opinion)/.test(n) && !/\b(maybe|depends|unsure|not sure)\b/.test(n)) {
    return n.startsWith('yes') ? 'yes' : 'no';
  }
  if (/^i (do not|don't|will not|won't|am not) /.test(n) || /^(not at all|never)$/.test(n)) return 'no';
  return null;
}

interface FactShape { id: string; type: string; choices?: Array<{ value: string }> }

const hasYesNoChoices = (f: FactShape) =>
  f.type === 'yesno' || (f.choices || []).some((c) => c.value === 'yes') && (f.choices || []).some((c) => c.value === 'no');

/** Could picking one of these options be saved as a yes or no fact? Used to show the toggle. */
export function canSaveFromOptions(fact: FactShape | null | undefined, question: string, options: string[]): boolean {
  if (!fact || isSensitiveQuestion(question) || !hasYesNoChoices(fact)) return false;
  return options.some((o) => optionYesNo(o) !== null);
}

/**
 * The fact value to remember after the person picked a dropdown option, or
 * null when saving would be a guess. Only yes or no facts, only options that
 * plainly mean yes or no, never a demographic question.
 */
export function saveDecision(
  fact: FactShape | null | undefined,
  question: string,
  option: string,
): { factId: string; value: 'yes' | 'no' } | null {
  if (!fact || isSensitiveQuestion(question) || !hasYesNoChoices(fact)) return null;
  const v = optionYesNo(option);
  return v ? { factId: fact.id, value: v } : null;
}
