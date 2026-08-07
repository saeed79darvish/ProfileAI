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
          // NOTE: this list previously included 'optimizedSummary', which does
          // not exist on TailoredProfile (nor in the database) and never has —
          // it dates to the initial commit. PostgreSQL rejected the SELECT with
          // "column tailoredProfile.optimizedSummary does not exist", so THIS
          // ENDPOINT RETURNED 500 FOR EVERY USER ON EVERY CALL, which is why
          // the My Jobs list came up empty. Keep this to columns the model
          // actually declares.
          attributes: ['id', 'jobTitle', 'companyName', 'matchScore'],
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

    // `total` counts CONFIRMED applications only. Rows sitting at 'clicked' or
    // 'in_progress' are jobs the user opened or started, not applied to, and
    // including them is exactly what made this number overstate reality. They
    // are still reported separately as `started` so the UI can surface them as
    // unfinished work.
    const { STAGE_ORDER } = require('../services/applicationTrackingService');
    const STARTED_STATUSES = ['clicked', 'in_progress'];
    const CONFIRMED_STATUSES = STAGE_ORDER
      .filter((s) => !STARTED_STATUSES.includes(s))
      .concat(['rejected', 'no_response']);

    const [total, started, byStatus, thisWeek, avgMatchScore] = await Promise.all([
      ExternalApplication.count({ where: { userId, status: { [Op.in]: CONFIRMED_STATUSES } } }),
      ExternalApplication.count({ where: { userId, status: { [Op.in]: STARTED_STATUSES } } }),
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
      started,
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

    // Optional stage reported by the caller. The Chrome extension fires this
    // endpoint when it AUTOFILLS a form, which is evidence the user started the
    // application — not that they submitted it — so an updated extension sends
    // stage='in_progress' there and stage='applied' only once it detects a real
    // form submit or confirmation page.
    //
    // The default stays 'applied' deliberately: extensions update on the Chrome
    // Web Store's schedule, so older versions in the wild keep sending no stage
    // at all, and a manual "add application" from the UI genuinely IS a
    // confirmed application. Defaulting to 'applied' therefore preserves both
    // behaviours; the extension gets more honest as users update.
    const { recordApplicationSignal, STAGE_ORDER } = require('../services/applicationTrackingService');
    const requestedStage = STAGE_ORDER.includes(req.body.stage) ? req.body.stage : 'applied';
    const provenance = req.body.confirmedBy
      || (requestedStage === 'applied' ? 'user' : 'extension_autofill');

    const { application, created } = await recordApplicationSignal({
      userId: req.user.id,
      externalJobId: req.body.externalJobId || null,
      jobUrl,
      stage: requestedStage,
      confirmedBy: provenance,
      fields: {
        jobTitle,
        company,
        location,
        platform,
        salary,
        jobType,
        locationType,
        notes,
        tailoredProfileId,
        resumeUsed,
        coverLetterUsed: coverLetterUsed || false,
        matchScore,
      },
    });

    // Preserve the previous contract: callers (including shipped extension
    // builds) treat 409 as "already tracked, stop retrying".
    if (!created) {
      return res.status(409).json({ message: 'Application already tracked', application });
    }
    if (appliedAt && created) {
      // Honour a caller-supplied timestamp for imports/backfills.
      await application.update({ appliedAt });
    }

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

        // Route through the tracking service rather than creating rows
        // directly, so bulk-synced rows get the same identity resolution as
        // every other path. The old code deduped on the RAW jobUrl, which
        // missed tracking-param variants of a posting the user had already
        // tracked — so a re-sync could insert a second row for the same
        // application. It also left normalizedJobUrl unset, making those rows
        // invisible to later dedup.
        const { recordApplicationSignal, STAGE_ORDER } =
          require('../services/applicationTrackingService');
        const stage = STAGE_ORDER.includes(app.stage) ? app.stage : 'applied';
        const { application, created } = await recordApplicationSignal({
          userId: req.user.id,
          externalJobId: app.externalJobId || null,
          jobUrl: app.jobUrl || null,
          stage,
          confirmedBy: app.confirmedBy || 'import',
          fields: app,
        });
        if (!created) {
          results.duplicates++;
          continue;
        }
        if (app.appliedAt) await application.update({ appliedAt: app.appliedAt });
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
