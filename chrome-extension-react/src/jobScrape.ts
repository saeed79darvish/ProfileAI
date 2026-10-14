/**
 * The one job-posting scraper.
 *
 * There used to be two: `getJobInfo()` in the content script and a second,
 * independently-written copy injected by the background worker via
 * `chrome.scripting.executeScript`. They disagreed in ways that mattered:
 *
 *   - The content script resolved titles with a single
 *     `document.querySelector('a, b, …, h1')`. That returns the first element
 *     in DOCUMENT ORDER matching ANY selector, not the first selector that
 *     matches — so with a bare `h1` in the list, any unrelated `h1` higher up
 *     the page beat the posting's own title element.
 *   - The background copy read descriptions with plain `innerText`, losing
 *     every `<li>` marker, so a bulleted requirements list arrived as prose.
 *   - The merge between them preferred the content script's title whenever the
 *     content script's DESCRIPTION was longer — an unrelated field deciding
 *     which title won.
 *
 * This function is deliberately self-contained: no imports, no references to
 * anything in module scope, every helper declared inside. That is a hard
 * requirement, not a style choice — `executeScript({ func })` serializes the
 * function with `toString()` and evaluates it in the page, where nothing from
 * this bundle exists. Anything hoisted out of the body breaks injection at
 * runtime, silently, on whichever site is being scraped.
 */

export interface ScrapedJob {
  title: string;
  company: string;
  description: string;
  location: string;
  /** Which site profile matched, for logging and for callers that branch. */
  site: string;
  /** Which selector produced each field — makes a bad scrape diagnosable. */
  via: { title: string; company: string; description: string };
}

export function scrapeJobFromDocument(): ScrapedJob {
  // ── Site profiles ─────────────────────────────────────────────────────────
  // Selectors are PRIORITY-ORDERED arrays, not comma-joined strings. The first
  // entry that matches an element wins, regardless of where it sits in the
  // document. Generic catch-alls (`h1`) come last precisely so they only apply
  // when nothing specific matched.
  const SITES: Array<{
    name: string;
    match: RegExp;
    title: string[];
    company: string[];
    description: string[];
  }> = [
    {
      name: 'linkedin',
      match: /linkedin\.com/,
      title: [
        '.job-details-jobs-unified-top-card__job-title a',
        '.job-details-jobs-unified-top-card__job-title h1',
        '.job-details-jobs-unified-top-card__job-title',
        '.jobs-unified-top-card__job-title a',
        '.jobs-unified-top-card__job-title h1',
        '.jobs-unified-top-card__job-title',
        '.jobs-details-top-card__job-title',
        '.top-card-layout__title',
        'h2.top-card-layout__title',
        'h1.t-24',
        'h1[class*="jobs"]',
      ],
      company: [
        '.job-details-jobs-unified-top-card__company-name a',
        '.job-details-jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__primary-description-without-tagline a',
        '.jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name',
        '.jobs-details-top-card__company-info a',
        '.topcard__org-name-link',
        '.job-details-jobs-unified-top-card__primary-description a[href*="/company/"]',
        '[class*="job-details"] a[href*="/company/"]',
        'a[data-tracking-control-name*="company"]',
      ],
      description: [
        '#job-details',
        '.jobs-description-content__text',
        '.jobs-description__content',
        '.jobs-description-content',
        '.jobs-box__html-content',
        '.show-more-less-html__markup',
        'div.jobs-description',
        'div[class*="jobs-description"]',
        '[class*="decorated-job-posting__details"]',
        '.description__text',
      ],
    },
    {
      name: 'greenhouse',
      match: /greenhouse\.io/,
      title: ['.app-title', 'h1.heading', 'h1'],
      company: ['.company-name', '.logo'],
      description: ['#content', '#job_description', '.job-description', '[class*="job-description"]'],
    },
    {
      name: 'lever',
      match: /lever\.co/,
      title: ['.posting-headline h2', 'h1.posting-headline', 'h1'],
      company: ['.main-header-logo img[alt]', '.posting-categories .location'],
      description: ['.posting-page', '.section-wrapper', '.content', '[class*="posting-"]'],
    },
    {
      name: 'workday',
      match: /workday\.com|myworkdayjobs\.com/,
      title: ['[data-automation-id="jobPostingTitle"]', 'h2[data-automation-id]', 'h1'],
      company: ['[data-automation-id="jobPostingCompany"]', '.company-name'],
      description: ['[data-automation-id="jobPostingDescription"]', '[data-automation-id="jobPostingPage"]', '[class*="jobDescription"]'],
    },
    {
      name: 'ashby',
      match: /ashbyhq\.com|[?&]ashby_jid=/,
      title: ['[class*="JobPostingTitle"]', '[class*="job-title"]', 'h1'],
      company: ['[class*="CompanyName"]', '[class*="company"]'],
      description: ['[class*="JobDescription"]', '[class*="job-description"]'],
    },
    {
      name: 'icims',
      match: /icims\.com/,
      title: ['.iCIMS_Header h1', 'h1'],
      company: ['.iCIMS_CompanyName'],
      description: ['.iCIMS_JobContent'],
    },
    {
      name: 'smartrecruiters',
      match: /smartrecruiters\.com|jobs\.smartrecruiters/,
      title: ['[class*="job-title"]', 'h1'],
      company: ['[class*="company"]'],
      description: ['[class*="job-description"]'],
    },
    {
      name: 'generic',
      match: /.*/,
      title: ['[class*="job-title"]', '[class*="jobtitle"]', '[class*="posting-headline"]', 'h1'],
      company: ['[class*="company-name"]', '.company', '[class*="company"]'],
      description: ['.job-description', '[class*="job-description"]', '[class*="jobdescription"]', '#job_description'],
    },
  ];

  /**
   * innerText with list markers preserved.
   *
   * Chrome renders `<li>` without its `::marker`, so `innerText` flattens a
   * bulleted requirements list into unmarked prose — and the on-device matcher
   * treats a bulleted line as a requirement but is deliberately sceptical of
   * prose. A posting with 34 long bullets arrived as 3 usable lines.
   *
   * `innerText` needs layout, and a detached clone has none (it degrades to
   * `textContent` and loses every line break), so the clone is attached
   * offscreen for the read and removed immediately. The marker goes in as a
   * text node rather than by rewriting `textContent`, which would flatten
   * nested lists into their parent.
   */
  const readText = (el: Element | null): string => {
    if (!el) return '';
    const plain = (el as HTMLElement).innerText || el.textContent || '';
    let host: HTMLElement | null = null;
    try {
      if (!el.querySelector('li')) return plain;
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('li').forEach((li) => {
        if ((li.textContent || '').trim()) {
          li.insertBefore(document.createTextNode('\n• '), li.firstChild);
          // A trailing newline too, so the markers still delimit lines if this
          // read ends up going through `textContent` rather than `innerText`
          // (older engines, and anywhere layout is unavailable). Without it a
          // textContent fallback returns every bullet run together on one line,
          // and the downstream matcher sees one enormous "requirement".
          li.appendChild(document.createTextNode('\n'));
        }
      });
      host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px;pointer-events:none;z-index:-1;';
      host.setAttribute('aria-hidden', 'true');
      host.appendChild(clone);
      document.body.appendChild(host);
      // `innerText` when layout gave us one, `textContent` otherwise — the
      // markers are real text nodes either way, so both carry them.
      const marked = clone.innerText || clone.textContent || '';
      // A materially shorter offscreen read means something in the clone did
      // not render — trust the original over a truncated copy.
      return marked.trim().length >= plain.trim().length * 0.6 ? marked : plain;
    } catch (_) {
      return plain;
    } finally {
      if (host && host.parentNode) host.parentNode.removeChild(host);
    }
  };

  /**
   * First SELECTOR that yields usable text wins — priority order, not document
   * order. This is the fix for the comma-joined `querySelector` that let a
   * stray `h1` outrank the posting's own title element.
   */
  const firstMatch = (selectors: string[], maxLen = 500): { text: string; via: string } => {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (!el) continue;
        // `alt` for the logo-image company selectors (Lever puts the company
        // name only in the header logo's alt text).
        const raw = (el.tagName === 'IMG' ? el.getAttribute('alt') : null) || el.textContent || '';
        const text = raw.replace(/\s+/g, ' ').trim();
        if (text && text.length < maxLen) return { text, via: sel };
      } catch (_) {
        /* invalid selector for this engine — skip */
      }
    }
    return { text: '', via: '' };
  };

  /** Longest text among the given selectors, read bullet-preservingly. */
  const longestOf = (selectors: string[]): { text: string; via: string } => {
    let best = '';
    let via = '';
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (!el) continue;
        const text = readText(el).trim();
        if (text.length > best.length) {
          best = text;
          via = sel;
        }
      } catch (_) {}
    }
    return { text: best, via };
  };

  const href = location.href;
  const site = SITES.find((s) => s.match.test(href)) || SITES[SITES.length - 1];
  const generic = SITES[SITES.length - 1];

  // ── Title and company ─────────────────────────────────────────────────────
  // Site-specific selectors first, then the generic profile's, then the bare
  // `h1`. The bare `h1` is last on purpose: it is the selector that produces a
  // profile owner's name on a LinkedIn /in/ page and a page heading on a
  // search results page.
  let titleHit = firstMatch(site.title);
  if (!titleHit.text && site.name !== 'generic') titleHit = firstMatch(generic.title);
  if (!titleHit.text) titleHit = firstMatch(['h1'], 300);

  let companyHit = firstMatch(site.company, 200);
  if (!companyHit.text && site.name !== 'generic') companyHit = firstMatch(generic.company, 200);

  let title = titleHit.text;
  let company = companyHit.text;
  let titleVia = titleHit.via;
  let companyVia = companyHit.via;

  // document.title fallback: "Job Title | Company | LinkedIn", possibly with a
  // "(3) " unread-count prefix.
  if (!title || !company) {
    const docTitle = (document.title || '').replace(/^\(\d+\)\s*/, '');
    // "Job Title | Company | LinkedIn", "Job Title - Company", and Ashby's
    // "Job Title @ Company" / "Job Title at Company". The @ form was not
    // split before, so every Ashby posting was saved with no company and its
    // tailored resume was unrecognisable in the list.
    let parts = docTitle.split(/\s*[|·–—]\s*/).map((p) => p.trim());
    if (parts.length < 2) {
      const m = docTitle.match(/^(.{3,200}?)\s+(?:@|at)\s+(.{2,120}?)\s*$/i);
      if (m) parts = [m[1].trim(), m[2].trim()];
    }
    if (parts.length >= 2) {
      if (!title && parts[0] && parts[0].length < 200) {
        title = parts[0];
        titleVia = 'document.title';
      }
      if (!company && parts[1] && parts[1] !== 'LinkedIn' && parts[1].length < 200) {
        company = parts[1];
        companyVia = 'document.title';
      }
    }
    // Last resort: the page's own declared site name.
    if (!company) {
      const meta =
        document.querySelector('meta[property="og:site_name"]') ||
        document.querySelector('meta[name="application-name"]');
      const name = (meta && meta.getAttribute('content') || '').trim();
      if (name && name.length < 120 && !/linkedin|indeed|glassdoor|greenhouse|lever|ashby|workday/i.test(name)) {
        company = name;
        companyVia = 'meta';
      }
    }
  }

  // ── Description ───────────────────────────────────────────────────────────
  // Two tiers. `article` and `main` are almost always the longest match on any
  // page, so mixing them in with the specific selectors meant they won on every
  // list-plus-detail layout — on a LinkedIn search page `main` is the whole
  // left-hand rail of other postings plus the one being viewed, which is how
  // unrelated jobs ended up in the description.
  //
  // The escalation threshold is deliberately LOW (120 chars, not the 400 one
  // of these copies used). 400 meant that a genuinely terse posting found in
  // its own named container was discarded in favour of `main` — which on a
  // list-plus-detail layout is the detail pane PLUS the rail of other
  // postings PLUS the page header. A short description from `#job-details` is
  // still the description; a long one from `main` is the whole page.
  const ENOUGH = 120;
  let descHit = longestOf(site.description);
  if (descHit.text.length < ENOUGH && site.name !== 'generic') {
    const genericHit = longestOf(generic.description);
    if (genericHit.text.length > descHit.text.length) descHit = genericHit;
  }
  if (descHit.text.length < ENOUGH) {
    const looseHit = longestOf(['[class*="description"]', '.posting-page', '.section-wrapper', '#content', '.content-wrapper']);
    if (looseHit.text.length > descHit.text.length) descHit = looseHit;
  }
  if (descHit.text.length < ENOUGH) {
    const wideHit = longestOf(['article', 'main']);
    if (wideHit.text.length > descHit.text.length) descHit = wideHit;
  }

  let description = descHit.text;
  let descVia = descHit.via;
  if (description.trim().length < 100) {
    description = readText(document.body).slice(0, 8000);
    descVia = 'body';
  }

  // ── Location, best effort ─────────────────────────────────────────────────
  const locationHit = firstMatch(
    [
      '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
      '.jobs-unified-top-card__bullet',
      '.topcard__flavor--bullet',
      '[data-automation-id="locations"]',
      '[class*="location"]',
    ],
    120
  );

  return {
    title,
    company,
    description,
    location: locationHit.text,
    site: site.name,
    via: { title: titleVia, company: companyVia, description: descVia },
  };
}

/**
 * How much to trust a scrape, for choosing between two of them.
 *
 * The old merge compared description lengths and then took the OTHER source's
 * title, so a longer description could drag a worse title along with it. Fields
 * are scored and chosen independently now.
 */
export function scrapeQuality(job: Partial<ScrapedJob> | null | undefined) {
  const descLen = (job?.description || '').trim().length;
  const via = job?.via || ({} as ScrapedJob['via']);
  return {
    descLen,
    // A title from a named posting element beats one inferred from the page
    // heading or the browser tab.
    titleRank: !job?.title ? 0 : via.title === 'document.title' ? 1 : via.title === 'h1' ? 2 : 3,
    companyRank: !job?.company ? 0 : via.company === 'document.title' ? 1 : 3,
    // A description scraped from `body`/`main` is a last resort, not a win.
    descRank: descLen < 100 ? 0 : via.description === 'body' ? 1 : via.description === 'main' || via.description === 'article' ? 2 : 3,
  };
}

/**
 * Merge two scrapes of the SAME page, field by field.
 *
 * Each field is decided on its own evidence: titles on how specific the
 * selector was, descriptions on rank first and length second. Nothing about one
 * field can decide another.
 */
export function mergeScrapes(
  a: Partial<ScrapedJob> | null | undefined,
  b: Partial<ScrapedJob> | null | undefined
): Partial<ScrapedJob> {
  if (!a) return b || {};
  if (!b) return a || {};
  const qa = scrapeQuality(a);
  const qb = scrapeQuality(b);

  const pickTitle = qb.titleRank > qa.titleRank ? b : a;
  const pickCompany = qb.companyRank > qa.companyRank ? b : a;
  const pickDesc =
    qb.descRank > qa.descRank || (qb.descRank === qa.descRank && qb.descLen > qa.descLen) ? b : a;

  return {
    title: pickTitle.title || a.title || b.title || '',
    company: pickCompany.company || a.company || b.company || '',
    description: pickDesc.description || a.description || b.description || '',
    location: a.location || b.location || '',
    site: a.site || b.site,
    via: {
      title: (pickTitle.via && pickTitle.via.title) || '',
      company: (pickCompany.via && pickCompany.via.company) || '',
      description: (pickDesc.via && pickDesc.via.description) || '',
    },
  };
}
