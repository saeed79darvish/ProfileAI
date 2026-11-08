/**
 * Interview prep: what candidates recently reported being asked for a role at
 * a company, researched with a web search API, cited, and cached per
 * (company, role) for 21 days (shared by all users).
 *
 * Honesty rules enforced here, not just asked of the model:
 *  - every question / process fact carries at least one source that the search
 *    actually returned (items with no resolvable source are dropped);
 *  - only the text the search returned is used; stored excerpts are at most
 *    300 characters; emitted text never repeats more than 25 consecutive words
 *    of a source;
 *  - only the last 24 months count.
 *
 * The search and the model are injected so tests never touch the network.
 */

const DAY_MS = 86400000;
const CACHE_DAYS = 21;
const WINDOW_DAYS = 730;
const MAX_RESULTS_KEPT = 16;
const FORUM_MIN_CHARS = 300;
const FORUM_SLOTS = 2; // per forum site, when the post is clearly about this company
const BATCH_SIZE = 4;
const SEARCH_CONCURRENCY = 3;
const EXCERPT_MAX = 300;
const QUOTE_MAX_WORDS = 25;
const SOURCE_TEXT_FOR_MODEL = 5000;
const CATEGORIES = new Set(['coding', 'system_design', 'behavioral', 'role_specific', 'other']);
const DISCLAIMER = 'Summaries of what other candidates reported publicly. Questions change, so use this as a guide, not a promise.';
const NO_EVIDENCE_SUMMARY = 'We could not find recent public reports (from the last 2 years) of what candidates were asked for this role at this company, so there is nothing reliable to show yet.';

/* ---------- small text helpers ---------- */

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const STOP = new Set(['a', 'an', 'the', 'you', 'your', 'to', 'of', 'in', 'on', 'for', 'with', 'how', 'what', 'is', 'are', 'do', 'does', 'did', 'would', 'will', 'we', 'i', 'me', 'about', 'tell', 'us', 'can', 'could', 'and']);
const COMPANY_SUFFIX = new Set(['inc', 'llc', 'ltd', 'corp', 'corporation', 'co', 'company', 'gmbh']);

const tokens = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9+#. ]+/g, ' ').replace(/\.(?=\s|$)/g, ' ').split(/\s+/).filter(Boolean);

const companyKeyOf = (company) => tokens(company).filter((t) => !COMPANY_SUFFIX.has(t)).join(' ').slice(0, 120);
const roleKeyOf = (role) => tokens(role).sort().join(' ').slice(0, 160);
const LEVEL_IDS = ['intern', 'junior', 'mid', 'senior', 'staff', 'principal', 'manager'];
/** Lowercase level id, or '' for empty, "unknown" and anything not recognized. */
const levelIdOf = (level) => { const l = String(level || '').trim().toLowerCase(); return LEVEL_IDS.includes(l) ? l : ''; };
const GENERAL_KEY = 'general'; // company key shared by every role-and-level prep (no company)
/** Role-scope key: the level is part of it so "senior" and "junior" never share research. */
const roleLevelKeyOf = (role, level) => [...new Set(tokens(`${role} ${level || ''}`))].sort().join(' ').slice(0, 160);

/** Order-free, filler-free key so "Design a URL shortener" equals "URL shortener design". */
function questionKey(text) {
  const t = tokens(text).filter((w) => !STOP.has(w));
  return (t.length ? t : tokens(text)).sort().join(' ');
}

const wordNorm = (w) => w.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Returns guard(text): the text cut so it never repeats QUOTE_MAX_WORDS + 1
 * or more consecutive words found in any of the given source texts.
 */
function makeQuoteGuard(sourceTexts) {
  const N = QUOTE_MAX_WORDS + 1;
  const grams = new Set();
  for (const src of sourceTexts) {
    const w = String(src || '').split(/\s+/).map(wordNorm).filter(Boolean);
    for (let i = 0; i + N <= w.length; i += 1) grams.add(w.slice(i, i + N).join(' '));
  }
  return (text) => {
    const raw = String(text || '').trim().split(/\s+/);
    const norm = raw.map(wordNorm);
    const idx = norm.map((w, i) => (w ? i : -1)).filter((i) => i >= 0);
    for (let k = 0; k + N <= idx.length; k += 1) {
      if (grams.has(idx.slice(k, k + N).map((i) => norm[i]).join(' '))) {
        return raw.slice(0, idx[k + QUOTE_MAX_WORDS - 1] + 1).join(' ');
      }
    }
    return raw.join(' ');
  };
}

const excerptOf = (text) => {
  const t = clean(text, 100000);
  return t.length <= EXCERPT_MAX ? t : `${t.slice(0, EXCERPT_MAX - 1).trimEnd()}…`;
};

/** JSON out of a model reply: code fences tolerated, truncation repaired. Never throws. */
function parseModelJson(raw) {
  let text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.search(/[{[]/);
  if (start < 0) return null;
  text = text.slice(start);
  try { return JSON.parse(text); } catch { /* repair below */ }
  try {
    const { repairTruncatedJSON } = require('./resumeParserService');
    return repairTruncatedJSON(text);
  } catch { return null; }
}

const normUrl = (url) => {
  try {
    const u = new URL(String(url).trim());
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^ref$|^fbclid$/i.test(k)) u.searchParams.delete(k);
    return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch { return String(url || '').trim().toLowerCase(); }
};

const isoOrNull = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/* ---------- shared assembly (used by the search path and the Claude web search path) ---------- */

/** Merge questions whose normalized text is equal. items: [{text, category, urls:Set|[]}] */
function dedupeQuestions(items) {
  const byKey = new Map();
  for (const it of items) {
    const text = clean(it.text, 300);
    if (text.length < 8) continue;
    const key = questionKey(text);
    const urls = new Set([...(it.urls || [])]);
    const cur = byKey.get(key);
    if (cur) {
      for (const u of urls) cur.urls.add(u);
    } else {
      byKey.set(key, { text, category: CATEGORIES.has(it.category) ? it.category : 'other', urls });
    }
  }
  return [...byKey.values()];
}

/** Apply model-proposed groups of near-duplicate indices. Invalid groups are ignored. */
function mergeGroups(items, groups) {
  const used = new Set();
  const out = [];
  const merged = new Map();
  for (const g of Array.isArray(groups) ? groups : []) {
    const idx = [...new Set((Array.isArray(g) ? g : []).map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < items.length && !used.has(i));
    if (idx.length < 2) continue;
    idx.forEach((i) => used.add(i));
    const first = items[idx[0]];
    merged.set(idx[0], { text: first.text, category: first.category, urls: new Set(idx.flatMap((i) => [...items[i].urls])) });
    idx.slice(1).forEach((i) => merged.set(i, null));
  }
  items.forEach((it, i) => {
    if (merged.has(i)) { if (merged.get(i)) out.push(merged.get(i)); } else out.push(it);
  });
  return out;
}

/* ---------- job postings are not candidate reports ---------- */

const JOB_BOARD_HOSTS = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|myworkdayjobs\.com|icims\.com|jobvite\.com|bamboohr\.com|theladders\.com|peerlist\.io|jobmentis\.com|ziprecruiter\.com|simplyhired\.com|jooble\.org|wellfound\.com|dice\.com|monster\.com|indeed\.com|builtin\.com|remoteok\.com|weworkremotely\.com|agentic-engineering-jobs\.com)$/i;

/** True for a job posting or job board page: its "process" text describes a vacancy, not what candidates were asked. */
function isJobPostingUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const host = u.hostname.toLowerCase();
  const path = u.pathname.toLowerCase();
  if (/interview|experience|questions?/.test(path)) return false; // an interview page on a job site is still an interview page
  if (/(^|\.)(reddit\.com|teamblind\.com|leetcode\.com|news\.ycombinator\.com|quora\.com|substack\.com|medium\.com|dev\.to|levels\.fyi)$/.test(host)) return false; // forums: r/jobs is not a job board
  if (JOB_BOARD_HOSTS.test(host)) return true;
  if (/^(jobs|job-boards|talents|careers)\./.test(host)) return true;
  return /\/(jobs?|job-listing|viewjob|vacanc(y|ies)|positions?|openings?)(\/|$)/.test(path) || /\/careers?\/.*\/(apply|\d{5,})/.test(path);
}

/* ---------- one timeline instead of every source's wording ---------- */

// Sources name the same stage in many ways ("Recruiter call", "Recruiter Screen", "Initial screening").
// Each round is placed in a stage; rounds in the same stage are merged, and stages run in the usual order.
const STAGES = [
  { key: 'recruiter', label: 'Recruiter screen', test: /recruiter|\bhr\b|initial (call|screen|conversation)|intro(ductory)? (call|chat)/i },
  { key: 'assessment', label: 'Online assessment', test: /online assessment|codesignal|hackerrank|codility|take.?home|\boa\b|assessment/i },
  { key: 'phone', label: 'Technical phone screen', test: /phone|tech(nical)? screen|team screen|screening round/i },
  { key: 'design', label: 'System design', test: /system design|architecture|design (round|interview|exercise)/i },
  { key: 'ai', label: 'AI and ML focus', test: /\bai\b|\bllm\b|\brag\b|machine learning|agent/i },
  { key: 'behavioral', label: 'Behavioral and hiring manager', test: /behaviou?ral|values|culture|leadership|bar.?raiser|hiring manager|manager|team match/i },
  { key: 'final', label: 'Final review', test: /committee|debrief|offer|reference|final review/i },
  { key: 'onsite', label: 'Onsite loop', test: /^(?!.*(cod|design|behaviou?ral|values|manager)).*(on-?site|final (loop|round)|\bloop\b)/i },
  { key: 'coding', label: 'Coding rounds', test: /cod(e|ing)|algorithm|data structure|\blive\b|javascript|frontend|front.end/i },
];
const STAGE_ORDER = ['recruiter', 'assessment', 'phone', 'onsite', 'coding', 'design', 'ai', 'behavioral', 'final'];
const MAX_ROUNDS = 7;

function stageOf(round) {
  const name = `${round.name || ''}`;
  const hit = STAGES.find((st) => st.test.test(name)) || STAGES.find((st) => st.test.test(`${name} ${round.format || ''}`));
  return hit ? hit.key : null;
}

function mergeRounds(rounds) {
  const byKey = new Map();
  const other = [];
  for (const r of rounds) {
    const key = stageOf(r);
    if (!key) { if (!other.some((o) => o.name.toLowerCase() === r.name.toLowerCase())) other.push(r); continue; }
    const cur = byKey.get(key);
    if (!cur) { byKey.set(key, { ...r, sourceIds: [...r.sourceIds] }); continue; }
    for (const id of r.sourceIds) if (!cur.sourceIds.includes(id)) cur.sourceIds.push(id);
    if ((r.format || '').length > (cur.format || '').length) cur.format = r.format;
    if ((r.notes || '').length > (cur.notes || '').length) cur.notes = r.notes;
  }
  const label = (key) => STAGES.find((st) => st.key === key).label;
  const merged = STAGE_ORDER.filter((k) => byKey.has(k)).map((k) => ({ ...byKey.get(k), name: label(k) }));
  return [...merged, ...other].slice(0, MAX_ROUNDS);
}

function coverageOf(questions) {
  if (!questions.length) return 'none';
  const distinct = new Set(questions.flatMap((q) => q.sourceIds)).size;
  // "good" needs independent confirmation: at least two questions that two or more
  // separate sources report, not just a long list of one-off posts.
  const confirmed = questions.filter((q) => q.sourceIds.length >= 2).length;
  return questions.length < 5 || distinct < 3 || confirmed < 2 ? 'thin' : 'good';
}

/**
 * Builds the final payload.
 * sources: Map url -> { title, url, site, date, excerpt }  (every url any item cites must be in here)
 * questions: [{text, category, urls}]  rounds: [{name, format, notes, urls}]  tips: [{text, urls}]
 * topics: [{name, why, urls}]  timeline: {text, urls}|null
 */
function assemblePayload({ company, role, now = new Date(), sources: allSources, questions, rounds = [], tips = [], topics = [], timeline = null, summary = '', discussions = [] }) {
  const sources = new Map([...allSources].filter(([u]) => !isJobPostingUrl(u)));
  const idByUrl = new Map();
  const order = [];
  const idsFor = (urls) => {
    const ids = [];
    for (const u of urls || []) {
      if (!sources.has(u)) continue;
      if (!idByUrl.has(u)) { idByUrl.set(u, `s${idByUrl.size + 1}`); order.push(u); }
      ids.push(idByUrl.get(u));
    }
    return [...new Set(ids)];
  };
  const dateOf = (u) => (sources.get(u) && sources.get(u).date) || null;
  const guard = makeQuoteGuard([...sources.values()].map((s) => `${s.excerpt || ''} ${s.fullText || ''}`));

  const qs = questions.map((q) => {
    const urls = [...new Set([...q.urls].filter((u) => sources.has(u)))];
    const dates = urls.map(dateOf).filter(Boolean).sort();
    return {
      text: guard(q.text), category: CATEGORIES.has(q.category) ? q.category : 'other',
      frequency: urls.length, mostRecent: dates.length ? dates[dates.length - 1] : null, urls,
    };
  }).filter((q) => q.frequency > 0)
    .sort((a, b) => b.frequency - a.frequency || String(b.mostRecent || '').localeCompare(String(a.mostRecent || '')));

  const outQuestions = qs.map((q, i) => ({
    id: `q${i + 1}`, text: q.text, category: q.category, frequency: q.frequency, mostRecent: q.mostRecent, sourceIds: idsFor(q.urls),
  }));
  const outRounds = rounds.map((r) => ({
    name: guard(clean(r.name, 120)), format: guard(clean(r.format, 200)), notes: guard(clean(r.notes, 400)), sourceIds: idsFor(r.urls),
  })).filter((r) => r.name && r.sourceIds.length);
  const outTips = tips.map((t) => ({ text: guard(clean(t.text, 300)), sourceIds: idsFor(t.urls) })).filter((t) => t.text && t.sourceIds.length);
  const outTimeline = timeline && clean(timeline.text, 400) ? { text: guard(clean(timeline.text, 400)), sourceIds: idsFor(timeline.urls) } : null;
  const outTopics = topics.filter((t) => (t.urls || []).some((u) => sources.has(u)))
    .map((t) => ({ name: guard(clean(t.name, 100)), why: guard(clean(t.why, 300)) })).filter((t) => t.name);

  const coverage = coverageOf(outQuestions);
  // Only sources that something cites are kept; ids are already in citation order.
  const outSources = order.map((u) => {
    const s = sources.get(u);
    return { id: idByUrl.get(u), title: clean(s.title, 200), url: s.url, site: s.site || '', date: s.date || null, excerpt: excerptOf(s.excerpt) };
  });

  return {
    company, role,
    scope: company ? 'company' : 'role',
    generatedAt: now.toISOString(),
    coverage,
    summary: coverage === 'none' ? NO_EVIDENCE_SUMMARY : guard(clean(summary, 1200)) || fallbackSummary(outQuestions, outSources),
    process: {
      rounds: mergeRounds(outRounds),
      timeline: outTimeline && outTimeline.sourceIds.length ? outTimeline.text : null,
      timelineSourceIds: outTimeline ? outTimeline.sourceIds : [],
      tips: outTips,
    },
    questions: outQuestions,
    topics: outTopics,
    sources: outSources,
    // Threads about this company that could not be read in full (Reddit gives only a title): shown as links, never used as evidence.
    discussions: (Array.isArray(discussions) ? discussions : []).slice(0, 6).map((d) => ({ title: clean(d.title, 160), url: d.url, site: d.site || '', date: d.date || null })).filter((d) => d.title && d.url),
    disclaimer: DISCLAIMER,
  };
}

function fallbackSummary(questions, sources) {
  const sites = [...new Set(sources.map((s) => s.site).filter(Boolean))].slice(0, 4).join(', ');
  return `We found ${questions.length} question${questions.length === 1 ? '' : 's'} that candidates reported in the last 2 years, drawn from ${sources.length} public source${sources.length === 1 ? '' : 's'}${sites ? ` (${sites})` : ''}. Treat this as a guide, not a promise.`;
}

/* ---------- search + model pipeline ---------- */

// Where candidates write about their interviews. Each gets its own search, so one busy site
// cannot fill the results, and a couple of slots in the final list, so guides cannot push them out.
const FORUM_DOMAINS = ['reddit.com', 'leetcode.com', 'teamblind.com', 'substack.com'];
const GENERIC_DOMAINS_B = ['glassdoor.com', 'levels.fyi', 'interviewing.io'];

function buildQueries(company, role, level) {
  if (!company) {
    const lr = `${level ? `${level} ` : ''}${role}`;
    return [
      { query: `${lr} interview questions` },
      { query: `${role}${level ? ` ${level}` : ''} interview experience` },
      { query: `${lr} interview process` },
      ...FORUM_DOMAINS.map((d) => ({ query: d === 'leetcode.com' ? `${role}${level ? ` ${level}` : ''} interview experience` : `${lr} interview`, includeDomains: [d], fullText: true })),
      { query: `${lr} interview`, includeDomains: GENERIC_DOMAINS_B },
      { query: `how to prepare ${lr} interview what to expect` },
    ];
  }
  const cr = `${company} ${role}`;
  return [
    { query: `${cr} interview questions` },
    { query: `${cr} interview experience` },
    { query: `${company} interview process ${role}` },
    ...FORUM_DOMAINS.map((d) => ({ query: d === 'leetcode.com' ? `${cr} interview experience` : `${cr} interview`, includeDomains: [d], fullText: true })),
    { query: `${cr} interview`, includeDomains: GENERIC_DOMAINS_B },
    { query: `${company} interview guide how we hire ${role} careers blog` },
  ];
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) { const i = next; next += 1; out[i] = await fn(items[i], i); }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function rankResult(r, { company, role, now }) {
  const hay = `${r.title} ${r.url} ${r.content}`.toLowerCase();
  let score = 0;
  const c = tokens(company)[0];
  if (c && hay.includes(c)) score += 3;
  if (c && `${r.title} ${r.url}`.toLowerCase().includes(c)) score += 2;
  const roleHits = tokens(role).filter((t) => t.length > 2 && hay.includes(t)).length;
  score += Math.min(roleHits, 3);
  if (/interview/.test(hay)) score += 2;
  if (/question|asked|round|onsite|phone screen/.test(hay)) score += 1;
  if (r.publishedAt) score += Math.max(0, 2 - (now - new Date(r.publishedAt)) / (180 * DAY_MS));
  return score;
}

/* ---------- forum results: keep real posts, find their dates ---------- */

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const MONTH_YEAR = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(?:\d{1,2}(?:st|nd|rd|th)?,?\s+)?(20\d{2})\b/i;
const DAY_MONTH_YEAR = /\b\d{1,2}(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(20\d{2})\b/i;

/** Search APIs often send no date. LeetCode titles say "Aug 2024"; posts say "Posted on ...". First 800 characters only. */
function inferDate(title, content, now = new Date()) {
  for (const text of [String(title || ''), String(content || '').slice(0, 800)]) {
    const m = text.match(MONTH_YEAR) || text.match(DAY_MONTH_YEAR);
    if (!m) continue;
    const d = new Date(Date.UTC(Number(m[2]), MONTHS[m[1].toLowerCase()], 15));
    if (!Number.isNaN(d.getTime()) && d.getTime() <= now.getTime()) return d.toISOString();
  }
  return null;
}

/** A thread that is about being interviewed, not a hiring announcement or a job-board bot post. */
function isInterviewTalk(title, content) {
  const t = String(title || '');
  if (/\b(is|are) hiring\b|we.?re hiring|\bhiring:|\[hiring\]|job opening|apply (now|here)|\bnow hiring\b/i.test(t)) return false;
  // The title says so, or the text keeps coming back to interviewing (an essay that mentions a recruiter once does not count).
  if (/interview|on-?site|phone screen|\bOA\b|online assessment|behav|coding round|system design round|take.?home|rejected|\boffer\b|\bloop\b/i.test(t)) return true;
  return (String(content || '').match(/interview/gi) || []).length >= 2;
}

/** A listing, a search page or a stub is not a post: a Reddit page that is not a thread, or too little text. */
function isUsableForumResult(r) {
  const site = String(r.site || '').toLowerCase().replace(/^www\./, '');
  const forum = FORUM_DOMAINS.some((d) => site.endsWith(d));
  if (!forum) return true;
  if (site.endsWith('reddit.com') && !/\/comments\//.test(r.url)) return false;
  return String(r.content || '').length >= FORUM_MIN_CHARS;
}

async function gatherResults({ company, jobTitle, level, search, now }) {
  const queries = buildQueries(company, jobTitle, level);
  let firstError = null;
  let failures = 0;
  const lists = await mapLimit(queries, SEARCH_CONCURRENCY, async (q) => {
    try {
      const found = await search({ query: q.query, includeDomains: q.includeDomains, days: WINDOW_DAYS, maxResults: 8, fullText: !!q.fullText });
      if (q.includeDomains) console.log(`[interviewPrep] search ${q.includeDomains[0]}: ${(found || []).length} results`);
      return found;
    } catch (err) {
      failures += 1; firstError = firstError || err; return [];
    }
  });
  if (failures === queries.length) throw firstError;

  const cutoff = now.getTime() - WINDOW_DAYS * DAY_MS;
  const seen = new Map();
  const dropped = { stub: 0, notPost: 0, old: 0 };
  const discussions = new Map();
  const companyToken = tokens(company)[0];
  for (const r of lists.flat()) {
    if (!r || !r.url) continue;
    const content = clean(r.content, 8000);
    if (content.length < 40) continue;
    const notPost = String(r.site || '').endsWith('reddit.com') && !/\/comments\//.test(r.url);
    const publishedAt = isoOrNull(r.publishedAt) || inferDate(r.title, content, now);
    if (!isUsableForumResult({ ...r, content })) {
      dropped[notPost ? 'notPost' : 'stub'] += 1;
      const fresh = !publishedAt || new Date(publishedAt).getTime() >= cutoff;
      const about = companyToken && `${r.title} ${r.url}`.toLowerCase().includes(companyToken);
      if (!notPost && fresh && about && isInterviewTalk(r.title, content) && discussions.size < 6) discussions.set(normUrl(r.url), { title: clean(r.title, 160), url: r.url, site: r.site || '', date: publishedAt });
      continue;
    }
    if (publishedAt && new Date(publishedAt).getTime() < cutoff) {
      dropped.old += 1; // older than 24 months: not evidence, but a forum thread is still worth a link, with its date
      const forumHost = FORUM_DOMAINS.some((d) => String(r.site || '').toLowerCase().replace(/^www\./, '').endsWith(d));
      const about = companyToken && `${r.title} ${r.url}`.toLowerCase().includes(companyToken);
      if (forumHost && about && isInterviewTalk(r.title, content) && discussions.size < 6) discussions.set(normUrl(r.url), { title: clean(r.title, 160), url: r.url, site: r.site || '', date: publishedAt });
      continue;
    }
    const key = normUrl(r.url);
    const prev = seen.get(key);
    if (prev && prev.content.length >= content.length) continue;
    seen.set(key, { title: clean(r.title, 200), url: r.url, site: r.site || '', publishedAt, content });
  }
  const droppedNote = Object.entries(dropped).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`);
  const ranked = [...seen.values()]
    .map((r) => ({ r, score: rankResult(r, { company, role: jobTitle, now }) }))
    .sort((a, b) => b.score - a.score);
  const c = tokens(company)[0];
  const hostIs = (r, d) => String(r.site || '').toLowerCase().replace(/^www\./, '').endsWith(d);
  const chosen = new Set();
  for (const d of FORUM_DOMAINS) {
    ranked.filter((x) => hostIs(x.r, d) && (!c || `${x.r.title} ${x.r.url} ${x.r.content}`.toLowerCase().includes(c)))
      .slice(0, FORUM_SLOTS).forEach((x) => chosen.add(x));
  }
  for (const x of ranked) { if (chosen.size >= MAX_RESULTS_KEPT) break; chosen.add(x); }
  const bySite = {};
  for (const x of chosen) bySite[x.r.site || '?'] = (bySite[x.r.site || '?'] || 0) + 1;
  console.log(`[interviewPrep] sent to the model: ${chosen.size} results (${Object.entries(bySite).map(([k, v]) => `${k} ${v}`).join(', ')}); dropped before ranking: ${droppedNote.join(', ') || 'none'}`);
  const out = [...chosen].sort((a, b) => b.score - a.score).map((x) => x.r);
  out.discussions = [...discussions.values()];
  return out;
}

const EXTRACT_SYSTEM = `You extract interview facts from web page text for job seekers. Strict rules:
- Use ONLY what is explicitly written in the given sources. Never add, guess or generalize. If a source says nothing about interviews at the given company for the given role, return empty lists for it. When no company is given, the research is general: it covers the given role and level across companies, so keep reports about that role and level from any company and ignore other roles.
- Ignore ads, unrelated companies and unrelated roles.
- On a forum page (Reddit, LeetCode Discuss, Blind, a newsletter) the original post and the comments by candidates are reports: when someone says what they were asked, how many rounds there were or how it went, that counts. Skip replies that only give opinions or advice with no account of an interview.
- Paraphrase every question and fact in your own words. Never copy more than 25 consecutive words from a source.
- Every item must list the source indexes (the numbers in [Source N]) that state it.
- category is one of: coding, system_design, behavioral, role_specific, other.
Return ONLY JSON: {"questions":[{"text":"","category":"","sources":[0]}],"rounds":[{"name":"","format":"","notes":"","sources":[0]}],"timeline":{"text":"","sources":[0]}|null,"tips":[{"text":"","sources":[0]}],"topics":[{"name":"","why":"","sources":[0]}]}`;

function extractPrompt({ company, role, level, batch }) {
  const blocks = batch.map((s, i) => `[Source ${i}] ${s.title}\nURL: ${s.url}\nDate: ${s.publishedAt || 'unknown'}\n${s.content.slice(0, SOURCE_TEXT_FOR_MODEL)}`).join('\n\n---\n\n');
  return `${company ? `Company: ${company}` : 'Company: none (general research for this role and level across companies)'}\nRole: ${role}${level ? `\nLevel: ${level}` : ''}\n\nSources:\n\n${blocks}`;
}

const validIdx = (arr, max) => [...new Set((Array.isArray(arr) ? arr : []).map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < max);

/**
 * @param {object} args
 * @param {string} args.company @param {string} args.jobTitle @param {string} [args.level]
 * @param {(opts:{query:string, includeDomains?:string[], days:number, maxResults:number}) => Promise<Array>} args.search
 * @param {(call:{system:string, prompt:string, maxTokens:number, purpose:string}) => Promise<string>} args.runModel
 */
async function researchInterview({ company, jobTitle, level, search, runModel, now = new Date() }) {
  const role = clean(jobTitle, 160);
  const results = await gatherResults({ company, jobTitle: role, level, search, now });
  const sources = new Map();
  const base = { company, role, now, sources };
  const discussions = results.discussions || [];
  if (!results.length) return assemblePayload({ ...base, questions: [], discussions });

  const rawQuestions = []; const rounds = []; const tips = []; const topics = []; let timeline = null;
  let okBatches = 0; let tried = 0;
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    tried += 1;
    let parsed = null;
    try {
      parsed = parseModelJson(await runModel({ system: EXTRACT_SYSTEM, prompt: extractPrompt({ company, role, level, batch }), maxTokens: 3000, purpose: 'extract' }));
    } catch { parsed = null; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    okBatches += 1;
    const urlsOf = (idx) => validIdx(idx, batch.length).map((k) => {
      const s = batch[k];
      if (!sources.has(s.url)) sources.set(s.url, { title: s.title, url: s.url, site: s.site, date: s.publishedAt, excerpt: excerptOf(s.content), fullText: s.content });
      return s.url;
    });
    const list = (v) => (Array.isArray(v) ? v : []);
    for (const q of list(parsed.questions)) { const urls = urlsOf(q && q.sources); if (urls.length && q.text) rawQuestions.push({ text: q.text, category: q.category, urls }); }
    for (const r of list(parsed.rounds)) { const urls = urlsOf(r && r.sources); if (urls.length && r.name) rounds.push({ ...r, urls }); }
    for (const t of list(parsed.tips)) { const urls = urlsOf(t && t.sources); if (urls.length && t.text) tips.push({ text: t.text, urls }); }
    for (const t of list(parsed.topics)) { const urls = urlsOf(t && t.sources); if (urls.length && t.name) topics.push({ ...t, urls }); }
    if (!timeline && parsed.timeline && parsed.timeline.text) { const urls = urlsOf(parsed.timeline.sources); if (urls.length) timeline = { text: parsed.timeline.text, urls }; }
  }
  if (tried > 0 && okBatches === 0) throw Object.assign(new Error('The model returned no usable answer'), { code: 'model_failed' });

  // Merge duplicate rounds by name and tips by text.
  const roundMap = new Map();
  for (const r of rounds) {
    const k = tokens(r.name).sort().join(' ');
    const cur = roundMap.get(k);
    if (cur) { r.urls.forEach((u) => cur.urls.push(u)); if (!cur.notes && r.notes) cur.notes = r.notes; if (!cur.format && r.format) cur.format = r.format; } else roundMap.set(k, { ...r, urls: [...r.urls] });
  }
  const tipMap = new Map();
  for (const t of tips) { const k = questionKey(t.text); const cur = tipMap.get(k); if (cur) cur.urls.push(...t.urls); else tipMap.set(k, { ...t, urls: [...t.urls] }); }
  const topicMap = new Map();
  for (const t of topics) { const k = tokens(t.name).sort().join(' '); const cur = topicMap.get(k); if (cur) cur.urls.push(...t.urls); else topicMap.set(k, { ...t, urls: [...t.urls] }); }

  let questions = dedupeQuestions(rawQuestions);
  if (questions.length >= 2 && questions.length <= 80) {
    try {
      const raw = await runModel({
        system: 'You find near-duplicate interview questions. Two questions are duplicates only if they ask for the same thing. Return ONLY JSON: {"groups":[[0,3],[2,5]]} listing indexes of duplicates; use {"groups":[]} if none.',
        prompt: questions.map((q, i) => `${i}: ${q.text}`).join('\n'), maxTokens: 800, purpose: 'dedupe',
      });
      const parsed = parseModelJson(raw);
      if (parsed && Array.isArray(parsed.groups)) questions = mergeGroups(questions, parsed.groups);
    } catch { /* keep the exact-match merge */ }
  }

  let summary = '';
  if (questions.length) {
    try {
      const facts = {
        questions: questions.slice(0, 25).map((q) => ({ text: q.text, category: q.category, reportedBySources: q.urls.size })),
        rounds: [...roundMap.values()].map((r) => ({ name: r.name, format: r.format, notes: r.notes })),
        timeline: timeline && timeline.text, tips: [...tipMap.values()].map((t) => t.text),
      };
      const parsed = parseModelJson(await runModel({
        system: `Write a 3 to 5 sentence summary of how interviewing for this role ${company ? 'at this company ' : 'and level across companies '}goes, for a candidate. Use ONLY the facts given; add nothing, and say plainly when the facts are thin. No more than 25 consecutive words from any source. Return ONLY JSON: {"summary":""}`,
        prompt: `${company ? `Company: ${company}\n` : ''}Role: ${role}\nFacts (from public candidate reports):\n${JSON.stringify(facts)}`, maxTokens: 600, purpose: 'summary',
      }));
      summary = parsed && typeof parsed.summary === 'string' ? parsed.summary : '';
    } catch { summary = ''; }
  }

  return assemblePayload({
    ...base, questions, rounds: [...roundMap.values()], tips: [...tipMap.values()], topics: [...topicMap.values()], timeline, summary, discussions,
  });
}

/* ---------- personalize ---------- */

const PROBE_SYSTEM = `You prepare a candidate for an interview. You get their real profile and public research about the interview. Write 4 to 6 practice probes: questions the interviewer is likely to ask THIS person.
Rules: each probe must point at something that is actually written in the profile, or at a clear gap (the research expects something the profile does not mention). Never invent experience, employers, numbers or skills. "basedOn" quotes or names the profile item, or starts with "Not in your profile:" for a gap. "why" is one sentence tied to the research.
Return ONLY JSON: {"probes":[{"question":"","why":"","basedOn":""}]}`;

function profileSnapshot(p) {
  if (!p || typeof p !== 'object') return '';
  const pick = (v, max) => clean(typeof v === 'string' ? v : JSON.stringify(v ?? ''), max);
  const parts = [];
  for (const [k, max] of [['title', 200], ['headline', 200], ['summary', 1200], ['skills', 1500], ['experience', 4000], ['education', 800], ['projects', 1500], ['certifications', 400]]) {
    if (p[k] && (typeof p[k] !== 'object' || Object.keys(p[k]).length)) parts.push(`${k}: ${pick(p[k], max)}`);
  }
  return parts.join('\n').slice(0, 9000);
}

async function personalizeProbes({ prep, profile, runModel }) {
  const snapshot = profileSnapshot(profile);
  if (!snapshot) throw Object.assign(new Error('Add some details to your profile first.'), { status: 422, code: 'profile_empty' });
  const research = {
    role: prep.role, company: prep.company,
    topics: (prep.topics || []).slice(0, 8),
    questions: (prep.questions || []).slice(0, 15).map((q) => ({ text: q.text, category: q.category })),
  };
  const parsed = parseModelJson(await runModel({
    system: PROBE_SYSTEM, prompt: `Research:\n${JSON.stringify(research)}\n\nCandidate profile:\n${snapshot}`, maxTokens: 1500, purpose: 'personalize',
  }));
  const probes = (parsed && Array.isArray(parsed.probes) ? parsed.probes : [])
    .map((p) => ({ question: clean(p && p.question, 300), why: clean(p && p.why, 300), basedOn: clean(p && p.basedOn, 300) }))
    .filter((p) => p.question && p.basedOn)
    .slice(0, 6);
  if (!probes.length) throw Object.assign(new Error('Could not build practice questions. Try again.'), { status: 502, code: 'personalize_failed' });
  return probes;
}

/* ---------- cache + background runs ---------- */

const PENDING_STALE_MS = 10 * 60 * 1000;
const REFRESH_MIN_AGE_MS = 24 * 3600 * 1000;
const withScope = (p) => (p && typeof p === 'object' ? { ...p, scope: p.scope || (p.company ? 'company' : 'role'), level: p.level || '' } : p);
const badRequest = (message, code = 'invalid_request') => Object.assign(new Error(message), { status: 400, code });

/**
 * @param {object} deps
 * @param {object} deps.InterviewPrep  Sequelize-like model (findOne, findByPk, create)
 * @param {() => Function} deps.getResearch  returns async ({company, jobTitle, level}) -> payload; throws search_not_configured
 */
function makeInterviewPrepService({ InterviewPrep, getResearch, now = () => new Date() }) {
  const inFlight = new Map();

  async function runInBackground(row, input) {
    const key = `${row.companyKey}|${row.roleKey}`;
    const task = (async () => {
      try {
        const research = getResearch();
        const payload = { ...(await research(input)), level: input.company ? '' : levelIdOf(input.level) };
        const t = now();
        // An empty result may be a bad run, not a fact about the company: retry after a day.
        const keepDays = payload.coverage === 'none' ? 1 : CACHE_DAYS;
        await row.update({ status: 'ready', payload, error: null, generatedAt: t, expiresAt: new Date(t.getTime() + keepDays * DAY_MS) });
      } catch (err) {
        console.error('[interviewPrep] research failed:', err && err.message);
        try { await row.update({ status: 'failed', error: clean((err && err.message) || 'failed', 500) }); } catch { /* row gone */ }
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, task);
  }

  /**
   * @returns {Promise<{id, status, prep?, blocked?}>}
   * gate: async () => boolean, called right before a NEW research run starts (rate limit hook).
   */
  async function start({ company, jobTitle, level, refresh = false, gate }) {
    const c = clean(company, 120); const r = clean(jobTitle, 160); const lv = c ? clean(level, 40) : levelIdOf(level);
    // Without a company the research is about the role and level across companies.
    if (!r || (!c && !lv)) throw badRequest(c || !r ? 'company and jobTitle are required' : 'level is required when there is no company');
    const companyKey = c ? companyKeyOf(c) : GENERAL_KEY;
    const roleKey = c ? roleKeyOf(r) : roleLevelKeyOf(r, lv);
    if (!companyKey || !roleKey) throw badRequest('company and jobTitle are required');
    const key = `${companyKey}|${roleKey}`;
    const t = now();

    let row = await InterviewPrep.findOne({ where: { companyKey, roleKey } });
    if (row && row.status === 'ready' && row.payload && row.expiresAt && new Date(row.expiresAt) > t) {
      const age = t - new Date(row.generatedAt || row.updatedAt || 0);
      if (!refresh || age < REFRESH_MIN_AGE_MS) return { id: row.id, status: 'ready', prep: withScope(row.payload) };
    }
    if (row && row.status === 'pending') {
      if (inFlight.has(key)) return { id: row.id, status: 'pending' };
      if (t - new Date(row.updatedAt || 0) < PENDING_STALE_MS) return { id: row.id, status: 'pending' };
    }
    if (inFlight.has(key)) return { id: row ? row.id : null, status: 'pending' };

    getResearch(); // throws search_not_configured before anything is created
    if (gate && !(await gate())) return { blocked: true };

    if (row) {
      await row.update({ status: 'pending', error: null });
    } else {
      try {
        row = await InterviewPrep.create({ companyKey, roleKey, status: 'pending' });
      } catch (err) {
        if (err && err.name === 'SequelizeUniqueConstraintError') {
          row = await InterviewPrep.findOne({ where: { companyKey, roleKey } });
          if (row && (inFlight.has(key) || row.status === 'pending')) return { id: row.id, status: 'pending' };
        } else throw err;
      }
    }
    await runInBackground(row, { company: c, jobTitle: r, level: lv || level });
    return { id: row.id, status: 'pending', started: true };
  }

  async function get(id) {
    const row = await InterviewPrep.findByPk(id);
    if (!row) return null;
    return { id: row.id, status: row.status, prep: row.status === 'ready' ? withScope(row.payload) : null, error: row.status === 'failed' ? row.error : null };
  }

  const whenIdle = () => Promise.all([...inFlight.values()]);

  return { start, get, whenIdle, _inFlight: inFlight };
}

module.exports = {
  researchInterview, personalizeProbes, makeInterviewPrepService,
  // shared with the Claude web search path
  assemblePayload, mergeRounds, isJobPostingUrl, inferDate, isUsableForumResult, isInterviewTalk, dedupeQuestions, mergeGroups, coverageOf, makeQuoteGuard, parseModelJson, excerptOf, normUrl, isoOrNull, clean,
  companyKeyOf, roleKeyOf, roleLevelKeyOf, levelIdOf, GENERAL_KEY, questionKey, profileSnapshot, buildQueries,
  CACHE_DAYS, WINDOW_DAYS, DISCLAIMER, NO_EVIDENCE_SUMMARY,
};
