/**
 * LinkedIn Enrichment Service
 *
 * Provides profile enrichment from LinkedIn URLs and email addresses.
 *
 * Primary provider: EnrichLayer (https://enrichlayer.com) — the direct
 * successor to Proxycurl's people-data API. Same response schema, still
 * accepts LinkedIn profile URLs. 1 credit / profile.
 * Set ENRICHLAYER_API_KEY in .env.
 *
 * (Nubela/Proxycurl itself pivoted to NinjaPear B2B company data and
 * returns HTTP 410 for LinkedIn URL lookups — do not use PROXYCURL_API_KEY
 * for URL enrichment anymore.)
 */

const axios = require('axios');

// Configuration - set these in .env
const ENRICHLAYER_API_KEY = process.env.ENRICHLAYER_API_KEY;
const PROXYCURL_API_KEY = process.env.PROXYCURL_API_KEY;
const PEOPLE_DATA_LABS_API_KEY = process.env.PEOPLE_DATA_LABS_API_KEY;

/**
 * Extract LinkedIn username from URL
 */
function extractLinkedInUsername(url) {
  if (!url) return null;
  
  try {
    // Handle various LinkedIn URL formats
    const patterns = [
      /linkedin\.com\/in\/([^\/\?]+)/i,
      /linkedin\.com\/pub\/([^\/\?]+)/i,
      /linkedin\.com\/profile\/view\?id=([^&]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1].toLowerCase();
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Validate LinkedIn URL format
 */
function isValidLinkedInUrl(url) {
  if (!url) return false;
  
  const linkedinPattern = /^https?:\/\/(www\.)?linkedin\.com\/(in|pub|profile)\/[a-zA-Z0-9_-]+\/?/i;
  return linkedinPattern.test(url);
}

/**
 * Enrich profile from LinkedIn URL
 * 
 * STUB: Returns basic extracted data. Replace with real API call.
 * 
 * @param {string} linkedinUrl - LinkedIn profile URL
 * @returns {Object} Enriched profile data
 */
async function enrichFromLinkedInUrl(linkedinUrl) {
  const username = extractLinkedInUsername(linkedinUrl);
  
  if (!username) {
    return {
      success: false,
      linkedinUrl,
      error: 'Invalid LinkedIn URL format',
      enriched: false
    };
  }
  
  // If EnrichLayer API key is configured, use real enrichment
  if (ENRICHLAYER_API_KEY) {
    try {
      // Notes on the params:
      //  - skills=include        → free; limited coverage but worth asking.
      //  - use_cache=if-recent   → fresh profile no older than 29 days
      //    (costs +1 credit); cached hits return in <1s.
      //  - fallback_to_cache=on-error → if the live fetch errors, serve an
      //    older cached copy rather than fail.
      //  - timeout 85_000ms      → Cloudflare kills the origin request at
      //    ~100s. Bail before that so we can return a friendly JSON error
      //    instead of a 502 Bad Gateway page.
      const response = await axios.get('https://enrichlayer.com/api/v2/profile', {
        params: {
          profile_url: linkedinUrl,
          skills: 'include',
          use_cache: 'if-recent',
          fallback_to_cache: 'on-error'
        },
        headers: { 'Authorization': `Bearer ${ENRICHLAYER_API_KEY}` },
        timeout: 85000
      });

      const data = response.data;

      // EnrichLayer dates are { day, month, year } objects.
      const dmyToDate = (d) =>
        (d && d.year
          ? `${d.year}-${String(d.month || 1).padStart(2, '0')}-${String(d.day || 1).padStart(2, '0')}`
          : null);

      return {
        success: true,
        linkedinUrl,
        username,
        enriched: true,
        source: 'enrichlayer',
        data: {
          firstName: data.first_name,
          lastName: data.last_name,
          fullName: data.full_name,
          headline: data.headline,
          summary: data.summary,
          location: data.location_str
            || [data.city, data.state, data.country_full_name || data.country].filter(Boolean).join(', ')
            || null,
          profilePicture: data.profile_pic_url,
          currentCompany: data.experiences?.[0]?.company,
          currentTitle: data.experiences?.[0]?.title || data.occupation,
          experience: (data.experiences || []).map(exp => ({
            company: exp.company,
            title: exp.title,
            startDate: dmyToDate(exp.starts_at),
            endDate: dmyToDate(exp.ends_at),
            current: !exp.ends_at,
            description: exp.description
          })),
          education: (data.education || []).map(edu => ({
            school: edu.school,
            degree: edu.degree_name,
            field: edu.field_of_study,
            startYear: edu.starts_at?.year,
            endYear: edu.ends_at?.year
          })),
          skills: data.skills || []
        }
      };
    } catch (error) {
      // Distinguish timeout from other errors so callers can surface a
      // useful message. axios uses ECONNABORTED for its own timeout.
      const status = error.response?.status;
      const isTimeout =
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT' ||
        /timeout/i.test(error.message || '');
      console.error(
        `[LinkedIn Enrichment] EnrichLayer API error (${isTimeout ? 'timeout' : (status || 'network')}):`,
        error.message
      );
      let friendly;
      if (isTimeout) {
        friendly = 'LinkedIn is being slow to respond right now. Try again in a minute, or upload your resume instead.';
      } else if (status === 404) {
        friendly = 'We couldn\u2019t find that LinkedIn profile. Double-check the URL, or upload your resume instead.';
      } else if (status === 403) {
        friendly = 'Profile import is temporarily unavailable (out of enrichment credits).';
      } else {
        friendly = error.response?.data?.description || error.response?.data?.message || error.message;
      }
      return {
        success: false,
        linkedinUrl,
        username,
        error: friendly,
        errorCode: isTimeout ? 'ENRICHLAYER_TIMEOUT' : undefined,
        enriched: false
      };
    }
  }

  // STUB: Return minimal data when no API is configured
  console.log(`[LinkedIn Enrichment] STUB: No API configured for ${linkedinUrl}`);

  return {
    success: true,
    linkedinUrl,
    username,
    enriched: false,
    source: 'stub',
    message: 'LinkedIn enrichment API not configured. Set ENRICHLAYER_API_KEY in .env',
    data: {
      linkedinUrl,
      linkedinUsername: username
    }
  };
}

/**
 * Enrich profile from email address
 * 
 * STUB: Returns basic data. Replace with real API (Clearbit, Hunter.io, PDL).
 * 
 * @param {string} email - Email address
 * @returns {Object} Enriched profile data
 */
async function enrichFromEmail(email) {
  if (!email || !email.includes('@')) {
    return {
      success: false,
      email,
      error: 'Invalid email format',
      enriched: false
    };
  }
  
  const normalizedEmail = email.trim().toLowerCase();
  const [localPart, domain] = normalizedEmail.split('@');
  
  // If People Data Labs API key is configured, use real enrichment
  if (PEOPLE_DATA_LABS_API_KEY) {
    try {
      const response = await axios.get('https://api.peopledatalabs.com/v5/person/enrich', {
        params: { email: normalizedEmail },
        headers: { 'X-Api-Key': PEOPLE_DATA_LABS_API_KEY }
      });
      
      const data = response.data.data;
      
      if (data) {
        return {
          success: true,
          email: normalizedEmail,
          enriched: true,
          source: 'people_data_labs',
          data: {
            firstName: data.first_name,
            lastName: data.last_name,
            fullName: data.full_name,
            linkedinUrl: data.linkedin_url,
            location: data.location_name,
            currentCompany: data.job_company_name,
            currentTitle: data.job_title,
            phone: data.phone_numbers?.[0]
          }
        };
      }
    } catch (error) {
      console.error('[Email Enrichment] PDL API error:', error.message);
      // Fall through to stub
    }
  }
  
  // STUB: Extract name guess from email
  const nameParts = localPart
    .replace(/[._-]/g, ' ')
    .replace(/\d+/g, '')
    .split(' ')
    .filter(part => part.length > 1);
  
  const guessedFirstName = nameParts[0] 
    ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1)
    : null;
  const guessedLastName = nameParts[1]
    ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1)
    : null;
  
  console.log(`[Email Enrichment] STUB: No API configured for ${normalizedEmail}`);
  
  return {
    success: true,
    email: normalizedEmail,
    enriched: false,
    source: 'stub',
    message: 'Email enrichment API not configured. Set PEOPLE_DATA_LABS_API_KEY in .env',
    data: {
      email: normalizedEmail,
      domain,
      // Guessed data from email (low confidence)
      guessedFirstName,
      guessedLastName,
      isPersonalEmail: ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain),
      isWorkEmail: !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)
    }
  };
}

/**
 * Batch enrich multiple LinkedIn URLs
 */
async function batchEnrichLinkedIn(urls, options = {}) {
  const { concurrency = 5, delayMs = 200 } = options;
  const results = [];
  
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(url => enrichFromLinkedInUrl(url))
    );
    results.push(...batchResults);
    
    // Rate limiting delay between batches
    if (i + concurrency < urls.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

/**
 * Batch enrich multiple emails
 */
async function batchEnrichEmails(emails, options = {}) {
  const { concurrency = 5, delayMs = 200 } = options;
  const results = [];
  
  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(email => enrichFromEmail(email))
    );
    results.push(...batchResults);
    
    // Rate limiting delay between batches
    if (i + concurrency < emails.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

/**
 * Enrich a person's professional profile via NinjaPear (formerly Proxycurl).
 *
 * Nubela deprecated the old /proxycurl/api/v2/linkedin endpoint (it now
 * returns HTTP 410) — LinkedIn URLs can no longer be resolved directly.
 * The replacement Person Profile endpoint takes one of:
 *   - workEmail                          (corporate email, not gmail/free)
 *   - firstName + employerWebsite        (+ optional lastName/role)
 *   - employerWebsite + role
 *
 * Docs: https://nubela.co/proxycurl/docs → GET /api/v2/employee/profile
 * Cost: 3 credits per request (charged even when nothing is found).
 *
 * @param {Object} params
 * @param {string} [params.workEmail]
 * @param {string} [params.firstName]
 * @param {string} [params.lastName]
 * @param {string} [params.employerWebsite]
 * @param {string} [params.role]
 * @returns {Object} { success, enriched, data?, error?, errorCode? }
 */
async function enrichPersonProfile({ workEmail, firstName, lastName, employerWebsite, role } = {}) {
  const hasEmailInput = !!workEmail;
  const hasNameInput = !!(firstName && employerWebsite);
  const hasRoleInput = !!(employerWebsite && role);
  if (!hasEmailInput && !hasNameInput && !hasRoleInput) {
    return {
      success: false,
      enriched: false,
      error: 'Provide a work email, or your name plus your current employer\u2019s website.'
    };
  }

  if (!PROXYCURL_API_KEY) {
    return {
      success: false,
      enriched: false,
      errorCode: 'NOT_CONFIGURED',
      error: 'Profile enrichment API not configured. Set PROXYCURL_API_KEY in .env'
    };
  }

  const params = { use_cache: 'if-recent' };
  if (workEmail) params.work_email = workEmail.trim();
  if (firstName) params.first_name = firstName.trim();
  if (lastName) params.last_name = lastName.trim();
  if (employerWebsite) params.employer_website = employerWebsite.trim();
  if (role) params.role = role.trim();

  try {
    // Detailed enrichment averages ~12s; hard-cap at 85s to stay under
    // Cloudflare's ~100s origin timeout.
    const response = await axios.get('https://nubela.co/api/v2/employee/profile', {
      params,
      headers: { 'Authorization': `Bearer ${PROXYCURL_API_KEY}` },
      timeout: 85000
    });

    const d = response.data || {};

    // "YYYY-MM" → "YYYY-MM-01"; null/undefined stays null.
    const ymToDate = (ym) => (ym ? `${ym}-01` : null);
    // Prefer the human-readable location_display ("California, United
    // States") the live API returns; fall back to assembling from the
    // *_name fields, then raw ISO codes.
    const location = d.location_display
      || [d.state_name || (d.state && d.state.includes('-') ? d.state.split('-')[1] : d.state), d.country_name || d.country]
        .filter(Boolean).join(', ')
      || null;

    return {
      success: true,
      enriched: true,
      source: 'ninjapear',
      data: {
        firstName: d.first_name || firstName || '',
        lastName: d.last_name || lastName || '',
        fullName: d.full_name || '',
        headline: d.bio || '',
        summary: d.bio || '',
        location,
        profilePicture: d.profile_pic_url || '',
        personalWebsite: d.personal_website || '',        linkedinUrl: d.linkedin_profile_url || '',        currentCompany: d.work_experience?.[0]?.company_name,
        currentTitle: d.work_experience?.[0]?.role,
        experience: (d.work_experience || []).map((exp) => ({
          company: exp.company_name || '',
          title: exp.role || '',
          startDate: ymToDate(exp.start_date),
          endDate: ymToDate(exp.end_date),
          current: !exp.end_date,
          description: exp.description || ''
        })),
        education: (d.education || []).map((edu) => ({
          school: edu.school || '',
          degree: edu.major || '',
          field: '',
          startYear: edu.start_date ? Number(edu.start_date.slice(0, 4)) : null,
          endYear: edu.end_date ? Number(edu.end_date.slice(0, 4)) : null
        })),
        skills: [] // Person Profile endpoint does not return skills
      }
    };
  } catch (error) {
    const status = error.response?.status;
    const isTimeout =
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      /timeout/i.test(error.message || '');

    let friendly;
    let errorCode;
    if (isTimeout) {
      friendly = 'The profile lookup is taking too long. Try again in a minute, or upload your resume instead.';
      errorCode = 'TIMEOUT';
    } else if (status === 400) {
      friendly = error.response?.data?.description || error.response?.data?.error ||
        'That looks like a personal email (e.g. gmail). Please use your work email, or enter your name and employer website instead.';
      errorCode = 'BAD_INPUT';
    } else if (status === 403) {
      friendly = 'Profile import is temporarily unavailable (out of enrichment credits).';
      errorCode = 'OUT_OF_CREDITS';
    } else if (status === 404) {
      friendly = 'We couldn\u2019t find a public professional profile matching those details. Double-check the spelling, or upload your resume instead.';
      errorCode = 'NOT_FOUND';
    } else {
      friendly = error.response?.data?.description || error.response?.data?.message || error.message;
    }

    console.error(`[Person Enrichment] NinjaPear API error (${status || error.code || 'network'}):`, error.message);
    return { success: false, enriched: false, error: friendly, errorCode };
  }
}

module.exports = {
  extractLinkedInUsername,
  isValidLinkedInUrl,
  enrichFromLinkedInUrl,
  enrichPersonProfile,
  enrichFromEmail,
  batchEnrichLinkedIn,
  batchEnrichEmails
};
