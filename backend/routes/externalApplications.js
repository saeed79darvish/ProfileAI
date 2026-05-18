const express = require('express');
const router = express.Router();
const { ExternalApplication, TailoredProfile } = require('../models');
const authMiddleware = require('../middleware/auth');
const { Op } = require('sequelize');

// @route   GET /api/external-applications
// @desc    Get all external applications for the current user
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      status,
      search,
      sortBy = 'appliedAt',
      sortOrder = 'DESC',
      page = 1,
      limit = 50,
    } = req.query;

    const where = { userId: req.user.id };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { jobTitle: { [Op.iLike]: `%${search}%` } },
        { company: { [Op.iLike]: `%${search}%` } },
        { platform: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows: applications, count: total } = await ExternalApplication.findAndCountAll({
      where,
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset,
      include: [
        {
          model: TailoredProfile,
          as: 'tailoredProfile',
          attributes: ['id', 'matchScore', 'optimizedSummary'],
          required: false,
        },
      ],
    });

    res.json({
      applications,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching external applications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/external-applications/stats
// @desc    Get application statistics for the current user
// @access  Private
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [total, byStatus, thisWeek, avgMatchScore] = await Promise.all([
      ExternalApplication.count({ where: { userId } }),
      ExternalApplication.findAll({
        where: { userId },
        attributes: [
          'status',
          [ExternalApplication.sequelize.fn('COUNT', '*'), 'count'],
        ],
        group: ['status'],
        raw: true,
      }),
      ExternalApplication.count({
        where: {
          userId,
          appliedAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      ExternalApplication.findOne({
        where: { userId, matchScore: { [Op.ne]: null } },
        attributes: [
          [ExternalApplication.sequelize.fn('AVG', ExternalApplication.sequelize.col('matchScore')), 'avg'],
        ],
        raw: true,
      }),
    ]);

    const statusMap = {};
    byStatus.forEach((s) => {
      statusMap[s.status] = parseInt(s.count);
    });

    res.json({
      total,
      thisWeek,
      avgMatchScore: avgMatchScore?.avg ? Math.round(parseFloat(avgMatchScore.avg)) : null,
      byStatus: statusMap,
    });
  } catch (error) {
    console.error('Error fetching application stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/external-applications
// @desc    Save a new external application (from Chrome extension or manual)
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      jobTitle,
      company,
      location,
      jobUrl,
      platform,
      salary,
      jobType,
      locationType,
      notes,
      tailoredProfileId,
      resumeUsed,
      coverLetterUsed,
      matchScore,
      appliedAt,
    } = req.body;

    if (!jobTitle) {
      return res.status(400).json({ message: 'jobTitle is required' });
    }

    // Check for duplicate (same user + same URL)
    if (jobUrl) {
      const existing = await ExternalApplication.findOne({
        where: { userId: req.user.id, jobUrl },
      });
      if (existing) {
        return res.status(409).json({
          message: 'Application already tracked',
          application: existing,
        });
      }
    }

    const application = await ExternalApplication.create({
      userId: req.user.id,
      jobTitle,
      company,
      location,
      jobUrl,
      platform,
      salary,
      jobType,
      locationType,
      notes,
      tailoredProfileId,
      resumeUsed,
      coverLetterUsed: coverLetterUsed || false,
      matchScore,
      appliedAt: appliedAt || new Date(),
    });

    res.status(201).json(application);
  } catch (error) {
    console.error('Error saving external application:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/external-applications/:id
// @desc    Update an external application (status, notes, etc.)
// @access  Private
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const application = await ExternalApplication.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const allowedFields = [
      'status',
      'notes',
      'salary',
      'jobType',
      'locationType',
      'jobTitle',
      'company',
      'location',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        application[field] = req.body[field];
      }
    });

    await application.save();
    res.json(application);
  } catch (error) {
    console.error('Error updating external application:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/external-applications/:id
// @desc    Delete an external application
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const application = await ExternalApplication.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    await application.destroy();
    res.json({ message: 'Application deleted' });
  } catch (error) {
    console.error('Error deleting external application:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/external-applications/bulk
// @desc    Save multiple external applications at once (batch sync from extension)
// @access  Private
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    const { applications } = req.body;

    if (!Array.isArray(applications) || applications.length === 0) {
      return res.status(400).json({ message: 'applications array is required' });
    }

    const results = { created: 0, duplicates: 0, errors: 0 };

    for (const app of applications) {
      try {
        if (!app.jobTitle || !app.company) {
          results.errors++;
          continue;
        }

        // Skip duplicates by URL
        if (app.jobUrl) {
          const existing = await ExternalApplication.findOne({
            where: { userId: req.user.id, jobUrl: app.jobUrl },
          });
          if (existing) {
            results.duplicates++;
            continue;
          }
        }

        await ExternalApplication.create({
          userId: req.user.id,
          ...app,
          appliedAt: app.appliedAt || new Date(),
        });
        results.created++;
      } catch (err) {
        results.errors++;
      }
    }

    res.status(201).json(results);
  } catch (error) {
    console.error('Error bulk saving applications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
