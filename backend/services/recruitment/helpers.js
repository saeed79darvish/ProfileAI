/**
 * Recruitment Service - Helper Utilities
 * Shared utility functions for recruitment operations
 */

/**
 * Calculate total years of experience from experience array
 * @param {Array} experience - Array of experience objects
 * @returns {number} - Total years of experience
 */
function calculateTotalYearsExperience(experience) {
  if (!experience || !Array.isArray(experience)) return 0;
  
  let totalMonths = 0;
  const now = new Date();
  
  experience.forEach(exp => {
    try {
      const startDate = exp.startDate ? new Date(exp.startDate) : null;
      const endDate = exp.current || !exp.endDate ? now : new Date(exp.endDate);
      
      if (startDate && !isNaN(startDate.getTime())) {
        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 
          + (endDate.getMonth() - startDate.getMonth());
        totalMonths += Math.max(0, months);
      }
    } catch (e) {
      // Skip invalid entries
    }
  });
  
  return Math.round(totalMonths / 12 * 10) / 10;
}

/**
 * Calculate profile completeness score (0-100)
 * @param {Object} profile - Profile object
 * @returns {number} - Completeness percentage
 */
function calculateProfileCompleteness(profile) {
  let completeness = 0;
  if (profile.summary) completeness += 15;
  if (profile.experience && profile.experience.length > 0) completeness += 25;
  if (profile.education && profile.education.length > 0) completeness += 15;
  if (profile.projects && profile.projects.length > 0) completeness += 15;
  if (Object.values(profile.skills || {}).flat().length > 0) completeness += 20;
  if (profile.linkedinUrl || profile.githubUrl) completeness += 10;
  return completeness;
}

/**
 * Generate scheduling slots for interviews
 * Creates available slots for the upcoming weeks
 * @param {number} weeksAhead - Number of weeks ahead to generate slots for
 * @returns {Array} - Array of available time slots
 */
function generateSchedulingSlots(weeksAhead = 2) {
  const slots = [];
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1); // Start from tomorrow
  
  const workHours = [9, 10, 11, 14, 15, 16]; // 9am-11am, 2pm-4pm
  
  for (let day = 0; day < weeksAhead * 5; day++) { // Only weekdays
    const slotDate = new Date(startDate);
    slotDate.setDate(slotDate.getDate() + day);
    
    // Skip weekends
    if (slotDate.getDay() === 0 || slotDate.getDay() === 6) continue;
    
    workHours.forEach(hour => {
      const slot = new Date(slotDate);
      slot.setHours(hour, 0, 0, 0);
      slots.push(slot.toISOString());
    });
  }
  
  return slots;
}

/**
 * Extract keywords from job description
 * @param {string} description - Job description text
 * @returns {Array} - Array of extracted keywords
 */
function extractKeywordsFromDescription(description) {
  if (!description) return [];
  
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'our', 'you', 'your', 'we', 'us', 'they', 'them', 'their', 'this',
    'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there'
  ]);
  
  // Extract words, filter, and get unique
  const words = description.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  // Count frequency and return top keywords
  const frequency = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

/**
 * Extract role keywords from job title
 * Works for any industry
 * @param {string} title - Job title
 * @returns {Array} - Role keywords
 */
function extractRoleWords(title) {
  const roleKeywords = [
    // Tech/Engineering
    'frontend', 'front-end', 'backend', 'back-end', 'fullstack', 'full-stack',
    'devops', 'sre', 'cloud', 'mobile', 'ios', 'android', 'react', 'vue', 
    'angular', 'node', 'python', 'java', 'data', 'machine learning', 'ml', 'ai',
    'software', 'developer', 'engineer', 'architect', 'qa', 'security',
    // Product/Design
    'product', 'design', 'ux', 'ui', 'creative', 'brand', 'content',
    // Business/Management
    'manager', 'director', 'lead', 'principal', 'senior', 'junior',
    'head', 'vp', 'chief', 'analyst', 'consultant', 'strategist',
    // Sales/Marketing
    'sales', 'marketing', 'growth', 'account', 'business development',
    // HR/Operations
    'hr', 'recruiter', 'operations', 'finance', 'legal'
  ];
  
  const titleLower = (title || '').toLowerCase();
  return roleKeywords.filter(keyword => titleLower.includes(keyword));
}

module.exports = {
  calculateTotalYearsExperience,
  calculateProfileCompleteness,
  generateSchedulingSlots,
  extractKeywordsFromDescription,
  extractRoleWords
};
