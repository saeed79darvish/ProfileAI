const fs = require('fs');
const os = require('os');
const path = require('path');
const { mapFormFields } = require('./mapFields');
const { uploadScreenshot } = require('../screenshotUpload');

let puppeteerLib = null;
function getPuppeteer() {
  if (!puppeteerLib) {
    try {
      puppeteerLib = require('puppeteer');
    } catch (_) {
      throw new Error('puppeteer is not installed. Run `npm install puppeteer` in /backend to enable Lever automation.');
    }
  }
  return puppeteerLib;
}

function parseUrl(url) {
  if (!url) return null;
  const raw = String(url);
  if (/https?:\/\/(?:jobs\.)?lever\.co\//i.test(raw)) {
    return { kind: 'lever' };
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
    console.warn(`[leverPuppeteer] screenshot step=${step} failed: ${err.message}`);
  }
  return { url, label, capturedAt: new Date().toISOString() };
}

async function detectHumanBlockers(page) {
  const blockers = [];
  const recaptcha = await page.$('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], div.g-recaptcha');
  if (recaptcha) {
    blockers.push({
      field: { label: 'Captcha challenge', rawName: 'captcha' },
      reason: 'captcha_required',
    });
  }
  return blockers;
}

async function harvestFieldsFromDom(page) {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll('form input, form textarea, form select');
    const fields = [];
    const seen = new Set();

    const labelFor = (el) => {
      const direct = el.labels && el.labels[0] ? el.labels[0] : null;
      if (direct) return direct.textContent.trim();
      const byFor = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
      if (byFor) return byFor.textContent.trim();
      const wrapper = el.closest('[class*="field"], [class*="question"], .application-question') || el.parentElement;
      if (!wrapper) return '';
      const candidate = wrapper.querySelector('label, h3, h4, [class*="label"]');
      if (!candidate) return '';
      if (candidate.querySelector('input, textarea, select')) return '';
      return candidate.textContent.trim();
    };

    for (const el of nodes) {
      const type = (el.type || '').toLowerCase();
      if (type === 'hidden') continue;
      const key = el.name || el.id;
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);

      const isSelect = el.tagName === 'SELECT';
      const isTextarea = el.tagName === 'TEXTAREA';
      const options = isSelect
        ? Array.from(el.options || []).map((o) => ({ label: (o.textContent || '').trim(), value: o.value }))
        : undefined;

      fields.push({
        name: key,
        rawName: key,
        label: labelFor(el),
        description: '',
        type: type || (isTextarea ? 'textarea' : (isSelect ? 'select' : 'text')),
        required: !!el.required || el.getAttribute('aria-required') === 'true',
        options,
      });
    }

    return fields;
  });
}

async function fillField(page, name, value, fieldMeta) {
  if (value == null || value === '') return false;

  const escapedName = String(name)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');

  const handle = await page.$(`[name="${escapedName}"]`) || await page.$(`#${escapedName}`);
  if (!handle) return false;

  const metaType = String(fieldMeta?.type || '').toLowerCase();
  const tag = await page.evaluate((el) => el.tagName.toLowerCase(), handle);
  const type = await page.evaluate((el) => (el.type || '').toLowerCase(), handle);

  if (metaType === 'select' || tag === 'select') {
    const target = String(value).toLowerCase().trim();
    const selected = await page.evaluate((el, t) => {
      const opts = Array.from(el.options || []);
      const hit = opts.find((o) => {
        const lbl = (o.textContent || '').trim().toLowerCase();
        const val = String(o.value || '').trim().toLowerCase();
        return lbl === t || val === t || (lbl && lbl.includes(t));
      });
      if (!hit) return false;
      el.value = hit.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, handle, target);
    return !!selected;
  }

  if (type === 'checkbox') {
    const v = String(value).toLowerCase().trim();
    const shouldCheck = ['yes', 'true', '1', 'on', 'checked'].includes(v);
    await page.evaluate((el, check) => {
      if (el.checked !== check) {
        el.click();
      }
    }, handle, shouldCheck);
    return true;
  }

  if (type === 'radio') {
    const target = String(value).toLowerCase().trim();
    const clicked = await page.evaluate((el, t) => {
      const name = el.name;
      if (!name) return false;
      const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
      for (const r of radios) {
        const val = String(r.value || '').toLowerCase().trim();
        const lblEl = r.labels && r.labels[0] ? r.labels[0] : null;
        const lbl = lblEl ? lblEl.textContent.trim().toLowerCase() : '';
        if (val === t || lbl === t || (lbl && lbl.includes(t))) {
          r.click();
          return true;
        }
      }
      return false;
    }, handle, target);
    return !!clicked;
  }

  await handle.click({ clickCount: 3 });
  await handle.type(String(value), { delay: 12 });
  return true;
}

async function findSubmitElement(page) {
  const selectors = [
    'form button[type="submit"]',
    'form input[type="submit"]',
    'button[data-qa="btn-submit-application"]',
    'button[class*="submit"]',
  ];
  for (const selector of selectors) {
    const el = await page.$(selector);
    if (el) return el;
  }

  const handles = await page.$$('button');
  for (const handle of handles) {
    const text = await page.evaluate((el) => (el?.textContent || '').trim().toLowerCase(), handle);
    if (!text) continue;
    if (text.includes('submit application') || text.includes('apply') || text === 'submit') {
      return handle;
    }
  }
  return null;
}

async function submit(ctx) {
  const { app } = ctx;
  const dryRun = !!ctx.dryRun;
  const applyUrl = ctx.applyUrl || app?.applicationUrl || app?.jobUrl;

  if (!parseUrl(applyUrl)) {
    throw new Error('Lever adapter received a non-Lever URL');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'applypilot-lever-'));
  const resumeFile = path.join(tmpDir, ctx.resumeFileName || 'resume.pdf');
  fs.writeFileSync(resumeFile, ctx.resumePdfBuffer);

  const puppeteer = getPuppeteer();
  const browser = await puppeteer.launch({
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
    await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('form', { timeout: 20_000 });

    screenshots.push(await captureStep(page, {
      userId: app.userId,
      appId: app.id,
      step: '01-loaded',
      label: 'Lever form loaded',
    }));

    const blockers = await detectHumanBlockers(page);
    if (blockers.length) {
      const err = new Error('Lever requires manual interaction before auto-submit can continue.');
      err.needsHuman = true;
      err.blockers = blockers;
      throw err;
    }

    const fields = await harvestFieldsFromDom(page);
    const mappable = fields.filter((f) => f.type !== 'file');
    const mapped = await mapFormFields({
      app: ctx.app,
      fields: mappable,
      profile: ctx.profile,
      user: ctx.user,
      memory: ctx.memory,
      demographics: ctx.demographics,
      job: ctx.job,
    });

    if (Array.isArray(mapped.resolutions) && mapped.resolutions.length) {
      resolutions.push(...mapped.resolutions);
    }

    if (mapped.blockers?.length) {
      const err = new Error(
        `Lever needs ${mapped.blockers.length} required field${mapped.blockers.length === 1 ? '' : 's'} not fully mapped.`,
      );
      err.needsHuman = true;
      err.blockers = mapped.blockers;
      throw err;
    }

    const fieldByName = new Map(fields.map((f) => [f.name || f.id, f]));
    for (const [name, value] of Object.entries(mapped.values || {})) {
      try {
        await fillField(page, name, value, fieldByName.get(name) || null);
      } catch (e) {
        console.warn(`[leverPuppeteer] fill failed for ${name}: ${e.message}`);
      }
    }

    const fileInput = await page.$('form input[type="file"][name*="resume" i]')
      || await page.$('form input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile(resumeFile);
      await new Promise((r) => setTimeout(r, 900));
    }

    screenshots.push(await captureStep(page, {
      userId: app.userId,
      appId: app.id,
      step: '02-filled',
      label: 'Form filled',
    }));

    if (dryRun) {
      screenshots.push(await captureStep(page, {
        userId: app.userId,
        appId: app.id,
        step: '03-preview',
        label: 'Pre-submit preview',
      }));

      return {
        ok: true,
        dryRun: true,
        provider: 'lever',
        confirmationUrl: null,
        previewUrl: page.url(),
        submittedAt: null,
        screenshots: screenshots.filter((s) => s.url),
        resolutions,
      };
    }

    const submitEl = await findSubmitElement(page);
    if (!submitEl) {
      const err = new Error('Could not locate Lever submit button.');
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
    const success = /thank you|application submitted|thanks for applying|we have received your application/i.test(body)
      || /thanks|thank-you|submitted|confirmation/i.test(url);

    screenshots.push(await captureStep(page, {
      userId: app.userId,
      appId: app.id,
      step: '03-confirmation',
      label: success ? 'Confirmation' : 'Post-submit page',
    }));

    if (!success) {
      const err = new Error(`Lever did not return a clear confirmation page. URL: ${url}`);
      err.needsHuman = true;
      err.blockers = [{
        field: { label: 'Submission confirmation', rawName: 'confirmation_check' },
        reason: 'confirmation_unclear',
      }];
      throw err;
    }

    return {
      ok: true,
      provider: 'lever',
      confirmationUrl: url,
      submittedAt: new Date().toISOString(),
      screenshots: screenshots.filter((s) => s.url),
      resolutions,
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
  name: 'lever',
  matches,
  submit,
  parseUrl,
};
