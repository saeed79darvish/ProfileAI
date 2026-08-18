/**
 * Deterministic Draft Audit
 *
 * Every rule this module checks already existed in the tailoring prompt, and
 * every one of them shipped violated. Metric caps, keyword frequency limits and
 * title consistency were written as instructions the model was asked to confirm
 * it had followed — and the model confirmed it had, while returning six metrics
 * and five copies of "component-driven". A rule the model both applies and
 * grades is not enforced; it is suggested.
 *
 * So the counting happens here, in code, over the finished JSON. This module
 * never rewrites the draft and never talks to a model. It returns COUNTS and
 * EVIDENCE. The review pass (reviewPrompt.js) is what acts on them, and the
 * caller re-runs this audit afterwards to confirm the counts actually moved.
 *
 * The other half of the job is the fabrication diff. `unsupported` is computed
 * by matching every term in the tailored draft against the ORIGINAL resume with
 * word-boundary matching. The previous guard used `sourceText.includes(term)`,
 * which is why "SQL" passed: the candidate had PostgreSQL, and "postgresql"
 * contains "sql". Substring matching cannot tell a skill from a syllable.
 */

// ── Term matching ────────────────────────────────────────────────────────────

/**
 * Equivalences that must not be reported as fabrication. A candidate who wrote
 * "Postgres" has support for "PostgreSQL"; one who wrote "K8s" has support for
 * "Kubernetes". Without this the audit generates noise questions, and a review
 * step that cries wolf gets ignored exactly like the prompt rules did.
 */
const TERM_ALIASES = {
  js: ['javascript'],
  javascript: ['js', 'es6', 'ecmascript'],
  ts: ['typescript'],
  typescript: ['ts'],
  postgres: ['postgresql'],
  postgresql: ['postgres'],
  k8s: ['kubernetes'],
  kubernetes: ['k8s'],
  'node.js': ['node', 'nodejs'],
  node: ['node.js', 'nodejs'],
  'react.js': ['react'],
  react: ['react.js', 'reactjs'],
  'vue.js': ['vue'],
  vue: ['vue.js', 'vuejs'],
  css: ['scss', 'sass', 'css3'],
  html: ['html5'],
  ci: ['ci/cd', 'continuous integration'],
  'ci/cd': ['ci', 'cd', 'continuous integration', 'continuous delivery'],
  gcp: ['google cloud'],
  'google cloud': ['gcp'],
  a11y: ['accessibility'],
  accessibility: ['a11y', 'wcag'],
  i18n: ['internationalization'],
  rest: ['restful', 'rest api', 'rest apis'],
  graphql: ['graph ql'],
};

/** Escape a term for use inside a RegExp. */
function escapeRe(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary containment test.
 *
 * `\b` is useless here because resume vocabulary is full of `.`, `+` and `#`
 * (Node.js, C++, C#), so the boundaries are hand-rolled:
 *   - before the term: must not be an alphanumeric, `+` or `#`. A leading `.`
 *     IS allowed, so "js" matches inside "Node.js".
 *   - after the term: must not be an alphanumeric, `+` or `#`. A trailing `.`
 *     IS allowed, so "React" matches inside "React.js".
 *
 * Net effect: "sql" does NOT match "postgresql" (preceded by `e`), which is the
 * exact failure that let SQL onto the Sigma Computing draft.
 */
function containsTerm(haystack, term) {
  const t = String(term || '').toLowerCase().trim();
  if (!t) return false;
  const re = new RegExp(`(?:^|[^a-z0-9+#])${escapeRe(t)}(?:$|[^a-z0-9+#])`, 'i');
  return re.test(String(haystack || '').toLowerCase());
}

/**
 * Does the ORIGINAL resume support this term, directly or through an alias?
 * @param {string} sourceText - The original resume text ONLY
 * @param {string} term
 */
function hasSupport(sourceText, term) {
  const t = String(term || '').toLowerCase().trim();
  if (!t) return true;
  if (containsTerm(sourceText, t)) return true;
  for (const alias of TERM_ALIASES[t] || []) {
    if (containsTerm(sourceText, alias)) return true;
  }
  // Multi-word terms count as supported when every content word is supported
  // ("REST APIs" against a resume that says "REST" and "API").
  const words = t.split(/[\s/]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (words.length > 1 && words.every((w) => containsTerm(sourceText, w))) return true;
  return false;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'over', 'across',
  'their', 'them', 'they', 'were', 'was', 'has', 'have', 'had', 'been', 'being',
  'are', 'our', 'its', 'his', 'her', 'not', 'but', 'all', 'any', 'can', 'will',
  'more', 'most', 'other', 'such', 'than', 'then', 'when', 'while', 'who', 'how',
  'a', 'an', 'of', 'in', 'on', 'to', 'at', 'by', 'as', 'is', 'it', 'or', 'be',
  'using', 'used', 'via', 'within', 'including', 'work', 'working', 'role',
  'team', 'teams', 'years', 'year', 'new', 'also', 'well', 'both', 'each',
]);

// ── Draft text assembly ──────────────────────────────────────────────────────

/**
 * Collect every resume-FACING string with a label, so findings can point at a
 * location instead of just asserting a count. Structural fields (company,
 * period, school) are excluded: the audit polices prose, not the record.
 */
function collectSegments(draft) {
  const segments = [];
  if (draft.summary) segments.push({ location: 'summary', text: String(draft.summary) });
  (draft.experience || []).forEach((e, i) => {
    const label = e.company ? `experience_${i + 1} (${e.company})` : `experience_${i + 1}`;
    if (e.description) segments.push({ location: label, text: String(e.description) });
  });
  (draft.projects || []).forEach((p, i) => {
    if (p.description) segments.push({ location: `project_${i + 1}`, text: String(p.description) });
  });
  return segments;
}

/** Flatten grouped or flat skills into a plain array. */
function flattenSkills(skills) {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills;
  if (typeof skills === 'object') return Object.values(skills).flat();
  return [];
}

// ── 1. Metric audit (issue 3) ────────────────────────────────────────────────

/**
 * Metric shapes worth counting. Percentages, money, multipliers, latencies,
 * durations and scale counts — the things METRIC DISCIPLINE caps at 3–4.
 */
const METRIC_PATTERNS = [
  { kind: 'percentage', re: /\b\d{1,3}(?:\.\d+)?\s?%|\b\d{1,3}\s?-\s?\d{1,3}\s?%/g },
  { kind: 'currency', re: /[$€£]\s?\d[\d,.]*\s?[KMB]?\b/gi },
  { kind: 'multiplier', re: /\b\d+(?:\.\d+)?\s?[x×]\b/gi },
  { kind: 'latency', re: /\b\d[\d,.]*\s?(?:ms|milliseconds?|µs)\b/gi },
  { kind: 'duration', re: /\b\d[\d,.]*\s?(?:seconds?|minutes?|hours?|days?|weeks?|months?)\b/gi },
  { kind: 'count', re: /\b\d[\d,.]*\s?[KMB]?\+?\s?(?:users?|customers?|clients?|engineers?|developers?|people|services?|components?|screens?|repos?|requests?|rps|qps|records?|tests?|apps?|applications?|teams?)\b/gi },
];

/** "from 840ms to 210ms", "3 weeks to 4 days" — a single before/after metric. */
const UNIT = '(?:ms|s|%|[KMB]|hours?|days?|weeks?|months?|minutes?|seconds?)?';
const BEFORE_AFTER_RE = new RegExp(
  `\\b(?:from\\s+)?\\d[\\d,.]*\\s?${UNIT}\\s+to\\s+\\d[\\d,.]*\\s?${UNIT}`,
  'gi'
);

/** A four-digit year is a date, not an achievement metric. */
function isCalendarYear(token) {
  return /^(?:19|20)\d{2}$/.test(token.replace(/\D/g, ''));
}

/**
 * Count every metric in the draft, with its kind and location, and surface the
 * two failures the prompt banned but never checked: exceeding the cap, and
 * repeating the same figure across different companies.
 */
function auditMetrics(draft) {
  const items = [];
  for (const seg of collectSegments(draft)) {
    // A before/after pair is ONE metric, not two. "Cut p95 latency from 840ms
    // to 210ms" is the exact shape METRIC DISCIPLINE holds up as the credible
    // alternative to "improved performance by 50%" — counting it twice would
    // charge the resume double for following the rule, and push writers back
    // toward the bare round percentage the rule exists to discourage.
    let text = seg.text;
    const beforeAfter = text.match(BEFORE_AFTER_RE) || [];
    for (const raw of beforeAfter) {
      items.push({ value: raw.trim().replace(/\s+/g, ' '), kind: 'before_after', location: seg.location });
    }
    text = text.replace(BEFORE_AFTER_RE, ' ');

    for (const { kind, re } of METRIC_PATTERNS) {
      const matches = text.match(new RegExp(re.source, re.flags)) || [];
      for (const raw of matches) {
        const value = raw.trim().replace(/\s+/g, ' ');
        if (isCalendarYear(value) && kind === 'count') continue;
        items.push({ value, kind, location: seg.location });
      }
    }
  }

  // Same figure in two different places is the "25% here, 25% there" tell.
  const byValue = new Map();
  for (const it of items) {
    const key = it.value.toLowerCase().replace(/\s/g, '');
    if (!byValue.has(key)) byValue.set(key, []);
    byValue.get(key).push(it.location);
  }
  const repeatedValues = [...byValue.entries()]
    .filter(([, locs]) => locs.length > 1)
    .map(([value, locations]) => ({ value, locations }));

  const inSummary = items.filter((i) => i.location === 'summary');

  return {
    count: items.length,
    cap: 4,
    items,
    repeatedValues,
    inSummary,
    ghostShapes: findGhostMetrics(draft),
    overCap: items.length > 4,
    kindsUsed: [...new Set(items.map((i) => i.kind))],
    // A resume whose metrics are all percentages reads as invented even at
    // three of them, which is why METRIC DISCIPLINE asks for different kinds.
    monotonous: items.length >= 3 && new Set(items.map((i) => i.kind)).size === 1,
  };
}

/**
 * The wreckage a dropped metric leaves behind.
 *
 * Dropping a number is the correct move when the resume is over its cap, but
 * the bullet has to be rewritten around the absence, not merely emptied of the
 * digit. "Improved rendering significantly" and "used by active users" are
 * sentences that wanted a number and lost one, and they read worse than the
 * metric they replaced — so the cap enforcement has to police its own output.
 */
const GHOST_METRIC_PATTERNS = [
  /\b(?:improved|increased|reduced|decreased|cut|boosted|grew|optimiz\w+|enhanc\w+)\s+(?:\w+\s+){0,3}(?:significantly|substantially|considerably|dramatically|greatly|markedly)\b/gi,
  /\bby\s+(?:significantly|substantially|considerably|dramatically|greatly)\b/gi,
  /\b(?:used|adopted|relied on)\s+by\s+(?:many\s+|numerous\s+|active\s+)?(?:users|customers|teams)\b(?!\s+\w*\d)/gi,
  /\bsupported\s+an?\s+(?:large|sizable|sizeable|significant|substantial)\s+(?:team|org|organization|organisation|user base)\b/gi,
  /\b(?:a|an)\s+(?:large|significant|substantial|considerable)\s+(?:number|amount|volume)\s+of\b/gi,
];

function findGhostMetrics(draft) {
  const hits = [];
  for (const seg of collectSegments(draft)) {
    for (const re of GHOST_METRIC_PATTERNS) {
      const matches = seg.text.match(new RegExp(re.source, re.flags)) || [];
      for (const raw of matches) hits.push({ phrase: raw.trim(), location: seg.location });
    }
  }
  return hits;
}

// ── 2. Repetition audit (issue 4) ────────────────────────────────────────────

/** Normalise for phrase counting: lowercase, strip punctuation, collapse space. */
function normalizeForCounting(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Count repeated multi-word phrases across the WHOLE resume (summary + skills +
 * every bullet), which is the scope the KEYWORD FREQUENCY LIMIT specifies and
 * the scope a per-section self-check never covers.
 *
 * @param {Object} draft
 * @param {string[]} jdKeywords - Extracted JD keywords, counted explicitly even
 *   when they are single words, since those carry the ATS weight.
 */
function auditRepetition(draft, jdKeywords = []) {
  // PROSE ONLY. The skills section is a list of labels, and listing a keyword
  // there is its legitimate single mention — the frequency limit exists to stop
  // a term being worked into three bullets for density, not to stop the resume
  // naming it once where it belongs. Counting skills entries made an honest
  // draft ("React" in the summary, one bullet, and the skills list) fail on
  // three separate keywords, and an audit that fires on good output is one
  // nobody reads.
  const scopes = collectSegments(draft);
  const skillsList = flattenSkills(draft.skills).map((s) => String(s).toLowerCase());

  // Phrase counting: 2–4 word n-grams, ignoring any that are all stopwords.
  const phraseCounts = new Map();
  for (const scope of scopes) {
    const words = normalizeForCounting(scope.text).split(' ').filter(Boolean);
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const gram = words.slice(i, i + n);
        if (gram.every((w) => STOPWORDS.has(w))) continue;
        if (gram.some((w) => w.length < 3)) continue;
        const phrase = gram.join(' ');
        if (!phraseCounts.has(phrase)) phraseCounts.set(phrase, []);
        phraseCounts.get(phrase).push(scope.location);
      }
    }
  }

  // A phrase appearing 3+ times is the "component-driven design x5" failure.
  // Report only the longest form of each repeat so one offence is not listed
  // three times as its own sub-phrases.
  const rawOffenders = [...phraseCounts.entries()]
    .filter(([, locs]) => locs.length >= 3)
    .map(([phrase, locations]) => ({ phrase, count: locations.length, locations }))
    .sort((a, b) => b.phrase.length - a.phrase.length);

  const phraseOffenders = [];
  for (const cand of rawOffenders) {
    const subsumed = phraseOffenders.some(
      (kept) => kept.phrase.includes(cand.phrase) && kept.count === cand.count
    );
    if (!subsumed) phraseOffenders.push(cand);
  }

  // Everything used twice or more, offending or not. The limit is 3, but the
  // output contract requires the resume to SHOW its repetition count rather than
  // assert one, and a list that only appears when something is wrong proves
  // nothing on the runs where nothing is. Same longest-form dedupe.
  const rawRepeats = [...phraseCounts.entries()]
    .filter(([, locs]) => locs.length >= 2)
    // Two content words minimum. "the carrier" repeating twice is English, not
    // a stock phrase, and a proof-of-work list padded with articles is one the
    // reader stops reading — which defeats the point of printing it.
    .filter(([phrase]) => phrase.split(' ').filter((w) => !STOPWORDS.has(w)).length >= 2)
    .map(([phrase, locations]) => ({
      phrase,
      count: locations.length,
      locations: [...new Set(locations)],
    }))
    .sort((a, b) => b.count - a.count || b.phrase.length - a.phrase.length);
  const repeatedTwicePlus = [];
  for (const cand of rawRepeats) {
    const subsumed = repeatedTwicePlus.some(
      (kept) => kept.phrase.includes(cand.phrase) && kept.count === cand.count
    );
    if (!subsumed) repeatedTwicePlus.push(cand);
  }

  // JD keywords have a hard limit of 2 anywhere in the resume.
  const keywordOffenders = [];
  const wholeText = scopes.map((s) => normalizeForCounting(s.text)).join(' \n ');
  for (const kw of jdKeywords) {
    const t = String(kw).toLowerCase().trim();
    if (!t) continue;
    const re = new RegExp(`(?:^|[^a-z0-9+#])${escapeRe(t)}(?=$|[^a-z0-9+#])`, 'gi');
    const count = (wholeText.match(re) || []).length;
    if (count > 2) {
      const locations = scopes
        .filter((s) => (normalizeForCounting(s.text).match(re) || []).length > 0)
        .map((s) => s.location);
      keywordOffenders.push({ phrase: t, count, limit: 2, locations });
    }
  }

  // A methodology is something you DID, evidenced in a bullet — not a tool you
  // can list. "Component-driven design" sitting in Skills between React and
  // Webpack is the same claim as putting "hard work" there, and it is also how
  // the phrase got its third and fourth appearance in a resume that was already
  // over the repetition limit in prose.
  const methodologyInSkills = skillsList.filter((s) => METHODOLOGY_LABEL_RE.test(s));

  return {
    phraseOffenders: phraseOffenders.slice(0, 15),
    repeatedTwicePlus: repeatedTwicePlus.slice(0, 25),
    keywordOffenders,
    methodologyInSkills,
    skillsListed: skillsList,
    clean:
      phraseOffenders.length === 0 &&
      keywordOffenders.length === 0 &&
      methodologyInSkills.length === 0,
  };
}

const { METHODOLOGY_LABEL_RE } = require('./writingRules');

// ── 3. Fabrication diff against the ORIGINAL (issues 1 and 2) ────────────────

/**
 * Everything in the tailored draft that cannot be traced to the original
 * resume. This is the mandatory diff: the original is the only admissible
 * source of truth, deliberately NOT the stored profile, because the stored
 * profile accumulates whatever previous tailoring passes wrote into it and
 * would launder last week's fabrication into this week's evidence.
 *
 * Nothing here is auto-deleted except unsupported SKILLS, which have no prose
 * context to preserve. Summary and bullet claims become QUESTIONS, because
 * silently dropping a claim can also be wrong: the candidate may genuinely have
 * done the work and simply not written it down.
 *
 * @param {Object} draft
 * @param {string} originalText - The ORIGINAL resume. Required.
 * @param {string[]} acceptedGaps - Skills the candidate explicitly asked for.
 * @param {string[]} jdKeywords - Used to prioritise which summary claims to test.
 * @param {string} jobDescription - Used to tell an imported claim from filler.
 */
function auditFabrication(draft, originalText, acceptedGaps = [], jdKeywords = [], jobDescription = '') {
  const source = String(originalText || '');
  const accepted = new Set(acceptedGaps.map((g) => String(g).toLowerCase().trim()));

  // 3a. Skills with no support anywhere in the original.
  const unsupportedSkills = [];
  for (const skill of flattenSkills(draft.skills)) {
    const s = String(skill).trim();
    if (!s) continue;
    if (accepted.has(s.toLowerCase())) continue;
    if (!hasSupport(source, s)) {
      unsupportedSkills.push({ term: s, section: 'skills' });
    }
  }

  // 3b. Summary claims. Every JD term the summary uses must be traceable to the
  // original; "real-time visualization systems" failed precisely because the
  // summary was checked against the JD instead of against the resume below it.
  const summary = String(draft.summary || '');
  const unsupportedSummaryClaims = [];
  const candidateClaims = new Set();

  // JD keywords that appear in the summary are the highest-risk claims.
  for (const kw of jdKeywords) {
    if (containsTerm(summary, kw)) candidateClaims.add(String(kw).toLowerCase().trim());
  }

  // Plus noun phrases the summary IMPORTED FROM THE POSTING. That import is
  // what fabrication looks like in a tailoring pass, and scoping the scan to it
  // is what keeps the finding list usable: an earlier version n-grammed the
  // whole summary and produced twenty findings, most of them fragments like
  // "versatile engineer. focused" that crossed a sentence boundary and meant
  // nothing. A check that reports twenty things reports nothing.
  //
  // A phrase qualifies only if at least one of its words appears in the JD and
  // appears NOWHERE in the original resume — a word that arrived with the
  // posting. Generic filler ("experienced, motivated, versatile") has no JD
  // origin and is a style defect caught by buzzwordChains instead.
  const jdText = String(jobDescription || '');
  // One finding per IMPORTED WORD, carrying the longest phrase that contains
  // it. Without this, "real-time visualization systems", "building real-time
  // visualization" and "visualization systems delivered" are three findings and
  // three questions about the same single claim.
  const byImportedWord = new Map();
  for (const sentence of summary.split(/(?<=[.!?])\s+/)) {
    const words = normalizeForCounting(sentence).split(' ').filter(Boolean);
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const gram = words.slice(i, i + n);
        if (gram.some((w) => STOPWORDS.has(w) || w.length < 4)) continue;
        const imported = gram.filter(
          (w) => containsTerm(jdText, w) && !containsTerm(source, w)
        );
        if (!imported.length) continue;
        const phrase = gram.join(' ').replace(/[.,;:]$/, '');
        for (const word of imported) {
          const held = byImportedWord.get(word);
          if (!held || phrase.length > held.length) byImportedWord.set(word, phrase);
        }
      }
    }
  }
  for (const phrase of new Set(byImportedWord.values())) candidateClaims.add(phrase);

  for (const claim of candidateClaims) {
    if (accepted.has(claim)) continue;
    if (!hasSupport(source, claim)) {
      unsupportedSummaryClaims.push({ term: claim, section: 'summary' });
    }
  }

  // 3c. Bullet-level terms drawn from the JD that the original never mentions.
  const unsupportedBulletTerms = [];
  for (const seg of collectSegments(draft)) {
    if (seg.location === 'summary') continue;
    for (const kw of jdKeywords) {
      const t = String(kw).toLowerCase().trim();
      if (!t || accepted.has(t)) continue;
      if (containsTerm(seg.text, t) && !hasSupport(source, t)) {
        unsupportedBulletTerms.push({ term: t, section: seg.location });
      }
    }
  }

  return {
    unsupportedSkills,
    unsupportedSummaryClaims: dedupeByTerm(unsupportedSummaryClaims),
    unsupportedBulletTerms: dedupeByTerm(unsupportedBulletTerms),
    clean:
      unsupportedSkills.length === 0 &&
      unsupportedSummaryClaims.length === 0 &&
      unsupportedBulletTerms.length === 0,
  };
}

/** Longest-form dedupe: "real time visualization" subsumes "visualization". */
function dedupeByTerm(findings) {
  const sorted = [...findings].sort((a, b) => b.term.length - a.term.length);
  const kept = [];
  for (const f of sorted) {
    if (kept.some((k) => k.section === f.section && k.term.includes(f.term))) continue;
    kept.push(f);
  }
  return kept;
}

// ── 4. Summary audit (issue 5) ───────────────────────────────────────────────

/**
 * Spans of four or more consecutive words shared with the job posting.
 *
 * Runs of overlapping 4-grams are merged back into the single longest span they
 * came from: "build real time visualization" and "real time visualization
 * systems" are one lifted phrase, not two, and reporting them separately turns
 * one defect into two questions about the same sentence.
 *
 * Anything the candidate's ORIGINAL resume also says is exempt. When the posting
 * asks for "React and TypeScript design systems" and the candidate's resume
 * already used those words, the overlap is agreement, not mirroring — flagging
 * it would push the rewrite AWAY from the candidate's own accurate vocabulary,
 * which is the opposite of what this check is for.
 */
function findJdSpans(text, jdNorm, originalNorm, n = 4) {
  const words = normalizeForCounting(text).split(' ').filter(Boolean);
  const hit = [];
  for (let i = 0; i + n <= words.length; i++) {
    const gram = words.slice(i, i + n);
    const phrase = gram.join(' ');
    hit[i] =
      !gram.every((w) => STOPWORDS.has(w)) &&
      jdNorm.includes(phrase) &&
      !originalNorm.includes(phrase);
  }

  const spans = [];
  let start = null;
  for (let i = 0; i <= hit.length; i++) {
    if (hit[i]) {
      if (start === null) start = i;
    } else if (start !== null) {
      spans.push(words.slice(start, i - 1 + n).join(' '));
      start = null;
    }
  }
  return [...new Set(spans)];
}

/**
 * Sentence count, metrics, and verbatim overlap with the posting.
 * "Strong computer science fundamentals" is a 4-word span shared with the JD,
 * which is what the 4-gram check catches — a rule saying "never copy phrasing"
 * cannot be verified, but a shared 4-gram can.
 */
function auditSummary(draft, jobDescription, originalText = '') {
  const summary = String(draft.summary || '').trim();
  const sentences = summary ? summary.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 1) : [];
  const jdNorm = normalizeForCounting(jobDescription);
  const originalNorm = normalizeForCounting(originalText);

  const copiedSpans = findJdSpans(summary, jdNorm, originalNorm);

  // Adjective stacking: three or more comma-separated descriptors in a row.
  const buzzwordChains = summary.match(/\b(?:[A-Za-z-]+,\s+){2,}[A-Za-z-]+\b/g) || [];

  return {
    sentenceCount: sentences.length,
    maxSentences: 3,
    overLength: sentences.length > 3,
    metricsInSummary: auditMetrics({ summary }).items,
    copiedSpans,
    buzzwordChains,
    clean:
      sentences.length <= 3 &&
      copiedSpans.length === 0 &&
      buzzwordChains.length === 0 &&
      auditMetrics({ summary }).items.length === 0,
  };
}

/**
 * The same 4-word rule, over the WHOLE resume.
 *
 * The summary was the only section checked, on the theory that it is where
 * posting language lands. It is where it landed FIRST. Once the summary check
 * started rejecting lifted phrases, the same phrases reappeared in bullets,
 * which is the predictable result of policing one section of a document the
 * model writes in one pass.
 */
function auditJdEcho(draft, jobDescription, originalText) {
  const jdNorm = normalizeForCounting(jobDescription);
  const originalNorm = normalizeForCounting(originalText);
  const spans = [];
  for (const seg of collectSegments(draft)) {
    for (const phrase of findJdSpans(seg.text, jdNorm, originalNorm)) {
      spans.push({ phrase, location: seg.location });
    }
  }
  return { spans, clean: spans.length === 0 };
}

// ── 5. Consistency audit (issue 6) ───────────────────────────────────────────

const ROLE_NOUN = '(?:Engineer|Developer|Manager|Designer|Analyst|Lead|Architect|Scientist|Consultant|Director|Specialist|Administrator|Programmer)';

/**
 * Titles asserted inside a bullet that contradict the role's own header.
 * This is the Wells Fargo bug: header "Full Stack Web Developer", first bullet
 * "as Senior Frontend React Developer". It survived a round of review because
 * CONSISTENCY CHECKS asked the model to confirm titles matched, and the model
 * confirmed. Extracting both strings and comparing them cannot do that.
 */
function auditConsistency(draft) {
  const titleMismatches = [];
  const inBulletTitle = new RegExp(`\\bas\\s+(?:an?\\s+)?((?:[A-Z][A-Za-z.+#]*\\s+){0,4}${ROLE_NOUN})\\b`, 'g');

  (draft.experience || []).forEach((entry, i) => {
    const headerTitle = String(entry.title || '').trim();
    const desc = String(entry.description || '');
    let m;
    while ((m = inBulletTitle.exec(desc)) !== null) {
      const claimed = m[1].trim();
      if (!headerTitle) continue;
      if (normalizeTitle(claimed) !== normalizeTitle(headerTitle)) {
        titleMismatches.push({
          location: `experience_${i + 1}${entry.company ? ` (${entry.company})` : ''}`,
          headerTitle,
          bulletTitle: claimed,
        });
      }
    }
  });

  // Date formats must be uniform across the whole experience list.
  const dateShapes = new Set();
  (draft.experience || []).forEach((e) => {
    const p = String(e.period || '');
    if (!p) return;
    if (/\d{1,2}\/\d{4}/.test(p)) dateShapes.add('MM/YYYY');
    else if (/[A-Za-z]{3,9}\s+\d{4}/.test(p)) dateShapes.add('Mon YYYY');
    else if (/\b\d{4}\b/.test(p)) dateShapes.add('YYYY');
  });

  return {
    titleMismatches,
    dateFormats: [...dateShapes],
    mixedDateFormats: dateShapes.size > 1,
    clean: titleMismatches.length === 0 && dateShapes.size <= 1,
  };
}

function normalizeTitle(t) {
  return String(t)
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\b(senior|sr|junior|jr|staff|principal|lead)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── 6. Education audit (issue 7) ─────────────────────────────────────────────

/**
 * The tailoring pass deleted "UCSC Silicon Valley Extension" and left an entry
 * with no school. Two distinct faults: a field was lost relative to the
 * original, and an incomplete entry was returned despite EDUCATION
 * COMPLETENESS. Both are checkable against the original text.
 */
function auditEducation(draft, originalText) {
  const entries = draft.education || [];
  const source = String(originalText || '');

  const incomplete = [];
  entries.forEach((e, i) => {
    const missing = [];
    const school = String(e.school || '').trim();
    const degree = String(e.degree || '').trim();
    const year = String(e.year || '').trim();
    if (!school || /^\[add /i.test(school)) missing.push('school');
    if (!degree || /^\[add /i.test(degree)) missing.push('degree');
    if (!year || /^\[add /i.test(year)) missing.push('year');
    if (missing.length) incomplete.push({ index: i, missing, entry: e });
  });

  // Institutions the original names but the draft no longer does.
  // The empty strings MUST be filtered out: `"ucsc...".includes("")` is true,
  // so an entry whose school was deleted would otherwise count as evidence
  // that the school was kept — the exact defect this check exists to find.
  const draftSchools = entries
    .map((e) => String(e.school || '').toLowerCase().trim())
    .filter((s) => s.length > 2 && !/^\[add /.test(s));
  const institutionRe = /\b((?:[A-Z][A-Za-z&.']*\s+){0,4}(?:University|College|Institute|Academy|School|Extension|Polytechnic)(?:\s+of\s+[A-Z][A-Za-z]+)?)\b/g;
  const droppedInstitutions = [];
  let m;
  while ((m = institutionRe.exec(source)) !== null) {
    const inst = m[1].trim();
    if (inst.length < 6) continue;
    const kept = draftSchools.some(
      (s) => s.includes(inst.toLowerCase()) || inst.toLowerCase().includes(s)
    );
    if (!kept && !droppedInstitutions.includes(inst)) droppedInstitutions.push(inst);
  }

  // Two entries for the same degree, which is what a bad merge leaves behind.
  const seen = new Map();
  const duplicates = [];
  entries.forEach((e, i) => {
    const key = `${String(e.degree || '').toLowerCase()}|${String(e.field || '').toLowerCase()}`;
    if (key === '|') return;
    if (seen.has(key)) duplicates.push({ indexes: [seen.get(key), i], degree: e.degree });
    else seen.set(key, i);
  });

  return {
    incomplete,
    droppedInstitutions,
    duplicates,
    clean: incomplete.length === 0 && droppedInstitutions.length === 0 && duplicates.length === 0,
  };
}

// ── 7. Location audit (issue 9) ──────────────────────────────────────────────

const ONSITE_RE = /\b(?:on-?site|in-?office|in-?person|hybrid|relocat\w*|based in|must (?:live|reside|be located))\b/i;
const REMOTE_RE = /\b(?:fully remote|100% remote|remote-first|work from anywhere)\b/i;
const CITY_RE = /\b(New York(?: City)?|NYC|Brooklyn|San Francisco|SF|Bay Area|Seattle|Austin|Boston|Chicago|Los Angeles|Denver|Atlanta|London|Toronto|Berlin|Dublin|Amsterdam|Bengaluru|Bangalore|Singapore|Sydney|Tel Aviv|Washington,? D\.?C\.?)\b/gi;

/** Cities that are the same place under different names. */
const CITY_SYNONYMS = {
  nyc: 'new york', 'new york city': 'new york', brooklyn: 'new york',
  sf: 'san francisco', 'bay area': 'san francisco',
  bengaluru: 'bangalore', bangalore: 'bengaluru',
};

function canonicalCity(name) {
  const n = String(name).toLowerCase().replace(/[.,]/g, '').trim();
  return CITY_SYNONYMS[n] || n;
}

/**
 * A JD that requires in-office work in a city the candidate does not live in is
 * a decision only the candidate can make: relocate, disclose, or skip. The
 * logic had no rule for it at all, and CONTACT INFO explicitly told the model
 * location was not its concern — so nothing looked. This never edits the
 * header; it raises a question.
 */
function auditLocation(jobDescription, profileData) {
  const jd = String(jobDescription || '');
  const candidateLocation = String((profileData && profileData.location) || '').trim();

  const requiresOnsite = ONSITE_RE.test(jd) && !REMOTE_RE.test(jd);
  const jdCities = [...new Set((jd.match(CITY_RE) || []).map((c) => canonicalCity(c)))];
  const candidateCity = candidateLocation ? canonicalCity(candidateLocation.split(',')[0]) : '';

  const conflict =
    requiresOnsite &&
    jdCities.length > 0 &&
    !!candidateCity &&
    !jdCities.some((c) => c.includes(candidateCity) || candidateCity.includes(c));

  return {
    requiresOnsite,
    jdCities,
    candidateLocation,
    conflict,
    clean: !conflict,
  };
}

// ── 8. Banned language (recurring failure 3) ─────────────────────────────────

const { findBannedLanguage } = require('./writingRules');

/**
 * Banned vocabulary that survived the mechanical scrub.
 *
 * The scrub in the service handles every word it can safely substitute or
 * delete, so anything reaching here is either a phrase no machine should rewrite
 * ("proven track record") or a regression the review pass introduced after the
 * scrub ran. Both need a writer, and both need to be visible in the report:
 * these words kept coming back precisely because nobody was counting them.
 */
function auditBannedLanguage(draft) {
  const hits = [];
  const scopes = [
    ...collectSegments(draft),
    { location: 'skills', text: flattenSkills(draft.skills).join(' | ') },
  ];
  for (const seg of scopes) {
    for (const hit of findBannedLanguage(seg.text)) {
      hits.push({ ...hit, location: seg.location });
    }
  }
  return {
    hits,
    fixableHits: hits.filter((h) => h.fixable),
    clean: hits.length === 0,
  };
}

// ── 9. Skills provenance (tailoring rule 6) ──────────────────────────────────

/**
 * Where every skill in the output came from.
 *
 * The removal of unsupported skills already happens (in the service, and as a
 * fabrication finding here). This is the other half the contract asks for: a
 * DIFF the candidate can read, saying for each surviving skill whether the
 * original resume names it or an experience bullet demonstrates it. A skills
 * list is the cheapest place to lie on a resume and the first place a recruiter
 * probes, so its provenance is stated rather than assumed.
 */
function auditSkillsProvenance(draft, originalText, acceptedGaps = []) {
  const accepted = new Set(acceptedGaps.map((g) => String(g).toLowerCase().trim()));
  const bulletText = collectSegments(draft)
    .filter((s) => s.location !== 'summary')
    .map((s) => s.text)
    .join('\n');

  const items = flattenSkills(draft.skills)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .map((skill) => {
      const inOriginal = hasSupport(originalText, skill);
      const inBullet = containsTerm(bulletText, skill);
      let evidence = 'none';
      if (inOriginal) evidence = inBullet ? 'original + bullet' : 'original';
      else if (accepted.has(skill.toLowerCase())) evidence = 'accepted gap';
      else if (inBullet) evidence = 'bullet only';
      return { skill, evidence, inOriginal, inBullet };
    });

  return {
    items,
    // "Bullet only" means the term is in a tailored bullet but nowhere in the
    // original — the bullet is the fabrication, and the skill is downstream of
    // it. Reported separately so the finding points at the cause.
    bulletOnly: items.filter((i) => i.evidence === 'bullet only').map((i) => i.skill),
    unevidenced: items.filter((i) => i.evidence === 'none').map((i) => i.skill),
    clean: items.every((i) => i.evidence !== 'none' && i.evidence !== 'bullet only'),
  };
}

// ── 10. Reframing limit (tailoring rule 5) ───────────────────────────────────

const IDENTITY_QUALIFIERS = [
  'full-stack', 'full stack', 'fullstack', 'frontend', 'front-end', 'front end',
  'backend', 'back-end', 'back end', 'data', 'platform', 'mobile', 'infrastructure',
  'devops', 'machine learning', 'ml', 'security', 'qa', 'embedded', 'cloud',
  'systems', 'product', 'growth', 'analytics', 'ios', 'android', 'web',
];

const IDENTITY_RE = new RegExp(
  `\\b(${IDENTITY_QUALIFIERS.map(escapeRe).join('|')})\\s+` +
  `(engineer|developer|designer|scientist|analyst|manager|architect|lead|specialist|consultant|programmer)\\b`,
  'i'
);

/** "full-stack", "full stack" and "fullstack" are the same claim. */
function normalizeQualifier(q) {
  return String(q).toLowerCase().replace(/[\s-]/g, '');
}

/**
 * How far the summary moved the candidate's professional identity, and whether
 * the bullets can carry the move.
 *
 * The failure this exists for: a frontend engineer applying to a full-stack
 * posting comes back as a "Full-stack engineer" in the summary, with the same
 * frontend bullets underneath. Nothing was fabricated at the bullet level, which
 * is why every fabrication check passed it — the lie is in the label. A label
 * the resume below it cannot support is the single most expensive thing to be
 * caught on in an interview, and it is decidable: take the qualifier, look for
 * it in the original.
 *
 * The `title` field is exempt by design — the tailoring prompt mirrors it to the
 * posting's exact wording for ATS title matching, which is a separate,
 * deliberate rule. This checks the sentence a human reads.
 */
function auditIdentity(draft, originalText, jobDescription = '') {
  const summary = String(draft.summary || '');
  const source = String(originalText || '');

  const draftMatch = summary.match(IDENTITY_RE);
  const originalMatch = source.match(IDENTITY_RE);
  const jdMatch = String(jobDescription).match(IDENTITY_RE);

  if (!draftMatch) {
    return { draftIdentity: null, originalIdentity: originalMatch ? originalMatch[0] : null, shifted: false, supported: true, clean: true };
  }

  const draftQualifier = draftMatch[1];
  const originalQualifier = originalMatch ? originalMatch[1] : null;
  const shifted =
    !!originalQualifier && normalizeQualifier(draftQualifier) !== normalizeQualifier(originalQualifier);

  // Support for a qualifier can come from the original's prose or from a role
  // header title, which tailoring is forbidden to alter and so is as good as
  // source. Spellings vary, so every form of the compound is tried.
  const variants = [
    draftQualifier,
    String(draftQualifier).replace(/-/g, ' '),
    String(draftQualifier).replace(/[\s-]/g, ''),
    String(draftQualifier).replace(/\s/g, '-'),
  ];
  const headerTitles = (draft.experience || []).map((e) => String(e.title || '')).join(' | ');
  const supported = variants.some(
    (v) => containsTerm(source, v) || containsTerm(headerTitles, v)
  );

  // Only a shift TOWARD the posting is interesting. A candidate whose summary
  // says something the posting never asked for is a style question, not a
  // credibility one.
  const towardJd = jdMatch
    ? normalizeQualifier(jdMatch[1]) === normalizeQualifier(draftQualifier)
    : false;

  return {
    draftIdentity: draftMatch[0],
    originalIdentity: originalMatch ? originalMatch[0] : null,
    jdIdentity: jdMatch ? jdMatch[0] : null,
    qualifier: draftQualifier,
    shifted,
    towardJd,
    supported,
    conflict: shifted && !supported,
    clean: !(shifted && !supported),
  };
}

// ── 11. Requirement coverage (tailoring rule 5, GENUINE GAPS) ────────────────

/**
 * Requirements the candidate half-has.
 *
 * A requirement the original never mentions is already caught as a gap. This
 * finds the more slippery case: the term IS in the candidate's background, but
 * no experience bullet in the tailored resume demonstrates it — it survives only
 * as a word in the skills list. That is a real, partial match, and the honest
 * place for it is GENUINE GAPS with a note for the cover letter, not a summary
 * sentence claiming depth the bullets never show.
 */
function auditCoverage(draft, originalText, requiredKeywords = [], acceptedGaps = []) {
  const accepted = new Set(acceptedGaps.map((g) => String(g).toLowerCase().trim()));
  const bulletText = collectSegments(draft)
    .filter((s) => s.location !== 'summary')
    .map((s) => s.text)
    .join('\n');

  const covered = [];
  const partiallyMet = [];
  const missing = [];

  for (const kw of requiredKeywords) {
    const term = String(kw || '').trim();
    if (!term) continue;
    const inOriginal = hasSupport(originalText, term) || accepted.has(term.toLowerCase());
    const inBullet = containsTerm(bulletText, term);
    if (inOriginal && inBullet) covered.push(term);
    else if (inOriginal) partiallyMet.push(term);
    else missing.push(term);
  }

  return { covered, partiallyMet, missing };
}

// ── 12. Role tapering (tailoring rule 7) ─────────────────────────────────────

const { planRoleShapes } = require('./roleShape');

/**
 * Bullet counts against each role's allowance.
 *
 * One-directional on purpose: a role over its allowance is a defect, a role
 * under it never is. Telling the model a role is short of bullets is an
 * instruction to produce more material about a job it only knows three facts
 * about, and there is exactly one way to do that.
 */
function auditTapering(draft, { selectedBullets, now = new Date() } = {}) {
  const plan = planRoleShapes(draft.experience || [], { selected: selectedBullets, now });

  const offenders = plan
    .filter((r) => r.bullets > r.allowance.max)
    .map((r) => ({
      location: r.location,
      bullets: r.bullets,
      max: r.allowance.max,
      reason: r.allowance.reason,
      ageYears: r.ageYears === null ? null : Math.round(r.ageYears * 10) / 10,
    }));

  // Equal counts down a long history is the template tell, even when every
  // individual role sits inside its allowance.
  const spansYears = plan.some((r) => r.ageYears !== null && r.ageYears > 4);
  const counts = plan.map((r) => r.bullets);
  const uniform =
    plan.length >= 3 && spansYears && new Set(counts).size === 1 && counts[0] >= 3;

  return {
    roles: plan.map((r) => ({
      location: r.location,
      bullets: r.bullets,
      max: r.allowance.max,
      ageYears: r.ageYears === null ? null : Math.round(r.ageYears * 10) / 10,
    })),
    offenders,
    uniform,
    clean: offenders.length === 0 && !uniform,
  };
}

// ── 13. Artifact scan (issue 8) ──────────────────────────────────────────────

const { harvestCompounds, findJoinedCompounds } = require('./textNormalizer');

function auditArtifacts(draft, originalText) {
  const extra = harvestCompounds(originalText);
  const hits = [];
  for (const seg of [...collectSegments(draft), { location: 'skills', text: flattenSkills(draft.skills).join(' ') }]) {
    for (const hit of findJoinedCompounds(seg.text, extra, originalText)) {
      hits.push({ ...hit, location: seg.location });
    }
  }
  return { joinedWords: hits, clean: hits.length === 0 };
}

// ── Top-level audit ──────────────────────────────────────────────────────────

/**
 * Run every check over a finished draft.
 *
 * @param {Object} input
 * @param {Object} input.draft - The tailored resume JSON
 * @param {string} input.originalText - REQUIRED. The original resume text.
 * @param {string} input.jobDescription
 * @param {string[]} [input.jdKeywords]
 * @param {string[]} [input.requiredKeywords] - the JD's required/preferred subset
 * @param {string[]} [input.acceptedGaps]
 * @param {Object} [input.profileData]
 * @param {number} [input.selectedBullets] - the user's experienceLines setting
 * @param {Date} [input.now] - injectable clock, so role ages are testable
 * @returns {Object} Report with a `passed` flag and per-check evidence.
 */
function auditDraft({
  draft,
  originalText,
  jobDescription,
  jdKeywords = [],
  requiredKeywords = null,
  acceptedGaps = [],
  profileData = {},
  selectedBullets = undefined,
  now = new Date(),
}) {
  if (!originalText || !String(originalText).trim()) {
    // The fabrication diff is the point of this module. Without a source of
    // truth there is nothing to diff against, and silently degrading to "looks
    // fine" is how unsupported skills shipped in the first place.
    throw new Error('auditDraft requires originalText — the fabrication diff has no source of truth without it');
  }

  const metrics = auditMetrics(draft);
  const repetition = auditRepetition(draft, jdKeywords);
  const fabrication = auditFabrication(draft, originalText, acceptedGaps, jdKeywords, jobDescription);
  const summary = auditSummary(draft, jobDescription, originalText);
  const jdEcho = auditJdEcho(draft, jobDescription, originalText);
  const banned = auditBannedLanguage(draft);
  const skills = auditSkillsProvenance(draft, originalText, acceptedGaps);
  const identity = auditIdentity(draft, originalText, jobDescription);
  const coverage = auditCoverage(draft, originalText, requiredKeywords || jdKeywords, acceptedGaps);
  const tapering = auditTapering(draft, { selectedBullets, now });
  const consistency = auditConsistency(draft);
  const education = auditEducation(draft, originalText);
  const location = auditLocation(jobDescription, profileData);
  const artifacts = auditArtifacts(draft, originalText);

  const report = {
    metrics, repetition, fabrication, summary, jdEcho, banned, skills, identity,
    coverage, tapering, consistency, education, location, artifacts,
  };

  // A location conflict is a question for the candidate, never a defect in the
  // draft, so it does not block: it travels alongside the finished resume. The
  // same is true of coverage — a partially-met requirement is honest output, and
  // its destination is GENUINE GAPS, not a rewrite.
  report.passed =
    !metrics.overCap &&
    metrics.repeatedValues.length === 0 &&
    metrics.inSummary.length === 0 &&
    metrics.ghostShapes.length === 0 &&
    repetition.clean &&
    fabrication.clean &&
    summary.clean &&
    jdEcho.clean &&
    banned.clean &&
    skills.clean &&
    identity.clean &&
    tapering.clean &&
    consistency.clean &&
    education.clean &&
    artifacts.clean;

  report.blocking = buildBlockingList(report);
  report.questions = buildQuestions(report);
  // Defects that need a writer, as opposed to the ones the final scan repairs
  // in code. Only these justify an AI round: artifacts are a dictionary
  // substitution, unsupported skills are a list deletion, and the fixable half
  // of the banned list is a find-and-replace. Spending a 60-second model call on
  // any of them is how the tailoring endpoint went from two AI calls to four.
  report.needsRewrite = buildBlockingList({
    ...report,
    artifacts: { joinedWords: [], clean: true },
    fabrication: { ...report.fabrication, unsupportedSkills: [] },
    banned: { ...report.banned, hits: report.banned.hits.filter((h) => !h.fixable) },
    skills: { ...report.skills, unevidenced: [] },
  });
  return report;
}

/**
 * The subset of defects the enforcement round exists for.
 *
 * These four classes are the ones that came back run after run, each already
 * covered by a written rule. They get a second, narrower AI round of their own
 * when the general review leaves them standing, because "the review pass looked
 * at it once" is what the previous three runs also had.
 */
const HARD_CLASS_RE = /^(METRICS|REPETITION|BANNED|JD LANGUAGE|SUMMARY|SKILLS|IDENTITY|TAPERING):/;

function hardClassDefects(report) {
  return (report.blocking || []).filter((d) => HARD_CLASS_RE.test(d));
}

/** The findings the review pass must fix, phrased as instructions. */
function buildBlockingList(r) {
  const out = [];
  if (r.metrics.overCap) {
    out.push(`METRICS: ${r.metrics.count} present, cap is 4. Drop the weakest ${r.metrics.count - 4} by rephrasing their bullets without the number. Present: ${r.metrics.items.map((i) => `${i.value} [${i.location}]`).join('; ')}`);
  }
  for (const rep of r.metrics.repeatedValues) {
    out.push(`METRICS: "${rep.value}" appears in ${rep.locations.join(' and ')}. Keep the single strongest placement and rewrite the others without a number.`);
  }
  if (r.metrics.inSummary.length) {
    out.push(`METRICS: summary contains ${r.metrics.inSummary.map((i) => i.value).join(', ')}. The summary carries no numbers.`);
  }
  if (r.metrics.monotonous) {
    out.push(`METRICS: all ${r.metrics.count} metrics are the same kind (${r.metrics.kindsUsed[0]}). Keep only the ones whose bullets differ in kind.`);
  }
  for (const ghost of r.metrics.ghostShapes || []) {
    out.push(`METRICS: "${ghost.phrase}" in ${ghost.location} is a metric with the number taken out. Rewrite the bullet so it states a concrete outcome without needing one.`);
  }
  for (const off of r.repetition.phraseOffenders) {
    out.push(`REPETITION: "${off.phrase}" appears ${off.count} times (${off.locations.join(', ')}). Reduce to at most 2 by rewriting the others as specific descriptions of the work in that role.`);
  }
  for (const off of r.repetition.keywordOffenders) {
    out.push(`REPETITION: JD keyword "${off.phrase}" appears ${off.count} times, limit is 2 (${off.locations.join(', ')}).`);
  }
  for (const s of r.repetition.methodologyInSkills || []) {
    out.push(`SKILLS: "${s}" is a methodology, not a skill. Remove it from the Skills list — if the candidate works that way, the bullet that shows it is the evidence.`);
  }
  for (const hit of (r.banned && r.banned.hits) || []) {
    out.push(`BANNED: "${hit.term}" in ${hit.location}. ${hit.kind === 'abstract_closing' ? 'End the bullet at its last factual word.' : 'Rewrite the sentence with the plain word for what happened.'}`);
  }
  for (const span of (r.jdEcho && r.jdEcho.spans) || []) {
    if (span.location === 'summary') continue; // already reported by the summary check
    out.push(`JD LANGUAGE: "${span.phrase}" in ${span.location} is four or more consecutive words taken from the posting. Say it in the candidate's own words, anchored to what they actually did.`);
  }
  for (const s of (r.skills && r.skills.bulletOnly) || []) {
    out.push(`SKILLS: "${s}" appears in a tailored bullet but nowhere in the original resume. Remove the skill AND the claim in the bullet that props it up.`);
  }
  if (r.identity && r.identity.conflict) {
    out.push(`IDENTITY: the summary calls the candidate "${r.identity.draftIdentity}" but the original resume says "${r.identity.originalIdentity}" and nothing supports "${r.identity.qualifier}". Restore the honest identity and let the bullets carry whatever the posting wants.`);
  }
  for (const off of (r.tapering && r.tapering.offenders) || []) {
    out.push(`TAPERING: ${off.location} has ${off.bullets} bullets, allowance is ${off.max} (${off.reason}). Cut the weakest — never pad another role to match.`);
  }
  if (r.tapering && r.tapering.uniform) {
    out.push(`TAPERING: every role carries the same ${r.tapering.roles[0].bullets} bullets across a history spanning more than four years. Shorten the older ones.`);
  }
  if (r.summary.overLength) {
    out.push(`SUMMARY: ${r.summary.sentenceCount} sentences, maximum is 3. Cut it down.`);
  }
  for (const span of r.summary.copiedSpans) {
    out.push(`SUMMARY: "${span}" is copied verbatim from the posting. Rewrite it in the candidate's own words or remove it.`);
  }
  for (const chain of r.summary.buzzwordChains) {
    out.push(`SUMMARY: adjective chain "${chain}". Say what the person does and at what level, then stop.`);
  }
  for (const mm of r.consistency.titleMismatches) {
    out.push(`CONSISTENCY: ${mm.location} header says "${mm.headerTitle}" but a bullet says "${mm.bulletTitle}". The header title is authoritative; fix the bullet.`);
  }
  if (r.consistency.mixedDateFormats) {
    out.push(`CONSISTENCY: mixed date formats (${r.consistency.dateFormats.join(', ')}). Use one throughout.`);
  }
  for (const inst of r.education.droppedInstitutions) {
    out.push(`EDUCATION: "${inst}" is in the original resume but missing from the draft. Restore it.`);
  }
  for (const inc of r.education.incomplete) {
    out.push(`EDUCATION: entry ${inc.index + 1} is missing ${inc.missing.join(', ')}. Restore from the original or use the permitted placeholder.`);
  }
  for (const dup of r.education.duplicates) {
    out.push(`EDUCATION: duplicate entries for "${dup.degree}". Merge into the single most complete one, keeping the institution name.`);
  }
  for (const a of r.artifacts.joinedWords) {
    out.push(`ARTIFACT: "${a.found}" in ${a.location} should be "${a.suggested}".`);
  }
  for (const f of r.fabrication.unsupportedSkills) {
    out.push(`FABRICATION: skill "${f.term}" has no support in the original resume. Remove it from skills.`);
  }
  for (const f of [...r.fabrication.unsupportedSummaryClaims, ...r.fabrication.unsupportedBulletTerms]) {
    out.push(`FABRICATION: "${f.term}" in ${f.section} has no support in the original resume. Remove it, or replace it with what the original actually says.`);
  }
  return out;
}

/**
 * Findings the candidate must decide, not the model. Anything here is surfaced
 * in the product and never resolved silently in either direction.
 */
function buildQuestions(r) {
  const questions = [];
  for (const f of r.fabrication.unsupportedSkills) {
    questions.push({
      type: 'unsupported_skill',
      term: f.term,
      question: `The posting asks for ${f.term}, but your original resume never mentions it. Do you have real experience with ${f.term} that we should add, or should this stay listed as a gap?`,
    });
  }
  for (const f of r.fabrication.unsupportedSummaryClaims) {
    questions.push({
      type: 'unsupported_summary_claim',
      term: f.term,
      question: `The summary claimed "${f.term}", which nothing in your resume backs up. Have you done this work? If so, which role, so we can put it in a bullet first?`,
    });
  }
  for (const f of r.fabrication.unsupportedBulletTerms) {
    questions.push({
      type: 'unsupported_bullet_term',
      term: f.term,
      section: f.section,
      question: `"${f.term}" was added to ${f.section} but is not in your original resume. Did you do this work in that role?`,
    });
  }
  for (const inst of r.education.droppedInstitutions) {
    questions.push({
      type: 'education_restored',
      term: inst,
      question: `We restored "${inst}" to your education, which the tailoring pass had dropped. Confirm the details are right.`,
    });
  }
  for (const s of (r.skills && r.skills.unevidenced) || []) {
    questions.push({
      type: 'skill_needs_confirmation',
      term: s,
      question: `"${s}" is in the tailored skills list but nothing in your original resume evidences it. Do you have real experience with it — and in which role — or should it come out?`,
    });
  }
  if (r.identity && r.identity.conflict) {
    questions.push({
      type: 'identity_reframe',
      term: r.identity.qualifier,
      question: `The posting is written for a ${r.identity.jdIdentity || r.identity.draftIdentity}, and your resume reads as a ${r.identity.originalIdentity}. We kept the honest label. If you have ${r.identity.qualifier} work that is not on the resume, tell us the role and we will put it in a bullet first.`,
    });
  }
  // Capped. A posting with twenty requirements would otherwise produce twenty
  // questions, and a question list that long is one nobody answers — the same
  // failure as an audit that fires on good output.
  for (const term of ((r.coverage && r.coverage.partiallyMet) || []).slice(0, 5)) {
    questions.push({
      type: 'partially_met_requirement',
      term,
      question: `You have ${term} in your background, but no bullet in this resume shows it. Which role should carry it — or would you rather address it in the cover letter?`,
    });
  }
  if (r.location.conflict) {
    questions.push({
      type: 'location_conflict',
      term: r.location.jdCities.join(', '),
      question: `This role expects you on-site in ${r.location.jdCities.join(' or ')}, and your profile says ${r.location.candidateLocation}. Do you want the resume to state that you are relocating, leave the location as-is, or would you rather skip this posting?`,
    });
  }
  return questions;
}

module.exports = {
  auditDraft,
  auditMetrics,
  auditRepetition,
  auditFabrication,
  auditSummary,
  auditJdEcho,
  auditBannedLanguage,
  auditSkillsProvenance,
  auditIdentity,
  auditCoverage,
  auditTapering,
  auditConsistency,
  auditEducation,
  auditLocation,
  auditArtifacts,
  hardClassDefects,
  hasSupport,
  containsTerm,
  flattenSkills,
};
