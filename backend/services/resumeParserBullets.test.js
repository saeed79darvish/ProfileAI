const test = require('node:test');
const assert = require('node:assert/strict');

const resumeParserService = require('./resumeParserService');

test('imported bullets stay bullets, one per line', () => {
  const out = resumeParserService.sanitizeParsedResume({
    experience: [{
      title: 'Senior UI Software Architect Engineer',
      company: 'Equinix',
      description: '•Defined the   frontend architecture\n•Led technical direction\n- Built reusable components',
    }],
  });
  assert.equal(
    out.experience[0].description,
    '• Defined the frontend architecture\n• Led technical direction\n• Built reusable components'
  );
});

test('the review annotations are still stripped from descriptions', () => {
  const out = resumeParserService.sanitizeParsedResume({
    experience: [{ title: 'Dev', company: 'Acme', description: '• Shipped billing\nLOW RELEVANCE — consider removing' }],
  });
  assert.doesNotMatch(out.experience[0].description, /LOW RELEVANCE/);
});

test('a note in the middle does not take the bullets after it', () => {
  const out = resumeParserService.sanitizeParsedResume({
    experience: [{ title: 'Dev', company: 'Acme', description: '• One\n• Two LOW RELEVANCE consider removing\n• Three' }],
  });
  assert.equal(out.experience[0].description, '• One\n• Two\n• Three');
});
