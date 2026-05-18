/**
 * ATS adapter registry.
 *
 * Each adapter exports `{ matches(url), submit(ctx), name }`.
 * `selectAdapter(url)` returns the first matching one, or null.
 *
 * For Greenhouse we keep TWO flavours:
 *   - greenhouse        · HTTP-only submission via Greenhouse's embed
 *                         endpoint. RETIRED by Greenhouse — both
 *                         boards.greenhouse.io/embed/job_app and
 *                         job-boards.greenhouse.io/embed/job_app now
 *                         return 404/405 for POST. Kept here as a
 *                         reference / opt-in via APPLYPILOT_GREENHOUSE_API=1
 *                         in case Greenhouse re-enables it.
 *   - greenhouse-puppeteer · drives headless Chrome end-to-end through
 *                         the rendered apply page. This is the only
 *                         working real-submission path today and is
 *                         the default regardless of APPLYPILOT_ATS_MODE.
 *
 * APPLYPILOT_ATS_MODE still toggles the OTHER adapters (lever, ashby,
 * workday, amazon) between api / puppeteer flavours where applicable.
 *   APPLYPILOT_ATS_MODE=api        → API/HTTP flavour (default)
 *   APPLYPILOT_ATS_MODE=puppeteer  → Puppeteer flavour for everything
 *
 * Order matters — put the most specific adapters first. The generic
 * adapter (Phase 3) goes last so it catches anything.
 */
const greenhouse = require('./greenhouse');
const greenhousePuppeteer = require('./greenhousePuppeteer');
const amazonPuppeteer = require('./amazonPuppeteer');
const leverPuppeteer  = require('./leverPuppeteer');
const ashbyPuppeteer  = require('./ashbyPuppeteer');
const ashby              = require('./ashby');    // kept as manual fallback reference
const workdayPuppeteer   = require('./workdayPuppeteer');
const workday            = require('./workday');  // kept as manual fallback reference
const generic            = require('./generic');

const atsMode = (process.env.APPLYPILOT_ATS_MODE || 'api').toLowerCase();
// Escape hatch: set APPLYPILOT_GREENHOUSE_API=1 to force the (currently
// broken) HTTP-only Greenhouse adapter. Default is the Puppeteer flow,
// which is the only path that still actually submits to Greenhouse.
const forceGreenhouseApi = ['1', 'true', 'yes'].includes(
  String(process.env.APPLYPILOT_GREENHOUSE_API || '').toLowerCase(),
);

function buildAdapters(mode = atsMode) {
  const isPuppeteer = mode === 'puppeteer';
  // Greenhouse: always use Puppeteer unless explicitly forced to API.
  const greenhouseAdapter = forceGreenhouseApi
    ? { name: 'greenhouse', ...greenhouse }
    : greenhousePuppeteer;

  if (isPuppeteer) {
    // Puppeteer mode includes screenshot-capable adapters only.
    return [greenhouseAdapter, amazonPuppeteer, leverPuppeteer, ashbyPuppeteer, workdayPuppeteer];
  }

  return [
    greenhouseAdapter,
    amazonPuppeteer,
    leverPuppeteer,
    ashbyPuppeteer,
    workdayPuppeteer,
    generic,
  ];
}

const adapters = buildAdapters();

function selectAdapter(url, options = {}) {
  if (!url) return null;
  const mode = options?.mode ? String(options.mode).toLowerCase() : atsMode;
  const list = mode === atsMode ? adapters : buildAdapters(mode);
  return list.find((a) => {
    try { return a.matches(url); } catch { return false; }
  }) || null;
}

module.exports = { selectAdapter, adapters };
