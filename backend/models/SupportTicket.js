const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * SupportTicket — a message from a user (or guest) to the ops inbox.
 *
 * Created either directly by the user via the Help Center's "Contact
 * support" form or offered by the AI chatbot when it can't confidently
 * resolve the issue on its own. The admin dashboard reads from this
 * table; an email also fires on create.
 */
const SupportTicket = sequelize.define('SupportTicket', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Nullable so a signed-out user hitting a public Help page could still
  // submit — currently we require auth, but the schema shouldn't lock us in.
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' }
  },
  // Echo the email + name at submission time so admins can reply even
  // if the user later changes their profile email or deletes the account.
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category: {
    type: DataTypes.ENUM('bug', 'feature', 'billing', 'account', 'question', 'other'),
    allowNull: false,
    defaultValue: 'question'
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  // Optional transcript of the AI chatbot conversation that led here —
  // saves admins from asking the user to re-explain.
  chatTranscript: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'closed'),
    allowNull: false,
    defaultValue: 'open'
  },
  // Free-text admin notes, resolution summary, etc.
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Threaded conversation on this ticket: each entry is
  // { by: 'admin' | 'user', adminId?, body, createdAt }.
  // Admin replies are appended here AND emailed to the user; the initial
  // ticket body stays in `message` so we don't duplicate it in the thread.
  replies: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Where the ticket originated: help-center form, ai-chat fallback,
  // in-app widget, extension, etc.
  source: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'help_center'
  },
  // Non-PII context for triage (URL, user agent, plan).
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'SupportTickets',
  indexes: [
    { fields: ['status'] },
    { fields: ['userId'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = SupportTicket;
