/**
 * Interview research through Claude's server-side web search tool.
 *
 * Search and reading happen inside one Claude call, so there is no raw page
 * text: sources come from the search results and the citations in the answer.
 *
 * HONESTY GATE: the model's JSON is only a proposal. Any question, round, tip
 * or topic that cites a URL which is not in the search results or citations
 * (or is older than 12 months) is dropped; frequency is recomputed from the
 * distinct cited URLs.
 */

const {
  assemblePayload, dedupeQuestions, parseModelJson, excerptOf, normUrl, isoOrNull, clean, WINDOW_DAYS,
} = require('../interviewPrepService');
const { hostOf } = require('./searchProvider');

const MODEL = process.env.INTERVIEW_PREP_MODEL || 'claude-sonnet-5-5';
const MAX_TOKENS = 8000;
const MAX_USES = 8;
const MAX_CONTINUATIONS = 3;
const TOOL_TYPES = ['web_search_20260209', 'web_search_20250305'];

const SYSTEM = `You research what job candidates recently reported about interviewing for a specific role at a specific company, using web search. Strict rules:
- Look only at content from the last 12 months. Search broadly: Reddit, LeetCode Discuss, Blind, Glassdoor, Levels.fyi, interviewing.io and the company's own interview or careers pages, wherever they appear.
- Every question and every process fact MUST be supported by a web result you found. Never invent. Ignore unrelated companies and roles.
- Paraphrase. Never copy more than 25 consecutive words from a source.
- If the evidence is thin, say so in the summary and return fewer items. Empty lists are fine.
- Cite by the full URL of the web result in "sourceUrls".
- category is one of: coding, system_design, behavioral, role_specific, other. Merge duplicate questions into one item with all its sources.
Finish with ONLY this JSON (no other prose after it):
{"summary":"3 to 5 sentences, only from sources","timeline":{"text":"","sourceUrls":[]}|null,"rounds":[{"name":"","format":"","notes":"","sourceUrls":[]}],"tips":[{"text":"","sourceUrls":[]}],"questions":[{"text":"","category":"","sourceUrls":[]}],"topics":[{"name":"","why":"","sourceUrls":[]}]}`;

let sharedClient = null;
function defaultClient() {
  if (!sharedClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    sharedClient = new (Anthropic.default || Anthropic)({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 180000 });
  }
  return sharedClient;
}

const isToolTypeComplaint = (err) => err && err.status === 400 && /web_search|tool/i.test(String(err.message || ''));

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
        for (const r of b.content) if (r && r.type === 'web_search_result') add(r.url, r.title, isoOrNull(r.page_age), '');
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
async function researchViaAnthropicWebSearch({ company, jobTitle, level, client = defaultClient(), model = MODEL, now = new Date(), log = console.log }) {
  const { createMessage } = require('../ai/core');
  const role = clean(jobTitle, 160);
  const userPrompt = `Company: ${company}\nRole: ${role}${level ? `\nLevel: ${level}` : ''}\n\nResearch the last 12 months of what candidates report about interviewing for this role at this company, then answer with the JSON.`;
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
        tools: [{ type: TOOL_TYPES[toolIdx], name: 'web_search', max_uses: MAX_USES }],
      };
      try { response = await createMessage(client, request); break; } catch (err) {
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
  log(`[interviewPrep] claude web search usage: input=${usage.input} output=${usage.output} searches=${usage.searches}`);

  const sourceMap = collectSources(allBlocks, now);
  const base = { company, role, now };
  if (!final || final.refusal) return assemblePayload({ ...base, sources: new Map(), questions: [] });

  const text = (final.content || []).filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('');
  const parsed = parseModelJson(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error('The research answer could not be read'), { code: 'model_failed' });
  }

  // Honesty gate: every cited url must resolve to a known, in-window source.
  const resolve = (urls) => {
    const list = Array.isArray(urls) ? urls : [];
    if (!list.length) return null;
    const out = [];
    for (const u of list) {
      const s = sourceMap.get(normUrl(u));
      if (!s) return null; // one unresolvable citation drops the whole item
      out.push(s.url);
    }
    return [...new Set(out)];
  };
  const keep = (arr, needs) => (Array.isArray(arr) ? arr : []).flatMap((it) => {
    if (!it || typeof it !== 'object' || !it[needs]) return [];
    const urls = resolve(it.sourceUrls);
    return urls ? [{ ...it, urls }] : [];
  });

  const sources = new Map([...sourceMap.values()].map((s) => [s.url, s]));
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

module.exports = { researchViaAnthropicWebSearch, collectSources };
