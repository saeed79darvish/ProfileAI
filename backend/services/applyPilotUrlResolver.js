/**
 * Resolves the apply URL for an application and backfills the persisted
 * jobUrl / applicationUrl columns when we discover them from the
 * underlying ExternalJob or Job rows.
 *
 * Why two columns?
 *   - `jobUrl`         → the canonical *job posting* page (where a human
 *                        reads the description). Surfaced as "View job
 *                        posting" in the UI.
 *   - `applicationUrl` → the page where submission actually happens.
 *                        Often identical to jobUrl, but Greenhouse / Lever
 *                        sometimes split them, and the submit worker /
 *                        ATS adapters always submit against this one.
 *
 * Both are written eagerly on creation today, but historic rows may have
 * only one populated, hence the two-step fallback chain. Callers must
 * `await app.save()` (or check app.changed()) after invoking this helper.
 *
 * Returns the resolved applyUrl (or null), and mutates `app` in place.
 */
async function resolveAndBackfillApplyUrl(app, { ExternalJob, Job }) {
  let applyUrl = app.applicationUrl || app.jobUrl || null;

  if (app.externalJobId && ExternalJob) {
    const ext = await ExternalJob.findByPk(app.externalJobId);
    applyUrl = applyUrl || ext?.applyUrl || ext?.sourceUrl || null;
    if (!app.applicationUrl && (ext?.applyUrl || ext?.sourceUrl)) {
      app.applicationUrl = ext?.applyUrl || ext?.sourceUrl || null;
    }
    if (!app.jobUrl && (ext?.sourceUrl || ext?.applyUrl)) {
      app.jobUrl = ext?.sourceUrl || ext?.applyUrl || null;
    }
    if (!app.atsProvider && ext?.source) {
      app.atsProvider = ext.source;
    }
  }

  if (!applyUrl && app.jobId && Job) {
    const intJob = await Job.findByPk(app.jobId);
    applyUrl = intJob?.applyUrl || intJob?.externalUrl || null;
    if (!app.applicationUrl && applyUrl) {
      app.applicationUrl = applyUrl;
    }
    if (!app.jobUrl) {
      app.jobUrl = intJob?.externalUrl || intJob?.applyUrl || null;
    }
  }

  return applyUrl;
}

module.exports = { resolveAndBackfillApplyUrl };
