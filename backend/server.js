const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');

// Sentry must be initialized BEFORE any other imports so its instrumentation
// can patch express/http modules. No-op if SENTRY_DSN is unset (local dev).
const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: 0,
  });
}

const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');
const smartMatchRoutes = require('./routes/smartMatch');
const recruiterProfileRoutes = require('./routes/recruiterProfiles');
const projectRoutes = require('./routes/projects');
const subscriptionRoutes = require('./routes/subscriptions');
const { stripeWebhookHandler } = subscriptionRoutes;
const tailoredProfileRoutes = require('./routes/tailoredProfiles');
const resumeDownloadRoutes = require('./routes/resumeDownload');
const postRoutes = require('./routes/posts');
const followRoutes = require('./routes/follows');
const messageRoutes = require('./routes/messages');
const jobRoutes = require('./routes/jobs');
const agentArenaRoutes = require('./routes/agentArena');
const applyPilotRoutes = require('./routes/applyPilot');
const interviewRoutes = require('./routes/interviews');

const reputationRoutes = require('./routes/reputation');
const vapiWebhookRoutes = require('./routes/vapi');
const phoneScreeningRoutes = require('./routes/phoneScreening');
const notificationRoutes = require('./routes/notifications');
const referralRoutes = require('./routes/referrals');
const kudosRoutes = require('./routes/kudos');
const pollsRoutes = require('./routes/polls');

const candidatesRoutes = require('./routes/candidates');
const invitationsRoutes = require('./routes/invitations');
const guestScreeningRoutes = require('./routes/guestScreening');
const promoRoutes = require('./routes/promo');
const creditPackRoutes = require('./routes/creditPacks');
const externalApplicationRoutes = require('./routes/externalApplications');
const externalJobRoutes = require('./routes/externalJobs');
const harvestRoutes = require('./routes/harvest');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiters');
const authMiddleware = require('./middleware/auth');
const requireVerifiedEmail = require('./middleware/requireVerifiedEmail');
const featureFlags = require('./config/featureFlags');

// Initialize the call scheduler service
const callSchedulerService = require('./services/callSchedulerService');

const app = express();

// Trust the reverse proxy in front of the API (Render/Heroku/Nginx/Cloudflare).
// Without this, req.ip resolves to the proxy address for every request, which:
//   1) Collapses all users into a single express-rate-limit bucket, so the
//      auth limiters (login/register/forgot-password/resend-verification) get
//      exhausted globally and return 429 to everyone.
//   2) Triggers express-rate-limit v8's ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
//      validation error when X-Forwarded-For is present.
// In production we trust the first hop (load balancer). In dev there's no
// proxy, so leaving it off is fine.
if (process.env.NODE_ENV === 'production') {
  // `1` = trust one proxy hop. Use a number (not `true`) so express-rate-limit
  // doesn't flag it as permissive.
  app.set('trust proxy', 1);
}

// Serve static files BEFORE helmet (to avoid CORP blocking images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    // Allow cross-origin access for images
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Middleware
app.use(helmet({
  // Backend serves JSON + /uploads only. Strict CSP — anything served from
  // here that needs scripts/styles/iframes should be added explicitly.
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // inline styles ok for error pages
      imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    const isProduction = process.env.NODE_ENV === 'production';

    // Base allowlist — local dev origins are only included when NOT in production
    const allowedOrigins = [
      ...(isProduction ? [] : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
      ]),
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : [])
    ];

    // Chrome extension origins — restrict to known extension IDs in production.
    // CHROME_EXTENSION_ID accepts a single ID or a comma-separated list, so the
    // unpacked dev build and the published Web Store build can both be allowed.
    if (origin.startsWith('chrome-extension://')) {
      const allowedExtIds = (process.env.CHROME_EXTENSION_ID || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (!isProduction || allowedExtIds.length === 0) {
        // Dev: allow any extension origin. Prod without IDs: log + reject.
        if (isProduction) {
          console.warn('[CORS] Rejected chrome-extension origin (CHROME_EXTENSION_ID not set):', origin);
          return callback(new Error('Not allowed by CORS'));
        }
        return callback(null, true);
      }
      if (allowedExtIds.some(id => origin === `chrome-extension://${id}`)) {
        return callback(null, true);
      }
      console.warn('[CORS] Rejected chrome-extension origin (not in allowlist):', origin);
      return callback(new Error('Not allowed by CORS'));
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn('[CORS] Rejected origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Stripe webhook — MUST be mounted BEFORE express.json() so the raw body
// Buffer is preserved for signature verification.
app.post(
  '/api/subscriptions/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(
  pinoHttp({
    logger,
    // Skip health-check noise.
    autoLogging: {
      ignore: (req) => req.url === '/health' || req.url === '/api/health',
    },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({ method: req.method, url: req.url, id: req.id }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  })
);

// Global rate limiter — applied after parsers so it covers the API surface.
// Per-route stricter limiters live inside individual routers.
app.use('/api', globalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
// Recruiter-only surfaces — gated by ENABLE_RECRUITER_SURFACE.
// Candidate-only launch keeps these dormant (no route mounted = 404).
if (featureFlags.recruiterSurface) {
  app.use('/api/smart-match', smartMatchRoutes);
  app.use('/api/recruiter-profiles', recruiterProfileRoutes);
}
app.use('/api/projects', projectRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/tailored-profiles', tailoredProfileRoutes);
app.use('/api/resume', resumeDownloadRoutes);
// Social feed API — gated by ENABLE_FEED (off by default for launch).
// Covers posts and their nested comments/likes/saved routes.
if (featureFlags.feed) {
  app.use('/api/posts', postRoutes);
}

// Claude.ai Custom Connector (MCP). Off by default; enable with
// ENABLE_CLAUDE_CONNECTOR=true. Exposes POST /mcp.
if (featureFlags.claudeConnector) {
  const mountMcp = require('./mcp/transport');
  mountMcp(app);
}
app.use('/api/follows', followRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/agent-arena', agentArenaRoutes);
// Defense in depth: ApplyPilot already runs authMiddleware at the router
// level, but we also block unverified emails before any handler runs so
// CLI / extension clients can't bypass the React PrivateRoute gate.
app.use('/api/applypilot', authMiddleware, requireVerifiedEmail, applyPilotRoutes);
app.use('/api/interviews', interviewRoutes);

app.use('/api/reputation', reputationRoutes);
if (featureFlags.recruiterSurface) {
  app.use('/api/vapi', vapiWebhookRoutes);
  app.use('/api/phone-screening', phoneScreeningRoutes);
}
app.use('/api/notifications', authMiddleware, requireVerifiedEmail, notificationRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/kudos', kudosRoutes);
app.use('/api/polls', pollsRoutes);

if (featureFlags.recruiterSurface) {
  app.use('/api/candidates', candidatesRoutes);
  app.use('/api/guest-screening', guestScreeningRoutes);
  app.use('/api/harvest', harvestRoutes);
}
// Invitations router is mixed: recruiter creates them (/import/*, /bulk)
// but candidates accept them (/:token/*). Mount unconditionally and gate
// recruiter-only handlers inside the router.
app.use('/api/invitations', invitationsRoutes);
app.use('/api/credit-packs', creditPackRoutes);
app.use('/api/external-applications', externalApplicationRoutes);
// The candidate job-discovery surface is intentionally PUBLIC so logged-out
// visitors can browse jobs (acquisition funnel). Auth is applied per-route
// inside the router: read/browse endpoints use optionalAuth, while
// user-specific endpoints (/saved, /recommended, /:id/save, /check-saved,
// /health) declare authMiddleware + requireVerifiedEmail themselves.
app.use('/api/external-jobs', externalJobRoutes);
app.use('/api/harvest', harvestRoutes);
app.use('/api/admin', adminRoutes);

// Sentry error handler must come before our errorHandler but after all routes.
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Error handler
app.use(errorHandler);

// Database connection and server start
const PORT = process.env.PORT || 5001;

const extractEmailDomain = (from) => {
  if (!from || typeof from !== 'string') return '';
  const match = from.match(/<([^>]+)>/);
  const addr = (match ? match[1] : from).trim().toLowerCase();
  const at = addr.lastIndexOf('@');
  return at > -1 ? addr.slice(at + 1) : '';
};

const startServer = async () => {
  try {
    // Validate required environment variables.
    // DB_PASSWORD is optional (local dev may use trust auth).
    // DB_HOST/DB_NAME/DB_USER are not required when DATABASE_URL is set
    // (standard for managed Postgres: Render/Railway/Heroku/Neon/Supabase).
    const isProduction = process.env.NODE_ENV === 'production';
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    const baseRequired = hasDatabaseUrl
      ? ['JWT_SECRET']
      : ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER'];
    // Stripe is intentionally NOT required: paymentService and creditPacks
    // routes fall back to placeholder mode and surface a friendly "payments
    // not configured" message. The candidate-only launch ships without
    // billing; recruiter/paid flows can be enabled later by setting
    // STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in the environment.
    const prodRequired = [
      'OPENAI_API_KEY',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'ALLOWED_ORIGINS',
      'FRONTEND_URL',
    ];
    const requiredEnvVars = isProduction
      ? [...baseRequired, ...prodRequired]
      : baseRequired;

    const missingRequired = requiredEnvVars.filter(v => !process.env[v]);
    if (missingRequired.length > 0) {
      console.error(`\u274C CRITICAL: Missing required env vars: ${missingRequired.join(', ')}`);
      process.exit(1);
    }

    // Brand-safe email validation: when STRICT_BRAND_FROM is enabled,
    // refuse startup unless sending is locked to Resend with a non-webmail domain.
    if (process.env.STRICT_BRAND_FROM === 'true') {
      const provider = (process.env.EMAIL_PROVIDER || 'auto').toLowerCase();
      const from = process.env.EMAIL_FROM || '';
      const domain = extractEmailDomain(from);
      const blockedDomains = new Set([
        'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com',
        'hotmail.com', 'icloud.com', 'live.com', 'aol.com', 'resend.dev'
      ]);

      const brandErrors = [];
      if (provider !== 'resend') {
        brandErrors.push('EMAIL_PROVIDER must be "resend" when STRICT_BRAND_FROM=true');
      }
      if (!process.env.RESEND_API_KEY) {
        brandErrors.push('RESEND_API_KEY is required when STRICT_BRAND_FROM=true');
      }
      if (!from || !domain) {
        brandErrors.push('EMAIL_FROM must be set, e.g. "ProfilleAI <no-reply@your-domain.com>"');
      } else if (blockedDomains.has(domain)) {
        brandErrors.push(`EMAIL_FROM domain must be a verified custom domain, not ${domain}`);
      }

      if (brandErrors.length > 0) {
        console.error(`\u274C CRITICAL: Invalid branded-email configuration:\n - ${brandErrors.join('\n - ')}`);
        process.exit(1);
      }
    }

    // Email delivery visibility: print the resolved sender domain/provider at boot.
    {
      const provider = (process.env.EMAIL_PROVIDER || 'auto').toLowerCase();
      const from = process.env.EMAIL_FROM || '';
      const domain = extractEmailDomain(from) || '(not set)';
      const strictBrand = process.env.STRICT_BRAND_FROM === 'true';
      console.log(`✓ Email sender config: provider=${provider} strictBrand=${strictBrand} fromDomain=${domain}`);
    }

    // JWT_SECRET strength check. A weak secret undermines every token in
    // the system. In production we require at least 32 chars (~256 bits)
    // and reject the obvious placeholder values that ship in examples.
    const jwtSecret = process.env.JWT_SECRET || '';
    const weakJwtPlaceholders = new Set([
      'your_jwt_secret_here',
      'your_jwt_secret',
      'changeme',
      'secret',
      'jwt_secret',
    ]);
    if (jwtSecret.length < 32 || weakJwtPlaceholders.has(jwtSecret.toLowerCase())) {
      const msg = `JWT_SECRET is weak (length=${jwtSecret.length}). Use at least 32 random chars (e.g. \`openssl rand -hex 32\`).`;
      if (isProduction) {
        console.error(`\u274C CRITICAL: ${msg}`);
        process.exit(1);
      } else {
        console.warn(`\u26A0\uFE0F  ${msg}`);
      }
    }

    // Warn about feature-specific env vars that aren't strictly required.
    const optionalProdWarn = [
      'OPENAI_API_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'CLOUDINARY_CLOUD_NAME',
    ];
    if (!isProduction) {
      const missingOptional = optionalProdWarn.filter(v => !process.env[v]);
      if (missingOptional.length > 0) {
        console.warn(`\u26A0\uFE0F  Feature env vars not set (some features disabled): ${missingOptional.join(', ')}`);
      }
    }

    // Validate required VAPI environment variables for phone screening
    const vapiEnvVars = ['VAPI_API_KEY', 'VAPI_PHONE_NUMBER_ID'];
    const missingVapiVars = vapiEnvVars.filter(v => !process.env[v]);
    if (missingVapiVars.length > 0) {
      console.warn(`⚠️  Missing VAPI environment variables: ${missingVapiVars.join(', ')}`);
      console.warn('   Phone screening calls will not work until these are configured.');
    } else {
      console.log('✓ VAPI environment variables configured');
    }
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully');

    // Idempotent, additive enum backfill. Several AI routes record usage with
    // featureType values that were missing from enum_AIUsages_featureType,
    // causing "invalid input value for enum" errors in prod. ALTER TYPE ...
    // ADD VALUE IF NOT EXISTS is purely additive (never drops/renames), so
    // it's safe to run on every boot — unlike sequelize.sync. Wrapped so a
    // failure here can never block the server from starting.
    try {
      const { up: addAIUsageFeatureTypes } = require('./scripts/migrations/addAIUsageFeatureTypes');
      await addAIUsageFeatureTypes();
    } catch (err) {
      console.warn('⚠️  AIUsage featureType enum backfill skipped:', err.message);
    }

    // Idempotent, additive column add for the daily job-match digest email's
    // opt-out flag (Users.jobDigestOptOut). Production skips sequelize.sync,
    // so this additive ALTER ... ADD COLUMN IF NOT EXISTS is how the column
    // reaches prod on a git-push deploy. Wrapped so a failure can't block boot.
    try {
      const { up: addUserJobDigestOptOut } = require('./scripts/migrations/addUserJobDigestOptOut');
      await addUserJobDigestOptOut();
    } catch (err) {
      console.warn('⚠️  Users.jobDigestOptOut column ensure skipped:', err.message);
    }

    // Add ATSBoards.isStartup and derive it from board provenance (seed list =
    // known companies → false; discovered greenhouse/lever/ashby boards →
    // true). This powers the accurate "Startups" job filter. AWAITED (not
    // backgrounded) and placed BEFORE the seed/discovery board steps below,
    // because the ATSBoard model now declares an isStartup field — every
    // ATSBoard query (incl. those board steps) would error if the column did
    // not yet exist. The ALTER is catalog-only (constant DEFAULT → no rewrite)
    // and the backfill touches a few hundred rows, so awaiting is cheap.
    try {
      const { up: ensureStartupBoardFlag } = require('./scripts/migrations/ensureStartupBoardFlag');
      await ensureStartupBoardFlag();
    } catch (err) {
      console.warn('⚠️  ATSBoards.isStartup flag ensure skipped:', err.message);
    }

    // Ensure the ExternalJobs performance schema (HNSW vector index, recency
    // composite index, searchTsv + GIN, skills/filter/trigram indexes) exists.
    // These were previously only created by manual migration scripts run on
    // the Render shell — which this git-push deploy flow never runs — so a
    // grown corpus without the HNSW index made "recommended" page-1 requests
    // fall back to a ~1.5s sequential cosine scan. Every statement is
    // IF NOT EXISTS (idempotent / additive), so this is a cheap no-op once the
    // objects exist. Run in the BACKGROUND (not awaited): a first-time index
    // build must never delay server readiness, and a failure must never block
    // boot.
    (async () => {
      try {
        const { up: ensureExternalJobPerfSchema } = require('./scripts/migrations/ensureExternalJobPerfSchema');
        await ensureExternalJobPerfSchema();
      } catch (err) {
        console.warn('⚠️  ExternalJobs performance schema ensure skipped:', err.message);
      }
    })();

    // Ensure the canonical free ATS boards (greenhouse/lever/ashby/remoteok/
    // wwr/hn_hiring) from config/seedBoards.js exist. ATS boards used to be
    // inserted only by the manual scripts/seedATSBoards.js, which this
    // git-push deploy flow never runs — so adding boards to the seed list had
    // no effect on prod. This idempotent findOrCreate upsert lands new boards
    // on a plain deploy; the sync cron then ingests their jobs. Run in the
    // BACKGROUND (not awaited) so it never delays readiness or blocks boot.
    (async () => {
      try {
        const { up: ensureSeedBoards } = require('./scripts/migrations/ensureSeedBoards');
        await ensureSeedBoards();
      } catch (err) {
        console.warn('⚠️  Seed ATS boards ensure skipped:', err.message);
      }
    })();

    // One-time bootstrap of startup ATS boards from the YC directory. GATED so
    // it only crawls when we still have few company boards (runs ~once after
    // this ships, then no-ops on every later boot); ongoing refresh is the
    // weekly cron. Heavy outbound HTTP crawl → run in the BACKGROUND, capped
    // and low-concurrency, so it never delays readiness or blocks boot.
    (async () => {
      try {
        const { up: ensureStartupBoards } = require('./scripts/migrations/ensureStartupBoards');
        await ensureStartupBoards();
      } catch (err) {
        console.warn('⚠️  Startup boards bootstrap skipped:', err.message);
      }
    })();

    // Sync models (in development only). In production we want explicit
    // migrations — silent ALTER TABLE on boot can drop or rename columns
    // unexpectedly and is unsafe on shared instances. This guard is
    // defensive: even if someone wraps sync() elsewhere, NODE_ENV=production
    // refuses to run alter mode.
    if (isProduction) {
      console.log('✓ Skipping sequelize.sync (production — use migrations)');
    } else if (process.env.NODE_ENV === 'development') {
      // "ExternalJobs"."searchTsvAB" is a STORED generated column depending on
      // title/company/department. Sequelize's sync({ alter: true }) blindly
      // emits ALTER COLUMN ... TYPE statements even when they are no-ops, and
      // Postgres refuses to alter columns referenced by generated columns.
      // Drop it (and the now-retired searchTsv, if a stale copy lingers) before
      // sync, then recreate searchTsvAB after. searchTsv is NOT recreated — it
      // was retired (description-bearing, read by nobody; see
      // ensureExternalJobPerfSchema.js "drop dead searchTsv index + column").
      let hadSearchCols = false;
      try {
        const [rows] = await sequelize.query(
          `SELECT 1 FROM information_schema.columns
           WHERE table_name = 'ExternalJobs'
             AND column_name IN ('searchTsv', 'searchTsvAB') LIMIT 1;`
        );
        hadSearchCols = rows.length > 0;
        if (hadSearchCols) {
          await sequelize.query(`ALTER TABLE "ExternalJobs" DROP COLUMN IF EXISTS "searchTsv";`);
          await sequelize.query(`ALTER TABLE "ExternalJobs" DROP COLUMN IF EXISTS "searchTsvAB";`);
        }
      } catch (e) {
        console.warn('[startup] Could not pre-drop search tsvector columns:', e.message);
      }

      await sequelize.sync({ alter: true });
      console.log('✓ Database models synchronized');

      // Backfill: treat all pre-existing users (no pending verification token)
      // as already verified so we don't lock them out when the new
      // emailVerified column rolls out.
      try {
        const [, meta] = await sequelize.query(`
          UPDATE "Users"
          SET "emailVerified" = true, "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW())
          WHERE "emailVerified" = false AND "emailVerificationToken" IS NULL;
        `);
        if (meta?.rowCount) {
          console.log(`✓ Backfilled emailVerified=true for ${meta.rowCount} existing user(s)`);
        }
      } catch (e) {
        console.warn('[startup] emailVerified backfill skipped:', e.message);
      }

      if (hadSearchCols) {
        try {
          await sequelize.query(`
            ALTER TABLE "ExternalJobs"
            ADD COLUMN IF NOT EXISTS "searchTsvAB" tsvector
            GENERATED ALWAYS AS (
              setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
              setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
              setweight(to_tsvector('english', coalesce(department, '')), 'B')
            ) STORED;
          `);
          await sequelize.query(`
            CREATE INDEX IF NOT EXISTS "external_jobs_search_tsv_ab_gin"
            ON "ExternalJobs" USING gin ("searchTsvAB");
          `);
        } catch (e) {
          console.warn('[startup] Could not recreate searchTsvAB:', e.message);
        }
      }
    }

    // Startup recovery — any application left in 'preparing' from a previous
    // crash or unclean shutdown will never exit that state on its own.
    // Reset them to needs_attention so users can see and retry them.
    try {
      const { ApplyPilotApplication } = require('./models');
      const [stuckCount] = await ApplyPilotApplication.update(
        {
          status: 'needs_attention',
          errorMessage: 'Server restarted during preparation. Click "Retry" to re-prepare.',
        },
        { where: { status: 'preparing' } }
      );
      if (stuckCount > 0) {
        console.log(`[startup] Reset ${stuckCount} stuck 'preparing' application(s) → needs_attention`);
      }
    } catch (recoveryErr) {
      console.warn('[startup] Preparing-app recovery failed (non-blocking):', recoveryErr.message);
    }

    // ApplyPilotConfigs.lastScoutRun — funnel snapshot written by the
    // scout cron so the dashboard can explain *why* a running pilot has
    // produced no applications (e.g. criteria too narrow, profile too
    // sparse, daily cap hit). Idempotent ADD COLUMN IF NOT EXISTS so the
    // boot is safe to run on every deploy.
    try {
      await sequelize.query(`
        ALTER TABLE "ApplyPilotConfigs"
        ADD COLUMN IF NOT EXISTS "lastScoutRun" jsonb
      `);
    } catch (e) {
      console.warn('[startup] ApplyPilotConfigs.lastScoutRun ensure skipped:', e.message);
    }

    // Start server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server running on 0.0.0.0:${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      // Operational banner — makes it obvious in logs which surfaces are
      // live for the current deployment, especially after a flag flip.
      console.log('✓ Feature flags:'
        + ` recruiterSurface=${featureFlags.recruiterSurface}`
        + ` feed=${featureFlags.feed}`
        + ` recruiterAgentArena=${featureFlags.recruiterAgentArena}`
        + ` claudeConnector=${featureFlags.claudeConnector}`);
      console.log(`✓ DB SSL: ${process.env.DB_SSL === 'true' || (isProduction && process.env.DB_SSL !== 'false') ? 'enabled' : 'disabled'}${process.env.DATABASE_URL ? ' (via DATABASE_URL)' : ''}`);

      // Initialize phone screening scheduler only when explicitly enabled.
      // This avoids noisy DB errors in environments where screening tables
      // have not been migrated yet.
      if (process.env.ENABLE_PHONE_SCREENING_SCHEDULER === 'true') {
        callSchedulerService.initializeScheduler();
      } else {
        console.log('[PhoneScheduler] Disabled. Set ENABLE_PHONE_SCREENING_SCHEDULER=true to enable.');
      }

      // Cron jobs — by default the dedicated `cronWorker` process owns these.
      // For local/dev convenience, set RUN_CRON_INLINE=true to embed them in
      // the API process. In production, run `npm run cron` as a separate
      // process so multi-instance API deploys don't duplicate scheduled work.
      if (process.env.RUN_CRON_INLINE === 'true') {
        const { startCron } = require('./workers/cronWorker');
        startCron({ inline: true });
      } else {
        console.log('[Cron] Inline cron disabled. Run `npm run cron` as a separate process.');
      }

      // Self-healing job-embedding backfill. New jobs are embedded inline at
      // ingest, but those OpenAI calls can drop ("Premature close") and leave
      // jobs with embedding=NULL — which makes them invisible to semantic
      // RANKING (they still appear via the recency path, just unranked). With
      // scheduled cron off in this topology, the API process sweeps a small
      // batch of unembedded active jobs (newest first) on an interval so the
      // corpus catches up and stays embedded. Deliberately gentle: one small
      // OpenAI batch + a few single-row UPDATEs per tick, single-flight, so it
      // never piles load on the DB. Disable with ENABLE_EMBED_BACKFILL=false.
      if (process.env.OPENAI_API_KEY && process.env.ENABLE_EMBED_BACKFILL !== 'false') {
        const { backfillMissingJobEmbeddings } = require('./services/jobEmbeddingService');
        const embedBatch = parseInt(process.env.EMBED_BACKFILL_BATCH || '50', 10);
        const embedIntervalMs = parseInt(process.env.EMBED_BACKFILL_INTERVAL_MS || '120000', 10);
        const embedTick = () => backfillMissingJobEmbeddings({ limit: embedBatch })
          .then(r => {
            if (r.success || r.failed) {
              console.log(`[EmbedBackfill] embedded ${r.success}, failed ${r.failed} (picked ${r.picked})`);
            }
          })
          .catch(err => console.warn('[EmbedBackfill] error:', err.message));
        setTimeout(embedTick, 30000);
        setInterval(embedTick, embedIntervalMs);
        console.log(`[EmbedBackfill] ✓ enabled (batch=${embedBatch}, every ${Math.round(embedIntervalMs / 1000)}s)`);
      } else {
        console.log('[EmbedBackfill] disabled');
      }

      // Disk-reclaim: prune long-inactive ExternalJobs. Deactivated jobs (no
      // longer in any board's fetch) are never shown again but keep a row +
      // 1536-dim embedding + index entries forever, steadily bloating the DB
      // (a direct cause of the storage filling up). This sweeps a bounded batch
      // of jobs inactive for > PRUNE_INACTIVE_DAYS, skipping any saved/applied
      // ones (FK-safe). Gentle + single-flight; disable with
      // ENABLE_INACTIVE_JOB_PRUNE=false.
      if (process.env.ENABLE_INACTIVE_JOB_PRUNE !== 'false') {
        const { pruneStaleInactiveJobs } = require('./services/externalJobService');
        const pruneDays = parseInt(process.env.PRUNE_INACTIVE_DAYS || '60', 10);
        const pruneBatch = parseInt(process.env.PRUNE_INACTIVE_BATCH || '500', 10);
        const pruneIntervalMs = parseInt(process.env.PRUNE_INACTIVE_INTERVAL_MS || '900000', 10);
        const pruneTick = () => pruneStaleInactiveJobs({ days: pruneDays, limit: pruneBatch })
          .then(r => {
            if (r.deleted) console.log(`[InactivePrune] deleted ${r.deleted} stale inactive jobs (>${pruneDays}d)`);
          })
          .catch(err => console.warn('[InactivePrune] error:', err.message));
        setTimeout(pruneTick, 90000);
        setInterval(pruneTick, pruneIntervalMs);
        console.log(`[InactivePrune] ✓ enabled (>${pruneDays}d inactive, batch=${pruneBatch}, every ${Math.round(pruneIntervalMs / 1000)}s)`);
      } else {
        console.log('[InactivePrune] disabled');
      }

      // Disk-reclaim, layer 2: compact heavy columns on OLD ExternalJob rows.
      // Nulls `metadata` (raw ATS JSON, never read back) and `descriptionHtml`
      // (HTML version of description; frontend falls back to plain `description`)
      // on rows older than COMPACT_OLD_JOBS_DAYS while keeping the row itself
      // discoverable. Both are TOASTed columns, so nulling them lets autovacuum
      // reclaim significant disk. Runs alongside the prune in a separate bounded
      // single-flight tick so neither blocks the other. Disable with
      // ENABLE_JOB_COMPACTION=false.
      if (process.env.ENABLE_JOB_COMPACTION !== 'false') {
        const { compactOldJobRows } = require('./services/externalJobService');
        const compactDays = parseInt(process.env.COMPACT_OLD_JOBS_DAYS || '30', 10);
        const compactBatch = parseInt(process.env.COMPACT_OLD_JOBS_BATCH || '500', 10);
        const compactIntervalMs = parseInt(process.env.COMPACT_OLD_JOBS_INTERVAL_MS || '600000', 10);
        const compactTick = () => compactOldJobRows({ days: compactDays, limit: compactBatch })
          .then(r => {
            if (r.updated) console.log(`[JobCompaction] compacted ${r.updated} jobs (>${compactDays}d, nulled descriptionHtml + metadata)`);
          })
          .catch(err => console.warn('[JobCompaction] error:', err.message));
        setTimeout(compactTick, 120000);
        setInterval(compactTick, compactIntervalMs);
        console.log(`[JobCompaction] ✓ enabled (>${compactDays}d, batch=${compactBatch}, every ${Math.round(compactIntervalMs / 1000)}s)`);
      } else {
        console.log('[JobCompaction] disabled');
      }

      // Scheduled stale-board refresh rotation. OPT-IN, DEFAULT OFF.
      // With no scheduled cron in this topology, board freshness (and the
      // Ashby postedAt backfill) otherwise only propagates when a user browses
      // a board's jobs and trips refreshIfStale. This rotation walks the few
      // most-stale boards on an interval so freshness heals without waiting on
      // traffic. It is GATED OFF by default because it adds continuous load to
      // the crash-prone managed Postgres — only flip ENABLE_BOARD_REFRESH=true
      // once the DB is upsized / stable. Deliberately gentle: a small batch of
      // the most-stale boards, synced one at a time, single-flight, yielding to
      // full sweeps and per-request refreshes.
      if (process.env.ENABLE_BOARD_REFRESH === 'true') {
        const { refreshStaleBoards } = require('./services/externalJobService');
        const boardBatch = parseInt(process.env.BOARD_REFRESH_BATCH || '3', 10);
        const boardIntervalMs = parseInt(process.env.BOARD_REFRESH_INTERVAL_MS || '300000', 10);
        const boardTick = () => refreshStaleBoards({ batch: boardBatch })
          .then(r => {
            if (r.synced || (r.results && r.results.length)) {
              console.log(`[BoardRefresh] synced ${r.synced || 0}/${(r.results || []).length} stale boards`
                + (r.skipped ? ` (skipped: ${r.skipped})` : ''));
            }
          })
          .catch(err => console.warn('[BoardRefresh] error:', err.message));
        setTimeout(boardTick, 60000);
        setInterval(boardTick, boardIntervalMs);
        console.log(`[BoardRefresh] ✓ enabled (batch=${boardBatch}, every ${Math.round(boardIntervalMs / 1000)}s)`);
      } else {
        console.log('[BoardRefresh] disabled. Set ENABLE_BOARD_REFRESH=true to enable (only after DB is upsized).');
      }

      // ApplyPilot submit worker — consumes approved applications from
      // the pg-boss queue and POSTs them to the right ATS. Runs in-
      // process for dev; production should spin it up standalone via
      // `npm run worker` so the API server isn't blocking on browser
      // automation / heavy PDF rendering. Hybrid pivot: gated behind
      // APPLYPILOT_AUTOSUBMIT — off by default. Prep worker still
      // mounts because we need it to generate tailored materials.
      if (process.env.APPLYPILOT_WORKER_INLINE !== 'false') {
        const featureFlags = require('./config/featureFlags');
        if (featureFlags.applyPilotAutoSubmit) {
          const { mountSubmitWorker } = require('./workers/submitWorker');
          mountSubmitWorker().catch((err) => {
            console.error('[submitWorker] mount failed:', err?.message || err);
          });
        } else {
          console.log('[submitWorker] disabled (APPLYPILOT_AUTOSUBMIT=off — hybrid mode)');
        }

        // ApplyPilot prep worker — consumes pending applications, runs
        // AI tailoring with retry/backoff. In hybrid mode prep stops at
        // 'prepared' and the candidate submits manually.
        const { mountPrepWorker } = require('./workers/prepWorker');
        mountPrepWorker()
          .then(async () => {
            // Re-enqueue orphaned 'pending' applications. A row lands in
            // 'pending' the moment the scout creates it; the scout then
            // enqueues a prep job. If that enqueue ever no-ops (e.g. the
            // queue couldn't boot on a previous deploy, or the process
            // crashed between create and enqueue), the row is stranded:
            // the scout de-dupes against already-surfaced jobs so it will
            // never re-enqueue it, and no worker is holding a job for it.
            // On every boot we re-enqueue all 'pending' rows. enqueuePrep
            // is idempotent (singletonKey prep:<appId>), so rows that
            // already have a live queue job are not double-processed.
            try {
              const { ApplyPilotApplication } = require('./models');
              const service = require('./services/applyPilotService');
              const stranded = await ApplyPilotApplication.findAll({
                where: { status: 'pending' },
                attributes: ['id'],
              });
              if (stranded.length) {
                await Promise.all(
                  stranded.map((a) => service.enqueuePrep(a.id, { autoSubmitOnReady: false })),
                );
                console.log(`[startup] Re-enqueued ${stranded.length} stranded 'pending' application(s) for prep`);
              }
            } catch (reErr) {
              console.warn('[startup] pending re-enqueue failed (non-blocking):', reErr.message);
            }
          })
          .catch((err) => {
            console.error('[prepWorker] mount failed:', err?.message || err);
          });
      }
    });

    // Graceful shutdown: stop accepting new connections, drain in-flight
    // requests, close DB, then exit. Forced-exit after a hard timeout in
    // case something hangs (e.g. open keep-alives).
    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`\n[shutdown] Received ${signal}, draining...`);

      const forceExit = setTimeout(() => {
        console.error('[shutdown] Force exit after 15s timeout.');
        process.exit(1);
      }, 15_000);
      // Don't let the timeout keep the loop alive.
      forceExit.unref();

      server.close(async (err) => {
        if (err) console.error('[shutdown] server.close error:', err.message);
        try {
          await sequelize.close();
          console.log('[shutdown] DB closed.');
        } catch (e) {
          console.error('[shutdown] DB close error:', e.message);
        }
        console.log('[shutdown] Bye.');
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
      console.error('[uncaughtException]', err);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
      console.error('[unhandledRejection]', reason);
      // Don't crash on unhandled rejections — log and continue.
    });
  } catch (error) {
    console.error('✗ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
