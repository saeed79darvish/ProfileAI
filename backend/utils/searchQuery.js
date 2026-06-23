/**
 * Search-query → Postgres `to_tsquery` builder for the external-jobs search.
 *
 * WHY THIS EXISTS
 * ---------------
 * Postgres' text-search tokenizer splits on punctuation, so the SAME role
 * spelled three common ways produces three DIFFERENT token sets:
 *   "Frontend Engineer"   → frontend, engineer        (one token "frontend")
 *   "Front End Engineer"  → front, end, engineer      (two tokens)
 *   "Front-End Engineer"  → front, end, engineer      (hyphen splits)
 *
 * A naive `to_tsquery('frontend:* & engineer:*')` therefore MISSES every job
 * titled "Front End Engineer" / "Front-End Developer", and a search for
 * "Frontend Developer" misses "Frontend Engineer". On a small corpus this
 * silently halves the result set (observed: "Frontend Engineer" + Bay Area +
 * senior = 35, while the role-equivalent variants live in disjoint buckets).
 *
 * This builder normalizes the typed query into concept groups and expands each
 * recognized concept to an OR-group covering its spelling + role synonyms, so
 * recall captures the variants WITHOUT loosening into unrelated roles (we still
 * AND the distinct concepts together, and the caller still matches title/
 * company/department only — never the description).
 */

// Each group lists surface phrases that mean the same concept. `triggers` are
// what a user might type (each an array of already-sanitized lowercase tokens);
// `expand` is the set of alternatives OR-ed together in the generated tsquery
// (each alternative an array of tokens AND-ed, then prefix-stemmed with :*).
//
// Keep this conservative: only equivalences that are genuinely the same role,
// so we widen recall without pulling in unrelated jobs.
const CONCEPT_GROUPS = [
  {
    // "Frontend" is a CONCEPT, not just a word. The token "frontend" alone
    // matched only ~6% of the "software engineer" corpus because the bulk of
    // frontend roles are titled by their stack/surface — "React Engineer",
    // "UI Engineer", "Angular Developer", "Vue Developer" — none of which
    // contain the literal "frontend". We expand the concept to the unambiguous
    // frontend technologies/surfaces so a "Frontend Engineer" search also
    // captures them. Distinct concepts are still AND-ed with the role noun
    // (engineer|developer), which keeps precision: "React Engineer" matches,
    // but a plain "Reactive Systems" backend role does not (no engineer/dev
    // co-occurrence rescue here — and these terms are frontend-specific).
    //
    // Deliberately EXCLUDED: "web" / "javascript" / "typescript" — too broad
    // ("web3"/blockchain, "webrtc", "webhook" infra roles, every JS backend)
    // and would erode precision more than they help recall.
    triggers: [
      ['frontend'], ['front', 'end'], ['frontend', 'developer'], ['front', 'end', 'developer'],
      ['react'], ['reactjs'], ['angular'], ['vue'], ['vuejs'], ['svelte'], ['ui'],
    ],
    expand: [
      ['frontend'], ['front', 'end'],
      ['react'], ['angular'], ['vue'], ['svelte'], ['ui'],
    ],
  },
  {
    triggers: [['backend'], ['back', 'end']],
    expand: [['backend'], ['back', 'end']],
  },
  {
    triggers: [['fullstack'], ['full', 'stack']],
    expand: [['fullstack'], ['full', 'stack']],
  },
  // Role-noun equivalence: "engineer" and "developer" are interchangeable in
  // job titles (Frontend Engineer ≡ Frontend Developer).
  {
    triggers: [['engineer'], ['developer']],
    expand: [['engineer'], ['developer']],
  },
];

// Longest triggers first so multi-word phrases (e.g. "front end developer") are
// matched before their single-word prefixes.
const SORTED_GROUPS = CONCEPT_GROUPS
  .map((g) => ({
    ...g,
    triggers: [...g.triggers].sort((a, b) => b.length - a.length),
  }));

function sanitizeTokens(search) {
  return String(search || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length >= 2)
    .slice(0, 8); // cap so a giant paste can't blow up the query
}

// Render one concept group (list of token-array alternatives) into a tsquery
// fragment: `(front:* & end:*) | frontend:*` etc.
function renderGroup(alternatives) {
  const parts = alternatives.map((tokens) => {
    const anded = tokens.map((t) => `${t}:*`).join(' & ');
    return tokens.length > 1 ? `(${anded})` : anded;
  });
  return parts.length > 1 ? `(${parts.join(' | ')})` : parts[0];
}

/**
 * Build a `to_tsquery`-compatible string from a free-text job search, expanding
 * known role-spelling/synonym concepts. Distinct concepts are AND-ed; each
 * concept's variants are OR-ed. Tokens are sanitized to [a-z0-9]+ so the result
 * is always safe to pass to to_tsquery (also pass it via a bind, not inline).
 *
 * @param {string} search raw user query
 * @returns {string|null} a to_tsquery string, or null if nothing usable remains
 */
function buildJobSearchTsquery(search) {
  const tokens = sanitizeTokens(search);
  if (tokens.length === 0) return null;

  const concepts = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = null;
    for (const group of SORTED_GROUPS) {
      for (const trigger of group.triggers) {
        if (
          trigger.length <= tokens.length - i &&
          trigger.every((tok, k) => tokens[i + k] === tok)
        ) {
          matched = { group, len: trigger.length };
          break;
        }
      }
      if (matched) break;
    }

    if (matched) {
      concepts.push(renderGroup(matched.group.expand));
      i += matched.len;
    } else {
      concepts.push(`${tokens[i]}:*`);
      i += 1;
    }
  }

  if (concepts.length === 0) return null;
  return concepts.join(' & ');
}

module.exports = { buildJobSearchTsquery };
