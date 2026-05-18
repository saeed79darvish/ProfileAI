#!/usr/bin/env node
/**
 * Temporary: inspect Greenhouse custom select options.
 * Clicks each combobox, reads its own listbox, then closes.
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

  // Get info about each combobox and its container
  const cbInfo = await page.evaluate(() => {
    const cbs = document.querySelectorAll('input[role="combobox"][aria-haspopup="true"]');
    return Array.from(cbs).map((el) => {
      const name = el.name || el.id;
      // Find the react-select container
      const selectContainer = el.closest('[class*="select__control"]')?.parentElement
        || el.closest('[class*="select"]');
      // The aria-controls attribute points to the listbox id
      const ariaControls = el.getAttribute('aria-controls');
      // Look at the wrapper structure
      const fieldWrapper = el.closest('.field-wrapper, [class*="field"]');
      const label = fieldWrapper?.querySelector('label')?.textContent?.trim() || '';

      return {
        name,
        label: label.slice(0, 80),
        ariaControls,
        selectContainerClass: selectContainer?.className?.slice(0, 100),
        isReactSelect: !!el.closest('[class*="select__"]'),
      };
    });
  });

  console.log('Comboboxes found:', cbInfo.length);
  for (const cb of cbInfo) {
    console.log(`  ${cb.name}: ${cb.label.slice(0, 50)} | reactSelect=${cb.isReactSelect} | controls=${cb.ariaControls}`);
  }

  // Skip the country combobox (index 0) and phone search (iti-0__search-input)
  // Try clicking question_65721388 specifically
  const targetName = 'question_65721388';
  const targetInput = await page.$(`input[name="${targetName}"][role="combobox"]`);
  if (targetInput) {
    console.log(`\n--- Clicking ${targetName} ---`);
    // Focus and click the react-select control area
    const controlDiv = await page.evaluateHandle((name) => {
      const input = document.querySelector(`input[name="${name}"]`);
      return input?.closest('[class*="select__control"]') || input;
    }, targetName);
    await controlDiv.click();
    await new Promise((r) => setTimeout(r, 800));

    // Check aria-expanded
    const expanded = await targetInput.evaluate((el) => el.getAttribute('aria-expanded'));
    console.log('aria-expanded:', expanded);

    // Read the aria-controls listbox
    const controlsId = await targetInput.evaluate((el) => el.getAttribute('aria-controls'));
    console.log('aria-controls:', controlsId);

    if (controlsId) {
      const options = await page.evaluate((id) => {
        const listbox = document.getElementById(id);
        if (!listbox) return [];
        return Array.from(listbox.querySelectorAll('[role="option"], [class*="option"]'))
          .map((o) => o.textContent.trim())
          .slice(0, 15);
      }, controlsId);
      console.log('Options from listbox:', options);
    }

    // Also try: read all visible select__option elements in the react-select menu
    const menuOptions = await page.evaluate((name) => {
      const input = document.querySelector(`input[name="${name}"]`);
      const selectRoot = input?.closest('[class*=" css-"]')?.parentElement
        || input?.closest('.select-container')
        || input?.closest('[class*="select"]')?.closest('[class*="field"]');
      if (!selectRoot) return { error: 'no select root found' };
      const opts = selectRoot.querySelectorAll('[class*="select__option"]');
      return Array.from(opts).map((o) => ({
        text: o.textContent.trim(),
        value: o.getAttribute('data-value') || o.id || '',
      })).slice(0, 10);
    }, targetName);
    console.log('Menu options:', menuOptions);

    // Also dump the rendered HTML around this input
    const html = await page.evaluate((name) => {
      const input = document.querySelector(`input[name="${name}"]`);
      const wrapper = input?.closest('[class*="field"]');
      return wrapper?.innerHTML?.slice(0, 2000) || 'not found';
    }, targetName);
    console.log('\nHTML around field:\n', html.slice(0, 1500));
  }

  await browser.close();
})();
