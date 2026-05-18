#!/usr/bin/env node
require('dotenv').config();
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.goto('https://job-boards.greenhouse.io/reddit/jobs/7825753', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('form', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2000));

  // Focus the target input and type to trigger react-select
  const input = await page.$('input[name="question_65721388"]')
    || await page.$('input[id="question_65721388"]')
    || await page.$('#question_65721388');
  if (!input) {
    // Dump all combobox inputs
    const cbs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input[role="combobox"]')).map(el => ({
        name: el.name, id: el.id, tag: el.tagName
      }));
    });
    console.log('No input found. Comboboxes:', JSON.stringify(cbs));
    await browser.close();
    process.exit(1);
  }
  
  await input.click();
  await new Promise((r) => setTimeout(r, 500));

  // Type "Yes" to filter
  await input.type('Yes', { delay: 50 });
  await new Promise((r) => setTimeout(r, 800));

  // Read what options appear
  const opts = await page.evaluate(() => {
    const all = document.querySelectorAll('[class*="select__option"]');
    return Array.from(all).map((o) => ({
      text: o.textContent.trim(),
      classes: o.className.slice(0, 80),
    }));
  });
  console.log('Options after typing "Yes":', JSON.stringify(opts, null, 2));

  // Also dump the HTML near the menu 
  const menuHTML = await page.evaluate(() => {
    const menu = document.querySelector('[class*="select__menu"]');
    return menu?.innerHTML?.slice(0, 1000) || 'no menu found';
  });
  console.log('\nMenu HTML:', menuHTML);

  // Now try selecting an option by clicking it
  if (opts.length > 0) {
    const option = await page.$('[class*="select__option"]');
    if (option) {
      await option.click();
      await new Promise((r) => setTimeout(r, 500));
      // Check if the value was set
      const selectedVal = await page.evaluate(() => {
        const sv = document.querySelector('[class*="select__single-value"]');
        // also check the input
        const input = document.querySelector('input[name="question_65721388"]');
        return {
          singleValue: sv?.textContent?.trim(),
          inputValue: input?.value,
        };
      });
      console.log('\nAfter selecting:', selectedVal);
    }
  }

  await browser.close();
})();
