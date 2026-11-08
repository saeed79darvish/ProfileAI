const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createTavily, createExa, resolveProviderName, getSearch, isSearchConfigured,
} = require('./searchProvider');

const jsonRes = (status, body) => ({ status, ok: status < 400, json: async () => body });

test('tavily: request shape and response normalization', async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, body: JSON.parse(init.body) };
    return jsonRes(200, { results: [
      { title: ' T ', url: 'https://www.reddit.com/r/x/1', content: 'a   b\n c', published_date: '2026-03-01' },
      { title: 'No date', url: 'https://example.com/p', content: 'z' },
      { title: 'no url' },
    ] });
  };
  const out = await createTavily({ apiKey: 'k', fetchImpl }).search({ query: 'q', includeDomains: ['reddit.com'], days: 365, maxResults: 5 });
  assert.equal(seen.url, 'https://api.tavily.com/search');
  assert.deepEqual(seen.body, { api_key: 'k', query: 'q', search_depth: 'advanced', max_results: 5, include_raw_content: false, days: 365, include_domains: ['reddit.com'] });
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { title: 'T', url: 'https://www.reddit.com/r/x/1', site: 'reddit.com', publishedAt: '2026-03-01T00:00:00.000Z', content: 'a b c' });
  assert.equal(out[1].publishedAt, null);
});

test('exa: request shape and response normalization', async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, headers: init.headers, body: JSON.parse(init.body) };
    return jsonRes(200, { results: [{ title: 'E', url: 'https://leetcode.com/discuss/1', publishedDate: '2026-02-02T00:00:00.000Z', text: 'hello  world' }] });
  };
  const now = () => Date.parse('2026-11-06T00:00:00Z');
  const out = await createExa({ apiKey: 'ek', fetchImpl, now }).search({ query: 'q', includeDomains: ['leetcode.com'], days: 365, maxResults: 3 });
  assert.equal(seen.url, 'https://api.exa.ai/search');
  assert.equal(seen.headers['x-api-key'], 'ek');
  assert.equal(seen.body.useAutoprompt, true);
  assert.equal(seen.body.numResults, 3);
  assert.deepEqual(seen.body.includeDomains, ['leetcode.com']);
  assert.equal(seen.body.startPublishedDate, '2025-11-06T00:00:00.000Z');
  assert.ok(seen.body.contents.text.maxCharacters > 0);
  assert.deepEqual(out, [{ title: 'E', url: 'https://leetcode.com/discuss/1', site: 'leetcode.com', publishedAt: '2026-02-02T00:00:00.000Z', content: 'hello world' }]);
});

test('retries once on 5xx, not on 4xx', async () => {
  let calls = 0;
  const flaky = async () => { calls += 1; return calls === 1 ? jsonRes(503, {}) : jsonRes(200, { results: [] }); };
  assert.deepEqual(await createTavily({ apiKey: 'k', fetchImpl: flaky }).search({ query: 'q' }), []);
  assert.equal(calls, 2);

  calls = 0;
  const always5 = async () => { calls += 1; return jsonRes(500, {}); };
  await assert.rejects(createTavily({ apiKey: 'k', fetchImpl: always5 }).search({ query: 'q' }), { code: 'search_failed' });
  assert.equal(calls, 2);

  calls = 0;
  const bad = async () => { calls += 1; return jsonRes(401, {}); };
  await assert.rejects(createTavily({ apiKey: 'k', fetchImpl: bad }).search({ query: 'q' }), { code: 'search_failed' });
  assert.equal(calls, 1);
});

test('times out a hung request', async () => {
  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  await assert.rejects(createTavily({ apiKey: 'k', fetchImpl: hang, timeoutMs: 10 }).search({ query: 'q' }), { code: 'search_failed' });
});

test('provider selection and search_not_configured', () => {
  assert.throws(() => resolveProviderName({}), { code: 'search_not_configured', status: 503 });
  assert.equal(resolveProviderName({ ANTHROPIC_API_KEY: 'a' }), 'anthropic');
  assert.equal(resolveProviderName({ ANTHROPIC_API_KEY: 'a', EXA_API_KEY: 'e' }), 'exa');
  assert.equal(resolveProviderName({ ANTHROPIC_API_KEY: 'a', EXA_API_KEY: 'e', TAVILY_API_KEY: 't' }), 'tavily');
  assert.equal(resolveProviderName({ ANTHROPIC_API_KEY: 'a', TAVILY_API_KEY: 't', SEARCH_PROVIDER: 'anthropic' }), 'anthropic');
  assert.throws(() => resolveProviderName({ SEARCH_PROVIDER: 'exa', TAVILY_API_KEY: 't' }), { code: 'search_not_configured' });
  assert.throws(() => getSearch({ SEARCH_PROVIDER: 'tavily' }), { code: 'search_not_configured' });
  assert.equal(isSearchConfigured({ TAVILY_API_KEY: 't' }), true);
  assert.equal(isSearchConfigured({}), false);
});

test('forum searches ask for the whole page and use it instead of the snippet', async () => {
  let seen;
  const long = 'I was asked about rate limiters and a take home. '.repeat(400);
  const fetchImpl = async (url, init) => {
    seen = JSON.parse(init.body);
    return jsonRes(200, { results: [{ title: 'Acme interview', url: 'https://www.reddit.com/r/x/1', content: 'short snippet', raw_content: long }] });
  };
  const out = await createTavily({ apiKey: 'k', fetchImpl }).search({ query: 'q', includeDomains: ['reddit.com'], fullText: true });
  assert.equal(seen.include_raw_content, true);
  assert.match(out[0].content, /rate limiters/);
  assert.ok(out[0].content.length <= 8000 && out[0].content.length > 2000);

  const exaSeen = [];
  const exaFetch = async (url, init) => { exaSeen.push(JSON.parse(init.body)); return jsonRes(200, { results: [] }); };
  const exa = createExa({ apiKey: 'k', fetchImpl: exaFetch });
  await exa.search({ query: 'q' });
  await exa.search({ query: 'q', fullText: true });
  assert.equal(exaSeen[0].contents.text.maxCharacters, 2000);
  assert.equal(exaSeen[1].contents.text.maxCharacters, 8000);
});
