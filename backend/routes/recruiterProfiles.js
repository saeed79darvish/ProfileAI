const express = require('express');
const router = express.Router();
const { RecruiterProfile, User } = require('../models');
const auth = require('../middleware/auth');
const multer = require('multer');
const { recruiterStorage } = require('../config/cloudinary');

// Configure multer for recruiter image upload with Cloudinary
const imageUpload = multer({
  storage: recruiterStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp|svg\+xml)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPEG, GIF, WebP or SVG images are allowed'));
  },
});

// @route   POST /api/recruiter-profiles/upload-image
// @desc    Upload recruiter profile picture or company logo
// @access  Private
router.post('/upload-image', auth, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    // Cloudinary returns the URL in req.file.path
    const imageUrl = req.file.path;
    console.log(`Recruiter image uploaded for user ${req.userId}: ${imageUrl}`);

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('Error uploading recruiter image:', error);
    
    if (error.message === 'Only image files (jpg, png, gif, webp) are allowed') {
      return res.status(400).json({ error: error.message });
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }

    res.status(500).json({ error: 'Error uploading image' });
  }
});

// Get recruiter profile
router.get('/me', auth, async (req, res) => {
  try {
    // Prevent caching to ensure fresh profile data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const profile = await RecruiterProfile.findOne({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }]
    });

    res.json(profile || {});
  } catch (error) {
    console.error('Error fetching recruiter profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create or update recruiter profile
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (user.role !== 'recruiter' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Recruiter role required.' });
    }

    console.log('Saving recruiter profile with data:', {
      userId: req.userId,
      profilePicture: req.body.profilePicture,
      companyLogo: req.body.companyLogo,
      companyName: req.body.companyName
    });

    // Find existing profile (most recent if duplicates exist)
    let profile = await RecruiterProfile.findOne({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']]
    });

    // Auto-generate slug if companyName provided and no slug exists
    let profileData = { ...req.body };
    if (profileData.companyName && !profileData.companySlug) {
      // Check if profile already has a slug
      if (!profile?.companySlug) {
        let baseSlug = generateSlug(profileData.companyName);
        let slug = baseSlug;
        let counter = 1;

        // Check for uniqueness
        while (true) {
          const existing = await RecruiterProfile.findOne({
            where: { 
              companySlug: slug,
              ...(profile?.id && { id: { [require('sequelize').Op.ne]: profile.id } })
            }
          });
          
          if (!existing) break;
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
        profileData.companySlug = slug;
      }
    }

    if (profile) {
      // Update existing profile
      await profile.update(profileData);
      console.log('Updated existing recruiter profile:', {
        id: profile.id,
        profilePicture: profile.profilePicture,
        companyLogo: profile.companyLogo,
        companySlug: profile.companySlug
      });
    } else {
      // Create new profile
      profile = await RecruiterProfile.create({
        userId: req.userId,
        ...profileData
      });
      console.log('Created new recruiter profile:', {
        id: profile.id,
        profilePicture: profile.profilePicture,
        companyLogo: profile.companyLogo,
        companySlug: profile.companySlug
      });
    }

    res.json(profile);
  } catch (error) {
    console.error('Error creating/updating recruiter profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to generate slug from company name
const generateSlug = (companyName) => {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
};

// @route   GET /api/recruiter-profiles/company/:slug
// @desc    Get public company profile by slug
// @access  Public
router.get('/company/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    let profile = await RecruiterProfile.findOne({
      where: { companySlug: slug },
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName', 'email', 'createdAt']
      }]
    });

    if (!profile) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching company profile by slug:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/recruiter-profiles/generate-slug
// @desc    Generate or update company slug
// @access  Private
router.put('/generate-slug', auth, async (req, res) => {
  try {
    const profile = await RecruiterProfile.findOne({
      where: { userId: req.userId }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Recruiter profile not found' });
    }

    // Generate slug from company name
    let baseSlug = generateSlug(profile.companyName);
    let slug = baseSlug;
    let counter = 1;

    // Check for uniqueness
    while (true) {
      const existing = await RecruiterProfile.findOne({
        where: { 
          companySlug: slug,
          id: { [require('sequelize').Op.ne]: profile.id }
        }
      });
      
      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    await profile.update({ companySlug: slug });
    res.json({ slug, profile });
  } catch (error) {
    console.error('Error generating company slug:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get public recruiter profile
router.get('/:id', async (req, res) => {
  try {
    const profile = await RecruiterProfile.findOne({
      where: { userId: req.params.id },
      order: [['createdAt', 'DESC']],
      include: [{ 
        model: User, 
        as: 'user', 
        attributes: ['firstName', 'lastName'] 
      }]
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching recruiter profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/recruiter-profiles/availability
// @desc    Get recruiter's availability settings
// @access  Private (Recruiter)
router.get('/availability', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (user.role !== 'recruiter' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Recruiter role required.' });
    }

    const profile = await RecruiterProfile.findOne({
      where: { userId: req.userId },
      attributes: ['availability']
    });

    if (!profile) {
      return res.status(404).json({ error: 'Recruiter profile not found' });
    }

    res.json(profile.availability || {
      timezone: 'America/Los_Angeles',
      workingHours: {
        1: { enabled: true, start: '09:00', end: '17:00' },
        2: { enabled: true, start: '09:00', end: '17:00' },
        3: { enabled: true, start: '09:00', end: '17:00' },
        4: { enabled: true, start: '09:00', end: '17:00' },
        5: { enabled: true, start: '09:00', end: '17:00' },
        0: { enabled: false },
        6: { enabled: false }
      },
      blockedSlots: [],
      preferredDuration: 30,
      bufferTime: 15,
      schedulingWindow: 14
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/recruiter-profiles/availability
// @desc    Update recruiter's availability settings
// @access  Private (Recruiter)
router.put('/availability', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (user.role !== 'recruiter' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Recruiter role required.' });
    }

    let profile = await RecruiterProfile.findOne({
      where: { userId: req.userId }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Recruiter profile not found. Please create a profile first.' });
    }

    const { 
      timezone, 
      workingHours, 
      blockedSlots, 
      preferredDuration, 
      bufferTime,
      schedulingWindow 
    } = req.body;

    // Validate workingHours structure
    if (workingHours) {
      const validDays = ['0', '1', '2', '3', '4', '5', '6'];
      for (const day of validDays) {
        if (workingHours[day]) {
          if (workingHours[day].enabled && (!workingHours[day].start || !workingHours[day].end)) {
            return res.status(400).json({ 
              error: `Invalid working hours for day ${day}. Must include start and end times.` 
            });
          }
        }
      }
    }

    // Merge with existing availability
    const currentAvailability = profile.availability || {};
    const updatedAvailability = {
      ...currentAvailability,
      ...(timezone && { timezone }),
      ...(workingHours && { workingHours }),
      ...(blockedSlots && { blockedSlots }),
      ...(preferredDuration && { preferredDuration }),
      ...(bufferTime !== undefined && { bufferTime }),
      ...(schedulingWindow && { schedulingWindow })
    };

    await profile.update({ availability: updatedAvailability });

    console.log(`Updated availability for recruiter ${req.userId}:`, updatedAvailability);

    res.json({
      success: true,
      message: 'Availability settings updated successfully',
      availability: updatedAvailability
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/recruiter-profiles/availability/block
// @desc    Add a blocked time slot
// @access  Private (Recruiter)
router.post('/availability/block', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (user.role !== 'recruiter' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Recruiter role required.' });
    }

    const profile = await RecruiterProfile.findOne({
      where: { userId: req.userId }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Recruiter profile not found.' });
    }

    const { type, dayOfWeek, start, end, reason } = req.body;

    if (!type || !start || !end) {
      return res.status(400).json({ error: 'Missing required fields: type, start, end' });
    }

    if (type === 'recurring' && dayOfWeek === undefined) {
      return res.status(400).json({ error: 'Recurring blocks require dayOfWeek (0-6)' });
    }

    const blockedSlot = {
      id: Date.now().toString(),
      type, // 'recurring' or 'one-time'
      dayOfWeek: type === 'recurring' ? dayOfWeek : undefined,
      start,
      end,
      reason: reason || '',
      createdAt: new Date().toISOString()
    };

    const currentAvailability = profile.availability || {};
    const blockedSlots = currentAvailability.blockedSlots || [];
    blockedSlots.push(blockedSlot);

    await profile.update({ 
      availability: { 
        ...currentAvailability, 
        blockedSlots 
      } 
    });

    res.json({
      success: true,
      message: 'Blocked time slot added',
      blockedSlot
    });
  } catch (error) {
    console.error('Error adding blocked slot:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE /api/recruiter-profiles/availability/block/:blockId
// @desc    Remove a blocked time slot
// @access  Private (Recruiter)
router.delete('/availability/block/:blockId', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (user.role !== 'recruiter' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Recruiter role required.' });
    }

    const profile = await RecruiterProfile.findOne({
      where: { userId: req.userId }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Recruiter profile not found.' });
    }

    const currentAvailability = profile.availability || {};
    const blockedSlots = (currentAvailability.blockedSlots || [])
      .filter(slot => slot.id !== req.params.blockId);

    await profile.update({ 
      availability: { 
        ...currentAvailability, 
        blockedSlots 
      } 
    });

    res.json({
      success: true,
      message: 'Blocked time slot removed'
    });
  } catch (error) {
    console.error('Error removing blocked slot:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
