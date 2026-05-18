/**
 * One-time (or periodic) backfill: extract skills via Claude Haiku for every
 * ExternalJob whose `skills` column is empty.
 *
 * Cost: ~$0.0001 per job. A 10k-job backfill is roughly $1-2 total.
 *
 * Run:
 *   node scripts/backfillJobSkills.js
 *   node scripts/backfillJobSkills.js --limit 100        # cap for testing
 *   node scripts/backfillJobSkills.js --concurrency 3    # parallel Haiku calls
 *   node scripts/backfillJobSkills.js --source greenhouse  # only one source
 *   node scripts/backfillJobSkills.js --dry-run          # don't write
 *   node scripts/backfillJobSkills.js --batch 200        # rows per DB query
 */

require('dotenv').config();
const { sequelize, ExternalJob } = require('../models');
const { Op } = require('sequelize');
const { extractSkills } = require('../services/jobSkillExtractor');

const args = process.argv.slice(2);
function arg(name, def = null) {
  const i = args.indexOf(name);
  if (i === -1) return def;
  const v = args[i + 1];
  return (v === undefined || (typeof v === 'string' && v.startsWith('--'))) ? true : v;
}
const LIMIT = parseInt(arg('--limit', 0), 10) || 0;
const CONCURRENCY = parseInt(arg('--concurrency', 5), 10);
const SOURCE = arg('--source', null);
const BATCH = parseInt(arg('--batch', 200), 10);
const DRY_RUN = !!arg('--dry-run', false);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY is not set in .env — Haiku extraction needs it.');
  process.exit(1);
}

async function findEmptySkillJobs(offset, limit) {
  // Sequelize doesn't have a clean "empty JSON array" test across dialects,
  // so fall back to raw SQL for the predicate.
  const where = {
    isActive: true,
    [Op.or]: [
      { skills: null },
      sequelize.literal(`jsonb_typeof("skills") = 'array' AND jsonb_array_length("skills") = 0`)
    ]
  };
  if (SOURCE) where.source = SOURCE;

  return ExternalJob.findAll({
    where,
    attributes: ['id', 'externalId', 'source', 'title', 'company', 'description', 'requirements', 'department', 'experienceLevel', 'skills'],
    order: [['createdAt', 'DESC']],
    offset,
    limit,
    raw: false,
  });
}

async function main() {
  console.log('🚀 Backfilling ExternalJob.skills via Claude Haiku\n');
  console.log(`   limit=${LIMIT || 'all'}  concurrency=${CONCURRENCY}  source=${SOURCE || '*'}  batch=${BATCH}  dry-run=${DRY_RUN}\n`);

  await sequelize.authenticate();

  // Quick total count for progress reporting.
  const totalEmptyRaw = await sequelize.query(
    `SELECT COUNT(*)::int as n FROM "ExternalJobs"
       WHERE "isActive" = true
         AND ("skills" IS NULL
              OR (jsonb_typeof("skills") = 'array' AND jsonb_array_length("skills") = 0))
         ${SOURCE ? `AND source = :src` : ''}`,
    { type: sequelize.constructor.QueryTypes.SELECT, replacements: SOURCE ? { src: SOURCE } : {} }
  );
  const total = totalEmptyRaw[0]?.n || 0;
  console.log(`Found ${total.toLocaleString()} jobs with empty skills.\n`);
  if (total === 0) { console.log('Nothing to do.'); process.exit(0); }

  const cap = LIMIT > 0 ? Math.min(LIMIT, total) : total;

  let processed = 0;
  let extracted = 0;  // jobs that got at least one skill
  let empty = 0;      // jobs Haiku returned nothing for
  let failed = 0;     // jobs where the call threw
  const startedAt = Date.now();

  // Page through the corpus in BATCH-sized chunks; within each chunk,
  // run CONCURRENCY Haiku calls in parallel. This keeps memory bounded
  // and lets us interrupt cleanly between batches.
  let offset = 0;
  while (processed < cap) {
    const remainingInCap = cap - processed;
    const pageLimit = Math.min(BATCH, remainingInCap);
    const jobs = await findEmptySkillJobs(offset, pageLimit);
    if (jobs.length === 0) break;
    offset += jobs.length;

    let i = 0;
    let inFlight = 0;
    await new Promise((resolve) => {
      const launchNext = () => {
        if (i >= jobs.length) {
          if (inFlight === 0) resolve();
          return;
        }
        const job = jobs[i++];
        inFlight++;
        extractSkills(job)
          .then(async (skills) => {
            if (!skills || skills.length === 0) { empty++; return; }
            if (!DRY_RUN) {
              try {
                await ExternalJob.update(
                  { skills },
                  { where: { id: job.id }, hooks: false }
                );
              } catch (err) {
                console.warn(`   write failed for ${job.id}: ${err.message}`);
                failed++;
                return;
              }
            }
            extracted++;
          })
          .catch(() => { failed++; })
          .finally(() => {
            inFlight--;
            processed++;
            if (processed % 25 === 0 || processed === cap) {
              const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
              const rate = (processed / Math.max(parseInt(elapsed, 10), 1)).toFixed(2);
              console.log(`   ${processed}/${cap} | extracted=${extracted} empty=${empty} failed=${failed} | ${elapsed}s | ${rate} jobs/s`);
            }
            launchNext();
          });
      };
      for (let n = 0; n < Math.min(CONCURRENCY, jobs.length); n++) launchNext();
    });
  }

  console.log(`\n✅ Done. Processed ${processed} jobs.`);
  console.log(`   Extracted skills: ${extracted}`);
  console.log(`   Returned empty:   ${empty}`);
  console.log(`   Failed:           ${failed}`);
  if (DRY_RUN) console.log(`   (dry-run — nothing written)`);
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
