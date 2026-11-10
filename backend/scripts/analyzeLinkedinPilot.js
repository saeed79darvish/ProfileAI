/**
 * Judges an export from the Apify LinkedIn jobs scraper before anything is built.
 *
 *   node scripts/analyzeLinkedinPilot.js /path/to/dataset.json
 *   node scripts/analyzeLinkedinPilot.js /path/to/dataset.json --offline     # skip the comparison with production
 *
 * Read only. The comparison asks production's public jobs search (no login, no AI) for each company's jobs,
 * about 60 requests with a short pause, and writes nothing anywhere.
 */
const fs = require('fs');
const { summarize, overlap } = require('../services/linkedinPilotAnalysis');

const file = process.argv[2];
if (!file || file.startsWith('--')) {
  console.error('Usage: node scripts/analyzeLinkedinPilot.js /path/to/dataset.json [--offline]');
  process.exit(1);
}

const API = process.env.PILOT_COMPARE_API || 'https://api.profilleai.com/api/external-jobs';

async function ourJobsFor(company) {
  const url = `${API}?search=${encodeURIComponent(company)}&limit=100`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return [];
    const body = await res.json();
    return (Array.isArray(body.jobs) ? body.jobs : []).map((j) => ({ title: j.title, company: j.company }));
  } catch { return []; }
}

(async () => {
  let jobs;
  try { jobs = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error(`Could not read ${file} as JSON: ${e.message}`); process.exit(1); }
  if (!Array.isArray(jobs)) jobs = Array.isArray(jobs.items) ? jobs.items : [];

  const s = summarize(jobs);
  console.log('\nThe export on its own');
  console.log(`  Jobs: ${s.jobs} (${s.uniqueIds} unique), from ${s.companies} companies`);
  console.log(`  Posted in the last 24 hours: ${s.postedWithin24h}%, in the last 7 days: ${s.postedWithin7d}%, age unknown: ${s.ageUnknown}%`);
  console.log(`  Real apply link: ${s.withApplyUrl}%, salary shown: ${s.withSalary}%, full description: ${s.withDescription}% (median ${s.medianDescriptionChars} characters)`);
  console.log(`  Company size known: ${s.sizeKnown}%, looks like a startup (under 200 people): ${s.startupLike}%`);
  console.log(`  Top places: ${s.topLocations.map(([l, c]) => `${l} ${c}`).join(', ')}`);

  if (process.argv.includes('--offline')) return;
  console.log('\nCompared with what we already have in production (public search, read only)');
  const o = await overlap(jobs, ourJobsFor);
  console.log(`  Companies checked: ${o.companiesChecked}. We already have jobs for ${o.companiesWeAlreadyHave}; ${o.companiesNewToUs} are new to us.`);
  console.log(`  Jobs checked: ${o.jobsChecked}. Already covered: ${o.alreadyCovered}%. New to us: ${o.newToUs}%.`);
  console.log(`  Startup-sized jobs checked: ${o.startupJobsChecked}, of which new to us: ${o.startupJobsNewToUs}`);
  console.log('  (Matching is by company and role title, so a reworded title counts as new. Treat the new share as an upper bound.)');
})();
