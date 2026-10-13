const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildTailoringPrompt, MASTER_TAILORING_PROMPT } = require('./tailoringPrompts');

const PROFILE = {
  title: 'Senior Software Engineer',
  summary: 'Builds backend services.',
  skills: ['Go', 'Kubernetes'],
  experience: [
    { company: 'Acme', title: 'Senior Software Engineer', startDate: '2021-01', current: true, description: 'Built things' },
  ],
};

const BASE = {
  group: 'engineering',
  originalResumeText: 'Senior Software Engineer at Acme. Built services in Go on Kubernetes.'.repeat(4),
  profileData: PROFILE,
  jobDescription: 'We need someone to work on our platform. Go and Kubernetes are used heavily.',
  gapContext: '',
  settingsContext: '',
  extractedKeywords: { required: ['Go'], preferred: [], domain: [], orGroups: [] },
  expCount: 1,
  now: new Date('2026-10-12T00:00:00Z'),
};

test('the posting title reaches the prompt verbatim', () => {
  const { prompt } = buildTailoringPrompt({
    ...BASE,
    targetTitle: 'Staff Software Engineer',
    targetCompany: 'Acme Corp',
  });
  assert.match(prompt, /TARGET ROLE/);
  assert.match(prompt, /Posting title: Staff Software Engineer/);
  assert.match(prompt, /Company: Acme Corp/);
});

test('the prompt names the band substitution it must not make', () => {
  // The reported defect: "Staff" rendered as "Senior". The instruction has to
  // be specific about bands, because "mirror the title" was already there and
  // was already being followed as the model understood it.
  const { prompt } = buildTailoringPrompt({ ...BASE, targetTitle: 'Staff Software Engineer' });
  assert.match(prompt, /"Staff" is not "Senior"/);
  assert.match(prompt, /seniority word is part of it/i);
});

test('no hardcoded example title can be echoed back as the answer', () => {
  // A literal {"detail": "Set title to match JD: Senior Software Engineer"}
  // used to sit in the output contract as the only concrete title example,
  // next to a prompt that often carried no real title at all.
  const { prompt } = buildTailoringPrompt({ ...BASE, targetTitle: 'Staff Software Engineer' });
  assert.ok(
    !/Set title to match JD: Senior Software Engineer/.test(prompt),
    'the old few-shot title is still in the prompt'
  );
  // "Senior Product Manager" survives only inside the TITLE rule's worked
  // example, which is about wording, not about seniority substitution.
  const seniorSwe = prompt.match(/Senior Software Engineer/g) || [];
  // The only permitted occurrences are the candidate's own stored title in the
  // profile/resume payload — never in the instructions or the output shape.
  const afterOutputFormat = prompt.slice(prompt.indexOf('═══ OUTPUT FORMAT ═══'));
  assert.ok(
    !/Senior Software Engineer/.test(afterOutputFormat),
    `output contract still names a concrete seniority: ${seniorSwe.length} occurrences`
  );
});

test('with no title supplied the prompt forbids inventing one', () => {
  const { prompt } = buildTailoringPrompt({ ...BASE, targetTitle: '', targetCompany: '' });
  assert.match(prompt, /No title was supplied/);
  assert.match(prompt, /do NOT\s+invent a plausible-sounding one/);
  assert.ok(!/Job title: /.test(prompt));
});

test('substantive requirements reach the prompt and are asked back for', () => {
  const requirements = [
    '8+ years of professional software engineering experience',
    'own the architecture of a multi-team platform',
  ];
  const { prompt } = buildTailoringPrompt({
    ...BASE,
    targetTitle: 'Staff Software Engineer',
    extractedKeywords: { ...BASE.extractedKeywords, requirements },
  });
  assert.match(prompt, /SUBSTANTIVE REQUIREMENTS/);
  for (const r of requirements) assert.ok(prompt.includes(r), `missing requirement: ${r}`);
  assert.match(prompt, /requirementCoverage/);
  // Scope must be evidenced, not asserted with a bigger adjective.
  assert.match(prompt, /demonstrated by EVIDENCE, not by\s+adjectives/);
});

test('no requirements means no empty requirements section', () => {
  const { prompt } = buildTailoringPrompt({ ...BASE, targetTitle: 'Staff Software Engineer' });
  assert.ok(!/SUBSTANTIVE REQUIREMENTS/.test(prompt));
});

test('the job description still reaches the prompt in full', () => {
  const jd = 'A distinctive sentence about the platform. ' + 'detail '.repeat(500);
  const { prompt } = buildTailoringPrompt({ ...BASE, jobDescription: jd, targetTitle: 'Staff Engineer' });
  assert.ok(prompt.includes(jd), 'the posting was truncated on the way into the prompt');
});

test('the title rule survives in the master prompt', () => {
  assert.match(MASTER_TAILORING_PROMPT, /TITLE/);
  assert.match(MASTER_TAILORING_PROMPT, /seniority band is part of the wording/i);
});

test('the builder returns a usable call config', () => {
  const cfg = buildTailoringPrompt({ ...BASE, targetTitle: 'Staff Software Engineer' });
  assert.equal(typeof cfg.system, 'string');
  assert.ok(cfg.system.length > 100);
  assert.equal(typeof cfg.max_tokens, 'number');
  assert.ok(cfg.max_tokens > 0);
  assert.ok(cfg.temperature >= 0 && cfg.temperature <= 1);
});

test('the prompt forbids the self-label opener the candidate objected to', () => {
  const { prompt } = buildTailoringPrompt({ ...BASE, targetTitle: 'Staff Software Engineer' });
  assert.match(prompt, /DO NOT OPEN THE SUMMARY WITH A HYPHENATED SELF-LABEL/);
  assert.match(prompt, /Frontend-focused/);
});

test('the prompt tells the model to KEEP source metrics, not ration them', () => {
  const { prompt } = buildTailoringPrompt({ ...BASE, targetTitle: 'Staff Software Engineer' });
  assert.match(prompt, /KEEP the original resume's numbers/);
  // The old "menu, not a manifest" framing actively instructed deletion.
  assert.ok(!/menu, not a manifest/.test(prompt), 'the ration-the-metrics framing is still in the prompt');
  assert.ok(!/3–4 metric cap/.test(prompt), 'the 3-4 cap is still quoted at the model');
});

test('the output contract never shows a placeholder as an example value', () => {
  // Placeholders are still NAMED in the prompt — to forbid them. What must not
  // happen is the output shape modelling one as an acceptable value, which is
  // what put "[add institution name]" on a real candidate's PDF.
  const { prompt } = buildTailoringPrompt({ ...BASE, targetTitle: 'Staff Software Engineer' });
  const contract = prompt.slice(prompt.indexOf('═══ OUTPUT FORMAT ═══'));
  assert.ok(!/\[add /i.test(contract), `the output contract still shows a placeholder: ${contract.match(/.{0,80}\[add .{0,40}/i)}`);
  assert.match(prompt, /NEVER write a bracketed placeholder into any resume field/);
});

test('the prompt rejects the generic summary openers', () => {
  const { prompt } = buildTailoringPrompt({ ...BASE, targetTitle: 'Staff Software Engineer' });
  assert.match(prompt, /THE FIRST SENTENCE IS THE ONLY ONE MOST RECRUITERS READ/);
  assert.match(prompt, /Never open with "Software engineer who" or "Engineer with"/);
  // It must show what good looks like, not only what to avoid.
  assert.match(prompt, /Concrete nouns, real scale, no category labels/);
});

test('the summary rules no longer forbid the scale that makes them specific', () => {
  const { prompt } = buildTailoringPrompt({ ...BASE, targetTitle: 'Staff Software Engineer' });
  // The old blanket "NO METRICS IN THE SUMMARY" contradicted the instruction to
  // open with concrete scale, and the model resolved the conflict by writing a
  // generic sentence — the same generic sentence for every posting.
  assert.ok(!/NO METRICS IN THE SUMMARY/.test(prompt), 'the blanket metric ban is still in the prompt');
  assert.match(prompt, /NO OUTCOME METRICS IN THE SUMMARY/);
  assert.match(prompt, /SCALE IS ALLOWED/);
});

test('the summary rules keep competency nouns and true years, and forbid employer-list closers', () => {
  const { prompt } = buildTailoringPrompt({ ...BASE, targetTitle: 'Staff Software Engineer' });
  assert.match(prompt, /COMPETENCY NOUNS ARE NOT SELF-RATING, AND THEY STAY/);
  assert.match(prompt, /STATE THE YEARS WHEN THE DATES SUPPORT THEM/);
  assert.match(prompt, /THE LAST SENTENCE IS A CLAIM, NOT A LIST/);
});
