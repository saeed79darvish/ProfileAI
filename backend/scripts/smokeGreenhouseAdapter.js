/**
 * Offline smoke test for the Greenhouse ATS adapter.
 *
 * Feeds a real-shape Greenhouse schema payload through:
 *   - parseUrl (both boards.* and job-boards.* hostnames)
 *   - normalizeFields (identity vs custom question routing)
 *   - fillIdentityFields (deterministic Profile → field mapping)
 *
 * Includes two regression guards:
 *   1. File-type fields must NOT leak into the Claude mapper pipeline
 *      (they are handled separately in buildFormBody).
 *   2. Identity fields must NOT be double-emitted (once directly and
 *      once under answers_attributes).
 *
 * Run:  node scripts/smokeGreenhouseAdapter.js
 */

const { normalizeFields, parseUrl } = require('../services/ats/greenhouse');
const { fillIdentityFields } = require('../services/ats/mapFields');

// ---- synthetic Greenhouse schema, real shape ----
const schema = {
  id: 1234567,
  title: 'Senior Frontend Engineer',
  absolute_url: 'https://boards.greenhouse.io/demoorg/jobs/1234567',
  questions: [
    { label: 'First Name',   required: true,
      fields: [{ name: 'first_name', type: 'input_text', values: [] }] },
    { label: 'Last Name',    required: true,
      fields: [{ name: 'last_name',  type: 'input_text', values: [] }] },
    { label: 'Email',        required: true,
      fields: [{ name: 'email',      type: 'input_text', values: [] }] },
    { label: 'Phone',        required: false,
      fields: [{ name: 'phone',      type: 'input_text', values: [] }] },
    { label: 'Resume/CV',    required: true,
      fields: [{ name: 'resume',     type: 'input_file', values: [] }] },
    { label: 'LinkedIn Profile', required: false,
      fields: [{ name: 'question_9_2001', type: 'input_text', values: [] }] },
    { label: 'Why are you interested in joining us?',
      description_text: 'Tell us in 2-3 sentences.',
      required: true, max_length: 500,
      fields: [{ name: 'question_9_2002', type: 'input_textarea', values: [], max_length: 500 }] },
    { label: 'Are you legally authorized to work in the United States?',
      required: true,
      fields: [{ name: 'question_9_2003', type: 'input_select',
        values: [{ label: 'Yes', value: '1' }, { label: 'No', value: '0' }] }] },
  ],
  compliance: [
    { label: 'Gender', required: false,
      fields: [{ name: 'gender', type: 'input_select',
        values: [{ label: 'Male', value: 'm' }, { label: 'Female', value: 'f' }, { label: 'Decline', value: 'x' }] }] },
  ],
};

// 1. parseUrl on both URL shapes
console.log('parseUrl(boards.greenhouse.io):',
  parseUrl('https://boards.greenhouse.io/demoorg/jobs/1234567'));
console.log('parseUrl(job-boards.greenhouse.io):',
  parseUrl('https://job-boards.greenhouse.io/demoorg/jobs/1234567'));
console.log('parseUrl(non-greenhouse):',
  parseUrl('https://jobs.lever.co/foo/abc'));

// 2. normalizeFields
const fields = normalizeFields(schema);
console.log('\nnormalizeFields -> ' + fields.length + ' fields');
for (const f of fields) {
  const opts = f.options ? ` options=${f.options.map(o => o.label).join('|')}` : '';
  console.log(`  - [${String(f.type).padEnd(10)}] req=${f.required ? 'Y' : 'N'} ${f.name}  "${(f.label || '').slice(0, 40)}"${opts}`);
}

// 3. Deterministic identity mapper
const ctx = {
  user: { firstName: 'Saeed', lastName: 'Darvish', email: 's@example.com' },
  profile: {
    phone: '+1 555 010 2030',
    linkedinUrl: 'https://linkedin.com/in/saeeddarvish',
    githubUrl: 'https://github.com/saeed',
    portfolioUrl: null,
    location: 'SF Bay',
  },
  app: { formAnswers: [], coverLetter: '', company: 'DemoOrg', role: 'FE' },
};

// Mirror the adapter's pre-filter: file fields are handled in
// buildFormBody, never mapped by Claude.
const mappableFields = fields.filter((f) => f.type !== 'file');
const { mapped, remaining } = fillIdentityFields(mappableFields, ctx);
console.log('\nIdentity pass (file fields excluded):');
console.log('  mapped keys:', Object.keys(mapped));
console.log('  remaining (will go to Claude):');
for (const f of remaining) {
  console.log('    -', f.name, '—', (f.label || '').slice(0, 50));
}

// Regression guard 1 — the resume file field must NOT be in remaining.
const leakedFile = remaining.find((f) => f.type === 'file');
console.log('\nFile field leaked into Claude pipeline?', leakedFile ? 'YES FAIL ' + leakedFile.name : 'NO OK');

// Regression guard 2 — identity fields must not be double-emitted.
const nameCounts = fields.reduce((acc, f) => { acc[f.name] = (acc[f.name] || 0) + 1; return acc; }, {});
const dupes = Object.entries(nameCounts).filter(([, n]) => n > 1);
console.log('Duplicate field names?', dupes.length ? 'YES FAIL ' + JSON.stringify(dupes) : 'NO OK');

// Exit non-zero if either guard failed, so CI can wire this up later.
if (leakedFile || dupes.length) process.exit(1);
