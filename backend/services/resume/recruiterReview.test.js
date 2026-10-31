const { test } = require('node:test');
const assert = require('node:assert/strict');

const { reviewFacts, normalizeReview } = require('./recruiterReview');

const PROFILE = {
  title: 'Staff Front-end UI Architect, Full-Stack',
  summary: 'Senior engineer with 6+ years of experience in React and Node.',
  skills: Array.from({ length: 52 }, (_, i) => `Skill ${i}`),
  experience: [
    { company: 'Amazon AWS', title: 'Lead UI Engineer', description: 'Cut data retrieval 30%.\nLed the player UI.' },
    { company: 'Restoration Hardware', title: 'Senior UI Engineer (Javascript, React, Node)', description: 'Led payments UI.' },
  ],
  education: [],
  projects: [],
  location: 'San Francisco',
  linkedinUrl: 'linkedin.com/in/x',
};

test('code finds what a recruiter would notice', () => {
  const keys = reviewFacts(PROFILE, { hasPhoto: true, target: '' }).map((f) => f.key);
  for (const k of ['no_projects', 'title_stack', 'no_target', 'title_unclear', 'summary_weak', 'too_many_skills']) {
    assert.ok(keys.includes(k), `${k} in ${keys.join(',')}`);
  }
  assert.ok(!keys.includes('no_links'));
  assert.ok(!keys.includes('no_photo'));
  assert.ok(!keys.includes('no_location'));
});

test('every code fact appears once; quick or improve comes from the fix', () => {
  const facts = reviewFacts(PROFILE, { hasPhoto: true, target: '' });
  const review = normalizeReview({
    verdict: { headline: 'Strong Staff-level frontend profile', summary: 'Scale stands out.' },
    strengths: [{ title: 'Scale', body: 'Built for 1M+ users at Amazon AWS.' }],
    tips: [
      // The model tries to send a code fact to a different fix: ignored.
      { key: 'no_projects', title: 'Add the AWS TV player as a project', body: 'A link proves it.', fix: 'enhance_summary' },
      { key: 'no_projects', title: 'Duplicate', body: 'Dropped.', fix: 'add_project' },
      { key: 'other', title: 'Explain the 2014 gap', body: 'Recruiters ask.', fix: 'made_up_fix' },
    ],
  }, facts, { profileKey: 'p1' });

  const all = [...review.quickWins, ...review.improve];
  assert.equal(all.filter((t) => t.key === 'no_projects').length, 1);
  const project = all.find((t) => t.key === 'no_projects');
  assert.equal(project.title, 'Add the AWS TV player as a project');
  assert.equal(project.fix, 'add_project');
  assert.ok(review.quickWins.includes(project));
  const other = all.find((t) => t.key === 'other');
  assert.equal(other.fix, 'none');
  assert.equal(other.action, '');
  // Facts the model skipped still appear, in the code's words.
  assert.ok(all.some((t) => t.key === 'title_stack' && /Senior UI Engineer/.test(t.body)));
  assert.equal(review.verdict.headline, 'Strong Staff-level frontend profile');
  assert.equal(review.strengths.length, 1);
  assert.ok(review.quickWins.length <= 5 && review.improve.length <= 6);
});

test('no model answer still gives a review from the facts alone', () => {
  const facts = reviewFacts(PROFILE, { hasPhoto: false, target: 'Staff Engineer' });
  const review = normalizeReview(null, facts, { profileKey: 'p1' });
  assert.ok(review.quickWins.length > 0);
  assert.equal(review.strengths.length, 0);
  assert.match(review.verdict.headline, /recruiter/i);
  assert.equal(review.id, normalizeReview(null, facts, { profileKey: 'p1' }).id);
});
