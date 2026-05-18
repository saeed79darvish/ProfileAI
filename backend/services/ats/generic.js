const { createManualAdapter } = require('./manualAdapter');

module.exports = createManualAdapter({
  name: 'generic',
  label: 'Generic ATS',
  matchers: [
    // Last-resort fallback for any absolute http(s) URL.
    /^https?:\/\//i,
  ],
  manualHint: 'This ATS is not automated yet. Open the application URL and submit manually.',
});
