/**
 * Coach tailor preview: one job link (or its text) in, a tailored resume and a
 * match score out, before the visitor has an account.
 *
 * Nothing here is a new prompt. The resume comes from the same engine as
 * /tailor-for-job (resumeParserService.tailorProfileForJob, with its
 * anti-fabrication rules intact) and the score from the same reading +
 * arithmetic as /job-match (jobMatchPrompt + jobMatchScore). This module is the
 * adapter: it takes the coach's unsaved draft instead of a stored Profile row,
 * resolves the posting, runs both, and maps the result onto the contract the
 * coach page calls.
 *
 * It persists nothing. No model is touched, so a guest leaves no trace beyond
 * the in-memory rate counter the route keeps.
 *
 * Dependencies are injectable so the tests never reach a model or the network.
 */

const dns = require('dns');
const net = require('net');

const MIN_JOB_DESCRIPTION_CHARS = 200;
const MAX_JOB_DESCRIPTION_CHARS = 20000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_LIST_ITEMS = 6;

const URL_UNREADABLE_MESSAGE = 'We could not read that page. Paste the job description instead.';

class CoachTailorError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ─── SSRF guard ─────────────────────────────────────────────────────────────

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const PRIVATE_V4_RANGES = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
].map(([base, bits]) => ({
  base: ipv4ToInt(base),
  mask: bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0,
}));

function isPrivateIp(ip) {
  const raw = String(ip || '').replace(/^\[|\]$/g, '').toLowerCase();
  const family = net.isIP(raw);
  if (family === 4) {
    const n = ipv4ToInt(raw);
    return PRIVATE_V4_RANGES.some(({ base, mask }) => ((n & mask) >>> 0) === ((base & mask) >>> 0));
  }
  if (family === 6) {
    if (raw === '::' || raw === '::1') return true;
    // IPv4-mapped / translated forms carry the real target in the tail.
    const mapped = raw.match(/^(?:::ffff:|::ffff:0:|64:ff9b::)?(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    const hexMapped = raw.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    const first = parseInt(raw.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // multicast
    return false;
  }
  return false;
}

const BLOCKED_HOSTNAME = /(^localhost$|\.localhost$|\.local$|\.internal$|\.lan$|\.home$|\.intranet$|\.corp$)/i;

/**
 * Syntactic check: http(s), no credentials, no private literal, no internal
 * name. Returns the parsed URL or throws a 400.
 */
function validateJobUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || '').trim());
  } catch {
    throw new CoachTailorError(400, 'invalid_job_url', 'That does not look like a job link. Paste the full address, starting with https://');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CoachTailorError(400, 'invalid_job_url', 'Only http and https job links are supported.');
  }
  if (url.username || url.password) {
    throw new CoachTailorError(400, 'invalid_job_url', 'That does not look like a job link.');
  }
  if (url.port && !['80', '443', '8080', '8443'].includes(url.port)) {
    throw new CoachTailorError(400, 'invalid_job_url', 'That does not look like a job link.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || BLOCKED_HOSTNAME.test(host) || isPrivateIp(host) || (!net.isIP(host) && !host.includes('.'))) {
    throw new CoachTailorError(400, 'invalid_job_url', 'That link points somewhere we cannot read. Paste the job description instead.');
  }
  return url;
}

async function defaultResolveHost(hostname) {
  const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

/**
 * The name has to resolve to public addresses only. A public name pointing at
 * 127.0.0.1 is the classic way past a hostname-only check.
 */
async function assertPublicHost(url, resolveHost) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return; // literal already checked by validateJobUrl
  let addresses;
  try {
    addresses = await resolveHost(host);
  } catch {
    throw new CoachTailorError(422, 'job_url_unreadable', URL_UNREADABLE_MESSAGE);
  }
  if (!addresses || addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new CoachTailorError(400, 'invalid_job_url', 'That link points somewhere we cannot read. Paste the job description instead.');
  }
}

// ─── Posting extraction ─────────────────────────────────────────────────────

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');
}

/** HTML to readable text, keeping line breaks where blocks end. */
function htmlToText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|ul|ol)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findJobPosting(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findJobPosting(item);
      if (hit) return hit;
    }
    return null;
  }
  const type = node['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return node;
  if (node['@graph']) return findJobPosting(node['@graph']);
  return null;
}

/**
 * Most ATS pages (Greenhouse, Lever, Ashby, Workday, company careers sites)
 * publish a schema.org JobPosting for Google for Jobs. That is the cleanest
 * source; the visible page text is the fallback.
 */
function extractPostingFromHtml(html) {
  const ldBlocks = String(html || '').match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of ldBlocks) {
    const body = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      continue; // structured data authored by the page, not model output
    }
    const posting = findJobPosting(parsed);
    if (posting) {
      const org = posting.hiringOrganization;
      const parts = [
        posting.description,
        posting.qualifications,
        posting.responsibilities,
        posting.skills,
        posting.experienceRequirements,
        posting.educationRequirements,
      ]
        .map((p) => (typeof p === 'string' ? htmlToText(p) : ''))
        .filter(Boolean);
      const text = parts.join('\n\n');
      if (text.length >= MIN_JOB_DESCRIPTION_CHARS) {
        return {
          jobDescription: text,
          jobTitle: typeof posting.title === 'string' ? decodeEntities(posting.title).trim() : '',
          company: typeof org === 'string' ? org : (org && typeof org.name === 'string' ? decodeEntities(org.name).trim() : ''),
        };
      }
    }
  }

  const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || [])[1];
  const titleTag = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const bodyHtml = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || html;
  const text = htmlToText(bodyHtml.replace(/<(nav|header|footer|form)[^>]*>[\s\S]*?<\/\1>/gi, ' '));
  return {
    jobDescription: text,
    jobTitle: decodeEntities(ogTitle || titleTag || '').trim().slice(0, 200),
    company: '',
  };
}

async function readCapped(response) {
  const reader = response.body && response.body.getReader ? response.body.getReader() : null;
  if (!reader) return (await response.text()).slice(0, MAX_PAGE_BYTES);
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    chunks.push(value);
    if (total >= MAX_PAGE_BYTES) {
      try { await reader.cancel(); } catch { /* ignore */ }
      break;
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

/**
 * Fetch a posting page with the SSRF guard applied to every hop: redirects are
 * followed by hand so a public URL cannot bounce us onto an internal one.
 */
async function defaultFetchJobPosting(rawUrl, { fetchImpl = globalThis.fetch, resolveHost = defaultResolveHost } = {}) {
  let url = validateJobUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url, resolveHost);
    let response;
    try {
      response = await fetchImpl(url.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ProfilleAI/1.0; +https://www.profilleai.com)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch {
      throw new CoachTailorError(422, 'job_url_unreadable', URL_UNREADABLE_MESSAGE);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) break;
      try {
        url = validateJobUrl(new URL(location, url).toString());
      } catch {
        throw new CoachTailorError(422, 'job_url_unreadable', URL_UNREADABLE_MESSAGE);
      }
      continue;
    }
    if (!response.ok) break;
    const type = response.headers.get('content-type') || '';
    if (type && !/html|xml|text\/plain/i.test(type)) break;
    const html = await readCapped(response);
    return extractPostingFromHtml(html);
  }
  throw new CoachTailorError(422, 'job_url_unreadable', URL_UNREADABLE_MESSAGE);
}

// ─── Profile adapter ────────────────────────────────────────────────────────

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

/**
 * The coach draft, narrowed and size-capped. This is a public endpoint taking
 * a client-built object, so every field is bounded before it reaches a prompt.
 */
function adaptGuestProfile(profile) {
  const p = profile && typeof profile === 'object' ? profile : {};
  return {
    title: str(p.title, 200),
    location: str(p.location, 200),
    summary: str(p.summary, 3000),
    skills: list(p.skills, 80).map((s) => (typeof s === 'string' ? s : s?.name)).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 80)),
    experience: list(p.experience, 15).filter((e) => e && typeof e === 'object').map((e) => ({
      title: str(e.title, 200),
      company: str(e.company, 200),
      location: str(e.location, 200),
      startDate: str(e.startDate, 40),
      endDate: str(e.endDate, 40),
      current: Boolean(e.current),
      description: str(e.description, 6000),
    })),
    education: list(p.education, 8).filter((e) => e && typeof e === 'object').map((e) => ({
      institution: str(e.institution || e.school, 200),
      degree: str(e.degree, 200),
      fieldOfStudy: str(e.fieldOfStudy || e.field, 200),
      startDate: str(e.startDate, 40),
      endDate: str(e.endDate || e.year, 40),
    })),
    projects: list(p.projects, 8).filter((x) => x && typeof x === 'object').map((x) => ({
      title: str(x.title || x.name, 200),
      description: str(x.description, 1500),
      technologies: list(x.technologies, 20).filter((t) => typeof t === 'string').map((t) => t.slice(0, 60)),
      url: str(x.url, 500),
    })),
    certifications: list(p.certifications, 10).map((c) => (typeof c === 'string' ? c.slice(0, 200) : c && typeof c === 'object' ? { name: str(c.name, 200), issuer: str(c.issuer, 200) } : null)).filter(Boolean),
    linkedinUrl: str(p.linkedinUrl, 500),
    githubUrl: str(p.githubUrl, 500),
  };
}

/** jobMatchPrompt reads school/field/year; the profile shape says institution/fieldOfStudy/endDate. */
function forMatchPrompt(profile) {
  return {
    ...profile,
    education: profile.education.map((e) => ({
      ...e,
      school: e.institution,
      field: e.fieldOfStudy,
      year: (String(e.endDate || '').match(/\d{4}/) || [''])[0],
    })),
  };
}

// ─── Match mapping ──────────────────────────────────────────────────────────

function extractJsonCandidate(raw) {
  const text = String(raw || '');
  const start = text.indexOf('{');
  if (start < 0) return null;
  const end = text.lastIndexOf('}');
  // Keep the tail when there is no closing brace: that is the truncated case
  // repairTruncatedJSON exists for.
  return end > start ? text.slice(start, end + 1) : text.slice(start);
}

const EMPTY_MATCH = Object.freeze({ score: null, summary: '', strengths: [], gaps: [] });

/** scoreJobMatch output + the model's read, onto { score, summary, strengths, gaps }. */
function mapMatch(read, scored) {
  const reqs = Array.isArray(scored.requirements) ? scored.requirements : [];
  const counted = reqs.filter((r) => r && r.requirement && r.type !== 'responsibility');
  const mustFirst = (a, b) => (a.hardness === 'must' ? 0 : 1) - (b.hardness === 'must' ? 0 : 1);

  const strengths = counted
    .filter((r) => r.coverage === 'strong')
    .sort(mustFirst)
    .map((r) => String(r.requirement));

  const blockerNames = (scored.blockers || []).map((b) => String(b.requirement));
  const missing = counted
    .filter((r) => r.coverage === 'none' || r.coverage === 'partial')
    .sort((a, b) => mustFirst(a, b) || (a.coverage === 'none' ? 0 : 1) - (b.coverage === 'none' ? 0 : 1))
    .map((r) => String(r.requirement));
  const gaps = [...new Set([...blockerNames, ...missing])];

  return {
    score: scored.score,
    summary: typeof read.verdict === 'string' ? read.verdict.trim() : '',
    strengths: strengths.slice(0, MAX_LIST_ITEMS),
    gaps: gaps.slice(0, MAX_LIST_ITEMS),
  };
}

// ─── Service ────────────────────────────────────────────────────────────────

function isOverloaded(err) {
  return err && (err.status === 529 || err.status === 503 || err.error?.type === 'overloaded_error');
}

function createCoachTailorService(deps = {}) {
  const lazy = {
    get resumeParserService() { return require('./resumeParserService'); },
    get aiService() { return require('./aiService'); },
  };
  const tailorProfileForJob = deps.tailorProfileForJob
    || ((...args) => lazy.resumeParserService.tailorProfileForJob(...args));
  const generateText = deps.generateText || ((prompt, opts) => lazy.aiService.generateText(prompt, opts));
  const repairTruncatedJSON = deps.repairTruncatedJSON || ((t) => lazy.resumeParserService.repairTruncatedJSON(t));
  const fetchJobPosting = deps.fetchJobPosting || ((url) => defaultFetchJobPosting(url));
  const { buildJobMatchPrompt, JOB_MATCH_SYSTEM } = deps.jobMatchPrompt || require('./resume/jobMatchPrompt');
  const { scoreJobMatch } = deps.jobMatchScore || require('./resume/jobMatchScore');
  const { toAIProfile, hasProfileContent } = require('./resume/candidateProfile');
  const { companyFromJobUrl } = require('./resume/companyFromUrl');

  /** Validates input and resolves the posting text. No AI spent yet. */
  async function resolveInput({ profile, jobUrl, jobDescription } = {}) {
    const adapted = adaptGuestProfile(profile);
    if (!hasProfileContent(adapted)) {
      throw new CoachTailorError(400, 'profile_required', 'Build your profile first, then try a job.');
    }

    const pasted = typeof jobDescription === 'string' ? jobDescription.trim() : '';
    const link = typeof jobUrl === 'string' ? jobUrl.trim() : '';

    if (pasted.length >= MIN_JOB_DESCRIPTION_CHARS) {
      return {
        profile: adapted,
        job: { jobDescription: pasted.slice(0, MAX_JOB_DESCRIPTION_CHARS), jobTitle: '', company: link ? companyFromJobUrl(link) : '' },
      };
    }
    if (!link) {
      if (pasted) {
        throw new CoachTailorError(400, 'job_description_too_short', `Paste the full job description (at least ${MIN_JOB_DESCRIPTION_CHARS} characters).`);
      }
      throw new CoachTailorError(400, 'job_required', 'Paste a job link or the job description.');
    }

    validateJobUrl(link); // cheap syntactic + literal-IP check before any network
    let posting;
    try {
      posting = await fetchJobPosting(link);
    } catch (err) {
      if (err instanceof CoachTailorError) throw err;
      throw new CoachTailorError(422, 'job_url_unreadable', URL_UNREADABLE_MESSAGE);
    }
    const text = String(posting?.jobDescription || '').trim();
    if (text.length < MIN_JOB_DESCRIPTION_CHARS) {
      throw new CoachTailorError(422, 'job_url_unreadable', URL_UNREADABLE_MESSAGE);
    }
    return {
      profile: adapted,
      job: {
        jobDescription: text.slice(0, MAX_JOB_DESCRIPTION_CHARS),
        jobTitle: str(posting.jobTitle, 200),
        company: str(posting.company, 200) || companyFromJobUrl(link),
      },
    };
  }

  /** The /job-match reading + arithmetic, on the draft. Never fails the preview. */
  async function scoreMatch(profile, job) {
    try {
      const { prompt } = buildJobMatchPrompt({
        jobTitle: job.jobTitle,
        jobDescription: job.jobDescription,
        profile: forMatchPrompt(profile),
      });
      // temperature is dropped by ai/core for models that reject it.
      const raw = await generateText(`${JOB_MATCH_SYSTEM}\n\n${prompt}`, { maxTokens: 4000, temperature: 0.2 });
      const read = repairTruncatedJSON(extractJsonCandidate(raw));
      if (!read || !Array.isArray(read.requirements) || read.requirements.length === 0) {
        return { match: { ...EMPTY_MATCH }, jobTitle: '' };
      }
      const scored = scoreJobMatch(read, profile);
      if (!scored.components || scored.components.scoredCount === 0) {
        return { match: { ...EMPTY_MATCH, summary: typeof read.verdict === 'string' ? read.verdict : '' }, jobTitle: str(read.jobTitle, 200) };
      }
      return { match: mapMatch(read, scored), jobTitle: str(read.jobTitle, 200) };
    } catch (err) {
      if (isOverloaded(err)) throw err;
      console.warn('[coach-tailor] match scoring failed:', err.message);
      return { match: { ...EMPTY_MATCH }, jobTitle: '' };
    }
  }

  /**
   * @param {{ profile: Object, job: { jobDescription, jobTitle, company } }} resolved
   *   output of resolveInput
   */
  async function runPreview({ profile, job }) {
    // Both in parallel: tailoring alone is budgeted at 85s against Cloudflare's
    // 100s cutoff, so the score cannot be run after it.
    const [tailorResult, matchResult] = await Promise.all([
      tailorProfileForJob(
        toAIProfile(profile),
        job.jobDescription,
        null, // no uploaded resume: the draft is the fabrication baseline
        null,
        null,
        { jobTitle: job.jobTitle || undefined, company: job.company || undefined },
      ),
      scoreMatch(profile, job),
    ]);

    if (!tailorResult || !tailorResult.success || !tailorResult.data) {
      throw new CoachTailorError(502, 'tailor_failed', 'We could not tailor your resume to this job. Please try again.');
    }

    return {
      success: true,
      tailored: tailorResult.data,
      match: matchResult.match,
      jobTitle: job.jobTitle || matchResult.jobTitle || '',
      company: job.company || '',
    };
  }

  async function tailorPreview(input) {
    return runPreview(await resolveInput(input));
  }

  return { resolveInput, runPreview, tailorPreview };
}

module.exports = {
  createCoachTailorService,
  CoachTailorError,
  validateJobUrl,
  isPrivateIp,
  assertPublicHost,
  extractPostingFromHtml,
  defaultFetchJobPosting,
  adaptGuestProfile,
  mapMatch,
  isOverloaded,
  MIN_JOB_DESCRIPTION_CHARS,
  URL_UNREADABLE_MESSAGE,
};
