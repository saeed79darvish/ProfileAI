/* utils/roleFamily — kept here because the test glob only covers services/. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { titleFamily, profileFamily, familyFits } = require('../utils/roleFamily');

test('reads the one family a title names', () => {
  assert.equal(titleFamily('Staff Software Engineer, Frontend Platform'), 'frontend');
  assert.equal(titleFamily('Software Engineer (Front-End Focus)'), 'frontend');
  assert.equal(titleFamily('Backend Software Engineer, Infrastructure'), 'backend');
  assert.equal(titleFamily('iOS Engineer'), 'mobile');
  assert.equal(titleFamily('Machine Learning Engineer'), 'ml');
});

test('says nothing for generalists and for titles that name no family', () => {
  for (const t of ['Senior Software Engineer', 'Full Stack Engineer', 'Fullstack Developer', 'Platform Engineer', 'Senior Laravel Developer + React', '']) {
    assert.equal(titleFamily(t), null, t);
  }
});

test('a frontend profile is never sent to a backend job, and is not cut off from unlabelled ones', () => {
  const me = profileFamily({ title: 'Staff Software Engineer, Frontend Platform' });
  assert.equal(me, 'frontend');
  assert.equal(familyFits(me, 'Backend Software Engineer, Infrastructure'), false);
  assert.equal(familyFits(me, 'Senior Software Engineer'), true);
  assert.equal(familyFits(me, 'Frontend Engineer'), true);
  assert.equal(familyFits(null, 'Backend Engineer'), true);
});

test('the profile family falls back to the latest role when the title names none', () => {
  assert.equal(profileFamily({ title: 'Software Engineer', experience: [{ title: 'Frontend Engineer', current: true }] }), 'frontend');
  assert.equal(profileFamily({ title: 'Software Engineer' }), null);
});
