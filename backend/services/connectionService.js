/**
 * Connection Service
 *
 * Used by the Claude MCP connector to let candidates and recruiters
 * start a conversation from inside Claude. Mirrors the behaviour of
 * backend/routes/messages.js POST /api/messages/send/:userId.
 */

const { Op } = require('sequelize');
const { Conversation, Message, User } = require('../models');
const notificationService = require('./notificationService');

/**
 * Send a first-contact (or follow-up) message to another user.
 * Creates the Conversation row if one does not already exist.
 *
 * @param {string} senderId    UUID of the authenticated sender
 * @param {string} recipientId UUID of the recipient
 * @param {string} content     Message body (1\u20132000 chars after trim)
 * @returns {Promise<{ conversationId: string, messageId: string, recipient: object }>}
 * @throws  { code: 'SELF' | 'EMPTY' | 'NOT_FOUND' | 'TOO_LONG' }
 */
async function startConversation(senderId, recipientId, content) {
  if (!content || !content.trim()) {
    const err = new Error('Message content is required');
    err.code = 'EMPTY';
    throw err;
  }
  const trimmed = content.trim();
  if (trimmed.length > 2000) {
    const err = new Error('Message is too long (max 2000 characters)');
    err.code = 'TOO_LONG';
    throw err;
  }
  if (senderId === recipientId) {
    const err = new Error('Cannot send a message to yourself');
    err.code = 'SELF';
    throw err;
  }

  const recipient = await User.findByPk(recipientId, {
    attributes: ['id', 'firstName', 'lastName'],
  });
  if (!recipient) {
    const err = new Error('Recipient not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const [p1, p2] = [senderId, recipientId].sort();

  let conversation = await Conversation.findOne({
    where: {
      [Op.or]: [
        { participant1Id: senderId, participant2Id: recipientId },
        { participant1Id: recipientId, participant2Id: senderId },
      ],
    },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participant1Id: p1,
      participant2Id: p2,
      lastMessageAt: new Date(),
      lastMessagePreview: trimmed.substring(0, 255),
    });
  }

  const message = await Message.create({
    conversationId: conversation.id,
    senderId,
    content: trimmed,
  });

  await conversation.update({
    lastMessageAt: new Date(),
    lastMessagePreview: trimmed.substring(0, 255),
  });

  const sender = await User.findByPk(senderId, {
    attributes: ['id', 'firstName', 'lastName'],
  });

  notificationService
    .notifyNewMessage(recipientId, sender, conversation, trimmed.substring(0, 100))
    .catch((err) => console.error('Error creating message notification:', err));

  return {
    conversationId: conversation.id,
    messageId: message.id,
    recipient: {
      id: recipient.id,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
    },
  };
}

module.exports = { startConversation };
