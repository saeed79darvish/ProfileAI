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

const { auditDraft, hasSupport } = require('../services/resume/draftAudit');
const {
  repairWrappedHyphens,
  repairJoinedCompounds,
  harvestCompounds,
} = require('../services/resume/textNormalizer');

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

const bad = auditDraft({
  draft: BAD_DRAFT,
  originalText: ORIGINAL,
  jobDescription: JD,
  jdKeywords: JD_KEYWORDS,
  acceptedGaps: [],
  profileData: { location: 'San Francisco, CA' },
});

const clean = auditDraft({
  draft: CLEAN_DRAFT,
  originalText: CLEAN_ORIGINAL,
  jobDescription: CLEAN_JD,
  jdKeywords: ['React', 'TypeScript', 'design systems', 'accessibility', 'SQL'],
  acceptedGaps: [],
  profileData: { location: 'San Francisco, CA' },
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
