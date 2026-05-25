/**
 * Seed script to pre-configure popular company ATS boards.
 * Usage: cd backend && node scripts/seedATSBoards.js
 */
require('dotenv').config();
const { sequelize, ATSBoard } = require('../models');
const { syncAllBoards } = require('../services/externalJobService');

const SEED_BOARDS = [
  // Greenhouse companies (verified working)
  { name: 'Airbnb', platform: 'greenhouse', boardToken: 'airbnb' },
  { name: 'Coinbase', platform: 'greenhouse', boardToken: 'coinbase' },
  { name: 'Stripe', platform: 'greenhouse', boardToken: 'stripe' },
  { name: 'Discord', platform: 'greenhouse', boardToken: 'discord' },
  { name: 'Figma', platform: 'greenhouse', boardToken: 'figma' },
  { name: 'Datadog', platform: 'greenhouse', boardToken: 'datadog' },
  { name: 'MongoDB', platform: 'greenhouse', boardToken: 'mongodb' },
  { name: 'Cloudflare', platform: 'greenhouse', boardToken: 'cloudflare' },
  { name: 'Twitch', platform: 'greenhouse', boardToken: 'twitch' },
  { name: 'Pinterest', platform: 'greenhouse', boardToken: 'pinterest' },
  { name: 'Lyft', platform: 'greenhouse', boardToken: 'lyft' },
  { name: 'Robinhood', platform: 'greenhouse', boardToken: 'robinhood' },
  { name: 'Airtable', platform: 'greenhouse', boardToken: 'airtable' },
  { name: 'GitLab', platform: 'greenhouse', boardToken: 'gitlab' },
  { name: 'Elastic', platform: 'greenhouse', boardToken: 'elastic' },
  { name: 'Databricks', platform: 'greenhouse', boardToken: 'databricks' },
  { name: 'Okta', platform: 'greenhouse', boardToken: 'okta' },
  { name: 'PagerDuty', platform: 'greenhouse', boardToken: 'pagerduty' },
  { name: 'CockroachDB', platform: 'greenhouse', boardToken: 'cockroachlabs' },
  { name: 'Brex', platform: 'greenhouse', boardToken: 'brex' },
  { name: 'Verkada', platform: 'greenhouse', boardToken: 'verkada' },
  { name: 'Gusto', platform: 'greenhouse', boardToken: 'gusto' },
  { name: 'Anthropic', platform: 'greenhouse', boardToken: 'anthropic' },
  { name: 'Duolingo', platform: 'greenhouse', boardToken: 'duolingo' },
  { name: 'Asana', platform: 'greenhouse', boardToken: 'asana' },
  { name: 'Dropbox', platform: 'greenhouse', boardToken: 'dropbox' },
  { name: 'Twilio', platform: 'greenhouse', boardToken: 'twilio' },
  { name: 'SpaceX', platform: 'greenhouse', boardToken: 'spacex' },
  { name: 'Reddit', platform: 'greenhouse', boardToken: 'reddit' },
  { name: 'Instacart', platform: 'greenhouse', boardToken: 'instacart' },
  { name: 'Samsara', platform: 'greenhouse', boardToken: 'samsara' },
  { name: 'Chime', platform: 'greenhouse', boardToken: 'chime' },
  { name: 'Flexport', platform: 'greenhouse', boardToken: 'flexport' },
  { name: 'Coupang', platform: 'greenhouse', boardToken: 'coupang' },
  { name: 'Anduril', platform: 'greenhouse', boardToken: 'andurilindustries' },
  { name: 'Scale AI', platform: 'greenhouse', boardToken: 'scaleai' },
  // Aggregator sources (no per-company board tokens needed)
  { name: 'RemoteOK', platform: 'remoteok', boardToken: 'remoteok' },
  // (Adzuna intentionally not seeded — required keys (ADZUNA_APP_ID +
  // ADZUNA_APP_KEY) we don't currently have. The fetcher code remains
  // available in externalJobService.js if you decide to re-enable later.)

  // ─── Lever companies (public API, no auth) ───
  { name: 'Spotify', platform: 'lever', boardToken: 'spotify' },
  { name: 'JumpCloud', platform: 'lever', boardToken: 'jumpcloud' },
  { name: 'Clari', platform: 'lever', boardToken: 'clari' },

  // ─── Ashby companies (public API, no auth) ───
  { name: 'OpenAI', platform: 'ashby', boardToken: 'openai' },
  { name: 'Deel', platform: 'ashby', boardToken: 'deel' },
  { name: 'Notion', platform: 'ashby', boardToken: 'notion' },
  { name: 'Ramp', platform: 'ashby', boardToken: 'ramp' },
  { name: 'Cohere', platform: 'ashby', boardToken: 'cohere' },
  { name: 'ClickUp', platform: 'ashby', boardToken: 'clickup' },
  { name: 'Replit', platform: 'ashby', boardToken: 'replit' },
  { name: 'Perplexity', platform: 'ashby', boardToken: 'perplexity' },
  { name: 'Ashby', platform: 'ashby', boardToken: 'ashby' },
  { name: 'Supabase', platform: 'ashby', boardToken: 'supabase' },
  { name: 'Linear', platform: 'ashby', boardToken: 'linear' },
  { name: 'Oyster HR', platform: 'ashby', boardToken: 'oyster' },
  { name: 'Render', platform: 'ashby', boardToken: 'render' },
  { name: 'Railway', platform: 'ashby', boardToken: 'railway' },
  { name: 'Resend', platform: 'ashby', boardToken: 'resend' },
  { name: 'Neon', platform: 'ashby', boardToken: 'neon' },
  { name: 'Clerk', platform: 'ashby', boardToken: 'clerk' },

  // ─── We Work Remotely RSS (free, no auth) ───
  { name: 'WWR: Programming', platform: 'wwr', boardToken: 'programming' },
  { name: 'WWR: Design', platform: 'wwr', boardToken: 'design' },
  { name: 'WWR: DevOps & Sysadmin', platform: 'wwr', boardToken: 'devops-sysadmin' },
  { name: 'WWR: Product', platform: 'wwr', boardToken: 'product' },
  // JSearch (Google Jobs aggregator via RapidAPI) — requires RAPIDAPI_KEY in .env
  // boardToken format: "search query" or "search query::num_pages"
  { name: 'JSearch: Software Engineer', platform: 'jsearch', boardToken: 'software engineer' },
  { name: 'JSearch: Frontend Developer', platform: 'jsearch', boardToken: 'frontend developer' },
  { name: 'JSearch: Backend Developer', platform: 'jsearch', boardToken: 'backend developer' },
  { name: 'JSearch: Full Stack Developer', platform: 'jsearch', boardToken: 'full stack developer' },
  { name: 'JSearch: Data Scientist', platform: 'jsearch', boardToken: 'data scientist' },
  { name: 'JSearch: DevOps Engineer', platform: 'jsearch', boardToken: 'devops engineer' },
  { name: 'JSearch: Product Manager', platform: 'jsearch', boardToken: 'product manager' },
  { name: 'JSearch: UX Designer', platform: 'jsearch', boardToken: 'ux designer' },
  { name: 'JSearch: Machine Learning', platform: 'jsearch', boardToken: 'machine learning engineer' },
  { name: 'JSearch: Mobile Developer', platform: 'jsearch', boardToken: 'mobile developer' },
  // TheirStack (largest job + technographic database) — requires THEIRSTACK_API_KEY in .env
  // boardToken format: "title1,title2" or "title1,title2::pages" or "title1,title2::pages::country"
  { name: 'TheirStack: Software Engineer', platform: 'theirstack', boardToken: 'software engineer' },
  { name: 'TheirStack: Frontend Developer', platform: 'theirstack', boardToken: 'frontend developer,react developer' },
  { name: 'TheirStack: Backend Developer', platform: 'theirstack', boardToken: 'backend developer,backend engineer' },
  { name: 'TheirStack: Full Stack', platform: 'theirstack', boardToken: 'full stack developer,full stack engineer' },
  { name: 'TheirStack: Data Scientist', platform: 'theirstack', boardToken: 'data scientist,data analyst' },
  { name: 'TheirStack: DevOps/SRE', platform: 'theirstack', boardToken: 'devops engineer,site reliability engineer' },
  { name: 'TheirStack: Product Manager', platform: 'theirstack', boardToken: 'product manager' },
  { name: 'TheirStack: UX Designer', platform: 'theirstack', boardToken: 'ux designer,product designer' },
  { name: 'TheirStack: ML Engineer', platform: 'theirstack', boardToken: 'machine learning engineer,ai engineer' },
  { name: 'TheirStack: Mobile Developer', platform: 'theirstack', boardToken: 'mobile developer,ios developer,android developer' },

  // ─── Hacker News "Who's Hiring" (free, public Algolia API) ───
  // Posted by user `whoishiring` on the first weekday of every month.
  // boardToken: "monthly" auto-detects the latest thread; "thread:<itemId>"
  // pins to a specific historical thread for backfill.
  { name: 'Hacker News: Who is Hiring', platform: 'hn_hiring', boardToken: 'monthly' },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Add new ENUM values for PostgreSQL (safe — IF NOT EXISTS)
    try {
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'remoteok'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'adzuna'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'jsearch'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'theirstack'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'ashby'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'wwr'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'hn_hiring'`);
      await sequelize.query(`ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'jsearch'`);
      await sequelize.query(`ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'theirstack'`);
      await sequelize.query(`ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'ashby'`);
      await sequelize.query(`ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'wwr'`);
      await sequelize.query(`ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'hn_hiring'`);
      console.log('Platform ENUM values updated.');
    } catch (e) {
      // ENUM values may already exist or table may not exist yet
      console.log('ENUM update skipped (may already exist):', e.message);
    }

    // Schema sync is OPT-IN. On production we manage schema via migrations
    // (npm run init-db) — do not silently alter columns on every seed.
    // Set SEED_ALLOW_SCHEMA_SYNC=true to enable for local/dev only.
    if (process.env.SEED_ALLOW_SCHEMA_SYNC === 'true') {
      console.log('SEED_ALLOW_SCHEMA_SYNC=true → running sequelize.sync({ alter: true })');
      await sequelize.sync({ alter: true });
    } else {
      console.log('Skipping sequelize.sync (set SEED_ALLOW_SCHEMA_SYNC=true to enable).');
    }

    let created = 0;
    let skipped = 0;

    for (const board of SEED_BOARDS) {
      const [, wasCreated] = await ATSBoard.findOrCreate({
        where: { platform: board.platform, boardToken: board.boardToken },
        defaults: { name: board.name, isActive: true }
      });
      if (wasCreated) {
        created++;
        console.log(`  + ${board.name} (${board.platform}/${board.boardToken})`);
      } else {
        skipped++;
        console.log(`  ~ ${board.name} already exists, skipped`);
      }
    }

    console.log(`\nSeeded ${created} boards (${skipped} already existed).`);

    // Run initial sync
    console.log('\nRunning initial sync for all boards...');
    const result = await syncAllBoards();
    console.log(`Sync complete: ${result.totalJobs} total jobs across ${result.boardsSynced} boards.`);

    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
