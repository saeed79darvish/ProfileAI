#!/usr/bin/env node
/**
 * Unit smoke test for the consent heuristic + training-memory override.
 *
 * Runs in-process, no DB, no network. Exits 0 on all-pass,
 * non-zero on the first failed assertion.
 *
 *   node scripts/testConsentHeuristic.js
 */
const { resolveConsentField } = require('../services/ats/consentHeuristic');
const { applyConsentHeuristic } = require('../services/ats/mapFields');

let passed = 0;
let failed = 0;

function assert(name, ok, details = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${details ? ' — ' + details : ''}`);
  }
}

function group(title, fn) {
  console.log(`\n${title}`);
  fn();
}

// ---- Positive cases: the heuristic SHOULD auto-check ----
group('heuristic: positive cases', () => {
  const cases = [
    { label: 'I acknowledge that the information I provided is true and complete.' },
    { label: 'I agree to the terms of this application.' },
    { label: 'I certify the information provided is accurate.' },
    { label: 'I consent to the processing of my personal data under GDPR.' },
    { label: 'I authorize the employer to contact my references.' },
    { label: 'I confirm I have read the privacy policy.' },
    { label: 'I attest that all information is accurate and complete.' },
  ];
  for (const { label } of cases) {
    const field = { type: 'checkbox', required: true, label, groupSize: 1, name: 'consent_1' };
    const out = resolveConsentField(field, []);
    assert(
      `"${label.slice(0, 50)}..." auto-checks`,
      out && out.value === 'yes' && out.via === 'consent-heuristic',
      out ? JSON.stringify(out) : 'no resolution',
    );
  }
});

// ---- Negative cases: the heuristic MUST abstain ----
group('heuristic: negative cases (must abstain)', () => {
  const cases = [
    {
      label: 'Confirm you have 5+ years of Python experience',
      reason: 'substantive eligibility question',
    },
    {
      label: 'Are you authorized to work in the United States without sponsorship?',
      reason: 'work authorization — routed through LLM',
    },
    {
      label: 'Which of the following describes your experience?',
      reason: 'no attestation vocabulary',
    },
    {
      label:
        'By checking this box I do NOT agree to any of the terms. (The candidate may still submit.)',
      reason: 'contains explicit negation',
    },
    {
      label:
        'I acknowledge that I have 10+ years of post-qualification experience in enterprise Java ' +
        'with Spring Boot, Hibernate, and Kafka at a FAANG-scale company, and that I am currently ' +
        'authorized to work in the European Union and able to relocate to Dublin within 30 days ' +
        'of an offer being extended, pending visa processing if required by local authorities.',
      reason: 'too long (substantive question dressed as attestation)',
    },
  ];
  for (const { label, reason } of cases) {
    const field = { type: 'checkbox', required: true, label, groupSize: 1, name: 'custom_1' };
    const out = resolveConsentField(field, []);
    assert(
      `abstains: ${reason}`,
      out === null,
      out ? JSON.stringify(out) : '',
    );
  }
});

// ---- Structural guardrails ----
group('heuristic: structural guardrails', () => {
  const base = {
    type: 'checkbox',
    required: true,
    label: 'I agree to the terms.',
    name: 'consent_1',
  };

  assert(
    'skips when not required',
    resolveConsentField({ ...base, required: false }, []) === null,
  );
  assert(
    'skips when groupSize > 1 (multi-value checkbox group)',
    resolveConsentField({ ...base, groupSize: 3 }, []) === null,
  );
  assert(
    'skips when options.length > 1 (yes/no/decline select)',
    resolveConsentField(
      { ...base, options: [{ label: 'Yes' }, { label: 'No' }, { label: 'Decline' }] },
      [],
    ) === null,
  );
  assert(
    'skips when type is not checkbox',
    resolveConsentField({ ...base, type: 'text' }, []) === null,
  );
});

// ---- Training memory overrides both directions ----
group('training-memory override', () => {
  const label = 'I confirm my availability for night shifts.';
  const field = { type: 'checkbox', required: true, label, groupSize: 1, name: 'confirm_shift' };

  // Without memory: heuristic matches (label contains "confirm"), auto-yes.
  const heuristicOut = resolveConsentField(field, []);
  assert(
    'heuristic fires on "I confirm…" label',
    heuristicOut && heuristicOut.value === 'yes' && heuristicOut.via === 'consent-heuristic',
  );

  // With memory row = "no": memory MUST win, override the heuristic.
  const memoryNo = [{ topic: 'consent', key: label, value: 'no', source: 'manual' }];
  const memOverrideNo = resolveConsentField(field, memoryNo);
  assert(
    'memory "no" overrides a positive heuristic match',
    memOverrideNo && memOverrideNo.value === 'no' && memOverrideNo.via === 'training-memory',
    JSON.stringify(memOverrideNo),
  );

  // Memory can also force-check a field the heuristic would've missed.
  const offHeuristic = {
    type: 'checkbox',
    required: true,
    label: 'Night shifts: opt in?', // no attestation keyword
    groupSize: 1,
    name: 'opt_in_shift',
  };
  assert(
    'heuristic does NOT fire on neutral label',
    resolveConsentField(offHeuristic, []) === null,
  );
  const memoryYes = [
    { topic: 'consent', key: 'Night shifts: opt in?', value: 'yes', source: 'manual' },
  ];
  const memForceCheck = resolveConsentField(offHeuristic, memoryYes);
  assert(
    'memory "yes" force-checks a field outside the heuristic',
    memForceCheck && memForceCheck.value === 'yes' && memForceCheck.via === 'training-memory',
    JSON.stringify(memForceCheck),
  );
});

// ---- applyConsentHeuristic integration: mapped + resolutions + remaining ----
group('applyConsentHeuristic: integration', () => {
  const fields = [
    { name: 'consent_gdpr', type: 'checkbox', required: true,
      label: 'I consent to the processing of my data.', groupSize: 1 },
    { name: 'years_py',     type: 'text',     required: true,
      label: 'Years of Python experience' },
    { name: 'opt_marketing', type: 'checkbox', required: true,
      label: 'I confirm I want weekly recruiter emails.', groupSize: 1 },
  ];
  const memory = [
    // User previously said "no" to marketing emails.
    { topic: 'consent', key: 'I confirm I want weekly recruiter emails.', value: 'no' },
  ];

  const result = applyConsentHeuristic(fields, { memory });

  assert(
    'mapped GDPR consent (heuristic)',
    result.mapped.consent_gdpr === 'yes',
    JSON.stringify(result),
  );
  assert(
    'did NOT map marketing opt-in (memory said no)',
    !('opt_marketing' in result.mapped),
    JSON.stringify(result),
  );
  assert(
    'passed the text field through to remaining',
    result.remaining.length === 1 && result.remaining[0].name === 'years_py',
  );
  assert(
    'recorded 2 resolutions (gdpr=yes, marketing=no)',
    result.resolutions.length === 2,
    JSON.stringify(result.resolutions),
  );
  const gdpr = result.resolutions.find((r) => r.fieldName === 'consent_gdpr');
  assert(
    'gdpr resolution labelled as heuristic',
    gdpr && gdpr.resolvedVia === 'consent-heuristic' && gdpr.value === 'yes',
    JSON.stringify(gdpr),
  );
  const marketing = result.resolutions.find((r) => r.fieldName === 'opt_marketing');
  assert(
    'marketing resolution labelled as training-memory with value=no',
    marketing && marketing.resolvedVia === 'training-memory' && marketing.value === 'no',
    JSON.stringify(marketing),
  );
});

console.log(`\n${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
