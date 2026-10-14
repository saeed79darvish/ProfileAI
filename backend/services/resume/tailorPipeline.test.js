/**
 * End-to-end test of tailorProfileForJob with the AI calls scripted.
 *
 * `createMessage` from ai/core is stubbed in the require cache before
 * resumeParserService is loaded, so every AI round in the pipeline returns text
 * this test chose. That makes the parts of the pipeline that are NOT the model
 * — the title override, the requirement reconciliation, the gap report, the
 * verification block — testable, which is the point: the reported defect was a
 * resume titled "Senior Software Engineer" for a Staff posting, and nothing in
 * the pipeline measured the title at all.
 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ── Stub ai/core before resumeParserService requires it ─────────────────────
const corePath = require.resolve('../ai/core');
const realCore = require('../ai/core');

/** Queue of replies, consumed in order by each AI round. */
let scripted = [];
/** Every prompt the pipeline sent, for asserting on what the model was told. */
let sentPrompts = [];

require.cache[corePath] = {
  id: corePath,
  filename: corePath,
  loaded: true,
  exports: {
    ...realCore,
    supportsTemperature: () => false,
    extractText: (response) => response.__text,
    createMessage: async (_client, request) => {
      sentPrompts.push(request);
      if (scripted.length === 0) {
        throw new Error(`unscripted AI call #${sentPrompts.length}`);
      }
      return { __text: scripted.shift() };
    },
  },
};

const servicePath = require.resolve('../resumeParserService');
delete require.cache[servicePath];
const resumeParserService = require('../resumeParserService');

// ── Fixtures ────────────────────────────────────────────────────────────────

const RESUME_TEXT = `
Ada Lovelace — Senior Software Engineer

Acme Corp, Senior Software Engineer, 2021 - Present
• Built and operated billing services in Go on Kubernetes
• Led the migration of the payments pipeline for a single team
• Mentored two junior engineers

Analytical Engines, Software Engineer, 2018 - 2021
• Wrote backend services in Go
`.trim();

const PROFILE = {
  title: 'Senior Software Engineer',
  summary: 'Backend engineer.',
  skills: ['Go', 'Kubernetes'],
  location: 'Remote',
  experience: [
    { company: 'Acme Corp', title: 'Senior Software Engineer', startDate: '2021-01', current: true, description: 'Built billing services' },
    { company: 'Analytical Engines', title: 'Software Engineer', startDate: '2018-01', endDate: '2021-01', description: 'Backend services' },
  ],
  education: [{ school: 'Somewhere', degree: 'BSc', field: 'Maths', year: '2018' }],
};

const JOB_DESCRIPTION = `
We are hiring an engineer for our platform team. You will design distributed
systems, own architecture across several teams, and mentor senior engineers.
Requires 8+ years of professional software engineering experience, deep Go and
Kubernetes knowledge, and experience in regulated fintech environments.
`.trim();

const REQUIREMENTS = [
  '8+ years of professional software engineering experience',
  'own architecture across several teams',
  'mentor senior engineers',
  'experience in regulated fintech environments',
];

const keywordReply = () =>
  JSON.stringify({
    required: ['Go', 'Kubernetes', 'distributed systems'],
    preferred: [],
    soft: ['mentoring'],
    domain: ['distributed systems'],
    orGroups: [],
    requirements: REQUIREMENTS,
    jobTitle: 'Staff Software Engineer',
    company: 'Acme Corp',
  });

/**
 * A tailored draft. `title` is a parameter because the whole question is what
 * happens when the model returns the wrong one.
 */
const draftReply = ({ title, requirementCoverage }) =>
  JSON.stringify({
    jobTitle: title,
    company: 'Acme Corp',
    title,
    summary: 'Backend engineer who builds billing systems in Go. Operates them on Kubernetes.',
    skills: { Languages: ['Go'], Infrastructure: ['Kubernetes'] },
    experience: [
      { company: 'Acme Corp', title: 'Senior Software Engineer', period: '2021 - Present', description: '• Built and operated billing services in Go on Kubernetes\n• Mentored two junior engineers' },
      { company: 'Analytical Engines', title: 'Software Engineer', period: '2018 - 2021', description: '• Wrote backend services in Go' },
    ],
    education: [{ school: 'Somewhere', degree: 'BSc', field: 'Maths', year: '2018' }],
    projects: [],
    matchScore: 74,
    requirementCoverage,
    matchAnalysis: {
      keywordMatch: '3 of 3',
      titleMatch: 'Close',
      experienceMatch: 'Strong on Go, lighter on scope.',
      top3Gaps: [],
      strongMatches: ['Go', 'Kubernetes'],
      gaps: [],
      skillsToConfirm: [],
      needsVerification: [],
      locationFlag: null,
      recommendation: 'Address the multi-team scope in the cover letter.',
    },
    selfAudit: {},
    changelog: [],
  });

const tailor = (overrides = {}) =>
  resumeParserService.tailorProfileForJob(
    PROFILE,
    JOB_DESCRIPTION,
    RESUME_TEXT,
    null,
    null,
    { jobTitle: 'Staff Software Engineer', company: 'Acme Corp', ...overrides }
  );

/** The user-message text of a recorded AI request. */
const promptOf = (request) => request.messages[0].content;

beforeEach(() => {
  scripted = [];
  sentPrompts = [];
});

/** Enough replies to satisfy every round the pipeline might take. */
function script(draft) {
  scripted = [keywordReply(), draft];
  // The review/enforcement rounds are optional; if they fire, hand them back
  // the same resume so they are accepted as no-ops rather than throwing.
  for (let i = 0; i < 4; i++) scripted.push(JSON.stringify({ resume: {}, fixes: [], openQuestions: [] }));
}

// ── The reported defect ─────────────────────────────────────────────────────

test('a model that returns the wrong seniority band is corrected in code', async () => {
  script(
    draftReply({
      // The exact failure: the posting is Staff, the model wrote Senior.
      title: 'Senior Software Engineer',
      requirementCoverage: REQUIREMENTS.map((r) => ({ requirement: r, status: 'demonstrated' })),
    })
  );

  const result = await tailor();
  assert.equal(result.success, true, result.error);
  assert.equal(result.data.title, 'Staff Software Engineer');
  assert.equal(result.data.jobTitle, 'Staff Software Engineer');
});

test('the correction is recorded, not silent', async () => {
  script(
    draftReply({
      title: 'Senior Software Engineer',
      requirementCoverage: REQUIREMENTS.map((r) => ({ requirement: r, status: 'demonstrated' })),
    })
  );

  const { data } = await tailor();
  assert.equal(data.verification.title.correctedInCode, true);
  assert.equal(data.verification.title.returnedByModel, 'Senior Software Engineer');
  assert.equal(data.verification.title.target, 'Staff Software Engineer');
  assert.equal(data.verification.title.postingBand, 'staff');
  assert.equal(data.verification.title.compliant, true); // compliant AFTER the fix
  const entry = data.changelog.find((c) => c.action === 'title_corrected');
  assert.ok(entry, 'no changelog entry for the corrected title');
  assert.match(entry.detail, /Staff Software Engineer/);
});

test('a model that gets the title right is left alone', async () => {
  script(
    draftReply({
      title: 'Staff Software Engineer',
      requirementCoverage: REQUIREMENTS.map((r) => ({ requirement: r, status: 'demonstrated' })),
    })
  );

  const { data } = await tailor();
  assert.equal(data.title, 'Staff Software Engineer');
  assert.equal(data.verification.title.correctedInCode, false);
  assert.ok(!data.changelog.some((c) => c.action === 'title_corrected'));
});

test('with no posting title the candidate’s own title is not overwritten', async () => {
  scripted = [
    JSON.stringify({ ...JSON.parse(keywordReply()), jobTitle: '', company: '' }),
    draftReply({ title: 'Senior Software Engineer', requirementCoverage: [] }),
  ];
  for (let i = 0; i < 4; i++) scripted.push(JSON.stringify({ resume: {}, fixes: [], openQuestions: [] }));

  const { data } = await tailor({ jobTitle: '', company: '' });
  assert.equal(data.title, 'Senior Software Engineer');
  assert.equal(data.verification.title.target, null);
});

test('the scraped header title beats the model’s reading of the posting body', async () => {
  // The header is the literal title element on the page; the keyword call's
  // `jobTitle` is an inference from body text that often omits the title.
  scripted = [
    JSON.stringify({ ...JSON.parse(keywordReply()), jobTitle: 'Senior Software Engineer' }),
    draftReply({ title: 'Senior Software Engineer', requirementCoverage: [] }),
  ];
  for (let i = 0; i < 4; i++) scripted.push(JSON.stringify({ resume: {}, fixes: [], openQuestions: [] }));

  const { data } = await tailor({ jobTitle: 'Staff Software Engineer' });
  assert.equal(data.title, 'Staff Software Engineer');
});

// ── The target role actually reaching the prompt ────────────────────────────

test('the tailoring prompt is told the target role', async () => {
  script(draftReply({ title: 'Staff Software Engineer', requirementCoverage: [] }));
  await tailor();

  // Call 1 is keyword extraction; call 2 is the tailoring round.
  const tailoringPrompt = promptOf(sentPrompts[1]);
  assert.match(tailoringPrompt, /Posting title: Staff Software Engineer/);
  assert.match(tailoringPrompt, /"Staff" is not "Senior"/);
});

test('the substantive requirements reach the tailoring prompt', async () => {
  script(draftReply({ title: 'Staff Software Engineer', requirementCoverage: [] }));
  await tailor();

  const tailoringPrompt = promptOf(sentPrompts[1]);
  for (const r of REQUIREMENTS) {
    assert.ok(tailoringPrompt.includes(r), `requirement never reached the prompt: ${r}`);
  }
});

// ── Requirement coverage and the gap report ─────────────────────────────────

test('unmet requirements become gaps the candidate can see', async () => {
  script(
    draftReply({
      title: 'Staff Software Engineer',
      requirementCoverage: [
        { requirement: REQUIREMENTS[0], status: 'demonstrated', evidence: 'Two roles since 2018' },
        { requirement: REQUIREMENTS[1], status: 'partial', evidence: 'single-team ownership only' },
        { requirement: REQUIREMENTS[2], status: 'partial', evidence: 'mentored juniors, not seniors' },
        { requirement: REQUIREMENTS[3], status: 'missing' },
      ],
    })
  );

  const { data } = await tailor();
  const gapText = data.genuineGaps.map((g) => g.requirement);

  assert.ok(gapText.includes(REQUIREMENTS[1]), 'multi-team scope gap missing from the report');
  assert.ok(gapText.includes(REQUIREMENTS[2]), 'mentoring-seniors gap missing from the report');
  assert.ok(gapText.includes(REQUIREMENTS[3]), 'fintech domain gap missing from the report');
  // A demonstrated requirement is not a gap.
  assert.ok(!gapText.includes(REQUIREMENTS[0]));

  const scopeGap = data.genuineGaps.find((g) => g.requirement === REQUIREMENTS[1]);
  assert.equal(scopeGap.status, 'partially met');
  assert.match(scopeGap.note, /single-team ownership only/);
});

test('a requirement the model skipped is reported as unassessed, never as met', async () => {
  script(
    draftReply({
      title: 'Staff Software Engineer',
      // Only two of the four assessed — the pipeline must not infer the rest.
      requirementCoverage: [
        { requirement: REQUIREMENTS[0], status: 'demonstrated' },
        { requirement: REQUIREMENTS[1], status: 'demonstrated' },
      ],
    })
  );

  const { data } = await tailor();
  assert.equal(data.verification.requirements.total, 4);
  assert.equal(data.verification.requirements.demonstrated, 2);
  assert.equal(data.verification.requirements.unassessed, 2);
  assert.deepEqual(data.verification.requirements.notAssessed.sort(), [REQUIREMENTS[2], REQUIREMENTS[3]].sort());

  const gapText = data.genuineGaps.map((g) => g.requirement);
  assert.ok(gapText.includes(REQUIREMENTS[2]));
  assert.ok(gapText.includes(REQUIREMENTS[3]));
});

test('requirement coverage on the payload matches what was asked about', async () => {
  script(
    draftReply({
      title: 'Staff Software Engineer',
      requirementCoverage: [
        { requirement: 'something nobody asked about', status: 'demonstrated' },
        { requirement: REQUIREMENTS[0], status: 'demonstrated' },
      ],
    })
  );

  const { data } = await tailor();
  assert.equal(data.requirementCoverage.length, 4);
  assert.ok(!data.requirementCoverage.some((c) => /nobody asked/.test(c.requirement)));
});

// ── Regressions in the surrounding pipeline ─────────────────────────────────

test('a truncated draft still yields a resume with the right title', async () => {
  // repairTruncatedJSON recovers the resume and loses the metadata tail. The
  // title override must still apply to what survives.
  const full = draftReply({ title: 'Senior Software Engineer', requirementCoverage: [] });
  scripted = [keywordReply(), full.slice(0, Math.floor(full.length * 0.55))];
  for (let i = 0; i < 4; i++) scripted.push(JSON.stringify({ resume: {}, fixes: [], openQuestions: [] }));

  const result = await tailor();
  assert.equal(result.success, true, result.error);
  assert.equal(result.data.title, 'Staff Software Engineer');
});

test('keyword extraction failing does not lose the scraped title', async () => {
  scripted = ['not json at all', draftReply({ title: 'Senior Software Engineer', requirementCoverage: [] })];
  for (let i = 0; i < 4; i++) scripted.push(JSON.stringify({ resume: {}, fixes: [], openQuestions: [] }));

  const { data } = await tailor();
  // The header title is independent of the keyword call, so it still applies.
  assert.equal(data.title, 'Staff Software Engineer');
});

test('tailoring without an original resume or a populated profile is refused', async () => {
  const result = await resumeParserService.tailorProfileForJob({}, JOB_DESCRIPTION, null, null, null, {
    jobTitle: 'Staff Software Engineer',
  });
  assert.equal(result.success, false);
  assert.match(result.error, /nothing to check the result against/);
});

test('the verification block still reports the pre-existing checks', async () => {
  script(draftReply({ title: 'Staff Software Engineer', requirementCoverage: [] }));
  const { data } = await tailor();
  for (const key of ['metrics', 'phraseFrequency', 'bannedWords', 'jdLanguage', 'skills', 'identity', 'summary', 'title', 'requirements']) {
    assert.ok(key in data.verification, `verification lost its ${key} section`);
  }
});

// ── Placeholders and tenure, end to end ─────────────────────────────────────
// Both of these reached a real candidate's finished PDF.

test('placeholder education never survives to the returned resume', async () => {
  const draft = JSON.parse(draftReply({ title: 'Staff Software Engineer', requirementCoverage: [] }));
  draft.education = [
    { school: 'UCSC Silicon Valley Extension', degree: 'Full Stack Development Certificate', field: 'Bootcamp', year: '2018' },
    { school: '[add institution name]', degree: '[add degree]', field: 'Computer Programming, Specific Applications', year: '[add graduation year]' },
  ];
  script(JSON.stringify(draft));

  const { data } = await tailor();
  assert.ok(!/\[\s*add/i.test(JSON.stringify(data.education)), 'placeholder text survived');
  // Education is copied from the stored record, so whatever the model wrote —
  // placeholders included — is discarded wholesale rather than repaired.
  assert.equal(data.education.length, 1);
  assert.equal(data.education[0].school, 'Somewhere');
  assert.equal(data.education[0].year, '2018');
  assert.ok(data.changelog.some((c) => c.action === 'restored_from_source'));
});

test('education fields the model dropped are restored from the source', async () => {
  // The reported defect: "UCSC Silicon Valley Extension — Full Stack
  // Development Certificate, 2018" came back as bare "Software Engineering
  // Bootcamp", with the institution and the year gone.
  const draft = JSON.parse(draftReply({ title: 'Staff Software Engineer', requirementCoverage: [] }));
  draft.education = [{ school: '', degree: 'Software Engineering Bootcamp', field: '', year: '' }];
  script(JSON.stringify(draft));

  const { data } = await tailor();
  assert.equal(data.education[0].school, 'Somewhere', 'the institution stayed dropped');
  assert.equal(data.education[0].year, '2018', 'the year stayed dropped');
});

test('a tenure claim the dates cannot support is removed from the summary', async () => {
  const draft = JSON.parse(draftReply({ title: 'Staff Software Engineer', requirementCoverage: [] }));
  // PROFILE's dated roles run 2018 -> now; claim far beyond that.
  draft.summary = 'Backend engineer who has spent eighteen years building billing systems in Go.';
  script(JSON.stringify(draft));

  const { data } = await tailor();
  assert.ok(!/eighteen years/i.test(data.summary), `inflated claim survived: ${data.summary}`);
  assert.equal(data.verification.tenure.compliant, false);
  assert.ok(data.verification.tenure.removedAsUnsupported.length > 0);
  assert.ok((data.openQuestions || []).some((q) => q.type === 'tenure_claim_removed'));
  assert.ok(data.changelog.some((c) => c.action === 'tenure_corrected'));
});

test('an honest tenure claim is left alone', async () => {
  const draft = JSON.parse(draftReply({ title: 'Staff Software Engineer', requirementCoverage: [] }));
  draft.summary = 'Engineer with three years building billing systems in Go on Kubernetes.';
  script(JSON.stringify(draft));

  const { data } = await tailor();
  assert.match(data.summary, /three years/);
  assert.equal(data.verification.tenure.compliant, true);
});

test('the verification block reports tenure whether or not a claim was made', async () => {
  script(draftReply({ title: 'Staff Software Engineer', requirementCoverage: [] }));
  const { data } = await tailor();
  assert.equal(typeof data.verification.tenure.yearsSupportedByDates, 'number');
  assert.ok(Array.isArray(data.verification.tenure.claimsInSummary));
});

// ── Truncated replies ───────────────────────────────────────────────────────

test('a reply cut inside the experience section restores the missing roles', async () => {
  const full = draftReply({ title: 'Staff Software Engineer', requirementCoverage: [] });
  // Cut inside the SECOND role's first key — the exact shape of the reported
  // failure ("company" is the first key of every experience entry).
  const at = full.indexOf('"company":"Analytical Engines"') + '"company":"Analyt'.length;
  scripted = [keywordReply(), full.slice(0, at)];
  for (let i = 0; i < 4; i++) scripted.push(JSON.stringify({ resume: {}, fixes: [], openQuestions: [] }));

  const result = await tailor();
  assert.equal(result.success, true, result.error);
  // The role the cut removed comes back from the source rather than vanishing.
  const companies = result.data.experience.map((e) => e.company);
  assert.ok(companies.includes('Acme Corp'));
  assert.ok(companies.includes('Analytical Engines'), 'a job silently disappeared from the resume');
});

test('an unrecoverable reply produces a readable error, not a parser message', async () => {
  scripted = [keywordReply(), 'I am unable to produce that resume.'];
  const result = await tailor();
  assert.equal(result.success, false);
  assert.ok(!/position \d+|Unterminated|JSON/.test(result.error), `raw parser text shown: ${result.error}`);
  assert.match(result.error, /try again/i);
});

test('the model is no longer asked to write out a selfAudit block', async () => {
  script(draftReply({ title: 'Staff Software Engineer', requirementCoverage: [] }));
  await tailor();
  const prompt = promptOf(sentPrompts[1]);
  const contract = prompt.slice(prompt.indexOf('═══ OUTPUT FORMAT ═══'));
  // ~2,000 tokens nothing read, which pushed real resumes past max_tokens.
  assert.ok(!/"selfAudit"\s*:/.test(contract), 'selfAudit is still in the output contract');
});

test('the headline is the role; the team name stays with the employer', async () => {
  script(draftReply({ title: 'Software Engineer, Agentic Runtime', requirementCoverage: [] }));
  const { data } = await tailor({ jobTitle: 'Software Engineer, Agentic Runtime', company: 'Glean' });
  assert.equal(data.title, 'Software Engineer', 'a team name reached the headline');
  // The exact posting title is kept for the record and the filename.
  assert.equal(data.jobTitle, 'Software Engineer, Agentic Runtime');
  assert.equal(data.verification.title.compliant, true);
});

test('a posting with no seniority band does not get one', async () => {
  script(draftReply({ title: 'Senior Software Engineer', requirementCoverage: [] }));
  const { data } = await tailor({ jobTitle: 'Software Engineer, Agentic Runtime', company: 'Glean' });
  assert.equal(data.title, 'Software Engineer');
  assert.equal(data.verification.title.correctedInCode, true);
});

test('accepted gaps do not come back under still-missing in the list the extension shows', async () => {
  const draft = JSON.parse(draftReply({ title: 'Staff Software Engineer', requirementCoverage: [] }));
  draft.matchAnalysis.gaps = [
    'NestJS and TypeORM (required stack): no NestJS anywhere',
    'GCP (stack item): the resume shows AWS only.',
    'Experience operating services in a regulated environment: not evidenced',
  ];
  draft.matchAnalysis.top3Gaps = ['NestJS', 'GCP', 'regulated environment'];
  script(JSON.stringify(draft));

  const result = await resumeParserService.tailorProfileForJob(
    PROFILE, JOB_DESCRIPTION, RESUME_TEXT,
    { acceptedGaps: ['NestJS', 'GCP'], skippedGaps: [], acceptedGapObjects: [] },
    null, { jobTitle: 'Staff Software Engineer', company: 'Acme Corp' }
  );
  const gaps = result.data.matchAnalysis.gaps;
  assert.ok(!gaps.some((g) => /^NestJS/.test(g)), `accepted NestJS still listed: ${gaps}`);
  assert.ok(!gaps.some((g) => /^GCP/.test(g)), `accepted GCP still listed: ${gaps}`);
  assert.ok(gaps.some((g) => /regulated/.test(g)), 'a real gap was removed');
  assert.deepEqual(result.data.matchAnalysis.top3Gaps, ['regulated environment']);
  // And they are on the resume, under honest framing.
  assert.ok(result.data.skills.includes('NestJS') && result.data.skills.includes('GCP'));
});
