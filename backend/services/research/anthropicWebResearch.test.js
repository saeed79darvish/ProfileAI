const test = require('node:test');
const assert = require('node:assert/strict');
const { researchViaAnthropicWebSearch, pageAgeToIso } = require('./anthropicWebResearch');

const NOW = new Date('2026-11-06T00:00:00Z');
const quiet = () => {};

const searchBlock = (urls, extra = {}) => ({
  type: 'web_search_tool_result', tool_use_id: 't',
  content: urls.map((u, i) => ({ type: 'web_search_result', url: u, title: `T${i}`, page_age: extra.page_age || 'September 1, 2026', encrypted_content: 'enc' })),
});
const textBlock = (text, citations) => ({ type: 'text', text, ...(citations ? { citations } : {}) });
const cite = (url, cited_text) => ({ type: 'web_search_result_location', url, title: 'c', cited_text, encrypted_index: 'i' });

const fakeClient = (responses, seen = []) => ({
  messages: {
    create: async (req) => {
      seen.push(req);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  },
});

const answer = (obj) => JSON.stringify(obj);
const U1 = 'https://www.reddit.com/r/cscareerquestions/a';
const U2 = 'https://leetcode.com/discuss/b';
const U3 = 'https://www.teamblind.com/post/c';

test('builds a cited payload; drops uncited and unknown-url items; recomputes frequency', async () => {
  const seen = [];
  const json = answer({
    summary: 'Candidates report a phone screen and an onsite.',
    timeline: { text: 'About three weeks end to end', sourceUrls: [U1] },
    rounds: [{ name: 'Phone screen', format: '45 min coding', notes: 'one problem', sourceUrls: [U1, U2] }, { name: 'Invented round', format: '', notes: '', sourceUrls: ['https://made.up/x'] }],
    tips: [{ text: 'Practice graphs', sourceUrls: [U2] }, { text: 'No source tip', sourceUrls: [] }],
    questions: [
      { text: 'Design a rate limiter', category: 'system_design', sourceUrls: [U1, U2, U1] },
      { text: 'Uncited question about trees', category: 'coding', sourceUrls: [] },
      { text: 'Question citing a made up url', category: 'coding', sourceUrls: [U3, 'https://made.up/y'] },
      { text: 'Tell me about a failure', category: 'behavioral', sourceUrls: [U3] },
    ],
    topics: [{ name: 'Caching', why: 'came up twice', sourceUrls: [U1] }, { name: 'Ghost topic', why: 'x', sourceUrls: ['https://made.up/z'] }],
  });
  const client = fakeClient([{
    stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 20, server_tool_use: { web_search_requests: 2 } },
    content: [
      { type: 'server_tool_use', id: 't', name: 'web_search', input: { query: 'q' } },
      searchBlock([U1, U2, U3]),
      textBlock(json, [cite(U1, 'x'.repeat(500))]),
    ],
  }], seen);
  const p = await researchViaAnthropicWebSearch({ company: 'Acme', jobTitle: 'Engineer', client, now: NOW, log: quiet });

  assert.deepEqual(p.questions.map((q) => q.text), ['Design a rate limiter', 'Tell me about a failure']);
  assert.equal(p.questions[0].frequency, 2);
  assert.equal(p.process.rounds.length, 1);
  assert.equal(p.process.rounds[0].sourceIds.length, 2);
  assert.equal(p.process.tips.length, 1);
  assert.equal(p.topics.length, 1);
  assert.equal(p.process.timeline, 'About three weeks end to end');
  assert.equal(p.coverage, 'thin');
  assert.ok(p.sources.every((s) => s.excerpt.length <= 300));
  assert.ok(p.sources.some((s) => s.site === 'reddit.com' && s.excerpt.length === 300));
  assert.ok(p.sources.every((s) => !('encrypted_content' in s)));
  // request shape: server tool, no temperature, no domain filters
  assert.equal(seen[0].model, 'claude-sonnet-5-5');
  assert.equal(seen[0].temperature, undefined);
  assert.equal(seen[0].tools[0].type, 'web_search_20260209');
  assert.equal(seen[0].tools[0].max_uses, 8);
  assert.equal(seen[0].tools[0].allowed_domains, undefined);
});

test('search error object (HTTP 200) is not indexed blindly; nothing cited means coverage none', async () => {
  const client = fakeClient([{
    stop_reason: 'end_turn', usage: {},
    content: [
      { type: 'web_search_tool_result', tool_use_id: 't', content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' } },
      textBlock(answer({ summary: 'x', questions: [{ text: 'Some question text here', category: 'coding', sourceUrls: [U1] }] })),
    ],
  }]);
  const p = await researchViaAnthropicWebSearch({ company: 'Acme', jobTitle: 'Engineer', client, now: NOW, log: quiet });
  assert.equal(p.coverage, 'none');
  assert.deepEqual(p.questions, []);
  assert.deepEqual(p.sources, []);
});

test('pause_turn continues with the assistant content, at most 3 times', async () => {
  const seen = [];
  const pause = (n) => ({ stop_reason: 'pause_turn', usage: {}, content: [searchBlock([`https://reddit.com/r/${n}`])] });
  const final = { stop_reason: 'end_turn', usage: {}, content: [textBlock(answer({ summary: 's', questions: [{ text: 'Explain how indexes work', category: 'coding', sourceUrls: ['https://reddit.com/r/1'] }] }))] };
  const client = fakeClient([pause(1), pause(2), final], seen);
  const p = await researchViaAnthropicWebSearch({ company: 'Acme', jobTitle: 'Engineer', client, now: NOW, log: quiet, targeted: false });
  assert.equal(seen.length, 3);
  assert.equal(seen[1].messages[1].role, 'assistant');
  assert.equal(p.questions.length, 1);

  // never more than 4 calls total
  const seen2 = [];
  const endless = fakeClient([pause(1), pause(2), pause(3), pause(4), pause(5)], seen2);
  await assert.rejects(researchViaAnthropicWebSearch({ company: 'A', jobTitle: 'B', client: endless, now: NOW, log: quiet, targeted: false }), { code: 'model_failed' });
  assert.equal(seen2.length, 4);
});

test('refusal gives coverage none', async () => {
  const client = fakeClient([{ stop_reason: 'refusal', usage: {}, content: [] }]);
  const p = await researchViaAnthropicWebSearch({ company: 'Acme', jobTitle: 'Engineer', client, now: NOW, log: quiet });
  assert.equal(p.coverage, 'none');
});

test('falls back once to the older tool type on a 400 about the tool', async () => {
  const seen = [];
  const err = Object.assign(new Error('tools.0: web_search_20260209 is not supported for this model'), { status: 400 });
  const client = fakeClient([err, { stop_reason: 'end_turn', usage: {}, content: [searchBlock([U1]), textBlock(answer({ summary: 's', questions: [] }))] }], seen);
  const p = await researchViaAnthropicWebSearch({ company: 'Acme', jobTitle: 'Engineer', client, now: NOW, log: quiet, targeted: false });
  assert.equal(seen[1].tools[0].type, 'web_search_20250305');
  assert.equal(p.coverage, 'none');
});

test('sources older than 24 months are not citable', async () => {
  const client = fakeClient([{
    stop_reason: 'end_turn', usage: {},
    content: [searchBlock([U1], { page_age: 'January 3, 2024' }), textBlock(answer({ summary: 's', questions: [{ text: 'Old question about sorting', category: 'coding', sourceUrls: [U1] }] }))],
  }]);
  const p = await researchViaAnthropicWebSearch({ company: 'Acme', jobTitle: 'Engineer', client, now: NOW, log: quiet });
  assert.deepEqual(p.questions, []);
});

test('unreadable answer fails the run', async () => {
  const client = fakeClient([{ stop_reason: 'end_turn', usage: {}, content: [textBlock('no json here')] }]);
  await assert.rejects(researchViaAnthropicWebSearch({ company: 'A', jobTitle: 'B', client, now: NOW, log: quiet }), { code: 'model_failed' });
});

test('dates and notes the model read on the pages fill undated sources; bad or old dates do not', async () => {
  const undated = (urls) => ({ type: 'web_search_tool_result', tool_use_id: 't', content: urls.map((u) => ({ type: 'web_search_result', url: u, title: 'T', page_age: null, encrypted_content: 'e' })) });
  const client = fakeClient([{
    stop_reason: 'end_turn', usage: {},
    content: [undated([U1, U2, U3]), textBlock(answer({
      summary: 's',
      questions: [
        { text: 'Design a rate limiter', category: 'system_design', sourceUrls: [U1] },
        { text: 'Question from an old post', category: 'coding', sourceUrls: [U2] },
        { text: 'Tell me about a failure', category: 'behavioral', sourceUrls: [U3] },
      ],
      sources: [
        { url: U1, postedOn: '2026-09-14', note: 'Candidate describes a rate limiter design round.' },
        { url: U2, postedOn: '2024-01-02', note: 'Old.' },
        { url: U3, postedOn: '2027-05-01', note: 'Future date is ignored.' },
        { url: 'https://made.up/q', postedOn: '2026-10-01', note: 'unknown source' },
      ],
    }))],
  }]);
  const p = await researchViaAnthropicWebSearch({ company: 'Acme', jobTitle: 'Engineer', client, now: NOW, log: quiet });
  const byUrl = Object.fromEntries(p.sources.map((s) => [s.url, s]));
  assert.equal(byUrl[U1].date.slice(0, 10), '2026-09-14');
  assert.match(byUrl[U1].excerpt, /rate limiter/);
  assert.equal(byUrl[U2], undefined); // older than the window: its question is dropped
  assert.equal(byUrl[U3].date, null); // a future date is not trusted
  assert.deepEqual(p.questions.map((q) => q.text).sort(), ['Design a rate limiter', 'Tell me about a failure']);
});

test('page_age in relative words becomes a date, so the 24 month window holds', async () => {
  assert.equal(pageAgeToIso('73 days ago', NOW).slice(0, 10), '2026-08-25');
  assert.equal(pageAgeToIso('2 weeks ago', NOW).slice(0, 10), '2026-10-23');
  assert.equal(pageAgeToIso('April 30, 2026', NOW).slice(0, 10), '2026-04-30');
  assert.equal(pageAgeToIso('', NOW), null);
  assert.equal(pageAgeToIso('sometime', NOW), null);
  const client = fakeClient([{
    stop_reason: 'end_turn', usage: {},
    content: [searchBlock([U1], { page_age: '800 days ago' }), textBlock(answer({ summary: 's', questions: [{ text: 'Question from an old post', category: 'coding', sourceUrls: [U1] }] }))],
  }]);
  const p = await researchViaAnthropicWebSearch({ company: 'Acme', jobTitle: 'Engineer', client, now: NOW, log: quiet });
  assert.deepEqual(p.questions, []);
});

test('a targeted pass on Reddit and friends is merged in, with allowed_domains set', async () => {
  const R = 'https://www.reddit.com/r/ExperiencedDevs/comments/x';
  const seen = [];
  const client = { messages: { create: async (req) => {
    seen.push(req.tools[0]);
    const targeted = !!req.tools[0].allowed_domains;
    return { stop_reason: 'end_turn', usage: {}, content: targeted
      ? [searchBlock([R]), textBlock(answer({ summary: '', questions: [{ text: 'Walk me through a time you shipped under pressure', category: 'behavioral', sourceUrls: [R] }] }))]
      : [searchBlock([U1]), textBlock(answer({ summary: 'broad', questions: [{ text: 'Design a rate limiter', category: 'system_design', sourceUrls: [U1] }] }))] };
  } } };
  const p = await researchViaAnthropicWebSearch({ company: 'Acme', jobTitle: 'Engineer', client, now: NOW, log: quiet });
  assert.equal(seen.length, 2);
  assert.ok(seen.some((t) => Array.isArray(t.allowed_domains) && t.allowed_domains.includes('leetcode.com')));
  assert.deepEqual(p.questions.map((q) => q.text).sort(), ['Design a rate limiter', 'Walk me through a time you shipped under pressure']);
  assert.equal(p.summary.includes('broad'), true);
});

test('if the targeted pass fails, the broad answer still stands', async () => {
  const client = { messages: { create: async (req) => {
    if (req.tools[0].allowed_domains) throw new Error('boom');
    return { stop_reason: 'end_turn', usage: {}, content: [searchBlock([U1]), textBlock(answer({ summary: 's', questions: [{ text: 'Design a rate limiter', category: 'system_design', sourceUrls: [U1] }] }))] };
  } } };
  const p = await researchViaAnthropicWebSearch({ company: 'Acme', jobTitle: 'Engineer', client, now: NOW, log: quiet });
  assert.equal(p.questions.length, 1);
});

test('a site the crawler cannot read is dropped and the targeted pass retries without it', async () => {
  const calls = [];
  const client = { messages: { create: async (req) => {
    const d = req.tools[0].allowed_domains;
    calls.push(d);
    if (d && d.includes('leetcode.com')) throw Object.assign(new Error("400 The following domains are not accessible to our user agent: ['leetcode.com']."), { status: 400 });
    return { stop_reason: 'end_turn', usage: {}, content: [searchBlock([U1]), textBlock(answer({ summary: 's', questions: [{ text: 'Design a rate limiter', category: 'system_design', sourceUrls: [U1] }] }))] };
  } } };
  const p = await researchViaAnthropicWebSearch({ company: 'Acme', jobTitle: 'Engineer', client, now: NOW, log: quiet });
  assert.equal(p.questions.length, 1);
  const targetedCalls = calls.filter(Boolean);
  assert.equal(targetedCalls.length, 2);
  assert.ok(!targetedCalls[1].includes('leetcode.com'));
});
