#!/usr/bin/env node
/**
 * Temporary: inspect dropdown options for one Greenhouse custom select.
 */
require('dotenv').config();
const puppeteer = require('puppeteer');

(async () => {
  const url = 'https://job-boards.greenhouse.io/reddit/jobs/7825753';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('form', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2000));

  // Click on a combobox to open its dropdown and read options
  const comboboxes = await page.$$('[role="combobox"][aria-haspopup="true"]');
  console.log(`Found ${comboboxes.length} comboboxes`);

  for (let i = 0; i < Math.min(comboboxes.length, 3); i++) {
    const cb = comboboxes[i];
    const name = await cb.evaluate((el) => el.name || el.id);
    const label = await cb.evaluate((el) => {
      const l = el.closest('.field-wrapper, .field, .form-field, [class*="field"]');
      return l?.querySelector('label')?.textContent?.trim() || '';
    });
    console.log(`\n--- Combobox: ${name} (${label.slice(0, 60)}) ---`);

    // Click to open
    await cb.click();
    await new Promise((r) => setTimeout(r, 500));

    // Read options from the opened dropdown
    const options = await page.evaluate((inputName) => {
      // Look for the listbox that appeared
      const listboxes = document.querySelectorAll('[role="listbox"], [class*="select__menu"] [class*="option"], [class*="menu-list"] div');
      const opts = [];
      // Try role=option elements
      document.querySelectorAll('[role="option"]').forEach((el) => {
        opts.push(el.textContent.trim());
      });
      if (!opts.length) {
        // Try select__option class
        document.querySelectorAll('[class*="select__option"]').forEach((el) => {
          opts.push(el.textContent.trim());
        });
      }
      return opts;
    }, name);

    console.log('Options:', options.slice(0, 10));

    // Close by pressing Escape
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 300));
  }

  await browser.close();
})();
