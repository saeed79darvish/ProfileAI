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
