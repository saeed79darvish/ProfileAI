/**
 * ExternalJobs."descriptionStructured" (services/jobDescriptionStructure.js).
 *
 * BLOCKING, awaited in server.js before app.listen: the column is in the
 * ExternalJob model, so every query that loads the model's attributes (the job
 * detail route among them) names it. Serving before it exists would 500 those.
 * Throws on failure so the deploy fails and the previous release keeps serving.
 *
 * Steady state is a catalog read, which takes no lock. ADD COLUMN with no
 * default is a metadata-only change, but it still needs a brief ACCESS
 * EXCLUSIVE lock; lock_timeout keeps it from queueing behind a long sync write
 * (and everything else from queueing behind it), and it retries a few times.
 */

const sequelize = require('../../config/database');

const ATTEMPTS = 5;

async function exists() {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_name = 'ExternalJobs' AND column_name = 'descriptionStructured'`
  );
  return rows.length > 0;
}

async function up() {
  if (await exists()) return;
  let lastErr;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      await sequelize.transaction(async (t) => {
        await sequelize.query(`SET LOCAL lock_timeout = '5s'`, { transaction: t });
        await sequelize.query(
          `ALTER TABLE "ExternalJobs" ADD COLUMN IF NOT EXISTS "descriptionStructured" JSONB`,
          { transaction: t }
        );
      });
      console.log('  ✓ descriptionStructured column');
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`  ⚠️  descriptionStructured attempt ${attempt} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  if (await exists()) return;
  throw new Error(`descriptionStructured column could not be added: ${lastErr && lastErr.message}`);
}

module.exports = { up };
