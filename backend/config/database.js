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
    min: parseInt(process.env.DB_POOL_MIN || '0', 10),
    acquire: 30000,
    idle: 10000,
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
