/**
 * Canonical list of ATS boards to ensure exist in the database.
 *
 * Shared by:
 *   - scripts/seedATSBoards.js        (manual seed + immediate sync)
 *   - scripts/migrations/ensureSeedBoards.js (boot-time idempotent ensure)
 *
 * All free / no-auth platforms (greenhouse, lever, ashby, remoteok, wwr,
 * hn_hiring) are safe to ensure on every boot. Keyed/paid platforms
 * (jsearch, theirstack, adzuna) only produce jobs when their API keys are
 * present, but creating the board rows is harmless (the fetcher no-ops
 * without a key).
 *
 * Greenhouse / Lever / Ashby company tokens added in the 2026-06 expansion
 * were each validated against the live public API before being added
 * (see scripts/validateBoardCandidates.js) — every entry returned > 0 jobs.
 */
const SEED_BOARDS = [
  // ─── Greenhouse companies (verified working) ───
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

  // ─── Greenhouse companies (2026-06 expansion, validated live) ───
  { name: 'Affirm', platform: 'greenhouse', boardToken: 'affirm' },
  { name: 'Roblox', platform: 'greenhouse', boardToken: 'roblox' },
  { name: 'Gemini', platform: 'greenhouse', boardToken: 'gemini' },
  { name: 'Block', platform: 'greenhouse', boardToken: 'block' },
  { name: 'SoFi', platform: 'greenhouse', boardToken: 'sofi' },
  { name: 'Carta', platform: 'greenhouse', boardToken: 'carta' },
  { name: 'Vercel', platform: 'greenhouse', boardToken: 'vercel' },
  { name: 'Grafana Labs', platform: 'greenhouse', boardToken: 'grafanalabs' },
  { name: 'Fastly', platform: 'greenhouse', boardToken: 'fastly' },
  { name: 'Webflow', platform: 'greenhouse', boardToken: 'webflow' },
  { name: 'Calendly', platform: 'greenhouse', boardToken: 'calendly' },
  { name: 'Lattice', platform: 'greenhouse', boardToken: 'lattice' },
  { name: 'Customer.io', platform: 'greenhouse', boardToken: 'customerio' },
  { name: 'Mixpanel', platform: 'greenhouse', boardToken: 'mixpanel' },
  { name: 'Amplitude', platform: 'greenhouse', boardToken: 'amplitude' },
  { name: 'Toast', platform: 'greenhouse', boardToken: 'toast' },
  { name: 'Squarespace', platform: 'greenhouse', boardToken: 'squarespace' },
  { name: 'Peloton', platform: 'greenhouse', boardToken: 'peloton' },
  { name: 'Glossier', platform: 'greenhouse', boardToken: 'glossier' },
  { name: 'Sweetgreen', platform: 'greenhouse', boardToken: 'sweetgreen' },
  { name: 'Nextdoor', platform: 'greenhouse', boardToken: 'nextdoor' },
  { name: 'ClassPass', platform: 'greenhouse', boardToken: 'classpass' },
  { name: 'The Trade Desk', platform: 'greenhouse', boardToken: 'thetradedesk' },
  { name: 'Wing', platform: 'greenhouse', boardToken: 'wing' },
  { name: 'Lucid Motors', platform: 'greenhouse', boardToken: 'lucidmotors' },
  { name: 'Faire', platform: 'greenhouse', boardToken: 'faire' },
  { name: 'Oscar Health', platform: 'greenhouse', boardToken: 'oscar' },
  { name: 'Recursion', platform: 'greenhouse', boardToken: 'recursionpharmaceuticals' },
  { name: 'Pendo', platform: 'greenhouse', boardToken: 'pendo' },
  { name: 'Smartsheet', platform: 'greenhouse', boardToken: 'smartsheet' },
  { name: 'Greenhouse', platform: 'greenhouse', boardToken: 'greenhouse' },
  { name: 'Checkr', platform: 'greenhouse', boardToken: 'checkr' },
  { name: 'Mercury', platform: 'greenhouse', boardToken: 'mercury' },
  { name: 'Pilot', platform: 'greenhouse', boardToken: 'pilothq' },
  { name: 'Tailscale', platform: 'greenhouse', boardToken: 'tailscale' },
  { name: 'Postman', platform: 'greenhouse', boardToken: 'postman' },
  { name: 'Fivetran', platform: 'greenhouse', boardToken: 'fivetran' },

  // ─── Aggregator sources (no per-company board tokens needed) ───
  { name: 'RemoteOK', platform: 'remoteok', boardToken: 'remoteok' },
  // (Adzuna intentionally not seeded — required keys (ADZUNA_APP_ID +
  // ADZUNA_APP_KEY) we don't currently have. The fetcher code remains
  // available in externalJobService.js if you decide to re-enable later.)

  // ─── Lever companies (public API, no auth) ───
  { name: 'Spotify', platform: 'lever', boardToken: 'spotify' },
  { name: 'JumpCloud', platform: 'lever', boardToken: 'jumpcloud' },
  { name: 'Clari', platform: 'lever', boardToken: 'clari' },
  // Lever expansion (2026-06, validated live)
  { name: 'Palantir', platform: 'lever', boardToken: 'palantir' },
  { name: 'Veeva', platform: 'lever', boardToken: 'veeva' },

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
  // Ashby expansion (2026-06, validated live)
  { name: 'Modal', platform: 'ashby', boardToken: 'modal' },
  { name: 'Baseten', platform: 'ashby', boardToken: 'baseten' },
  { name: 'Pinecone', platform: 'ashby', boardToken: 'pinecone' },
  { name: 'Mux', platform: 'ashby', boardToken: 'mux' },
  { name: 'Vapi', platform: 'ashby', boardToken: 'vapi' },
  { name: 'Browserbase', platform: 'ashby', boardToken: 'browserbase' },
  { name: 'Sierra', platform: 'ashby', boardToken: 'sierra' },
  { name: 'Decagon', platform: 'ashby', boardToken: 'decagon' },
  { name: 'Harvey', platform: 'ashby', boardToken: 'harvey' },
  { name: 'Abridge', platform: 'ashby', boardToken: 'abridge' },
  { name: 'Watershed', platform: 'ashby', boardToken: 'watershed' },
  { name: 'Mercor', platform: 'ashby', boardToken: 'mercor' },
  { name: 'ElevenLabs', platform: 'ashby', boardToken: 'elevenlabs' },

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

module.exports = { SEED_BOARDS };
