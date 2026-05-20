import axios from 'axios';

// Use relative URL to go through Vite proxy in development
const API_URL = import.meta.env.VITE_API_URL || '/api';
const BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : `${window.location.protocol}//${window.location.hostname}:5001`;

// Allow a React component inside the Router to register a navigate function
// so the 401 interceptor can do SPA navigation instead of full page reload
let _navigate = null;
export const setApiNavigate = (fn) => { _navigate = fn; };

// Helper function to resolve image URLs
// - Cloudinary URLs (starting with http/https) are returned as-is
// - Legacy local URLs (/uploads/...) are converted to full URL
// - Data URLs (base64) are returned as-is
export const resolveImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  // Legacy local uploads - prepend base URL
  return `${BASE_URL}${url}`;
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log('[API] Request to:', config.url, '| Token present:', !!token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 responses (unauthorized) - be very careful not to logout unnecessarily
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Network error - backend might be down, DON'T clear auth
    if (!error.response) {
      console.log('[API] Network error - backend may be down, keeping session');
      return Promise.reject(error);
    }
    
    // Only clear auth on actual 401 from protected endpoints
    // Don't clear on login/register failures (those are expected 401s for wrong password)
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
      const isAuthPage = window.location.pathname.includes('/login') || 
                         window.location.pathname.includes('/register');
      
      // Only force logout if it's a protected endpoint returning 401 (token expired/invalid)
      if (!isAuthEndpoint && !isAuthPage) {
        console.log('[API] 401 from protected endpoint - session expired');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Preserve the current path so login can redirect back
        const returnPath = window.location.pathname + window.location.search;
        if (_navigate) {
          _navigate('/login', { state: { from: returnPath }, replace: true });
        } else {
          window.location.href = '/login?redirect=' + encodeURIComponent(returnPath);
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me'),
  impersonate: (userId) => api.post(`/auth/impersonate/${userId}`),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  validateResetToken: (token) => api.get(`/auth/validate-reset-token/${token}`),
  // Google OAuth
  googleLogin: (credential) => api.post('/auth/google', { credential }),
  googleRegister: (credential, role) => api.post('/auth/google/register', { credential, role }),
  // GitHub OAuth
  githubLogin: (code) => api.post('/auth/github', { code }),
  githubRegister: (code, role) => api.post('/auth/github/register', { code, role }),
  // LinkedIn OAuth
  linkedinAuthorizeUrl: (redirectUri, state) =>
    api.get('/auth/linkedin/authorize-url', { params: { redirectUri, state } }),
  linkedinLogin: (code, redirectUri) => api.post('/auth/linkedin', { code, redirectUri }),
  linkedinRegister: (code, redirectUri, role) => api.post('/auth/linkedin/register', { code, redirectUri, role }),
  // Email verification
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  resendVerification: () => api.post('/auth/resend-verification')
};

// Profile API
export const profileAPI = {
  getMyProfile: () => api.get('/profiles/me'),
  createOrUpdateProfile: (profileData) => api.post('/profiles', profileData),
  enhanceProfile: () => api.post('/profiles/enhance'),
  getPublicProfile: (id) => api.get(`/profiles/${id}`),
  getAllProfiles: (params) => api.get('/profiles', { params }),
  // Search public profiles for global search
  searchPublic: (params) => api.get('/profiles', { params: { ...params, search: params.query } }),
  uploadResume: async (formData) => {
    // Use fetch directly to avoid axios content-type issues with FormData
    const token = localStorage.getItem('token');
    const response = await fetch('/api/profiles/upload-resume', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }
    return { data: await response.json() };
  },
  // Upload profile picture (returns URL)
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const token = localStorage.getItem('token');
    const response = await fetch('/api/profiles/upload-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }
    return { data: await response.json() };
  },
  // Delete profile image
  deleteImage: (imageUrl) => api.delete('/profiles/delete-image', { data: { imageUrl } }),
  enhanceResumeData: (profileData, customPrompt, config) => api.post('/profiles/enhance-resume', { profileData, customPrompt }, config),
  getEnhancementSuggestions: (profileData, config) => api.post('/profiles/enhancement-suggestions', { profileData }, config),
  enhanceText: (text, type, context, config) => api.post('/profiles/enhance-text', { text, type, context }, config),
  analyzeGaps: ({ profileData, jobDescription }) => api.post('/profiles/analyze-gaps', { profileData, jobDescription }),
  tailorProfileForJob: ({ profileData, jobDescription, gapSelections, tailorSettings }) => api.post('/profiles/tailor-for-job', { profileData, jobDescription, gapSelections, tailorSettings }),
  generateCoverLetter: (data) => api.post('/profiles/generate-cover-letter', data),
  keywordOptimization: ({ profileData, jobDescription }) => api.post('/profiles/keyword-optimization', { profileData, jobDescription })
};

// Smart Match API
export const smartMatchAPI = {
  // Core smart search with enhanced criteria
  findMatches: (criteria) => api.post('/smart-match/match', criteria),
  
  // Enhanced search with all criteria
  findMatchesAdvanced: (criteria) => api.post('/smart-match/match', {
    keywords: criteria.keywords,
    skills: criteria.skills,
    experienceLevel: criteria.experienceLevel,
    mustHaveAI: criteria.mustHaveAI,
    location: criteria.location,
    educationLevel: criteria.educationLevel,
    certifications: criteria.certifications,
    minYearsExperience: criteria.minYearsExperience,
    maxYearsExperience: criteria.maxYearsExperience,
    availabilityStatus: criteria.availabilityStatus,
    jobId: criteria.jobId
  }),
  
  // Analytics
  getAnalytics: () => api.get('/smart-match/analytics'),
  
  // Feedback for algorithm improvement
  submitFeedback: (feedbackData) => api.post('/smart-match/feedback', feedbackData),
  
  // Search history
  getSearchHistory: () => api.get('/smart-match/search-history'),
  
  // Recruiter AI Features
  generateInterviewQuestions: (profileId, roleContext) => 
    api.post(`/smart-match/interview-questions/${profileId}`, { roleContext }),
  
  compareCandidates: (profileIds, jobRequirements) => 
    api.post('/smart-match/compare-candidates', { profileIds, jobRequirements }),
  
  predictSalary: (profileId, location, currency) => 
    api.post(`/smart-match/salary-prediction/${profileId}`, { location, currency }),
  
  generateOutreach: (profileId, jobDetails, tone) => 
    api.post(`/smart-match/outreach-message/${profileId}`, { jobDetails, tone }),
  
  analyzeSkillGaps: (profileId, jobRequirements) => 
    api.post(`/smart-match/skill-gap-analysis/${profileId}`, { jobRequirements }),
  
  predictCultureFit: (profileId, companyValues) => 
    api.post(`/smart-match/culture-fit/${profileId}`, { companyValues })
};

// Tailored Profiles API
export const tailoredProfileAPI = {
  getAll: () => api.get('/tailored-profiles'),
  getById: (id) => api.get(`/tailored-profiles/${id}`),
  save: (data) => api.post('/tailored-profiles', data),
  update: (id, data) => api.put(`/tailored-profiles/${id}`, data),
  delete: (id) => api.delete(`/tailored-profiles/${id}`),
  updateGapStatus: (id, gapIndex, status) => api.patch(`/tailored-profiles/${id}/gaps/${gapIndex}`, { status }),
  getLearningPlan: () => api.get('/tailored-profiles/learning-plan/all'),
  getGaps: (id) => api.get(`/tailored-profiles/${id}/gaps`),
  getInterviewPrep: (interviewId) => api.get(`/interviews/${interviewId}/prep`),
  generateInterviewPrep: (id, data) => api.post(`/tailored-profiles/${id}/generate-interview-prep`, data)
};

// Recruiter Profile API
export const recruiterProfileAPI = {
  getMyProfile: () => api.get('/recruiter-profiles/me'),
  createOrUpdate: (profileData) => api.post('/recruiter-profiles', profileData),
  getPublicProfile: (userId) => api.get(`/recruiter-profiles/${userId}`),
  getCompanyBySlug: (slug) => api.get(`/recruiter-profiles/company/${slug}`),
  generateSlug: () => api.put('/recruiter-profiles/generate-slug'),
  // Upload recruiter profile picture or company logo (returns URL)
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    // Use explicit config to override default Content-Type and let browser set multipart boundary
    return api.post('/recruiter-profiles/upload-image', formData, {
      headers: {
        'Content-Type': undefined
      }
    });
  }
};

// Resume Download API
export const resumeAPI = {
  getTemplates: () => api.get('/resume/templates'),
  generate: async (format, templateId, tailoredProfileId = null, tailoredProfileData = null, accentColor = null, bulletStyle = null) => {
    const response = await api.post('/resume/generate', 
      { format, templateId, tailoredProfileId, tailoredProfileData, accentColor, bulletStyle },
      { responseType: 'blob' }
    );
    return response;
  },
  preview: (templateId, tailoredProfileId = null, tailoredProfileData = null, accentColor = null, bulletStyle = null) => 
    api.post('/resume/preview', { templateId, tailoredProfileId, tailoredProfileData, accentColor, bulletStyle })
};

// Posts/Feed API
export const postAPI = {
  // Get all posts with optional filtering
  getAll: (params = {}) => api.get('/posts', { params }),
  
  // Get a single post by ID
  getById: (id) => api.get(`/posts/${id}`),
  
  // Get posts by a specific user
  getByUser: (userId, params = {}) => api.get(`/posts/user/${userId}`, { params }),
  
  // Create a new post
  create: (postData) => api.post('/posts', postData),
  
  // Update an existing post
  update: (id, postData) => api.put(`/posts/${id}`, postData),
  
  // Delete a post
  delete: (id) => api.delete(`/posts/${id}`),
  
  // Like a post
  like: (id) => api.post(`/posts/${id}/like`),
  
  // Get users who liked a post
  getLikes: (postId) => api.get(`/posts/${postId}/likes`),
  
  // Check which posts user has liked
  checkLikes: (postIds) => api.post('/posts/check-likes', { postIds }),
  
  // Track post view
  trackView: (id) => api.post(`/posts/${id}/view`),
  
  // Comments
  getComments: (postId) => api.get(`/posts/${postId}/comments`),
  addComment: (postId, content) => api.post(`/posts/${postId}/comments`, { content }),
  editComment: (postId, commentId, content) => api.put(`/posts/${postId}/comments/${commentId}`, { content }),
  deleteComment: (postId, commentId) => api.delete(`/posts/${postId}/comments/${commentId}`),
  
  // Comment likes
  likeComment: (postId, commentId) => api.post(`/posts/${postId}/comments/${commentId}/like`),
  getCommentLikes: (postId, commentId) => api.get(`/posts/${postId}/comments/${commentId}/likes`),
  
  // Comment replies
  replyToComment: (postId, commentId, content) => api.post(`/posts/${postId}/comments/${commentId}/reply`, { content }),
  getReplies: (postId, commentId) => api.get(`/posts/${postId}/comments/${commentId}/replies`),
  
  // Saved Posts (Bookmarks)
  savePost: (postId) => api.post(`/posts/${postId}/save`),
  getSavedPosts: (params = {}) => api.get('/posts/saved', { params }),
  checkSavedPosts: (postIds) => api.post('/posts/check-saved', { postIds }),
  
  // Upload image for post
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    console.log('📤 [postAPI.uploadImage] Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
    // Set Content-Type to undefined to let browser set proper multipart/form-data with boundary
    return api.post('/posts/upload-image', formData, {
      headers: {
        'Content-Type': undefined
      }
    });
  },
  
  // AI Features (placeholders for future implementation)
  enhanceWithAI: (content) => api.post('/posts/ai/enhance', { content }),
  getSuggestions: (context) => api.post('/posts/ai/suggest', { context })
};

// Follow API
export const followAPI = {
  // Follow a user
  follow: (userId) => api.post(`/follows/${userId}`),
  
  // Unfollow a user
  unfollow: (userId) => api.delete(`/follows/${userId}`),
  
  // Check if current user follows a specific user
  checkFollowStatus: (userId) => api.get(`/follows/status/${userId}`),
  
  // Get followers of a user
  getFollowers: (userId, params = {}) => api.get(`/follows/followers/${userId}`, { params }),
  
  // Get users that a user is following
  getFollowing: (userId, params = {}) => api.get(`/follows/following/${userId}`, { params }),
  
  // Get follower/following counts for a user
  getCounts: (userId) => api.get(`/follows/counts/${userId}`),
  
  // Get my followers
  getMyFollowers: (params = {}) => api.get('/follows/me/followers', { params }),
  
  // Get who I'm following
  getMyFollowing: (params = {}) => api.get('/follows/me/following', { params })
};

// Message API
export const messageAPI = {
  // Get all conversations for current user
  getConversations: () => api.get('/messages/conversations'),
  
  // Get messages in a specific conversation (alias for backward compatibility)
  getConversation: (conversationId, params = {}) => 
    api.get(`/messages/conversations/${conversationId}`, { params }),
  
  // Get messages in a specific conversation
  getMessages: (conversationId, params = {}) => 
    api.get(`/messages/conversations/${conversationId}`, { params }),
  
  // Send message to a user (creates conversation if needed)
  sendMessage: (userId, content) => 
    api.post(`/messages/send/${userId}`, { content }),
  
  // Send message in existing conversation
  sendToConversation: (conversationId, content) => 
    api.post(`/messages/conversations/${conversationId}`, { content }),
  
  // Get unread message count
  getUnreadCount: () => api.get('/messages/unread-count'),
  
  // Mark conversation as read
  markAsRead: (conversationId) => 
    api.put(`/messages/read/${conversationId}`),
  
  // Delete a conversation
  deleteConversation: (conversationId) => 
    api.delete(`/messages/conversations/${conversationId}`),
  
  // Check if conversation exists with a user
  checkConversation: (userId) => 
    api.get(`/messages/conversation-with/${userId}`),
  
  // Start or get a conversation with a user (no message sent)
  startConversation: (userId) => 
    api.post(`/messages/start/${userId}`),
    
  // Confirm reschedule with selected slot
  confirmReschedule: (interviewId, selectedSlotIndex, conversationId) =>
    api.post('/messages/reschedule-confirm', { interviewId, selectedSlotIndex, conversationId })
};

// Job API
export const jobAPI = {
  // Get all active jobs (public)
  getAll: (params = {}) => api.get('/jobs', { params }),
  
  // Get job by ID
  getById: (id) => api.get(`/jobs/${id}`),
  
  // Get jobs by company/recruiter (public)
  getByCompany: (userId) => api.get(`/jobs/company/${userId}`),
  
  // Get recruiter's own jobs
  getMyJobs: (params = {}) => api.get('/jobs/my-jobs', { params }),
  
  // Create a new job posting
  create: (jobData) => api.post('/jobs', jobData),
  
  // Update a job posting
  update: (id, jobData) => api.put(`/jobs/${id}`, jobData),
  
  // Delete a job posting
  delete: (id) => api.delete(`/jobs/${id}`),
  
  // Update job status
  updateStatus: (id, status) => api.put(`/jobs/${id}/status`, { status }),
  
  // Get screening status (recruitment automation progress)
  getScreeningStatus: (id) => api.get(`/jobs/${id}/screening-status`),
  
  // Start screening with custom configuration
  startScreeningWithConfig: (id, config) => api.post(`/jobs/${id}/start-screening`, config),
  
  // Screen selected candidates after manual review
  screenSelectedCandidates: (id, candidateIds) => api.post(`/jobs/${id}/screen-selected`, { candidateIds }),
  
  // Submit feedback on screening results
  submitScreeningFeedback: (id, feedback) => api.post(`/jobs/${id}/screening-feedback`, feedback),
  
  // Saved Jobs
  getSavedJobs: () => api.get('/jobs/saved'),
  checkSavedJobs: (jobIds) => api.post('/jobs/check-saved', { jobIds }),
  saveJob: (id) => api.post(`/jobs/${id}/save`),
  unsaveJob: (id) => api.delete(`/jobs/${id}/save`),
  
  // AI Features
  aiGenerateDescription: (data) => api.post('/jobs/ai/generate-description', data),
  aiSuggestSkills: (data) => api.post('/jobs/ai/suggest-skills', data),
  aiImproveTitle: (data) => api.post('/jobs/ai/improve-title', data),
  aiGenerateRequirements: (data) => api.post('/jobs/ai/generate-requirements', data),
  aiGenerateBenefits: (data) => api.post('/jobs/ai/generate-benefits', data),
  
  // Application Form Templates
  getApplicationTemplates: () => api.get('/jobs/application-templates'),
  
  // Job Applications (manual applications only)
  submitApplication: (jobId, formData) => api.post(`/jobs/${jobId}/apply`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getMyApplications: (params = {}) => api.get('/jobs/my-applications', { params }),
  getJobApplications: (jobId, params = {}) => api.get(`/jobs/${jobId}/applications`, { params }),
  updateApplicationStatus: (applicationId, status, recruiterNotes) => 
    api.put(`/jobs/applications/${applicationId}/status`, { status, recruiterNotes }),
  withdrawApplication: (applicationId) => 
    api.put(`/jobs/applications/${applicationId}/withdraw`),
  
  // Shortlist (AI-screened + Agent Arena matches)
  getShortlist: (jobId, params = {}) => api.get(`/jobs/${jobId}/shortlist`, { params })
};

// Agent Arena API - AI-to-AI Negotiation System
export const agentArenaAPI = {
  // Start a new agent negotiation
  // initiatorType: 'candidate' (applying) or 'recruiter' (scouting)
  initiate: (initiatorType, jobId, candidateId = null, agentContext = {}) => 
    api.post('/agent-arena/initiate', { initiatorType, jobId, candidateId, agentContext }),
  
  // Get all negotiations for current user
  getMyNegotiations: (params = {}) => api.get('/agent-arena/negotiations', { params }),
  
  // Get a single negotiation with all messages
  getNegotiation: (id) => api.get(`/agent-arena/negotiations/${id}`),
  
  // Continue to next round (one agent responds)
  continueNegotiation: (id) => api.post(`/agent-arena/negotiations/${id}/continue`),
  
  // Run multiple rounds until conclusion
  runFullNegotiation: (id, maxRounds = 5) => 
    api.post(`/agent-arena/negotiations/${id}/run-full`, { maxRounds }),
  
  // Force agents to make final decisions
  concludeNegotiation: (id) => api.post(`/agent-arena/negotiations/${id}/conclude`),
  
  // Human takes over the negotiation
  humanOverride: (id, action, note = '') => 
    api.post(`/agent-arena/negotiations/${id}/human-override`, { action, note }),
  
  // Update agent context/preferences
  updateContext: (id, agentContext) => 
    api.post(`/agent-arena/negotiations/${id}/update-context`, { agentContext }),
  
  // Check user's negotiation limits
  getLimits: () => api.get('/agent-arena/limits'),

  // Reschedule negotiations
  initiateReschedule: (interviewId, reason, preferredDates = [], flexibility = 'flexible') =>
    api.post('/agent-arena/reschedule', { interviewId, reason, preferredDates, flexibility }),
  
  continueReschedule: (id) => api.post(`/agent-arena/reschedule/${id}/continue`),
  
  getRescheduleForInterview: (interviewId) =>
    api.get(`/agent-arena/interview/${interviewId}/reschedule`)
};

// ----------------------------------------------------------------
// ApplyPilot API (the new autonomous candidate agent, distinct
// from the legacy `agentArenaAPI` above which handles agent↔agent
// negotiation rounds). Mounted server-side under /api/applypilot/*.
// ----------------------------------------------------------------
export const applyPilotAPI = {
  // ---- Setup / config -------------------------------------------------
  // Returns the candidate's pilot config: criteria, approval mode, rails,
  // training coverage, and current run status. Shape:
  //   { config, status: 'idle'|'running'|'paused', training: {...} }
  getConfig: () => api.get('/applypilot/config'),

  // Persist setup wizard output. Body shape:
  //   { criteria: {...}, approval: 'auto'|'review', rails: {...} }
  updateConfig: (config) => api.put('/applypilot/config', config),

  // Kick off (or resume) the background scout+prep loop.
  start: () => api.post('/applypilot/start'),
  // Stop further scouting/prep. Pending applications stay in queue.
  pause: () => api.post('/applypilot/pause'),
  // Light-weight poll for the dashboard hero ("running" pulse + counts).
  getStatus: () => api.get('/applypilot/status'),

  // ---- Dashboard ------------------------------------------------------
  // Stat cards (queue, applied, replies, interviews).
  getStats: () => api.get('/applypilot/stats'),
  // Prepared / pending applications (the queue table).
  // params: { status?: 'pending'|'approved'|'rejected', limit? }
  getQueue: (params = {}) => api.get('/applypilot/queue', { params }),
  // Live activity timeline ("Tailoring resume for OpenAI…" etc).
  getActivity: (params = {}) => api.get('/applypilot/activity', { params }),

  // ---- Review ---------------------------------------------------------
  // Full prepared package for one application: resume diff, cover letter,
  // form answers, original JD, match breakdown.
  getApplication: (appId) => api.get(`/applypilot/applications/${appId}`),
  // Run a pre-submit dry-run in Puppeteer and return screenshot timeline.
  previewApplication: (appId) => api.post(`/applypilot/applications/${appId}/preview`),
  // Manually add a job to the queue (bypasses scout, useful in dev or
  // for jobs not yet indexed). Body: { applicationUrl, company?, role?,
  // location?, description?, requirements? }
  createApplication: (payload) => api.post('/applypilot/applications', payload),
  // Approve → submit-worker picks it up and sends. Optional final tweaks.
  approveApplication: (appId, edits = {}) =>
    api.post(`/applypilot/applications/${appId}/approve`, edits),
  // Manually enqueue a submission for one application.
  submitApplication: (appId) =>
    api.post(`/applypilot/applications/${appId}/submit`),
  // Batch-submit already approved applications, or an explicit id list.
  submitQueued: (applicationIds = []) =>
    api.post('/applypilot/submit', applicationIds.length ? { applicationIds } : {}),
  // Reject → drops from queue, optional reason teaches the agent.
  rejectApplication: (appId, reason = '') =>
    api.post(`/applypilot/applications/${appId}/reject`, { reason }),
  // Bulk reject, { ids?: [...], all?: bool, reason?: string }.
  rejectApplicationsBulk: (payload) =>
    api.post('/applypilot/applications/reject-bulk', payload),
  // Reopen a recently rejected application (Undo reject).
  reopenApplication: (appId) =>
    api.post(`/applypilot/applications/${appId}/reopen`),
  // Hard-delete (permanent remove from inbox).
  deleteApplication: (appId) =>
    api.delete(`/applypilot/applications/${appId}`),
  // Ask the agent to redo a section ("rewrite this paragraph more concise").
  // section: 'summary' | 'experience' | 'cover' | 'answers'
  requestEdit: (appId, section, instruction) =>
    api.post(`/applypilot/applications/${appId}/request-edit`, { section, instruction }),
  // Retry a failed or needs-attention submission after the user resolves it.
  resolveApplication: (appId, payload = {}) =>
    api.post(`/applypilot/applications/${appId}/resolve`, payload),
  // Resume PDF used for submission. Returns a file response or redirect.
  getResumePdf: (appId) =>
    api.get(`/applypilot/applications/${appId}/resume.pdf`, { responseType: 'blob' }),
  // Inbox classifier webhook helper. Body:
  // { type, reasonCategory?, reason?, metadata? }
  reportOutcome: (appId, payload) =>
    api.post(`/applypilot/applications/${appId}/outcome`, payload),

  // ---- Hybrid manual-submit (APPLYPILOT_AUTOSUBMIT=off) -----------
  // Re-tailor the resume from scratch. Optional body:
  //   { tailorSettings: { tone?, summaryLines?, experienceLines?, maxSkills? } }
  regenerateResume: (appId, payload = {}) =>
    api.post(`/applypilot/applications/${appId}/regenerate-resume`, payload),
  // Re-draft the cover letter (and optionally pre-answers).
  // Body: { tone?, includeAnswers?: boolean }
  regenerateCoverLetter: (appId, payload = {}) =>
    api.post(`/applypilot/applications/${appId}/regenerate-cover-letter`, payload),
  // Have the AI redraft a single Q&A. Body: { question, fieldId?, guidance? }
  regenerateAnswer: (appId, payload) =>
    api.post(`/applypilot/applications/${appId}/regenerate-answer`, payload),
  // Bulk-replace pre-answered questions after the user edits them.
  // Body: { answers: [{ fieldId, question, answer, confidence? }] }
  patchAnswers: (appId, answers) =>
    api.patch(`/applypilot/applications/${appId}/answers`, { answers }),
  // Candidate clicks "I applied", flips status=submitted + tracking=applied.
  markApplied: (appId, payload = {}) =>
    api.post(`/applypilot/applications/${appId}/mark-applied`, payload),
  // Run gap analysis for an application (used by the GapReviewDialog
  // on the Review page when re-tailoring). Returns
  //   { success, gaps, satisfiedAlternatives }
  analyzeApplicationGaps: (appId) =>
    api.post(`/applypilot/applications/${appId}/analyze-gaps`),
  // Download the tailored resume as a PDF (auth-protected, returns a
  // 302 to the cloud URL or the binary stream). We fetch as a blob so
  // the browser triggers a real download instead of opening it in
  // place.
  downloadResumePdf: (appId) =>
    api.get(`/applypilot/applications/${appId}/resume.pdf`, { responseType: 'blob' }),
  // Update manual tracking (status + notes). Body:
  //   { status?: 'applied'|'interviewing'|'offer'|'hired'|'rejected_by_company'|'withdrawn'|'not_applied',
  //     notes?: string }
  patchTracking: (appId, payload) =>
    api.patch(`/applypilot/applications/${appId}/tracking`, payload),

  // Live match preview for the setup wizard's "Live matches" card.
  // Body: criteria fields (roleTitles, seniority, workstyle, locations,
  // industries, salaryFloorK). All fields optional.
  matchPreview: (criteria) =>
    api.post('/applypilot/match-preview', criteria || {}),

  // Provider support matrix and credentials placeholder endpoints.
  getATS: () => api.get('/applypilot/ats'),
  getCredentials: () => api.get('/applypilot/credentials'),
  saveCredentials: (payload) => api.post('/applypilot/credentials', payload),

  // ---- Training (Agent Coach) ----------------------------------------
  // Returns chat history, coverage topics, memory rows, current focus topic.
  getTrainingState: () => api.get('/applypilot/training'),
  // Send a user reply to the coach. Body: { content, topic? }.
  // Server streams the next AI message (we just await the JSON for now).
  sendTrainingMessage: (content, topic) =>
    api.post('/applypilot/training/messages', { content, topic }),
  // Move focus to the next (or a specific) training topic. Body: { topic? }.
  // If `topic` is omitted the server advances to the next uncovered topic.
  advanceTrainingTopic: (topic) =>
    api.post('/applypilot/training/advance', { topic }),
  // Memory CRUD (the "What I've taught my agent" panel).
  getMemory: () => api.get('/applypilot/training/memory'),
  updateMemory: (memoryId, value) =>
    api.put(`/applypilot/training/memory/${memoryId}`, { value }),
  deleteMemory: (memoryId) =>
    api.delete(`/applypilot/training/memory/${memoryId}`),

  // ---- Voice (Whisper STT + OpenAI TTS for training chat) -----------
  // Transcribe a short audio clip recorded via MediaRecorder.
  // `blob` is the Blob from MediaRecorder; returns { text }.
  transcribeAudio: (blob) => {
    const form = new FormData();
    const ext = (blob.type || '').includes('mp4') ? 'mp4'
      : (blob.type || '').includes('ogg') ? 'ogg'
      : 'webm';
    form.append('audio', blob, `clip.${ext}`);
    return api.post('/applypilot/voice/transcribe', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  // Synthesize speech. Returns an axios response with a Blob body.
  synthesizeSpeech: (text, voice = 'nova') =>
    api.post('/applypilot/voice/speak', { text, voice }, {
      responseType: 'blob',
    }),
  // Wipe the training conversation + memory and reset the current topic.
  resetTraining: () => api.post('/applypilot/training/reset'),
};

// Interview/Scheduling API
export const interviewAPI = {
  // Get all interviews for current user
  getMyInterviews: () => api.get('/interviews/my'),
  // Get calendar view interviews
  getCalendarInterviews: (month, year) => 
    api.get('/interviews/calendar', { params: { month, year } }),
  
  // Get single interview details
  getInterview: (id) => api.get(`/interviews/${id}`),
  
  // Create new interview request (recruiter)
  createInterview: (data) => api.post('/interviews', data),
  
  // Respond to interview (candidate)
  respondToInterview: (id, response) => 
    api.post(`/interviews/${id}/respond`, response),
  
  // Update interview (recruiter)
  updateInterview: (id, data) => api.put(`/interviews/${id}`, data),
  
  // Cancel interview
  cancelInterview: (id, reason) => 
    api.delete(`/interviews/${id}`, { data: { reason } }),
  
  // Get interview by message ID
  getInterviewByMessage: (messageId) => 
    api.get(`/interviews/pending/message/${messageId}`),
  
  // Request reschedule
  requestReschedule: (interviewId, data) => api.post(`/interviews/${interviewId}/reschedule`, data)
};

// Phone Screening API
export const phoneScreeningAPI = {
  // Get all phone screenings for recruiter
  getAll: (params = {}) => api.get('/phone-screening', { params }),
  
  // Get single phone screening details
  getById: (id) => api.get(`/phone-screening/${id}`),
  
  // Get phone screening for an interview
  getForInterview: (interviewId) => api.get(`/phone-screening/interview/${interviewId}`),
  
  // Schedule a phone screening
  schedule: (interviewId, data = {}) => 
    api.post(`/phone-screening/schedule/${interviewId}`, data),
  
  // Start a phone screening call immediately
  startCall: (id) => api.post(`/phone-screening/${id}/start`),
  
  // Cancel a scheduled phone screening
  cancel: (id) => api.post(`/phone-screening/${id}/cancel`),
  
  // Reschedule a phone screening (candidate)
  reschedule: (id, newDateTime, reason = '') => 
    api.post(`/phone-screening/${id}/reschedule`, { newDateTime, reason }),
  
  // Get screening results/transcript
  getResults: (id) => api.get(`/phone-screening/${id}/results`),
  
  // Get call statistics for recruiter dashboard
  getStats: () => api.get('/phone-screening/stats')
};

// Reputation API
export const reputationAPI = {
  // Get current user's stats
  getMyStats: () => api.get('/reputation/me'),
  
  // Get user's reputation
  getByUserId: (userId) => api.get(`/reputation/${userId}`),
  
  // Get leaderboard
  getLeaderboard: (category = 'teachingCredits') => 
    api.get('/reputation/leaderboard', { params: { category } }),
  
  // Get all badges with progress
  getBadges: () => api.get('/badges/me')
};

// Subscription & AI Usage API
export const subscriptionAPI = {
  // Get current subscription
  getCurrent: () => api.get('/subscriptions/my-subscription'),
  
  // Get AI usage summary
  getUsage: () => api.get('/subscriptions/usage'),
  
  // Create subscription
  create: (planType, paymentMethod) => 
    api.post('/subscriptions/subscribe', { planType, paymentMethod }),
  
  // Cancel subscription
  cancel: () => api.post('/subscriptions/cancel'),
  
  // Check feature access
  checkFeatureAccess: (feature) => 
    api.get(`/subscriptions/feature/${feature}`)
};

// Credit Packs API
export const creditPackAPI = {
  // Get available packs catalog
  getCatalog: () => api.get('/credit-packs/catalog'),
  
  // Get user's current credit balances
  getMyCredits: () => api.get('/credit-packs/my-credits'),
  
  // Purchase a credit pack
  purchase: (packId) => api.post('/credit-packs/purchase', { packId }),
};

// Notification API
export const notificationAPI = {
  // Get paginated notifications
  getAll: (params = {}) => api.get('/notifications', { params }),
  
  // Get unread count for badge
  getUnreadCount: () => api.get('/notifications/unread-count'),
  
  // Get preview for dropdown
  getPreview: (limit = 5) => api.get('/notifications/preview', { params: { limit } }),
  
  // Mark single notification as read
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  
  // Mark all notifications as read
  markAllAsRead: () => api.put('/notifications/read-all'),
  
  // Delete a notification
  delete: (id) => api.delete(`/notifications/${id}`),
  
  // Clear all notifications
  clearAll: (readOnly = false) => 
    api.delete('/notifications/clear-all', { params: { readOnly: readOnly.toString() } })
};

// Referral API
export const referralAPI = {
  // Get user's referral code and stats
  getMyCode: () => api.get('/referrals/my-code'),
  
  // Get all referrals made by user
  getMyReferrals: () => api.get('/referrals/my-referrals'),
  
  // Track referral link click (public)
  trackClick: (code) => api.post('/referrals/track-click', { code }),
  
  // Validate referral code (public, for signup)
  validate: (code) => api.post('/referrals/validate', { code }),
  
  // Complete referral after signup
  complete: (code) => api.post('/referrals/complete', { code }),
  
  // Complete referral by referrer user ID (from shared profile links)
  completeByReferrer: (referrerId) => api.post('/referrals/complete-by-referrer', { referrerId }),
  
  // Log a share action
  share: (source) => api.post('/referrals/share', { source }),
  
  // Get leaderboard
  getLeaderboard: (limit = 10) => api.get('/referrals/leaderboard', { params: { limit } })
};

// Kudos API - Peer recognition system
export const kudosAPI = {
  // Get all kudos types
  getTypes: () => api.get('/kudos/types'),
  
  // Give kudos to someone
  give: (data) => api.post('/kudos', data),
  
  // Remove kudos
  remove: (kudosId) => api.delete(`/kudos/${kudosId}`),
  
  // Get kudos for a post
  getForPost: (postId) => api.get(`/kudos/post/${postId}`),
  
  // Check if user gave kudos on a post
  checkPost: (postId) => api.get(`/kudos/check/${postId}`),
  
  // Get kudos received by current user
  getReceived: (page = 1, limit = 20) => api.get('/kudos/received', { params: { page, limit } }),
  
  // Get kudos given by current user
  getGiven: (page = 1, limit = 20) => api.get('/kudos/given', { params: { page, limit } }),
  
  // Get kudos stats for current user
  getStats: () => api.get('/kudos/stats'),
  
  // Get weekly leaderboard (type: 'receivers' | 'givers')
  getLeaderboard: (type = 'receivers', limit = 10) => 
    api.get('/kudos/leaderboard', { params: { type, limit } }),
  
  // Get public kudos for a user
  getForUser: (userId, page = 1, limit = 10) => 
    api.get(`/kudos/user/${userId}`, { params: { page, limit } })
};

// Polls API - Hot Takes & Debates
export const pollsAPI = {
  // Get poll categories
  getCategories: () => api.get('/polls/categories'),
  
  // Get expiry presets
  getExpiryPresets: () => api.get('/polls/expiry-presets'),
  
  // Create a poll
  create: (data) => api.post('/polls', data),
  
  // Get all polls with filters
  getAll: (params = {}) => api.get('/polls', { params }),
  
  // Get trending polls
  getTrending: (limit = 5) => api.get('/polls/trending', { params: { limit } }),
  
  // Get hot takes (polarizing polls)
  getHotTakes: (limit = 5) => api.get('/polls/hot-takes', { params: { limit } }),
  
  // Get a single poll
  getById: (pollId) => api.get(`/polls/${pollId}`),
  
  // Vote on a poll
  vote: (pollId, optionId) => api.post(`/polls/${pollId}/vote`, { optionId }),
  
  // Get voters for a poll
  getVoters: (pollId, params = {}) => api.get(`/polls/${pollId}/voters`, { params }),
  
  // Delete a poll
  delete: (pollId) => api.delete(`/polls/${pollId}`),
  
  // Track share
  trackShare: (pollId) => api.post(`/polls/${pollId}/share`),
  
  // Get user's polls
  getUserPolls: (userId, page = 1, limit = 10) => 
    api.get(`/polls/user/${userId}`, { params: { page, limit } }),
  
  // Check if user voted
  checkVote: (pollId) => api.get(`/polls/check/${pollId}`)
};

// Candidate Import API (Recruiters only)
export const candidateAPI = {
  // Upload CSV file for import
  uploadCSV: (file, jobId, autoProcess = false) => {
    const formData = new FormData();
    formData.append('file', file);
    if (jobId) formData.append('jobId', jobId);
    formData.append('autoProcess', autoProcess);
    return api.post('/candidates/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  // Import from LinkedIn URLs
  importLinkedIn: (urls, jobId, autoProcess = false) => 
    api.post('/candidates/import/linkedin', { urls, jobId, autoProcess }),
  
  // Import from email list
  importEmails: (emails, jobId, autoProcess = false, enrichData = false) => 
    api.post('/candidates/import/emails', { emails, jobId, autoProcess, enrichData }),
  
  // Get import status
  getImportStatus: (importId) => 
    api.get(`/candidates/import/${importId}`),
  
  // Get import history
  getImports: (params = {}) => 
    api.get('/candidates/imports', { params }),
  
  // Trigger processing for pending import
  processImport: (importId) => 
    api.post(`/candidates/import/${importId}/process`),
  
  // Trigger AI screening on imported candidates
  screenImport: (importId, screeningMode = 'fast', createApplications = true) => 
    api.post(`/candidates/import/${importId}/screen`, { screeningMode, createApplications }),
  
  // Download CSV template
  downloadTemplate: async () => {
    const response = await api.get('/candidates/import/template', { responseType: 'blob' });
    // Create download link
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'candidate_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return response;
  },
  
  // Delete/cancel import
  deleteImport: (importId) => 
    api.delete(`/candidates/import/${importId}`)
};

// ===== Invitation API =====
export const invitationAPI = {
  // Send bulk invitations to email list
  sendBulkInvitations: (data) =>
    api.post('/invitations/bulk', data),
  
  // Create invitations for import batch
  createInvitations: (importId, personalMessage = null) =>
    api.post(`/invitations/import/${importId}/create`, { personalMessage }),
  
  // Send pending invitations
  sendInvitations: (importId) =>
    api.post(`/invitations/import/${importId}/send`),
  
  // Create and send in one step
  sendAllInvitations: (importId, personalMessage = null) =>
    api.post(`/invitations/import/${importId}/send-all`, { personalMessage }),
  
  // Send reminder emails
  sendReminders: (importId) =>
    api.post(`/invitations/import/${importId}/remind`),
  
  // Get invitation statistics
  getStats: (importId) =>
    api.get(`/invitations/import/${importId}/stats`),
  
  // List invitations for import
  listInvitations: (importId, params = {}) =>
    api.get(`/invitations/import/${importId}`, { params }),
  
  // Get invitation by token (public)
  getInvitation: (token) =>
    api.get(`/invitations/${token}`),
  
  // Accept invitation (public)
  acceptInvitation: (token, data) =>
    api.post(`/invitations/${token}/accept`, data),
  
  // Decline invitation (public)
  declineInvitation: (token, reason = null) =>
    api.post(`/invitations/${token}/decline`, { reason }),
  
  // Track email events
  trackEvent: (token, event) =>
    api.post(`/invitations/${token}/track`, { event })
};

// Guest Screening API (public, no auth required)
export const guestScreeningAPI = {
  // Get invitation details + job + screening questions
  getScreeningData: (token) =>
    api.get(`/guest-screening/${token}`),
  
  // Submit guest screening (resume + answers)
  submitScreening: (token, formData) =>
    api.post(`/guest-screening/${token}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  // Track application status by tracking code
  trackApplication: (code) =>
    api.get(`/guest-screening/track/${code}`)
};

// Promo Code API (user-facing)
export const promoAPI = {
  redeem: (code) => api.post('/promo/redeem', { code }),
  getMyPromos: () => api.get('/promo/my-promos')
};

// Admin API
export const adminAPI = {
  // Dashboard
  getStats: () => api.get('/admin/stats'),

  // Users
  getUsers: (params = {}) => api.get('/admin/users', { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  changeRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),
  changeTier: (id, tier) => api.put(`/admin/users/${id}/tier`, { tier }),
  toggleActive: (id) => api.put(`/admin/users/${id}/toggle-active`),

  // Promos
  getPromos: () => api.get('/admin/promos'),
  createPromo: (data) => api.post('/admin/promos', data),
  updatePromo: (id, data) => api.put(`/admin/promos/${id}`, data),
  deletePromo: (id) => api.delete(`/admin/promos/${id}`),
  getRedemptions: (id) => api.get(`/admin/promos/${id}/redemptions`)
};

// External Applications API - Track jobs applied via ApplyPilot extension
export const externalApplicationAPI = {
  // Get all external applications with optional filters
  getAll: (params = {}) => api.get('/external-applications', { params }),

  // Get application statistics (counts by status, weekly stats, etc.)
  getStats: () => api.get('/external-applications/stats'),

  // Save a new external application
  create: (data) => api.post('/external-applications', data),

  // Update an application (status, notes, etc.)
  update: (id, data) => api.put(`/external-applications/${id}`, data),

  // Delete an application
  delete: (id) => api.delete(`/external-applications/${id}`),

  // Bulk save applications (batch sync from extension)
  bulkCreate: (applications) => api.post('/external-applications/bulk', { applications }),
};

// External Jobs API - Jobs pulled from ATS platforms (Greenhouse, RemoteOK, Adzuna)
export const externalJobAPI = {
  getAll: (params = {}) => api.get('/external-jobs', { params }),
  getById: (id) => api.get(`/external-jobs/${id}`),
  getStats: () => api.get('/external-jobs/stats'),
  getCompanies: () => api.get('/external-jobs/companies'),
  getDepartments: () => api.get('/external-jobs/departments'),
  getLocations: () => api.get('/external-jobs/locations'),
  // Save / unsave / list — backed by the polymorphic SavedJob table.
  // Replaces the old localStorage-only path.
  save: (id) => api.post(`/external-jobs/${id}/save`),
  unsave: (id) => api.delete(`/external-jobs/${id}/save`),
  getSaved: () => api.get('/external-jobs/saved'),
  checkSaved: (externalJobIds) => api.post('/external-jobs/check-saved', { externalJobIds }),
  // "Recommended for you" rail — top N relevant + recent jobs with a per-job
  // reason string. Powers the strip at the top of the Discover tab.
  getRecommended: (limit = 8) => api.get('/external-jobs/recommended', { params: { limit } }),
  // Top skills across the active corpus (for the skill-filter typeahead).
  // Optional `q` does a substring match against skill names.
  getSkills: (q = '', limit = 100) => api.get('/external-jobs/skills', { params: q ? { q, limit } : { limit } }),
};

// Greenhouse Harvest API - Recruiter's own ATS integration
export const harvestAPI = {
  connect: (apiKey, label) => api.post('/harvest/connect', { apiKey, label }),
  disconnect: () => api.delete('/harvest/disconnect'),
  getStatus: () => api.get('/harvest/status'),
  getJobs: () => api.get('/harvest/jobs'),
  getJob: (jobId) => api.get(`/harvest/jobs/${jobId}`),
};

export default api;
