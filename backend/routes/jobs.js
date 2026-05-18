const express = require('express');
const router = express.Router();
const { Job, User, RecruiterProfile, JobScreening, SavedJob, JobApplication, Profile } = require('../models');
const authMiddleware = require('../middleware/auth');
const requireRecruiterSurface = require('../middleware/recruiterSurface');
const { aiRateLimiter, recordAIUsage } = require('../middleware/aiRateLimiter');
const { Op } = require('sequelize');
const aiService = require('../services/aiService');
const recruitmentService = require('../services/recruitmentService');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const jobSearchService = require('../services/jobSearchService');
const multer = require('multer');
const { cloudinary } = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary storage for resume uploads
const resumeStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profileai/resumes',
    resource_type: 'raw',
    allowed_formats: ['pdf', 'doc', 'docx']
  }
});

const resumeUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/msword'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'));
    }
  }
});

/**
 * @route   GET /api/jobs
 * @desc    Get all active jobs (public)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await jobSearchService.searchJobs({ ...req.query, page, limit });
    res.json(result);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/jobs/company/:userId
 * @desc    Get public jobs by company/recruiter ID
 * @access  Public
 */
router.get('/company/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const jobs = await Job.findAll({
      where: {
        userId: userId,
        status: 'active'
      },
      include: [{
        model: User,
        as: 'recruiter',
        attributes: ['id', 'firstName', 'lastName'],
        include: [{
          model: RecruiterProfile,
          as: 'recruiterProfile',
          attributes: ['companyName', 'companyLogo', 'companySlug', 'industry', 'profilePicture']
        }]
      }],
      order: [['featured', 'DESC'], ['createdAt', 'DESC']]
    });
    
    res.json({ jobs });
  } catch (error) {
    console.error('Error fetching company jobs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/jobs/my-jobs
 * @desc    Get recruiter's own jobs
 * @access  Private (Recruiter)
 */
router.get('/my-jobs', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only recruiters can access this endpoint' });
    }
    
    const { status, page = 1, limit = 20 } = req.query;
    
    const where = { userId: req.user.id };
    if (status) {
      where.status = status;
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows: jobs } = await Job.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    res.json({
      jobs,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching my jobs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/jobs/application-templates
 * @desc    Get application form templates
 * @access  Private (Recruiter)
 */
router.get('/application-templates', authMiddleware, (req, res) => {
  const { FORM_TEMPLATES, STANDARD_QUESTIONS } = require('../config/applicationFormTemplates');
  
  try {
    res.json({
      templates: FORM_TEMPLATES,
      standardQuestions: STANDARD_QUESTIONS
    });
  } catch (error) {
    console.error('Error fetching application templates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/jobs/:id/screening-status
 * @desc    Get the screening status for a job (recruitment automation progress)
 * @access  Private (Recruiter - owner only)
 */
router.get('/:id/screening-status', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Only job owner can view screening status
    if (job.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this job screening status' });
    }
    
    const screeningStatus = await recruitmentService.getScreeningStatus(req.params.id);
    
    res.json(screeningStatus);
  } catch (error) {
    console.error('Error fetching screening status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/jobs/:id/start-screening
 * @desc    Start AI screening with custom configuration
 * @access  Private (Recruiter - owner only)
 */
router.post('/:id/start-screening', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Only job owner can start screening
    if (job.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to start screening for this job' });
    }
    
    const {
      minMatchScore = 60,
      candidatesToScreen = 25,
      includePassiveCandidates = true,
      enablePhoneScreening = true,
      phoneScreeningDuration = 15,
      enableEmailOutreach = true,
      useAgentArena = true, // Enable visible Agent-to-Agent negotiations
      screeningStyle = 'balanced',
      priorityFactors = ['skills', 'experience'],
      autoScheduleInterviews = true,
      sendRejectionEmails = false,
      customInstructions = ''
    } = req.body;
    
    // Store configuration in job or screening record
    const screeningConfig = {
      minMatchScore,
      candidatesToScreen,
      includePassiveCandidates,
      enablePhoneScreening,
      phoneScreeningDuration,
      enableEmailOutreach,
      useAgentArena,
      screeningStyle,
      priorityFactors,
      autoScheduleInterviews,
      sendRejectionEmails,
      customInstructions
    };
    
    console.log(`Starting screening for job ${job.id} with config:`, screeningConfig);
    
    // Start the recruitment drive with configuration (searchOnly = true for manual selection)
    recruitmentService.startRecruitmentDrive(job.id, screeningConfig, true).catch(err => {
      console.error('Background recruitment drive failed:', err);
    });
    
    res.json({
      message: 'AI Smart Search started successfully',
      jobId: job.id,
      config: screeningConfig
    });
  } catch (error) {
    console.error('Error starting screening:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/jobs/:id/screen-selected
 * @desc    Start AI screening for manually selected candidates
 * @access  Private (Recruiter - owner only)
 */
router.post('/:id/screen-selected', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Only job owner can start screening
    if (job.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to screen candidates for this job' });
    }
    
    const { candidateIds } = req.body;
    
    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ message: 'Please provide candidate IDs to screen' });
    }
    
    console.log(`Starting screening for ${candidateIds.length} selected candidates on job ${job.id}`);
    
    // Start screening for selected candidates (async)
    recruitmentService.startScreeningForSelected(job.id, candidateIds).catch(err => {
      console.error('Background screening of selected candidates failed:', err);
    });
    
    res.json({
      message: `AI screening started for ${candidateIds.length} selected candidates`,
      jobId: job.id,
      candidateCount: candidateIds.length
    });
  } catch (error) {
    console.error('Error starting screening for selected candidates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/jobs/:id/cancel-screening
 * @desc    Cancel a running screening drive
 * @access  Private (job owner only)
 */
router.post('/:id/cancel-screening', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.recruiterId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

    const result = await recruitmentService.cancelScreening(job.id);
    res.json({ message: 'Screening cancelled successfully', ...result });
  } catch (error) {
    console.error('Error cancelling screening:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * @route   POST /api/jobs/:id/screening-feedback
 * @desc    Submit recruiter feedback on the screening results
 * @access  Private (Recruiter - owner only)
 */
router.post('/:id/screening-feedback', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Only job owner can submit feedback
    if (job.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to submit feedback for this job' });
    }
    
    const { rating, comments, improveSearchCriteria, improveScreeningLogic } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    
    const updatedScreening = await recruitmentService.submitScreeningFeedback(req.params.id, req.user.id, {
      rating,
      notes: comments,
      searchQuality: rating,
      candidateQuality: rating,
      improveSearch: improveSearchCriteria
    });
    
    res.json({
      message: 'Feedback submitted successfully',
      screening: updatedScreening
    });
  } catch (error) {
    console.error('Error submitting screening feedback:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/jobs/:id
 * @desc    Get job by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const job = await jobSearchService.getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/jobs
 * @desc    Create a new job posting
 * @access  Private (Recruiter)
 */
router.post('/', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only recruiters can post jobs' });
    }
    
    const {
      title,
      company,
      location,
      locationType,
      employmentType,
      experienceLevel,
      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryPeriod,
      description,
      requirements,
      benefits,
      skills,
      department,
      applicationDeadline,
      status,
      skipAutoScreening,
      applicationQuestions
    } = req.body;
    
    // Validation
    if (!title || !company || !location || !description) {
      return res.status(400).json({ 
        message: 'Title, company, location, and description are required' 
      });
    }
    
    const job = await Job.create({
      userId: req.user.id,
      title,
      company,
      location,
      locationType: locationType || 'onsite',
      employmentType: employmentType || 'full-time',
      experienceLevel: experienceLevel || 'mid',
      salaryMin: salaryMin || null,
      salaryMax: salaryMax || null,
      salaryCurrency: salaryCurrency || 'USD',
      salaryPeriod: salaryPeriod || 'yearly',
      description,
      requirements: requirements || null,
      benefits: benefits || null,
      skills: skills || [],
      department: department || null,
      applicationDeadline: applicationDeadline || null,
      status: status || 'active',
      applicationQuestions: applicationQuestions || []
    });
    
    // Trigger automated recruitment drive only if not skipped
    // (skipAutoScreening means recruiter will configure and start manually)
    if (!skipAutoScreening) {
      recruitmentService.startRecruitmentDrive(job.id).catch(err => {
        console.error('Background recruitment drive failed:', err);
      });
    }
    
    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/jobs/:id
 * @desc    Update a job posting
 * @access  Private (Recruiter - owner only)
 */
router.put('/:id', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (job.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this job' });
    }
    
    const {
      title,
      company,
      location,
      locationType,
      employmentType,
      experienceLevel,
      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryPeriod,
      description,
      requirements,
      benefits,
      skills,
      department,
      applicationDeadline,
      status,
      applicationQuestions
    } = req.body;
    
    await job.update({
      title: title || job.title,
      company: company || job.company,
      location: location || job.location,
      locationType: locationType || job.locationType,
      employmentType: employmentType || job.employmentType,
      experienceLevel: experienceLevel || job.experienceLevel,
      salaryMin: salaryMin !== undefined ? salaryMin : job.salaryMin,
      salaryMax: salaryMax !== undefined ? salaryMax : job.salaryMax,
      salaryCurrency: salaryCurrency || job.salaryCurrency,
      salaryPeriod: salaryPeriod || job.salaryPeriod,
      description: description || job.description,
      requirements: requirements !== undefined ? requirements : job.requirements,
      benefits: benefits !== undefined ? benefits : job.benefits,
      skills: skills || job.skills,
      department: department !== undefined ? department : job.department,
      applicationDeadline: applicationDeadline !== undefined ? applicationDeadline : job.applicationDeadline,
      status: status || job.status,
      applicationQuestions: applicationQuestions !== undefined ? applicationQuestions : job.applicationQuestions
    });
    
    res.json(job);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/jobs/:id
 * @desc    Delete a job posting
 * @access  Private (Recruiter - owner only)
 */
router.delete('/:id', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (job.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this job' });
    }
    
    await job.destroy();
    
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/jobs/:id/status
 * @desc    Update job status (active, paused, closed)
 * @access  Private (Recruiter - owner only)
 */
router.put('/:id/status', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    const job = await Job.findByPk(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (job.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this job' });
    }
    
    const { status } = req.body;
    
    if (!['draft', 'active', 'paused', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    await job.update({ status });
    
    res.json(job);
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/jobs/ai/generate-description
 * @desc    Generate AI job description based on basic info
 * @access  Private (Recruiter)
 */
router.post('/ai/generate-description', requireRecruiterSurface, authMiddleware, aiRateLimiter('job_enhance'), async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only recruiters can use this feature' });
    }

    const { title, company, department, experienceLevel, locationType, skills, notes } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: 'Job title is required' });
    }

    const description = await aiService.generateJobDescription({
      title,
      companyName: company,
      department,
      experienceLevel: experienceLevel || 'mid',
      workMode: locationType || 'onsite',
      requiredSkills: skills || [],
      notes
    });

    // Record AI usage
    await recordAIUsage(req.user.id, 'job_enhance');

    res.json({ description });
  } catch (error) {
    console.error('Error generating AI job description:', error);
    res.status(500).json({ message: 'Failed to generate job description' });
  }
});

/**
 * @route   POST /api/jobs/ai/suggest-skills
 * @desc    AI suggests skills for a job title
 * @access  Private (Recruiter)
 */
router.post('/ai/suggest-skills', requireRecruiterSurface, authMiddleware, aiRateLimiter('job_enhance'), async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only recruiters can use this feature' });
    }

    const { title, industry } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: 'Job title is required' });
    }

    const skills = await aiService.suggestSkillsForRole(title, industry || 'Technology');

    // Record AI usage
    await recordAIUsage(req.user.id, 'job_enhance');

    res.json(skills);
  } catch (error) {
    console.error('Error suggesting skills:', error);
    res.status(500).json({ message: 'Failed to suggest skills' });
  }
});

/**
 * @route   POST /api/jobs/ai/improve-title
 * @desc    AI suggests improved job titles
 * @access  Private (Recruiter)
 */
router.post('/ai/improve-title', requireRecruiterSurface, authMiddleware, aiRateLimiter('job_enhance'), async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only recruiters can use this feature' });
    }

    const { title, experienceLevel, department } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: 'Current title is required' });
    }

    const prompt = `Given this job title: "${title}"
Experience Level: ${experienceLevel || 'Not specified'}
Department: ${department || 'Not specified'}

Suggest 5 alternative job titles that:
1. Are more attractive to candidates
2. Better reflect industry standards
3. Would improve search visibility
4. Are clear about the role level

Return as JSON array of objects:
[{"title": "...", "reason": "Why this title works better"}]`;

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 1 });
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_JOB_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    });

    const content = response.choices[0].message.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    // Record AI usage
    await recordAIUsage(req.user.id, 'job_enhance');
    
    if (jsonMatch) {
      res.json({ suggestions: JSON.parse(jsonMatch[0]) });
    } else {
      res.json({ suggestions: [] });
    }
  } catch (error) {
    console.error('Error improving title:', error);
    res.status(500).json({ message: 'Failed to improve title' });
  }
});

/**
 * @route   POST /api/jobs/ai/generate-requirements
 * @desc    AI generates requirements section
 * @access  Private (Recruiter)
 */
router.post('/ai/generate-requirements', requireRecruiterSurface, authMiddleware, aiRateLimiter('job_enhance'), async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only recruiters can use this feature' });
    }

    const { title, skills, experienceLevel, description } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: 'Job title is required' });
    }

    const prompt = `Create a professional requirements section for this job posting:

Job Title: ${title}
Experience Level: ${experienceLevel || 'mid'}
Key Skills: ${JSON.stringify(skills || [])}
Job Description: ${description || 'Not provided'}

Write a clean requirements section with these categories:

Education & Experience
- Education requirement
- Years of experience requirement
- Industry experience if applicable

Technical Skills
- Technical skill 1
- Technical skill 2
- Technical skill 3
- Technical skill 4

Soft Skills
- Soft skill 1
- Soft skill 2
- Soft skill 3

Certifications (if applicable)
- Certification 1
- Certification 2

IMPORTANT RULES:
1. Do NOT use emojis, asterisks, or special formatting characters
2. Use simple dashes (-) for bullet points
3. Use plain section titles without any symbols
4. Write clean, professional text`;

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 1 });
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_JOB_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.7
    });

    // Record AI usage
    await recordAIUsage(req.user.id, 'job_enhance');

    res.json({ requirements: response.choices[0].message.content.trim() });
  } catch (error) {
    console.error('Error generating requirements:', error);
    res.status(500).json({ message: 'Failed to generate requirements' });
  }
});

/**
 * @route   POST /api/jobs/ai/generate-benefits
 * @desc    AI generates benefits section
 * @access  Private (Recruiter)
 */
router.post('/ai/generate-benefits', requireRecruiterSurface, authMiddleware, aiRateLimiter('job_enhance'), async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only recruiters can use this feature' });
    }

    const { company, industry, existingBenefits } = req.body;

    const prompt = `Create an attractive benefits section for a job posting:

Company: ${company || 'Tech Company'}
Industry: ${industry || 'Technology'}
Existing Benefits to Include: ${existingBenefits || 'None specified'}

Write a compelling benefits section with these categories:

Health & Wellness
- Health benefit 1
- Health benefit 2
- Wellness perk

Work-Life Balance
- Flexibility perk 1
- PTO/vacation policy
- Remote work option if applicable

Growth & Development
- Learning opportunity 1
- Career development perk
- Mentorship/training

Compensation & Perks
- Financial benefit 1
- Bonus/equity if applicable
- Other perks

Culture & Fun
- Team activity/event
- Office perk
- Culture highlight

IMPORTANT RULES:
1. Do NOT use emojis, asterisks, or special formatting characters
2. Use simple dashes (-) for bullet points
3. Use plain section titles without any symbols
4. Write clean, professional text`;

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 1 });
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_JOB_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.7
    });

    // Record AI usage
    await recordAIUsage(req.user.id, 'job_enhance');

    res.json({ benefits: response.choices[0].message.content.trim() });
  } catch (error) {
    console.error('Error generating benefits:', error);
    res.status(500).json({ message: 'Failed to generate benefits' });
  }
});

/**
 * @route   GET /api/jobs/saved
 * @desc    Get user's saved jobs
 * @access  Private (Candidate)
 */
router.get('/saved', authMiddleware, async (req, res) => {
  try {
    const savedJobs = await SavedJob.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Job,
        as: 'job',
        include: [{
          model: User,
          as: 'recruiter',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: RecruiterProfile,
            as: 'recruiterProfile',
            attributes: ['companyName', 'companyLogo', 'companySlug', 'industry', 'profilePicture']
          }]
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      savedJobs: savedJobs.map(sj => ({
        ...sj.job.toJSON(),
        savedAt: sj.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/jobs/check-saved
 * @desc    Check which jobs from a list are saved
 * @access  Private (Candidate)
 */
router.post('/check-saved', authMiddleware, async (req, res) => {
  try {
    const { jobIds } = req.body;
    
    if (!jobIds || !Array.isArray(jobIds)) {
      return res.status(400).json({ message: 'jobIds array is required' });
    }

    const savedJobs = await SavedJob.findAll({
      where: {
        userId: req.user.id,
        jobId: { [Op.in]: jobIds }
      },
      attributes: ['jobId']
    });

    const savedJobIds = savedJobs.map(sj => sj.jobId);
    res.json({ savedJobIds });
  } catch (error) {
    console.error('Error checking saved jobs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/jobs/my-applications
 * @desc    Get candidate's own applications
 * @access  Private (Candidate)
 */
router.get('/my-applications', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'candidate') {
      return res.status(403).json({ message: 'Only candidates can view their applications' });
    }
    
    const { status, page = 1, limit = 20 } = req.query;
    
    const where = { candidateId: req.user.id };
    if (status) {
      where.status = status;
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows: applications } = await JobApplication.findAndCountAll({
      where,
      include: [{
        model: Job,
        as: 'job',
        include: [{
          model: User,
          as: 'recruiter',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: RecruiterProfile,
            as: 'recruiterProfile',
            attributes: ['companyName', 'companyLogo']
          }]
        }]
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    res.json({
      applications,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching my applications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/jobs/:id/apply
 * @desc    Submit a job application
 * @access  Private (Candidate)
 */
router.post('/:id/apply', authMiddleware, resumeUpload.single('resume'), async (req, res) => {
  try {
    const jobId = req.params.id;
    
    // Only candidates can apply for jobs
    if (req.user.role !== 'candidate') {
      return res.status(403).json({ message: 'Only candidates can apply for jobs' });
    }
    
    // Check if job exists and is active
    const job = await Job.findByPk(jobId, {
      include: [{
        model: User,
        as: 'recruiter',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }]
    });
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (job.status !== 'active') {
      return res.status(400).json({ message: 'This job is no longer accepting applications' });
    }
    
    // Check application deadline
    if (job.applicationDeadline && new Date(job.applicationDeadline) < new Date()) {
      return res.status(400).json({ message: 'Application deadline has passed' });
    }
    
    // Check if already applied
    const existingApplication = await JobApplication.findOne({
      where: { jobId, candidateId: req.user.id }
    });
    
    if (existingApplication) {
      return res.status(400).json({ 
        message: 'You have already applied for this job',
        applicationId: existingApplication.id,
        status: existingApplication.status
      });
    }
    
    // Parse application data from form fields
    const { coverLetter, expectedSalary, availableStartDate, additionalInfo, answers } = req.body;
    
    // Build answers object
    const applicationAnswers = {
      coverLetter: coverLetter || '',
      expectedSalary: expectedSalary || '',
      availableStartDate: availableStartDate || '',
      additionalInfo: additionalInfo || ''
    };
    
    // Include custom question answers if provided
    if (answers) {
      try {
        const parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers;
        applicationAnswers.customAnswers = parsedAnswers;
      } catch (e) {
        console.error('Error parsing custom answers:', e);
      }
    }
    
    // Get resume URL from uploaded file
    const resumeUrl = req.file ? req.file.path : null;
    
    // Get candidate profile for AI matching
    const candidateProfile = await Profile.findOne({
      where: { userId: req.user.id }
    });
    
    // Create the job application
    const application = await JobApplication.create({
      jobId,
      candidateId: req.user.id,
      status: 'submitted',
      answers: applicationAnswers,
      resumeUrl,
      coverLetter: coverLetter || '',
      source: 'direct'
    });
    
    // Increment the job's application count
    await job.increment('applications');
    
    // Calculate AI match score asynchronously (don't block the response)
    if (candidateProfile) {
      aiService.calculateApplicationMatchScore(job, candidateProfile, applicationAnswers)
        .then(async (matchResult) => {
          if (matchResult && matchResult.score !== undefined) {
            await application.update({
              aiMatchScore: matchResult.score,
              aiAnalysis: matchResult.analysis || null
            });
            
            // Send new application notification to recruiter (after AI score is calculated)
            emailService.sendNewApplicationNotification(
              job.recruiter,
              req.user,
              job,
              { ...application.toJSON(), aiMatchScore: matchResult.score }
            ).catch(err => console.error('Error sending recruiter notification:', err));
            
            // Create in-app notification for recruiter
            notificationService.notifyApplicationReceived(job.userId, application, req.user, job)
              .catch(err => console.error('Error creating application notification:', err));
          }
        })
        .catch(err => {
          console.error('Error calculating AI match score:', err);
        });
    } else {
      // No profile, still notify recruiter
      emailService.sendNewApplicationNotification(
        job.recruiter,
        req.user,
        job,
        application
      ).catch(err => console.error('Error sending recruiter notification:', err));
      
      // Create in-app notification for recruiter
      notificationService.notifyApplicationReceived(job.userId, application, req.user, job)
        .catch(err => console.error('Error creating application notification:', err));
    }
    
    // Send confirmation email to candidate (don't block response)
    emailService.sendApplicationConfirmation(req.user, job)
      .catch(err => console.error('Error sending application confirmation:', err));
    
    console.log(`New application submitted: Job ${jobId}, Candidate ${req.user.id}, Application ${application.id}`);
    
    res.status(201).json({
      message: 'Application submitted successfully',
      application: {
        id: application.id,
        jobId: application.jobId,
        status: application.status,
        submittedAt: application.createdAt
      }
    });
  } catch (error) {
    console.error('Error submitting job application:', error);
    
    // Handle multer errors
    if (error.message === 'Only PDF and Word documents are allowed') {
      return res.status(400).json({ message: error.message });
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size exceeds 5MB limit' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/jobs/:id/applications
 * @desc    Get manual applications for a job (recruiter only)
 *          Only returns applications from candidates who applied directly
 *          AI-screened and agent arena matches are shown in shortlist instead
 * @access  Private (Recruiter)
 */
router.get('/:id/applications', requireRecruiterSurface, authMiddleware, async (req, res) => {
  try {
    const jobId = req.params.id;
    
    // Verify recruiter owns this job
    const job = await Job.findByPk(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (job.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view applications for this job' });
    }
    
    const { status, page = 1, limit = 20 } = req.query;
    
    // Only show manual applications (exclude AI-screened and agent arena)
    const where = { 
      jobId,
      [Op.or]: [
        { source: 'manual' },
        { source: 'direct' },
        { source: null },
        { source: '' }
      ]
    };
    if (status) {
      where.status = status;
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows: applications } = await JobApplication.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'candidate',
        attributes: ['id', 'firstName', 'lastName', 'email'],
        include: [{
          model: Profile,
          as: 'profile',
          attributes: ['headline', 'profilePicture', 'skills', 'experience', 'location']
        }]
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    res.json({
      applications,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching job applications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/jobs/:id/shortlist
 * @desc    Get shortlisted candidates (AI-screened + Agent Arena matches)
 * @access  Private (Recruiter)
 */
router.get('/:id/shortlist', authMiddleware, async (req, res) => {
  try {
    const jobId = req.params.id;
    
    // Verify recruiter owns this job
    const job = await Job.findByPk(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    if (job.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view shortlist for this job' });
    }
    
    const { page = 1, limit = 20 } = req.query;
    
    // Get shortlisted candidates from AI screening and agent arena
    const where = { 
      jobId,
      [Op.or]: [
        { source: 'ai_screening' },
        { source: 'agent_arena' }
      ],
      status: 'shortlisted'
    };
    
    const offset = (page - 1) * limit;
    
    const { count, rows: shortlisted } = await JobApplication.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'candidate',
        attributes: ['id', 'firstName', 'lastName', 'email'],
        include: [{
          model: Profile,
          as: 'profile',
          attributes: ['headline', 'profilePicture', 'skills', 'experience', 'location']
        }]
      }],
      order: [['aiMatchScore', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    // Format response with scores
    const formattedShortlist = shortlisted.map(app => ({
      id: app.id,
      candidateId: app.candidateId,
      candidate: app.candidate,
      matchScore: app.aiMatchScore,
      fitScore: app.aiAnalysis?.fitScore || 0,
      interestScore: app.aiAnalysis?.interestScore || 0,
      source: app.source,
      keyStrengths: app.aiAnalysis?.keyStrengths || [],
      concerns: app.aiAnalysis?.concerns || [],
      summary: app.aiAnalysis?.summary || app.aiAnalysis?.recruiterSummary || '',
      createdAt: app.createdAt
    }));
    
    res.json({
      shortlist: formattedShortlist,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching shortlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/jobs/applications/:applicationId/status
 * @desc    Update application status (shortlist, reject, etc.)
 * @access  Private (Recruiter - job owner only)
 */
router.put('/applications/:applicationId/status', authMiddleware, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, recruiterNotes } = req.body;
    
    // Validate status
    const validStatuses = [
      'submitted', 'under_review', 'screening', 'shortlisted',
      'interview_scheduled', 'interview_completed', 'offered',
      'accepted', 'rejected', 'withdrawn'
    ];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Valid statuses are: ' + validStatuses.join(', ')
      });
    }
    
    // Find the application with job and candidate
    const application = await JobApplication.findByPk(applicationId, {
      include: [
        {
          model: Job,
          as: 'job'
        },
        {
          model: User,
          as: 'candidate',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });
    
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    
    // Verify recruiter owns the job
    if (application.job.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this application' });
    }
    
    // Store old status for comparison
    const oldStatus = application.status;
    
    // Update the application
    const updateData = { 
      status,
      reviewedAt: new Date(),
      reviewedBy: req.user.id
    };
    
    if (recruiterNotes !== undefined) {
      updateData.recruiterNotes = recruiterNotes;
    }
    
    await application.update(updateData);
    
    // Send status update email to candidate (if status actually changed)
    if (oldStatus !== status && application.candidate) {
      const statusesToNotify = ['under_review', 'shortlisted', 'interview_scheduled', 'offered', 'rejected'];
      if (statusesToNotify.includes(status)) {
        emailService.sendApplicationStatusUpdate(
          application.candidate,
          application.job,
          status,
          recruiterNotes
        ).catch(err => console.error('Error sending status update email:', err));
        
        // Create in-app notification for candidate
        notificationService.notifyApplicationStatusChange(
          application.candidateId,
          application,
          application.job,
          status
        ).catch(err => console.error('Error creating status notification:', err));
      }
    }
    
    // Reload with full associations for response
    await application.reload({
      include: [{
        model: User,
        as: 'candidate',
        attributes: ['id', 'firstName', 'lastName', 'email'],
        include: [{
          model: Profile,
          as: 'profile',
          attributes: ['headline', 'profilePicture', 'skills', 'experience', 'location']
        }]
      }]
    });
    
    console.log(`Application ${applicationId} status updated to ${status} by recruiter ${req.user.id}`);
    
    res.json({
      message: 'Application status updated successfully',
      application
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/jobs/applications/:applicationId/withdraw
 * @desc    Withdraw a job application (candidate only)
 * @access  Private (Candidate - owner only)
 */
router.put('/applications/:applicationId/withdraw', authMiddleware, async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    // Find the application
    const application = await JobApplication.findByPk(applicationId, {
      include: [{
        model: Job,
        as: 'job',
        attributes: ['id', 'title', 'company']
      }]
    });
    
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    
    // Verify candidate owns this application
    if (application.candidateId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to withdraw this application' });
    }
    
    // Can only withdraw if status is pending-like (not already rejected, accepted, or withdrawn)
    const withdrawableStatuses = ['submitted', 'under_review', 'screening', 'shortlisted', 'interview_scheduled'];
    if (!withdrawableStatuses.includes(application.status)) {
      return res.status(400).json({ 
        message: `Cannot withdraw application with status: ${application.status}. Only pending applications can be withdrawn.`
      });
    }
    
    // Update status to withdrawn
    await application.update({
      status: 'withdrawn',
      withdrawnAt: new Date()
    });
    
    console.log(`Application ${applicationId} withdrawn by candidate ${req.user.id}`);
    
    res.json({
      message: 'Application withdrawn successfully',
      application
    });
  } catch (error) {
    console.error('Error withdrawing application:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/jobs/:id/save
 * @desc    Save a job
 * @access  Private (Candidate)
 */
router.post('/:id/save', authMiddleware, async (req, res) => {
  try {
    const jobId = req.params.id;
    
    // Check if job exists
    const job = await Job.findByPk(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if already saved
    const existingSave = await SavedJob.findOne({
      where: { userId: req.user.id, jobId }
    });

    if (existingSave) {
      return res.status(400).json({ message: 'Job already saved' });
    }

    // Save the job
    await SavedJob.create({
      userId: req.user.id,
      jobId
    });

    res.json({ message: 'Job saved successfully', saved: true });
  } catch (error) {
    console.error('Error saving job:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/jobs/:id/save
 * @desc    Unsave a job
 * @access  Private (Candidate)
 */
router.delete('/:id/save', authMiddleware, async (req, res) => {
  try {
    const jobId = req.params.id;
    
    const deleted = await SavedJob.destroy({
      where: { userId: req.user.id, jobId }
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Saved job not found' });
    }

    res.json({ message: 'Job unsaved successfully', saved: false });
  } catch (error) {
    console.error('Error unsaving job:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

