const express = require('express');
const router = express.Router();
const { Profile, User, Job } = require('../models');
const { Op } = require('sequelize');
const aiService = require('../services/aiService');
const sequelize = require('../config/database');
const { embeddingService } = require('../services/embeddingService');

// ========================================
// SMART SEARCH - Enhanced Criteria Matching (with RAG vector search)
// ========================================

// @route   POST /api/smart-match
// @desc    Get smart AI-powered candidate matches based on comprehensive criteria
// @access  Public
router.post('/match', async (req, res) => {
  try {
    const { 
      keywords, 
      skills, 
      experienceLevel, 
      mustHaveAI,
      // Enhanced criteria
      location,
      educationLevel,
      certifications,
      minYearsExperience,
      maxYearsExperience,
      availabilityStatus,
      jobId, // Optional: match against specific job requirements
      useSemanticSearch // Optional: enable RAG vector search (default: auto-detect)
    } = req.body;

    // ═══════════════════════════════════════════════════════════════
    // RAG VECTOR SEARCH PATH
    // When keywords/skills are provided + VOYAGE_API_KEY is configured,
    // use pgvector to retrieve semantically similar candidates first
    // ═══════════════════════════════════════════════════════════════
    const hasSearchTerms = (keywords && keywords.length > 0) || (skills && skills.length > 0);
    const canUseVectorSearch = process.env.VOYAGE_API_KEY && (useSemanticSearch !== false);
    let vectorResults = null;
    let usedVectorSearch = false;

    if (hasSearchTerms && canUseVectorSearch) {
      try {
        // Build query text from search criteria
        const queryParts = [];
        if (keywords && keywords.length > 0) queryParts.push(keywords.join(', '));
        if (skills && skills.length > 0) queryParts.push(`Skills: ${skills.join(', ')}`);
        if (experienceLevel) queryParts.push(`Experience level: ${experienceLevel}`);
        
        // If jobId provided, include job details in query
        if (jobId) {
          const job = await Job.findByPk(jobId);
          if (job) {
            queryParts.push(embeddingService.buildJobQueryText(job));
          }
        }

        const queryText = queryParts.join('. ');
        const queryEmbedding = await embeddingService.generateQueryEmbedding(queryText);

        if (queryEmbedding) {
          vectorResults = await embeddingService.searchSimilarProfiles(queryEmbedding, {
            limit: 50,
            location: location || null,
            availabilityStatuses: availabilityStatus 
              ? [availabilityStatus] 
              : ['actively-looking', 'open', 'not-looking']
          });
          usedVectorSearch = vectorResults.length > 0;
        }
      } catch (err) {
        console.warn('[SmartMatch] Vector search failed, falling back:', err.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // If vector search succeeded, score those results; otherwise fall back
    // ═══════════════════════════════════════════════════════════════
    let profiles;
    if (usedVectorSearch) {
      // Convert vector results to Profile-like objects
      profiles = vectorResults.map(row => {
        const profile = Profile.build(row, { isNewRecord: false });
        profile.user = { firstName: row.firstName, lastName: row.lastName, email: row.email };
        profile.dataValues.user = profile.user;
        profile._vectorSimilarity = row.similarity;
        return profile;
      });
    } else {
      // Fallback: standard SQL query
      const where = { isPublic: true };
      if (mustHaveAI) where.aiSummary = { [Op.not]: null };
      if (location) where.location = { [Op.iLike]: `%${location}%` };
      if (availabilityStatus) where.availabilityStatus = availabilityStatus;

      profiles = await Profile.findAll({
        where,
        include: [{
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email']
        }]
      });
    }

    // If jobId provided, fetch job requirements for better matching
    let jobRequirements = null;
    if (jobId) {
      const job = await Job.findByPk(jobId);
      if (job) {
        jobRequirements = {
          skills: job.skills || [],
          experienceLevel: job.experienceLevel,
          location: job.location,
          description: job.description,
          requirements: job.requirements
        };
      }
    }

    // Calculate match scores with enhanced algorithm
    const scoredProfiles = profiles.map(profile => {
      let score = 0;
      const reasons = [];
      const matchDetails = {
        skillsMatched: [],
        skillsGaps: [],
        educationMatch: false,
        experienceMatch: false,
        locationMatch: false,
        certificationsMatched: []
      };

      // 1. KEYWORD MATCHING (title, summary, AI insights)
      if (keywords && keywords.length > 0) {
        const searchText = `${profile.title} ${profile.summary} ${profile.aiSummary || ''} ${profile.aiRecruiterInsights || ''}`.toLowerCase();
        keywords.forEach(keyword => {
          if (searchText.includes(keyword.toLowerCase())) {
            score += 15;
            reasons.push(`Matches keyword: ${keyword}`);
          }
        });
      }

      // 2. SKILLS MATCHING (enhanced with job requirements)
      const searchSkills = jobRequirements?.skills?.length > 0 
        ? jobRequirements.skills 
        : (skills || []);
      
      if (searchSkills.length > 0) {
        const profileSkills = Object.values(profile.skills || {}).flat().map(s => 
          typeof s === 'string' ? s.toLowerCase() : (s.name || '').toLowerCase()
        );
        
        searchSkills.forEach(skill => {
          const skillLower = skill.toLowerCase();
          const hasSkill = profileSkills.some(ps => ps.includes(skillLower) || skillLower.includes(ps));
          if (hasSkill) {
            score += 20;
            reasons.push(`Has skill: ${skill}`);
            matchDetails.skillsMatched.push(skill);
          } else {
            matchDetails.skillsGaps.push(skill);
          }
        });
      }

      // 3. EXPERIENCE LEVEL MATCHING
      const expCount = (profile.experience || []).length;
      const totalYears = calculateTotalYearsExperience(profile.experience);
      const targetExpLevel = jobRequirements?.experienceLevel || experienceLevel;
      
      if (targetExpLevel) {
        if (targetExpLevel === 'senior' && (expCount >= 5 || totalYears >= 7)) {
          score += 25;
          reasons.push('Senior level experience');
          matchDetails.experienceMatch = true;
        } else if (targetExpLevel === 'mid' && (expCount >= 3 || totalYears >= 3)) {
          score += 25;
          reasons.push('Mid-level experience');
          matchDetails.experienceMatch = true;
        } else if (targetExpLevel === 'junior' && expCount >= 1) {
          score += 25;
          reasons.push('Junior level experience');
          matchDetails.experienceMatch = true;
        } else if (targetExpLevel === 'entry') {
          score += 20;
          reasons.push('Entry level position match');
          matchDetails.experienceMatch = true;
        }
      }

      // 4. YEARS OF EXPERIENCE RANGE
      if (minYearsExperience !== undefined || maxYearsExperience !== undefined) {
        const min = minYearsExperience || 0;
        const max = maxYearsExperience || 50;
        if (totalYears >= min && totalYears <= max) {
          score += 15;
          reasons.push(`Experience (${totalYears}y) within range ${min}-${max}`);
        }
      }

      // 5. EDUCATION LEVEL MATCHING
      if (educationLevel && profile.education?.length > 0) {
        const educationLevels = { 'phd': 4, 'masters': 3, 'bachelors': 2, 'associates': 1, 'highschool': 0 };
        const requiredLevel = educationLevels[educationLevel.toLowerCase()] || 0;
        
        const candidateEducation = profile.education.map(e => {
          const degree = (e.degree || '').toLowerCase();
          if (degree.includes('phd') || degree.includes('doctor')) return 4;
          if (degree.includes('master') || degree.includes('mba') || degree.includes('ms ') || degree.includes('m.s.')) return 3;
          if (degree.includes('bachelor') || degree.includes('bs ') || degree.includes('b.s.') || degree.includes('ba ')) return 2;
          if (degree.includes('associate')) return 1;
          return 0;
        });
        
        const maxEducation = Math.max(...candidateEducation, 0);
        if (maxEducation >= requiredLevel) {
          score += 15;
          reasons.push(`Education meets ${educationLevel} requirement`);
          matchDetails.educationMatch = true;
        }
      }

      // 6. CERTIFICATIONS MATCHING
      if (certifications && certifications.length > 0 && profile.certifications?.length > 0) {
        const profileCerts = profile.certifications.map(c => 
          (typeof c === 'string' ? c : c.name || '').toLowerCase()
        );
        
        certifications.forEach(cert => {
          const certLower = cert.toLowerCase();
          if (profileCerts.some(pc => pc.includes(certLower) || certLower.includes(pc))) {
            score += 15;
            reasons.push(`Has certification: ${cert}`);
            matchDetails.certificationsMatched.push(cert);
          }
        });
      }

      // 7. LOCATION MATCHING (enhanced)
      const targetLocation = jobRequirements?.location || location;
      if (targetLocation && profile.location) {
        const profileLoc = profile.location.toLowerCase();
        const targetLoc = targetLocation.toLowerCase();
        if (profileLoc.includes(targetLoc) || targetLoc.includes(profileLoc)) {
          score += 10;
          reasons.push(`Location match: ${profile.location}`);
          matchDetails.locationMatch = true;
        }
      }

      // 8. AI ENHANCEMENT BONUS
      if (profile.aiSummary) {
        score += 10;
        reasons.push('Profile enhanced with AI');
      }

      if (profile.aiStrengths && profile.aiStrengths.length > 0) {
        score += 10;
        reasons.push('Has identified strengths');
      }

      // 9. PROFILE COMPLETENESS
      const completeness = calculateCompleteness(profile);
      if (completeness >= 80) {
        score += 15;
        reasons.push('Highly complete profile');
      } else if (completeness >= 60) {
        score += 8;
        reasons.push('Well-documented profile');
      }

      // 10. RAG VECTOR SIMILARITY BOOST (when vector search was used)
      if (profile._vectorSimilarity && profile._vectorSimilarity > 0) {
        const vectorBoost = Math.round(profile._vectorSimilarity * 20);
        score += vectorBoost;
        if (profile._vectorSimilarity >= 0.7) {
          reasons.push(`High semantic relevance (${Math.round(profile._vectorSimilarity * 100)}%)`);
        } else if (profile._vectorSimilarity >= 0.5) {
          reasons.push(`Good semantic relevance (${Math.round(profile._vectorSimilarity * 100)}%)`);
        }
        matchDetails.vectorSimilarity = Math.round(profile._vectorSimilarity * 100);
      }

      return {
        profile: profile.toJSON(),
        matchScore: Math.min(score, 100),
        matchReasons: reasons,
        matchDetails,
        completeness,
        totalYearsExperience: totalYears
      };
    });

    // Sort by match score
    scoredProfiles.sort((a, b) => b.matchScore - a.matchScore);

    // Return top matches with analytics summary
    const matchedProfiles = scoredProfiles.filter(p => p.matchScore > 0);
    
    res.json({
      matches: matchedProfiles.slice(0, 20),
      total: matchedProfiles.length,
      searchMethod: usedVectorSearch ? 'rag_vector' : 'keyword',
      // Search quality metrics
      searchMetrics: {
        totalCandidatesSearched: profiles.length,
        matchedCandidates: matchedProfiles.length,
        avgMatchScore: matchedProfiles.length > 0 
          ? Math.round(matchedProfiles.reduce((sum, p) => sum + p.matchScore, 0) / matchedProfiles.length)
          : 0,
        topScore: matchedProfiles[0]?.matchScore || 0,
        usedVectorSearch,
        criteriaUsed: {
          keywords: keywords?.length || 0,
          skills: skills?.length || 0,
          experienceLevel: !!experienceLevel,
          location: !!location,
          educationLevel: !!educationLevel,
          certifications: certifications?.length || 0,
          jobId: !!jobId
        }
      }
    });
  } catch (error) {
    console.error('Error in smart match:', error);
    res.status(500).json({ error: 'Failed to perform smart match' });
  }
});

// Calculate total years of experience from experience array
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
  
  return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal
}

// @route   GET /api/smart-match/analytics
// @desc    Get comprehensive analytics about available talent
// @access  Public
router.get('/analytics', async (req, res) => {
  try {
    const profiles = await Profile.findAll({
      where: { isPublic: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName']
      }]
    });

    // Calculate experience distribution using calculated years
    const experienceDistribution = {
      entry: 0,
      junior: 0,
      mid: 0,
      senior: 0
    };
    
    profiles.forEach(p => {
      const years = calculateTotalYearsExperience(p.experience);
      if (years < 1) experienceDistribution.entry++;
      else if (years < 3) experienceDistribution.junior++;
      else if (years < 7) experienceDistribution.mid++;
      else experienceDistribution.senior++;
    });

    // Education level distribution
    const educationDistribution = {
      phd: 0,
      masters: 0,
      bachelors: 0,
      associates: 0,
      other: 0
    };
    
    profiles.forEach(p => {
      if (!p.education || p.education.length === 0) {
        educationDistribution.other++;
        return;
      }
      const highestDegree = p.education.reduce((highest, edu) => {
        const degree = (edu.degree || '').toLowerCase();
        if (degree.includes('phd') || degree.includes('doctor')) return 'phd';
        if ((degree.includes('master') || degree.includes('mba')) && highest !== 'phd') return 'masters';
        if (degree.includes('bachelor') && !['phd', 'masters'].includes(highest)) return 'bachelors';
        if (degree.includes('associate') && !['phd', 'masters', 'bachelors'].includes(highest)) return 'associates';
        return highest;
      }, 'other');
      educationDistribution[highestDegree]++;
    });

    // Location distribution
    const locationCounts = {};
    profiles.forEach(p => {
      if (p.location) {
        const loc = p.location.trim();
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      }
    });
    const topLocations = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([location, count]) => ({ location, count }));

    // Certifications distribution
    const certCounts = {};
    profiles.forEach(p => {
      (p.certifications || []).forEach(cert => {
        const certName = typeof cert === 'string' ? cert : cert.name || 'Unknown';
        certCounts[certName] = (certCounts[certName] || 0) + 1;
      });
    });
    const topCertifications = Object.entries(certCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([certification, count]) => ({ certification, count }));

    // Availability distribution
    const availabilityCounts = {
      open: profiles.filter(p => p.availabilityStatus === 'open' || !p.availabilityStatus).length,
      'actively-looking': profiles.filter(p => p.availabilityStatus === 'actively-looking').length,
      'not-looking': profiles.filter(p => p.availabilityStatus === 'not-looking').length
    };

    // Gather comprehensive analytics
    const analytics = {
      totalProfiles: profiles.length,
      aiEnhanced: profiles.filter(p => p.aiSummary).length,
      aiEnhancedPercent: Math.round(profiles.filter(p => p.aiSummary).length / profiles.length * 100),
      
      // Distribution metrics
      byExperienceLevel: experienceDistribution,
      byEducationLevel: educationDistribution,
      byAvailability: availabilityCounts,
      
      // Top rankings
      topSkills: getTopSkills(profiles, 20),
      topLocations,
      topCertifications,
      
      // Quality metrics
      averageCompleteness: Math.round(
        profiles.reduce((sum, p) => sum + calculateCompleteness(p), 0) / profiles.length
      ),
      profilesWithProjects: profiles.filter(p => (p.projects || []).length > 0).length,
      profilesWithCertifications: profiles.filter(p => (p.certifications || []).length > 0).length,
      
      // Count stats
      locationsAvailable: [...new Set(profiles.map(p => p.location).filter(Boolean))].length,
      uniqueSkillsCount: [...new Set(profiles.flatMap(p => Object.values(p.skills || {}).flat()))].length,
      
      // Time-based (for trend analysis)
      generatedAt: new Date()
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// ========================================
// SEARCH FEEDBACK & REFINEMENT
// ========================================

// @route   POST /api/smart-match/feedback
// @desc    Submit feedback on search results to improve algorithm
// @access  Public (should be protected in production)
router.post('/feedback', async (req, res) => {
  try {
    const {
      searchId,
      profileId,
      feedbackType, // 'relevant', 'not_relevant', 'good_match', 'poor_match', 'hired'
      rating, // 1-5 scale
      notes,
      searchCriteria // Original search criteria for context
    } = req.body;

    // In a production system, this would be stored in a SearchFeedback model
    // For now, we log it and return success
    console.log('Smart Match Feedback received:', {
      searchId,
      profileId,
      feedbackType,
      rating,
      notes,
      searchCriteria,
      timestamp: new Date()
    });

    // TODO: Store in database for ML/algorithm improvement
    // const feedback = await SearchFeedback.create({...});

    res.json({
      success: true,
      message: 'Feedback recorded. Thank you for helping improve our matching algorithm!',
      feedbackId: `fb_${Date.now()}`
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

// @route   GET /api/smart-match/search-history
// @desc    Get recruiter's search history for refinement
// @access  Private (should require auth)
router.get('/search-history', async (req, res) => {
  try {
    // In production, this would fetch from SearchHistory model filtered by user
    // For now, return mock data structure
    res.json({
      searches: [],
      message: 'Search history feature - store searches to enable this'
    });
  } catch (error) {
    console.error('Error fetching search history:', error);
    res.status(500).json({ error: 'Failed to fetch search history' });
  }
});

function calculateCompleteness(profile) {
  let completeness = 0;
  if (profile.summary) completeness += 15;
  if (profile.experience && profile.experience.length > 0) completeness += 25;
  if (profile.education && profile.education.length > 0) completeness += 15;
  if (profile.projects && profile.projects.length > 0) completeness += 15;
  if (Object.values(profile.skills || {}).flat().length > 0) completeness += 20;
  if (profile.linkedinUrl || profile.githubUrl) completeness += 10;
  return completeness;
}

function getTopSkills(profiles, limit = 10) {
  const skillCounts = {};
  
  profiles.forEach(profile => {
    const skills = Object.values(profile.skills || {}).flat();
    skills.forEach(skill => {
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    });
  });

  return Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([skill, count]) => ({ skill, count }));
}

// ========== RECRUITER AI FEATURES ==========

// @route   POST /api/smart-match/interview-questions/:userId
// @desc    Generate AI-powered interview questions for a candidate
// @access  Public (can be protected later)
router.post('/interview-questions/:userId', async (req, res) => {
  try {
    const { roleContext } = req.body;
    
    // Look up by userId instead of profile.id for consistency
    const profile = await Profile.findOne({
      where: { userId: req.params.userId, isPublic: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName']
      }]
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profileData = {
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      title: profile.title,
      summary: profile.summary,
      skills: profile.skills,
      experience: profile.experience,
      projects: profile.projects
    };

    const questions = await aiService.generateInterviewQuestions(profileData, roleContext);

    res.json({
      candidateName: `${profile.user.firstName} ${profile.user.lastName}`,
      questions,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error generating interview questions:', error);
    res.status(500).json({ error: error.message || 'Failed to generate interview questions' });
  }
});

// @route   POST /api/smart-match/compare-candidates
// @desc    AI-powered comparison of multiple candidates
// @access  Public
router.post('/compare-candidates', async (req, res) => {
  try {
    const { profileIds, jobRequirements } = req.body;

    if (!profileIds || profileIds.length < 2) {
      return res.status(400).json({ error: 'Please provide at least 2 profile IDs to compare' });
    }

    const profiles = await Profile.findAll({
      where: {
        id: { [Op.in]: profileIds },
        isPublic: true
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName']
      }]
    });

    if (profiles.length < 2) {
      return res.status(404).json({ error: 'Not enough valid profiles found' });
    }

    const candidates = profiles.map(p => ({
      id: p.id,
      name: `${p.user.firstName} ${p.user.lastName}`,
      title: p.title,
      skills: p.skills,
      experience: p.experience,
      aiStrengths: p.aiStrengths,
      aiSummary: p.aiSummary
    }));

    const comparison = await aiService.compareCandidates(candidates, jobRequirements || 'General software engineering role');

    res.json({
      candidates: candidates.map(c => ({ id: c.id, name: c.name, title: c.title })),
      comparison,
      comparedAt: new Date()
    });
  } catch (error) {
    console.error('Error comparing candidates:', error);
    res.status(500).json({ error: error.message || 'Failed to compare candidates' });
  }
});

// @route   POST /api/smart-match/salary-prediction/:userId
// @desc    Predict salary range for a candidate
// @access  Public
router.post('/salary-prediction/:userId', async (req, res) => {
  try {
    const { location, currency } = req.body;
    
    const profile = await Profile.findOne({
      where: { userId: req.params.userId, isPublic: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName']
      }]
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profileData = {
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      title: profile.title,
      skills: profile.skills,
      experience: profile.experience,
      education: profile.education,
      location: profile.location
    };

    const salaryPrediction = await aiService.predictSalaryRange(
      profileData,
      location || profile.location || 'US',
      currency || 'USD'
    );

    res.json({
      candidateName: `${profile.user.firstName} ${profile.user.lastName}`,
      salaryPrediction,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error predicting salary:', error);
    res.status(500).json({ error: error.message || 'Failed to predict salary' });
  }
});

// @route   POST /api/smart-match/outreach-message/:userId
// @desc    Generate personalized recruiting outreach message
// @access  Public
router.post('/outreach-message/:userId', async (req, res) => {
  try {
    const { jobDetails, tone } = req.body;
    
    const profile = await Profile.findOne({
      where: { userId: req.params.userId, isPublic: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName']
      }]
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profileData = {
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      title: profile.title,
      summary: profile.summary,
      skills: profile.skills,
      experience: profile.experience,
      aiStrengths: profile.aiStrengths
    };

    const outreachMessage = await aiService.generateOutreachMessage(
      profileData,
      jobDetails || 'Exciting opportunity at a growing tech company',
      tone || 'professional'
    );

    res.json({
      candidateName: `${profile.user.firstName} ${profile.user.lastName}`,
      outreachMessage,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error generating outreach message:', error);
    res.status(500).json({ error: error.message || 'Failed to generate outreach message' });
  }
});

// @route   POST /api/smart-match/skill-gap-analysis/:userId
// @desc    Analyze skill gaps for a specific role
// @access  Public
router.post('/skill-gap-analysis/:userId', async (req, res) => {
  try {
    const { jobRequirements } = req.body;
    
    if (!jobRequirements) {
      return res.status(400).json({ error: 'Job requirements are required' });
    }

    const profile = await Profile.findOne({
      where: { userId: req.params.userId, isPublic: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName']
      }]
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profileData = {
      title: profile.title,
      skills: profile.skills,
      experience: profile.experience
    };

    const analysis = await aiService.analyzeSkillGaps(profileData, jobRequirements);

    res.json({
      candidateName: `${profile.user.firstName} ${profile.user.lastName}`,
      analysis,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error analyzing skill gaps:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze skill gaps' });
  }
});

// @route   POST /api/smart-match/culture-fit/:userId
// @desc    Predict culture fit for a candidate
// @access  Public
router.post('/culture-fit/:userId', async (req, res) => {
  try {
    const { companyValues } = req.body;
    
    if (!companyValues) {
      return res.status(400).json({ error: 'Company values description is required' });
    }

    const profile = await Profile.findOne({
      where: { userId: req.params.userId, isPublic: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName']
      }]
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profileData = {
      title: profile.title,
      summary: profile.summary,
      experience: profile.experience,
      projects: profile.projects
    };

    const cultureFit = await aiService.predictCultureFit(profileData, companyValues);

    res.json({
      candidateName: `${profile.user.firstName} ${profile.user.lastName}`,
      cultureFit,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error predicting culture fit:', error);
    res.status(500).json({ error: error.message || 'Failed to predict culture fit' });
  }
});

module.exports = router;

