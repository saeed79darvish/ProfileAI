const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveHeadline } = require('./headline');

const ME = {
  candidateTitle: 'Staff Software Engineer, Frontend Platform',
  heldTitles: ['Senior UI Engineer', 'Software Development Engineer', 'Senior Software Engineer'],
  skills: ['React', 'TypeScript', 'Design Systems', 'GraphQL'],
  sourceText: 'Built reusable components and design systems in React and TypeScript with GraphQL.',
};

test('an uncommon title is never adopted: the candidate keeps their own, with a supported focus', () => {
  const r = resolveHeadline({ ...ME, postingTitle: 'Staff Design Technologist', keywords: ['React', 'design systems', 'Figma', 'WCAG 2.2 AA'] });
  assert.equal(r.mode, 'keep');
  assert.ok(!/Design Technologist/i.test(r.headline), r.headline);
  assert.ok(r.headline.startsWith('Staff Software Engineer, Frontend Platform'));
  assert.match(r.headline, /Design Systems/);
  assert.ok(!/Figma|WCAG/.test(r.headline), 'unsupported terms stay out');
});

test('a common title at or below the candidate\'s level is mirrored', () => {
  const r = resolveHeadline({ ...ME, postingTitle: 'Senior Frontend Engineer, Ads Creative', keywords: [] });
  assert.equal(r.mode, 'mirror');
  assert.equal(r.headline, 'Senior Frontend Engineer');
});

test('a posting with no level keeps the candidate\'s title', () => {
  const r = resolveHeadline({ ...ME, postingTitle: 'Software Engineer 5 - TV (Ads)', keywords: [] });
  assert.equal(r.mode, 'keep');
  assert.equal(r.headline, 'Staff Software Engineer, Frontend Platform');
});

test('a level above the candidate\'s is never claimed', () => {
  const r = resolveHeadline({ ...ME, postingTitle: 'Principal Software Engineer', keywords: [] });
  assert.equal(r.mode, 'keep');
  assert.ok(!/Principal/.test(r.headline));
});

test('a different profession is not adopted', () => {
  const r = resolveHeadline({ ...ME, postingTitle: 'Staff Data Scientist', keywords: [] });
  assert.equal(r.mode, 'keep');
  assert.ok(!/Scientist/.test(r.headline));
});

test('a management title is not adopted by an individual contributor', () => {
  const r = resolveHeadline({ ...ME, postingTitle: 'Engineering Manager, Platform', keywords: [] });
  assert.equal(r.mode, 'keep');
  assert.ok(!/Manager/.test(r.headline));
});

test('the same level in the same family mirrors the posting wording', () => {
  const r = resolveHeadline({ candidateTitle: 'Senior Software Engineer', heldTitles: ['Software Engineer'], skills: ['Go'], sourceText: '', postingTitle: 'Senior Software Engineer, Payments', keywords: [] });
  assert.equal(r.mode, 'mirror');
  assert.equal(r.headline, 'Senior Software Engineer');
});

test('with no title of their own, the posting\'s role is used', () => {
  const r = resolveHeadline({ candidateTitle: '', heldTitles: [], skills: [], keywords: [], sourceText: '', postingTitle: 'Staff Software Engineer, Platform' });
  assert.equal(r.mode, 'posting');
  assert.equal(r.headline, 'Staff Software Engineer');
});

test('a focus term the profile does not support is left out', () => {
  const r = resolveHeadline({ ...ME, postingTitle: 'Staff Design Technologist', keywords: ['Figma', 'motion prototyping'] });
  assert.equal(r.headline, 'Staff Software Engineer, Frontend Platform');
});
