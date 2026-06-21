/**
 * Throwaway validator: probe a candidate list of public ATS boards
 * (Greenhouse / Lever / Ashby) against their real public APIs and print
 * which return jobs, so we only seed verified, job-producing boards.
 *
 * Run: node scripts/validateBoardCandidates.js
 * Output: JSON array of { name, platform, boardToken, jobCount } for valid boards.
 */
const {
  fetchGreenhouseJobs,
  fetchLeverJobs,
  fetchAshbyJobs,
} = require('../services/externalJobService');

// Candidate companies with their best-guess public board slug.
const CANDIDATES = [
  // ─── Greenhouse ───
  ['DoorDash', 'greenhouse', 'doordash'],
  ['Snowflake', 'greenhouse', 'snowflake'],
  ['Affirm', 'greenhouse', 'affirm'],
  ['Plaid', 'greenhouse', 'plaid'],
  ['Roblox', 'greenhouse', 'roblox'],
  ['Unity', 'greenhouse', 'unity'],
  ['Niantic', 'greenhouse', 'niantic'],
  ['Benchling', 'greenhouse', 'benchling'],
  ['Gemini', 'greenhouse', 'gemini'],
  ['Kraken', 'greenhouse', 'kraken'],
  ['Block', 'greenhouse', 'block'],
  ['Wealthfront', 'greenhouse', 'wealthfront'],
  ['Nerdwallet', 'greenhouse', 'nerdwallet'],
  ['Sofi', 'greenhouse', 'sofi'],
  ['Carta', 'greenhouse', 'carta'],
  ['Rippling', 'greenhouse', 'rippling'],
  ['Vercel', 'greenhouse', 'vercel'],
  ['HashiCorp', 'greenhouse', 'hashicorp'],
  ['Confluent', 'greenhouse', 'confluent'],
  ['Grafana Labs', 'greenhouse', 'grafanalabs'],
  ['DigitalOcean', 'greenhouse', 'digitalocean'],
  ['Fastly', 'greenhouse', 'fastly'],
  ['Sentry', 'greenhouse', 'sentry'],
  ['Webflow', 'greenhouse', 'webflow'],
  ['Calendly', 'greenhouse', 'calendly'],
  ['Gong', 'greenhouse', 'gong'],
  ['Outreach', 'greenhouse', 'outreach'],
  ['Lattice', 'greenhouse', 'lattice'],
  ['Customerio', 'greenhouse', 'customerio'],
  ['Mixpanel', 'greenhouse', 'mixpanel'],
  ['Amplitude', 'greenhouse', 'amplitude'],
  ['Segment', 'greenhouse', 'segment'],
  ['Zapier', 'greenhouse', 'zapier'],
  ['Toast', 'greenhouse', 'toast'],
  ['Squarespace', 'greenhouse', 'squarespace'],
  ['Wayfair', 'greenhouse', 'wayfair'],
  ['Peloton', 'greenhouse', 'peloton'],
  ['Warby Parker', 'greenhouse', 'warbyparker'],
  [' Glossier', 'greenhouse', 'glossier'],
  ['Sweetgreen', 'greenhouse', 'sweetgreen'],
  ['Compass', 'greenhouse', 'compass'],
  ['Opendoor', 'greenhouse', 'opendoor'],
  ['Nextdoor', 'greenhouse', 'nextdoor'],
  ['Thumbtack', 'greenhouse', 'thumbtack'],
  ['Houzz', 'greenhouse', 'houzz'],
  ['Quora', 'greenhouse', 'quora'],
  ['Yelp', 'greenhouse', 'yelp'],
  ['Eventbrite', 'greenhouse', 'eventbrite'],
  ['ClassPass', 'greenhouse', 'classpass'],
  ['Bumble', 'greenhouse', 'bumble'],
  ['The Trade Desk', 'greenhouse', 'thetradedesk'],
  ['Cruise', 'greenhouse', 'cruise'],
  ['Aurora', 'greenhouse', 'aurora'],
  ['Zoox', 'greenhouse', 'zoox'],
  ['Wing', 'greenhouse', 'wing'],
  ['Rivian', 'greenhouse', 'rivian'],
  ['Lucid Motors', 'greenhouse', 'lucidmotors'],
  ['Faire', 'greenhouse', 'faire'],
  ['Whatnot', 'greenhouse', 'whatnot'],
  ['Gopuff', 'greenhouse', 'gopuff'],
  ['Hims & Hers', 'greenhouse', 'himsandhers'],
  ['Ro', 'greenhouse', 'ro'],
  ['Cedar', 'greenhouse', 'cedar'],
  ['Included Health', 'greenhouse', 'includedhealth'],
  ['Devoted Health', 'greenhouse', 'devotedhealth'],
  ['Oscar Health', 'greenhouse', 'oscar'],
  ['Color', 'greenhouse', 'color'],
  ['Tempus', 'greenhouse', 'tempus'],
  ['Recursion', 'greenhouse', 'recursionpharmaceuticals'],
  ['Pendo', 'greenhouse', 'pendo'],
  ['Smartsheet', 'greenhouse', 'smartsheet'],
  ['Greenhouse', 'greenhouse', 'greenhouse'],
  ['Checkr', 'greenhouse', 'checkr'],
  ['Newfront', 'greenhouse', 'newfront'],
  ['Mercury', 'greenhouse', 'mercury'],
  ['Modern Treasury', 'greenhouse', 'moderntreasury'],
  ['Pilot', 'greenhouse', 'pilothq'],
  ['Vanta', 'greenhouse', 'vanta'],
  ['Drata', 'greenhouse', 'drata'],
  ['1Password', 'greenhouse', '1password'],
  ['Tailscale', 'greenhouse', 'tailscale'],
  ['Postman', 'greenhouse', 'postman'],
  ['Airbyte', 'greenhouse', 'airbyte'],
  ['dbt Labs', 'greenhouse', 'dbtlabs'],
  ['Fivetran', 'greenhouse', 'fivetran'],
  ['Census', 'greenhouse', 'census'],
  ['Retool', 'greenhouse', 'retool'],

  // ─── Lever ───
  ['Netflix', 'lever', 'netflix'],
  ['Plaid (Lever)', 'lever', 'plaid'],
  ['KeepTruckin/Motive', 'lever', 'motive'],
  ['Brex (Lever)', 'lever', 'brex'],
  ['Attentive', 'lever', 'attentive'],
  ['Ramp (Lever)', 'lever', 'ramp'],
  ['Voleon', 'lever', 'voleon'],
  ['Palantir', 'lever', 'palantir'],
  ['Shopify', 'lever', 'shopify'],
  ['Fanatics', 'lever', 'fanatics'],
  ['Veeva', 'lever', 'veeva'],
  ['Quora (Lever)', 'lever', 'quora'],

  // ─── Ashby ───
  ['Anthropic (Ashby)', 'ashby', 'anthropic'],
  ['Hugging Face', 'ashby', 'huggingface'],
  ['Runway', 'ashby', 'runwayml'],
  ['Mistral AI', 'ashby', 'mistral'],
  ['Together AI', 'ashby', 'together'],
  ['Modal', 'ashby', 'modal'],
  ['Baseten', 'ashby', 'baseten'],
  ['Pinecone', 'ashby', 'pinecone'],
  ['Weights & Biases', 'ashby', 'wandb'],
  ['Hex', 'ashby', 'hex'],
  ['Mux', 'ashby', 'mux'],
  ['Liveblocks', 'ashby', 'liveblocks'],
  ['Vapi', 'ashby', 'vapi'],
  ['Browserbase', 'ashby', 'browserbase'],
  ['Cursor / Anysphere', 'ashby', 'anysphere'],
  ['Sierra', 'ashby', 'sierra'],
  ['Decagon', 'ashby', 'decagon'],
  ['Glean', 'ashby', 'glean'],
  ['Harvey', 'ashby', 'harvey'],
  ['Abridge', 'ashby', 'abridge'],
  ['Scale (Ashby)', 'ashby', 'scaleai'],
  ['Watershed', 'ashby', 'watershed'],
  ['Ramp (Ashby)', 'ashby', 'ramp'],
  ['Mercor', 'ashby', 'mercor'],
  ['ElevenLabs', 'ashby', 'elevenlabs'],
];

async function run() {
  const valid = [];
  for (const [name, platform, token] of CANDIDATES) {
    try {
      let jobs;
      if (platform === 'greenhouse') jobs = await fetchGreenhouseJobs(token);
      else if (platform === 'lever') jobs = await fetchLeverJobs(token);
      else if (platform === 'ashby') jobs = await fetchAshbyJobs(token);
      const n = Array.isArray(jobs) ? jobs.length : 0;
      if (n > 0) {
        valid.push({ name: name.trim(), platform, boardToken: token, jobCount: n });
        console.log(`OK   ${platform}/${token} → ${n}`);
      } else {
        console.log(`ZERO ${platform}/${token}`);
      }
    } catch (e) {
      console.log(`FAIL ${platform}/${token}: ${e.message}`);
    }
  }
  console.log('\n=== VALID BOARDS ===');
  console.log(JSON.stringify(valid, null, 2));
  console.log(`\nTotal valid: ${valid.length} / ${CANDIDATES.length}, jobs: ${valid.reduce((s, b) => s + b.jobCount, 0)}`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
