/**
 * Board Discovery Script — finds working Greenhouse, Lever, and Ashby boards from a curated company list.
 * Tests each company's public API endpoint and adds active boards to ATSBoards table.
 *
 * Usage: cd backend && node scripts/discoverBoards.js
 * Options:
 *   --dry-run    Only test APIs, don't save to DB
 *   --platform   Only test one platform (greenhouse, lever, ashby)
 */
require('dotenv').config();
const { sequelize, ATSBoard } = require('../models');

// Curated list of tech companies and their known ATS slugs
// Format: { name, slugs: { greenhouse?, lever?, ashby? } }
const COMPANIES = [
  // FAANG / Big Tech
  { name: 'Airbnb', slugs: { greenhouse: 'airbnb' } },
  { name: 'Coinbase', slugs: { greenhouse: 'coinbase' } },
  { name: 'Stripe', slugs: { greenhouse: 'stripe' } },
  { name: 'Discord', slugs: { greenhouse: 'discord' } },
  { name: 'Figma', slugs: { greenhouse: 'figma' } },
  { name: 'Datadog', slugs: { greenhouse: 'datadog' } },
  { name: 'MongoDB', slugs: { greenhouse: 'mongodb' } },
  { name: 'Cloudflare', slugs: { greenhouse: 'cloudflare' } },
  { name: 'Twitch', slugs: { greenhouse: 'twitch' } },
  { name: 'Pinterest', slugs: { greenhouse: 'pinterest' } },
  { name: 'Reddit', slugs: { greenhouse: 'reddit' } },
  { name: 'SpaceX', slugs: { greenhouse: 'spacex' } },
  { name: 'Anthropic', slugs: { greenhouse: 'anthropic' } },
  { name: 'Duolingo', slugs: { greenhouse: 'duolingo' } },

  // Lever companies (most have migrated away — these are verified working)
  { name: 'Spotify', slugs: { lever: 'spotify' } },
  { name: 'JumpCloud', slugs: { lever: 'jumpcloud' } },
  { name: 'Clari', slugs: { lever: 'clari' } },
  { name: 'Anyscale', slugs: { lever: 'anyscale' } },

  // Ashby companies (growing fast — many AI/dev-tool companies)
  { name: 'OpenAI', slugs: { ashby: 'openai' } },
  { name: 'Deel', slugs: { ashby: 'deel' } },
  { name: 'Notion', slugs: { ashby: 'notion' } },
  { name: 'Ramp', slugs: { ashby: 'ramp' } },
  { name: 'Cohere', slugs: { ashby: 'cohere' } },
  { name: 'ClickUp', slugs: { ashby: 'clickup' } },
  { name: 'Replit', slugs: { ashby: 'replit' } },
  { name: 'Perplexity', slugs: { ashby: 'perplexity' } },
  { name: 'Ashby', slugs: { ashby: 'ashby' } },
  { name: 'Supabase', slugs: { ashby: 'supabase' } },
  { name: 'Linear', slugs: { ashby: 'linear' } },
  { name: 'Oyster HR', slugs: { ashby: 'oyster' } },
  { name: 'Render', slugs: { ashby: 'render' } },
  { name: 'Railway', slugs: { ashby: 'railway' } },
  { name: 'Resend', slugs: { ashby: 'resend' } },
  { name: 'Neon', slugs: { ashby: 'neon' } },
  { name: 'Clerk', slugs: { ashby: 'clerk' } },
  { name: 'Axiom', slugs: { ashby: 'axiom' } },

  // Additional Greenhouse companies
  { name: 'Lyft', slugs: { greenhouse: 'lyft' } },
  { name: 'Robinhood', slugs: { greenhouse: 'robinhood' } },
  { name: 'Gusto', slugs: { greenhouse: 'gusto' } },
  { name: 'Asana', slugs: { greenhouse: 'asana' } },
  { name: 'Dropbox', slugs: { greenhouse: 'dropbox' } },
];

const ATS_URLS = {
  greenhouse: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
  lever: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json&limit=1`,
  ashby: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
};

async function testBoard(platform, slug) {
  try {
    const url = ATS_URLS[platform](slug);
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return { ok: false, status: response.status };

    const data = await response.json();

    let jobCount = 0;
    if (platform === 'greenhouse') {
      jobCount = data.jobs?.length || 0;
    } else if (platform === 'lever') {
      jobCount = Array.isArray(data) ? data.length : 0;
    } else if (platform === 'ashby') {
      jobCount = data.jobs?.length || 0;
    }

    return { ok: jobCount > 0, jobCount };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function discover() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const platformFilter = args.find(a => !a.startsWith('--'));

  if (!dryRun) {
    await sequelize.authenticate();
    console.log('Database connected.\n');

    // Ensure ENUM values exist
    for (const val of ['lever', 'ashby', 'wwr']) {
      try {
        await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS '${val}'`);
        await sequelize.query(`ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS '${val}'`);
      } catch (e) { /* already exists */ }
    }
  }

  const platforms = platformFilter ? [platformFilter] : ['greenhouse', 'lever', 'ashby'];
  const discovered = [];

  for (const company of COMPANIES) {
    for (const platform of platforms) {
      const slug = company.slugs[platform];
      if (!slug) continue;

      process.stdout.write(`  Testing ${platform}/${slug} (${company.name})... `);
      const result = await testBoard(platform, slug);

      if (result.ok) {
        console.log(`✓ ${result.jobCount} jobs`);
        discovered.push({ name: company.name, platform, boardToken: slug, jobCount: result.jobCount });
      } else {
        console.log(`✗ ${result.status || result.error || 'no jobs'}`);
      }

      await sleep(300); // Rate limit courtesy
    }
  }

  console.log(`\n${discovered.length} active boards discovered.\n`);

  if (!dryRun && discovered.length > 0) {
    let created = 0;
    for (const board of discovered) {
      const [, wasCreated] = await ATSBoard.findOrCreate({
        where: { platform: board.platform, boardToken: board.boardToken },
        defaults: { name: board.name, isActive: true }
      });
      if (wasCreated) {
        created++;
        console.log(`  + ${board.name} (${board.platform}/${board.boardToken})`);
      }
    }
    console.log(`\nAdded ${created} new boards to database.`);
  }

  if (!dryRun) process.exit(0);
}

discover().catch(err => {
  console.error('Discovery failed:', err);
  process.exit(1);
});
