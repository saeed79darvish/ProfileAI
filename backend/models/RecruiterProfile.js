const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RecruiterProfile = sequelize.define('RecruiterProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  companySlug: {
    type: DataTypes.STRING,
    allowNull: true,
    // Unique constraint is enforced via database index
    comment: 'URL-friendly company identifier (e.g., chaloos-recruit)'
  },
  companyTagline: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Short company tagline/motto'
  },
  companyBanner: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Company banner/cover image URL'
  },
  employeeCount: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Number of employees or follower count display'
  },
  companyWebsite: {
    type: DataTypes.STRING,
    allowNull: true
  },
  companySize: {
    type: DataTypes.ENUM('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'),
    allowNull: true
  },
  industry: {
    type: DataTypes.STRING,
    allowNull: true
  },
  jobTitle: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  linkedinUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  companyDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  companyLogo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  profilePicture: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  hiringStats: {
    type: DataTypes.JSONB,
    defaultValue: {
      totalProjects: 0,
      activeProjects: 0,
      totalHires: 0,
      averageTimeToHire: 0
    }
  },
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      industries: [],
      skills: [],
      locations: [],
      salaryRange: { min: 0, max: 0 }
    }
  },
  // Recruiter's availability for scheduling interviews
  availability: {
    type: DataTypes.JSONB,
    defaultValue: {
      timezone: 'America/Los_Angeles',
      // Working hours per day of week (0=Sunday, 6=Saturday)
      workingHours: {
        1: { enabled: true, start: '09:00', end: '17:00' },  // Monday
        2: { enabled: true, start: '09:00', end: '17:00' },  // Tuesday
        3: { enabled: true, start: '09:00', end: '17:00' },  // Wednesday
        4: { enabled: true, start: '09:00', end: '17:00' },  // Thursday
        5: { enabled: true, start: '09:00', end: '17:00' },  // Friday
        0: { enabled: false, start: '09:00', end: '17:00' }, // Sunday
        6: { enabled: false, start: '09:00', end: '17:00' }  // Saturday
      },
      // Blocked times (recurring or one-time)
      blockedSlots: [],
      // Preferred interview duration in minutes
      preferredDuration: 30,
      // Buffer time between interviews in minutes
      bufferTime: 15,
      // How many days ahead to allow scheduling
      schedulingWindow: 14
    },
    comment: 'Recruiter availability settings for interview scheduling'
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

module.exports = RecruiterProfile;
