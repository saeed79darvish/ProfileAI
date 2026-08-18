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
- proven track record / track record of / proven ability
- passionate / passion for
- results-driven / results-oriented / data-driven (as a self-description)
- innovative / innovative solutions
- detail-oriented, dynamic, seasoned, synergy, team player, go-getter,
  proactively, in order to, instrumental in, tasked with
- SELF-RATINGS, which are the same error in a different costume: expert in,
  expert at, expert-level, highly skilled, highly proficient, exceptional,
  extensive experience. A rating is a claim the reader has to take your word
  for. Show the level through what was built, at what scale, and stop —
  "Expert in React" tells a recruiter nothing that "Built the design system
  four product teams shipped on" does not tell them better.
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
  // Self-rating adjectives. Deleting the word leaves a grammatical sentence
  // ("delivered exceptional results" becomes "delivered results"), which is the
  // test for this tier — the ones that need the sentence rebuilt are below.
  'exceptional', 'innovative',
];

const BANNED_FLAG_ONLY = [
  'proven track record', 'track record of', 'proven ability',
  'passionate', 'passion for',
  'synergy', 'synergies', 'team player', 'go-getter',
  'instrumental in', 'tasked with', 'dynamic',
  // Self-ratings that open a claim rather than modify one. "Expert in React"
  // cannot lose its first two words and stay a sentence — the line has to be
  // rewritten around the evidence instead, which is a writer's job.
  'expert in', 'expert at', 'expert-level',
  'highly skilled', 'highly proficient', 'extensive experience',
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

/**
 * The vocabulary of the buzzword chain: abstract quality nouns that mean
 * something on their own and nothing in a list. Deliberately nouns only, and
 * deliberately not technologies — "React, TypeScript, and Node" is a factual
 * enumeration, "usability, accessibility, and maintainability" is three claims
 * with no anchor. The audit needs a fixed vocabulary to tell those apart, so
 * the list lives here next to the rule that describes it.
 */
const ABSTRACT_QUALITY_NOUNS = [
  'scalability', 'maintainability', 'usability', 'reliability', 'availability',
  'performance', 'quality', 'efficiency', 'flexibility', 'extensibility',
  'readability', 'robustness', 'consistency', 'observability', 'testability',
  'reusability', 'productivity', 'velocity', 'stability', 'accessibility',
  'modularity', 'interoperability', 'compliance', 'innovation', 'excellence',
];

const BANNED_BULLET_ENDINGS = `BANNED BULLET ENDINGS (abstract quality clauses)
- No bullet may end in a trailing clause that asserts a virtue instead of an
  outcome. Examples of what is banned:
    "...with a focus on scalability and maintainability"
    "...ensuring high availability and performance"
    "...driving business value across the organization"
    "...to improve overall efficiency"
- These clauses are unfalsifiable and add no information. Either state the
  concrete result (what changed, for whom, by how much) or end the bullet at
  the last factual word.
- The same ban covers the chain wherever it sits, not only at the end: three or
  more abstract quality nouns in a row ("usability, accessibility, and
  maintainability") is a list of adjectives wearing nouns' clothing. Name the
  one that the work actually turned on and say what it changed, or cut all
  three. A list of technologies is not this — "React, TypeScript, and Node" is
  a fact about the stack; the banned shape is a list of virtues.`;

const SENTENCE_STRUCTURE_VARIATION = `SENTENCE & STRUCTURE VARIATION
- Most bullets: [Action verb] + [what/how] + [outcome]. But do NOT force every
  bullet into that mold — a resume where all 14 lines share one grammatical
  shape reads as generated. Some bullets should be a single short clause.
- Vary bullet LENGTH deliberately across each role: mix short lines (8–12
  words) with longer ones (20–30). Never let a role's bullets all land within
  a few words of each other.
- Never start consecutive bullets with the same verb, and don't cycle the same
  four verbs down the whole resume. Both halves are COUNTED after you return:
  the opening word of every bullet is extracted, adjacent repeats inside a role
  are reported, and any verb opening three or more bullets anywhere in the
  resume is reported with its locations. "Built" five times is the same defect
  as one phrase five times, in the position a recruiter's eye lands first.
- Bullets inside one role must not all be the same LENGTH either. Four lines
  that each run 18 to 20 words are a template even when every word is true.
  Word counts are measured per role; a role whose bullets all land within three
  words of each other is reported.
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
 * Summary policy, shared because a summary is the same object in both modes:
 * three sentences a human reads first, and the only section where a claim can
 * be made without the work that produced it standing directly underneath.
 *
 * It is shared for a specific reason. Tailoring banned numbers in the summary
 * while five of the six enhancement prompts REQUIRED one — "Sentence 3: one
 * proof point of scale", and in the sales prompt, "the strongest real number
 * from the profile". Enhancement writes the stored profile tailoring then
 * starts from, so the two rules met in the middle and the number was already
 * there. Neither prompt was wrong on its own terms; they were never read
 * together.
 */
const SUMMARY_DISCIPLINE = `SUMMARY DISCIPLINE
- Three sentences maximum. Shorter is better than padded. This is a CEILING,
  not a target, and no user preference raises it — a length setting governs the
  EXPERIENCE descriptions only.
- NO METRICS IN THE SUMMARY. Not a percentage, not a dollar figure, not a
  headcount, not "one proof point of scale". Numbers belong in bullets, where
  the work that produced them is visible and the reader can judge them. A
  number in the summary is a claim with its evidence one section away.
- No self-rating. "Expert in", "highly skilled", "exceptional", "extensive
  experience" — say what the person does and at what level, then stop.
- No adjective stacking: "experienced, motivated, versatile engineer" is three
  words that survive being deleted.
- EVERY CLAIM IN THE SUMMARY MUST BE VISIBLE IN A BULLET BELOW IT. Before
  writing a summary sentence, point to the role and bullet carrying the
  evidence. The summary is a table of contents for the resume, not an extra
  place to make claims.
- The professional identity in the first sentence is a claim like any other. It
  may only say what the experience section shows.`;

/**
 * Skills policy. Mode-dependent for the same reason metrics are: enhancement
 * writes the record every future application draws from, so capping the list
 * there would delete real skills before any tailoring pass could choose among
 * them. Tailoring renders one resume for one posting and picks.
 */
function skillsRules(mode) {
  const shared = `- Every entry is a technology, tool, language, platform or credential a
  recruiter can verify. A way of working is not a skill: "component-driven
  design", "clean code", "best practices", "attention to detail" and
  "problem-solving" never appear in this list. The bullet that shows the
  practice is the evidence for it, and the Skills list is where such a phrase
  quietly collects the repetitions that put it over the frequency limit.
- Never pad. Every entry must be traceable to something the candidate actually
  used — the list is diffed against the source in code afterwards, and anything
  untraceable is deleted before the candidate sees it.`;
  if (mode === 'tailor') {
    return `SKILLS DISCIPLINE
${shared}
- AT MOST 15 ENTRIES across all categories combined, counted after you return.
  A 30-item list is not a stronger match; it is a list nobody reads, and it
  buries the eight terms this posting actually asked for. Keep the ones this JD
  prioritises and the ones a bullet demonstrates, and drop the rest — they are
  still in the candidate's stored profile for the next application.`;
  }
  return `SKILLS DISCIPLINE
${shared}
- No cap here. This is the candidate's record, not one application's shortlist,
  so a real skill is kept even when it is irrelevant to any posting you can
  imagine. The tailoring pass is what selects; deleting here deletes for good.`;
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
- Never three round percentages. 20%, 25% and 30% down one resume is the shape
  of numbers someone chose rather than measured, and it is counted after you
  return. When the source only offers round percentages, keep the single
  strongest and write the others as concrete outcomes with no number.
- NO RANGES. "25-30%", "3-4 weeks", "roughly 40%" — a range is an estimate, and
  an estimate presented as a measurement is the kind of number a candidate
  cannot defend when an interviewer asks how it was calculated. State the one
  real figure the source gives, or drop the number.
- EVERY NUMBER YOU RETURN IS DIFFED AGAINST THE ORIGINAL RESUME IN CODE. A
  figure that appears nowhere in the source is removed and raised with the
  candidate, whatever the sentence around it says. This is not a check you can
  satisfy by asserting the number is right.
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
  not a dollar figure, and not an estimate dressed as one. Every number in your
  output is diffed against the source in code; one that is not there is removed
  and raised with the candidate.
- Never widen a figure into a range. If the source says 25%, the output says
  25% — "25-30%" is a number the candidate never claimed and cannot defend.
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
    SUMMARY_DISCIPLINE,
    skillsRules(mode),
    metricRules(mode),
    CONSISTENCY_CHECKS,
    ATS_SAFE_FORMATTING,
    noAnnotations({ explanationField }),
  ].join('\n\n');
}

/**
 * Every banned term as a flat list, for prompts that state the ban inline
 * rather than composing the block above — the cover letter, which is prose in a
 * different genre but has no business disagreeing about which words are dead.
 * It kept its own hand-written list, and the two drifted exactly as enhancement
 * and tailoring had: the letter banned "leveraging" and "utilizing" while
 * permitting "leverage", "leveraged", "utilize" and "utilized".
 */
function bannedTerms() {
  return [
    ...Object.keys(BANNED_SUBSTITUTIONS),
    ...BANNED_DELETIONS,
    ...BANNED_FLAG_ONLY,
  ];
}

module.exports = {
  writingRules,
  readAloudCheck,
  scrubBannedLanguage,
  findBannedLanguage,
  bannedTerms,
  BANNED_SUBSTITUTIONS,
  BANNED_DELETIONS,
  BANNED_FLAG_ONLY,
  METHODOLOGY_LABEL_RE,
  ABSTRACT_QUALITY_NOUNS,
  metricRules,
  skillsRules,
  antiFabrication,
  noAnnotations,
  BANNED_VOCABULARY,
  BANNED_BULLET_ENDINGS,
  SENTENCE_STRUCTURE_VARIATION,
  SUMMARY_DISCIPLINE,
  CONSISTENCY_CHECKS,
  ATS_SAFE_FORMATTING,
};
