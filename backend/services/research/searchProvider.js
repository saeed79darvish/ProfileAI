/**
 * Search provider layer for web research.
 *
 * One interface, two vendors:
 *   search({ query, includeDomains?, days, maxResults })
 *     -> [{ title, url, site, publishedAt|null, content }]
 *
 * Chosen by SEARCH_PROVIDER ('tavily' default, or 'exa'). When the chosen
 * provider's key is missing, getSearch() throws code 'search_not_configured'
 * (status 503) so only the features that need search report it.
 *
 * We use only the text the search API returns. Nothing here fetches a result's
 * page. Keys are read from env and never logged.
 */

const TIMEOUT_MS = 20000;
const FULL_TEXT_CHARS = 8000;

const notConfigured = (message) => Object.assign(new Error(message), { status: 503, code: 'search_not_configured' });

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};

const toIso = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const cleanContent = (text) => String(text || '').replace(/\s+/g, ' ').trim();

/** POST JSON with a 20 s timeout and one retry on a 5xx or a network failure. */
async function postJson(fetchImpl, url, { headers = {}, body }, timeoutMs = TIMEOUT_MS) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.status >= 500) {
        lastErr = Object.assign(new Error(`search provider returned ${res.status}`), { status: 502, code: 'search_failed' });
        continue;
      }
      if (!res.ok) {
        throw Object.assign(new Error(`search provider returned ${res.status}`), { status: 502, code: 'search_failed', providerStatus: res.status });
      }
      return await res.json();
    } catch (err) {
      if (err && err.code === 'search_failed' && err.providerStatus) throw err;
      lastErr = err && err.code ? err : Object.assign(new Error(`search request failed: ${err && err.name === 'AbortError' ? 'timeout' : (err && err.message) || 'error'}`), { status: 502, code: 'search_failed' });
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

function normalizeTavily(json) {
  const rows = Array.isArray(json && json.results) ? json.results : [];
  return rows
    .filter((r) => r && r.url)
    .map((r) => ({
      title: String(r.title || '').trim(),
      url: String(r.url),
      site: hostOf(r.url),
      publishedAt: toIso(r.published_date || r.publishedDate),
      // A forum search asks for the whole page (the thread and its comments): a snippet of a Reddit
      // post rarely holds the questions, and a source nobody can cite never reaches the list.
      content: cleanContent(r.raw_content || r.content).slice(0, FULL_TEXT_CHARS),
    }));
}

function normalizeExa(json) {
  const rows = Array.isArray(json && json.results) ? json.results : [];
  return rows
    .filter((r) => r && r.url)
    .map((r) => ({
      title: String(r.title || '').trim(),
      url: String(r.url),
      site: hostOf(r.url),
      publishedAt: toIso(r.publishedDate),
      content: cleanContent(r.text || (Array.isArray(r.highlights) ? r.highlights.join(' ') : '')),
    }));
}

function createTavily({ apiKey, fetchImpl = (...a) => fetch(...a), timeoutMs } = {}) {
  return {
    name: 'tavily',
    async search({ query, includeDomains, days = 365, maxResults = 8, fullText = false }) {
      const body = {
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        max_results: maxResults,
        include_raw_content: !!fullText,
        days,
      };
      if (Array.isArray(includeDomains) && includeDomains.length) body.include_domains = includeDomains;
      return normalizeTavily(await postJson(fetchImpl, 'https://api.tavily.com/search', { body }, timeoutMs));
    },
  };
}

function createExa({ apiKey, fetchImpl = (...a) => fetch(...a), timeoutMs, now = () => Date.now() } = {}) {
  return {
    name: 'exa',
    async search({ query, includeDomains, days = 365, maxResults = 8, fullText = false }) {
      const body = {
        query,
        useAutoprompt: true,
        numResults: maxResults,
        startPublishedDate: new Date(now() - days * 86400000).toISOString(),
        contents: { text: { maxCharacters: fullText ? FULL_TEXT_CHARS : 2000 } },
      };
      if (Array.isArray(includeDomains) && includeDomains.length) body.includeDomains = includeDomains;
      return normalizeExa(await postJson(fetchImpl, 'https://api.exa.ai/search', { headers: { 'x-api-key': apiKey }, body }, timeoutMs));
    },
  };
}

/**
 * Which provider to use: 'tavily' | 'exa' | 'anthropic'.
 * SEARCH_PROVIDER forces one (its key must be set). Otherwise the first key
 * found wins: Tavily, then Exa, then ANTHROPIC_API_KEY (Claude web search).
 * Throws search_not_configured when nothing is usable.
 */
function resolveProviderName(env = process.env) {
  const keyFor = { tavily: env.TAVILY_API_KEY, exa: env.EXA_API_KEY, anthropic: env.ANTHROPIC_API_KEY };
  const forced = String(env.SEARCH_PROVIDER || '').toLowerCase();
  if (forced) {
    if (!(forced in keyFor)) throw notConfigured(`Unknown SEARCH_PROVIDER "${forced}".`);
    if (!keyFor[forced]) throw notConfigured(`Interview research is not configured (key for ${forced} missing).`);
    return forced;
  }
  if (keyFor.tavily) return 'tavily';
  if (keyFor.exa) return 'exa';
  if (keyFor.anthropic) return 'anthropic';
  throw notConfigured('Interview research is not configured (set ANTHROPIC_API_KEY, TAVILY_API_KEY or EXA_API_KEY).');
}

/** A raw search provider (tavily or exa), or throws search_not_configured. */
function getProvider(env = process.env, fetchImpl) {
  const which = resolveProviderName(env);
  if (which === 'exa') return createExa({ apiKey: env.EXA_API_KEY, fetchImpl });
  if (which === 'tavily') return createTavily({ apiKey: env.TAVILY_API_KEY, fetchImpl });
  throw notConfigured('The anthropic provider researches in one call and has no raw search.');
}

/** The search function: search(opts) -> results. Throws search_not_configured. */
function getSearch(env = process.env, fetchImpl) {
  const provider = getProvider(env, fetchImpl);
  return (opts) => provider.search(opts);
}

function isSearchConfigured(env = process.env) {
  try { resolveProviderName(env); return true; } catch { return false; }
}

module.exports = {
  createTavily, createExa, getProvider, getSearch, isSearchConfigured, resolveProviderName,
  normalizeTavily, normalizeExa, hostOf, toIso,
};
