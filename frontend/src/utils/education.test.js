import { describe, it, expect } from 'vitest';
import { normalizeEducationRows } from './education';

// Mirrors the save-time filter in ProfileForm/handleSubmit: a row survives only
// if it has an institution or a degree under those exact keys.
const PLACEHOLDER_RE = /^(field|degree|period|company\s*name|institution\s*name|role|title|n\/?a|none|null|undefined|tbd)$/i;
const isReal = (v) => {
  if (v == null) return false;
  const s = String(v).trim();
  return !!s && !PLACEHOLDER_RE.test(s);
};
const survivesSave = (rows) => rows.filter((edu) => isReal(edu.institution) || isReal(edu.degree));

describe('normalizeEducationRows', () => {
  it('keeps the AI parser shape intact and drops the `current` flag', () => {
    // Verbatim output of resumeParserService.parseResumeWithAI.
    const parsed = [
      {
        institution: 'University of California, Berkeley',
        degree: 'B.S.',
        field: 'Computer Science',
        startDate: '2013-01-01',
        endDate: '2017-01-01',
        current: false,
        gpa: '3.8',
      },
    ];
    const [row] = normalizeEducationRows(parsed);
    expect(row.institution).toBe('University of California, Berkeley');
    expect(row.fieldOfStudy).toBe('Computer Science');
    expect(row.field).toBe('Computer Science');
    expect(row).not.toHaveProperty('current');
    expect(survivesSave(normalizeEducationRows(parsed))).toHaveLength(1);
  });

  it('rescues a LinkedIn-imported row whose institution lives under `school`', () => {
    const imported = [{ school: 'Hack Reactor', degree: '', field: 'Software Engineering' }];
    // Without normalisation the save filter deletes it: no institution, no degree.
    expect(survivesSave(imported)).toHaveLength(0);
    const normalized = normalizeEducationRows(imported);
    expect(normalized[0].institution).toBe('Hack Reactor');
    expect(survivesSave(normalized)).toHaveLength(1);
  });

  it('converts an in-progress degree to the editor\'s endDate encoding', () => {
    const [row] = normalizeEducationRows([
      { institution: 'MIT', degree: 'M.S.', startDate: '2024-09-01', endDate: null, current: true },
    ]);
    expect(row.endDate).toBe('Present');
    expect(row).not.toHaveProperty('current');
  });

  it('prefers an existing fieldOfStudy over the legacy aliases', () => {
    const [row] = normalizeEducationRows([
      { institution: 'MIT', fieldOfStudy: 'Robotics', field: 'stale', major: 'older' },
    ]);
    expect(row.fieldOfStudy).toBe('Robotics');
    expect(row.field).toBe('Robotics');
    expect(row).not.toHaveProperty('major');
  });

  it('carries editor-only fields through untouched', () => {
    const [row] = normalizeEducationRows([
      { institution: 'MIT', degree: 'B.S.', location: 'Cambridge, MA', honors: "Dean's List", description: 'Thesis on X', gpa: '3.9' },
    ]);
    expect(row).toMatchObject({ location: 'Cambridge, MA', honors: "Dean's List", description: 'Thesis on X', gpa: '3.9' });
  });

  it('tolerates null and non-object input', () => {
    expect(normalizeEducationRows(null)).toEqual([]);
    expect(normalizeEducationRows(undefined)).toEqual([]);
    expect(normalizeEducationRows([null])).toEqual([null]);
  });
});
