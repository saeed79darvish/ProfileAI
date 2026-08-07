/**
 * Cross-process mutex for boot-time migrations.
 *
 * WHY
 * ---
 * server.js runs its blocking migrations on EVERY boot. During a zero-downtime
 * deploy the platform starts the new instance while the old one is still
 * running, and any multi-instance configuration boots several at once — so two
 * processes can execute the same DDL simultaneously. PostgreSQL does not
 * serialise catalog writes for us, and concurrent `ALTER TYPE ... ADD VALUE`,
 * `CREATE OR REPLACE FUNCTION` or `DROP/CREATE TRIGGER` against the same object
 * fails with:
 *
 *     error: tuple concurrently updated
 *
 * which is fatal at boot (observed in production: one instance died with
 * exactly this while a sibling completed the same migration successfully). The
 * statements are all individually idempotent, so the fix is not to make them
 * safer but to stop them running concurrently at all.
 *
 * HOW
 * ---
 * A PostgreSQL session-level advisory lock. The first process in wins and runs
 * the migration; the others block until it finishes and then find the work
 * already done, so they fall through in milliseconds.
 *
 * The lock is taken on a DEDICATED pooled connection, held for the duration,
 * and released in a finally. That matters: session-level advisory locks belong
 * to a connection, and issuing lock/unlock through Sequelize's normal query
 * path could land them on two different pooled connections — acquiring a lock
 * nothing ever releases. A dedicated connection also lets the migration body
 * manage its own transactions (the effectivePostedAt backfill deliberately
 * commits batch by batch, so it must NOT be wrapped in one outer transaction).
 *
 * Advisory locks are automatically released if the connection dies, so a
 * crashed or OOM-killed instance cannot wedge future deploys.
 */

const sequelize = require('../../config/database');

// Distinct arbitrary keys, one per migration. Two different migrations should
// not block each other; two copies of the SAME migration must.
const LOCK_KEYS = {
  effectivePostedAt: 815_001,
  applyTrackingStates: 815_002,
};

/**
 * Run `fn` while holding the advisory lock for `key`.
 *
 * @param {number} key  numeric lock id (see LOCK_KEYS)
 * @param {Function} fn async function to run under the lock
 * @param {Object} [opts]
 * @param {number} [opts.timeoutMs] how long to wait for the lock before giving
 *        up. On timeout we throw — at boot that means the deploy fails and the
 *        platform keeps the previous release serving, which is the safe outcome.
 */
async function withMigrationLock(key, fn, { timeoutMs = 300000 } = {}) {
  const conn = await sequelize.connectionManager.getConnection();
  let held = false;
  try {
    // lock_timeout does not apply to advisory locks, so bound the wait with
    // statement_timeout on this connection only.
    await conn.query(`SET statement_timeout = ${Math.max(1000, timeoutMs)}`);
    try {
      await conn.query(`SELECT pg_advisory_lock(${key})`);
      held = true;
    } catch (err) {
      throw new Error(
        `Timed out waiting ${Math.round(timeoutMs / 1000)}s for migration lock ${key}: ${err.message}`
      );
    }
    // Reset so the lock-holding connection isn't left with an unusual timeout
    // if it gets recycled back into the pool.
    await conn.query('SET statement_timeout = 15000');
    return await fn();
  } finally {
    if (held) {
      try { await conn.query(`SELECT pg_advisory_unlock(${key})`); } catch { /* connection died: lock auto-released */ }
    }
    try { await sequelize.connectionManager.releaseConnection(conn); } catch { /* pool already discarded it */ }
  }
}

module.exports = { withMigrationLock, LOCK_KEYS };
