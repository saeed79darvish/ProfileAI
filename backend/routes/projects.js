const express = require('express');
const router = express.Router();
const { Project, User, RecruiterProfile, Profile } = require('../models');
const auth = require('../middleware/auth');
const aiService = require('../services/aiService');
const paymentService = require('../services/paymentService');
const { Op } = require('sequelize');

// Get all projects (public)
router.get('/', async (req, res) => {
  try {
    const { 
      search = '', 
      employmentType, 
      workMode, 
      experienceLevel,
      limit = 20, 
      offset = 0 
    } = req.query;

    const where = {
      status: 'active',
      isPublic: true
    };

    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (employmentType) where.employmentType = employmentType;
    if (workMode) where.workMode = workMode;
    if (experienceLevel) where.experienceLevel = experienceLevel;

    const { count, rows: projects } = await Project.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [{
        model: User,
        as: 'recruiter',
        attributes: ['id', 'firstName', 'lastName'],
        include: [{
          model: RecruiterProfile,
          as: 'recruiterProfile',
          attributes: ['companyName', 'companyLogo', 'industry']
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ total: count, projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get my projects (recruiter only)
router.get('/my-projects', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (user.role !== 'recruiter' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Recruiter role required.' });
    }

    const projects = await Project.findAll({
      where: { recruiterId: req.userId },
      order: [['createdAt', 'DESC']]
    });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching my projects:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id },
      include: [{
        model: User,
        as: 'recruiter',
        attributes: ['id', 'firstName', 'lastName'],
        include: [{
          model: RecruiterProfile,
          as: 'recruiterProfile'
        }]
      }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Increment view count
    project.analytics.views += 1;
    await project.save();

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create project with AI auto-matching
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (user.role !== 'recruiter' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Recruiter role required.' });
    }

    // Check subscription limits
    const hasFeature = await paymentService.hasFeatureAccess(req.userId, 'activeProjects');
    if (!hasFeature) {
      return res.status(403).json({ 
        error: 'Upgrade required',
        message: 'Please upgrade your plan to create more projects.'
      });
    }

    // Create project
    const project = await Project.create({
      ...req.body,
      recruiterId: req.userId
    });

    // Auto-match candidates if premium feature
    const hasAutoMatch = await paymentService.hasFeatureAccess(req.userId, 'autoSourcing');
    if (hasAutoMatch) {
      try {
        // Check AI credits
        const credits = await paymentService.checkAICredits(req.userId);
        if (credits.available > 0 || credits.available === -1) {
          // Get all candidate profiles
          const candidates = await Profile.findAll({
            where: { isPublic: true },
            include: [{ 
              model: User, 
              as: 'user',
              attributes: ['firstName', 'lastName', 'email']
            }],
            limit: 50 // Match top 50
          });

          const matches = await aiService.autoMatchCandidatesForProject(
            project.toJSON(),
            candidates.map(c => c.toJSON()),
            10
          );

          project.aiMatchedCandidates = matches;
          await project.save();

          // Use AI credit
          if (credits.available !== -1) {
            await paymentService.useAICredit(req.userId);
          }
        }
      } catch (aiError) {
        console.error('AI matching failed:', aiError);
        // Don't fail the request, just skip AI matching
      }
    }

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update project
router.put('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id, recruiterId: req.userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    await project.update(req.body);
    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete project
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id, recruiterId: req.userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    await project.destroy();
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate job description (AI Premium Feature)
router.post('/ai/generate-description', auth, async (req, res) => {
  try {
    const credits = await paymentService.checkAICredits(req.userId);
    if (credits.available === 0) {
      return res.status(403).json({ 
        error: 'AI credits exhausted',
        message: 'Please upgrade your plan for more AI credits.'
      });
    }

    const description = await aiService.generateJobDescription(req.body);
    
    if (credits.available !== -1) {
      await paymentService.useAICredit(req.userId);
    }

    res.json({ description, creditsRemaining: credits.available - 1 });
  } catch (error) {
    console.error('Error generating job description:', error);
    res.status(500).json({ error: 'Failed to generate description' });
  }
});

// Suggest skills for role (AI Premium Feature)
router.post('/ai/suggest-skills', auth, async (req, res) => {
  try {
    const { jobTitle, industry } = req.body;
    
    const credits = await paymentService.checkAICredits(req.userId);
    if (credits.available === 0) {
      return res.status(403).json({ 
        error: 'AI credits exhausted',
        message: 'Please upgrade your plan for more AI credits.'
      });
    }

    const skills = await aiService.suggestSkillsForRole(jobTitle, industry);
    
    if (credits.available !== -1) {
      await paymentService.useAICredit(req.userId);
    }

    res.json({ skills, creditsRemaining: credits.available - 1 });
  } catch (error) {
    console.error('Error suggesting skills:', error);
    res.status(500).json({ error: 'Failed to suggest skills' });
  }
});

// Generate screening questions (AI Premium Feature)
router.post('/:id/ai/screening-questions', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id, recruiterId: req.userId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const credits = await paymentService.checkAICredits(req.userId);
    if (credits.available === 0) {
      return res.status(403).json({ 
        error: 'AI credits exhausted'
      });
    }

    const questions = await aiService.generateScreeningQuestions(
      project.toJSON(),
      req.body.numberOfQuestions || 5
    );
    
    if (credits.available !== -1) {
      await paymentService.useAICredit(req.userId);
    }

    res.json({ questions, creditsRemaining: credits.available - 1 });
  } catch (error) {
    console.error('Error generating screening questions:', error);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

module.exports = router;
