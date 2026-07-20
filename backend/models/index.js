const sequelize = require('../config/database');
const User = require('./User');
const Profile = require('./Profile');
const RecruiterProfile = require('./RecruiterProfile');
const Project = require('./Project');
const Subscription = require('./Subscription');
const TailoredProfile = require('./TailoredProfile');
const Post = require('./Post');
const Like = require('./Like');
const Comment = require('./Comment');
const Job = require('./Job');
const JobScreening = require('./JobScreening');
const JobApplication = require('./JobApplication');
const AgentNegotiation = require('./AgentNegotiation');
const NegotiationMessage = require('./NegotiationMessage');
const CandidateInsights = require('./CandidateInsights');
const Interview = require('./Interview');
const SavedJob = require('./SavedJob');
const PhoneScreeningCall = require('./PhoneScreeningCall');
const PasswordReset = require('./PasswordReset')(sequelize);
const AIUsage = require('./AIUsage');
const Notification = require('./Notification');
const SupportTicket = require('./SupportTicket');
const SavedPost = require('./SavedPost');
const Referral = require('./Referral');
const Kudos = require('./Kudos');
const Poll = require('./Poll');
const PollVote = require('./PollVote');

// Bulk Import Models
const CandidateImport = require('./CandidateImport');
const ImportedCandidate = require('./ImportedCandidate');
const CandidateInvitation = require('./CandidateInvitation');

// Promo Code Models
const PromoCode = require('./PromoCode');
const PromoRedemption = require('./PromoRedemption');

// Credit Pack Model
const CreditPack = require('./CreditPack');

// External Application Tracking (Chrome Extension)
const ExternalApplication = require('./ExternalApplication');

// External Job Board Aggregation
const ExternalJob = require('./ExternalJob');
const ATSBoard = require('./ATSBoard');
const Company = require('./Company');

// Recruiter ATS Integrations (Greenhouse Harvest)
const RecruiterATSIntegration = require('./RecruiterATSIntegration');

// ApplyPilot (autonomous candidate agent)
const ApplyPilotConfig = require('./ApplyPilotConfig');
const ApplyPilotApplication = require('./ApplyPilotApplication');
const ApplyPilotTrainingMemory = require('./ApplyPilotTrainingMemory');
const ApplyPilotTrainingMessage = require('./ApplyPilotTrainingMessage');
const ApplyPilotCredential = require('./ApplyPilotCredential');

// AchieveShare Collaboration Models
const CollaborationSession = require('./CollaborationSession')(sequelize);
const SessionParticipant = require('./SessionParticipant')(sequelize);
const SessionReview = require('./SessionReview')(sequelize);
const UserReputation = require('./UserReputation')(sequelize);
const UserBadge = require('./UserBadge')(sequelize);

// Guest LinkedIn Profile Analyzer (unauthenticated teaser flow)
const GuestAIUsage = require('./GuestAIUsage');
const GuestAnalysisCache = require('./GuestAnalysisCache');
const GuestLead = require('./GuestLead');

// In-house analytics event log
const AnalyticsEvent = require('./AnalyticsEvent');

// Define associations
User.hasOne(Profile, {
  foreignKey: 'userId',
  as: 'profile'
});

Profile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

User.hasOne(RecruiterProfile, {
  foreignKey: 'userId',
  as: 'recruiterProfile'
});

RecruiterProfile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

User.hasMany(Project, {
  foreignKey: 'recruiterId',
  as: 'projects'
});

Project.belongsTo(User, {
  foreignKey: 'recruiterId',
  as: 'recruiter'
});

User.hasMany(Subscription, {
  foreignKey: 'userId',
  as: 'subscriptions'
});

Subscription.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// TailoredProfile associations
User.hasMany(TailoredProfile, {
  foreignKey: 'userId',
  as: 'tailoredProfiles'
});

TailoredProfile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Post associations
User.hasMany(Post, {
  foreignKey: 'userId',
  as: 'posts'
});

Post.belongsTo(User, {
  foreignKey: 'userId',
  as: 'author'
});

// Like associations
User.hasMany(Like, {
  foreignKey: 'userId',
  as: 'likes'
});

Like.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

Post.hasMany(Like, {
  foreignKey: 'postId',
  as: 'postLikes'
});

Like.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

// Comment associations
User.hasMany(Comment, {
  foreignKey: 'userId',
  as: 'comments'
});

Comment.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

Post.hasMany(Comment, {
  foreignKey: 'postId',
  as: 'postComments'
});

Comment.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

// Comment self-referential associations for replies
Comment.hasMany(Comment, {
  foreignKey: 'parentCommentId',
  as: 'replies'
});

Comment.belongsTo(Comment, {
  foreignKey: 'parentCommentId',
  as: 'parentComment'
});

// CommentLike associations
const CommentLike = require('./CommentLike');

User.hasMany(CommentLike, {
  foreignKey: 'userId',
  as: 'commentLikes'
});

CommentLike.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

Comment.hasMany(CommentLike, {
  foreignKey: 'commentId',
  as: 'commentLikes'
});

CommentLike.belongsTo(Comment, {
  foreignKey: 'commentId',
  as: 'comment'
});

// SavedPost associations (bookmarks)
User.hasMany(SavedPost, {
  foreignKey: 'userId',
  as: 'savedPosts'
});

SavedPost.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

Post.hasMany(SavedPost, {
  foreignKey: 'postId',
  as: 'saves'
});

SavedPost.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

// Referral associations
User.hasMany(Referral, {
  foreignKey: 'referrerId',
  as: 'referralsMade'
});

Referral.belongsTo(User, {
  foreignKey: 'referrerId',
  as: 'referrer'
});

User.hasOne(Referral, {
  foreignKey: 'referredUserId',
  as: 'referredBy'
});

Referral.belongsTo(User, {
  foreignKey: 'referredUserId',
  as: 'referredUser'
});

// Follow associations
const Follow = require('./Follow');

// User's followers (people who follow this user)
User.hasMany(Follow, {
  foreignKey: 'followingId',
  as: 'followers'
});

// User's following (people this user follows)
User.hasMany(Follow, {
  foreignKey: 'followerId',
  as: 'following'
});

Follow.belongsTo(User, {
  foreignKey: 'followerId',
  as: 'follower'
});

Follow.belongsTo(User, {
  foreignKey: 'followingId',
  as: 'followedUser'
});

// Conversation and Message associations
const Conversation = require('./Conversation');
const Message = require('./Message');

// User has many conversations (as participant1 or participant2)
User.hasMany(Conversation, {
  foreignKey: 'participant1Id',
  as: 'conversationsAsParticipant1'
});

User.hasMany(Conversation, {
  foreignKey: 'participant2Id',
  as: 'conversationsAsParticipant2'
});

Conversation.belongsTo(User, {
  foreignKey: 'participant1Id',
  as: 'participant1'
});

Conversation.belongsTo(User, {
  foreignKey: 'participant2Id',
  as: 'participant2'
});

// Conversation has many messages
Conversation.hasMany(Message, {
  foreignKey: 'conversationId',
  as: 'messages'
});

Message.belongsTo(Conversation, {
  foreignKey: 'conversationId',
  as: 'conversation'
});

// User has many messages
User.hasMany(Message, {
  foreignKey: 'senderId',
  as: 'sentMessages'
});

Message.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender'
});

// Job associations
User.hasMany(Job, {
  foreignKey: 'userId',
  as: 'jobs'
});

Job.belongsTo(User, {
  foreignKey: 'userId',
  as: 'recruiter'
});

// AgentNegotiation associations
User.hasMany(AgentNegotiation, {
  foreignKey: 'candidateId',
  as: 'negotiationsAsCandidate'
});

User.hasMany(AgentNegotiation, {
  foreignKey: 'recruiterId',
  as: 'negotiationsAsRecruiter'
});

AgentNegotiation.belongsTo(User, {
  foreignKey: 'candidateId',
  as: 'candidate'
});

AgentNegotiation.belongsTo(User, {
  foreignKey: 'recruiterId',
  as: 'recruiter'
});

Job.hasMany(AgentNegotiation, {
  foreignKey: 'jobId',
  as: 'negotiations'
});

AgentNegotiation.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job'
});

// NegotiationMessage associations
AgentNegotiation.hasMany(NegotiationMessage, {
  foreignKey: 'negotiationId',
  as: 'messages'
});

NegotiationMessage.belongsTo(AgentNegotiation, {
  foreignKey: 'negotiationId',
  as: 'negotiation'
});

// CandidateInsights associations
User.hasOne(CandidateInsights, {
  foreignKey: 'userId',
  as: 'candidateInsights'
});

CandidateInsights.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Link CandidateInsights to Profile for easy access
Profile.hasOne(CandidateInsights, {
  foreignKey: 'userId',
  sourceKey: 'userId',
  as: 'insights'
});

CandidateInsights.belongsTo(Profile, {
  foreignKey: 'userId',
  targetKey: 'userId',
  as: 'profile'
});

// JobScreening associations
Job.hasOne(JobScreening, {
  foreignKey: 'jobId',
  as: 'screening'
});

JobScreening.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job'
});

// Interview associations
User.hasMany(Interview, {
  foreignKey: 'candidateId',
  as: 'interviewsAsCandidate'
});

User.hasMany(Interview, {
  foreignKey: 'recruiterId',
  as: 'interviewsAsRecruiter'
});

Interview.belongsTo(User, {
  foreignKey: 'candidateId',
  as: 'candidate'
});

Interview.belongsTo(User, {
  foreignKey: 'recruiterId',
  as: 'recruiter'
});

Job.hasMany(Interview, {
  foreignKey: 'jobId',
  as: 'interviews'
});

Interview.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job'
});

JobScreening.hasMany(Interview, {
  foreignKey: 'screeningId',
  as: 'interviews'
});

Interview.belongsTo(JobScreening, {
  foreignKey: 'screeningId',
  as: 'screening'
});

// ============================================
// AchieveShare Collaboration Associations
// ============================================

// CollaborationSession associations
User.hasMany(CollaborationSession, {
  foreignKey: 'hostId',
  as: 'hostedSessions'
});

CollaborationSession.belongsTo(User, {
  foreignKey: 'hostId',
  as: 'host'
});

// SessionParticipant associations
CollaborationSession.hasMany(SessionParticipant, {
  foreignKey: 'sessionId',
  as: 'participants'
});

SessionParticipant.belongsTo(CollaborationSession, {
  foreignKey: 'sessionId',
  as: 'session'
});

User.hasMany(SessionParticipant, {
  foreignKey: 'userId',
  as: 'sessionParticipations'
});

SessionParticipant.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// SessionReview associations
CollaborationSession.hasMany(SessionReview, {
  foreignKey: 'sessionId',
  as: 'reviews'
});

SessionReview.belongsTo(CollaborationSession, {
  foreignKey: 'sessionId',
  as: 'session'
});

User.hasMany(SessionReview, {
  foreignKey: 'reviewerId',
  as: 'givenReviews'
});

SessionReview.belongsTo(User, {
  foreignKey: 'reviewerId',
  as: 'reviewer'
});

User.hasMany(SessionReview, {
  foreignKey: 'revieweeId',
  as: 'receivedReviews'
});

SessionReview.belongsTo(User, {
  foreignKey: 'revieweeId',
  as: 'reviewee'
});

// UserReputation associations
User.hasOne(UserReputation, {
  foreignKey: 'userId',
  as: 'reputation'
});

UserReputation.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// UserBadge associations
User.hasMany(UserBadge, {
  foreignKey: 'userId',
  as: 'badges'
});

UserBadge.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// SavedJob associations
User.hasMany(SavedJob, {
  foreignKey: 'userId',
  as: 'savedJobs'
});

SavedJob.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

Job.hasMany(SavedJob, {
  foreignKey: 'jobId',
  as: 'savedByUsers'
});

SavedJob.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job'
});

// SavedJob is polymorphic: also references ExternalJob (see SavedJob.js).
ExternalJob.hasMany(SavedJob, {
  foreignKey: 'externalJobId',
  as: 'savedByUsers'
});

SavedJob.belongsTo(ExternalJob, {
  foreignKey: 'externalJobId',
  as: 'externalJob'
});

// ExternalApplication associations (Chrome extension job tracking)
User.hasMany(ExternalApplication, {
  foreignKey: 'userId',
  as: 'externalApplications'
});

ExternalApplication.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

TailoredProfile.hasMany(ExternalApplication, {
  foreignKey: 'tailoredProfileId',
  as: 'externalApplications'
});

ExternalApplication.belongsTo(TailoredProfile, {
  foreignKey: 'tailoredProfileId',
  as: 'tailoredProfile'
});

// ============================================
// PhoneScreeningCall Associations (Vapi.ai)
// ============================================

// PhoneScreeningCall belongs to Interview
Interview.hasOne(PhoneScreeningCall, {
  foreignKey: 'interviewId',
  as: 'phoneScreening'
});

PhoneScreeningCall.belongsTo(Interview, {
  foreignKey: 'interviewId',
  as: 'Interview'
});

// PhoneScreeningCall belongs to Job
Job.hasMany(PhoneScreeningCall, {
  foreignKey: 'jobId',
  as: 'phoneScreenings'
});

PhoneScreeningCall.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'Job'
});

// === JobApplication Associations ===
Job.hasMany(JobApplication, {
  foreignKey: 'jobId',
  as: 'jobApplications'
});

JobApplication.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job'
});

User.hasMany(JobApplication, {
  foreignKey: 'candidateId',
  as: 'jobApplications'
});

JobApplication.belongsTo(User, {
  foreignKey: 'candidateId',
  as: 'candidate'
});

JobApplication.belongsTo(User, {
  foreignKey: 'reviewedBy',
  as: 'reviewer'
});

// JobApplication ↔ ImportedCandidate (for guest screening submissions)
ImportedCandidate.hasMany(JobApplication, {
  foreignKey: 'importedCandidateId',
  as: 'jobApplications'
});

JobApplication.belongsTo(ImportedCandidate, {
  foreignKey: 'importedCandidateId',
  as: 'importedCandidate'
});

// PhoneScreeningCall belongs to User (candidate)
User.hasMany(PhoneScreeningCall, {
  foreignKey: 'candidateId',
  as: 'phoneScreeningsAsCandidate'
});

PhoneScreeningCall.belongsTo(User, {
  foreignKey: 'candidateId',
  as: 'candidate'
});

// PhoneScreeningCall belongs to User (recruiter)
User.hasMany(PhoneScreeningCall, {
  foreignKey: 'recruiterId',
  as: 'phoneScreeningsAsRecruiter'
});

PhoneScreeningCall.belongsTo(User, {
  foreignKey: 'recruiterId',
  as: 'recruiter'
});

// AI Usage association
User.hasMany(AIUsage, {
  foreignKey: 'userId',
  as: 'aiUsages'
});

AIUsage.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Notification associations
User.hasMany(Notification, {
  foreignKey: 'userId',
  as: 'notifications'
});

Notification.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// SupportTicket associations
User.hasMany(SupportTicket, {
  foreignKey: 'userId',
  as: 'supportTickets'
});
SupportTicket.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Kudos associations
User.hasMany(Kudos, {
  foreignKey: 'senderId',
  as: 'kudosGiven'
});

User.hasMany(Kudos, {
  foreignKey: 'receiverId',
  as: 'kudosReceived'
});

Kudos.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender'
});

Kudos.belongsTo(User, {
  foreignKey: 'receiverId',
  as: 'receiver'
});

Post.hasMany(Kudos, {
  foreignKey: 'postId',
  as: 'kudos'
});

Kudos.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

Profile.hasMany(Kudos, {
  foreignKey: 'profileId',
  as: 'kudos'
});

Kudos.belongsTo(Profile, {
  foreignKey: 'profileId',
  as: 'profile'
});

// Poll associations
User.hasMany(Poll, {
  foreignKey: 'authorId',
  as: 'polls'
});

Poll.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author'
});

Post.hasOne(Poll, {
  foreignKey: 'postId',
  as: 'poll'
});

Poll.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

Poll.hasMany(PollVote, {
  foreignKey: 'pollId',
  as: 'votes'
});

PollVote.belongsTo(Poll, {
  foreignKey: 'pollId',
  as: 'poll'
});

User.hasMany(PollVote, {
  foreignKey: 'userId',
  as: 'pollVotes'
});

PollVote.belongsTo(User, {
  foreignKey: 'userId',
  as: 'voter'
});

// ===========================================
// Bulk Candidate Import Associations
// ===========================================

// Recruiter has many imports
User.hasMany(CandidateImport, {
  foreignKey: 'recruiterId',
  as: 'candidateImports'
});

CandidateImport.belongsTo(User, {
  foreignKey: 'recruiterId',
  as: 'recruiter'
});

// Import can be linked to a job
Job.hasMany(CandidateImport, {
  foreignKey: 'jobId',
  as: 'candidateImports'
});

CandidateImport.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job'
});

// Import has many imported candidates
CandidateImport.hasMany(ImportedCandidate, {
  foreignKey: 'importId',
  as: 'candidates'
});

ImportedCandidate.belongsTo(CandidateImport, {
  foreignKey: 'importId',
  as: 'import'
});

// Imported candidate can be linked to a Profile
Profile.hasMany(ImportedCandidate, {
  foreignKey: 'profileId',
  as: 'importRecords'
});

ImportedCandidate.belongsTo(Profile, {
  foreignKey: 'profileId',
  as: 'profile'
});

// Imported candidate can be linked to a User
User.hasMany(ImportedCandidate, {
  foreignKey: 'userId',
  as: 'importedCandidateRecords'
});

ImportedCandidate.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// ===========================================
// Candidate Invitation Associations
// ===========================================

// Import has many invitations
CandidateImport.hasMany(CandidateInvitation, {
  foreignKey: 'importId',
  as: 'invitations'
});

CandidateInvitation.belongsTo(CandidateImport, {
  foreignKey: 'importId',
  as: 'import'
});

// Imported candidate has one invitation
ImportedCandidate.hasOne(CandidateInvitation, {
  foreignKey: 'importedCandidateId',
  as: 'invitation'
});

CandidateInvitation.belongsTo(ImportedCandidate, {
  foreignKey: 'importedCandidateId',
  as: 'importedCandidate'
});

// Job has many invitations
Job.hasMany(CandidateInvitation, {
  foreignKey: 'jobId',
  as: 'candidateInvitations'
});

CandidateInvitation.belongsTo(Job, {
  foreignKey: 'jobId',
  as: 'job'
});

// Recruiter sends many invitations
User.hasMany(CandidateInvitation, {
  foreignKey: 'recruiterId',
  as: 'sentInvitations'
});

CandidateInvitation.belongsTo(User, {
  foreignKey: 'recruiterId',
  as: 'recruiter'
});

// Invitation can link to created user
CandidateInvitation.belongsTo(User, {
  foreignKey: 'userId',
  as: 'candidate'
});

// Invitation can link to profile
CandidateInvitation.belongsTo(Profile, {
  foreignKey: 'profileId',
  as: 'profile'
});

// Invitation can link to job application
CandidateInvitation.belongsTo(JobApplication, {
  foreignKey: 'jobApplicationId',
  as: 'application'
});

// Promo Code associations
PromoCode.hasMany(PromoRedemption, {
  foreignKey: 'promoCodeId',
  as: 'redemptions'
});

PromoRedemption.belongsTo(PromoCode, {
  foreignKey: 'promoCodeId',
  as: 'promoCode'
});

User.hasMany(PromoRedemption, {
  foreignKey: 'userId',
  as: 'promoRedemptions'
});

PromoRedemption.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

PromoCode.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

// CreditPack associations
User.hasMany(CreditPack, {
  foreignKey: 'userId',
  as: 'creditPacks'
});

CreditPack.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// ===========================================
// External Job Board Associations
// ===========================================

ATSBoard.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

// Recruiter ATS Integration associations
User.hasMany(RecruiterATSIntegration, {
  foreignKey: 'userId',
  as: 'atsIntegrations'
});

RecruiterATSIntegration.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Company <-> ExternalJob
Company.hasMany(ExternalJob, { foreignKey: 'companyId', as: 'jobs' });
ExternalJob.belongsTo(Company, { foreignKey: 'companyId', as: 'companyInfo' });

// ============================================
// ApplyPilot Associations
// ============================================
User.hasOne(ApplyPilotConfig, { foreignKey: 'userId', as: 'applyPilotConfig' });
ApplyPilotConfig.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(ApplyPilotApplication, { foreignKey: 'userId', as: 'applyPilotApplications' });
ApplyPilotApplication.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Job.hasMany(ApplyPilotApplication, { foreignKey: 'jobId', as: 'applyPilotApplications' });
ApplyPilotApplication.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

ExternalJob.hasMany(ApplyPilotApplication, { foreignKey: 'externalJobId', as: 'applyPilotApplications' });
ApplyPilotApplication.belongsTo(ExternalJob, { foreignKey: 'externalJobId', as: 'externalJob' });

ApplyPilotApplication.hasOne(TailoredProfile, {
  foreignKey: 'applyPilotApplicationId',
  as: 'syncedTailoredProfile'
});
TailoredProfile.belongsTo(ApplyPilotApplication, {
  foreignKey: 'applyPilotApplicationId',
  as: 'applyPilotApplication'
});

User.hasMany(ApplyPilotTrainingMemory, { foreignKey: 'userId', as: 'applyPilotMemory' });
ApplyPilotTrainingMemory.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(ApplyPilotTrainingMessage, { foreignKey: 'userId', as: 'applyPilotMessages' });
ApplyPilotTrainingMessage.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(ApplyPilotCredential, { foreignKey: 'userId', as: 'applyPilotCredentials' });
ApplyPilotCredential.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  User,
  Profile,
  RecruiterProfile,
  Project,
  Subscription,
  TailoredProfile,
  Post,
  Like,
  Comment,
  CommentLike,
  Follow,
  Conversation,
  Message,
  Job,
  JobScreening,
  JobApplication,
  AgentNegotiation,
  NegotiationMessage,
  CandidateInsights,
  Interview,
  SavedJob,
  PhoneScreeningCall,
  PasswordReset,
  AIUsage,
  Notification,
  SupportTicket,
  SavedPost,
  Referral,
  Kudos,
  Poll,
  PollVote,
  // AchieveShare Collaboration Models
  CollaborationSession,
  SessionParticipant,
  SessionReview,
  UserReputation,
  UserBadge,
  // Bulk Import Models
  CandidateImport,
  ImportedCandidate,
  CandidateInvitation,
  // Promo Code Models
  PromoCode,
  PromoRedemption,
  // Credit Pack Model
  CreditPack,
  // External Application Tracking
  ExternalApplication,
  // External Job Board Aggregation
  ExternalJob,
  ATSBoard,
  Company,
  // Recruiter ATS Integrations
  RecruiterATSIntegration,
  // ApplyPilot
  ApplyPilotConfig,
  ApplyPilotApplication,
  ApplyPilotTrainingMemory,
  ApplyPilotTrainingMessage,
  ApplyPilotCredential,
  // Guest LinkedIn Profile Analyzer
  GuestAIUsage,
  GuestAnalysisCache,
  GuestLead,
  // In-house analytics
  AnalyticsEvent
};
