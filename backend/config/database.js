const Sequelize = require('sequelize');
const { registerType } = require('pgvector/sequelize');
require('dotenv').config();

// Register pgvector types (VECTOR, HALFVEC, SPARSEVEC) with Sequelize
registerType(Sequelize);

// SSL is enabled when DB_SSL=true OR we're in production with a hosted DB.
// Most managed Postgres providers (Render, Railway, Supabase, Heroku,
// Neon, RDS-with-IAM) terminate TLS with intermediate certs we don't
// bundle, so we disable strict cert verification here. If you're on a
// self-managed cluster with a known CA, set DB_SSL_REJECT_UNAUTHORIZED=true.
const isProduction = process.env.NODE_ENV === 'production';
const sslEnabled =
  process.env.DB_SSL === 'true' ||
  process.env.DB_SSL === '1' ||
  (isProduction && process.env.DB_SSL !== 'false');

const dialectOptions = sslEnabled
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
      },
    }
  : {};

const commonOptions = {
  dialect: 'postgres',
  logging: false,
  dialectOptions,
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    // Keep a small warm pool so the next request after a quiet moment
    // doesn't pay the ~300-1500ms TLS+auth handshake to set up a brand
    // new connection to managed Postgres. With min=0 (the old default)
    // every 10s of inactivity wiped the pool and every cold request
    // wore the handshake on its critical path — which on the
    // /external-jobs hot path was a visible chunk of the user-reported
    // multi-second waits. Override via DB_POOL_MIN if you need to scale
    // up or down per environment.
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    acquire: 30000,
    idle: 10000,
    // Bump the eviction TTL so warm connections survive idle windows.
    // Without this, sequelize's pool will idle-close min connections
    // anyway after `idle` ms; setting it explicitly makes min:2 actually
    // mean "always keep 2 warm".
    evict: 60000,
  },
  // Transparent retry for TRANSIENT connection-level failures only. When
  // managed Postgres restarts (Render maintenance, a crash-into-recovery,
  // or a failover) every connection already in the pool is dead, and the
  // pg driver only discovers that on first reuse — so the next handful of
  // requests 500 with "Connection terminated unexpectedly" / "the database
  // system is in recovery mode" until the pool evicts the corpses. Retrying
  // those specific errors a few times with a short backoff rides through a
  // restart window (typically a few seconds) instead of surfacing 500s.
  //
  // Scope is deliberately NARROW: only connection/socket errors match.
  // Statement timeouts (statement_timeout=15s) raise SequelizeDatabaseError,
  // NOT a connection error, so a slow query is NEVER retried (it would just
  // pile more load on a struggling DB). All our hot-path writes are
  // idempotent (bulkCreate = upsert, the deactivate UPDATE and embedding
  // UPDATEs are set-based), so a retried write can't double-apply.
  retry: {
    max: 3,
    backoffBase: 250,
    backoffExponent: 1.5,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotReachableError/,
      /SequelizeConnectionTimedOutError/,
      /Connection terminated unexpectedly/,
      /ECONNRESET/,
      /EPIPE/,
      /ETIMEDOUT/,
      /the database system is (starting up|in recovery mode|not yet accepting connections)/,
    ],
  },
  // Per-connection session setup. Runs once when a connection is opened
  // (i.e. on cold-start of each pool slot, not per query) and applies
  // settings that searchSimilarJobs() used to wrap in a transaction:
  //
  //   - hnsw.ef_search = 200  bumps HNSW traversal width so restrictive
  //                           WHERE filters don't drop recall. Default
  //                           (40) is fine for unfiltered ANN but starves
  //                           the post-WHERE candidate pool when the user
  //                           narrows by locationType / salary / skills.
  //                           200 keeps recall > 99% on this corpus while
  //                           the probe stays single-digit ms.
  //
  //   - statement_timeout = 15s  hard cap to keep one bad query from
  //                              monopolizing a connection during a
  //                              traffic burst. Long enough for the
  //                              ANN+rank SELECT under load, short
  //                              enough that a stuck statement releases
  //                              its slot before the rest of the API
  //                              starts queuing.
  hooks: {
    afterConnect: async (connection) => {
      try {
        await connection.query(`SET hnsw.ef_search = 200; SET statement_timeout = 15000;`);
      } catch (err) {
        // Older PG / pgvector builds without HNSW just ignore the unknown
        // setting (PG raises a NOTICE, not an ERROR). If it does throw,
        // log once but don't fail the connection — the API would rather
        // run with default ef_search than 500 errors on every request.
        // eslint-disable-next-line no-console
        console.warn('[database] afterConnect SET failed:', err.message);
      }
    },
  },
};

// Prefer DATABASE_URL when present (standard for Render, Railway, Heroku,
// Neon, Supabase, etc.). Falls back to discrete DB_* vars for local dev
// and Docker compose.
const sequelize = process.env.DATABASE_URL
  ? new Sequelize.Sequelize(process.env.DATABASE_URL, commonOptions)
  : new Sequelize.Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        ...commonOptions,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
      }
    );

module.exports = sequelize;
