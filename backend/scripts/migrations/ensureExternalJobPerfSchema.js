/**
 * Boot-time performance-schema guard for the ExternalJobs corpus.
 *
 * WHY THIS EXISTS
 * ---------------
 * The /external-jobs listing relies on several indexes and a generated
 * tsvector column to stay fast:
 *   - HNSW index on `embedding`         → semantic ANN ranking (recommended/match)
 *   - composite (isActive, recency)     → "most recent" + the recency UNION pool
 *   - GIN on `searchTsv`                → weighted full-text search
 *   - GIN on `skills` (jsonb_path_ops)  → ?skills= containment filter
 *   - b-tree on locationType/employmentType/experienceLevel → chip filters
 *   - pg_trgm GIN on location/company/department → ILIKE '%...%' filters
 *
 * These were previously only created by standalone migration scripts meant
 * to be run by hand on the Render shell (`node scripts/migrations/...`).
 * This project deploys via `git push` (Render auto-deploy) and those manual
 * scripts are NOT run as part of a deploy — so on a corpus that grew to 13k+
 * rows WITHOUT the HNSW index, every "recommended" page-1 request fell back
 * to a sequential cosine scan (~1.5s+), which is exactly the "jobs page is
 * slow" symptom.
 *
 * Running these here, idempotently, on server boot guarantees the schema is
 * present in prod no matter what. Every statement is `IF NOT EXISTS`, so once
 * the objects exist this is a cheap catalog check (a few ms).
 *
 * SAFETY
 * ------
 * - Purely additive: only CREATE EXTENSION / ADD COLUMN IF NOT EXISTS /
 *   CREATE INDEX IF NOT EXISTS. Never drops or rewrites data.
 * - The caller runs this in the background (NOT awaited) so a first-time
 *   HNSW build (which can take a little while) never delays server readiness.
 * - A non-concurrent CREATE INDEX briefly locks writes on ExternalJobs while
 *   it builds. On a corpus this size that's seconds and only happens the very
 *   first time (subsequent boots are no-ops). We accept that one-time cost in
 *   exchange for not requiring a manual ops step.
 */

const { sequelize } = require('../../models');

// Each step is independent: one failing (e.g. a permissions quirk on an
// extension) must not prevent the others from being created.
async function runStep(label, sql) {
  try {
    await sequelize.query(sql);
    console.log(`  ✓ ${label}`);
  } catch (err) {
    console.warn(`  ⚠️  ${label} skipped: ${err.message}`);
  }
}

async function up() {
  console.log('🚀 Ensuring ExternalJobs performance schema (indexes + searchTsv)…');

  // Extensions first — HNSW needs pgvector, trigram ILIKE needs pg_trgm.
  await runStep('extension vector', 'CREATE EXTENSION IF NOT EXISTS vector;');
  await runStep('extension pg_trgm', 'CREATE EXTENSION IF NOT EXISTS pg_trgm;');

  // Generated tsvector column for weighted full-text search (A=title,
  // B=company/department, C=description). STORED so it's indexable.
  await runStep('searchTsv column', `
    ALTER TABLE "ExternalJobs"
    ADD COLUMN IF NOT EXISTS "searchTsv" tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(department, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'C')
    ) STORED;
  `);
  await runStep('searchTsv GIN index', `
    CREATE INDEX IF NOT EXISTS "external_jobs_search_tsv_gin"
    ON "ExternalJobs" USING gin ("searchTsv");
  `);

  // Full-text search (searchTsv @@ plainto_tsquery) MUST hit the GIN index
  // above. If it doesn't, a search WITHOUT any structured filter (location/
  // date/experience) recheck-scans all ~12k+ rows, runs ts_rank_cd per row,
  // and sorts by recency — which blows the 15s statement_timeout and returns
  // HTTP 500. (Search + a filter stays fast because the filter's index
  // narrows the rows first.) A plain `CREATE INDEX` (above) takes a SHARE
  // lock that loses the race against the live cron writers, so on a busy
  // prod table it can fail and leave an INVALID index behind — and
  // `CREATE INDEX IF NOT EXISTS` then silently skips rebuilding it forever
  // (same failure mode as the skills index). So: (1) drop any INVALID
  // leftover, then (2) rebuild CONCURRENTLY, which doesn't block writers.
  await runStep('drop invalid searchTsv GIN', `
    DO $$
    DECLARE v_invalid boolean;
    BEGIN
      SELECT NOT i.indisvalid INTO v_invalid
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname = 'external_jobs_search_tsv_gin';
      IF v_invalid IS TRUE THEN
        EXECUTE 'DROP INDEX IF EXISTS "external_jobs_search_tsv_gin"';
      END IF;
    END $$;
  `);
  // CONCURRENTLY can't run inside a transaction block — sequelize.query runs
  // in autocommit here, so it's fine. IF NOT EXISTS makes it a no-op once a
  // valid index is present.
  await runStep('searchTsv GIN index (concurrent rebuild)', `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS "external_jobs_search_tsv_gin"
    ON "ExternalJobs" USING gin ("searchTsv");
  `);

  // HNSW vector index — the single most important one for the slow path.
  // Turns the cosine ANN ORDER BY into an index probe instead of a seq scan.
  await runStep('HNSW embedding index', `
    CREATE INDEX IF NOT EXISTS external_jobs_embedding_hnsw_idx
    ON "ExternalJobs"
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  `);

  // Composite/partial index for the default "most recent" sort AND the
  // recency UNION pool in recommended mode. Matches the COALESCE ORDER BY
  // exactly so it's a straight index scan with no sort step.
  await runStep('active+recency index', `
    CREATE INDEX IF NOT EXISTS external_jobs_active_posted_idx
    ON "ExternalJobs" (COALESCE("postedAt", "createdAt") DESC NULLS LAST)
    WHERE "isActive" = TRUE;
  `);

  // The `skills` column must be jsonb (not json) for the @> containment
  // filter, jsonb_typeof()/jsonb_array_elements_text() in /skills, and the
  // jsonb_path_ops GIN index below to work. The model originally declared it
  // as DataTypes.JSON → Postgres `json`, on which `@>` is undefined and
  // jsonb_typeof() errors, so BOTH the ?skills= filter and the /skills
  // endpoint returned HTTP 500. Convert in place (lossless for arrays of
  // strings), guarded so it only rewrites the table the first time.
  await runStep('skills column → jsonb', `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ExternalJobs'
          AND column_name = 'skills'
          AND data_type = 'json'
      ) THEN
        ALTER TABLE "ExternalJobs"
          ALTER COLUMN "skills" TYPE jsonb USING "skills"::jsonb;
      END IF;
    END $$;
  `);

  // GIN on skills (jsonb_path_ops) for the ?skills= @> containment filter.
  await runStep('skills GIN index', `
    CREATE INDEX IF NOT EXISTS "external_jobs_skills_gin"
    ON "ExternalJobs" USING gin ("skills" jsonb_path_ops);
  `);

  // Normalize legacy/polluted employmentType values to the 5 canonical chip
  // values (matches normalizeEmploymentType in externalJobService.js). Older
  // ingests let raw ATS metadata through ("Regular", "Standard", "Remote",
  // "Salary", "Pipeline", job titles, …), which made the Job Type chip
  // exclude those jobs. Map known synonyms, NULL the rest. Idempotent: the
  // WHERE clause skips already-canonical/NULL rows, so it's a no-op after the
  // first boot. Small targeted UPDATE (~couple thousand rows).
  await runStep('normalize employmentType', `
    UPDATE "ExternalJobs"
    SET "employmentType" = CASE
      WHEN LOWER("employmentType") LIKE '%full%' AND LOWER("employmentType") LIKE '%time%' THEN 'full-time'
      WHEN LOWER("employmentType") LIKE '%part%' AND LOWER("employmentType") LIKE '%time%' THEN 'part-time'
      WHEN LOWER("employmentType") LIKE '%contract%' OR LOWER("employmentType") LIKE '%freelance%' OR LOWER("employmentType") LIKE '%contractor%' THEN 'contract'
      WHEN LOWER("employmentType") LIKE '%intern%' THEN 'internship'
      WHEN LOWER("employmentType") LIKE '%temp%' OR LOWER("employmentType") LIKE '%seasonal%' OR LOWER("employmentType") LIKE '%fixed term%' OR LOWER("employmentType") LIKE '%fixed-term%' THEN 'temporary'
      WHEN LOWER(TRIM("employmentType")) IN ('regular','permanent','standard','employee','fte') THEN 'full-time'
      ELSE NULL
    END
    WHERE "employmentType" IS NOT NULL
      AND "employmentType" NOT IN ('full-time','part-time','contract','internship','temporary');
  `);

  // Exact-equality chip filters.
  for (const col of ['locationType', 'employmentType', 'experienceLevel']) {
    await runStep(`b-tree ${col}`, `
      CREATE INDEX IF NOT EXISTS "external_jobs_${col.toLowerCase()}_idx"
      ON "ExternalJobs" ("${col}");
    `);
  }

  // ILIKE '%...%' chip filters — trigram GIN.
  for (const col of ['location', 'company', 'department']) {
    await runStep(`trigram ${col}`, `
      CREATE INDEX IF NOT EXISTS "external_jobs_${col}_trgm_idx"
      ON "ExternalJobs" USING gin ("${col}" gin_trgm_ops);
    `);
  }

  console.log('✅ ExternalJobs performance schema ensured.');
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ ensureExternalJobPerfSchema failed:', err);
      process.exit(1);
    });
}

module.exports = { up };
