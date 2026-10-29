const test = require('node:test');
const assert = require('node:assert/strict');

const { rankJobs, inferExperienceLevel, inferExperienceLevelOrNull, careerSignals } = require('./jobRelevanceService');

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const job = (id, title, extra = {}) => ({
  id, title, company: `Co ${id}`, description: '', skills: [], location: 'Remote',
  locationType: 'remote', effectivePostedAt: daysAgo(1), ...extra,
});

test('the level reading has a null form for profiles that say nothing', () => {
  assert.equal(inferExperienceLevel(0, ''), 'mid');
  assert.equal(inferExperienceLevelOrNull(0, ''), null);
  assert.equal(inferExperienceLevelOrNull(0, 'Senior Product Designer'), 'senior');
  assert.equal(inferExperienceLevelOrNull(12, 'Designer'), 'lead');
});

test('a stated level only counts when it was actually stated', () => {
  assert.equal(careerSignals({ seniority: 'senior' }).statedLevel, 3);
  assert.equal(careerSignals({ careerStage: 'new_grad' }).statedLevel, 0);
  assert.equal(careerSignals({}).statedLevel, null);
  assert.equal(careerSignals(null, '  Engineering Manager ').targetTitle, 'engineering manager');
});

test('a stated student stage scores internships above senior roles', () => {
  const profile = { title: 'Software Engineer', experience: [], skills: [] };
  const jobs = [job(1, 'Senior Software Engineer', { experienceLevel: 'senior' }), job(2, 'Software Engineer Intern')];
  const ranked = rankJobs(jobs, profile, { sortMode: 'match', preferences: { careerStage: 'new_grad' } });
  assert.equal(ranked[0].id, 2);
  // Without the stated stage the profile reads as mid, and the intern role
  // gets no level credit.
  const plain = rankJobs(jobs, profile, { sortMode: 'match' });
  const internPlain = plain.find((j) => j.id === 2).relevanceScore;
  const internStated = ranked.find((j) => j.id === 2).relevanceScore;
  assert.ok(internStated > internPlain);
});

test('an internship is never a near-miss for a stated senior', () => {
  const profile = { title: 'Software Engineer', experience: [], skills: [] };
  const jobs = [job(1, 'Software Engineer Intern'), job(2, 'Senior Software Engineer', { experienceLevel: 'senior' })];
  const ranked = rankJobs(jobs, profile, { sortMode: 'match', preferences: { seniority: 'senior' } });
  assert.equal(ranked[0].id, 2);
});

test('the target role counts as a title match without displacing the current one', () => {
  const profile = { title: 'Frontend Engineer', experience: [], skills: [] };
  const jobs = [job(1, 'Data Scientist, Growth'), job(2, 'Frontend Engineer, Growth')];
  const withoutTarget = rankJobs(jobs, profile, { sortMode: 'match' });
  const withTarget = rankJobs(jobs, profile, { sortMode: 'match', target: 'Data Scientist' });
  const em = (list) => list.find((j) => j.id === 1).titleMatch;
  const swe = (list) => list.find((j) => j.id === 2).titleMatch;
  assert.ok(em(withTarget) > em(withoutTarget));
  assert.equal(swe(withTarget), swe(withoutTarget));
});
