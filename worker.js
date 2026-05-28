// Cloudflare Worker entry:
// 1. Proxy `/api/*` requests to the Render-hosted backend so the SPA can keep
//    using same-origin URLs (and avoids CORS / cookie issues).
// 2. Serve static assets from the frontend build for everything else, falling
//    back to /index.html for SPA client-side routes.
// 3. For known search-engine + AI crawlers, rewrite per-route <title>,
//    <meta description>, canonical, and OG tags on the SPA shell so that
//    bots which do NOT execute JavaScript still get unique, indexable
//    metadata for each public route.

const BACKEND_ORIGIN = 'https://api.profilleai.com';
const SITE_URL = 'https://www.profilleai.com';

// User-agent fragments matched case-insensitively. Includes major search
// engines and AI/answer-engine crawlers (GPTBot, ClaudeBot, PerplexityBot,
// Bingbot, Google-Extended, etc.) so those bots receive prerendered meta.
const BOT_UA_RE = /(googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|sogou|exabot|facebot|facebookexternalhit|twitterbot|linkedinbot|slackbot|telegrambot|whatsapp|discordbot|applebot|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|perplexity-user|google-extended|ccbot|bytespider|cohere-ai|youbot|meta-externalagent|amazonbot|petalbot|semrushbot|ahrefsbot|mj12bot)/i;

// Per-route SEO overrides. Add an entry per indexable public route.
const ROUTE_META = {
  '/': {
    title: 'ProfilleAI — AI Resume Tailoring, Auto-Apply & Negotiation Coach',
    description:
      'Tailor your resume to any job in seconds, auto-apply with the ApplyPilot Chrome extension, and practice salary negotiation with AI agents — all from your single ProfilleAI profile.',
  },
  '/pricing': {
    title: 'Pricing — Free, Pro & Enterprise Plans | ProfilleAI',
    description:
      'Simple pricing for ProfilleAI. Start free with AI resume tailoring; upgrade to Pro for unlimited tailoring, ApplyPilot auto-apply, and AI negotiation coaching.',
  },
  '/apply-pilot': {
    title: 'ApplyPilot — AI Job Auto-Apply Chrome Extension | ProfilleAI',
    description:
      'ApplyPilot is the ProfilleAI Chrome extension that auto-applies to 99% of jobs on LinkedIn, Indeed, Greenhouse, Lever, and Workday. You just review and approve.',
  },
  '/applypilot': {
    title: 'ApplyPilot — AI Job Auto-Apply Chrome Extension | ProfilleAI',
    description:
      'ApplyPilot is the ProfilleAI Chrome extension that auto-applies to 99% of jobs on LinkedIn, Indeed, Greenhouse, Lever, and Workday.',
  },
  '/jobs': {
    title: 'Browse Jobs — Curated Roles with AI Matching | ProfilleAI',
    description:
      'Browse jobs curated for your profile. ProfilleAI ranks every role by fit, surfaces AI-suggested resume edits, and lets you apply in one click with ApplyPilot.',
  },
  '/browse-profiles': {
    title: 'Browse Candidate Profiles — AI Recruiter Matching | ProfilleAI',
    description:
      'Recruiters: discover vetted candidates with AI-ranked matches, resume keyword highlights, and one-click outreach. Candidates: get found by hiring teams.',
  },
  '/feed': {
    title: 'Career Feed — Community, Polls & Achievements | ProfilleAI',
    description:
      'The ProfilleAI career feed: real wins, polls, and conversations from candidates, recruiters, and founders shaping the future of hiring.',
  },
  '/blog': {
    title: 'Blog — AI Career, Resume & Negotiation Insights | ProfilleAI',
    description:
      'Guides on AI resume tailoring, auto-applying to jobs, salary negotiation, and how candidates and recruiters win with AI.',
  },
  '/login': {
    title: 'Log in | ProfilleAI',
    description: 'Log in to your ProfilleAI account.',
  },
  '/register': {
    title: 'Create your free ProfilleAI account',
    description:
      'Sign up free to tailor your resume with AI, auto-apply to jobs, and practice salary negotiation with AI agents.',
  },
  '/privacy-policy': {
    title: 'Privacy Policy | ProfilleAI',
    description: 'How ProfilleAI collects, uses, and protects your data.',
  },
  '/terms-of-service': {
    title: 'Terms of Service | ProfilleAI',
    description: 'The terms governing your use of ProfilleAI.',
  },
};

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Use Cloudflare's HTMLRewriter to inject route-specific meta into the
// static SPA shell without re-parsing or buffering the body.
function rewriteHtmlForBot(response, meta, canonicalUrl) {
  const title = htmlEscape(meta.title);
  const description = htmlEscape(meta.description);
  const canonical = htmlEscape(canonicalUrl);

  return new HTMLRewriter()
    .on('title', {
      element(el) { el.setInnerContent(title); },
    })
    .on('meta[name="description"]', {
      element(el) { el.setAttribute('content', description); },
    })
    .on('meta[property="og:title"]', {
      element(el) { el.setAttribute('content', title); },
    })
    .on('meta[property="og:description"]', {
      element(el) { el.setAttribute('content', description); },
    })
    .on('meta[property="og:url"]', {
      element(el) { el.setAttribute('content', canonical); },
    })
    .on('meta[name="twitter:title"]', {
      element(el) { el.setAttribute('content', title); },
    })
    .on('meta[name="twitter:description"]', {
      element(el) { el.setAttribute('content', description); },
    })
    .on('link[rel="canonical"]', {
      element(el) { el.setAttribute('href', canonical); },
    })
    .transform(response);
}

// Detect requests for hashed build artifacts. Cloudflare must serve a real
// 404 for these (never the SPA fallback) so that:
//   - lazyWithReload() can detect chunk-load failures and force a reload, and
//   - the browser never receives an HTML body under a `.js`/`.css` URL,
//     which trips the strict-MIME script-loader and breaks the page.
const ASSET_PREFIXES = ['/assets/', '/static/'];
const ASSET_EXTENSIONS = /\.(js|mjs|css|map|woff2?|ttf|otf|eot|svg|png|jpe?g|gif|webp|ico|json|txt|wasm|webmanifest)$/i;

function isAssetRequest(pathname) {
  if (ASSET_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return ASSET_EXTENSIONS.test(pathname);
}

// Patch headers on a response without consuming the body. Used to force
// browsers to revalidate index.html on every refresh so stale HTML (which
// references obsolete hashed chunks) cannot survive a deploy.
function withHeaders(response, headers) {
  const next = new Response(response.body, response);
  for (const [k, v] of Object.entries(headers)) next.headers.set(k, v);
  return next;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- API proxy ----
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      const upstream = new URL(url.pathname + url.search, BACKEND_ORIGIN);
      const hasBody = !['GET', 'HEAD'].includes(request.method);
      // Reuse the original method, headers and body. Keep redirects manual so
      // they're passed back to the browser unchanged.
      // NOTE: when forwarding a streaming body in Cloudflare Workers we MUST
      // set `duplex: 'half'`, otherwise the body is silently dropped — this
      // was the cause of multipart/form-data uploads (resume, profile image)
      // arriving at the backend with no file payload and returning 500.
      const init = {
        method: request.method,
        headers: request.headers,
        body: hasBody ? request.body : undefined,
        redirect: 'manual',
      };
      if (hasBody) init.duplex = 'half';
      return fetch(new Request(upstream.toString(), init));
    }

    // ---- Static asset / SPA fallback ----
    const ua = request.headers.get('user-agent') || '';
    const isBot = BOT_UA_RE.test(ua);
    const canonicalUrl = `${SITE_URL}${url.pathname}`;

    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404) {
      // Force HTML documents to revalidate on every load. Hashed JS/CSS
      // assets keep their long-lived immutable caching (set by the static
      // assets binding) since their URLs change on every build.
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        let html = withHeaders(response, {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        });
        const meta = ROUTE_META[url.pathname];
        if (isBot && meta) {
          html = rewriteHtmlForBot(html, meta, canonicalUrl);
        }
        return html;
      }
      return response;
    }

    // 404 from the static binding. For hashed assets we MUST surface the 404
    // so lazyWithReload triggers a reload — never serve index.html under a
    // `.js`/`.css` URL.
    if (isAssetRequest(url.pathname)) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // SPA fallback for client-side routes.
    url.pathname = '/index.html';
    const fallback = await env.ASSETS.fetch(new Request(url.toString(), request));
    let withCache = withHeaders(fallback, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    // Bot hitting a client-side route: rewrite meta if we have an entry,
    // otherwise leave the global defaults from index.html in place (still
    // far better than the old empty shell).
    const meta = ROUTE_META[new URL(request.url).pathname];
    if (isBot && meta) {
      withCache = rewriteHtmlForBot(withCache, meta, canonicalUrl);
    }
    return withCache;
  },
};

