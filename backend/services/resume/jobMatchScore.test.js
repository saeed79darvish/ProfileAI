const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreJobMatch, isKnockout, normalizeType, BLOCKED_SCORE_CAP } = require('./jobMatchScore');

const req = (requirement, extra = {}) => ({
  requirement,
  type: 'skill',
  hardness: 'must',
  coverage: 'strong',
  ...extra,
});

/** A strong frontend match with one missing tool — the shape that used to read 49. */
const strongWithOneGap = {
  roleFit: 0.95,
  recency: 1,
  seniorityFit: 1,
  requirements: [
    req('React'),
    req('TypeScript'),
    req('Modern JavaScript'),
    req('Component architecture'),
    req('Testing client-side code'),
    req('Webpack', { coverage: 'none' }),
  ],
};

test('one missing tool costs its share but does not cap the score', () => {
  const r = scoreJobMatch(strongWithOneGap);
  assert.ok(r.score > BLOCKED_SCORE_CAP, `capped at ${r.score} for a single tool`);
  assert.equal(r.blockers.length, 0);
  assert.equal(r.components.cappedByBlockers, false);
});

test('a missing core requirement the model marks as a knockout still caps', () => {
  const read = {
    ...strongWithOneGap,
    requirements: [...strongWithOneGap.requirements.slice(0, 5), req('Swift for native iOS', { coverage: 'none', knockout: true })],
  };
  const r = scoreJobMatch(read);
  assert.ok(r.score <= BLOCKED_SCORE_CAP);
  assert.equal(r.blockers.length, 1);
});

test('a stated years minimum is a knockout even when typed as generic experience', () => {
  const years = normalizeType({ requirement: '7+ years of frontend experience', type: 'experience' });
  assert.equal(years.type, 'experience_years');
  assert.equal(isKnockout({ ...years, hardness: 'must', coverage: 'none' }), true);
  // Without a number it stays an ordinary requirement.
  assert.equal(normalizeType({ requirement: 'Experience shipping consumer apps', type: 'experience' }).type, 'experience');
});

test('a degree caps only when read as a hard requirement with no experience substitute', () => {
  const degree = { type: 'education', hardness: 'must', coverage: 'none' };
  // Listed among qualifications: a weighted gap, not a knockout.
  assert.equal(isKnockout({ ...degree, requirement: 'BS in Computer Science or related field' }), false);
  // The model read it as required.
  assert.equal(isKnockout({ ...degree, requirement: 'PhD in Machine Learning (required)', knockout: true }), true);
  // Experience substitutes, whatever the model said.
  assert.equal(isKnockout({ ...degree, requirement: 'BS in CS or equivalent practical experience', knockout: true }), false);
  assert.equal(isKnockout({ ...degree, requirement: "Bachelor's degree or equivalent experience", knockout: true }), false);
});

test('nice-to-haves, soft skills and covered items are never knockouts', () => {
  assert.equal(isKnockout(req('React Native', { hardness: 'nice', coverage: 'none', knockout: true })), false);
  assert.equal(isKnockout(req('Great communication', { type: 'soft', coverage: 'none', knockout: true })), false);
  assert.equal(isKnockout(req('Swift', { coverage: 'partial', knockout: true })), false);
});

test('the scored requirements are returned with normalized types', () => {
  const r = scoreJobMatch({
    roleFit: 1,
    recency: 1,
    requirements: [req('5+ years building web apps', { type: 'experience' }), req('React')],
  });
  assert.equal(r.requirements[0].type, 'experience_years');
});
