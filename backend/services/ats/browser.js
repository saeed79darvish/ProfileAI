/**
 * Shared browser launcher for the Puppeteer ATS adapters.
 *
 * Every adapter used to hardcode its own user agent (Chrome 120 or 124
 * on an old macOS) while the bundled browser is a newer Chromium, so
 * the UA string, navigator.userAgentData and the real engine disagreed.
 * We now take the browser's own UA and only drop the "Headless" marker,
 * so everything a site can read reports the same version.
 */
let puppeteerLib = null;

function getPuppeteer() {
  if (puppeteerLib) return puppeteerLib;
  try {
    const extra = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    extra.use(StealthPlugin());
    puppeteerLib = extra;
  } catch (_) {
    try {
      puppeteerLib = require('puppeteer');
    } catch (err) {
      throw new Error('puppeteer is not installed. Run `npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth` in /backend.');
    }
  }
  return puppeteerLib;
}

// Every browser an adapter opens, so a send that runs past its time
// limit can be closed from outside (adapters only close their own
// browser when they finish or throw).
const activeBrowsers = new Set();

async function closeAllBrowsers() {
  const list = [...activeBrowsers];
  activeBrowsers.clear();
  await Promise.allSettled(list.map((b) => b.close()));
  return list.length;
}

async function launchBrowser({ userDataDir, extraArgs = [], viewport = { width: 1280, height: 900 } } = {}) {
  const browser = await getPuppeteer().launch({
    headless: 'new',
    userDataDir: userDataDir || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      `--window-size=${viewport.width},${viewport.height}`,
      ...extraArgs,
    ],
  });
  activeBrowsers.add(browser);
  browser.once('disconnected', () => activeBrowsers.delete(browser));
  const ua = (await browser.userAgent()).replace(/HeadlessChrome/g, 'Chrome');
  const newPage = async () => {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.setUserAgent(ua);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    return page;
  };
  return { browser, newPage, userAgent: ua };
}

/**
 * True only when the page shows a CAPTCHA a person has to solve.
 *
 * Many ATS pages (Ashby, Lever) embed an invisible reCAPTCHA that scores
 * the session in the background and never asks the user anything. Its
 * iframe and [data-sitekey] are always present, so matching on those
 * alone flagged every application as needing a human. We only count a
 * visible checkbox/challenge widget.
 */
async function hasVisibleCaptcha(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 30 && r.height > 30 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };
    const frames = Array.from(document.querySelectorAll('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"]'));
    if (frames.some((f) => !/size=invisible/i.test(f.src) && !/\/bframe/i.test(f.src) && visible(f))) return true;
    const widgets = Array.from(document.querySelectorAll('div.g-recaptcha, div.h-captcha, div.cf-turnstile'));
    return widgets.some((w) => (w.getAttribute('data-size') || '').toLowerCase() !== 'invisible' && visible(w));
  }).catch(() => false);
}

module.exports = { getPuppeteer, launchBrowser, hasVisibleCaptcha, closeAllBrowsers };
