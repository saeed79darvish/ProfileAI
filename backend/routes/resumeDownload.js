const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Profile, User, TailoredProfile } = require('../models');
const { generatePDF, generateWord, getTemplates } = require('../services/resumeGeneratorService');

/**
 * Attach the candidate's real contact details to whatever payload we're about
 * to render.
 *
 * The renderer reads email off the User row but phone, location, LinkedIn,
 * GitHub and portfolio off the profile object it's handed. Both branches that
 * supply that object from somewhere other than the Profile row — a client
 * payload, or a saved TailoredProfile — carry no contact fields at all: the
 * tailoring output contract has no place for them, and the profile form sends
 * the resume content it's editing. So the rendered header collapsed to name
 * and email for every download started from the profile page, while a plain
 * download with no payload came out complete.
 *
 * Contact details are identity, not resume content — they are never something
 * the caller should have to remember to send. Filled in here rather than in the
 * client so every caller (profile page, dashboard, extension) gets them.
 */
async function withRealContactDetails(profileData, userId) {
  const profile = await Profile.findOne({ where: { userId } });
  if (!profile) return profileData;

  const source = profile.toJSON();
  const merged = { ...profileData };
  for (const field of ['phone', 'location', 'linkedinUrl', 'githubUrl', 'portfolioUrl']) {
    // Only fill gaps: a caller that deliberately sent a value keeps it.
    if (!merged[field] && source[field]) merged[field] = source[field];
  }
  return merged;
}

// Get available templates
router.get('/templates', auth, async (req, res) => {
  try {
    const templates = getTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ message: 'Failed to get templates' });
  }
});

// Generate resume (PDF or Word)
router.post('/generate', auth, async (req, res) => {
  try {
    const { format, templateId, tailoredProfileId, tailoredProfileData, accentColor, bulletStyle, sectionOrder } = req.body;
    
    // Validate format
    if (!format || !['pdf', 'word', 'docx'].includes(format.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid format. Use "pdf" or "word"' });
    }

    // Get user info
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let profileData;

    // Priority 1: Use directly provided tailored profile data (from extension)
    if (tailoredProfileData && typeof tailoredProfileData === 'object') {
      console.log('[Resume] Using directly provided tailored profile data');
      profileData = tailoredProfileData;
    }
    // Priority 2: Check if we're generating from a saved tailored profile
    else if (tailoredProfileId) {
      const tailoredProfile = await TailoredProfile.findOne({
        where: { 
          id: tailoredProfileId, 
          userId: req.user.id,
          isActive: true 
        }
      });

      if (!tailoredProfile) {
        return res.status(404).json({ message: 'Tailored profile not found' });
      }

      // Use tailored data
      profileData = {
        ...tailoredProfile.tailoredData,
        title: tailoredProfile.tailoredData.title || tailoredProfile.jobTitle
      };
    } else {
      // Get main profile
      const profile = await Profile.findOne({ where: { userId: req.user.id } });
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      profileData = profile.toJSON();
    }

    profileData = await withRealContactDetails(profileData, req.user.id);

    let buffer;
    let contentType;
    let filename;

    const baseFilename = `${user.firstName}_${user.lastName}_Resume`.replace(/\s+/g, '_');

    if (format.toLowerCase() === 'pdf') {
      buffer = await generatePDF(profileData, user, templateId, accentColor, bulletStyle, sectionOrder);
      contentType = 'application/pdf';
      filename = `${baseFilename}.pdf`;
    } else {
      buffer = await generateWord(profileData, user, templateId, sectionOrder);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filename = `${baseFilename}.docx`;
    }

    // Set headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
  } catch (error) {
    console.error('Error generating resume:', error);
    res.status(500).json({ message: 'Failed to generate resume', error: error.message });
  }
});

// Preview resume (returns base64 for PDF preview)
router.post('/preview', auth, async (req, res) => {
  try {
    const { templateId, tailoredProfileId, tailoredProfileData, accentColor, bulletStyle, sectionOrder } = req.body;

    // Get user info
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let profileData;

    // Priority 1: Use directly provided profile data
    if (tailoredProfileData && typeof tailoredProfileData === 'object') {
      profileData = tailoredProfileData;
    }
    // Priority 2: Use saved tailored profile
    else if (tailoredProfileId) {
      const tailoredProfile = await TailoredProfile.findOne({
        where: { 
          id: tailoredProfileId, 
          userId: req.user.id,
          isActive: true 
        }
      });

      if (!tailoredProfile) {
        return res.status(404).json({ message: 'Tailored profile not found' });
      }

      profileData = {
        ...tailoredProfile.tailoredData,
        title: tailoredProfile.tailoredData.title || tailoredProfile.jobTitle
      };
    } else {
      const profile = await Profile.findOne({ where: { userId: req.user.id } });
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      profileData = profile.toJSON();
    }

    profileData = await withRealContactDetails(profileData, req.user.id);

    const buffer = await generatePDF(profileData, user, templateId, accentColor, bulletStyle, sectionOrder);
    const base64 = buffer.toString('base64');
    
    res.json({ 
      preview: `data:application/pdf;base64,${base64}`,
      templateId 
    });
  } catch (error) {
    // Log the full detail server-side so we can diagnose without asking
    // the user to reproduce, AND return a diagnostic `error` field to
    // the client so the modal's Retry state shows the real reason.
    console.error('[POST /api/resume/preview] generation failed', {
      userId: req.user?.id,
      templateId: req.body?.templateId,
      hasTailoredProfileId: !!req.body?.tailoredProfileId,
      hasTailoredProfileData: !!req.body?.tailoredProfileData,
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    res.status(500).json({
      message: 'Failed to generate preview',
      error: error?.message || error?.name || 'Unknown error',
    });
  }
});

module.exports = router;
