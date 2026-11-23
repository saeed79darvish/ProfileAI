import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';
import { buildFixtures, OUT_DIR } from './build-fixtures.mjs';

let find;
before(async () => {
  await buildFixtures();
  find = (await import(resolve(OUT_DIR, 'applyTarget.mjs'))).findApplyTarget;
});

const page = (html, url = 'https://jobs.ashbyhq.com/illumio/abc') => {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url });
  return find(dom.window.document, dom.window, { layout: false });
};

test('Ashby: the Application tab on the posting', () => {
  const el = page('<nav><a href="/illumio/abc">Overview</a><a href="/illumio/abc/application">Application</a></nav><h1>Sr. Engineer</h1>');
  assert.equal(el?.textContent, 'Application');
});

test('Greenhouse and Lever: the Apply link or button', () => {
  assert.equal(page('<a class="btn" href="#app">Apply for this job</a>', 'https://boards.greenhouse.io/x/jobs/1')?.textContent, 'Apply for this job');
  assert.equal(page('<a href="/acme/123/apply">Apply</a>', 'https://jobs.lever.co/acme/123')?.textContent, 'Apply');
  assert.equal(page('<button>Apply now</button>', 'https://careers.example.com/job/1')?.textContent, 'Apply now');
});

test('an Apply link that leaves the site is not followed', () => {
  assert.equal(page('<a href="https://other-ats.com/apply/1">Apply</a>', 'https://careers.example.com/job/1'), null);
});

test('a page that already shows a form is left alone', () => {
  const inputs = '<input type="text"><input type="email"><input type="tel"><textarea></textarea>';
  assert.equal(page(`<a href="/apply">Apply</a><form>${inputs}</form>`, 'https://careers.example.com/job/1'), null);
});

test('only an apply label counts, never a lookalike', () => {
  assert.equal(page('<a href="/x">Applications status</a><a href="/y">Apply filters</a><button>Reapply</button>'), null);
  assert.equal(page('<a href="/jobs">See all jobs</a><button>Save</button>'), null);
});

test('our own panel is never clicked', () => {
  assert.equal(page('<div id="profileai-overlay"><button>Apply</button></div>'), null);
});

test('wording on other boards', () => {
  const labels = ["I'm interested", 'Apply to this job', 'Apply for this position', 'Start application', 'Apply online', 'Apply Now', 'APPLICATION FORM'];
  for (const text of labels) {
    assert.equal(page(`<a href="/job/1/apply">${text}</a>`, 'https://careers.example.com/job/1')?.textContent, text, text);
  }
});

test('the Ashby tab is found when the page is the posting, and skipped once the form is up', () => {
  const tabs = '<nav><a href="/x/abc">Overview</a><a href="/x/abc/application">Application</a></nav>';
  assert.equal(page(tabs)?.textContent, 'Application');
  const form = '<input type="text"><input type="email"><input type="tel"><textarea></textarea>';
  assert.equal(page(tabs + form), null);
});
