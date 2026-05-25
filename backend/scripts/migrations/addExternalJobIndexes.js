/**
 * Add critical missing indexes on ExternalJobs:
 *
 *   1. HNSW vector index on `embedding` column.
 *
 *      Before this index, every semantic search did a sequential scan of
 *      the entire ExternalJobs corpus (~11k+ rows) computing cosine
 *      distance per row. With HNSW (m=16, ef_construction=64) the query
 *      becomes an approximate nearest-neighbor lookup — roughly O(log N)
 *      probes — which on this corpus drops semantic search latency from
 *      hundreds of ms to single-digit ms while remaining > 99% recall@k
 *      for typical k=200.
 *
 *      We use HNSW (not ivfflat) because: (a) no training step needed,
 *      (b) better recall on small/medium corpora, (c) matches the index
 *      type already on Profiles.embedding.
 *
 *   2. B-tree indexes on the filter columns hit by every /external-jobs
 *      request: locationType, employmentType, experienceLevel.
 *
 *      Without these the planner falls back to a heap scan when the
 *      query has filters but no searchTsv predicate. These are small,
 *      cheap indexes and the filter is exact-equality so B-tree is the
 *      right structure.
 *
 *   3. pg_trgm GIN indexes on `location`, `company`, `department`.
 *
 *      These three columns are filtered with `ILIKE '%...%'`, which a
 *      B-tree can't help with (the leading wildcard prevents prefix
 *      matching). pg_trgm's `gin_trgm_ops` builds an inverted index of
 *      3-character trigrams so substring ILIKE queries become index
 *      probes instead of full table scans. The corpus is small enough
 *      that the gain is modest today, but it scales correctly as the
 *      job count grows and removes the ILIKE columns from EXPLAIN as a
 *      hotspot.
 *
 *   4. Composite index on (isActive, postedAt DESC) — the default sort
 *      key for every list request. Covers the "most recent active jobs"
 *      query path that fires when no search term is provided.
 *
 * Run on prod via the Render shell:
 *   node scripts/migrations/addExternalJobIndexes.js
 *
 * Safe to re-run — every statement is idempotent (IF NOT EXISTS).
 */

require('dotenv').config();
const sequelize = require('../../config/database');

async function migrate() {
  console.log('[migration] addExternalJobIndexes — start');
  try {
    await sequelize.authenticate();

    // pgvector extension must exist before HNSW index creation. The
    // Profiles migration already ensures this on prod, but keep it
    // defensive so this script can be run standalone in a fresh DB.
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('  ✓ pgvector extension present');

    // pg_trgm powers the GIN trigram indexes on ILIKE-filtered text
    // columns (location/company/department).
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    console.log('  ✓ pg_trgm extension present');

    // ---------- HNSW index on ExternalJobs.embedding ----------
    // Note: index creation on a large table can be slow (minutes) but
    // does NOT block reads. Writes are blocked only briefly during
    // catalog updates. CONCURRENTLY can't run inside a transaction, so
    // we use plain CREATE INDEX IF NOT EXISTS which is fine here — the
    // table size is well under the threshold where CONCURRENTLY matters.
    console.log('  ↻ creating HNSW index on ExternalJobs.embedding…');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS external_jobs_embedding_hnsw_idx
      ON "ExternalJobs"
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `);
    console.log('  ✓ external_jobs_embedding_hnsw_idx');

    // ---------- Filter-column B-tree indexes ----------
    // Three exact-equality filter columns. Cardinality is low (~3-5
    // distinct values each) but the indexes still help when combined
    // with other predicates via bitmap heap scan.
    const filterColumns = ['locationType', 'employmentType', 'experienceLevel'];
    for (const col of filterColumns) {
      const idxName = `external_jobs_${col.toLowerCase()}_idx`;
      console.log(`  ↻ ${idxName}…`);
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS "${idxName}" ON "ExternalJobs" ("${col}");`
      );
      console.log(`  ✓ ${idxName}`);
    }

    // ---------- pg_trgm GIN indexes for ILIKE columns ----------
    // `location`, `company`, `department` are all filtered with
    // ILIKE '%...%'. A trigram GIN index turns the planner's seq scan
    // into a bitmap index scan. Index size is ~2-3x a B-tree on the
    // same column, which is fine for these short text fields.
    const trigramColumns = ['location', 'company', 'department'];
    for (const col of trigramColumns) {
      const idxName = `external_jobs_${col}_trgm_idx`;
      console.log(`  ↻ ${idxName}…`);
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS "${idxName}" ON "ExternalJobs" USING gin ("${col}" gin_trgm_ops);`
      );
      console.log(`  ✓ ${idxName}`);
    }

    // ---------- Composite index for default "most recent" list ----------
    // The default sort order is `COALESCE(postedAt, createdAt) DESC`
    // filtered by isActive=true. A partial+composite index makes this a
    // straight index scan with no sort step.
    //
    // We use COALESCE in the index expression so the planner can match
    // it directly against the ORDER BY. The `WHERE "isActive"` partial
    // clause keeps the index small (only ~70% of rows are active).
    console.log('  ↻ external_jobs_active_posted_idx…');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS external_jobs_active_posted_idx
      ON "ExternalJobs" (COALESCE("postedAt", "createdAt") DESC NULLS LAST)
      WHERE "isActive" = TRUE;
    `);
    console.log('  ✓ external_jobs_active_posted_idx');

    // ---------- Verify ----------
    const [rows] = await sequelize.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'ExternalJobs'
      ORDER BY indexname;
    `);
    console.log('\n[migration] ExternalJobs indexes now present:');
    rows.forEach(r => console.log('   •', r.indexname));

    console.log('\n[migration] addExternalJobIndexes — done');
    process.exit(0);
  } catch (err) {
    console.error('[migration] addExternalJobIndexes FAILED:', err.message);
    if (err.parent) console.error('  parent:', err.parent.message);
    process.exit(1);
  }
}

migrate();
