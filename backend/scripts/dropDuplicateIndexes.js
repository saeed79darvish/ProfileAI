#!/usr/bin/env node
/**
 * Find and drop duplicate indexes.
 *
 * Sequelize's `sync({ alter: true })` re-creates every UNIQUE index on each
 * run instead of detecting the existing one, appending a numeric suffix:
 * Users_email_key, Users_email_key1, Users_email_key2, ... A dev database that
 * has been booted a few hundred times accumulates thousands of them.
 *
 * The cost is not just disk. Postgres locks EVERY index on a table while
 * planning a query against it, so a table with ~4000 indexes needs ~4000 lock
 * slots for a single SELECT. The lock table is sized
 * max_locks_per_transaction * max_connections (6400 on a default install), so
 * two concurrent queries exhaust it and every session starts failing with
 * "out of shared memory". In an Express app that error surfaces from
 * middleware/auth.js as a 401 — signed-in users get logged out under load.
 *
 * Production is not supposed to be affected: server.js skips sync() when
 * NODE_ENV=production. But `npm run sync-db-safe` runs alter mode against
 * whatever DATABASE_URL points at, so it is worth checking there too:
 *
 *   select c.relname, count(*) from pg_index i
 *   join pg_class c on c.oid = i.indrelid group by 1 order by 2 desc limit 10;
 *
 * Usage:
 *   node scripts/dropDuplicateIndexes.js            # dry run, prints the plan
 *   node scripts/dropDuplicateIndexes.js --apply    # actually drop them
 *
 * Duplicates are usually UNIQUE *constraints*, not bare indexes, so most are
 * removed with ALTER TABLE ... DROP CONSTRAINT rather than DROP INDEX. Primary
 * keys are never dropped, and a group is only ever reduced to one surviving
 * index, never zero.
 */

require('dotenv').config();
const sequelize = require('../config/database');

const APPLY = process.argv.includes('--apply');

(async () => {
  await sequelize.authenticate();

  const [rows] = await sequelize.query(`
    SELECT
      i.indexrelid::regclass::text        AS index_name,
      c.relname                           AS table_name,
      pg_get_indexdef(i.indexrelid)       AS def,
      con.conname                         AS constraint_name,
      con.contype                         AS constraint_type,
      pg_relation_size(i.indexrelid)      AS bytes
    FROM pg_index i
    JOIN pg_class c   ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_constraint con ON con.conindid = i.indexrelid
    WHERE n.nspname = 'public'
    ORDER BY c.relname, i.indexrelid::regclass::text
  `);

  // Two indexes are duplicates when their definitions match once the index
  // name is removed — same table, same columns, same uniqueness, same method.
  const groups = new Map();
  for (const r of rows) {
    const normalized = r.def.replace(/^CREATE (UNIQUE )?INDEX \S+ ON /, 'CREATE $1INDEX ON ');
    const key = `${r.table_name}::${normalized}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const toDrop = [];
  let bytesFreed = 0;
  for (const [, members] of groups) {
    if (members.length < 2) continue;
    // Always keep a primary key. Otherwise keep the shortest name, which is
    // the original: the duplicates are that same name plus a numeric suffix.
    const keeper =
      members.find((m) => m.constraint_type === 'p') ||
      members.slice().sort((a, b) => a.index_name.length - b.index_name.length)[0];
    for (const m of members) {
      if (m === keeper) continue;
      if (m.constraint_type === 'p') continue; // never drop a primary key
      toDrop.push(m);
      bytesFreed += Number(m.bytes);
    }
  }

  if (!toDrop.length) {
    console.log('No duplicate indexes found.');
    await sequelize.close();
    return;
  }

  const byTable = new Map();
  for (const d of toDrop) byTable.set(d.table_name, (byTable.get(d.table_name) || 0) + 1);

  console.log(`\n${toDrop.length} duplicate index(es) across ${byTable.size} table(s), ${(bytesFreed / 1024 / 1024).toFixed(1)} MB:\n`);
  for (const [t, n] of [...byTable.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(28)} ${String(n).padStart(6)}`);
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to drop them.\n');
    await sequelize.close();
    return;
  }

  console.log('\nDropping...');
  let done = 0;
  let failed = 0;
  for (const d of toDrop) {
    try {
      // Each drop is its own statement so one failure doesn't roll back the rest.
      // A constraint owns its index, so DROP INDEX would be refused — the
      // constraint has to go instead, which takes the index with it.
      if (d.constraint_name) {
        await sequelize.query(
          `ALTER TABLE "${d.table_name}" DROP CONSTRAINT IF EXISTS "${d.constraint_name.replace(/"/g, '')}"`
        );
      } else {
        await sequelize.query(`DROP INDEX IF EXISTS "${d.index_name.replace(/"/g, '')}"`);
      }
      done++;
      if (done % 250 === 0) process.stdout.write(`\r  ${done}/${toDrop.length}`);
    } catch (err) {
      failed++;
      if (failed <= 5) console.warn(`\n  skip ${d.index_name}: ${err.message}`);
    }
  }
  console.log(`\r  dropped ${done}, skipped ${failed}.            `);

  await sequelize.query('ANALYZE');
  console.log('ANALYZE done.\n');
  await sequelize.close();
})().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
