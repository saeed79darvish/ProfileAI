/**
 * Picks the next jobs to show after the person says they applied: their saved
 * (not yet applied) jobs first, then other jobs from the same company, then a
 * plain list search shaped like what they were browsing. Only free list and
 * search calls; nothing here touches an AI or embedding endpoint.
 */
const QUERY_KEYS = [
  'search', 'locationType', 'location', 'datePosted', 'experienceLevel',
  'company', 'department', 'employmentType', 'skills', 'startup', 'scope', 'sort',
];

export function listParamsFromQuery(search = '') {
  const out = {};
  try {
    const q = new URLSearchParams(search || '');
    QUERY_KEYS.forEach((k) => { const v = q.get(k); if (v) out[k] = v; });
  } catch (_) { /* ignore */ }
  return out;
}

const sameRole = (a, b) =>
  a && b && String(a.title || '').trim().toLowerCase() === String(b.title || '').trim().toLowerCase()
  && String(a.company || '').trim().toLowerCase() === String(b.company || '').trim().toLowerCase();

/** Dedupes by id, drops the excluded job and applied ones, keeps order, caps at limit. */
export function pickNext(pool, { excludeId = null, applied = [], current = null, limit = 3 } = {}) {
  const skip = new Set((applied || []).map(String));
  if (excludeId) skip.add(String(excludeId));
  const seen = new Set();
  const out = [];
  for (const j of pool || []) {
    if (!j || !j.id) continue;
    const id = String(j.id);
    if (skip.has(id) || seen.has(id)) continue;
    if (current && sameRole(j, current)) continue;
    seen.add(id);
    out.push(j);
    if (out.length >= limit) break;
  }
  return out;
}

export function matchPercent(job) {
  const r = Number(job?.relevanceScore);
  if (Number.isFinite(r) && r > 0) return Math.round(r <= 1 ? r * 100 : r);
  const s = Number(job?.similarityScore);
  if (Number.isFinite(s) && s > 0) return Math.round(s <= 1 ? s * 100 : s);
  return null;
}

/**
 * api: { getSaved, getAll, checkApplied } (the externalJobAPI helpers).
 * ctx: { jobId, title, company, listQuery }.
 */
export async function fetchNextJobs(api, ctx = {}, limit = 3) {
  const current = { title: ctx.title, company: ctx.company };
  const sources = [
    async () => (await api.getSaved())?.data?.savedJobs || [],
    async () => (ctx.company ? (await api.getAll({ company: ctx.company, limit: 12 }))?.data?.jobs || [] : []),
    async () => (await api.getAll({ ...listParamsFromQuery(ctx.listQuery), limit: 15 }))?.data?.jobs || [],
  ];
  let pool = [];
  let applied = [];
  let result = [];
  for (const source of sources) {
    try { pool = pool.concat(await source()); } catch (_) { /* try the next source */ }
    const ids = pickNext(pool, { excludeId: ctx.jobId, current, limit: 1000 }).map((j) => j.id);
    if (ids.length) {
      try {
        const res = await api.checkApplied(ids);
        applied = res?.data?.appliedExternalJobIds || [];
      } catch (_) { /* treat as none applied */ }
    }
    result = pickNext(pool, { excludeId: ctx.jobId, applied, current, limit });
    if (result.length >= limit) break;
  }
  return result;
}
