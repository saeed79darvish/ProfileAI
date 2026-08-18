/**
 * Regression harness for the two paths that had no enforcement at all.
 *
 *   node backend/scripts/verifyProfileGuards.js
 *
 * The tailoring path counts what it asks for; verifyDraftAudit.js proves it.
 * These two did not:
 *
 *   ENHANCEMENT wrote the stored profile every future application is built
 *   from, and checked nothing. Its prompt banned the same words tailoring bans
 *   and then asked the model to confirm it had followed them — the exact
 *   arrangement that shipped six metrics under a four-metric rule three times
 *   on the other path. Worse: five of the six department prompts REQUIRED a
 *   number in the summary that tailoring forbids, so the two rules met in the
 *   middle of a pipeline and the number was already in the profile before
 *   tailoring ever saw it.
 *
 *   THE COVER LETTER kept its own hand-written banned list, which had drifted
 *   from the shared one exactly as predicted: it banned "leveraging" and
 *   "utilizing" while permitting "leverage", "leveraged", "utilize" and
 *   "utilized". After generation, at temperature 0.95, the only thing checked
 *   was percentages.
 *
 * Fixture B in each half is the one that matters most: honest output must
 * produce ZERO findings, because an audit that fires on good work gets ignored
 * exactly like the prompt rules it replaced.
 *
 * No network, no database, no API key.
 */

const { auditProfile } = require('../services/resume/profileAudit');
const { enforceLetterRules, cleanLetter } = require('../services/coverLetterService');
const { bannedTerms } = require('../services/resume/writingRules');

const checks = [];
const check = (id, label, pass, evidence) => checks.push({ id, label, pass: !!pass, evidence });

// ── Enhancement ──────────────────────────────────────────────────────────────

/** What the candidate actually wrote. Every question is asked against this. */
const PROFILE_SOURCE = `
Frontend engineer building React interfaces for logistics products.

Frontend Engineer | Flexport | Feb 2022 - Present
Rebuilt the shipment tracking UI in React and TypeScript, improving load time by 25%.
Documented 30 shared components in Storybook.

Frontend Engineer | Convoy | Mar 2019 - Jan 2022
Built a design system used by four product teams.
Reduced bundle size by 20%.

Web Development Certificate | UCSC Silicon Valley Extension | 2017
React, TypeScript, Storybook, CSS
`;

/**
 * Fixture A: the enhancement output the old path would have returned intact.
 * Every defect here is covered by a rule in the enhancement prompt.
 */
const BAD_ENHANCED = {
  title: 'Senior Frontend Engineer',
  summary:
    'Frontend engineer with 8 years of experience building React interfaces. ' +
    'Expert in component architecture and highly skilled at design systems. ' +
    'Delivered exceptional results across 12 product teams. ' +
    'Serving millions of users daily.',
  skills: ['React', 'TypeScript', 'Storybook', 'CSS', 'component-driven design', 'GraphQL'],
  experience: [
    {
      company: 'Flexport',
      title: 'Frontend Engineer',
      period: 'Feb 2022 - Present',
      description:
        'Built the shipment tracking UI in React and TypeScript.\n' +
        'Built the shared component library in Storybook.\n' +
        'Improved rendering performance significantly.\n' +
        'Cut error rates by 45% [consider adding more detail].',
    },
    {
      company: 'Convoy',
      title: 'Frontend Engineer',
      period: 'Mar 2019 - Jan 2022',
      description:
        'Designed a design system, improving usability, accessibility, and maintainability.\n' +
        'Reduced bundle size by 20%.',
    },
  ],
  education: [{ institution: '', degree: 'Web Development Certificate', field: '', period: '2017' }],
  projects: [],
};

const badProfile = auditProfile({ profile: BAD_ENHANCED, sourceText: PROFILE_SOURCE });

check('E1', 'A number in the SUMMARY is a defect, whatever the department prompt asked for',
  badProfile.metrics.inSummary.length > 0 &&
    badProfile.blocking.some((b) => /^SUMMARY:.*carries no numbers/.test(b)),
  badProfile.metrics.inSummary.map((m) => m.value).join(', ') || 'none');

check('E2', 'A number that is not in the candidate\'s own profile is caught',
  badProfile.metrics.invented.some((i) => /45\s?%/.test(i.value)),
  badProfile.metrics.invented.map((i) => `${i.value}[${i.location}]`).join(', ') || 'none');

check('E2b', 'Real numbers the candidate wrote are NOT touched, and there is no cap here',
  badProfile.metrics.invented.every((i) => !/20\s?%/.test(i.value)) &&
    !badProfile.blocking.some((b) => /cap is 4/.test(b)),
  'the record keeps every real figure; only tailoring picks');

check('E3', 'Self-ratings are caught',
  badProfile.banned.hits.some((h) => h.term === 'expert in') &&
    badProfile.banned.hits.some((h) => h.term === 'highly skilled'),
  badProfile.banned.hits.map((h) => `${h.term}[${h.location}]`).join(', ') || 'none');

check('E4', 'A metric with the number taken out is caught',
  badProfile.metrics.ghostShapes.some((g) => /significantly/i.test(g.phrase)),
  badProfile.metrics.ghostShapes.map((g) => g.phrase).join(' | ') || 'none');

check('E5', 'Two bullets in a row opening with the same verb are caught',
  badProfile.variation.adjacentRepeats.some((a) => a.opener === 'built'),
  JSON.stringify(badProfile.variation.adjacentRepeats));

check('E6', 'A chain of abstract qualities is caught',
  badProfile.variation.buzzwordChains.some((c) => /usability, accessibility, and maintainability/.test(c.chain)),
  badProfile.variation.buzzwordChains.map((c) => c.chain).join(' | ') || 'none');

check('E7', 'A dropped institution is caught and the incomplete entry is questioned',
  badProfile.education.droppedInstitutions.some((i) => /UCSC/i.test(i)) &&
    badProfile.questions.some((q) => q.type === 'education_incomplete'),
  `dropped=${JSON.stringify(badProfile.education.droppedInstitutions)}`);

check('E8', 'A skill the profile never mentions is questioned rather than kept quietly',
  badProfile.questions.some((q) => q.type === 'skill_needs_confirmation' && /graphql/i.test(q.term)),
  badProfile.skills.unevidenced.join(', ') || 'none');

check('E9', 'The bad enhancement fails overall',
  badProfile.passed === false && badProfile.blocking.length >= 6,
  `passed=${badProfile.passed} blocking=${badProfile.blocking.length}`);

check('E10', 'Only the defects that need a WRITER buy a model round',
  badProfile.needsRewrite.length > 0 &&
    badProfile.needsRewrite.length < badProfile.blocking.length &&
    !badProfile.needsRewrite.some((d) => /^ARTIFACT:/.test(d)),
  `${badProfile.needsRewrite.length} of ${badProfile.blocking.length} need a rewrite`);

/** Fixture B: honest enhancement of the same profile. Must be silent. */
const GOOD_ENHANCED = {
  title: 'Frontend Engineer',
  summary:
    'Frontend engineer who builds React and TypeScript interfaces for logistics products. ' +
    'Works on design systems and the shared component libraries other teams build on.',
  skills: ['React', 'TypeScript', 'Storybook', 'CSS'],
  experience: [
    {
      company: 'Flexport',
      title: 'Frontend Engineer',
      period: 'Feb 2022 - Present',
      description:
        'Rebuilt the shipment tracking UI in React and TypeScript, cutting load time by 25%.\n' +
        'Documented 30 shared components in Storybook so other teams stopped rewriting them.\n' +
        'Owns the tracking surface.',
    },
    {
      company: 'Convoy',
      title: 'Frontend Engineer',
      period: 'Mar 2019 - Jan 2022',
      description:
        'Built the design system four product teams shipped on.\n' +
        'Reduced bundle size by 20%.',
    },
  ],
  education: [
    {
      institution: 'UCSC Silicon Valley Extension',
      degree: 'Web Development Certificate',
      field: 'Web Development',
      period: '2017',
    },
  ],
  projects: [],
};

const goodProfile = auditProfile({ profile: GOOD_ENHANCED, sourceText: PROFILE_SOURCE });

check('E11', 'An honest enhancement produces ZERO findings',
  goodProfile.passed && goodProfile.blocking.length === 0,
  goodProfile.blocking.join(' // ') || 'no findings');

check('E12', 'Missing source is a hard error, not a silent pass',
  (() => {
    try {
      auditProfile({ profile: GOOD_ENHANCED, sourceText: '' });
      return false;
    } catch (e) {
      return /nothing to check/.test(e.message);
    }
  })(),
  'auditProfile throws without sourceText');

// ── Cover letter ─────────────────────────────────────────────────────────────

const LETTER_SOURCE = JSON.stringify({
  experience: [
    { company: 'Flexport', title: 'Frontend Engineer', description: 'Rebuilt tracking UI. Documented 30 shared components.' },
  ],
  skills: ['React', 'TypeScript'],
});

const BAD_LETTER = `Dear Hiring Manager,

The Frontend Engineer role at Acme stood out, in particular the tracking work. I utilized React heavily at Flexport, leveraging TypeScript across the stack.

I built the component library there. It cut rendering time by 40%. We shipped 30 shared components. I am highly skilled at design systems.

Would love to talk more about the tracking work if you are open to it.

Best,
Alex Rivera`;

const cleanedBad = enforceLetterRules(cleanLetter(BAD_LETTER), LETTER_SOURCE);

check('L1', 'Banned words the letter\'s own list missed are now substituted',
  !/utiliz/i.test(cleanedBad) && !/leverag/i.test(cleanedBad),
  cleanedBad.split('\n').find((l) => /React/.test(l)) || '(line gone)');

check('L1b', 'The letter and the resume now share ONE banned list',
  ['leverage', 'leveraged', 'utilize', 'utilized', 'expert in', 'highly skilled']
    .every((t) => bannedTerms().includes(t)),
  `${bannedTerms().length} shared terms`);

check('L2', 'A percentage is dropped with its sentence',
  !/40\s?%/.test(cleanedBad),
  'percentage sentence removed');

check('L3', 'A number the profile does not contain is dropped',
  !/\b40\b/.test(cleanedBad),
  'unsupported figure removed');

check('L3b', 'A number the profile DOES contain survives',
  /30 shared components/.test(cleanedBad),
  'real counts are kept');

check('L4', 'A self-rating sentence is dropped, not left standing',
  !/highly skilled/i.test(cleanedBad),
  'declared expertise removed');

check('L5', 'The letter still reads as a letter: greeting, paragraphs, sign-off',
  /^Dear Hiring Manager,/.test(cleanedBad) &&
    /\n\nBest,\nAlex Rivera$/.test(cleanedBad) &&
    cleanedBad.split(/\n{2,}/).length >= 3,
  JSON.stringify(cleanedBad.slice(-30)));

const GOOD_LETTER = `Dear Hiring Manager,

The Frontend Engineer role at Acme stood out, in particular the tracking work. That has been most of my job for the last three years.

At Flexport I rebuilt the shipment tracking UI. The old one redrew the whole table on every poll, so I moved it to incremental updates. Documented 30 shared components along the way.

Would love to talk more about the tracking work if you are open to it.

Best,
Alex Rivera`;

check('L6', 'An honest letter passes through untouched',
  enforceLetterRules(cleanLetter(GOOD_LETTER), LETTER_SOURCE) === GOOD_LETTER,
  'no sentence lost from clean copy');

// ── Run ──────────────────────────────────────────────────────────────────────

let failed = 0;
for (const c of checks) {
  if (!c.pass) failed++;
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  [${c.id}] ${c.label}`);
  console.log(`        ${c.evidence}`);
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);

if (process.argv.includes('--verbose')) {
  console.log(`\nEnhancement defects (${badProfile.blocking.length}):`);
  badProfile.blocking.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
  console.log(`\nQuestions for the candidate (${badProfile.questions.length}):`);
  badProfile.questions.forEach((q, i) => console.log(`  ${i + 1}. [${q.type}] ${q.question}`));
  console.log('\nCleaned letter:\n');
  console.log(cleanedBad);
}

process.exit(failed ? 1 : 0);
