/* utils/jobLocationFit — kept here because the test glob only covers services/. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { locationTier, candidateCountry } = require('../utils/jobLocationFit');

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
