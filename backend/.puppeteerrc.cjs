/**
 * Keep Puppeteer's Chrome inside the project folder.
 *
 * By default Puppeteer downloads Chrome to ~/.cache/puppeteer. On Render
 * that is /opt/render/.cache/puppeteer, which exists during the build but
 * is NOT part of what Render runs, so at runtime every ApplyPilot send
 * failed with "Could not find Chrome (ver. 131...)". Files under the
 * project folder (rootDir: backend) are kept, so the download made by
 * `npm ci` is still there when the server starts.
 */
const { join } = require('path');

module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
