/**
 * Refreshes interview library entries by hand and prints what it cost.
 *
 *   node scripts/refreshInterviewLibrary.js --only google,stripe --roles frontend --max 3
 *   node scripts/refreshInterviewLibrary.js --dry-run --max 60        # what would be refreshed
 *
 * It writes to the database this machine's .env points at. On a laptop that is the LOCAL database,
 * so it measures cost but does not fill production; production is filled by the scheduler
 * (INTERVIEW_LIBRARY_AUTO=true on Render). Every entry spends real search and model budget.
 */
require('dotenv').config();

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : null; };
const list = (v) => (v ? v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : null);

/* Count calls to the search provider so the run can be priced. */
const hosts = {};
const realFetch = global.fetch;
global.fetch = (url, ...rest) => {
  try { const h = new URL(typeof url === 'string' ? url : url.url).hostname; hosts[h] = (hosts[h] || 0) + 1; } catch { /* not a URL */ }
  return realFetch(url, ...rest);
};

/* Sum the model tokens the AI wrapper logs. */
const tokens = { byModel: {} };
const realLog = console.log;
console.log = (...a) => {
  const line = String(a[0] || '');
  const m = /^\[ai-usage\] \S+ model=(\S+) input=(\d+) cache_read=(\d+) cache_write=(\d+) output=(\d+)/.exec(line);
  if (m) {
    const t = tokens.byModel[m[1]] || (tokens.byModel[m[1]] = { input: 0, output: 0 });
    t.input += Number(m[2]) + Number(m[3]) + Number(m[4]);
    t.output += Number(m[5]);
    return undefined;
  }
  return realLog(...a);
};

(async () => {
  const models = require('../models');
  const { companyKeyOf, roleKeyOf } = require('../services/interviewPrepService');
  const { getSharedService } = require('../services/interviewPrepRuntime');
  const { refreshLibrary } = require('../services/interviewLibrary');
  const started = Date.now();
  const results = await refreshLibrary({
    service: getSharedService(), models,
    keysOf: (e) => ({ companyKey: companyKeyOf(e.company), roleKey: roleKeyOf(e.jobTitle) }),
    only: list(arg('only')), roles: list(arg('roles')), max: Number(arg('max')) || 3, dryRun: process.argv.includes('--dry-run'), log: realLog,
  });
  realLog(`\nDone: ${results.length} entr${results.length === 1 ? 'y' : 'ies'} in ${Math.round((Date.now() - started) / 1000)}s`);
  realLog('Search and API calls by host:', hosts);
  const price = { 'claude-haiku-4-5': [1, 5], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] };
  let usd = 0;
  for (const [model, t] of Object.entries(tokens.byModel)) {
    const [pi, po] = price[model] || [2, 10];
    const cost = (t.input * pi + t.output * po) / 1e6;
    usd += cost;
    realLog(`  ${model}: ${t.input} input, ${t.output} output tokens, about $${cost.toFixed(3)}`);
  }
  realLog(`Model cost about $${usd.toFixed(3)} (search provider calls above are billed separately by the provider)`);
  process.exit(0);
})().catch((e) => { realLog(e); process.exit(1); });
