/**
 * Recruitment Service - Scoring Algorithms
 * Candidate scoring and matching logic
 */

const { calculateTotalYearsExperience } = require('./helpers');

/**
 * Experience level requirements mapping
 */
const EXPERIENCE_REQUIREMENTS = {
  'entry': { min: 0, max: 1, ideal: 0 },
  'junior': { min: 0, max: 3, ideal: 1 },
  'mid': { min: 2, max: 6, ideal: 4 },
  'senior': { min: 5, max: 15, ideal: 8 },
  'lead': { min: 7, max: 20, ideal: 10 },
  'executive': { min: 10, max: 30, ideal: 15 }
};

/**
 * Score experience level match
 * @param {number} totalYears - Candidate's years of experience
 * @param {string} requiredLevel - Required experience level
 * @returns {Object} - Score and reason
 */
function scoreExperienceMatch(totalYears, requiredLevel) {
  const req = EXPERIENCE_REQUIREMENTS[requiredLevel] || EXPERIENCE_REQUIREMENTS['mid'];
  
  // Perfect match: within ideal range
  if (totalYears >= req.min && totalYears <= req.max) {
    const idealDistance = Math.abs(totalYears - req.ideal);
    const score = Math.max(15, 25 - idealDistance * 2);
    return { 
      score, 
      reason: `Experience: ${totalYears} years (${requiredLevel} level)` 
    };
  }
  
  // Overqualified
  if (totalYears > req.max) {
    return { 
      score: 10, 
      reason: `Overqualified: ${totalYears} years for ${requiredLevel}` 
    };
  }
  
  // Underqualified
  if (totalYears < req.min) {
    return { 
      score: 5, 
      reason: `Limited experience: ${totalYears} years` 
    };
  }

  return { score: 15, reason: `Experience: ${totalYears} years` };
}

/**
 * Calculate location match score
 * @param {Object} profile - Candidate profile
 * @param {string} jobLocation - Job location
 * @param {string} locationType - Location type (onsite, remote, hybrid)
 * @returns {Object} - Score and reason
 */
function scoreLocationMatch(profile, jobLocation, locationType) {
  // Remote jobs match everyone
  if (locationType === 'remote') {
    return { score: 15, reason: 'Remote position' };
  }
  
  if (!jobLocation || !profile.location) {
    return { score: 5, reason: 'Location not specified' };
  }
  
  const profileLocation = profile.location.toLowerCase();
  const jobLoc = jobLocation.toLowerCase();
  
  // Direct match
  if (profileLocation.includes(jobLoc) || jobLoc.includes(profileLocation)) {
    return { score: 15, reason: 'Location match' };
  }
  
  // Check for same country/state indicators
  const locationParts = profileLocation.split(/[,\s]+/);
  const jobParts = jobLoc.split(/[,\s]+/);
  const hasOverlap = locationParts.some(part => 
    part.length > 2 && jobParts.some(jp => jp.includes(part) || part.includes(jp))
  );
  
  if (hasOverlap) {
    return { score: 10, reason: 'Nearby location' };
  }
  
  // Hybrid can have some flexibility
  if (locationType === 'hybrid') {
    return { score: 5, reason: 'Hybrid - may require relocation' };
  }
  
  return { score: 0, reason: 'Location mismatch' };
}

/**
 * Score availability match
 * @param {Object} profile - Candidate profile
 * @returns {Object} - Score and reason
 */
function scoreAvailability(profile) {
  const status = profile.availabilityStatus;
  
  if (status === 'actively-looking') {
    return { score: 10, reason: 'Actively looking' };
  }
  
  if (status === 'open') {
    return { score: 7, reason: 'Open to opportunities' };
  }
  
  if (status === 'not-looking' || status === 'employed') {
    return { score: 3, reason: 'Not actively looking' };
  }
  
  return { score: 5, reason: 'Availability unknown' };
}

/**
 * Score title/role relevance
 * @param {Object} profile - Candidate profile
 * @param {Object} job - Job object
 * @returns {Object} - Score, reason, and matched words
 */
function scoreTitleMatch(profile, job) {
  const profileTitle = (profile.title || profile.headline || '').toLowerCase();
  const jobTitle = (job.title || '').toLowerCase();
  
  if (!profileTitle || !jobTitle) {
    return { score: 0, reason: 'No title to compare', matchedWords: [] };
  }
  
  // Extract significant words (3+ chars, not common words)
  const commonWords = ['the', 'and', 'for', 'with', 'senior', 'junior', 'lead', 'staff'];
  const titleWords = jobTitle
    .split(/[\s,\-\/]+/)
    .filter(w => w.length > 2 && !commonWords.includes(w));
  
  const matchedWords = titleWords.filter(tw => profileTitle.includes(tw));
  const matchRatio = titleWords.length > 0 ? matchedWords.length / titleWords.length : 0;
  
  // Calculate score based on match ratio (max 30 points)
  const score = Math.round(matchRatio * 30);
  
  if (matchedWords.length === 0) {
    return { score: 0, reason: 'Different role type', matchedWords: [] };
  }
  
  return { 
    score, 
    reason: `Role match: ${matchedWords.join(', ')}`,
    matchedWords 
  };
}

/**
 * Calculate weighted total score from breakdown
 * @param {Object} breakdown - Score breakdown by category
 * @param {Array} priorityFactors - Factors to prioritize
 * @param {Object} options - Additional options
 * @returns {number} - Total score (0-100)
 */
function calculateWeightedScore(breakdown, priorityFactors = [], options = {}) {
  const { hasAiKeywords = false, hasVectorSimilarity = false } = options;
  
  const weights = {
    skills: priorityFactors.includes('skills') ? 1.2 : 1.0,
    experience: priorityFactors.includes('experience') ? 1.2 : 1.0,
    location: priorityFactors.includes('location') ? 1.2 : 1.0,
    availability: priorityFactors.includes('availability') ? 1.2 : 1.0,
    profileQuality: 1.0,
    aiKeywords: 1.0,
    titleMatch: 1.0,
    vectorSimilarity: 1.0
  };

  // Compute raw weighted sum
  const rawScore = 
    (breakdown.skills || 0) * weights.skills +
    (breakdown.experience || 0) * weights.experience +
    (breakdown.location || 0) * weights.location +
    (breakdown.availability || 0) * weights.availability +
    (breakdown.profileQuality || 0) * weights.profileQuality +
    (breakdown.aiKeywords || 0) * weights.aiKeywords +
    (breakdown.titleMatch || 0) * weights.titleMatch +
    (breakdown.vectorSimilarity || 0) * weights.vectorSimilarity;

  // Calculate theoretical max for normalization
  const maxRaw = 
    40 * weights.skills +
    25 * weights.experience +
    15 * weights.location +
    10 * weights.availability +
    10 * weights.profileQuality +
    (hasAiKeywords ? 10 : 0) * weights.aiKeywords +
    30 * weights.titleMatch +
    (hasVectorSimilarity ? 15 : 0) * weights.vectorSimilarity;

  // Normalize to 0-100 range
  return Math.min(100, Math.round((rawScore / maxRaw) * 100));
}

/**
 * Simple/fallback scoring for quick filtering
 * @param {Object} profile - Candidate profile
 * @param {Object} job - Job object
 * @param {Object} options - Scoring options
 * @returns {Object} - Score and reasons
 */
function calculateSimpleScore(profile, job, options = {}) {
  const { skills = [], experienceLevel = 'mid', location = null } = options;
  
  let score = 0;
  const reasons = [];
  
  // Extract candidate skills
  const pSkills = Object.values(profile.skills || {})
    .flat()
    .map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase())
    .filter(Boolean);

  // Skills matching (25 pts each, max 100 pts)
  let skillMatches = 0;
  skills.forEach(jobSkill => {
    const skillLower = jobSkill.toLowerCase();
    if (pSkills.some(ps => ps.includes(skillLower) || skillLower.includes(ps))) {
      skillMatches++;
      if (skillMatches <= 4) {
        score += 25;
        reasons.push(`Skill: ${jobSkill}`);
      }
    }
  });

  // Title/Role relevance bonus (20 pts)
  const titleMatch = scoreTitleMatch(profile, job);
  if (titleMatch.score > 0) {
    score += Math.min(20, titleMatch.score);
    reasons.push('Relevant title/role');
  }

  // Experience level (20 pts)
  const totalYears = calculateTotalYearsExperience(profile.experience);
  const expMatch = scoreExperienceMatch(totalYears, experienceLevel);
  if (expMatch.score >= 15) {
    score += 20;
    reasons.push(expMatch.reason);
  }

  return { score, reasons };
}

module.exports = {
  EXPERIENCE_REQUIREMENTS,
  scoreExperienceMatch,
  scoreLocationMatch,
  scoreAvailability,
  scoreTitleMatch,
  calculateWeightedScore,
  calculateSimpleScore
};
