import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyEnhanceChanges, replaceBullet, removeBullet } from './enhanceApply.js';

const PROFILE = {
  title: 'Staff Front-end UI Architect, Full-Stack',
  summary: 'Old summary.',
  experience: [
    { company: 'Amazon AWS', title: 'Lead UI Engineer', startDate: '2024-05', current: true, description: '• First bullet.\n\n• Second bullet.\n• Third bullet.' },
    { company: 'Restoration Hardware', position: 'Senior UI Engineer (React)', description: 'One.\nTwo.' },
  ],
  education: [{ school: 'SJSU', degree: 'BS', fieldOfStudy: 'CS', startDate: '2009', endDate: '2013' }],
};

test('replaceBullet skips blank lines and keeps the bullet mark', () => {
  assert.equal(replaceBullet(PROFILE.experience[0].description, 1, 'New second.'), '• First bullet.\n\n• New second.\n• Third bullet.');
  assert.equal(replaceBullet('A.\nB.', 5, 'x'), 'A.\nB.');
});

test('only kept changes land, field by field', () => {
  const out = applyEnhanceChanges(PROFILE, [
    { kind: 'title', after: 'Staff Front-end Engineer · UI Architecture' },
    { kind: 'bullet', index: 0, bullet: 2, after: 'Better third.' },
    { kind: 'role_title', index: 1, after: 'Senior UI Engineer' },
    { kind: 'education', index: 0, value: { degree: 'B.S.', field: 'Computer Science', institution: 'SJSU', period: '2013' } },
  ]);
  assert.equal(out.title, 'Staff Front-end Engineer · UI Architecture');
  assert.equal(out.summary, 'Old summary.');
  assert.equal(out.experience[0].description, '• First bullet.\n\n• Second bullet.\n• Better third.');
  assert.equal(out.experience[0].startDate, '2024-05');
  assert.equal(out.experience[1].position, 'Senior UI Engineer');
  assert.ok(!('title' in out.experience[1]));
  assert.deepEqual(out.education[0], { school: 'SJSU', degree: 'B.S.', fieldOfStudy: 'Computer Science', startDate: '2009', endDate: '2013' });
  // The input is untouched.
  assert.equal(PROFILE.experience[0].description, '• First bullet.\n\n• Second bullet.\n• Third bullet.');
});

test('removeBullet drops one bullet by the same count', () => {
  assert.equal(removeBullet('• A.\n\n• B.\n• C.', 1), '• A.\n\n• C.');
});
