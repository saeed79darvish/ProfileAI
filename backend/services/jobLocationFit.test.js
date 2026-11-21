/* utils/jobLocationFit — kept here because the test glob only covers services/. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { locationTier, candidateCountry, locationFactor, withLocationFactor } = require('../utils/jobLocationFit');

const tier = (where, location, locationType = null) => locationTier(where, { location, locationType });

test('the metro counts as their city', () => {
  for (const place of ['San Francisco, CA', 'San Mateo, CA', 'Palo Alto, California', 'San Francisco, CA (Hybrid)']) {
    assert.equal(tier('San Francisco, CA', place), 1, place);
  }
});

test('remote is only remote if their country is allowed', () => {
  assert.equal(tier('San Francisco, CA', 'Remote'), 2);
  assert.equal(tier('San Francisco, CA', 'Remote - United States', 'remote'), 2);
  assert.equal(tier('San Francisco, CA', 'US, Remote', 'remote'), 2);
  assert.equal(tier('San Francisco, CA', 'Remote - North America - Europe', 'remote'), 2);
  assert.equal(tier('San Francisco, CA', 'Anywhere in the world', 'remote'), 2);
  assert.equal(tier('San Francisco, CA', 'Budapest, Hungary', 'remote'), 0);
  assert.equal(tier('San Francisco, CA', 'Remote, Canada', 'remote'), 0);
});

test('another city at home comes last, another country not at all', () => {
  assert.equal(tier('San Francisco, CA', 'El Segundo, California, United States'), 3);
  assert.equal(tier('San Francisco, CA', 'Austin, TX'), 3);
  assert.equal(tier('San Francisco, CA', 'Warsaw'), 0);
  assert.equal(tier('San Francisco, CA', 'Toronto, ON'), 0);
});

test('outside the US, by the country they named', () => {
  assert.equal(candidateCountry('Berlin, Germany'), 'germany');
  assert.equal(tier('Berlin, Germany', 'Munich, Germany'), 3);
  assert.equal(tier('Berlin, Germany', 'Remote, Germany', 'remote'), 2);
  assert.equal(tier('Berlin, Germany', 'Austin, TX'), 0);
});

test('no place given: remote first, nothing dropped', () => {
  assert.equal(tier('', 'Remote', 'remote'), 2);
  assert.equal(tier('', 'Warsaw'), 3);
});

test('a place mismatch lowers a match score, and not knowing a place does not', () => {
  const sf = 'San Francisco, California, United States';
  // The screenshot case: an on-site job in Bucharest for a San Francisco profile.
  assert.equal(locationFactor(sf, { location: 'Bucharest', locationType: 'onsite' }).factor, 0.6);
  assert.equal(locationFactor(sf, { location: 'Bucharest, Romania', locationType: 'remote' }).factor, 0.6);
  assert.equal(locationFactor(sf, { location: 'San Mateo, CA United States', locationType: 'onsite' }).factor, 1);
  assert.equal(locationFactor(sf, { location: 'New York or San Francisco', locationType: 'remote' }).factor, 1);
  assert.equal(locationFactor(sf, { location: 'Remote', locationType: 'remote' }).factor, 1);
  assert.equal(locationFactor(sf, { location: 'Austin, TX', locationType: 'onsite' }).factor, 0.8);
  assert.equal(locationFactor('', { location: 'Bucharest' }).factor, 1);
  assert.equal(locationFactor(sf, { location: '', locationType: null }).factor, 1);
});

test('withLocationFactor scales both scores and records why, leaving a fit alone', () => {
  const data = { score: 80, projectedScore: 90, components: { coverage: 0.8 } };
  assert.deepEqual(withLocationFactor(data, { factor: 0.6, tier: 0 }), {
    score: 48, projectedScore: 54, components: { coverage: 0.8, locationFit: 0.6, locationTier: 0 },
  });
  assert.equal(withLocationFactor(data, { factor: 1, tier: 1 }), data);
});
