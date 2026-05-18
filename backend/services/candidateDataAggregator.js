/**
 * CandidateDataAggregator Service
 * 
 * Aggregates all candidate data sources to provide comprehensive information
 * to the candidate AI agent for autonomous negotiations with recruiter agents.
 * 
 * Data Sources:
 * - Profile: skills, experience, education, projects, certifications
 * - Posts: articles, achievements, announcements (public activity)
 * - TailoredProfiles: past job applications and preferences
 * - AI-enhanced data: strengths, insights, keywords
 */

const { Profile, Post, TailoredProfile, User } = require('../models');
const { Op } = require('sequelize');

class CandidateDataAggregator {
  
  /**
   * Fetch and aggregate all candidate data for AI agent negotiations
   * @param {number} candidateUserId - The candidate's user ID
   * @param {object} jobData - The job being negotiated for (optional, for relevance scoring)
   * @returns {object} Comprehensive candidate data package
   */
  async aggregateCandidateData(candidateUserId, jobData = null) {
    try {
      // Fetch all data sources in parallel for efficiency
      const [profile, posts, tailoredProfiles, user] = await Promise.all([
        this.fetchProfile(candidateUserId),
        this.fetchRecentPosts(candidateUserId),
        this.fetchTailoredProfiles(candidateUserId),
        User.findByPk(candidateUserId, { attributes: ['id', 'firstName', 'lastName', 'email'] })
      ]);

      if (!profile) {
        throw new Error(`Profile not found for user ${candidateUserId}`);
      }

      // Structure the aggregated data
      const aggregatedData = {
        // Basic identity
        identity: {
          userId: candidateUserId,
          fullName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          email: user?.email,
          title: profile.title,
          headline: profile.headline,
          location: profile.location,
          availabilityStatus: profile.availabilityStatus
        },

        // Professional summary
        professionalSummary: {
          summary: profile.summary,
          aiSummary: profile.aiSummary,
          aiStrengths: profile.aiStrengths || [],
          aiRecruiterInsights: profile.aiRecruiterInsights,
          aiKeywords: profile.aiKeywords || []
        },

        // Skills with proficiency
        skills: this.parseSkills(profile.skills),

        // Work experience (detailed)
        experience: this.parseExperience(profile.experience),

        // Education background
        education: this.parseEducation(profile.education),

        // Portfolio projects
        projects: this.parseProjects(profile.projects),

        // Professional certifications
        certifications: profile.certifications || [],

        // Languages spoken
        languages: profile.languages || [],

        // Online presence
        onlinePresence: {
          linkedinUrl: profile.linkedinUrl,
          githubUrl: profile.githubUrl,
          websiteUrl: profile.websiteUrl,
          twitterUrl: profile.twitterUrl,
          portfolioUrl: profile.portfolioUrl
        },

        // Public activity (posts/articles)
        publicActivity: this.analyzePublicActivity(posts),

        // Job application history (from tailored profiles)
        applicationHistory: this.analyzeApplicationHistory(tailoredProfiles),

        // Computed metrics
        metrics: {
          profileCompleteness: this.calculateProfileCompleteness(profile),
          totalYearsExperience: this.calculateTotalExperience(profile.experience),
          uniqueSkillsCount: this.countUniqueSkills(profile.skills),
          projectsCount: (profile.projects || []).length,
          certificationsCount: (profile.certifications || []).length,
          postsCount: posts.length,
          hasAIEnhancements: !!(profile.aiSummary || profile.aiStrengths?.length)
        }
      };

      // If job data provided, compute relevance scores
      if (jobData) {
        aggregatedData.jobRelevance = this.computeJobRelevance(aggregatedData, jobData);
      }

      return aggregatedData;
    } catch (error) {
      console.error('Error aggregating candidate data:', error);
      throw error;
    }
  }

  /**
   * Fetch candidate profile with all fields
   */
  async fetchProfile(userId) {
    return Profile.findOne({
      where: { userId },
      attributes: [
        'id', 'userId', 'title', 'headline', 'summary', 'location',
        'skills', 'experience', 'education', 'projects', 'certifications',
        'languages', 'linkedinUrl', 'githubUrl', 'websiteUrl', 'twitterUrl',
        'portfolioUrl', 'profilePicture', 'aiSummary', 'aiStrengths',
        'aiRecruiterInsights', 'aiKeywords', 'availabilityStatus'
      ]
    });
  }

  /**
   * Fetch recent posts (last 6 months, max 20)
   */
  async fetchRecentPosts(userId) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return Post.findAll({
      where: {
        userId,
        createdAt: { [Op.gte]: sixMonthsAgo }
      },
      order: [['createdAt', 'DESC']],
      limit: 20,
      attributes: ['id', 'content', 'postType', 'tags', 'aiMetadata', 'createdAt']
    });
  }

  /**
   * Fetch tailored profiles (job applications history)
   */
  async fetchTailoredProfiles(userId) {
    return TailoredProfile.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 10,
      attributes: ['id', 'jobTitle', 'companyName', 'tailoredData', 
                   'matchScore', 'createdAt']
    });
  }

  /**
   * Parse and structure skills data
   */
  parseSkills(skills) {
    if (!skills) return { technical: [], soft: [], all: [] };
    
    const skillsArray = Array.isArray(skills) ? skills : [];
    
    // Categorize skills if they have category info
    const technical = [];
    const soft = [];
    const all = [];

    skillsArray.forEach(skill => {
      const skillEntry = {
        name: typeof skill === 'string' ? skill : skill.name || skill.skill,
        proficiency: skill.proficiency || skill.level || 'intermediate',
        yearsUsed: skill.years || skill.yearsUsed || null
      };
      
      all.push(skillEntry);
      
      // Simple categorization based on common patterns
      const softSkillKeywords = ['communication', 'leadership', 'teamwork', 'management', 
        'problem-solving', 'collaboration', 'mentoring', 'presentation', 'negotiation'];
      
      const skillNameLower = skillEntry.name.toLowerCase();
      if (softSkillKeywords.some(k => skillNameLower.includes(k))) {
        soft.push(skillEntry);
      } else {
        technical.push(skillEntry);
      }
    });

    return { technical, soft, all };
  }

  /**
   * Parse and enrich experience data
   */
  parseExperience(experience) {
    if (!experience || !Array.isArray(experience)) return [];

    return experience.map(exp => ({
      company: exp.company || exp.companyName,
      title: exp.title || exp.position || exp.jobTitle,
      location: exp.location,
      startDate: exp.startDate || exp.start,
      endDate: exp.endDate || exp.end || 'Present',
      isCurrent: exp.current || exp.isCurrent || !exp.endDate,
      description: exp.description || exp.summary,
      achievements: exp.achievements || exp.highlights || [],
      technologies: exp.technologies || exp.skills || [],
      // Compute duration
      durationMonths: this.calculateDuration(exp.startDate || exp.start, exp.endDate || exp.end)
    }));
  }

  /**
   * Parse education data
   */
  parseEducation(education) {
    if (!education || !Array.isArray(education)) return [];

    return education.map(edu => ({
      institution: edu.institution || edu.school || edu.university,
      degree: edu.degree,
      field: edu.field || edu.major || edu.fieldOfStudy,
      graduationYear: edu.graduationYear || edu.endYear || edu.year,
      gpa: edu.gpa,
      honors: edu.honors || edu.achievements || []
    }));
  }

  /**
   * Parse portfolio projects
   */
  parseProjects(projects) {
    if (!projects || !Array.isArray(projects)) return [];

    return projects.map(proj => ({
      name: proj.name || proj.title,
      description: proj.description,
      role: proj.role,
      technologies: proj.technologies || proj.techStack || proj.skills || [],
      url: proj.url || proj.link || proj.projectUrl,
      githubUrl: proj.githubUrl || proj.repoUrl,
      imageUrl: proj.imageUrl || proj.image,
      startDate: proj.startDate,
      endDate: proj.endDate,
      highlights: proj.highlights || proj.achievements || [],
      impact: proj.impact || proj.results
    }));
  }

  /**
   * Analyze public activity from posts
   */
  analyzePublicActivity(posts) {
    if (!posts || posts.length === 0) {
      return {
        summary: 'No recent public activity',
        posts: [],
        themes: [],
        activityLevel: 'inactive'
      };
    }

    // Categorize posts by type
    const postsByType = {};
    const allTags = [];
    const postSummaries = [];

    posts.forEach(post => {
      const type = post.postType || 'update';
      if (!postsByType[type]) postsByType[type] = [];
      postsByType[type].push(post);

      if (post.tags) {
        allTags.push(...(Array.isArray(post.tags) ? post.tags : []));
      }

      // Create summary for each post
      postSummaries.push({
        id: post.id,
        type: type,
        contentPreview: post.content?.substring(0, 200) + (post.content?.length > 200 ? '...' : ''),
        fullContent: post.content,
        tags: post.tags || [],
        aiMetadata: post.aiMetadata,
        date: post.createdAt
      });
    });

    // Find common themes from tags
    const tagCounts = {};
    allTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    const themes = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    // Determine activity level
    const postsPerMonth = posts.length / 6; // 6 months window
    let activityLevel = 'low';
    if (postsPerMonth >= 4) activityLevel = 'high';
    else if (postsPerMonth >= 2) activityLevel = 'medium';

    return {
      summary: `${posts.length} posts in the last 6 months`,
      totalPosts: posts.length,
      postsByType,
      posts: postSummaries,
      themes,
      activityLevel,
      // Highlight notable posts
      achievements: postsByType['achievement'] || [],
      projectUpdates: postsByType['project'] || [],
      announcements: postsByType['announcement'] || []
    };
  }

  /**
   * Analyze application history from tailored profiles
   */
  analyzeApplicationHistory(tailoredProfiles) {
    if (!tailoredProfiles || tailoredProfiles.length === 0) {
      return {
        summary: 'No previous applications on record',
        applications: [],
        targetedRoles: [],
        targetedCompanies: [],
        averageMatchScore: null
      };
    }

    const applications = tailoredProfiles.map(tp => ({
      jobTitle: tp.jobTitle,
      company: tp.companyName,
      matchScore: tp.matchScore,
      date: tp.createdAt
    }));

    // Extract patterns
    const targetedRoles = [...new Set(applications.map(a => a.jobTitle).filter(Boolean))];
    const targetedCompanies = [...new Set(applications.map(a => a.company).filter(Boolean))];
    const matchScores = applications.map(a => a.matchScore).filter(s => s != null);
    const averageMatchScore = matchScores.length > 0 
      ? Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length) 
      : null;

    return {
      summary: `${applications.length} previous job applications`,
      applications,
      targetedRoles,
      targetedCompanies,
      averageMatchScore,
      // Infer preferences from history
      inferredPreferences: this.inferPreferencesFromHistory(applications)
    };
  }

  /**
   * Infer candidate preferences from application history
   */
  inferPreferencesFromHistory(applications) {
    if (applications.length < 2) return null;

    // Look for patterns in targeted roles
    const roleCounts = {};
    applications.forEach(app => {
      if (app.jobTitle) {
        // Extract role keywords
        const keywords = app.jobTitle.toLowerCase().split(/\s+/);
        keywords.forEach(kw => {
          if (kw.length > 3) roleCounts[kw] = (roleCounts[kw] || 0) + 1;
        });
      }
    });

    const preferredRoleKeywords = Object.entries(roleCounts)
      .filter(([, count]) => count >= 2)
      .map(([kw]) => kw);

    return {
      preferredRoleKeywords,
      applicationFrequency: applications.length,
      mostRecentApplication: applications[0]?.date
    };
  }

  /**
   * Compute relevance scores against a specific job
   */
  computeJobRelevance(candidateData, jobData) {
    const relevance = {
      overallScore: 0,
      skillsMatch: { score: 0, matched: [], missing: [], partial: [] },
      experienceMatch: { score: 0, relevantExperiences: [], yearsMatch: false },
      educationMatch: { score: 0, meetsRequirements: false },
      locationMatch: { score: 0, compatible: false },
      evidenceFromPosts: [],
      evidenceFromProjects: [],
      strengthsAlignment: [],
      potentialConcerns: []
    };

    const jobRequirements = this.extractJobRequirements(jobData);

    // Skills matching
    relevance.skillsMatch = this.matchSkills(candidateData.skills, jobRequirements.skills);

    // Experience matching
    relevance.experienceMatch = this.matchExperience(
      candidateData.experience, 
      candidateData.metrics.totalYearsExperience,
      jobRequirements
    );

    // Find evidence from posts
    relevance.evidenceFromPosts = this.findEvidenceInPosts(
      candidateData.publicActivity.posts,
      jobRequirements
    );

    // Find evidence from projects
    relevance.evidenceFromProjects = this.findEvidenceInProjects(
      candidateData.projects,
      jobRequirements
    );

    // Location compatibility
    relevance.locationMatch = this.matchLocation(
      candidateData.identity.location,
      jobData.location,
      jobData.remote || jobData.isRemote
    );

    // Align AI-identified strengths with job requirements
    relevance.strengthsAlignment = this.alignStrengths(
      candidateData.professionalSummary.aiStrengths,
      jobRequirements
    );

    // Identify potential concerns (honest assessment)
    relevance.potentialConcerns = this.identifyConcerns(candidateData, jobRequirements);

    // Calculate overall score
    relevance.overallScore = Math.round(
      (relevance.skillsMatch.score * 0.35) +
      (relevance.experienceMatch.score * 0.30) +
      (relevance.locationMatch.score * 0.10) +
      (relevance.evidenceFromPosts.length > 0 ? 10 : 0) +
      (relevance.evidenceFromProjects.length > 0 ? 15 : 0)
    );

    return relevance;
  }

  /**
   * Extract requirements from job data
   */
  extractJobRequirements(jobData) {
    return {
      title: jobData.title,
      skills: this.extractSkillsFromJob(jobData),
      minYearsExperience: jobData.experienceLevel === 'senior' ? 5 
        : jobData.experienceLevel === 'mid' ? 2 
        : jobData.experienceLevel === 'entry' ? 0 : 2,
      requiredEducation: jobData.education || null,
      location: jobData.location,
      isRemote: jobData.remote || jobData.isRemote,
      keywords: this.extractKeywords(jobData.description || '')
    };
  }

  /**
   * Extract skills from job posting
   */
  extractSkillsFromJob(jobData) {
    const skills = [];
    
    // From explicit skills field
    if (jobData.skills) {
      if (Array.isArray(jobData.skills)) {
        skills.push(...jobData.skills);
      } else if (typeof jobData.skills === 'string') {
        skills.push(...jobData.skills.split(',').map(s => s.trim()));
      }
    }

    // From requirements
    if (jobData.requirements && Array.isArray(jobData.requirements)) {
      skills.push(...jobData.requirements);
    }

    // From description keywords (simple extraction)
    if (jobData.description) {
      const techKeywords = this.extractTechKeywords(jobData.description);
      skills.push(...techKeywords);
    }

    return [...new Set(skills.map(s => s.toLowerCase()))];
  }

  /**
   * Extract tech keywords from text
   */
  extractTechKeywords(text) {
    const commonTech = [
      'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'php',
      'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring', 'rails',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd',
      'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
      'graphql', 'rest', 'api', 'microservices', 'agile', 'scrum'
    ];

    const textLower = text.toLowerCase();
    return commonTech.filter(tech => textLower.includes(tech));
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text) {
    // Simple keyword extraction
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);
    
    const stopWords = ['that', 'this', 'with', 'from', 'have', 'will', 'your', 'about', 'would', 'could', 'should'];
    return [...new Set(words.filter(w => !stopWords.includes(w)))];
  }

  /**
   * Match candidate skills against job requirements
   */
  matchSkills(candidateSkills, jobSkills) {
    const result = { score: 0, matched: [], missing: [], partial: [] };
    
    if (!jobSkills || jobSkills.length === 0) {
      return { score: 70, matched: [], missing: [], partial: [], note: 'No specific skills required' };
    }

    const candidateSkillNames = candidateSkills.all.map(s => s.name.toLowerCase());

    jobSkills.forEach(reqSkill => {
      const reqSkillLower = reqSkill.toLowerCase();
      
      // Exact match
      if (candidateSkillNames.includes(reqSkillLower)) {
        result.matched.push(reqSkill);
      }
      // Partial match (e.g., "React" matches "React.js")
      else if (candidateSkillNames.some(cs => cs.includes(reqSkillLower) || reqSkillLower.includes(cs))) {
        result.partial.push(reqSkill);
      }
      else {
        result.missing.push(reqSkill);
      }
    });

    // Calculate score
    const totalRequired = jobSkills.length;
    const matchedWeight = result.matched.length * 1.0;
    const partialWeight = result.partial.length * 0.5;
    result.score = Math.round(((matchedWeight + partialWeight) / totalRequired) * 100);

    return result;
  }

  /**
   * Match experience against requirements
   */
  matchExperience(experiences, totalYears, requirements) {
    const result = {
      score: 0,
      relevantExperiences: [],
      yearsMatch: totalYears >= requirements.minYearsExperience,
      totalYears
    };

    // Find relevant experiences based on job title/keywords
    experiences.forEach(exp => {
      const expText = `${exp.title} ${exp.description} ${exp.technologies?.join(' ')}`.toLowerCase();
      const titleLower = requirements.title?.toLowerCase() || '';
      
      // Check if experience is relevant
      const relevanceScore = requirements.keywords?.filter(kw => expText.includes(kw)).length || 0;
      
      if (relevanceScore > 0 || expText.includes(titleLower.split(' ')[0])) {
        result.relevantExperiences.push({
          ...exp,
          relevanceScore,
          matchedKeywords: requirements.keywords?.filter(kw => expText.includes(kw)) || []
        });
      }
    });

    // Score calculation
    let score = 0;
    if (result.yearsMatch) score += 40;
    if (result.relevantExperiences.length > 0) score += 30;
    if (result.relevantExperiences.length > 2) score += 20;
    if (totalYears > requirements.minYearsExperience + 2) score += 10;

    result.score = Math.min(score, 100);
    return result;
  }

  /**
   * Find evidence in posts that supports job fit
   */
  findEvidenceInPosts(posts, requirements) {
    const evidence = [];

    posts.forEach(post => {
      if (!post.fullContent) return;
      
      const contentLower = post.fullContent.toLowerCase();
      const matchedKeywords = requirements.keywords?.filter(kw => contentLower.includes(kw)) || [];
      const matchedSkills = requirements.skills?.filter(skill => contentLower.includes(skill)) || [];

      if (matchedKeywords.length > 2 || matchedSkills.length > 0 || 
          post.type === 'achievement' || post.type === 'project') {
        evidence.push({
          postId: post.id,
          type: post.type,
          preview: post.contentPreview,
          date: post.date,
          matchedKeywords,
          matchedSkills,
          relevanceReason: post.type === 'achievement' ? 'Demonstrates accomplishments' :
                          post.type === 'project' ? 'Shows hands-on experience' :
                          'Discusses relevant topics'
        });
      }
    });

    return evidence.slice(0, 5); // Top 5 most relevant
  }

  /**
   * Find evidence in projects
   */
  findEvidenceInProjects(projects, requirements) {
    const evidence = [];

    projects.forEach(project => {
      const projectText = `${project.name} ${project.description} ${project.technologies?.join(' ')}`.toLowerCase();
      const matchedSkills = requirements.skills?.filter(skill => projectText.includes(skill)) || [];
      const matchedKeywords = requirements.keywords?.filter(kw => projectText.includes(kw)) || [];

      if (matchedSkills.length > 0 || matchedKeywords.length > 2) {
        evidence.push({
          name: project.name,
          description: project.description,
          technologies: project.technologies,
          url: project.url,
          matchedSkills,
          relevanceReason: `Demonstrates practical experience with ${matchedSkills.join(', ') || 'relevant technologies'}`
        });
      }
    });

    return evidence;
  }

  /**
   * Match location compatibility
   */
  matchLocation(candidateLocation, jobLocation, isRemote) {
    if (isRemote) {
      return { score: 100, compatible: true, reason: 'Remote position - location flexible' };
    }

    if (!candidateLocation || !jobLocation) {
      return { score: 50, compatible: null, reason: 'Location information incomplete' };
    }

    const candLoc = candidateLocation.toLowerCase();
    const jobLoc = jobLocation.toLowerCase();

    if (candLoc.includes(jobLoc) || jobLoc.includes(candLoc)) {
      return { score: 100, compatible: true, reason: 'Same location' };
    }

    // Check for same country/region
    const candParts = candLoc.split(',').map(s => s.trim());
    const jobParts = jobLoc.split(',').map(s => s.trim());
    
    if (candParts.some(p => jobParts.includes(p))) {
      return { score: 70, compatible: true, reason: 'Same region - may require relocation within area' };
    }

    return { score: 30, compatible: false, reason: 'Different location - relocation may be required' };
  }

  /**
   * Align AI strengths with job requirements
   */
  alignStrengths(aiStrengths, requirements) {
    if (!aiStrengths || aiStrengths.length === 0) return [];

    const aligned = [];
    const allRequirements = [
      ...(requirements.skills || []),
      ...(requirements.keywords || [])
    ].join(' ').toLowerCase();

    aiStrengths.forEach(strength => {
      const strengthLower = (typeof strength === 'string' ? strength : strength.name || '').toLowerCase();
      if (allRequirements.includes(strengthLower) || 
          strengthLower.includes('leadership') ||
          strengthLower.includes('communication') ||
          strengthLower.includes('problem')) {
        aligned.push({
          strength: typeof strength === 'string' ? strength : strength.name,
          relevance: allRequirements.includes(strengthLower) ? 'Directly relevant to role' : 'Generally valuable'
        });
      }
    });

    return aligned;
  }

  /**
   * Identify potential concerns (honest assessment)
   */
  identifyConcerns(candidateData, requirements) {
    const concerns = [];

    // Experience gap
    if (candidateData.metrics.totalYearsExperience < requirements.minYearsExperience) {
      concerns.push({
        type: 'experience',
        description: `${requirements.minYearsExperience - candidateData.metrics.totalYearsExperience} years less experience than typically required`,
        severity: 'medium',
        mitigatingFactors: candidateData.projects.length > 2 ? 
          'Strong portfolio projects may compensate' : null
      });
    }

    // Skill gaps
    const skillMatch = this.matchSkills(candidateData.skills, requirements.skills);
    if (skillMatch.missing.length > 0) {
      concerns.push({
        type: 'skills',
        description: `Missing skills: ${skillMatch.missing.slice(0, 3).join(', ')}`,
        severity: skillMatch.missing.length > 3 ? 'high' : 'low',
        mitigatingFactors: skillMatch.partial.length > 0 ? 
          `Has related skills: ${skillMatch.partial.join(', ')}` : null
      });
    }

    // Location
    if (!requirements.isRemote && candidateData.identity.location) {
      const locMatch = this.matchLocation(candidateData.identity.location, requirements.location, false);
      if (!locMatch.compatible) {
        concerns.push({
          type: 'location',
          description: 'May require relocation',
          severity: 'medium',
          mitigatingFactors: null
        });
      }
    }

    // Job search status
    if (candidateData.identity.availabilityStatus === 'not-looking') {
      concerns.push({
        type: 'availability',
        description: 'Candidate marked as not actively looking',
        severity: 'low',
        mitigatingFactors: 'May still be open to exceptional opportunities'
      });
    }

    return concerns;
  }

  /**
   * Calculate total years of experience
   */
  calculateTotalExperience(experience) {
    if (!experience || !Array.isArray(experience)) return 0;

    let totalMonths = 0;
    experience.forEach(exp => {
      totalMonths += this.calculateDuration(exp.startDate || exp.start, exp.endDate || exp.end);
    });

    return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate duration in months between two dates
   */
  calculateDuration(startDate, endDate) {
    if (!startDate) return 0;

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();

    if (isNaN(start.getTime())) return 0;

    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(0, months);
  }

  /**
   * Count unique skills
   */
  countUniqueSkills(skills) {
    if (!skills) return 0;
    const skillsArray = Array.isArray(skills) ? skills : [];
    return skillsArray.length;
  }

  /**
   * Calculate profile completeness percentage
   */
  calculateProfileCompleteness(profile) {
    const fields = [
      { name: 'title', weight: 10 },
      { name: 'summary', weight: 15 },
      { name: 'location', weight: 5 },
      { name: 'skills', weight: 20, isArray: true },
      { name: 'experience', weight: 20, isArray: true },
      { name: 'education', weight: 10, isArray: true },
      { name: 'projects', weight: 10, isArray: true },
      { name: 'linkedinUrl', weight: 5 },
      { name: 'profilePicture', weight: 5 }
    ];

    let score = 0;
    fields.forEach(field => {
      const value = profile[field.name];
      if (field.isArray) {
        if (value && Array.isArray(value) && value.length > 0) {
          score += field.weight;
        }
      } else if (value) {
        score += field.weight;
      }
    });

    return score;
  }

  /**
   * Generate a quick summary for AI prompts
   */
  generateQuickSummary(aggregatedData) {
    const { identity, professionalSummary, skills, metrics, jobRelevance } = aggregatedData;

    return {
      name: identity.fullName,
      title: identity.title,
      location: identity.location,
      yearsExperience: metrics.totalYearsExperience,
      topSkills: skills.all.slice(0, 10).map(s => s.name),
      strengths: professionalSummary.aiStrengths?.slice(0, 5) || [],
      summary: professionalSummary.aiSummary || professionalSummary.summary,
      profileCompleteness: metrics.profileCompleteness,
      recentActivity: aggregatedData.publicActivity.summary,
      projectsCount: metrics.projectsCount,
      ...(jobRelevance && {
        matchScore: jobRelevance.overallScore,
        matchedSkills: jobRelevance.skillsMatch.matched,
        missingSkills: jobRelevance.skillsMatch.missing,
        concerns: jobRelevance.potentialConcerns.map(c => c.description)
      })
    };
  }
}

module.exports = new CandidateDataAggregator();
