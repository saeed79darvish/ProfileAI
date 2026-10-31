const { test } = require('node:test');
const assert = require('node:assert/strict');

const { scrubBannedLanguage } = require('./writingRules');

// The sentence pass used to rejoin on a space, flattening bullets into a
// paragraph; the additive check then reverted every enhanced role.
test('scrubbing keeps one bullet per line', () => {
  const text = 'Led the UI rebuild.\nBuilt the BFF layer.\n\nShipped the player.';
  assert.equal(scrubBannedLanguage(text).text, text);
});
