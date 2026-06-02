const { Op } = require('sequelize');
const { ExternalJob, ATSBoard } = require('../models');

// Lazy-load job embedding service (only when OPENAI_API_KEY is set)
let jobEmbeddingService = null;
function getJobEmbeddingService() {
  if (!jobEmbeddingService && process.env.OPENAI_API_KEY) {
    jobEmbeddingService = require('./jobEmbeddingService');
  }
  return jobEmbeddingService;
}

// Staleness threshold in minutes — boards older than this get re-fetched on demand.
// Cron worker runs full sync every 15 minutes; anything past 30 min means cron is
// lagging or the board is new, and refreshIfStale acts as a safety net.
const STALE_THRESHOLD_MINUTES = 30;

// In-flight tracker: prevents the same board from being synced concurrently when
// multiple user requests trigger refreshIfStale at the same time. Without this,
// a single page load on /jobs could fan out to N parallel syncs of the same
// board (one per row in the result set), each holding a DB connection and
// burning event-loop time. Cleared by the syncBoard promise's finally handler.
const _inFlightBoardSyncs = new Set();

// Global concurrency cap for user-request-driven background refreshes. The cron
// worker is the primary path for keeping data fresh; refreshIfStale is just a
// fallback. Capping at 2 means even under burst load (e.g. 100 concurrent
// /jobs requests hitting 6 different boards each), at most 2 boards will sync
// at once, leaving DB pool capacity for actual user queries.
const REFRESH_CONCURRENCY_CAP = 2;
let _activeRefreshCount = 0;

// Overlap guard for the full cron sweep (syncAllBoards). A sweep can exceed
// the 15-min cron interval, so without this a second tick would start a
// concurrent sweep. Module-scoped boolean toggled in syncAllBoards' finally.
let _fullSyncInProgress = false;

/**
 * Fetch jobs from Greenhouse Job Board API (public, no auth required)
 * API: GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
 */
async function fetchGreenhouseJobs(boardToken) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`Greenhouse API error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const jobs = data.jobs || [];

  return jobs.map(job => normalizeGreenhouseJob(job, boardToken));
}

/**
 * Normalize a Greenhouse job to our ExternalJob schema
 */
function normalizeGreenhouseJob(job, boardToken) {
  const departments = (job.departments || []).map(d => d.name).join(', ');
  const offices = (job.offices || []).map(o => o.name).join(', ');
  const location = job.location?.name || offices || null;

  // Try to extract employment type and level from metadata
  let employmentType = null;
  let experienceLevel = null;
  if (job.metadata) {
    for (const meta of job.metadata) {
      const name = (meta.name || '').toLowerCase();
      if (name.includes('employment') || name.includes('type')) {
        employmentType = normalizeEmploymentType(meta.value);
      }
      if (name.includes('level') || name.includes('seniority') || name.includes('experience')) {
        experienceLevel = normalizeExperienceLevel(meta.value);
      }
    }
  }

  return {
    externalId: String(job.id),
    source: 'greenhouse',
    boardToken,
    title: job.title,
    company: boardToken, // Will be enriched from ATSBoard.name
    location,
    locationType: inferLocationType(location, job.title),
    employmentType,
    experienceLevel: experienceLevel || inferExperienceLevel(job.title),
    department: departments || null,
    description: stripHtml(job.content || ''),
    descriptionHtml: decodeHtmlEntities(job.content || ''),
    requirements: null,
    skills: [],
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'USD',
    salaryPeriod: null,
    applyUrl: job.absolute_url || null,
    sourceUrl: job.absolute_url || null,
    // Greenhouse's public board API only exposes `updated_at` — there is no
    // true `first_published` field. In practice `updated_at` is set when the
    // job is posted and then again whenever the requisition is edited. It's
    // imperfect (a stale job will look "fresh" right after an edit) but it's
    // far better than the previous behavior of leaving postedAt NULL and
    // having every job from a single cron sweep show the same crawl time.
    // The UI labels this as "Posted" — for the small fraction of jobs that
    // were recently edited, that label slightly overstates freshness.
    postedAt: job.updated_at ? new Date(job.updated_at) : null,
    isActive: true,
    lastFetchedAt: new Date(),
    metadata: {
      internal_job_id: job.internal_job_id,
      requisition_id: job.requisition_id,
      departments: job.departments,
      offices: job.offices,
      metadata: job.metadata,
      language: job.language
    }
  };
}

/**
 * Fetch jobs from RemoteOK API (public, no auth required)
 * API: GET https://remoteok.com/api
 */
async function fetchRemoteOKJobs() {
  const url = 'https://remoteok.com/api';
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ProfilleAI/1.0 (job-aggregator)'
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`RemoteOK API error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  // First element is metadata/legal notice, rest are jobs
  const jobs = Array.isArray(data) ? data.filter(j => j.id && j.position) : [];

  return jobs.map(job => normalizeRemoteOKJob(job));
}

/**
 * Normalize a RemoteOK job to our ExternalJob schema
 */
function normalizeRemoteOKJob(job) {
  const tags = Array.isArray(job.tags) ? job.tags : [];

  return {
    externalId: String(job.id),
    source: 'remoteok',
    boardToken: 'remoteok',
    title: job.position || job.slug || 'Untitled',
    company: job.company || 'Unknown',
    location: job.location || 'Remote',
    locationType: 'remote',
    employmentType: normalizeEmploymentType(job.type) || 'full-time',
    experienceLevel: inferExperienceLevel(job.position),
    department: null,
    description: job.description ? stripHtml(job.description) : null,
    descriptionHtml: job.description || null,
    requirements: null,
    skills: tags,
    salaryMin: job.salary_min ? parseInt(job.salary_min) : null,
    salaryMax: job.salary_max ? parseInt(job.salary_max) : null,
    salaryCurrency: 'USD',
    salaryPeriod: (job.salary_min || job.salary_max) ? 'yearly' : null,
    applyUrl: job.url || job.apply_url || null,
    sourceUrl: job.url ? `https://remoteok.com${job.url}` : null,
    postedAt: job.epoch ? new Date(job.epoch * 1000) : (job.date ? new Date(job.date) : null),
    isActive: true,
    lastFetchedAt: new Date(),
    metadata: {
      slug: job.slug,
      tags,
      company_logo: job.company_logo,
      original: job.original
    }
  };
}

/**
 * Fetch jobs from Adzuna API (requires app_id + app_key)
 * API: GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
 * Set ADZUNA_APP_ID and ADZUNA_APP_KEY in .env
 */
async function fetchAdzunaJobs(countryCode = 'us', pages = 3) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    throw new Error('Adzuna API keys not configured. Set ADZUNA_APP_ID and ADZUNA_APP_KEY in .env');
  }

  const allJobs = [];
  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: '50',
      what: 'software engineer developer designer',
      'content-type': 'application/json'
    });
    const url = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(countryCode)}/search/${page}?${params}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`Adzuna API error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.results || [];
    allJobs.push(...results.map(job => normalizeAdzunaJob(job, countryCode)));

    // Stop if we got fewer results than requested (last page)
    if (results.length < 50) break;
    // Rate-limit courtesy
    await sleep(500);
  }

  return allJobs;
}

/**
 * Normalize an Adzuna job to our ExternalJob schema
 */
function normalizeAdzunaJob(job, countryCode) {
  let employmentType = null;
  if (job.contract_time === 'full_time') employmentType = 'full-time';
  else if (job.contract_time === 'part_time') employmentType = 'part-time';
  if (job.contract_type === 'contract') employmentType = 'contract';

  const location = job.location?.display_name || null;

  return {
    externalId: String(job.id),
    source: 'adzuna',
    boardToken: countryCode,
    title: job.title || 'Untitled',
    company: job.company?.display_name || 'Unknown',
    location,
    locationType: inferLocationType(location, job.title),
    employmentType,
    experienceLevel: inferExperienceLevel(job.title),
    department: job.category?.label || null,
    description: job.description ? stripHtml(job.description) : null,
    descriptionHtml: null,
    requirements: null,
    skills: [],
    salaryMin: job.salary_min ? Math.round(job.salary_min) : null,
    salaryMax: job.salary_max ? Math.round(job.salary_max) : null,
    salaryCurrency: countryCode === 'gb' ? 'GBP' : (countryCode === 'ca' ? 'CAD' : 'USD'),
    salaryPeriod: (job.salary_min || job.salary_max) ? 'yearly' : null,
    applyUrl: job.redirect_url || null,
    sourceUrl: job.redirect_url || null,
    postedAt: job.created ? new Date(job.created) : null,
    isActive: true,
    lastFetchedAt: new Date(),
    metadata: {
      category: job.category,
      contract_time: job.contract_time,
      contract_type: job.contract_type,
      latitude: job.latitude,
      longitude: job.longitude
    }
  };
}

/**
 * Fetch jobs from JSearch (RapidAPI) — Google Jobs aggregator
 * Aggregates LinkedIn, Indeed, Glassdoor, ZipRecruiter, and all public job sites
 * API: GET https://jsearch.p.rapidapi.com/search
 * Set RAPIDAPI_KEY in .env
 */
async function fetchJSearchJobs(query = 'software engineer', { pages = 3, country = 'us', datePosted = 'week' } = {}) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RapidAPI key not configured. Set RAPIDAPI_KEY in .env');
  }

  const allJobs = [];
  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({
      query: `${query} in United States`,
      page: String(page),
      num_pages: '1',
      country,
      date_posted: datePosted,
    });
    const url = `https://jsearch.p.rapidapi.com/search?${params}`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(30000)
    });

    if (response.status === 429) {
      console.warn('[JSearch] Rate limited, stopping pagination');
      break;
    }
    if (response.status === 403) {
      throw new Error('Invalid or unsubscribed RapidAPI key. Subscribe to JSearch on RapidAPI.');
    }
    if (!response.ok) {
      throw new Error(`JSearch API error ${response.status}: ${response.statusText}`);
    }

    const body = await response.json();
    if (body.status !== 'OK' || !Array.isArray(body.data)) {
      console.warn('[JSearch] Unexpected response:', body.status, body.error?.message);
      break;
    }

    allJobs.push(...body.data.map(job => normalizeJSearchJob(job)));

    if (body.data.length < 10) break; // Last page
    // Rate-limit courtesy (free plan = 1 req/sec)
    await sleep(1200);
  }

  return allJobs;
}

/**
 * Normalize a JSearch job to our ExternalJob schema
 */
function normalizeJSearchJob(job) {
  // JSearch returns rich data including employer, location, salary, etc.
  const isRemote = job.job_is_remote === true;
  const location = job.job_city && job.job_state
    ? `${job.job_city}, ${job.job_state}`
    : (job.job_city || job.job_state || (isRemote ? 'Remote' : null));

  // Parse employment type
  let employmentType = null;
  const jType = (job.job_employment_type || '').toUpperCase();
  if (jType === 'FULLTIME') employmentType = 'full-time';
  else if (jType === 'PARTTIME') employmentType = 'part-time';
  else if (jType === 'CONTRACTOR' || jType === 'CONTRACT') employmentType = 'contract';
  else if (jType === 'INTERN') employmentType = 'internship';

  // Salary — JSearch provides min/max salary
  const salaryMin = job.job_min_salary ? Math.round(job.job_min_salary) : null;
  const salaryMax = job.job_max_salary ? Math.round(job.job_max_salary) : null;
  const salaryPeriod = job.job_salary_period || (salaryMin || salaryMax ? 'yearly' : null);
  const salaryCurrency = job.job_salary_currency || 'USD';

  // Skills from highlights
  const skills = [];
  if (job.job_highlights?.Qualifications) {
    // Extract short skill-like items (< 50 chars)
    for (const q of job.job_highlights.Qualifications) {
      if (q.length < 50) skills.push(q);
    }
  }

  // Build a clean description from highlights if available
  let description = job.job_description || '';
  if (description.length > 5000) {
    description = description.substring(0, 5000) + '...';
  }

  return {
    externalId: job.job_id || String(Date.now() + Math.random()),
    source: 'jsearch',
    boardToken: 'jsearch-us',
    title: job.job_title || 'Untitled',
    company: job.employer_name || 'Unknown',
    location,
    locationType: isRemote ? 'remote' : inferLocationType(location, job.job_title),
    employmentType,
    experienceLevel: job.job_required_experience?.required_experience_in_months
      ? (job.job_required_experience.required_experience_in_months >= 96 ? 'senior'
        : job.job_required_experience.required_experience_in_months >= 36 ? 'mid'
        : 'entry')
      : inferExperienceLevel(job.job_title),
    department: null,
    description: stripHtml(description),
    descriptionHtml: job.job_description || null,
    requirements: job.job_highlights?.Qualifications?.join('\n') || null,
    skills: skills.slice(0, 15),
    salaryMin,
    salaryMax,
    salaryCurrency,
    salaryPeriod,
    applyUrl: job.job_apply_link || null,
    sourceUrl: job.job_google_link || job.job_apply_link || null,
    postedAt: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : null,
    isActive: !(job.job_is_expired === true),
    lastFetchedAt: new Date(),
    metadata: {
      employer_logo: job.employer_logo,
      employer_website: job.employer_website,
      publisher: job.job_publisher,
      job_benefits: job.job_highlights?.Benefits || [],
      job_responsibilities: job.job_highlights?.Responsibilities || [],
      apply_options: job.apply_options?.map(o => ({ publisher: o.publisher, url: o.apply_link })) || [],
      required_experience: job.job_required_experience,
      required_education: job.job_required_education,
      job_offer_expiration: job.job_offer_expiration_datetime_utc,
    }
  };
}

/**
 * Fetch jobs from TheirStack API — largest job + technographic database
 * API: POST https://api.theirstack.com/v1/jobs/search
 * Set THEIRSTACK_API_KEY in .env
 * Consumes 1 API credit per job returned.
 */
async function fetchTheirStackJobs(searchConfig = {}) {
  const apiKey = process.env.THEIRSTACK_API_KEY;
  if (!apiKey) {
    throw new Error('TheirStack API key not configured. Set THEIRSTACK_API_KEY in .env');
  }

  const {
    jobTitles = ['software engineer'],
    country = 'US',
    maxAgeDays = 7,
    limit = 25,
    pages = 2,
  } = searchConfig;

  const allJobs = [];
  for (let page = 0; page < pages; page++) {
    const body = {
      job_title_or: jobTitles,
      job_country_code_or: [country],
      posted_at_max_age_days: maxAgeDays,
      limit,
      page,
      order_by: [{ desc: true, field: 'date_posted' }],
    };

    const response = await fetch('https://api.theirstack.com/v1/jobs/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (response.status === 402) {
      console.warn('[TheirStack] Out of API credits, stopping');
      break;
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid TheirStack API key. Check THEIRSTACK_API_KEY in .env');
    }
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`TheirStack API error ${response.status}: ${errText.substring(0, 200)}`);
    }

    const result = await response.json();
    const jobs = result.data || [];
    allJobs.push(...jobs.map(job => normalizeTheirStackJob(job)));

    if (jobs.length < limit) break; // Last page
    // Rate-limit courtesy
    await sleep(500);
  }

  return allJobs;
}

/**
 * Normalize a TheirStack job to our ExternalJob schema
 */
function normalizeTheirStackJob(job) {
  // Location
  const location = job.short_location || job.location || job.long_location || null;
  let locationType = 'onsite';
  if (job.remote) locationType = 'remote';
  else if (job.hybrid) locationType = 'hybrid';

  // Employment type
  let employmentType = null;
  const statuses = job.employment_statuses || [];
  if (statuses.includes('full_time')) employmentType = 'full-time';
  else if (statuses.includes('part_time')) employmentType = 'part-time';
  else if (statuses.includes('contract')) employmentType = 'contract';
  else if (statuses.includes('internship')) employmentType = 'internship';
  else if (statuses.includes('temporary')) employmentType = 'contract';

  // Experience level mapping
  let experienceLevel = null;
  const seniority = (job.seniority || '').toLowerCase();
  if (seniority === 'junior') experienceLevel = 'entry';
  else if (seniority === 'mid_level') experienceLevel = 'mid';
  else if (seniority === 'senior' || seniority === 'staff') experienceLevel = 'senior';
  else if (seniority === 'c_level') experienceLevel = 'executive';
  else experienceLevel = inferExperienceLevel(job.job_title);

  // Salary
  const salaryMin = job.min_annual_salary_usd ? Math.round(job.min_annual_salary_usd) : null;
  const salaryMax = job.max_annual_salary_usd ? Math.round(job.max_annual_salary_usd) : null;

  // Skills from technology slugs
  const skills = (job.technology_slugs || []).slice(0, 15);

  // Company info
  const companyObj = job.company_object || {};
  const company = job.company || companyObj.name || 'Unknown';

  // Description
  let description = job.description || '';
  if (description.length > 5000) {
    description = description.substring(0, 5000) + '...';
  }

  return {
    externalId: String(job.id),
    source: 'theirstack',
    boardToken: 'theirstack-us',
    title: job.job_title || 'Untitled',
    company,
    location,
    locationType,
    employmentType,
    experienceLevel,
    department: null,
    description: stripHtml(description),
    descriptionHtml: description,
    requirements: null,
    skills,
    salaryMin,
    salaryMax,
    salaryCurrency: job.salary_currency || 'USD',
    salaryPeriod: (salaryMin || salaryMax) ? 'yearly' : null,
    applyUrl: job.final_url || job.url || null,
    sourceUrl: job.source_url || job.url || null,
    postedAt: job.date_posted ? new Date(job.date_posted) : null,
    isActive: true,
    lastFetchedAt: new Date(),
    metadata: {
      company_domain: companyObj.domain || job.company_domain,
      company_logo: companyObj.logo,
      company_industry: companyObj.industry,
      company_employee_count: companyObj.employee_count,
      company_linkedin_url: companyObj.linkedin_url,
      company_funding_stage: companyObj.funding_stage,
      company_revenue: companyObj.annual_revenue_usd_readable,
      hiring_team: job.hiring_team,
      seniority: job.seniority,
      technology_slugs: job.technology_slugs,
      keyword_slugs: job.keyword_slugs,
      cities: job.cities,
      country_code: job.country_code,
      easy_apply: job.easy_apply,
      reposted: job.reposted,
      date_reposted: job.date_reposted,
      salary_string: job.salary_string,
      normalized_title: job.normalized_title,
    }
  };
}

/**
 * Fetch jobs from Lever public API (no auth required)
 * API: GET https://api.lever.co/v0/postings/{company}
 */
async function fetchLeverJobs(companySlug) {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(companySlug)}?mode=json`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30000)
  });

  if (response.status === 404) {
    throw new Error(`Lever board not found: ${companySlug}`);
  }
  if (!response.ok) {
    throw new Error(`Lever API error ${response.status}: ${response.statusText}`);
  }

  const jobs = await response.json();
  if (!Array.isArray(jobs)) return [];

  return jobs.map(job => normalizeLeverJob(job, companySlug));
}

/**
 * Normalize a Lever job to our ExternalJob schema
 */
function normalizeLeverJob(job, companySlug) {
  const categories = job.categories || {};
  const location = categories.location || job.workplaceType || null;
  const department = categories.department || categories.team || null;
  const commitment = categories.commitment || null; // "Full-time", "Part-time", etc.
  const level = categories.level || null;

  // Workplace type
  let locationType = 'onsite';
  const wt = (job.workplaceType || '').toLowerCase();
  if (wt === 'remote') locationType = 'remote';
  else if (wt === 'hybrid' || wt === 'unspecified') locationType = inferLocationType(location, job.text);
  else locationType = inferLocationType(location, job.text);

  // Lists (requirements-like sections from the description)
  let descriptionHtml = job.descriptionPlain || '';
  const descLists = job.lists || [];
  if (descLists.length > 0) {
    descriptionHtml = (job.descriptionPlain || '') + '\n\n' +
      descLists.map(l => `${l.text}\n${l.content}`).join('\n\n');
  }

  // Additional content for description enrichment
  const additionalPlain = job.additionalPlain || '';

  return {
    externalId: job.id,
    source: 'lever',
    boardToken: companySlug,
    title: job.text || 'Untitled',
    company: companySlug, // Will be enriched from ATSBoard.name
    location,
    locationType,
    employmentType: normalizeEmploymentType(commitment),
    experienceLevel: normalizeExperienceLevel(level) || inferExperienceLevel(job.text),
    department,
    description: stripHtml(descriptionHtml + '\n' + additionalPlain),
    descriptionHtml: job.description || descriptionHtml,
    requirements: descLists.filter(l => {
      const t = (l.text || '').toLowerCase();
      return t.includes('requirement') || t.includes('qualification') || t.includes('must have');
    }).map(l => stripHtml(l.content)).join('\n') || null,
    skills: [],
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'USD',
    salaryPeriod: null,
    applyUrl: job.applyUrl || job.hostedUrl || null,
    sourceUrl: job.hostedUrl || null,
    postedAt: job.createdAt ? new Date(job.createdAt) : null,
    isActive: true,
    lastFetchedAt: new Date(),
    metadata: {
      categories,
      workplaceType: job.workplaceType,
      lists: descLists.map(l => ({ text: l.text })),
      salaryDescription: job.salaryDescription || null,
      salaryRange: job.salaryRange || null,
    }
  };
}

/**
 * Fetch jobs from Ashby public API (no auth required)
 * API: POST https://api.ashbyhq.com/posting-api/job-board/{org_slug}
 */
async function fetchAshbyJobs(orgSlug) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(orgSlug)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30000)
  });

  if (response.status === 404) {
    throw new Error(`Ashby board not found: ${orgSlug}`);
  }
  if (!response.ok) {
    throw new Error(`Ashby API error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const jobs = data.jobs || [];

  return jobs.map(job => normalizeAshbyJob(job, orgSlug));
}

/**
 * Normalize an Ashby job to our ExternalJob schema
 */
function normalizeAshbyJob(job, orgSlug) {
  const location = job.location || job.secondaryLocations?.join(', ') || null;
  const department = job.departmentName || job.department || null;
  const team = job.teamName || job.team || null;

  let locationType = 'onsite';
  if (job.isRemote) locationType = 'remote';
  else locationType = inferLocationType(location, job.title);

  // Employment type from commitment field
  const commitment = job.employmentType || job.commitment || null;

  return {
    externalId: job.id,
    source: 'ashby',
    boardToken: orgSlug,
    title: job.title || 'Untitled',
    company: orgSlug, // Will be enriched from ATSBoard.name
    location,
    locationType,
    employmentType: normalizeEmploymentType(commitment),
    experienceLevel: inferExperienceLevel(job.title),
    department: department || team || null,
    description: job.descriptionPlain || stripHtml(job.descriptionHtml || ''),
    descriptionHtml: job.descriptionHtml || null,
    requirements: null,
    skills: [],
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'USD',
    salaryPeriod: null,
    applyUrl: job.jobUrl || `https://jobs.ashbyhq.com/${orgSlug}/${job.id}`,
    sourceUrl: job.jobUrl || `https://jobs.ashbyhq.com/${orgSlug}/${job.id}`,
    postedAt: job.publishedDate ? new Date(job.publishedDate) : (job.updatedAt ? new Date(job.updatedAt) : null),
    isActive: true,
    lastFetchedAt: new Date(),
    metadata: {
      team: team,
      isRemote: job.isRemote,
      secondaryLocations: job.secondaryLocations,
      compensation: job.compensation || null,
    }
  };
}

/**
 * Fetch jobs from We Work Remotely RSS feeds
 * Parses RSS XML into structured job data.
 * boardToken format: category slug (e.g., "programming", "design", "devops-sysadmin")
 */
async function fetchWWRJobs(category = 'programming') {
  const url = `https://weworkremotely.com/categories/remote-${encodeURIComponent(category)}-jobs.rss`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`WWR RSS error ${response.status}: ${response.statusText}`);
  }

  const xml = await response.text();
  const jobs = parseRSSItems(xml);

  return jobs.map(item => normalizeWWRJob(item, category));
}

/**
 * Simple RSS XML parser — extracts <item> elements into objects.
 * No external dependency needed.
 */
function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const get = (tag) => {
      const tagMatch = itemXml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
        || itemXml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return tagMatch ? tagMatch[1].trim() : null;
    };

    items.push({
      title: get('title'),
      link: get('link'),
      description: get('description'),
      pubDate: get('pubDate'),
      guid: get('guid'),
      category: get('category'),
      region: get('region'),
    });
  }

  return items;
}

/**
 * Normalize a We Work Remotely RSS item to our ExternalJob schema
 */
function normalizeWWRJob(item, category) {
  // WWR titles are typically "Company Name: Job Title"
  let company = 'Unknown';
  let title = item.title || 'Untitled';
  const colonIdx = title.indexOf(':');
  if (colonIdx > 0 && colonIdx < title.length - 1) {
    company = title.substring(0, colonIdx).trim();
    title = title.substring(colonIdx + 1).trim();
  }

  // Generate stable external ID from link/guid
  const externalId = item.guid || item.link || `wwr-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    externalId: String(externalId),
    source: 'wwr',
    boardToken: category,
    title,
    company,
    location: item.region || 'Remote',
    locationType: 'remote',
    employmentType: 'full-time',
    experienceLevel: inferExperienceLevel(title),
    department: category,
    description: item.description ? stripHtml(item.description) : null,
    descriptionHtml: item.description || null,
    requirements: null,
    skills: [],
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'USD',
    salaryPeriod: null,
    applyUrl: item.link || null,
    sourceUrl: item.link || null,
    postedAt: item.pubDate ? new Date(item.pubDate) : null,
    isActive: true,
    lastFetchedAt: new Date(),
    metadata: {
      category: item.category || category,
      region: item.region,
    }
  };
}

/**
 * Fetch jobs from Amazon Jobs public API (no auth required)
 * API: GET https://www.amazon.jobs/en/search.json?category[]={category}&result_limit=100
 * boardToken format: category slug, e.g. "software-development", "data-science"
 */
async function fetchAmazonJobs(category = 'software-development', { pages = 5, resultLimit = 100 } = {}) {
  const allJobs = [];
  let offset = 0;

  for (let page = 0; page < pages; page++) {
    const params = new URLSearchParams({
      'result_limit': String(resultLimit),
      offset: String(offset),
    });
    // category[] needs special handling (URLSearchParams encodes [] wrongly for some servers)
    const url = `https://www.amazon.jobs/en/search.json?category[]=${encodeURIComponent(category)}&${params}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ProfilleAI/1.0 (job-aggregator)',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Amazon Jobs API error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const jobs = data.jobs || [];

    if (jobs.length === 0) break;

    allJobs.push(...jobs.map(job => normalizeAmazonJob(job, category)));
    offset += jobs.length;

    // Stop if we got fewer than requested (last page)
    if (jobs.length < resultLimit) break;
    // Rate-limit courtesy
    await sleep(500);
  }

  return allJobs;
}

/**
 * Normalize an Amazon Jobs API response to our ExternalJob schema
 */
function normalizeAmazonJob(job, category) {
  // Location
  const city = job.city || '';
  const state = job.state || '';
  const country = job.country_code || '';
  let location = [city, state].filter(Boolean).join(', ');
  if (!location && country) location = country;
  if (!location) location = null;

  // Determine location type from location data
  const locationType = inferLocationType(location, job.title);

  // Employment type from schedule
  const schedule = (job.job_schedule_type || '').toLowerCase();
  let employmentType = 'full-time';
  if (schedule.includes('part')) employmentType = 'part-time';
  else if (schedule.includes('contract') || schedule.includes('temp')) employmentType = 'contract';
  else if (schedule.includes('intern')) employmentType = 'internship';

  // Build description from multiple fields
  const descParts = [];
  if (job.description) descParts.push(job.description);
  if (job.basic_qualifications) descParts.push(`<h3>Basic Qualifications</h3>\n${job.basic_qualifications}`);
  if (job.preferred_qualifications) descParts.push(`<h3>Preferred Qualifications</h3>\n${job.preferred_qualifications}`);
  const descriptionHtml = descParts.join('\n\n');

  return {
    externalId: String(job.id_icims || job.id || `amazon-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    source: 'amazon',
    boardToken: category,
    title: job.title || 'Untitled',
    company: 'Amazon',
    location,
    locationType,
    employmentType,
    experienceLevel: inferExperienceLevel(job.title),
    department: job.job_category || category || null,
    description: stripHtml(descriptionHtml),
    descriptionHtml,
    requirements: job.basic_qualifications ? stripHtml(job.basic_qualifications) : null,
    skills: [],
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'USD',
    salaryPeriod: null,
    // Prefer the public amazon.jobs job page over Amazon's account.amazon.com
    // apply redirect: the latter requires an authenticated session and isn't
    // reachable via a headless browser, which breaks the auto-submit flow.
    applyUrl: job.job_path ? `https://www.amazon.jobs${job.job_path}` : null,
    sourceUrl: job.job_path ? `https://www.amazon.jobs${job.job_path}` : null,
    postedAt: job.posted_date ? new Date(job.posted_date) : null,
    isActive: true,
    lastFetchedAt: new Date(),
    metadata: {
      id_icims: job.id_icims,
      team: job.team?.name || job.business_category,
      business_category: job.business_category,
      company_name: job.company_name,
      country_code: job.country_code,
      state: job.state,
      preferred_qualifications: job.preferred_qualifications ? stripHtml(job.preferred_qualifications) : null,
      job_schedule_type: job.job_schedule_type,
      job_category: job.job_category,
    }
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Hacker News "Who's Hiring" — monthly thread, ~400-900 startup roles each.
// boardToken format:
//   "monthly"           — auto-detect latest "Ask HN: Who is hiring?" thread
//   "thread:<itemId>"   — pin to a specific thread (useful for backfill)
// ───────────────────────────────────────────────────────────────────────────

const HN_HIRING_AUTHOR = 'whoishiring';

/**
 * Fetch jobs from the latest (or specified) HN "Who is hiring?" thread.
 * Algolia HN APIs are public and free — no key, no rate limit worth caring
 * about for monthly use.
 */
async function fetchHackerNewsHiringJobs(boardToken = 'monthly') {
  const { parseCommentHybrid, htmlToText } = require('./hnHiringParser');

  // 1. Resolve which thread to read.
  let threadId;
  if (boardToken && boardToken.startsWith('thread:')) {
    threadId = boardToken.slice('thread:'.length).trim();
  } else {
    threadId = await findLatestHiringThreadId();
  }
  if (!threadId) {
    throw new Error('Could not locate an HN "Who is hiring?" thread');
  }

  // 2. Pull the thread tree in one shot.
  const itemUrl = `https://hn.algolia.com/api/v1/items/${encodeURIComponent(threadId)}`;
  const itemRes = await fetch(itemUrl, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30000)
  });
  if (!itemRes.ok) {
    throw new Error(`HN Algolia items API error ${itemRes.status}: ${itemRes.statusText}`);
  }
  const thread = await itemRes.json();

  // The Algolia items endpoint returns the full nested tree.
  // Top-level postings are direct children with non-empty text.
  const topLevelComments = (thread.children || []).filter(c => c && c.text);

  console.log(`[HNHiring] Parsing ${topLevelComments.length} top-level comments from thread ${threadId} (${thread.title})`);

  const jobs = [];
  let regexHits = 0;
  let llmHits = 0;
  let skipped = 0;

  // Parse sequentially — keeps Anthropic / Algolia rate limits comfortable
  // and the monthly cadence makes throughput a non-issue.
  for (const comment of topLevelComments) {
    let parsed;
    try {
      parsed = await parseCommentHybrid(comment.text);
    } catch (err) {
      console.warn(`[HNHiring] parseCommentHybrid failed for comment ${comment.id}:`, err.message);
      parsed = null;
    }
    if (!parsed) { skipped++; continue; }
    if (parsed.method === 'llm') llmHits++; else regexHits++;

    const postedAt = comment.created_at_i ? new Date(comment.created_at_i * 1000)
                    : (comment.created_at ? new Date(comment.created_at) : null);

    jobs.push({
      // Compose a stable per-comment ID so reruns dedupe via (source, externalId).
      externalId: `hn-${threadId}-${comment.id}`,
      source: 'hn_hiring',
      boardToken,
      title: parsed.title,
      company: parsed.company,
      location: parsed.location,
      locationType: parsed.locationType,
      employmentType: parsed.employmentType,
      experienceLevel: parsed.experienceLevel,
      department: null,
      description: parsed.description || htmlToText(comment.text),
      descriptionHtml: comment.text,
      requirements: null,
      skills: [],
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: 'USD',
      salaryPeriod: null,
      // Apply URL is whatever the post offered; otherwise deep-link back to
      // the comment on news.ycombinator.com so the user can read full context.
      applyUrl: parsed.applyUrl || `https://news.ycombinator.com/item?id=${comment.id}`,
      sourceUrl: `https://news.ycombinator.com/item?id=${comment.id}`,
      postedAt,
      isActive: true,
      lastFetchedAt: new Date(),
      metadata: {
        thread_id: threadId,
        thread_title: thread.title || null,
        comment_id: comment.id,
        author: comment.author || null,
        visa_sponsorship: parsed.visaSponsorship || null,
        parser: parsed.method
      }
    });
  }

  console.log(`[HNHiring] Parsed ${jobs.length}/${topLevelComments.length} (regex: ${regexHits}, llm: ${llmHits}, skipped: ${skipped})`);
  return jobs;
}

/**
 * Resolve the latest HN "Who is hiring?" thread by querying Algolia for
 * stories authored by `whoishiring`.
 */
async function findLatestHiringThreadId() {
  const url = `https://hn.algolia.com/api/v1/search_by_date?author=${HN_HIRING_AUTHOR}&tags=story&hitsPerPage=10`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    throw new Error(`HN Algolia search error ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  // Filter to "Ask HN: Who is hiring?" specifically — the same account also
  // posts "Who wants to be hired?" and "Freelancer? Seeking freelancer?".
  const hiring = (data.hits || []).filter(h =>
    /who\s+is\s+hiring/i.test(h.title || '') && !/freelancer|wants?\s+to\s+be\s+hired/i.test(h.title || '')
  );
  return hiring[0]?.objectID || null;
}

/**
 * Parse a TheirStack boardToken into search config.
 * Format: "title1,title2" or "title1,title2::pages" or "title1,title2::pages::country"
 */
function parseTheirStackBoardToken(boardToken) {
  const parts = boardToken.split('::');
  const titles = (parts[0] || 'software engineer').split(',').map(t => t.trim());
  const pages = parseInt(parts[1]) || 2;
  const country = parts[2] || 'US';
  return { jobTitles: titles, pages, country };
}

/**
 * Sync a single ATS board — fetch jobs and upsert into DB
 */
async function syncBoard(atsBoard) {
  const startTime = Date.now();
  console.log(`[ExternalJobs] Syncing board: ${atsBoard.name} (${atsBoard.platform}/${atsBoard.boardToken})`);

  try {
    let normalizedJobs;
    if (atsBoard.platform === 'greenhouse') {
      normalizedJobs = await fetchGreenhouseJobs(atsBoard.boardToken);
    } else if (atsBoard.platform === 'lever') {
      normalizedJobs = await fetchLeverJobs(atsBoard.boardToken);
    } else if (atsBoard.platform === 'ashby') {
      normalizedJobs = await fetchAshbyJobs(atsBoard.boardToken);
    } else if (atsBoard.platform === 'remoteok') {
      normalizedJobs = await fetchRemoteOKJobs();
    } else if (atsBoard.platform === 'adzuna') {
      normalizedJobs = await fetchAdzunaJobs(atsBoard.boardToken);
    } else if (atsBoard.platform === 'jsearch') {
      // boardToken format: "query" or "query::pages" e.g. "software engineer" or "data scientist::2"
      const parts = atsBoard.boardToken.split('::');
      const query = parts[0] || 'software engineer';
      const pages = parseInt(parts[1]) || 3;
      normalizedJobs = await fetchJSearchJobs(query, { pages, country: 'us', datePosted: 'week' });
    } else if (atsBoard.platform === 'theirstack') {
      const config = parseTheirStackBoardToken(atsBoard.boardToken);
      normalizedJobs = await fetchTheirStackJobs(config);
    } else if (atsBoard.platform === 'wwr') {
      normalizedJobs = await fetchWWRJobs(atsBoard.boardToken);
    } else if (atsBoard.platform === 'amazon') {
      // boardToken is the job category, e.g. "software-development"
      normalizedJobs = await fetchAmazonJobs(atsBoard.boardToken);
    } else if (atsBoard.platform === 'hn_hiring') {
      // boardToken: "monthly" (auto) or "thread:<itemId>" (pinned)
      normalizedJobs = await fetchHackerNewsHiringJobs(atsBoard.boardToken);
    } else {
      throw new Error(`Unsupported platform: ${atsBoard.platform}`);
    }

    // Enrich company name from ATSBoard for per-company sources
    // Aggregators (remoteok, adzuna, wwr) already have company names from their data
    if (['greenhouse', 'lever', 'ashby'].includes(atsBoard.platform) && atsBoard.platform !== 'amazon') {
      normalizedJobs = normalizedJobs.map(job => ({
        ...job,
        company: atsBoard.name
      }));
    }

    const fetchedExternalIds = new Set(normalizedJobs.map(j => j.externalId));

    // Pre-fetch the postedAt values of any rows we already have for this
    // (source, externalId) set so we can preserve the FIRST-seen posting
    // date. Some ATS APIs (Ashby in particular — `publishedDate` mirrors
    // `updatedAt` and refreshes on every republish) would otherwise stamp
    // every job with the latest sync time, making old listings look
    // "Posted just now".
    const existingRows = await ExternalJob.findAll({
      where: {
        source: normalizedJobs[0]?.source || null,
        externalId: { [Op.in]: [...fetchedExternalIds] }
      },
      attributes: ['externalId', 'postedAt'],
      raw: true,
    });
    const existingPostedAt = new Map(
      existingRows.map(r => [r.externalId, r.postedAt])
    );

    // Upsert all fetched jobs.
    //
    // Important: Sequelize.upsert rewrites EVERY field in the payload on
    // conflict. Some source APIs return the posted-date intermittently
    // (Greenhouse / RSS feeds in particular) — if we passed `postedAt: null`
    // through to the UPDATE clause, we'd wipe a previously-correct date
    // every time we re-scraped. Strip null `postedAt` so the existing
    // column value is preserved. Also strip `postedAt` whenever a row
    // already exists with a non-null value, so the first-seen posting date
    // is treated as canonical and never overwritten by later syncs.
    let created = 0;
    let updated = 0;
    const newJobs = [];
    for (const jobData of normalizedJobs) {
      const payload = { ...jobData };
      if (payload.postedAt == null) {
        delete payload.postedAt;
      } else if (existingPostedAt.get(payload.externalId) != null) {
        // Row exists and already has a postedAt — keep the original.
        delete payload.postedAt;
      }
      const [job, wasCreated] = await ExternalJob.upsert(payload, {
        conflictFields: ['source', 'externalId']
      });
      if (wasCreated) {
        created++;
        newJobs.push(job);
      } else {
        updated++;
      }
    }

    // Generate embeddings for new jobs in the background
    if (newJobs.length > 0) {
      const embSvc = getJobEmbeddingService();
      if (embSvc) {
        embSvc.generateBatchJobEmbeddings(newJobs).then(({ success, failed }) => {
          if (success > 0) console.log(`[ExternalJobs] Embedded ${success} new jobs for ${atsBoard.name}`);
          if (failed > 0) console.warn(`[ExternalJobs] Failed to embed ${failed} jobs for ${atsBoard.name}`);
        }).catch(err => {
          console.warn(`[ExternalJobs] Embedding error for ${atsBoard.name}:`, err.message);
        });
      }
    }

    // Extract skills via Claude Haiku for any new job whose source didn't
    // give us an explicit skills array (Greenhouse / Adzuna / Amazon / HN
    // typically don't). Bounded concurrency keeps us polite to the API.
    // Fire-and-forget — we never block sync on this.
    if (newJobs.length > 0 && process.env.ANTHROPIC_API_KEY) {
      const { extractAndPersist } = require('./jobSkillExtractor');
      const SKILL_CONCURRENCY = 5;
      const queue = newJobs.filter(j => !Array.isArray(j.skills) || j.skills.length === 0);
      if (queue.length > 0) {
        let inFlight = 0, idx = 0, ok = 0, fail = 0;
        const next = () => {
          if (idx >= queue.length) return;
          const job = queue[idx++];
          inFlight++;
          extractAndPersist(job)
            .then(out => { if (out && out.length) ok++; else fail++; })
            .catch(() => fail++)
            .finally(() => {
              inFlight--;
              if (idx < queue.length) next();
              else if (inFlight === 0) {
                console.log(`[ExternalJobs] Extracted skills for ${ok}/${queue.length} new jobs (${atsBoard.name})`);
              }
            });
        };
        for (let i = 0; i < Math.min(SKILL_CONCURRENCY, queue.length); i++) next();
      }
    }

    // Mark jobs that were NOT in the fetch as inactive (removed from ATS)
    const deactivated = await ExternalJob.update(
      { isActive: false, lastFetchedAt: new Date() },
      {
        where: {
          source: atsBoard.platform,
          boardToken: atsBoard.boardToken,
          externalId: { [Op.notIn]: [...fetchedExternalIds] },
          isActive: true
        }
      }
    );

    // Update the ATSBoard record
    await atsBoard.update({
      lastSyncAt: new Date(),
      jobCount: normalizedJobs.length,
      syncError: null
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[ExternalJobs] ✓ ${atsBoard.name}: ${normalizedJobs.length} jobs (${created} new, ${updated} updated, ${deactivated[0] || 0} deactivated) in ${elapsed}s`);

    // Invalidate the aggregation caches (companies / departments / locations
    // / skills) any time we change the corpus. Without this, freshly-added
    // jobs would wait up to 10 minutes for the TTL to expire before
    // surfacing in those endpoints. Lazy-required to avoid circular deps.
    if (created > 0 || updated > 0 || (deactivated[0] || 0) > 0) {
      try {
        const cache = require('./simpleCache');
        cache.invalidatePrefix('external_jobs:');
      } catch { /* cache module is optional, never fail sync because of it */ }
      // Also clear the per-filter count cache inside jobEmbeddingService.
      // It's a separate Map (not the simpleCache prefix space) so it
      // needs its own kick; otherwise newly synced jobs would sit behind
      // a stale total for up to 60s of cached counts.
      try {
        const { invalidateJobsCountCache } = require('./jobEmbeddingService');
        invalidateJobsCountCache();
      } catch { /* same — never fail the sync because of cache plumbing */ }
    }

    return { success: true, created, updated, deactivated: deactivated[0] || 0, total: normalizedJobs.length };
  } catch (error) {
    console.error(`[ExternalJobs] ✗ ${atsBoard.name}: ${error.message}`);
    await atsBoard.update({ syncError: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Sync all active ATS boards
 */
async function syncAllBoards() {
  // Overlap guard. A full sweep can run longer than the 15-min cron
  // interval (HN "Who's hiring" LLM parsing, JSearch/Amazon pagination,
  // per-board 30s fetch timeouts all add up). Without this lock the next
  // `*/15` tick — or a manual trigger — would start a SECOND concurrent
  // sweep that competes for the same DB pool and double-upserts every
  // board, which both slows the live /jobs queries and can leave the
  // later boards starved so they "never refresh". Skip if one is running.
  if (_fullSyncInProgress) {
    console.warn('[ExternalJobs] Full sync already in progress — skipping this run.');
    return { boardsSynced: 0, skipped: true, results: [] };
  }
  _fullSyncInProgress = true;
  try {
    console.log('[ExternalJobs] Starting full sync of all active boards...');
    const boards = await ATSBoard.findAll({ where: { isActive: true } });

    if (boards.length === 0) {
      console.log('[ExternalJobs] No active boards configured. Skipping sync.');
      return { boardsSynced: 0, results: [] };
    }

    const results = [];
    for (const board of boards) {
      const result = await syncBoard(board);
      results.push({ board: board.name, ...result });
      // Small delay between boards to be nice to APIs
      if (boards.indexOf(board) < boards.length - 1) {
        await sleep(1000);
      }
    }

    const totalJobs = results.filter(r => r.success).reduce((sum, r) => sum + r.total, 0);
    console.log(`[ExternalJobs] Full sync complete: ${results.length} boards, ${totalJobs} total jobs`);
    return { boardsSynced: results.length, totalJobs, results };
  } finally {
    _fullSyncInProgress = false;
  }
}

/**
 * Check if a board is stale and needs re-fetching.
 * Triggers background sync if stale but returns immediately.
 *
 * Guards against the pathological case (observed in prod) where a single
 * /jobs page load fans out N parallel sync calls to the same board: each
 * caller now goes through an in-flight Set keyed by boardToken plus a
 * global concurrency cap, so at most REFRESH_CONCURRENCY_CAP boards can
 * be syncing simultaneously and the same board never syncs twice at once.
 */
function refreshIfStale(boardToken) {
  // Cheap synchronous gates first — avoid even hitting the DB if we know
  // we're going to bail.
  if (_inFlightBoardSyncs.has(boardToken)) return;
  if (_activeRefreshCount >= REFRESH_CONCURRENCY_CAP) return;

  ATSBoard.findOne({
    where: { boardToken, isActive: true }
  }).then(board => {
    if (!board) return;
    const minutesSinceSync = board.lastSyncAt
      ? (Date.now() - new Date(board.lastSyncAt).getTime()) / 60000
      : Infinity;

    if (minutesSinceSync <= STALE_THRESHOLD_MINUTES) return;

    // Re-check gates now that we've awaited the DB lookup — another
    // request may have started syncing this board while we were waiting.
    if (_inFlightBoardSyncs.has(boardToken)) return;
    if (_activeRefreshCount >= REFRESH_CONCURRENCY_CAP) return;

    _inFlightBoardSyncs.add(boardToken);
    _activeRefreshCount += 1;
    console.log(`[ExternalJobs] Board ${board.name} is stale (${minutesSinceSync.toFixed(0)} min), refreshing... [inflight=${_activeRefreshCount}/${REFRESH_CONCURRENCY_CAP}]`);

    syncBoard(board)
      .catch(err => console.error(`[ExternalJobs] Background refresh failed for ${board.name}:`, err.message))
      .finally(() => {
        _inFlightBoardSyncs.delete(boardToken);
        _activeRefreshCount = Math.max(0, _activeRefreshCount - 1);
      });
  }).catch(err => {
    console.error('[ExternalJobs] refreshIfStale error:', err.message);
  });
}

/**
 * Validate that a board token is reachable and returns jobs
 */
async function validateBoard(platform, boardToken) {
  try {
    let jobs;
    if (platform === 'greenhouse') {
      jobs = await fetchGreenhouseJobs(boardToken);
    } else if (platform === 'lever') {
      jobs = await fetchLeverJobs(boardToken);
    } else if (platform === 'ashby') {
      jobs = await fetchAshbyJobs(boardToken);
    } else if (platform === 'remoteok') {
      jobs = await fetchRemoteOKJobs();
    } else if (platform === 'adzuna') {
      jobs = await fetchAdzunaJobs(boardToken);
    } else if (platform === 'jsearch') {
      jobs = await fetchJSearchJobs(boardToken);
    } else if (platform === 'theirstack') {
      const config = parseTheirStackBoardToken(boardToken);
      jobs = await fetchTheirStackJobs(config);
    } else if (platform === 'wwr') {
      jobs = await fetchWWRJobs(boardToken);
    } else if (platform === 'amazon') {
      jobs = await fetchAmazonJobs(boardToken);
    } else if (platform === 'hn_hiring') {
      jobs = await fetchHackerNewsHiringJobs(boardToken);
    } else {
      return { valid: false, error: 'Unsupported platform' };
    }
    return { valid: true, jobCount: jobs.length };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// ─── HELPERS ───────────────────────────────────────────────

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
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(html) {
  if (!html) return '';
  // Decode entities first (Greenhouse returns &lt;h2&gt; not <h2>)
  const decoded = decodeHtmlEntities(html);
  return decoded
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEmploymentType(value) {
  if (!value) return null;
  const v = value.toLowerCase().trim();
  if (v.includes('full') && v.includes('time')) return 'full-time';
  if (v.includes('part') && v.includes('time')) return 'part-time';
  if (v.includes('contract') || v.includes('freelance')) return 'contract';
  if (v.includes('intern')) return 'internship';
  return value;
}

function normalizeExperienceLevel(value) {
  if (!value) return null;
  const v = value.toLowerCase().trim();
  if (v.includes('entry') || v.includes('junior') || v.includes('jr')) return 'entry';
  if (v.includes('senior') || v.includes('sr') || v.includes('staff')) return 'senior';
  if (v.includes('lead') || v.includes('principal') || v.includes('manager')) return 'lead';
  if (v.includes('executive') || v.includes('director') || v.includes('vp') || v.includes('c-level') || v.includes('chief')) return 'executive';
  if (v.includes('mid') || v.includes('intermediate')) return 'mid';
  return null;
}

function inferExperienceLevel(title) {
  if (!title) return null;
  const t = title.toLowerCase();
  if (t.includes('junior') || t.includes('jr.') || t.includes('entry') || t.includes('associate')) return 'entry';
  if (t.includes('senior') || t.includes('sr.') || t.includes('staff') || t.includes('principal')) return 'senior';
  if (t.includes('lead') || t.includes('manager')) return 'lead';
  if (t.includes('director') || t.includes('vp') || t.includes('head of') || t.includes('chief')) return 'executive';
  return 'mid';
}

function inferLocationType(location, title) {
  const text = ((location || '') + ' ' + (title || '')).toLowerCase();
  if (text.includes('remote')) return 'remote';
  if (text.includes('hybrid')) return 'hybrid';
  return 'onsite';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  fetchGreenhouseJobs,
  fetchLeverJobs,
  fetchAshbyJobs,
  fetchRemoteOKJobs,
  fetchAdzunaJobs,
  fetchJSearchJobs,
  fetchTheirStackJobs,
  fetchWWRJobs,
  fetchAmazonJobs,
  fetchHackerNewsHiringJobs,
  syncBoard,
  syncAllBoards,
  refreshIfStale,
  validateBoard,
  STALE_THRESHOLD_MINUTES
};
