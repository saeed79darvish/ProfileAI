/**
 * Candidates Routes
 * 
 * Handles bulk candidate import and management for recruiters.
 * 
 * Routes:
 * - POST /api/candidates/import/csv - Upload CSV file for bulk import
 * - GET /api/candidates/import/:importId - Get import status
 * - GET /api/candidates/imports - Get recruiter's import history
 * - POST /api/candidates/import/:importId/process - Trigger processing
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { 
  parseCSV, 
  createImportBatch, 
  processImportedCandidates,
  getImportStatus,
  getRecruiterImports,
  createLinkedInImportBatch,
  createEmailImportBatch,
  screenImportedCandidates
} = require('../services/candidateImportService');
const { 
  isValidLinkedInUrl,
  enrichFromLinkedInUrl,
  enrichFromEmail
} = require('../services/linkedinEnrichmentService');
const { CandidateImport, ImportedCandidate } = require('../models');

// Import limits by subscription tier
const IMPORT_LIMITS = {
  free: 10,
  pro: 100,
  enterprise: 1000
};

// Configure multer for CSV uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV files
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

/**
 * @route   POST /api/candidates/import/csv
 * @desc    Upload and parse a CSV file for bulk candidate import
 * @access  Private (Recruiters only)
 */
router.post('/import/csv', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    // Check if user is a recruiter
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only recruiters can import candidates'
      });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No CSV file provided'
      });
    }
    
    const { jobId, autoProcess } = req.body;
    const fileName = req.file.originalname;
    
    console.log(`[CSV Import] Recruiter ${req.user.id} uploading ${fileName}`);
    
    // Parse the CSV
    const { rows, errors, columnMapping, headers } = await parseCSV(req.file.buffer);
    
    // Check for header errors
    const headerErrors = errors.filter(e => e.type === 'header');
    if (headerErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CSV format',
        details: headerErrors.map(e => e.message),
        expectedColumns: {
          required: ['email'],
          optional: ['name', 'first_name', 'last_name', 'linkedin_url', 'phone', 'resume_url', 'title', 'company', 'location']
        },
        detectedColumns: headers
      });
    }
    
    // Check if any rows were parsed
    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'CSV file is empty or contains only headers'
      });
    }
    
    // Check import limit based on subscription tier
    const limit = IMPORT_LIMITS[req.user.subscriptionTier] || IMPORT_LIMITS.free;
    if (rows.length > limit) {
      return res.status(400).json({
        success: false,
        error: `Import limit exceeded. Your ${req.user.subscriptionTier || 'free'} plan allows ${limit} candidates per import.`,
        limit,
        provided: rows.length,
        upgradeUrl: '/pricing'
      });
    }
    
    // Create import batch
    const importResult = await createImportBatch(
      req.user.id,
      jobId,
      fileName,
      rows,
      'csv'
    );
    
    console.log(`[CSV Import] Created import batch ${importResult.importId} with ${rows.length} rows`);
    
    // Optionally start processing immediately
    if (autoProcess === 'true' || autoProcess === true) {
      // Process asynchronously (don't await)
      setImmediate(() => {
        processImportedCandidates(importResult.importId)
          .catch(err => console.error(`[CSV Import] Background processing error:`, err));
      });
      
      return res.status(202).json({
        success: true,
        message: 'CSV uploaded and processing started',
        data: {
          importId: importResult.importId,
          fileName,
          status: 'processing',
          summary: {
            totalRows: importResult.totalRows,
            validRows: importResult.validRows,
            invalidRows: importResult.invalidRows,
            internalDuplicates: importResult.internalDuplicates
          },
          columnMapping
        }
      });
    }
    
    // Return import batch info for review before processing
    res.status(201).json({
      success: true,
      message: 'CSV uploaded successfully. Call process endpoint to start import.',
      data: {
        importId: importResult.importId,
        fileName,
        status: 'pending',
        summary: {
          totalRows: importResult.totalRows,
          validRows: importResult.validRows,
          invalidRows: importResult.invalidRows,
          internalDuplicates: importResult.internalDuplicates
        },
        columnMapping,
        validationErrors: errors.filter(e => e.type === 'validation').slice(0, 10) // First 10 errors
      }
    });
    
  } catch (error) {
    console.error('[CSV Import] Error:', error);
    
    // Handle multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process CSV file',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/candidates/import/:importId/process
 * @desc    Start processing a pending import batch
 * @access  Private (Recruiters only)
 */
router.post('/import/:importId/process', authMiddleware, async (req, res) => {
  try {
    const { importId } = req.params;
    
    // Get import and verify ownership
    const importRecord = await CandidateImport.findByPk(importId);
    
    if (!importRecord) {
      return res.status(404).json({
        success: false,
        error: 'Import not found'
      });
    }
    
    if (importRecord.recruiterId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to process this import'
      });
    }
    
    if (importRecord.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Import cannot be processed. Current status: ${importRecord.status}`
      });
    }
    
    // Start processing asynchronously
    setImmediate(() => {
      processImportedCandidates(importId)
        .catch(err => console.error(`[Import ${importId}] Processing error:`, err));
    });
    
    res.status(202).json({
      success: true,
      message: 'Processing started',
      data: {
        importId,
        status: 'processing'
      }
    });
    
  } catch (error) {
    console.error('[Import Process] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start processing',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/candidates/import/:importId
 * @desc    Get import status and details
 * @access  Private (Recruiters only)
 */
router.get('/import/:importId', authMiddleware, async (req, res) => {
  try {
    const { importId } = req.params;
    
    // Get import and verify ownership
    const importRecord = await CandidateImport.findByPk(importId);
    
    if (!importRecord) {
      return res.status(404).json({
        success: false,
        error: 'Import not found'
      });
    }
    
    if (importRecord.recruiterId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this import'
      });
    }
    
    const status = await getImportStatus(importId);
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('[Import Status] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get import status',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/candidates/imports
 * @desc    Get recruiter's import history
 * @access  Private (Recruiters only)
 */
router.get('/imports', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only recruiters can view import history'
      });
    }
    
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await getRecruiterImports(req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('[Import History] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get import history',
      details: error.message
    });
  }
});

/**
 * @route   DELETE /api/candidates/import/:importId
 * @desc    Cancel or delete an import
 * @access  Private (Recruiters only)
 */
router.delete('/import/:importId', authMiddleware, async (req, res) => {
  try {
    const { importId } = req.params;
    
    // Get import and verify ownership
    const importRecord = await CandidateImport.findByPk(importId);
    
    if (!importRecord) {
      return res.status(404).json({
        success: false,
        error: 'Import not found'
      });
    }
    
    if (importRecord.recruiterId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this import'
      });
    }
    
    // Only allow deletion of pending or failed imports
    if (!['pending', 'failed', 'cancelled'].includes(importRecord.status)) {
      // If processing, cancel it
      if (importRecord.status === 'processing') {
        await importRecord.update({ status: 'cancelled' });
        return res.json({
          success: true,
          message: 'Import cancelled'
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Cannot delete completed imports. Archive instead.'
      });
    }
    
    // Delete imported candidates first (due to FK)
    await ImportedCandidate.destroy({
      where: { importId }
    });
    
    // Delete the import record
    await importRecord.destroy();
    
    res.json({
      success: true,
      message: 'Import deleted successfully'
    });
    
  } catch (error) {
    console.error('[Import Delete] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete import',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/candidates/import/template
 * @desc    Download CSV template for candidate import
 * @access  Private (Recruiters only)
 */
router.get('/import/template', authMiddleware, (req, res) => {
  try {
    const csvContent = `email,first_name,last_name,phone,linkedin_url,title,company,location,resume_url
john.doe@example.com,John,Doe,+1-555-1234,https://linkedin.com/in/johndoe,Software Engineer,TechCorp,San Francisco CA,
jane.smith@example.com,Jane,Smith,+1-555-5678,https://linkedin.com/in/janesmith,Product Manager,StartupXYZ,New York NY,
bob.wilson@example.com,Bob,Wilson,+1-555-9999,https://linkedin.com/in/bobwilson,Data Scientist,DataCo,Austin TX,`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="candidate_import_template.csv"');
    res.send(csvContent);
    
  } catch (error) {
    console.error('[Template Download] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate template'
    });
  }
});

/**
 * @route   POST /api/candidates/import/linkedin
 * @desc    Import candidates from LinkedIn URLs
 * @access  Private (Recruiters only)
 */
router.post('/import/linkedin', authMiddleware, async (req, res) => {
  try {
    // Check if user is a recruiter
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only recruiters can import candidates'
      });
    }
    
    const { urls, jobId, autoProcess } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of LinkedIn URLs'
      });
    }
    
    // Check import limit
    const limit = IMPORT_LIMITS[req.user.subscriptionTier] || IMPORT_LIMITS.free;
    if (urls.length > limit) {
      return res.status(400).json({
        success: false,
        error: `Import limit exceeded. Your ${req.user.subscriptionTier || 'free'} plan allows ${limit} candidates per import.`,
        limit,
        provided: urls.length,
        upgradeUrl: '/pricing'
      });
    }
    
    // Validate and deduplicate URLs
    const validUrls = [];
    const invalidUrls = [];
    const seenUrls = new Set();
    
    for (const url of urls) {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) continue;
      
      if (seenUrls.has(trimmedUrl.toLowerCase())) {
        continue; // Skip duplicates
      }
      seenUrls.add(trimmedUrl.toLowerCase());
      
      if (isValidLinkedInUrl(trimmedUrl)) {
        validUrls.push(trimmedUrl);
      } else {
        invalidUrls.push({ url: trimmedUrl, error: 'Invalid LinkedIn URL format' });
      }
    }
    
    if (validUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid LinkedIn URLs provided',
        invalidUrls
      });
    }
    
    console.log(`[LinkedIn Import] Recruiter ${req.user.id} importing ${validUrls.length} URLs`);
    
    // Create import batch
    const importResult = await createLinkedInImportBatch(
      req.user.id,
      jobId,
      validUrls,
      invalidUrls
    );
    
    // Optionally start processing immediately
    if (autoProcess === 'true' || autoProcess === true) {
      setImmediate(() => {
        processImportedCandidates(importResult.importId)
          .catch(err => console.error(`[LinkedIn Import] Background processing error:`, err));
      });
      
      return res.status(202).json({
        success: true,
        message: 'LinkedIn URLs received and processing started',
        data: {
          importId: importResult.importId,
          status: 'processing',
          summary: {
            totalUrls: urls.length,
            validUrls: validUrls.length,
            invalidUrls: invalidUrls.length
          },
          invalidUrls: invalidUrls.slice(0, 10)
        }
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'LinkedIn URLs validated. Call process endpoint to start import.',
      data: {
        importId: importResult.importId,
        status: 'pending',
        summary: {
          totalUrls: urls.length,
          validUrls: validUrls.length,
          invalidUrls: invalidUrls.length
        },
        invalidUrls: invalidUrls.slice(0, 10)
      }
    });
    
  } catch (error) {
    console.error('[LinkedIn Import] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process LinkedIn URLs',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/candidates/import/emails
 * @desc    Import candidates from email list
 * @access  Private (Recruiters only)
 */
router.post('/import/emails', authMiddleware, async (req, res) => {
  try {
    // Check if user is a recruiter
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only recruiters can import candidates'
      });
    }
    
    const { emails, jobId, autoProcess, enrichData } = req.body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of email addresses'
      });
    }
    
    // Check import limit
    const limit = IMPORT_LIMITS[req.user.subscriptionTier] || IMPORT_LIMITS.free;
    if (emails.length > limit) {
      return res.status(400).json({
        success: false,
        error: `Import limit exceeded. Your ${req.user.subscriptionTier || 'free'} plan allows ${limit} candidates per import.`,
        limit,
        provided: emails.length,
        upgradeUrl: '/pricing'
      });
    }
    
    // Validate and deduplicate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = [];
    const invalidEmails = [];
    const seenEmails = new Set();
    
    for (const email of emails) {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) continue;
      
      if (seenEmails.has(trimmedEmail)) {
        continue; // Skip duplicates
      }
      seenEmails.add(trimmedEmail);
      
      if (emailRegex.test(trimmedEmail)) {
        validEmails.push(trimmedEmail);
      } else {
        invalidEmails.push({ email: trimmedEmail, error: 'Invalid email format' });
      }
    }
    
    if (validEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid email addresses provided',
        invalidEmails
      });
    }
    
    console.log(`[Email Import] Recruiter ${req.user.id} importing ${validEmails.length} emails`);
    
    // Create import batch
    const importResult = await createEmailImportBatch(
      req.user.id,
      jobId,
      validEmails,
      invalidEmails,
      { enrichData: enrichData === true || enrichData === 'true' }
    );
    
    // Optionally start processing immediately
    if (autoProcess === 'true' || autoProcess === true) {
      setImmediate(() => {
        processImportedCandidates(importResult.importId)
          .catch(err => console.error(`[Email Import] Background processing error:`, err));
      });
      
      return res.status(202).json({
        success: true,
        message: 'Emails received and processing started',
        data: {
          importId: importResult.importId,
          status: 'processing',
          summary: {
            totalEmails: emails.length,
            validEmails: validEmails.length,
            invalidEmails: invalidEmails.length
          },
          invalidEmails: invalidEmails.slice(0, 10)
        }
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Emails validated. Call process endpoint to start import.',
      data: {
        importId: importResult.importId,
        status: 'pending',
        summary: {
          totalEmails: emails.length,
          validEmails: validEmails.length,
          invalidEmails: invalidEmails.length
        },
        invalidEmails: invalidEmails.slice(0, 10)
      }
    });
    
  } catch (error) {
    console.error('[Email Import] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process email list',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/candidates/import/:importId/screen
 * @desc    Trigger AI screening on all imported candidates
 * @access  Private (Recruiters only)
 */
router.post('/import/:importId/screen', authMiddleware, async (req, res) => {
  try {
    const { importId } = req.params;
    const { screeningMode = 'fast', createApplications = true } = req.body;
    
    // Get import and verify ownership
    const importRecord = await CandidateImport.findByPk(importId);
    
    if (!importRecord) {
      return res.status(404).json({
        success: false,
        error: 'Import not found'
      });
    }
    
    if (importRecord.recruiterId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to screen this import'
      });
    }
    
    if (importRecord.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: `Import must be completed before screening. Current status: ${importRecord.status}`
      });
    }
    
    if (!importRecord.jobId) {
      return res.status(400).json({
        success: false,
        error: 'This import is not linked to a job. Cannot perform screening without a job.'
      });
    }
    
    // Count successful imports
    const successfulCount = await ImportedCandidate.count({
      where: { importId, importStatus: 'success' }
    });
    
    if (successfulCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'No successfully imported candidates to screen'
      });
    }
    
    console.log(`[Import Screening] Starting screening for ${successfulCount} candidates from import ${importId}`);
    
    // Start screening asynchronously
    setImmediate(() => {
      screenImportedCandidates(importId, importRecord.jobId, {
        screeningMode,
        createApplications
      }).catch(err => console.error(`[Import Screening] Error:`, err));
    });
    
    res.status(202).json({
      success: true,
      message: 'AI screening started',
      data: {
        importId,
        jobId: importRecord.jobId,
        candidatesToScreen: successfulCount,
        screeningMode
      }
    });
    
  } catch (error) {
    console.error('[Import Screening] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start screening',
      details: error.message
    });
  }
});

module.exports = router;