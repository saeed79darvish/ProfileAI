/**
 * Interview research through Claude's server-side web search tool.
 *
 * Search and reading happen inside one Claude call, so there is no raw page
 * text: sources come from the search results and the citations in the answer.
 *
 * HONESTY GATE: the model's JSON is only a proposal. Any question, round, tip
 * or topic that cites a URL which is not in the search results or citations
 * (or is older than 24 months) is dropped; frequency is recomputed from the
 * distinct cited URLs.
 */

const {
  assemblePayload, dedupeQuestions, parseModelJson, excerptOf, normUrl, isoOrNull, clean, WINDOW_DAYS,
} = require('../interviewPrepService');
const { hostOf } = require('./searchProvider');

const MODEL = process.env.INTERVIEW_PREP_MODEL || 'claude-sonnet-5-5';
const MAX_TOKENS = 16000;
const MAX_USES = 8;
const MAX_CONTINUATIONS = 3;
const TARGETED_MAX_USES = 5;
// reddit.com is not listed: Anthropic's crawler cannot read it (a 400 'not accessible'). Tavily or Exa cover Reddit.
const TARGET_DOMAINS = ['leetcode.com', 'substack.com', 'teamblind.com', 'glassdoor.com', 'levels.fyi'];
const TOOL_TYPES = ['web_search_20260209', 'web_search_20250305'];

const SYSTEM = `You research what job candidates recently reported about interviewing for a specific role at a specific company, using web search. Strict rules:
- Do not write commentary between searches. Your only text output is the final JSON.
- Look only at content from the last 24 months, newest first. Search broadly: Reddit, LeetCode Discuss, Blind, Glassdoor, Levels.fyi, interviewing.io and the company's own interview or careers pages, wherever they appear.
- Use only what candidates reported about being interviewed (interview experiences, forum threads, review sites, interview guides). A job posting or careers page describes a vacancy, not an interview: never use one as evidence for a question or a round.
- Every question and every process fact MUST be supported by a web result you found. Never invent. Ignore unrelated companies and roles.
- Paraphrase. Never copy more than 25 consecutive words from a source.
- If the evidence is thin, say so in the summary and return fewer items. Empty lists are fine.
- Cite by the full URL of the web result in "sourceUrls".
- rounds: list each interview stage ONCE, in the order candidates meet them, at most 7 (for example recruiter screen, phone screen, coding, system design, behavioral). Never list the same stage twice under different names; put variations in notes.
- category is one of: coding, system_design, behavioral, role_specific, other. Merge duplicate questions into one item with all its sources.
Finish with ONLY this JSON (no other prose after it):
{"summary":"3 to 5 sentences, only from sources","timeline":{"text":"","sourceUrls":[]}|null,"rounds":[{"name":"","format":"","notes":"","sourceUrls":[]}],"tips":[{"text":"","sourceUrls":[]}],"questions":[{"text":"","category":"","sourceUrls":[]}],"topics":[{"name":"","why":"","sourceUrls":[]}],"sources":[{"url":"","postedOn":"YYYY-MM-DD or YYYY-MM or null","note":""}]}
"sources" lists every url you cited. postedOn is the date the post or review was published, only when the page itself shows it, otherwise null (never guess). note is one short sentence in your own words on what that source says about this interview.`;

let sharedClient = null;
function defaultClient() {
  if (!sharedClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    sharedClient = new (Anthropic.default || Anthropic)({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 180000 });
  }
  return sharedClient;
}

const isToolTypeComplaint = (err) => err && err.status === 400 && /web_search|tool/i.test(String(err.message || ''));

/** page_age arrives as text such as "73 days ago" or "April 30, 2025". */
function pageAgeToIso(v, now) {
  if (!v || typeof v !== 'string') return null;
  const rel = v.trim().match(/^(\d+)\s+(day|week|month|year)s?\s+ago$/i);
  if (rel) {
    const per = { day: 1, week: 7, month: 30, year: 365 }[rel[2].toLowerCase()];
    return new Date(now.getTime() - Number(rel[1]) * per * 86400000).toISOString();
  }
  return isoOrNull(v);
}

/** Pulls sources out of server tool blocks and citations. Branches on list vs error object. */
function collectSources(blocks, now) {
  const cutoff = now.getTime() - WINDOW_DAYS * 86400000;
  const map = new Map(); // normalized url -> source
  const add = (url, title, date, cited) => {
    if (!url) return;
    const key = normUrl(url);
    const cur = map.get(key) || { title: '', url, site: hostOf(url), date: null, excerpt: '' };
    if (!cur.title && title) cur.title = clean(title, 200);
    if (!cur.date && date) cur.date = date;
    if (!cur.excerpt && cited) cur.excerpt = excerptOf(cited);
    map.set(key, cur);
  };
  for (const b of blocks) {
    if (!b) continue;
    if (b.type === 'web_search_tool_result') {
      if (Array.isArray(b.content)) {
        for (const r of b.content) if (r && r.type === 'web_search_result') add(r.url, r.title, pageAgeToIso(r.page_age, now), '');
      } // else: { error_code } object with HTTP 200 - no sources from this search
    } else if (b.type === 'text' && Array.isArray(b.citations)) {
      for (const c of b.citations) if (c && c.url) add(c.url, c.title, null, c.cited_text);
    }
  }
  for (const [k, s] of map) if (s.date && new Date(s.date).getTime() < cutoff) map.delete(k);
  return map;
}

/**
 * @returns {Promise<object>} the same payload as researchInterview
 */
async function runPass({ company, role, level, client, model, now, log, domains: wantedDomains = null, maxUses = MAX_USES }) {
  let domains = wantedDomains ? [...wantedDomains] : null;
  const { createMessage } = require('../ai/core');
  const userPrompt = `Company: ${company}\nRole: ${role}${level ? `\nLevel: ${level}` : ''}\n\nResearch the last 24 months of what candidates report about interviewing for this role at this company, then answer with the JSON.${domains ? ` Search only these sites: ${domains.join(', ')}.` : ''}`;
  const messages = [{ role: 'user', content: userPrompt }];
  let toolIdx = 0;
  const allBlocks = [];
  let final = null;
  const usage = { input: 0, output: 0, searches: 0 };

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn += 1) {
    let response;
    for (;;) {
      const request = {
        model, max_tokens: MAX_TOKENS, system: SYSTEM, messages,
        tools: [{ type: TOOL_TYPES[toolIdx], name: 'web_search', max_uses: maxUses, ...(domains ? { allowed_domains: domains } : {}) }],
      };
      try { response = await createMessage(client, request); break; } catch (err) {
        // A site the crawler cannot read fails the whole call: drop it and try again.
        const blocked = domains && err && err.status === 400 && /not accessible to our user agent: \[(.*?)\]/.exec(String(err.message || ''));
        if (blocked) {
          const bad = blocked[1].split(',').map((d) => d.replace(/['"\s]/g, '').toLowerCase());
          domains = domains.filter((d) => !bad.includes(d.toLowerCase()));
          if (!domains.length) return { sourceMap: new Map(), parsed: {} };
          continue;
        }
        if (toolIdx < TOOL_TYPES.length - 1 && isToolTypeComplaint(err)) { toolIdx += 1; continue; }
        throw err;
      }
    }
    usage.input += (response.usage && response.usage.input_tokens) || 0;
    usage.output += (response.usage && response.usage.output_tokens) || 0;
    usage.searches += (response.usage && response.usage.server_tool_use && response.usage.server_tool_use.web_search_requests) || 0;
    const content = Array.isArray(response.content) ? response.content : [];
    allBlocks.push(...content);
    if (response.stop_reason === 'refusal') { final = { refusal: true }; break; }
    if (response.stop_reason === 'pause_turn' && turn < MAX_CONTINUATIONS) {
      messages.push({ role: 'assistant', content });
      continue;
    }
    final = { content };
    break;
  }
  log(`[interviewPrep] claude web search${domains ? ' (targeted)' : ''} usage: input=${usage.input} output=${usage.output} searches=${usage.searches}`);

  const sourceMap = collectSources(allBlocks, now);
  if (!final || final.refusal) return { sourceMap: new Map(), parsed: {} };

  const text = (final.content || []).filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('');
  const parsed = parseModelJson(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error('The research answer could not be read'), { code: 'model_failed' });
  }

  // Source details the model read on the pages (search results often carry no date).
  // A date is used only when it parses, is not in the future and is inside the window;
  // a source older than the window is removed, so anything citing it is dropped below.
  const cutoff = now.getTime() - WINDOW_DAYS * 86400000;
  for (const m of Array.isArray(parsed.sources) ? parsed.sources : []) {
    const s = m && typeof m.url === 'string' ? sourceMap.get(normUrl(m.url)) : null;
    if (!s) continue;
    const when = typeof m.postedOn === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(m.postedOn.trim()) ? isoOrNull(m.postedOn.trim()) : null;
    if (when && !s.date && new Date(when).getTime() <= now.getTime()) {
      if (new Date(when).getTime() < cutoff) { sourceMap.delete(normUrl(m.url)); continue; }
      s.date = when;
    }
    if (!s.excerpt && typeof m.note === 'string') s.excerpt = excerptOf(m.note);
  }

  return { sourceMap, parsed };
}

/**
 * Two passes at once: a broad search, and one aimed at the sites candidates write on.
 * Their sources and findings are merged, then the honesty gate runs over the union.
 */
async function researchViaAnthropicWebSearch({ company, jobTitle, level, client = defaultClient(), model = MODEL, now = new Date(), log = console.log, targeted: runTargeted = true }) {
  const role = clean(jobTitle, 160);
  const base = { company, role, now };
  const common = { company, role, level, client, model, now, log };
  const [broad, targeted] = await Promise.allSettled([
    runPass(common),
    runTargeted ? runPass({ ...common, domains: TARGET_DOMAINS, maxUses: TARGETED_MAX_USES }) : Promise.reject(new Error('targeted pass off')),
  ]);
  if (broad.status === 'rejected' && targeted.status === 'rejected') throw broad.reason;
  if (runTargeted && targeted.status === 'rejected') log(`[interviewPrep] targeted pass failed: ${targeted.reason && targeted.reason.message}`);
  const passes = [broad, targeted].filter((r) => r.status === 'fulfilled').map((r) => r.value);

  const sourceMap = new Map();
  for (const ps of passes) for (const [k, v] of ps.sourceMap) {
    const cur = sourceMap.get(k);
    if (!cur) sourceMap.set(k, { ...v });
    else { if (!cur.date && v.date) cur.date = v.date; if (!cur.excerpt && v.excerpt) cur.excerpt = v.excerpt; if (!cur.title && v.title) cur.title = v.title; }
  }
  const cat = (key) => passes.flatMap((ps) => (Array.isArray(ps.parsed[key]) ? ps.parsed[key] : []));
  const parsed = {
    summary: (passes.find((ps) => typeof ps.parsed.summary === 'string' && ps.parsed.summary) || { parsed: {} }).parsed.summary || '',
    timeline: (passes.find((ps) => ps.parsed.timeline && ps.parsed.timeline.text) || { parsed: {} }).parsed.timeline || null,
    rounds: cat('rounds'), tips: cat('tips'), questions: cat('questions'), topics: cat('topics'),
  };
  if (!sourceMap.size && !parsed.questions.length) return assemblePayload({ ...base, sources: new Map(), questions: [] });

  // Honesty gate: every cited url must resolve to a known, in-window source.
  const resolve = (urls) => {
    const list = Array.isArray(urls) ? urls : [];
    if (!list.length) return null;
    const out = [];
    for (const u of list) {
      const s = sourceMap.get(normUrl(u));
      if (s) out.push(s.url); // an unknown url is dropped from the item, never trusted
    }
    return out.length ? [...new Set(out)] : null; // nothing resolvable: the item is dropped
  };
  const keep = (arr, needs) => (Array.isArray(arr) ? arr : []).flatMap((it) => {
    if (!it || typeof it !== 'object' || !it[needs]) return [];
    const urls = resolve(it.sourceUrls);
    return urls ? [{ ...it, urls }] : [];
  });

  const sources = new Map([...sourceMap.values()].map((s) => [s.url, s]));
  const kept = { rounds: keep(parsed.rounds, 'name'), questions: keep(parsed.questions, 'text') };
  log(`[interviewPrep] proposed vs cited-and-kept: rounds ${(parsed.rounds || []).length}/${kept.rounds.length}, questions ${(parsed.questions || []).length}/${kept.questions.length}; round names: ${(parsed.rounds || []).map((r) => r && r.name).join(' | ')}`);
  const questions = dedupeQuestions(keep(parsed.questions, 'text').map((q) => ({ text: q.text, category: q.category, urls: q.urls })));
  const rounds = keep(parsed.rounds, 'name');
  const tips = keep(parsed.tips, 'text');
  const topics = keep(parsed.topics, 'name');
  let timeline = null;
  if (parsed.timeline && parsed.timeline.text) { const urls = resolve(parsed.timeline.sourceUrls); if (urls) timeline = { text: parsed.timeline.text, urls }; }

  return assemblePayload({
    ...base, sources, questions, rounds, tips, topics, timeline, summary: typeof parsed.summary === 'string' ? parsed.summary : '',
  });
}

module.exports = { researchViaAnthropicWebSearch, collectSources, pageAgeToIso };
