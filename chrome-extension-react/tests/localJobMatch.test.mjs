/**
 * The on-device match scorer.
 *
 * This is the number on the job card ("49% MATCH"). It makes no network call
 * and no AI call — it is a pure function of (posting, profile), which is why
 * re-analyzing returns the same number: nothing is cached, it is deterministic.
 *
 * The bug these tests pin down: requirements were SHORTENED at collection time
 * and the shortened string was stored as the requirement, so the scorer judged
 * the candidate against the first 72 characters of each bullet. A requirement
 * whose distinguishing words fell past that cut could never be matched. It also
 * surfaced in the UI as a screening verdict quoting a sentence that stops
 * mid-clause: "Experience working in fast-paced startup environments where
 * you've built".
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { buildFixtures, OUT_DIR } from './build-fixtures.mjs';

let analyzeJobMatchLocally;

before(async () => {
  await buildFixtures();
  ({ analyzeJobMatchLocally } = await import(resolve(OUT_DIR, 'localJobMatch.mjs')));
});

/** Minimal vocabulary: substring matching over a small keyword set. */
const KEYWORDS = [
  'react', 'typescript', 'node.js', 'kubernetes', 'terraform', 'go', 'aws',
  'graphql', 'postgresql', 'docker', 'python',
];
const vocab = {
  keywords: KEYWORDS,
  canonical: (t) => String(t || '').toLowerCase().trim(),
  contains: (haystack, needle) =>
    String(haystack || '').toLowerCase().includes(String(needle || '').toLowerCase()),
};

const PROFILE = {
  title: 'Senior UI Platform Engineer',
  skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
  experience: [
    {
      title: 'Senior UI Platform Engineer',
      company: 'Equinix',
      startDate: '2021-01',
      current: true,
      description:
        'Built a shared component library used by 20+ internal applications. Worked in a fast-paced startup environment where I built the design system from scratch.',
    },
    {
      title: 'Frontend Engineer',
      company: 'AWS',
      startDate: '2019-05',
      endDate: '2021-01',
      description: 'Built video platform UI in React and TypeScript.',
    },
  ],
  education: [{ school: 'Bootcamp', degree: 'Certificate', year: '2018' }],
};

const run = (jobDescription, jobTitle = 'Staff Software Engineer') =>
  analyzeJobMatchLocally({ jobDescription, jobTitle, profile: PROFILE, vocab });

/** The long, comma-free requirement from the reported screenshot. */
const LONG_REQ =
  'Experience working in fast-paced startup environments where you have built and scaled products from the ground up';

const POSTING = `
About the Role
We are hiring a Staff Software Engineer.

What You'll Need
- ${LONG_REQ}
- Mastery of React, TypeScript and Node.js
- 7+ years of full-stack engineering experience
- Strong background in scalable system design and API development
`.trim();

// ── The reported defect ─────────────────────────────────────────────────────

test('no requirement is shown as a sentence that stops mid-clause', () => {
  const r = run(POSTING);
  const shown = [...(r.present || []), ...(r.partial || []), ...(r.missing || []),
                 ...((r.blockers || []).map((b) => b.requirement))];
  const stump = 'Experience working in fast-paced startup environments where you have built';
  for (const s of shown) {
    assert.notEqual(
      s, stump,
      'a hard 72-char cut is being presented as the complete requirement'
    );
  }
});

test('a shortened requirement is visibly shortened', () => {
  const r = run(POSTING);
  const shown = [...(r.present || []), ...(r.partial || []), ...(r.missing || []),
                 ...((r.blockers || []).map((b) => b.requirement))];
  for (const s of shown) {
    if (s.length >= 72) {
      assert.ok(s.endsWith('…'), `long label not marked as elided: ${JSON.stringify(s)}`);
    }
    // Never cut mid-word.
    assert.ok(!/\s\S{1,2}…$/.test(s), `label cut mid-word: ${JSON.stringify(s)}`);
  }
});

test('matching reads the WHOLE requirement, not its first 72 characters', () => {
  // "fast-paced startup environments where you have built and scaled products
  // from the ground up" — the profile evidences this, but only via words that
  // sit past character 72 ("scaled products from the ground up" is beyond the
  // cut). Under the old behaviour the tail did not exist for matching at all.
  const evidenced = {
    ...PROFILE,
    experience: [
      {
        ...PROFILE.experience[0],
        description:
          'Scaled products from the ground up in a fast-paced startup environment, building and scaling the platform.',
      },
      PROFILE.experience[1],
    ],
  };
  const withTail = analyzeJobMatchLocally({
    jobDescription: POSTING, jobTitle: 'Staff Software Engineer', profile: evidenced, vocab,
  });
  const noTail = analyzeJobMatchLocally({
    jobDescription: POSTING, jobTitle: 'Staff Software Engineer',
    profile: { ...PROFILE, experience: [PROFILE.experience[1]] }, vocab,
  });
  // The scorer must be able to tell these two profiles apart. If requirements
  // were truncated before scoring, the distinguishing evidence is invisible.
  assert.notEqual(
    withTail.matchScore, noTail.matchScore,
    'evidence beyond char 72 of a requirement made no difference to the score'
  );
});

// ── Determinism: the thing that looks like caching ──────────────────────────

test('the same posting and profile always produce the same score', () => {
  const a = run(POSTING);
  const b = run(POSTING);
  const c = run(POSTING);
  assert.equal(a.matchScore, b.matchScore);
  assert.equal(b.matchScore, c.matchScore);
  // This is why "Re-analyze" returns an identical number. It is not a cache —
  // it is a pure function, recomputed every time.
  assert.deepEqual(a.missing, c.missing);
});

test('a different posting produces a different reading', () => {
  const other = `
What You'll Need
- Deep Terraform and Kubernetes operations experience
- 15+ years of infrastructure engineering
- Expert level Go and Rust
`.trim();
  const a = run(POSTING);
  const b = run(other);
  assert.notEqual(a.matchScore, b.matchScore, 'the scorer is insensitive to the posting');
});

// ── Priority lookup, which the label change could have silently broken ──────

test('blockers resolve to high priority through the displayed string', () => {
  const r = run(POSTING);
  if (!r.blockers?.length) return; // nothing to assert on this fixture
  for (const b of r.blockers) {
    const key = b.requirement.toLowerCase();
    // `missing` and `priorities` must be keyed on the same string the card
    // renders, or every blocker silently downgrades to 'medium'.
    if (r.missing?.some((m) => m.toLowerCase() === key)) {
      assert.equal(r.priorities?.[key], 'high', `blocker not marked high: ${b.requirement}`);
    }
  }
});

test('every missing entry can be looked up in priorities', () => {
  const r = run(POSTING);
  for (const m of r.missing || []) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(r.priorities || {}, m.toLowerCase()),
      `no priority for rendered requirement: ${m}`
    );
  }
});

// ── Sanity ──────────────────────────────────────────────────────────────────

test('a posting with no requirements is reported unscorable, not scored at 0', () => {
  const r = run('We are a great company. We value people. Come join us.');
  // Better to decline than to publish an arbitrary number. `unscorable` is
  // itself the reason string, not a boolean flag.
  assert.ok('unscorable' in r || typeof r.matchScore === 'number');
  if ('unscorable' in r) {
    assert.equal(typeof r.unscorable, 'string');
    assert.ok(r.unscorable.length > 0, 'declined to score without saying why');
  }
});

test('the score stays inside 0..100', () => {
  for (const jd of [POSTING, 'What You\'ll Need\n- React\n- TypeScript']) {
    const r = run(jd);
    if ('unscorable' in r) continue;
    assert.ok(r.matchScore >= 0 && r.matchScore <= 100, `out of range: ${r.matchScore}`);
  }
});

// ── A Staff frontend engineer reading a frontend posting at 21% ─────────────
//
// Reported on a Verkada "Staff Frontend Engineer - Mapping & Spatial Platform"
// posting. A like-for-like candidate scored 21% because: the "Nice to Haves"
// heading wasn't recognised, so preferred items were scored as required; the
// word "Platform" in the title and "UI" in the candidate's titles moved both
// into other role families; and trait lines ("Eye for Detail") with nothing to
// match on were listed as failing the screen.

const SPATIAL_VOCAB = {
  ...vocab,
  keywords: [...KEYWORDS, 'javascript', 'ux', 'three.js', 'webgl', 'deck.gl', 'postgis', 'yjs', 'crdt'],
};

const SPATIAL_POSTING = `
What You Bring
• 5+ years of experience building complex, customer-facing web applications.
• Mastery of Web Technologies: JavaScript fundamentals and React expertise.
• Eye for Detail: Pixel-perfect execution — you notice the half-pixel misalignment, the 16ms jank.
• Product Grit: Ability to bridge the gap between CAD-level precision and consumer-grade UX.
• Spatial Reasoning: Understanding of coordinate system conversions and projections.
Nice to Haves
• Graphics Stack: Experience with Deck.gl, MapLibre, Three.js, or raw WebGL/WebGPU.
• Collaborative Systems: Experience with real-time sync architectures (e.g., Yjs).
• Geospatial Mastery: Familiarity with PostGIS and GIS workflows.
`.trim();

const UI_ENGINEER = {
  ...PROFILE,
  title: 'Senior UI Software Architect Engineer',
  skills: [...PROFILE.skills, 'JavaScript'],
  experience: [
    { ...PROFILE.experience[0], title: 'Senior UI Software Architect Engineer',
      description: 'Built React and TypeScript design systems in partnership with the UX team.' },
    { ...PROFILE.experience[1], title: 'Lead UI Software Development Engineer' },
  ],
};

const runSpatial = (profile = UI_ENGINEER) =>
  analyzeJobMatchLocally({
    jobDescription: SPATIAL_POSTING,
    jobTitle: 'Staff Frontend Engineer - Mapping & Spatial Platform',
    profile,
    vocab: SPATIAL_VOCAB,
  });

const reqNamed = (r, prefix) => r.requirements.find((q) => q.requirement.startsWith(prefix));

test('"Nice to Haves" (plural) is read as a preferred section', () => {
  const r = runSpatial();
  for (const prefix of ['Graphics Stack', 'Collaborative Systems', 'Geospatial Mastery']) {
    assert.equal(reqNamed(r, prefix)?.hardness, 'nice', `${prefix} scored as required`);
  }
  assert.ok(
    !r.blockers.some((b) => /Graphics Stack|Geospatial/.test(b.requirement)),
    'a preferred item is listed as failing the screen',
  );
});

test('a product name in an engineering title does not change the role family', () => {
  const r = runSpatial();
  assert.equal(r.components.roleFit, 1, `role fit ${r.components.roleFit} (${r.components.roleFitBasis})`);
});

test('a genuinely different platform role is still adjacent, not the same', () => {
  const r = analyzeJobMatchLocally({
    jobDescription: SPATIAL_POSTING,
    jobTitle: 'Senior Platform Software Engineer',
    profile: UI_ENGINEER,
    vocab: SPATIAL_VOCAB,
  });
  assert.equal(r.components.roleFit, 0.7);
});

test('trait requirements never fail the screen', () => {
  const r = runSpatial();
  for (const prefix of ['Eye for Detail', 'Product Grit']) {
    assert.equal(reqNamed(r, prefix)?.type, 'soft', `${prefix} read as a hard skill`);
    assert.ok(!r.blockers.some((b) => b.requirement.startsWith(prefix)), `${prefix} listed as a blocker`);
  }
});

test('"collaborative systems" is a technical requirement, not teamwork', () => {
  assert.equal(reqNamed(runSpatial(), 'Collaborative Systems')?.type, 'skill');
});

test('UX named in a role description is evidence of UX', () => {
  const r = runSpatial();
  assert.notEqual(reqNamed(r, 'Product Grit')?.evidence, 'Not stated either way in your profile');
  const terms = r.requirements.filter((q) => /\bUX\b/.test(q.requirement));
  assert.ok(terms.every((q) => q.coverage !== 'none'), 'UX in a role description was ignored');
});

test('a requirement nothing on-device can judge is left out, not failed', () => {
  const r = runSpatial();
  const spatial = reqNamed(r, 'Spatial Reasoning');
  assert.equal(spatial?.unchecked, true);
  assert.ok(!r.blockers.some((b) => b.requirement.startsWith('Spatial Reasoning')));
  assert.ok(r.unchecked.some((u) => u.startsWith('Spatial Reasoning')));
  assert.ok(!r.missing.some((m) => m.startsWith('Spatial Reasoning')), 'shown as a gap as well');
  assert.equal(r.components.uncheckedCount, 1);
});

test('a posting where nothing can be checked is unscorable, not 0%', () => {
  const r = analyzeJobMatchLocally({
    jobDescription: `What You Bring
• Understanding of coordinate system conversions and projections.
• Intuition for numerical stability under floating point error.
• Comfort reasoning about quaternions and homogeneous coordinates.`,
    jobTitle: 'Staff Frontend Engineer',
    profile: UI_ENGINEER,
    vocab: SPATIAL_VOCAB,
  });
  assert.ok('unscorable' in r, `scored ${r.matchScore} from nothing`);
});

test('the verdict only says "capped" when the cap lowered the score', () => {
  const r = runSpatial();
  if (!r.blockers.length) return;
  assert.equal(/^Capped/.test(r.verdict), r.components.cappedByBlockers, r.verdict);
});

test('blocker reasons read as a sentence', () => {
  for (const b of runSpatial().blockers) {
    assert.ok(!/\b\w+, \w+ is listed\b/.test(b.why), `ungrammatical: ${b.why}`);
  }
});
