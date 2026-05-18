const { createManualAdapter } = require('./manualAdapter');

module.exports = createManualAdapter({
  name: 'ashby',
  label: 'Ashby',
  matchers: [
    /https?:\/\/(?:jobs\.)?ashbyhq\.com\//i,
  ],
  manualHint: 'Ashby browser automation is not implemented yet. Open the Ashby apply page and submit manually.',
});
