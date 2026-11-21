import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { buildFixtures, OUT_DIR } from './build-fixtures.mjs';

let R;
before(async () => {
  await buildFixtures();
  R = await import(resolve(OUT_DIR, 'fieldRules.mjs'));
});

const is = (type, ...ids) => R.isFieldType(type, ids);

test('a city field is a city field, and ethnicity or capacity is not', () => {
  assert.ok(is('city', 'city'));
  assert.ok(is('city', 'Current City'));
  assert.ok(is('city', 'currentcity'));
  assert.ok(is('city', 'address_city', 'Home city'));
  assert.ok(is('city', 'address-level2'));
  for (const id of ['Ethnicity', 'ethnicity', 'Race/Ethnicity', 'Capacity', 'velocity', 'authenticity', 'Electricity']) {
    assert.equal(is('city', id), false, id);
  }
});

test('state matches only a state field', () => {
  assert.ok(is('state', 'State'));
  assert.ok(is('state', 'State *'));
  assert.ok(is('state', 'State / Province'));
  assert.ok(is('state', 'address-level1'));
  assert.ok(is('state', 'Province'));
  for (const id of ['Statement of purpose', 'United States', 'Real estate experience', 'Statistics', 'What is your status?']) {
    assert.equal(is('state', id), false, id);
  }
});

test('zip and postal code fields, not ZipRecruiter', () => {
  for (const id of ['Zip', 'ZIP code', 'zipcode', 'Postal Code', 'postal_code', 'Postcode', 'post code', 'address_postal']) {
    assert.ok(is('zip', id), id);
  }
  assert.equal(is('zip', 'ZipRecruiter'), false);
  assert.equal(is('zip', 'First name'), false);
});

test('relocation and excellence do not read as a location or a cell phone', () => {
  assert.equal(R.scrubIdentifier('Are you open to relocation?').includes('location'), false);
  assert.equal(R.scrubIdentifier('Commitment to excellence').includes('cell'), false);
  assert.ok(R.scrubIdentifier('Current location').includes('location'));
});

test('a location is read for what it plainly says', () => {
  assert.deepEqual(R.parseLocation('San Francisco, CA'), {
    city: 'San Francisco', state: 'California', stateCode: 'CA', country: 'United States', zip: '',
  });
  assert.deepEqual(R.parseLocation('San Francisco, California, United States'), {
    city: 'San Francisco', state: 'California', stateCode: 'CA', country: 'United States', zip: '',
  });
  assert.deepEqual(R.parseLocation('Austin, TX 78701'), {
    city: 'Austin', state: 'Texas', stateCode: 'TX', country: 'United States', zip: '78701',
  });
});

test('places outside the US keep a city and country and no invented state', () => {
  const blr = R.parseLocation('Bangalore, India');
  assert.equal(blr.city, 'Bangalore');
  assert.equal(blr.country, 'India');
  assert.equal(blr.state, '');
  assert.equal(R.parseLocation('Bucharest').city, 'Bucharest');
});

test('an empty or odd location gives nothing rather than a guess', () => {
  assert.deepEqual(R.parseLocation(''), { city: '', state: '', stateCode: '', country: '', zip: '' });
  assert.equal(R.parseLocation('Remote').zip, '');
  // No zip in the text means no zip out: a made-up one would be submitted.
  assert.equal(R.parseLocation('San Francisco, CA').zip, '');
});

test('fact questions are recognised so rules never answer them', () => {
  for (const q of [
    'Are you legally authorized to work in the United States?',
    'Will you now or in the future require sponsorship for an employment visa?',
    'Are you open to relocation?',
    'Are you comfortable working on-site 5 days a week?',
    'What is your notice period?',
    'Desired salary',
    'How did you hear about us?',
    'When can you start?',
  ]) assert.ok(R.isFactShapedQuestion(q), q);
  for (const q of ['Gender', 'First name', 'Do you have a non-compete agreement?', 'Why do you want to work here?', 'LinkedIn profile']) {
    assert.equal(R.isFactShapedQuestion(q), false, q);
  }
});
