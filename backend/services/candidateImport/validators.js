/**
 * Candidate Import Validators
 * 
 * Validation functions for candidate import data.
 */

/**
 * Required CSV columns for import
 */
const REQUIRED_COLUMNS = ['email'];

/**
 * Optional CSV columns for import
 */
const OPTIONAL_COLUMNS = [
  'name', 'first_name', 'last_name', 'linkedin_url', 
  'phone', 'resume_url', 'title', 'company', 'location'
];

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

/**
 * Validate LinkedIn URL format
 * @param {string} url - LinkedIn URL to validate
 * @returns {boolean}
 */
function isValidLinkedInUrl(url) {
  if (!url) return false;
  const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/i;
  return linkedinRegex.test(url.trim());
}

/**
 * Validate phone number format (basic validation)
 * @param {string} phone - Phone number to validate
 * @returns {boolean}
 */
function isValidPhone(phone) {
  if (!phone) return false;
  // Allow various formats: +1-234-567-8900, (234) 567-8900, 234.567.8900, etc.
  const phoneRegex = /^[\d\s\-\.\(\)\+]+$/;
  const digits = phone.replace(/\D/g, '');
  return phoneRegex.test(phone) && digits.length >= 7 && digits.length <= 15;
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
function isValidUrl(url) {
  if (!url) return false;
  try {
    new URL(url.startsWith('http') ? url : `https://${url}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a candidate row data
 * @param {Object} row - Candidate data row
 * @returns {Object} Validation result with isValid and errors
 */
function validateCandidateRow(row) {
  const errors = [];
  
  // Check required fields
  if (!row.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(row.email)) {
    errors.push('Invalid email format');
  }
  
  // Validate optional fields if present
  if (row.linkedin_url && !isValidLinkedInUrl(row.linkedin_url)) {
    errors.push('Invalid LinkedIn URL format');
  }
  
  if (row.phone && !isValidPhone(row.phone)) {
    // Warning only, don't fail validation
    console.warn(`Warning: Phone number format may be invalid: ${row.phone}`);
  }
  
  if (row.resume_url && !isValidUrl(row.resume_url)) {
    errors.push('Invalid resume URL format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Normalize email for comparison
 * @param {string} email - Email to normalize
 * @returns {string}
 */
function normalizeEmail(email) {
  if (!email) return '';
  return email.trim().toLowerCase();
}

module.exports = {
  REQUIRED_COLUMNS,
  OPTIONAL_COLUMNS,
  isValidEmail,
  isValidLinkedInUrl,
  isValidPhone,
  isValidUrl,
  validateCandidateRow,
  normalizeEmail
};
