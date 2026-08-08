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

// ── Data-driven, multi-industry alias taxonomy ──────────────────────────────
//
// HOW TO EXTEND: just add a `syn(...)` line below. Each `syn(...)` call lists
// the surface phrases that mean the SAME concept; any of them TRIGGERS the
// group, and the whole set is OR-ed into the generated tsquery (recall), while
// DISTINCT concepts in a query are still AND-ed together (precision). No code
// changes are needed to cover a new role/industry — this is pure data.
//
// `syn('registered nurse', 'rn')` →
//    triggers: [['registered','nurse'], ['rn']]
//    expand:   same
//    so a search for "RN" finds "Registered Nurse" jobs and vice-versa.
//
// PRECISION NOTES:
//  • Multi-token phrases are AND-ed inside an alternative, so "registered nurse"
//    only matches when BOTH tokens are present — no loose "nurse" blow-out.
//  • Because concepts are AND-ed across a query, an abbreviation expansion can't
//    drag in unrelated roles on its own: "UI Designer" requires (ui-concept) AND
//    (designer), so a "React Engineer" (ui-concept but no "designer") won't match.
//  • Keep equivalences to genuinely-interchangeable role language. Avoid overly
//    generic single tokens (web/javascript/data/ops/support on their own) that
//    would erode precision more than they help recall.

// Tokenize a human phrase ("Front-End", "React.js") into sanitized lexemes the
// same way the query side does, so triggers line up with parsed query tokens.
function tokenizePhrase(s) {
  return String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length >= 2);
}

// Build a symmetric concept group from a list of equivalent phrases: every
// phrase both triggers the group and is part of its expansion.
function syn(...phrases) {
  const toks = phrases.map(tokenizePhrase).filter((p) => p.length > 0);
  return { triggers: toks, expand: toks };
}

const CONCEPT_GROUPS = [
  // ── Software / Engineering ────────────────────────────────────────────────
  // "Frontend" is a concept, not just a word: most frontend roles are titled by
  // their stack/surface (React/UI/Angular/Vue). Expand to those so a "Frontend
  // Engineer" search captures them. Excludes web/js/ts (too broad: web3, webrtc).
  syn('frontend', 'front end', 'react', 'angular', 'vue', 'svelte', 'ui', 'user interface'),
  syn('backend', 'back end'),
  syn('fullstack', 'full stack'),
  syn('engineer', 'developer', 'programmer'),
  syn('devops', 'dev ops', 'sre', 'site reliability'),
  syn('mobile', 'ios', 'android'),
  syn('machine learning', 'ml'),
  syn('artificial intelligence', 'ai'),
  syn('data scientist', 'data science'),
  syn('data engineer', 'data engineering'),
  syn('data analyst', 'data analytics'),
  syn('qa', 'quality assurance', 'sdet', 'test engineer', 'quality engineer'),
  syn('security', 'infosec', 'information security', 'cybersecurity', 'appsec'),
  syn('ux', 'user experience'),

  // ── Product / Program / Project ───────────────────────────────────────────
  syn('product manager', 'product management', 'pm'),
  syn('program manager', 'program management', 'tpm', 'technical program manager'),
  syn('project manager', 'project management'),
  syn('product owner'),

  // ── Design ────────────────────────────────────────────────────────────────
  syn('designer', 'design'),
  syn('product designer'),
  syn('graphic designer'),

  // ── Marketing ─────────────────────────────────────────────────────────────
  syn('marketing', 'marketer'),
  syn('seo', 'search engine optimization'),
  syn('content strategist', 'content marketing'),

  // ── Sales / Customer ──────────────────────────────────────────────────────
  syn('account executive', 'ae'),
  syn('sales development', 'sdr', 'bdr', 'business development representative'),
  syn('customer success', 'csm'),
  syn('customer support', 'customer service'),

  // ── Healthcare ────────────────────────────────────────────────────────────
  syn('registered nurse', 'rn'),
  syn('nurse practitioner', 'np'),
  syn('licensed practical nurse', 'lpn', 'licensed vocational nurse', 'lvn'),
  syn('certified nursing assistant', 'cna'),
  syn('physician', 'doctor', 'md'),
  syn('medical assistant'),

  // ── Finance / Accounting ──────────────────────────────────────────────────
  syn('accountant', 'accounting'),
  syn('financial analyst', 'finance analyst'),
  syn('bookkeeper', 'bookkeeping'),
  syn('certified public accountant', 'cpa'),

  // ── HR / Recruiting ───────────────────────────────────────────────────────
  syn('human resources', 'hr'),
  syn('recruiter', 'recruiting', 'talent acquisition'),
  syn('people operations', 'people ops'),

  // ── Legal ─────────────────────────────────────────────────────────────────
  syn('attorney', 'lawyer', 'counsel'),
  syn('paralegal', 'legal assistant'),

  // ── Operations / Admin ────────────────────────────────────────────────────
  syn('administrative assistant', 'admin assistant', 'executive assistant'),
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
// fragment: `(front & end) | frontend` etc.
//
// Expansion tokens are matched EXACTLY, not as prefixes. They are canonical
// names we chose ourselves, not partial input someone is still typing, so a
// prefix here buys nothing and costs precision: `react:*` also matches
// "reactor", "reaction" and "reactive". That is not hypothetical — a nuclear
// "Reactor Engineering" department matched a Frontend Engineer search, scored a
// full-strength lexical hit, and put an Instrumentation and Controls Engineer
// at the top of a frontend candidate's feed at "65% · Strong match".
//
// Nothing real is lost: English stemming already collapses morphology, so exact
// `engineer` matches "Engineering" (both stem to 'engin') and exact `frontend`
// matches "Frontends". Prefix matching is still applied to tokens the USER
// typed (below), where a partial word genuinely is likely.
function renderGroup(alternatives) {
  const parts = alternatives.map((tokens) => {
    const anded = tokens.join(' & ');
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
