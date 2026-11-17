/* utils/companyKey — kept here because the test glob only covers services/. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { companyKey } = require('../utils/companyKey');

test('spellings of one employer share a key', () => {
  assert.equal(companyKey('Coupang'), companyKey('Coupang Internal'));
  assert.equal(companyKey('Atoms'), companyKey('ATOMS Careers page'));
  assert.equal(companyKey('Acme, Inc.'), companyKey('ACME'));
  assert.equal(companyKey('Acme (Remote)'), companyKey('acme'));
  assert.equal(companyKey('Zalando SE'), 'zalando se');
});

test('different employers are never merged', () => {
  assert.notEqual(companyKey('Atoms'), companyKey('Atom'));
  assert.notEqual(companyKey('Stripe'), companyKey('Stripe Climate'));
  assert.notEqual(companyKey('Rivian'), companyKey('Rivian and Volkswagen Group Technologies'));
});

test('names that are only noise, or empty, do not collapse to nothing', () => {
  assert.equal(companyKey('Jobs Inc'), 'jobs inc');
  assert.equal(companyKey(''), '');
  assert.equal(companyKey(null), '');
});
