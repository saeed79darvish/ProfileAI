import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pluralize } from './pluralize.js';

test('pluralize: returns singular for count === 1', () => {
  assert.equal(pluralize(1, 'Role'), 'Role');
  assert.equal(pluralize(1, 'Skill'), 'Skill');
});

test('pluralize: returns plural for count === 0 (English convention)', () => {
  assert.equal(pluralize(0, 'Role'), 'Roles');
  assert.equal(pluralize(0, 'Skill'), 'Skills');
});

test('pluralize: returns plural for count > 1', () => {
  assert.equal(pluralize(2, 'Role'), 'Roles');
  assert.equal(pluralize(10, 'Skill'), 'Skills');
});

test('pluralize: defaults plural to singular + "s"', () => {
  assert.equal(pluralize(2, 'Project'), 'Projects');
});

test('pluralize: honours an explicit irregular plural', () => {
  assert.equal(pluralize(1, 'child', 'children'), 'child');
  assert.equal(pluralize(2, 'child', 'children'), 'children');
  assert.equal(pluralize(0, 'child', 'children'), 'children');
});

test('pluralize: explicit same-form plural acts as mass-noun opt-out', () => {
  // For "Education" we want the label to read identically regardless of
  // count. Passing the same string twice makes the intent obvious at
  // the call site without forcing the helper to know about mass nouns.
  assert.equal(pluralize(1, 'Education', 'Education'), 'Education');
  assert.equal(pluralize(2, 'Education', 'Education'), 'Education');
  assert.equal(pluralize(0, 'Education', 'Education'), 'Education');
});
