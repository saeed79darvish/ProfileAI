#!/usr/bin/env node
/**
 * Seed disposable users for a load test, and mint their JWTs directly.
 *
 * Writes two files:
 *   tokens json — array of JWT strings, for SCENARIO=authed / mixed
 *   creds json  — array of {email, password}, for SCENARIO=login
 *
 * Users are created straight through Sequelize (never via POST /api/auth/register),
 * so seeding 1000 accounts doesn't trip the auth rate limiter, doesn't send
 * 1000 verification emails, and doesn't spend 1000 bcrypt hashes on the API's
 * event loop. Every account is created emailVerified so the authed scenario
 * isn't just measuring requireVerifiedEmail rejections.
 *
 * Usage:
 *   COUNT=1000 node scripts/seedLoadTestUsers.js
 *   node scripts/seedLoadTestUsers.js --cleanup      # delete them again
 *
 * Env:
 *   COUNT    how many users        (default 200)
 *   PREFIX   email local-part tag  (default loadtest)
 *   OUT_DIR  where to write files  (default os tmpdir)
 *
 * Refuses to run against a production DATABASE_URL unless
 * I_KNOW_THIS_IS_PRODUCTION=yes — this creates rows, and prod is not the
 * place to discover that.
 */

require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize, User, Profile } = require('../models');

const COUNT = parseInt(process.env.COUNT || '200', 10);
const PREFIX = process.env.PREFIX || 'loadtest';
const OUT_DIR = process.env.OUT_DIR || os.tmpdir();
const DOMAIN = 'loadtest.invalid';
const PASSWORD = 'LoadTest!2026xyz';
const CLEANUP = process.argv.includes('--cleanup');

function guardProduction() {
  const url = process.env.DATABASE_URL || '';
  const local = !url || /localhost|127\.0\.0\.1|@db[:/]/.test(url);
  if (!local && process.env.I_KNOW_THIS_IS_PRODUCTION !== 'yes') {
    console.error(
      '\nDATABASE_URL does not look local. This script CREATES USER ROWS.\n' +
      'If you really mean to seed that database, re-run with I_KNOW_THIS_IS_PRODUCTION=yes.\n'
    );
    process.exit(2);
  }
}

(async () => {
  guardProduction();
  await sequelize.authenticate();

  if (CLEANUP) {
    const n = await User.destroy({ where: { email: { [require('sequelize').Op.like]: `${PREFIX}+%@${DOMAIN}` } } });
    console.log(`Deleted ${n} load-test users.`);
    await sequelize.close();
    return;
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set — cannot mint tokens.');
    process.exit(2);
  }

  // Hash once and reuse. Every seeded account shares a password, so paying
  // bcrypt 1000 times would just make seeding slow for no benefit. The model's
  // beforeCreate hook would re-hash a plaintext value, so we set the already
  // hashed field via bulkCreate with hooks off.
  const hashed = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  const rows = Array.from({ length: COUNT }, (_, i) => ({
    firstName: 'Load',
    lastName: `Test${i}`,
    email: `${PREFIX}+${i}@${DOMAIN}`,
    password: hashed,
    role: 'candidate',
    isActive: true,
    emailVerified: true,
    emailVerifiedAt: now,
  }));

  // Insert in chunks. A single 1000-row INSERT runs past the 15s
  // statement_timeout that config/database.js sets on every connection, and
  // fails the whole batch — chunking keeps each statement well inside it.
  const CHUNK = 100;
  console.log(`Seeding ${COUNT} users in chunks of ${CHUNK}...`);
  for (let i = 0; i < rows.length; i += CHUNK) {
    await User.bulkCreate(rows.slice(i, i + CHUNK), {
      hooks: false,           // don't re-hash the already-hashed password
      ignoreDuplicates: true, // re-running is a no-op, not a crash
    });
    process.stdout.write(`\r  ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  console.log('');

  // Give every seeded user a Profile WITH an embedding. Two reasons:
  //
  //   1. Without a Profile, /api/profiles/me answers 404 and the feed's
  //      ranking branch short-circuits, so the authed scenario would measure
  //      error paths instead of the real work.
  //
  //   2. Without a *persisted* embedding, both the feed and /recommended call
  //      OpenAI to regenerate one — /recommended does it blocking, on the
  //      request path (routes/externalJobs.js `regenerateProfileOpenAIEmbedding`).
  //      A 1000-user run would then buy 1000 embeddings. Writing a synthetic
  //      512-dim unit vector here keeps the pgvector ANN query on its real
  //      code path and costs nothing. Rankings are meaningless, which is fine:
  //      the test measures query cost, not match quality.
  //
  // The vector is deterministic per user, so the ANN probe sees 1000 different
  // query points rather than one — a single repeated vector would make every
  // search hit the same HNSW neighbourhood and understate the real cost.
  const seeded = await User.findAll({
    where: { email: { [require('sequelize').Op.like]: `${PREFIX}+%@${DOMAIN}` } },
    attributes: ['id'],
  });
  const DIMS = 512; // must match EMBEDDING_DIMENSIONS in services/jobEmbeddingService.js
  const fakeEmbedding = (seed) => {
    // Cheap deterministic PRNG — Math.random() would give a different corpus
    // on every re-seed and make runs incomparable.
    let x = seed * 2654435761 % 2147483647;
    const v = Array.from({ length: DIMS }, () => {
      x = (x * 16807) % 2147483647;
      return x / 2147483647 - 0.5;
    });
    const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
    return v.map((n) => n / norm);
  };
  const titles = ['Software Engineer', 'Product Manager', 'Data Analyst', 'Designer', 'DevOps Engineer'];
  const skillSets = [
    ['JavaScript', 'React', 'Node.js'],
    ['Python', 'SQL', 'Pandas'],
    ['Figma', 'UI Design', 'Prototyping'],
    ['AWS', 'Terraform', 'Kubernetes'],
  ];
  // Replace rather than ignore-duplicate: bulkCreate({ignoreDuplicates}) skips
  // rows that already exist, so a re-seed would leave earlier profiles without
  // the synthetic embedding and quietly put the paid regen back on the path.
  await Profile.destroy({ where: { userId: seeded.map((u) => u.id) } });
  console.log(`Ensuring ${seeded.length} profiles...`);
  for (let i = 0; i < seeded.length; i += CHUNK) {
    await Profile.bulkCreate(
      seeded.slice(i, i + CHUNK).map((u, k) => ({
        userId: u.id,
        title: titles[(i + k) % titles.length],
        headline: 'Load test profile',
        location: ['Remote', 'New York', 'London', 'Berlin'][(i + k) % 4],
        skills: skillSets[(i + k) % skillSets.length],
        isPublic: true,
        openaiEmbedding: fakeEmbedding(i + k + 1),
        // Fresh timestamp: /recommended treats an embedding older than 24h as
        // stale and regenerates it against OpenAI, which is the exact cost
        // this whole block exists to avoid.
        openaiEmbeddingUpdatedAt: now,
      })),
      { hooks: false, ignoreDuplicates: true }
    );
    process.stdout.write(`\r  ${Math.min(i + CHUNK, seeded.length)}/${seeded.length}`);
  }
  console.log('');

  const users = await User.findAll({
    where: { email: { [require('sequelize').Op.like]: `${PREFIX}+%@${DOMAIN}` } },
    attributes: ['id', 'email'],
  });

  const tokens = users.map((u) => jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '7d' }));
  const creds = users.map((u) => ({ email: u.email, password: PASSWORD }));

  const tokensPath = path.join(OUT_DIR, 'loadtest-tokens.json');
  const credsPath = path.join(OUT_DIR, 'loadtest-creds.json');
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
  fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));

  console.log(`\n${users.length} users ready.`);
  console.log(`  tokens: ${tokensPath}`);
  console.log(`  creds:  ${credsPath}`);
  console.log(`\nClean up afterwards with: node scripts/seedLoadTestUsers.js --cleanup\n`);

  await sequelize.close();
})().catch((err) => {
  // Print the message, not the whole Sequelize error — a failed bulkCreate
  // dumps the entire multi-hundred-KB INSERT statement otherwise.
  console.error(`\nSeeding failed: ${err.message}`);
  process.exit(1);
});
