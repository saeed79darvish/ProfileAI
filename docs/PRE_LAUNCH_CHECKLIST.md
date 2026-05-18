# ProfileAI Pre-Launch Checklist

**Last Updated:** February 9, 2026  
**Status:** 🟡 Near MVP-Ready

---

## 📊 Feature Status Overview

### ✅ WORKING (Verified with real credentials)
| Feature | Status | Notes |
|---------|--------|-------|
| AI Service (Claude) | ✅ Working | Anthropic API key configured |
| Email (Resend) | ✅ Working | `RESEND_API_KEY` configured |
| File Uploads (Cloudinary) | ✅ Working | Real credentials |
| Phone Screening (Vapi) | ✅ Working | Real API key + phone number |
| Privacy Policy Page | ✅ Done | 349 lines, comprehensive |
| Terms of Service Page | ✅ Done | 474 lines, full legal coverage |
| Cookie Consent Banner | ✅ Done | GDPR-compliant with Accept/Decline |
| Pricing Page | ✅ Done | 3-tier pricing with billing toggle |

### ⚠️ PLACEHOLDER (Code exists, needs credentials)
| Feature | Issue | Action Required |
|---------|-------|-----------------|
| Google OAuth | Empty `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Get from Google Cloud Console |
| GitHub OAuth | Empty `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Get from GitHub Developer Settings |
| Stripe Payments | Using placeholder `sk_test_your_stripe_secret_key_here` | Get from Stripe Dashboard |
| PayPal Payments | Using placeholder `your_paypal_client_id_here` | Get from PayPal Developer |

### ❌ NOT IMPLEMENTED
| Feature | Impact | Priority |
|---------|--------|----------|
| Redis Caching | Performance at scale | Medium |
| Feedback Persistence | Losing ML training data | Medium |
| General Rate Limiting | Security vulnerability | High |
| Login Attempt Limiting | Security vulnerability | High |

---

## 🔴 CRITICAL - Must Complete Before Launch

### 1. Legal Pages ✅ FULLY COMPLETE

#### ~~Step 1.1: Create Privacy Policy Page~~ ✅ COMPLETE
- [x] `frontend/src/pages/PrivacyPolicy.jsx` exists (349 lines)
- [x] Covers data collection, AI disclosure, third-party services
- [x] Route `/privacy` configured
- [ ] **Have a lawyer review before launch**

#### ~~Step 1.2: Create Terms of Service Page~~ ✅ COMPLETE
- [x] `frontend/src/pages/TermsOfService.jsx` exists (474 lines)
- [x] Covers user accounts, AI content, payments, liability
- [x] Route `/terms` configured
- [ ] **Have a lawyer review before launch**

#### ~~Step 1.3: Add Cookie Consent Banner~~ ✅ COMPLETE
- [x] Installed `react-cookie-consent` library
- [x] Created `frontend/src/components/CookieConsent.jsx`
- [x] Added to `App.jsx` (renders on all pages)
- [x] Consent stored in localStorage as `profileai_cookie_consent`
- [x] Links to Privacy Policy in the banner
- [x] Accept/Decline buttons with styled GDPR-compliant design

---

### 2. OAuth Configuration ⚠️ NEEDS CREDENTIALS

#### Step 2.1: Set Up Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Add authorized redirect URI: `https://yourdomain.com/api/auth/google/callback`
6. Copy Client ID and Secret to `.env`:
```
GOOGLE_CLIENT_ID=your_real_client_id
GOOGLE_CLIENT_SECRET=your_real_secret
```
**Current Status:** Code in `backend/config/passport.js` ready, just needs credentials

#### Step 2.2: Set Up GitHub OAuth
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App
3. Set callback URL: `https://yourdomain.com/api/auth/github/callback`
4. Copy Client ID and Secret to `.env`:
```
GITHUB_CLIENT_ID=your_real_client_id
GITHUB_CLIENT_SECRET=your_real_secret
```
**Current Status:** Code ready, just needs credentials

---

### 3. Security Hardening ❌ PARTIALLY DONE

#### Step 3.1: Add Rate Limiting to Auth Endpoints ❌ NOT DONE
1. The project already has `express-rate-limit` installed
2. Edit `backend/routes/auth.js`:

```javascript
const rateLimit = require('express-rate-limit');

// Add at top of file
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: { error: 'Too many password reset requests. Please try again later.' },
});

// Apply to routes:
router.post('/login', authLimiter, [...]);
router.post('/register', authLimiter, [...]);
router.post('/forgot-password', passwordResetLimiter, [...]);
```

#### Step 3.2: Fix CORS Configuration
1. Edit `backend/server.js`:

```javascript
// Replace hardcoded origins with env variable
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

2. Add to `.env.example`:
```
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

#### Step 3.3: Remove Debug Console Logs
Search and remove/comment these patterns:
- [ ] `backend/middleware/auth.js` - Token presence logging
- [ ] `backend/routes/auth.js` - Password reset link logging
- [ ] Any `console.log` containing sensitive data

Run this command to find them:
```bash
grep -r "console.log" backend/ | grep -i "token\|password\|secret\|key"
```

---

### 4. Payment Configuration ⚠️ NEEDS CREDENTIALS

#### Step 4.1: Set Up Production Stripe Keys
**Current Status:** Using placeholder `sk_test_your_stripe_secret_key_here`

1. Get production keys from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Add to production `.env`:
```
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
```
3. Create products and prices in Stripe Dashboard for:
   - Candidate Pro Monthly ($19.99)
   - Candidate Pro Yearly ($199.99)
   - Candidate Enterprise Monthly ($49.99)
   - Recruiter Pro Monthly ($99.99)
   - Recruiter Pro Yearly ($999.99)
   - Recruiter Enterprise Monthly ($299.99)
4. Update price IDs in `backend/services/paymentService.js`

#### Step 4.2: Set Up Production PayPal
**Current Status:** Using placeholder `your_paypal_client_id_here`

1. Get production credentials from [PayPal Developer](https://developer.paypal.com/)
2. Create subscription plans in PayPal matching Stripe tiers
3. Update `backend/services/paymentService.js` with real plan IDs

#### Step 4.3: Test Payment Webhooks
1. Use Stripe CLI for local testing: `stripe listen --forward-to localhost:5001/api/subscriptions/webhook`
2. Verify webhook endpoint handles all events properly
3. Test subscription creation, update, and cancellation flows

---

### 5. Environment Validation (Week 1, Day 5)

#### Step 5.1: Create Environment Validator
Create `backend/config/validateEnv.js`:

```javascript
const requiredEnvVars = [
  'DB_HOST',
  'DB_NAME', 
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET',
  'OPENAI_API_KEY',
];

const productionRequiredVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CORS_ORIGINS',
];

function validateEnv() {
  const missing = [];
  
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });
  
  if (process.env.NODE_ENV === 'production') {
    productionRequiredVars.forEach(varName => {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    });
  }
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated');
}

module.exports = validateEnv;
```

Add to `backend/server.js` at the top:
```javascript
require('./config/validateEnv')();
```

---

## 🟠 IMPORTANT - Complete Within First Week Post-Launch

### 6. GDPR Compliance Features

#### Step 6.1: Create Data Export Endpoint
Add to `backend/routes/auth.js`:
```javascript
// GET /api/auth/account/export
router.get('/account/export', authMiddleware, async (req, res) => {
  // Gather all user data from Profile, Posts, Applications, etc.
  // Return as downloadable JSON
});
```

#### Step 6.2: Create Account Deletion Endpoint
Add to `backend/routes/auth.js`:
```javascript
// DELETE /api/auth/account
router.delete('/account', authMiddleware, async (req, res) => {
  // Soft delete or anonymize user data
  // Cancel any active subscriptions
  // Send confirmation email
});
```

#### Step 6.3: Create Account Settings Page
1. Create `frontend/src/pages/AccountSettings.jsx`
2. Include:
   - Password change form
   - Data export button
   - Account deletion (with confirmation)
   - Notification preferences
3. Add route and navigation link

---

### 7. Error Handling Improvements

#### Step 7.1: Add Global Error Boundary
Create `frontend/src/components/ErrorBoundary.jsx`:
```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    // Log to error reporting service (Sentry, etc.)
    console.error('Uncaught error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

Wrap `App.jsx` with ErrorBoundary.

#### Step 7.2: Add Empty States to List Pages
Check and add empty states to:
- [ ] Jobs list page
- [ ] Applications list page
- [ ] Messages/Conversations list
- [ ] Saved jobs list
- [ ] Candidate search results
- [ ] Notifications list

---

### 8. Database Production Setup

#### Step 8.1: Set Up Sequelize Migrations
```bash
cd backend
npx sequelize-cli init
```

#### Step 8.2: Disable Auto-Sync in Production
Edit `backend/config/database.js`:
```javascript
// Only sync in development
if (process.env.NODE_ENV !== 'production') {
  sequelize.sync({ alter: true });
}
```

#### Step 8.3: Create Backup Strategy
- Set up automated daily backups
- Test restore procedure
- Document recovery steps

---

### 9. Refresh Token Implementation

#### Step 9.1: Generate Refresh Tokens on Login
1. Create `refreshTokens` table in database
2. Generate long-lived refresh token alongside access token
3. Store refresh token in httpOnly cookie

#### Step 9.2: Add Token Refresh Endpoint
```javascript
// POST /api/auth/refresh-token
router.post('/refresh-token', async (req, res) => {
  // Validate refresh token from cookie
  // Generate new access token
  // Optionally rotate refresh token
});
```

#### Step 9.3: Update Frontend Auth Context
- Intercept 401 responses
- Automatically call refresh endpoint
- Retry failed request with new token

---

## 🟡 NICE-TO-HAVE - Post-Launch Improvements

### 10. Production Monitoring
- [ ] Set up error tracking (Sentry, Bugsnag)
- [ ] Add APM (Application Performance Monitoring)
- [ ] Configure structured logging (Winston/Pino)
- [ ] Set up uptime monitoring
- [ ] Create health check dashboard

### 11. Enhanced Health Check
Update `/health` endpoint to check:
- [ ] Database connection
- [ ] Redis connection (if used)
- [ ] OpenAI API availability
- [ ] Stripe API availability
- [ ] Vapi connectivity

### 12. API Documentation
- [ ] Add Swagger/OpenAPI documentation
- [ ] Create API versioning (`/api/v1/`)
- [ ] Document all endpoints

### 13. Accessibility Audit
- [ ] Run axe-core accessibility audit
- [ ] Add proper ARIA labels
- [ ] Ensure keyboard navigation
- [ ] Check color contrast ratios

### 14. Performance Optimization
- [ ] Implement React.lazy for code splitting
- [ ] Add image optimization
- [ ] Enable gzip compression
- [ ] Add caching headers
- [ ] Consider CDN for static assets

---

## 📋 Pre-Launch Checklist Summary

### ✅ Already Done
- [x] Privacy Policy page created (349 lines)
- [x] Terms of Service page created (474 lines)
- [x] Cookie consent banner (GDPR-compliant)
- [x] Pricing page with 3-tier plans
- [x] AI Service (Claude) working
- [x] Email service (Resend) working
- [x] File uploads (Cloudinary) working
- [x] Phone screening (Vapi) working
- [x] AI rate limiting per subscription tier
- [x] 50 frontend pages implemented
- [x] 27 backend route files
- [x] 17 backend services

### ⚠️ Needs Credentials Only
- [ ] Google OAuth - get from Google Cloud Console
- [ ] GitHub OAuth - get from GitHub Developer Settings
- [ ] Stripe payments - get from Stripe Dashboard
- [ ] PayPal payments - get from PayPal Developer

### ❌ Needs Implementation
- [ ] General API rate limiting (auth endpoints)
- [ ] Login attempt limiting
- [ ] Redis caching for production scale
- [ ] Feedback persistence (currently console.log only)
- [ ] Missing recruiter pages: /recruiter/analytics, /recruiter/pipeline, /recruiter/team

### Day 1-2: Credentials
- [ ] Set up Google OAuth credentials
- [ ] Set up GitHub OAuth credentials
- [ ] Set up Stripe production credentials
- [ ] Set up PayPal production credentials

### Day 3-4: Security
- [ ] Add auth rate limiting
- [ ] Add login attempt limiting
- [x] ~~Cookie consent banner~~ ✅ DONE
- [ ] Remove debug console.logs

### Day 5-7: Final Testing
- [ ] Full user flow testing (signup → subscription → usage)
- [ ] OAuth flow testing (Google, GitHub)
- [ ] Payment flow testing (Stripe, PayPal)
- [ ] Mobile responsive testing
- [ ] Cross-browser testing

### Launch Day
- [ ] DNS configured
- [ ] SSL certificate active
- [ ] Monitoring enabled
- [ ] Error tracking enabled
- [ ] Backup verified
- [ ] Team notified
- [ ] Go live! 🚀

---

## 📞 Support Contacts

| Service | Contact | Purpose |
|---------|---------|---------|
| OpenAI | support@openai.com | API issues |
| Stripe | dashboard.stripe.com/support | Payment issues |
| Vapi | vapi.ai/support | Phone screening issues |
| Cloudinary | support.cloudinary.com | File upload issues |

---

## 📚 Reference Documents

- [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md) - Feature roadmap
- [PRODUCT_AUDIT.md](./PRODUCT_AUDIT.md) - Detailed product audit
- [QUICKSTART.md](./QUICKSTART.md) - Development setup
- [PAYMENT_SETUP.md](./PAYMENT_SETUP.md) - Payment configuration
- [RECRUITER_GUIDE.md](./RECRUITER_GUIDE.md) - Recruiter features

---

## 🏆 What's Actually Working (50 Pages, 27 Route Files, 17 Services)

### Frontend Pages (All 50 Implemented)
**Auth:** Login, Register, ForgotPassword, ResetPassword, CandidateOnboarding, RecruiterOnboarding
**Public:** Home, PublicProfile, RecruiterPublicProfile, CompanyPage, PrivacyPolicy, TermsOfService, Pricing
**Candidate:** Dashboard, ProfileForm, CandidateJobs, JobDetail, JobApplication, CandidateInterviews, ResumeDownloadPage
**Recruiter:** RecruiterDashboard, RecruiterJobs, RecruiterProfileForm, BrowseProfiles, RecruiterTools, RecruiterInterviews, ImportHistoryPage
**Social:** FeedPage, MessagesPage, NotificationsPage, FollowersPage, PollsPage, ChallengesPage, SessionDetailPage
**AI:** AgentArena (1816 lines)
**Admin:** AdminDashboard, AdminUsers, AdminPromos

### Backend Services (All 17 Working)
- `aiService.js` (2749 lines) - Claude Sonnet integration
- `agentArenaService.js` (1476 lines) - AI negotiation
- `paymentService.js` - Stripe + PayPal (needs credentials)
- `emailService.js` - Resend configured
- `vapiService.js` - Phone screening
- `resumeParserService.js` - PDF/DOCX parsing
- `candidateImportService.js` - CSV/LinkedIn import
- Plus 10 more services

---

**Good luck with launch! 🎉**
