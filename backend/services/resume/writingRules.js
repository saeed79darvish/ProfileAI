/**
 * Shared Resume Writing Rules
 *
 * What makes a resume readable and honest doesn't depend on whether there's a
 * job description in play. Those rules live here and are composed into BOTH the
 * enhancement prompts (general quality pass, no target job) and the tailoring
 * prompts (targeted pass against one posting), so the two can't answer the same
 * question differently — which is exactly what had happened: enhancement banned
 * "leverage" and "utilized" while permitting "utilize", "seamless", "robust"
 * and "cutting-edge", because it was written from an older list and never
 * revisited.
 *
 * What stays OUT of here, deliberately:
 *   - keyword frequency limits, GENUINE GAPS, title mirroring, JD-driven
 *     reordering. These need a target job; enhancement has none.
 *   - the metric CAP. See metricRules() — the two modes genuinely differ, and
 *     copying tailoring's cap into enhancement would destroy data.
 */

const BANNED_VOCABULARY = `BANNED VOCABULARY (all grammatical forms — verb, noun, adjective, adverb)
- leverage / leveraged / leveraging
- utilize / utilized / utilizing / utilization
- spearhead / spearheaded / spearheading
- seamless / seamlessly
- robust / robustly
- cutting-edge / bleeding-edge / state-of-the-art / best-in-class / world-class
- proven track record / track record of
- passionate / passion for
- results-driven / results-oriented / data-driven (as a self-description)
- detail-oriented, dynamic, seasoned, synergy, team player, go-getter,
  proactively, in order to, instrumental in, tasked with
- Plain substitutes: used, ran, built, led, cut, moved, rewrote, set up, fixed.
  Say the actual verb for the actual action.
- THIS LIST IS NOT A PREFERENCE AND THE SOURCE DOES NOT EXEMPT IT. Most of these
  words reach the output by being copied out of the candidate's own resume, and
  "it was already there" has been the reason they came back on run after run.
  Every word above is find-and-replaced out of your draft mechanically after you
  return it, whether it came from the original or from your own tailoring. Write
  the plain word yourself so the substitution has nothing left to do — the
  machine pass cannot rewrite a sentence, only strip a word, and a sentence you
  built around "utilizing" reads worse after the strip than before it.`;

// ── The banned list, in machine-applicable form ──────────────────────────────
//
// The prose block above is what the model reads. This is what runs. They are
// deliberately in the same file: the previous arrangement had the ban written in
// one place and enforced nowhere, and "utilize" came back on three consecutive
// runs because it was in the candidate's original resume and every rule the
// model was asked to apply to its own output is a rule it can report as applied.
//
// Three tiers, by what a machine can safely do to a sentence it cannot read:
//   SUBSTITUTIONS — a word with an exact plain equivalent. Always safe.
//   DELETIONS     — a modifier that carries no information. Dropping it leaves a
//                   grammatical sentence (articles are repaired afterwards).
//   FLAG_ONLY     — phrases whose removal needs the sentence rebuilt. These are
//                   reported as defects for the review pass, never auto-edited,
//                   because a bad mechanical edit here is worse than the word.

const BANNED_SUBSTITUTIONS = {
  leverage: 'use', leverages: 'uses', leveraged: 'used', leveraging: 'using',
  utilize: 'use', utilizes: 'uses', utilized: 'used', utilizing: 'using',
  utilisation: 'use', utilization: 'use',
  spearhead: 'lead', spearheads: 'leads', spearheaded: 'led', spearheading: 'leading',
  'in order to': 'to',
};

const BANNED_DELETIONS = [
  'seamless', 'seamlessly',
  'robust', 'robustly',
  'cutting-edge', 'bleeding-edge', 'state-of-the-art', 'best-in-class', 'world-class',
  'detail-oriented', 'results-driven', 'results-oriented',
  'seasoned', 'proactively',
];

const BANNED_FLAG_ONLY = [
  'proven track record', 'track record of',
  'passionate', 'passion for',
  'synergy', 'synergies', 'team player', 'go-getter',
  'instrumental in', 'tasked with', 'dynamic',
];

/**
 * Trailing clauses that assert a virtue instead of an outcome. Only the shapes
 * with a fixed, unfalsifiable vocabulary are matched — "ensuring SOC2 controls
 * passed audit" is a fact and must survive, so `ensuring` alone is not a
 * trigger; `ensuring high availability` is.
 */
const ABSTRACT_CLOSING_PATTERNS = [
  /[,;]?\s*with\s+(?:an?\s+)?(?:strong\s+|particular\s+|special\s+|heavy\s+)?(?:focus|emphasis)\s+on\s+[^.;\n]*/gi,
  /[,;]?\s*(?:ensuring|guaranteeing)\s+(?:high|optimal|maximum|consistent|seamless|greater|improved)\s+(?:availability|performance|quality|reliability|scalability|uptime|efficiency|consistency|usability|maintainability)[^.;\n]*/gi,
  /[,;]?\s*driving\s+(?:business|customer|organizational|organisational|significant)?\s*value[^.;\n]*/gi,
  /[,;]?\s*to\s+improve\s+overall\s+[^.;\n]*/gi,
  /[,;]?\s*thereby\s+[^.;\n]*/gi,
];

// How much sentence has to survive a trim for the trim to be worth making.
// Three words is the floor because "Delivered an integration" is a sentence and
// "With a focus on maintainability" is not — a clause that opens a sentence is
// the sentence, and cutting it would leave nothing behind.
const WORDS_KEPT_AFTER_TRIM = 3;

function escapeForRe(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Match a term as a whole word, tolerating the hyphens in "cutting-edge". */
function bannedTermRe(term) {
  return new RegExp(`(?<![A-Za-z0-9])${escapeForRe(term)}(?![A-Za-z0-9])`, 'gi');
}

/** Keep the replacement's capitalisation in step with what it replaced. */
function matchCase(sample, replacement) {
  if (/^[A-Z]/.test(sample) && !/^[A-Z]/.test(replacement)) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * "a integration" after "seamless" is deleted, "an system" after "an optimal
 * system" loses its adjective. Both are artifacts of the deletion, not of the
 * writing, so they are repaired here rather than left in the resume.
 */
function fixArticles(text) {
  return String(text)
    .replace(/\ba\s+(?=[aeiou])/gi, (m) => (m[0] === 'A' ? 'An ' : 'an '))
    .replace(/\ban\s+(?![aeiou])/gi, (m) => (m[0] === 'A' ? 'A ' : 'a '));
}

function tidySpacing(text) {
  return String(text)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/[ \t]+$/gm, '');
}

/**
 * Trim abstract closing clauses, sentence by sentence.
 *
 * Per sentence, so a clause that opens one ("With a focus on accessibility, I
 * rebuilt…") is never mistaken for a trailing one, and so a trim can be
 * abandoned when it would leave a stub instead of a sentence.
 */
function trimAbstractClosings(text) {
  const trimmed = [];
  const out = String(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      let next = sentence;
      for (const re of ABSTRACT_CLOSING_PATTERNS) {
        next = next.replace(new RegExp(re.source, re.flags), (match, offset, whole) => {
          const before = whole.slice(0, offset).trim();
          // A clause is only trailing if a real sentence precedes it.
          if (before.split(/\s+/).filter(Boolean).length < WORDS_KEPT_AFTER_TRIM) return match;
          return '';
        });
      }
      next = next.trim();
      if (next !== sentence.trim()) {
        // Restore the sentence's terminator, which the clause took with it.
        if (!/[.!?]$/.test(next)) next = `${next.replace(/[,;\s]+$/, '')}.`;
        trimmed.push(tidySpacing(sentence).trim());
      }
      return next;
    })
    .join(' ');
  return { text: tidySpacing(out).trim(), trimmed };
}

/**
 * The find-and-replace pass. Runs on every draft, every run, over text that came
 * from the model AND text that survived unchanged from the candidate's original.
 *
 * @param {string} text
 * @returns {{text: string, replaced: Array<{from: string, to: string}>, residual: string[]}}
 *   `residual` is what a machine must not touch — reported as a defect instead.
 */
function scrubBannedLanguage(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { text, replaced: [], residual: [] };
  }

  let out = text;
  const replaced = [];

  for (const [term, replacement] of Object.entries(BANNED_SUBSTITUTIONS)) {
    out = out.replace(bannedTermRe(term), (match) => {
      replaced.push({ from: match, to: replacement });
      return matchCase(match, replacement);
    });
  }

  for (const term of BANNED_DELETIONS) {
    out = out.replace(bannedTermRe(term), (match) => {
      replaced.push({ from: match, to: '(removed)' });
      return '';
    });
  }

  const closings = trimAbstractClosings(out);
  out = closings.text;
  for (const clause of closings.trimmed) {
    replaced.push({ from: clause, to: '(abstract closing clause removed)' });
  }

  out = fixArticles(tidySpacing(out)).trim();

  const residual = [];
  for (const term of BANNED_FLAG_ONLY) {
    if (bannedTermRe(term).test(out)) residual.push(term);
  }

  return { text: out, replaced, residual };
}

/**
 * Read-only version: what banned language is present, without changing anything.
 * Used by the audit so the report describes the bytes being returned.
 */
function findBannedLanguage(text) {
  const found = [];
  if (typeof text !== 'string' || !text.trim()) return found;
  for (const term of Object.keys(BANNED_SUBSTITUTIONS)) {
    if (bannedTermRe(term).test(text)) found.push({ term, fixable: true });
  }
  for (const term of BANNED_DELETIONS) {
    if (bannedTermRe(term).test(text)) found.push({ term, fixable: true });
  }
  for (const term of BANNED_FLAG_ONLY) {
    if (bannedTermRe(term).test(text)) found.push({ term, fixable: false });
  }
  for (const re of ABSTRACT_CLOSING_PATTERNS) {
    const m = text.match(new RegExp(re.source, re.flags));
    if (m) found.push({ term: m[0].trim(), fixable: false, kind: 'abstract_closing' });
  }
  return found;
}

/**
 * Skills-list entries that are methodologies or philosophies rather than
 * technologies. Deliberately narrow: "Agile" and "Scrum" are industry-standard
 * ATS keywords a recruiter expects to find in a skills list, so they do not
 * match — what matches is the unfalsifiable kind ("component-driven design",
 * "clean code", "attention to detail").
 *
 * Shared between the audit that reports these and the repair that deletes them,
 * so the two can never disagree about what counts.
 */
const METHODOLOGY_LABEL_RE = /\b(?:driven|first|oriented|based)\s+(?:design|development|architecture|approach|thinking|mindset|culture)\b|\b(?:design|development|architecture)\s+(?:philosophy|principles|mindset|thinking)\b|\bbest practices\b|\bclean code\b|\bproblem[- ]solving\b|\battention to detail\b/i;

const BANNED_BULLET_ENDINGS = `BANNED BULLET ENDINGS (abstract quality clauses)
- No bullet may end in a trailing clause that asserts a virtue instead of an
  outcome. Examples of what is banned:
    "...with a focus on scalability and maintainability"
    "...ensuring high availability and performance"
    "...driving business value across the organization"
    "...to improve overall efficiency"
- These clauses are unfalsifiable and add no information. Either state the
  concrete result (what changed, for whom, by how much) or end the bullet at
  the last factual word.`;

const SENTENCE_STRUCTURE_VARIATION = `SENTENCE & STRUCTURE VARIATION
- Most bullets: [Action verb] + [what/how] + [outcome]. But do NOT force every
  bullet into that mold — a resume where all 14 lines share one grammatical
  shape reads as generated. Some bullets should be a single short clause.
- Vary bullet LENGTH deliberately across each role: mix short lines (8–12
  words) with longer ones (20–30). Never let a role's bullets all land within
  a few words of each other.
- Never start consecutive bullets with the same verb, and don't cycle the same
  four verbs down the whole resume.
- Older roles get FEWER and SHORTER bullets than recent ones — 2–3 compact
  lines for a job from eight years ago, more for the current one. A resume
  that gives equal weight to every role reads as a template, not a career.
- Roles do not all need the same bullet count. Match the count to how much
  genuinely relevant material the role has.
- Banned openers: "Responsible for," "Worked on," "Helped with," "Was part of"`;

const CONSISTENCY_CHECKS = `CONSISTENCY CHECKS
- Job titles must match everywhere: the title in a role's header, any reference
  to that role inside a bullet, and the summary must all use the same wording.
- De-duplicate education: one entry per degree. If the same school or degree
  appears twice (common when a resume was merged from two sources), merge into
  the single most complete entry.
- Fix hyphenation and capitalization consistently across the whole document:
  pick one form of each compound (full-stack vs full stack, front-end vs
  frontend) and use it everywhere. Product and technology names take their
  official casing: JavaScript, TypeScript, PostgreSQL, GitHub, Node.js, Kubernetes.
- Fix typos and grammatical errors carried over from the source resume.
- Dates use ONE format throughout (e.g. "Jan 2021 – Mar 2023" everywhere, never
  mixed with "01/2021-03/2023"). Use the same dash character in every range.`;

const ATS_SAFE_FORMATTING = `ATS-SAFE FORMATTING
- Single column only. No multi-column layouts, tables, text boxes, sidebars,
  headers/footers, images, icons, emoji, or symbol characters as bullet markers.
- Standard section headers only: Summary, Experience, Skills, Education,
  Projects, Certifications. No invented or clever section names.
- Plain text in every field. No markdown syntax (**, ##, backticks), no HTML.
- Consistent date formatting per the rule above.`;

/**
 * Both prompts return the finished resume in structured fields plus a separate
 * field explaining what changed. The rule is the same in both — apply the
 * decision, explain it elsewhere — only the name of the "elsewhere" differs.
 */
function noAnnotations({ explanationField }) {
  return `NO ANNOTATIONS IN THE RESUME (hard rule)
- The resume fields contain the FINAL resume text and nothing else. You apply
  your decisions; you never narrate them into the output.
- Never emit into summary, experience descriptions, project descriptions, or
  skills: "[LOW RELEVANCE — consider removing]", "(consider adding a metric)",
  "NOTE:", "TODO", "optional", "if applicable", "you may want to…", or any
  parenthetical addressed to the candidate.
- Every decision and suggestion goes in \`${explanationField}\`, which the
  product renders separately. Resume text is what the employer will read.
- The only bracketed text permitted anywhere in the output is a missing-fact
  placeholder in a STRUCTURED contact/education/project field — exactly
  [add phone], [add LinkedIn], [add institution name], [add graduation year],
  [add year]. These are never allowed inside summary or any description text.`;
}

/**
 * Metric policy. The one place the two modes SHOULD differ.
 *
 * Enhancement writes the stored profile — the candidate's full record, which
 * every future application draws from. Capping metrics there would delete real
 * numbers before any tailoring pass could choose between them.
 *
 * Tailoring renders one resume for one posting, so it picks the strongest few.
 *
 * What both refuse: producing a number, or a scope claim standing in for one,
 * that isn't in the source. The old enhancement rule ("Always include a metric
 * — if unknown, describe scope or scale") pushed for exactly that, in five of
 * the six department prompts.
 */
function metricRules(mode) {
  if (mode === 'tailor') {
    return `METRIC DISCIPLINE
- 3–4 metrics TOTAL across the whole resume. Not per role — per resume. Beyond
  four, each additional number weakens the ones that matter.
- Use DIFFERENT KINDS of number: one duration (cut release time from 3 weeks to
  4 days), one count (12 services, 40-person org), one dollar figure ($1.2M
  budget), one percentage. Four percentages in a row reads as invented.
- Never repeat the same percentage anywhere in the resume, and avoid two
  percentages that are suspiciously close (30% and 35% in adjacent bullets).
- Prefer specific over round. "Cut p95 latency from 840ms to 210ms" is credible;
  "improved performance by 50%" is not. If the original resume has a round
  number and no supporting detail, keep it verbatim but don't add more like it.
- Choose which of the candidate's REAL metrics to keep — the strongest 3–4,
  placed in the most JD-relevant bullets. Metrics you drop are simply not
  written; the bullet is rephrased without them. Dropping is allowed; inventing,
  changing, moving a number to a different accomplishment, or re-deriving one
  ("30% faster" becoming "saved 200 hours") is never allowed.`;
  }
  return `METRIC DISCIPLINE
- Keep every real number the candidate already has. This profile is the record
  every future application is built from, so a metric dropped here is gone for
  all of them. Preserve them exactly — never round, re-derive ("30% faster"
  becoming "saved 200 hours"), or move a number onto a different accomplishment.
- Never add a number that isn't in the source. Not a percentage, not a count,
  not a dollar figure, and not an estimate dressed as one.
- A bullet with no metric is fine. Do NOT reach for a scope or scale claim to
  fill the gap — "supported a 40-person org" is a factual claim too, and if the
  source doesn't say it, inventing it is the same error as inventing a
  percentage. Write what the candidate actually did, plainly, and stop.
- Never leave the SHAPE of a metric with the number taken out. "Used by active
  users", "reduced load time significantly", "supported a large team" are the
  scaffolding of a sentence that wanted a number and didn't have one. Rewrite
  the bullet so it reads as a complete thought without the number: "Built the
  customer dashboard" is finished; "built the dashboard used by active users"
  is not.
- Where a real metric exists but is buried in prose, surface it.`;
}

/**
 * Anti-fabrication. Identical in spirit; the destination for an uncoverable
 * requirement differs because only tailoring has a target job to be short of.
 */
function antiFabrication(mode) {
  const destination =
    mode === 'tailor'
      ? `An uncovered JD requirement goes in GENUINE GAPS. That is the only option.`
      : `If the candidate doesn't have it, it simply isn't in the resume. There is no version of this rule where the wording gets vaguer instead.`;
  return `NEVER FABRICATE
- Never invent a job, project, responsibility, skill, or metric. If the
  candidate did not do it, it does not appear anywhere in the resume — not in a
  bullet, not in skills, not softened into a vaguer claim. ${destination}
- Never remove or alter the candidate's real company names, titles, or dates.
- Never add a skill or keyword anywhere — including the skills section — that
  has no real support elsewhere in the candidate's background. A skills section
  padded with unsupported terms is the fastest way a resume gets flagged as fake
  by a recruiter or a hiring manager's own screening pass.
- Write each bullet the way this specific candidate would describe their own
  work to a peer. If a rewritten line would sound strange coming out of the
  candidate's mouth in an interview, rewrite it again.`;
}

/**
 * The last pass. Tailoring adds its own JD-specific checks on top of this.
 */
function readAloudCheck({ unverifiableDestination }) {
  return `READ-ALOUD TEST (bullet by bullet)
Go through every bullet one at a time and read it as if saying it out loud to
an interviewer. For each one ask:

- Could this candidate tell a real 2-minute story behind this line — the
  situation, what they personally did, what happened? If the honest answer is
  no, the bullet is describing work that isn't theirs or isn't real. Rewrite it
  down to what actually happened, or drop it.
- Does it sound like a person talking, or like a posting? If you would never
  say the sentence aloud, it doesn't belong in writing either.
- Would the candidate have to explain a number in this bullet and not be able
  to? Then that number goes to ${unverifiableDestination}, not into the resume
  as fact.
- Is there any skill or term here the candidate could not defend if asked about
  it in an interview? If so, remove it — an unsupported term is a liability,
  not a win, even if it improves keyword match.`;
}

/**
 * The full shared block, in reading order.
 *
 * @param {Object} opts
 * @param {'enhance'|'tailor'} opts.mode
 * @param {string} opts.explanationField - where decisions are explained instead
 * @param {string} opts.unverifiableDestination - where undefendable numbers go
 */
function writingRules({ mode, explanationField, unverifiableDestination }) {
  return [
    antiFabrication(mode),
    BANNED_VOCABULARY,
    BANNED_BULLET_ENDINGS,
    SENTENCE_STRUCTURE_VARIATION,
    metricRules(mode),
    CONSISTENCY_CHECKS,
    ATS_SAFE_FORMATTING,
    noAnnotations({ explanationField }),
  ].join('\n\n');
}

module.exports = {
  writingRules,
  readAloudCheck,
  scrubBannedLanguage,
  findBannedLanguage,
  BANNED_SUBSTITUTIONS,
  BANNED_DELETIONS,
  BANNED_FLAG_ONLY,
  METHODOLOGY_LABEL_RE,
  metricRules,
  antiFabrication,
  noAnnotations,
  BANNED_VOCABULARY,
  BANNED_BULLET_ENDINGS,
  SENTENCE_STRUCTURE_VARIATION,
  CONSISTENCY_CHECKS,
  ATS_SAFE_FORMATTING,
};
