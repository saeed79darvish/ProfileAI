/**
 * A job posting's description, split into the same predictable shape for
 * every source, so the phone detail page can show pay and schedule up front,
 * real section titles, and the boilerplate folded away.
 *
 *   facts     salary, work mode, schedule, experience, location, equity
 *   summary   1-2 sentences about the role
 *   sections  responsibilities | requirements | niceToHave | team | benefits | other
 *   company   "About <company>" boilerplate
 *   legal     pay disclaimer, EEO, accommodations, privacy, with their links
 *
 * Built in code from the posting's HTML (no AI): sanitized down to a few
 * block tags, split into blocks, headings found and mapped to a kind by a
 * keyword table. Built once, the first time someone opens the job, and cached
 * on the row (descriptionStructured) keyed by a hash of its source, so a
 * resync that changes the text rebuilds it and one that doesn't is free.
 *
 * Postings with no usable headings (one run-on blob) come back with fewer
 * than two role sections; `needsAiSplit` says so, and
 * jobDescriptionStructureService.js asks Haiku where each section starts.
 * The model never rewrites anything: it returns verbatim anchors and the
 * cutting happens here (applyAiSplit).
 */

const crypto = require('crypto');

const STRUCTURE_VERSION = 1;

// ── HTML to blocks ─────────────────────────────────────────────────────────

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', middot: '·',
  trade: '™', reg: '®', copy: '©', eacute: 'é', euro: '€', pound: '£',
};

function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : ''; } catch (_) { return ''; }
    }
    const v = NAMED[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

const BLOCK_TAGS = new Set(['p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article',
  'header', 'footer', 'table', 'tr', 'td', 'th', 'blockquote', 'dl', 'dt', 'dd', 'hr']);
const BOLD_TAGS = new Set(['strong', 'b']);
const BULLET_RE = /^\s*(?:[•●▪◦·*‣⁃–—-]|\d{1,2}[.)])\s+/;

// UTF-8 read as Latin-1 upstream ("Youâ\u0080\u0099ll"); undo it when seen.
const unmojibake = (s) => (/[âÃ][\u0080-\u00bf]/.test(s) ? (() => {
  try { const fixed = Buffer.from(s, 'latin1').toString('utf8'); return fixed.includes('\ufffd') ? s : fixed; } catch (_) { return s; }
})() : s);

const tidy = (s) => unmojibake(String(s || ''))
  .replace(/[   ]/g, ' ')
  .replace(/[​-‍﻿]/g, '')
  .replace(/\s+/g, ' ')
  // "word– word" and "word –word" → "word – word"
  .replace(/(\S)([–—])\s/g, '$1 $2 ')
  .replace(/\s([–—])(\S)/g, ' $1 $2')
  .trim();

/**
 * Blocks in reading order: { type: 'heading'|'p'|'li', text, bold, lead?, links }.
 * `bold` means the whole block is bold; `lead` is a bold lead-in ending in a
 * colon ("<strong>Responsibilities:</strong> You will...").
 */
function toBlocks(source) {
  let html = String(source || '');
  // Greenhouse ships entity-encoded markup (&lt;p&gt;); decode once first.
  if (!/<[a-z][^>]*>/i.test(html) && /&lt;\/?[a-z]/i.test(html)) html = decodeEntities(html);
  html = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|iframe|svg|template)\b[\s\S]*?<\/\1\s*>/gi, ' ');

  const plain = !/<[a-z][^>]*>/i.test(html);
  if (plain) html = html.replace(/\r?\n/g, '<br>');

  const blocks = [];
  let text = '';
  let boldChars = 0;
  let boldDepth = 0;
  let listDepth = 0;
  let liDepth = 0;
  let heading = false;
  let leadOpen = null; // text offset where the first bold run started
  let lead = null;
  let links = [];
  let href = null;
  let anchorText = '';

  const flush = () => {
    const raw = text;
    const t = tidy(decodeEntities(raw));
    if (t) {
      const visible = raw.replace(/\s+/g, '').length || 1;
      blocks.push({
        type: heading ? 'heading' : liDepth > 0 ? 'li' : 'p',
        text: t,
        bold: boldChars / visible > 0.85,
        ...(lead ? { lead: tidy(decodeEntities(lead)) } : {}),
        links,
      });
    }
    text = ''; boldChars = 0; lead = null; leadOpen = null; links = [];
  };

  const re = /<(\/?)([a-z][a-z0-9]*)\b([^>]*)>|([^<]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) {
      text += m[4];
      if (boldDepth > 0) boldChars += m[4].replace(/\s+/g, '').length;
      if (href) anchorText += m[4];
      continue;
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (tag === 'br') { flush(); continue; }
    if (BOLD_TAGS.has(tag)) {
      if (!closing) {
        boldDepth += 1;
        if (leadOpen === null && !text.trim()) leadOpen = text.length;
      } else {
        boldDepth = Math.max(0, boldDepth - 1);
        if (boldDepth === 0 && leadOpen !== null && lead === null) {
          const run = text.slice(leadOpen).trim();
          lead = run || null;
          if (!run) leadOpen = null;
        }
      }
      continue;
    }
    if (tag === 'a') {
      if (!closing) {
        const h = /href\s*=\s*["']([^"']+)["']/i.exec(m[3] || '');
        href = h ? decodeEntities(h[1]).trim() : null;
        anchorText = '';
      } else if (href) {
        if (/^(https?:|mailto:)/i.test(href)) links.push({ label: tidy(decodeEntities(anchorText)) || href, href });
        href = null;
      }
      continue;
    }
    if (!BLOCK_TAGS.has(tag)) continue;
    flush();
    if (/^h[1-6]$/.test(tag)) heading = !closing;
    if (tag === 'ul' || tag === 'ol') listDepth = Math.max(0, listDepth + (closing ? -1 : 1));
    if (tag === 'li') liDepth = Math.max(0, liDepth + (closing ? -1 : 1));
  }
  flush();

  // Text bullets ("• item", "- item") written as lines in a paragraph, and
  // markdown some aggregators pass through (**bold**, # heading).
  return blocks.map((b) => {
    const md = /^#{1,6}\s+(.+)$/.exec(b.text);
    if (md) return { ...b, type: 'heading', text: md[1].replace(/\*\*/g, '').trim() };
    if (b.text.includes('**')) {
      const whole = /^\*\*([^*]+)\*\*:?$/.test(b.text);
      b = { ...b, text: b.text.replace(/\*\*/g, '').trim(), bold: b.bold || whole };
    }
    if (b.type === 'p' && BULLET_RE.test(b.text)) return { ...b, type: 'li', text: b.text.replace(BULLET_RE, '').trim() };
    if (b.type === 'li') return { ...b, text: b.text.replace(BULLET_RE, '').trim() };
    return b;
  // Recruiter tracking tags ("#LI-CT4", "#LI-Hybrid") are not content.
  }).filter((b) => b.text && !/^[\s•·*-]*$/.test(b.text) && !/^(#[\w-]+\s*)+$/.test(b.text));
}

// ── Headings and their kind ────────────────────────────────────────────────

// Checked in this order: the first match wins. "Preferred qualifications" is
// a nice-to-have before it is a qualification; "About the role" is the team
// overview before it is "the role".
const KIND_RULES = [
  ['legal', /\b(equal (employment )?opportunit|eeo\b|e-verify|accommodation|data privacy|privacy (notice|policy)|applicant privacy|pay transparency|(base )?(pay|salary|compensation) (range|transparency|information)|^compensation\b|^salary\b|^pay\b|fraud|recruitment scam|legal notice|disclaimer)/i],
  ['niceToHave', /\b(bonus|would be great|great if|nice[- ]to[- ]haves?|preferred|plus(es)?\b|desired|desirable|extra credit|ideally)/i],
  ['requirements', /\b(you have|you('ll)? bring|what you bring|requirements?|qualifications?|must[- ]haves?|who you are|about you|what we('re| are) looking for|what we need|looking for|you must bring|good fit|you should have|what it takes|who we('re| are) looking for|skills|experience (we|you)|you might be|we('d)? love|ideal candidate)/i],
  ['team', /\b(about the (role|team|job|position|opportunity)|the opportunity|(role|job|position) (overview|summary|description)|^overview$|^summary$|^description$|the team|team overview|meet the team|who you('ll)? work with|^the role$|^(about )?(the |our )[\w\s&'-]{0,30}\bteam$)/i],
  ['responsibilities', /\b(you will|you'll|what you('ll)? do|responsibilit|duties|your impact|in this role|day[- ]to[- ]day|key (job )?responsibilities|the work|what the job involves|your role|your job|day in the life|role and responsibilities|you('ll)? be)/i],
  ['benefits', /\b(benefits|perks|what we offer|why (join|work)|we offer|total rewards|life at|our offer|reasons to join)/i],
];
const COMPANY_RE = /\b(about us|who we are|our (mission|story|company|culture)|about the company|company (overview|description)|why us|our (brand |core )?values|who are we)\b/i;

function kindOfHeading(text, company) {
  const t = String(text || '').replace(/[‘’`]/g, "'").replace(/[:\s]+$/, '').trim();
  const c = String(company || '').trim().toLowerCase();
  if (COMPANY_RE.test(t)) return 'company';
  if (c && new RegExp(`^(about|life at|working at|join|why)\\s+${escapeRe(c)}\\b`, 'i').test(t)) return 'company';
  for (const [kind, rx] of KIND_RULES) if (rx.test(t)) return kind;
  // "Thumbtack helps millions of people..." as a heading is company text.
  if (c && c.length >= 3 && t.toLowerCase().includes(c)) return 'company';
  // "About Applied Intuition" when the board's company name differs slightly.
  if (/^about\s+(?!the\b|you\b|this\b)/i.test(t)) return 'company';
  return 'other';
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function isHeadingBlock(b, next, jobTitle) {
  if (b.type === 'heading') return b.text.length <= 100;
  if (b.type === 'li') return false;
  const t = b.text;
  if (t.length > 80) return false;
  if (/:$/.test(t)) return true;
  if (b.bold && /\?$/.test(t) && t.split(' ').length <= 6) return true;
  if (t.length >= 60 || /[.!?;,]$/.test(t)) return false;
  if (b.bold) return true;
  // A short line straight before a list ("Key job responsibilities").
  if (next && next.type === 'li' && t.split(' ').length <= 8) return true;
  return kindOfHeading(t) !== 'other' && t.split(' ').length <= 6 && !sameTitle(t, jobTitle);
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sameTitle = (a, b) => !!b && norm(a) === norm(b);

// Content that is legal/pay boilerplate wherever it sits.
const LEGAL_TEXT_RE = /\b(base pay|base salary|salary range|pay range|compensation range|pay scale|equal (employment )?opportunity|affirmative action|reasonable accommodation|accommodations?\b.*\b(disabilit|request)|e-verify|privacy (notice|policy)|applicant privacy|without regard to (race|age)|protected veteran|fair chance|arrest (and|or) conviction|background check|pay transparency|exempt from|this range|ranges? (is|are) (based|determined)|final (offer|compensation)|recruitment (fraud|scam)|please mention the word)/i;

// ── Facts ──────────────────────────────────────────────────────────────────

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };
const DAY_RE = /\b(mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri)(?:day)?s?\b/gi;

function money(n, k) {
  const v = parseFloat(String(n).replace(/,/g, ''));
  return Number.isFinite(v) ? (k ? v * 1000 : v) : null;
}

function extractSalary(text) {
  const re = /(?:(USD|CAD|EUR|GBP|AUD)\s*)?([$£€])\s?(\d[\d,]*(?:\.\d+)?)\s*([kK])?\s*(?:USD|CAD)?\s*(?:[—–-]|to)\s*(?:(?:USD|CAD)\s*)?[$£€]?\s?(\d[\d,]*(?:\.\d+)?)\s*([kK])?([^.\n]{0,60})/g;
  let m;
  while ((m = re.exec(text))) {
    const min = money(m[3], m[4]);
    const max = money(m[5], m[6] || m[4]);
    if (!min || !max || max < min) continue;
    const tail = `${m[7] || ''}`.toLowerCase();
    if (/^\s*(m|mm|b|bn|million|billion)\b/.test(tail)) continue;
    const hourly = /\b(hour|hr|hourly)\b/.test(tail) || max < 500;
    if (hourly ? (min < 7 || max > 500) : (min < 15000 || max > 2000000)) continue;
    const symbol = m[2];
    const currency = m[1] || (/\bcad\b/i.test(m[0]) ? 'CAD' : symbol === '£' ? 'GBP' : symbol === '€' ? 'EUR' : 'USD');
    return { min: Math.round(min), max: Math.round(max), currency, period: hourly ? 'hour' : 'year' };
  }
  return null;
}

const dayKey = (d) => d.slice(0, 3).toLowerCase();
const listDays = (idx) => idx.map((i) => DAY_LABEL[DAYS[i]]).join(', ').replace(/, ([^,]+)$/, ' & $1');

/** Weekdays named in a phrase, with "Monday through Thursday" expanded. */
function daysIn(phrase) {
  const found = new Set();
  let m;
  DAY_RE.lastIndex = 0;
  while ((m = DAY_RE.exec(phrase))) found.add(DAYS.indexOf(dayKey(m[1])));
  const range = /\b(mon|tue|wed|thu|fri)[a-z]*\s*(?:through|thru|to|[-–—])\s*(mon|tue|wed|thu|fri)[a-z]*/i.exec(phrase);
  if (range) {
    for (let i = DAYS.indexOf(dayKey(range[1])); i >= 0 && i <= DAYS.indexOf(dayKey(range[2])); i += 1) found.add(i);
  }
  return [...found].filter((i) => i >= 0).sort((a, b) => a - b);
}

/** { label: "Onsite Tue–Thu", detail: "Onsite Tue, Wed, Thu · optional Mon & Fri" } */
function extractSchedule(text) {
  for (const s of text.split(/(?<=[.!?])\s+|\n/)) {
    if (!/\b(on-?site|in[- ]office|in the office|in-person|in person|office)\b/i.test(s)) continue;
    // Days named as optional ("with Monday and Friday optional") don't count.
    const cut = s.search(/\b(optional|flexible|remote on|work from home on|wfh on)\b|,?\s+with\s+(?=(mon|tue|wed|thu|fri))/i);
    const required = daysIn(cut >= 0 ? s.slice(0, cut) : s);
    if (required.length < 2) continue;
    const optional = cut >= 0 ? daysIn(s.slice(cut)).filter((i) => !required.includes(i)) : [];
    const contiguous = required.length >= 3 && required.every((v, i) => i === 0 || v === required[i - 1] + 1);
    const short = contiguous ? `${DAY_LABEL[DAYS[required[0]]]}–${DAY_LABEL[DAYS[required[required.length - 1]]]}` : required.map((i) => DAY_LABEL[DAYS[i]]).join(', ');
    return {
      label: `Onsite ${short}`,
      detail: `Onsite ${required.map((i) => DAY_LABEL[DAYS[i]]).join(', ')}${optional.length ? ` · optional ${listDays(optional)}` : ''}`,
    };
  }
  const n = /\b(\d|one|two|three|four|five)\s*(?:\(\d\)\s*)?days?\s*(?:a|per|each|\/)\s*week\b[^.]{0,40}?\b(office|on-?site|in[- ]person)|\b(office|on-?site|in[- ]person)\b[^.]{0,40}?\b(\d|one|two|three|four|five)\s*(?:\(\d\)\s*)?days?\s*(?:a|per|each|\/)\s*week/i.exec(text);
  if (n) {
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    const raw = (n[1] || n[4]).toLowerCase();
    const days = words[raw] || parseInt(raw, 10);
    if (days >= 1 && days <= 5) {
      return days === 5
        ? { label: 'Onsite 5 days/wk', detail: 'In the office 5 days a week' }
        : { label: `In office ${days} days/wk`, detail: `In the office ${days} days a week` };
    }
  }
  return null;
}

function extractExperience(text) {
  const re = /(\d{1,2})\s*(\+)?\s*(?:(?:[-–—]|to)\s*(\d{1,2})\s*\+?\s*)?(?:years?|yrs?)\b/gi;
  let m;
  while ((m = re.exec(text))) {
    const a = parseInt(m[1], 10);
    const b = m[3] ? parseInt(m[3], 10) : null;
    if (a < 1 || a > 25 || (b !== null && (b <= a || b > 30))) continue;
    // "founded 10 years ago", "18 years of age", "a 4-year degree"
    const before = text.slice(Math.max(0, m.index - 25), m.index).toLowerCase();
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 15).toLowerCase();
    if (/^\s*(ago|old|of age|degree|history|warranty|program)/.test(after) || /\b(founded|anniversary|vest\w*|celebrat\w*)\W+(\w+\W+)?$/.test(before)) continue;
    return b ? `${a}–${b} years` : `${a}+ years`;
  }
  return null;
}

function extractWorkMode(text, locationType) {
  const lt = String(locationType || '').toLowerCase();
  if (lt === 'remote') return 'Remote';
  if (lt === 'hybrid') return 'Hybrid';
  if (lt === 'onsite' || lt === 'on-site') return 'Onsite';
  if (/\bhybrid\b/i.test(text)) return 'Hybrid';
  if (/\b(fully remote|100% remote|remote[- ]first|remote position|this (role|position) is remote|work from anywhere)\b/i.test(text)) return 'Remote';
  if (/\b(on-?site|in[- ]office company|in the office \d|in-person role)\b/i.test(text)) return 'Onsite';
  return null;
}

// "Diversity, equity and inclusion" and "pay equity" are not equity comp.
const hasEquity = (text) => /\b(equity|rsus?|stock options?|employee stock)\b/i.test(
  text.replace(/\b(diversity,?\s*(and\s*)?equity|equity,?\s*(and\s*)?inclusion|inclusion,?\s*(and\s*)?equity|pay equity|health equity|racial equity|equity[- ]minded|equitable)\b/gi, '')
);

function extractFacts(text, job = {}) {
  const facts = {};
  const salary = job.salaryMin && job.salaryMax && job.salaryMax >= job.salaryMin
    ? {
      min: job.salaryMin,
      max: job.salaryMax,
      currency: job.salaryCurrency || 'USD',
      period: /hour/i.test(job.salaryPeriod || '') || job.salaryMax < 500 ? 'hour' : 'year',
    }
    : extractSalary(text);
  if (salary) facts.salary = salary;
  const workMode = extractWorkMode(text, job.locationType);
  if (workMode) facts.workMode = workMode;
  const schedule = workMode === 'Remote' ? null : extractSchedule(text);
  if (schedule) { facts.schedule = schedule.label; facts.scheduleDetail = schedule.detail; }
  const experience = extractExperience(text);
  if (experience) facts.experience = experience;
  const location = String(job.location || '').trim();
  if (location) facts.location = location.slice(0, 120);
  if (hasEquity(text)) facts.equity = true;
  return facts;
}

// ── Assemble ───────────────────────────────────────────────────────────────

const TITLES = {
  team: 'About the role',
  responsibilities: "What you'll do",
  requirements: "What they're looking for",
  niceToHave: 'Nice to have',
  benefits: 'Benefits',
  other: null,
};
const ROLE_KINDS = new Set(['responsibilities', 'requirements', 'niceToHave']);
const NICE_PREFIX = /^(bonus( points)?|nice[- ]to[- ]have|plus|preferred|extra credit)\s*[:–—-]\s*/i;

function firstSentences(text, n = 2) {
  // Split only where a sentence really ends: "Node.js" and "e.g. React" stay whole.
  const parts = String(text).split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/);
  const take = [];
  for (const p of parts) {
    if (take.length && (take.length >= n || `${take.join(' ')} ${p.trim()}`.length > 220)) break;
    take.push(p.trim());
  }
  const summary = take.join(' ').trim();
  return { summary, rest: String(text).slice(String(text).indexOf(take[take.length - 1]) + take[take.length - 1].length).trim() };
}

/**
 * Group blocks into sections, then route boilerplate out: company text to
 * `company`, pay/EEO/privacy to `legal`, "Bonus:" bullets to niceToHave.
 */
function assemble(blocks, job = {}) {
  const company = String(job.company || '').trim();
  const companyRe = company && company.length >= 3 ? new RegExp(`\\b${escapeRe(company)}\\b`, 'i') : null;
  const groups = [];
  let current = { kind: 'intro', title: null, blocks: [] };
  let sawRoleHeading = false;

  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    if (isHeadingBlock(b, blocks[i + 1], job.title)) {
      const title = b.text.replace(/\s*:\s*$/, '').trim();
      if (sameTitle(title, job.title)) continue;
      groups.push(current);
      const kind = kindOfHeading(title, company);
      if (ROLE_KINDS.has(kind) || kind === 'team') sawRoleHeading = true;
      current = { kind, title, blocks: [] };
      continue;
    }
    // "<strong>Responsibilities:</strong> Partner with ..." in one paragraph.
    if (b.type === 'p' && b.lead && /:$/.test(b.lead) && b.lead.length < 60 && b.text.length > b.lead.length + 3) {
      const kind = kindOfHeading(b.lead, company);
      if (kind !== 'other') {
        groups.push(current);
        current = { kind, title: b.lead.replace(/\s*:\s*$/, ''), blocks: [{ ...b, text: b.text.slice(b.lead.length).trim(), lead: undefined }] };
        if (ROLE_KINDS.has(kind) || kind === 'team') sawRoleHeading = true;
        continue;
      }
    }
    // Before the first role heading, a block about the company is company text.
    if (!sawRoleHeading && current.kind === 'intro' && b.type === 'p' && companyRe && companyRe.test(b.text) && groups.length === 0 && /\b(founded|mission|we are|is a|is the|is an|our|headquartered|company|platform)\b/i.test(b.text)) {
      current.companyBlocks = (current.companyBlocks || []).concat(b);
      continue;
    }
    current.blocks.push(b);
  }
  groups.push(current);

  const out = { sections: [], company: [], legal: [], links: [] };
  const pushLegal = (b) => { out.legal.push(b.text); out.links.push(...(b.links || [])); };
  const bySection = new Map();
  const sectionFor = (kind, title) => {
    const key = kind === 'other' ? `other:${title || ''}` : kind;
    if (!bySection.has(key)) {
      const s = { kind, title: TITLES[kind] || title || 'More about the role', items: [], paragraphs: [] };
      bySection.set(key, s);
      out.sections.push(s);
    }
    return bySection.get(key);
  };

  for (const g of groups) {
    for (const b of g.companyBlocks || []) out.company.push(b.text);
    if (!g.blocks.length) continue;
    if (g.kind === 'company') { for (const b of g.blocks) out.company.push(b.text); continue; }
    if (g.kind === 'legal') { for (const b of g.blocks) pushLegal(b); continue; }
    const kind = g.kind === 'intro' ? 'team' : g.kind;
    let sawItem = false;
    for (const b of g.blocks) {
      if (LEGAL_TEXT_RE.test(b.text) && (b.type === 'p' || kind === 'other' || kind === 'benefits' || kind === 'team')) { pushLegal(b); continue; }
      // Company boilerplate trailing a role section ("Spotify is an equal...")
      // is caught above; plain "At <Company> we ..." paragraphs after the
      // role sections read as company text.
      if (b.type === 'p' && kind === 'other' && companyRe && companyRe.test(b.text) && /^(at |about |join |we |our )/i.test(b.text)) { out.company.push(b.text); continue; }
      if (b.type === 'li') {
        if (kind === 'requirements' && NICE_PREFIX.test(b.text)) {
          sectionFor('niceToHave').items.push(b.text.replace(NICE_PREFIX, '').replace(/^./, (c) => c.toUpperCase()));
          continue;
        }
        sawItem = true;
        sectionFor(kind, g.title).items.push(b.text);
      } else if (sawItem && ROLE_KINDS.has(kind)) {
        // Prose trailing a list ("Clearance Level: None", "Shift: First")
        // belongs to the posting, not to the list above it.
        sectionFor('other', 'More details').paragraphs.push(b.text);
      } else {
        sectionFor(kind, g.title).paragraphs.push(b.text);
      }
    }
  }

  // Plain-text postings list requirements as bare lines; read short lines
  // under a role heading as the list they are.
  for (const sec of out.sections) {
    if (ROLE_KINDS.has(sec.kind) && !sec.items.length && sec.paragraphs.length >= 2 && sec.paragraphs.every((p) => p.length < 300)) {
      sec.items = sec.paragraphs;
      sec.paragraphs = [];
    }
  }

  // Bullets under "Job Description"/"About the role" are the duties when the
  // posting has no separate responsibilities heading.
  const teamS = bySection.get('team');
  if (teamS && teamS.items.length && !bySection.has('responsibilities')) {
    sectionFor('responsibilities').items.push(...teamS.items);
    teamS.items = [];
  }

  // Requirements and nice-to-have read best side by side.
  const order = ['team', 'responsibilities', 'requirements', 'niceToHave', 'other', 'benefits'];
  out.sections = out.sections
    .filter((s) => s.items.length || s.paragraphs.length)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => order.indexOf(a.s.kind) - order.indexOf(b.s.kind) || a.i - b.i)
    .map(({ s }) => {
      const clean = { kind: s.kind, title: s.title };
      if (s.items.length) clean.items = dedupe(s.items);
      if (s.paragraphs.length) clean.paragraphs = dedupe(s.paragraphs);
      return clean;
    });
  return out;
}

const LOGISTICS_RE = /^(by applying|please note|please mention|note:|[a-z][a-z /]{2,24}:\s|https?:|this (position|role) (is|requires|will be)|applications? (are|will)|we will take your location|candidates must)/i;

const dedupe = (arr) => arr.filter((v, i, a) => a.indexOf(v) === i);

function finish(parts, text, job) {
  let summary = '';
  const team = parts.sections.find((s) => s.kind === 'team' && s.paragraphs && s.paragraphs.length);
  // Application logistics ("By applying to this position...") make a poor summary.
  const at = team ? team.paragraphs.findIndex((p) => !LOGISTICS_RE.test(p) && p.length > 40) : -1;
  if (at >= 0) {
    const { summary: s, rest } = firstSentences(team.paragraphs[at]);
    summary = s;
    if (rest) team.paragraphs[at] = rest; else team.paragraphs.splice(at, 1);
    if (!team.paragraphs.length) delete team.paragraphs;
  }
  const sections = parts.sections.filter((s) => (s.items && s.items.length) || (s.paragraphs && s.paragraphs.length));
  const links = parts.links.filter((l, i, a) => a.findIndex((x) => x.href === l.href) === i).slice(0, 12);
  return {
    version: STRUCTURE_VERSION,
    facts: extractFacts(text, job),
    summary,
    sections,
    company: { paragraphs: dedupe(parts.company) },
    legal: { paragraphs: dedupe(parts.legal), links },
  };
}

const sourceOf = (job = {}) => String(job.descriptionHtml || job.description || '');
const sourceHash = (src) => crypto.createHash('sha1').update(String(src)).digest('hex').slice(0, 16);

/** The structured description for a job row, or null when it has no text. */
function structureDescription(job = {}) {
  const src = sourceOf(job);
  if (!src.trim()) return null;
  const blocks = toBlocks(src);
  if (!blocks.length) return null;
  const text = blocks.map((b) => b.text).join('\n');
  const out = finish(assemble(blocks, job), text, job);
  out.src = sourceHash(src);
  out.method = 'rules';
  return out;
}

/** Fewer than two role sections: the posting had no headings worth the name. */
function needsAiSplit(structured) {
  if (!structured) return false;
  const roleSections = structured.sections.filter((s) => ROLE_KINDS.has(s.kind)).length;
  const textLength = structured.sections.reduce((n, s) => n + [...(s.items || []), ...(s.paragraphs || [])].join(' ').length, 0);
  return roleSections < 2 && textLength > 600;
}

/** Is the cached structure current for this row's text? */
function isCurrent(structured, job = {}) {
  if (!structured || structured.version !== STRUCTURE_VERSION) return false;
  // descriptionHtml is nulled on old rows to reclaim disk
  // (compactOldJobRows); the cache built from it stays the better read.
  if (!job.descriptionHtml) return true;
  return structured.src === sourceHash(sourceOf(job));
}

// ── AI split (anchors only) ────────────────────────────────────────────────

const AI_KINDS = ['team', 'responsibilities', 'requirements', 'niceToHave', 'benefits', 'company', 'legal', 'other'];

/** Plain text the model reads, and the text its anchors are found in. */
function plainTextFor(job = {}) {
  return toBlocks(sourceOf(job)).map((b) => b.text).join('\n').slice(0, 12000);
}

function buildSplitPrompt(job = {}, text) {
  return {
    system: 'You split job postings into sections. You never rewrite text. Return valid JSON only.',
    prompt: `Split this job posting into sections.

TITLE: ${String(job.title || '').slice(0, 200)}
COMPANY: ${String(job.company || '').slice(0, 120)}

POSTING:
${text}

RULES:
- Do not rewrite content; only classify and split it. Every "heading" and "starts" value must be copied VERBATIM from the posting, character for character, so it can be found by exact search.
- kind: one of ${AI_KINDS.join(', ')}. team = what the role and team are; company = about the company; legal = pay disclaimers, EEO, accommodations, privacy.
- heading: the section's heading text exactly as written, or "" when it has none.
- format: "items" when the section is a list of separate points (even if run together without bullets), else "paragraphs".
- starts: the first 5-8 words of each item or paragraph, verbatim, in order.
- Sections in the posting's order. Cover the whole posting.
- summary: 1-2 plain sentences about the role and team, in your own words, under 240 characters.

Return ONLY JSON:
{"summary":"","sections":[{"kind":"","heading":"","format":"items","starts":[""]}]}`,
    max_tokens: 2000,
  };
}

/**
 * Cut the posting at the model's verbatim anchors. Anchors that can't be
 * found are dropped; null when too little lines up to trust.
 */
function applyAiSplit(raw, job = {}, text) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sections)) return null;
  // Every cut point, in order: { at, kind, role: 'heading'|'start', format }
  const cuts = [];
  let cursor = 0;
  let found = 0;
  let asked = 0;
  for (const s of raw.sections.slice(0, 20)) {
    if (!s || typeof s !== 'object') continue;
    const kind = AI_KINDS.includes(s.kind) ? s.kind : 'other';
    const format = s.format === 'items' ? 'items' : 'paragraphs';
    const heading = tidy(s.heading);
    if (heading) {
      const at = text.indexOf(heading, cursor);
      if (at >= 0) { cuts.push({ at, end: at + heading.length, kind, role: 'heading', format, heading }); cursor = at + heading.length; }
    }
    for (const start of (Array.isArray(s.starts) ? s.starts : []).slice(0, 40)) {
      const a = tidy(start);
      if (a.length < 8) continue;
      asked += 1;
      const at = text.indexOf(a, cursor);
      if (at < 0) continue;
      found += 1;
      cuts.push({ at, kind, role: 'start', format, heading });
      cursor = at + a.length;
    }
  }
  if (asked === 0 || found / asked < 0.6) return null;

  const parts = { sections: [], company: [], legal: [], links: [] };
  const byKind = new Map();
  const preamble = text.slice(0, cuts.length ? cuts[0].at : text.length).trim();
  for (let i = 0; i < cuts.length; i += 1) {
    const c = cuts[i];
    if (c.role === 'heading') continue;
    const piece = tidy(text.slice(c.at, i + 1 < cuts.length ? cuts[i + 1].at : text.length)).replace(BULLET_RE, '');
    if (!piece) continue;
    if (c.kind === 'company') { parts.company.push(piece); continue; }
    if (c.kind === 'legal') { parts.legal.push(piece); continue; }
    const key = c.kind === 'other' ? `other:${c.heading}` : c.kind;
    if (!byKind.has(key)) {
      const s = { kind: c.kind, title: TITLES[c.kind] || c.heading || 'More about the role', items: [], paragraphs: [] };
      byKind.set(key, s);
      parts.sections.push(s);
    }
    const s = byKind.get(key);
    if (c.format === 'items' && c.kind !== 'team') s.items.push(piece); else s.paragraphs.push(piece);
  }
  if (preamble) {
    if (!byKind.has('team')) { const s = { kind: 'team', title: TITLES.team, items: [], paragraphs: [] }; byKind.set('team', s); parts.sections.unshift(s); }
    byKind.get('team').paragraphs.unshift(preamble);
  }
  const order = ['team', 'responsibilities', 'requirements', 'niceToHave', 'other', 'benefits'];
  parts.sections = parts.sections
    .map((s) => ({ kind: s.kind, title: s.title, ...(s.items.length ? { items: s.items } : {}), ...(s.paragraphs.length ? { paragraphs: s.paragraphs } : {}) }))
    .filter((s) => s.items || s.paragraphs)
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const out = finish(parts, text, job);
  const summary = tidy(raw.summary).slice(0, 280);
  if (summary) {
    out.summary = summary;
  }
  out.src = sourceHash(sourceOf(job));
  out.method = 'ai';
  return out;
}

module.exports = {
  STRUCTURE_VERSION,
  structureDescription,
  needsAiSplit,
  isCurrent,
  plainTextFor,
  buildSplitPrompt,
  applyAiSplit,
  // exported for tests
  toBlocks,
  kindOfHeading,
  extractFacts,
  extractSalary,
  extractSchedule,
  extractExperience,
};
