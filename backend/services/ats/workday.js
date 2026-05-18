const { createManualAdapter } = require('./manualAdapter');

module.exports = createManualAdapter({
  name: 'workday',
  label: 'Workday',
  matchers: [
    /https?:\/\/[\w.-]*myworkdayjobs\.com\//i,
    /https?:\/\/[\w.-]*workday\.com\//i,
  ],
  manualHint: 'Workday automation is not implemented yet. Open the Workday apply page, sign in, and submit manually.',
});
