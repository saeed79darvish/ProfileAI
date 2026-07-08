/**
 * LinkedIn Enrichment Service
 * 
 * Provides profile enrichment from LinkedIn URLs and email addresses.
 * 
 * STUB IMPLEMENTATION - Replace with real API integration:
 * - Proxycurl (https://proxycurl.com) - ~$0.01-0.03 per profile
 * - People Data Labs (https://peopledatalabs.com) - ~$0.01-0.05 per profile
 * - Clearbit (https://clearbit.com) - Enterprise pricing
 * - Hunter.io (https://hunter.io) - Email verification + enrichment
 */

const axios = require('axios');

// Configuration - set these in .env
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
  
  // If Proxycurl API key is configured, use real enrichment
  if (PROXYCURL_API_KEY) {
    try {
      // Notes on the params:
      //  - use_cache=if-recent  → Proxycurl serves a cached copy (if <29 days
      //    old) in <1s instead of scraping live for 30–120s. Massive latency
      //    win on repeat lookups; fresh lookups still hit live scrape.
      //  - fallback_to_cache=on-error → if live scrape times out or errors,
      //    return a cached copy (even older than 29 days) rather than fail.
      //  - timeout 85_000ms      → Cloudflare kills the origin request at
      //    ~100s. Bail before that so we can return a friendly JSON error
      //    instead of a 502 Bad Gateway page.
      const response = await axios.get('https://nubela.co/proxycurl/api/v2/linkedin', {
        params: {
          url: linkedinUrl,
          use_cache: 'if-recent',
          fallback_to_cache: 'on-error'
        },
        headers: { 'Authorization': `Bearer ${PROXYCURL_API_KEY}` },
        timeout: 85000
      });
      
      const data = response.data;
      
      return {
        success: true,
        linkedinUrl,
        username,
        enriched: true,
        source: 'proxycurl',
        data: {
          firstName: data.first_name,
          lastName: data.last_name,
          fullName: data.full_name,
          headline: data.headline,
          summary: data.summary,
          location: data.city ? `${data.city}, ${data.state}, ${data.country}` : data.country,
          profilePicture: data.profile_pic_url,
          currentCompany: data.experiences?.[0]?.company,
          currentTitle: data.experiences?.[0]?.title,
          experience: (data.experiences || []).map(exp => ({
            company: exp.company,
            title: exp.title,
            startDate: exp.starts_at ? `${exp.starts_at.year}-${exp.starts_at.month || 1}` : null,
            endDate: exp.ends_at ? `${exp.ends_at.year}-${exp.ends_at.month || 1}` : null,
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
      const isTimeout =
        error.code === 'ECONNABORTED' ||
        error.code === 'ETIMEDOUT' ||
        /timeout/i.test(error.message || '');
      console.error(
        `[LinkedIn Enrichment] Proxycurl API error (${isTimeout ? 'timeout' : (error.response?.status || 'network')}):`,
        error.message
      );
      return {
        success: false,
        linkedinUrl,
        username,
        error: isTimeout
          ? 'LinkedIn is being slow to respond right now. Try again in a minute, or upload your resume instead.'
          : (error.response?.data?.message || error.message),
        errorCode: isTimeout ? 'PROXYCURL_TIMEOUT' : undefined,
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
    message: 'LinkedIn enrichment API not configured. Set PROXYCURL_API_KEY in .env',
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

module.exports = {
  extractLinkedInUsername,
  isValidLinkedInUrl,
  enrichFromLinkedInUrl,
  enrichFromEmail,
  batchEnrichLinkedIn,
  batchEnrichEmails
};
