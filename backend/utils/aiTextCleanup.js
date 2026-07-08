/**
 * Post-process AI-generated text to remove common "AI tell" characters
 * that readers (and users of this app) have complained about.
 *
 * Scope:
 *  - Em dash  (—, U+2014)  → ", " (comma + space) if surrounded by letters,
 *                             else " - " (spaced hyphen) as a safe fallback.
 *  - En dash  (–, U+2013)  → same treatment as em dash. Preserved inside
 *                             numeric ranges like "2020–2024" (keeps their
 *                             meaning; users almost never complain about
 *                             those and stripping them breaks dates).
 *  - Non-breaking space (U+00A0) → regular space (models slip these into
 *                                   otherwise plain text).
 *
 * NOT touched:
 *  - Regular hyphens ("-") — legitimate in "AI-powered", "check-in", etc.
 *  - Ellipsis characters, quotes, or anything else content-bearing.
 *
 * This runs on every AI response coming out of `callAI` in ai/core.js so
 * all downstream features (summaries, cover letters, tailoring, etc.)
 * benefit without touching each call site.
 */

function stripAiTellChars(text) {
  if (typeof text !== 'string' || text.length === 0) return text;

  let out = text;

  // Em dash → prefer comma when it's separating clauses (letter—letter),
  // otherwise fall back to a spaced hyphen so we never mash tokens together.
  out = out.replace(/\s*\u2014\s*/g, (match, offset, full) => {
    const before = full[offset - 1] || '';
    const after = full[offset + match.length] || '';
    if (/[A-Za-z]/.test(before) && /[A-Za-z]/.test(after)) return ', ';
    return ' - ';
  });

  // En dash → same treatment, but keep numeric ranges intact
  // (e.g. "2020–2024", "10–15%").
  out = out.replace(/\s*\u2013\s*/g, (match, offset, full) => {
    const before = full[offset - 1] || '';
    const after = full[offset + match.length] || '';
    if (/[0-9]/.test(before) && /[0-9]/.test(after)) return match; // leave alone
    if (/[A-Za-z]/.test(before) && /[A-Za-z]/.test(after)) return ', ';
    return ' - ';
  });

  // Non-breaking space → regular space.
  out = out.replace(/\u00A0/g, ' ');

  return out;
}

module.exports = { stripAiTellChars };
