#!/usr/bin/env node
/**
 * Temporary script: inspect Greenhouse dropdown DOM structure.
 * Delete after investigation.
 */
require('dotenv').config();
const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'https://job-boards.greenhouse.io/reddit/jobs/7825753';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('form', { timeout: 15000 });

  // Wait a bit for React hydration
  await new Promise((r) => setTimeout(r, 2000));

  const info = await page.evaluate(() => {
    const results = [];

    // 1. All form inputs with their context
    const allInputs = document.querySelectorAll('form input, form select, form textarea');
    allInputs.forEach((el) => {
      const name = el.name || el.id;
      if (!name) return;
      if (el.type === 'hidden') return;

      const wrapper = el.closest('[class*="select"], [class*="Select"], [class*="dropdown"]');
      const parent = el.parentElement;
      const label = el.labels?.[0]?.textContent?.trim() || '';

      results.push({
        _type: 'input',
        tag: el.tagName,
        inputType: el.type,
        name,
        label: label.slice(0, 80),
        role: el.getAttribute('role'),
        ariaExpanded: el.getAttribute('aria-expanded'),
        ariaHaspopup: el.getAttribute('aria-haspopup'),
        ariaAutocomplete: el.getAttribute('aria-autocomplete'),
        placeholder: el.placeholder || null,
        wrapperTag: wrapper?.tagName || null,
        wrapperClass: wrapper?.className?.slice(0, 120) || null,
        parentTag: parent?.tagName || null,
        parentClass: parent?.className?.slice(0, 120) || null,
        parentRole: parent?.getAttribute('role') || null,
      });
    });

    // 2. Native <select> elements (should show up if they exist)
    document.querySelectorAll('form select').forEach((el) => {
      const opts = Array.from(el.options).map((o) => o.textContent.trim()).slice(0, 5);
      results.push({
        _type: 'native-select',
        name: el.name || el.id,
        label: el.labels?.[0]?.textContent?.trim() || '',
        options: opts,
      });
    });

    // 3. Look for custom select containers: divs with role=combobox or listbox
    document.querySelectorAll('[role="combobox"], [role="listbox"]').forEach((el) => {
      results.push({
        _type: 'aria-widget',
        tag: el.tagName,
        role: el.getAttribute('role'),
        id: el.id,
        className: el.className?.slice(0, 120),
        ariaExpanded: el.getAttribute('aria-expanded'),
        textContent: el.textContent?.trim()?.slice(0, 80),
      });
    });

    // 4. Look for elements with "Select..." text that look like dropdowns
    document.querySelectorAll('form [class*="select"], form [class*="Select"]').forEach((el) => {
      if (el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
      const text = el.textContent?.trim()?.slice(0, 80);
      if (!text) return;
      results.push({
        _type: 'custom-select-container',
        tag: el.tagName,
        className: el.className?.slice(0, 120),
        role: el.getAttribute('role'),
        text,
        childInputName: el.querySelector('input')?.name || el.querySelector('input')?.id || null,
      });
    });

    return results;
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
