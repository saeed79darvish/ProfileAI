const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { RecruiterATSIntegration } = require('../models');
const {
  encrypt,
  decrypt,
  validateApiKey,
  fetchAllOpenJobs,
  fetchHarvestJob,
  fetchHiringTeam,
  normalizeHarvestJob
} = require('../services/harvestService');

/**
 * @route   POST /api/harvest/connect
 * @desc    Connect a Greenhouse Harvest API key
 * @access  Private (recruiter)
 */
router.post('/connect', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Only recruiters can connect ATS integrations' });
    }

    const { apiKey, label } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return res.status(400).json({ message: 'A valid API key is required' });
    }

    // Validate the key against Greenhouse
    const validation = await validateApiKey(apiKey.trim());
    if (!validation.valid) {
      return res.status(400).json({ message: `Invalid API key: ${validation.error}` });
    }

    // Encrypt and store
    const apiKeyEncrypted = encrypt(apiKey.trim());

    const [integration, created] = await RecruiterATSIntegration.upsert({
      userId: req.userId,
      platform: 'greenhouse',
      apiKeyEncrypted,
      label: label || 'Greenhouse',
      isActive: true,
      syncError: null
    }, {
      conflictFields: ['userId', 'platform']
    });

    res.json({
      message: created ? 'Greenhouse connected successfully' : 'Greenhouse API key updated',
      integration: {
        id: integration.id,
        platform: integration.platform,
        label: integration.label,
        isActive: integration.isActive,
        lastSyncAt: integration.lastSyncAt,
        jobCount: integration.jobCount
      }
    });
  } catch (error) {
    console.error('Error connecting Greenhouse:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/harvest/disconnect
 * @desc    Disconnect Greenhouse integration
 * @access  Private (recruiter)
 */
router.delete('/disconnect', authMiddleware, async (req, res) => {
  try {
    const deleted = await RecruiterATSIntegration.destroy({
      where: { userId: req.userId, platform: 'greenhouse' }
    });

    if (!deleted) {
      return res.status(404).json({ message: 'No Greenhouse integration found' });
    }

    res.json({ message: 'Greenhouse disconnected' });
  } catch (error) {
    console.error('Error disconnecting Greenhouse:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/harvest/status
 * @desc    Get integration status
 * @access  Private (recruiter)
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const integration = await RecruiterATSIntegration.findOne({
      where: { userId: req.userId, platform: 'greenhouse' },
      attributes: ['id', 'platform', 'label', 'isActive', 'lastSyncAt', 'jobCount', 'syncError', 'createdAt']
    });

    if (!integration) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      integration
    });
  } catch (error) {
    console.error('Error fetching Harvest status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Helper: Get decrypted API key for the current user
 */
async function getApiKey(userId) {
  const integration = await RecruiterATSIntegration.findOne({
    where: { userId, platform: 'greenhouse', isActive: true }
  });
  if (!integration) return null;
  return { apiKey: decrypt(integration.apiKeyEncrypted), integration };
}

/**
 * @route   GET /api/harvest/jobs
 * @desc    List all open jobs from Harvest API (live)
 * @access  Private (recruiter)
 */
router.get('/jobs', authMiddleware, async (req, res) => {
  try {
    const result = await getApiKey(req.userId);
    if (!result) {
      return res.status(404).json({ message: 'No Greenhouse integration configured. Connect your API key first.' });
    }

    const { apiKey, integration } = result;
    const jobs = await fetchAllOpenJobs(apiKey);

    // Fetch hiring teams in parallel (batches of 5 to avoid rate limits)
    const batchSize = 5;
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      const teams = await Promise.allSettled(
        batch.map(job => fetchHiringTeam(apiKey, job.id))
      );
      teams.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          batch[idx].hiring_team = result.value;
        }
      });
      // Small delay between batches
      if (i + batchSize < jobs.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    const normalized = jobs.map(normalizeHarvestJob);

    // Update sync metadata
    await integration.update({
      lastSyncAt: new Date(),
      jobCount: jobs.length,
      syncError: null
    });

    res.json({
      jobs: normalized,
      total: normalized.length,
      lastSyncAt: new Date()
    });
  } catch (error) {
    console.error('Error fetching Harvest jobs:', error);

    // Save error to integration
    const integration = await RecruiterATSIntegration.findOne({
      where: { userId: req.userId, platform: 'greenhouse' }
    });
    if (integration) {
      await integration.update({ syncError: error.message });
    }

    if (error.message.includes('Invalid Greenhouse API key')) {
      return res.status(401).json({ message: 'Your Greenhouse API key is invalid or expired. Please reconnect.' });
    }
    res.status(500).json({ message: 'Failed to fetch jobs from Greenhouse' });
  }
});

/**
 * @route   GET /api/harvest/jobs/:jobId
 * @desc    Get full job details including hiring team from Harvest API
 * @access  Private (recruiter)
 */
router.get('/jobs/:jobId', authMiddleware, async (req, res) => {
  try {
    const result = await getApiKey(req.userId);
    if (!result) {
      return res.status(404).json({ message: 'No Greenhouse integration configured.' });
    }

    const { apiKey } = result;
    const { jobId } = req.params;

    // Fetch job details and hiring team in parallel
    const [job, hiringTeam] = await Promise.all([
      fetchHarvestJob(apiKey, jobId),
      fetchHiringTeam(apiKey, jobId)
    ]);

    // Merge hiring team into job data
    job.hiring_team = hiringTeam;

    const normalized = normalizeHarvestJob(job);

    res.json({
      job: normalized,
      hiringTeam: normalized.hiringTeam
    });
  } catch (error) {
    console.error('Error fetching Harvest job detail:', error);

    if (error.message.includes('Invalid Greenhouse API key')) {
      return res.status(401).json({ message: 'Your Greenhouse API key is invalid or expired.' });
    }
    res.status(500).json({ message: 'Failed to fetch job details' });
  }
});

module.exports = router;
