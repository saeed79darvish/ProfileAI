// Paths the SPA actually renders, so the worker can answer anything else with
// a real 404 status. The body is still the SPA shell either way: a path that's
// missing from this list only gets the wrong status for crawlers, it never
// breaks the page for a person. spaRoutes.test.js fails when a <Route> in
// App.jsx has no match here.
//
// `:param` matches one segment, a trailing `/*` matches any depth.
export const SPA_ROUTES = [
  '/',
  '/admin', '/admin/promos', '/admin/support', '/admin/users',
  '/agent-arena/*',
  '/applypilot', '/applypilot/*',
  '/auth/:provider/callback',
  '/blog', '/blog/:slug',
  '/browse',
  '/check-email',
  '/company/:slug',
  '/connect/claude',
  '/dashboard',
  '/extension', '/extension-auth-success',
  '/feed',
  '/forgot-password',
  '/help',
  '/integrations/claude',
  '/interviews',
  '/invite/:token',
  '/jobs', '/jobs/:id', '/jobs/:id/apply',
  '/login',
  '/messages', '/messages/:conversationId',
  '/my-jobs',
  '/network', '/network/:userId',
  '/notifications',
  '/onboarding',
  '/poll/:id', '/polls',
  '/pricing',
  '/privacy',
  '/profile', '/profile/:id', '/profile/create', '/profile/create-form',
  '/profile/edit', '/profile/preferences',
  '/recruiter-tools/:profileId',
  '/recruiter/:id', '/recruiter/calendar', '/recruiter/dashboard',
  '/recruiter/greenhouse', '/recruiter/imports', '/recruiter/interviews',
  '/recruiter/jobs', '/recruiter/jobs/:id/application-form',
  '/recruiter/jobs/:id/applications', '/recruiter/onboarding',
  '/recruiter/profile', '/recruiter/schedule-interview',
  '/register',
  '/reset-password/:token',
  '/resume/download',
  '/screen/:token',
  '/signup',
  '/subscription/success',
  '/terms',
  '/track',
  '/verify-email/:token',
];

// Old URLs that are still out in the world (the sitemap listed these until
// the routes were renamed). Permanent redirects keep their search ranking.
export const LEGACY_REDIRECTS = {
  '/privacy-policy': '/privacy',
  '/terms-of-service': '/terms',
};

function toRegExp(pattern) {
  if (pattern === '/') return /^\/$/;
  const splat = pattern.endsWith('/*');
  const body = (splat ? pattern.slice(0, -2) : pattern)
    .split('/')
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${body}${splat ? '(?:/.*)?' : ''}/?$`);
}

const MATCHERS = SPA_ROUTES.map(toRegExp);

export function isSpaRoute(pathname) {
  return MATCHERS.some((re) => re.test(pathname));
}
