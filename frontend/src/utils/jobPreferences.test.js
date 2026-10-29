import { test } from 'node:test';
import assert from 'node:assert/strict';

import { jobFiltersFrom, employmentTypeLabel, locationTypeLabel } from './jobPreferences.js';

test('jobFiltersFrom: work style maps to a work-type filter; flexible means none', () => {
  assert.deepEqual(jobFiltersFrom({ workStyle: 'remote' }), { locationType: 'remote' });
  assert.deepEqual(jobFiltersFrom({ workStyle: 'onsite' }), { locationType: 'onsite' });
  assert.deepEqual(jobFiltersFrom({ workStyle: 'flexible' }), {});
  assert.deepEqual(jobFiltersFrom({}), {});
  assert.deepEqual(jobFiltersFrom(null), {});
});

test('jobFiltersFrom: several role types become one list filter, in feed order', () => {
  assert.deepEqual(jobFiltersFrom({ roleTypes: ['contract', 'full-time'] }), { employmentType: 'full-time,contract' });
  assert.deepEqual(jobFiltersFrom({ roleTypes: ['full-time'] }), { employmentType: 'full-time' });
});

test('jobFiltersFrom: coach-only types map onto the nearest feed type', () => {
  assert.deepEqual(jobFiltersFrom({ roleTypes: ['freelance'] }), { employmentType: 'contract' });
  assert.deepEqual(jobFiltersFrom({ roleTypes: ['freelance', 'contract'] }), { employmentType: 'contract' });
  assert.deepEqual(jobFiltersFrom({ roleTypes: ['apprenticeship'] }), { employmentType: 'internship' });
  assert.deepEqual(jobFiltersFrom({ roleTypes: ['seasonal'] }), { employmentType: 'temporary' });
  assert.deepEqual(jobFiltersFrom({ roleTypes: ['something-else'] }), {});
});

test('jobFiltersFrom: every type picked means no filter', () => {
  const all = ['full-time', 'part-time', 'contract', 'internship', 'seasonal'];
  assert.deepEqual(jobFiltersFrom({ roleTypes: all }), {});
});

test('labels read well on a chip', () => {
  assert.equal(employmentTypeLabel('full-time,contract'), 'Full-time, Contract');
  assert.equal(locationTypeLabel('onsite'), 'On-site');
});
