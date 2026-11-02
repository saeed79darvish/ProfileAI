const test = require('node:test');
const assert = require('node:assert/strict');

const {
  structureDescription,
  needsAiSplit,
  isCurrent,
  applyAiSplit,
  plainTextFor,
  toBlocks,
  kindOfHeading,
  extractSalary,
  extractSchedule,
  extractExperience,
  extractFacts,
} = require('./jobDescriptionStructure');

const ROBLOX = {
  title: 'Software Engineer, Frontend - Economy',
  company: 'Roblox',
  location: 'San Mateo, CA',
  descriptionHtml: `
<p>Every day, tens of millions of people come to Roblox to explore, create, play, learn, and connect with friends. Roblox is a platform built by our community.</p>
<p><strong>About the Economy team</strong></p>
<p>Our Economy team owns the products and systems that power how creators earn. You’ll partner closely with product, design and data science.</p>
<h3>You Will</h3>
<ul><li>Build and ship polished experiences used by millions.</li><li>Create tools that help creators grow.</li><li>Write performant, accessible code.</li></ul>
<h3>You Have:</h3>
<ul>
<li>1-3 years of experience building web apps with React and TypeScript.</li>
<li>Bachelor’s degree in Computer Science or equivalent experience.</li>
<li>Bonus: experience with e-commerce or marketplaces.</li>
</ul>
<p>This role is based in our San Mateo office. We work onsite Tuesday, Wednesday and Thursday, with Monday and Friday optional.</p>
<p>The salary range for this position is $153,120 — $196,750 USD per year. You may also be eligible for equity.</p>
<p>Roblox provides equal employment opportunity for all applicants. See our <a href="https://roblox.com/privacy">privacy notice</a>.</p>
`,
};

test('headings become sections with display titles, and Bonus bullets move to nice to have', () => {
  const s = structureDescription(ROBLOX);
  const kinds = s.sections.map((x) => x.kind);
  assert.deepEqual(kinds, ['responsibilities', 'requirements', 'niceToHave', 'other']);
  // Prose after the last list is the posting's, not the nice-to-haves'.
  assert.equal(s.sections[3].title, 'More details');
  const req = s.sections.find((x) => x.kind === 'requirements');
  assert.equal(req.title, "What they're looking for");
  assert.equal(req.items.length, 2);
  const nice = s.sections.find((x) => x.kind === 'niceToHave');
  assert.deepEqual(nice.items, ['Experience with e-commerce or marketplaces.']);
  assert.equal(s.sections.find((x) => x.kind === 'responsibilities').items.length, 3);
});

test('company boilerplate, pay disclaimer and EEO are routed out of the role', () => {
  const s = structureDescription(ROBLOX);
  assert.equal(s.company.paragraphs.length, 1);
  assert.match(s.company.paragraphs[0], /^Every day/);
  assert.ok(s.legal.paragraphs.some((p) => /salary range/.test(p)));
  assert.ok(s.legal.paragraphs.some((p) => /equal employment/.test(p)));
  assert.deepEqual(s.legal.links, [{ label: 'privacy notice', href: 'https://roblox.com/privacy' }]);
  assert.match(s.summary, /^Our Economy team owns/);
});

test('facts: salary, schedule with optional days, experience, equity', () => {
  const { facts } = structureDescription(ROBLOX);
  assert.deepEqual(facts.salary, { min: 153120, max: 196750, currency: 'USD', period: 'year' });
  assert.equal(facts.schedule, 'Onsite Tue–Thu');
  assert.equal(facts.scheduleDetail, 'Onsite Tue, Wed, Thu · optional Mon & Fri');
  assert.equal(facts.experience, '1–3 years');
  assert.equal(facts.equity, true);
  assert.equal(facts.location, 'San Mateo, CA');
});

test('salary columns on the row win over text', () => {
  const facts = extractFacts('Pay $1 - $2', { salaryMin: 100000, salaryMax: 120000, salaryPeriod: 'yearly' });
  assert.deepEqual(facts.salary, { min: 100000, max: 120000, currency: 'USD', period: 'year' });
});

test('salary: k suffix, hourly, implausible ranges', () => {
  assert.deepEqual(extractSalary('Pay: $120k - $150k'), { min: 120000, max: 150000, currency: 'USD', period: 'year' });
  assert.deepEqual(extractSalary('$25 – $32 per hour'), { min: 25, max: 32, currency: 'USD', period: 'hour' });
  assert.equal(extractSalary('raised $10 - $20 million'), null);
  assert.equal(extractSalary('$515m in funding'), null);
});

test('equity in "diversity, equity and inclusion" is not equity comp', () => {
  assert.equal(extractFacts('We value diversity, equity and inclusion.').equity, undefined);
  assert.equal(extractFacts('Competitive salary and equity.').equity, true);
});

test('schedule: day ranges and days per week', () => {
  assert.equal(extractSchedule('You will be in the office Monday through Thursday.').label, 'Onsite Mon–Thu');
  assert.equal(extractSchedule('We work in office 3 days a week.').label, 'In office 3 days/wk');
  assert.equal(extractSchedule('Fully remote.'), null);
});

test('experience ignores ages and company history', () => {
  assert.equal(extractExperience('Must be 18 years of age'), null);
  assert.equal(extractExperience('Founded 10 years ago. 5+ years of experience in Go.'), '5+ years');
  assert.equal(extractExperience('3 - 5 years experience'), '3–5 years');
});

test('heading kinds, including curly apostrophes and order of precedence', () => {
  assert.equal(kindOfHeading('WHAT YOU’LL DO'), 'responsibilities');
  assert.equal(kindOfHeading('Preferred Qualifications'), 'niceToHave');
  assert.equal(kindOfHeading('Basic Qualifications'), 'requirements');
  assert.equal(kindOfHeading('About the role'), 'team');
  assert.equal(kindOfHeading('About Roblox', 'Roblox'), 'company');
  assert.equal(kindOfHeading('Pay Transparency'), 'legal');
});

test('blocks: Greenhouse entity-encoded markup, <br> bullets, nested spans', () => {
  const blocks = toBlocks('&lt;p&gt;&lt;strong&gt;Responsibilities:&lt;/strong&gt;&lt;/p&gt;&lt;ul&gt;&lt;li&gt;&lt;span&gt;Ship&lt;/span&gt; it&lt;/li&gt;&lt;/ul&gt;');
  assert.deepEqual(blocks.map((b) => [b.type, b.text]), [['p', 'Responsibilities:'], ['li', 'Ship it']]);
  const amazon = toBlocks('Key job responsibilities<br/>• Design systems<br/>• Review code<br/>');
  assert.deepEqual(amazon.map((b) => [b.type, b.text]), [['p', 'Key job responsibilities'], ['li', 'Design systems'], ['li', 'Review code']]);
  assert.deepEqual(toBlocks('<p>Apply now.</p><p>#LI-CT4 #LI-Hybrid</p>').map((b) => b.text), ['Apply now.']);
});

test('a run-on posting with no headings asks for the AI split', () => {
  const blob = { title: 'Engineer', company: 'Acme', description: `${'We build things for customers every day and you will help. '.repeat(20)}` };
  assert.equal(needsAiSplit(structureDescription(blob)), true);
  assert.equal(needsAiSplit(structureDescription(ROBLOX)), false);
});

test('cache is current until the source text changes, and survives compaction', () => {
  const s = structureDescription(ROBLOX);
  assert.equal(isCurrent(s, ROBLOX), true);
  assert.equal(isCurrent(s, { ...ROBLOX, descriptionHtml: `${ROBLOX.descriptionHtml}<p>new</p>` }), false);
  assert.equal(isCurrent(s, { ...ROBLOX, descriptionHtml: null }), true);
});

test('AI split cuts the posting at verbatim anchors and never rewrites it', () => {
  const job = {
    title: 'Senior Solutions Engineer',
    company: 'Acme',
    description: 'Role Overview As an engineer you will talk to customers daily. Key Responsibilities Work closely with IT on hardware. Provide detailed specifications for solutions. Required Qualifications A degree in Computer Science. 7-10 years of hands-on experience.',
  };
  const text = plainTextFor(job);
  const out = applyAiSplit({
    summary: 'A customer-facing engineering role.',
    sections: [
      { kind: 'team', heading: 'Role Overview', format: 'paragraphs', starts: ['As an engineer you will talk'] },
      { kind: 'responsibilities', heading: 'Key Responsibilities', format: 'items', starts: ['Work closely with IT on', 'Provide detailed specifications for solutions'] },
      { kind: 'requirements', heading: 'Required Qualifications', format: 'items', starts: ['A degree in Computer Science', '7-10 years of hands-on experience'] },
    ],
  }, job, text);
  assert.equal(out.method, 'ai');
  assert.equal(out.summary, 'A customer-facing engineering role.');
  assert.deepEqual(out.sections.find((s) => s.kind === 'responsibilities').items, ['Work closely with IT on hardware.', 'Provide detailed specifications for solutions.']);
  assert.deepEqual(out.sections.find((s) => s.kind === 'requirements').items, ['A degree in Computer Science.', '7-10 years of hands-on experience.']);
  assert.equal(out.facts.experience, '7–10 years');
});

test('AI split with anchors that are not in the posting is rejected', () => {
  const job = { description: 'Some posting text that is here.' };
  assert.equal(applyAiSplit({ sections: [{ kind: 'requirements', starts: ['invented words that do not appear', 'more invented words here'] }] }, job, plainTextFor(job)), null);
});
