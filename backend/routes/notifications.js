const express = require('express');
const router = express.Router();
const { Notification, User } = require('../models');
const authMiddleware = require('../middleware/auth');
const { Op } = require('sequelize');

/**
 * @route   GET /api/notifications
 * @desc    Get paginated notifications for current user
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      unreadOnly = 'false',
      type 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const where = { userId };
    
    // Filter by read status
    if (unreadOnly === 'true') {
      where.isRead = false;
    }
    
    // Filter by type (supports comma-separated list)
    if (type) {
      const types = type.split(',').map(t => t.trim()).filter(Boolean);
      if (types.length === 1) {
        where.type = types[0];
      } else if (types.length > 1) {
        where.type = { [Op.in]: types };
      }
    }

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      notifications,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        hasMore: offset + notifications.length < count
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count for badge
 * @access  Private
 */
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await Notification.count({
      where: {
        userId,
        isRead: false
      }
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Error fetching unread count', error: error.message });
  }
});

/**
 * @route   GET /api/notifications/preview
 * @desc    Get latest unread notifications for dropdown preview
 * @access  Private
 */
router.get('/preview', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;

    const notifications = await Notification.findAll({
      where: {
        userId,
        isRead: false
      },
      order: [['createdAt', 'DESC']],
      limit
    });

    const unreadCount = await Notification.count({
      where: {
        userId,
        isRead: false
      }
    });

    res.json({ 
      notifications,
      unreadCount,
      hasMore: unreadCount > limit
    });
  } catch (error) {
    console.error('Error fetching notification preview:', error);
    res.status(500).json({ message: 'Error fetching preview', error: error.message });
  }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Private
 */
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Error updating notification', error: error.message });
  }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [updatedCount] = await Notification.update(
      { 
        isRead: true, 
        readAt: new Date() 
      },
      { 
        where: { 
          userId, 
          isRead: false 
        } 
      }
    );

    res.json({ 
      message: 'All notifications marked as read', 
      updatedCount 
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Error updating notifications', error: error.message });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.destroy();

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
});

/**
 * @route   DELETE /api/notifications/clear-all
 * @desc    Delete all notifications for user
 * @access  Private
 */
router.delete('/clear-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { readOnly = 'false' } = req.query;

    const where = { userId };
    if (readOnly === 'true') {
      where.isRead = true;
    }

    const deletedCount = await Notification.destroy({ where });

    res.json({ 
      message: readOnly === 'true' 
        ? 'Read notifications cleared' 
        : 'All notifications cleared', 
      deletedCount 
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ message: 'Error clearing notifications', error: error.message });
  }
});

/**
 * @route   POST /api/notifications/test
 * @desc    Create test notifications (development only)
 * @access  Private
 */
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const testNotifications = [
      {
        userId,
        type: 'interview_scheduled',
        title: 'Interview Scheduled: Senior Developer',
        message: 'Your interview has been scheduled for tomorrow at 2:00 PM.',
        data: { interviewId: 'test-123' }
      },
      {
        userId,
        type: 'application_status',
        title: 'Application Update: Frontend Engineer',
        message: 'Congratulations! You have been shortlisted for this position.',
        data: { applicationId: 'test-456', status: 'shortlisted' }
      },
      {
        userId,
        type: 'message_received',
        title: 'New Message from John Smith',
        message: 'Hi! I wanted to follow up on your application...',
        data: { conversationId: 'test-789' }
      },
      {
        userId,
        type: 'agent_completed',
        title: 'Negotiation Complete',
        message: 'The AI negotiation has reached an agreement! Review the terms.',
        data: { negotiationId: 'test-neg-1' }
      }
    ];

    const created = await Notification.bulkCreate(testNotifications);
    
    res.status(201).json({
      message: `Created ${created.length} test notifications`,
      notifications: created
    });
  } catch (error) {
    console.error('Error creating test notifications:', error);
    res.status(500).json({ message: 'Error creating test notifications', error: error.message });
  }
});

module.exports = router;
