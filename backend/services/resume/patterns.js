/**
 * Resume Pattern Utilities
 * 
 * Regex patterns and utilities for extracting structured data from resume text.
 * Includes contact info extraction, date parsing, and skill detection.
 */

// ═══════════════════════════════════════════════════════════════
// REGEX PATTERNS
// ═══════════════════════════════════════════════════════════════

const PATTERNS = {
  // Contact info patterns
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  phone: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/,
  linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i,
  github: /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/?/i,
  website: /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/,
  location: /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2}|[A-Z][a-z]+)/,

  // Date patterns
  dateRange: /((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.\s]*\d{4}|(?:\d{1,2}\/\d{4}))\s*[-–—to]+\s*((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.\s]*\d{4}|(?:\d{1,2}\/\d{4})|Present|Current|Now|Ongoing)/gi,

  // Section headers
  experienceHeader: /^(PROFESSIONAL\s+EXPERIENCE|WORK\s+EXPERIENCE|EXPERIENCE|EMPLOYMENT(?:\s+HISTORY)?|WORK\s+HISTORY|CAREER\s+HISTORY)\s*:?\s*$/i,
  educationHeader: /^(EDUCATION|ACADEMIC\s+BACKGROUND|ACADEMIC|QUALIFICATIONS)\s*:?\s*$/i,
  summaryHeader: /^(PROFESSIONAL\s+SUMMARY|EXECUTIVE\s+SUMMARY|CAREER\s+SUMMARY|PROFILE\s+SUMMARY|SUMMARY\s+OF\s+QUALIFICATIONS|SUMMARY|OBJECTIVE|CAREER\s+OBJECTIVE|PROFESSIONAL\s+OBJECTIVE|PROFILE|ABOUT\s+ME|ABOUT)\s*:?\s*$/i,
  sectionHeader: /^(EXPERIENCE|PROFESSIONAL\s+EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT(?:\s+HISTORY)?|WORK\s+HISTORY|CAREER\s+HISTORY|EDUCATION|ACADEMIC\s+BACKGROUND|SKILLS|TECHNICAL\s+SKILLS|CORE\s+COMPETENCIES|PROJECTS|CERTIFICATIONS|AWARDS|REFERENCES|ACCOMPLISHMENTS)\s*:?\s*$/i,

  // Job title patterns
  jobTitle: [
    /(?:Senior|Junior|Lead|Principal|Staff|Associate|Sr\.?|Jr\.?)?\s*(?:Software|Frontend|Backend|Full[- ]?Stack|UI|UX|DevOps|Data|ML|AI|Cloud|Mobile|Web|QA|Platform|SRE|Solutions?|Systems?)?\s*(?:Engineer|Developer|Architect|Designer|Scientist|Analyst|Manager|Specialist|Consultant|Lead)/i,
    /(?:CEO|CTO|CFO|COO|VP|Director|Manager|Lead|Head|Principal|Staff|Senior|Junior)\s+(?:of\s+)?(?:\w+\s*)+/i,
    /\b(?:Engineer|Developer|Architect|Designer|Manager)\b.*\b(?:I{1,3}|IV|V|1|2|3|4|5)?\b/i
  ],

  // Degree patterns
  degree: /(Bachelor|Master|Ph\.?D|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|MBA|Associate|Doctor|Diploma|Certificate|Bootcamp|Immersive|Program)(?:'?s)?(?:\s+(?:of|in))?\s*(?:Science|Arts|Engineering|Business|Computer|Information|Technology|Software)?/i,
  institution: /([A-Z][A-Za-z\s]+(?:University|College|Institute|School|Academy|Reactor|Bootcamp|Program))/i,
  gpa: /GPA[:\s]*(\d+\.?\d*)/i
};

// Common skill patterns for extraction
const SKILL_PATTERNS = [
  /JavaScript/gi, /TypeScript/gi, /Python/gi, /Java(?!Script)/gi, /C\+\+/gi, /C#/gi,
  /React/gi, /Angular/gi, /Vue/gi, /Node\.?js/gi, /Express/gi, /Django/gi, /Flask/gi,
  /SQL/gi, /PostgreSQL/gi, /MongoDB/gi, /MySQL/gi, /Redis/gi,
  /AWS/gi, /Azure/gi, /GCP/gi, /Docker/gi, /Kubernetes/gi, /Git/gi,
  /HTML/gi, /CSS/gi, /SASS/gi, /REST/gi, /GraphQL/gi, /API/gi,
  /Machine Learning/gi, /AI/gi, /Data Science/gi, /TensorFlow/gi, /PyTorch/gi,
  /Agile/gi, /Scrum/gi, /CI\/CD/gi, /DevOps/gi, /Linux/gi,
  /Swift/gi, /Kotlin/gi, /Go(?:lang)?/gi, /Rust/gi, /Ruby/gi, /PHP/gi,
  /Spring/gi, /\.NET/gi, /Microservices/gi, /Serverless/gi
];

// ═══════════════════════════════════════════════════════════════
// EXTRACTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Extract contact information from resume text
 * @param {string} text - Resume text
 * @returns {Object} Contact info object
 */
function extractContactInfo(text) {
  const emailMatch = text.match(PATTERNS.email);
  const phoneMatch = text.match(PATTERNS.phone);
  const linkedinMatch = text.match(PATTERNS.linkedin);
  const githubMatch = text.match(PATTERNS.github);
  const websiteMatch = text.match(PATTERNS.website);
  const locationMatch = text.match(PATTERNS.location);

  return {
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
    linkedinUrl: linkedinMatch ? linkedinMatch[0] : null,
    githubUrl: githubMatch ? githubMatch[0] : null,
    website: websiteMatch && !websiteMatch[0].includes('linkedin') && !websiteMatch[0].includes('github')
      ? websiteMatch[0] : null,
    location: locationMatch ? `${locationMatch[1]}, ${locationMatch[2]}` : null
  };
}

/**
 * Extract name from first few lines of resume
 * @param {string[]} lines - Resume lines
 * @returns {Object} Name object with firstName and lastName
 */
function extractName(lines) {
  let firstName = null;
  let lastName = null;

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    // Skip lines that look like contact info, titles, or are too long
    if (line.includes('@') || line.includes('http') || line.match(/^\d/) || line.length > 40) continue;
    
    // Look for a name pattern (2-3 words, capitalized)
    const nameMatch = line.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?$/);
    if (nameMatch) {
      firstName = nameMatch[1];
      lastName = nameMatch[3] || nameMatch[2];
      break;
    }
    
    // Simpler pattern: just capitalized words
    const words = line.split(/\s+/).filter(w => /^[A-Z][a-z]+$/.test(w));
    if (words.length >= 2 && words.length <= 3) {
      firstName = words[0];
      lastName = words[words.length - 1];
      break;
    }
  }

  return { firstName, lastName };
}

/**
 * Extract skills from resume text
 * @param {string} text - Resume text
 * @returns {string[]} Array of skills
 */
function extractSkills(text) {
  const skills = [];
  const seenSkills = new Set();

  for (const pattern of SKILL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      const skill = matches[0];
      const normalizedSkill = skill.toLowerCase();
      if (!seenSkills.has(normalizedSkill)) {
        seenSkills.add(normalizedSkill);
        skills.push(skill);
      }
    }
  }

  return skills;
}

/**
 * Parse date string to ISO format (YYYY-MM-DD)
 * @param {string} dateStr - Date string to parse
 * @returns {string|null} ISO date string or null
 */
function parseDateToISO(dateStr) {
  if (!dateStr) return null;

  // Handle "Present", "Current", etc.
  if (/present|current|now|ongoing/i.test(dateStr)) {
    return null;
  }

  // Handle MM/YYYY format
  const mmyyyyMatch = dateStr.match(/(\d{1,2})\/(\d{4})/);
  if (mmyyyyMatch) {
    const month = mmyyyyMatch[1].padStart(2, '0');
    return `${mmyyyyMatch[2]}-${month}-01`;
  }

  // Handle Month YYYY format
  const monthYearMatch = dateStr.match(/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.\s]*(\d{4})/i);
  if (monthYearMatch) {
    const monthMap = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const month = monthMap[monthYearMatch[1].toLowerCase().substring(0, 3)];
    return `${monthYearMatch[2]}-${month}-01`;
  }

  // Handle just year
  const yearMatch = dateStr.match(/(\d{4})/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }

  return null;
}

/**
 * Check if a date string indicates current position
 * @param {string} dateStr - Date string to check
 * @returns {boolean}
 */
function isCurrentPosition(dateStr) {
  return /present|current|now|ongoing/i.test(dateStr);
}

/**
 * Find section start index in lines array
 * @param {string[]} lines - Resume lines
 * @param {RegExp} headerPattern - Pattern to match section header
 * @returns {number} Line index or -1 if not found
 */
function findSectionIndex(lines, headerPattern) {
  for (let i = 0; i < lines.length; i++) {
    if (headerPattern.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

/**
 * Extract section content between two section headers
 * @param {string} text - Full text
 * @param {string} header - Start header
 * @param {string[]} endHeaders - Possible end headers
 * @returns {string} Section content
 */
function extractSectionContent(text, header, endHeaders) {
  const headerMatch = text.match(new RegExp(`(?:^|\\n)\\s*${header}\\s*[:\\n]?`, 'im'));
  if (!headerMatch) return '';

  const startIndex = headerMatch.index + headerMatch[0].length;
  const remainingText = text.substring(startIndex);

  const endPattern = new RegExp(
    `(?:^|\\n)\\s*(${endHeaders.join('|')})\\s*[:\\n]`,
    'im'
  );
  const endMatch = remainingText.match(endPattern);

  return endMatch
    ? remainingText.substring(0, endMatch.index)
    : remainingText;
}

module.exports = {
  PATTERNS,
  SKILL_PATTERNS,
  extractContactInfo,
  extractName,
  extractSkills,
  parseDateToISO,
  isCurrentPosition,
  findSectionIndex,
  extractSectionContent
};
