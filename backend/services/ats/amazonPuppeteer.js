const fs = require('fs');
const os = require('os');
const path = require('path');
const { uploadScreenshot } = require('../screenshotUpload');

let puppeteerLib = null;
function getPuppeteer() {
  if (!puppeteerLib) {
    try {
      puppeteerLib = require('puppeteer');
    } catch (_) {
      throw new Error('puppeteer is not installed. Run `npm install puppeteer` in /backend to enable Amazon automation.');
    }
  }
  return puppeteerLib;
}

function parseUrl(url) {
  if (!url) return null;
  const raw = String(url);
  if (/https?:\/\/account\.amazon\.com\/jobs\/[\w-]+\/apply/i.test(raw)) {
    return { kind: 'account-apply' };
  }
  if (/https?:\/\/(?:www\.)?amazon\.jobs\//i.test(raw)) {
    return { kind: 'job-page' };
  }
  return null;
}

function matches(url) {
  return !!parseUrl(url);
}

async function captureStep(page, { userId, appId, step, label }) {
  let url = null;
  try {
    const buffer = await page.screenshot({ type: 'png', fullPage: true });
    url = await uploadScreenshot(buffer, { userId, appId, step, label });
  } catch (err) {
    console.warn(`[amazonPuppeteer] screenshot step=${step} failed: ${err.message}`);
  }
  return { url, label, capturedAt: new Date().toISOString() };
}

async function hasSelector(page, selector) {
  try {
    return !!(await page.$(selector));
  } catch {
    return false;
  }
}

async function detectHumanBlockers(page) {
  const blockers = [];

  const loginSelectors = [
    '#ap_email',
    '#ap_password',
    'form[action*="signin"]',
    'input[name="email"]',
    'input[name="password"]',
    'button[name="signInSubmit"]',
  ];
  for (const selector of loginSelectors) {
    if (await hasSelector(page, selector)) {
      blockers.push({
        field: { label: 'Amazon account login', rawName: 'amazon_login' },
        reason: 'login_required',
      });
      break;
    }
  }

  const captchaSelectors = [
    'input[name="cvf_captcha_input"]',
    '#captchacharacters',
    'img[src*="captcha"]',
    'iframe[src*="captcha"]',
  ];
  for (const selector of captchaSelectors) {
    if (await hasSelector(page, selector)) {
      blockers.push({
        field: { label: 'Captcha challenge', rawName: 'captcha' },
        reason: 'captcha_required',
      });
      break;
    }
  }

  return blockers;
}

async function findSubmitElement(page) {
  // Order matters: prefer real <button type="submit"> inside an actual
  // application form. The text-based fallback below was previously
  // matching Amazon's nav "Apply now" button on listing pages, which
  // just redirected to /search and looked like a failed submission.
  const selectors = [
    'form button[type="submit"]',
    'form input[type="submit"]',
    'button[type="submit"]',
    'input[type="submit"]',
    'button[id*="submit"]',
    'button[data-test-id*="submit"]',
  ];
  for (const selector of selectors) {
    const el = await page.$(selector);
    if (el) return el;
  }

  // Text-based fallback — only inside a <form> to avoid nav buttons.
  const handles = await page.$$('form button');
  for (const handle of handles) {
    const text = await page.evaluate((el) => (el?.textContent || '').trim().toLowerCase(), handle);
    if (!text) continue;
    if (text.includes('submit') || text.includes('send application')) {
      return handle;
    }
  }
  return null;
}

// Sniff for an actual application form on the page. Many amazon.jobs
// listings only render a marketing "Apply now" CTA that redirects
// off-site / through SSO — there is no inline form. We must detect
// this *before* clicking, otherwise the click navigates to /search
// and the post-submit confirmation check fails with a misleading
// "did not show a clear submission confirmation" error.
async function hasInlineApplicationForm(page) {
  return page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll('form'));
    for (const form of forms) {
      const hasFile = !!form.querySelector('input[type="file"]');
      const hasSubmit = !!form.querySelector(
        'button[type="submit"], input[type="submit"], button[id*="submit" i], button[data-test-id*="submit" i]'
      );
      if (hasFile && hasSubmit) return true;
    }
    return false;
  });
}

// Detect Amazon's "posting pulled" / expired-listing page so we can
// auto-dismiss instead of bubbling a misleading "confirmation unclear"
// error. The page text reads roughly:
//   "Sorry, the job you're looking for isn't available."
// and Amazon also sometimes 404/410's. We check both.
async function isExpiredListingPage(page) {
  try {
    const url = page.url() || '';
    if (/\/(?:[a-z-]+\/)?search(?:\?|$)/i.test(url)) {
      // A bare /search redirect with no real listing is an expired pull too.
      // (Caller decides whether to treat as expired or sso — we only flag
      //  the explicit "job not available" page here.)
    }
    const text = await page.evaluate(
      () => (document.body && document.body.innerText) || ''
    );
    if (!text) return false;
    const lc = text.toLowerCase();
    return (
      lc.includes("job you're looking for isn't available") ||
      lc.includes('job you are looking for isn’t available') ||
      lc.includes('this job is no longer available') ||
      lc.includes('this position is no longer available')
    );
  } catch {
    return false;
  }
}

async function submit(ctx) {
  const { app } = ctx;
  const applyUrl = ctx.applyUrl || app?.applicationUrl || app?.jobUrl;
  const dryRun = !!ctx.dryRun;

  if (!parseUrl(applyUrl)) {
    throw new Error('Amazon adapter received a non-Amazon URL');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'applypilot-amazon-'));
  const resumeFile = path.join(tmpDir, ctx.resumeFileName || 'resume.pdf');
  fs.writeFileSync(resumeFile, ctx.resumePdfBuffer);

  const puppeteer = getPuppeteer();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 920 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  const screenshots = [];

  try {
    await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    screenshots.push(await captureStep(page, {
      userId: app.userId,
      appId: app.id,
      step: '01-loaded',
      label: 'Amazon page loaded',
    }));

    const blockers = await detectHumanBlockers(page);
    if (blockers.length) {
      const err = new Error('Amazon page requires manual interaction before auto-submit can continue.');
      err.needsHuman = true;
      err.blockers = blockers;
      throw err;
    }

    // Pre-flight: detect Amazon's "job no longer available" page so the
    // row is auto-dismissed (posting_pulled) instead of surfaced as a
    // confusing "confirmation unclear" error.
    if (await isExpiredListingPage(page)) {
      const err = new Error('This Amazon listing was pulled (the job is no longer available).');
      err.needsHuman = false;
      err.postingPulled = true;
      err.blockers = [{
        field: { label: 'Amazon listing', rawName: 'listing_status' },
        reason: 'posting_pulled',
      }];
      throw err;
    }

    // Pre-flight: confirm there's actually an application form on the
    // page. amazon.jobs listings without one require Amazon SSO and
    // can't be auto-submitted from a clean session.
    const hasForm = await hasInlineApplicationForm(page);
    if (!hasForm) {
      const err = new Error(
        'Amazon listing has no inline application form on this page. It likely requires signing into your Amazon account — please apply manually.'
      );
      err.needsHuman = true;
      err.blockers = [{
        field: { label: 'Amazon application form', rawName: 'inline_form' },
        reason: 'sso_required',
      }];
      throw err;
    }

    const resumeInputSelectors = [
      'input[type="file"][accept*="pdf"]',
      'input[type="file"][name*="resume"]',
      'input[type="file"]',
    ];
    for (const selector of resumeInputSelectors) {
      const input = await page.$(selector);
      if (!input) continue;
      await input.uploadFile(resumeFile);
      await new Promise((r) => setTimeout(r, 1200));
      break;
    }

    screenshots.push(await captureStep(page, {
      userId: app.userId,
      appId: app.id,
      step: '02-pre-submit',
      label: 'Pre-submit state',
    }));

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        provider: 'amazon',
        confirmationUrl: null,
        previewUrl: page.url(),
        submittedAt: null,
        screenshots: screenshots.filter((s) => s.url),
        resolutions: [],
      };
    }

    const submitEl = await findSubmitElement(page);
    if (!submitEl) {
      const err = new Error('Could not locate an Amazon submit button.');
      err.needsHuman = true;
      err.blockers = [{
        field: { label: 'Submit button', rawName: 'submit_button' },
        reason: 'manual_submit_required',
      }];
      throw err;
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => null),
      submitEl.click(),
    ]);

    const body = (await page.content()) || '';
    const url = page.url();
    const success = /thank you|application submitted|we received your application|successfully submitted/i.test(body)
      || /\/application[-_/]confirmation|\/thank[-_/]?you|\/submitted/i.test(url);

    screenshots.push(await captureStep(page, {
      userId: app.userId,
      appId: app.id,
      step: '03-post-submit',
      label: success ? 'Submission confirmation' : 'Post-submit page',
    }));

    if (!success) {
      // Diagnose the failure mode rather than emitting a generic
      // "confirmation unclear" message. The two most common cases
      // are (a) redirect to /search (no real form was on the listing)
      // and (b) redirect to the SSO/login wall.
      const isSearchRedirect = /\/(?:[a-z-]+\/)?search(?:\?|$)/i.test(url);
      const postClickBlockers = await detectHumanBlockers(page);
      const isLoginWall = postClickBlockers.some((b) => b.reason === 'login_required');
      const isExpired = await isExpiredListingPage(page);

      let message;
      let reason;
      if (isExpired) {
        message = 'This Amazon listing was pulled (the job is no longer available).';
        reason = 'posting_pulled';
      } else if (isLoginWall) {
        message = 'Amazon redirected to its sign-in page. This listing requires a logged-in Amazon account — please apply manually.';
        reason = 'login_required';
      } else if (isSearchRedirect) {
        message = 'Amazon redirected to its job search page. This listing doesn’t have an inline application form — please apply manually.';
        reason = 'sso_required';
      } else {
        message = `Amazon did not show a clear submission confirmation. URL: ${url}`;
        reason = 'confirmation_unclear';
      }
      const err = new Error(message);
      err.needsHuman = reason !== 'posting_pulled';
      if (reason === 'posting_pulled') err.postingPulled = true;
      err.blockers = [{
        field: { label: 'Submission confirmation', rawName: 'confirmation_check' },
        reason,
      }];
      throw err;
    }

    return {
      ok: true,
      provider: 'amazon',
      confirmationUrl: url,
      submittedAt: new Date().toISOString(),
      screenshots: screenshots.filter((s) => s.url),
      resolutions: [],
    };
  } catch (err) {
    try {
      screenshots.push(await captureStep(page, {
        userId: app.userId,
        appId: app.id,
        step: 'error',
        label: `Error: ${String(err.message || 'unknown').slice(0, 80)}`,
      }));
    } catch (_) {
      // best-effort only
    }
    err.screenshots = screenshots.filter((s) => s.url);
    err.resolutions = Array.isArray(err.resolutions) ? err.resolutions : [];
    throw err;
  } finally {
    try { await browser.close(); } catch (_) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = {
  name: 'amazon',
  matches,
  submit,
  parseUrl,
};
