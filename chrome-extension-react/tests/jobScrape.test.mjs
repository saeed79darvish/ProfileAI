import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildFixtures, OUT_DIR } from './build-fixtures.mjs';
import { resolve } from 'path';

let scrapeJobFromDocument;
let mergeScrapes;
let scrapeQuality;
/** The minified build, exercised through the same string round-trip Chrome does. */
let injectedScraper;

before(async () => {
  await buildFixtures();
  const mod = await import(resolve(OUT_DIR, 'jobScrape.mjs'));
  scrapeJobFromDocument = mod.scrapeJobFromDocument;
  mergeScrapes = mod.mergeScrapes;
  scrapeQuality = mod.scrapeQuality;

  const min = await import(resolve(OUT_DIR, 'jobScrape.min.mjs'));
  // Exactly what chrome.scripting.executeScript does: take the function, turn
  // it into source, evaluate that source in a context that shares nothing with
  // the bundle it came from.
  const src = min.scrapeJobFromDocument.toString();
  injectedScraper = new Function(`return (${src});`)();
});

/**
 * Installs a document for the duration of one test. The scraper reads
 * `document` and `location` as page globals, which is what it will have in the
 * page too.
 */
function withPage(html, url) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  return dom;
}

/**
 * A LinkedIn job page, laid out the way the real one is: a visually-hidden page
 * `h1` and a left-hand rail of OTHER postings both appear in the DOM BEFORE the
 * top card that holds the title of the job actually being viewed.
 *
 * This ordering is the entire bug. `document.querySelector('.top-card__title,
 * …, h1')` returns the first element in DOCUMENT ORDER matching any of those
 * selectors, so the page-level `h1` won and the posting's own title lost.
 */
const LINKEDIN_PAGE = `<!doctype html><html><head><title>(3) Staff Software Engineer | Acme Corp | LinkedIn</title></head>
<body>
  <h1 class="visually-hidden">Jobs</h1>
  <aside class="jobs-search-results-list">
    <ul>
      <li><a class="job-card-container__link"><strong>Senior Software Engineer</strong></a></li>
      <li><a class="job-card-container__link"><strong>Junior Software Engineer</strong></a></li>
    </ul>
  </aside>
  <main>
    <div class="job-view-layout">
      <div class="job-details-jobs-unified-top-card__job-title"><h1><a>Staff Software Engineer</a></h1></div>
      <div class="job-details-jobs-unified-top-card__company-name"><a href="/company/acme">Acme Corp</a></div>
      <div id="job-details">
        <p>About the job</p>
        <ul>
          <li>Design distributed systems across multiple teams</li>
          <li>8+ years of professional software engineering experience</li>
          <li>Deep experience with Kubernetes and Go</li>
        </ul>
      </div>
    </div>
  </main>
</body></html>`;

test('the posting title beats a page-level h1 that appears earlier in the DOM', () => {
  withPage(LINKEDIN_PAGE, 'https://www.linkedin.com/jobs/view/123/');
  const job = scrapeJobFromDocument();

  assert.equal(job.title, 'Staff Software Engineer');
  assert.equal(job.site, 'linkedin');
  // Not the bare `h1`, and not the browser tab — the posting's own element.
  assert.equal(job.via.title, '.job-details-jobs-unified-top-card__job-title a');
});

test('the seniority band of a neighbouring job card never leaks into the title', () => {
  withPage(LINKEDIN_PAGE, 'https://www.linkedin.com/jobs/view/123/');
  const job = scrapeJobFromDocument();
  assert.ok(!/Senior/.test(job.title), `title leaked a rail entry: ${job.title}`);
  assert.ok(!/Junior/.test(job.title), `title leaked a rail entry: ${job.title}`);
});

test('company comes from the top card, not from any /company/ link on the page', () => {
  withPage(LINKEDIN_PAGE, 'https://www.linkedin.com/jobs/view/123/');
  const job = scrapeJobFromDocument();
  assert.equal(job.company, 'Acme Corp');
});

test('list markers survive the description read', () => {
  withPage(LINKEDIN_PAGE, 'https://www.linkedin.com/jobs/view/123/');
  const job = scrapeJobFromDocument();
  // Bullets are what tell the downstream matcher a line is a requirement
  // rather than company blurb.
  const bullets = job.description.split('\n').filter((l) => l.trim().startsWith('•'));
  assert.equal(bullets.length, 3, `expected 3 bulleted requirements, got:\n${job.description}`);
  assert.match(job.description, /8\+ years of professional software engineering experience/);
});

test('the description is the posting, not the whole left-hand rail', () => {
  withPage(LINKEDIN_PAGE, 'https://www.linkedin.com/jobs/view/123/');
  const job = scrapeJobFromDocument();
  assert.equal(job.via.description, '#job-details');
  assert.ok(
    !job.description.includes('Junior Software Engineer'),
    'description swallowed the list of other postings'
  );
});

test('a page with nothing recognisable degrades to the body rather than throwing', () => {
  withPage(
    `<!doctype html><html><head><title>Careers</title></head><body><p>${'some prose '.repeat(40)}</p></body></html>`,
    'https://example.com/careers'
  );
  const job = scrapeJobFromDocument();
  assert.equal(job.via.description, 'body');
  assert.ok(job.description.length > 100);
});

test('document.title supplies title and company when the DOM has no header', () => {
  withPage(
    `<!doctype html><html><head><title>Staff Platform Engineer | Globex | LinkedIn</title></head>
     <body><div id="job-details">${'Build the platform. '.repeat(40)}</div></body></html>`,
    'https://www.linkedin.com/jobs/view/999/'
  );
  const job = scrapeJobFromDocument();
  assert.equal(job.title, 'Staff Platform Engineer');
  assert.equal(job.company, 'Globex');
  assert.equal(job.via.title, 'document.title');
});

test('greenhouse and lever postings resolve through their own selectors', () => {
  withPage(
    `<!doctype html><html><head><title>Jobs</title></head><body>
      <h1 class="app-title">Staff Backend Engineer</h1>
      <span class="company-name">Initech</span>
      <div id="content">${'Own the billing service. '.repeat(40)}</div>
     </body></html>`,
    'https://boards.greenhouse.io/initech/jobs/42'
  );
  let job = scrapeJobFromDocument();
  assert.equal(job.title, 'Staff Backend Engineer');
  assert.equal(job.company, 'Initech');

  withPage(
    `<!doctype html><html><head><title>Jobs</title></head><body>
      <div class="posting-headline"><h2>Principal Data Engineer</h2></div>
      <div class="main-header-logo"><img alt="Hooli" /></div>
      <div class="posting-page">${'Model the warehouse. '.repeat(40)}</div>
     </body></html>`,
    'https://jobs.lever.co/hooli/abc'
  );
  job = scrapeJobFromDocument();
  assert.equal(job.title, 'Principal Data Engineer');
  // Lever puts the company name only in the header logo's alt text.
  assert.equal(job.company, 'Hooli');
});

// ── The injection contract ───────────────────────────────────────────────────

test('the MINIFIED scraper still works after a toString round-trip', () => {
  // If a minifier hoists any helper out of the function body, the serialized
  // source references an identifier that does not exist in the page and this
  // throws ReferenceError. Calling the function normally would NOT catch it.
  withPage(LINKEDIN_PAGE, 'https://www.linkedin.com/jobs/view/123/');
  const job = injectedScraper();
  assert.equal(job.title, 'Staff Software Engineer');
  assert.equal(job.company, 'Acme Corp');
  assert.match(job.description, /Kubernetes and Go/);
});

test('the scraper source names no bundle-local identifier', () => {
  // A structural guard to go with the behavioural one above: the serialized
  // function must not mention the module-level exports it ships beside.
  const src = injectedScraper.toString();
  for (const name of ['mergeScrapes', 'scrapeQuality']) {
    assert.ok(!src.includes(name), `injected source references ${name}`);
  }
});

// ── Merging two scrapes of the same page ─────────────────────────────────────

test('a longer description cannot drag a worse title along with it', () => {
  // The exact shape of the old bug: the merge asked "is B's description
  // longer?" and, if so, took B's title too.
  const fromHeader = {
    title: 'Staff Software Engineer',
    company: 'Acme Corp',
    description: 'short but correct',
    via: { title: '.job-details-jobs-unified-top-card__job-title', company: '.c', description: '#job-details' },
  };
  const fromGenericH1 = {
    title: 'Jobs',
    company: '',
    description: 'a much longer description '.repeat(50),
    via: { title: 'h1', company: '', description: '#job-details' },
  };

  const merged = mergeScrapes(fromHeader, fromGenericH1);
  assert.equal(merged.title, 'Staff Software Engineer', 'title followed the longer description');
  assert.equal(merged.company, 'Acme Corp');
  assert.equal(merged.description, fromGenericH1.description, 'the longer description should win on its own merit');
});

test('a body-scraped description loses to a shorter one from a real container', () => {
  const specific = {
    title: 'Staff Engineer',
    description: 'x'.repeat(600),
    via: { title: '.t', company: '', description: '#job-details' },
  };
  const fromBody = {
    title: 'Staff Engineer',
    description: 'x'.repeat(8000),
    via: { title: '.t', company: '', description: 'body' },
  };
  const merged = mergeScrapes(specific, fromBody);
  assert.equal(merged.description.length, 600, 'whole-page text beat the posting container');
});

test('merging tolerates a missing side', () => {
  assert.deepEqual(mergeScrapes(null, null), {});
  assert.equal(mergeScrapes({ title: 'A' }, null).title, 'A');
  assert.equal(mergeScrapes(null, { title: 'B' }).title, 'B');
});

test('quality ranks a named selector above an h1 above the browser tab', () => {
  const rank = (via) => scrapeQuality({ title: 'T', description: 'x'.repeat(500), via }).titleRank;
  assert.ok(rank({ title: '.job-details-jobs-unified-top-card__job-title' }) > rank({ title: 'h1' }));
  assert.ok(rank({ title: 'h1' }) > rank({ title: 'document.title' }));
  assert.equal(scrapeQuality({ title: '', via: {} }).titleRank, 0);
});

test('an Ashby posting gets its company from the "Role @ Company" tab title', () => {
  // Every Solace tailoring was saved with no company because the title was
  // only split on | · – —, and Ashby writes "Staff Software Engineer @ Solace".
  withPage(
    `<!doctype html><html><head><title>Staff Software Engineer @ Solace</title></head>
     <body><h1>Staff Software Engineer</h1><div class="job-description">${'Own the platform. '.repeat(40)}</div></body></html>`,
    'https://jobs.ashbyhq.com/solace/87748158-42b6-4c55-91ca-8f3d95799ee9'
  );
  const job = scrapeJobFromDocument();
  assert.equal(job.title, 'Staff Software Engineer');
  assert.equal(job.company, 'Solace');
});

test('og:site_name is the last resort for a company name', () => {
  withPage(
    `<!doctype html><html><head><title>Careers</title><meta property="og:site_name" content="Northwind"></head>
     <body><h1>Platform Engineer</h1><div class="job-description">${'Build things. '.repeat(40)}</div></body></html>`,
    'https://careers.northwind.example/jobs/1'
  );
  assert.equal(scrapeJobFromDocument().company, 'Northwind');
});
