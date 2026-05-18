# ProfileAI - Professional App Roadmap

**Goal:** Transform ProfileAI into a production-ready, professional application  
**Total Estimated Time:** 15-20 hours  
**Priority Order:** Critical → High → Medium → Low

---

## Phase 1: Critical Fixes (Priority: 🔴 URGENT)

### Task 1.1: Fix Orphan Navigation Links
**Time:** 30 minutes  
**Files:** `frontend/src/components/Navbar.jsx`

**Prompt:**
> Remove the following broken navigation links from Navbar.jsx since the pages don't exist:
> - `/recruiter/pipeline`
> - `/recruiter/analytics`  
> - `/recruiter/team`
> - `/applications`
> 
> Keep only links to pages that actually exist. Add a comment `// TODO: Implement these pages` where appropriate.

**Acceptance Criteria:**
- [ ] No 404 errors when clicking nav items
- [ ] All visible links lead to working pages

---

### Task 1.2: Protect /browse Route
**Time:** 15 minutes  
**Files:** `frontend/src/App.jsx`

**Prompt:**
> In App.jsx, wrap the `/browse` route with PrivateRoute component to require authentication. Only recruiters should be able to browse candidate profiles.
> 
> Change from:
> ```jsx
> <Route path="/browse" element={<BrowseProfiles />} />
> ```
> To:
> ```jsx
> <Route path="/browse" element={
>   <PrivateRoute allowedRoles={['recruiter']}>
>     <BrowseProfiles />
>   </PrivateRoute>
> } />
> ```

**Acceptance Criteria:**
- [ ] Unauthenticated users redirected to login
- [ ] Candidates cannot access /browse
- [ ] Recruiters can access /browse normally

---

### Task 1.3: Remove Hardcoded Notification Badge
**Time:** 10 minutes  
**Files:** `frontend/src/components/Navbar.jsx`

**Prompt:**
> Remove the hardcoded notification badge that always shows "3". Either:
> 1. Remove the badge entirely until we implement real notifications, OR
> 2. Hide the badge when there are no notifications
> 
> Find and remove/modify:
> ```jsx
> <span className="badge">3</span>
> ```

**Acceptance Criteria:**
- [ ] No fake notification count shown
- [ ] UI doesn't mislead users about notifications

---

### Task 1.4: Fix Subscription Gating in Agent Arena
**Time:** 45 minutes  
**Files:** `backend/routes/agentArena.js`

**Prompt:**
> The Agent Arena currently bypasses all subscription checks with hardcoded `{ canCreate: true }`. Implement proper subscription gating:
> 
> 1. Import the User model and check `req.user.subscriptionTier`
> 2. Define limits per tier:
>    - `free`: 1 negotiation per month
>    - `pro`: 10 negotiations per month  
>    - `enterprise`: unlimited
> 3. Count user's negotiations this month before allowing new ones
> 4. Return 403 with upgrade message if limit exceeded
> 
> Remove this hardcoded bypass:
> ```javascript
> const subscriptionLimits = { canCreate: true, tier: 'unlimited' };
> ```

**Acceptance Criteria:**
- [ ] Free users limited to 1 negotiation/month
- [ ] Pro users limited to 10 negotiations/month
- [ ] Enterprise users have unlimited access
- [ ] Clear error message when limit exceeded

---

### Task 1.5: Add Recruitment Automation Visibility
**Time:** 2 hours  
**Files:** 
- `backend/routes/jobs.js`
- `backend/services/recruitmentService.js`
- `frontend/src/pages/RecruiterJobs.jsx` (or new component)

**Prompt - Backend:**
> Create a new endpoint `GET /api/jobs/:id/screening-status` that returns:
> ```json
> {
>   "jobId": 1,
>   "status": "completed", // "pending" | "screening" | "completed"
>   "candidatesFound": 45,
>   "candidatesScreened": 45,
>   "shortlisted": [
>     {
>       "candidateId": 12,
>       "name": "John Doe",
>       "fitScore": 92,
>       "interestScore": 85,
>       "profilePicture": "url"
>     }
>   ],
>   "startedAt": "2024-12-30T10:00:00Z",
>   "completedAt": "2024-12-30T10:05:00Z"
> }
> ```
> 
> Modify `recruitmentService.js` to store screening progress in a new `JobScreening` model or in the Job model itself.

**Prompt - Frontend:**
> Create a `ScreeningProgress` component that:
> 1. Polls `/api/jobs/:id/screening-status` every 5 seconds while status is "screening"
> 2. Shows a progress bar during screening
> 3. Displays shortlisted candidates with fit scores when complete
> 4. Appears automatically after job creation

**Acceptance Criteria:**
- [ ] Recruiter sees "Screening in progress..." after posting job
- [ ] Progress updates in real-time
- [ ] Shortlisted candidates shown with scores
- [ ] Can view screening results anytime from job detail page

---

## Phase 2: UX Improvements (Priority: 🟡 HIGH)

### Task 2.1: Add Empty States
**Time:** 1 hour  
**Files:** Multiple page components

**Prompt:**
> Create a reusable `EmptyState` component and add it to all list pages:
> 
> ```jsx
> // components/EmptyState.jsx
> const EmptyState = ({ 
>   icon, // emoji or icon component
>   title, 
>   description, 
>   actionText, 
>   actionLink 
> }) => (
>   <div className="empty-state">
>     <span className="empty-icon">{icon}</span>
>     <h3>{title}</h3>
>     <p>{description}</p>
>     {actionText && <Link to={actionLink}>{actionText}</Link>}
>   </div>
> );
> ```
> 
> Add to these pages with appropriate messages:
> - Jobs list: "No jobs posted yet. Create your first job posting!"
> - Messages: "No conversations yet. Start connecting with candidates!"
> - Feed: "Your feed is empty. Follow people to see their posts!"
> - Applications: "No applications received yet."

**Acceptance Criteria:**
- [ ] All list pages show helpful empty states
- [ ] Empty states include actionable next steps
- [ ] Consistent styling across all empty states

---

### Task 2.2: Add Loading States for AI Operations
**Time:** 45 minutes  
**Files:** Components that use AI features

**Prompt:**
> Add skeleton loaders and progress indicators to all AI-powered features:
> 
> 1. Profile Enhancement (`ProfileForm.jsx`):
>    - Show "✨ AI is enhancing your profile..." with pulsing animation
>    - Disable form while processing
>    
> 2. Job Generation (`RecruiterJobs.jsx`):
>    - Show "🤖 Generating job description..." 
>    - Display typing animation effect
>    
> 3. Agent Arena (`AgentArena.jsx`):
>    - Show "🤝 Agents are negotiating..." between rounds
>    - Display which agent is "thinking"
> 
> Create a reusable `AILoadingState` component with customizable messages.

**Acceptance Criteria:**
- [ ] Users never see frozen UI during AI operations
- [ ] Clear indication that AI is working
- [ ] Estimated time shown when possible

---

### Task 2.3: Fix "My Jobs" Label Confusion  
**Time:** 15 minutes  
**Files:** `frontend/src/components/Navbar.jsx`

**Prompt:**
> Update navigation labels to be role-specific and clear:
> 
> For Recruiters:
> - "My Jobs" → "Posted Jobs"
> - Add "Candidates" link to /browse
> 
> For Candidates:
> - "My Jobs" → "Job Board" (links to /jobs)
> - Add "My Applications" (if page exists)
> 
> Use `user.role` from auth context to show appropriate labels.

**Acceptance Criteria:**
- [ ] Recruiters see "Posted Jobs" not "My Jobs"
- [ ] Candidates see "Job Board" not "My Jobs"
- [ ] No confusion about what each link does

---

### Task 2.4: Add Onboarding Flow
**Time:** 1.5 hours  
**Files:** New component + Dashboard modifications

**Prompt:**
> Create an onboarding checklist that appears on the dashboard for new users:
> 
> ```jsx
> // components/OnboardingChecklist.jsx
> const OnboardingChecklist = ({ user, profile }) => {
>   const tasks = [
>     { 
>       id: 'profile', 
>       label: 'Complete your profile', 
>       done: profile?.headline && profile?.summary,
>       link: '/profile/edit'
>     },
>     { 
>       id: 'picture', 
>       label: 'Add a profile picture', 
>       done: !!profile?.profilePicture,
>       link: '/profile/edit'
>     },
>     { 
>       id: 'skills', 
>       label: 'Add your skills', 
>       done: profile?.skills?.length > 0,
>       link: '/profile/edit'
>     },
>     // Role-specific tasks...
>   ];
>   
>   const progress = tasks.filter(t => t.done).length / tasks.length * 100;
>   
>   if (progress === 100) return null; // Hide when complete
>   
>   return (
>     <div className="onboarding-card">
>       <h3>Complete your profile</h3>
>       <ProgressBar value={progress} />
>       <ul>{tasks.map(task => <TaskItem key={task.id} {...task} />)}</ul>
>     </div>
>   );
> };
> ```
> 
> Show different tasks for candidates vs recruiters.

**Acceptance Criteria:**
- [ ] New users see onboarding checklist
- [ ] Progress bar shows completion percentage
- [ ] Tasks link to relevant pages
- [ ] Checklist hides when 100% complete
- [ ] Different tasks for each role

---

### Task 2.5: Standardize Error Handling
**Time:** 1 hour  
**Files:** Frontend services and components

**Prompt:**
> Create a unified error handling system:
> 
> 1. Create `utils/errorHandler.js`:
> ```javascript
> export const handleAPIError = (error) => {
>   const message = error.response?.data?.message 
>     || error.response?.data?.error 
>     || error.message 
>     || 'Something went wrong';
>   
>   toast.error(message);
>   return message;
> };
> ```
> 
> 2. Create `components/FormError.jsx` for inline validation:
> ```jsx
> const FormError = ({ error }) => 
>   error ? <span className="form-error">{error}</span> : null;
> ```
> 
> 3. Update all API calls to use `handleAPIError`
> 4. Update all forms to use `FormError` for validation
> 
> Backend: Standardize all error responses to:
> ```json
> { "success": false, "message": "Error description" }
> ```

**Acceptance Criteria:**
- [ ] All errors show user-friendly messages
- [ ] Form validation errors appear inline
- [ ] Server errors show as toast notifications
- [ ] No silent failures

---

### Task 2.6: Mobile Responsiveness Audit
**Time:** 2 hours  
**Files:** CSS/styling files, component layouts

**Prompt:**
> Audit and fix mobile responsiveness at 375px viewport:
> 
> 1. **Navbar:** 
>    - Add hamburger menu for mobile
>    - Collapse navigation into drawer
>    
> 2. **Dashboard Cards:**
>    - Stack cards vertically on mobile
>    - Full-width cards under 768px
>    
> 3. **Tables:**
>    - Convert to card layout on mobile
>    - Or add horizontal scroll with visual indicator
>    
> 4. **Modals:**
>    - Full-screen on mobile
>    - Proper padding and scroll behavior
>    
> 5. **Forms:**
>    - Full-width inputs on mobile
>    - Larger touch targets (min 44px)
> 
> Test each page at: 375px, 768px, 1024px, 1440px

**Acceptance Criteria:**
- [ ] No horizontal scroll on any page at 375px
- [ ] All buttons/links have 44px+ touch target
- [ ] Text readable without zooming
- [ ] Forms usable on mobile

---

## Phase 3: Feature Completion (Priority: 🟢 MEDIUM)

### Task 3.1: Implement Tailored Profiles Frontend
**Time:** 2 hours  
**Files:** New page component

**Prompt:**
> The backend for Tailored Profiles exists but there's no frontend. Create:
> 
> 1. `pages/TailoredProfiles.jsx` - List user's tailored profiles
> 2. `pages/CreateTailoredProfile.jsx` - Form to create new tailored profile
> 
> Features needed:
> - Select a job to tailor profile for
> - AI generates tailored version of profile
> - View/edit/delete tailored profiles
> - Download tailored resume
> 
> Use existing `/api/tailored-profiles` endpoints.

**Acceptance Criteria:**
- [ ] Can create tailored profile for specific job
- [ ] AI customizes profile content
- [ ] Can view list of all tailored profiles
- [ ] Can download as PDF

---

### Task 3.2: Build Basic Analytics Dashboard
**Time:** 3 hours  
**Files:** New page + backend endpoints

**Prompt:**
> Create a recruiter analytics dashboard at `/recruiter/analytics`:
> 
> **Metrics to show:**
> - Total jobs posted
> - Total candidates viewed
> - Total applications received
> - Average fit score of applicants
> - Jobs by status (active/closed)
> - Top performing jobs (most applicants)
> 
> **Backend endpoint:** `GET /api/recruiter/analytics`
> ```json
> {
>   "totalJobs": 12,
>   "activeJobs": 8,
>   "totalViews": 456,
>   "totalApplications": 89,
>   "averageFitScore": 72,
>   "topJobs": [...]
> }
> ```
> 
> **Frontend:** Use cards and simple charts (can use recharts library)

**Acceptance Criteria:**
- [ ] Analytics page loads with real data
- [ ] Key metrics displayed prominently
- [ ] Data refreshes on page load
- [ ] Mobile-friendly layout

---

### Task 3.3: Add Real Notifications System
**Time:** 3 hours  
**Files:** Backend + Frontend

**Prompt:**
> Implement a basic notifications system:
> 
> **Backend:**
> 1. Create `Notification` model:
>    - id, userId, type, title, message, read, createdAt
>    - Types: 'new_message', 'new_follower', 'job_match', 'application'
>    
> 2. Create endpoints:
>    - `GET /api/notifications` - Get user's notifications
>    - `PUT /api/notifications/:id/read` - Mark as read
>    - `PUT /api/notifications/read-all` - Mark all as read
>    
> 3. Create notifications when:
>    - Someone follows the user
>    - User receives a message
>    - New job matches user's profile (candidates)
>    - Someone applies to user's job (recruiters)
> 
> **Frontend:**
> 1. Notification bell icon with unread count
> 2. Dropdown showing recent notifications
> 3. Full notifications page at `/notifications`
> 4. Click notification to navigate to relevant page

**Acceptance Criteria:**
- [ ] Real notification count in navbar
- [ ] Notifications created for key events
- [ ] Can mark as read
- [ ] Notifications link to relevant content

---

### Task 3.4: Implement Application Tracking
**Time:** 2 hours  
**Files:** New model + routes + pages

**Prompt:**
> Create application tracking for candidates:
> 
> **Backend:**
> 1. Create `Application` model:
>    - id, candidateId, jobId, status, appliedAt, notes
>    - Status: 'applied', 'viewed', 'shortlisted', 'rejected', 'hired'
>    
> 2. Endpoints:
>    - `POST /api/applications` - Apply to job
>    - `GET /api/applications` - Get user's applications
>    - `PUT /api/applications/:id/status` - Update status (recruiter)
> 
> **Frontend:**
> 1. "Apply" button on job listings
> 2. `/applications` page showing all applications with status
> 3. Recruiter can update application status

**Acceptance Criteria:**
- [ ] Candidates can apply to jobs
- [ ] Application status tracked
- [ ] Candidates see their applications
- [ ] Recruiters can update status

---

## Phase 4: Code Quality (Priority: ⚪ LOW)

### Task 4.1: Remove Console Logs
**Time:** 30 minutes  
**Files:** All backend files

**Prompt:**
> Search and remove all console.log statements from backend code, or replace with proper logging:
> 
> 1. Install winston: `npm install winston`
> 2. Create `utils/logger.js`:
> ```javascript
> const winston = require('winston');
> const logger = winston.createLogger({
>   level: process.env.LOG_LEVEL || 'info',
>   format: winston.format.json(),
>   transports: [
>     new winston.transports.File({ filename: 'error.log', level: 'error' }),
>     new winston.transports.File({ filename: 'combined.log' }),
>   ],
> });
> if (process.env.NODE_ENV !== 'production') {
>   logger.add(new winston.transports.Console());
> }
> module.exports = logger;
> ```
> 3. Replace `console.log` with `logger.info`, `console.error` with `logger.error`

**Acceptance Criteria:**
- [ ] No console.log in production code
- [ ] Proper logging with levels
- [ ] Logs written to files

---

### Task 4.2: Standardize API Error Responses
**Time:** 45 minutes  
**Files:** All backend route files

**Prompt:**
> Standardize all API error responses to this format:
> 
> ```javascript
> // Success
> res.json({ success: true, data: {...} });
> 
> // Error
> res.status(400).json({ 
>   success: false, 
>   error: { 
>     message: 'Human readable message',
>     code: 'ERROR_CODE' // optional
>   }
> });
> ```
> 
> Create a helper in `utils/apiResponse.js`:
> ```javascript
> exports.success = (res, data, status = 200) => 
>   res.status(status).json({ success: true, data });
> 
> exports.error = (res, message, status = 400, code = null) =>
>   res.status(status).json({ success: false, error: { message, code } });
> ```
> 
> Update all routes to use these helpers.

**Acceptance Criteria:**
- [ ] All endpoints use consistent response format
- [ ] Frontend can reliably parse errors
- [ ] Error codes for programmatic handling

---

### Task 4.3: Add Database Indexes
**Time:** 20 minutes  
**Files:** Model files or migration

**Prompt:**
> Add indexes to improve query performance:
> 
> ```javascript
> // In Job model
> indexes: [
>   { fields: ['recruiterId'] },
>   { fields: ['status'] },
>   { fields: ['createdAt'] }
> ]
> 
> // In Profile model  
> indexes: [
>   { fields: ['userId'] },
>   { fields: ['skills'], using: 'GIN' } // for array search
> ]
> 
> // In Application model
> indexes: [
>   { fields: ['candidateId'] },
>   { fields: ['jobId'] },
>   { fields: ['status'] }
> ]
> 
> // In Message model
> indexes: [
>   { fields: ['conversationId'] },
>   { fields: ['createdAt'] }
> ]
> ```
> 
> Run `npm run init-db` to apply changes.

**Acceptance Criteria:**
- [ ] Indexes created on frequently queried columns
- [ ] Query performance improved
- [ ] No breaking changes

---

### Task 4.4: Environment Variable Audit
**Time:** 30 minutes  
**Files:** Frontend service files, config files

**Prompt:**
> Audit all hardcoded URLs and replace with environment variables:
> 
> 1. Search for `localhost` in frontend code
> 2. Search for `5001` port references
> 3. Replace with `import.meta.env.VITE_API_URL`
> 
> Create `.env.example` files for both frontend and backend with all required variables documented.
> 
> Backend `.env.example`:
> ```
> NODE_ENV=development
> PORT=5001
> DB_HOST=localhost
> DB_NAME=profileai
> DB_USER=postgres
> DB_PASSWORD=
> JWT_SECRET=
> OPENAI_API_KEY=
> CLOUDINARY_CLOUD_NAME=
> CLOUDINARY_API_KEY=
> CLOUDINARY_API_SECRET=
> STRIPE_SECRET_KEY=
> PAYPAL_CLIENT_ID=
> PAYPAL_SECRET=
> ```

**Acceptance Criteria:**
- [ ] No hardcoded URLs in code
- [ ] .env.example files document all variables
- [ ] App works with different API URLs

---

## Summary Checklist

### Phase 1: Critical (Do First)
- [ ] 1.1 Fix orphan navigation links
- [ ] 1.2 Protect /browse route
- [ ] 1.3 Remove hardcoded notification badge
- [ ] 1.4 Fix subscription gating
- [ ] 1.5 Add recruitment automation visibility

### Phase 2: UX (Do Second)
- [ ] 2.1 Add empty states
- [ ] 2.2 Add AI loading states
- [ ] 2.3 Fix navigation labels
- [ ] 2.4 Add onboarding flow
- [ ] 2.5 Standardize error handling
- [ ] 2.6 Fix mobile responsiveness

### Phase 3: Features (Do Third)
- [ ] 3.1 Tailored profiles frontend
- [ ] 3.2 Analytics dashboard
- [ ] 3.3 Notifications system
- [ ] 3.4 Application tracking

### Phase 4: Code Quality (Do Last)
- [ ] 4.1 Remove console logs
- [ ] 4.2 Standardize API responses
- [ ] 4.3 Add database indexes
- [ ] 4.4 Environment variable audit

---

## Quick Reference Commands

```bash
# Start development
cd backend && node server.js    # Terminal 1
cd frontend && npm run dev      # Terminal 2

# Database
cd backend && npm run init-db   # Sync schema

# Testing
curl http://localhost:5001/api/health  # Check backend
```

---

*Roadmap created: December 30, 2024*  
*Last updated: December 30, 2024*
