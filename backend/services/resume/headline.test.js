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
  const r = resolveHeadline({ ...ME, postingTitle: 'Staff Design Technologist', keywords: ['React.js', 'design systems', 'Figma', 'WCAG 2.2 AA', 'Git and code reviews'], jobDescription: 'Build design systems and design system foundations. Strong React.js and code reviews. Design systems at scale.' });
  assert.equal(r.mode, 'keep');
  assert.ok(!/Design Technologist/i.test(r.headline), r.headline);
  assert.ok(r.headline.startsWith('Staff Software Engineer, Frontend Platform'));
  assert.match(r.headline, /Design Systems/);
  assert.ok(!/Figma|WCAG/.test(r.headline), 'unsupported terms stay out');
  assert.ok(!/React|code review/i.test(r.headline), 'tools and practices are never the focus');
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

test('the focus comes from the candidate\'s own skills, ranked by how much the posting mentions them', () => {
  const r = resolveHeadline({
    candidateTitle: 'Staff Software Engineer, Frontend Platform', heldTitles: [], sourceText: '',
    skills: ['React', 'GraphQL', 'State Management', 'Design Systems', 'Frontend Testing'],
    postingTitle: 'Staff Design Technologist', keywords: [],
    jobDescription: 'Design systems, design systems, design systems. Some state management.',
  });
  assert.equal(r.headline, 'Staff Software Engineer, Frontend Platform | Design Systems, State Management');
});

test('the explanation names only the focus terms that made it into the headline', () => {
  const r = resolveHeadline({
    candidateTitle: 'Staff Software Engineer, Frontend Platform, Cloud Services Group', heldTitles: [], sourceText: '',
    skills: ['Design Systems', 'State Management'],
    postingTitle: 'Staff Design Technologist', keywords: [],
    jobDescription: 'Design systems, design systems. State management.',
  });
  assert.ok(r.headline.length <= 80, r.headline);
  const named = (r.headline.split(' | ')[1] || '').split(', ').filter(Boolean);
  for (const t of ['Design Systems', 'State Management']) assert.equal(r.detail.includes(t), named.includes(t), `${t}: ${r.detail}`);
});

test('leadership and mentoring are ways of working, never a headline focus', () => {
  const r = resolveHeadline({
    candidateTitle: 'Staff Software Engineer, Frontend Platform', heldTitles: [], sourceText: '',
    skills: ['Technical Leadership', 'Mentorship', 'Cross-Functional Leadership'],
    postingTitle: 'Staff Design Technologist', keywords: [],
    jobDescription: 'Technical leadership, mentorship and cross-functional leadership.',
  });
  assert.equal(r.headline, 'Staff Software Engineer, Frontend Platform');
});

// ── Other professions: the same rules, no engineering vocabulary ────────────

test('an accountant keeps their title for a role that is not theirs, mirrors one that is', () => {
  const me = { candidateTitle: 'Senior Accountant', heldTitles: ['Accountant', 'Staff Accountant'], skills: ['Month-end close', 'Audit support'], sourceText: '', keywords: [] };
  assert.equal(resolveHeadline({ ...me, postingTitle: 'Senior Accountant, Tax' }).headline, 'Senior Accountant');
  const other = resolveHeadline({ ...me, postingTitle: 'Senior Financial Controller' });
  assert.equal(other.mode, 'keep');
  assert.equal(other.headline, 'Senior Accountant');
});

test('a nurse is not retitled to a specialty role they have not held', () => {
  const r = resolveHeadline({ candidateTitle: 'Registered Nurse', heldTitles: ['Registered Nurse', 'Staff Nurse'], skills: ['IV therapy'], sourceText: '', keywords: [], postingTitle: 'Charge Nurse, ICU' });
  assert.equal(r.mode, 'keep');
  assert.equal(r.headline, 'Registered Nurse');
});

test('a marketing manager: same level mirrors, a director role does not', () => {
  const me = { candidateTitle: 'Senior Marketing Manager', heldTitles: ['Marketing Manager'], skills: ['Demand generation'], sourceText: '', keywords: [] };
  assert.equal(resolveHeadline({ ...me, postingTitle: 'Senior Marketing Manager, Growth' }).headline, 'Senior Marketing Manager');
  const dir = resolveHeadline({ ...me, postingTitle: 'Director of Marketing' });
  assert.equal(dir.mode, 'keep');
  assert.equal(dir.headline, 'Senior Marketing Manager');
});

test('a product manager is not made a Group Product Manager', () => {
  const r = resolveHeadline({ candidateTitle: 'Senior Product Manager', heldTitles: ['Product Manager'], skills: ['Roadmapping'], sourceText: '', keywords: [], postingTitle: 'Group Product Manager' });
  assert.equal(r.mode, 'keep');
  assert.equal(r.headline, 'Senior Product Manager');
});

test('a data analyst is not retitled Data Scientist', () => {
  const r = resolveHeadline({ candidateTitle: 'Senior Data Analyst', heldTitles: ['Data Analyst'], skills: ['SQL', 'Tableau'], sourceText: '', keywords: [], postingTitle: 'Senior Data Scientist' });
  assert.equal(r.mode, 'keep');
  assert.equal(r.headline, 'Senior Data Analyst');
});

test('the segment after a comma is not part of the role, in any profession', () => {
  const r = resolveHeadline({ candidateTitle: 'Senior Account Executive', heldTitles: ['Account Executive'], skills: ['Salesforce'], sourceText: '', keywords: [], postingTitle: 'Senior Account Executive, Enterprise' });
  assert.equal(r.mode, 'mirror');
  assert.equal(r.headline, 'Senior Account Executive');
});

test('a single-word skill or tool is never a headline focus; a phrase can be', () => {
  const r = resolveHeadline({ candidateTitle: 'Senior Data Analyst', heldTitles: ['Data Analyst'], skills: ['Excel', 'Statistics', 'Experiment design'], sourceText: '', keywords: [], postingTitle: 'Senior Data Scientist', jobDescription: 'Excel, statistics and experiment design for experiment design reviews.' });
  assert.equal(r.mode, 'keep');
  assert.equal(r.headline, 'Senior Data Analyst | Experiment design');
});

test('a focus term must be evidenced in the experience, not only listed in skills', () => {
  const base = { candidateTitle: 'Staff Software Engineer, Frontend Platform', heldTitles: [], skills: ['Design Systems', 'State Management'], sourceText: '', keywords: [], postingTitle: 'Staff Design Technologist', jobDescription: 'Design systems and state management.' };
  const listedOnly = resolveHeadline({ ...base, evidenceText: 'Built React interfaces and managed shared state across the app.' });
  assert.equal(listedOnly.headline, 'Staff Software Engineer, Frontend Platform', 'design systems is not in any bullet');
  const evidenced = resolveHeadline({ ...base, evidenceText: 'Built the design system foundations used by four teams.' });
  assert.equal(evidenced.headline, 'Staff Software Engineer, Frontend Platform | Design Systems');
});
