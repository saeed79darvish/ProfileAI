/**
 * Recruitment Service
 * 
 * Main service class for AI-powered recruitment automation.
 * Modular utilities are available in ./recruitment/ folder.
 * 
 * Structure:
 * - ./recruitment/helpers.js  - Utility functions
 * - ./recruitment/scoring.js  - Scoring algorithms
 */
const { Job, User, Profile, AgentNegotiation, JobScreening, JobApplication, ImportedCandidate, Conversation, Message } = require('../models');
const agentArenaService = require('./agentArenaService');
const aiService = require('./aiService');
const emailService = require('./emailService');
const featureFlags = require('../config/featureFlags');
const { aiSkillsMatching } = require('./aiSkillsMatchingService');
const { embeddingService } = require('./embeddingService');
const { createConcurrencyLimiter } = require('../utils/aiUtils');
const { Op, literal, fn, col } = require('sequelize');
const sequelize = require('../config/database');

// Import modular utilities
const { helpers: recruitmentHelpers, scoring: recruitmentScoring } = require('./recruitment');

class RecruitmentService {
  
  /**
   * Start the automated recruitment drive for a job
   * 
   * WORKFLOW:
   * 1. SEARCHING Phase - Smart search filters candidates based on criteria
   * 2. MANUAL SELECTION - Recruiter selects which candidates to screen (if searchOnly=true)
   * 3. SCREENING Phase - AI agents interview selected candidates
   * 4. SHORTLISTING - Top candidates are selected and notified
   * 
   * @param {number} jobId - The job ID to start recruitment for
   * @param {Object} config - Optional configuration for the screening
   * @param {boolean} searchOnly - If true, stop after Smart Search for manual selection
   */
  /**
   * Check if a screening is already actively running for a job.
   * Prevents double-click / duplicate drive launches.
   */
  async _checkIdempotency(jobId) {
    const existing = await JobScreening.findOne({ where: { jobId } });
    if (existing && ['searching', 'screening'].includes(existing.status)) {
      const age = Date.now() - new Date(existing.startedAt).getTime();
      const STALE_THRESHOLD = 30 * 60 * 1000; // 30 min
      if (age < STALE_THRESHOLD) {
        throw new Error(`A screening is already in progress for this job (status: ${existing.status}). Wait for it to finish or cancel it first.`);
      }
      // Stale screening — allow restart
      console.warn(`Stale screening detected (${Math.round(age / 60000)}m old). Allowing restart.`);
    }
    return existing;
  }

  /**
   * Check cancellation flag on the screening record.
   * Call between long phases to allow early exit.
   */
  async _isCancelled(screening) {
    await screening.reload();
    return screening.status === 'failed' && screening.errorMessage === 'Cancelled by user';
  }

  async startRecruitmentDrive(jobId, config = {}, searchOnly = false) {
    console.log(`Starting recruitment drive for Job ${jobId}`, config);

    // Idempotency: prevent duplicate concurrent drives
    await this._checkIdempotency(jobId);
    
    // Default configuration
    const screeningConfig = {
      minMatchScore: config.minMatchScore || 60,
      enforceMinScore: config.enforceMinScore || false, // When true, only candidates above minMatchScore proceed
      candidatesToScreen: config.candidatesToScreen || 25, // Percentage (1-100) of candidates to screen
      maxShortlisted: config.maxShortlisted || 10, // Max candidates to shortlist
      includePassiveCandidates: config.includePassiveCandidates !== false,
      enablePhoneScreening: config.enablePhoneScreening !== false,
      phoneScreeningDuration: config.phoneScreeningDuration || 15,
      enableEmailOutreach: config.enableEmailOutreach !== false,
      useAgentArena: featureFlags.recruiterAgentArena && config.useAgentArena !== false, // Gated by ENABLE_RECRUITER_AGENT_ARENA
      screeningStyle: config.screeningStyle || 'balanced',
      priorityFactors: config.priorityFactors || ['skills', 'experience'],
      autoScheduleInterviews: config.autoScheduleInterviews !== false,
      sendRejectionEmails: config.sendRejectionEmails || false,
      customInstructions: config.customInstructions || ''
    };
    
    // Create or update screening record
    let screening = await JobScreening.findOne({ where: { jobId } });
    if (!screening) {
      screening = await JobScreening.create({
        jobId,
        status: 'pending',
        startedAt: new Date(),
        screeningConfig: screeningConfig
      });
    } else {
      await screening.update({
        status: 'pending',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
        candidatesFound: 0,
        candidatesScreened: 0,
        totalCandidatesEvaluated: 0,
        shortlisted: [],
        progressPercent: 0,
        currentPhase: null,
        searchCriteria: null,
        searchStartedAt: null,
        searchCompletedAt: null,
        screeningConfig: screeningConfig
      });
    }
    
    try {
      const job = await Job.findByPk(jobId, {
        include: [{ model: User, as: 'recruiter' }]
      });
      
      if (!job) {
        await screening.update({ status: 'failed', errorMessage: 'Job not found' });
        throw new Error('Job not found');
      }

      // ========================================
      // PHASE 1: SMART SEARCH
      // Find and filter candidates BEFORE AI screening begins
      // ========================================
      await screening.update({ 
        status: 'searching',
        currentPhase: 'search',
        currentStep: 'Initializing smart search...',
        progressPercent: 5,
        searchStartedAt: new Date(),
        searchCriteria: {
          skills: job.skills || [],
          experienceLevel: job.experienceLevel,
          location: job.location,
          title: job.title
        }
      });
      
      // Ensure frontend can catch the 'searching' status
      await this.delay(500);

      // Run smart search to find top candidates
      const { candidates, totalEvaluated, searchMetrics } = await this.runSmartSearch(job, screening, screeningConfig);
      
      console.log(`Smart Search Complete: Evaluated ${totalEvaluated}, Found ${candidates.length} qualified candidates`);
      
      // Format search results for frontend display
      const searchResults = candidates.map(profile => {
        // Extract skills from various formats (flat array, categorized object, etc.)
        let skillsList = [];
        if (profile.skills) {
          if (Array.isArray(profile.skills)) {
            skillsList = profile.skills.map(s => typeof s === 'string' ? s : s.name || '').filter(Boolean);
          } else if (typeof profile.skills === 'object') {
            Object.values(profile.skills).forEach(cat => {
              if (Array.isArray(cat)) {
                cat.forEach(s => {
                  const name = typeof s === 'string' ? s : s.name || '';
                  if (name) skillsList.push(name);
                });
              }
            });
          }
        }

        return {
          candidateId: profile.userId,
          name: profile.user ? `${profile.user.firstName} ${profile.user.lastName}` : 'Unknown',
          email: profile.user?.email,
          title: profile.title || profile.headline,
          location: profile.location,
          score: profile.smartSearchScore || 0,
          breakdown: profile.smartSearchBreakdown || {},
          profilePicture: profile.profilePicture,
          skills: skillsList.slice(0, 10),
          experience: profile.experience?.length || 0
        };
      });
      
      await screening.update({ 
        searchCompletedAt: new Date(),
        candidatesFound: candidates.length,
        totalCandidatesEvaluated: totalEvaluated,
        searchResults: searchResults,
        currentStep: `Smart search complete. Found ${candidates.length} qualified candidates.`,
        progressPercent: 30
      });
      
      // If searchOnly mode, stop here for manual candidate selection
      if (searchOnly) {
        await screening.update({
          status: 'search_complete',
          currentPhase: 'selection',
          currentStep: `Waiting for recruiter to select candidates from ${candidates.length} matches`,
          progressPercent: 35
        });
        console.log('Search-only mode: Stopping for manual candidate selection');
        return { searchResults, totalEvaluated };
      }
      
      // Brief pause before transitioning to screening
      await this.delay(500);

      // Check cancellation before moving to screening phase
      if (await this._isCancelled(screening)) {
        console.log('Recruitment drive cancelled by user before screening phase');
        return [];
      }

      // Check if we have candidates to screen
      if (candidates.length === 0) {
        await screening.update({
          status: 'completed',
          currentPhase: null,
          currentStep: 'No matching candidates found.',
          progressPercent: 100,
          completedAt: new Date(),
          shortlisted: []
        });
        return [];
      }

      // ========================================
      // PHASE 2: AI SCREENING
      // Only begins AFTER smart search is complete
      // ========================================
      await screening.update({ 
        status: 'screening',
        currentPhase: 'screening',
        currentStep: `Starting AI screening for ${candidates.length} candidates...`,
        progressPercent: 35
      });

      // Separate platform candidates from guest candidates
      // Guest candidates (no user account) can't go through Agent Arena
      const platformCandidates = candidates.filter(c => !c._isGuestCandidate);
      const guestCandidates = candidates.filter(c => c._isGuestCandidate);
      
      if (guestCandidates.length > 0) {
        console.log(`Separating ${guestCandidates.length} guest candidates (Smart Search score only, no Agent Arena)`);
      }

      // Screen platform candidates - choose method based on config
      const useAgentArena = screeningConfig.useAgentArena === true;
      let screeningResults;
      
      if (platformCandidates.length > 0) {
        if (useAgentArena) {
          console.log('Using Agent Arena screening (creates visible negotiations)...');
          screeningResults = await this.screenCandidatesWithAgentArena(job, platformCandidates, screening);
        } else {
          console.log('Using fast AI screening (background processing)...');
          screeningResults = await this.screenCandidates(job, platformCandidates, screening);
        }
      } else {
        screeningResults = [];
      }

      // Add guest candidates to results (scored by Smart Search only)
      if (guestCandidates.length > 0) {
        const guestResults = guestCandidates.map(candidate => ({
          candidateId: candidate._guestApplicationId,
          candidateName: `${candidate.user?.firstName || ''} ${candidate.user?.lastName || ''}`.trim(),
          candidateProfile: candidate,
          smartSearchScore: candidate.smartSearchScore || 0,
          smartSearchRank: candidate.smartSearchRank || 0,
          screeningScore: candidate.smartSearchScore || 0, // Use Smart Search score for ranking
          fitScore: candidate.smartSearchScore || 0,
          decision: candidate.smartSearchScore >= 60 ? 'shortlist' : 'maybe',
          isGuestCandidate: true,
          guestApplicationId: candidate._guestApplicationId,
          trackingCode: candidate._guestTrackingCode,
          success: true
        }));
        screeningResults = [...screeningResults, ...guestResults];
        console.log(`Added ${guestResults.length} guest candidate results to screening output`);
      }
      
      // ========================================
      // PHASE 3: SHORTLISTING
      // ========================================
      
      // Check cancellation before shortlisting
      if (await this._isCancelled(screening)) {
        console.log('Recruitment drive cancelled by user before shortlisting phase');
        return [];
      }
      
      await screening.update({ 
        currentStep: 'Selecting top candidates...',
        progressPercent: 90
      });
      
      const shortlisted = await this.shortlistCandidates(screeningResults, screeningConfig.maxShortlisted);
      console.log(`Shortlisted ${shortlisted.length} candidates.`);

      // Format shortlisted data for storage
      const shortlistedData = await this.formatShortlistedCandidates(shortlisted);
      
      // Create JobApplication records for shortlisted candidates (unified pipeline)
      await this.createApplicationsForShortlisted(jobId, shortlistedData);
      
      // Update screening record with results
      await screening.update({
        status: 'completed',
        currentPhase: null,
        shortlisted: shortlistedData,
        completedAt: new Date(),
        currentStep: `Completed. Shortlisted ${shortlisted.length} candidates.`,
        progressPercent: 100
      });

      // Send Outreach (Email + In-App Message with Scheduling)
      await this.sendOutreach(shortlisted, job);
      
      return shortlisted;
    } catch (error) {
      console.error('Recruitment drive failed:', error);
      await screening.update({
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date()
      });
      throw error;
    }
  }

  /**
   * Run Smart Search to find and filter candidates
   * This MUST complete before AI screening begins
   * @param {Object} job - The job to search for
   * @param {Object} screening - The JobScreening record to update
   * @param {Object} config - Screening configuration with minMatchScore, candidatesToScreen, etc.
   */
  async runSmartSearch(job, screening, config = {}) {
    let jobSkills = job.skills || [];
    const experienceLevel = job.experienceLevel || 'mid';
    const location = job.location || null;
    const locationType = job.locationType || 'onsite'; // remote, hybrid, onsite
    
    // AUTO-INFER SKILLS: If job has no explicit skills, extract from title/description
    if (!jobSkills || jobSkills.length === 0) {
      jobSkills = this.inferSkillsFromJob(job);
      console.log(`[Smart Search] No explicit skills — inferred: ${jobSkills.join(', ')}`);
    }
    
    // Get config values with defaults
    const minMatchScore = config.minMatchScore || 50; // Raised from 20
    const candidatesToScreen = config.candidatesToScreen || 25;
    const includePassiveCandidates = config.includePassiveCandidates !== false;
    const priorityFactors = config.priorityFactors || ['skills', 'experience', 'availability'];
    
    console.log('=== RAG-POWERED SMART SEARCH ===');
    console.log(`Job: ${job.title} | Skills: ${jobSkills.join(', ')}`);
    console.log(`Config: minScore=${minMatchScore}, limit=${candidatesToScreen}`);
    
    await screening.update({
      currentStep: 'Analyzing job requirements...',
      progressPercent: 10
    });
    
    console.log(`Job skills: ${jobSkills.join(', ')}`);
    
    // Extract keywords from job for semantic matching
    const jobKeywords = this.extractKeywordsFromJob(job);
    
    // Build availability filter
    const availabilityStatuses = includePassiveCandidates 
      ? ['actively-looking', 'open', 'not-looking']
      : ['actively-looking', 'open'];
    const availabilityFilter = { [Op.in]: availabilityStatuses };

    await screening.update({
      currentStep: 'Searching candidate database with smart filters...',
      progressPercent: 15
    });

    // ═══════════════════════════════════════════════════════════════
    // RAG RETRIEVAL: Try pgvector semantic search first, fall back to SQL scan
    // ═══════════════════════════════════════════════════════════════
    let candidates;
    let usedVectorSearch = false;

    try {
      // Build query text from job for semantic embedding
      const queryText = embeddingService.buildJobQueryText(job);
      const queryEmbedding = await embeddingService.generateQueryEmbedding(queryText);

      if (queryEmbedding) {
        console.log('Using RAG vector search (pgvector cosine similarity)...');
        
        // Vector search: retrieve top candidates by semantic similarity
        const vectorResults = await embeddingService.searchSimilarProfiles(queryEmbedding, {
          limit: 200, // Retrieve more than we need, then score for precision
          location: locationType === 'remote' ? null : location, // Skip location filter for remote jobs
          availabilityStatuses,
          excludeUserId: job.userId
        });

        if (vectorResults.length > 0) {
          usedVectorSearch = true;
          console.log(`Vector search returned ${vectorResults.length} semantically similar candidates`);

          // Convert raw query results back to Profile-like objects with user data
          candidates = vectorResults.map(row => {
            const profile = Profile.build(row, { isNewRecord: false });
            // Attach user data as a virtual association
            profile.user = { 
              id: row.userId, 
              firstName: row.firstName, 
              lastName: row.lastName, 
              email: row.email 
            };
            profile.dataValues.user = profile.user;
            // Carry the vector similarity score for use in scoring
            profile._vectorSimilarity = row.similarity;
            return profile;
          });
        }
      }
    } catch (error) {
      console.warn('Vector search failed, falling back to SQL scan:', error.message);
    }

    // Fallback: standard SQL scan (when pgvector unavailable or no embeddings)
    if (!candidates || candidates.length === 0) {
      console.log('Using fallback SQL scan...');
      candidates = await Profile.findAll({
        where: {
          userId: { [Op.ne]: job.userId },
          isPublic: true,
          availabilityStatus: availabilityFilter
        },
        include: [{ 
          model: User, 
          as: 'user', 
          where: { role: 'candidate' },
          attributes: ['id', 'firstName', 'lastName', 'email']
        }],
        limit: 500
      });
    }

    const totalEvaluated = candidates.length;
    console.log(`Found ${totalEvaluated} eligible platform candidates (vector=${usedVectorSearch})`);

    // ═══════════════════════════════════════════════════════════════
    // GUEST CANDIDATES: Include guest screening submissions for this job
    // These are external candidates who submitted via guest screening
    // ═══════════════════════════════════════════════════════════════
    let guestCandidateProfiles = [];
    try {
      const guestApplications = await JobApplication.findAll({
        where: {
          jobId: job.id,
          source: 'guest_screening',
          importedCandidateId: { [Op.ne]: null },
          status: { [Op.in]: ['pending_screening', 'submitted'] }
        },
        include: [{
          model: ImportedCandidate,
          as: 'importedCandidate'
        }]
      });

      if (guestApplications.length > 0) {
        console.log(`Found ${guestApplications.length} guest screening submissions for this job`);

        // Convert guest applications to Profile-like objects for scoring
        guestCandidateProfiles = guestApplications.map(app => {
          const ic = app.importedCandidate;
          const parsed = app.parsedResumeData || {};
          const enriched = ic?.enrichedData || {};

          // Build a pseudo-Profile object that the scorer can work with
          const pseudoProfile = Profile.build({
            id: `guest_${app.id}`,
            userId: null,
            headline: parsed.currentTitle || ic?.currentTitle || '',
            title: parsed.currentTitle || ic?.currentTitle || '',
            summary: parsed.summary || enriched.summary || '',
            skills: parsed.skills || enriched.skills || [],
            experience: parsed.experience || enriched.experience || [],
            education: parsed.education || enriched.education || [],
            location: ic?.location || '',
            availabilityStatus: 'actively-looking',
            isPublic: true
          }, { isNewRecord: false });

          // Attach virtual user data
          pseudoProfile.user = {
            id: `guest_${app.id}`,
            firstName: ic?.firstName || app.guestName?.split(' ')[0] || '',
            lastName: ic?.lastName || app.guestName?.split(' ').slice(1).join(' ') || '',
            email: ic?.email || app.guestEmail || ''
          };
          pseudoProfile.dataValues.user = pseudoProfile.user;
          
          // Mark as guest candidate
          pseudoProfile._isGuestCandidate = true;
          pseudoProfile._guestApplicationId = app.id;
          pseudoProfile._guestTrackingCode = app.trackingCode;
          pseudoProfile._importedCandidateId = ic?.id;
          pseudoProfile._screeningAnswers = app.answers;

          return pseudoProfile;
        });

        // Merge guest candidates into the main pool
        candidates = [...candidates, ...guestCandidateProfiles];
        console.log(`Total candidates after including guests: ${candidates.length}`);
      }
    } catch (guestError) {
      console.warn('Failed to include guest candidates (non-fatal):', guestError.message);
    }

    const totalWithGuests = candidates.length;
    
    await screening.update({
      currentStep: `Scoring ${totalWithGuests} candidates with AI-powered matching...`,
      progressPercent: 20,
      totalCandidatesEvaluated: totalWithGuests
    });

    // Score candidates with AI-powered semantic skill matching
    // Use concurrency limiter to prevent rate limit cascades with large pools
    const limit = createConcurrencyLimiter(15); // Max 15 concurrent scoring operations
    const scoredCandidates = await Promise.all(
      candidates.map((profile) => limit(() => 
        this.calculateModernScoreAsync(profile, job, {
          jobSkills,
          jobKeywords,
          experienceLevel,
          location,
          locationType,
          priorityFactors,
          vectorSimilarity: profile._vectorSimilarity || null
        }).then(scoreResult => ({
          profile,
          ...scoreResult,
          isGuestCandidate: profile._isGuestCandidate || false,
          guestApplicationId: profile._guestApplicationId || null
        }))
      ))
    );

    // Log all scores for debugging
    console.log('=== CANDIDATE SCORES (Top 10) ===');
    const sortedForLog = [...scoredCandidates].sort((a, b) => b.totalScore - a.totalScore);
    sortedForLog.slice(0, 10).forEach((s, i) => {
      const name = s.profile.user ? `${s.profile.user.firstName} ${s.profile.user.lastName}` : `Profile ${s.profile.id}`;
      const title = s.profile.title || s.profile.headline || '(no title)';
      console.log(`${i+1}. ${name} (${title}): ${s.totalScore}/100 | Skills: ${s.breakdown?.skills || 0}, Title: ${s.breakdown?.titleMatch || 0}, Exp: ${s.breakdown?.experience || 0}`);
    });

    await screening.update({
      currentStep: 'Ranking candidates by match quality...',
      progressPercent: 25
    });

    // Sort ALL candidates by score (highest first) - this ensures we always return the top-ranked candidates
    const sortedCandidates = scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

    // PERCENTAGE-BASED SELECTION: candidatesToScreen is treated as a percentage (1-100)
    // E.g., if candidatesToScreen = 2, return top 2% of all candidates
    // Minimum of 1 candidate, maximum of all candidates
    const percentageValue = Math.max(1, Math.min(100, candidatesToScreen));
    const calculatedCount = Math.max(1, Math.ceil(totalWithGuests * (percentageValue / 100)));
    
    console.log('=== PERCENTAGE-BASED SELECTION ===');
    console.log('Total candidates:', totalWithGuests, `(${totalEvaluated} platform + ${guestCandidateProfiles.length} guest)`);
    console.log('Percentage requested:', percentageValue + '%');
    console.log('Calculated top candidates:', calculatedCount, '(top ' + percentageValue + '% of ' + totalWithGuests + ')');

    // Take top N candidates based on percentage calculation
    const qualifiedCandidates = sortedCandidates.slice(0, calculatedCount);

    const passedThreshold = scoredCandidates.filter(s => s.totalScore >= minMatchScore).length;
    const belowThreshold = qualifiedCandidates.filter(s => s.totalScore < minMatchScore);
    
    // Enforce minimum score threshold if configured
    if (config.enforceMinScore && belowThreshold.length > 0) {
      const beforeCount = qualifiedCandidates.length;
      qualifiedCandidates = qualifiedCandidates.filter(s => s.totalScore >= minMatchScore);
      console.log(`[enforceMinScore] Filtered ${beforeCount - qualifiedCandidates.length} candidates below score ${minMatchScore}`);
    } else if (belowThreshold.length > 0) {
      console.log(`⚠️ ${belowThreshold.length} of ${qualifiedCandidates.length} selected candidates are below minimum score ${minMatchScore} (not enforced)`);
    }
    
    console.log(`Selected: top ${qualifiedCandidates.length} candidates (${passedThreshold} total above threshold)`);
    console.log('=== TOP SELECTED CANDIDATES ===');
    qualifiedCandidates.forEach((c, i) => {
      const name = c.profile.user ? `${c.profile.user.firstName} ${c.profile.user.lastName}` : `Profile ${c.profile.id}`;
      console.log(`  ${i + 1}. ${name}: ${c.totalScore}/100`);
    });

    await screening.update({
      currentStep: `Smart Search complete: Top ${percentageValue}% = ${qualifiedCandidates.length} candidates from ${totalWithGuests} evaluated`,
      progressPercent: 28
    });

    // IMPORTANT: Attach smart search scores directly to profile objects
    // This ensures scores are preserved through the screening pipeline
    const candidatesWithScores = qualifiedCandidates.map(scored => {
      const profileWithScore = scored.profile;
      profileWithScore.smartSearchScore = scored.totalScore;
      profileWithScore.smartSearchBreakdown = scored.breakdown;
      profileWithScore.smartSearchRank = qualifiedCandidates.indexOf(scored) + 1;
      return profileWithScore;
    });

    return {
      candidates: candidatesWithScores, // Profiles with scores attached
      scoredResults: qualifiedCandidates, // Full scored results for reference
      totalEvaluated: totalWithGuests,
      guestCandidatesIncluded: guestCandidateProfiles.length,
      percentageUsed: percentageValue,
      searchMetrics: {
        totalScanned: totalWithGuests,
        platformCandidates: totalEvaluated,
        guestCandidates: guestCandidateProfiles.length,
        passedThreshold,
        topSelected: qualifiedCandidates.length,
        percentageRequested: percentageValue,
        averageScore: qualifiedCandidates.length > 0 
          ? Math.round(qualifiedCandidates.reduce((sum, c) => sum + c.totalScore, 0) / qualifiedCandidates.length)
          : 0
      }
    };
  }

  /**
   * AI-Powered scoring algorithm using semantic embeddings
   * Works for ANY industry - tech, healthcare, finance, creative, etc.
   * No hardcoded mappings - understands semantic relationships
   * When RAG vector search is used, incorporates vector similarity as a boost
   */
  async calculateModernScoreAsync(profile, job, options = {}) {
    const {
      jobSkills = [],
      jobKeywords = [],
      experienceLevel = 'mid',
      location = null,
      locationType = 'onsite',
      priorityFactors = ['skills', 'experience', 'availability'],
      vectorSimilarity = null // From pgvector RAG search (0-1)
    } = options;

    const breakdown = {
      skills: 0,
      experience: 0,
      location: 0,
      availability: 0,
      profileQuality: 0,
      aiKeywords: 0
    };
    const matchDetails = [];

    // ═══════════════════════════════════════════════════════════════
    // 1. AI-POWERED SKILLS MATCHING (max 40 points) - Uses OpenAI embeddings
    // ═══════════════════════════════════════════════════════════════
    const candidateSkills = aiSkillsMatching.extractFromProfile(profile.skills);
    
    let skillMatch;
    try {
      skillMatch = await aiSkillsMatching.calculateSkillMatch(
        jobSkills, 
        candidateSkills,
        { maxScore: 40 }
      );
    } catch (error) {
      console.error('AI skills matching error, using fallback:', error.message);
      // Fallback to simple percentage match if AI fails
      const simpleMatch = candidateSkills.filter(cs => 
        jobSkills.some(js => js.toLowerCase().includes(cs.toLowerCase()) || cs.toLowerCase().includes(js.toLowerCase()))
      );
      skillMatch = {
        score: jobSkills.length > 0 ? Math.round((simpleMatch.length / jobSkills.length) * 40) : 0,
        matches: simpleMatch.map(s => ({ jobSkill: s, candidateSkill: s, type: 'fallback' })),
        missing: jobSkills.filter(js => !simpleMatch.some(m => m.toLowerCase() === js.toLowerCase())),
        bonus: [],
        summary: { exact: simpleMatch.length, missing: jobSkills.length - simpleMatch.length }
      };
    }
    
    breakdown.skills = skillMatch.score;
    const matchedSkillNames = skillMatch.matches?.map(m => m.candidateSkill || m.jobSkill).slice(0, 5) || [];
    const matchPercentage = jobSkills.length > 0 
      ? Math.round((skillMatch.matches?.length || 0) / jobSkills.length * 100) 
      : 0;
    
    if (matchedSkillNames.length > 0) {
      matchDetails.push(`Skills: ${matchedSkillNames.join(', ')} (${matchPercentage}% match)`);
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. EXPERIENCE MATCHING (max 25 points)
    // ═══════════════════════════════════════════════════════════════
    const totalYears = this.calculateTotalYearsExperience(profile.experience);
    const experienceMatch = this.scoreExperienceMatch(totalYears, experienceLevel);
    breakdown.experience = experienceMatch.score;
    if (experienceMatch.score > 0) {
      matchDetails.push(experienceMatch.reason);
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. LOCATION MATCHING (max 15 points)
    // ═══════════════════════════════════════════════════════════════
    const locationMatch = this.scoreLocationMatch(profile.location, location, locationType);
    breakdown.location = locationMatch.score;
    if (locationMatch.score > 0) {
      matchDetails.push(locationMatch.reason);
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. AVAILABILITY STATUS (max 10 points)
    // ═══════════════════════════════════════════════════════════════
    const availabilityMatch = this.scoreAvailability(profile.availabilityStatus);
    breakdown.availability = availabilityMatch.score;
    if (availabilityMatch.score > 5) {
      matchDetails.push(availabilityMatch.reason);
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. JOB TITLE MATCHING (max 30 points) - CRITICAL when skills are missing
    // Matches job title against candidate's title/headline
    // Uses weighted matching: primary roles > modifiers > generic terms
    // ═══════════════════════════════════════════════════════════════
    breakdown.titleMatch = 0;
    const jobTitle = (job?.title || '').toLowerCase();
    const candidateTitle = (profile.title || profile.headline || '').toLowerCase();
    
    if (jobTitle && candidateTitle) {
      // Check for exact match
      if (jobTitle === candidateTitle) {
        breakdown.titleMatch = 30;
        matchDetails.push(`Perfect title match: ${profile.title || profile.headline}`);
      } else {
        // Extract role components with categories
        const jobRoles = this.extractRoleComponents(jobTitle);
        const candidateRoles = this.extractRoleComponents(candidateTitle);
        
        let titleScore = 0;
        const matchedDetails = [];
        
        // PRIMARY ROLE MATCH (frontend, backend, data, devops, etc.) - max 20 points
        const primaryMatches = jobRoles.primary.filter(jp => 
          candidateRoles.primary.some(cp => 
            cp === jp || 
            cp.includes(jp) || 
            jp.includes(cp) ||
            this.areRelatedRoles(jp, cp)
          )
        );
        
        // FULL-STACK SPECIAL CASE: full-stack candidates match both frontend and backend jobs
        const candidateIsFullStack = candidateRoles.stack.some(s => 
          s.includes('full') && (s.includes('stack') || s.includes('-stack'))
        );
        const jobIsFrontendOrBackend = jobRoles.primary.some(p => 
          p.includes('frontend') || p.includes('front-end') || p.includes('front end') ||
          p.includes('backend') || p.includes('back-end') || p.includes('back end')
        );
        
        if (primaryMatches.length > 0) {
          // Full match on primary role - strong signal
          titleScore += 20;
          matchedDetails.push(`Primary role: ${primaryMatches.join(', ')}`);
        } else if (candidateIsFullStack && jobIsFrontendOrBackend) {
          // Full-stack candidates are good for both frontend and backend roles
          titleScore += 20;
          matchedDetails.push(`Full-stack matches ${jobRoles.primary.join('/')}`);
        } else if (candidateRoles.primary.length === 0 && candidateRoles.generic.length > 0) {
          // Generic title (e.g. "Software Engineer", "Developer") with no specialization
          // Give partial credit — they could be relevant depending on skills match
          titleScore += 5;
          matchedDetails.push(`General ${candidateRoles.generic.join('/')} (skills-dependent)`);
        } else if (jobRoles.primary.length > 0 && candidateRoles.primary.length > 0) {
          // No primary match when both have primary roles - likely mismatch
          // DevOps doesn't match Frontend
          titleScore += 0;
        }
        
        // STACK/SPECIALTY MATCH (full-stack, mobile, cloud, etc.) - max 5 points
        const stackMatches = jobRoles.stack.filter(js => 
          candidateRoles.stack.some(cs => cs === js || cs.includes(js) || js.includes(cs))
        );
        if (stackMatches.length > 0) {
          titleScore += 5;
          matchedDetails.push(`Stack: ${stackMatches.join(', ')}`);
        }
        
        // SENIORITY MATCH (senior, lead, principal, etc.) - max 5 points
        const seniorityMatches = jobRoles.seniority.filter(js =>
          candidateRoles.seniority.some(cs => cs === js || cs.includes(js) || js.includes(cs))
        );
        if (seniorityMatches.length > 0 && titleScore > 0) {
          // Only count seniority if there's some role relevance
          titleScore += 5;
          matchedDetails.push(`Level: ${seniorityMatches.join(', ')}`);
        }
        
        breakdown.titleMatch = Math.min(30, titleScore);
        if (matchedDetails.length > 0) {
          matchDetails.push(`Title: ${matchedDetails.join(', ')} (${profile.title || profile.headline})`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. AI KEYWORDS SEMANTIC MATCHING (max 10 points)
    // ═══════════════════════════════════════════════════════════════
    if (profile.aiKeywords && Array.isArray(profile.aiKeywords) && jobKeywords.length > 0) {
      const aiKeywordMatches = profile.aiKeywords.filter(keyword => 
        jobKeywords.some(jk => 
          keyword.toLowerCase().includes(jk.toLowerCase()) ||
          jk.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      breakdown.aiKeywords = Math.min(10, aiKeywordMatches.length * 2);
      if (aiKeywordMatches.length > 0) {
        matchDetails.push(`AI Keywords: ${aiKeywordMatches.slice(0, 3).join(', ')}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. PROFILE QUALITY BONUS (max 10 points)
    // ═══════════════════════════════════════════════════════════════
    const completeness = this.calculateProfileCompleteness(profile);
    if (completeness >= 80) breakdown.profileQuality += 5;
    if (profile.aiSummary) breakdown.profileQuality += 3;
    if (profile.aiRecruiterInsights) breakdown.profileQuality += 2;

    // ═══════════════════════════════════════════════════════════════
    // 8. RAG VECTOR SIMILARITY BOOST (max 15 points)
    // When pgvector search was used, incorporate the cosine similarity score
    // This rewards candidates whose overall profile is semantically close
    // to the job description — a holistic signal vs per-field scoring above
    // ═══════════════════════════════════════════════════════════════
    breakdown.vectorSimilarity = 0;
    if (vectorSimilarity !== null && vectorSimilarity > 0) {
      // vectorSimilarity is 0-1 cosine similarity; scale to max 15 points
      breakdown.vectorSimilarity = Math.round(vectorSimilarity * 15);
      if (vectorSimilarity >= 0.7) {
        matchDetails.push(`High semantic match (${Math.round(vectorSimilarity * 100)}%)`);
      } else if (vectorSimilarity >= 0.5) {
        matchDetails.push(`Good semantic match (${Math.round(vectorSimilarity * 100)}%)`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CALCULATE WEIGHTED TOTAL SCORE
    // ═══════════════════════════════════════════════════════════════
    const weights = {
      skills: priorityFactors.includes('skills') ? 1.2 : 1.0,
      experience: priorityFactors.includes('experience') ? 1.2 : 1.0,
      location: priorityFactors.includes('location') ? 1.2 : 1.0,
      availability: priorityFactors.includes('availability') ? 1.2 : 1.0,
      profileQuality: 1.0,
      aiKeywords: 1.0,
      titleMatch: 1.0,
      vectorSimilarity: 1.0 // RAG boost
    };

    // Compute raw weighted sum
    const rawScore = 
      breakdown.skills * weights.skills +
      breakdown.experience * weights.experience +
      breakdown.location * weights.location +
      breakdown.availability * weights.availability +
      breakdown.profileQuality * weights.profileQuality +
      breakdown.aiKeywords * weights.aiKeywords +
      breakdown.titleMatch * weights.titleMatch +
      breakdown.vectorSimilarity * weights.vectorSimilarity;

    // Calculate theoretical max for normalization (avoids ceiling compression)
    // Only include components that are actually achievable for this candidate/job combo.
    // If vectorSimilarity wasn't used or no keywords exist, exclude from denominator
    // to avoid deflating scores with unreachable points.
    const hasAiKeywords = profile.aiKeywords && Array.isArray(profile.aiKeywords) && profile.aiKeywords.length > 0 && jobKeywords.length > 0;
    const hasVectorSimilarity = vectorSimilarity !== null && vectorSimilarity > 0;
    const maxRaw = 
      40 * weights.skills +
      25 * weights.experience +
      15 * weights.location +
      10 * weights.availability +
      10 * weights.profileQuality +
      (hasAiKeywords ? 10 : 0) * weights.aiKeywords +
      30 * weights.titleMatch +
      (hasVectorSimilarity ? 15 : 0) * weights.vectorSimilarity;

    // Normalize to 0-100 range
    const totalScore = Math.round((rawScore / maxRaw) * 100);

    return {
      totalScore: Math.min(100, totalScore),
      breakdown,
      matchDetails,
      usedVectorSearch: vectorSimilarity !== null,
      skillMatch: {
        matched: matchedSkillNames,
        missing: skillMatch.missing || [],
        bonus: skillMatch.bonus || [],
        percentage: matchPercentage,
        details: skillMatch.details,
        summary: skillMatch.summary
      }
    };
  }

  /**
   * Score experience level match
   */
  scoreExperienceMatch(totalYears, requiredLevel) {
    const requirements = {
      'entry': { min: 0, max: 1, ideal: 0 },
      'junior': { min: 0, max: 3, ideal: 1 },
      'mid': { min: 2, max: 6, ideal: 4 },
      'senior': { min: 5, max: 15, ideal: 8 },
      'lead': { min: 7, max: 20, ideal: 10 },
      'executive': { min: 10, max: 30, ideal: 15 }
    };

    const req = requirements[requiredLevel] || requirements['mid'];
    
    // Perfect match: within ideal range
    if (totalYears >= req.min && totalYears <= req.max) {
      const idealDistance = Math.abs(totalYears - req.ideal);
      const score = Math.max(15, 25 - idealDistance * 2);
      return { 
        score, 
        reason: `Experience: ${totalYears} years (${requiredLevel} level)` 
      };
    }
    
    // Overqualified
    if (totalYears > req.max) {
      return { 
        score: 10, 
        reason: `Overqualified: ${totalYears} years for ${requiredLevel}` 
      };
    }
    
    // Underqualified
    if (totalYears < req.min) {
      return { 
        score: 5, 
        reason: `Limited experience: ${totalYears} years` 
      };
    }

    return { score: 15, reason: `Experience: ${totalYears} years` };
  }

  /**
   * Extract role-defining words from a job title
   * Works for any industry - tech, healthcare, finance, creative, etc.
   */
  extractRoleWords(title) {
    const roleKeywords = [
      // Tech/Engineering
      'frontend', 'front-end', 'front end', 'backend', 'back-end', 'back end', 
      'fullstack', 'full-stack', 'full stack', 'devops', 'sre', 'cloud',
      'mobile', 'ios', 'android', 'react', 'vue', 'angular', 'node', 'python', 'java',
      'data', 'machine learning', 'ml', 'ai', 'artificial intelligence',
      'software', 'developer', 'engineer', 'architect', 'programmer',
      'qa', 'quality', 'test', 'automation', 'security', 'infra', 'infrastructure',
      'platform', 'systems', 'network', 'database', 'dba', 'embedded',
      // Product/Design
      'product', 'design', 'ux', 'ui', 'user experience', 'graphic',
      'creative', 'visual', 'brand', 'content', 'copywriter',
      // Business/Management
      'manager', 'director', 'lead', 'principal', 'staff', 'senior', 'junior',
      'head', 'vp', 'chief', 'executive', 'coordinator', 'specialist',
      'analyst', 'consultant', 'advisor', 'strategist',
      // Sales/Marketing
      'sales', 'marketing', 'growth', 'customer', 'success', 'support',
      'account', 'business development', 'bd', 'partnerships',
      // Finance/Legal
      'finance', 'financial', 'accounting', 'accountant', 'controller',
      'legal', 'compliance', 'risk', 'audit', 'tax',
      // Healthcare
      'nurse', 'nursing', 'clinical', 'medical', 'healthcare', 'health',
      'physician', 'doctor', 'surgeon', 'therapist', 'pharmacist',
      // Operations/HR
      'operations', 'ops', 'hr', 'human resources', 'recruiting', 'recruiter',
      'talent', 'people', 'culture', 'admin', 'administrative', 'office',
      // Research/Science
      'research', 'researcher', 'scientist', 'biologist', 'chemist', 'physicist',
      'statistician', 'mathematician'
    ];
    
    const lowerTitle = title.toLowerCase();
    return roleKeywords.filter(keyword => lowerTitle.includes(keyword));
  }

  /**
   * Extract role components categorized by type
   * Returns { primary: [], stack: [], seniority: [], generic: [] }
   */
  extractRoleComponents(title) {
    const lowerTitle = title.toLowerCase();
    
    // PRIMARY ROLES - the core specialization (must match for good score)
    const primaryRoles = [
      'frontend', 'front-end', 'front end',
      'backend', 'back-end', 'back end',
      'devops', 'sre', 'infrastructure', 'platform',
      'data', 'ml', 'machine learning', 'ai', 'artificial intelligence',
      'mobile', 'ios', 'android',
      'security', 'cybersecurity', 'infosec',
      'qa', 'quality', 'test', 'automation',
      'embedded', 'firmware', 'hardware',
      'ux', 'ui', 'design', 'product',
      'sales', 'marketing', 'customer success',
      'finance', 'accounting', 'legal', 'compliance',
      'hr', 'recruiting', 'talent',
      'research', 'science'
    ];
    
    // STACK/SPECIALTY - additional specialization
    const stackRoles = [
      'full-stack', 'fullstack', 'full stack',
      'cloud', 'aws', 'azure', 'gcp',
      'react', 'vue', 'angular', 'node', 'python', 'java', 'go', 'rust',
      'blockchain', 'web3', 'crypto',
      'game', 'graphics', '3d',
      'network', 'database', 'dba'
    ];
    
    // SENIORITY/LEVEL modifiers
    const seniorityRoles = [
      'intern', 'junior', 'entry',
      'mid', 'senior', 'staff', 'principal', 'distinguished',
      'lead', 'manager', 'director', 'head', 'vp', 'chief', 'executive',
      'architect'
    ];
    
    // GENERIC terms (engineer, developer, etc.) - don't use for matching
    const genericTerms = [
      'engineer', 'developer', 'programmer', 'specialist', 'analyst',
      'consultant', 'coordinator', 'associate'
    ];
    
    return {
      primary: primaryRoles.filter(r => lowerTitle.includes(r)),
      stack: stackRoles.filter(r => lowerTitle.includes(r)),
      seniority: seniorityRoles.filter(r => lowerTitle.includes(r)),
      generic: genericTerms.filter(r => lowerTitle.includes(r))
    };
  }

  /**
   * Check if two roles are semantically related
   * E.g., full-stack relates to both frontend and backend
   * UI/UX relates to frontend
   */
  areRelatedRoles(role1, role2) {
    // Define role relationships (bidirectional)
    // NOTE: These are STRONG relationships - candidates with related roles get full title match
    // UX/UI is related to design, NOT to frontend development (coding)
    const relationships = {
      // Frontend-related (coding roles)
      'frontend': ['react', 'vue', 'angular', 'web'],
      'front-end': ['react', 'vue', 'angular', 'web'],
      'front end': ['react', 'vue', 'angular', 'web'],
      
      // UI/UX-related (design roles) - separate from frontend development
      'ui': ['ux', 'design', 'graphic', 'visual'],
      'ux': ['ui', 'design', 'product', 'user experience'],
      'design': ['ui', 'ux', 'graphic', 'visual', 'creative'],
      
      // Backend-related (NOTE: backend does NOT relate to frontend)
      'backend': ['api', 'server', 'node', 'python', 'java', 'go', 'database'],
      'back-end': ['api', 'server', 'node', 'python', 'java', 'go', 'database'],
      'back end': ['api', 'server', 'node', 'python', 'java', 'go', 'database'],
      
      // DevOps/Infra-related
      'devops': ['sre', 'infrastructure', 'platform', 'cloud'],
      'sre': ['devops', 'infrastructure', 'platform', 'cloud'],
      'infrastructure': ['devops', 'sre', 'platform', 'cloud'],
      
      // Data-related
      'data': ['ml', 'machine learning', 'ai', 'artificial intelligence', 'analytics'],
      'ml': ['data', 'machine learning', 'ai', 'artificial intelligence'],
      'ai': ['data', 'ml', 'machine learning', 'artificial intelligence'],
      
      // Mobile-related
      'mobile': ['ios', 'android', 'react native', 'flutter'],
      'ios': ['mobile', 'android'],
      'android': ['mobile', 'ios']
    };
    
    // Check direct relationships
    if (relationships[role1]?.includes(role2)) return true;
    if (relationships[role2]?.includes(role1)) return true;
    
    return false;
  }

  /**
   * Score location match with remote work consideration
   */
  scoreLocationMatch(candidateLocation, jobLocation, locationType) {
    // Remote jobs match everyone
    if (locationType === 'remote') {
      return { score: 15, reason: 'Remote position - location flexible' };
    }

    if (!candidateLocation || !jobLocation) {
      return { score: 5, reason: 'Location not specified' };
    }

    const candLoc = candidateLocation.toLowerCase();
    const jobLoc = jobLocation.toLowerCase();

    // Exact city match
    if (candLoc === jobLoc) {
      return { score: 15, reason: `Location: ${candidateLocation}` };
    }

    // City contained in location string
    const jobCities = jobLoc.split(/[,\/]/).map(s => s.trim());
    const candCities = candLoc.split(/[,\/]/).map(s => s.trim());
    
    const hasMatch = jobCities.some(jc => 
      candCities.some(cc => cc.includes(jc) || jc.includes(cc))
    );
    
    if (hasMatch) {
      return { score: 12, reason: `Near: ${candidateLocation}` };
    }

    // Same state/country (basic check)
    const jobState = this.extractState(jobLoc);
    const candState = this.extractState(candLoc);
    if (jobState && candState && jobState === candState) {
      return { score: 8, reason: `Same region: ${candState}` };
    }

    // Hybrid might work for nearby
    if (locationType === 'hybrid') {
      return { score: 5, reason: 'Hybrid - may require relocation' };
    }

    return { score: 0, reason: 'Location mismatch' };
  }

  /**
   * Extract state/region from location string
   */
  extractState(location) {
    const statePatterns = [
      /,\s*([A-Z]{2})\s*$/i,  // ", CA" or ", NY"
      /,\s*(\w+)\s*$/,         // ", California"
    ];
    for (const pattern of statePatterns) {
      const match = location.match(pattern);
      if (match) return match[1].toLowerCase();
    }
    return null;
  }

  /**
   * Score availability status
   */
  scoreAvailability(status) {
    const scores = {
      'actively-looking': { score: 10, reason: 'Actively job searching' },
      'open': { score: 7, reason: 'Open to opportunities' },
      'not-looking': { score: 3, reason: 'Passive candidate' }
    };
    return scores[status] || { score: 5, reason: 'Availability unknown' };
  }
  
  /**
   * Helper to add delays for visibility of progress updates
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract keywords from job title and description for matching
   * Works for ALL industries - not just tech
   */
  extractKeywordsFromJob(job) {
    const keywords = [];
    const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 
      'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
      'shall', 'can', 'need', 'our', 'your', 'we', 'they', 'their', 'this', 'that', 'these',
      'those', 'am', 'i', 'you', 'he', 'she', 'it', 'who', 'which', 'what', 'where', 'when',
      'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
      'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also']);
    
    // Extract from title
    if (job.title) {
      const titleWords = job.title.toLowerCase()
        .replace(/[^\w\s\-]/g, ' ')
        .split(/[\s\-\/]+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
      keywords.push(...titleWords);
    }
    
    // Extract from description (first 500 chars to get key requirements)
    if (job.description) {
      const descWords = job.description.substring(0, 500).toLowerCase()
        .replace(/[^\w\s\-]/g, ' ')
        .split(/[\s\-\/]+/)
        .filter(w => w.length > 3 && !stopWords.has(w));
      keywords.push(...descWords);
    }
    
    // Extract from requirements
    if (job.requirements) {
      const reqText = Array.isArray(job.requirements) ? job.requirements.join(' ') : job.requirements;
      const reqWords = reqText.substring(0, 300).toLowerCase()
        .replace(/[^\w\s\-]/g, ' ')
        .split(/[\s\-\/]+/)
        .filter(w => w.length > 3 && !stopWords.has(w));
      keywords.push(...reqWords);
    }
    
    // Return unique keywords, prioritizing title words
    return [...new Set(keywords)].slice(0, 20); // Limit to top 20 keywords
  }

  /**
   * Infer likely skills from job title and description when no explicit skills provided.
   * Uses a curated mapping of role keywords → common skills for that role.
   * This ensures the scoring algorithm has meaningful skills to match against.
   */
  inferSkillsFromJob(job) {
    const title = (job.title || '').toLowerCase();
    const description = (job.description || '').toLowerCase();
    const combined = title + ' ' + description;
    const inferred = new Set();

    // Role → Skills mapping (common industry expectations)
    const roleSkillMap = {
      // Frontend / UI
      'frontend': ['JavaScript', 'TypeScript', 'React', 'CSS', 'HTML', 'Redux', 'Webpack', 'REST APIs'],
      'front-end': ['JavaScript', 'TypeScript', 'React', 'CSS', 'HTML', 'Redux', 'Webpack', 'REST APIs'],
      'front end': ['JavaScript', 'TypeScript', 'React', 'CSS', 'HTML', 'Redux', 'Webpack', 'REST APIs'],
      'react': ['React', 'JavaScript', 'TypeScript', 'Redux', 'HTML', 'CSS'],
      'angular': ['Angular', 'TypeScript', 'RxJS', 'HTML', 'CSS'],
      'vue': ['Vue.js', 'JavaScript', 'TypeScript', 'HTML', 'CSS'],
      'ui developer': ['JavaScript', 'HTML', 'CSS', 'React', 'Figma'],
      'ui engineer': ['JavaScript', 'HTML', 'CSS', 'React', 'Figma'],
      
      // Backend
      'backend': ['Node.js', 'Python', 'SQL', 'REST APIs', 'Docker', 'PostgreSQL'],
      'back-end': ['Node.js', 'Python', 'SQL', 'REST APIs', 'Docker', 'PostgreSQL'],
      'back end': ['Node.js', 'Python', 'SQL', 'REST APIs', 'Docker', 'PostgreSQL'],
      'node': ['Node.js', 'Express', 'JavaScript', 'TypeScript', 'MongoDB', 'REST APIs'],
      'python': ['Python', 'Django', 'Flask', 'SQL', 'REST APIs'],
      'java developer': ['Java', 'Spring Boot', 'SQL', 'REST APIs', 'Maven'],
      'golang': ['Go', 'REST APIs', 'Docker', 'PostgreSQL', 'gRPC'],
      
      // Full Stack
      'full stack': ['JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'REST APIs', 'Docker'],
      'full-stack': ['JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'REST APIs', 'Docker'],
      'fullstack': ['JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'REST APIs', 'Docker'],
      
      // Data
      'data scientist': ['Python', 'Machine Learning', 'SQL', 'TensorFlow', 'Pandas', 'Statistics'],
      'data engineer': ['Python', 'SQL', 'Apache Spark', 'ETL', 'AWS', 'Data Pipelines'],
      'data analyst': ['SQL', 'Python', 'Excel', 'Tableau', 'Statistics', 'Data Visualization'],
      'machine learning': ['Python', 'TensorFlow', 'PyTorch', 'Machine Learning', 'Deep Learning', 'NLP'],
      
      // DevOps / Infrastructure
      'devops': ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Terraform', 'Linux'],
      'sre': ['Docker', 'Kubernetes', 'AWS', 'Monitoring', 'Linux', 'Python'],
      'cloud': ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform'],
      'infrastructure': ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'Linux', 'CI/CD'],
      
      // Mobile
      'ios': ['Swift', 'SwiftUI', 'Objective-C', 'Xcode', 'iOS'],
      'android': ['Kotlin', 'Java', 'Android SDK', 'Jetpack Compose'],
      'mobile': ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Mobile Development'],
      'react native': ['React Native', 'JavaScript', 'TypeScript', 'iOS', 'Android'],
      
      // Other
      'security': ['Cybersecurity', 'Penetration Testing', 'OWASP', 'Network Security', 'SIEM'],
      'qa': ['Testing', 'Selenium', 'Jest', 'Cypress', 'Test Automation'],
      'test': ['Testing', 'Selenium', 'Jest', 'Cypress', 'Test Automation'],
      'product manager': ['Product Management', 'Agile', 'User Research', 'Roadmapping', 'Analytics'],
      'designer': ['Figma', 'UI/UX', 'Adobe XD', 'Sketch', 'Design Systems'],
      'ux': ['UX Research', 'Figma', 'Wireframing', 'Prototyping', 'User Testing'],
    };

    // Check title and description against role keywords
    for (const [keyword, skills] of Object.entries(roleSkillMap)) {
      if (combined.includes(keyword)) {
        skills.forEach(s => inferred.add(s));
      }
    }

    // Also scan description for specific tech mentions
    const techTerms = [
      'react', 'angular', 'vue', 'typescript', 'javascript', 'python', 'java', 'go', 'rust',
      'node.js', 'express', 'django', 'flask', 'spring', 'docker', 'kubernetes', 'aws', 'azure',
      'gcp', 'postgresql', 'mongodb', 'redis', 'graphql', 'rest api', 'ci/cd', 'terraform',
      'swift', 'kotlin', 'flutter', 'react native', 'tensorflow', 'pytorch', 'sql', 'nosql',
      'html', 'css', 'sass', 'webpack', 'vite', 'next.js', 'nuxt', 'tailwind', 'redux',
      'git', 'linux', 'agile', 'scrum', 'microservices', 'serverless', 'figma'
    ];

    for (const tech of techTerms) {
      if (combined.includes(tech)) {
        // Capitalize properly
        const proper = tech.charAt(0).toUpperCase() + tech.slice(1);
        inferred.add(proper);
      }
    }

    const result = [...inferred].slice(0, 15);
    console.log(`[inferSkillsFromJob] "${job.title}" → [${result.join(', ')}]`);
    return result;
  }

  /**
   * Calculate candidate match score for smart search
   */
  calculateCandidateScore(profile, job) {
    let score = 0;
    const reasons = [];
    let skills = job.skills || [];
    const experienceLevel = job.experienceLevel || 'mid';
    const location = job.location || null;
    
    // If job has no skills, extract keywords from title/description
    let extractedKeywords = [];
    if (!skills || skills.length === 0) {
      extractedKeywords = this.extractKeywordsFromJob(job);
      if (extractedKeywords.length > 0) {
        console.log(`No skills on job "${job.title}", extracted keywords:`, extractedKeywords.slice(0, 10));
      }
    }
    
    // Get candidate skills - handle both array and object formats
    let pSkills = [];
    if (Array.isArray(profile.skills)) {
      pSkills = profile.skills.map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase());
    } else if (typeof profile.skills === 'object' && profile.skills !== null) {
      pSkills = Object.values(profile.skills).flat().map(s => 
        (typeof s === 'string' ? s : s.name || '').toLowerCase()
      );
    }
    
    // Build searchable candidate text (title, headline, summary, skills)
    const candidateText = [
      profile.title || '',
      profile.headline || '',
      profile.summary || '',
      ...pSkills
    ].join(' ').toLowerCase();

    // Skills matching (25 pts each, max 100 pts)
    let skillMatches = 0;
    skills.forEach(jobSkill => {
      const skillLower = jobSkill.toLowerCase();
      if (pSkills.some(ps => ps.includes(skillLower) || skillLower.includes(ps))) {
        skillMatches++;
        if (skillMatches <= 4) {
          score += 25;
          reasons.push(`Skill: ${jobSkill}`);
        }
      }
    });
    
    // Keyword matching when no skills provided (15 pts each, max 60 pts)
    if (skills.length === 0 && extractedKeywords.length > 0) {
      let keywordMatches = 0;
      extractedKeywords.forEach(keyword => {
        if (candidateText.includes(keyword)) {
          keywordMatches++;
          if (keywordMatches <= 4) {
            score += 15;
            reasons.push(`Keyword: ${keyword}`);
          }
        }
      });
    }

    // Title/Role relevance bonus (20 pts)
    if (profile.title || profile.headline) {
      const profileTitle = (profile.title || profile.headline || '').toLowerCase();
      const jobTitle = (job.title || '').toLowerCase();
      const titleWords = jobTitle.split(/[\s,\-\/]+/).filter(w => w.length > 3);
      const matchedWords = titleWords.filter(tw => profileTitle.includes(tw));
      if (matchedWords.length > 0) {
        score += Math.min(20, matchedWords.length * 10);
        reasons.push('Relevant title/role');
      }
    }

    // Experience level (20 pts)
    const totalYears = this.calculateTotalYearsExperience(profile.experience);
    if (experienceLevel === 'senior' && totalYears >= 7) {
      score += 20;
      reasons.push('Senior experience');
    } else if (experienceLevel === 'mid' && totalYears >= 3) {
      score += 20;
      reasons.push('Mid-level experience');
    } else if (experienceLevel === 'junior' && totalYears >= 1) {
      score += 20;
      reasons.push('Junior experience');
    } else if (experienceLevel === 'entry') {
      score += 15;
      reasons.push('Entry level');
    }

    // Location (15 pts)
    if (location && profile.location) {
      const pLoc = profile.location.toLowerCase();
      const jLoc = location.toLowerCase();
      if (pLoc.includes(jLoc) || jLoc.includes(pLoc)) {
        score += 15;
        reasons.push('Location match');
      }
    }

    // Profile quality bonuses
    if (this.calculateProfileCompleteness(profile) >= 80) {
      score += 10;
      reasons.push('Complete profile');
    }
    if (profile.aiSummary) {
      score += 10;
      reasons.push('AI-enhanced');
    }
    if (profile.availabilityStatus === 'actively-looking') {
      score += 10;
      reasons.push('Actively looking');
    } else if (profile.availabilityStatus === 'open') {
      score += 5;
      reasons.push('Open to opportunities');
    }

    return { score, reasons };
  }

  /**
   * Format shortlisted candidates for storage in JobScreening
   * Works with both legacy negotiation format and new fast screening format
   */
  async formatShortlistedCandidates(screeningResults) {
    const formatted = [];
    
    for (const result of screeningResults) {
      try {
        // Handle guest candidates (no user account)
        if (result.isGuestCandidate) {
          formatted.push({
            candidateId: result.candidateId,
            name: result.candidateName || 'Guest Candidate',
            fitScore: result.fitScore || result.screeningScore || 0,
            interestScore: result.interestScore || 0,
            matchScore: result.matchScore || result.screeningScore || 0,
            profilePicture: null,
            headline: result.candidateProfile?.title || result.candidateProfile?.headline || null,
            keyStrengths: result.keyStrengths || [],
            concerns: result.concerns || [],
            skillsMatch: result.skillsMatch || {},
            summary: result.summary || '',
            decision: result.decision || 'shortlist',
            confidence: result.confidence || 50,
            isGuestCandidate: true,
            guestApplicationId: result.guestApplicationId,
            trackingCode: result.trackingCode
          });
          continue;
        }

        // Handle new fast screening format
        if (result.candidateProfile || result.candidateName) {
          const user = await User.findByPk(result.candidateId, {
            include: [{ model: Profile, as: 'profile' }]
          });
          
          formatted.push({
            candidateId: result.candidateId,
            name: result.candidateName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
            fitScore: result.fitScore || result.screeningScore || 0,
            interestScore: result.interestScore || 0,
            matchScore: result.matchScore || result.screeningScore || 0,
            profilePicture: user?.profile?.profilePicture || null,
            headline: user?.profile?.title || result.candidateProfile?.title || null,
            keyStrengths: result.keyStrengths || [],
            concerns: result.concerns || [],
            skillsMatch: result.skillsMatch || {},
            summary: result.summary || '',
            decision: result.decision || 'shortlist',
            confidence: result.confidence || 50
          });
        } else {
          // Legacy negotiation format (backward compatibility)
          const user = await User.findByPk(result.candidateId, {
            include: [{ model: Profile, as: 'profile' }]
          });
          
          if (user) {
            formatted.push({
              candidateId: user.id,
              name: `${user.firstName} ${user.lastName}`,
              fitScore: result.screeningScore || 0,
              interestScore: result.candidateInterestScore || 0,
              matchScore: result.screeningScore || 0,
              profilePicture: user.profile?.profilePicture || null,
              headline: user.profile?.title || null,
              decision: 'shortlist'
            });
          }
        }
      } catch (err) {
        console.error('Error formatting candidate:', err);
      }
    }
    
    return formatted;
  }

  /**
   * Create JobApplication records for AI-screened shortlisted candidates
   * This unifies the pipeline so all candidates (AI-screened + manual) appear together
   */
  async createApplicationsForShortlisted(jobId, shortlistedData) {
    console.log(`Creating JobApplication records for ${shortlistedData.length} AI-screened candidates`);
    
    let newApplicationsCount = 0;
    
    for (const candidate of shortlistedData) {
      try {
        // Calculate match score (use matchScore if available, otherwise average fit + interest)
        const matchScore = candidate.matchScore || 
          Math.round((candidate.fitScore + candidate.interestScore) / 2);
        
        const aiAnalysis = {
          fitScore: candidate.fitScore || 0,
          interestScore: candidate.interestScore || 0,
          matchScore: matchScore,
          keyStrengths: candidate.keyStrengths || [],
          concerns: candidate.concerns || [],
          skillsMatch: candidate.skillsMatch || {},
          summary: candidate.summary || '',
          confidence: candidate.confidence || 50,
          source: candidate.isGuestCandidate ? 'guest_screening' : 'ai_fast_screening',
          decision: candidate.decision || 'shortlist'
        };

        // Handle guest candidates (already have a JobApplication from guest submission)
        if (candidate.isGuestCandidate && candidate.guestApplicationId) {
          const guestApp = await JobApplication.findByPk(candidate.guestApplicationId);
          if (guestApp) {
            await guestApp.update({
              status: 'shortlisted',
              aiMatchScore: matchScore,
              aiAnalysis: aiAnalysis
            });
            console.log(`Updated guest application ${candidate.guestApplicationId} to shortlisted (score: ${matchScore})`);
          }
          continue;
        }

        // Check if application already exists (candidate may have applied manually)
        const existing = await JobApplication.findOne({
          where: { jobId, candidateId: candidate.candidateId }
        });
        
        if (existing) {
          // Update existing application with AI scores
          await existing.update({
            aiMatchScore: matchScore,
            aiAnalysis: aiAnalysis,
            status: existing.status === 'submitted' ? 'shortlisted' : existing.status
          });
          console.log(`Updated existing application for candidate ${candidate.candidateId}`);
        } else {
          // Create new application for AI-screened candidate
          await JobApplication.create({
            jobId,
            candidateId: candidate.candidateId,
            status: 'shortlisted',
            aiMatchScore: matchScore,
            aiAnalysis: aiAnalysis,
            source: 'ai_screening',
            answers: {},
            resumeUrl: null,
            coverLetter: null
          });
          newApplicationsCount++;
          console.log(`Created new application for AI-screened candidate ${candidate.candidateId}`);
        }
      } catch (err) {
        console.error(`Error creating application for candidate ${candidate.candidateId}:`, err);
      }
    }
    
    // Update job's application count
    if (newApplicationsCount > 0) {
      const job = await Job.findByPk(jobId);
      if (job) {
        await job.update({
          applications: (job.applications || 0) + newApplicationsCount
        });
        console.log(`Updated job application count by ${newApplicationsCount}`);
      }
    }
  }

  /**
   * Get screening status for a job (enhanced with phase tracking)
   */
  async getScreeningStatus(jobId) {
    const screening = await JobScreening.findOne({ 
      where: { jobId },
      include: [{ model: Job, as: 'job' }]
    });
    
    if (!screening) {
      // Return 'not_started' instead of 'pending' to indicate no screening has been configured
      return {
        jobId,
        status: 'not_started',  // Changed from 'pending' to avoid false polling
        currentPhase: null,
        progressPercent: 0,
        candidatesFound: 0,
        candidatesScreened: 0,
        totalCandidatesEvaluated: 0,
        shortlisted: [],
        searchCriteria: null,
        searchStartedAt: null,
        searchCompletedAt: null,
        startedAt: null,
        completedAt: null,
        recruiterFeedback: null
      };
    }
    
    return {
      jobId: screening.jobId,
      status: screening.status,
      currentPhase: screening.currentPhase,
      currentStep: screening.currentStep,
      progressPercent: screening.progressPercent || 0,
      candidatesFound: screening.candidatesFound,
      candidatesScreened: screening.candidatesScreened,
      totalCandidatesEvaluated: screening.totalCandidatesEvaluated || 0,
      shortlisted: screening.shortlisted || [],
      searchResults: screening.searchResults || [], // For candidate selection modal
      selectedCandidateIds: screening.selectedCandidateIds || [],
      searchCriteria: screening.searchCriteria,
      searchStartedAt: screening.searchStartedAt,
      searchCompletedAt: screening.searchCompletedAt,
      startedAt: screening.startedAt,
      completedAt: screening.completedAt,
      errorMessage: screening.errorMessage,
      recruiterFeedback: screening.recruiterFeedback
    };
  }

  /**
   * Submit recruiter feedback on screening quality
   */
  async submitScreeningFeedback(jobId, userId, feedbackData) {
    const screening = await JobScreening.findOne({ where: { jobId } });
    
    if (!screening) {
      throw new Error('Screening record not found');
    }

    const job = await Job.findByPk(jobId);
    if (!job || job.userId !== userId) {
      throw new Error('Not authorized to submit feedback for this job');
    }

    await screening.update({
      recruiterFeedback: {
        rating: feedbackData.rating, // 1-5
        searchQuality: feedbackData.searchQuality, // 1-5
        candidateQuality: feedbackData.candidateQuality, // 1-5
        notes: feedbackData.notes,
        improveSearch: feedbackData.improveSearch, // suggestions
        submittedAt: new Date(),
        submittedBy: userId
      }
    });

    return { success: true, message: 'Feedback submitted successfully' };
  }

  /**
   * FAST Screen candidates via single-call AI evaluation
   * Replaces slow multi-round AI conversations with one comprehensive evaluation per candidate
   * ~80% cost reduction, ~90% faster
   */
  async screenCandidates(job, candidates, screening) {
    const results = [];
    const config = screening.screeningConfig || {};
    const batchSize = 5; // Process 5 candidates in parallel
    
    console.log(`Fast screening ${candidates.length} candidates for job: ${job.title}`);

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(candidates.length / batchSize);
      
      // Calculate progress: screening is 35-85%
      const screeningProgress = 35 + Math.round(((i + batch.length) / candidates.length) * 50);
      
      await screening.update({
        candidatesScreened: i,
        currentStep: `Fast screening batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + batchSize, candidates.length)} of ${candidates.length})...`,
        progressPercent: screeningProgress
      });

      // Process batch in parallel
      const batchPromises = batch.map(async (candidate, idx) => {
        try {
          // Build candidate profile for screening
          const candidateProfile = {
            firstName: candidate.user?.firstName || candidate.firstName || '',
            lastName: candidate.user?.lastName || candidate.lastName || '',
            title: candidate.title || '',
            summary: candidate.summary || '',
            skills: candidate.skills || {},
            experience: candidate.experience || [],
            education: candidate.education || [],
            location: candidate.location || '',
            userId: candidate.userId || candidate.id
          };

          // Use fast single-call screening
          const screenResult = await aiService.fastScreenCandidate(job, candidateProfile, {
            style: config.screeningStyle || 'balanced',
            priorityFactors: config.priorityFactors || ['skills', 'experience']
          });

          return {
            candidateId: candidateProfile.userId,
            candidateName: `${candidateProfile.firstName} ${candidateProfile.lastName}`.trim(),
            candidateProfile: candidateProfile,
            // PRESERVE smart search score from the profile object
            smartSearchScore: candidate.smartSearchScore || 0,
            smartSearchRank: candidate.smartSearchRank || 0,
            smartSearchBreakdown: candidate.smartSearchBreakdown || null,
            // AI screening scores
            screeningScore: screenResult.matchScore || 0,
            fitScore: screenResult.fitScore || 0,
            interestScore: screenResult.interestScore || 0,
            decision: screenResult.decision || 'maybe',
            confidence: screenResult.confidence || 50,
            keyStrengths: screenResult.keyStrengths || [],
            concerns: screenResult.concerns || [],
            skillsMatch: screenResult.skillsMatch || {},
            summary: screenResult.summary || '',
            recommendedAction: screenResult.recommendedAction || '',
            processingTimeMs: screenResult.processingTimeMs || 0,
            success: screenResult.success !== false
          };
        } catch (err) {
          console.error(`Failed to fast-screen candidate ${candidate.userId}:`, err.message);
          return {
            candidateId: candidate.userId || candidate.id,
            candidateName: `${candidate.user?.firstName || ''} ${candidate.user?.lastName || ''}`.trim(),
            // PRESERVE smart search score even on error - candidate was still top-ranked
            smartSearchScore: candidate.smartSearchScore || 0,
            smartSearchRank: candidate.smartSearchRank || 0,
            screeningScore: 0,
            decision: 'error',
            success: false,
            error: err.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`Completed batch ${batchNum}/${totalBatches}: ${batchResults.filter(r => r.success).length}/${batch.length} successful`);
    }
    
    await screening.update({ 
      candidatesScreened: candidates.length,
      progressPercent: 85
    });
    
    // Log screening summary
    const successful = results.filter(r => r.success);
    const shortlistDecisions = results.filter(r => r.decision === 'shortlist').length;
    console.log(`Fast screening complete: ${successful.length}/${candidates.length} successful, ${shortlistDecisions} recommended for shortlist`);
    
    return results;
  }

  /**
   * Screen candidates using Agent Arena negotiations
   * Creates visible AgentNegotiation records that appear in the Agent Arena UI
   * Slower than fast screening but provides interactive, watchable negotiations
   */
  async screenCandidatesWithAgentArena(job, candidates, screening) {
    const results = [];
    const ARENA_CONCURRENCY = 3; // Process 3 candidates concurrently in Agent Arena

    for (let i = 0; i < candidates.length; i += ARENA_CONCURRENCY) {
      const batch = candidates.slice(i, i + ARENA_CONCURRENCY);
      const batchNum = Math.floor(i / ARENA_CONCURRENCY) + 1;
      const totalBatches = Math.ceil(candidates.length / ARENA_CONCURRENCY);
      
      const screeningProgress = 35 + Math.round(((i + batch.length) / candidates.length) * 50);
      
      await screening.update({
        candidatesScreened: i,
        currentStep: `AI Agent Arena batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + ARENA_CONCURRENCY, candidates.length)} of ${candidates.length})...`,
        progressPercent: screeningProgress
      });

      const batchPromises = batch.map(async (candidate, idx) => {
        try {
          console.log(`Agent Arena screening candidate ${i + idx + 1}/${candidates.length}: ${candidate.user?.email || candidate.userId}`);
          
          // Initiate AI-to-AI screening negotiation via Agent Arena
          const negotiation = await agentArenaService.initiateNegotiation(
            'recruiter',
            job.id,
            candidate.userId,
            job.userId,
            { context: 'Automated Screening', screeningId: screening.id },
            'screening'
          );

          // Run screening conversation (3 rounds for comprehensive evaluation)
          await agentArenaService.runFullNegotiation(negotiation.id, 3);

          // Fetch final state
          const finalState = await AgentNegotiation.findByPk(negotiation.id);
          
          return {
            candidateId: candidate.userId,
            candidateName: `${candidate.user?.firstName || ''} ${candidate.user?.lastName || ''}`.trim(),
            candidateProfile: candidate,
            smartSearchScore: candidate.smartSearchScore || 0,
            smartSearchRank: candidate.smartSearchRank || 0,
            screeningScore: finalState?.fitScore || 0,
            fitScore: finalState?.fitScore || 0,
            interestScore: finalState?.interestScore || 0,
            decision: finalState?.outcome === 'matched' ? 'shortlist' : (finalState?.outcome === 'rejected' ? 'reject' : 'maybe'),
            negotiationId: finalState?.id,
            negotiationStatus: finalState?.status,
            success: true
          };
        } catch (err) {
          console.error(`Failed to Agent Arena screen candidate ${candidate.userId}:`, err);
          return {
            candidateId: candidate.userId,
            candidateName: `${candidate.user?.firstName || ''} ${candidate.user?.lastName || ''}`.trim(),
            smartSearchScore: candidate.smartSearchScore || 0,
            screeningScore: 0,
            decision: 'error',
            success: false,
            error: err.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`Completed Agent Arena batch ${batchNum}/${totalBatches}: ${batchResults.filter(r => r.success).length}/${batch.length} successful`);
    }
    
    await screening.update({ 
      candidatesScreened: candidates.length,
      progressPercent: 85
    });
    
    console.log(`Agent Arena screening complete: ${results.filter(r => r.success).length}/${candidates.length} successful`);
    
    return results;
  }

  /**
   * Legacy slow screening via AI-to-AI negotiation (kept for reference)
   * Use screenCandidates() instead for 10x faster screening
   */
  async screenCandidatesLegacy(job, candidates, screening) {
    const results = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      try {
        console.log(`Screening candidate ${i + 1}/${candidates.length}: ${candidate.user?.email}`);
        
        const screeningProgress = 35 + Math.round((i / candidates.length) * 50);
        
        await screening.update({
          candidatesScreened: i,
          currentStep: `AI screening candidate ${i + 1} of ${candidates.length}...`,
          progressPercent: screeningProgress
        });
        
        // Initiate AI-to-AI screening negotiation
        const negotiation = await agentArenaService.initiateNegotiation(
          'recruiter',
          job.id,
          candidate.userId,
          job.userId,
          { context: 'Automated Screening' },
          'screening'
        );

        // Run brief screening conversation (2 rounds)
        await agentArenaService.runFullNegotiation(negotiation.id, 2);

        // Fetch final state
        const finalState = await AgentNegotiation.findByPk(negotiation.id);
        results.push(finalState);
        
      } catch (err) {
        console.error(`Failed to screen candidate ${candidate.id}:`, err);
      }
    }
    
    await screening.update({ 
      candidatesScreened: candidates.length,
      progressPercent: 85
    });
    
    return results;
  }

  /**
   * Select top candidates based on COMBINED smart search + AI screening scores
   * Prioritizes smart search ranking to ensure top-ranked candidates are always shortlisted
   * Takes the top N candidates regardless of AI decision - let recruiter make final call
   */
  async shortlistCandidates(screeningResults, maxShortlisted = 10) {
    // Filter only failed screenings (errors)
    const validResults = screeningResults.filter(r => r.success !== false);
    
    // Log for debugging
    console.log('=== SHORTLISTING: COMBINED SCORE RANKING ===');
    console.log(validResults.length + ' valid results from ' + screeningResults.length + ' total');
    
    // Percentile-normalize both score distributions before combining
    // This prevents one scoring method from dominating due to different distributions
    const smartScores = validResults.map(r => r.smartSearchScore || 0);
    const aiScores = validResults.map(r => r.screeningScore || r.matchScore || 0);
    
    const smartMin = Math.min(...smartScores, 0);
    const smartMax = Math.max(...smartScores, 1);
    const aiMin = Math.min(...aiScores, 0);
    const aiMax = Math.max(...aiScores, 1);
    
    const resultsWithCombinedScore = validResults.map(r => {
      const smartSearchScore = r.smartSearchScore || 0;
      const aiScreeningScore = r.screeningScore || r.matchScore || 0;
      
      // Min-max normalize both to 0-100 range
      const smartNorm = smartMax > smartMin 
        ? ((smartSearchScore - smartMin) / (smartMax - smartMin)) * 100 
        : smartSearchScore;
      const aiNorm = aiMax > aiMin 
        ? ((aiScreeningScore - aiMin) / (aiMax - aiMin)) * 100 
        : aiScreeningScore;
      
      // Weighted combination: prioritize smart search score (60%) + AI screening (40%)
      const combinedScore = (smartNorm * 0.6) + (aiNorm * 0.4);
      
      return {
        ...r,
        smartSearchScore,
        aiScreeningScore,
        combinedScore
      };
    });
    
    // Sort by COMBINED score (highest first)
    const sorted = resultsWithCombinedScore.sort((a, b) => b.combinedScore - a.combinedScore);
    
    // Log sorted results
    sorted.slice(0, 10).forEach((r, i) => {
      console.log('  ' + (i+1) + '. ' + r.candidateName + ': combined=' + r.combinedScore.toFixed(1) + ' (smartSearch=' + r.smartSearchScore + ', ai=' + r.aiScreeningScore + ') decision=' + r.decision);
    });
    
    // Take TOP N candidates - don't filter by AI decision
    // The recruiter should see the best matches and decide themselves
    const result = sorted.slice(0, maxShortlisted);
    
    console.log(`Final shortlist: ${result.length} candidates (max ${maxShortlisted}, ranked by combined smart search + AI score)`);
    return result;
  }

  /**
   * Calculate total years of experience
   */
  calculateTotalYearsExperience(experience) {
    if (!experience || !Array.isArray(experience)) return 0;
    
    let totalMonths = 0;
    const now = new Date();
    
    experience.forEach(exp => {
      try {
        const startDate = exp.startDate ? new Date(exp.startDate) : null;
        const endDate = exp.current || !exp.endDate ? now : new Date(exp.endDate);
        
        if (startDate && !isNaN(startDate.getTime())) {
          const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 
            + (endDate.getMonth() - startDate.getMonth());
          totalMonths += Math.max(0, months);
        }
      } catch (e) {
        // Skip invalid entries
      }
    });
    
    return Math.round(totalMonths / 12 * 10) / 10;
  }

  /**
   * Calculate profile completeness score
   */
  calculateProfileCompleteness(profile) {
    let completeness = 0;
    if (profile.summary) completeness += 15;
    if (profile.experience && profile.experience.length > 0) completeness += 25;
    if (profile.education && profile.education.length > 0) completeness += 15;
    if (profile.projects && profile.projects.length > 0) completeness += 15;
    if (Object.values(profile.skills || {}).flat().length > 0) completeness += 20;
    if (profile.linkedinUrl || profile.githubUrl) completeness += 10;
    return completeness;
  }

  /**
   * Send email outreach to shortlisted candidates
   */
  async sendOutreach(negotiations, job) {
    const { Interview } = require('../models');
    
    for (const negotiation of negotiations) {
      const candidate = await User.findByPk(negotiation.candidateId);
      if (candidate) {
        // Send email notification
        await emailService.sendShortlistNotification(candidate, job, job.recruiter);
        
        // Check if interview already exists (may have been created by Agent Arena)
        const existingInterview = await Interview.findOne({
          where: {
            jobId: job.id,
            candidateId: candidate.id,
            status: { [Op.in]: ['pending', 'confirmed'] }
          }
        });
        
        if (existingInterview) {
          console.log(`Interview already exists for candidate ${candidate.email} - skipping duplicate creation and message`);
          continue;
        }
        
        // Auto-create Interview record with proposed time slots
        // This allows candidate to formally accept and trigger phone screening
        const slots = this.generateSchedulingSlots();
        const proposedSlots = slots.slice(0, 5); // Offer first 5 available slots
        
        try {
          // Create interview with phone screening enabled
          const interview = await Interview.create({
            jobId: job.id,
            candidateId: candidate.id,
            recruiterId: job.userId,
            proposedSlots: proposedSlots,
            type: 'screening',
            format: 'phone',
            duration: 30,
            phoneScreeningEnabled: true,
            phoneScreeningDuration: 15,
            status: 'pending',
            recruiterNotes: `AI-generated candidate with score: ${negotiation.screeningScore}%`
          });
          
          // Send the scheduling message via Interview system (not duplicate message)
          await this.sendInterviewSchedulingMessage(candidate, job, interview, proposedSlots, negotiation.screeningScore);
          
          console.log(`✅ Created interview ${interview.id} for candidate ${candidate.email}`);
        } catch (error) {
          console.error(`Failed to create interview for ${candidate.email}:`, error.message);
          // Still send notification email even if interview creation fails
        }
      }
    }
  }

  /**
   * Send interview scheduling message to candidate
   * This integrates with the Interview system so candidates can formally accept slots
   */
  async sendInterviewSchedulingMessage(candidate, job, interview, proposedSlots, fitScore) {
    try {
      const recruiterId = job.userId;
      const { Conversation, Message } = require('../models');
      
      // Find or create conversation between recruiter and candidate
      let conversation = await Conversation.findOne({
        where: {
          [Op.or]: [
            { participant1Id: recruiterId, participant2Id: candidate.id },
            { participant1Id: candidate.id, participant2Id: recruiterId }
          ]
        }
      });

      if (!conversation) {
        const [p1, p2] = [recruiterId, candidate.id].sort();
        conversation = await Conversation.create({
          participant1Id: p1,
          participant2Id: p2,
          lastMessageAt: new Date()
        });
      }

      // Format slots for message
      const slotsText = proposedSlots.map((slot, i) => {
        const date = new Date(slot.datetime);
        return `${i + 1}. ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }).join('\n');

      const messageContent = `Hi ${candidate.firstName},

Congratulations! You've been shortlisted for the ${job.title} position at ${job.company}.

Our AI screening identified you as a top match with a compatibility score of ${fitScore}%.

Next Step: Schedule Your AI Screening Call

Please select one of the following times for a brief 30-minute screening call:

${slotsText}

The call will include an automated AI phone screening (15 minutes) to discuss your background, followed by any questions you have.

To confirm, visit your dashboard and accept a time slot, or reply with your preferred time.

Looking forward to speaking with you!

Best regards,
${job.recruiter.firstName} ${job.recruiter.lastName}
${job.company}`;

      // Create the message linked to the interview
      const message = await Message.create({
        conversationId: conversation.id,
        senderId: recruiterId,
        content: messageContent,
        metadata: {
          type: 'interview_request',
          interviewId: interview.id,
          proposedSlots: proposedSlots
        }
      });
      
      // Link message to interview
      await interview.update({ messageId: message.id });

      // Update conversation
      await conversation.update({
        lastMessageAt: new Date(),
        lastMessagePreview: `🎉 Congratulations! You've been shortlisted for ${job.title}...`
      });

      console.log(`Sent interview scheduling message to ${candidate.email} for job ${job.title}`);
      return message;
    } catch (error) {
      console.error('Error sending interview scheduling message:', error);
      // Don't throw - we don't want to fail the whole process if messaging fails
    }
  }

  /**
   * Generate available scheduling slots for the next 7 days
   */
  generateSchedulingSlots() {
    const slots = [];
    const now = new Date();
    
    for (let day = 1; day <= 7; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      // Generate slots at 9 AM, 11 AM, 2 PM, 4 PM
      const hours = [9, 11, 14, 16];
      for (const hour of hours) {
        const slotDate = new Date(date);
        slotDate.setHours(hour, 0, 0, 0);
        
        // Only future slots
        if (slotDate > now) {
          slots.push({
            datetime: slotDate.toISOString(),
            display: slotDate.toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            }) + ' at ' + slotDate.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            })
          });
        }
      }
    }
    
    return slots;
  }

  /**
   * Start AI screening for manually selected candidates
   * Called after recruiter reviews Smart Search results and selects candidates
   * @param {UUID} jobId - The job ID
   * @param {Array<UUID>} selectedCandidateIds - IDs of candidates to screen
   */
  async startScreeningForSelected(jobId, selectedCandidateIds) {
    console.log(`Starting AI screening for ${selectedCandidateIds.length} selected candidates`);
    
    const screening = await JobScreening.findOne({ where: { jobId } });
    if (!screening) {
      throw new Error('No screening record found for this job');
    }
    
    if (!['search_complete', 'failed'].includes(screening.status)) {
      throw new Error(`Cannot start screening: current status is ${screening.status}`);
    }
    
    const job = await Job.findByPk(jobId, {
      include: [{ model: User, as: 'recruiter' }]
    });
    
    if (!job) {
      throw new Error('Job not found');
    }
    
    try {
      // Save selected candidate IDs
      await screening.update({
        selectedCandidateIds,
        status: 'screening',
        currentPhase: 'screening',
        currentStep: `Starting AI screening for ${selectedCandidateIds.length} selected candidates...`,
        progressPercent: 40
      });
      
      // Fetch full candidate profiles
      const candidates = await Profile.findAll({
        where: {
          userId: { [Op.in]: selectedCandidateIds }
        },
        include: [{ 
          model: User, 
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }]
      });
      
      console.log(`Loaded ${candidates.length} candidate profiles for screening`);
      
      // Get screening config
      const screeningConfig = screening.screeningConfig || {};
      const useAgentArena = featureFlags.recruiterAgentArena && screeningConfig.useAgentArena !== false;
      
      // Screen candidates
      let screeningResults;
      if (useAgentArena) {
        console.log('Using Agent Arena screening for selected candidates...');
        screeningResults = await this.screenCandidatesWithAgentArena(job, candidates, screening);
      } else {
        console.log('Using fast AI screening for selected candidates...');
        screeningResults = await this.screenCandidates(job, candidates, screening);
      }
      
      // Shortlist
      await screening.update({ 
        currentStep: 'Selecting top candidates...',
        progressPercent: 90
      });
      
      const shortlisted = await this.shortlistCandidates(screeningResults, screeningConfig.maxShortlisted || 10);
      console.log(`Shortlisted ${shortlisted.length} candidates from selection.`);
      
      // Format and save results
      const shortlistedData = await this.formatShortlistedCandidates(shortlisted);
      await this.createApplicationsForShortlisted(jobId, shortlistedData);
      
      await screening.update({
        status: 'completed',
        currentPhase: null,
        shortlisted: shortlistedData,
        completedAt: new Date(),
        currentStep: `Completed. Shortlisted ${shortlisted.length} candidates.`,
        progressPercent: 100
      });
      
      // Send outreach
      await this.sendOutreach(shortlisted, job);
      
      return shortlisted;
    } catch (error) {
      console.error('Screening selected candidates failed:', error);
      await screening.update({
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date()
      });
      throw error;
    }
  }
  /**
   * Cancel a running screening drive.
   * Sets status to 'failed' with a sentinel error message that _isCancelled() checks for.
   */
  async cancelScreening(jobId) {
    const screening = await JobScreening.findOne({ where: { jobId } });
    if (!screening) {
      throw new Error('No screening record found for this job');
    }
    if (!['searching', 'screening', 'search_complete'].includes(screening.status)) {
      throw new Error(`Cannot cancel screening in status: ${screening.status}`);
    }
    await screening.update({
      status: 'failed',
      errorMessage: 'Cancelled by user',
      completedAt: new Date(),
      currentStep: 'Screening cancelled by recruiter.'
    });
    console.log(`Screening for job ${jobId} cancelled by user`);
    return { cancelled: true };
  }
}

module.exports = new RecruitmentService();
