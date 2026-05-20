/**
 * Candidate Import Helpers
 * 
 * Helper functions for duplicate detection and scoring.
 */

/**
 * Find duplicate entries within a set of rows (internal duplicates)
 * @param {Array} rows - Array of candidate rows
 * @returns {Object} Object with duplicates array and unique rows
 */
function findInternalDuplicates(rows) {
  const seen = new Map();
  const duplicates = [];
  const uniqueRows = [];
  
  for (const row of rows) {
    const email = row.email?.toLowerCase().trim();
    
    if (!email) {
      uniqueRows.push(row);
      continue;
    }
    
    if (seen.has(email)) {
      duplicates.push({
        row: row.rowNumber,
        email,
        duplicateOf: seen.get(email)
      });
    } else {
      seen.set(email, row.rowNumber);
      uniqueRows.push(row);
    }
  }
  
  return { duplicates, uniqueRows };
}

/**
 * Calculate a basic match score between a profile and job
 * @param {Object} profile - Candidate profile
 * @param {Object} job - Job posting
 * @returns {number} Score between 0 and 100
 */
function calculateBasicScore(profile, job) {
  let score = 50; // Base score
  
  // Check for skill matches
  const profileSkills = Object.keys(profile.skills || {}).map(s => s.toLowerCase());
  const jobSkills = (job.skills || []).map(s => s.toLowerCase());
  
  const matchedSkills = profileSkills.filter(s => jobSkills.includes(s));
  score += matchedSkills.length * 5; // 5 points per matched skill
  
  // Check title similarity
  if (profile.title && job.title) {
    const profileTitle = profile.title.toLowerCase();
    const jobTitle = job.title.toLowerCase();
    
    if (profileTitle.includes(jobTitle) || jobTitle.includes(profileTitle)) {
      score += 15;
    }
  }
  
  // Check location match
  if (profile.location && job.location) {
    if (profile.location.toLowerCase().includes(job.location.toLowerCase()) ||
        job.location.toLowerCase().includes(profile.location.toLowerCase())) {
      score += 10;
    }
  }
  
  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Generate a unique import ID
 * @returns {string} UUID for the import batch
 */
function generateImportId() {
  return require('crypto').randomUUID();
}

/**
 * Format import statistics
 * @param {Object} importBatch - Import batch record
 * @returns {Object} Formatted statistics
 */
function formatImportStats(importBatch) {
  return {
    total: importBatch.totalCount || 0,
    processed: importBatch.processedCount || 0,
    succeeded: importBatch.successCount || 0,
    failed: importBatch.errorCount || 0,
    duplicates: importBatch.duplicateCount || 0,
    pending: (importBatch.totalCount || 0) - (importBatch.processedCount || 0),
    progress: importBatch.totalCount > 0 
      ? Math.round((importBatch.processedCount / importBatch.totalCount) * 100) 
      : 0
  };
}

/**
 * Categorize import status
 * @param {string} status - Raw status string
 * @returns {string} Normalized status category
 */
function categorizeStatus(status) {
  const statusMap = {
    'pending': 'pending',
    'processing': 'processing',
    'completed': 'completed',
    'partial': 'completed',
    'failed': 'failed',
    'error': 'failed',
    'cancelled': 'cancelled'
  };
  
  return statusMap[status?.toLowerCase()] || 'unknown';
}

/**
 * Calculate estimated time remaining for import
 * @param {number} processed - Number processed
 * @param {number} total - Total count
 * @param {number} elapsedMs - Elapsed time in ms
 * @returns {number} Estimated remaining time in ms
 */
function estimateRemainingTime(processed, total, elapsedMs) {
  if (processed === 0) return null;
  
  const avgTimePerItem = elapsedMs / processed;
  const remaining = total - processed;
  
  return Math.round(avgTimePerItem * remaining);
}

module.exports = {
  findInternalDuplicates,
  calculateBasicScore,
  generateImportId,
  formatImportStats,
  categorizeStatus,
  estimateRemainingTime
};
