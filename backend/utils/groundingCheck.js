/**
 * Lightweight grounding / hallucination detector for AI-enhanced text.
 *
 * Compares the AI output against the user-provided source text (and optional
 * context fields) to flag entities that look invented — capitalized multi-word
 * phrases, acronyms, percent metrics, and dollar figures that were not present
 * in the source. This is intentionally conservative: we only surface flags as
 * warnings to the user; we do not block the enhancement.
 *
 * Used by the per-section enhance endpoints (5.4) so the UI can render a
 * "verify before accepting" alert above the diff preview.
 */

const STOPWORDS = new Set([
  'I', 'A', 'An', 'The', 'And', 'Or', 'But', 'For', 'With', 'On', 'In', 'At',
  'To', 'By', 'Of', 'As', 'It', 'Is', 'Was', 'Be', 'My', 'Our', 'We', 'You',
  'Your', 'Their', 'They', 'This', 'That', 'These', 'Those', 'Project',
  'Description', 'Role', 'Title', 'Company', 'Period', 'Technologies'
]);

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9%$.+\-/ ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Extract candidate entities from text:
 *  - Capitalized multi-word phrases (e.g., "Apache Kafka", "React Native")
 *  - All-caps acronyms 2-6 chars (e.g., "AWS", "GraphQL"-skipped, "SQL")
 *  - Percent metrics ("35%")
 *  - Dollar amounts ("$2M", "$120k")
 */
function extractEntities(text) {
  if (!text) return [];
  const out = new Set();

  // Multi-word capitalized phrases
  const capPhrase = /\b([A-Z][a-zA-Z0-9+\-.]*(?:\s+[A-Z][a-zA-Z0-9+\-.]*){0,4})\b/g;
  let m;
  while ((m = capPhrase.exec(text)) !== null) {
    const phrase = m[1].trim();
    if (phrase.length < 2) continue;
    if (STOPWORDS.has(phrase)) continue;
    // Skip pure single-word stopwords
    const parts = phrase.split(/\s+/);
    if (parts.length === 1 && STOPWORDS.has(parts[0])) continue;
    out.add(phrase);
  }

  // Acronyms (2-6 uppercase letters/digits)
  const acro = /\b([A-Z]{2,6})\b/g;
  while ((m = acro.exec(text)) !== null) {
    if (!STOPWORDS.has(m[1])) out.add(m[1]);
  }

  // Percent metrics
  const pct = /\b(\d{1,3}(?:\.\d+)?\s*%)/g;
  while ((m = pct.exec(text)) !== null) out.add(m[1].replace(/\s+/g, ''));

  // Dollar amounts
  const usd = /\$\s?\d+(?:[.,]\d+)?\s?[KkMmBb]?/g;
  while ((m = usd.exec(text)) !== null) out.add(m[0].replace(/\s+/g, ''));

  return Array.from(out);
}

/**
 * Check whether `enhanced` text introduces entities that aren't supported by
 * `source` or any of the `contextStrings` (e.g., job title, company name,
 * technologies list). Returns an array of { type, content } flags. Empty
 * array means the output appears grounded.
 */
function checkGrounding(source, enhanced, contextStrings = []) {
  if (!enhanced || !source) return [];
  const haystack = normalize([source, ...contextStrings.filter(Boolean)].join(' '));
  const entities = extractEntities(enhanced);
  const flags = [];

  for (const ent of entities) {
    const norm = normalize(ent);
    if (!norm) continue;
    // Skip very short / numeric-only items
    if (norm.length < 2) continue;
    if (haystack.includes(norm)) continue;

    // For multi-word phrases, also accept if every word individually appears.
    const parts = norm.split(' ').filter(Boolean);
    if (parts.length > 1 && parts.every((p) => haystack.includes(p))) continue;

    let type = 'entity';
    if (/^\d/.test(ent) && ent.includes('%')) type = 'metric';
    else if (ent.startsWith('$')) type = 'metric';
    else if (/^[A-Z]{2,6}$/.test(ent)) type = 'acronym';

    flags.push({ type, content: ent });
  }

  // De-duplicate while preserving order, cap at 8 to avoid noise.
  const seen = new Set();
  return flags.filter((f) => {
    const k = f.content.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 8);
}

module.exports = { checkGrounding, extractEntities };
