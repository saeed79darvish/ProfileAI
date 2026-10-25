/**
 * Read a LinkedIn profile from its public page: the version LinkedIn shows
 * logged-out visitors and search engines.
 *
 * Best effort, by design. Only profiles set to public have one, sections the
 * person hid are not on it, role descriptions are often missing, and LinkedIn
 * blocks cloud servers far more readily than a home connection. So every
 * failure comes back as a reason, never a throw, and the caller falls back
 * to the PDF LinkedIn exports. One page, fetched once, because the person
 * asked for their own profile to be read; never a crawl.
 *
 * Returns the same resume shape the PDF parser and the paid import do, so
 * the coach treats all three alike.
 */

const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** `https://www.linkedin.com/in/<slug>/`, or '' when it is not a profile URL. */
const canonicalProfileUrl = (url = '') => {
  const m = String(url).trim().match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]+)\/?/i);
  return m ? `https://www.linkedin.com/in/${m[1]}/` : '';
};

// Inside a tag, up to its end. Quote-aware: LinkedIn's class names contain
// a literal ">" (Tailwind's "[&>*]"), which ends a naive [^>]* early.
const ATTRS = '(?:"[^"]*"|[^">])*';

const decode = (s = '') => String(s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const text = (html = '') => decode(String(html).replace(/<br\s*\/?>/gi, '\n').replace(new RegExp(`<${ATTRS}>`, 'g'), ' '))
  .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const oneLine = (s) => text(s).replace(/\s+/g, ' ').trim();

/** The inner HTML of the first element carrying `cls`, or ''. */
const byClass = (html, cls) => {
  const m = html.match(new RegExp(`<(\\w+)${ATTRS}class="[^"]*\\b${cls}\\b[^"]*"${ATTRS}>([\\s\\S]*?)</\\1>`));
  return m ? m[2] : '';
};

const section = (html, name) => {
  const m = html.match(new RegExp(`<section${ATTRS}data-section="${name}"[\\s\\S]*?</section>`));
  return m ? m[0] : '';
};

const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
/** "Jan 2020" to "2020-01", "2020" to "2020"; anything else to ''. */
const toDate = (s = '') => {
  const m = String(s).trim().match(/^(?:([A-Za-z]{3})[a-z]*\.?\s+)?(\d{4})$/);
  if (!m) return '';
  const month = m[1] && MONTHS[m[1].toLowerCase()];
  return month ? `${m[2]}-${month}` : m[2];
};

/** Start, end and whether it is current, from a "date-range" span. */
const dateRange = (html) => {
  const range = byClass(html, 'date-range');
  if (!range) return { startDate: '', endDate: null, current: false };
  const times = [...range.matchAll(/<time>([\s\S]*?)<\/time>/g)].map((m) => oneLine(m[1]));
  const current = /present/i.test(oneLine(range));
  return {
    startDate: toDate(times[0] || ''),
    endDate: current ? null : (toDate(times[1] || '') || null),
    current,
  };
};

const listItems = (html, cls) => {
  const out = [];
  const re = new RegExp(`<li${ATTRS}class="[^"]*\\b${cls}\\b[^"]*"[\\s\\S]*?</li>`, 'g');
  let m;
  while ((m = re.exec(html))) out.push(m[0]);
  return out;
};

const ldPerson = (html) => {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      const person = nodes.find((n) => n && n['@type'] === 'Person');
      if (person) return person;
    } catch { /* not JSON we can use */ }
  }
  return null;
};

/** Pure: the public profile page's HTML in, the resume shape out. */
function parsePublicProfileHtml(html = '', linkedinUrl = '') {
  const person = ldPerson(html) || {};
  const name = oneLine(person.name || (html.match(/<title>([^<]*?)\s+-\s+/) || [])[1] || '');
  const [firstName = '', ...rest] = name.split(' ');
  // "<Name> - <Headline> | LinkedIn"
  const titleTag = decode((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
  const headline = (titleTag.split(' | LinkedIn')[0].split(' - ').slice(1).join(' - ') || '').trim();

  const about = text(byClass(section(html, 'summary'), 'core-section-container__content') || section(html, 'summary'))
    .replace(/^About\s*/i, '').trim() || oneLine(person.description || '');

  const experience = listItems(section(html, 'experience'), 'experience-item').map((item) => {
    const description = text(
      byClass(item, 'show-more-less-text__text--more')
      || byClass(item, 'show-more-less-text__text--less')
      || byClass(item, 'experience-item__description')
    );
    return {
      title: oneLine(byClass(item, 'experience-item__title')),
      company: oneLine(byClass(item, 'experience-item__subtitle')),
      ...dateRange(item),
      description,
    };
  }).filter((r) => r.title || r.company);

  const education = listItems(section(html, 'educationsDetails'), 'education__list-item').map((item) => {
    const degreeInfo = [...item.matchAll(new RegExp(`<span${ATTRS}class="[^"]*education__item--degree-info[^"]*"${ATTRS}>([\\s\\S]*?)</span>`, 'g'))].map((m) => oneLine(m[1]));
    const range = dateRange(item);
    return {
      institution: oneLine((item.match(new RegExp(`<h3${ATTRS}>([\\s\\S]*?)</h3>`)) || [])[1] || ''),
      degree: degreeInfo[0] || '',
      field: degreeInfo[1] || '',
      startDate: range.startDate,
      endDate: range.endDate,
      current: false,
      gpa: null,
    };
  }).filter((e) => e.institution);

  const address = person.address || {};
  return {
    firstName,
    lastName: rest.join(' '),
    title: headline || (Array.isArray(person.jobTitle) ? person.jobTitle[0] : person.jobTitle) || '',
    location: oneLine(address.addressLocality || ''),
    phone: '',
    linkedinUrl,
    githubUrl: '',
    summary: about,
    profilePicture: '',
    // The public page has no skills list.
    skills: [],
    experience,
    education,
    projects: [],
  };
}

/** What the page we got back is, before reading anything off it. */
const classify = (status, html) => {
  if (status === 999 || status === 429) return 'blocked';
  if (status === 404) return 'not_found';
  if (status >= 400) return 'blocked';
  if (/authwall|uas\/login|checkpoint\/challenge/i.test(html) && !/data-section="experience"/.test(html)) return 'authwall';
  return 'ok';
};

/**
 * Fetch and read one public profile.
 * @returns {Promise<{ok: true, data: object} | {ok: false, reason: string}>}
 */
async function readPublicProfile(url) {
  const canonical = canonicalProfileUrl(url);
  if (!canonical) return { ok: false, reason: 'invalid_url' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let status = 0;
  let html = '';
  try {
    const res = await fetch(canonical, { headers: HEADERS, redirect: 'follow', signal: controller.signal });
    status = res.status;
    html = (await res.text()).slice(0, MAX_HTML_BYTES);
  } catch (error) {
    return { ok: false, reason: error?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }

  const kind = classify(status, html);
  if (kind !== 'ok') return { ok: false, reason: kind };

  const data = parsePublicProfileHtml(html, canonical);
  // A page with a name and nothing else is a private profile, not an import.
  if (!data.experience.length && !data.summary && !data.education.length) return { ok: false, reason: 'empty' };
  return { ok: true, data };
}

module.exports = { readPublicProfile, parsePublicProfileHtml, canonicalProfileUrl, toDate };
