const { createManualAdapter } = require('./manualAdapter');

module.exports = createManualAdapter({
  name: 'lever',
  label: 'Lever',
  matchers: [
    /https?:\/\/(?:jobs\.)?lever\.co\//i,
  ],
  manualHint: 'Lever browser automation is not implemented yet. Open the Lever apply page and submit manually.',
});
