/**
 * The interview prep library: research for well-known companies is built ahead of time and
 * refreshed on a slow schedule, so the first person to ask for "Google, Frontend Engineer" does
 * not wait for research and nobody pays for it twice. Everything lives in the shared
 * InterviewPreps table the normal flow already uses; this file only says which entries exist,
 * maps what a person typed onto one, and refreshes the stalest few each day.
 *
 * Nothing here runs unless INTERVIEW_LIBRARY_AUTO=true, because every refresh spends search and
 * model budget.
 */

const COMPANIES = [
  { name: 'Google', aliases: ['alphabet', 'google cloud', 'google llc'] },
  { name: 'Apple', aliases: ['apple computer'] },
  { name: 'Meta', aliases: ['facebook', 'meta platforms', 'instagram', 'whatsapp'] },
  { name: 'Nvidia', aliases: ['nvidia corporation'] },
  { name: 'Netflix', aliases: [] },
  { name: 'Salesforce', aliases: ['salesforce com'] },
  { name: 'Adobe', aliases: ['adobe systems'] },
  { name: 'Intel', aliases: ['intel corporation'] },
  { name: 'Cisco', aliases: ['cisco systems'] },
  { name: 'Uber', aliases: ['uber technologies'] },
  { name: 'Airbnb', aliases: [] },
  { name: 'Stripe', aliases: [] },
  { name: 'OpenAI', aliases: ['open ai'] },
  { name: 'Tesla', aliases: ['tesla motors'] },
  { name: 'PayPal', aliases: ['paypal holdings'] },
  { name: 'Intuit', aliases: [] },
  { name: 'LinkedIn', aliases: ['linked in'] },
  { name: 'Snap', aliases: ['snapchat', 'snap inc'] },
  { name: 'Pinterest', aliases: [] },
  { name: 'DoorDash', aliases: ['door dash'] },
];

const ROLES = [
  { id: 'frontend', title: 'Frontend Engineer', test: /front.?end|\bui (engineer|developer)\b|\breact\b|web (developer|engineer)/i },
  { id: 'backend', title: 'Backend Engineer', test: /back.?end|\bapi (engineer|developer)\b|server.?side|distributed systems|platform engineer|infrastructure engineer/i },
  { id: 'software', title: 'Software Engineer', test: /software|full.?stack|\bsde\b|\bswe\b|developer|programmer|\bengineer\b/i },
];
/* Engineers whose interviews are not the software loop. They keep their own research. */
const NOT_SOFTWARE = /machine learning|\bml\b|data (scientist|engineer|analyst)|security|devops|site reliab|\bsre\b|hardware|mechanical|electrical|solutions|sales|support|quality|\btest\b|\bqa\b|manager|director|product|design|research|mobile|\bios\b|android|embedded|firmware|network/i;

const KEEP_DAYS = 45;
const REFRESH_AFTER_DAYS = 30;
const DAY_MS = 24 * 3600 * 1000;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(inc|llc|ltd|corp|corporation|co|company|gmbh)\b/g, ' ').replace(/\s+/g, ' ').trim();

const BY_NAME = new Map();
for (const c of COMPANIES) {
  BY_NAME.set(norm(c.name), c);
  for (const a of c.aliases) BY_NAME.set(norm(a), c);
}

/** The library company for what a person typed, or null. Whole-name match only, so "Google Fiber Dental" is not Google. */
function libraryCompany(company) {
  return BY_NAME.get(norm(company)) || null;
}

/** The library role for a job title, or null for titles whose interviews are not the general software loop. */
function libraryRole(jobTitle) {
  const t = String(jobTitle || '');
  if (!t || NOT_SOFTWARE.test(t)) return null;
  return ROLES.find((r) => r.test.test(t)) || null;
}

/** {company, jobTitle} in the library's own words, or null when this pair is not in the library. */
function libraryMatch(company, jobTitle) {
  const c = libraryCompany(company);
  const r = c && libraryRole(jobTitle);
  return c && r ? { company: c.name, jobTitle: r.title, companyId: c.name.toLowerCase(), roleId: r.id } : null;
}

/** Every entry, company by company. */
function libraryEntries() {
  return COMPANIES.flatMap((c) => ROLES.map((r) => ({ company: c.name, jobTitle: r.title, companyId: c.name.toLowerCase(), roleId: r.id })));
}

/**
 * The entries most in need of research, stalest first: never built, then failed, then a thin result
 * older than a day (it may have been a bad run), then ready ones past REFRESH_AFTER_DAYS.
 */
async function pickStale({ models, keysOf, now = new Date(), only = null, roles = null, max = 4 }) {
  const rows = await models.InterviewPrep.findAll({});
  const byKey = new Map(rows.map((r) => [`${r.companyKey}|${r.roleKey}`, r]));
  const scored = [];
  for (const e of libraryEntries()) {
    if (only && !only.includes(e.companyId)) continue;
    if (roles && !roles.includes(e.roleId)) continue;
    const { companyKey, roleKey } = keysOf(e);
    const row = byKey.get(`${companyKey}|${roleKey}`);
    const age = row && row.generatedAt ? (now - new Date(row.generatedAt)) / DAY_MS : Infinity;
    let rank = null;
    if (!row) rank = 0;
    else if (row.status === 'failed') rank = 1;
    else if (row.status === 'pending') rank = null;
    else if (row.payload && row.payload.coverage === 'none' && age >= 1) rank = 2;
    else if (age >= REFRESH_AFTER_DAYS) rank = 3;
    if (rank !== null) scored.push({ e, rank, age: Number.isFinite(age) ? age : 1e6 });
  }
  scored.sort((a, b) => a.rank - b.rank || b.age - a.age);
  return scored.slice(0, max).map((s) => s.e);
}

/**
 * Refreshes up to `max` stale entries, one at a time. Returns a line per entry.
 * deps: service (makeInterviewPrepService result), models, keysOf(entry) -> {companyKey, roleKey}.
 */
async function refreshLibrary({ service, models, keysOf, max = 4, only = null, roles = null, dryRun = false, now = () => new Date(), pauseMs = 2000, log = console.log }) {
  const todo = await pickStale({ models, keysOf, now: now(), only, roles, max });
  const results = [];
  for (const e of todo) {
    if (dryRun) { results.push({ ...e, status: 'would refresh' }); continue; }
    const began = Date.now();
    let out;
    try {
      out = await service.start({ company: e.company, jobTitle: e.jobTitle, refresh: true });
      await service.whenIdle();
      const { companyKey, roleKey } = keysOf(e);
      const row = await models.InterviewPrep.findOne({ where: { companyKey, roleKey } });
      const p = row && row.payload ? row.payload : {};
      results.push({ ...e, status: row ? row.status : (out && out.status) || 'unknown', coverage: p.coverage || '', questions: (p.questions || []).length, sources: (p.sources || []).length, seconds: Math.round((Date.now() - began) / 1000) });
    } catch (err) {
      results.push({ ...e, status: 'error', error: String((err && err.message) || err).slice(0, 200), seconds: Math.round((Date.now() - began) / 1000) });
    }
    const r = results[results.length - 1];
    log(`[interviewLibrary] ${r.company} / ${r.jobTitle}: ${r.status}${r.coverage ? ` (${r.coverage}, ${r.questions} questions, ${r.sources} sources)` : ''}${r.error ? ` ${r.error}` : ''} in ${r.seconds}s`);
    if (pauseMs) await new Promise((res) => setTimeout(res, pauseMs));
  }
  return results;
}

let running = false;
/** Daily check, only when INTERVIEW_LIBRARY_AUTO=true. Each pass refreshes the few stalest entries, so spend is spread out. */
function startLibraryScheduler({ env = process.env, log = console.log } = {}) {
  if (String(env.INTERVIEW_LIBRARY_AUTO) !== 'true') return null;
  const perRun = Math.max(1, Math.min(20, Number(env.INTERVIEW_LIBRARY_PER_RUN) || 4));
  const pass = async () => {
    if (running) return;
    running = true;
    try {
      const { getSharedService } = require('./interviewPrepRuntime');
      const { companyKeyOf, roleKeyOf } = require('./interviewPrepService');
      const models = require('../models');
      await refreshLibrary({ service: getSharedService(), models, keysOf: (e) => ({ companyKey: companyKeyOf(e.company), roleKey: roleKeyOf(e.jobTitle) }), max: perRun, log });
    } catch (err) {
      log(`[interviewLibrary] pass failed: ${(err && err.message) || err}`);
    } finally {
      running = false;
    }
  };
  const first = setTimeout(pass, 5 * 60 * 1000);
  const every = setInterval(pass, DAY_MS);
  if (first.unref) first.unref();
  if (every.unref) every.unref();
  log(`[interviewLibrary] scheduler on: up to ${perRun} entries a day`);
  return { pass, stop: () => { clearTimeout(first); clearInterval(every); } };
}

module.exports = { COMPANIES, ROLES, KEEP_DAYS, REFRESH_AFTER_DAYS, libraryCompany, libraryRole, libraryMatch, libraryEntries, pickStale, refreshLibrary, startLibraryScheduler };
