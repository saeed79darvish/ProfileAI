const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildTailorSuggestions } = require('./tailorSuggestions');

const ORIGINAL = {
  title: 'Staff Front-end UI Architect, Full-Stack',
  summary: 'Senior engineer with 6+ years of experience in React and Node.',
  experience: [{
    company: 'Amazon AWS',
    description: 'Lead UI engineer developing a new video player platform for AWS environments.\nLead UI pattern and component design, spearhead architectural discussions, and mentor junior developers.',
  }],
};

const TAILORED = {
  title: 'Senior Frontend Engineer',
  summary: 'Frontend engineer building React platforms for video at AWS scale.',
  experience: [{
    company: 'Amazon AWS',
    // Reordered, one bullet rewritten.
    description: '• Defined the UI patterns and component design for the player platform, and mentor junior developers.\n• Lead UI engineer developing a new video player platform for AWS environments.',
  }],
  changelog: [
    { section: 'title', action: 'matched', detail: 'Set title to the posting’s exact title' },
    { section: 'summary', action: 'rewritten', detail: 'Led with React platform work the posting asks for.' },
    { section: 'experience_1', action: 'reordered', detail: 'Moved component design to the top' },
  ],
};

test('three suggestions with the changelog note as each reason', () => {
  const out = buildTailorSuggestions(ORIGINAL, TAILORED);
  assert.deepEqual(out.map((s) => s.id), ['title', 'summary', 'bullet']);
  assert.equal(out[0].reason, 'Set title to the posting’s exact title.');
  assert.equal(out[2].label, 'Key bullet · Amazon AWS');
  assert.equal(out[2].bullet, 0);
  assert.match(out[2].before, /^Lead UI pattern/);
  assert.match(out[2].after, /^Defined the UI patterns/);
  assert.equal(out[2].added, false);
});

test('unchanged sections are not suggested', () => {
  const out = buildTailorSuggestions(ORIGINAL, { ...ORIGINAL, changelog: [] });
  assert.deepEqual(out, []);
});

test('an added bullet is offered as an addition', () => {
  const tailored = {
    ...ORIGINAL,
    experience: [{ company: 'Amazon AWS', description: `${ORIGINAL.experience[0].description}\nBuilt GraphQL APIs for playback metadata.` }],
  };
  const [bullet] = buildTailorSuggestions(ORIGINAL, tailored);
  assert.equal(bullet.added, true);
  assert.equal(bullet.before, '');
  assert.equal(bullet.bullet, 2);
});
