/**
 * Candidate Import Service
 * 
 * Handles bulk import of candidates from CSV files and other sources.
 * Includes CSV parsing, validation, duplicate detection, and async processing.
 * 
 * This service has been modularized into:
 * - ./candidateImport/validators.js: Email, URL, and data validation
 * - ./candidateImport/parsers.js: CSV parsing and normalization
 * - ./candidateImport/helpers.js: Duplicate detection and scoring
 */

const { parse } = require('csv-parse');
const { sequelize, User, Profile, CandidateImport, ImportedCandidate, Job, JobApplication } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { enrichFromLinkedInUrl, enrichFromEmail } = require('./linkedinEnrichmentService');

// Import modular components
const { validators: importValidators, parsers: importParsers, helpers: importHelpers } = require('./candidateImport');

// Required and optional CSV columns
const REQUIRED_COLUMNS = ['email'];
const OPTIONAL_COLUMNS = ['name', 'first_name', 'last_name', 'linkedin_url', 'phone', 'resume_url', 'title', 'company', 'location'];

/**
 * Validate email format
 */
function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

/**
 * Normalize column names (handle variations like "Email", "EMAIL", "e-mail", etc.)
 */
function normalizeColumnName(column) {
  const normalized = column.toLowerCase().trim().replace(/[-\s]/g, '_');
  
  // Map common variations
  const mappings = {
    'e_mail': 'email',
    'email_address': 'email',
    'linkedin': 'linkedin_url',
    'linkedin_profile': 'linkedin_url',
    'linkedin_profile_url': 'linkedin_url',
    'phone_number': 'phone',
    'mobile': 'phone',
    'mobile_phone': 'phone',
    'telephone': 'phone',
    'full_name': 'name',
    'candidate_name': 'name',
    'firstname': 'first_name',
    'lastname': 'last_name',
    'surname': 'last_name',
    'job_title': 'title',
    'current_title': 'title',
    'position': 'title',
    'current_company': 'company',
    'employer': 'company',
    'organization': 'company',
    'city': 'location',
    'resume': 'resume_url',
    'cv_url': 'resume_url',
    'cv': 'resume_url'
  };
  
  return mappings[normalized] || normalized;
}

/**
 * Parse name into first and last name
 */
function parseName(name) {
  if (!name) return { firstName: null, lastName: null };
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

/**
 * Parse CSV buffer and validate structure
 * Returns { rows, errors, columnMapping }
 */
async function parseCSV(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const errors = [];
    let headers = [];
    let columnMapping = {};
    
    const parser = parse({
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });
    
    let rowNumber = 0;
    
    parser.on('readable', function() {
      let record;
      while ((record = parser.read()) !== null) {
        rowNumber++;
        
        // First row is headers
        if (rowNumber === 1) {
          headers = record;
          
          // Create column mapping
          headers.forEach((header, index) => {
            const normalized = normalizeColumnName(header);
            columnMapping[normalized] = index;
          });
          
          // Check for required columns
          const missingRequired = REQUIRED_COLUMNS.filter(col => 
            columnMapping[col] === undefined
          );
          
          if (missingRequired.length > 0) {
            errors.push({
              row: 1,
              type: 'header',
              message: `Missing required columns: ${missingRequired.join(', ')}`
            });
          }
          
          continue;
        }
        
        // Parse data rows
        const rowData = {
          sourceRowNumber: rowNumber,
          raw: {}
        };
        
        // Map each column
        headers.forEach((header, index) => {
          const normalized = normalizeColumnName(header);
          rowData.raw[normalized] = record[index] || null;
        });
        
        // Extract key fields
        rowData.email = (rowData.raw.email || '').trim().toLowerCase();
        
        // Handle name parsing
        if (rowData.raw.first_name || rowData.raw.last_name) {
          rowData.firstName = rowData.raw.first_name || null;
          rowData.lastName = rowData.raw.last_name || null;
        } else if (rowData.raw.name) {
          const parsed = parseName(rowData.raw.name);
          rowData.firstName = parsed.firstName;
          rowData.lastName = parsed.lastName;
        }
        
        rowData.phone = rowData.raw.phone || null;
        rowData.linkedinUrl = rowData.raw.linkedin_url || null;
        rowData.resumeUrl = rowData.raw.resume_url || null;
        rowData.currentTitle = rowData.raw.title || null;
        rowData.currentCompany = rowData.raw.company || null;
        rowData.location = rowData.raw.location || null;
        
        // Validate email
        if (!rowData.email) {
          errors.push({
            row: rowNumber,
            type: 'validation',
            field: 'email',
            message: 'Email is required'
          });
          rowData.isValid = false;
          rowData.validationErrors = ['Email is required'];
        } else if (!isValidEmail(rowData.email)) {
          errors.push({
            row: rowNumber,
            type: 'validation',
            field: 'email',
            message: `Invalid email format: ${rowData.email}`
          });
          rowData.isValid = false;
          rowData.validationErrors = [`Invalid email format: ${rowData.email}`];
        } else {
          rowData.isValid = true;
          rowData.validationErrors = [];
        }
        
        rows.push(rowData);
      }
    });
    
    parser.on('error', function(err) {
      reject(err);
    });
    
    parser.on('end', function() {
      resolve({ rows, errors, columnMapping, headers });
    });
    
    // Write buffer to parser
    parser.write(buffer);
    parser.end();
  });
}

/**
 * Check for duplicate emails within the CSV
 */
function findInternalDuplicates(rows) {
  const emailCounts = {};
  const duplicates = [];
  
  rows.forEach((row, index) => {
    if (row.email) {
      if (emailCounts[row.email] !== undefined) {
        duplicates.push({
          row: row.sourceRowNumber,
          email: row.email,
          duplicateOf: emailCounts[row.email]
        });
      } else {
        emailCounts[row.email] = row.sourceRowNumber;
      }
    }
  });
  
  return duplicates;
}

/**
 * Create import batch and store candidates for async processing
 */
async function createImportBatch(recruiterId, jobId, fileName, rows, importType = 'csv') {
  const transaction = await sequelize.transaction();
  
  try {
    // Count valid/invalid rows
    const validRows = rows.filter(r => r.isValid);
    const invalidRows = rows.filter(r => !r.isValid);
    
    // Find internal duplicates
    const internalDuplicates = findInternalDuplicates(validRows);
    const duplicateEmails = new Set(internalDuplicates.map(d => d.email));
    
    // Create the import batch record
    const candidateImport = await CandidateImport.create({
      recruiterId,
      jobId: jobId || null,
      importType,
      fileName,
      totalCandidates: rows.length,
      processedCandidates: 0,
      successfulImports: 0,
      failedImports: invalidRows.length,
      duplicatesFound: 0, // Will be updated during processing
      status: 'pending',
      errorLog: invalidRows.map(r => ({
        row: r.sourceRowNumber,
        email: r.email,
        errors: r.validationErrors
      })),
      importOptions: {}
    }, { transaction });
    
    // Create imported candidate records
    const importedCandidates = [];
    
    for (const row of rows) {
      const isDuplicateInFile = duplicateEmails.has(row.email) && 
        internalDuplicates.some(d => d.email === row.email && d.row === row.sourceRowNumber);
      
      const candidate = await ImportedCandidate.create({
        importId: candidateImport.id,
        profileId: null,
        userId: null,
        sourceData: row.raw,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        linkedinUrl: row.linkedinUrl,
        resumeUrl: row.resumeUrl,
        currentTitle: row.currentTitle,
        currentCompany: row.currentCompany,
        location: row.location,
        enrichmentStatus: 'none',
        enrichedData: {},
        importStatus: !row.isValid ? 'invalid' : (isDuplicateInFile ? 'duplicate' : 'pending'),
        errorMessage: !row.isValid ? row.validationErrors.join('; ') : null,
        validationErrors: row.validationErrors || [],
        sourceRowNumber: row.sourceRowNumber
      }, { transaction });
      
      importedCandidates.push(candidate);
    }
    
    await transaction.commit();
    
    return {
      importId: candidateImport.id,
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      internalDuplicates: internalDuplicates.length,
      status: 'pending'
    };
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Process imported candidates asynchronously
 * This is the main background processing function
 */
async function processImportedCandidates(importId) {
  console.log(`[Import ${importId}] Starting background processing...`);
  
  // Get the import record to know the type
  const importRecord = await CandidateImport.findByPk(importId);
  if (!importRecord) {
    throw new Error(`Import ${importId} not found`);
  }
  
  const importType = importRecord.importType; // 'csv', 'linkedin', or 'email'
  
  // Update import status to processing
  await CandidateImport.update(
    { status: 'processing' },
    { where: { id: importId } }
  );
  
  try {
    // Get all pending candidates for this import
    const pendingCandidates = await ImportedCandidate.findAll({
      where: {
        importId,
        importStatus: 'pending'
      },
      order: [['sourceRowNumber', 'ASC']]
    });
    
    console.log(`[Import ${importId}] Processing ${pendingCandidates.length} pending candidates (type: ${importType})...`);
    
    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    let processedCount = 0;
    
    // Process each candidate
    for (const candidate of pendingCandidates) {
      const transaction = await sequelize.transaction();
      
      try {
        let candidateEmail = candidate.email;
        let candidateFirstName = candidate.firstName;
        let candidateLastName = candidate.lastName;
        let candidateTitle = candidate.currentTitle;
        let candidateCompany = candidate.currentCompany;
        let candidateLocation = candidate.location;
        let enrichedData = candidate.enrichedData || {};
        
        // For LinkedIn imports, try to enrich first to get email
        if (importType === 'linkedin' && candidate.linkedinUrl && !candidateEmail) {
          console.log(`[Import ${importId}] Enriching LinkedIn URL: ${candidate.linkedinUrl}`);
          
          const enrichResult = await enrichFromLinkedInUrl(candidate.linkedinUrl);
          
          if (enrichResult.success && enrichResult.data) {
            enrichedData = { ...enrichedData, ...enrichResult.data, source: enrichResult.source };
            candidateFirstName = enrichResult.data.firstName || candidateFirstName;
            candidateLastName = enrichResult.data.lastName || candidateLastName;
            candidateTitle = enrichResult.data.currentTitle || candidateTitle;
            candidateCompany = enrichResult.data.currentCompany || candidateCompany;
            candidateLocation = enrichResult.data.location || candidateLocation;
            // Note: LinkedIn enrichment typically doesn't provide email
            // but some services might
            
            await candidate.update({
              enrichmentStatus: enrichResult.enriched ? 'completed' : 'failed',
              enrichedData,
              firstName: candidateFirstName,
              lastName: candidateLastName,
              currentTitle: candidateTitle,
              currentCompany: candidateCompany,
              location: candidateLocation
            }, { transaction });
          } else {
            await candidate.update({
              enrichmentStatus: 'failed',
              enrichedData: { error: enrichResult.error }
            }, { transaction });
          }
        }
        
        // For email imports with enrichment enabled, enrich from email
        if (importType === 'email' && candidateEmail && importRecord.importOptions?.enrichData) {
          console.log(`[Import ${importId}] Enriching email: ${candidateEmail}`);
          
          const enrichResult = await enrichFromEmail(candidateEmail);
          
          if (enrichResult.success && enrichResult.data) {
            enrichedData = { ...enrichedData, ...enrichResult.data, source: enrichResult.source };
            candidateFirstName = enrichResult.data.firstName || candidateFirstName;
            candidateLastName = enrichResult.data.lastName || candidateLastName;
            candidateTitle = enrichResult.data.currentTitle || candidateTitle;
            candidateCompany = enrichResult.data.currentCompany || candidateCompany;
            candidateLocation = enrichResult.data.location || candidateLocation;
            
            // If we got a LinkedIn URL from enrichment, save it
            if (enrichResult.data.linkedinUrl && !candidate.linkedinUrl) {
              await candidate.update({ linkedinUrl: enrichResult.data.linkedinUrl }, { transaction });
            }
            
            await candidate.update({
              enrichmentStatus: enrichResult.enriched ? 'completed' : 'failed',
              enrichedData,
              firstName: candidateFirstName,
              lastName: candidateLastName,
              currentTitle: candidateTitle,
              currentCompany: candidateCompany,
              location: candidateLocation
            }, { transaction });
          }
        }
        
        // For LinkedIn imports without email, we can't create a user account
        // Instead, store as an imported candidate record only (no user/profile created)
        if (!candidateEmail && importType === 'linkedin') {
          // Store enriched data but mark as needing email
          await candidate.update({
            importStatus: 'success',
            errorMessage: 'Imported without user account (no email available). Candidate can be invited to join.',
            enrichedData
          }, { transaction });
          
          await transaction.commit();
          successCount++;
          processedCount++;
          
          console.log(`[Import ${importId}] LinkedIn candidate stored without user account (no email): ${candidate.linkedinUrl}`);
          
          // Update progress
          await CandidateImport.update({
            processedCandidates: sequelize.literal('"processedCandidates" + 1'),
            successfulImports: successCount,
            duplicatesFound: duplicateCount,
            failedImports: failedCount
          }, { where: { id: importId } });
          
          continue;
        }
        
        // If still no email, fail this candidate
        if (!candidateEmail) {
          await candidate.update({
            importStatus: 'failed',
            errorMessage: 'No email address available to create user account'
          }, { transaction });
          
          await transaction.commit();
          failedCount++;
          processedCount++;
          
          await CandidateImport.update({
            processedCandidates: sequelize.literal('"processedCandidates" + 1'),
            successfulImports: successCount,
            duplicatesFound: duplicateCount,
            failedImports: failedCount
          }, { where: { id: importId } });
          
          continue;
        }
        
        // Check if profile already exists by email
        const existingUser = await User.findOne({
          where: { email: candidateEmail },
          include: [{ model: Profile, as: 'profile' }],
          transaction
        });
        
        if (existingUser) {
          // Mark as duplicate and link to existing profile
          await candidate.update({
            importStatus: 'duplicate',
            profileId: existingUser.profile?.id || null,
            userId: existingUser.id,
            duplicateOfProfileId: existingUser.profile?.id || null,
            errorMessage: 'Candidate already exists in database'
          }, { transaction });
          
          duplicateCount++;
          console.log(`[Import ${importId}] Row ${candidate.sourceRowNumber}: Duplicate (${candidateEmail})`);
        } else {
          // Create new user and profile
          const newUser = await User.create({
            email: candidateEmail,
            firstName: candidateFirstName || 'Unknown',
            lastName: candidateLastName || 'Candidate',
            password: null, // Imported candidates have no password until they set one
            role: 'candidate',
            isActive: true
          }, { transaction });
          
          // Create profile with imported/enriched data
          const newProfile = await Profile.create({
            userId: newUser.id,
            title: candidateTitle || 'Imported Candidate',
            headline: candidateTitle ? `${candidateTitle} at ${candidateCompany || 'Company'}` : null,
            location: candidateLocation,
            phone: candidate.phone,
            linkedinUrl: candidate.linkedinUrl,
            summary: enrichedData.summary || null,
            skills: enrichedData.skills || {},
            experience: candidateCompany ? [{
              company: candidateCompany,
              title: candidateTitle || 'Unknown Role',
              current: true
            }] : (enrichedData.experience || []),
            education: enrichedData.education || [],
            projects: [],
            certifications: [],
            languages: [],
            availabilityStatus: 'open',
            isPublic: false, // Imported profiles are private by default
            profilePicture: enrichedData.profilePicture || null,
            // Import tracking fields
            importSource: importRecord.importType,
            importedAt: new Date(),
            importBatchId: importId
          }, { transaction });
          
          // Update imported candidate record
          await candidate.update({
            importStatus: 'success',
            profileId: newProfile.id,
            userId: newUser.id,
            errorMessage: null,
            enrichedData
          }, { transaction });
          
          successCount++;
          console.log(`[Import ${importId}] Row ${candidate.sourceRowNumber}: Success - Created profile for ${candidateEmail}`);
        }
        
        await transaction.commit();
        
      } catch (error) {
        await transaction.rollback();
        
        // Mark as failed
        await candidate.update({
          importStatus: 'failed',
          errorMessage: error.message
        });
        
        failedCount++;
        console.error(`[Import ${importId}] Row ${candidate.sourceRowNumber}: Failed - ${error.message}`);
      }
      
      // Update progress
      processedCount++;
      await CandidateImport.update({
        processedCandidates: sequelize.literal('"processedCandidates" + 1'),
        successfulImports: successCount,
        duplicatesFound: duplicateCount,
        failedImports: failedCount
      }, { where: { id: importId } });
    }
    
    // Count previously failed (invalid) candidates
    const invalidCount = await ImportedCandidate.count({
      where: { importId, importStatus: 'invalid' }
    });
    
    // Mark import as completed
    await CandidateImport.update({
      status: 'completed',
      completedAt: new Date(),
      successfulImports: successCount,
      duplicatesFound: duplicateCount,
      failedImports: failedCount + invalidCount
    }, { where: { id: importId } });
    
    console.log(`[Import ${importId}] Processing completed!`);
    console.log(`  - Success: ${successCount}`);
    console.log(`  - Duplicates: ${duplicateCount}`);
    console.log(`  - Failed: ${failedCount}`);
    console.log(`  - Invalid: ${invalidCount}`);
    
    return {
      importId,
      status: 'completed',
      successCount,
      duplicateCount,
      failedCount,
      invalidCount,
      totalProcessed: processedCount
    };
    
  } catch (error) {
    console.error(`[Import ${importId}] Processing failed:`, error);
    
    // Mark import as failed
    await CandidateImport.update({
      status: 'failed',
      errorLog: sequelize.literal(`"errorLog" || '${JSON.stringify([{ type: 'fatal', message: error.message }])}'::jsonb`)
    }, { where: { id: importId } });
    
    throw error;
  }
}

/**
 * Get import status and summary
 */
async function getImportStatus(importId) {
  const importRecord = await CandidateImport.findByPk(importId, {
    include: [{
      model: ImportedCandidate,
      as: 'candidates',
      attributes: ['id', 'email', 'firstName', 'lastName', 'importStatus', 'errorMessage', 'sourceRowNumber']
    }]
  });
  
  if (!importRecord) {
    return null;
  }
  
  // Group candidates by status
  const byStatus = {
    pending: [],
    success: [],
    duplicate: [],
    invalid: [],
    failed: []
  };
  
  importRecord.candidates.forEach(c => {
    if (byStatus[c.importStatus]) {
      byStatus[c.importStatus].push({
        row: c.sourceRowNumber,
        email: c.email,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || null,
        error: c.errorMessage
      });
    }
  });
  
  return {
    id: importRecord.id,
    status: importRecord.status,
    importType: importRecord.importType,
    fileName: importRecord.fileName,
    progress: {
      total: importRecord.totalCandidates,
      processed: importRecord.processedCandidates,
      percentage: importRecord.totalCandidates > 0 
        ? Math.round((importRecord.processedCandidates / importRecord.totalCandidates) * 100)
        : 0
    },
    summary: {
      successful: importRecord.successfulImports,
      duplicates: importRecord.duplicatesFound,
      failed: importRecord.failedImports
    },
    candidates: byStatus,
    createdAt: importRecord.createdAt,
    completedAt: importRecord.completedAt
  };
}

/**
 * Get import history for a recruiter
 */
async function getRecruiterImports(recruiterId, options = {}) {
  const { limit = 20, offset = 0 } = options;
  
  const imports = await CandidateImport.findAndCountAll({
    where: { recruiterId },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    attributes: [
      'id', 'importType', 'fileName', 'status',
      'totalCandidates', 'processedCandidates',
      'successfulImports', 'duplicatesFound', 'failedImports',
      'createdAt', 'completedAt'
    ]
  });
  
  return {
    imports: imports.rows,
    total: imports.count,
    limit,
    offset
  };
}

/**
 * Create import batch from LinkedIn URLs
 */
async function createLinkedInImportBatch(recruiterId, jobId, validUrls, invalidUrls = []) {
  const transaction = await sequelize.transaction();
  
  try {
    // Create the import batch record
    const candidateImport = await CandidateImport.create({
      recruiterId,
      jobId: jobId || null,
      importType: 'linkedin',
      fileName: null,
      totalCandidates: validUrls.length + invalidUrls.length,
      processedCandidates: 0,
      successfulImports: 0,
      failedImports: invalidUrls.length,
      duplicatesFound: 0,
      status: 'pending',
      errorLog: invalidUrls.map(item => ({
        url: item.url,
        error: item.error
      })),
      importOptions: { enrichData: true }
    }, { transaction });
    
    // Create imported candidate records for valid URLs
    for (const url of validUrls) {
      await ImportedCandidate.create({
        importId: candidateImport.id,
        profileId: null,
        userId: null,
        sourceData: { linkedinUrl: url },
        firstName: null,
        lastName: null,
        email: null,
        phone: null,
        linkedinUrl: url,
        resumeUrl: null,
        currentTitle: null,
        currentCompany: null,
        location: null,
        enrichmentStatus: 'pending',
        enrichedData: {},
        importStatus: 'pending',
        errorMessage: null,
        validationErrors: [],
        sourceRowNumber: null
      }, { transaction });
    }
    
    // Create records for invalid URLs (already failed)
    for (let i = 0; i < invalidUrls.length; i++) {
      await ImportedCandidate.create({
        importId: candidateImport.id,
        profileId: null,
        userId: null,
        sourceData: { linkedinUrl: invalidUrls[i].url },
        linkedinUrl: invalidUrls[i].url,
        enrichmentStatus: 'none',
        importStatus: 'invalid',
        errorMessage: invalidUrls[i].error,
        validationErrors: [invalidUrls[i].error]
      }, { transaction });
    }
    
    await transaction.commit();
    
    return {
      importId: candidateImport.id,
      totalUrls: validUrls.length + invalidUrls.length,
      validUrls: validUrls.length,
      invalidUrls: invalidUrls.length,
      status: 'pending'
    };
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Create import batch from email list
 */
async function createEmailImportBatch(recruiterId, jobId, validEmails, invalidEmails = [], options = {}) {
  const transaction = await sequelize.transaction();
  
  try {
    // Create the import batch record
    const candidateImport = await CandidateImport.create({
      recruiterId,
      jobId: jobId || null,
      importType: 'email',
      fileName: null,
      totalCandidates: validEmails.length + invalidEmails.length,
      processedCandidates: 0,
      successfulImports: 0,
      failedImports: invalidEmails.length,
      duplicatesFound: 0,
      status: 'pending',
      errorLog: invalidEmails.map(item => ({
        email: item.email,
        error: item.error
      })),
      importOptions: { enrichData: options.enrichData || false }
    }, { transaction });
    
    // Create imported candidate records for valid emails
    for (const email of validEmails) {
      await ImportedCandidate.create({
        importId: candidateImport.id,
        profileId: null,
        userId: null,
        sourceData: { email },
        firstName: null,
        lastName: null,
        email: email,
        phone: null,
        linkedinUrl: null,
        resumeUrl: null,
        currentTitle: null,
        currentCompany: null,
        location: null,
        enrichmentStatus: options.enrichData ? 'pending' : 'none',
        enrichedData: {},
        importStatus: 'pending',
        errorMessage: null,
        validationErrors: [],
        sourceRowNumber: null
      }, { transaction });
    }
    
    // Create records for invalid emails (already failed)
    for (let i = 0; i < invalidEmails.length; i++) {
      await ImportedCandidate.create({
        importId: candidateImport.id,
        profileId: null,
        userId: null,
        sourceData: { email: invalidEmails[i].email },
        email: invalidEmails[i].email,
        enrichmentStatus: 'none',
        importStatus: 'invalid',
        errorMessage: invalidEmails[i].error,
        validationErrors: [invalidEmails[i].error]
      }, { transaction });
    }
    
    await transaction.commit();
    
    return {
      importId: candidateImport.id,
      totalEmails: validEmails.length + invalidEmails.length,
      validEmails: validEmails.length,
      invalidEmails: invalidEmails.length,
      status: 'pending'
    };
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Screen all imported candidates for a job using AI
 */
async function screenImportedCandidates(importId, jobId, options = {}) {
  const { screeningMode = 'fast', createApplications = true } = options;
  
  console.log(`[Import Screening] Starting AI screening for import ${importId}, job ${jobId}`);
  
  try {
    // Get the job details
    const job = await Job.findByPk(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    
    // Get all successfully imported candidates with profiles
    const candidates = await ImportedCandidate.findAll({
      where: { importId, importStatus: 'success' },
      include: [{
        model: Profile,
        as: 'profile',
        required: true
      }]
    });
    
    console.log(`[Import Screening] Found ${candidates.length} candidates to screen`);
    
    // Try to load the recruitment service for AI screening
    let recruitmentService;
    try {
      recruitmentService = require('./recruitmentService');
    } catch (error) {
      console.log('[Import Screening] RecruitmentService not available, using basic screening');
      recruitmentService = null;
    }
    
    const results = [];
    let screened = 0;
    let applicationsCreated = 0;
    
    for (const candidate of candidates) {
      try {
        let screeningResult = null;
        
        // Use AI screening if available
        if (recruitmentService && typeof recruitmentService.screenCandidateFast === 'function') {
          screeningResult = await recruitmentService.screenCandidateFast(
            candidate.profile,
            job,
            screeningMode
          );
        } else {
          // Basic scoring without AI
          screeningResult = {
            score: calculateBasicScore(candidate.profile, job),
            summary: 'Basic matching score (AI screening not configured)',
            recommendation: 'review'
          };
        }
        
        // Create job application if requested
        if (createApplications) {
          const existingApplication = await JobApplication.findOne({
            where: { jobId, userId: candidate.userId }
          });
          
          if (!existingApplication) {
            await JobApplication.create({
              jobId,
              userId: candidate.userId,
              status: 'imported',
              aiScreeningScore: screeningResult.score,
              aiScreeningNotes: screeningResult.summary,
              source: 'bulk_import'
            });
            applicationsCreated++;
          }
        }
        
        results.push({
          candidateId: candidate.id,
          profileId: candidate.profileId,
          email: candidate.email,
          score: screeningResult.score,
          recommendation: screeningResult.recommendation
        });
        
        screened++;
        console.log(`[Import Screening] Screened ${screened}/${candidates.length}: ${candidate.email} - Score: ${screeningResult.score}`);
        
      } catch (error) {
        console.error(`[Import Screening] Error screening ${candidate.email}:`, error.message);
        results.push({
          candidateId: candidate.id,
          email: candidate.email,
          error: error.message
        });
      }
    }
    
    console.log(`[Import Screening] Completed! Screened: ${screened}, Applications created: ${applicationsCreated}`);
    
    return {
      importId,
      jobId,
      totalCandidates: candidates.length,
      screened,
      applicationsCreated,
      results
    };
    
  } catch (error) {
    console.error(`[Import Screening] Failed:`, error);
    throw error;
  }
}

/**
 * Basic scoring without AI (fallback)
 */
function calculateBasicScore(profile, job) {
  let score = 50; // Base score
  
  // Check for skill matches
  const profileSkills = Object.keys(profile.skills || {}).map(s => s.toLowerCase());
  const jobSkills = (job.skills || []).map(s => s.toLowerCase());
  
  const matchedSkills = profileSkills.filter(s => jobSkills.includes(s));
  score += matchedSkills.length * 5; // 5 points per matched skill
  
  // Check title similarity
  if (profile.title && job.title) {
    const profileTitle = profile.title.toLowerCase();
    const jobTitle = job.title.toLowerCase();
    
    if (profileTitle.includes(jobTitle) || jobTitle.includes(profileTitle)) {
      score += 15;
    }
  }
  
  // Check location match
  if (profile.location && job.location) {
    if (profile.location.toLowerCase().includes(job.location.toLowerCase()) ||
        job.location.toLowerCase().includes(profile.location.toLowerCase())) {
      score += 10;
    }
  }
  
  // Cap at 100
  return Math.min(score, 100);
}

module.exports = {
  parseCSV,
  createImportBatch,
  processImportedCandidates,
  getImportStatus,
  getRecruiterImports,
  isValidEmail,
  normalizeColumnName,
  // New exports
  createLinkedInImportBatch,
  createEmailImportBatch,
  screenImportedCandidates
};
