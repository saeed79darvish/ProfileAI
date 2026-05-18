/**
 * Agent Arena Service
 * 
 * Orchestrates AI-to-AI negotiations between candidate and recruiter agents.
 * 
 * This service has been modularized into:
 * - ./agentArena/scheduling.js: Interview slot generation
 * - ./agentArena/helpers.js: Status helpers and utilities
 */

const { AgentNegotiation, NegotiationMessage, User, Profile, Job, CandidateInsights, Interview, Conversation, Message, RecruiterProfile, JobApplication } = require('../models');
const { Op } = require('sequelize');
const aiService = require('./aiService');
const candidateDataAggregator = require('./candidateDataAggregator');

// Import modular components
const { scheduling: arenaScheduling, helpers: arenaHelpers } = require('./agentArena');

/**
 * Agent Arena Service
 * Orchestrates AI-to-AI negotiations between candidate and recruiter agents
 * 
 * AUTONOMOUS CANDIDATE AGENT:
 * The candidate AI agent operates autonomously, providing accurate information
 * to recruiter agents based on the candidate's full profile, posts, projects,
 * and public activity - without candidate intervention or control.
 */
class AgentArenaService {

  /**
   * Get or generate candidate insights for autonomous agent
   * @param {number} candidateId - Candidate user ID  
   * @param {object} jobData - Job for context-specific analysis
   */
  async getCandidateInsights(candidateId, jobData) {
    try {
      // Aggregate all candidate data
      const aggregatedData = await candidateDataAggregator.aggregateCandidateData(candidateId, jobData);
      
      // Check for cached insights
      let insights = await CandidateInsights.findOne({ where: { userId: candidateId } });
      
      const needsRefresh = !insights || !insights.isValid();
      
      if (needsRefresh) {
        // Generate fresh AI analysis
        const [strengthsAnalysis, fitAssessment] = await Promise.all([
          aiService.analyzeCandidateStrengthsWithEvidence(aggregatedData, jobData),
          aiService.assessFitHonestly(aggregatedData, jobData)
        ]);

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const insightsData = {
          userId: candidateId,
          aggregatedData,
          strengthsAnalysis,
          generalFitProfile: fitAssessment,
          topSkills: aggregatedData.skills.all.slice(0, 10),
          topStrengths: strengthsAnalysis.provenStrengths?.slice(0, 5) || [],
          experienceYears: aggregatedData.metrics.totalYearsExperience,
          projectsCount: aggregatedData.metrics.projectsCount,
          postsCount: aggregatedData.metrics.postsCount,
          profileCompleteness: aggregatedData.metrics.profileCompleteness,
          generatedAt: new Date(),
          expiresAt,
          aiProcessingTimeMs: (strengthsAnalysis.processingTimeMs || 0) + (fitAssessment.processingTimeMs || 0),
          aiTokensUsed: (strengthsAnalysis.tokensUsed || 0) + (fitAssessment.tokensUsed || 0)
        };

        if (insights) {
          await insights.update({
            ...insightsData,
            regenerationCount: insights.regenerationCount + 1
          });
        } else {
          insights = await CandidateInsights.create(insightsData);
        }
      }

      // Add job-specific assessment to cache (reuse fitAssessment from above if same job)
      if (jobData && jobData.id) {
        const existingJobAssessment = insights.getJobAssessment(jobData.id);
        if (!existingJobAssessment) {
          // Reuse fitAssessment if it was just generated (needsRefresh was true), otherwise generate new
          const jobFitAssessment = needsRefresh ? insights.generalFitProfile : await aiService.assessFitHonestly(aggregatedData, jobData);
          await insights.addJobAssessment(jobData.id, jobFitAssessment);
        }
      }

      // Record usage
      await insights.recordUsage();

      return {
        aggregatedData,
        strengthsAnalysis: insights.strengthsAnalysis,
        fitAssessment: insights.generalFitProfile,
        cached: !needsRefresh
      };
    } catch (error) {
      console.error('Error getting candidate insights:', error);
      // Fallback to basic data if insights generation fails
      const aggregatedData = await candidateDataAggregator.aggregateCandidateData(candidateId, jobData);
      return { aggregatedData, strengthsAnalysis: null, fitAssessment: null, cached: false };
    }
  }
  
  /**
   * Initialize a new agent negotiation
   * @param {string} initiatorType - 'candidate' or 'recruiter'
   * @param {string} jobId - The job being discussed
   * @param {string} candidateId - The candidate user ID
   * @param {string} recruiterId - The recruiter user ID (job owner)
   * @param {object} agentContext - Context for the initiating agent
   * @param {string} type - 'negotiation' or 'screening' (default: 'negotiation')
   */
  async initiateNegotiation(initiatorType, jobId, candidateId, recruiterId, agentContext = {}, type = 'negotiation') {
    try {
      // Prevent duplicate active negotiations (can be disabled with env var for dev)
      if (!process.env.DISABLE_NEGOTIATION_DUPE_CHECK) {
        // Only block truly in-progress negotiations, not completed/terminal ones.
        // This allows re-screening the same candidate for the same job.
        const activeStatuses = ['pending', 'negotiating'];
        const existing = await AgentNegotiation.findOne({
          where: { 
            jobId, 
            candidateId,
            status: { [Op.in]: activeStatuses }
          }
        });
        if (existing) {
          throw new Error('A negotiation already exists for this job and candidate');
        }
      }

      // Fetch all required data
      const [job, candidateUser, recruiterUser, candidateProfile] = await Promise.all([
        Job.findByPk(jobId),
        User.findByPk(candidateId),
        User.findByPk(recruiterId),
        Profile.findOne({ 
          where: { userId: candidateId },
          include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }]
        })
      ]);

      if (!job) throw new Error('Job not found');
      if (!candidateUser) throw new Error('Candidate not found');
      if (!recruiterUser) throw new Error('Recruiter not found');
      if (!candidateProfile) throw new Error('Candidate profile not found');

      // Create the negotiation record
      const negotiation = await AgentNegotiation.create({
        jobId,
        candidateId,
        recruiterId,
        initiatorType,
        type,
        status: 'negotiating',
        candidateAgentContext: initiatorType === 'candidate' ? agentContext : {},
        recruiterAgentContext: initiatorType === 'recruiter' ? agentContext : {},
        startedAt: new Date(),
        lastAgentTurn: 'none'
      });

      // ========================================
      // AUTONOMOUS CANDIDATE AGENT DATA GATHERING
      // Gather comprehensive candidate data behind the scenes
      // ========================================
      const candidateInsights = await this.getCandidateInsights(candidateId, job);
      const { aggregatedData, strengthsAnalysis, fitAssessment } = candidateInsights;

      // Legacy profile data for backward compatibility
      const profileData = {
        firstName: candidateProfile.user.firstName,
        lastName: candidateProfile.user.lastName,
        title: candidateProfile.title,
        summary: candidateProfile.summary,
        skills: candidateProfile.skills,
        experience: candidateProfile.experience,
        education: candidateProfile.education,
        projects: candidateProfile.projects,
        aiStrengths: candidateProfile.aiStrengths,
        location: candidateProfile.location
      };

      // Generate the opening message
      let aiResponse;
      let agentRole;

      if (initiatorType === 'candidate') {
        // Candidate is applying - use AUTONOMOUS agent with full data
        agentRole = 'candidate_agent';
        
        if (strengthsAnalysis && fitAssessment) {
          // Use enhanced autonomous pitch with evidence
          aiResponse = await aiService.generateAutonomousCandidatePitch(
            aggregatedData,
            job,
            strengthsAnalysis,
            fitAssessment
          );
        } else {
          // Fallback to basic pitch
          aiResponse = await aiService.candidateAgentPitch(profileData, job, agentContext);
        }
      } else {
        // Recruiter is scouting - generate outreach
        agentRole = 'recruiter_agent';
        aiResponse = await aiService.recruiterAgentScout(job, profileData, agentContext);
      }

      // Save the opening message
      await NegotiationMessage.create({
        negotiationId: negotiation.id,
        agentRole,
        content: aiResponse.content,
        internalReasoning: aiResponse.reasoning || aiResponse.internalReasoning,
        messageType: 'opening_pitch',
        sentiment: aiResponse.sentiment || 'positive',
        confidenceScore: aiResponse.confidenceScore || 80,
        roundNumber: 1,
        tokensUsed: aiResponse.tokensUsed || 0,
        processingTimeMs: aiResponse.processingTimeMs || 0,
        // Store autonomous agent metadata
        metadata: aiResponse.autonomous ? {
          autonomous: true,
          evidenceCited: aiResponse.evidenceCited,
          proactiveDisclosures: aiResponse.proactiveDisclosures,
          dataSourcesUsed: aiResponse.dataSourcesUsed
        } : null
      });

      // Update negotiation with initial scores
      const updateData = {
        roundCount: 1,
        lastAgentTurn: agentRole
      };

      if (initiatorType === 'candidate' && aiResponse.matchAnalysis) {
        updateData.interestScore = aiResponse.initialInterestLevel || aiResponse.matchAnalysis.overallFit;
      } else if (aiResponse.initialFitAssessment) {
        updateData.fitScore = aiResponse.initialFitAssessment.overallFit;
      }

      await negotiation.update(updateData);

      // Fetch and return the complete negotiation with messages
      return this.getNegotiationWithMessages(negotiation.id);
    } catch (error) {
      console.error('Error initiating negotiation:', error);
      throw error;
    }
  }

  /**
   * Run the next round of negotiation
   * The other agent responds to the last message
   */
  async continueNegotiation(negotiationId) {
    try {
      const negotiation = await AgentNegotiation.findByPk(negotiationId, {
        include: [
          { model: Job, as: 'job' },
          { model: User, as: 'candidate' },
          { model: User, as: 'recruiter' }
        ]
      });

      if (!negotiation) throw new Error('Negotiation not found');
      if (negotiation.status !== 'negotiating') {
        throw new Error(`Negotiation is not active (status: ${negotiation.status})`);
      }
      if (negotiation.roundCount >= negotiation.maxRounds) {
        // Max rounds reached, force a decision
        return this.forceDecision(negotiationId);
      }

      // Get conversation history
      const messages = await NegotiationMessage.findAll({
        where: { negotiationId },
        order: [['roundNumber', 'ASC'], ['createdAt', 'ASC']]
      });

      // ========================================
      // AUTONOMOUS CANDIDATE AGENT DATA GATHERING
      // Get comprehensive candidate data for evidence-based responses
      // ========================================
      const candidateInsights = await this.getCandidateInsights(negotiation.candidateId, negotiation.job);
      const { aggregatedData, strengthsAnalysis, fitAssessment } = candidateInsights;

      // Legacy profile data for recruiter agent and backward compatibility
      const candidateProfile = await Profile.findOne({
        where: { userId: negotiation.candidateId },
        include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName'] }]
      });

      const profileData = {
        firstName: candidateProfile.user.firstName,
        lastName: candidateProfile.user.lastName,
        title: candidateProfile.title,
        summary: candidateProfile.summary,
        skills: candidateProfile.skills,
        experience: candidateProfile.experience,
        aiStrengths: candidateProfile.aiStrengths,
        location: candidateProfile.location
      };

      // Determine whose turn it is
      const lastTurn = negotiation.lastAgentTurn;
      const nextAgent = lastTurn === 'candidate_agent' ? 'recruiter_agent' : 'candidate_agent';
      const newRound = negotiation.roundCount + 1;

      // Generate response based on whose turn it is
      let aiResponse;
      const conversationHistory = messages.map(m => ({
        agentRole: m.agentRole,
        content: m.content,
        messageType: m.messageType
      }));

      if (negotiation.type === 'screening') {
        // ========================================
        // SCREENING MODE
        // ========================================
        if (nextAgent === 'candidate_agent') {
          aiResponse = await aiService.candidateAgentScreen(
            profileData, 
            negotiation.job, 
            conversationHistory, 
            negotiation.candidateAgentContext
          );
        } else {
          aiResponse = await aiService.recruiterAgentScreen(
            negotiation.job, 
            profileData, 
            conversationHistory, 
            negotiation.recruiterAgentContext
          );
        }
      } else if (nextAgent === 'candidate_agent') {
        // ========================================
        // AUTONOMOUS CANDIDATE AGENT RESPONSE
        // Uses full aggregated data with evidence
        // ========================================
        const lastRecruiterMsg = messages.filter(m => m.agentRole === 'recruiter_agent').pop();
        
        if (messages.length === 1 && negotiation.initiatorType === 'recruiter') {
          // Candidate agent evaluating recruiter's scout - still use old method
          // as it's about evaluation, not pitching
          aiResponse = await aiService.candidateAgentEvaluateOpportunity(
            profileData,
            negotiation.job,
            lastRecruiterMsg.content,
            negotiation.candidateAgentContext
          );
        } else if (strengthsAnalysis && aggregatedData) {
          // Use AUTONOMOUS response with evidence lookup
          aiResponse = await aiService.generateAutonomousCandidateResponse(
            aggregatedData,
            negotiation.job,
            conversationHistory,
            strengthsAnalysis
          );
        } else {
          // Fallback to basic response
          aiResponse = await aiService.candidateAgentRespond(
            profileData,
            negotiation.job,
            conversationHistory,
            negotiation.candidateAgentContext
          );
        }
      } else {
        // Recruiter agent's turn (unchanged - recruiter doesn't need autonomous mode)
        const lastCandidateMsg = messages.filter(m => m.agentRole === 'candidate_agent').pop();
        
        if (messages.length === 1 && negotiation.initiatorType === 'candidate') {
          // Recruiter agent evaluating candidate's application
          aiResponse = await aiService.recruiterAgentEvaluate(
            negotiation.job,
            profileData,
            lastCandidateMsg.content,
            negotiation.recruiterAgentContext
          );
        } else {
          // Ongoing conversation
          aiResponse = await aiService.recruiterAgentRespond(
            negotiation.job,
            profileData,
            conversationHistory,
            negotiation.recruiterAgentContext
          );
        }
      }

      // Save the new message with autonomous metadata
      await NegotiationMessage.create({
        negotiationId,
        agentRole: nextAgent,
        content: aiResponse.content,
        internalReasoning: aiResponse.reasoning || aiResponse.internalReasoning,
        messageType: aiResponse.messageType || 'answer',
        sentiment: aiResponse.sentiment || 'neutral',
        confidenceScore: aiResponse.confidenceScore || 75,
        proposedTerms: aiResponse.proposedTerms,
        roundNumber: newRound,
        tokensUsed: aiResponse.tokensUsed || 0,
        processingTimeMs: aiResponse.processingTimeMs || 0,
        // Store autonomous agent metadata if present
        metadata: aiResponse.autonomous ? {
          autonomous: true,
          questionsAnswered: aiResponse.questionsAnswered,
          evidenceCited: aiResponse.evidenceCited,
          honestAdmissions: aiResponse.honestAdmissions
        } : null
      });

      // Update scores and turn
      const updateData = {
        roundCount: newRound,
        lastAgentTurn: nextAgent
      };

      if (negotiation.type === 'screening') {
        if (nextAgent === 'recruiter_agent' && aiResponse.screeningScore) {
          updateData.screeningScore = aiResponse.screeningScore;
        }
        if (aiResponse.isComplete) {
           if (aiResponse.decision === 'pass') updateData.status = 'recruiter_shortlisted';
           else if (aiResponse.decision === 'fail') updateData.status = 'candidate_declined';
        }
      } else {
        if (nextAgent === 'candidate_agent') {
          updateData.interestScore = aiResponse.currentInterestLevel || aiResponse.interestLevel || negotiation.interestScore;
        } else {
          updateData.fitScore = aiResponse.currentFitScore || negotiation.fitScore;
        }
      }

      // Check if agent is ready to decide
      if (aiResponse.readyToDecide || aiResponse.nextAction === 'decline') {
        // One agent wants to conclude
        updateData.status = 'negotiating'; // Still negotiating until both decide
      }

      await negotiation.update(updateData);

      return this.getNegotiationWithMessages(negotiationId);
    } catch (error) {
      console.error('Error continuing negotiation:', error);
      throw error;
    }
  }

  /**
   * Run multiple rounds until a conclusion is reached
   */
  async runFullNegotiation(negotiationId, maxRounds = 5) {
    try {
      let negotiation = await AgentNegotiation.findByPk(negotiationId);
      
      if (!negotiation) throw new Error('Negotiation not found');
      if (negotiation.status !== 'negotiating') {
        throw new Error(`Negotiation is not active (status: ${negotiation.status})`);
      }

      const roundsToRun = Math.min(maxRounds, negotiation.maxRounds - negotiation.roundCount);
      
      for (let i = 0; i < roundsToRun; i++) {
        await this.continueNegotiation(negotiationId);
        
        // Refresh negotiation status
        negotiation = await AgentNegotiation.findByPk(negotiationId);
        
        // Stop if negotiation concluded
        if (negotiation.status !== 'negotiating') break;
        
        // Check if we should conclude (both agents exchanged enough)
        if (negotiation.roundCount >= negotiation.maxRounds) {
          // Respect the model's maxRounds setting
          break;
        }
      }

      // After running rounds, get final decisions
      return this.concludeNegotiation(negotiationId);
    } catch (error) {
      console.error('Error running full negotiation:', error);
      throw error;
    }
  }

  /**
   * Get both agents to make final decisions
   */
  async concludeNegotiation(negotiationId) {
    try {
      const negotiation = await AgentNegotiation.findByPk(negotiationId, {
        include: [{ model: Job, as: 'job' }]
      });

      if (!negotiation) throw new Error('Negotiation not found');
      if (negotiation.status !== 'negotiating') {
        return this.getNegotiationWithMessages(negotiationId);
      }

      // Get conversation history
      const messages = await NegotiationMessage.findAll({
        where: { negotiationId },
        order: [['roundNumber', 'ASC'], ['createdAt', 'ASC']]
      });

      // ========================================
      // AUTONOMOUS CANDIDATE AGENT FINAL DECISION
      // Uses comprehensive data for informed decision
      // ========================================
      const candidateInsights = await this.getCandidateInsights(negotiation.candidateId, negotiation.job);
      const { aggregatedData, fitAssessment } = candidateInsights;

      // Legacy profile data for recruiter agent
      const candidateProfile = await Profile.findOne({
        where: { userId: negotiation.candidateId },
        include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName'] }]
      });

      const profileData = {
        firstName: candidateProfile.user.firstName,
        lastName: candidateProfile.user.lastName,
        title: candidateProfile.title,
        summary: candidateProfile.summary,
        skills: candidateProfile.skills,
        experience: candidateProfile.experience,
        aiStrengths: candidateProfile.aiStrengths
      };

      const conversationHistory = messages.map(m => ({
        agentRole: m.agentRole,
        content: m.content,
        messageType: m.messageType
      }));

      // Get decisions from both agents
      // Candidate uses AUTONOMOUS decision-making with full data
      let candidateDecision;
      if (aggregatedData && fitAssessment) {
        candidateDecision = await aiService.makeAutonomousCandidateDecision(
          aggregatedData,
          negotiation.job,
          conversationHistory,
          fitAssessment
        );
      } else {
        // Fallback to basic decision
        candidateDecision = await aiService.candidateAgentDecide(
          profileData,
          negotiation.job,
          conversationHistory,
          negotiation.candidateAgentContext
        );
      }

      // Recruiter decision (unchanged)
      const recruiterDecision = await aiService.recruiterAgentDecide(
        negotiation.job,
        profileData,
        conversationHistory,
        negotiation.recruiterAgentContext
      );

      const newRound = negotiation.roundCount + 1;

      // Save both decision messages
      await Promise.all([
        NegotiationMessage.create({
          negotiationId,
          agentRole: 'candidate_agent',
          content: candidateDecision.content,
          internalReasoning: candidateDecision.reasoning,
          messageType: candidateDecision.messageType || 'summary',
          sentiment: candidateDecision.decision === 'interested' ? 'positive' : 
                    candidateDecision.decision === 'not_interested' ? 'negative' : 'neutral',
          confidenceScore: candidateDecision.confidenceScore || 85,
          roundNumber: newRound,
          tokensUsed: candidateDecision.tokensUsed || 0,
          processingTimeMs: candidateDecision.processingTimeMs || 0
        }),
        NegotiationMessage.create({
          negotiationId,
          agentRole: 'recruiter_agent',
          content: recruiterDecision.content,
          internalReasoning: recruiterDecision.reasoning,
          messageType: recruiterDecision.messageType || 'summary',
          sentiment: recruiterDecision.decision === 'shortlist' ? 'positive' : 
                    recruiterDecision.decision === 'reject' ? 'negative' : 'neutral',
          confidenceScore: recruiterDecision.confidenceScore || 85,
          roundNumber: newRound,
          tokensUsed: recruiterDecision.tokensUsed || 0,
          processingTimeMs: recruiterDecision.processingTimeMs || 0
        })
      ]);

      // Determine final status based on both decisions
      let finalStatus;
      const candidateInterested = candidateDecision.decision === 'interested';
      const recruiterShortlisted = recruiterDecision.decision === 'shortlist';
      const candidateDeclined = candidateDecision.decision === 'not_interested';
      const recruiterRejected = recruiterDecision.decision === 'reject';

      if (candidateInterested && recruiterShortlisted) {
        finalStatus = 'mutual_match';
      } else if (candidateDeclined) {
        finalStatus = 'candidate_declined';
      } else if (recruiterRejected) {
        finalStatus = 'recruiter_rejected';
      } else if (candidateInterested) {
        finalStatus = 'candidate_interested';
      } else if (recruiterShortlisted) {
        finalStatus = 'recruiter_shortlisted';
      } else {
        finalStatus = 'expired'; // Both agents unsure
      }

      // Build outcome summary
      const outcome = {
        summary: `Negotiation concluded after ${newRound} rounds.`,
        candidateVerdict: candidateDecision.decision,
        recruiterVerdict: recruiterDecision.decision,
        candidateSummary: candidateDecision.summary,
        recruiterSummary: recruiterDecision.summary,
        recommendedNextSteps: [
          ...(candidateDecision.recommendedNextSteps || []),
          ...(recruiterDecision.recommendedNextSteps || [])
        ],
        finalScores: {
          candidateInterest: candidateDecision.finalInterestScore,
          recruiterFit: recruiterDecision.finalFitScore
        }
      };

      // Update negotiation with final status
      await negotiation.update({
        status: finalStatus,
        roundCount: newRound,
        completedAt: new Date(),
        interestScore: candidateDecision.finalInterestScore || negotiation.interestScore,
        fitScore: recruiterDecision.finalFitScore || negotiation.fitScore,
        outcome
      });

      // Add system message about outcome
      await NegotiationMessage.create({
        negotiationId,
        agentRole: 'system',
        content: this.getOutcomeMessage(finalStatus),
        messageType: 'system',
        sentiment: finalStatus === 'mutual_match' ? 'positive' : 'neutral',
        roundNumber: newRound
      });

      // If mutual match or recruiter shortlisted, sync to applications
      if (finalStatus === 'mutual_match' || finalStatus === 'recruiter_shortlisted') {
        await this.syncToShortlist(negotiation, candidateDecision, recruiterDecision);
        
        // If mutual match, also auto-schedule interview
        if (finalStatus === 'mutual_match') {
          await this.autoScheduleInterview(negotiation);
        }
      }

      return this.getNegotiationWithMessages(negotiationId);
    } catch (error) {
      console.error('Error concluding negotiation:', error);
      throw error;
    }
  }

  /**
   * Force a decision when max rounds reached
   */
  async forceDecision(negotiationId) {
    return this.concludeNegotiation(negotiationId);
  }

  /**
   * Human takes over the negotiation
   */
  async humanTakeover(negotiationId, userId, action, note) {
    try {
      const negotiation = await AgentNegotiation.findByPk(negotiationId);
      
      if (!negotiation) throw new Error('Negotiation not found');

      // Verify user is part of this negotiation
      if (userId !== negotiation.candidateId && userId !== negotiation.recruiterId) {
        throw new Error('You are not authorized to intervene in this negotiation');
      }

      const isCandidate = userId === negotiation.candidateId;
      
      // Update negotiation status
      await negotiation.update({
        status: 'human_takeover',
        humanIntervenedAt: new Date(),
        humanIntervenedBy: userId
      });

      // Add system message
      await NegotiationMessage.create({
        negotiationId,
        agentRole: 'system',
        content: `${isCandidate ? 'Candidate' : 'Recruiter'} has taken over this negotiation. Action: ${action}. ${note ? `Note: ${note}` : ''}`,
        messageType: 'system',
        sentiment: 'neutral',
        roundNumber: negotiation.roundCount + 1
      });

      return this.getNegotiationWithMessages(negotiationId);
    } catch (error) {
      console.error('Error in human takeover:', error);
      throw error;
    }
  }

  /**
   * Sync negotiation match to JobApplication (shortlist)
   * Creates or updates JobApplication when agent arena negotiation results in match
   */
  async syncToShortlist(negotiation, candidateDecision, recruiterDecision) {
    try {
      console.log(`🔄 Syncing agent arena match to shortlist for negotiation ${negotiation.id}`);
      
      const candidate = await User.findByPk(negotiation.candidateId, {
        include: [{ model: Profile, as: 'profile' }]
      });
      
      if (!candidate) {
        console.error('Candidate not found for shortlist sync');
        return;
      }

      const fitScore = recruiterDecision.finalFitScore || negotiation.fitScore || 70;
      const interestScore = candidateDecision.finalInterestScore || negotiation.interestScore || 70;
      const matchScore = Math.round((fitScore + interestScore) / 2);

      // Check if application already exists
      const existing = await JobApplication.findOne({
        where: { 
          jobId: negotiation.jobId, 
          candidateId: negotiation.candidateId 
        }
      });

      const aiAnalysis = {
        fitScore,
        interestScore,
        matchScore,
        keyStrengths: recruiterDecision.keyStrengths || [],
        concerns: recruiterDecision.concerns || [],
        candidateSummary: candidateDecision.summary || '',
        recruiterSummary: recruiterDecision.summary || '',
        negotiationId: negotiation.id,
        source: 'agent_arena',
        decision: negotiation.status
      };

      if (existing) {
        // Update existing application
        await existing.update({
          status: 'shortlisted',
          aiMatchScore: matchScore,
          aiAnalysis: {
            ...existing.aiAnalysis,
            ...aiAnalysis
          }
        });
        console.log(`✅ Updated existing application for candidate ${candidate.firstName} ${candidate.lastName}`);
      } else {
        // Create new application
        await JobApplication.create({
          jobId: negotiation.jobId,
          candidateId: negotiation.candidateId,
          status: 'shortlisted',
          aiMatchScore: matchScore,
          aiAnalysis,
          source: 'agent_arena',
          answers: {},
          resumeUrl: null,
          coverLetter: null
        });
        console.log(`✅ Created shortlist application for candidate ${candidate.firstName} ${candidate.lastName}`);
      }
    } catch (error) {
      console.error('Error syncing to shortlist:', error);
      // Don't throw - this shouldn't break the negotiation flow
    }
  }

  /**
   * Create interview request when mutual match is reached
   * Interview is created with 'pending' status - candidate must confirm a time slot
   * SKIP if this is part of automated screening - let recruitmentService handle it
   */
  async autoScheduleInterview(negotiation) {
    try {
      // Check if this is automated screening - if so, skip interview creation
      // The recruitmentService will handle interview creation for all shortlisted candidates
      if (negotiation.context && negotiation.context.context === 'Automated Screening') {
        console.log(`⏭️  Skipping auto-schedule for automated screening - will be handled by recruitmentService`);
        return;
      }
      
      console.log(`🤖 Creating interview request for negotiation ${negotiation.id}`);
      
      // Get job and candidate info
      const job = await Job.findByPk(negotiation.jobId);
      const candidate = await User.findByPk(negotiation.candidateId);
      const recruiter = await User.findByPk(negotiation.recruiterId);
      
      if (!job || !candidate || !recruiter) {
        console.error('Missing job, candidate, or recruiter for interview scheduling');
        return;
      }

      // Get recruiter's availability settings
      const recruiterProfile = await RecruiterProfile.findOne({
        where: { userId: recruiter.id }
      });
      const availability = recruiterProfile?.availability || null;

      // Generate interview time slots based on recruiter's availability
      // Check for existing interviews to avoid conflicts
      const existingInterviews = await Interview.findAll({
        where: {
          recruiterId: recruiter.id,
          status: { [Op.in]: ['confirmed', 'pending'] }
        },
        attributes: ['scheduledAt']
      });
      
      const existingTimes = existingInterviews
        .filter(i => i.scheduledAt)
        .map(i => new Date(i.scheduledAt).getTime());
      
      const proposedSlots = this.generateInterviewSlots(existingTimes, availability);
      
      // Create interview with PENDING status - candidate must confirm
      const interview = await Interview.create({
        jobId: negotiation.jobId,
        candidateId: negotiation.candidateId,
        recruiterId: negotiation.recruiterId,
        proposedSlots,
        // scheduledAt is NOT set until candidate confirms
        type: 'screening',
        format: 'video',
        duration: availability?.preferredDuration || 30,
        status: 'pending', // Waiting for candidate confirmation
        recruiterNotes: `Interview request created by AI Agent after mutual match in Agent Arena negotiation. Awaiting candidate confirmation.`,
        candidateResponse: null // Will be filled when candidate responds
      });

      console.log(`✅ Interview request created (pending candidate confirmation)`);
      console.log(`   Interview ID: ${interview.id}`);
      console.log(`   Proposed slots: ${proposedSlots.map(s => s.label).join(', ')}`);

      // Send notification to candidate asking them to select a time
      await this.sendInterviewRequestNotification(recruiter, candidate, job, interview, proposedSlots);

      // Add system message to negotiation
      const slotsText = proposedSlots.map((s, i) => `${i + 1}. ${s.label}`).join('\n');
      await NegotiationMessage.create({
        negotiationId: negotiation.id,
        agentRole: 'system',
        content: `📅 Interview Request Sent!\n\n` +
                 `**${job.title}** at **${job.company}**\n\n` +
                 `The candidate has been asked to select from the following time slots:\n${slotsText}\n\n` +
                 `⏱️ Duration: 30 minutes\n` +
                 `🎥 Format: Video Call\n\n` +
                 `⏳ Waiting for ${candidate.firstName} to confirm their preferred time...`,
        messageType: 'system',
        sentiment: 'positive',
        roundNumber: negotiation.roundCount + 1
      });

      return interview;
    } catch (error) {
      console.error('Error creating interview request:', error);
      // Don't throw - this shouldn't break the negotiation flow
    }
  }

  /**
   * Send interview request notification to candidate asking them to select a time
   */
  async sendInterviewRequestNotification(recruiter, candidate, job, interview, proposedSlots) {
    try {
      // Find or create conversation between recruiter and candidate
      let conversation = await Conversation.findOne({
        where: {
          [Op.or]: [
            { participant1Id: recruiter.id, participant2Id: candidate.id },
            { participant1Id: candidate.id, participant2Id: recruiter.id }
          ]
        }
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participant1Id: recruiter.id,
          participant2Id: candidate.id,
          lastMessageAt: new Date()
        });
      }

      // Format the proposed slots for the message
      const slotsText = proposedSlots.map((s, i) => `   ${i + 1}. ${s.label}`).join('\n');

      // Send message from recruiter asking candidate to select a time
      const messageContent = 
        `🎉 Great news! Based on our successful AI Agent negotiation, I'd like to schedule an interview with you.\n\n` +
        `📋 **Position:** ${job.title} at ${job.company}\n` +
        `⏱️ **Duration:** 30 minutes\n` +
        `🎥 **Format:** Video Call\n\n` +
        `📅 **Please select your preferred time:**\n${slotsText}\n\n` +
        `You can confirm your preferred time slot in the Interviews section of your dashboard, or propose alternative times if these don't work for you.\n\n` +
        `Looking forward to hearing from you!`;

      await Message.create({
        conversationId: conversation.id,
        senderId: recruiter.id,
        content: messageContent,
        isRead: false,
        metadata: {
          type: 'interview_request',
          interviewId: interview.id,
          proposedSlots
        }
      });

      // Update conversation
      await conversation.update({
        lastMessageAt: new Date(),
        lastMessagePreview: 'Interview request sent! 📅'
      });

      console.log(`📧 Interview request sent to ${candidate.firstName} ${candidate.lastName}`);
    } catch (error) {
      console.error('Error sending interview request notification:', error);
    }
  }

  /**
   * Generate reasonable interview time slots based on recruiter's availability
   * @param {number[]} existingTimes - Array of existing interview times as timestamps
   * @param {Object} availability - Recruiter's availability settings from RecruiterProfile
   */
  generateInterviewSlots(existingTimes = [], availability = null) {
    const slots = [];
    const now = new Date();
    
    // Default working hours if no availability set
    const defaultWorkingHours = {
      1: { enabled: true, start: '09:00', end: '17:00' },
      2: { enabled: true, start: '09:00', end: '17:00' },
      3: { enabled: true, start: '09:00', end: '17:00' },
      4: { enabled: true, start: '09:00', end: '17:00' },
      5: { enabled: true, start: '09:00', end: '17:00' },
      0: { enabled: false },
      6: { enabled: false }
    };
    
    const workingHours = availability?.workingHours || defaultWorkingHours;
    const bufferTime = availability?.bufferTime || 15; // minutes
    const schedulingWindow = availability?.schedulingWindow || 14; // days
    const blockedSlots = availability?.blockedSlots || [];
    
    const formatSlot = (date) => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      const displayMinutes = minutes === 0 ? '' : `:${minutes.toString().padStart(2, '0')}`;
      const dayName = days[date.getDay()];
      const monthName = months[date.getMonth()];
      const dayOfMonth = date.getDate();
      const year = date.getFullYear();
      return {
        datetime: date.toISOString(),
        label: `${dayName}, ${monthName} ${dayOfMonth}, ${year} at ${displayHour}${displayMinutes} ${ampm}`
      };
    };

    // Check if a time slot conflicts with existing interviews (considering buffer)
    const hasConflict = (timestamp) => {
      const bufferMs = bufferTime * 60 * 1000;
      return existingTimes.some(existing => Math.abs(existing - timestamp) < (60 * 60 * 1000 + bufferMs));
    };
    
    // Check if slot is in a blocked time period
    const isBlocked = (slotDate) => {
      return blockedSlots.some(blocked => {
        if (blocked.type === 'recurring') {
          // Check if day of week and time match
          const dayMatch = blocked.dayOfWeek === slotDate.getDay();
          const startTime = blocked.start.split(':');
          const endTime = blocked.end.split(':');
          const slotHour = slotDate.getHours();
          const slotMinute = slotDate.getMinutes();
          const startHour = parseInt(startTime[0]);
          const endHour = parseInt(endTime[0]);
          return dayMatch && slotHour >= startHour && slotHour < endHour;
        } else {
          // One-time block - check exact date range
          const blockStart = new Date(blocked.start);
          const blockEnd = new Date(blocked.end);
          return slotDate >= blockStart && slotDate <= blockEnd;
        }
      });
    };

    // Generate hours array from working hours config
    const getAvailableHours = (dayOfWeek) => {
      const dayConfig = workingHours[dayOfWeek];
      if (!dayConfig || !dayConfig.enabled) return [];
      
      const startParts = dayConfig.start.split(':');
      const endParts = dayConfig.end.split(':');
      const startHour = parseInt(startParts[0]);
      const endHour = parseInt(endParts[0]);
      
      // Generate hour slots, skipping typical lunch hour (12-13)
      const hours = [];
      for (let h = startHour; h < endHour; h++) {
        if (h !== 12) { // Skip lunch hour
          hours.push(h);
        }
      }
      return hours;
    };

    // Generate slots for the scheduling window
    let currentDay = new Date(now);
    currentDay.setDate(currentDay.getDate() + 1); // Start from tomorrow
    currentDay.setMinutes(0, 0, 0);
    
    let daysChecked = 0;
    while (slots.length < 3 && daysChecked < schedulingWindow) {
      daysChecked++;
      const dayOfWeek = currentDay.getDay();
      const availableHours = getAvailableHours(dayOfWeek);
      
      // Skip days with no availability
      if (availableHours.length === 0) {
        currentDay.setDate(currentDay.getDate() + 1);
        continue;
      }

      // Try each available hour
      for (const hour of availableHours) {
        if (slots.length >= 3) break;
        
        const slotTime = new Date(currentDay);
        slotTime.setHours(hour, 0, 0, 0);
        
        // Skip if in the past
        if (slotTime.getTime() <= now.getTime()) continue;
        
        // Skip if conflicts with existing interviews
        if (hasConflict(slotTime.getTime())) continue;
        
        // Skip if in blocked time
        if (isBlocked(slotTime)) continue;
        
        // Check if we already have a slot at this time
        const alreadyHasSlot = slots.some(s => 
          new Date(s.datetime).getTime() === slotTime.getTime()
        );
        if (alreadyHasSlot) continue;
        
        slots.push(formatSlot(slotTime));
      }
      
      currentDay.setDate(currentDay.getDate() + 1);
    }

    // If we couldn't find 3 non-conflicting slots, generate fallback slots
    if (slots.length === 0) {
      const fallback = new Date(now);
      fallback.setDate(fallback.getDate() + 7);
      fallback.setHours(10, 0, 0, 0);
      // Find next working day
      let fallbackAttempts = 0;
      while (fallbackAttempts < 14) {
        const dayConfig = workingHours[fallback.getDay()];
        if (dayConfig && dayConfig.enabled) break;
        fallback.setDate(fallback.getDate() + 1);
        fallbackAttempts++;
      }
      slots.push(formatSlot(fallback));
    }

    return slots;
  }

  /**
   * Send interview confirmation notification after candidate confirms a time slot
   * This is called when interview status changes from 'pending' to 'confirmed'
   */
  async sendInterviewConfirmationNotification(recruiter, candidate, job, interview, selectedSlot) {
    try {
      // Find or create conversation between recruiter and candidate
      let conversation = await Conversation.findOne({
        where: {
          [Op.or]: [
            { participant1Id: recruiter.id, participant2Id: candidate.id },
            { participant1Id: candidate.id, participant2Id: recruiter.id }
          ]
        }
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participant1Id: recruiter.id,
          participant2Id: candidate.id,
          lastMessageAt: new Date()
        });
      }

      // Send confirmation message
      const messageContent = 
        `✅ Interview Confirmed!\n\n` +
        `📋 **Position:** ${job.title} at ${job.company}\n` +
        `📅 **Date/Time:** ${selectedSlot.label}\n` +
        `⏱️ **Duration:** 30 minutes\n` +
        `🎥 **Format:** Video Call\n` +
        `🔗 **Meeting Link:** ${interview.meetingLink}\n\n` +
        `The interview has been added to your calendar. Looking forward to speaking with you!`;

      await Message.create({
        conversationId: conversation.id,
        senderId: recruiter.id,
        content: messageContent,
        isRead: false,
        metadata: {
          type: 'interview_confirmed',
          interviewId: interview.id
        }
      });

      // Update conversation
      await conversation.update({
        lastMessageAt: new Date(),
        lastMessagePreview: 'Interview confirmed! ✅'
      });

      console.log(`📧 Interview confirmation sent to ${candidate.firstName} ${candidate.lastName}`);
    } catch (error) {
      console.error('Error sending interview confirmation:', error);
    }
  }

  /**
   * Get negotiation with all messages
   */
  async getNegotiationWithMessages(negotiationId) {
    const negotiation = await AgentNegotiation.findByPk(negotiationId, {
      include: [
        { 
          model: Job, 
          as: 'job',
          attributes: ['id', 'title', 'company', 'location', 'locationType', 'employmentType', 'salaryMin', 'salaryMax', 'salaryCurrency']
        },
        { 
          model: User, 
          as: 'candidate',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        { 
          model: User, 
          as: 'recruiter',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: NegotiationMessage,
          as: 'messages',
          order: [['roundNumber', 'ASC'], ['createdAt', 'ASC']]
        }
      ],
      order: [[{ model: NegotiationMessage, as: 'messages' }, 'roundNumber', 'ASC']]
    });

    return negotiation;
  }

  /**
   * Get all negotiations for a user (as candidate or recruiter)
   */
  async getUserNegotiations(userId, role = null) {
    const whereClause = role === 'candidate' 
      ? { candidateId: userId }
      : role === 'recruiter'
      ? { recruiterId: userId }
      : { 
          [require('sequelize').Op.or]: [
            { candidateId: userId },
            { recruiterId: userId }
          ]
        };

    return AgentNegotiation.findAll({
      where: whereClause,
      include: [
        { 
          model: Job, 
          as: 'job',
          attributes: ['id', 'title', 'company', 'location']
        },
        { 
          model: User, 
          as: 'candidate',
          attributes: ['id', 'firstName', 'lastName']
        },
        { 
          model: User, 
          as: 'recruiter',
          attributes: ['id', 'firstName', 'lastName']
        }
      ],
      order: [['updatedAt', 'DESC']]
    });
  }

  /**
   * Get outcome message based on status
   */
  getOutcomeMessage(status) {
    const messages = {
      'mutual_match': '🎉 Great news! Both agents have agreed this is a strong match. Time for the humans to connect!',
      'candidate_interested': '✅ The candidate is interested! Waiting for recruiter confirmation.',
      'recruiter_shortlisted': '✅ The recruiter has shortlisted this candidate! Waiting for candidate confirmation.',
      'candidate_declined': '❌ The candidate agent has determined this opportunity is not a good fit.',
      'recruiter_rejected': '❌ The recruiter agent has determined this candidate is not a good fit for this role.',
      'expired': '⏰ The negotiation has expired without a conclusion.',
      'human_takeover': '👤 A human has taken over this negotiation.'
    };
    return messages[status] || 'Negotiation status updated.';
  }

  /**
   * Check subscription limits for negotiations
   */
  async checkNegotiationLimits(userId, subscriptionTier) {
    const limits = {
      free: { active: 5, monthly: 10 },
      pro: { active: 10, monthly: 50 },
      enterprise: { active: -1, monthly: -1 } // unlimited
    };

    const limit = limits[subscriptionTier] || limits.free;
    
    // Count active negotiations
    const activeCount = await AgentNegotiation.count({
      where: {
        [require('sequelize').Op.or]: [
          { candidateId: userId },
          { recruiterId: userId }
        ],
        status: 'negotiating'
      }
    });

    // Count this month's negotiations
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyCount = await AgentNegotiation.count({
      where: {
        [require('sequelize').Op.or]: [
          { candidateId: userId },
          { recruiterId: userId }
        ],
        createdAt: {
          [require('sequelize').Op.gte]: startOfMonth
        }
      }
    });

    return {
      canCreate: (limit.active === -1 || activeCount < limit.active) && 
                 (limit.monthly === -1 || monthlyCount < limit.monthly),
      activeCount,
      monthlyCount,
      limits: limit,
      tier: subscriptionTier
    };
  }

  /**
   * Initiate a reschedule negotiation between candidate and recruiter agents
   * @param {string} interviewId - The interview to reschedule
   * @param {string} candidateId - The candidate requesting reschedule
   * @param {object} rescheduleContext - Reason and preferred times
   */
  async initiateRescheduleNegotiation(interviewId, candidateId, rescheduleContext = {}) {
    try {
      const interview = await Interview.findByPk(interviewId, {
        include: [
          { model: Job, as: 'job' },
          { model: User, as: 'recruiter' },
          { model: User, as: 'candidate' }
        ]
      });

      if (!interview) throw new Error('Interview not found');
      if (interview.candidateId !== candidateId) {
        throw new Error('You can only reschedule your own interviews');
      }

      const candidateProfile = await Profile.findOne({
        where: { userId: candidateId },
        include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }]
      });

      // Create reschedule negotiation
      const negotiation = await AgentNegotiation.create({
        jobId: interview.jobId,
        interviewId: interview.id,
        candidateId: interview.candidateId,
        recruiterId: interview.recruiterId,
        initiatorType: 'candidate',
        type: 'reschedule',
        status: 'negotiating',
        candidateAgentContext: {
          reason: rescheduleContext.reason || 'Schedule conflict',
          preferredDates: rescheduleContext.preferredDates || [],
          urgency: rescheduleContext.urgency || 'medium',
          originalDate: interview.scheduledAt,
          flexibility: rescheduleContext.flexibility || 'flexible'
        },
        recruiterAgentContext: {},
        startedAt: new Date(),
        lastAgentTurn: 'none',
        maxRounds: 6 // Fewer rounds for reschedule
      });

      // Generate initial reschedule request message from candidate agent
      const initialMessage = await aiService.generateCandidateRescheduleRequest(
        candidateProfile,
        interview,
        rescheduleContext
      );

      await NegotiationMessage.create({
        negotiationId: negotiation.id,
        agentRole: 'candidate_agent',
        content: initialMessage.message,
        messageType: 'reschedule_request',
        reasoning: initialMessage.reasoning || 'Initiating reschedule request',
        roundNumber: 1
      });

      await negotiation.update({
        roundCount: 1,
        lastAgentTurn: 'candidate_agent'
      });

      return this.getNegotiationWithMessages(negotiation.id);
    } catch (error) {
      console.error('Error initiating reschedule negotiation:', error);
      throw error;
    }
  }

  /**
   * Continue reschedule negotiation - recruiter agent responds
   */
  async continueRescheduleNegotiation(negotiationId) {
    const negotiation = await this.getNegotiationWithMessages(negotiationId);
    
    if (!negotiation) throw new Error('Negotiation not found');
    if (negotiation.type !== 'reschedule') {
      throw new Error('This is not a reschedule negotiation');
    }
    if (negotiation.status !== 'negotiating') {
      throw new Error(`Negotiation is not active (status: ${negotiation.status})`);
    }

    const interview = await Interview.findByPk(negotiation.interviewId, {
      include: [{ model: Job, as: 'job' }]
    });

    const recruiterProfile = await require('../models').RecruiterProfile.findOne({
      where: { userId: negotiation.recruiterId },
      include: [{ model: User, as: 'user' }]
    });

    const candidateProfile = await Profile.findOne({
      where: { userId: negotiation.candidateId },
      include: [{ model: User, as: 'user' }]
    });

    const messages = negotiation.messages || [];
    const lastMessage = messages[messages.length - 1];
    const nextAgent = negotiation.lastAgentTurn === 'candidate_agent' ? 'recruiter_agent' : 'candidate_agent';
    const newRound = negotiation.roundCount + 1;

    let aiResponse;
    const conversationHistory = messages.map(m => ({
      agentRole: m.agentRole,
      content: m.content,
      messageType: m.messageType
    }));

    if (nextAgent === 'recruiter_agent') {
      // Recruiter agent evaluates and responds to reschedule request
      aiResponse = await aiService.generateRecruiterRescheduleResponse(
        recruiterProfile,
        candidateProfile,
        interview,
        conversationHistory,
        negotiation.candidateAgentContext
      );
    } else {
      // Candidate agent responds to recruiter's proposal
      aiResponse = await aiService.generateCandidateRescheduleResponse(
        candidateProfile,
        interview,
        conversationHistory,
        negotiation.candidateAgentContext
      );
    }

    // Determine if negotiation should conclude
    let newStatus = 'negotiating';
    let outcome = null;

    if (aiResponse.decision === 'accepted' || aiResponse.decision === 'confirmed') {
      newStatus = 'mutual_match';
      outcome = {
        summary: 'Reschedule agreed',
        newDate: aiResponse.agreedDate,
        candidateVerdict: 'confirmed',
        recruiterVerdict: 'approved'
      };
      
      // Update the actual interview
      if (aiResponse.agreedDate) {
        await interview.update({
          scheduledAt: new Date(aiResponse.agreedDate),
          status: 'rescheduled'
        });
      }
    } else if (aiResponse.decision === 'rejected') {
      newStatus = 'recruiter_rejected';
      outcome = {
        summary: 'Reschedule declined',
        reason: aiResponse.reason
      };
    } else if (newRound >= negotiation.maxRounds) {
      newStatus = 'expired';
      outcome = {
        summary: 'Unable to find mutually agreeable time',
        requiresHumanIntervention: true
      };
    }

    await NegotiationMessage.create({
      negotiationId,
      agentRole: nextAgent,
      content: aiResponse.message,
      messageType: aiResponse.messageType || 'response',
      reasoning: aiResponse.reasoning || '',
      roundNumber: newRound
    });

    await negotiation.update({
      roundCount: newRound,
      lastAgentTurn: nextAgent,
      status: newStatus,
      outcome: outcome || negotiation.outcome,
      completedAt: newStatus !== 'negotiating' ? new Date() : null
    });

    return this.getNegotiationWithMessages(negotiationId);
  }
}

module.exports = new AgentArenaService();
