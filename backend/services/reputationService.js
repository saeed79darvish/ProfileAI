const { UserReputation, UserBadge, User, Profile } = require('../models');

class ReputationService {
  
  /**
   * Get or create user reputation record
   */
  async getOrCreateReputation(userId) {
    let reputation = await UserReputation.findOne({ 
      where: { userId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, as: 'profile', attributes: ['profilePicture'] }]
        }
      ]
    });
    
    if (!reputation) {
      reputation = await UserReputation.create({ userId });
      reputation = await UserReputation.findOne({ 
        where: { userId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName'],
            include: [{ model: Profile, as: 'profile', attributes: ['profilePicture'] }]
          }
        ]
      });
    }
    
    return reputation;
  }

  /**
   * Get user stats for display in sidebar
   */
  async getUserStats(userId) {
    const reputation = await this.getOrCreateReputation(userId);
    
    return {
      teachingCredits: reputation.teachingCredits,
      sessionsAttended: reputation.sessionsAttended,
      peopleHelped: reputation.peopleHelped,
      currentLevel: reputation.currentLevel,
      levelProgress: reputation.levelProgress,
      averageRating: parseFloat(reputation.averageRating) || 0,
      totalSessionsHosted: reputation.totalSessionsHosted
    };
  }

  /**
   * Get user's earned badges
   */
  async getUserBadges(userId) {
    const badges = await UserBadge.findAll({
      where: { userId },
      order: [['earnedAt', 'DESC']]
    });

    // Map to include badge metadata
    return badges.map(badge => ({
      ...badge.toJSON(),
      ...UserBadge.BADGE_DEFINITIONS[badge.badgeType]
    }));
  }

  /**
   * Get all badges with user's progress
   */
  async getAllBadgesWithProgress(userId) {
    const earnedBadges = await UserBadge.findAll({ where: { userId } });
    const earnedTypes = earnedBadges.map(b => b.badgeType);
    const reputation = await this.getOrCreateReputation(userId);

    const allBadges = Object.entries(UserBadge.BADGE_DEFINITIONS).map(([type, def]) => {
      const earned = earnedTypes.includes(type);
      let progress = 0;

      // Calculate progress for unearned badges
      if (!earned) {
        switch (type) {
          case 'first_steps':
            progress = Math.min(reputation.totalSessionsHosted / 1 * 100, 100);
            break;
          case 'helpful_hand':
            progress = Math.min(reputation.peopleHelped / 10 * 100, 100);
            break;
          case 'educator':
            progress = Math.min(reputation.totalTeachingSessions / 10 * 100, 100);
            break;
          case 'team_player':
            progress = Math.min(reputation.totalShowcases / 5 * 100, 100);
            break;
          case 'mentor_master':
            progress = Math.min(reputation.totalMentorships / 25 * 100, 100);
            break;
          case 'rising_star':
            progress = Math.min(reputation.peopleHelped / 50 * 100, 100);
            break;
          case 'thought_leader':
            progress = Math.min(reputation.teachingCredits / 100 * 100, 100);
            break;
          case 'community_builder':
            progress = Math.min(reputation.peopleHelped / 50 * 100, 100);
            break;
          case 'top_rated':
            if (reputation.totalRatingsReceived >= 10 && reputation.averageRating >= 4.5) {
              progress = 100;
            } else {
              progress = Math.min(reputation.totalRatingsReceived / 10 * 100, 100);
            }
            break;
        }
      }

      return {
        type,
        ...def,
        earned,
        progress: earned ? 100 : Math.floor(progress),
        earnedAt: earned ? earnedBadges.find(b => b.badgeType === type)?.earnedAt : null
      };
    });

    return allBadges;
  }

  /**
   * Award credits to user
   */
  async awardCredits(userId, amount, reason) {
    const reputation = await this.getOrCreateReputation(userId);
    
    await reputation.increment('teachingCredits', { by: amount });
    
    // Check for badge unlocks
    await this.checkAndAwardBadges(userId);
    
    return {
      newTotal: reputation.teachingCredits + amount,
      awarded: amount,
      reason
    };
  }

  /**
   * Update level based on total sessions
   */
  async updateLevel(userId) {
    const reputation = await this.getOrCreateReputation(userId);
    const totalSessions = reputation.totalSessionsHosted + reputation.sessionsAttended;
    
    const newLevel = UserReputation.calculateLevel(totalSessions);
    const levelProgress = UserReputation.calculateLevelProgress(totalSessions, newLevel);

    const levelChanged = reputation.currentLevel !== newLevel;

    await reputation.update({
      currentLevel: newLevel,
      levelProgress
    });

    return {
      previousLevel: reputation.currentLevel,
      newLevel,
      levelProgress,
      levelChanged
    };
  }

  /**
   * Check and award badges
   */
  async checkAndAwardBadges(userId) {
    const reputation = await this.getOrCreateReputation(userId);
    const earnedBadges = await UserBadge.findAll({ where: { userId } });
    const earnedTypes = earnedBadges.map(b => b.badgeType);
    const newBadges = [];

    const badgeConditions = [
      { type: 'first_steps', condition: reputation.totalSessionsHosted >= 1 },
      { type: 'helpful_hand', condition: reputation.peopleHelped >= 10 },
      { type: 'educator', condition: reputation.totalTeachingSessions >= 10 },
      { type: 'team_player', condition: reputation.totalShowcases >= 5 },
      { type: 'mentor_master', condition: reputation.totalMentorships >= 25 },
      { type: 'rising_star', condition: reputation.peopleHelped >= 50 },
      { type: 'thought_leader', condition: reputation.teachingCredits >= 100 },
      { type: 'community_builder', condition: reputation.peopleHelped >= 50 },
      { type: 'top_rated', condition: reputation.averageRating >= 4.5 && reputation.totalRatingsReceived >= 10 }
    ];

    for (const { type, condition } of badgeConditions) {
      if (condition && !earnedTypes.includes(type)) {
        await UserBadge.create({ userId, badgeType: type });
        newBadges.push({
          type,
          ...UserBadge.BADGE_DEFINITIONS[type]
        });
      }
    }

    return newBadges;
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(category = 'teachingCredits', limit = 10) {
    const orderField = ['teachingCredits', 'peopleHelped', 'sessionsAttended', 'averageRating']
      .includes(category) ? category : 'teachingCredits';

    const leaders = await UserReputation.findAll({
      include: [
        {
          model: User,
          as: 'user',
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
      order: [[orderField, 'DESC']],
      limit
    });

    return leaders.map((rep, index) => ({
      rank: index + 1,
      userId: rep.userId,
      user: rep.user,
      [category]: rep[category],
      currentLevel: rep.currentLevel
    }));
  }

  /**
   * Calculate sessions to next level
   */
  getSessionsToNextLevel(currentLevel, totalSessions) {
    const thresholds = {
      'newcomer': 11,
      'contributor': 26,
      'expert': 51,
      'master': 101,
      'legend': Infinity
    };

    const nextThreshold = thresholds[currentLevel] || 11;
    const remaining = Math.max(0, nextThreshold - totalSessions);
    
    return {
      currentLevel,
      totalSessions,
      sessionsToNextLevel: remaining,
      nextLevel: currentLevel === 'legend' ? 'legend' : 
        currentLevel === 'master' ? 'legend' :
        currentLevel === 'expert' ? 'master' :
        currentLevel === 'contributor' ? 'expert' : 'contributor'
    };
  }
}

module.exports = new ReputationService();
