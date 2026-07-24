const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { User, Profile, RecruiterProfile, PromoCode, PromoRedemption, AIUsage, Subscription, Job, Post, ATSBoard, ExternalJob, BlockedCompany, sequelize } = require('../models');
const { syncBoard, syncAllBoards, validateBoard, enforceActiveBoardCap } = require('../services/externalJobService');

// All routes require auth + admin
router.use(auth, admin);

// ─── DASHBOARD STATS ──────────────────────────────────────────

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
// @access  Admin
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisMonth,
      newUsersThisWeek,
      totalCandidates,
      totalRecruiters,
      totalAdmins,
      totalJobs,
      totalPosts,
      totalAIUsage,
      aiUsageThisMonth,
      activePromos,
      totalRedemptions,
      tierCounts
    ] = await Promise.all([
      User.count(),
      User.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } }),
      User.count({ where: { createdAt: { [Op.gte]: sevenDaysAgo } } }),
      User.count({ where: { role: 'candidate' } }),
      User.count({ where: { role: 'recruiter' } }),
      User.count({ where: { role: 'admin' } }),
      Job.count(),
      Post.count(),
      AIUsage.count(),
      AIUsage.count({ where: { usedAt: { [Op.gte]: thirtyDaysAgo } } }),
      PromoCode.count({ where: { isActive: true } }),
      PromoRedemption.count(),
      User.findAll({
        attributes: ['subscriptionTier', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['subscriptionTier'],
        raw: true
      })
    ]);

    res.json({
      users: {
        total: totalUsers,
        newThisMonth: newUsersThisMonth,
        newThisWeek: newUsersThisWeek,
        candidates: totalCandidates,
        recruiters: totalRecruiters,
        admins: totalAdmins,
        byTier: tierCounts.reduce((acc, t) => ({ ...acc, [t.subscriptionTier || 'free']: parseInt(t.count) }), {})
      },
      content: {
        jobs: totalJobs,
        posts: totalPosts
      },
      ai: {
        totalUsage: totalAIUsage,
        usageThisMonth: aiUsageThisMonth
      },
      promos: {
        activeCodes: activePromos,
        totalRedemptions: totalRedemptions
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── USER MANAGEMENT ──────────────────────────────────────────

// @route   GET /api/admin/users
// @desc    List all users with filtering/search/pagination
// @access  Admin
router.get('/users', async (req, res) => {
  try {
    console.log('Admin users endpoint called with query:', req.query);
    const { page = 1, limit = 20, search, role, tier, sort = 'createdAt', order = 'DESC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (role) where.role = role;
    if (tier) where.subscriptionTier = tier;
    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const allowedSorts = ['createdAt', 'email', 'firstName', 'role', 'subscriptionTier'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'subscriptionTier', 'subscriptionStatus', 'isActive', 'createdAt', 'updatedAt'],
      order: [[sortField, sortOrder]],
      limit: parseInt(limit),
      offset
    });

    res.json({
      users: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// @route   GET /api/admin/users/:id
// @desc    Get single user details
// @access  Admin
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Profile, as: 'profile' },
        { model: RecruiterProfile, as: 'recruiterProfile' },
        { model: PromoRedemption, as: 'promoRedemptions', include: [{ model: PromoCode, as: 'promoCode', attributes: ['code', 'description', 'type'] }] }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get AI usage summary
    const aiUsageCount = await AIUsage.count({ where: { userId: user.id } });

    res.json({ user, aiUsageCount });
  } catch (error) {
    console.error('Admin user detail error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Change user role
// @access  Admin
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['candidate', 'recruiter', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be candidate, recruiter, or admin.' });
    }

    // Prevent self-demotion
    if (req.params.id === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change your own role. Ask another admin.' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const previousRole = user.role;
    user.role = role;
    await user.save();

    res.json({ 
      success: true, 
      message: `${user.firstName} ${user.lastName} role changed: ${previousRole} → ${role}`,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Admin role change error:', error);
    res.status(500).json({ error: 'Failed to change role' });
  }
});

// @route   PUT /api/admin/users/:id/tier
// @desc    Change user subscription tier
// @access  Admin
router.put('/users/:id/tier', async (req, res) => {
  try {
    const { tier } = req.body;
    if (!['free', 'pro', 'enterprise'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be free, pro, or enterprise.' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const previousTier = user.subscriptionTier;
    user.subscriptionTier = tier;
    user.subscriptionStatus = tier === 'free' ? 'inactive' : 'active';
    await user.save();

    res.json({ 
      success: true, 
      message: `${user.firstName} ${user.lastName} tier changed: ${previousTier} → ${tier}`,
      user: { id: user.id, email: user.email, subscriptionTier: user.subscriptionTier }
    });
  } catch (error) {
    console.error('Admin tier change error:', error);
    res.status(500).json({ error: 'Failed to change tier' });
  }
});

// @route   PUT /api/admin/users/:id/toggle-active
// @desc    Activate/deactivate a user
// @access  Admin
router.put('/users/:id/toggle-active', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate yourself' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.isActive = !user.isActive;
    await user.save();

    res.json({ 
      success: true, 
      message: `${user.firstName} ${user.lastName} is now ${user.isActive ? 'active' : 'deactivated'}`,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Admin toggle active error:', error);
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

// ─── PROMO CODE MANAGEMENT ───────────────────────────────────

// @route   GET /api/admin/promos
// @desc    List all promo codes
// @access  Admin
router.get('/promos', async (req, res) => {
  try {
    const promos = await PromoCode.findAll({
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }]
    });

    res.json({ promos });
  } catch (error) {
    console.error('Admin promos error:', error);
    res.status(500).json({ error: 'Failed to fetch promos' });
  }
});

// @route   POST /api/admin/promos
// @desc    Create a promo code
// @access  Admin
router.post('/promos', async (req, res) => {
  try {
    const {
      code,
      description,
      type = 'ai_bonus',
      dailyMultiplier = 2,
      dailyBonusFlat = 0,
      grantTier,
      durationDays = 30,
      maxRedemptions = null,
      validFrom,
      validUntil
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Promo code is required' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const existing = await PromoCode.findOne({ where: { code: normalizedCode } });
    if (existing) {
      return res.status(400).json({ error: `Code "${normalizedCode}" already exists` });
    }

    const promo = await PromoCode.create({
      code: normalizedCode,
      description,
      type,
      dailyMultiplier: type === 'ai_bonus' ? dailyMultiplier : null,
      dailyBonusFlat: type === 'ai_bonus' ? dailyBonusFlat : 0,
      grantTier: type === 'subscription_upgrade' ? grantTier : null,
      durationDays,
      maxRedemptions,
      validFrom: validFrom || new Date(),
      validUntil: validUntil || null,
      isActive: true,
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, promo });
  } catch (error) {
    console.error('Admin create promo error:', error);
    res.status(500).json({ error: 'Failed to create promo code' });
  }
});

// @route   PUT /api/admin/promos/:id
// @desc    Update a promo code
// @access  Admin
router.put('/promos/:id', async (req, res) => {
  try {
    const promo = await PromoCode.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Promo code not found' });

    const allowed = ['description', 'isActive', 'maxRedemptions', 'validUntil', 'dailyMultiplier', 'dailyBonusFlat', 'durationDays'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        promo[key] = req.body[key];
      }
    }
    await promo.save();

    res.json({ success: true, promo });
  } catch (error) {
    console.error('Admin update promo error:', error);
    res.status(500).json({ error: 'Failed to update promo' });
  }
});

// @route   DELETE /api/admin/promos/:id
// @desc    Deactivate a promo code
// @access  Admin
router.delete('/promos/:id', async (req, res) => {
  try {
    const promo = await PromoCode.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Promo code not found' });

    promo.isActive = false;
    await promo.save();

    res.json({ success: true, message: `Promo code "${promo.code}" deactivated` });
  } catch (error) {
    console.error('Admin delete promo error:', error);
    res.status(500).json({ error: 'Failed to deactivate promo' });
  }
});

// @route   GET /api/admin/promos/:id/redemptions
// @desc    Get all redemptions for a promo code
// @access  Admin
router.get('/promos/:id/redemptions', async (req, res) => {
  try {
    const redemptions = await PromoRedemption.findAll({
      where: { promoCodeId: req.params.id },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ redemptions });
  } catch (error) {
    console.error('Admin promo redemptions error:', error);
    res.status(500).json({ error: 'Failed to fetch redemptions' });
  }
});

// ─── ATS BOARD MANAGEMENT ──────────────────────────────────────

// @route   GET /api/admin/ats-boards
// @desc    Get all ATS boards
// @access  Admin
router.get('/ats-boards', async (req, res) => {
  try {
    const boards = await ATSBoard.findAll({
      include: [{ model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json({ boards });
  } catch (error) {
    console.error('Admin ATS boards error:', error);
    res.status(500).json({ error: 'Failed to fetch ATS boards' });
  }
});

// @route   POST /api/admin/ats-boards
// @desc    Create a new ATS board
// @access  Admin
router.post('/ats-boards', async (req, res) => {
  try {
    const { name, platform, boardToken } = req.body;

    if (!name || !platform || !boardToken) {
      return res.status(400).json({ error: 'name, platform, and boardToken are required' });
    }

    if (!['greenhouse', 'lever'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be greenhouse or lever' });
    }

    // Validate the board is reachable
    const validation = await validateBoard(platform, boardToken);
    if (!validation.valid) {
      return res.status(400).json({ error: `Board validation failed: ${validation.error}` });
    }

    const board = await ATSBoard.create({
      name,
      platform,
      boardToken: boardToken.trim().toLowerCase(),
      createdBy: req.user.id
    });

    // Trigger initial sync
    syncBoard(board).catch(err =>
      console.error(`Initial sync failed for ${board.name}:`, err.message)
    );

    res.status(201).json({
      board,
      message: `Board created. Found ${validation.jobCount} jobs. Initial sync started.`
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'This board already exists' });
    }
    console.error('Admin create ATS board error:', error);
    res.status(500).json({ error: 'Failed to create ATS board' });
  }
});

// @route   PUT /api/admin/ats-boards/:id
// @desc    Update an ATS board
// @access  Admin
router.put('/ats-boards/:id', async (req, res) => {
  try {
    const board = await ATSBoard.findByPk(req.params.id);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const { name, isActive } = req.body;
    if (name !== undefined) board.name = name;
    if (isActive !== undefined) board.isActive = isActive;

    await board.save();
    res.json({ board });
  } catch (error) {
    console.error('Admin update ATS board error:', error);
    res.status(500).json({ error: 'Failed to update ATS board' });
  }
});

// @route   DELETE /api/admin/ats-boards/:id
// @desc    Delete an ATS board and its jobs
// @access  Admin
router.delete('/ats-boards/:id', async (req, res) => {
  try {
    const board = await ATSBoard.findByPk(req.params.id);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Deactivate jobs from this board instead of deleting
    await ExternalJob.update(
      { isActive: false },
      { where: { source: board.platform, boardToken: board.boardToken } }
    );

    await board.destroy();
    res.json({ message: 'Board deleted and jobs deactivated' });
  } catch (error) {
    console.error('Admin delete ATS board error:', error);
    res.status(500).json({ error: 'Failed to delete ATS board' });
  }
});

// @route   POST /api/admin/ats-boards/:id/sync
// @desc    Manually trigger sync for a single board
// @access  Admin
router.post('/ats-boards/:id/sync', async (req, res) => {
  try {
    const board = await ATSBoard.findByPk(req.params.id);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const result = await syncBoard(board);
    res.json(result);
  } catch (error) {
    console.error('Admin sync ATS board error:', error);
    res.status(500).json({ error: 'Failed to sync board' });
  }
});

// @route   POST /api/admin/ats-boards/sync-all
// @desc    Manually trigger sync for all active boards
// @access  Admin
router.post('/ats-boards/sync-all', async (req, res) => {
  try {
    const result = await syncAllBoards();
    res.json(result);
  } catch (error) {
    console.error('Admin sync all boards error:', error);
    res.status(500).json({ error: 'Failed to sync boards' });
  }
});

// @route   POST /api/admin/ats-boards/enforce-cap
// @desc    Manually run the self-balancing active-board cap sweep (also runs
//          on its own schedule — see server.js). Retires the weakest
//          discovery-sourced boards (fewest active jobs, most stale) when the
//          active-board count is over MAX_ACTIVE_BOARDS. Never touches
//          hand-curated SEED_BOARDS.
// @access  Admin
router.post('/ats-boards/enforce-cap', async (req, res) => {
  try {
    const maxBoards = parseInt(req.body?.maxBoards || process.env.MAX_ACTIVE_BOARDS || '750', 10);
    const result = await enforceActiveBoardCap({ maxBoards, limit: parseInt(req.body?.limit || '100', 10) });
    res.json(result);
  } catch (error) {
    console.error('Admin enforce board cap error:', error);
    res.status(500).json({ error: 'Failed to enforce board cap' });
  }
});

// ─── JOB / COMPANY MODERATION ─────────────────────────────────
// No automated scam/spam detection exists for the external-jobs corpus —
// these are the manual levers: delete a single bad listing, or block an
// entire company so it's purged now and never re-ingested.

// @route   DELETE /api/admin/external-jobs/:id
// @desc    Remove a single external job listing (e.g. a scam / bad posting).
//          Soft-delete (isActive=false) rather than a hard DELETE: SavedJob /
//          ApplyPilotApplication / ExternalApplication rows can reference this
//          job by FK, and the existing prune sweep (pruneStaleInactiveJobs)
//          reclaims the row for real after its normal grace period.
// @access  Admin
router.delete('/external-jobs/:id', async (req, res) => {
  try {
    const job = await ExternalJob.findByPk(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    await job.update({ isActive: false });
    try { require('../services/simpleCache').invalidatePrefix('external_jobs:'); } catch { /* optional */ }
    res.json({ message: 'Job removed', id: job.id });
  } catch (error) {
    console.error('Admin delete external job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// @route   GET /api/admin/blocked-companies
// @desc    List the company moderation blocklist
// @access  Admin
router.get('/blocked-companies', async (req, res) => {
  try {
    const blocked = await BlockedCompany.findAll({
      include: [{ model: User, as: 'blocker', attributes: ['id', 'firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ blocked });
  } catch (error) {
    console.error('Admin list blocked companies error:', error);
    res.status(500).json({ error: 'Failed to fetch blocked companies' });
  }
});

// @route   POST /api/admin/blocked-companies
// @desc    Block a company by name — purges it NOW (deactivates any matching
//          ATSBoards + their jobs, plus any ExternalJob rows with that company
//          name from aggregator sources) and prevents future re-ingestion
//          (syncBoard checks this list — see externalJobService.isCompanyBlocked).
//          Case-insensitive; stored lowercased.
// @access  Admin
router.post('/blocked-companies', async (req, res) => {
  try {
    const { companyName, reason } = req.body;
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ error: 'companyName is required' });
    }
    const normalized = companyName.trim().toLowerCase();

    const [blocked, created] = await BlockedCompany.findOrCreate({
      where: { companyName: normalized },
      defaults: { companyName: normalized, reason: reason || null, createdBy: req.user.id },
    });
    if (!created) {
      return res.status(409).json({ error: 'Company already blocked', blocked });
    }

    // Purge immediately: matching boards (their jobs deactivate via the same
    // path admin board-delete uses) and any aggregator-sourced job rows under
    // that company name that aren't tied to a board row.
    const boards = await ATSBoard.findAll({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('name')), normalized),
    });
    for (const board of boards) {
      await ExternalJob.update(
        { isActive: false },
        { where: { source: board.platform, boardToken: board.boardToken } }
      );
      await board.update({ isActive: false, syncError: 'Company blocklisted by admin' });
    }
    const [jobsPurged] = await ExternalJob.update(
      { isActive: false },
      { where: sequelize.where(sequelize.fn('lower', sequelize.col('company')), normalized) }
    );

    try { require('../services/simpleCache').invalidatePrefix('external_jobs:'); } catch { /* optional */ }
    res.status(201).json({
      blocked,
      message: `Blocked "${companyName}". Deactivated ${boards.length} board(s) and ${jobsPurged} job(s).`,
    });
  } catch (error) {
    console.error('Admin block company error:', error);
    res.status(500).json({ error: 'Failed to block company' });
  }
});

// @route   DELETE /api/admin/blocked-companies/:id
// @desc    Unblock a company. Does NOT automatically reactivate its previously
//          purged boards/jobs (avoids silently resurrecting stale data) — use
//          PUT /api/admin/ats-boards/:id { isActive: true } and re-sync if the
//          block was a mistake.
// @access  Admin
router.delete('/blocked-companies/:id', async (req, res) => {
  try {
    const blocked = await BlockedCompany.findByPk(req.params.id);
    if (!blocked) {
      return res.status(404).json({ error: 'Blocked company not found' });
    }
    await blocked.destroy();
    res.json({ message: 'Company unblocked (boards/jobs not auto-restored)' });
  } catch (error) {
    console.error('Admin unblock company error:', error);
    res.status(500).json({ error: 'Failed to unblock company' });
  }
});

module.exports = router;
