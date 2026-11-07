const test = require('node:test');
const assert = require('node:assert/strict');
const { suggestTopics, writeStory, cleanTopics, cleanStory, plain, cleanQuestions, answersToDetails } = require('./interviewStoriesService');

const prep = { company: 'Acme', role: 'Engineer', topics: [{ name: 'Scale', why: 'w' }], questions: [{ text: 'Tell me about scaling', category: 'behavioral' }] };
const profile = { title: 'Engineer', experience: [{ company: 'Equinix', title: 'SRE', description: 'Rebuilt the billing queue' }] };
const ref = { company: 'Equinix', role: 'SRE', period: '2020', project: 'Billing queue' };
const t = (title, r = ref) => ({ title, angle: 'a', experienceRef: r });
const goodTopic = (theme) => ({ theme, why: 'w', questions: ['q1', 'q2', 'q3', 'q4'], titles: [t('One'), t('Two'), t('Three')] });

test('suggestTopics keeps topics with exactly three grounded titles and regenerates ids', async () => {
  const calls = [];
  const out = await suggestTopics({
    prep, profile,
    runModel: async (a) => { calls.push(a); return JSON.stringify({ topics: [goodTopic('Scaling'), goodTopic('Ambiguity'), goodTopic('Third')] }); },
  });
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 't1');
  assert.deepEqual(out[1].titles.map((x) => x.id), ['t2a', 't2b', 't2c']);
  assert.equal(out[0].questions.length, 3);
  assert.ok(!('temperature' in calls[0]));
  assert.equal(calls[0].maxTokens, 2500);
});

test('ungrounded titles are dropped and a topic below three is dropped', () => {
  const topics = cleanTopics({ topics: [
    { theme: 'A', titles: [t('One'), t('Two'), t('Three', {})] },
    { theme: 'B', titles: [t('One'), t('Two'), t('Three'), t('Four', {})] },
  ] });
  assert.equal(topics.length, 1);
  assert.equal(topics[0].theme, 'B');
  assert.equal(topics[0].titles.length, 3);
});

test('suggestTopics repairs truncated JSON and errors when nothing valid', async () => {
  const full = JSON.stringify({ topics: [goodTopic('Scaling')] });
  const out = await suggestTopics({ prep, profile, runModel: async () => full.slice(0, -2) });
  assert.equal(out.length, 1);
  await assert.rejects(suggestTopics({ prep, profile, runModel: async () => 'nope' }), (e) => e.status === 502);
  await assert.rejects(suggestTopics({ prep, profile: {}, runModel: async () => '' }), (e) => e.status === 422);
});

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

test('writeStory adds needsYou for every placeholder and strips dashes and arrows', async () => {
  const spoken = `I cut costs by [your number] percent — it worked -> well. ${words(100)} Then [what happened next].`;
  const calls = [];
  const s = await writeStory({
    prep, profile, theme: 'Scaling', title: 'The billing queue', experienceRef: ref,
    runModel: async (a) => { calls.push(a); return JSON.stringify({ spoken, beats: [{ label: 'The situation', text: 'x — y' }], tips: ['Slow down'], needsYou: ['Your number for the cost cut'] }); },
  });
  assert.ok(!/[—–→]|->/.test(JSON.stringify(s)));
  assert.equal(s.needsYou.length, 2);
  assert.ok(s.needsYou.some((n) => n.includes('what happened next')));
  assert.ok(!('temperature' in calls[0]));
  assert.equal(calls[0].maxTokens, 1800);
  assert.match(calls[0].system, /FACT RULES/);
});

test('writeStory repairs truncated JSON, rejects empty story', async () => {
  const body = JSON.stringify({ spoken: words(120), beats: [], tips: [], needsYou: [] });
  const s = await writeStory({ prep, profile, theme: 'x', title: 'y', experienceRef: ref, runModel: async () => body.slice(0, -1) });
  assert.ok(s.spoken.length > 100);
  await assert.rejects(writeStory({ prep, profile, theme: 'x', title: 'y', experienceRef: ref, runModel: async () => '{"spoken":"short"}' }), (e) => e.status === 502);
});

test('plain replaces em dashes and arrows', () => {
  assert.equal(plain('a — b'), 'a, b');
  assert.ok(!plain('a → b ---> c').match(/→|->/));
});

test('a placeholder the model already explained, with different punctuation, is not explained twice', () => {
  const spoken = 'I led the project at the company and it went well for everyone involved in the work. We shipped on time and the team was happy with how it turned out in the end. Before we started, the pages were slow and people noticed it every single day. I split the code into smaller pieces and added caching so repeat visits were fast. Then I walked the other engineers through each change so they could carry it on. [What happened next, like fewer complaints.] That is the part I would say next, in my own words, with a real example.';
  const out = cleanStory({ spoken, beats: [], tips: [], needsYou: ['[What happened next, like fewer complaints]: the real result people saw.'] });
  assert.equal(out.needsYou.length, 1);
});

test('a long theme is kept whole, not cut in the middle of a word', () => {
  const theme = "Real-time collaborative editing and the 'why' behind TypeScript and React decisions";
  const title = (n) => ({ title: `Title number ${n} at Equinix`, angle: 'Shows judgment', experienceRef: { company: 'Equinix' } });
  const out = cleanTopics({ topics: [{ theme, why: 'Matters here', questions: [], titles: [title(1), title(2), title(3)] }] });
  assert.equal(out[0].theme, theme);
});

test('the candidate\'s own words reach the model as facts, and are left out when empty', async () => {
  const prompts = [];
  const runModel = async ({ prompt }) => { prompts.push(prompt); return JSON.stringify({ spoken: 'I was the lead on the project and the pages were slow for everyone who used them every day. I split the code into smaller pieces and added caching so repeat visits were fast. Then I walked the other engineers through each change so they could carry it on after I left. In the end, load time fell by 40 percent for the whole team and their customers, and people noticed it straight away. That is what I would bring to a product like yours, a habit of measuring first and fixing the biggest cost.', beats: [], tips: [], needsYou: [] }); };
  const base = { prep: { company: 'Acme', role: 'Engineer', topics: [], questions: [] }, profile: { title: 'Engineer', experience: [{ company: 'Equinix', title: 'Architect' }] }, theme: 'Performance', title: 'The slow billing pages at Equinix', experienceRef: { company: 'Equinix' }, runModel };
  await writeStory({ ...base, details: 'The real problem was that finance could not close the month. We cut load time by 40 percent.' });
  await writeStory({ ...base });
  assert.match(prompts[0], /The candidate's own words/);
  assert.match(prompts[0], /finance could not close the month/);
  assert.doesNotMatch(prompts[1], /The candidate's own words/);
});

test('questions are cleaned: capped at four, unique, too short ones dropped', () => {
  const out = cleanQuestions({ questions: [
    { question: 'What was the real problem you were solving?', hint: 'plain words' },
    { question: 'What was the real problem you were solving?', hint: 'duplicate' },
    { question: 'Why?' },
    { question: 'Which rendering approach did you use, and why?' },
    { question: 'What was the hardest part?' },
    { question: 'How did you measure the result?' },
    { question: 'A fifth question that should be dropped' },
  ] });
  assert.equal(out.length, 4);
  assert.deepEqual(out.map((q) => q.id), ['q1', 'q2', 'q3', 'q4']);
  assert.equal(answersToDetails([{ question: 'Q one here', answer: ' A real answer ' }, { question: 'Empty', answer: '' }]), 'Q: Q one here\nA: A real answer');
});
