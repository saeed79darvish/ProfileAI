const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LEVEL,
  LEVEL_FIT,
  candidateLevelFromPreferences,
  resolveCandidateLevel,
  jobLevel,
  levelFitAdjustment,
  excludesEarlyCareer,
  isEarlyCareerTitle,
  levelFitSql,
  notEarlyCareerSql,
  EARLY_CAREER_PG,
} = require('./jobSeniorityFit');

test('a student career stage wins over a stated seniority', () => {
  assert.equal(candidateLevelFromPreferences({ careerStage: 'new_grad' }), LEVEL.STUDENT);
  assert.equal(candidateLevelFromPreferences({ careerStage: 'internship', seniority: 'entry' }), LEVEL.STUDENT);
});

test('coach level ids map onto the shared scale', () => {
  assert.equal(candidateLevelFromPreferences({ seniority: 'entry' }), LEVEL.ENTRY);
  assert.equal(candidateLevelFromPreferences({ seniority: 'ic' }), LEVEL.MID);
  assert.equal(candidateLevelFromPreferences({ seniority: 'senior' }), LEVEL.SENIOR);
  for (const id of ['staff', 'principal', 'lead', 'manager', 'director', 'head']) {
    assert.equal(candidateLevelFromPreferences({ seniority: id }), LEVEL.STAFF_PLUS, id);
  }
});

test('stages and levels that describe a path, not a rung, carry no level', () => {
  assert.equal(candidateLevelFromPreferences({ careerStage: 'career_change' }), null);
  assert.equal(candidateLevelFromPreferences({ careerStage: 'experienced' }), null);
  assert.equal(candidateLevelFromPreferences({ seniority: 'consultant' }), null);
  assert.equal(candidateLevelFromPreferences({ seniority: 'owner' }), null);
  assert.equal(candidateLevelFromPreferences({}), null);
  assert.equal(candidateLevelFromPreferences(null), null);
});

test('what they said beats what the profile implies; nothing means no level', () => {
  assert.deepEqual(
    resolveCandidateLevel({ constraints: { seniority: 'senior' }, inferredLevel: 'entry' }),
    { level: LEVEL.SENIOR, source: 'stated' }
  );
  assert.deepEqual(
    resolveCandidateLevel({ constraints: { careerStage: 'career_change' }, inferredLevel: 'lead' }),
    { level: LEVEL.STAFF_PLUS, source: 'inferred' }
  );
  assert.deepEqual(resolveCandidateLevel({ constraints: {}, inferredLevel: null }), { level: null, source: null });
});

test('a job reads early-career from the title before the structured level', () => {
  // The structured field calls a PhD internship "mid"; the title knows better.
  assert.equal(jobLevel({ title: 'Machine Learning PhD Intern', experienceLevel: 'mid' }), LEVEL.STUDENT);
  assert.equal(jobLevel({ title: "New Grad Software Engineer '26" }), LEVEL.STUDENT);
  assert.equal(jobLevel({ title: 'Electrician Apprentice' }), LEVEL.STUDENT);
  assert.equal(jobLevel({ title: 'Software Engineer', experienceLevel: 'senior' }), LEVEL.SENIOR);
  assert.equal(jobLevel({ title: 'Staff Engineer' }), LEVEL.STAFF_PLUS);
  assert.equal(jobLevel({ title: 'Junior Accountant' }), LEVEL.ENTRY);
  assert.equal(jobLevel({ title: 'Software Engineer' }), null);
});

test('"Internal" and "International" are not internships', () => {
  assert.equal(isEarlyCareerTitle('Internal Audit Manager'), false);
  assert.equal(isEarlyCareerTitle('Sr. Accountant, International'), false);
  assert.equal(isEarlyCareerTitle('Summer Intern, Finance'), true);
  assert.equal(jobLevel({ title: 'Internal Tools Engineer' }), null);
});

test('students are lifted towards internships and away from senior roles', () => {
  assert.ok(levelFitAdjustment(LEVEL.STUDENT, LEVEL.STUDENT) > 0);
  assert.ok(levelFitAdjustment(LEVEL.STUDENT, LEVEL.ENTRY) > 0);
  assert.ok(levelFitAdjustment(LEVEL.STUDENT, LEVEL.SENIOR) < 0);
  assert.ok(levelFitAdjustment(LEVEL.STUDENT, LEVEL.STAFF_PLUS) < levelFitAdjustment(LEVEL.STUDENT, LEVEL.SENIOR));
});

test('senior people are lifted at their level and away from entry roles', () => {
  assert.ok(levelFitAdjustment(LEVEL.SENIOR, LEVEL.SENIOR) > 0);
  assert.ok(levelFitAdjustment(LEVEL.SENIOR, LEVEL.ENTRY) < 0);
  assert.ok(levelFitAdjustment(LEVEL.MID, LEVEL.MID) > 0);
  assert.ok(levelFitAdjustment(LEVEL.MID, LEVEL.MID) <= 0.05, 'mid preference stays mild');
});

test('an unknown level on either side changes nothing', () => {
  assert.equal(levelFitAdjustment(null, LEVEL.SENIOR), 0);
  assert.equal(levelFitAdjustment(LEVEL.SENIOR, null), 0);
});

test('every adjustment stays within two bands of the feed score', () => {
  // One band is 0.1 of a rank score whose relevance part tops out at 0.8; a
  // level term larger than this would let level outrank a much better role match.
  for (const row of LEVEL_FIT) {
    for (const adj of row) assert.ok(Math.abs(adj) <= 0.2, `adjustment ${adj} too large`);
  }
});

test('internships are excluded for senior and above unless asked for', () => {
  assert.equal(excludesEarlyCareer(LEVEL.SENIOR), true);
  assert.equal(excludesEarlyCareer(LEVEL.STAFF_PLUS), true);
  assert.equal(excludesEarlyCareer(LEVEL.MID), false);
  assert.equal(excludesEarlyCareer(LEVEL.STUDENT), false);
  assert.equal(excludesEarlyCareer(null), false);
  assert.equal(excludesEarlyCareer(LEVEL.SENIOR, { employmentType: 'full-time,internship' }), false);
  assert.equal(excludesEarlyCareer(LEVEL.SENIOR, { experienceLevel: 'entry' }), false);
  assert.equal(excludesEarlyCareer(LEVEL.SENIOR, { search: 'design internship' }), false);
  assert.equal(excludesEarlyCareer(LEVEL.SENIOR, { search: 'frontend engineer' }), true);
});

test('the SQL builders are safe to inline and null without a candidate level', () => {
  assert.equal(levelFitSql(null), null);
  const sql = levelFitSql(LEVEL.SENIOR, 'ej');
  assert.match(sql, /CASE/);
  assert.match(sql, /WHEN 3 THEN 0\.040/);
  // Inlined into a bound query: no quotes, backslashes or `$` in the pattern.
  assert.doesNotMatch(EARLY_CAREER_PG, /['\\$]/);
  assert.match(notEarlyCareerSql('ej.title'), /^NOT \(COALESCE\(ej\.title, ''\) ~\* '/);
});
