/**
 * Job queue · pg-boss singleton.
 *
 * We use pg-boss because it runs on the existing Postgres — no Redis,
 * no new infra. On first start it creates a `pgboss` schema in the same
 * database to hold its job tables.
 *
 * Usage:
 *   const { getBoss, enqueue, QUEUES } = require('./lib/queue');
 *   await enqueue(QUEUES.SUBMIT, { appId });
 *
 *   const boss = await getBoss();
 *   await boss.work(QUEUES.SUBMIT, { teamConcurrency: 3 }, handler);
 *
 * Single shared instance: both the API server and the worker `require`
 * this module; whichever starts pg-boss first wins, the other reuses it.
 */
const PgBoss = require('pg-boss');
require('dotenv').config();

// Queue names — keep them namespaced so we can add more in later phases
// (interview scheduling, offer-letter drafting, etc.).
const QUEUES = Object.freeze({
  SUBMIT: 'applypilot:submit',
  PREP: 'applypilot:prep',
});

let bossPromise = null;

function buildConnectionString() {
  // pg-boss wants a single DSN. We can't reuse the Sequelize pool
  // because pg-boss owns its own pg client for LISTEN/NOTIFY.
  //
  // Prefer DATABASE_URL when present — this is the standard on managed
  // hosts (Render, Railway, Heroku, Neon, Supabase) and is the ONLY DB
  // config those deploys provide. Sequelize already prefers it (see
  // config/database.js); pg-boss must match or it silently fails to
  // boot in production (no discrete DB_* vars → throw → prep/submit
  // workers never mount and enqueue() no-ops).
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Fall back to discrete DB_* vars for local dev / Docker compose.
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 5432;
  const db = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!db || !user) {
    throw new Error('[queue] DATABASE_URL or DB_NAME + DB_USER are required to boot pg-boss');
  }

  const auth = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : encodeURIComponent(user);

  return `postgres://${auth}@${host}:${port}/${db}`;
}

/**
 * Lazy-start the pg-boss instance. First caller triggers the boot; all
 * callers (across the API server and worker process) get the same
 * started instance back.
 */
function getBoss() {
  if (bossPromise) return bossPromise;

  const connectionString = buildConnectionString();

  // SSL parity with config/database.js: managed Postgres (Render external,
  // Railway, Neon, Supabase, Heroku, RDS) terminates TLS with intermediate
  // certs we don't bundle, so disable strict cert verification. Render's
  // INTERNAL network URL needs no SSL (DB_SSL=false), which is the default.
  const isProduction = process.env.NODE_ENV === 'production';
  const sslEnabled =
    process.env.DB_SSL === 'true' ||
    process.env.DB_SSL === '1' ||
    (isProduction && process.env.DB_SSL !== 'false');

  const boss = new PgBoss({
    connectionString,
    ...(sslEnabled
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
          },
        }
      : {}),
    // Keep completed/failed job rows for 24h so the Review UI can show
    // failure diagnostics. pg-boss prunes older rows automatically.
    archiveCompletedAfterSeconds: 60 * 60 * 24,
    // Retry with exponential backoff. The adapter layer sets per-job
    // overrides for particularly expensive retries (e.g. CAPTCHA).
    retryLimit: 2,
    retryDelay: 60,      // seconds
    retryBackoff: true,
  });

  boss.on('error', (err) => {
    console.error('[queue] pg-boss error:', err?.message || err);
  });

  bossPromise = boss
    .start()
    .then(() => {
      console.log('[queue] pg-boss started');
      return boss;
    })
    .catch((err) => {
      console.error('[queue] pg-boss start failed:', err?.message || err);
      bossPromise = null; // allow retry on next call
      throw err;
    });

  return bossPromise;
}

/**
 * Enqueue a job. Thin wrapper so callers don't have to await getBoss()
 * themselves. Returns the pg-boss job id (or null if boss failed to
 * start — caller can decide whether to fail hard).
 */
async function enqueue(queueName, data, opts = {}) {
  try {
    const boss = await getBoss();
    const sendOpts = {
      // Deduplicate on (queueName, singletonKey): e.g. appId means the
      // same app can't be double-enqueued while one is still pending.
      singletonKey: opts.singletonKey,
      startAfter: opts.startAfter, // seconds / date / ISO
      expireInHours: opts.expireInHours ?? 2,
    };

    if (Number.isInteger(opts.retryLimit) && opts.retryLimit >= 0) {
      sendOpts.retryLimit = opts.retryLimit;
    }
    if (Number.isInteger(opts.retryDelay) && opts.retryDelay >= 0) {
      sendOpts.retryDelay = opts.retryDelay;
    }
    if (typeof opts.retryBackoff === 'boolean') {
      sendOpts.retryBackoff = opts.retryBackoff;
    }

    return await boss.send(queueName, data, sendOpts);
  } catch (err) {
    console.error('[queue] enqueue failed:', queueName, err?.message || err);
    return null;
  }
}

async function shutdown() {
  if (!bossPromise) return;
  try {
    const boss = await bossPromise;
    await boss.stop({ graceful: true, timeout: 10_000 });
    console.log('[queue] pg-boss stopped');
  } catch (err) {
    console.error('[queue] shutdown error:', err?.message || err);
  }
}

module.exports = { getBoss, enqueue, shutdown, QUEUES };
