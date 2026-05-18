/**
 * Greenhouse ATS adapter · Puppeteer flavour.
 *
 * The API adapter in ./greenhouse.js submits through Greenhouse's public
 * embed endpoint. That works but it produces no visible trace for the
 * candidate — no screenshots, no proof of the actual submission step.
 *
 * This adapter drives a headless Chrome through the real apply page so
 * we can:
 *   1. Screenshot the empty form (proves we landed on the right page)
 *   2. Fill fields programmatically (same mapping logic as the API path)
 *   3. Upload the tailored resume via the file input
 *   4. Screenshot the filled form before we hit submit
 *   5. Click submit and wait for the confirmation
 *   6. Screenshot the thank-you state
 *
 * Each screenshot is pushed to Cloudinary and the URLs are returned in
 * the receipt so the Review page can render a submission timeline.
 *
 * Guard rails:
 *   · Falls back with err.needsHuman=true when required fields can't be
 *     mapped — same contract as the API adapter.
 *   · Captures an error screenshot on any thrown exception so the user
 *     can see exactly what Greenhouse rendered when the submission
 *     failed.
 *   · Writes resume PDF to a temp file so Puppeteer's uploadFile can
 *     read it — cleaned up in a finally.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { mapFormFields } = require('./mapFields');
const { uploadScreenshot } = require('../screenshotUpload');

let puppeteerLib = null;
function getPuppeteer() {
  if (!puppeteerLib) {
    try {
      // puppeteer-extra wraps puppeteer with the stealth plugin which
      // patches ~15 headless-Chrome fingerprint leaks (navigator.webdriver,
      // missing chrome.runtime, fake plugins, broken WebGL vendor, etc.)
      // so most ATS anti-bot gates (incl. Greenhouse's 8-char email code)
      // never fire. Falls back to plain puppeteer if the plugin is absent.
      const extra = require('puppeteer-extra');
      const StealthPlugin = require('puppeteer-extra-plugin-stealth');
      extra.use(StealthPlugin());
      puppeteerLib = extra;
    } catch (_) {
      try {
        puppeteerLib = require('puppeteer');
      } catch (err) {
        throw new Error(
          'puppeteer is not installed. Run `npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth` in /backend to enable the Puppeteer ATS adapter.',
        );
      }
    }
  }
  return puppeteerLib;
}

// Per-user persistent Chrome profile so cookies / IndexedDB build up
// across submissions. Greenhouse challenges new sessions much more
// aggressively than returning ones, so this materially reduces the
// chance of triggering the email verification gate.
function userDataDirFor(userId) {
  if (!userId) return null;
  const root = path.join(os.tmpdir(), 'applypilot-chrome-profiles');
  try { fs.mkdirSync(root, { recursive: true }); } catch (_) {}
  return path.join(root, String(userId));
}

// Tiny humanized delay helper. Real users don't fill a form in 200ms.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (min, max) => sleep(min + Math.floor(Math.random() * (max - min)));

const BOARD_URL_RE = /https?:\/\/(?:boards|job-boards)\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i;

function parseUrl(url) {
  if (!url) return null;
  const raw = String(url);
  const m = raw.match(BOARD_URL_RE);
  if (m) return { boardToken: m[1], jobId: m[2] };

  try {
    const parsed = new URL(raw);
    const isGreenhouseHost = /(^|\.)greenhouse\.io$/i.test(parsed.hostname);
    const isEmbedPath = /\/embed\/job_app$/i.test(parsed.pathname);
    const boardToken = parsed.searchParams.get('for');
    const jobId = parsed.searchParams.get('token');
    if (isGreenhouseHost && isEmbedPath && boardToken && jobId) {
      return { boardToken, jobId };
    }
  } catch (_) {
    return null;
  }

  return null;
}

function matches(url) {
  return !!parseUrl(url);
}

/**
 * Scrape the live apply page for its form fields instead of calling
 * the JSON API — the rendered DOM is the source of truth for what
 * Puppeteer will actually type into. Returns our adapter-neutral
 * field shape so mapFormFields can match against it.
 */
async function harvestFieldsFromDom(page) {
  return page.evaluate(() => {
    // Pre-count inputs per name so the consent heuristic downstream can
    // tell "lone required checkbox" (group size 1 → attestation candidate)
    // from "multi-value checkbox group" (group size > 1 → substantive,
    // must fall through to training memory / LLM).
    const counts = {};
    const allInputs = document.querySelectorAll('form input, form textarea, form select');
    allInputs.forEach((el) => {
      const n = el.name || el.id;
      if (!n) return;
      if (el.type === 'hidden') return;
      counts[n] = (counts[n] || 0) + 1;
    });

    const toField = (el, labelEl, groupSize) => {
      // Detect Greenhouse's react-select custom dropdowns: they render as
      // <input role="combobox" class="select__input"> inside a .select-shell.
      const isReactSelect = el.getAttribute('role') === 'combobox'
        && el.closest('.select-shell') != null;

      const type = isReactSelect ? 'react-select'
        : el.tagName === 'TEXTAREA' ? 'textarea'
        : el.tagName === 'SELECT' ? 'select'
        : (el.type === 'file' ? 'file' : (el.type || 'text'));
      const options = type === 'select'
        ? Array.from(el.options).map((o) => ({ label: o.textContent.trim(), value: o.value }))
        : undefined;
      // For a lone consent checkbox the visible label is often NOT
      // connected via <label for>; it may live in the sibling text node
      // of a wrapping <label>. Fall back to the closest <label> text.
      let labelText = labelEl ? labelEl.textContent.trim() : '';
      if (!labelText) {
        const closest = el.closest('label');
        if (closest) labelText = closest.textContent.trim();
      }
      // Greenhouse renders required-asterisks in the label text rather
      // than setting the HTML `required` attribute on react-select
      // comboboxes, so trust either signal.
      const ariaRequired = el.getAttribute('aria-required') === 'true';
      const labelHasAsterisk = /\*\s*$/.test(labelText) || /\*$/.test((labelText || '').replace(/\s+/g, ''));
      return {
        name: el.name || el.id || '',
        rawName: el.name || el.id || '',
        label: labelText,
        description: '',
        type,
        required: !!el.required || ariaRequired || labelHasAsterisk,
        options,
        groupSize,
        standard: /^(job_application\[(first_name|last_name|email|phone|resume|cover_letter)\])$/.test(el.name || ''),
      };
    };

    const fields = [];
    const seen = new Set();
    allInputs.forEach((el) => {
      const name = el.name || el.id;
      if (!name) return;
      if (seen.has(name)) return;
      if (el.type === 'hidden') return;
      seen.add(name);

      const groupSize = counts[name] || 1;

      // Checkbox groups: multiple checkboxes sharing the same name (often
      // ending in "[]"). Collect all option labels/values so the LLM can
      // pick the right one(s).
      if ((el.type === 'checkbox' || el.type === 'radio') && groupSize > 1) {
        const selector = name.includes('[')
          ? `input[name="${name.replace(/"/g, '\\"')}"]`
          : `input[name="${name}"]`;
        const groupEls = document.querySelectorAll(selector);
        const options = [];
        let groupLabel = '';
        groupEls.forEach((ge) => {
          const val = ge.value || '';
          // Get visible label text for each checkbox/radio.
          let lbl = '';
          const lbEl = ge.labels && ge.labels[0]
            ? ge.labels[0]
            : document.querySelector(`label[for="${ge.id}"]`);
          if (lbEl) lbl = lbEl.textContent.trim();
          if (!lbl) {
            const closest = ge.closest('label');
            if (closest) lbl = closest.textContent.trim();
          }
          options.push({ label: lbl || val, value: val });
        });
        // For the group-level label, look for a preceding heading or
        // legend that describes the whole set.
        const fieldset = el.closest('fieldset');
        const legend = fieldset ? fieldset.querySelector('legend') : null;
        if (legend) {
          groupLabel = legend.textContent.trim();
        } else {
          // Walk up to the nearest question wrapper and grab its label
          const wrapper = el.closest('[class*="field"]') || el.closest('[class*="question"]') || el.parentElement?.parentElement;
          if (wrapper) {
            const heading = wrapper.querySelector('label, h3, h4, [class*="label"]');
            if (heading && !heading.querySelector('input')) {
              groupLabel = heading.textContent.trim();
            }
          }
        }
        fields.push({
          name,
          rawName: name,
          label: groupLabel || options[0]?.label || '',
          description: '',
          type: 'checkbox-group',
          required: !!el.required,
          options,
          groupSize,
        });
        return;
      }

      const labelEl = el.labels && el.labels[0]
        ? el.labels[0]
        : document.querySelector(`label[for="${el.id}"]`);
      fields.push(toField(el, labelEl, groupSize));
    });
    return fields;
  });
}

/**
 * Fill a Greenhouse react-select (custom dropdown) by clicking its
 * control div, waiting for the listbox to appear, and clicking the
 * matching option. Returns true if it selected something.
 */
async function fillReactSelect(page, name, value, fieldMeta = null) {
  if (value == null) return false;
  const target = String(value).toLowerCase().trim();
  const fieldLabel = String(fieldMeta?.label || '').toLowerCase().trim();
  const escapedName = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\[/g, '\\[').replace(/\]/g, '\\]');

  // Find the input by id (react-selects use id, not name).
  const input = await page.$(`[id="${escapedName}"]`)
    || await page.$(`[name="${escapedName}"]`);
  if (!input) return false;

  // Navigate up to the .select-shell container, then click its .select__control.
  const controlHandle = await page.evaluateHandle((el) => {
    const shell = el.closest('.select-shell');
    return shell ? shell.querySelector('.select__control') : null;
  }, input);
  const control = controlHandle.asElement();
  if (!control) return false;

  // Close any other open dropdowns first by pressing Escape.
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 150));

  // Click the control to open the listbox.
  await control.click();
  await new Promise((r) => setTimeout(r, 400));

  // Type the value into the input to trigger autocomplete/filtering.
  // Some react-selects are searchable (like location pickers) and won't
  // show options until the user types a query.
  await input.type(String(value), { delay: 20 });
  await new Promise((r) => setTimeout(r, 600));

  // Helper: find a matching option inside this select-shell's menu.
  const findOption = async (val, label) => {
    return page.evaluateHandle((el, v, label) => {
      const collectOptions = () => {
        const shell = el.closest('.select-shell');
        const nodes = [];
        const seenNodes = new Set();
        const addNode = (n) => {
          if (!n || seenNodes.has(n)) return;
          seenNodes.add(n);
          nodes.push(n);
        };

        if (shell) {
          addNode(shell.querySelector('[class*="select__menu-list"]'));
          addNode(shell.querySelector('[role="listbox"]'));
          addNode(shell.querySelector('[class*="select__menu"]'));
        }

        // React-select often portals the menu outside .select-shell.
        const controlledIds = [el.getAttribute('aria-controls'), el.getAttribute('aria-owns')].filter(Boolean);
        for (const id of controlledIds) {
          addNode(document.getElementById(id));
        }

        document.querySelectorAll('[role="listbox"], [class*="select__menu"], [class*="select__menu-list"]').forEach(addNode);

        const opts = [];
        const seenOpts = new Set();
        for (const node of nodes) {
          node.querySelectorAll('[role="option"], [class*="select__option"]').forEach((o) => {
            if (!seenOpts.has(o)) {
              seenOpts.add(o);
              opts.push(o);
            }
          });
        }
        return opts;
      };

      const opts = collectOptions();
      if (opts.length === 0) return null;
      // Exact match first.
      for (const o of opts) {
        const text = (o.textContent || '').trim().toLowerCase();
        if (text === v) return o;
      }
      // Fuzzy: option starts with or contains the value.
      for (const o of opts) {
        const text = (o.textContent || '').trim().toLowerCase();
        if (text.includes(v) || v.includes(text)) return o;
      }
      // Consent-like fields vary by wording. If the mapped value is
      // "I agree" but ATS option text is "I Accept", treat as equivalent.
      if ((String(v).includes('agree') || String(v).includes('accept')) &&
          (String(label || '').includes('consent') || String(label || '').includes('privacy'))) {
        for (const o of opts) {
          const text = (o.textContent || '').trim().toLowerCase();
          if (text.includes('agree') || text.includes('accept') || text.includes('consent') || text.includes('authorize')) {
            return o;
          }
        }
      }
      // If only one option is shown (common in autocomplete), pick it.
      if (opts.length === 1) return opts[0];
      return null;
    }, input, val, label);
  };

  let optionHandle = await findOption(target, fieldLabel);
  let option = optionHandle.asElement();

  // Retry: if typing filtered out all options, clear the input, reopen
  // the menu to show all options, and try a semantic/keyword match.
  if (!option) {
    if (process.env.APPLYPILOT_DEBUG) {
      console.log(`[DEBUG] fillReactSelect(${name}): first attempt failed, retrying with clear+reopen`);
    }
    // Clear what was typed and reopen the menu.
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 300));

    // Focus the input and clear its value.
    await input.focus();
    await page.keyboard.down('Meta');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Meta');
    await page.keyboard.press('Backspace');
    await new Promise((r) => setTimeout(r, 300));

    // Re-focus and press ArrowDown to reopen the full options list.
    await input.focus();
    await page.keyboard.press('ArrowDown');
    await new Promise((r) => setTimeout(r, 600));

    // Try keyword matching: split the value into words and look for options
    // sharing the most keywords.
    optionHandle = await page.evaluateHandle((el, v, label) => {
      const collectOptions = () => {
        const shell = el.closest('.select-shell');
        const nodes = [];
        const seenNodes = new Set();
        const addNode = (n) => {
          if (!n || seenNodes.has(n)) return;
          seenNodes.add(n);
          nodes.push(n);
        };

        if (shell) {
          addNode(shell.querySelector('[class*="select__menu-list"]'));
          addNode(shell.querySelector('[role="listbox"]'));
          addNode(shell.querySelector('[class*="select__menu"]'));
        }
        const controlledIds = [el.getAttribute('aria-controls'), el.getAttribute('aria-owns')].filter(Boolean);
        for (const id of controlledIds) {
          addNode(document.getElementById(id));
        }
        document.querySelectorAll('[role="listbox"], [class*="select__menu"], [class*="select__menu-list"]').forEach(addNode);

        const opts = [];
        const seenOpts = new Set();
        for (const node of nodes) {
          node.querySelectorAll('[role="option"], [class*="select__option"]').forEach((o) => {
            if (!seenOpts.has(o)) {
              seenOpts.add(o);
              opts.push(o);
            }
          });
        }
        return opts;
      };

      const opts = collectOptions();
      if (opts.length === 0) return null;

      // Semantic synonyms for common ATS answer patterns.
      const synonyms = {
        'prefer not to say': ["don't wish to answer", "decline to state", "prefer not to disclose", "choose not to disclose"],
        "don't wish to answer": ["prefer not to say", "decline to state", "prefer not to disclose"],
        'decline to state': ["prefer not to say", "don't wish to answer", "prefer not to disclose"],
        'i agree': ['i accept', 'accept', 'agree', 'yes'],
        'i accept': ['i agree', 'agree', 'accept', 'yes'],
      };
      const syns = synonyms[v] || [];
      for (const o of opts) {
        const text = (o.textContent || '').trim().toLowerCase();
        for (const s of syns) {
          if (text === s || text.includes(s) || s.includes(text)) return o;
        }
      }

      // Field-label-aware consent fallback.
      if ((String(v).includes('agree') || String(v).includes('accept')) &&
          (String(label || '').includes('consent') || String(label || '').includes('privacy'))) {
        for (const o of opts) {
          const text = (o.textContent || '').trim().toLowerCase();
          if (text.includes('agree') || text.includes('accept') || text.includes('consent') || text.includes('authorize')) {
            return o;
          }
        }
      }

      // Keyword overlap: split both into words and count matches.
      const valWords = v.split(/\s+/).filter(w => w.length > 2);
      let best = null;
      let bestScore = 0;
      for (const o of opts) {
        const text = (o.textContent || '').trim().toLowerCase();
        const textWords = text.split(/\s+/).filter(w => w.length > 2);
        const score = valWords.filter(w => textWords.some(tw => tw.includes(w) || w.includes(tw))).length;
        if (score > bestScore) {
          bestScore = score;
          best = o;
        }
      }
      // Only use keyword match if at least half the words matched.
      if (best && bestScore >= Math.ceil(valWords.length / 2)) return best;

      return null;
    }, input, target, fieldLabel);
    option = optionHandle.asElement();
  }

  if (!option) {
    // Close the dropdown since we couldn't match.
    await page.keyboard.press('Escape');
    return false;
  }

  await option.click();
  await new Promise((r) => setTimeout(r, 200));
  return true;
}

/**
 * Type `value` into the matching DOM input. Handles input/textarea/select
 * and Greenhouse's react-select custom dropdowns.
 * Returns true if it wrote anything, false if the field wasn't found.
 */
async function fillField(page, name, value, fieldMeta = null) {
  if (value == null) return false;
  // Escape characters special in CSS attribute selectors: ", \, [, ]
  const escapedName = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  // Try matching by name attribute first, then by id. Greenhouse's newer
  // job-boards.greenhouse.io uses id-based fields without name attributes.
  const handle = await page.$(`[name="${escapedName}"]`)
    || await page.$(`[id="${escapedName}"]`);
  if (!handle) return false;
  const tag = await handle.evaluate((el) => ({
    tag: el.tagName,
    type: el.type,
    isReactSelect: el.getAttribute('role') === 'combobox' && !!el.closest('.select-shell'),
  }));
  // Greenhouse react-select custom dropdowns.
  if (tag.isReactSelect) {
    return fillReactSelect(page, name, value, fieldMeta);
  }
  if (tag.tag === 'SELECT') {
    try {
      await handle.select(String(value));
      return true;
    } catch (_) {
      // Try matching by visible option text.
      const matched = await handle.evaluate((el, val) => {
        const v = String(val).toLowerCase();
        for (const o of el.options) {
          if ((o.textContent || '').trim().toLowerCase() === v) {
            el.value = o.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      }, value);
      return matched;
    }
  }
  if (tag.type === 'checkbox' || tag.type === 'radio') {
    const target = String(value).toLowerCase();
    // Re-query all matching elements by both name and id for grouped inputs.
    const byName = await page.$$(`[name="${escapedName}"]`);
    const byId = byName.length ? byName : await page.$$(`[id="${escapedName}"]`);
    const boxes = byName.length ? byName : byId;
    // Special case: a lone checkbox (not a grouped multi-select) with a
    // truthy target value. The consent heuristic resolves to 'yes' for
    // attestation boxes whose `value` attribute on the DOM is usually
    // "1"/"true"/empty — value matching would fail. Just click once,
    // unless it's already checked.
    const isTruthy = ['yes', 'true', '1', 'check', 'checked', 'agree', 'on'].includes(target);
    if (tag.type === 'checkbox' && boxes.length === 1 && isTruthy) {
      const already = await boxes[0].evaluate((el) => !!el.checked);
      if (!already) await boxes[0].click();
      return true;
    }
    for (const b of boxes) {
      const bv = await b.evaluate((el) => String(el.value || '').toLowerCase());
      if (bv === target || bv.includes(target)) {
        await b.click();
        return true;
      }
    }
    // Fallback: match by visible label text (the label element's textContent
    // may differ from the checkbox's value attribute).
    for (const b of boxes) {
      const labelText = await b.evaluate((el) => {
        const lbl = el.labels?.[0] || document.querySelector(`label[for="${el.id}"]`);
        if (lbl) return lbl.textContent.trim().toLowerCase();
        const closest = el.closest('label');
        return closest ? closest.textContent.trim().toLowerCase() : '';
      });
      if (labelText && (labelText === target || labelText.includes(target) || target.includes(labelText))) {
        await b.click();
        return true;
      }
    }
    return false;
  }
  // Clear + type.
  await handle.click({ clickCount: 3 });
  await handle.type(String(value), { delay: 12 });
  return true;
}

/**
 * Grab a PNG screenshot of the page, upload it to Cloudinary, and
 * return a `{ url, label, capturedAt }` record. URL may be null on dev
 * without Cloudinary creds — the caller should still record the label
 * so the timeline renders the step name.
 */
async function captureStep(page, { userId, appId, step, label }) {
  let url = null;
  try {
    const buffer = await page.screenshot({ type: 'png', fullPage: true });
    url = await uploadScreenshot(buffer, { userId, appId, step, label });
  } catch (err) {
    console.warn(`[greenhousePuppeteer] screenshot step=${step} failed: ${err.message}`);
  }
  return { url, label, capturedAt: new Date().toISOString() };
}

/**
 * Type a verification code into the live Greenhouse page (handles both
 * the 8-box layout and a single OTP input), click submit, and poll for
 * the confirmation text. Returns `{ success: boolean, error: string|null }`.
 */
async function handleVerificationCode({ page, app, code, SUCCESS_RE, screenshots }) {
  const typed = await page.evaluate((codeStr) => {
    const boxes = Array.from(document.querySelectorAll(
      'form input[maxlength="1"], [data-testid*="security-code" i] input, [class*="verification" i] input, [class*="security" i] input[type="text"], [class*="security" i] input:not([type])'
    )).filter((el) => el.offsetParent !== null);
    if (boxes.length >= codeStr.length) {
      for (let i = 0; i < codeStr.length; i += 1) {
        const box = boxes[i];
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(box, codeStr[i]);
        box.dispatchEvent(new Event('input', { bubbles: true }));
        box.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return 'multi';
    }
    const single = document.querySelector(
      'input[name*="code" i], input[id*="code" i], input[autocomplete="one-time-code"]'
    );
    if (single) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(single, codeStr);
      single.dispatchEvent(new Event('input', { bubbles: true }));
      single.dispatchEvent(new Event('change', { bubbles: true }));
      return 'single';
    }
    return null;
  }, code);

  if (!typed) {
    return { success: false, error: 'Could not locate the verification-code input on the Greenhouse page.' };
  }
  if (process.env.APPLYPILOT_DEBUG) {
    console.log(`[DEBUG] verification code typed (${typed} variant): ${code.slice(0, 2)}******`);
  }

  await new Promise((r) => setTimeout(r, 600));
  const verifyClicked = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('form button, form input[type="submit"], button'))
      .filter((el) => el.offsetParent !== null);
    const preferred = candidates.find((el) => /submit|verify|continue|confirm/i.test((el.innerText || el.value || '').trim()));
    const target = preferred || candidates[0];
    if (!target) return false;
    target.click();
    return true;
  });
  if (!verifyClicked) {
    return { success: false, error: 'Verification code typed but no submit button found on verification screen.' };
  }

  if (Array.isArray(screenshots)) {
    try {
      screenshots.push(await captureStep(page, {
        userId: app.userId, appId: app.id, step: '04-verification-submitted', label: 'Verification code submitted',
      }));
    } catch (_) { /* best effort */ }
  }

  const verifyDeadline = Date.now() + 25_000;
  let verifyError = null;
  while (Date.now() < verifyDeadline) {
    const probe = await page.evaluate(() => {
      const txt = (document.body && document.body.innerText) || '';
      const errs = [];
      document.querySelectorAll('[role="alert"], .error-message, [class*="error" i]').forEach((n) => {
        const t = (n.innerText || '').trim();
        if (t && t.length < 200) errs.push(t);
      });
      return { txt: txt.slice(0, 5000), errs };
    }).catch(() => ({ txt: '', errs: [] }));

    if (SUCCESS_RE.test(probe.txt)) return { success: true, error: null };
    const badCode = probe.errs.find((e) => /code|invalid|incorrect|expired/i.test(e));
    if (badCode) { verifyError = `Greenhouse rejected the verification code: ${badCode}`; break; }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { success: false, error: verifyError };
}

async function submit(ctx) {
  const { app } = ctx;
  const dryRun = !!ctx.dryRun;
  const applyUrl = ctx.applyUrl || app.applyUrl;
  const parsed = parseUrl(applyUrl);
  if (!parsed) throw new Error('Greenhouse (Puppeteer) adapter received a non-Greenhouse URL');

  const SUCCESS_RE = /thank you for applying|thanks for your application|application received|your application (?:has been|was) submitted|we received your application|application submitted/i;

  // Persist resume PDF to a temp file for Puppeteer's uploadFile.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'applypilot-'));
  const resumeFile = path.join(tmpDir, ctx.resumeFileName || 'resume.pdf');
  fs.writeFileSync(resumeFile, ctx.resumePdfBuffer);

  const puppeteer = getPuppeteer();
  const userDataDir = userDataDirFor(app?.userId);
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: userDataDir || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1280,900',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  // Real Chrome UA — stealth plugin patches navigator.webdriver and
  // related fingerprints, but UA still needs to look plausible.
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });

  const screenshots = [];
  let receipt = null;
  // (Legacy: park-for-verification path is intentionally unused now —
  // we reject on verification gate instead. Kept as a no-op flag so the
  // finally block stays simple.)
  let parkedForVerification = false;

  try {
    // 1. Navigate + capture the blank form.
    await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    try {
      await page.waitForSelector('form', { timeout: 15_000 });
    } catch (_) {
      throw new Error('Greenhouse apply form never rendered (selector `form` timed out)');
    }
    screenshots.push(await captureStep(page, {
      userId: app.userId, appId: app.id, step: '01-loaded', label: 'Form loaded',
    }));

    // 2. Harvest field schema from the live DOM.
    const fields = await harvestFieldsFromDom(page);
    if (process.env.APPLYPILOT_DEBUG) {
      console.log('[DEBUG] Harvested fields:', JSON.stringify(fields.map(f => ({ name: f.name, label: f.label, type: f.type, required: f.required })), null, 2));
    }

    // 3. Map answers → field names using the shared mapper. Skip file
    //    fields — the resume is uploaded explicitly below.
    const mappable = fields.filter((f) => f.type !== 'file');
    const { values, blockers, resolutions } = await mapFormFields({
      app: ctx.app,
      fields: mappable,
      profile: ctx.profile,
      user: ctx.user,
      memory: ctx.memory,
      demographics: ctx.demographics,
      job: ctx.job,
    });
    if (process.env.APPLYPILOT_DEBUG) {
      console.log('[DEBUG] Mapped values:', JSON.stringify(values, null, 2));
      console.log('[DEBUG] Blockers:', blockers.length);
    }
    // Hoist resolutions so they ride along on both the success receipt
    // and any thrown error screenshots.
    ctx._resolutions = Array.isArray(resolutions) ? resolutions : [];

    if (blockers.length) {
      const err = new Error(
        `Greenhouse (Puppeteer) needs ${blockers.length} field${blockers.length === 1 ? '' : 's'} you haven't trained: ` +
        blockers.slice(0, 3).map((b) => b.field.label || b.field.rawName).join(', '),
      );
      err.needsHuman = true;
      err.blockers = blockers.map((b) => ({
        label: b.field.label,
        name: b.field.rawName || b.field.name,
        reason: b.reason,
      }));
      throw err;
    }

    const fieldByName = new Map(fields.map((f) => [f.name || f.id, f]));

    // 4. Fill every mappable field with small humanized delays
    //    between each so we don't trip behavioral bot-detection.
    await jitter(400, 900);
    for (const [name, value] of Object.entries(values)) {
      try {
        const filled = await fillField(page, name, value, fieldByName.get(name) || null);
        if (process.env.APPLYPILOT_DEBUG) {
          console.log(`[DEBUG] fillField(${name}) = ${filled} (value: ${String(value).slice(0, 40)})`);
        }
        await jitter(180, 520);
      } catch (e) {
        console.warn(`[greenhousePuppeteer] failed to fill ${name}: ${e.message}`);
      }
    }

    // 5. Upload resume and cover letter.
    //    Greenhouse has two file inputs: #resume and #cover_letter.
    //    Target each by id so we don't mix them up.
    const resumeInput = await page.$('#resume')
      || await page.$('input[name="resume"][type="file"]')
      || await page.$('form input[type="file"]');
    if (resumeInput) {
      await resumeInput.uploadFile(resumeFile);
      await new Promise((r) => setTimeout(r, 800));
    }

    // Cover letter — write the text to a temp .txt and upload it.
    const coverText = ctx.app?.coverLetter;
    if (coverText) {
      const coverLetterInput = await page.$('#cover_letter')
        || await page.$('input[name="cover_letter"][type="file"]');
      if (coverLetterInput) {
        const coverFile = path.join(tmpDir, 'cover-letter.txt');
        fs.writeFileSync(coverFile, coverText, 'utf-8');
        await coverLetterInput.uploadFile(coverFile);
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    // 6. Capture the filled form.
    screenshots.push(await captureStep(page, {
      userId: app.userId, appId: app.id, step: '02-filled', label: 'Form filled',
    }));

    // 6b. Re-scan for conditional required fields. On modern Greenhouse
    //     (job-boards.greenhouse.io) some EEO questions — notably the
    //     race dropdown — only render AFTER an earlier field is filled
    //     (e.g. selecting a Hispanic/Latino answer reveals "Please
    //     identify your race"). Scroll through the form to trigger any
    //     intersection-observer lazy renders, then re-harvest. If we
    //     find new required fields the first pass missed, map and fill
    //     them. Cap at two extra passes to avoid loops on weird forms.
    for (let pass = 0; pass < 2; pass += 1) {
      // Scroll the form (and the document) end-to-end to nudge lazy
      // sections into the DOM.
      await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const total = document.body.scrollHeight;
        for (let y = 0; y <= total; y += Math.max(200, Math.floor(window.innerHeight / 2))) {
          window.scrollTo(0, y);
          await sleep(50);
        }
        window.scrollTo(0, 0);
      }).catch(() => {});
      await new Promise((r) => setTimeout(r, 600));

      const fresh = await harvestFieldsFromDom(page);
      const knownNames = new Set(fields.map((f) => f.name || f.id));
      const newFields = fresh.filter((f) => f.name && !knownNames.has(f.name) && f.type !== 'file');
      if (process.env.APPLYPILOT_DEBUG) {
        console.log(`[DEBUG] Conditional rescan pass ${pass + 1}: +${newFields.length} new field(s):`,
          JSON.stringify(newFields.map((f) => ({ name: f.name, label: f.label, type: f.type, required: f.required }))));
      }
      if (!newFields.length) break;

      // Track them so the next pass / pre-flight sees them.
      for (const nf of newFields) {
        fields.push(nf);
        fieldByName.set(nf.name || nf.id, nf);
      }

      const newMap = await mapFormFields({
        app: ctx.app,
        fields: newFields,
        profile: ctx.profile,
        user: ctx.user,
        memory: ctx.memory,
        demographics: ctx.demographics,
        job: ctx.job,
      });
      // Only block on REQUIRED conditional fields the mapper couldn't
      // resolve — optional ones are fine to skip.
      const requiredBlockers = (newMap.blockers || []).filter((b) => b.field?.required);
      if (requiredBlockers.length) {
        const err = new Error(
          `Greenhouse needs ${requiredBlockers.length} conditional field${requiredBlockers.length === 1 ? '' : 's'} you haven't trained: ` +
          requiredBlockers.slice(0, 3).map((b) => b.field.label || b.field.rawName).join(', '),
        );
        err.needsHuman = true;
        err.blockers = requiredBlockers.map((b) => ({
          label: b.field.label,
          name: b.field.rawName || b.field.name,
          reason: b.reason,
        }));
        throw err;
      }
      ctx._resolutions = (ctx._resolutions || []).concat(
        Array.isArray(newMap.resolutions) ? newMap.resolutions : [],
      );

      for (const [name, value] of Object.entries(newMap.values || {})) {
        try {
          const filled = await fillField(page, name, value, fieldByName.get(name) || null);
          if (process.env.APPLYPILOT_DEBUG) {
            console.log(`[DEBUG] (rescan) fillField(${name}) = ${filled} (value: ${String(value).slice(0, 40)})`);
          }
        } catch (e) {
          console.warn(`[greenhousePuppeteer] rescan failed to fill ${name}: ${e.message}`);
        }
      }
    }

    // 6c. Pre-flight: enumerate every required field still visibly empty
    //     (covers conditional fields, react-selects, and stale fills).
    //     If anything's blank, fail fast with a precise list rather than
    //     clicking submit and getting a silent SPA rejection.
    const missing = await page.evaluate(() => {
      const out = [];
      const isVisible = (el) => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        return style.visibility !== 'hidden' && style.display !== 'none';
      };
      // a) Native required inputs.
      document.querySelectorAll('form input[required], form textarea[required], form select[required]').forEach((el) => {
        if (el.type === 'hidden' || !isVisible(el)) return;
        if (el.type === 'checkbox' || el.type === 'radio') {
          // group required: at least one in group must be checked.
          const name = el.name || el.id;
          if (!name) return;
          const any = document.querySelectorAll(`input[name="${name.replace(/"/g, '\\\"')}"]:checked`).length > 0;
          if (!any) out.push({ name, label: (el.labels?.[0]?.textContent || name).trim().slice(0, 80) });
          return;
        }
        if (!String(el.value || '').trim()) {
          const lbl = (el.labels?.[0]?.textContent || '').trim();
          out.push({ name: el.name || el.id, label: lbl.slice(0, 80) });
        }
      });
      // b) React-select required (asterisk in label or aria-required).
      document.querySelectorAll('.select-shell').forEach((shell) => {
        const labelEl = shell.querySelector('label, .select__label, [class*="label"]');
        const labelText = labelEl ? labelEl.textContent.trim() : '';
        const combobox = shell.querySelector('[role=\"combobox\"]');
        const ariaReq = combobox && combobox.getAttribute('aria-required') === 'true';
        const starred = /\*\s*$/.test(labelText.replace(/\s+$/, ''));
        if (!ariaReq && !starred) return;
        if (!isVisible(shell)) return;
        // Empty if there's no .select__single-value AND no .select__multi-value.
        const hasSingle = !!shell.querySelector('.select__single-value');
        const hasMulti = !!shell.querySelector('.select__multi-value');
        if (!hasSingle && !hasMulti) {
          out.push({
            name: combobox?.id || combobox?.name || labelText.replace(/\*/g, '').trim(),
            label: labelText.replace(/\s+/g, ' ').trim().slice(0, 80),
          });
        }
      });
      return out;
    });
    if (process.env.APPLYPILOT_DEBUG) {
      console.log('[DEBUG] Pre-flight missing required fields:', JSON.stringify(missing));
    }
    if (!dryRun && missing.length) {
      const err = new Error(
        `Greenhouse has ${missing.length} required field${missing.length === 1 ? '' : 's'} still empty: ` +
        missing.slice(0, 5).map((m) => m.label || m.name).join(', '),
      );
      err.needsHuman = true;
      err.blockers = missing.map((m) => ({ label: m.label, name: m.name, reason: 'empty_required_pre_submit' }));
      throw err;
    }

    // 7. Optional dry-run path for previewing before approval.
    if (dryRun) {
      screenshots.push(await captureStep(page, {
        userId: app.userId,
        appId: app.id,
        step: '03-preview',
        label: 'Pre-submit preview',
      }));

      receipt = {
        ok: true,
        dryRun: true,
        provider: 'greenhouse-puppeteer',
        confirmationUrl: null,
        previewUrl: page.url(),
        submittedAt: null,
        screenshots: screenshots.filter((s) => s.url),
        resolutions: Array.isArray(ctx._resolutions) ? ctx._resolutions : [],
      };
    } else {
      // 8. Submit. Modern Greenhouse (job-boards.greenhouse.io) is a SPA:
      // the success state usually renders in-place WITHOUT a navigation,
      // so we kick off the click and then poll for either a confirmation
      // string OR a visible validation error, whichever appears first.
      const SUBMIT_SELECTORS = [
        'form button[type="submit"]',
        'form input[type="submit"]',
        'button#submit_app',
        'button[name="commit"]',
        'button[data-testid="submit-button"]',
        'button[data-source="apply_form_submit"]',
      ];
      const startUrl = page.url();

      let clicked = false;
      for (const sel of SUBMIT_SELECTORS) {
        const el = await page.$(sel);
        if (el) {
          // Scroll into view, then click. We don't wait on navigation here
          // because the SPA path doesn't navigate.
          await el.evaluate((node) => node.scrollIntoView({ block: 'center' })).catch(() => {});
          // Fire a possible navigation listener in parallel but don't fail
          // if it never resolves.
          const navP = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null);
          await el.click().catch(async () => {
            // Some versions wrap submit in a non-button element — fall back to JS click.
            await page.evaluate((s) => {
              const n = document.querySelector(s);
              if (n) n.click();
            }, sel);
          });
          await navP;
          clicked = true;
          break;
        }
      }
      if (!clicked) throw new Error('Could not locate the Greenhouse submit button.');

      // 9. Poll up to ~25s for confirmation, validation error, OR an
      //    8-character email-verification challenge that Greenhouse
      //    sometimes injects right after submit.
      let success = false;
      let validationErrors = [];
      let verificationDetected = false;
      const deadline = Date.now() + 25_000;
      const VERIFICATION_RE = /verification code was sent|enter the 8-character code|security code/i;
      while (Date.now() < deadline) {
        // Did the URL change to a /confirmation, /thanks, /submitted etc?
        const currentUrl = page.url();
        if (currentUrl !== startUrl && /confirm|thank|submitted|applied|success/i.test(currentUrl)) {
          success = true;
          break;
        }
        // Pull a snapshot of body text + visible error nodes.
        const probe = await page.evaluate(() => {
          const txt = (document.body && document.body.innerText) || '';
          const errSelectors = [
            '[role="alert"]',
            '[aria-invalid="true"]',
            '.field-error',
            '.error-message',
            '.field--error',
            '.input-error',
            '[data-testid*="error" i]',
          ];
          const errs = new Set();
          for (const sel of errSelectors) {
            document.querySelectorAll(sel).forEach((n) => {
              const t = (n.innerText || '').trim();
              if (t && t.length < 200) errs.add(t);
            });
          }
          return { txt: txt.slice(0, 5000), errs: Array.from(errs) };
        }).catch(() => ({ txt: '', errs: [] }));

        if (SUCCESS_RE.test(probe.txt)) { success = true; break; }
        if (VERIFICATION_RE.test(probe.txt)) { verificationDetected = true; break; }
        if (probe.errs.length) {
          validationErrors = probe.errs;
        }
        if (validationErrors.length) {
          await new Promise((r) => setTimeout(r, 1500));
          const recheck = await page.evaluate(() => (document.body && document.body.innerText) || '').catch(() => '');
          if (SUCCESS_RE.test(recheck)) { success = true; break; }
          if (VERIFICATION_RE.test(recheck)) { verificationDetected = true; break; }
          break; // sticky validation error — surface it
        }
        await new Promise((r) => setTimeout(r, 1500));
      }

      // 9b. Email verification code gate.
      //     We do NOT solve this — would require Gmail OAuth. Instead
      //     we capture proof and surface a structured `manualReviewRequired`
      //     error so the worker can mark the app as rejected and notify
      //     the user to apply via the Chrome extension.
      if (verificationDetected) {
        screenshots.push(await captureStep(page, {
          userId: app.userId, appId: app.id, step: '03-verification', label: 'Email verification required (anti-bot gate)',
        }));
        const err = new Error(
          'Greenhouse triggered an email verification gate (anti-bot). ' +
          'Auto-submit is not possible for this posting — apply manually using the ApplyPilot Chrome extension.',
        );
        err.needsHuman = true;
        err.manualReviewRequired = true;
        err.verificationEmailRequired = true;
        err.useChromeExtension = true;
        err.verificationEmail = ctx.user?.email || ctx.app?.candidateEmail || null;
        throw err;
      }

      screenshots.push(await captureStep(page, {
        userId: app.userId, appId: app.id, step: '03-confirmation', label: success ? 'Confirmation' : 'Post-submit',
      }));

      if (!success) {
        const detail = validationErrors.length
          ? `Greenhouse rejected the form: ${validationErrors.slice(0, 5).join(' | ')}`
          : `Greenhouse did not return a confirmation page. URL after submit: ${page.url()}`;
        throw new Error(detail);
      }

      receipt = {
        ok: true,
        provider: 'greenhouse-puppeteer',
        confirmationUrl: page.url(),
        submittedAt: new Date().toISOString(),
        screenshots: screenshots.filter((s) => s.url),
        // Audit trail for any fields auto-resolved by the consent heuristic
        // or training memory. Always an array.
        resolutions: Array.isArray(ctx._resolutions) ? ctx._resolutions : [],
      };
    }
  } catch (err) {
    // Error screenshot so the human gets context, even for needsHuman cases.
    try {
      screenshots.push(await captureStep(page, {
        userId: app.userId, appId: app.id, step: 'error', label: `Error: ${String(err.message).slice(0, 80)}`,
      }));
    } catch (_) { /* best effort */ }
    // Attach screenshots + resolutions to the error so the worker can
    // persist them on the failed row. Resolutions are useful even on
    // failure — they tell the reviewer which consent boxes the agent
    // ticked before things blew up.
    err.screenshots = screenshots.filter((s) => s.url);
    err.resolutions = Array.isArray(ctx._resolutions) ? ctx._resolutions : [];
    throw err;
  } finally {
    if (!parkedForVerification) {
      try { await browser.close(); } catch (_) {}
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  }

  return receipt;
}

module.exports = {
  name: 'greenhouse-puppeteer',
  matches,
  submit,
  parseUrl,
};
