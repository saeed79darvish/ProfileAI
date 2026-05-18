'use strict';

/**
 * Workday Puppeteer ATS adapter.
 *
 * Handles application forms hosted on:
 *   https://<company>.wd5.myworkdayjobs.com/...
 *   https://<company>.myworkdayjobs.com/...
 *   https://wd3.myworkday.com/<company>/...
 *   https://workday.com/<company>/...
 *
 * Workday requires the candidate to be signed in.  Credentials are passed via
 * `ctx.credential = { username, password }` — pre-fetched and decrypted by the
 * submit worker.  If absent or login fails the adapter escalates with
 * `err.needsHuman = true` so the worker marks the application `needs_attention`.
 *
 * High-level flow:
 *   1. Navigate to the apply URL
 *   2. Detect login wall — sign in with stored credentials
 *   3. Walk multi-page form: harvest → mapFormFields → fill → Next
 *   4. Upload resume on the first file-input page
 *   5. Click the final Submit button
 *   6. Confirm success via page content / URL / data-automation-id
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { mapFormFields }    = require('./mapFields');
const { uploadScreenshot } = require('../screenshotUpload');

// ──────────────────────────────────────────────────────────────────────────────
// Lazy Puppeteer loader
// ──────────────────────────────────────────────────────────────────────────────

let puppeteerLib = null;
function getPuppeteer() {
  if (!puppeteerLib) {
    try {
      puppeteerLib = require('puppeteer');
    } catch (_) {
      throw new Error(
        'puppeteer is not installed. Run `npm install puppeteer` in /backend to enable Workday automation.',
      );
    }
  }
  return puppeteerLib;
}

// ──────────────────────────────────────────────────────────────────────────────
// URL matching
// ──────────────────────────────────────────────────────────────────────────────

const WORKDAY_RE = /https?:\/\/[\w.-]*(?:myworkdayjobs|myworkday|workday)\.com\//i;

function parseUrl(url) {
  if (!url) return null;
  const raw = String(url);
  return WORKDAY_RE.test(raw) ? { kind: 'workday' } : null;
}

function matches(url) {
  return !!parseUrl(url);
}

// ──────────────────────────────────────────────────────────────────────────────
// Screenshot helper
// ──────────────────────────────────────────────────────────────────────────────

async function captureStep(page, { userId, appId, step, label }) {
  let url = null;
  try {
    const buffer = await page.screenshot({ type: 'png', fullPage: true });
    url = await uploadScreenshot(buffer, { userId, appId, step, label });
  } catch (err) {
    console.warn(`[workdayPuppeteer] screenshot step=${step} failed: ${err.message}`);
  }
  return { url, label, capturedAt: new Date().toISOString() };
}

// ──────────────────────────────────────────────────────────────────────────────
// Login
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the page is currently showing the Workday sign-in form.
 * Workday uses `data-automation-id` attributes on key elements.
 */
async function isLoginPage(page) {
  const emailInput = await page.$(
    '[data-automation-id="email"], input[type="email"], #username, #userNameInput, #emailInput',
  );
  return !!emailInput;
}

/**
 * Attempt to log in using `credential.username` / `credential.password`.
 * Throws a structured `needsHuman` error if login appears to fail.
 */
async function performLogin(page, credential) {
  const { username, password } = credential;

  // Email / username
  const emailSel = '[data-automation-id="email"], input[type="email"], #username, #userNameInput, #emailInput';
  const emailEl  = await page.$(emailSel);
  if (!emailEl) throw Object.assign(new Error('Could not find Workday email field.'), { loginFailed: true });

  await emailEl.click({ clickCount: 3 });
  await emailEl.type(String(username), { delay: 12 });

  // Some Workday flows have a "Next" step before the password field appears.
  const nextBtn = await page.$('[data-automation-id="nextButton"], button[data-automation-id*="next" i]');
  if (nextBtn) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => null),
      nextBtn.click(),
    ]);
    await new Promise((r) => setTimeout(r, 1_500));
  }

  // Password
  const pwSel = '[data-automation-id="password"], input[type="password"], #password, #passwordInput';
  const pwEl  = await page.$(pwSel);
  if (!pwEl) throw Object.assign(new Error('Could not find Workday password field.'), { loginFailed: true });

  await pwEl.click({ clickCount: 3 });
  await pwEl.type(String(password), { delay: 12 });

  // Sign in button
  const signInSel = [
    '[data-automation-id="signInButton"]',
    'button[data-automation-id*="signIn" i]',
    'button[type="submit"]',
  ];
  let signInEl = null;
  for (const sel of signInSel) {
    signInEl = await page.$(sel);
    if (signInEl) break;
  }
  if (!signInEl) throw Object.assign(new Error('Could not find Workday sign-in button.'), { loginFailed: true });

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null),
    signInEl.click(),
  ]);
  await new Promise((r) => setTimeout(r, 2_000));

  // Detect failed login — Workday shows an error notification
  const errorEl = await page.$(
    '[data-automation-id="errorMessage"], [data-automation-id="loginError"], .WD-error, [class*="error" i]',
  );
  if (errorEl) {
    const text = await page.evaluate((el) => el.textContent || '', errorEl);
    if (/invalid|incorrect|wrong|failed|unauthorized/i.test(text)) {
      throw Object.assign(new Error(`Workday login failed: ${text.slice(0, 120).trim()}`), { loginFailed: true });
    }
  }

  // Still on login page?
  if (await isLoginPage(page)) {
    throw Object.assign(new Error('Workday sign-in did not proceed. Credentials may be wrong.'), { loginFailed: true });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Form harvesting — Workday uses data-automation-id extensively
// ──────────────────────────────────────────────────────────────────────────────

async function harvestFieldsFromDom(page) {
  return page.evaluate(() => {
    const inputs = document.querySelectorAll(
      '[data-automation-id] input:not([type="hidden"]):not([type="file"]),' +
      '[data-automation-id] textarea,' +
      '[data-automation-id] select,' +
      'form input:not([type="hidden"]):not([type="file"]),' +
      'form textarea,' +
      'form select',
    );

    const fields = [];
    const seen   = new Set();

    const resolveLabel = (el) => {
      // 1. Explicit <label for>
      if (el.id) {
        const lb = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lb) return lb.textContent.trim();
      }
      // 2. aria-label / aria-labelledby
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel.trim();
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const lb = document.getElementById(labelledBy);
        if (lb) return lb.textContent.trim();
      }
      // 3. Workday-specific data-automation-id on wrapping div
      const wd = el.closest('[data-automation-id]');
      if (wd) {
        const lbEl = wd.querySelector('label, [class*="Label"], [class*="label"]');
        if (lbEl && !lbEl.contains(el)) return lbEl.textContent.trim();
        const aid = wd.getAttribute('data-automation-id');
        if (aid) return aid.replace(/([A-Z])/g, ' $1').trim();
      }
      return el.placeholder || el.name || el.id || '';
    };

    for (const el of inputs) {
      const type = (el.type || '').toLowerCase();
      const key  = el.name || el.id || el.getAttribute('data-automation-id');
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const isSelect   = el.tagName === 'SELECT';
      const isTextarea = el.tagName === 'TEXTAREA';
      const opts = isSelect
        ? Array.from(el.options || []).map((o) => ({
            label: (o.textContent || '').trim(),
            value: o.value,
          }))
        : undefined;

      fields.push({
        name:        key,
        rawName:     key,
        label:       resolveLabel(el),
        description: el.placeholder || '',
        type: type || (isTextarea ? 'textarea' : (isSelect ? 'select' : 'text')),
        required: !!el.required || el.getAttribute('aria-required') === 'true',
        options: opts,
      });
    }

    return fields;
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Field filler — same pattern as other adapters
// ──────────────────────────────────────────────────────────────────────────────

async function fillField(page, name, value, fieldMeta) {
  if (value == null || value === '') return false;

  const safeName = String(name)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');

  const handle =
    (await page.$(`[name="${safeName}"]`)) ||
    (await page.$(`#${safeName}`)) ||
    (await page.$(`[data-automation-id="${safeName}"] input`)) ||
    (await page.$(`[data-automation-id="${safeName}"]`));
  if (!handle) return false;

  const metaType = String(fieldMeta?.type || '').toLowerCase();
  const tag      = await page.evaluate((el) => el.tagName.toLowerCase(), handle);
  const type     = await page.evaluate((el) => (el.type || '').toLowerCase(), handle);

  if (metaType === 'select' || tag === 'select') {
    const target = String(value).toLowerCase().trim();
    return !!(await page.evaluate((el, t) => {
      const hit = Array.from(el.options || []).find((o) => {
        const lbl = (o.textContent || '').trim().toLowerCase();
        const val = String(o.value || '').trim().toLowerCase();
        return lbl === t || val === t || (lbl && lbl.includes(t));
      });
      if (!hit) return false;
      el.value = hit.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, handle, target));
  }

  if (type === 'checkbox') {
    const v = String(value).toLowerCase().trim();
    const shouldCheck = ['yes', 'true', '1', 'on', 'checked'].includes(v);
    await page.evaluate((el, check) => {
      if (el.checked !== check) el.click();
    }, handle, shouldCheck);
    return true;
  }

  if (type === 'radio') {
    const target = String(value).toLowerCase().trim();
    return !!(await page.evaluate((el, t) => {
      const radios = document.querySelectorAll(`input[type="radio"][name="${el.name}"]`);
      for (const r of radios) {
        const val = String(r.value || '').toLowerCase().trim();
        const lbl = (r.labels && r.labels[0]) ? r.labels[0].textContent.trim().toLowerCase() : '';
        if (val === t || lbl === t || (lbl && lbl.includes(t))) {
          r.click();
          return true;
        }
      }
      return false;
    }, handle, target));
  }

  // Workday text inputs often use React-controlled inputs; triple-click + type
  await handle.click({ clickCount: 3 });
  await handle.type(String(value), { delay: 12 });
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// Navigation helpers for multi-page forms
// ──────────────────────────────────────────────────────────────────────────────

/** Click the "Next" / "Continue" button on a Workday form page, if present. */
async function clickNextIfPresent(page) {
  const selectors = [
    '[data-automation-id="nextButton"]',
    '[data-automation-id="continueButton"]',
    'button[data-automation-id*="next" i]',
    'button[data-automation-id*="continue" i]',
  ];
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null),
        el.click(),
      ]);
      await new Promise((r) => setTimeout(r, 1_500));
      return true;
    }
  }
  return false;
}

/** Return the final Submit element, or null. */
async function findSubmitElement(page) {
  const selectors = [
    '[data-automation-id="saveButton"]',     // Workday's final save/submit CTA
    '[data-automation-id="submitButton"]',
    '[data-automation-id="applyButton"]',
    'form button[type="submit"]',
    'button[class*="submit" i]',
  ];
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) return el;
  }

  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate((el) => (el?.textContent || '').trim().toLowerCase(), btn);
    if (!text) continue;
    if (
      text === 'submit' ||
      text === 'submit application' ||
      text === 'apply' ||
      text === 'save and continue' ||
      text.includes('submit application') ||
      text.includes('complete application')
    ) {
      return btn;
    }
  }
  return null;
}

/** Check for Workday success page / confirmation section. */
async function isConfirmationPage(page) {
  const url  = page.url();
  const body = (await page.content()) || '';

  if (/\/confirmation|\/thank-you|\/submitted|\/success/i.test(url)) return true;

  if (
    /application (has been|was) (submitted|received)|thank you for (applying|your application)|we[''`]?ve received your application|your application is submitted/i.test(body)
  ) return true;

  const confirmEl = await page.$(
    '[data-automation-id="applicationConfirmation"], ' +
    '[data-automation-id="applicationSubmitted"], ' +
    '[data-automation-id*="confirmation" i], ' +
    '[data-automation-id*="submitted" i]',
  );
  if (confirmEl) return true;

  return false;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main submit function
// ──────────────────────────────────────────────────────────────────────────────

async function submit(ctx) {
  const { app } = ctx;
  const dryRun   = !!ctx.dryRun;
  const applyUrl = ctx.applyUrl || app?.applicationUrl || app?.jobUrl;

  if (!parseUrl(applyUrl)) {
    throw new Error('Workday adapter received a non-Workday URL');
  }

  if (!ctx.credential) {
    const err = new Error('Workday requires account credentials. Add your Workday credentials in ApplyPilot settings.');
    err.needsHuman = true;
    err.blockers   = [{
      field:  { label: 'Workday credentials', rawName: 'credentials' },
      reason: 'missing_credentials',
    }];
    throw err;
  }

  const tmpDir     = fs.mkdtempSync(path.join(os.tmpdir(), 'applypilot-workday-'));
  const resumeFile = path.join(tmpDir, ctx.resumeFileName || 'resume.pdf');
  fs.writeFileSync(resumeFile, ctx.resumePdfBuffer);

  const puppeteer = getPuppeteer();
  const browser   = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  const screenshots = [];
  const resolutions = [];

  try {
    // ── 1. Load the apply page ─────────────────────────────────────────────
    await page.goto(applyUrl, { waitUntil: 'networkidle2', timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 1_500)); // let React hydrate

    screenshots.push(await captureStep(page, {
      userId: app.userId,
      appId:  app.id,
      step:   '01-loaded',
      label:  'Workday page loaded',
    }));

    // ── 2. Sign in if needed ──────────────────────────────────────────────
    if (await isLoginPage(page)) {
      try {
        await performLogin(page, ctx.credential);
      } catch (loginErr) {
        screenshots.push(await captureStep(page, {
          userId: app.userId,
          appId:  app.id,
          step:   '02-login-failed',
          label:  'Login failed',
        }));

        const err = Object.assign(
          new Error(`Workday login failed: ${loginErr.message}`),
          {
            needsHuman: true,
            loginFailed: true,
            blockers: [{
              field:  { label: 'Workday login', rawName: 'login' },
              reason: 'login_failed',
            }],
          },
        );
        throw err;
      }

      // After login Workday may redirect to a home page; navigate back to apply
      const currentUrl = page.url();
      if (!currentUrl.includes('/apply') && !currentUrl.includes('/application')) {
        await page.goto(applyUrl, { waitUntil: 'networkidle2', timeout: 45_000 });
        await new Promise((r) => setTimeout(r, 1_500));
      }

      screenshots.push(await captureStep(page, {
        userId: app.userId,
        appId:  app.id,
        step:   '02-logged-in',
        label:  'Logged in to Workday',
      }));
    }

    // ── 3. Wait for the apply form ─────────────────────────────────────────
    await page
      .waitForSelector(
        'form, [data-automation-id="autofill-overlay"], [data-automation-id*="apply"]',
        { timeout: 30_000 },
      )
      .catch(() => null);

    // ── 4. Multi-page form walk ────────────────────────────────────────────
    // Workday forms are often multi-page (My Info → My Experience → Application Questions → Review & Submit).
    // We do up to 8 page-turns before looking for the final submit button.
    const MAX_PAGES = 8;
    let resumeUploaded = false;

    for (let pageIdx = 0; pageIdx < MAX_PAGES; pageIdx++) {
      // Check if we've already landed on a confirmation page mid-walk
      if (await isConfirmationPage(page)) break;

      // Harvest & fill
      const fields   = await harvestFieldsFromDom(page);
      const mappable = fields.filter((f) => f.type !== 'file');
      if (mappable.length > 0) {
        const mapped = await mapFormFields({
          app:          ctx.app,
          fields:       mappable,
          profile:      ctx.profile,
          user:         ctx.user,
          memory:       ctx.memory,
          demographics: ctx.demographics,
          job:          ctx.job,
        });

        if (Array.isArray(mapped.resolutions) && mapped.resolutions.length) {
          resolutions.push(...mapped.resolutions);
        }

        const fieldByName = new Map(fields.map((f) => [f.name || f.id, f]));
        for (const [name, value] of Object.entries(mapped.values || {})) {
          try {
            await fillField(page, name, value, fieldByName.get(name) || null);
          } catch (e) {
            console.warn(`[workdayPuppeteer] fill failed for ${name}: ${e.message}`);
          }
        }
      }

      // Upload resume once (typically first "My Experience" page)
      if (!resumeUploaded) {
        const fileInput =
          (await page.$('input[type="file"][data-automation-id*="resume" i]')) ||
          (await page.$('input[type="file"][accept*="pdf" i]')) ||
          (await page.$('input[type="file"][name*="resume" i]')) ||
          (await page.$('input[type="file"]'));
        if (fileInput) {
          try {
            await fileInput.uploadFile(resumeFile);
            await new Promise((r) => setTimeout(r, 1_200));
            resumeUploaded = true;
          } catch (uploadErr) {
            console.warn(`[workdayPuppeteer] resume upload failed on page ${pageIdx}: ${uploadErr.message}`);
          }
        }
      }

      // Capture filled state
      screenshots.push(await captureStep(page, {
        userId: app.userId,
        appId:  app.id,
        step:   `${String(pageIdx + 3).padStart(2, '0')}-page-${pageIdx}`,
        label:  `Form page ${pageIdx} filled`,
      }));

      if (dryRun && pageIdx === 0) {
        return {
          ok:              true,
          dryRun:          true,
          provider:        'workday',
          confirmationUrl: null,
          previewUrl:      page.url(),
          submittedAt:     null,
          screenshots:     screenshots.filter((s) => s.url),
          resolutions,
        };
      }

      // Look for the final submit button first
      const submitEl = await findSubmitElement(page);
      if (submitEl) {
        // Confirm it's truly the final page — check "Review" or no more Next buttons
        const nextPresent = await page.$(
          '[data-automation-id="nextButton"], [data-automation-id="continueButton"]',
        );
        if (!nextPresent) {
          // This is the final submit page — proceed to step 5 below
          if (!dryRun) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => null),
              submitEl.click(),
            ]);
            await new Promise((r) => setTimeout(r, 2_500));
          }
          break;
        }
      }

      // Navigate to next form page; if nothing left to click, break
      const advanced = await clickNextIfPresent(page);
      if (!advanced) break;
    }

    // ── 5. Confirm or escalate ─────────────────────────────────────────────
    const confirmed = await isConfirmationPage(page);

    screenshots.push(await captureStep(page, {
      userId: app.userId,
      appId:  app.id,
      step:   'final-confirmation',
      label:  confirmed ? 'Confirmation' : 'Post-submit page',
    }));

    if (!confirmed) {
      const err = new Error(
        `Workday did not return a clear confirmation page. URL: ${page.url()}`,
      );
      err.needsHuman = true;
      err.blockers   = [{
        field:  { label: 'Submission confirmation', rawName: 'confirmation_check' },
        reason: 'confirmation_unclear',
      }];
      throw err;
    }

    return {
      ok:              true,
      provider:        'workday',
      confirmationUrl: page.url(),
      submittedAt:     new Date().toISOString(),
      screenshots:     screenshots.filter((s) => s.url),
      resolutions,
    };
  } catch (err) {
    try {
      screenshots.push(await captureStep(page, {
        userId: app.userId,
        appId:  app.id,
        step:   'error',
        label:  `Error: ${String(err.message || 'unknown').slice(0, 80)}`,
      }));
    } catch (_) {
      // best effort
    }
    err.screenshots = screenshots.filter((s) => s.url);
    err.resolutions = Array.isArray(err.resolutions) ? err.resolutions : resolutions;
    throw err;
  } finally {
    try { await browser.close(); } catch (_) {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = {
  name: 'workday',
  matches,
  submit,
  parseUrl,
};
