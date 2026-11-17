/**
 * companyKey — one stable key for an employer, so "Coupang" and "Coupang
 * Internal", or "Atoms" and "ATOMS Careers page", count as one company.
 *
 * Job boards and career-page scrapers spell the same employer several ways, and
 * "one opening per company" on a card only holds if those spellings collapse.
 * The rules are deliberately small: lowercase, drop accents, drop anything in
 * brackets, drop a few words that name the page or the legal form rather than
 * the company, and squash punctuation. Nothing fuzzy, so two different
 * companies are never merged on a guess.
 */

const NOISE_WORDS = new Set([
  'careers', 'career', 'jobs', 'internal',
  'inc', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'gmbh', 'plc', 'co',
]);

function companyKey(name) {
  const original = String(name || '').toLowerCase().trim();
  if (!original) return '';

  const words = original
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

  // "page" only counts as noise right after "career(s)": "Careers page".
  const kept = words.filter((word, i) => {
    if (NOISE_WORDS.has(word)) return false;
    if (word === 'page' && /^careers?$/.test(words[i - 1] || '')) return false;
    return true;
  });

  // A name made only of noise ("Jobs Inc") keeps its own spelling.
  return kept.length ? kept.join(' ') : words.join(' ');
}

module.exports = { companyKey };
