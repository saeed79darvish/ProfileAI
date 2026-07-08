const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { Profile, User } = require('../models');
const authMiddleware = require('../middleware/auth');
const { isUuid } = require('../utils/slug');
const { aiRateLimiter, recordAIUsage } = require('../middleware/aiRateLimiter');
const aiService = require('../services/aiService');
const resumeParserService = require('../services/resumeParserService');
const coverLetterService = require('../services/coverLetterService');
const {
  enrichFromLinkedInUrl,
  isValidLinkedInUrl
} = require('../services/linkedinEnrichmentService');
const { fetchLinkedInProfile } = require('../services/linkedinOAuth');
const { checkGrounding } = require('../utils/groundingCheck');
const multer = require('multer');
const { profileStorage, cloudinary } = require('../config/cloudinary');

// Defense-in-depth URL validation options. Mirrors the frontend
// `isValidHttpUrl` helper in @/utils/urlValidation — must accept only
// http:/https: and reject schemes like javascript:, data:, file:, mailto:
// that the client-side validator also rejects.
const STRICT_URL_OPTS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: true,
};

// Configure multer for profile image upload with Cloudinary
const imageUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPEG, GIF or WebP images are allowed'));
  },
});

// Configure multer for resume file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF and DOCX files
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/msword'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  }
});

// @route   POST /api/profiles/upload-resume
// @desc    Upload and parse resume to extract profile data (NO AI - uses pattern matching)
// @access  Private
router.post('/upload-resume', authMiddleware, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing resume upload for user ${req.user.id}`);
    console.log(`File: ${req.file.originalname}, Type: ${req.file.mimetype}, Size: ${req.file.size} bytes`);

    // Extract raw text first (for storing)
    const rawResumeText = await resumeParserService.extractTextFromResume(req.file);

    // Parse the resume (no AI - pattern matching only)
    const result = await resumeParserService.parseResume(req.file);

    if (!result.success) {
      return res.status(400).json({ 
        error: result.error || 'Failed to parse resume'
      });
    }

    // Store the original resume text on the user's profile for tailoring later
    if (rawResumeText && rawResumeText.trim()) {
      const { Profile } = require('../models');
      await Profile.update(
        { originalResumeText: rawResumeText.trim() },
        { where: { userId: req.user.id } }
      );
      console.log(`[Resume] Stored original resume text for user ${req.user.id} (${rawResumeText.length} chars)`);
    }

    // Return the parsed data to the frontend
    res.json({
      success: true,
      message: 'Resume parsed successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Error uploading resume:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      userId: req.user?.id,
      filename: req.file?.originalname,
      mimetype: req.file?.mimetype,
      size: req.file?.size,
    });
    
    // Handle multer errors
    if (error.message === 'Only PDF and DOCX files are allowed') {
      return res.status(400).json({ error: error.message });
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }

    res.status(500).json({
      error: 'Error processing resume',
      // Surface the underlying message so the frontend / browser console
      // shows something actionable instead of an opaque 500.
      detail: error?.message || 'unknown'
    });
  }
});

// ═════════════════════════════════════════════════════════════════
// LinkedIn / professional profile import (NinjaPear + OAuth prefill)
// ═════════════════════════════════════════════════════════════════

// Transform the NinjaPear-style payload returned by
// linkedinEnrichmentService.enrichPersonProfile into the same "resume data"
// shape the frontend ProfileForm consumes on `location.state.resumeData`.
// Keeping the shape identical means the /profile/create-form loader doesn't
// need any special handling for LinkedIn-sourced data.
function normalizeLinkedInDataToResumeShape(enrichedData, linkedinUrl) {
  const d = enrichedData || {};
  const yearToDate = (year) => (year ? `${year}-01-01` : '');
  return {
    firstName: d.firstName || '',
    lastName: d.lastName || '',
    title: d.currentTitle || d.headline || '',
    location: d.location || '',
    phone: '',
    linkedinUrl: linkedinUrl || d.linkedinUrl || '',
    githubUrl: '',
    summary: d.summary || '',
    profilePicture: d.profilePicture || '',
    skills: Array.isArray(d.skills) ? d.skills : [],
    experience: (d.experience || []).map((exp) => ({
      company: exp.company || '',
      title: exp.title || '',
      startDate: exp.startDate || '',
      endDate: exp.current ? null : (exp.endDate || null),
      current: !!exp.current,
      description: exp.description || ''
    })),
    education: (d.education || []).map((edu) => ({
      institution: edu.school || '',
      degree: edu.degree || '',
      field: edu.field || '',
      startDate: yearToDate(edu.startYear),
      endDate: edu.endYear ? yearToDate(edu.endYear) : null,
      current: !edu.endYear,
      gpa: null
    })),
    projects: []
  };
}

// @route   GET /api/profiles/import-linkedin/status
// @desc    Report which LinkedIn import options are enabled on the server so
//          the frontend can gracefully hide / disable the buttons instead of
//          letting the user click into a dead-end flow.
// @access  Private
router.get('/import-linkedin/status', authMiddleware, (req, res) => {
  res.json({
    urlImportAvailable: !!process.env.ENRICHLAYER_API_KEY,
    oauthAvailable: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
  });
});

// @route   POST /api/profiles/import-linkedin
// @desc    Import a candidate profile from a LinkedIn URL via EnrichLayer.
//          Returns the parsed data in the same shape as /upload-resume so
//          the frontend can pass it directly to /profile/create-form.
// @access  Private
router.post(
  '/import-linkedin',
  [
    authMiddleware,
    body('linkedinUrl')
      .notEmpty().withMessage('LinkedIn URL is required')
      .isURL(STRICT_URL_OPTS).withMessage('LinkedIn URL must start with http:// or https://')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { linkedinUrl } = req.body;

      if (!isValidLinkedInUrl(linkedinUrl)) {
        return res.status(400).json({
          error: "That doesn't look like a LinkedIn profile URL. It should look like https://www.linkedin.com/in/yourname"
        });
      }

      if (!process.env.ENRICHLAYER_API_KEY) {
        return res.status(503).json({
          error: 'LinkedIn URL import is not enabled on this server yet. Please upload your resume or create your profile manually.',
          code: 'LINKEDIN_IMPORT_NOT_CONFIGURED'
        });
      }

      console.log(`[LinkedIn Import] User ${req.user.id} importing from ${linkedinUrl}`);

      const result = await enrichFromLinkedInUrl(linkedinUrl);

      if (!result || !result.success || !result.enriched) {
        return res.status(502).json({
          error: result?.error || 'Could not import your LinkedIn profile right now. Please try again or upload your resume.',
          detail: result?.message
        });
      }

      const data = normalizeLinkedInDataToResumeShape(result.data, linkedinUrl);

      // Persist the LinkedIn URL on the profile immediately so it isn't lost
      // if the user drops off before saving the full form (mirrors what
      // /upload-resume does with originalResumeText).
      try {
        const existing = await Profile.findOne({ where: { userId: req.user.id } });
        if (existing) {
          await existing.update({ linkedinUrl });
        }
      } catch (persistErr) {
        console.warn('[LinkedIn Import] Could not auto-persist linkedinUrl:', persistErr?.message);
      }

      res.json({
        success: true,
        message: 'LinkedIn profile imported successfully',
        data
      });
    } catch (error) {
      console.error('[LinkedIn Import] Error:', {
        message: error?.message,
        stack: error?.stack,
        userId: req.user?.id
      });
      res.status(500).json({
        error: 'Error importing LinkedIn profile',
        detail: error?.message || 'unknown'
      });
    }
  }
);

// @route   POST /api/profiles/linkedin-oauth-prefill
// @desc    Exchange a LinkedIn OAuth code for the basics LinkedIn OIDC
//          exposes (name, email, photo) and return them for prefill. Does
//          NOT create a session — the user is already authenticated when
//          this is called from /profile/create.
// @access  Private
router.post('/linkedin-oauth-prefill', authMiddleware, async (req, res) => {
  try {
    const { code, redirectUri } = req.body || {};
    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'code and redirectUri are required' });
    }
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      return res.status(503).json({
        error: 'Sign in with LinkedIn is not configured on this server yet.',
        code: 'LINKEDIN_OAUTH_NOT_CONFIGURED'
      });
    }

    const profile = await fetchLinkedInProfile(code, redirectUri);
    // profile = { linkedinId, email, firstName, lastName, picture }

    // Best-effort: link the LinkedIn identity to the user record so they can
    // sign in with LinkedIn next time. Non-fatal if it fails (e.g. someone
    // else already claimed that linkedinId).
    try {
      const currentUser = await User.findByPk(req.user.id);
      if (currentUser) {
        const updates = {};
        if (!currentUser.linkedinId) updates.linkedinId = profile.linkedinId;
        if (!currentUser.profilePictureUrl && profile.picture) {
          updates.profilePictureUrl = profile.picture;
        }
        if (Object.keys(updates).length > 0) {
          await currentUser.update(updates);
        }
      }
    } catch (linkErr) {
      console.warn('[LinkedIn Prefill] Could not link LinkedIn id to user:', linkErr?.message);
    }

    // Same shape as /upload-resume so the frontend can pass this as
    // `resumeData` without any special-casing.
    res.json({
      success: true,
      message: 'LinkedIn profile fetched',
      data: {
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        profilePicture: profile.picture || '',
        title: '',
        location: '',
        phone: '',
        linkedinUrl: '',
        githubUrl: '',
        summary: '',
        skills: [],
        experience: [],
        education: [],
        projects: []
      }
    });
  } catch (error) {
    console.error('[LinkedIn Prefill] Error:', error);
    res.status(error.status || 500).json({
      error: error.message || 'LinkedIn prefill failed'
    });
  }
});

// @route   POST /api/profiles/upload-image
// @desc    Upload profile picture (stores as file, returns URL)
// @access  Private
router.post('/upload-image', authMiddleware, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    // Cloudinary returns the URL in req.file.path
    const imageUrl = req.file.path;

    console.log(`Profile image uploaded for user ${req.user.id}: ${imageUrl}`);

    // Persist to the user's profile immediately so the photo survives even if
    // the user navigates away without clicking "Save Profile". If a profile
    // doesn't exist yet, we leave it; the next POST /profiles will pick up
    // the value the client just stashed in formData.
    try {
      const existing = await Profile.findOne({ where: { userId: req.user.id } });
      if (existing) {
        await existing.update({ profilePicture: imageUrl });
      }
    } catch (persistErr) {
      // Non-fatal — the client still receives the URL and saves on submit.
      console.warn('Could not auto-persist profile picture:', persistErr?.message);
    }

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('Error uploading profile image:', error);
    
    if (error.message === 'Only image files (jpg, png, gif, webp) are allowed') {
      return res.status(400).json({ error: error.message });
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }

    res.status(500).json({ error: 'Error uploading image' });
  }
});

// @route   DELETE /api/profiles/delete-image
// @desc    Delete a profile image from Cloudinary
// @access  Private
router.delete('/delete-image', authMiddleware, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Verify that this image belongs to the current user's profile
    const userProfile = await Profile.findOne({ where: { userId: req.user.id } });
    if (!userProfile || userProfile.profilePicture !== imageUrl) {
      return res.status(403).json({ error: 'You can only delete your own profile images' });
    }

    // Extract Cloudinary public_id from URL
    // Cloudinary URLs look like: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{folder}/{public_id}.{format}
    const urlParts = imageUrl.split('/');
    const filenameWithExt = urlParts[urlParts.length - 1];
    const filename = filenameWithExt.split('.')[0];
    const folder = urlParts[urlParts.length - 2];
    const publicId = `${folder}/${filename}`;

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok' || result.result === 'not found') {
      console.log(`Deleted profile image from Cloudinary: ${publicId}`);
      res.json({ success: true, message: 'Image deleted successfully' });
    } else {
      console.error('Cloudinary delete result:', result);
      res.status(500).json({ error: 'Failed to delete image from Cloudinary' });
    }

  } catch (error) {
    console.error('Error deleting profile image:', error);
    res.status(500).json({ error: 'Error deleting image' });
  }
});

// @route   POST /api/profiles/enhance-resume
// @desc    Enhance profile data with AI-powered improvements
// @access  Private
router.post('/enhance-resume', authMiddleware, aiRateLimiter('profile_enhance'), async (req, res) => {
  try {
    const { profileData, customPrompt } = req.body;

    if (!profileData) {
      return res.status(400).json({ error: 'Profile data is required' });
    }

    console.log(`Enhancing resume for user ${req.user.id}${customPrompt ? ' with custom prompt' : ''}`);

    const result = await resumeParserService.enhanceProfileData(profileData, customPrompt);

    if (!result.success) {
      return res.status(400).json({ 
        error: result.error || 'Failed to enhance profile'
      });
    }

    // Record AI usage
    await recordAIUsage(req.user.id, 'profile_enhance');

    res.json({
      success: true,
      message: 'Profile enhanced successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Error enhancing profile:', error);
    res.status(500).json({ error: 'Error enhancing profile' });
  }
});

// @route   POST /api/profiles/enhancement-suggestions
// @desc    Get AI-powered suggestions for profile improvement
// @access  Private
router.post('/enhancement-suggestions', authMiddleware, aiRateLimiter('career_suggestions'), async (req, res) => {
  try {
    const { profileData } = req.body;

    if (!profileData) {
      return res.status(400).json({ error: 'Profile data is required' });
    }

    console.log(`Getting enhancement suggestions for user ${req.user.id}`);

    const result = await resumeParserService.getEnhancementSuggestions(profileData);

    if (!result.success) {
      return res.status(400).json({ 
        error: result.error || 'Failed to get suggestions'
      });
    }

    // Record AI usage
    await recordAIUsage(req.user.id, 'career_suggestions');

    res.json({
      success: true,
      suggestions: result.suggestions
    });

  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({ error: 'Error getting enhancement suggestions' });
  }
});

// @route   POST /api/profiles/analyze-gaps
// @desc    Analyze skill gaps between profile/resume and job description
// @access  Private
router.post('/analyze-gaps', authMiddleware, aiRateLimiter('tailor_profile'), async (req, res) => {
  try {
    const { profileData, jobDescription } = req.body;

    if (!profileData) {
      return res.status(400).json({ error: 'Profile data is required' });
    }

    if (!jobDescription || jobDescription.trim().length < 50) {
      return res.status(400).json({ error: 'Please provide a detailed job description (at least 50 characters)' });
    }

    console.log(`Analyzing skill gaps for user ${req.user.id}`);

    // Fetch stored resume text if available
    const { Profile } = require('../models');
    const userProfile = await Profile.findOne({ where: { userId: req.user.id }, attributes: ['originalResumeText'] });
    const originalResumeText = userProfile?.originalResumeText || null;

    const result = await resumeParserService.analyzeResumeGaps(profileData, jobDescription, originalResumeText);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to analyze gaps' });
    }

    // Record AI usage
    await recordAIUsage(req.user.id, 'analyze_gaps');

    res.json({
      success: true,
      gaps: result.gaps,
      satisfiedAlternatives: result.satisfiedAlternatives || []
    });

  } catch (error) {
    console.error('Error analyzing gaps:', error);
    if (error.status === 529 || error.status === 503 || error.error?.type === 'overloaded_error') {
      return res.status(503).json({ error: 'AI service is temporarily overloaded. Please try again in a moment.' });
    }
    res.status(500).json({ error: 'Error analyzing skill gaps' });
  }
});

// @route   POST /api/profiles/tailor-for-job
// @desc    Tailor profile for a specific job description
// @access  Private
router.post('/tailor-for-job', authMiddleware, aiRateLimiter('tailor_profile'), async (req, res) => {
  try {
    const { profileData, jobDescription, gapSelections, tailorSettings } = req.body;

    if (!profileData) {
      return res.status(400).json({ error: 'Profile data is required' });
    }

    if (!jobDescription || jobDescription.trim().length < 50) {
      return res.status(400).json({ error: 'Please provide a detailed job description (at least 50 characters)' });
    }

    console.log(`Tailoring profile for job for user ${req.user.id}`);
    if (tailorSettings) {
      console.log(`[Tailor] User settings: tone=${tailorSettings.tone}, summaryLines=${tailorSettings.summaryLines}, experienceLines=${tailorSettings.experienceLines}, maxSkills=${tailorSettings.maxSkills}`);
    }

    // Fetch the user's stored original resume text (from uploaded PDF/DOCX)
    const { Profile } = require('../models');
    const userProfile = await Profile.findOne({ where: { userId: req.user.id }, attributes: ['originalResumeText'] });
    const originalResumeText = userProfile?.originalResumeText || null;

    if (originalResumeText) {
      console.log(`[Tailor] Using original resume text (${originalResumeText.length} chars) for user ${req.user.id}`);
    } else {
      console.log(`[Tailor] No uploaded resume found, using structured profile data for user ${req.user.id}`);
    }

    if (gapSelections) {
      console.log(`[Tailor] Gap selections: ${gapSelections.acceptedGaps?.length || 0} accepted, ${gapSelections.skippedGaps?.length || 0} skipped`);
    }

    // Pass full gap objects (with type/severity) through to the service if available
    const enrichedGapSelections = gapSelections ? {
      ...gapSelections,
      acceptedGapObjects: gapSelections.acceptedGapObjects || []
    } : null;

    const result = await resumeParserService.tailorProfileForJob(profileData, jobDescription, originalResumeText, enrichedGapSelections, tailorSettings);

    if (!result.success) {
      return res.status(400).json({ 
        error: result.error || 'Failed to tailor profile'
      });
    }

    // Record AI usage
    await recordAIUsage(req.user.id, 'tailor_profile');

    res.json({
      success: true,
      message: 'Profile tailored successfully for the job',
      data: result.data
    });

  } catch (error) {
    console.error('Error tailoring profile for job:', error);
    if (error.status === 529 || error.status === 503 || error.error?.type === 'overloaded_error') {
      return res.status(503).json({ error: 'AI service is temporarily overloaded. Please try again in a moment.' });
    }
    res.status(500).json({ error: 'Error tailoring profile for job' });
  }
});

// @route   POST /api/profiles/generate-answers
// @desc    Generate AI answers for job application screening questions
// @access  Private
router.post('/generate-answers', authMiddleware, aiRateLimiter('tailor_profile'), async (req, res) => {
  try {
    const { questions, jobDescription, profile, questionMeta, seedAnswers } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Questions array is required' });
    }

    console.log(`Generating AI answers for ${questions.length} questions for user ${req.user.id}`);

    const aiService = require('../services/aiService');

    // Build skills string safely
    const skillsStr = Array.isArray(profile?.skills)
      ? profile.skills.join(', ')
      : (typeof profile?.skills === 'object' && profile?.skills !== null
          ? Object.values(profile.skills).flat().join(', ')
          : profile?.skills || 'Not specified');

    // Build experience summary
    const experienceStr = profile?.experience
      ? JSON.stringify(profile.experience.slice(0, 3)).substring(0, 2000)
      : 'Multiple years of professional experience';

    // Build education summary
    const educationStr = profile?.education
      ? JSON.stringify(profile.education.slice(0, 2)).substring(0, 500)
      : 'Not specified';

    // Build seed answers context (candidate's personal insights)
    let seedContext = '';
    if (seedAnswers && typeof seedAnswers === 'object') {
      const seedParts = [];
      if (seedAnswers.career_motivation) seedParts.push(`Career Motivation: ${seedAnswers.career_motivation}`);
      if (seedAnswers.ideal_role) seedParts.push(`Ideal Role: ${seedAnswers.ideal_role}`);
      if (seedAnswers.career_goals) seedParts.push(`Career Goals: ${seedAnswers.career_goals}`);
      if (seedAnswers.proudest_achievement) seedParts.push(`Proudest Achievement: ${seedAnswers.proudest_achievement}`);
      if (seedAnswers.unique_strength) seedParts.push(`Unique Strength: ${seedAnswers.unique_strength}`);
      if (seedAnswers.work_style) seedParts.push(`Work Style & Values: ${seedAnswers.work_style}`);
      if (seedParts.length > 0) {
        seedContext = `\n\nCANDIDATE'S PERSONAL INSIGHTS (use these to write authentic, personalized answers):\n${seedParts.join('\n')}`;
      }
    }

    // Build enriched question list with field type and options context
    const meta = Array.isArray(questionMeta) ? questionMeta : [];
    const questionDescriptions = questions.map((q, i) => {
      const m = meta[i] || {};
      let desc = `${i + 1}. "${q}"`;
      if (m.fieldType && m.fieldType !== 'text') {
        desc += ` [Field type: ${m.fieldType}]`;
      }
      if (m.options && Array.isArray(m.options) && m.options.length > 0) {
        desc += `\n   Available options: ${m.options.join(' | ')}`;
      }
      return desc;
    }).join('\n');

    const prompt = `You are an expert career coach helping a job candidate answer application screening questions on a job application form.
Your answers will be directly inserted into form fields, so they must be accurate, specific, and appropriately formatted for each field type.

CANDIDATE PROFILE:
- Name: ${req.user.firstName || ''} ${req.user.lastName || ''}
- Title: ${profile?.title || 'Professional'}
- Summary: ${profile?.summary || 'Experienced professional'}
- Skills: ${skillsStr}
- Location: ${profile?.location || 'United States'}
- Experience: ${experienceStr}
- Education: ${educationStr}${seedContext}

JOB CONTEXT:
${jobDescription ? jobDescription.substring(0, 2000) : 'Job application'}

SCREENING QUESTIONS TO ANSWER:
${questionDescriptions}

CRITICAL INSTRUCTIONS:
1. READ EACH QUESTION CAREFULLY. Answer ONLY what that specific question asks. Do not reuse or blend answers across questions.
2. For RADIO and SELECT fields: Your answer MUST exactly match one of the provided options. Choose the most appropriate option from the available list.
3. For TEXT fields with specific factual questions (years of experience, tech stack, etc.): Give a direct, concise answer derived from the profile.
4. For TEXTAREA / open-ended questions (e.g., "Why are you interested?", "Tell us about yourself", "Describe a challenge"):
   - Write 3-5 sentences that are specific to THIS candidate's actual background and THIS job
   - Reference specific skills, projects, or experiences from the profile
   - USE THE CANDIDATE'S PERSONAL INSIGHTS to make answers sound authentic and personal
   - Connect the candidate's motivations and career goals to the job requirements
   - Be genuine and professional, not generic or templated
   - Do NOT use placeholder language like "I am excited about this opportunity" without specific context
5. For yes/no questions: Answer "Yes" or "No" appropriately for a candidate seeking employment
6. Be truthful — do not fabricate experience or skills not present in the profile
7. Match your answer length to the field type: short for radio/select/text, detailed for textarea

WRITING STYLE (MANDATORY):
- Write like a real human, NOT like AI. Use natural, conversational prose.
- NEVER use dashes (—, –, -) as bullet separators or list markers.
- NEVER use bullet points, numbered lists, asterisks (*), or any list formatting.
- NEVER use phrases like "I am passionate about", "I am eager to", "I am thrilled", "I look forward to".
- Write in flowing sentences and short paragraphs. No headers, no bold, no markdown.
- Keep it casual-professional — the way a real person writes in a form field.
- Draw on the candidate's personal insights to make answers sound genuine and self-aware.

Return a JSON object where keys are the EXACT question text (matching the quotes above) and values are the answers:
{
  "Exact question text 1": "Answer 1",
  "Exact question text 2": "Answer 2"
}

Return ONLY valid JSON, no additional text or markdown.`;

    const completion = await aiService.generateText(prompt);

    let answers = {};
    try {
      let jsonText = completion.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      answers = JSON.parse(jsonText);

      // Post-process: strip AI formatting artifacts from all answers
      for (const key of Object.keys(answers)) {
        if (typeof answers[key] === 'string') {
          answers[key] = answers[key]
            .replace(/^[-•*]\s+/gm, '')           // remove leading bullets/dashes
            .replace(/^\d+\.\s+/gm, '')            // remove numbered list prefixes
            .replace(/\*\*([^*]+)\*\*/g, '$1')     // remove bold markdown
            .replace(/\*([^*]+)\*/g, '$1')          // remove italic markdown
            .replace(/^#+\s+/gm, '')               // remove markdown headers
            .replace(/\n{3,}/g, '\n\n')            // collapse excess newlines
            .trim();
        }
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      // Return empty answers on parse failure
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Record AI usage
    await recordAIUsage(req.user.id, 'generate_answers');

    res.json({
      success: true,
      answers
    });

  } catch (error) {
    console.error('Error generating answers:', error);
    res.status(500).json({ error: 'Error generating AI answers' });
  }
});

// @route   POST /api/profiles/autofill-suggest
// @desc    Suggest a value for a single autofill field that the rule-based
//          extension pass could not match. Lightweight, single-question call.
// @access  Private
router.post('/autofill-suggest', authMiddleware, aiRateLimiter('tailor_profile'), async (req, res) => {
  try {
    const { question, fieldType, options, profile, jobContext } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question is required' });
    }

    const { callAI, safeParseJSON } = require('../services/ai/core');

    // Build a tiny profile snapshot (keep prompt short → cheap & fast)
    const snap = {
      name: [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || null,
      title: profile?.title || profile?.headline || null,
      location: profile?.location || null,
      yearsExp: profile?.yearsOfExperience || null,
      summary: (profile?.summary || '').slice(0, 400) || null,
      skills: Array.isArray(profile?.skills) ? profile.skills.slice(0, 15) : null,
      authorized: profile?.workAuthorization || null,
    };

    const optList = Array.isArray(options) && options.length > 0
      ? options.slice(0, 60).map((o) => (typeof o === 'string' ? o : o?.text || '')).filter(Boolean)
      : null;

    const prompt = `You are filling out a job application for the candidate below. Pick the BEST answer for ONE question.

CANDIDATE: ${JSON.stringify(snap)}
${jobContext ? `JOB: ${JSON.stringify({ title: jobContext.title, company: jobContext.company }).slice(0, 300)}` : ''}

QUESTION: "${question}"
FIELD TYPE: ${fieldType || 'unknown'}
${optList ? `OPTIONS (must pick one EXACTLY as written): ${JSON.stringify(optList)}` : 'No fixed options — return a short free-text answer.'}

Rules:
- For demographic/EEO questions (gender, race, ethnicity, veteran, disability) → "Prefer not to say" if available.
- For sponsorship/visa/relocation/security-clearance questions, default to a safe answer based on the candidate (US-based candidates: authorized=Yes, sponsorship=No, willing-to-relocate=Yes).
- Free-text answers: 1-2 short sentences max, first-person, professional.
- If options are provided, you MUST return one of them verbatim.
- Reply ONLY with JSON: {"value": "<answer>", "confidence": 0..1}`;

    const response = await callAI({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.2,
    });
    const raw = response?.choices?.[0]?.message?.content?.trim() || '';
    const parsed = safeParseJSON(raw.match(/\{[\s\S]*\}/)?.[0] || raw, { value: '', confidence: 0 });
    const value = typeof parsed?.value === 'string' ? parsed.value.trim() : '';
    const confidence = Math.max(0, Math.min(1, Number(parsed?.confidence) || 0));

    if (!value) return res.json({ value: '', confidence: 0 });

    // If options are provided, ensure the model's output really is one of them.
    if (optList) {
      const exact = optList.find((o) => o.toLowerCase() === value.toLowerCase());
      if (!exact) {
        const fuzzy = optList.find((o) => o.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase().includes(o.toLowerCase()));
        if (!fuzzy) return res.json({ value: '', confidence: 0 });
        return res.json({ value: fuzzy, confidence: Math.min(confidence, 0.7) });
      }
      return res.json({ value: exact, confidence });
    }

    res.json({ value, confidence });
  } catch (err) {
    console.error('[profiles/autofill-suggest]', err);
    res.status(500).json({ error: 'Failed to generate autofill suggestion' });
  }
});

// @route   POST /api/profiles/autofill-suggest-batch
// @desc    Suggest values for MANY autofill fields in a single AI call. Far cheaper
//          and faster than calling /autofill-suggest per-field. Used by the Chrome
//          extension when the rule-based autofill leaves multiple custom dropdowns
//          unfilled (typical Greenhouse / Lever / Ashby application has 5-15).
// @access  Private
router.post('/autofill-suggest-batch', authMiddleware, aiRateLimiter('tailor_profile'), async (req, res) => {
  try {
    const { fields, profile, jobContext } = req.body || {};
    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ error: 'fields array is required' });
    }

    const { callAI, safeParseJSON } = require('../services/ai/core');

    const snap = {
      name: [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || null,
      title: profile?.title || profile?.headline || null,
      location: profile?.location || null,
      yearsExp: profile?.yearsOfExperience || null,
      summary: (profile?.summary || '').slice(0, 400) || null,
      skills: Array.isArray(profile?.skills) ? profile.skills.slice(0, 15) : null,
      authorized: profile?.workAuthorization || null,
    };

    const numbered = fields.slice(0, 30).map((f, i) => ({
      i,
      question: String(f.question || '').slice(0, 300),
      options: Array.isArray(f.options) ? f.options.slice(0, 60).map(String) : null,
      fieldType: f.fieldType || 'dropdown',
    }));

    const prompt = `You are filling out a job application for the candidate below.
Pick the BEST answer for EACH question. Reply ONLY with JSON in this exact shape:
{ "answers": [ { "i": <index>, "value": "<answer>", "confidence": 0..1 }, ... ] }

CANDIDATE: ${JSON.stringify(snap)}
${jobContext ? `JOB: ${JSON.stringify({ title: jobContext.title, company: jobContext.company }).slice(0, 300)}` : ''}

Rules:
- For demographic / EEO questions (gender, race, ethnicity, veteran, disability) → "Prefer not to say" if available.
- Sponsorship / visa / security-clearance: candidate is US-based and authorized to work, no sponsorship required.
- Open-to-relocation: Yes (default).
- "Are you currently / previously employed by ${jobContext?.company || 'the company'}?" → No (unless candidate.title says otherwise).
- "Are you familiar with [product]?" → Yes.
- Non-compete / conflict-of-interest / agreement-restricting-employment → No.
- "If offered, can you begin immediately / are you legally eligible?" → Yes.
- If options are provided, you MUST return one verbatim from the list.
- Free text: 1-2 short sentences max, first-person, professional.
- If unsure, return value:"" and confidence:0.

QUESTIONS:
${numbered.map(q => `[${q.i}] "${q.question}"${q.options ? `\n     options: ${JSON.stringify(q.options)}` : ' (free text)'}`).join('\n')}`;

    const response = await callAI({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
      temperature: 0.2,
    });
    const raw = response?.choices?.[0]?.message?.content?.trim() || '';
    const parsed = safeParseJSON(raw.match(/\{[\s\S]*\}/)?.[0] || raw, { answers: [] });
    const answers = Array.isArray(parsed?.answers) ? parsed.answers : [];

    // Validate: each answer.value must be one of the provided options when options exist.
    const result = numbered.map((q) => {
      const a = answers.find((x) => Number(x?.i) === q.i) || { value: '', confidence: 0 };
      let value = typeof a.value === 'string' ? a.value.trim() : '';
      const confidence = Math.max(0, Math.min(1, Number(a.confidence) || 0));
      if (!value) return { i: q.i, value: '', confidence: 0 };
      if (q.options && q.options.length) {
        const exact = q.options.find((o) => o.toLowerCase() === value.toLowerCase());
        if (exact) return { i: q.i, value: exact, confidence };
        const fuzzy = q.options.find((o) =>
          o.toLowerCase().includes(value.toLowerCase()) ||
          value.toLowerCase().includes(o.toLowerCase())
        );
        if (fuzzy) return { i: q.i, value: fuzzy, confidence: Math.min(confidence, 0.7) };
        return { i: q.i, value: '', confidence: 0 };
      }
      return { i: q.i, value, confidence };
    });

    res.json({ answers: result });
  } catch (err) {
    console.error('[profiles/autofill-suggest-batch]', err);
    res.status(500).json({ error: 'Failed to generate autofill batch' });
  }
});

// @route   POST /api/profiles/generate-cover-letter
// @desc    Generate a cover letter based on candidate profile and job info
// @access  Private
router.post('/generate-cover-letter', authMiddleware, aiRateLimiter('tailor_profile'), async (req, res) => {
  try {
    const { jobTitle, company, jobDescription, profile, tone, lines, length } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description is required' });
    }

    const enrichedProfile = {
      ...(profile || {}),
      firstName: profile?.firstName || req.user.firstName,
      lastName: profile?.lastName || req.user.lastName,
    };

    // Map the frontend `length` string ('short' | 'medium' | 'long') to the
    // numeric `lines` the cover-letter service expects. The UI promises
    // ~150/250/400 words for short/medium/long, which corresponds roughly to
    // 12/18/28 lines of typical cover-letter prose. Falls back to whatever
    // `lines` was passed (or service default) if `length` is missing/unknown.
    const LENGTH_TO_LINES = { short: 12, medium: 18, long: 28 };
    const resolvedLines = (typeof length === 'string' && LENGTH_TO_LINES[length])
      ? LENGTH_TO_LINES[length]
      : lines;

    const coverLetter = await coverLetterService.generateCoverLetter({
      profile: enrichedProfile,
      job: { title: jobTitle, company, description: jobDescription },
      tone,
      lines: resolvedLines,
      length,
    });

    await recordAIUsage(req.user.id, 'generate_cover_letter');

    res.json({ success: true, coverLetter });
  } catch (error) {
    console.error('Error generating cover letter:', error);
    res.status(500).json({ error: 'Error generating cover letter' });
  }
});

// @route   POST /api/profiles/enhance-text
// @desc    Enhance individual text (project description, experience description, etc.)
// @access  Private
router.post('/enhance-text', authMiddleware, aiRateLimiter('profile_enhance'), async (req, res) => {
  try {
    const { text, type, context } = req.body;

    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'Text must be at least 10 characters' });
    }

    if (!type || !['project', 'experience', 'summary', 'company_description', 'recruiter_bio'].includes(type)) {
      return res.status(400).json({ error: 'Type must be project, experience, summary, company_description, or recruiter_bio' });
    }

    console.log(`Enhancing ${type} description for user ${req.user.id}`);

    // Shared voice & tone rules — mirrors the resume-tailoring prompt so the
    // enhance-text output reads like a real person, not corporate filler.
    // Keep this in sync with backend/services/resume/tailoringPrompts.js.
    const VOICE_AND_TONE = `VOICE & TONE — write like a real person, not a press release:
- BANNED WORDS — never use any of these (or close synonyms): "results-driven", "results-oriented", "detail-oriented", "passionate", "dynamic", "visionary", "synergy", "leverage", "spearheaded", "orchestrated", "utilized", "proven track record", "go-getter", "self-starter", "thought leader", "rockstar", "ninja", "guru", "world-class", "best-in-class", "cutting-edge", "next-generation", "transformative", "disruptive", "game-changing", "seamlessly", "robust", "scalable solutions" (as filler), "leveraging", "ecosystem", "synergize", "cross-functional collaboration" (as filler), "strategic vision", "extensive expertise", "demonstrated ability", "exceptional".
- BANNED OPENERS for bullets: "Responsible for", "Worked on", "Helped with", "Was part of", "Tasked with", "Duties included".
- Plain-English action verbs only (built, shipped, designed, wrote, led, fixed, migrated, debugged, mentored, owned, scoped, automated, refactored). Never start two consecutive bullets with the same verb.
- Concrete over abstract. Prefer "rebuilt the checkout flow in React" over "drove transformative customer experiences".
- Don't pad. Short sentences. No throat-clearing intros ("In my role as...", "Throughout my career...").
- If a number isn't in the source, do NOT invent one. Describe the work qualitatively.`;

    let prompt;
    
    if (type === 'project') {
      prompt = `You are an experienced engineer rewriting a project description for a résumé. Make it sharper and more specific—without inflating it.

${VOICE_AND_TONE}

Project Title: ${context?.title || 'N/A'}
Role: ${context?.role || 'N/A'}
Technologies: ${Array.isArray(context?.technologies) ? context.technologies.join(', ') : 'N/A'}

Original Description:
${text}

Guidelines:
- Plain action verbs (built, shipped, designed, wrote, migrated, refactored, automated). Avoid the banned list above.
- Keep numbers ONLY if they appear in the original; never invent metrics.
- Cover what the project does, the role you played, the technical decisions, and the outcome—only if those facts are present in the source.
- ATS-friendly with the technologies listed above, but no keyword stuffing.
- Bullet points are fine when there are multiple distinct contributions; otherwise a short paragraph is better.

STRICT NO-INVENTION RULE: Do NOT introduce any skills, technologies, companies, employers, schools, certifications, metrics, percentages, or dollar amounts that are not present in the original description or context above. If a measurable outcome is not given, describe the work qualitatively instead of fabricating numbers.

LENGTH LIMIT: The enhanced description MUST be 1500 characters or fewer (including spaces). Be concise and prioritize the highest-impact content within this budget.

Provide ONLY the enhanced description, nothing else.`;
    } else if (type === 'experience') {
      // Industry-specific framing hint passed by the candidate's wizard
      // (sectorProfiles.ts → experience.aiContextHint). Lets a legal rewrite
      // emphasise practice area + jurisdiction, a sales rewrite lead with
      // quota %, a healthcare rewrite cite setting / population, etc. We
      // append it AFTER the universal voice/tone rules so the no-invention
      // and banned-word rules always win on conflict.
      const INDUSTRY_HINT = context?.hint
        ? `\nINDUSTRY FRAMING (sector: ${context?.sector || 'unspecified'}):\n${context.hint}\n`
        : '';

      prompt = `You are rewriting a work-experience entry for a résumé. Tighten the language and surface concrete contributions—without exaggerating.

${VOICE_AND_TONE}
${INDUSTRY_HINT}
Company: ${context?.company || 'N/A'}
Job Title: ${context?.title || 'N/A'}
Period: ${context?.period || 'N/A'}

Original Description:
${text}

Guidelines:
- Bullet points, each one starting with a plain action verb from the allowed set above.
- Each bullet = action + what/how + (optional) outcome. Outcomes must come from the original text—never fabricated.
- Keep specific tools, products, and team scope that the candidate actually mentioned.
- 3–7 bullets is fine. Don't pad to a target count if the source doesn't support it.
- ATS-friendly but no keyword stuffing.

STRICT NO-INVENTION RULE: Do NOT introduce any skills, technologies, companies, employers, schools, certifications, metrics, percentages, or dollar amounts that are not present in the original description or context above. If a measurable outcome is not given, describe the work qualitatively instead of fabricating numbers.

LENGTH LIMIT: The enhanced description MUST be 2000 characters or fewer (including spaces). Be concise and prioritize the highest-impact bullets within this budget.

Provide ONLY the enhanced description as bullet points, nothing else.`;
    } else if (type === 'summary') {
      prompt = `You are rewriting a professional summary so it reads like a real human wrote it—short, specific, and free of corporate filler.

${VOICE_AND_TONE}

Original Summary:
${text}

Guidelines:
- 3–5 short sentences. No multi-clause epics.
- Open with a concrete identity ( e.g. "Android engineer with 10 years of experience shipping consumer apps" ), not adjectives.
- Mention real specialties from the original; do NOT add new technologies, industries, or claims.
- End with what the person is looking for next, only if the original implies it. Otherwise stop.
- No "passionate", "results-driven", "visionary", "transformative", etc.

STRICT NO-INVENTION RULE: Do NOT introduce any skills, technologies, companies, employers, schools, certifications, metrics, percentages, or dollar amounts that are not present in the original summary. Describe the candidate qualitatively if specifics are missing.

LENGTH LIMIT: The enhanced summary MUST be 1500 characters or fewer (including spaces). Aim for 3–5 tight sentences — do not pad.

Provide ONLY the enhanced summary, nothing else.`;
    } else if (type === 'company_description') {
      prompt = `You are rewriting a company description for an employer-branding page. Plain language, no marketing slogans.

${VOICE_AND_TONE}

Company Name: ${context?.companyName || 'N/A'}
Industry: ${context?.industry || 'N/A'}
Company Size: ${context?.companySize || 'N/A'}

Original Description:
${text}

Guidelines:
- 3–5 sentences. Plain English. No "world-class", "cutting-edge", "transformative".
- Cover what the company does, who it serves, and the work environment—only using facts from the original.
- Don't invent benefits, perks, or growth claims.

STRICT NO-INVENTION RULE: Do NOT introduce any companies, products, technologies, certifications, or measurable outcomes that are not present in the original description.

Provide ONLY the enhanced description, nothing else.`;
    } else if (type === 'recruiter_bio') {
      prompt = `You are rewriting a recruiter bio so it sounds like a real person, not a corporate brochure.

${VOICE_AND_TONE}

Job Title: ${context?.jobTitle || 'N/A'}
Company: ${context?.companyName || 'N/A'}

Original Bio:
${text}

Guidelines:
- 3–5 short sentences in first person.
- Concrete background (industries, roles you hire for) using only what's in the original.
- A small personal touch is fine if implied by the source. No invented hobbies or claims.
- No "passionate about connecting talent" or similar clichés.

Provide ONLY the enhanced bio, nothing else.`;
    }

    const enhancedText = await aiService.generateText(prompt);

    if (!enhancedText) {
      return res.status(500).json({ error: 'Failed to generate enhanced text' });
    }

    // Hard length budget per type — must stay in sync with frontend FIELD_LIMITS.
    // The prompt asks the AI to respect these, but we clamp as a safety net so
    // the user never sees a "too long" validation error after accepting an
    // enhancement.
    const MAX_LENGTHS = {
      summary: 1500,
      experience: 2000,
      project: 1500,
      company_description: 1500,
      recruiter_bio: 1000,
    };
    const limit = MAX_LENGTHS[type];
    let trimmed = enhancedText.trim();
    if (limit && trimmed.length > limit) {
      // Trim at the last sentence boundary that fits within the budget.
      const slice = trimmed.slice(0, limit);
      const lastBoundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'), slice.lastIndexOf('\n'));
      trimmed = (lastBoundary > limit * 0.6 ? slice.slice(0, lastBoundary + 1) : slice).trim();
    }

    // Record AI usage for rate limiting
    await recordAIUsage(req.user.id, 'profile_enhance');

    // 5.4: grounding check — flag any new entities the AI may have introduced.
    const contextStrings = [
      context?.title,
      context?.company,
      context?.role,
      context?.period,
      Array.isArray(context?.technologies) ? context.technologies.join(' ') : context?.technologies,
    ].filter(Boolean);
    const hallucinationFlags = checkGrounding(text, trimmed, contextStrings);

    res.json({
      success: true,
      enhancedText: trimmed,
      hallucinationFlags
    });

  } catch (error) {
    console.error('Error enhancing text:', error);
    res.status(500).json({ error: 'Error enhancing text' });
  }
});

// @route   GET /api/profiles/me
// @desc    Get current user's profile
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Authed, user-specific response. Disable shared/proxy/browser caching so
    // a different user on the same browser (or a stale 304 from disk cache)
    // can never see another account's profile.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const profile = await Profile.findOne({
      where: { userId: req.user.id }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Backfill avatar from OAuth provider photo (User.profilePictureUrl)
    // for legacy SSO accounts whose Profile row was created before we
    // started seeding profilePicture on first save. One-shot persistence
    // so subsequent reads are cheap and the recruiter-side serializers
    // that read profile.profilePicture directly see the same value.
    if (!profile.profilePicture && req.user?.profilePictureUrl) {
      try {
        await profile.update({ profilePicture: req.user.profilePictureUrl });
      } catch (backfillErr) {
        // Non-fatal: still return the avatar in the response so the UI
        // populates immediately even if the write failed.
        console.warn('Avatar backfill failed:', backfillErr.message);
        profile.profilePicture = req.user.profilePictureUrl;
      }
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/profiles
// @desc    Create or update profile
// @access  Private
router.post(
  '/',
  [
    authMiddleware,
    body('title').notEmpty().withMessage('Title is required'),
    body('summary').optional(),
    body('location').optional(),
    body('phone').optional(),
    body('linkedinUrl').optional({ checkFalsy: true }).isURL(STRICT_URL_OPTS).withMessage('Invalid LinkedIn URL'),
    body('githubUrl').optional({ checkFalsy: true }).isURL(STRICT_URL_OPTS).withMessage('Invalid GitHub URL'),
    body('portfolioUrl').optional({ checkFalsy: true }).isURL(STRICT_URL_OPTS).withMessage('Invalid Portfolio URL'),
    body('projects.*.url').optional({ checkFalsy: true }).isURL(STRICT_URL_OPTS).withMessage('Project Live Demo URL must start with http:// or https://'),
    body('projects.*.githubUrl').optional({ checkFalsy: true }).isURL(STRICT_URL_OPTS).withMessage('Project Source Code URL must start with http:// or https://'),
    body('projects.*.imageUrl').optional({ checkFalsy: true }).isURL(STRICT_URL_OPTS).withMessage('Project Image URL must start with http:// or https://')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        location,
        phone,
        linkedinUrl,
        githubUrl,
        portfolioUrl,
        summary,
        profilePicture,
        coverImage,
        skills,
        experience,
        education,
        projects,
        isPublic
      } = req.body;

      // Check if profile exists
      let profile = await Profile.findOne({ where: { userId: req.user.id } });

      const profileData = {
        userId: req.user.id,
        title,
        location: location || null,
        phone: phone || null,
        linkedinUrl: linkedinUrl || null,
        githubUrl: githubUrl || null,
        portfolioUrl: portfolioUrl || null,
        summary: summary || null,
        profilePicture: profilePicture || null,
        coverImage: coverImage || null,
        skills: skills || {},
        experience: experience || [],
        education: education || [],
        projects: projects || [],
        isPublic: isPublic !== undefined ? isPublic : true
      };

      if (profile) {
        // Update existing profile
        await profile.update(profileData);
      } else {
        // Create new profile. Seed the avatar from User.profilePictureUrl
        // (captured during Google/GitHub OAuth sign-in) when the client
        // didn't supply one — so users who register via SSO get their
        // provider photo as a default on first onboarding save instead of
        // a blank initials avatar. They can still replace it later via
        // the normal profile edit flow.
        if (!profileData.profilePicture && req.user?.profilePictureUrl) {
          profileData.profilePicture = req.user.profilePictureUrl;
        }
        profile = await Profile.create(profileData);
      }

      // Mark onboarding complete once the profile has a title AND at least
      // a summary or one experience entry — i.e. it's a real first profile.
      // This flips the AI rate limiter from the generous 'onboarding' tier
      // to the user's actual subscription tier.
      if (!req.user.aiOnboardingCompleted) {
        const hasTitle = !!(profileData.title && profileData.title.trim());
        const hasSummary = !!(profileData.summary && profileData.summary.trim());
        const hasExperience = Array.isArray(profileData.experience) && profileData.experience.length > 0;
        if (hasTitle && (hasSummary || hasExperience)) {
          await User.update(
            { aiOnboardingCompleted: true },
            { where: { id: req.user.id } }
          );
        }
      }

      res.json(profile);
    } catch (error) {
      console.error('Error creating/updating profile:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// @route   POST /api/profiles/keyword-optimization
// @desc    Analyze job description keywords vs profile and suggest optimizations
// @access  Private
router.post('/keyword-optimization', authMiddleware, aiRateLimiter('profile_enhance'), async (req, res) => {
  try {
    const { profileData, jobDescription } = req.body;

    if (!profileData) {
      return res.status(400).json({ error: 'Profile data is required' });
    }

    if (!jobDescription || jobDescription.trim().length < 50) {
      return res.status(400).json({ error: 'Please provide a detailed job description (at least 50 characters)' });
    }

    console.log(`Keyword optimization for user ${req.user.id}`);

    const prompt = `Analyze this job description and the candidate's profile. Identify the most important keywords and phrases from the job that are missing or underrepresented in the profile. Return a JSON object with this exact structure:
{
  "matchedKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["keyword1", "keyword2"],
  "suggestedAdditions": [
    {"keyword": "keyword", "section": "skills|summary|experience", "reason": "why this keyword matters", "priority": "high|medium|low"}
  ],
  "overallKeywordScore": 75,
  "atsOptimizationTips": ["tip1", "tip2"]
}

JOB DESCRIPTION:
${jobDescription.substring(0, 3000)}

CANDIDATE PROFILE:
Title: ${profileData.title || 'N/A'}
Summary: ${(profileData.summary || '').substring(0, 500)}
Skills: ${Array.isArray(profileData.skills) ? profileData.skills.map(s => typeof s === 'string' ? s : s?.name || '').join(', ') : typeof profileData.skills === 'object' ? Object.entries(profileData.skills).map(([cat, items]) => `${cat}: ${Array.isArray(items) ? items.join(', ') : ''}`).join('; ') : ''}
Experience: ${(profileData.experience || []).map(e => `${e.title} at ${e.company}: ${(e.description || '').substring(0, 200)}`).join('; ')}
Projects: ${(profileData.projects || []).map(p => `${p.title}: ${(p.description || '').substring(0, 150)}`).join('; ')}

Return ONLY valid JSON.`;

    const result = await aiService.generateText(prompt);
    
    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      parsed = null;
    }

    if (!parsed) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Record AI usage
    await recordAIUsage(req.user.id, 'profile_enhance');

    res.json({
      success: true,
      data: parsed
    });

  } catch (error) {
    console.error('Error in keyword optimization:', error);
    res.status(500).json({ error: 'Error analyzing keywords' });
  }
});

// @route   POST /api/profiles/enhance
// @desc    Enhance profile with AI
// @access  Private
router.post('/enhance', authMiddleware, aiRateLimiter('profile_enhance'), async (req, res) => {
  try {
    const profile = await Profile.findOne({ where: { userId: req.user.id } });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found. Please create a profile first.' });
    }

    // Prepare data for AI enhancement
    const profileData = {
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      title: profile.title,
      summary: profile.summary,
      skills: profile.skills,
      experience: profile.experience,
      education: profile.education,
      projects: profile.projects
    };

    // Generate AI enhancements
    const aiEnhancements = await aiService.enhanceProfile(profileData);

    // Update profile with AI enhancements
    await profile.update({
      aiSummary: aiEnhancements.aiSummary,
      aiStrengths: aiEnhancements.aiStrengths,
      aiRecruiterInsights: aiEnhancements.aiRecruiterInsights,
      aiKeywords: aiEnhancements.aiKeywords
    });

    // Record AI usage
    await recordAIUsage(req.user.id, 'profile_enhance');

    res.json({
      message: 'Profile enhanced successfully',
      enhancements: aiEnhancements
    });
  } catch (error) {
    console.error('Error enhancing profile:', error);
    res.status(500).json({ error: error.message || 'Server error during AI enhancement' });
  }
});

// @route   GET /api/profiles/:id
// @desc    Get public profile by user UUID or by slug (/profile/saeed-darvish).
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Resolve the param to a real userId. If it looks like a UUID, use it
    // directly. Otherwise treat it as a slug and look up the User row first.
    let userId = id;
    if (!isUuid(id)) {
      const userBySlug = await User.findOne({
        where: { slug: id },
        attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'slug', 'profilePictureUrl'],
      });
      if (!userBySlug) {
        return res.status(404).json({ error: 'Profile not found or not public' });
      }
      userId = userBySlug.id;
    }

    // Look up profile by userId (not profile.id)
    const profile = await Profile.findOne({
      where: {
        userId,
        isPublic: true
      },
      order: [['createdAt', 'DESC']], // Get most recent profile if duplicates
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'slug', 'profilePictureUrl']
      }]
    });

    // If no candidate profile found, check if it's a recruiter
    if (!profile) {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'slug', 'profilePictureUrl']
      });

      if (user && user.role === 'recruiter') {
        // Return recruiter profile structure
        const { RecruiterProfile } = require('../models');
        const recruiterProfile = await RecruiterProfile.findOne({
          where: { userId },
          order: [['createdAt', 'DESC']]
        });

        if (recruiterProfile) {
          return res.json({
            ...recruiterProfile.toJSON(),
            user: user,
            isRecruiter: true
          });
        }
      }

      return res.status(404).json({ error: 'Profile not found or not public' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/profiles
// @desc    Get all public profiles (with smart search/filter) - Only candidate profiles
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      skills,           // Comma-separated skills filter
      location,         // Location filter
      experienceLevel,  // Entry, Junior, Mid, Senior
      minExperience,    // Min years of experience
      maxExperience,    // Max years of experience
      aiEnhanced,       // Only AI-enhanced profiles
      sortBy,           // relevance, recent, experience
      limit = 20, 
      offset = 0 
    } = req.query;

    const { Op, Sequelize, literal, fn, col, where: seqWhere } = require('sequelize');
    
    const where = { isPublic: true };
    const userWhere = { role: 'candidate' };
    const replacements = {};
    let paramIndex = 0;
    
    // Helper to create safe parameterized literal
    const safeLike = (sqlExpr, value) => {
      const key = `p${paramIndex++}`;
      replacements[key] = `%${value}%`;
      return literal(`${sqlExpr} ILIKE :${key}`);
    };
    
    // Build comprehensive search conditions
    const searchConditions = [];
    
    // Text search across multiple fields
    if (search) {
      const searchTerm = search.trim();
      const searchTerms = searchTerm.split(/\s+/).filter(t => t.length > 1);
      
      // Search in profile fields
      searchConditions.push({ title: { [Op.iLike]: `%${searchTerm}%` } });
      searchConditions.push({ summary: { [Op.iLike]: `%${searchTerm}%` } });
      searchConditions.push({ location: { [Op.iLike]: `%${searchTerm}%` } });
      
      // Search in AI-generated fields
      searchConditions.push({ aiSummary: { [Op.iLike]: `%${searchTerm}%` } });
      
      // Search in skills (JSON field) - cast to text for searching (parameterized)
      searchConditions.push(safeLike(`CAST("Profile"."skills" AS TEXT)`, searchTerm));
      
      // Search in experience (JSON field)
      searchConditions.push(safeLike(`CAST("Profile"."experience" AS TEXT)`, searchTerm));
      
      // Search in AI keywords
      searchConditions.push(safeLike(`CAST("Profile"."aiKeywords" AS TEXT)`, searchTerm));
      
      // Search in user's name (firstName, lastName)
      searchConditions.push(safeLike(`"user"."firstName"`, searchTerm));
      searchConditions.push(safeLike(`"user"."lastName"`, searchTerm));
      // Search full name (firstName + lastName)
      searchConditions.push(safeLike(`CONCAT("user"."firstName", ' ', "user"."lastName")`, searchTerm));
      
      // Also search each term individually for better matching
      searchTerms.forEach(term => {
        if (term.length > 2) {
          searchConditions.push({ title: { [Op.iLike]: `%${term}%` } });
          searchConditions.push(safeLike(`CAST("Profile"."skills" AS TEXT)`, term));
          // Search individual terms in names
          searchConditions.push(safeLike(`"user"."firstName"`, term));
          searchConditions.push(safeLike(`"user"."lastName"`, term));
        }
      });
    }
    
    // Skills filter (comma-separated list)
    if (skills) {
      const skillsList = skills.split(',').map(s => s.trim().toLowerCase());
      skillsList.forEach(skill => {
        const key = `p${paramIndex++}`;
        replacements[key] = `%${skill}%`;
        searchConditions.push(literal(`LOWER(CAST("Profile"."skills" AS TEXT)) LIKE :${key}`));
      });
    }
    
    // Location filter
    if (location) {
      searchConditions.push({ location: { [Op.iLike]: `%${location}%` } });
    }
    
    // AI-enhanced filter
    if (aiEnhanced === 'true') {
      where.aiSummary = { [Op.ne]: null };
    }
    
    // Apply search conditions
    if (searchConditions.length > 0) {
      where[Op.or] = searchConditions;
    }

    // Determine ordering
    let order = [['createdAt', 'DESC']];
    
    if (sortBy === 'experience') {
      // Sort by experience count (profiles with more experience first)
      order = [
        [literal(`COALESCE(jsonb_array_length("Profile"."experience"), 0)`), 'DESC'],
        ['createdAt', 'DESC']
      ];
    } else if (sortBy === 'aiScore') {
      // Sort by AI enhancement level
      order = [
        [literal(`CASE WHEN "Profile"."aiSummary" IS NOT NULL THEN 1 ELSE 0 END`), 'DESC'],
        [literal(`CASE WHEN "Profile"."aiRecruiterInsights" IS NOT NULL THEN 1 ELSE 0 END`), 'DESC'],
        ['createdAt', 'DESC']
      ];
    }

    const queryOptions = {
      where,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'role'],
        where: userWhere
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order
    };
    
    // Add replacements for parameterized literal queries
    if (Object.keys(replacements).length > 0) {
      queryOptions.replacements = replacements;
    }

    const profiles = await Profile.findAndCountAll(queryOptions);

    // Calculate relevance scores for sorting if search is provided
    let rankedProfiles = profiles.rows;
    
    if (search && sortBy === 'relevance') {
      const searchLower = search.toLowerCase();
      const searchTerms = searchLower.split(/\s+/).filter(t => t.length > 1);
      
      rankedProfiles = profiles.rows.map(profile => {
        let score = 0;
        const p = profile.toJSON ? profile.toJSON() : profile;
        
        // Name match (highest weight for exact match)
        const fullName = `${p.user?.firstName || ''} ${p.user?.lastName || ''}`.toLowerCase();
        if (fullName.includes(searchLower)) score += 60;
        searchTerms.forEach(term => {
          if (fullName.includes(term)) score += 25;
        });
        
        // Title exact match (high weight)
        if (p.title && p.title.toLowerCase().includes(searchLower)) score += 50;
        searchTerms.forEach(term => {
          if (p.title && p.title.toLowerCase().includes(term)) score += 15;
        });
        
        // Skills matching (high weight)
        const allSkills = Object.values(p.skills || {}).flat().map(s => 
          (typeof s === 'string' ? s : s.name || '').toLowerCase()
        );
        searchTerms.forEach(term => {
          if (allSkills.some(skill => skill.includes(term))) score += 30;
        });
        
        // Location match
        if (p.location && p.location.toLowerCase().includes(searchLower)) score += 20;
        
        // AI-enhanced bonus
        if (p.aiSummary) score += 15;
        if (p.aiRecruiterInsights) score += 10;
        
        // Summary match
        if (p.summary && p.summary.toLowerCase().includes(searchLower)) score += 10;
        
        // Experience relevance
        const expText = JSON.stringify(p.experience || []).toLowerCase();
        searchTerms.forEach(term => {
          if (expText.includes(term)) score += 5;
        });
        
        return { ...p, _relevanceScore: score };
      }).sort((a, b) => b._relevanceScore - a._relevanceScore);
    }

    // Calculate experience level for each profile
    const enrichedProfiles = rankedProfiles.map(p => {
      const profile = p.toJSON ? p.toJSON() : p;
      const expCount = (profile.experience || []).length;
      let experienceLevelLabel;
      if (expCount >= 5) experienceLevelLabel = 'Senior';
      else if (expCount >= 3) experienceLevelLabel = 'Mid-Level';
      else if (expCount >= 1) experienceLevelLabel = 'Junior';
      else experienceLevelLabel = 'Entry';
      
      return {
        ...profile,
        experienceLevel: experienceLevelLabel,
        experienceCount: expCount
      };
    });

    // Filter by experience level if specified
    let filteredProfiles = enrichedProfiles;
    if (experienceLevel) {
      filteredProfiles = enrichedProfiles.filter(p => 
        p.experienceLevel.toLowerCase() === experienceLevel.toLowerCase()
      );
    }

    res.json({
      profiles: filteredProfiles,
      total: profiles.count,
      filtered: filteredProfiles.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      searchApplied: !!search,
      filtersApplied: {
        skills: skills || null,
        location: location || null,
        experienceLevel: experienceLevel || null,
        aiEnhanced: aiEnhanced === 'true'
      }
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
