const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { aiRateLimiter, recordAIUsage } = require('../middleware/aiRateLimiter');
const { TailoredProfile, Profile } = require('../models');
const resumeParserService = require('../services/resumeParserService');

// Get all tailored profiles for current user
router.get('/', auth, async (req, res) => {
  try {
    const tailoredProfiles = await TailoredProfile.findAll({
      where: { 
        userId: req.user.id,
        isActive: true 
      },
      order: [['createdAt', 'DESC']]
    });
    
    res.json(tailoredProfiles);
  } catch (error) {
    console.error('Error fetching tailored profiles:', error);
    res.status(500).json({ error: 'Failed to fetch tailored profiles' });
  }
});

// Get a specific tailored profile
router.get('/:id', auth, async (req, res) => {
  try {
    const tailoredProfile = await TailoredProfile.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id,
        isActive: true
      }
    });
    
    if (!tailoredProfile) {
      return res.status(404).json({ error: 'Tailored profile not found' });
    }
    
    res.json(tailoredProfile);
  } catch (error) {
    console.error('Error fetching tailored profile:', error);
    res.status(500).json({ error: 'Failed to fetch tailored profile' });
  }
});

// Save a new tailored profile
router.post('/', auth, async (req, res) => {
  try {
    const { jobTitle, jobUrl, companyName, tailoredData, matchScore, notes, skillGaps, learningPlan } = req.body;
    
    if (!jobTitle || !tailoredData) {
      return res.status(400).json({ error: 'Job title and tailored data are required' });
    }

    // Get the current profile as snapshot
    const currentProfile = await Profile.findOne({
      where: { userId: req.user.id }
    });

    const originalProfileSnapshot = currentProfile ? {
      headline: currentProfile.headline,
      summary: currentProfile.summary,
      skills: currentProfile.skills,
      experience: currentProfile.experience,
      education: currentProfile.education
    } : null;

    const tailoredProfile = await TailoredProfile.create({
      userId: req.user.id,
      jobTitle,
      jobUrl: jobUrl || null,
      companyName: companyName || null,
      tailoredData,
      originalProfileSnapshot,
      matchScore: matchScore || null,
      notes: notes || null,
      skillGaps: skillGaps || [],
      learningPlan: learningPlan || null,
      isActive: true
    });

    // Tailoring a resume FOR a specific posting is strong evidence the user is
    // actually working on that application — much stronger than opening the ATS
    // page. Record it as 'in_progress' and attach the tailored profile to the
    // application row, so the two stop living in separate silos: the
    // Applications view can show what was used to apply, and an unfinished
    // application can be surfaced back to the user.
    //
    // Fire-and-forget: this is enrichment, and a failure here must never lose
    // the user's tailored resume, which is the thing they actually asked for.
    if (jobUrl || req.body.externalJobId) {
      const { recordApplicationSignal } = require('../services/applicationTrackingService');
      recordApplicationSignal({
        userId: req.user.id,
        externalJobId: req.body.externalJobId || null,
        jobUrl: jobUrl || null,
        stage: 'in_progress',
        confirmedBy: 'tailored_resume',
        fields: {
          jobTitle,
          company: companyName || 'Unknown company',
          matchScore: matchScore || null,
          tailoredProfileId: tailoredProfile.id,
        },
      }).catch((e) => {
        console.warn('[TailoredProfiles] could not link application signal:', e.message);
      });
    }

    res.status(201).json(tailoredProfile);
  } catch (error) {
    console.error('Error saving tailored profile:', error);
    res.status(500).json({ error: 'Failed to save tailored profile' });
  }
});

// Update a tailored profile
router.put('/:id', auth, async (req, res) => {
  try {
    const tailoredProfile = await TailoredProfile.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!tailoredProfile) {
      return res.status(404).json({ error: 'Tailored profile not found' });
    }
    
    const { jobTitle, jobUrl, companyName, tailoredData, matchScore, notes } = req.body;
    
    await tailoredProfile.update({
      jobTitle: jobTitle || tailoredProfile.jobTitle,
      jobUrl: jobUrl !== undefined ? jobUrl : tailoredProfile.jobUrl,
      companyName: companyName !== undefined ? companyName : tailoredProfile.companyName,
      tailoredData: tailoredData || tailoredProfile.tailoredData,
      matchScore: matchScore !== undefined ? matchScore : tailoredProfile.matchScore,
      notes: notes !== undefined ? notes : tailoredProfile.notes
    });
    
    res.json(tailoredProfile);
  } catch (error) {
    console.error('Error updating tailored profile:', error);
    res.status(500).json({ error: 'Failed to update tailored profile' });
  }
});

// Delete (soft delete) a tailored profile
router.delete('/:id', auth, async (req, res) => {
  try {
    const tailoredProfile = await TailoredProfile.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!tailoredProfile) {
      return res.status(404).json({ error: 'Tailored profile not found' });
    }
    
    await tailoredProfile.update({ isActive: false });
    
    res.json({ message: 'Tailored profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting tailored profile:', error);
    res.status(500).json({ error: 'Failed to delete tailored profile' });
  }
});

// Mark a skill gap as learned/in-progress
router.patch('/:id/gaps/:gapIndex', auth, async (req, res) => {
  try {
    const { status } = req.body; // 'pending', 'in_progress', 'learned'
    if (!['pending', 'in_progress', 'learned'].includes(status)) {
      return res.status(400).json({ error: 'Status must be pending, in_progress, or learned' });
    }

    const tailoredProfile = await TailoredProfile.findOne({
      where: { id: req.params.id, userId: req.user.id, isActive: true }
    });

    if (!tailoredProfile) {
      return res.status(404).json({ error: 'Tailored profile not found' });
    }

    const gapIndex = parseInt(req.params.gapIndex);
    const gaps = tailoredProfile.skillGaps || [];

    if (gapIndex < 0 || gapIndex >= gaps.length) {
      return res.status(400).json({ error: 'Invalid gap index' });
    }

    gaps[gapIndex].status = status;
    await tailoredProfile.update({ skillGaps: gaps });

    res.json({ success: true, skillGaps: gaps });
  } catch (error) {
    console.error('Error updating gap status:', error);
    res.status(500).json({ error: 'Failed to update gap status' });
  }
});

// Get aggregated learning plan across all tailored profiles
router.get('/learning-plan/all', auth, async (req, res) => {
  try {
    const tailoredProfiles = await TailoredProfile.findAll({
      where: { userId: req.user.id, isActive: true },
      attributes: ['id', 'jobTitle', 'companyName', 'skillGaps', 'learningPlan', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    // Aggregate all gaps across profiles
    const allGaps = [];
    const seenSkills = new Set();

    for (const tp of tailoredProfiles) {
      const gaps = tp.skillGaps || [];
      for (const gap of gaps) {
        const key = gap.skill?.toLowerCase();
        if (key && !seenSkills.has(key)) {
          seenSkills.add(key);
          allGaps.push({
            ...gap,
            fromJob: tp.jobTitle,
            fromCompany: tp.companyName,
            tailoredProfileId: tp.id
          });
        }
      }
    }

    // Sort: pending first, then in_progress, then learned; within each group by severity
    const severityOrder = { critical: 0, important: 1, nice_to_have: 2 };
    const statusOrder = { pending: 0, in_progress: 1, learned: 2 };
    allGaps.sort((a, b) => {
      const statusDiff = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
      if (statusDiff !== 0) return statusDiff;
      return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
    });

    const stats = {
      total: allGaps.length,
      pending: allGaps.filter(g => g.status === 'pending').length,
      inProgress: allGaps.filter(g => g.status === 'in_progress').length,
      learned: allGaps.filter(g => g.status === 'learned').length
    };

    res.json({ success: true, gaps: allGaps, stats });
  } catch (error) {
    console.error('Error fetching learning plan:', error);
    res.status(500).json({ error: 'Failed to fetch learning plan' });
  }
});

// Get gaps for a specific job (used by interview prep)
router.get('/:id/gaps', auth, async (req, res) => {
  try {
    const tailoredProfile = await TailoredProfile.findOne({
      where: { id: req.params.id, userId: req.user.id, isActive: true },
      attributes: ['id', 'jobTitle', 'companyName', 'skillGaps', 'learningPlan']
    });

    if (!tailoredProfile) {
      return res.status(404).json({ error: 'Tailored profile not found' });
    }

    res.json({
      success: true,
      jobTitle: tailoredProfile.jobTitle,
      companyName: tailoredProfile.companyName,
      gaps: tailoredProfile.skillGaps || [],
      learningPlan: tailoredProfile.learningPlan
    });
  } catch (error) {
    console.error('Error fetching gaps:', error);
    res.status(500).json({ error: 'Failed to fetch gaps' });
  }
});

// Generate interview preparation based on user answers
// @route   POST /api/tailored-profiles/:id/generate-interview-prep
// @desc    Generate personalized interview prep based on interview level and profile gaps
// @access  Private
router.post('/:id/generate-interview-prep', auth, aiRateLimiter('interview_prep'), async (req, res) => {
  try {
    const { interviewLevel, interviewFormat, specificConcerns } = req.body;

    if (!interviewLevel) {
      return res.status(400).json({ error: 'Interview level/round is required' });
    }

    const tailoredProfile = await TailoredProfile.findOne({
      where: { id: req.params.id, userId: req.user.id, isActive: true }
    });

    if (!tailoredProfile) {
      return res.status(404).json({ error: 'Tailored profile not found' });
    }

    // Get user's actual profile for context
    const userProfile = await Profile.findOne({
      where: { userId: req.user.id },
      attributes: ['headline', 'summary', 'skills', 'experience', 'education']
    });

    const skillGaps = tailoredProfile.skillGaps || [];
    const matchAnalysis = tailoredProfile.tailoredData?.matchAnalysis || {};
    const jobLevel = tailoredProfile.tailoredData?.jobLevel || {};

    const result = await resumeParserService.generateInterviewPrep({
      jobTitle: tailoredProfile.jobTitle,
      companyName: tailoredProfile.companyName,
      interviewLevel,
      interviewFormat: interviewFormat || 'unknown',
      specificConcerns: specificConcerns || '',
      skillGaps,
      matchAnalysis,
      jobLevel,
      candidateProfile: {
        headline: userProfile?.headline || tailoredProfile.tailoredData?.title || '',
        skills: userProfile?.skills || tailoredProfile.tailoredData?.skills || [],
        experience: userProfile?.experience || tailoredProfile.tailoredData?.experience || []
      }
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to generate interview prep' });
    }

    // Save the generated prep to the tailored profile data
    const updatedTailoredData = {
      ...tailoredProfile.tailoredData,
      interviewPrep: result.data,
      interviewPrepMeta: {
        interviewLevel,
        interviewFormat: interviewFormat || 'unknown',
        specificConcerns: specificConcerns || '',
        generatedAt: new Date().toISOString()
      }
    };

    await tailoredProfile.update({ tailoredData: updatedTailoredData });

    // Record AI usage — interview_prep is expensive ($0.145) so it's gated
    await recordAIUsage(req.user.id, 'interview_prep', {
      jobTitle: tailoredProfile.jobTitle,
      interviewLevel
    });

    res.json({
      success: true,
      interviewPrep: result.data,
      interviewPrepMeta: updatedTailoredData.interviewPrepMeta
    });
  } catch (error) {
    console.error('Error generating interview prep:', error);
    res.status(500).json({ error: 'Failed to generate interview prep' });
  }
});

module.exports = router;
