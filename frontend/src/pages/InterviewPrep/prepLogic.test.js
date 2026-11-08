import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterQuestions, categoryCounts, monthYear, reportedBy, sourcesFor, safeUrl, sortGuard, pollExpired, progressStep, companyFromUrl, cleanDiscussions } from './prepLogic.js';

const qs = [
  { id: 'a', text: 'Reverse a list', category: 'coding', mostRecent: '2026-03-10T00:00:00Z', sourceIds: ['s1', 's2'] },
  { id: 'b', text: 'Design a feed', category: 'system_design', mostRecent: null, sourceIds: ['s1'] },
  { id: 'c', text: 'Odd one', category: 'other', mostRecent: '2026-05-01T00:00:00Z', sourceIds: [] },
  { id: 'd', text: '', category: 'coding' },
];

test('filterQuestions: all keeps valid questions, categories narrow', () => {
  assert.equal(filterQuestions(qs, 'all').length, 3);
  assert.deepEqual(filterQuestions(qs, 'coding').map((q) => q.id), ['a']);
  assert.deepEqual(filterQuestions(qs, 'behavioral'), []);
  assert.deepEqual(filterQuestions(null, 'all'), []);
});
test('categoryCounts', () => {
  const c = categoryCounts(qs);
  assert.equal(c.all, 3);
  assert.equal(c.coding, 1);
  assert.equal(c.behavioral, 0);
});
test('monthYear', () => {
  assert.equal(monthYear('2026-03-10T00:00:00Z'), 'March 2026');
  assert.equal(monthYear(null), '');
  assert.equal(monthYear('nope'), '');
});
test('reportedBy pluralises', () => {
  assert.equal(reportedBy(qs[0]), 'Reported by 2 sources');
  assert.equal(reportedBy(qs[1]), 'Reported by 1 source');
  assert.equal(reportedBy({}), 'Reported by 0 sources');
});
test('sourcesFor skips unknown ids', () => {
  const src = [{ id: 's1' }, { id: 's2' }];
  assert.deepEqual(sourcesFor(['s2', 'zz', 's1'], src).map((s) => s.id), ['s2', 's1']);
  assert.deepEqual(sourcesFor(undefined, src), []);
});
test('safeUrl allows only http(s)', () => {
  assert.equal(safeUrl('https://a.com/x'), 'https://a.com/x');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl(''), null);
});
test('sortGuard: newest first, undated last, then source count', () => {
  assert.deepEqual(sortGuard(qs).map((q) => q.id), ['c', 'a', 'b']);
});
test('poll timing', () => {
  assert.equal(pollExpired(0, 239999), false);
  assert.equal(pollExpired(0, 240000), true);
  assert.equal(progressStep(0), 0);
  assert.equal(progressStep(60000), 2);
  assert.equal(progressStep(999999), 3);
});

test('a company name can be read from common job board links', () => {
  assert.equal(companyFromUrl('https://job-boards.greenhouse.io/glean/jobs/4545'), 'Glean');
  assert.equal(companyFromUrl('https://boards.greenhouse.io/scale-ai/jobs/1'), 'Scale Ai');
  assert.equal(companyFromUrl('https://jobs.lever.co/verkada/abc'), 'Verkada');
  assert.equal(companyFromUrl('https://jobs.ashbyhq.com/roblox/xyz'), 'Roblox');
  assert.equal(companyFromUrl('https://acme.wd5.myworkdayjobs.com/en-US/careers/job/x'), 'Acme');
  assert.equal(companyFromUrl('https://www.example.com/careers/engineer'), '');
  assert.equal(companyFromUrl('not a url'), '');
});

test('discussion links keep only titled, safe web links', () => {
  const out = cleanDiscussions([
    { title: 'SDE Interview at Stripe : r/leetcode', url: 'https://www.reddit.com/r/leetcode/comments/1d8/x', site: 'reddit.com', date: null },
    { title: 'Bad link', url: 'javascript:alert(1)', site: 'x.com' },
    { title: '', url: 'https://leetcode.com/discuss/post/1/x' },
    null,
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].href, 'https://www.reddit.com/r/leetcode/comments/1d8/x');
  assert.deepEqual(cleanDiscussions(undefined), []);
});

import {
  categoryTag, shortMonthYear, sourcePillLabel, coverageChip, companyInitial, logoColor, selectStep, stepKeyTarget,
  visibleQuestions, showMoreLabel, isGapProbe, gapDetail, discussionBadge, planProgress, storyRows,
} from './prepLogic.js';

test('category tags map known categories and fall back to Other', () => {
  assert.equal(categoryTag('coding').label, 'Coding');
  assert.equal(categoryTag('role_specific').fg, '#8a4a08');
  assert.equal(categoryTag('weird').label, 'Other');
  assert.equal(categoryTag(undefined).label, 'Other');
});

test('short dates and source pill labels', () => {
  assert.equal(shortMonthYear('2026-10-05T00:00:00Z'), 'Oct 2026');
  assert.equal(shortMonthYear('x'), '');
  assert.equal(sourcePillLabel({ site: 'teamblind.com', date: '2026-10-05T00:00:00Z' }), 'teamblind.com · Oct 2026');
  assert.equal(sourcePillLabel({ title: 'Guide' }), 'Guide');
  assert.equal(sourcePillLabel(null), '');
});

test('coverage chip', () => {
  assert.equal(coverageChip('thin').label, 'Limited coverage');
  assert.equal(coverageChip('none').label, 'Limited coverage');
  assert.equal(coverageChip('good').label, 'Good coverage');
  assert.equal(coverageChip(undefined).label, 'Good coverage');
});

test('company initial and logo color are stable', () => {
  assert.equal(companyInitial('  stripe'), 'S');
  assert.equal(companyInitial(''), '?');
  assert.equal(logoColor('Stripe'), logoColor('Stripe'));
  assert.match(logoColor('x'), /^#[0-9a-f]{6}$/);
});

test('stepper selection and keyboard targets', () => {
  const rounds = [{}, {}, {}];
  assert.equal(selectStep(rounds, 2), 2);
  assert.equal(selectStep(rounds, 9), 0);
  assert.equal(selectStep(rounds, -1), 0);
  assert.equal(selectStep(undefined, 1), 0);
  assert.equal(stepKeyTarget('ArrowRight', 2, 3), 0);
  assert.equal(stepKeyTarget('ArrowLeft', 0, 3), 2);
  assert.equal(stepKeyTarget('Home', 2, 3), 0);
  assert.equal(stepKeyTarget('End', 0, 3), 2);
  assert.equal(stepKeyTarget('a', 0, 3), null);
  assert.equal(stepKeyTarget('ArrowRight', 0, 0), null);
});

test('show more for questions', () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.equal(visibleQuestions(list, false, 6).length, 6);
  assert.equal(visibleQuestions(list, true, 6).length, 8);
  assert.equal(visibleQuestions([1, 2], false, 6).length, 2);
  assert.equal(showMoreLabel(8, 6), 'Show 2 more questions');
  assert.equal(showMoreLabel(7, 6), 'Show 1 more question');
  assert.equal(showMoreLabel(6, 6), '');
});

test('gap probes are found by the marker', () => {
  assert.equal(isGapProbe({ basedOn: 'Not in your profile: payments failure cases' }), true);
  assert.equal(isGapProbe({ basedOn: 'not in your profile: x' }), true);
  assert.equal(isGapProbe({ basedOn: 'Senior Architect, Equinix' }), false);
  assert.equal(isGapProbe({}), false);
  assert.equal(gapDetail('Not in your profile: payments'), 'payments');
  assert.equal(gapDetail('Equinix'), 'Equinix');
});

test('discussion badge comes from the host', () => {
  assert.equal(discussionBadge({ href: 'https://www.reddit.com/r/x/comments/1' }).label, 'Reddit');
  assert.equal(discussionBadge({ href: 'https://leetcode.com/discuss/post/1' }).label, 'LeetCode');
  assert.equal(discussionBadge({ href: 'https://www.teamblind.com/post/x' }).label, 'Blind');
  assert.equal(discussionBadge({ href: 'https://news.example.org/a' }).label, 'Example');
  assert.equal(discussionBadge({ site: 'reddit.com' }).label, 'Reddit');
  assert.equal(discussionBadge({}).label, 'Web');
});

test('plan progress shows research done and hides unknown story counts', () => {
  const p = planProgress({ sourceCount: 11, questionCount: 19, probeCount: 2, storyCount: null });
  assert.equal(p.doneCount, 1);
  assert.equal(p.percent, 25);
  assert.equal(p.steps[0].detail, '11 sources read');
  assert.equal(p.steps[1].detail, '19 reported, 2 about your resume');
  assert.equal(p.steps[2].detail, '');
  assert.equal(planProgress({ sourceCount: 1, storyCount: 2 }).steps[2].detail, '2 saved so far');
  assert.equal(planProgress({ sourceCount: 1, storyCount: 0 }).steps[2].detail, 'None saved yet');
  assert.equal(planProgress({ sourceCount: 1 }).steps[0].detail, '1 source read');
});

test('story rows only keep objects', () => {
  assert.deepEqual(storyRows(null), []);
  const rows = storyRows([{ id: 'a', title: 'T', theme: 'Perf' }, null, 'x', { title: { bad: 1 } }]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].theme, 'Perf');
  assert.equal(rows[1].title, 'Your story');
});
