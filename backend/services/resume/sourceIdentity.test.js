const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sameCompany, resumeMatchesProfile, periodOf, formatDate } = require('./sourceIdentity');
const { alignExperience, enforceFoundationBullets } = require('./foundation');

const PROFILE = {
  experience: [
    { company: 'Equinix', title: 'Senior UI Engineer', startDate: '2025-04-01', current: true, description: '• Define frontend architecture standards.\n• Lead technical direction through design reviews.' },
    { company: 'Amazon', title: 'Software Development Engineer', startDate: '2024-05-01', endDate: '2025-04-01', description: '• Led frontend architecture for a video platform.' },
    { company: 'RH', title: 'Senior Software Engineer', startDate: '2023-08-01', endDate: '2024-05-01', description: '• Built payment web apps.' },
    { company: 'Autodesk', title: 'Software Engineer 3', startDate: '2021-06-01', endDate: '2023-08-01', description: '• Developed micro frontends.' },
  ],
};

const STALE_TEXT = `Jordan Lee
Data Analyst, Brightline Retail, Mar 2024 - Sep 2024
Responsible for weekly sales reports. Worked on dashboards in Tableau.
Business Analyst, Northwind Logistics, Jan 2023 - Dec 2023
Reporting Analyst, Harbor Insurance, Jun 2021 - Nov 2022`;

const REAL_TEXT = `Saeed Darvish
Equinix, Senior UI Software Architect Engineer, Apr 2025 - Present
Amazon AWS, Lead UI Software Development Engineer
Restoration Hardware, Senior UI Engineer
Autodesk, Software Engineer III`;

test('a resume from another career is rejected', () => {
  const r = resumeMatchesProfile(STALE_TEXT, PROFILE);
  assert.equal(r.matches, false);
  assert.equal(r.matched.length, 0);
});

test("the candidate's own resume passes, including RH for Restoration Hardware", () => {
  const r = resumeMatchesProfile(REAL_TEXT, PROFILE);
  assert.equal(r.matches, true, JSON.stringify(r));
  assert.ok(r.matched.includes('RH'));
});

test('a profile with no employers does not reject the text', () => {
  assert.equal(resumeMatchesProfile(STALE_TEXT, { experience: [] }).matches, true);
});

test('company names pair by employer, not by wording alone', () => {
  assert.equal(sameCompany('Amazon', 'Amazon AWS'), true);
  assert.equal(sameCompany('RH', 'Restoration Hardware'), true);
  assert.equal(sameCompany('Wells Fargo', 'Wells Fargo & Co.'), true);
  assert.equal(sameCompany('Equinix', 'Brightline Retail'), false);
  assert.equal(sameCompany('', 'Equinix'), false);
});

test('dates come out of the profile in a readable form', () => {
  assert.equal(formatDate('2025-04-01'), 'Apr 2025');
  assert.equal(periodOf({ startDate: '2025-04-01', current: true }), 'Apr 2025 - Present');
  assert.equal(periodOf({ startDate: '2024-05-01', endDate: '2025-04-01' }), 'May 2024 - Apr 2025');
  assert.equal(periodOf({}), '');
});

test("a draft built from another resume cannot rename the candidate's roles", () => {
  const draft = {
    experience: [
      { company: 'Brightline Retail', title: 'Data Analyst', period: 'Mar 2024 – Sep 2024', description: '• Responsible for weekly sales reports\n• Worked on dashboards in Tableau' },
      { company: 'Northwind Logistics', title: 'Business Analyst', period: 'Jan 2023 – Dec 2023', description: '• Built Excel models' },
      { company: 'Harbor Insurance', title: 'Reporting Analyst', period: 'Jun 2021 – Nov 2022', description: '• Produced monthly claims reports in SQL' },
    ],
  };
  const { notes } = alignExperience(draft, PROFILE.experience);
  assert.deepEqual(draft.experience.map((e) => e.company), ['Equinix', 'Amazon', 'RH', 'Autodesk']);
  assert.deepEqual(draft.experience.map((e) => e.title), PROFILE.experience.map((e) => e.title));
  assert.equal(draft.experience[0].period, 'Apr 2025 - Present');
  const text = JSON.stringify(draft);
  assert.ok(!/Analyst|Tableau|Excel|SQL|Brightline|Northwind|Harbor/.test(text), text);
  assert.ok(notes.some((n) => /Brightline Retail.*removed/.test(n)));
  assert.ok(draft.experience.every((e) => e.description.includes('•')));
});

test('the foundation guard then keeps only the candidate\'s own bullets and dates', () => {
  const draft = { experience: [{ company: 'Brightline Retail', title: 'Data Analyst', period: 'x', description: '• Weekly sales reports' }] };
  enforceFoundationBullets(draft, PROFILE.experience);
  assert.equal(draft.experience.length, 4);
  assert.ok(draft.experience.every((e) => e.period));
  assert.ok(!/sales reports/.test(JSON.stringify(draft)));
});

test('a draft with the right employers keeps its rewritten bullets, in profile order, with profile titles', () => {
  const draft = {
    experience: [
      { company: 'Amazon AWS', title: 'Lead UI Software Development Engineer', period: 'May 2024 - Apr 2025', description: '• Led frontend architecture for a video platform.' },
      { company: 'Equinix', title: 'Senior UI Software Architect Engineer', period: 'Apr 2025 - Present', description: '• Define frontend architecture standards.\n• Lead technical direction through design reviews.' },
      { company: 'Restoration Hardware', title: 'Senior UI Engineer', description: '• Built payment web apps.' },
      { company: 'Autodesk', title: 'Software Engineer III', description: '• Developed micro frontends.' },
    ],
  };
  const { notes } = alignExperience(draft, PROFILE.experience);
  assert.deepEqual(draft.experience.map((e) => e.company), ['Equinix', 'Amazon', 'RH', 'Autodesk']);
  assert.equal(draft.experience[0].title, 'Senior UI Engineer');
  assert.equal(draft.experience[1].title, 'Software Development Engineer');
  assert.ok(notes.some((n) => /title kept as "Senior UI Engineer"/.test(n)));
  assert.match(draft.experience[1].description, /video platform/);
});
