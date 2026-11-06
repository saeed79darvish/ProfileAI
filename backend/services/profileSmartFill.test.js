const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPrompt, cleanDate, cleanList, normalizeItem, smartFill, SmartFillError,
} = require('./profileSmartFill');

const reply = (obj) => async () => (typeof obj === 'string' ? obj : JSON.stringify(obj));

test('cleanDate keeps months and years and drops everything else', () => {
  assert.equal(cleanDate('2021-06'), '2021-06');
  assert.equal(cleanDate('2021-6'), '2021-06');
  assert.equal(cleanDate('2021-06-15'), '2021-06');
  assert.equal(cleanDate('2019'), '2019');
  assert.equal(cleanDate('current'), 'Present');
  assert.equal(cleanDate('June 2021'), '');
  assert.equal(cleanDate('2019 - 2021'), '');
  assert.equal(cleanDate('2021-13'), '2021');
  assert.equal(cleanDate(''), '');
});

test('cleanList dedupes case-insensitively and accepts a comma string', () => {
  assert.deepEqual(cleanList(['React', 'react', ' Node.js ', '']), ['React', 'Node.js']);
  assert.deepEqual(cleanList('AWS, Docker,aws'), ['AWS', 'Docker']);
});

test('education: the one-sentence example fills the real fields', async () => {
  const { item } = await smartFill({
    kind: 'education',
    text: 'UC Santa Cruz Silicon Valley software engineering',
    generateText: reply({
      institution: 'UC Santa Cruz Silicon Valley', fieldOfStudy: 'Software Engineering',
      degree: '', location: 'Santa Clara, CA', startDate: '', endDate: '',
    }),
  });
  assert.equal(item.institution, 'UC Santa Cruz Silicon Valley');
  assert.equal(item.fieldOfStudy, 'Software Engineering');
  assert.equal(item.field, 'Software Engineering', 'the resume renderer reads field');
  assert.equal(item.degree, '');
});

test('experience: type is mapped to the select options, dates normalised, skills deduped', async () => {
  const { item } = await smartFill({
    kind: 'experience',
    text: 'Autodesk software engineer III, full time, June 2021 to August 2023, React and AWS',
    generateText: reply({
      company: 'Autodesk', title: 'Software Engineer III', employmentType: 'full time',
      startDate: '2021-06', endDate: '2023-08', description: '- Built serverless apps\n- Shipped GraphQL APIs',
      skills: ['React', 'AWS', 'react'],
    }),
  });
  assert.equal(item.employmentType, 'Full-time');
  assert.equal(item.startDate, '2021-06');
  assert.equal(item.description, '• Built serverless apps\n• Shipped GraphQL APIs');
  assert.deepEqual(item.skills, ['React', 'AWS']);
});

test('a start date after the end date is dropped rather than shown backwards', () => {
  const item = normalizeItem('experience', { company: 'X', startDate: '2024-01', endDate: '2020-01' });
  assert.equal(item.startDate, '');
  assert.equal(item.endDate, '');
  assert.equal(item.company, 'X');
});

test('project fields, technologies as a list', async () => {
  const { item } = await smartFill({
    kind: 'project',
    text: 'Recipe finder app I built with Next.js and Postgres, github.com/me/recipes',
    generateText: reply({ title: 'Recipe Finder', technologies: ['Next.js', 'Postgres'], githubUrl: 'github.com/me/recipes' }),
  });
  assert.equal(item.title, 'Recipe Finder');
  assert.deepEqual(item.technologies, ['Next.js', 'Postgres']);
  assert.equal(item.githubUrl, 'github.com/me/recipes');
});

test('skills kind returns a clean list', async () => {
  const { item } = await smartFill({ kind: 'skills', text: 'python, sql and some figma', generateText: reply({ skills: ['Python', 'SQL', 'Figma'] }) });
  assert.deepEqual(item.skills, ['Python', 'SQL', 'Figma']);
});

test('a truncated model reply is repaired, not thrown away', async () => {
  const { item } = await smartFill({
    kind: 'education',
    text: 'MIT computer science',
    generateText: reply('```json\n{"institution": "Massachusetts Institute of Technology", "fieldOfStudy": "Computer Science", "description": "Algorithms, syst'),
  });
  assert.equal(item.institution, 'Massachusetts Institute of Technology');
  assert.equal(item.fieldOfStudy, 'Computer Science');
});

test('em dashes and arrows never reach the form', () => {
  const item = normalizeItem('experience', { company: 'A — B', description: 'Built it → shipped it' });
  assert.ok(!/[—→]/.test(item.company + item.description));
});

test('input is validated before any model call', async () => {
  let called = false;
  const generateText = async () => { called = true; return '{}'; };
  await assert.rejects(smartFill({ kind: 'nope', text: 'abc def', generateText }), (e) => e instanceof SmartFillError && e.status === 400);
  await assert.rejects(smartFill({ kind: 'education', text: '  ', generateText }), (e) => e.code === 'text_required');
  assert.equal(called, false);
});

test('an empty parse is an error the person can act on, a model failure is a 502', async () => {
  await assert.rejects(
    smartFill({ kind: 'education', text: 'asdf qwer', generateText: reply({ institution: '', degree: '' }) }),
    (e) => e.status === 422 && e.code === 'nothing_found',
  );
  await assert.rejects(
    smartFill({ kind: 'education', text: 'MIT cs', generateText: async () => { throw new Error('down'); } }),
    (e) => e.status === 502,
  );
});

test('the prompt carries the note, the date and the no-invention rule', () => {
  const p = buildPrompt('education', 'UCSC', { today: new Date('2026-11-06T00:00:00Z') });
  assert.match(p, /UCSC/);
  assert.match(p, /2026-11-06/);
  assert.match(p, /Never invent/);
});
