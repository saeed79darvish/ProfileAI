/**
 * Regression harness for the tailoring review pass.
 *
 *   node backend/scripts/verifyDraftAudit.js
 *
 * Fixture A replays the nine defects that shipped on a frontend engineer's
 * resume tailored to a Sigma Computing posting. Each was covered by a written
 * rule in the tailoring prompt at the time, and each shipped anyway, because
 * the rule was checked by the same model call that wrote the text. Every one
 * must now be caught by draftAudit.js, which counts instead of asking.
 *
 * Fixture B is the other half, and the easier one to forget: an honest,
 * well-tailored draft must produce ZERO findings. An audit that fires on good
 * output gets ignored, and an ignored audit enforces exactly as much as the
 * prompt rules it replaced.
 *
 * No network, no database, no API key.
 */

const {
  auditDraft,
  auditMetrics,
  auditVariation,
  auditConsistency,
  auditSkillsProvenance,
  findEstimatedMetrics,
  hasSupport,
  hardClassDefects,
} = require('../services/resume/draftAudit');
const {
  repairWrappedHyphens,
  repairJoinedCompounds,
  harvestCompounds,
} = require('../services/resume/textNormalizer');
const { scrubBannedLanguage, findBannedLanguage } = require('../services/resume/writingRules');
const { planRoleShapes, countBullets } = require('../services/resume/roleShape');

// Role ages are arithmetic against today, so the fixtures pin a clock. Without
// this the tapering checks would start failing on their own in a year's time,
// which is the least useful kind of test failure there is.
const NOW = new Date('2026-08-17T00:00:00Z');

const ORIGINAL = `
Alex Rivera
San Francisco, CA

Summary
Frontend engineer focused on React applications and design systems.

Experience
Wells Fargo | Full Stack Web Developer | Jan 2021 - Mar 2023
Built internal banking dashboards in React and TypeScript. Improved page load
performance by 25%. Worked with PostgreSQL-backed services.

Chegg | Frontend Engineer | Jun 2018 - Dec 2020
Built a component-driven design system used across four product teams.
Cut bundle size by 30%.

Education
Web Development Certificate, UCSC Silicon Valley Extension, 2017
`;

const JD = `
Sigma Computing - Senior Frontend Engineer - New York, NY
This role is in-office in NYC four days per week.
You will build real-time visualization systems for large datasets.
Requirements: React, TypeScript, SQL, Python, strong computer science fundamentals,
component-driven design, performance optimization.
`;

const JD_KEYWORDS = [
  'React', 'TypeScript', 'SQL', 'Python',
  'component-driven design', 'performance optimization', 'visualization',
];

/** Fixture A: the draft that shipped, reproducing all nine defects. */
const BAD_DRAFT = {
  title: 'Senior Frontend Engineer',
  summary:
    'Frontend engineer with strong computer science fundamentals and experience building real-time visualization systems. ' +
    'Delivered 25-30% performance gains across enterprise products. ' +
    'Skilled in component-driven design, performance optimization, and reusable components. ' +
    'Experienced, motivated, versatile engineer. ' +
    'Focused on component-driven design at scale. ' +
    'Brings performance optimization expertise to every team.',
  skills: ['React', 'TypeScript', 'SQL', 'Python', 'PostgreSQL', 'component-driven design'],
  experience: [
    {
      company: 'Wells Fargo',
      title: 'Full Stack Web Developer',
      period: 'Jan 2021 - Mar 2023',
      description:
        'Served as Senior Frontend React Developer building banking dashboards. ' +
        'Drove performance optimization improving load time by 25%. ' +
        'Applied componentdriven design with reusable components. ' +
        'Partnered with crossfunctional teams on 30% faster delivery.',
    },
    {
      company: 'Chegg',
      title: 'Frontend Engineer',
      period: '06/2018-12/2020',
      description:
        'Built a component-driven design system with reusable components. ' +
        'Led performance optimization reducing bundle size by 30%. ' +
        'Improved rendering by 20% using component-driven design and reusable components.',
    },
  ],
  education: [{ school: '', degree: 'Web Development Certificate', field: '', year: '2017' }],
  projects: [],
};

/** Fixture B: honest tailoring of the same resume. Must pass silently. */
const CLEAN_JD = `
Acme - Senior Frontend Engineer - Remote (fully remote)
Requirements: React, TypeScript, design systems, accessibility, SQL.
`;

const CLEAN_ORIGINAL = ORIGINAL.replace(
  'Improved page load\nperformance by 25%. Worked with PostgreSQL-backed services.',
  "Improved page load performance, cutting p95 render from 840ms to 210ms.\nWorked with PostgreSQL-backed services and wrote the team's accessibility checklist."
);

const CLEAN_DRAFT = {
  title: 'Senior Frontend Engineer',
  summary:
    'Frontend engineer who builds React and TypeScript interfaces for banking and education products. ' +
    'Owns design systems end to end and treats accessibility as part of the build, not a later pass.',
  skills: ['React', 'TypeScript', 'PostgreSQL', 'accessibility', 'design systems'],
  experience: [
    {
      company: 'Wells Fargo',
      title: 'Full Stack Web Developer',
      period: 'Jan 2021 - Mar 2023',
      description:
        'Built internal banking dashboards in React and TypeScript. ' +
        'Cut p95 render time from 840ms to 210ms. ' +
        'Wrote the accessibility checklist the team still screens against.',
    },
    {
      company: 'Chegg',
      title: 'Frontend Engineer',
      period: 'Jun 2018 - Dec 2020',
      description:
        'Built the component-driven design system four product teams shipped on. ' +
        'Cut bundle size by 30%. Mentored two junior engineers.',
    },
  ],
  education: [
    {
      school: 'UCSC Silicon Valley Extension',
      degree: 'Web Development Certificate',
      field: 'Web Development',
      year: '2017',
    },
  ],
  projects: [],
};

// ── Run ──────────────────────────────────────────────────────────────────────

/**
 * Fixture C: the three-run regression set. Every defect here was covered by a
 * written rule in the tailoring prompt and shipped anyway on three consecutive
 * runs, because the rule was enforced by asking the model to confirm it had
 * followed it.
 *
 * All five of the original's metrics carried through untouched, one phrase used
 * five times, "utilizing" and "seamless" inherited from the original resume, a
 * qualification lifted word-for-word out of the posting, a frontend engineer
 * relabelled full-stack, a JD skill with no backing, and four roles carrying
 * four bullets each across eight years.
 */
const RECURRING_ORIGINAL = `
Sam Okafor
Summary
Frontend engineer building React interfaces for logistics products.

Experience
Flexport | Frontend Engineer | Feb 2022 - Present
Rebuilt the shipment tracking UI in React and TypeScript, improving load time by 25%.
Utilizing Storybook, documented 30 shared components. Cut error rates by 30%.

Convoy | Frontend Engineer | Mar 2019 - Jan 2022
Built a component-driven design system adopted by 25% more teams each quarter.
Delivered seamless integration with the carrier portal. Reduced bundle size by 20%.

Zulily | Web Developer | Jun 2016 - Feb 2019
Maintained the checkout flow in Angular. Wrote the team's testing guidelines.

Nordstrom | Junior Developer | Jul 2015 - May 2016
Built internal reporting pages in jQuery.

Education
BS Computer Science, University of Washington, 2015
`;

const RECURRING_JD = `
Databricks - Senior Full-Stack Engineer - Remote
You will own features end to end across our data visualization platform.
Requirements: React, TypeScript, Python, backend service development,
data visualization, and experience designing scalable component systems.
`;

const RECURRING_KEYWORDS = ['React', 'TypeScript', 'Python', 'data visualization', 'component-driven design'];

const RECURRING_DRAFT = {
  title: 'Senior Full-Stack Engineer',
  summary:
    'Full-stack engineer who owns features end to end across data visualization platforms. ' +
    'Skilled in component-driven design and scalable component systems.',
  skills: ['React', 'TypeScript', 'Python', 'Storybook', 'component-driven design'],
  experience: [
    {
      company: 'Flexport',
      title: 'Frontend Engineer',
      period: 'Feb 2022 - Present',
      description:
        'Rebuilt shipment tracking in React, improving load time by 25%. ' +
        'Utilizing Storybook, documented 30 shared components. ' +
        'Owned features end to end across the tracking surface. ' +
        'Cut error rates by 30%.',
    },
    {
      company: 'Convoy',
      title: 'Frontend Engineer',
      period: 'Mar 2019 - Jan 2022',
      description:
        'Built a component-driven design system adopted by 25% more teams each quarter. ' +
        'Delivered seamless integration with the carrier portal. ' +
        'Reduced bundle size by 20%. ' +
        'Extended component-driven design to the shipper app.',
    },
    {
      company: 'Zulily',
      title: 'Web Developer',
      period: 'Jun 2016 - Feb 2019',
      description:
        'Maintained the checkout flow in Angular, with a focus on maintainability. ' +
        'Wrote the testing guidelines, lifting coverage to 30%. ' +
        'Applied component-driven design to shared widgets. ' +
        'Improved rendering significantly.',
    },
    {
      company: 'Nordstrom',
      title: 'Junior Developer',
      period: 'Jul 2015 - May 2016',
      description:
        'Built internal reporting pages in jQuery. ' +
        'Partnered with analysts on report layouts. ' +
        'Documented the reporting stack. ' +
        'Supported a large team of merchandisers.',
    },
  ],
  education: [{ school: 'University of Washington', degree: 'BS', field: 'Computer Science', year: '2015' }],
  projects: [],
};

const bad = auditDraft({
  draft: BAD_DRAFT,
  originalText: ORIGINAL,
  jobDescription: JD,
  jdKeywords: JD_KEYWORDS,
  acceptedGaps: [],
  profileData: { location: 'San Francisco, CA' },
  now: NOW,
});

const clean = auditDraft({
  draft: CLEAN_DRAFT,
  originalText: CLEAN_ORIGINAL,
  jobDescription: CLEAN_JD,
  jdKeywords: ['React', 'TypeScript', 'design systems', 'accessibility', 'SQL'],
  acceptedGaps: [],
  profileData: { location: 'San Francisco, CA' },
  now: NOW,
});

const recurring = auditDraft({
  draft: RECURRING_DRAFT,
  originalText: RECURRING_ORIGINAL,
  jobDescription: RECURRING_JD,
  jdKeywords: RECURRING_KEYWORDS,
  requiredKeywords: RECURRING_KEYWORDS,
  acceptedGaps: [],
  profileData: { location: 'Seattle, WA' },
  selectedBullets: 5,
  now: NOW,
});

const checks = [];
const check = (id, label, pass, evidence) => checks.push({ id, label, pass: !!pass, evidence });

check('1', 'Fabricated skills (SQL, Python) caught',
  ['sql', 'python'].every((t) => bad.fabrication.unsupportedSkills.some((s) => s.term.toLowerCase() === t)),
  bad.fabrication.unsupportedSkills.map((s) => s.term).join(', '));

check('1b', 'PostgreSQL still supports itself but not SQL (substring bug fixed)',
  hasSupport(ORIGINAL, 'PostgreSQL') && !hasSupport(ORIGINAL, 'SQL'),
  `hasSupport(PostgreSQL)=${hasSupport(ORIGINAL, 'PostgreSQL')} hasSupport(SQL)=${hasSupport(ORIGINAL, 'SQL')}`);

check('2', 'Unsupported summary claim (visualization) caught',
  bad.fabrication.unsupportedSummaryClaims.some((c) => /visualization/i.test(c.term)),
  bad.fabrication.unsupportedSummaryClaims.map((c) => c.term).join(' | '));

check('3', 'Metric cap, repeated value, and summary metric all counted',
  bad.metrics.overCap && bad.metrics.repeatedValues.length > 0 && bad.metrics.inSummary.length > 0,
  `count=${bad.metrics.count} repeated=${bad.metrics.repeatedValues.map((r) => r.value).join(',')} inSummary=${bad.metrics.inSummary.length}`);

check('4', 'Keyword and phrase repetition counted',
  bad.repetition.keywordOffenders.length > 0 && bad.repetition.phraseOffenders.length > 0,
  [...bad.repetition.keywordOffenders, ...bad.repetition.phraseOffenders].map((o) => `"${o.phrase}"x${o.count}`).join(', '));

check('5', 'JD text copied into summary + summary over length',
  bad.summary.overLength && bad.summary.copiedSpans.some((s) => /computer science fundamentals/.test(s)),
  `sentences=${bad.summary.sentenceCount} copied=${JSON.stringify(bad.summary.copiedSpans)}`);

check('6', 'Wells Fargo header/bullet title mismatch caught',
  bad.consistency.titleMismatches.some((m) => /Wells Fargo/.test(m.location)),
  JSON.stringify(bad.consistency.titleMismatches));

check('7', 'Dropped institution and incomplete education caught',
  bad.education.droppedInstitutions.some((i) => /UCSC/i.test(i)) && bad.education.incomplete.length > 0,
  `dropped=${JSON.stringify(bad.education.droppedInstitutions)}`);

check('8', 'Line-wrap artifacts caught',
  ['componentdriven', 'crossfunctional'].every((w) => bad.artifacts.joinedWords.some((a) => a.found.toLowerCase() === w)),
  bad.artifacts.joinedWords.map((a) => `${a.found} to ${a.suggested}`).join(', '));

check('8b', 'Artifacts repaired on ingest and on output',
  repairWrappedHyphens('a component-\ndriven system') === 'a component-driven system' &&
    repairJoinedCompounds('componentdriven and crossfunctional', harvestCompounds(ORIGINAL), ORIGINAL) ===
      'component-driven and cross-functional',
  'both substitutions exact');

check('8c', 'Legitimate joined spellings left alone',
  bad.artifacts.joinedWords.every((a) => !/^frontend$/i.test(a.found)),
  '"Frontend" not rewritten to "Front-end"');

check('9', 'On-site NYC vs San Francisco conflict raised as a question',
  bad.location.conflict && bad.questions.some((q) => q.type === 'location_conflict'),
  `jdCities=${JSON.stringify(bad.location.jdCities)} candidate=${bad.location.candidateLocation}`);

check('10', 'Mixed date formats caught', bad.consistency.mixedDateFormats,
  JSON.stringify(bad.consistency.dateFormats));

check('11', 'Bad draft fails overall', bad.passed === false,
  `passed=${bad.passed} blocking=${bad.blocking.length}`);

check('12', 'Fabrications become questions, never silent edits',
  bad.questions.filter((q) => q.type.startsWith('unsupported')).length >= 3,
  `${bad.questions.length} question(s)`);

check('13', 'CLEAN draft passes with zero findings', clean.passed && clean.blocking.length === 0,
  clean.blocking.length ? clean.blocking.join(' // ') : 'no findings');

check('14', 'Before/after pair counts as ONE metric, not two',
  clean.metrics.count === 2 && clean.metrics.items.some((i) => i.kind === 'before_after'),
  clean.metrics.items.map((i) => `${i.value}(${i.kind})`).join(', '));

check('15', 'A skills-section listing does not trip the repetition limit',
  clean.repetition.keywordOffenders.length === 0,
  'React/TypeScript in summary + one bullet + skills is fine');

check('16', 'Remote posting raises no location conflict', clean.location.conflict === false,
  `conflict=${clean.location.conflict}`);

// ── The three-run regression set ─────────────────────────────────────────────

check('R1', 'All five original metrics carried through: over cap and repeats counted',
  recurring.metrics.overCap && recurring.metrics.count >= 5 && recurring.metrics.repeatedValues.length > 0,
  `count=${recurring.metrics.count} values=${recurring.metrics.items.map((i) => i.value).join(',')} repeated=${recurring.metrics.repeatedValues.map((r) => r.value).join(',')}`);

check('R2', 'Phrase used 3+ times is reported with an at-most-2 instruction',
  recurring.repetition.phraseOffenders.some((o) => /component-driven design/.test(o.phrase)) &&
    recurring.blocking.some((b) => /^REPETITION:.*component-driven design.*at most 2/i.test(b)),
  recurring.repetition.phraseOffenders.map((o) => `"${o.phrase}"x${o.count}`).join(', '));

check('R2b', 'Everything used twice or more is listed, not only the offenders',
  recurring.repetition.repeatedTwicePlus.length > recurring.repetition.phraseOffenders.length,
  `${recurring.repetition.repeatedTwicePlus.length} phrase(s) at 2+, ${recurring.repetition.phraseOffenders.length} over the limit`);

check('R2c', 'A methodology in the Skills list is a defect',
  recurring.repetition.methodologyInSkills.includes('component-driven design'),
  JSON.stringify(recurring.repetition.methodologyInSkills));

check('R3', 'Banned words inherited from the ORIGINAL are still caught',
  recurring.banned.hits.some((h) => /utiliz/i.test(h.term)) &&
    recurring.banned.hits.some((h) => /seamless/i.test(h.term)),
  recurring.banned.hits.map((h) => `${h.term}[${h.location}]`).join(', '));

check('R3b', 'The find-and-replace pass rewrites them without touching the facts',
  (() => {
    const r = scrubBannedLanguage('Utilizing Storybook, documented 30 shared components. Delivered a seamless integration, with a focus on maintainability.');
    return r.text === 'Using Storybook, documented 30 shared components. Delivered an integration.' &&
      r.replaced.length === 3 &&
      /30 shared components/.test(r.text);
  })(),
  JSON.stringify(scrubBannedLanguage('Utilizing Storybook, documented 30 shared components. Delivered a seamless integration, with a focus on maintainability.')));

check('R3c', 'A factual "ensuring" clause survives; an abstract one does not',
  scrubBannedLanguage('Rebuilt the audit trail, ensuring SOC2 controls passed the annual review.').replaced.length === 0 &&
    scrubBannedLanguage('Rebuilt the audit trail, ensuring high availability across regions.').replaced.length === 1,
  'only the unfalsifiable clause is trimmed');

check('R4', 'JD language copied into a BULLET is caught, not just the summary',
  recurring.jdEcho.spans.some((s) => s.location !== 'summary'),
  recurring.jdEcho.spans.map((s) => `"${s.phrase}"[${s.location}]`).join(' | ') || 'none');

check('R4b', 'Words the candidate\'s own resume already uses are not flagged as copied',
  !recurring.jdEcho.spans.some((s) => /component-driven design system/.test(s.phrase)),
  'agreement with the posting is not mirroring');

check('R5', 'Frontend engineer relabelled full-stack is caught and questioned',
  recurring.identity.conflict &&
    recurring.questions.some((q) => q.type === 'identity_reframe') &&
    recurring.blocking.some((b) => /^IDENTITY:/.test(b)),
  `draft="${recurring.identity.draftIdentity}" original="${recurring.identity.originalIdentity}" supported=${recurring.identity.supported}`);

check('R5b', 'A partially-met requirement becomes a gap question, never a relabel',
  recurring.coverage.partiallyMet.length > 0 || recurring.coverage.missing.includes('Python'),
  `partial=${JSON.stringify(recurring.coverage.partiallyMet)} missing=${JSON.stringify(recurring.coverage.missing)}`);

check('R6', 'A JD skill with no backing is unevidenced and asked about',
  recurring.skills.unevidenced.includes('Python') &&
    recurring.questions.some((q) => /python/i.test(q.term || '')),
  `unevidenced=${JSON.stringify(recurring.skills.unevidenced)}`);

check('R6b', 'Every surviving skill carries its provenance',
  recurring.skills.items.every((i) => typeof i.evidence === 'string' && i.evidence.length > 0) &&
    recurring.skills.items.some((i) => i.evidence.startsWith('original')),
  recurring.skills.items.map((i) => `${i.skill}=${i.evidence}`).join(', '));

check('R7', 'Four bullets on an eight-year-old role is over its allowance',
  recurring.tapering.offenders.some((o) => /Nordstrom/.test(o.location)) &&
    recurring.tapering.offenders.some((o) => /Zulily/.test(o.location)),
  recurring.tapering.roles.map((r) => `${r.location}=${r.bullets}/${r.max}`).join(' | '));

check('R7b', 'Uniform bullet counts across a long history are flagged on their own',
  recurring.tapering.uniform,
  `counts=${recurring.tapering.roles.map((r) => r.bullets).join(',')}`);

check('R7c', 'Recent roles keep the user\'s selected count; older ones taper',
  (() => {
    const plan = planRoleShapes(RECURRING_DRAFT.experience, { selected: 5, now: NOW });
    return plan[0].allowance.max === 5 && plan[1].allowance.max === 5 &&
      plan[2].allowance.max === 3 && plan[3].allowance.max === 2;
  })(),
  planRoleShapes(RECURRING_DRAFT.experience, { selected: 5, now: NOW }).map((r) => `${r.company}=${r.allowance.max}`).join(', '));

check('R7d', 'Bullets are counted from lines when present, sentences otherwise',
  countBullets('One thing.\nTwo things.\nThree.') === 3 && countBullets('One thing. Two things.') === 2,
  'both shapes counted');

check('R8', 'A metric emptied of its number is caught as a ghost shape',
  recurring.metrics.ghostShapes.some((g) => /significantly/i.test(g.phrase)) &&
    recurring.metrics.ghostShapes.some((g) => /large team/i.test(g.phrase)),
  recurring.metrics.ghostShapes.map((g) => g.phrase).join(' | '));

check('R9', 'The four recurring classes are separable for the enforcement round',
  (() => {
    const hard = hardClassDefects(recurring);
    return hard.length > 0 && hard.length < recurring.blocking.length &&
      hard.every((d) => /^(METRICS|REPETITION|BANNED|JD LANGUAGE|SUMMARY|SKILLS|IDENTITY|TAPERING):/.test(d));
  })(),
  `${hardClassDefects(recurring).length} hard-class of ${recurring.blocking.length} total`);

check('R10', 'The recurring draft fails overall', recurring.passed === false,
  `passed=${recurring.passed} blocking=${recurring.blocking.length}`);

check('R11', 'The clean draft still passes every NEW check too',
  clean.banned.clean && clean.jdEcho.clean && clean.skills.clean &&
    clean.identity.clean && clean.tapering.clean && clean.metrics.ghostShapes.length === 0,
  `banned=${clean.banned.hits.length} jdEcho=${clean.jdEcho.spans.length} skills=${JSON.stringify(clean.skills.unevidenced)} identity=${clean.identity.clean} tapering=${clean.tapering.clean}`);

// ── The avoid-list additions ─────────────────────────────────────────────────
//
// Everything below was on the reviewed contract and enforced by prompt text
// alone: the model was told, and nothing counted. The invented metric is the
// one that matters most — a fabricated skill was caught by the term diff, a
// fabricated NUMBER was caught by nothing, and a draft that made one up passed
// every metric check by staying under the cap and not repeating itself.

check('N1', 'A number that is nowhere in the original is caught as invented',
  bad.metrics.invented.some((i) => /20\s?%/.test(i.value)) &&
    bad.blocking.some((b) => /^METRICS:.*appears nowhere in the original/.test(b)),
  bad.metrics.invented.map((i) => `${i.value}[${i.location}] missing ${i.missing.join('/')}`).join(', ') || 'none');

check('N1b', 'The candidate is asked about it rather than only losing it',
  bad.questions.some((q) => q.type === 'invented_metric'),
  bad.questions.filter((q) => q.type === 'invented_metric').map((q) => q.term).join(', ') || 'none');

check('N1c', 'A real number written as a word is NOT called invented',
  (() => {
    const r = auditDraft({
      draft: { summary: '', skills: [], experience: [{ company: 'Acme', title: 'Engineer', period: 'Jan 2021 - Mar 2023', description: 'Shipped 3 services.' }], education: [], projects: [] },
      originalText: 'Acme | Engineer | Jan 2021 - Mar 2023\nShipped three services.',
      jobDescription: 'Engineer',
    });
    return r.metrics.invented.length === 0;
  })(),
  '"three services" in the source supports "3 services" in the draft');

check('N2', 'A range is caught as an estimate, not accepted as a measurement',
  bad.metrics.estimates.some((e) => /25\s?-\s?30\s?%/.test(e.phrase)),
  bad.metrics.estimates.map((e) => `${e.phrase}[${e.location}]`).join(', ') || 'none');

check('N2b', 'A hedged number is caught the same way',
  findEstimatedMetrics({ experience: [{ description: 'Cut review time by roughly 40%.' }] }).length === 1,
  '"roughly 40%" is an estimate');

check('N3', 'Three round percentages are flagged even when other kinds are present',
  (() => {
    const items = auditMetrics({
      experience: [{ description: 'Cut load by 20%. Grew adoption 25%. Raised coverage 30%. Shipped 12 services.' }],
    }).roundPercentages;
    return items.length === 3;
  })(),
  'all-multiples-of-five percentages counted');

check('N3b', 'Irregular percentages are left alone',
  auditMetrics({ experience: [{ description: 'Cut load 23%. Grew adoption 31%. Raised coverage 47%.' }] }).roundPercentages.length === 0,
  'real measurements are irregular and pass');

check('N4', 'Two bullets in a row opening with the same verb are caught',
  auditVariation({
    experience: [{ company: 'Acme', description: 'Built the dashboard.\nBuilt the API.\nCut latency.' }],
  }).adjacentRepeats.length === 1,
  'adjacent opener repeat reported');

check('N4b', 'One verb opening three bullets anywhere is caught',
  auditVariation({
    experience: [
      { company: 'A', description: 'Built the dashboard.\nCut latency.' },
      { company: 'B', description: 'Built the API.\nShipped the docs.' },
      { company: 'C', description: 'Built the pipeline.\nWrote the runbook.' },
    ],
  }).repeatedOpeners.some((o) => o.opener === 'built' && o.count === 3),
  'cross-role opener repetition counted');

check('N5', 'A role whose bullets are all the same length is caught',
  recurring.variation.uniformLengthRoles.some((u) => /Nordstrom/.test(u.location)),
  recurring.variation.uniformLengthRoles.map((u) => `${u.location}=${u.lengths.join('/')}`).join(' | ') || 'none');

check('N6', 'A chain of abstract quality nouns in a bullet is caught',
  auditVariation({
    experience: [{ company: 'Acme', description: 'Rebuilt the design system, improving usability, accessibility, and maintainability.' }],
  }).buzzwordChains.length === 1,
  'three virtues in a row reported');

check('N6b', 'A list of technologies is NOT a buzzword chain',
  auditVariation({
    experience: [{ company: 'Acme', description: 'Built the service in React, TypeScript, and Node.' }],
  }).buzzwordChains.length === 0,
  'a factual stack list passes');

check('N7', 'Self-ratings are banned vocabulary now, in both tiers',
  (() => {
    const flagged = findBannedLanguage('Expert in React and highly skilled at scaling teams.');
    const deleted = scrubBannedLanguage('Delivered exceptional results for the team.');
    return flagged.some((h) => h.term === 'expert in' && !h.fixable) &&
      flagged.some((h) => h.term === 'highly skilled') &&
      deleted.text === 'Delivered results for the team.';
  })(),
  'declared expertise is flagged; the adjective is deleted');

check('N8', 'A skills list over 15 entries is capped',
  (() => {
    const many = Array.from({ length: 18 }, (_, i) => `Skill${i}`);
    const r = auditSkillsProvenance({ skills: many, experience: [] }, many.join(', '), []);
    return r.overCap && r.count === 18 && r.cap === 15;
  })(),
  '18 entries reported against a cap of 15');

check('N9', 'Company capitalization is corrected against the original',
  (() => {
    const r = auditConsistency(
      { experience: [{ company: 'Paypal', title: 'Engineer', period: 'Jan 2021 - Mar 2023' }] },
      'PayPal | Engineer | Jan 2021 - Mar 2023'
    );
    return r.companyCasing.length === 1 && r.companyCasing[0].inOriginal === 'PayPal';
  })(),
  '"Paypal" reported against the original "PayPal"');

check('N10', 'The clean draft still passes every added check',
  clean.metrics.invented.length === 0 && clean.metrics.estimates.length === 0 &&
    clean.metrics.roundPercentages.length === 0 && clean.variation.clean &&
    clean.consistency.companyCasing.length === 0 && !clean.skills.overCap,
  `invented=${clean.metrics.invented.length} estimates=${clean.metrics.estimates.length} variation=${clean.variation.clean} skillsCount=${clean.skills.count}`);

check('17', 'Missing original is a hard error, not a silent pass',
  (() => {
    try {
      auditDraft({ draft: CLEAN_DRAFT, originalText: '', jobDescription: JD });
      return false;
    } catch (e) {
      return /source of truth/.test(e.message);
    }
  })(),
  'auditDraft throws without originalText');

let failed = 0;
for (const c of checks) {
  if (!c.pass) failed++;
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  [${c.id}] ${c.label}`);
  console.log(`        ${c.evidence}`);
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);

if (process.argv.includes('--verbose')) {
  console.log(`\nInstructions the review pass receives (${bad.blocking.length}):`);
  bad.blocking.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
  console.log(`\nQuestions surfaced to the candidate (${bad.questions.length}):`);
  bad.questions.forEach((q, i) => console.log(`  ${i + 1}. [${q.type}] ${q.question}`));
}

process.exit(failed ? 1 : 0);
