/**
 * Seed the broad aggregator boards (Adzuna + JSearch) used to compete on
 * BREADTH and FRESHNESS — these sources return real `postedAt` and cover the
 * whole US market (not just startups), unlike the per-company ATS boards.
 *
 * Tier-1 of the "more updated / more jobs" plan. Seeded INACTIVE by default so
 * they add ZERO load until you're ready (i.e. after the Postgres is upsized).
 * Flip them on with `--activate` (or later in the DB) once the DB can take the
 * extra sync volume.
 *
 * Usage (run against PROD — e.g. from a Render backend shell where DATABASE_URL
 * points at prod; your LOCAL machine connects to a stale DB):
 *   node scripts/seedAggregatorBoards.js              # seed, inactive
 *   node scripts/seedAggregatorBoards.js --activate   # seed + activate now
 *
 * Requires env: ADZUNA_APP_ID / ADZUNA_APP_KEY (Adzuna) and RAPIDAPI_KEY
 * (JSearch). Boards seed regardless, but syncs will no-op without the keys.
 */
require('dotenv').config();
const { sequelize, ATSBoard } = require('../models');

// One Adzuna board that fans out across many categories internally (see
// fetchAdzunaJobs). Keep it a SINGLE board so deactivation stays correct.
const ADZUNA_BOARDS = [
  { name: 'Adzuna US', platform: 'adzuna', boardToken: 'us' },
];

// JSearch (Google-for-Jobs aggregator: Indeed/LinkedIn/ZipRecruiter/etc).
// Each query is its own board; boardToken = "query::pages". Kept broad but
// bounded — RapidAPI quota is the limiter. Tune pages per query as needed.
const JSEARCH_QUERIES = [
  'software engineer', 'frontend engineer', 'backend engineer', 'full stack developer',
  'data scientist', 'data analyst', 'data engineer', 'machine learning engineer',
  'devops engineer', 'product manager', 'product designer', 'ux designer',
  'project manager', 'marketing manager', 'sales representative', 'account executive',
  'customer success manager', 'business analyst', 'financial analyst', 'accountant',
  'human resources manager', 'recruiter', 'operations manager', 'registered nurse',
];

async function seed() {
  const activate = process.argv.includes('--activate');
  try {
    await sequelize.authenticate();
    console.log(`Database connected. Seeding aggregator boards (activate=${activate}).`);

    // Make sure the platform/source ENUMs include the aggregators (idempotent).
    for (const stmt of [
      `ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'adzuna'`,
      `ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'jsearch'`,
      `ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'adzuna'`,
      `ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'jsearch'`,
    ]) {
      try { await sequelize.query(stmt); } catch (e) { /* already exists */ }
    }

    const boards = [
      ...ADZUNA_BOARDS,
      ...JSEARCH_QUERIES.map((q) => ({
        name: `JSearch: ${q}`,
        platform: 'jsearch',
        boardToken: `${q}::2`,
      })),
    ];

    let created = 0;
    let activated = 0;
    let skipped = 0;
    for (const b of boards) {
      const [row, wasCreated] = await ATSBoard.findOrCreate({
        where: { platform: b.platform, boardToken: b.boardToken },
        defaults: { name: b.name, isActive: activate },
      });
      if (wasCreated) {
        created++;
        console.log(`  + ${b.name} (${b.platform}/${b.boardToken})${activate ? ' [active]' : ' [inactive]'}`);
      } else if (activate && !row.isActive) {
        await row.update({ isActive: true });
        activated++;
        console.log(`  ^ ${b.name} activated`);
      } else {
        skipped++;
        console.log(`  ~ ${b.name} already exists, skipped`);
      }
    }

    console.log(`\nDone: ${created} created, ${activated} activated, ${skipped} unchanged.`);
    if (!activate) {
      console.log('Boards are INACTIVE. Re-run with --activate (after upsizing the DB) to turn them on.');
    }
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
