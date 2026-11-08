import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, levelLabel, normalizeLevel, isPaidUser, validateJobInput, parseJobBody, normalizeJob, validateConfirm, jobStartBody,
  validateRoleForm, roleStartBody, tailoredRows, prepRow, prepRows, initialOf, avatarColor, apiErrorState, isPrepIdMode, prepHeading, refreshBody,
} from './startLogic.js';

test('levels and labels', () => {
  assert.equal(LEVELS.length, 7);
  assert.equal(levelLabel('senior'), 'Senior');
  assert.equal(levelLabel('nope'), '');
  assert.equal(normalizeLevel('Senior'), 'senior');
  assert.equal(normalizeLevel('Sr. Engineer'), 'senior');
  assert.equal(normalizeLevel('Staff Engineer'), 'staff');
  assert.equal(normalizeLevel('Engineering Manager'), 'manager');
  assert.equal(normalizeLevel('wizard'), '');
  assert.equal(normalizeLevel(null), '');
});
test('isPaidUser', () => {
  assert.equal(isPaidUser({ subscriptionTier: 'pro' }), true);
  assert.equal(isPaidUser({ subscriptionTier: 'pro_plus' }), true);
  assert.equal(isPaidUser({ subscriptionTier: 'free', role: 'admin' }), true);
  assert.equal(isPaidUser({ subscriptionTier: 'free' }), false);
  assert.equal(isPaidUser(null), false);
});
test('validateJobInput: link, description, empty, too short', () => {
  assert.equal(validateJobInput('').ok, false);
  assert.equal(validateJobInput('hello').ok, false);
  const link = validateJobInput('  https://boards.greenhouse.io/glean/jobs/1 ');
  assert.deepEqual(parseJobBody(link), { url: 'https://boards.greenhouse.io/glean/jobs/1' });
  const text = validateJobInput('We are hiring a senior frontend engineer to build our product with React.');
  assert.equal(text.ok, true);
  assert.deepEqual(Object.keys(parseJobBody(text)), ['text']);
});
test('normalizeJob handles junk and objects', () => {
  const j = normalizeJob({ company: null, jobTitle: { a: 1 }, level: 'Senior', summary: ' Build UI ', source: 'link' });
  assert.deepEqual(j, { company: '', role: '', level: 'senior', summary: 'Build UI', source: 'link' });
  assert.equal(normalizeJob(undefined).source, 'text');
});
test('validateConfirm requires company and role', () => {
  assert.equal(validateConfirm({ company: '', role: 'Dev' }).errors.company.length > 0, true);
  assert.equal(validateConfirm({ company: 'Glean', role: '' }).errors.role.length > 0, true);
  assert.equal(validateConfirm({ company: 'Glean', role: 'Dev' }).ok, true);
});
test('jobStartBody', () => {
  assert.deepEqual(jobStartBody({ company: ' Glean ', role: 'Dev', level: 'senior' }, 'link'), { company: 'Glean', jobTitle: 'Dev', source: 'link', level: 'senior' });
  assert.equal('level' in jobStartBody({ company: 'A', role: 'B', level: '' }, 'text'), false);
});
test('role form', () => {
  assert.equal(validateRoleForm({ role: '', level: 'senior' }).errors.role.length > 0, true);
  assert.equal(validateRoleForm({ role: 'Dev', level: '' }).errors.level.length > 0, true);
  assert.equal(validateRoleForm({ role: 'Dev', level: 'senior' }).ok, true);
  assert.deepEqual(roleStartBody({ role: ' Dev ', level: 'staff', company: '' }), { company: '', jobTitle: 'Dev', level: 'staff', source: 'role' });
});
test('tailoredRows sorts newest first and drops inactive or empty', () => {
  const rows = tailoredRows([
    { id: 1, companyName: 'A', jobTitle: 'X', createdAt: '2026-01-01' },
    { id: 2, companyName: 'B', jobTitle: 'Y', createdAt: '2026-05-01' },
    { id: 3, companyName: '', jobTitle: '' },
    { id: 4, companyName: 'C', jobTitle: 'Z', isActive: false },
  ]);
  assert.deepEqual(rows.map((r) => r.id), [2, 1]);
  assert.deepEqual(tailoredRows(null), []);
});
test('prepRow for company and role scope', () => {
  const c = prepRow({ id: 'a', company: 'Glean', role: 'Frontend', scope: 'company', generatedAt: '2026-03-10T00:00:00Z', storyCount: 1 });
  assert.equal(c.title, 'Glean');
  assert.equal(c.sub, 'Frontend');
  assert.equal(c.researched, 'Researched March 2026');
  assert.equal(c.stories, '1 story');
  const r = prepRow({ id: 'b', company: '', role: 'Full stack developer', scope: 'role', level: 'senior', storyCount: 0 });
  assert.equal(r.title, 'Full stack developer');
  assert.equal(r.sub, 'Across companies, Senior');
  assert.equal(r.stories, '0 stories');
  assert.equal(r.researched, '');
});
test('prepRows sorts and skips id-less', () => {
  const rows = prepRows([{ id: 1, role: 'a', generatedAt: '2026-01-01' }, { id: 2, role: 'b', lastOpenedAt: '2026-06-01' }, { role: 'x' }]);
  assert.deepEqual(rows.map((r) => r.id), [2, 1]);
});
test('apiErrorState', () => {
  const err = (status, data) => ({ response: { status, data } });
  assert.equal(apiErrorState(err(422, { code: 'unreadable', message: 'Nope' })).message, 'Nope');
  assert.equal(apiErrorState(err(422, { code: 'unreadable' })).kind, 'unreadable');
  assert.equal(apiErrorState(err(403, { code: 'upgrade_required' })).kind, 'upgrade');
  assert.equal(apiErrorState(err(403, { upgradeRequired: true })).kind, 'upgrade');
  assert.equal(apiErrorState(err(429, { feature: 'interview_prep' })).kind, 'limit');
  assert.equal(apiErrorState(err(503, { code: 'search_not_configured' })).kind, 'unavailable');
  assert.equal(apiErrorState(err(400, { message: 'bad' })).kind, 'invalid');
  assert.equal(apiErrorState(new Error('x')).kind, 'failed');
  assert.equal(apiErrorState(undefined).kind, 'failed');
});
test('isPrepIdMode', () => {
  assert.equal(isPrepIdMode({ prepId: 'abc' }), true);
  assert.equal(isPrepIdMode({ tailoredId: '5' }), false);
  assert.equal(isPrepIdMode({}), false);
});
test('prepHeading', () => {
  assert.deepEqual(prepHeading({ company: 'Glean', role: 'FE', scope: 'company' }), { title: 'Interview prep: Glean', role: 'FE', acrossCompanies: false });
  assert.deepEqual(prepHeading({ company: '', role: 'Full stack', scope: 'role' }), { title: 'Interview prep: Full stack', role: '', acrossCompanies: true });
  assert.equal(prepHeading(null).title, 'Interview prep');
});
test('refreshBody', () => {
  assert.deepEqual(refreshBody({ company: 'Glean', role: 'FE', scope: 'company', level: 'Senior' }), { company: 'Glean', jobTitle: 'FE', refresh: true, level: 'senior' });
  assert.equal(refreshBody({ company: '', role: 'FE', scope: 'role', level: 'staff' }).source, 'role');
});
test('initialOf and avatarColor are stable', () => {
  assert.equal(initialOf(' stripe'), 'S');
  assert.equal(initialOf(''), '');
  assert.equal(initialOf(null), '');
  assert.equal(avatarColor('Stripe'), avatarColor('stripe'));
  assert.match(avatarColor('x'), /^#[0-9a-f]{6}$/);
});
test('prepRow carries avatar fields', () => {
  const c = prepRow({ id: 'a', company: 'Glean', role: 'Frontend', scope: 'company' });
  assert.equal(c.isRole, false);
  assert.equal(c.initial, 'G');
  const r = prepRow({ id: 'b', role: 'Dev', scope: 'role' });
  assert.equal(r.isRole, true);
});
