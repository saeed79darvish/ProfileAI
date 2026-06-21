const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ATSBoard = sequelize.define('ATSBoard', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Friendly display name (e.g., "Google", "Stripe")'
  },
  platform: {
    type: DataTypes.ENUM('greenhouse', 'lever', 'ashby', 'remoteok', 'adzuna', 'jsearch', 'theirstack', 'wwr', 'amazon'),
    allowNull: false
  },
  boardToken: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The company slug/token for the ATS API (e.g., "google", "stripe")'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  jobCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  syncError: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Last sync error message, null if successful'
  },
  isStartup: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'True for boards discovered via the YC / VC-portfolio crawl — i.e. genuine startups. Hand-seeded boards (config/seedBoards.js: Airbnb, Roblox, Datadog, …) stay false. Drives the "Startups" job filter. Column added + backfilled by scripts/migrations/ensureStartupBoardFlag.js.'
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  tableName: 'ATSBoards',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['platform', 'boardToken']
    },
    { fields: ['isActive'] }
  ]
});

module.exports = ATSBoard;
