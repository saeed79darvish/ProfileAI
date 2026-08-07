/**
 * Hacker News "Who's Hiring" comment parser
 *
 * Each top-level comment in the monthly "Ask HN: Who is hiring?" thread is
 * one job posting. The HN community has a strong convention for these:
 *
 *   COMPANY | ROLE(s) | LOCATION (REMOTE/HYBRID/ONSITE) | URL
 *
 * Reality is messier — many comments use em-dash, hyphen, or just newlines
 * between fields, and ~30% deviate enough that pure regex misses them.
 *
 * Strategy: try a fast deterministic regex pass first (free), then fall back
 * to a Claude Haiku call for any comment where the title or company couldn't
 * be extracted. Per-comment Haiku cost is ~$0.0001 → ~$0.08-0.15/month for
 * the entire thread (~800 comments).
 *
 * Public surface:
 *   - parseComment(text)       — sync, regex-only, returns null on failure
 *   - parseCommentLLM(text)    — async, Haiku, throws on hard failure
 *   - parseCommentHybrid(text) — async, regex first then LLM fallback
 */

const { callAI, safeParseJSON } = require('./ai/core');

// Use Haiku for the parser — small, cheap, fast.
// Override via ANTHROPIC_HAIKU_MODEL env var.
const HAIKU_MODEL = process.env.ANTHROPIC_HAIKU_MODEL || 'claude-haiku-4-5-20251001';

// ─── HTML helpers (HN comments come as HTML fragments) ───────────────────

function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function htmlToText(html) {
  if (!html) return '';
  // Convert <p> and <br> to newlines so paragraph structure survives stripping.
  //
  // Hacker News emits <p> as a paragraph SEPARATOR and does not close it, so
  // the old rule — newline for </p>, empty string for <p> — never fired and
  // instead welded paragraphs together: "Senior QA Engineer" + "Our mission is
  // to empower..." became one line. Since parseComment treats the first line as
  // the header, that produced job titles containing whole paragraphs of body
  // copy. Both forms must break.
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*p\s*>/gi, '\n\n');
  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ').trim());
}

function extractFirstUrl(text) {
  if (!text) return null;
  // HN comments often have URLs as raw http(s) — match a long-ish first one.
  const m = text.match(/https?:\/\/[^\s)<>"]+/);
  return m ? m[0].replace(/[.,)]+$/, '') : null;
}

// ─── Heuristics ───────────────────────────────────────────────────────────

const REMOTE_RX = /\b(remote|wfh|work\s*from\s*home|distributed|anywhere)\b/i;
const HYBRID_RX = /\bhybrid\b/i;
const ONSITE_RX = /\b(on[\s-]?site|in[\s-]?office)\b/i;
const VISA_RX   = /\b(visa|sponsorship)\b/i;

function inferLocationType(text) {
  if (!text) return null;
  if (HYBRID_RX.test(text)) return 'hybrid';
  if (REMOTE_RX.test(text)) return 'remote';
  if (ONSITE_RX.test(text)) return 'onsite';
  return null;
}

// Light heuristic for employment type — most HN posts are full-time but
// a meaningful minority advertise contract or intern roles in the title.
function inferEmploymentType(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\bintern(ship)?\b/.test(t)) return 'internship';
  if (/\b(contract|contractor|freelance|consulting)\b/.test(t)) return 'contract';
  if (/\bpart[\s-]?time\b/.test(t)) return 'part-time';
  return 'full-time';
}

function inferExperienceLevel(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b(staff|principal|lead|director|head\s+of|vp|chief|cto|ceo)\b/.test(t)) return 'lead';
  if (/\b(senior|sr\.?|experienced)\b/.test(t)) return 'senior';
  if (/\b(junior|jr\.?|entry|graduate|new\s+grad)\b/.test(t)) return 'entry';
  if (/\b(mid|mid[\s-]?level)\b/.test(t)) return 'mid';
  return null;
}

// ─── Regex parser (fast path) ─────────────────────────────────────────────

/**
 * Parse the first non-empty line of a comment as a pipe-delimited header.
 * Returns null if the heuristic doesn't fit (caller should fall back to LLM).
 *
 * Examples this parser handles:
 *   "Acme Inc | Senior Backend Engineer | Berlin (REMOTE) | https://acme.com/jobs"
 *   "Acme - Frontend Engineer - Remote (US/EU) - apply@acme.com"
 *   "Acme | Multiple Roles | SF, Berlin, Remote"
 */
function parseComment(html) {
  const text = htmlToText(html);
  if (!text || text.length < 20) return null;

  const firstLine = text.split('\n').find(l => l.trim().length > 0)?.trim() || '';

  // Try pipe split first; fall back to em-dash, then hyphen surrounded by spaces.
  let parts = null;
  if (firstLine.includes('|')) {
    parts = firstLine.split('|').map(s => s.trim()).filter(Boolean);
  } else if (/[—–]/.test(firstLine)) {
    parts = firstLine.split(/[—–]/).map(s => s.trim()).filter(Boolean);
  } else if (/\s-\s/.test(firstLine)) {
    parts = firstLine.split(/\s-\s/).map(s => s.trim()).filter(Boolean);
  }

  if (!parts || parts.length < 2) return null;

  // First field is almost always the company. Second is usually the role.
  // Third / fourth typically location and a URL — but order varies.
  const company = stripParens(parts[0]);
  const title = stripParens(parts[1]);

  // Anything that looks like a URL across the whole comment (not just header).
  const applyUrl = extractFirstUrl(text);

  // Location: any header part that looks like a place / has remote keyword.
  let location = null;
  for (let i = 2; i < parts.length; i++) {
    const p = parts[i];
    if (/^https?:/i.test(p)) continue;
    if (/[A-Za-z]{2,}/.test(p) && p.length < 80) {
      location = stripParens(p);
      break;
    }
  }

  if (!company || !title) return null;

  return {
    company,
    title,
    location,
    locationType: inferLocationType(firstLine + ' ' + (location || '')),
    employmentType: inferEmploymentType(firstLine),
    experienceLevel: inferExperienceLevel(firstLine + ' ' + title),
    applyUrl,
    visaSponsorship: VISA_RX.test(text) || null,
    description: text,
    method: 'regex',
  };
}

function stripParens(s) {
  if (!s) return s;
  return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// ─── LLM parser (fallback path) ───────────────────────────────────────────

const LLM_SYSTEM_PROMPT = `You extract structured job data from Hacker News "Who's Hiring" comments.
Return ONLY a single JSON object on one line with these keys:
  company       — string, the hiring company's name (required)
  title         — string, primary role title (required, the main one if multiple)
  location      — string or null, e.g. "San Francisco, CA" or "Berlin" or "Remote"
  locationType  — one of "remote" | "hybrid" | "onsite" | null
  employmentType— one of "full-time" | "part-time" | "contract" | "internship" | null
  experienceLevel— one of "entry" | "mid" | "senior" | "lead" | "executive" | null
  applyUrl      — string URL to apply (or company careers page) or null
  visaSponsorship— true if the post mentions visa/sponsorship, else null

If the comment is not a job posting (e.g. a meta comment), return {"company":null,"title":null}.
Do not include any commentary, markdown, or code fences — just raw JSON.`;

async function parseCommentLLM(html) {
  const text = htmlToText(html);
  if (!text || text.length < 20) return null;

  // Truncate very long comments so we don't burn tokens on novel-length posts.
  const trimmed = text.length > 3000 ? text.slice(0, 3000) + '…' : text;

  const response = await callAI({
    model: HAIKU_MODEL,
    max_tokens: 400,
    temperature: 0,
    messages: [
      { role: 'system', content: LLM_SYSTEM_PROMPT },
      { role: 'user', content: trimmed }
    ]
  });

  const raw = response.choices?.[0]?.message?.content?.trim() || '';
  const parsed = safeParseJSON(raw, null) || extractJsonObject(raw);
  if (!parsed || !parsed.company || !parsed.title) return null;

  return {
    company: parsed.company,
    title: parsed.title,
    location: parsed.location || null,
    locationType: parsed.locationType || inferLocationType(text),
    employmentType: parsed.employmentType || inferEmploymentType(text),
    experienceLevel: parsed.experienceLevel || null,
    applyUrl: parsed.applyUrl || extractFirstUrl(text),
    visaSponsorship: parsed.visaSponsorship ?? (VISA_RX.test(text) || null),
    description: text,
    method: 'llm',
  };
}

// Recover from LLMs that wrap the JSON in code fences or commentary.
function extractJsonObject(s) {
  if (!s) return null;
  const match = s.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// ─── Hybrid public entry point ────────────────────────────────────────────

/**
 * Parse a comment, preferring the fast deterministic path. Falls back to
 * the LLM when the regex output is missing required fields.
 *
 * Set ENABLE_HN_LLM_FALLBACK=false in the env to disable the LLM path
 * entirely (e.g. local dev without an Anthropic key).
 */

// ─── Quality gate ─────────────────────────────────────────────────────────
//
// The regex header parser assumes "Company | Role | Location | URL", but real
// posts vary enormously — "Company | Remote | Role", "Company | Location", a
// role in the company slot, a whole sentence as the company. Accepting any
// parse that merely produced two non-empty fields put visible junk in the feed:
// job titles that were actually locations ("Onsite (San Francisco) + Remote"),
// companies that were sentences ("Beacon AI builds intelligent systems tha"),
// and titles containing an email address.
//
// So a regex parse must now look like a real posting to be accepted. When it
// doesn't, we fall through to the LLM parser that already exists for
// unparseable comments — it handles the awkward layouts, and it is only reached
// for the minority of posts the fast path can't do well.
const EMAIL_RX = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
// A "title" that is really a location/work-arrangement fragment.
const LOCATIONISH_TITLE_RX = /^(remote|onsite|on-site|hybrid|wfh|anywhere|location\b|[A-Z]{2},?\s|.*\b(only|based)\b\s*$)/i;
// A "company" that is really prose rather than a name.
const SENTENCE_RX = /\b(is|are|we|our|builds?|makes?|helps?|provides?|looking|hiring)\b/i;
// A "title" that is really the employment type, or the compensation, because
// the poster's second header field was one of those instead of the role.
const EMPLOYMENT_TITLE_RX = /^(full[\s-]?time|part[\s-]?time|contract(or)?|intern(ship)?|freelance|permanent|temp(orary)?)\b/i;
const COMPENSATION_TITLE_RX = /^[$€£]|\d{2,3}\s*[-–]?\s*\d{0,3}\s*k\b|\bequity\b|\bsalary\b/i;

function isPlausiblePosting(p) {
  if (!p) return false;
  const title = (p.title || '').trim();
  const company = (p.company || '').trim();
  if (title.length < 3 || title.length > 80) return false;
  if (company.length < 2 || company.length > 60) return false;
  if (EMAIL_RX.test(title) || EMAIL_RX.test(company)) return false;
  if (/^https?:/i.test(title) || /^https?:/i.test(company)) return false;
  if (LOCATIONISH_TITLE_RX.test(title)) return false;
  if (EMPLOYMENT_TITLE_RX.test(title)) return false;
  if (COMPENSATION_TITLE_RX.test(title)) return false;
  // A company name never contains a URL — that means the header field ran into
  // the apply link ("Snout https://snout.com/").
  if (/https?:\/\/|www\./i.test(company)) return false;
  // A company name is a name, not a clause. Allow a few words (e.g. "Open
  // Education Applications") but reject anything reading as a sentence.
  if (company.split(/\s+/).length > 6) return false;
  if (SENTENCE_RX.test(company) && company.split(/\s+/).length > 3) return false;
  // Titles listing several roles at once ("A, B, C and D") are a digest, not a
  // posting; the LLM splits these far better than the header regex.
  if ((title.match(/,/g) || []).length >= 3) return false;
  return true;
}

// The LLM fallback is now reached far more often, because the quality gate
// correctly rejects sloppy regex parses. But the HN board re-parses the entire
// thread on EVERY sync sweep, and a "Who is hiring" comment never changes once
// posted — so without memoisation the same ~70 comments would be re-sent to the
// model every 15 minutes, forever, for an identical answer.
//
// Keyed on the comment HTML itself, so an edited comment re-parses naturally
// and no id plumbing is required. Bounded and in-process: losing it on restart
// only costs one sweep's worth of re-parsing.
const _llmParseCache = new Map();
const LLM_CACHE_MAX = 3000;

function _cacheKey(html) {
  // Cheap non-cryptographic hash — we only need identity, not security.
  let h = 0;
  for (let i = 0; i < html.length; i++) h = ((h << 5) - h + html.charCodeAt(i)) | 0;
  return `${html.length}:${h}`;
}

async function parseCommentHybrid(html) {
  const fast = parseComment(html);
  // Only trust the fast path when its output actually looks like a posting.
  if (isPlausiblePosting(fast)) return fast;

  if (process.env.ENABLE_HN_LLM_FALLBACK === 'false') return null;
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const key = _cacheKey(html);
  if (_llmParseCache.has(key)) return _llmParseCache.get(key);

  try {
    const parsed = await parseCommentLLM(html);
    if (_llmParseCache.size >= LLM_CACHE_MAX) {
      const oldest = _llmParseCache.keys().next().value;
      if (oldest !== undefined) _llmParseCache.delete(oldest);
    }
    // Cache negatives too — a comment the model could not parse will not become
    // parseable on the next sweep, and retrying it every 15 minutes is the same
    // waste in a different costume.
    _llmParseCache.set(key, parsed);
    return parsed;
  } catch (err) {
    // Don't let a single bad comment kill the whole sync.
    console.warn('[HNHiring] LLM parse failed:', err.message);
    return null;
  }
}

module.exports = {
  parseComment,
  isPlausiblePosting,
  parseCommentLLM,
  parseCommentHybrid,
  htmlToText, // exported so the fetcher can use it for description fields
};
