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
const featureFlags = require('./config/featureFlags');

// Initialize the call scheduler service
const callSchedulerService = require('./services/callSchedulerService');

const app = express();

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

    // Chrome extension origins — restrict to a known extension ID in production
    if (origin.startsWith('chrome-extension://')) {
      const allowedExtId = process.env.CHROME_EXTENSION_ID;
      if (!isProduction || !allowedExtId) {
        // Dev: allow any extension origin. Prod without ID: log + reject.
        if (isProduction) {
          console.warn('[CORS] Rejected chrome-extension origin (CHROME_EXTENSION_ID not set):', origin);
          return callback(new Error('Not allowed by CORS'));
        }
        return callback(null, true);
      }
      if (origin === `chrome-extension://${allowedExtId}`) {
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
app.use('/api/applypilot', applyPilotRoutes);
app.use('/api/interviews', interviewRoutes);

app.use('/api/reputation', reputationRoutes);
if (featureFlags.recruiterSurface) {
  app.use('/api/vapi', vapiWebhookRoutes);
  app.use('/api/phone-screening', phoneScreeningRoutes);
}
app.use('/api/notifications', notificationRoutes);
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

    // Sync models (in development only). In production we want explicit
    // migrations — silent ALTER TABLE on boot can drop or rename columns
    // unexpectedly and is unsafe on shared instances. This guard is
    // defensive: even if someone wraps sync() elsewhere, NODE_ENV=production
    // refuses to run alter mode.
    if (isProduction) {
      console.log('✓ Skipping sequelize.sync (production — use migrations)');
    } else if (process.env.NODE_ENV === 'development') {
      // The "ExternalJobs"."searchTsv" column is a STORED generated column
      // depending on title/company/department/description. Sequelize's
      // sync({ alter: true }) blindly emits ALTER COLUMN ... TYPE statements
      // even when they are no-ops, and Postgres refuses to alter columns
      // referenced by generated columns. Drop & recreate searchTsv around sync.
      let hadSearchTsv = false;
      try {
        const [rows] = await sequelize.query(
          `SELECT 1 FROM information_schema.columns
           WHERE table_name = 'ExternalJobs' AND column_name = 'searchTsv' LIMIT 1;`
        );
        hadSearchTsv = rows.length > 0;
        if (hadSearchTsv) {
          await sequelize.query(`ALTER TABLE "ExternalJobs" DROP COLUMN IF EXISTS "searchTsv";`);
        }
      } catch (e) {
        console.warn('[startup] Could not pre-drop searchTsv:', e.message);
      }

      await sequelize.sync({ alter: true });
      console.log('✓ Database models synchronized');

      if (hadSearchTsv) {
        try {
          await sequelize.query(`
            ALTER TABLE "ExternalJobs"
            ADD COLUMN IF NOT EXISTS "searchTsv" tsvector
            GENERATED ALWAYS AS (
              setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
              setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
              setweight(to_tsvector('english', coalesce(department, '')), 'B') ||
              setweight(to_tsvector('english', coalesce(description, '')), 'C')
            ) STORED;
          `);
          await sequelize.query(`
            CREATE INDEX IF NOT EXISTS "external_jobs_search_tsv_gin"
            ON "ExternalJobs" USING gin ("searchTsv");
          `);
        } catch (e) {
          console.warn('[startup] Could not recreate searchTsv:', e.message);
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

      // Initialize the phone screening call scheduler
      callSchedulerService.initializeScheduler();

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
        mountPrepWorker().catch((err) => {
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
