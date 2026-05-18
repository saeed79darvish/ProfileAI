'use strict';

/**
 * Ashby HQ Puppeteer ATS adapter.
 *
 * Handles application forms hosted on:
 *   https://jobs.ashbyhq.com/<company>/<jobId>/application
 *   https://app.ashbyhq.com/posting/<company>/<jobId>
 *
 * Ashby forms are React-rendered and use data-testid/aria attributes for
 * inputs. We wait for the React shell to hydrate before harvesting fields.
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
        'puppeteer is not installed. Run `npm install puppeteer` in /backend to enable Ashby automation.',
      );
    }
  }
  return puppeteerLib;
}

// ──────────────────────────────────────────────────────────────────────────────
// URL matching
// ──────────────────────────────────────────────────────────────────────────────

const ASHBY_RE = /https?:\/\/(?:jobs|app)\.ashbyhq\.com\//i;

function parseUrl(url) {
  if (!url) return null;
  const raw = String(url);
  return ASHBY_RE.test(raw) ? { kind: 'ashby' } : null;
}

function matches(url) {
  return !!parseUrl(url);
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function captureStep(page, { userId, appId, step, label }) {
  let url = null;
  try {
    const buffer = await page.screenshot({ type: 'png', fullPage: true });
    url = await uploadScreenshot(buffer, { userId, appId, step, label });
  } catch (err) {
    console.warn(`[ashbyPuppeteer] screenshot step=${step} failed: ${err.message}`);
  }
  return { url, label, capturedAt: new Date().toISOString() };
}

/** Detect captcha / login walls before we try to fill anything. */
async function detectHumanBlockers(page) {
  const blockers = [];

  const captcha = await page.$(
    'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], div.g-recaptcha, [data-sitekey]',
  );
  if (captcha) {
    blockers.push({
      field: { label: 'Captcha challenge', rawName: 'captcha' },
      reason: 'captcha_required',
    });
  }

  return blockers;
}

/**
 * Harvest form fields from a React-rendered Ashby apply page.
 *
 * Ashby renders inputs as standard <input>/<textarea>/<select> elements but
 * wraps them in `[data-testid*="field"]` or `[class*="ashby"]` containers
 * with associated `<label>` siblings.
 */
async function harvestFieldsFromDom(page) {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll(
      'form input:not([type="hidden"]), form textarea, form select',
    );
    const fields = [];
    const seen   = new Set();

    const resolveLabel = (el) => {
      // 1. Explicit <label for="id">
      if (el.id) {
        const lb = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lb) return lb.textContent.trim();
      }
      // 2. Implicit wrapping <label>
      const implicit = el.closest('label');
      if (implicit) {
        const clone = implicit.cloneNode(true);
        clone.querySelectorAll('input,textarea,select,button').forEach((n) => n.remove());
        const txt = clone.textContent.trim();
        if (txt) return txt;
      }
      // 3. aria-label / aria-labelledby
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel.trim();
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const lb = document.getElementById(labelledBy);
        if (lb) return lb.textContent.trim();
      }
      // 4. Closest container with a label/heading child
      const container = el.closest(
        '[data-testid*="field"], [data-testid*="question"], [class*="Field"], [class*="Question"]',
      ) || el.parentElement;
      if (container) {
        const candidate = container.querySelector('label, [class*="label"], [class*="Label"]');
        if (candidate && !candidate.contains(el)) {
          return candidate.textContent.trim();
        }
      }
      return el.placeholder || el.name || el.id || '';
    };

    for (const el of nodes) {
      const type = (el.type || '').toLowerCase();
      const key  = el.name || el.id;
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
        name:     key,
        rawName:  key,
        label:    resolveLabel(el),
        description: el.placeholder || '',
        type: type || (isTextarea ? 'textarea' : (isSelect ? 'select' : 'text')),
        required: !!el.required || el.getAttribute('aria-required') === 'true',
        options:  opts,
      });
    }

    return fields;
  });
}

async function fillField(page, name, value, fieldMeta) {
  if (value == null || value === '') return false;

  const safeName = String(name)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');

  const handle =
    (await page.$(`[name="${safeName}"]`)) ||
    (await page.$(`#${safeName}`));
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

  await handle.click({ clickCount: 3 });
  await handle.type(String(value), { delay: 12 });
  return true;
}

/** Locate the primary submit / "Apply" button. */
async function findSubmitElement(page) {
  const selectors = [
    // Ashby-specific test ids
    'button[data-testid="submit-application-button"]',
    'button[data-testid*="submit"]',
    // Generic form fallbacks
    'form button[type="submit"]',
    'form input[type="submit"]',
    'button[class*="submit" i]',
    'button[class*="apply" i]',
  ];
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) return el;
  }

  // Text-based fallback
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate((el) => (el?.textContent || '').trim().toLowerCase(), btn);
    if (!text) continue;
    if (
      text === 'submit application' ||
      text === 'submit' ||
      text === 'apply' ||
      text === 'apply now' ||
      text.includes('submit application') ||
      text.includes('apply now')
    ) {
      return btn;
    }
  }

  return null;
}

/** Check whether the post-submit page looks like a Ashby confirmation. */
async function isConfirmationPage(page) {
  const url  = page.url();
  const body = (await page.content()) || '';

  // URL patterns
  if (/\/confirmation|\/thank-you|\/submitted|\/success/i.test(url)) return true;

  // On-page text / React component rendered text
  if (
    /your application (has been|was) (submitted|received)|application submitted|thank you for applying|thanks for (your application|applying)|we[''`]?ve received your application/i.test(body)
  ) return true;

  // Ashby often renders a specific element
  const confirmEl = await page.$(
    '[data-testid*="confirmation"], [data-testid*="success"], [class*="Confirmation"], [class*="SuccessPage"]',
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
    throw new Error('Ashby adapter received a non-Ashby URL');
  }

  // Write resume PDF to a temp file for Puppeteer's uploadFile API
  const tmpDir     = fs.mkdtempSync(path.join(os.tmpdir(), 'applypilot-ashby-'));
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

    // Ashby React forms need a moment to hydrate
    await page
      .waitForSelector('form', { timeout: 30_000 })
      .catch(async () => {
        // Some Ashby postings redirect to /application — follow it
        const currentUrl = page.url();
        if (!currentUrl.includes('/application')) {
          await page.goto(currentUrl + '/application', { waitUntil: 'networkidle2', timeout: 30_000 })
            .catch(() => {});
        }
        await page.waitForSelector('form', { timeout: 20_000 });
      });

    screenshots.push(await captureStep(page, {
      userId: app.userId,
      appId:  app.id,
      step:   '01-loaded',
      label:  'Ashby form loaded',
    }));

    // ── 2. Blocker check ──────────────────────────────────────────────────
    const blockers = await detectHumanBlockers(page);
    if (blockers.length) {
      const err = new Error('Ashby form requires manual interaction before auto-submit can continue.');
      err.needsHuman = true;
      err.blockers   = blockers;
      throw err;
    }

    // ── 3. Harvest & map form fields ──────────────────────────────────────
    const fields   = await harvestFieldsFromDom(page);
    const mappable = fields.filter((f) => f.type !== 'file');
    const mapped   = await mapFormFields({
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

    if (mapped.blockers?.length) {
      const count = mapped.blockers.length;
      const err   = new Error(
        `Ashby form needs ${count} required field${count === 1 ? '' : 's'} not fully mapped.`,
      );
      err.needsHuman = true;
      err.blockers   = mapped.blockers;
      throw err;
    }

    // ── 4. Fill fields ────────────────────────────────────────────────────
    const fieldByName = new Map(fields.map((f) => [f.name || f.id, f]));
    for (const [name, value] of Object.entries(mapped.values || {})) {
      try {
        await fillField(page, name, value, fieldByName.get(name) || null);
      } catch (e) {
        console.warn(`[ashbyPuppeteer] fill failed for ${name}: ${e.message}`);
      }
    }

    // ── 5. Upload resume ──────────────────────────────────────────────────
    const fileInput =
      (await page.$('form input[type="file"][accept*="pdf" i]')) ||
      (await page.$('form input[type="file"][name*="resume" i]')) ||
      (await page.$('form input[type="file"][aria-label*="resume" i]')) ||
      (await page.$('form input[type="file"]'));
    if (fileInput) {
      await fileInput.uploadFile(resumeFile);
      await new Promise((r) => setTimeout(r, 900));
    }

    screenshots.push(await captureStep(page, {
      userId: app.userId,
      appId:  app.id,
      step:   '02-filled',
      label:  'Form filled',
    }));

    // ── 6. Dry-run exit ───────────────────────────────────────────────────
    if (dryRun) {
      screenshots.push(await captureStep(page, {
        userId: app.userId,
        appId:  app.id,
        step:   '03-preview',
        label:  'Pre-submit preview',
      }));

      return {
        ok:              true,
        dryRun:          true,
        provider:        'ashby',
        confirmationUrl: null,
        previewUrl:      page.url(),
        submittedAt:     null,
        screenshots:     screenshots.filter((s) => s.url),
        resolutions,
      };
    }

    // ── 7. Submit ─────────────────────────────────────────────────────────
    const submitEl = await findSubmitElement(page);
    if (!submitEl) {
      const err = new Error('Could not locate Ashby submit button.');
      err.needsHuman = true;
      err.blockers   = [{
        field:  { label: 'Submit button', rawName: 'submit_button' },
        reason: 'manual_submit_required',
      }];
      throw err;
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => null),
      submitEl.click(),
    ]);

    // Give the React confirmation component time to render
    await new Promise((r) => setTimeout(r, 2_000));

    const confirmed = await isConfirmationPage(page);

    screenshots.push(await captureStep(page, {
      userId: app.userId,
      appId:  app.id,
      step:   '03-confirmation',
      label:  confirmed ? 'Confirmation' : 'Post-submit page',
    }));

    if (!confirmed) {
      const err = new Error(
        `Ashby did not return a clear confirmation page. URL: ${page.url()}`,
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
      provider:        'ashby',
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
  name: 'ashby',
  matches,
  submit,
  parseUrl,
};
