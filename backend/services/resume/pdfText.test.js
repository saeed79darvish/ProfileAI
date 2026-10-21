const test = require('node:test');
const assert = require('node:assert/strict');

const { pdfToText } = require('./pdfText');
const { generatePDF } = require('../resumeGeneratorService');
const resumeParserService = require('../resumeParserService');

const PROFILE = {
  title: 'Senior Software Engineer',
  email: 'ada@example.com',
  summary: 'Engineer who builds platforms.',
  skills: ['React', 'Node.js'],
  experience: [{ title: 'Senior Engineer', company: 'Acme Test Co', period: '2021 - Present', description: '• Built the platform' }],
  education: [{ school: 'UW', degree: 'BS', field: 'CS', year: '2016' }],
};
const USER = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' };

/* A small PDF in a pooled Buffer — what multer hands the route. This is the
   exact shape that produced "Failed to extract text from PDF". */
const pooled = (buf) => Buffer.concat([Buffer.from(buf)]);

test('a small text PDF in a pooled buffer extracts, every time', async () => {
  const pdf = await generatePDF(PROFILE, USER, 'professional');
  // Fill the pool with something else first so a byteOffset bug would show.
  Buffer.from('x'.repeat(3000));
  for (let i = 0; i < 5; i += 1) {
    const text = await pdfToText(pooled(pdf));
    assert.match(text, /Acme Test Co/);
  }
});

test('the upload path reads the app\'s own resumes back in', async () => {
  for (const template of ['professional', 'modern', 'minimal', 'centered']) {
    const pdf = await generatePDF(PROFILE, USER, template);
    const text = await resumeParserService.extractTextFromResume({ buffer: pooled(pdf), mimetype: 'application/pdf' });
    assert.match(text, /Senior Engineer/, template);
  }
});

test('garbage fails with a code, not a bare message', async () => {
  await assert.rejects(pdfToText(Buffer.from('not a pdf at all')), (err) => err.code === 'pdf_unreadable');
});
