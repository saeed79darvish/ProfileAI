/**
 * MCP "App" layer — turns tool results into an interactive UI resource that
 * Claude renders in its sandboxed iframe (see backend/mcp/ui/).
 *
 * Each app-enabled tool returns:
 *   - content: a markdown text fallback + an EMBEDDED html resource whose HTML
 *     has this call's data baked in (window.__MCP_DATA__), so the widget is
 *     fully self-contained and needs no host data-injection API.
 *   - structuredContent: the machine-readable data (per the tool contract).
 *   - _meta: a reference to the ui:// resource (Apps-SDK / MCP-UI style hosts).
 *
 * The widget never navigates; its buttons post a "link" intent to the host,
 * which opens the deep link in a new tab — carrying the user back to
 * ProfilleAI's AI tools for that job/resume.
 */

const fs = require('fs');
const path = require('path');

const FRONTEND = (process.env.FRONTEND_URL || 'https://www.profilleai.com').replace(/\/$/, '');
const UTM = 'utm_source=claude&utm_medium=mcp&utm_campaign=connector';
const WIDGET_URI = 'ui://widgets/profileai-cards.html';

// Load the built widget once. `npm run build:mcp-ui` (esbuild) produces this.
const DIST = path.join(__dirname, 'ui', 'dist', 'cards.html');
let baseHtmlCache = null;
function baseHtml() {
  if (baseHtmlCache == null) {
    try {
      baseHtmlCache = fs.readFileSync(DIST, 'utf8');
    } catch (err) {
      console.error('[mcp-apps] missing built widget (run backend/mcp/ui/build.mjs):', err.message);
      baseHtmlCache = '<!doctype html><body>Widget unavailable.</body>';
    }
  }
  return baseHtmlCache;
}

/** Inject this call's data into the widget HTML (XSS-safe for a <script> tag). */
function widgetHtml(data) {
  const json = JSON.stringify(data || {}).replace(/</g, '\\u003c');
  return baseHtml().replace(
    '<!--__MCP_DATA__-->',
    `<script>window.__MCP_DATA__=${json};</script>`,
  );
}

// ---- deep links (always route back into the platform) ----
function withUtm(pathAndQuery) {
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  return `${FRONTEND}${pathAndQuery}${sep}${UTM}`;
}
function jobDeepLink(jobId) {
  // External job ids resolve on the /jobs list page (via ?jobId=), not
  // /jobs/:id. `tailor=1` opens the AI resume-tailoring flow on arrival.
  return withUtm(`/jobs?jobId=${encodeURIComponent(jobId)}&tailor=1`);
}
function resumeDeepLink(id) {
  return withUtm(`/profile?tailored=${encodeURIComponent(id)}`);
}
function portfolioDeepLink() {
  return withUtm('/profile');
}

function truncate(str, n = 140) {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function salaryRange(job) {
  const cur = job.salaryCurrency || 'USD';
  const fmt = (v) => new Intl.NumberFormat('en-US').format(v);
  if (job.salaryMin && job.salaryMax) return `${cur} ${fmt(job.salaryMin)}–${fmt(job.salaryMax)}`;
  if (job.salaryMin || job.salaryMax) return `${cur} ${fmt(job.salaryMin || job.salaryMax)}`;
  return null;
}

/**
 * Assemble an app-enabled tool result.
 * @param {object} opts
 * @param {string} opts.fallbackText - markdown shown by hosts that can't render the app
 * @param {object} opts.data - the object baked into window.__MCP_DATA__ (drives the widget)
 * @param {object} opts.structuredContent - machine-readable result
 */
function appResult({ fallbackText, data, structuredContent }) {
  return {
    content: [
      { type: 'text', text: fallbackText },
      {
        type: 'resource',
        resource: {
          uri: WIDGET_URI,
          mimeType: 'text/html',
          text: widgetHtml(data),
        },
      },
    ],
    structuredContent,
    _meta: {
      'openai/outputTemplate': WIDGET_URI,
      'mcpui.dev/ui-resource-uri': WIDGET_URI,
    },
  };
}

/** Register the static ui:// resource (data-less base) for hosts that read _meta. */
function registerAppResource(server) {
  server.registerResource(
    'profileai-cards',
    WIDGET_URI,
    {
      title: 'ProfilleAI cards',
      description: 'Interactive job / portfolio / resume cards for ProfilleAI.',
      mimeType: 'text/html',
    },
    async () => ({
      contents: [{ uri: WIDGET_URI, mimeType: 'text/html', text: baseHtml() }],
    }),
  );
}

module.exports = {
  WIDGET_URI,
  appResult,
  registerAppResource,
  jobDeepLink,
  resumeDeepLink,
  portfolioDeepLink,
  salaryRange,
  truncate,
};
