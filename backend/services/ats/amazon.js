const { createManualAdapter } = require('./manualAdapter');

module.exports = createManualAdapter({
  name: 'amazon',
  label: 'Amazon',
  matchers: [
    /https?:\/\/(?:www\.)?amazon\.jobs\//i,
    /https?:\/\/account\.amazon\.com\/jobs\//i,
  ],
  manualHint: 'Amazon automation is not implemented yet. Open the Amazon apply page, sign in, and submit manually.',
});