/**
 * Loads the SHIPPED dist/content.js into a jsdom page and runs it.
 *
 * The unit tests exercise the scraper's source. This exercises the artifact
 * Chrome actually loads, which is the only thing that catches the failure mode
 * the build split exists for: a top-level `import` in a classic content script
 * throws before the first statement and the whole content script is dead on
 * every page — no overlay, no autofill, no job detection, and nothing in the
 * extension's own logs to say why.
 *
 * Requires a prior `npm run build`; `npm test` chains them.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = resolve(root, 'dist/content.js');

let bundleSource;

before(() => {
  assert.ok(existsSync(BUNDLE), 'dist/content.js is missing — run `npm run build` first');
  bundleSource = readFileSync(BUNDLE, 'utf8');
});

const LINKEDIN_PAGE = `<!doctype html><html><head><title>(3) Staff Software Engineer | Acme Corp | LinkedIn</title></head>
<body>
  <h1 class="visually-hidden">Jobs</h1>
  <aside class="jobs-search-results-list">
    <ul>
      <li><a class="job-card-container__link"><strong>Senior Software Engineer</strong></a></li>
    </ul>
  </aside>
  <main>
    <div class="job-view-layout">
      <div class="job-details-jobs-unified-top-card__job-title"><h1><a>Staff Software Engineer</a></h1></div>
      <div class="job-details-jobs-unified-top-card__company-name"><a href="/company/acme">Acme Corp</a></div>
      <div id="job-details">
        <p>About the job</p>
        <ul>
          <li>Own architecture across several teams</li>
          <li>8+ years of professional software engineering experience</li>
          <li>Deep experience with Kubernetes and Go</li>
        </ul>
      </div>
    </div>
  </main>
</body></html>`;

/** State captured from the stubbed extension APIs. */
let harness;

/**
 * Boots a page with a stubbed `chrome` namespace and evaluates the bundle in
 * it, exactly as Chrome would for a content script.
 */
function bootBundle({ html = LINKEDIN_PAGE, url = 'https://www.linkedin.com/jobs/view/4321/' } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;

  const store = {};
  const sets = [];
  const removes = [];
  const sent = [];
  const messageListeners = [];
  const errors = [];

  window.addEventListener('error', (e) => errors.push(e.error || e.message));

  const storageArea = () => ({
    get: async (keys) => {
      const names = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || {});
      const out = {};
      for (const k of names) if (k in store) out[k] = store[k];
      return out;
    },
    set: async (obj) => {
      sets.push(JSON.parse(JSON.stringify(obj)));
      Object.assign(store, obj);
    },
    remove: async (keys) => {
      const names = typeof keys === 'string' ? [keys] : keys;
      removes.push(names);
      for (const k of names) delete store[k];
    },
  });

  window.chrome = {
    runtime: {
      id: 'test-extension-id',
      getURL: (p) => `chrome-extension://test-extension-id/${p}`,
      sendMessage: async (msg) => {
        sent.push(msg);
        // Unauthenticated: the content script must cope with this.
        if (msg?.type === 'CHECK_AUTH') return { isAuthenticated: false };
        if (msg?.type === 'GET_SAVED_ANSWERS') return { answers: {} };
        return {};
      },
      onMessage: { addListener: (fn) => messageListeners.push(fn) },
      lastError: null,
    },
    storage: { local: storageArea(), sync: storageArea(), onChanged: { addListener: () => {} } },
  };

  harness = { dom, window, store, sets, removes, sent, messageListeners, errors };

  // `runScripts: 'outside-only'` means this is the only script that runs, and
  // it runs with the window as its global — the content-script contract.
  window.eval(bundleSource);
  return harness;
}

/** Polls until `fn()` returns truthy, or gives up. Avoids guessing at timers. */
async function waitFor(fn, { timeout = 4000, interval = 25 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = fn();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, interval));
  }
}

const storedJob = () => {
  for (let i = harness.sets.length - 1; i >= 0; i--) {
    if (harness.sets[i].currentJobInfo) return harness.sets[i].currentJobInfo;
  }
  return null;
};

beforeEach(() => {
  harness = null;
});

after(() => {
  if (harness?.dom) harness.dom.window.close();
});

// ── The build-split regression ──────────────────────────────────────────────

test('the shipped bundle evaluates without throwing', () => {
  // If content.js carried a top-level import this throws SyntaxError here, and
  // in a real browser the content script would simply never run.
  assert.doesNotThrow(() => bootBundle());
});

test('the bundle contains no top-level import or export', () => {
  bootBundle();
  assert.ok(!/(^|\n)\s*import[\s{*'"]/.test(bundleSource), 'top-level import in content.js');
  assert.ok(!/(^|\n)\s*export[\s{*]/.test(bundleSource), 'top-level export in content.js');
});

test('it registers a message listener and reports no page errors', async () => {
  bootBundle();
  await waitFor(() => harness.messageListeners.length > 0);
  assert.ok(harness.messageListeners.length > 0, 'no chrome.runtime.onMessage listener registered');
  assert.deepEqual(harness.errors, [], `uncaught page errors: ${harness.errors.join(', ')}`);
});

// ── What it actually scrapes, from the real bundle ──────────────────────────

test('it stores the posting title, not the page h1 or a neighbouring card', async () => {
  bootBundle();
  const job = await waitFor(storedJob);
  assert.ok(job, 'the content script never stored any job info');
  assert.equal(job.title, 'Staff Software Engineer');
  assert.equal(job.company, 'Acme Corp');
});

test('the stored description carries the bulleted requirements', async () => {
  bootBundle();
  const job = await waitFor(() => {
    const j = storedJob();
    return j && j.description ? j : null;
  });
  assert.match(job.description, /8\+ years of professional software engineering experience/);
  assert.match(job.description, /Own architecture across several teams/);
  const bullets = job.description.split('\n').filter((l) => l.trim().startsWith('•'));
  assert.equal(bullets.length, 3, `expected 3 bulleted lines, got ${bullets.length}`);
});

test('the stored record says which page it came from', async () => {
  bootBundle();
  const job = await waitFor(storedJob);
  // `_url` is what lets every later reader reject a posting belonging to
  // another tab — storage is one slot shared by all of them.
  assert.equal(job._url, 'https://www.linkedin.com/jobs/view/4321/');
  assert.equal(typeof job._ts, 'number');
  const urlSet = harness.sets.find((s) => s.currentJobUrl);
  assert.equal(urlSet.currentJobUrl, 'https://www.linkedin.com/jobs/view/4321/');
});

test('GET_JOB_INFO answers from the live DOM', async () => {
  bootBundle();
  await waitFor(() => harness.messageListeners.length > 0);

  let answer = null;
  for (const listener of harness.messageListeners) {
    listener({ type: 'GET_JOB_INFO' }, {}, (response) => {
      if (response && (response.title || response.description)) answer = response;
    });
    if (answer) break;
  }

  assert.ok(answer, 'no listener answered GET_JOB_INFO');
  assert.equal(answer.title, 'Staff Software Engineer');
  assert.equal(answer.via.title, '.job-details-jobs-unified-top-card__job-title a');
});

// ── The stale-pane guard, in the shipped bundle ─────────────────────────────

test('a new URL showing the previous posting is not stored', async () => {
  bootBundle();
  const first = await waitFor(storedJob);
  assert.ok(first, 'nothing stored for the first posting');
  const countAfterFirst = harness.sets.filter((s) => s.currentJobInfo).length;

  // Click a different job card: the SPA changes the URL immediately while the
  // detail pane still shows the old posting. This is the race that filed one
  // posting's text under another posting's URL.
  harness.window.history.pushState({}, '', '/jobs/view/9999/');
  // Nudge the MutationObserver that watches for SPA navigation.
  harness.window.document.body.appendChild(harness.window.document.createElement('div'));

  // The nav handler's first read lands ~800ms later. Give it room, then check
  // that it did NOT store the unchanged pane under the new URL.
  await new Promise((r) => setTimeout(r, 1500));

  const storedForNewUrl = harness.sets
    .filter((s) => s.currentJobInfo)
    .slice(countAfterFirst)
    .filter((s) => s.currentJobInfo._url?.includes('9999'));

  assert.deepEqual(
    storedForNewUrl,
    [],
    'stale pane content was stored under the new URL — the fingerprint guard did not hold'
  );
});

test('once the pane really repaints, the new posting is stored', async () => {
  bootBundle();
  await waitFor(storedJob);

  harness.window.history.pushState({}, '', '/jobs/view/9999/');
  const doc = harness.window.document;
  doc.querySelector('.job-details-jobs-unified-top-card__job-title').innerHTML =
    '<h1><a>Principal Platform Engineer</a></h1>';
  doc.querySelector('#job-details').innerHTML =
    '<ul><li>Define platform strategy for the whole org</li><li>12+ years of experience</li></ul>';
  doc.body.appendChild(doc.createElement('div'));

  const updated = await waitFor(() => {
    const j = storedJob();
    return j && j.title === 'Principal Platform Engineer' ? j : null;
  });

  assert.ok(updated, 'the repainted posting was never stored');
  assert.equal(updated._url, 'https://www.linkedin.com/jobs/view/9999/');
  assert.match(updated.description, /Define platform strategy/);
});

// ── Non-job pages must not produce phantom jobs ─────────────────────────────

test('a LinkedIn profile page does not store the person’s name as a job', async () => {
  bootBundle({
    html: `<!doctype html><html><head><title>Ada Lovelace | LinkedIn</title></head>
           <body><h1>Ada Lovelace</h1><p>Senior Software Engineer at Acme</p></body></html>`,
    url: 'https://www.linkedin.com/in/adalovelace/',
  });

  await new Promise((r) => setTimeout(r, 1200));
  const job = storedJob();
  assert.ok(
    !job || !/Ada Lovelace/.test(job.title || ''),
    `stored a phantom job from a profile page: ${JSON.stringify(job)}`
  );
});
