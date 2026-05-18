#!/usr/bin/env node
/**
 * Step 3 dry-run script — simulates the full Greenhouse submission pipeline
 * without actually POSTing to the ATS.
 *
 * Usage:
 *   node scripts/dryRunSubmit.js                     # auto-picks most recent approved/prepared app
 *   node scripts/dryRunSubmit.js <appId>              # specific application
 *   node scripts/dryRunSubmit.js --skip-llm           # skip Claude field mapping (no API key needed)
 *   node scripts/dryRunSubmit.js <appId> --skip-llm
 *
 * What it does:
 *   1. Loads the ApplyPilotApplication + ExternalJob + User + Profile + TrainingMemory
 *   2. Resolves the applyUrl
 *   3. Checks if the Greenhouse adapter matches
 *   4. Fetches the real schema from Greenhouse's public API
 *   5. Normalizes fields
 *   6. Runs deterministic identity mapping
 *   7. (Unless --skip-llm) Runs Claude LLM field matching
 *   8. Prints the full would-be submission body — without sending it
 *
 * URL-only mode (no DB app needed):
 *   node scripts/dryRunSubmit.js --url https://boards.greenhouse.io/gitlab/jobs/12345
 *   Tests adapter matching, schema fetch, field normalization against a live Greenhouse URL.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// ANSI color helpers (no external dependency)
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
};

const OK   = c.green('✓');
const FAIL = c.red('✗');
const WARN = c.yellow('⚠');

// ── URL-only mode ───────────────────────────────────────────────────
// Tests the adapter pipeline against a live Greenhouse URL without
// needing a DB application row. Great for verifying schema fetch +
// field normalization work for a specific board.
async function urlOnlyMode(url) {
  console.log(`\n${c.bold('═══ URL-ONLY MODE ═══')}`);
  console.log(`  URL: ${url}\n`);

  const { selectAdapter } = require('../services/ats');
  const adapter = selectAdapter(url);
  if (!adapter) {
    console.log(`  ${FAIL} No adapter matched for: ${url}`);
    process.exit(1);
  }
  console.log(`  ${OK} Adapter: ${c.cyan(adapter.name)}`);

  const { parseUrl, normalizeFields } = require('../services/ats/greenhouse');
  const parsed = parseUrl(url);
  if (!parsed) {
    console.log(`  ${FAIL} Could not parse Greenhouse URL`);
    process.exit(1);
  }
  console.log(`  ${OK} Board: ${parsed.boardToken}  Job: ${parsed.jobId}`);

  const axios = require('axios');
  const schemaUrl = `https://boards-api.greenhouse.io/v1/boards/${parsed.boardToken}/jobs/${parsed.jobId}?questions=true`;
  console.log(`\n  Fetching schema: ${c.dim(schemaUrl)}`);
  let schema;
  try {
    const { data } = await axios.get(schemaUrl, { timeout: 15_000 });
    schema = data;
  } catch (err) {
    console.log(`  ${FAIL} Schema fetch failed: ${err.message}`);
    process.exit(1);
  }
  console.log(`  ${OK} Title: ${schema.title || '(unknown)'}`);
  console.log(`     Questions: ${(schema.questions || []).length}  Compliance: ${(schema.compliance || []).length}`);

  const fields = normalizeFields(schema);
  const required = fields.filter((f) => f.required);
  const custom   = fields.filter((f) => !f.standard);
  console.log(`\n  ${OK} Normalized: ${fields.length} fields (${required.length} required, ${custom.length} custom)`);

  console.log(`\n  ${c.dim('Field list:')}`);
  for (const f of fields) {
    const req = f.required ? c.red('REQ') : c.dim('opt');
    const std = f.standard ? c.cyan('STD') : c.yellow('CUS');
    const opts = f.options ? ` [${f.options.length} opts]` : '';
    console.log(`    ${req} ${std} ${f.type.padEnd(10)} ${(f.rawName || '').padEnd(30)} "${(f.label || '').slice(0, 50)}"${opts}`);
  }

  // Identity check
  const names = new Set(fields.map((f) => f.name));
  const expected = ['job_application[first_name]', 'job_application[last_name]', 'job_application[email]'];
  const missing = expected.filter((n) => !names.has(n));
  console.log(`\n  Identity fields: ${missing.length === 0 ? c.green('all present ✓') : c.red('MISSING: ' + missing.join(', '))}`);

  console.log(`\n${c.bold('═══ VERDICT ═══')}`);
  console.log(`  ${OK} Schema fetch + normalization working for this board.`);
  console.log(`  To test full pipeline with field mapping, create an app for this job and run:`);
  console.log(`     node scripts/dryRunSubmit.js <appId>`);
}

async function main() {
  const args = process.argv.slice(2);
  const skipLlm = args.includes('--skip-llm');
  const urlFlag = args.indexOf('--url');
  const appIdArg = args.find((a) => !a.startsWith('--') && args.indexOf(a) !== urlFlag + 1);

  // URL-only mode — no DB needed
  if (urlFlag >= 0 && args[urlFlag + 1]) {
    await urlOnlyMode(args[urlFlag + 1]);
    return;
  }

  // ── 0. Connect to DB ─────────────────────────────────────────────
  const { sequelize, ApplyPilotApplication, ExternalJob, Job, User, Profile, ApplyPilotTrainingMemory } = require('../models');
  await sequelize.authenticate();
  console.log(`${OK} Database connected`);

  // ── 1. Find the application ───────────────────────────────────────
  let app;
  if (appIdArg) {
    app = await ApplyPilotApplication.findByPk(appIdArg);
    if (!app) {
      console.error(`${FAIL} Application ${appIdArg} not found`);
      process.exit(1);
    }
  } else {
    // Auto-pick the most recent app that's in a submittable state
    app = await ApplyPilotApplication.findOne({
      where: { status: ['approved', 'prepared', 'submitting', 'needs_attention', 'failed'] },
      order: [['updatedAt', 'DESC']],
    });
    if (!app) {
      // Fall back to any app at all
      app = await ApplyPilotApplication.findOne({ order: [['updatedAt', 'DESC']] });
    }
    if (!app) {
      console.error(`${FAIL} No ApplyPilotApplication rows found. Create one first.`);
      process.exit(1);
    }
  }

  console.log(`\n${c.bold('═══ APPLICATION ═══')}`);
  console.log(`  ID:      ${app.id}`);
  console.log(`  Company: ${app.company || '(none)'}`);
  console.log(`  Role:    ${app.role || '(none)'}`);
  console.log(`  Status:  ${app.status}`);
  console.log(`  User ID: ${app.userId}`);

  // ── 2. Resolve applyUrl ───────────────────────────────────────────
  let applyUrl = null;
  if (app.externalJobId) {
    const ext = await ExternalJob.findByPk(app.externalJobId);
    applyUrl = ext?.applyUrl || ext?.sourceUrl || null;
    if (applyUrl) console.log(`  ${OK} applyUrl from ExternalJob: ${applyUrl}`);
  }
  if (!applyUrl && app.jobId) {
    const intJob = await Job.findByPk(app.jobId);
    applyUrl = intJob?.applyUrl || intJob?.externalUrl || null;
    if (applyUrl) console.log(`  ${OK} applyUrl from Job: ${applyUrl}`);
  }
  if (!applyUrl) {
    console.log(`  ${FAIL} No applyUrl found — this app can't be auto-submitted`);
    console.log(`     (externalJobId=${app.externalJobId}, jobId=${app.jobId})`);
    await sequelize.close();
    process.exit(1);
  }

  // ── 3. Adapter selection ──────────────────────────────────────────
  console.log(`\n${c.bold('═══ ADAPTER ═══')}`);
  const { selectAdapter } = require('../services/ats');
  const adapter = selectAdapter(applyUrl);
  if (!adapter) {
    console.log(`  ${FAIL} No adapter matched for: ${applyUrl}`);
    console.log(`     This URL needs a Phase 2/3 adapter (Lever, Workday, etc.)`);
    await sequelize.close();
    process.exit(1);
  }
  console.log(`  ${OK} Adapter: ${c.cyan(adapter.name)}`);

  // ── 4. Parse URL ──────────────────────────────────────────────────
  const { parseUrl, normalizeFields } = require('../services/ats/greenhouse');
  const parsed = parseUrl(applyUrl);
  if (!parsed) {
    console.log(`  ${FAIL} Could not parse Greenhouse URL: ${applyUrl}`);
    await sequelize.close();
    process.exit(1);
  }
  console.log(`  ${OK} Board: ${parsed.boardToken}  Job: ${parsed.jobId}`);

  // ── 5. Fetch schema from Greenhouse API ───────────────────────────
  console.log(`\n${c.bold('═══ SCHEMA FETCH ═══')}`);
  const axios = require('axios');
  let schema;
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${parsed.boardToken}/jobs/${parsed.jobId}?questions=true`;
    console.log(`  Fetching: ${c.dim(url)}`);
    const { data } = await axios.get(url, { timeout: 15_000 });
    schema = data;
    console.log(`  ${OK} Schema fetched`);
    console.log(`     Title: ${schema.title || '(unknown)'}`);
    console.log(`     Questions: ${(schema.questions || []).length}`);
    console.log(`     Compliance: ${(schema.compliance || []).length}`);
  } catch (err) {
    console.log(`  ${FAIL} Schema fetch failed: ${err.message}`);
    if (err.response?.status === 404) {
      console.log(`     The job may be closed or the board token is wrong.`);
    }
    await sequelize.close();
    process.exit(1);
  }

  // ── 6. Normalize fields ───────────────────────────────────────────
  console.log(`\n${c.bold('═══ FIELD NORMALIZATION ═══')}`);
  const fields = normalizeFields(schema);
  const mappableFields = fields.filter((f) => f.type !== 'file');
  const fileFields = fields.filter((f) => f.type === 'file');

  console.log(`  Total fields: ${fields.length}`);
  console.log(`  Mappable:     ${mappableFields.length}  (file fields excluded: ${fileFields.length})`);
  console.log(`  Required:     ${fields.filter((f) => f.required).length}`);
  console.log(`  Standard:     ${fields.filter((f) => f.standard).length}`);
  console.log(`  Custom:       ${fields.filter((f) => !f.standard).length}`);

  console.log(`\n  ${c.dim('Field list:')}`);
  for (const f of fields) {
    const req = f.required ? c.red('REQ') : c.dim('opt');
    const std = f.standard ? c.cyan('STD') : c.yellow('CUS');
    const opts = f.options ? ` [${f.options.length} options]` : '';
    console.log(`    ${req} ${std} ${f.type.padEnd(10)} ${(f.rawName || '').padEnd(30)} "${(f.label || '').slice(0, 50)}"${opts}`);
  }

  // ── 7. Load candidate context ─────────────────────────────────────
  console.log(`\n${c.bold('═══ CANDIDATE CONTEXT ═══')}`);
  const [user, profile, memory] = await Promise.all([
    User.findByPk(app.userId, { attributes: ['id', 'firstName', 'lastName', 'email'] }),
    Profile.findOne({ where: { userId: app.userId } }),
    ApplyPilotTrainingMemory.findAll({ where: { userId: app.userId } }),
  ]);

  if (!user) {
    console.log(`  ${FAIL} User ${app.userId} not found`);
    await sequelize.close();
    process.exit(1);
  }
  console.log(`  ${OK} User: ${user.firstName} ${user.lastName} <${user.email}>`);
  console.log(`  ${profile ? OK : WARN} Profile: ${profile ? 'loaded' : 'NOT FOUND (identity mapping will be sparse)'}`);
  console.log(`  ${OK} Training memories: ${memory.length}`);
  console.log(`  ${OK} Pre-drafted formAnswers: ${(app.formAnswers || []).length}`);
  console.log(`  ${app.coverLetter ? OK : WARN} Cover letter: ${app.coverLetter ? `${app.coverLetter.length} chars` : 'none'}`);

  // ── 8. Field mapping ──────────────────────────────────────────────
  console.log(`\n${c.bold('═══ FIELD MAPPING ═══')}`);

  // Always run the deterministic pass
  const { fillIdentityFields } = require('../services/ats/mapFields');
  const ctx = { app, profile, user, memory };
  const pass1 = fillIdentityFields(mappableFields, ctx);
  console.log(`  ${OK} Deterministic pass: ${Object.keys(pass1.mapped).length} fields filled`);
  console.log(`     Remaining for LLM: ${pass1.remaining.length}`);

  for (const [key, val] of Object.entries(pass1.mapped)) {
    const display = String(val).length > 60 ? String(val).slice(0, 60) + '…' : val;
    console.log(`     ${c.green('→')} ${key} = "${display}"`);
  }

  let values = { ...pass1.mapped };
  let blockers = [];

  if (pass1.remaining.length > 0 && !skipLlm) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log(`\n  ${FAIL} ANTHROPIC_API_KEY not set — cannot run LLM pass`);
      console.log(`     Run with --skip-llm to see results without Claude, or set the key in .env`);
      blockers = pass1.remaining
        .filter((f) => f.required)
        .map((f) => ({ field: f, reason: 'LLM pass skipped (no API key)' }));
    } else {
      console.log(`\n  ${c.dim('Running LLM pass (Claude)...')}`);
      try {
        const { mapFormFields } = require('../services/ats/mapFields');
        const result = await mapFormFields({ app, fields: mappableFields, profile, user, memory });
        values = result.values;
        blockers = result.blockers;
        console.log(`  ${OK} LLM pass complete`);
        console.log(`     Total mapped: ${Object.keys(values).length}`);
        console.log(`     Blockers: ${blockers.length}`);
      } catch (err) {
        console.log(`  ${FAIL} LLM pass failed: ${err.message}`);
        blockers = [{ field: { label: 'LLM error' }, reason: err.message }];
      }
    }
  } else if (pass1.remaining.length > 0 && skipLlm) {
    console.log(`\n  ${WARN} --skip-llm: ${pass1.remaining.length} fields not mapped`);
    blockers = pass1.remaining
      .filter((f) => f.required)
      .map((f) => ({ field: f, reason: 'skipped (--skip-llm)' }));
  } else {
    console.log(`\n  ${OK} All fields covered by deterministic pass — no LLM needed`);
  }

  // ── 9. Results ────────────────────────────────────────────────────
  console.log(`\n${c.bold('═══ SUBMISSION BODY (would-be) ═══')}`);
  console.log(`  POST https://boards.greenhouse.io/embed/job_app?for=${encodeURIComponent(parsed.boardToken)}&token=${encodeURIComponent(parsed.jobId)}`);
  console.log(`  Content-Type: multipart/form-data\n`);

  // Identity fields
  const firstName = values['job_application[first_name]'] || user?.firstName || '';
  const lastName  = values['job_application[last_name]']  || user?.lastName  || '';
  const email     = values['job_application[email]']      || user?.email     || '';
  const phone     = values['job_application[phone]']      || '';

  console.log(`  job_application[first_name] = "${firstName}"`);
  console.log(`  job_application[last_name]  = "${lastName}"`);
  console.log(`  job_application[email]      = "${email}"`);
  if (phone) console.log(`  job_application[phone]      = "${phone}"`);
  console.log(`  job_application[resume]     = <PDF buffer, would be rendered by resumePdf service>`);

  // Answer attributes
  const answerKeys = Object.keys(values).filter((k) => k.startsWith('job_application[answers_attributes]'));
  if (answerKeys.length) {
    console.log(`\n  ${c.dim('Answer attributes:')}`);
    for (const key of answerKeys) {
      const val = String(values[key]);
      const display = val.length > 80 ? val.slice(0, 80) + '…' : val;
      console.log(`  ${key} = "${display}"`);
    }
  }

  // ── 10. Verdict ───────────────────────────────────────────────────
  console.log(`\n${c.bold('═══ VERDICT ═══')}`);

  const totalRequired = fields.filter((f) => f.required && f.type !== 'file').length;
  const filledRequired = fields.filter((f) => f.required && f.type !== 'file' && values[f.name]).length;

  if (blockers.length === 0) {
    console.log(`  ${OK} ${c.green('READY TO SUBMIT')}`);
    console.log(`     All ${totalRequired} required fields filled (${filledRequired}/${totalRequired})`);
    console.log(`     Total fields mapped: ${Object.keys(values).length}`);
    console.log(`\n  Next step: approve this app in the UI, or run Step 4 manually.`);
  } else {
    console.log(`  ${FAIL} ${c.red(`${blockers.length} BLOCKER(S)`)} — submission would pause for human input`);
    for (const b of blockers) {
      console.log(`     ${c.red('•')} ${b.field.label || b.field.rawName || b.field.name}: ${b.reason}`);
    }
    console.log(`\n  Required fields: ${filledRequired}/${totalRequired} filled`);
    console.log(`  Fix: add training memories for the blocked fields, or edit formAnswers in the Review UI.`);
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error(`\n${FAIL} Fatal error:`, err);
  process.exit(1);
});
