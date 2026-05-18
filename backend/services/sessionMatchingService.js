const { CollaborationSession, User, Profile, UserReputation } = require('../models');
const aiService = require('./aiService');
const { Op } = require('sequelize');

class SessionMatchingService {
  
  /**
   * Calculate match score between a user and a session
   */
  async calculateMatchScore(userId, sessionId) {
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Profile,
          as: 'profile',
          attributes: ['skills', 'experience', 'headline', 'title']
        }
      ]
    });

    const session = await CollaborationSession.findByPk(sessionId, {
      include: [
        {
          model: User,
          as: 'host',
          include: [{ model: Profile, as: 'profile' }]
        }
      ]
    });

    if (!user || !session) {
      return { score: 0, reasons: [] };
    }

    const userProfile = user.profile || {};
    const userSkills = this.extractSkills(userProfile.skills);
    const sessionTags = session.tags || [];
    const sessionCategory = session.category || '';

    let score = 50; // Base score
    const reasons = [];

    // 1. Skill match (40% weight)
    const skillMatch = this.calculateSkillMatch(userSkills, sessionTags, sessionCategory);
    score += skillMatch.score * 0.4;
    if (skillMatch.matchedSkills.length > 0) {
      reasons.push({
        type: 'skill',
        message: `Matches your ${skillMatch.matchedSkills.slice(0, 2).join(', ')} skills`
      });
    }

    // 2. Career goal alignment (25% weight)
    const goalMatch = this.calculateGoalMatch(userProfile, session);
    score += goalMatch.score * 0.25;
    if (goalMatch.isRelevant) {
      reasons.push({
        type: 'goal',
        message: goalMatch.message
      });
    }

    // 3. Experience level fit (15% weight)
    const experienceMatch = this.calculateExperienceMatch(userProfile, session);
    score += experienceMatch.score * 0.15;

    // 4. Host reputation (10% weight)
    const hostRep = await UserReputation.findOne({ where: { userId: session.hostId } });
    if (hostRep && hostRep.averageRating >= 4.0) {
      score += 10;
      reasons.push({
        type: 'reputation',
        message: 'Highly rated host'
      });
    }

    // 5. Session type preference (10% weight)
    // (Would need user preferences stored - simplified for now)
    score += 5;

    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Generate primary reason for display
    const primaryReason = this.generatePrimaryReason(score, session.sessionType, reasons);

    return {
      score,
      reasons,
      primaryReason,
      matchedSkills: skillMatch.matchedSkills
    };
  }

  /**
   * Extract skills from profile skills object
   */
  extractSkills(skillsObj) {
    if (!skillsObj) return [];
    
    // Handle different skill formats
    if (Array.isArray(skillsObj)) return skillsObj;
    
    if (typeof skillsObj === 'object') {
      // Flatten skills from categories
      return Object.values(skillsObj).flat();
    }
    
    return [];
  }

  /**
   * Calculate skill match score
   */
  calculateSkillMatch(userSkills, sessionTags, sessionCategory) {
    const normalizedUserSkills = userSkills.map(s => s.toLowerCase().trim());
    const normalizedTags = sessionTags.map(t => t.toLowerCase().trim());
    
    // Check category match
    const categoryMatch = normalizedUserSkills.some(skill => 
      sessionCategory.toLowerCase().includes(skill) ||
      skill.includes(sessionCategory.toLowerCase())
    );

    // Check tag matches
    const matchedSkills = normalizedUserSkills.filter(skill =>
      normalizedTags.some(tag => 
        tag.includes(skill) || skill.includes(tag)
      )
    );

    let score = 0;
    if (matchedSkills.length >= 3) score = 100;
    else if (matchedSkills.length === 2) score = 75;
    else if (matchedSkills.length === 1) score = 50;
    else if (categoryMatch) score = 40;

    return { score, matchedSkills };
  }

  /**
   * Calculate career goal alignment
   */
  calculateGoalMatch(userProfile, session) {
    const headline = (userProfile.headline || '').toLowerCase();
    const title = (userProfile.title || '').toLowerCase();
    const sessionTitle = session.title.toLowerCase();
    const sessionDesc = (session.description || '').toLowerCase();

    // Keywords indicating goal alignment
    const careerKeywords = ['junior', 'senior', 'lead', 'manager', 'promotion', 'career', 'growth'];
    const techKeywords = ['developer', 'engineer', 'designer', 'product', 'data', 'devops'];

    let isRelevant = false;
    let message = '';

    // Check if session topic aligns with user's role
    for (const keyword of techKeywords) {
      if ((headline.includes(keyword) || title.includes(keyword)) &&
          (sessionTitle.includes(keyword) || sessionDesc.includes(keyword))) {
        isRelevant = true;
        message = `Relevant to your ${keyword} work`;
        break;
      }
    }

    // Check career growth alignment
    if (!isRelevant) {
      for (const keyword of careerKeywords) {
        if (sessionTitle.includes(keyword) || sessionDesc.includes(keyword)) {
          isRelevant = true;
          message = 'Perfect for your career goals';
          break;
        }
      }
    }

    return {
      score: isRelevant ? 75 : 25,
      isRelevant,
      message
    };
  }

  /**
   * Calculate experience level match
   */
  calculateExperienceMatch(userProfile, session) {
    const experience = userProfile.experience || [];
    const yearsOfExperience = experience.length;

    // Simple heuristic based on years
    let score = 50;
    
    // Senior sessions may benefit all levels
    if (session.sessionType === 'teaching') {
      score = 75; // Teaching sessions are generally valuable
    } else if (session.sessionType === 'mentorship') {
      // Mentorship could be seeking or offering
      score = yearsOfExperience >= 3 ? 80 : 60;
    }

    return { score };
  }

  /**
   * Generate primary reason for display
   */
  generatePrimaryReason(score, sessionType, reasons) {
    if (score >= 90) {
      return {
        icon: '✨',
        text: 'Perfect for your career goals',
        color: 'success'
      };
    } else if (score >= 75) {
      const skillReason = reasons.find(r => r.type === 'skill' || r.type === 'goal');
      return {
        icon: '🎯',
        text: skillReason?.message || 'Highly relevant to your work',
        color: 'primary'
      };
    } else if (score >= 60) {
      return {
        icon: '💡',
        text: sessionType === 'mentorship' 
          ? 'Share your experience - Help someone starting their journey'
          : 'Similar to your recent projects',
        color: 'info'
      };
    } else {
      return {
        icon: '📚',
        text: 'Expand your knowledge',
        color: 'default'
      };
    }
  }

  /**
   * Get recommended sessions for a user
   */
  async getRecommendedSessions(userId, limit = 10) {
    // Get all upcoming sessions
    const sessions = await CollaborationSession.findAll({
      where: {
        status: { [Op.in]: ['scheduled', 'live'] },
        scheduledTime: { [Op.gte]: new Date() },
        hostId: { [Op.ne]: userId } // Don't recommend user's own sessions
      },
      include: [
        {
          model: User,
          as: 'host',
          attributes: ['id', 'firstName', 'lastName'],
          include: [
            {
              model: Profile,
              as: 'profile',
              attributes: ['profilePicture', 'headline']
            }
          ]
        }
      ],
      order: [['scheduledTime', 'ASC']],
      limit: 50 // Get more to score and filter
    });

    // Calculate match scores for each session
    const scoredSessions = await Promise.all(
      sessions.map(async (session) => {
        const matchResult = await this.calculateMatchScore(userId, session.id);
        return {
          session: session.toJSON(),
          ...matchResult
        };
      })
    );

    // Sort by score and return top results
    return scoredSessions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Find mentors for a mentorship session
   */
  async findMatchingMentors(sessionId, limit = 5) {
    const session = await CollaborationSession.findByPk(sessionId);
    
    if (!session || session.sessionType !== 'mentorship') {
      return [];
    }

    const sessionTags = session.tags || [];
    const sessionCategory = session.category || '';

    // Find users with relevant skills and good reputation
    const potentialMentors = await User.findAll({
      where: {
        id: { [Op.ne]: session.hostId }
      },
      include: [
        {
          model: Profile,
          as: 'profile',
          attributes: ['skills', 'experience', 'headline', 'title', 'profilePicture']
        },
        {
          model: UserReputation,
          as: 'reputation',
          where: {
            totalSessionsHosted: { [Op.gte]: 1 } // Has hosted at least one session
          },
          required: false
        }
      ],
      limit: 100
    });

    // Score and rank potential mentors
    const scoredMentors = potentialMentors
      .map(mentor => {
        const skills = this.extractSkills(mentor.profile?.skills);
        const skillMatch = this.calculateSkillMatch(skills, sessionTags, sessionCategory);
        
        const reputationScore = mentor.reputation 
          ? (mentor.reputation.averageRating * 10) + (mentor.reputation.teachingCredits / 10)
          : 0;

        return {
          user: {
            id: mentor.id,
            firstName: mentor.firstName,
            lastName: mentor.lastName,
            profile: mentor.profile,
            reputation: mentor.reputation
          },
          score: skillMatch.score * 0.6 + reputationScore * 0.4,
          matchedSkills: skillMatch.matchedSkills
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scoredMentors;
  }

  /**
   * Use AI to generate match explanation
   */
  async generateAIMatchExplanation(userId, sessionId) {
    try {
      const user = await User.findByPk(userId, {
        include: [{ model: Profile, as: 'profile' }]
      });

      const session = await CollaborationSession.findByPk(sessionId, {
        include: [{ model: User, as: 'host' }]
      });

      if (!user || !session) {
        return null;
      }

      const prompt = `Based on this user's profile and the session details, generate a brief (1 sentence) personalized reason why this session would be valuable for them.

User Profile:
- Title: ${user.profile?.title || 'Professional'}
- Headline: ${user.profile?.headline || ''}
- Skills: ${JSON.stringify(this.extractSkills(user.profile?.skills)).substring(0, 200)}

Session:
- Title: ${session.title}
- Type: ${session.sessionType}
- Category: ${session.category}
- Description: ${(session.description || '').substring(0, 200)}

Generate a personalized, encouraging match reason in one sentence:`;

      const response = await aiService.generateGenericText(prompt, 100);
      return response;
    } catch (error) {
      console.error('Error generating AI match explanation:', error);
      return null;
    }
  }
}

module.exports = new SessionMatchingService();
