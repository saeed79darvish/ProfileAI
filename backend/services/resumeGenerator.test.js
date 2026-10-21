/**
 * The resume renderers.
 *
 * The headline — the title the tailoring engine mirrors to the posting — was
 * rendered by exactly ONE of the four PDF templates. `professional`, which is
 * the default and the one the extension downloads, printed no title at all. So
 * the entire title pipeline was correct in the data, correct in the saved
 * record and correct in the .docx, and invisible in the file most candidates
 * actually send to an employer.
 *
 * Text is extracted with pdf.js directly rather than through `pdf-parse`. That
 * wrapper runs an internal debug path when it has no `module.parent` and keeps
 * worker state between documents, and both failure modes surface as
 * "bad XRef entry" — a message that reads as a corrupt PDF and is not one.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const PDFJS = require(path.join(
  __dirname,
  '..',
  'node_modules/pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js'
));
const { generatePDF, generateWord } = require('./resumeGeneratorService');

const TEMPLATES = ['professional', 'modern', 'minimal', 'centered'];
const HEADLINE = 'Staff Software Engineer, Platform Infrastructure';

const PROFILE = {
  title: HEADLINE,
  email: 'ada@example.com',
  phone: '555-0100',
  location: 'San Francisco, CA',
  summary: 'Engineer who builds platforms that other teams ship on.',
  skills: ['React', 'TypeScript', 'Node.js'],
  experience: [
    { title: 'Senior Engineer', company: 'Acme', period: '2021 - Present', description: '• Built the platform' },
  ],
  education: [{ school: 'MIT', degree: 'BSc', field: 'CS', year: '2010' }],
};
const USER = { firstName: 'Saeed', lastName: 'Darvish', email: 'ada@example.com' };

async function pdfText(buffer) {
  const doc = await PDFJS.getDocument({ data: new Uint8Array(buffer) }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    text += content.items.map((x) => x.str).join(' ') + '\n';
  }
  return text;
}

const renderText = async (templateId, profile = PROFILE) =>
  pdfText(await generatePDF(profile, USER, templateId));

for (const templateId of TEMPLATES) {
  test(`${templateId} prints the headline under the name`, async () => {
    const text = await renderText(templateId);
    assert.ok(
      text.includes(HEADLINE),
      `${templateId} dropped the headline — this is the template the whole title pipeline exists for`
    );
  });

  test(`${templateId} still renders contact details and sections`, async () => {
    const text = await renderText(templateId);
    assert.ok(text.includes('ada@example.com'), `${templateId} lost the email`);
    // The summary TEXT, not the heading: templates label it differently and
    // the sidebar layouts put it in a different flow order.
    assert.ok(text.includes('builds platforms that other teams ship on'), `${templateId} lost the summary`);
    // `minimal` letter-spaces the name ("S a e e d"), so the name is checked
    // with whitespace removed rather than as a contiguous string.
    assert.match(text.replace(/\s+/g, ''), /SaeedDarvish/i);
  });

  test(`${templateId} renders nothing in place of an absent headline`, async () => {
    const { title, ...untitled } = PROFILE;
    const text = await renderText(templateId, untitled);
    assert.ok(!text.includes(HEADLINE));
    assert.ok(!/\[\s*add/i.test(text), 'a placeholder leaked into the rendered resume');
    assert.ok(text.includes('ada@example.com'), `${templateId} failed to render without a title`);
  });
}

test('the headline falls back to profile.headline when there is no title', async () => {
  const { title, ...rest } = PROFILE;
  const text = await renderText('professional', { ...rest, headline: 'Platform Engineer' });
  assert.ok(text.includes('Platform Engineer'));
});

test('a placeholder in the title never reaches the page', async () => {
  const text = await renderText('professional', { ...PROFILE, title: '[add title]' });
  assert.ok(!/\[\s*add/i.test(text), 'placeholder title was printed on the resume');
});

test('Word renders with and without a headline', async () => {
  const withTitle = await generateWord(PROFILE, USER, 'professional');
  const without = await generateWord({ ...PROFILE, title: '' }, USER, 'professional');
  assert.ok(withTitle.length > 1000, 'Word document looks empty');
  assert.ok(without.length > 1000, 'Word document failed without a title');
});

test('a saved record written before the hygiene fix still renders clean', async () => {
  // Every resume tailored before placeholders were stripped still carries them,
  // and those records are re-rendered on every later download.
  const legacy = {
    ...PROFILE,
    education: [
      { school: 'UCSC Silicon Valley Extension', degree: 'Full Stack Development Certificate', year: '2018' },
      { school: '[add institution name]', degree: '[add degree]', field: 'Computer Programming, Specific Applications', year: '[add graduation year]' },
    ],
    projects: [{ title: 'Widget ([add year])', description: 'Built a widget.' }],
  };
  for (const templateId of TEMPLATES) {
    const text = await renderText(templateId, legacy);
    assert.ok(!/\[\s*add/i.test(text), `${templateId} printed placeholder text from a legacy record`);
    assert.ok(text.includes('UCSC'), `${templateId} dropped the real education entry`);
  }
});

test('Word strips placeholders from legacy records too', async () => {
  const legacy = { ...PROFILE, title: '[add title]', education: [{ school: '[add institution name]', degree: '[add degree]' }] };
  const buf = await generateWord(legacy, USER, 'professional');
  assert.ok(buf.length > 1000, 'Word document failed on a legacy record');
});

// ── Free-plan watermark ─────────────────────────────────────────────────────
// Free exports carry a quiet footer on every page; paid exports carry nothing.

for (const templateId of TEMPLATES) {
  test(`${templateId} stamps the watermark only when asked`, async () => {
    const marked = await pdfText(await generatePDF(PROFILE, USER, templateId, undefined, undefined, undefined, { watermark: true }));
    const clean = await pdfText(await generatePDF(PROFILE, USER, templateId));
    assert.ok(marked.includes('Made with ProfilleAI'), `${templateId} did not stamp the free-plan watermark`);
    assert.ok(!clean.includes('ProfilleAI'), `${templateId} watermarked a paid export`);
  });
}

test('the watermark lands on every page and adds none', async () => {
  const long = {
    ...PROFILE,
    experience: Array.from({ length: 14 }, (_, i) => ({
      title: `Engineer ${i}`, company: `Company ${i}`, period: '2010 - 2011',
      description: Array.from({ length: 5 }, () => '• Shipped a thing that mattered to a lot of people').join('\n'),
    })),
  };
  const countPages = async (buf) => (await PDFJS.getDocument({ data: new Uint8Array(buf) }).promise).numPages;
  const clean = await generatePDF(long, USER, 'professional');
  const marked = await generatePDF(long, USER, 'professional', undefined, undefined, undefined, { watermark: true });
  const pages = await countPages(clean);
  assert.ok(pages > 1, 'fixture should span several pages');
  assert.equal(await countPages(marked), pages);
  const stamps = (await pdfText(marked)).split('Made with ProfilleAI').length - 1;
  assert.equal(stamps, pages);
});
