import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeDictation } from './useDictation.js';

/* Dictation appends to the box rather than replacing it: someone who typed
   half an answer and then reached for the mic must not lose the half. */

test('speech joins what was already typed', () => {
  assert.equal(mergeDictation('', 'I am a staff engineer'), 'I am a staff engineer');
  assert.equal(mergeDictation('I work at ', 'Acme since 2019'), 'I work at Acme since 2019');
  assert.equal(mergeDictation('half typed', ''), 'half typed');
  assert.equal(mergeDictation('', ''), '');
});

test('no double spaces where the two meet', () => {
  assert.equal(mergeDictation('I work at   ', '   Acme'), 'I work at Acme');
});
