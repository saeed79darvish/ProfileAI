const test = require('node:test');
const assert = require('node:assert/strict');
const { rejectedRoots } = require('./profileCoachService');

test('a field they turned down gives roots to keep out of the buttons', () => {
  assert.deepEqual(rejectedRoots(['i studied biology but i dont want to be a scientist']), ['scien']);
  assert.deepEqual(rejectedRoots(["I'm not interested in accounting anymore"]).includes('accou'), true);
});

test('wanting something gives no roots', () => {
  assert.deepEqual(rejectedRoots(['i want to be a data analyst', 'customer success or hr']), []);
});
