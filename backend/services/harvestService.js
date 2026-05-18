const crypto = require('crypto');

// Encryption for storing API keys at rest
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey() {
  const secret = process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Build Authorization header for Greenhouse Harvest API
 * Harvest uses HTTP Basic Auth with API key as username and empty password
 */
function buildAuthHeader(apiKey) {
  return 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
}

/**
 * Fetch jobs from Greenhouse Harvest API
 * GET https://harvest.greenhouse.io/v1/jobs?status=open
 */
async function fetchHarvestJobs(apiKey, { status = 'open', page = 1, perPage = 100 } = {}) {
  const params = new URLSearchParams({
    status,
    page: String(page),
    per_page: String(perPage)
  });
  const url = `https://harvest.greenhouse.io/v1/jobs?${params}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': buildAuthHeader(apiKey),
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(30000)
  });

  if (response.status === 401) {
    throw new Error('Invalid Greenhouse API key');
  }
  if (!response.ok) {
    throw new Error(`Harvest API error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch a single job with full details from Harvest API
 * GET https://harvest.greenhouse.io/v1/jobs/{id}
 */
async function fetchHarvestJob(apiKey, jobId) {
  const url = `https://harvest.greenhouse.io/v1/jobs/${encodeURIComponent(jobId)}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': buildAuthHeader(apiKey),
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(30000)
  });

  if (response.status === 401) {
    throw new Error('Invalid Greenhouse API key');
  }
  if (!response.ok) {
    throw new Error(`Harvest API error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch hiring team for a job
 * GET https://harvest.greenhouse.io/v1/jobs/{id}/hiring_team
 */
async function fetchHiringTeam(apiKey, jobId) {
  const url = `https://harvest.greenhouse.io/v1/jobs/${encodeURIComponent(jobId)}/hiring_team`;
  const response = await fetch(url, {
    headers: {
      'Authorization': buildAuthHeader(apiKey),
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(30000)
  });

  if (response.status === 401) {
    throw new Error('Invalid Greenhouse API key');
  }
  if (!response.ok) {
    throw new Error(`Harvest API error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch all open jobs with pagination
 */
async function fetchAllOpenJobs(apiKey) {
  const allJobs = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const jobs = await fetchHarvestJobs(apiKey, { status: 'open', page, perPage });
    allJobs.push(...jobs);
    if (jobs.length < perPage) break;
    page++;
    // Rate-limit courtesy
    await new Promise(r => setTimeout(r, 500));
  }

  return allJobs;
}

/**
 * Validate an API key by making a lightweight request
 */
async function validateApiKey(apiKey) {
  try {
    const jobs = await fetchHarvestJobs(apiKey, { perPage: 1 });
    return { valid: true, jobCount: Array.isArray(jobs) ? jobs.length : 0 };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Normalize Harvest job to a simplified response for the frontend
 */
function normalizeHarvestJob(job) {
  const hiringManagers = (job.hiring_team?.hiring_managers || []).map(m => ({
    name: m.name,
    firstName: m.first_name,
    lastName: m.last_name
  }));

  const recruiters = (job.hiring_team?.recruiters || []).map(r => ({
    name: r.name,
    firstName: r.first_name,
    lastName: r.last_name,
    responsible: r.responsible || false
  }));

  const departments = (job.departments || []).map(d => ({
    id: d.id,
    name: d.name
  }));

  const offices = (job.offices || []).map(o => ({
    id: o.id,
    name: o.name,
    location: o.location?.name || null
  }));

  // Extract salary from custom fields
  let salaryMin = null;
  let salaryMax = null;
  let salaryCurrency = 'USD';
  const salaryField = job.custom_fields?.salary_range || job.keyed_custom_fields?.salary_range?.value;
  if (salaryField) {
    salaryMin = salaryField.min_value || null;
    salaryMax = salaryField.max_value || null;
    salaryCurrency = salaryField.unit || 'USD';
  }

  const openings = (job.openings || []).map(o => ({
    id: o.id,
    openingId: o.opening_id,
    status: o.status,
    openedAt: o.opened_at,
    closedAt: o.closed_at
  }));

  const openOpenings = openings.filter(o => o.status === 'open').length;

  // Convenience fields for the frontend
  const title = job.name;
  const location = offices.map(o => o.name).filter(Boolean).join(', ') || null;
  const departmentNames = departments.map(d => d.name);

  // Merged hiring team with roles for easy display
  const hiringTeam = [
    ...hiringManagers.map(m => ({ name: m.name, role: 'Hiring Manager' })),
    ...recruiters.map(r => ({ name: r.name, role: r.responsible ? 'Lead Recruiter' : 'Recruiter' })),
    ...(job.hiring_team?.coordinators || []).map(c => ({ name: c.name, role: c.responsible ? 'Lead Coordinator' : 'Coordinator' })),
    ...(job.hiring_team?.sourcers || []).map(s => ({ name: s.name, role: 'Sourcer' })),
  ];

  return {
    id: job.id,
    name: job.name,
    title,
    requisitionId: job.requisition_id,
    status: job.status,
    confidential: job.confidential,
    createdAt: job.created_at,
    openedAt: job.opened_at,
    closedAt: job.closed_at,
    updatedAt: job.updated_at,
    location,
    departments: departmentNames,
    departmentsRaw: departments,
    offices,
    hiringManagers,
    recruiters,
    hiringTeam,
    coordinators: (job.hiring_team?.coordinators || []).map(c => ({
      name: c.name,
      responsible: c.responsible || false
    })),
    sourcers: (job.hiring_team?.sourcers || []).map(s => ({ name: s.name })),
    salaryMin,
    salaryMax,
    salaryCurrency,
    employmentType: job.custom_fields?.employment_type || job.keyed_custom_fields?.employment_type?.value || null,
    openings: openOpenings,
    openingsRaw: openings,
    totalOpenings: openings.length
  };
}

module.exports = {
  encrypt,
  decrypt,
  fetchHarvestJobs,
  fetchHarvestJob,
  fetchHiringTeam,
  fetchAllOpenJobs,
  validateApiKey,
  normalizeHarvestJob
};
