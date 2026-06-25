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

  // Widen `location` to TEXT. The model declares it TEXT, but prod drifted to
  // varchar(255). Greenhouse builds location from the joined office list
  // ((job.offices||[]).map(o=>o.name).join(', ')), which for big multi-office
  // companies (Datadog/Fastly/Flexport) exceeds 255 chars and fails the WHOLE
  // board insert with "value too long for type character varying(255)" — those
  // boards got stuck at 0 jobs. `location` is NOT referenced by the
  // searchTsv/searchTsvAB generated columns, so this is a fast catalog-only
  // change (varchar→text needs no table rewrite). The other varchar(255)
  // columns ARE generated-column-referenced and can't be altered in place;
  // they're clamped to 255 at ingest instead (clampVarchar255Fields).
  await runStep('widen location to TEXT', `
    SET lock_timeout = '5s';
    ALTER TABLE "ExternalJobs" ALTER COLUMN "location" TYPE TEXT;
  `);

  // Generated tsvector column for weighted full-text search.
  //
  // RETIRED (2026-06-24): the description-bearing `searchTsv` (weight C =
  // description) is no longer read by ANY query path — both the route
  // (routes/externalJobs.js) and the semantic path (jobEmbeddingService.js)
  // now filter on the smaller `searchTsvAB` (title+company/dept, no
  // description). The old column + its big GIN index were pure dead weight:
  // a large TOASTed tsvector stored per row plus a description-sized GIN
  // index, BOTH re-maintained on every upsert (slowing board syncs) while
  // being queried by nobody. Dropping them reclaims significant disk and
  // removes one index-maintenance pass per write. DROP INDEX frees its space
  // immediately; DROP COLUMN of a STORED generated column is catalog-only
  // (fast) and reclaims the per-row tsvector lazily as rows churn on re-sync.
  await runStep('drop dead searchTsv index + column', `
    SET lock_timeout = '5s';
    DROP INDEX IF EXISTS "external_jobs_search_tsv_gin";
    ALTER TABLE "ExternalJobs" DROP COLUMN IF EXISTS "searchTsv";
  `);

  // Title + company/department ONLY tsvector (weights A/B, NO description).
  // The /external-jobs search intentionally rejects description-only hits (a
  // Back-End JD that merely mentions "frontend" must NOT match a "Frontend
  // Engineer" search). That used to be enforced with a per-row
  // `ts_rank_cd('{0,0,1,1}', searchTsv, query) > 0` post-filter — but on a
  // common term like "engineer" that matches thousands of rows, computing
  // ts_rank_cd per row for BOTH the SELECT and findAndCountAll's COUNT pass
  // blew the 15s statement_timeout (→ 500), while a rare term like
  // "kubernetes" squeaked through. This dedicated A/B-only tsvector lets the
  // route use a single GIN-indexable `searchTsvAB @@ query` predicate that
  // (a) inherently excludes description-only matches and (b) needs no per-row
  // ranking, so both the bitmap COUNT and the recency sort stay fast.
  await runStep('searchTsvAB column', `
    SET lock_timeout = '5s';
    ALTER TABLE "ExternalJobs"
    ADD COLUMN IF NOT EXISTS "searchTsvAB" tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(department, '')), 'B')
    ) STORED;
  `);
  await runStep('searchTsvAB GIN index', `
    SET lock_timeout = '5s';
    CREATE INDEX IF NOT EXISTS "external_jobs_search_tsv_ab_gin"
    ON "ExternalJobs" USING gin ("searchTsvAB");
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
