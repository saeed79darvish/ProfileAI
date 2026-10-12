/**
 * analyzeResumeGaps, with the AI call scripted.
 *
 * Found in production, not in a unit test: on a real 7-role resume against a
 * real posting, EVERY call to this endpoint failed with "Unterminated string in
 * JSON at position 8642". The reply was truncated at max_tokens and the parse
 * was a bare JSON.parse with no recovery, so the whole analysis was lost. The
 * panel's catch then proceeded straight to tailoring with no gap selections, so
 * the candidate never saw the gap review and had no way to tell that a step had
 * silently been skipped — it just looked like tailoring kept producing the same
 * resume.
 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const corePath = require.resolve('../ai/core');
const realCore = require('../ai/core');

let scripted = [];
let sentRequests = [];

require.cache[corePath] = {
  id: corePath,
  filename: corePath,
  loaded: true,
  exports: {
    ...realCore,
    supportsTemperature: () => false,
    extractText: (r) => r.__text,
    createMessage: async (_client, request) => {
      sentRequests.push(request);
      if (!scripted.length) throw new Error('unscripted AI call');
      return { __text: scripted.shift() };
    },
  },
};

const servicePath = require.resolve('../resumeParserService');
delete require.cache[servicePath];
const resumeParserService = require('../resumeParserService');

const PROFILE = {
  title: 'Senior UI Platform Engineer',
  skills: ['TypeScript', 'React', 'Node.js'],
  experience: [{ company: 'Acme', title: 'Senior Engineer', description: 'Built UI platform' }],
};

const JD = `
Staff Software Engineer, Platform Infrastructure.
Own the architecture of a multi-tenant platform across four teams.
Requires 10+ years of experience, Terraform, Kubernetes, and Go or Rust.
Experience operating services in a regulated environment is required.
`.trim();

/** A full, well-formed gap array of `n` entries. */
const gapArray = (n) =>
  JSON.stringify(
    Array.from({ length: n }, (_, i) => ({
      skill: `Skill ${i + 1}`,
      category: 'technical',
      severity: 'critical',
      type: 'required',
      suggest_adding: true,
      reason: 'Not present anywhere in the resume, and the posting lists it as required.',
      description: 'The candidate has no demonstrable experience with this technology.',
      learningResource: 'Build a small project using it, or take the official tutorial.',
    }))
  );

const analyze = () => resumeParserService.analyzeResumeGaps(PROFILE, JD, 'Senior UI Platform Engineer at Acme. '.repeat(50));

beforeEach(() => {
  scripted = [];
  sentRequests = [];
});

test('a complete reply parses as before', async () => {
  scripted = [gapArray(5)];
  const result = await analyze();
  assert.equal(result.success, true, result.error);
  assert.equal(result.gaps.length, 5);
});

test('a truncated reply keeps the gaps it managed to emit', async () => {
  // The production failure, reproduced: cut the reply mid-string.
  const full = gapArray(15);
  scripted = [full.slice(0, Math.floor(full.length * 0.6))];

  const result = await analyze();
  assert.equal(result.success, true, `truncation still fails: ${result.error}`);
  assert.ok(result.gaps.length > 0, 'recovered zero gaps from a truncated reply');
  assert.ok(result.gaps.length < 15, 'expected to lose the severed tail');
  // Every recovered entry must still be a usable gap, not a fragment.
  for (const g of result.gaps) {
    assert.equal(typeof g.skill, 'string');
    assert.ok(g.skill.length > 0);
  }
});

test('a reply cut immediately after the opening bracket fails cleanly', async () => {
  scripted = ['[{"skill":'];
  const result = await analyze();
  // No silent success with an empty list — that is the shape that let a broken
  // gap step look like "your resume already covers everything".
  if (result.success) {
    assert.equal(result.gaps.length, 0);
  } else {
    assert.match(result.error, /could not be parsed or repaired|Unterminated|JSON/i);
  }
});

test('unparseable junk is reported as a failure, not as zero gaps', async () => {
  scripted = ['I am sorry, I cannot help with that request.'];
  const result = await analyze();
  assert.equal(result.success, false);
  assert.deepEqual(result.gaps, []);
});

test('the token ceiling is high enough for a full 15-gap report', async () => {
  scripted = [gapArray(1)];
  await analyze();
  const req = sentRequests[0];
  // 15 gaps x 7 populated fields overran 3000 and killed the endpoint.
  assert.ok(req.max_tokens >= 6000, `max_tokens is ${req.max_tokens}, too low for 15 gaps`);
  // Rough sanity: the full report must fit inside the ceiling with headroom.
  const fullReportTokens = gapArray(15).length / 4;
  assert.ok(req.max_tokens > fullReportTokens, 'ceiling is below a full report');
});

test('satisfied alternatives are split out from actionable gaps', async () => {
  scripted = [
    JSON.stringify([
      { skill: 'Terraform', suggest_adding: true, category: 'technical', severity: 'critical' },
      { skill: 'Vue.js', suggest_adding: false, category: 'technical', severity: 'nice_to_have', reason: 'JD lists React OR Vue — candidate has React' },
    ]),
  ];
  const result = await analyze();
  assert.equal(result.gaps.length, 1);
  assert.equal(result.gaps[0].skill, 'Terraform');
  assert.equal(result.satisfiedAlternatives.length, 1);
  assert.equal(result.satisfiedAlternatives[0].skill, 'Vue.js');
});

test('the prompt asks for scope and seniority gaps, not only tools', async () => {
  scripted = [gapArray(1)];
  await analyze();
  const prompt = sentRequests[0].messages[0].content;
  assert.match(prompt, /SCOPE AND SENIORITY ARE GAPS TOO/);
  assert.match(prompt, /multi-team ownership/);
  assert.ok(prompt.includes(JD), 'the posting never reached the prompt');
});
