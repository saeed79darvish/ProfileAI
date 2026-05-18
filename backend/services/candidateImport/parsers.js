/**
 * Candidate Import Parsers
 * 
 * CSV parsing and data normalization utilities.
 */

const { parse } = require('csv-parse');
const { isValidEmail, validateCandidateRow } = require('./validators');

/**
 * Column name mappings for normalization
 */
const COLUMN_MAPPINGS = {
  'e_mail': 'email',
  'email_address': 'email',
  'linkedin': 'linkedin_url',
  'linkedin_profile': 'linkedin_url',
  'linkedin_profile_url': 'linkedin_url',
  'phone_number': 'phone',
  'mobile': 'phone',
  'mobile_phone': 'phone',
  'telephone': 'phone',
  'full_name': 'name',
  'candidate_name': 'name',
  'firstname': 'first_name',
  'lastname': 'last_name',
  'surname': 'last_name',
  'job_title': 'title',
  'current_title': 'title',
  'position': 'title',
  'current_company': 'company',
  'employer': 'company',
  'organization': 'company',
  'city': 'location',
  'resume': 'resume_url',
  'cv_url': 'resume_url',
  'cv': 'resume_url'
};

/**
 * Normalize column names (handle variations like "Email", "EMAIL", "e-mail", etc.)
 * @param {string} column - Raw column name
 * @returns {string} Normalized column name
 */
function normalizeColumnName(column) {
  const normalized = column.toLowerCase().trim().replace(/[-\s]/g, '_');
  return COLUMN_MAPPINGS[normalized] || normalized;
}

/**
 * Parse name into first and last name
 * @param {string} name - Full name string
 * @returns {Object} Object with firstName and lastName
 */
function parseName(name) {
  if (!name) return { firstName: null, lastName: null };
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

/**
 * Parse and normalize a row of candidate data
 * @param {Object} rawRow - Raw row data with original column names
 * @param {Object} columnMapping - Mapping from header index to normalized column name
 * @returns {Object} Normalized row data
 */
function normalizeRow(rawRow, columnMapping) {
  const normalized = {};
  
  for (const [index, value] of Object.entries(rawRow)) {
    const columnName = columnMapping[index];
    if (columnName) {
      normalized[columnName] = value?.trim() || null;
    }
  }
  
  // Handle name parsing
  if (normalized.name && !normalized.first_name) {
    const { firstName, lastName } = parseName(normalized.name);
    normalized.first_name = normalized.first_name || firstName;
    normalized.last_name = normalized.last_name || lastName;
  }
  
  // Normalize email
  if (normalized.email) {
    normalized.email = normalized.email.toLowerCase().trim();
  }
  
  return normalized;
}

/**
 * Parse CSV buffer and validate structure
 * @param {Buffer} buffer - CSV file buffer
 * @param {Object} options - Parsing options
 * @returns {Promise<Object>} Parsed result with rows, errors, columnMapping, headers
 */
async function parseCSV(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const errors = [];
    let headers = [];
    let columnMapping = {};
    
    const parser = parse({
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });
    
    let rowNumber = 0;
    
    parser.on('readable', function() {
      let record;
      while ((record = parser.read()) !== null) {
        rowNumber++;
        
        if (rowNumber === 1) {
          // First row is headers
          headers = record;
          
          // Build column mapping
          record.forEach((header, index) => {
            const normalized = normalizeColumnName(header);
            columnMapping[index] = normalized;
          });
          
          // Check for required columns
          const normalizedHeaders = Object.values(columnMapping);
          if (!normalizedHeaders.includes('email')) {
            errors.push({
              row: 1,
              error: 'Missing required column: email. Found columns: ' + headers.join(', ')
            });
          }
          
          continue;
        }
        
        // Parse data rows
        const rowData = {};
        record.forEach((value, index) => {
          const columnName = columnMapping[index];
          if (columnName) {
            rowData[columnName] = value?.trim() || null;
          }
        });
        
        // Handle name parsing if we have a name column but not first_name
        if (rowData.name && !rowData.first_name) {
          const { firstName, lastName } = parseName(rowData.name);
          rowData.first_name = firstName;
          rowData.last_name = rowData.last_name || lastName;
        }
        
        // Validate row
        const validation = validateCandidateRow(rowData);
        if (!validation.isValid) {
          errors.push({
            row: rowNumber,
            data: rowData,
            errors: validation.errors
          });
          continue;
        }
        
        // Normalize email
        if (rowData.email) {
          rowData.email = rowData.email.toLowerCase().trim();
        }
        
        rows.push({
          rowNumber,
          ...rowData
        });
      }
    });
    
    parser.on('error', (err) => {
      reject(err);
    });
    
    parser.on('end', () => {
      resolve({ rows, errors, columnMapping, headers });
    });
    
    // Write buffer to parser
    parser.write(buffer);
    parser.end();
  });
}

/**
 * Parse LinkedIn URLs from text or array
 * @param {string|Array} input - Text with URLs or array of URLs
 * @returns {Object} Object with validUrls and invalidUrls arrays
 */
function parseLinkedInUrls(input) {
  const validUrls = [];
  const invalidUrls = [];
  
  const urls = Array.isArray(input) 
    ? input 
    : input.split(/[\n,;]+/).map(u => u.trim()).filter(Boolean);
  
  const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/i;
  
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    
    // Try to extract LinkedIn URL if embedded in text
    const urlMatch = trimmed.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
    
    if (linkedinRegex.test(trimmed)) {
      validUrls.push(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    } else if (urlMatch) {
      validUrls.push(`https://www.${urlMatch[0]}`);
    } else {
      invalidUrls.push(trimmed);
    }
  }
  
  return { validUrls, invalidUrls };
}

/**
 * Parse emails from text or array
 * @param {string|Array} input - Text with emails or array of emails
 * @returns {Object} Object with validEmails and invalidEmails arrays
 */
function parseEmails(input) {
  const validEmails = [];
  const invalidEmails = [];
  
  const emails = Array.isArray(input)
    ? input
    : input.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
  
  for (const email of emails) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) continue;
    
    if (isValidEmail(trimmed)) {
      validEmails.push(trimmed);
    } else {
      invalidEmails.push(email);
    }
  }
  
  return { validEmails, invalidEmails };
}

module.exports = {
  COLUMN_MAPPINGS,
  normalizeColumnName,
  parseName,
  normalizeRow,
  parseCSV,
  parseLinkedInUrls,
  parseEmails
};
