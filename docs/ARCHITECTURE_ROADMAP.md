# ProfileAI Architecture Roadmap
## From MVP to Production-Ready Public SaaS

**Version:** 2.0  
**Last Updated:** December 2025  
**Status:** Planning Phase

---

## Executive Summary

| Aspect | Decision |
|--------|----------|
| **Primary Database** | PostgreSQL (keep current) |
| **Caching Layer** | Redis (add in Phase 2) |
| **Hosting (MVP)** | Render or Railway |
| **Hosting (Scale)** | DigitalOcean → AWS ECS |
| **File Storage** | AWS S3 |
| **Error Tracking** | Sentry |
| **Frontend Language** | TypeScript (.tsx) |
| **State Management** | Zustand (replace Context) |
| **Data Fetching** | React Query (TanStack) |
| **Timeline** | 12 weeks to production |
| **Monthly Cost** | $50-200 |

---

## Current State Assessment

### What We Have
- ✅ Express.js backend on port 5001
- ✅ React 18 frontend on port 3000
- ✅ PostgreSQL with Sequelize ORM
- ✅ JWT authentication
- ✅ OpenAI GPT-4 integration
- ✅ Stripe/PayPal payments
- ✅ Role-based access (candidate/recruiter)

### Critical Gaps
| Gap | Risk | Phase to Fix |
|-----|------|--------------|
| No rate limiting | 🔴 High | Phase 1 |
| 130+ console.log calls | 🔴 High | Phase 3 |
| Local file storage | 🔴 High | Phase 2 |
| No testing | 🔴 High | Phase 4 |
| No monitoring | 🔴 High | Phase 3 |
| No CI/CD | 🟡 Medium | Phase 5 |
| JavaScript (no types) | 🟡 Medium | Phase F |
| React Context (not scalable) | 🟡 Medium | Phase F |
| Flat folder structure | 🟡 Medium | Phase F |

---

## Architecture Diagrams

### Current MVP
```
Frontend (React:3000) ←→ Backend (Express:5001)
                              ↓
            PostgreSQL + OpenAI API + Local Disk
```

### Target Production
```
CloudFlare CDN
      ↓
┌─────────────────────────────────────┐
│           Load Balancer             │
└─────────────────────────────────────┘
      ↓                    ↓
 Backend x2          Background Workers
      ↓                    ↓
┌─────────────────────────────────────┐
│  PostgreSQL  │  Redis  │  S3       │
└─────────────────────────────────────┘
      ↓
External: OpenAI, Stripe, Sentry
```

---

## Phase 0: Pre-Launch Decisions (Day 1-2)

### Prompts

**Hosting Selection:**
> "Help me set up ProfileAI on [Render/Railway/DigitalOcean]. I have an Express.js backend, React frontend, and need PostgreSQL and Redis. Budget is $X/month."

**Domain & SSL:**
> "Configure DNS for profileai.com pointing to [hosting platform] with SSL certificate."

**External Services Setup:**
> "Create accounts and get API keys for: Sentry (error tracking), AWS S3 (file storage), CloudFlare (CDN)."

### Checklist
- [ ] Choose hosting platform
- [ ] Purchase domain
- [ ] Create Sentry account
- [ ] Create AWS account & S3 bucket
- [ ] Set up CloudFlare
- [ ] Document all API keys securely

---

## Phase 1: Security & Stability (Week 1-2) 🔴 CRITICAL

### Prompts

**Rate Limiting:**
> "Add rate limiting to my Express.js app: 100 requests/15min for general API, 5 requests/15min for auth endpoints, 10 requests/min for AI endpoints. Use express-rate-limit package."

**Input Sanitization:**
> "Add XSS protection, NoSQL injection prevention, and HTTP parameter pollution prevention to my Express.js server using helmet, xss-clean, and hpp packages."

**JWT Refresh Tokens:**
> "Implement JWT refresh token flow in my Express.js app. Access tokens expire in 15 minutes, refresh tokens in 7 days. Store refresh tokens in PostgreSQL with revocation support."

**Environment Validation:**
> "Create a centralized config module that validates all required environment variables (DB_HOST, JWT_SECRET, OPENAI_API_KEY, etc.) on server startup and throws clear errors if missing."

**Frontend Auth Update:**
> "Update my React AuthContext to handle JWT refresh tokens. Automatically refresh access token when it expires, handle token refresh failures by redirecting to login."

### Checklist
- [ ] Install security packages (express-rate-limit, helmet, xss-clean, hpp)
- [ ] Create rate limiter middleware with 3 tiers
- [ ] Apply rate limiters to all routes
- [ ] Add input sanitization middleware
- [ ] Create RefreshToken model
- [ ] Add /auth/refresh and /auth/logout endpoints
- [ ] Update frontend AuthContext
- [ ] Create centralized config with validation
- [ ] Test all security measures

---

## Phase 2: Infrastructure & Performance (Week 3-4)

### Prompts

**Redis Setup:**
> "Add Redis caching to my Express.js app using ioredis. Create cache helpers for get/set/delete with TTL support. Cache profile queries (10 min TTL) and AI responses (24 hour TTL)."

**Background Jobs:**
> "Set up Bull queue for background job processing in my Express.js app. Move AI profile enhancement to async processing with job status polling. Add retry logic with exponential backoff."

**S3 File Storage:**
> "Migrate file uploads from local disk to AWS S3. Create a storage service with uploadFile, deleteFile, and getSignedUrl methods. Update all routes that handle file uploads."

**Database Optimization:**
> "Optimize my Sequelize PostgreSQL connection for production: increase pool size to 20, add SSL support, configure retry logic for connection errors, add health check queries."

**API Versioning:**
> "Add API versioning to my Express.js app. Create /api/v1/ routes structure, maintain backward compatibility with /api/ routes that redirect to v1."

### Checklist
- [ ] Set up Redis (managed service or self-hosted)
- [ ] Create Redis config and cache service
- [ ] Add caching to high-traffic endpoints
- [ ] Install and configure Bull queue
- [ ] Create AI processing queue
- [ ] Add job status endpoints
- [ ] Set up S3 bucket with proper permissions
- [ ] Create storage service
- [ ] Migrate all file uploads to S3
- [ ] Update database pool configuration
- [ ] Implement API versioning

---

## Phase 3: Observability & Debugging (Week 5-6)

### Prompts

**Structured Logging:**
> "Replace all console.log calls in my Express.js app with Winston logger. Use JSON format in production, colorized output in development. Add daily log rotation with 14-day retention."

**Request Logging:**
> "Create request logging middleware that generates unique request IDs, logs incoming requests with method/URL/IP/user-agent, and logs response status codes with duration."

**Error Tracking:**
> "Integrate Sentry for error tracking in my Express.js app. Configure environment-based DSN, set traces sample rate to 10%, only report 500+ errors. Add Sentry handlers before and after routes."

**Health Checks:**
> "Create comprehensive health check endpoints. /health returns quick status, /health/detailed (admin only) returns database status, Redis status, queue stats, memory usage, and CPU load."

### Checklist
- [ ] Install Winston and configure logger
- [ ] Create log directory structure
- [ ] Replace all 130+ console.log calls with logger
- [ ] Create request logging middleware
- [ ] Add correlation IDs to all requests
- [ ] Create Sentry account and project
- [ ] Integrate Sentry SDK
- [ ] Create /health endpoint
- [ ] Create /health/detailed endpoint (admin only)
- [ ] Test all observability features

---

## Phase 4: Code Quality & Testing (Week 7-8)

### Prompts

**Controller Layer:**
> "Refactor my Express.js routes to use a controller layer. Extract business logic from routes/profiles.js into controllers/profileController.js. Routes should only handle HTTP concerns, controllers handle business logic."

**Custom Errors:**
> "Create custom error classes for my Express.js app: AppError (base), ValidationError (400), NotFoundError (404), UnauthorizedError (401), ForbiddenError (403), RateLimitError (429). Update error handler to use these."

**Request Validation:**
> "Add Joi validation to all API endpoints. Create validators for profile, auth, posts, and subscription routes. Validate request bodies, params, and query strings."

**Testing Setup:**
> "Set up Jest for my Express.js backend. Create test configuration, setup file for database, example unit test for aiService, and integration test for auth endpoints. Target 70% coverage."

### Checklist
- [ ] Create controllers directory
- [ ] Extract logic from routes to controllers
- [ ] Create errors directory with custom error classes
- [ ] Update error handler middleware
- [ ] Create validators directory
- [ ] Add Joi validation to all endpoints
- [ ] Install Jest and Supertest
- [ ] Create test configuration
- [ ] Write unit tests for services
- [ ] Write integration tests for API
- [ ] Add coverage reporting
- [ ] Update package.json scripts

---

## Phase 5: Deployment & DevOps (Week 9-10)

### Prompts

**Docker Setup:**
> "Create Dockerfiles for my Express.js backend and React frontend. Use multi-stage builds, run as non-root user, expose correct ports. Create docker-compose.yml with backend, frontend, PostgreSQL, and Redis services."

**CI/CD Pipeline:**
> "Create GitHub Actions workflows for my app. test.yml runs on push/PR: lints code, runs tests with PostgreSQL service. deploy.yml runs on main push: builds Docker images, pushes to registry, deploys to hosting."

**Database Migrations:**
> "Set up Sequelize migrations for my app. Replace sequelize.sync() with proper migrations. Create initial migrations for all existing tables (Users, Profiles, Posts, etc.)."

**Staging Environment:**
> "Set up a staging environment that mirrors production. Use separate database, different environment variables, deploy from develop branch."

### Checklist
- [ ] Create backend Dockerfile
- [ ] Create frontend Dockerfile
- [ ] Create docker-compose.yml
- [ ] Test local Docker setup
- [ ] Create .github/workflows/test.yml
- [ ] Create .github/workflows/deploy.yml
- [ ] Configure GitHub secrets
- [ ] Set up sequelize-cli
- [ ] Create initial migrations
- [ ] Remove sequelize.sync() from production
- [ ] Set up staging environment
- [ ] Test full deployment pipeline

---

## Phase 6: Launch & Monitoring (Week 11-12)

### Prompts

**Pre-Launch Checklist:**
> "Review my app for production readiness: verify all environment variables, test rate limiting, check error handling, verify SSL, test payment flows, check CORS configuration."

**Performance Testing:**
> "Load test my Express.js API using k6 or artillery. Test key endpoints: login, profile fetch, profile enhance, file upload. Identify bottlenecks and optimize."

**Monitoring Setup:**
> "Set up monitoring dashboards for my production app: uptime monitoring (every 5 min), error rate alerts (>1% threshold), response time alerts (>2s threshold), queue depth alerts."

**Launch Plan:**
> "Create a launch checklist: database backup, feature flags enabled, canary deployment to 10% traffic, full rollout, post-launch monitoring for 24 hours."

### Checklist
- [ ] Complete pre-launch security audit
- [ ] Run load tests
- [ ] Set up uptime monitoring
- [ ] Configure alert thresholds
- [ ] Create rollback procedures
- [ ] Back up production database
- [ ] Deploy to production
- [ ] Monitor for 24-48 hours
- [ ] Document any issues and fixes

---

## Database Strategy

### Decision: PostgreSQL + Redis

| Use Case | Database | Reason |
|----------|----------|--------|
| Users, Profiles, Posts | PostgreSQL | Relational data, ACID compliance |
| Payments, Subscriptions | PostgreSQL | Transaction safety |
| Session cache | Redis | Fast reads, TTL support |
| Rate limiting | Redis | Atomic counters |
| Job queues | Redis | Bull queue backend |
| AI response cache | Redis | Reduce API costs |

### When to Add More?
| Database | Trigger | Use Case |
|----------|---------|----------|
| Elasticsearch | 10K+ users | Advanced candidate search |
| MongoDB | Feed becomes core feature | High-volume social data |
| Read Replica | 50K+ users | Scale read operations |

---

## Hosting Strategy

### Progression Path
```
MVP Launch (0-1K users)     →    Growth (1K-10K)    →    Scale (10K+)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Render/Railway                   DigitalOcean            AWS ECS
$25-50/month                     $60-150/month           $200-500/month
```

### Platform Comparison

| Platform | Best For | Setup Time | DevOps Needed |
|----------|----------|------------|---------------|
| Render | Quick MVP | 1 hour | None |
| Railway | Developer experience | 1 hour | None |
| DigitalOcean | Balance | 2-4 hours | Low |
| Fly.io | Global edge | 2-4 hours | Medium |
| AWS ECS | Full control | 1-2 days | High |

### Hosting Prompts

**Render Setup:**
> "Deploy my Express.js backend and React frontend to Render. Set up managed PostgreSQL and Redis. Configure environment variables and auto-deploy from GitHub main branch."

**DigitalOcean Setup:**
> "Deploy my Dockerized app to DigitalOcean App Platform. Set up managed PostgreSQL and Redis, configure scaling rules, set up domain with SSL."

**AWS ECS Setup:**
> "Deploy my Dockerized app to AWS ECS Fargate. Set up RDS PostgreSQL, ElastiCache Redis, S3 for files, CloudFront for CDN. Configure auto-scaling and load balancer."

---

## Cost Estimates

### MVP Phase ($25-75/month)
| Service | Cost |
|---------|------|
| Render/Railway (backend) | $7-25 |
| Render/Railway (frontend) | $0-7 |
| Managed PostgreSQL | $7-15 |
| Managed Redis | $10-15 |
| S3 (5GB) | Free tier |
| Sentry | Free tier |
| **Total** | **$25-75** |

### Growth Phase ($100-200/month)
| Service | Cost |
|---------|------|
| DigitalOcean (2 backends) | $30-60 |
| Managed PostgreSQL | $15-30 |
| Managed Redis | $15-25 |
| S3 (50GB) | $5-10 |
| CloudFlare | Free |
| Sentry | Free-$26 |
| **Total** | **$100-200** |

### Scale Phase ($300-600/month)
| Service | Cost |
|---------|------|
| AWS ECS (auto-scaling) | $100-200 |
| RDS PostgreSQL | $50-100 |
| ElastiCache Redis | $30-50 |
| S3 + CloudFront | $20-50 |
| Sentry | $26-89 |
| **Total** | **$300-600** |

---

## Timeline Overview

```
WEEK  1  2  3  4  5  6  7  8  9  10  11  12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ████████                              Phase 1: Security
      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                      Phase F: Frontend (parallel)
            ████████                        Phase 2: Infrastructure
                  ████████                  Phase 3: Observability
                        ████████            Phase 4: Testing
                              ████████      Phase 5: DevOps
                                    ████    Phase 6: Launch
```

### Parallel Work
- Phase 4 (Testing) can run parallel with Phases 2-3
- Phase 5 (DevOps) can start during Phase 4
- **Phase F (Frontend)** can run parallel with Phases 1-4

### Critical Path
1. **Security (Phase 1)** - MUST complete before any public access
2. **Observability (Phase 3)** - Need visibility before scaling
3. **DevOps (Phase 5)** - Need CI/CD before launch

---

## Risk Mitigation

### Before Going Public
- [ ] Rate limiting tested with load test
- [ ] All sensitive data encrypted
- [ ] Error messages don't leak internal details
- [ ] CORS properly configured
- [ ] SQL injection prevented (Sequelize parameterized queries)
- [ ] XSS prevented (input sanitization)

### Deployment Risks
| Risk | Mitigation |
|------|------------|
| Database migration fails | Always backup before migrations |
| New code breaks production | Use feature flags for gradual rollout |
| Traffic spike crashes server | Auto-scaling + rate limiting |
| Third-party API failure | Graceful degradation, circuit breakers |

### Rollback Plan
1. Keep previous Docker image tagged
2. Database migrations must be reversible
3. Feature flags to disable new features instantly
4. DNS failover to previous version

---

## Quick Reference: All Prompts

### Phase 0: Pre-Launch
```
"Help me set up ProfileAI on [Render/Railway/DigitalOcean]. I have an Express.js 
backend, React frontend, and need PostgreSQL and Redis. Budget is $X/month."

"Configure DNS for profileai.com pointing to [hosting platform] with SSL certificate."

"Create accounts and get API keys for: Sentry, AWS S3, CloudFlare."
```

### Phase 1: Security
```
"Add rate limiting to my Express.js app: 100 requests/15min for general API, 
5 requests/15min for auth endpoints, 10 requests/min for AI endpoints."

"Implement JWT refresh token flow. Access tokens 15min, refresh tokens 7 days. 
Store refresh tokens in PostgreSQL with revocation support."

"Add helmet, xss-clean, hpp middleware for security hardening."

"Create centralized config that validates required environment variables on startup."
```

### Phase 2: Infrastructure
```
"Add Redis caching using ioredis. Cache profiles (10min TTL) and AI responses (24hr TTL)."

"Set up Bull queue for async AI processing with job status polling and retry logic."

"Migrate file uploads from local disk to AWS S3 with presigned URLs."

"Optimize Sequelize connection: pool size 20, SSL, retry logic, health checks."
```

### Phase 3: Observability
```
"Replace all console.log with Winston logger. JSON in prod, colors in dev. 
Daily rotation, 14-day retention."

"Create request logging middleware with unique request IDs and duration tracking."

"Integrate Sentry: 10% trace sample rate, report 500+ errors only."

"Create /health endpoint checking database, Redis, and external services."
```

### Phase 4: Code Quality
```
"Refactor routes to use controller layer. Routes handle HTTP, controllers handle logic."

"Create custom error classes: ValidationError, NotFoundError, UnauthorizedError, etc."

"Add Joi validation to all API endpoints."

"Set up Jest with 70% coverage target. Unit tests for services, integration for API."
```

### Phase 5: DevOps
```
"Create Dockerfiles for backend and frontend. Multi-stage builds, non-root user."

"Create GitHub Actions: test.yml for PR checks, deploy.yml for main branch deploys."

"Set up Sequelize migrations. Replace sync() with proper migrations for all tables."

"Set up staging environment mirroring production with separate database."
```

### Phase 6: Launch
```
"Review app for production: environment variables, rate limiting, error handling, 
SSL, payment flows, CORS configuration."

"Load test API using k6: login, profile fetch, profile enhance, file upload."

"Set up monitoring: uptime (5min), error rate alerts (>1%), response time (>2s)."

"Launch plan: backup, feature flags, canary 10%, full rollout, 24hr monitoring."
```

### Phase F: Frontend Restructure
```
"Convert CRA to Vite with TypeScript. Add path aliases @/components, @/hooks, @/stores."

"Create TypeScript types for User, Profile, Recruiter, Subscription in types/ folder."

"Create Zustand authStore with user, token, login(), logout(). Persist to localStorage."

"Set up TanStack React Query with queryKeys factory and 5-minute staleTime."

"Create React Query hooks: useMyProfile(), useProfiles(filters), useLogin(), useRegister()."

"Create reusable components in common/: Button, Input, Card, Modal, Avatar, Loader."

"Organize pages by feature: auth/, candidate/, recruiter/, public/."

"Migrate all .js files to .tsx with proper TypeScript interfaces."
```

---

## Environment Variables Checklist

### Required for All Phases
```
NODE_ENV=production
PORT=5001

# Database
DB_HOST=
DB_PORT=5432
DB_NAME=profileai
DB_USER=
DB_PASSWORD=

# Authentication
JWT_SECRET=
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# External APIs
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# CORS
CORS_ORIGIN=https://profileai.com
```

### Added in Phase 2
```
# Redis
REDIS_URL=redis://localhost:6379

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=profileai-uploads
```

### Added in Phase 3
```
# Monitoring
SENTRY_DSN=
```

---

## Next Steps

1. **Today**: Complete Phase 0 decisions (choose hosting platform)
2. **This Week**: Start Phase 1 (rate limiting first)
3. **Ongoing**: Review this document weekly, check off completed items

---

## Frontend Architecture Restructuring

### Decision Summary

| Aspect | Current | Target |
|--------|---------|--------|
| **Language** | JavaScript (.js) | TypeScript (.tsx) |
| **State Management** | React Context | Zustand |
| **Data Fetching** | Direct axios calls | React Query (TanStack) |
| **File Extension** | .js | .tsx / .ts |
| **Folder Structure** | Flat | Feature-based + Shared |

### Target Folder Structure

```
frontend/src/
├── api/                          # API layer
│   ├── axios.ts                  # Axios instance & interceptors
│   ├── endpoints.ts              # API endpoint constants
│   └── types.ts                  # API response types
│
├── assets/                       # Static assets
│   ├── images/
│   ├── icons/
│   └── fonts/
│
├── components/                   # React components
│   ├── common/                   # Reusable/shared components
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.styles.ts
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Modal/
│   │   ├── Card/
│   │   ├── Avatar/
│   │   ├── Loader/
│   │   ├── ErrorBoundary/
│   │   └── index.ts              # Barrel export
│   │
│   ├── layout/                   # Layout components
│   │   ├── Navbar/
│   │   ├── Footer/
│   │   ├── Sidebar/
│   │   └── PageLayout/
│   │
│   └── features/                 # Feature-specific components
│       ├── auth/
│       │   ├── LoginForm/
│       │   └── RegisterForm/
│       ├── profile/
│       │   ├── ProfileCard/
│       │   ├── ProfileForm/
│       │   └── ResumeUploader/
│       ├── recruiter/
│       │   ├── CandidateCard/
│       │   └── MatchResults/
│       └── subscription/
│           ├── PricingCard/
│           └── PaymentForm/
│
├── constants/                    # App constants
│   ├── routes.ts                 # Route paths
│   ├── queryKeys.ts              # React Query keys
│   ├── config.ts                 # App configuration
│   └── index.ts
│
├── hooks/                        # Custom hooks
│   ├── api/                      # Data fetching hooks
│   │   ├── useAuth.ts
│   │   ├── useProfile.ts
│   │   ├── useProfiles.ts
│   │   ├── useRecruiter.ts
│   │   ├── useSubscription.ts
│   │   └── index.ts
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   ├── useMediaQuery.ts
│   └── index.ts
│
├── pages/                        # Route pages (thin wrappers)
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   ├── candidate/
│   │   ├── DashboardPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── BrowseJobsPage.tsx
│   ├── recruiter/
│   │   ├── DashboardPage.tsx
│   │   ├── BrowseProfilesPage.tsx
│   │   └── ToolsPage.tsx
│   ├── public/
│   │   ├── HomePage.tsx
│   │   ├── PricingPage.tsx
│   │   └── PublicProfilePage.tsx
│   └── index.ts
│
├── stores/                       # Zustand stores
│   ├── authStore.ts
│   ├── uiStore.ts
│   ├── profileStore.ts
│   └── index.ts
│
├── styles/                       # Global styles
│   ├── theme.ts                  # MUI theme customization
│   ├── globalStyles.ts
│   └── mixins.ts
│
├── types/                        # TypeScript types
│   ├── user.ts
│   ├── profile.ts
│   ├── recruiter.ts
│   ├── subscription.ts
│   ├── api.ts
│   └── index.ts
│
├── utils/                        # Utility functions
│   ├── formatters.ts             # Date, currency formatters
│   ├── validators.ts             # Form validation
│   ├── storage.ts                # localStorage helpers
│   ├── imageUrl.ts               # Image URL resolver
│   └── index.ts
│
├── App.tsx
├── main.tsx                      # Entry point
└── vite-env.d.ts
```

### Migration Prompts

**Phase F1: TypeScript & Tooling Setup**

> "Convert my Create React App project to Vite with TypeScript. Add tsconfig.json with strict mode, path aliases (@/components, @/hooks, etc.). Install and configure: typescript, @types/react, @types/react-dom. Keep all existing dependencies."

> "Create a comprehensive tsconfig.json for a React TypeScript project with path aliases: @/components, @/hooks, @/stores, @/types, @/utils, @/api, @/constants, @/pages, @/styles, @/assets. Enable strict mode and modern ES features."

**Phase F2: Create Types**

> "Create TypeScript types for my ProfileAI app in frontend/src/types/. Create: user.ts (User, UserRole, AuthState), profile.ts (Profile, Skill, Experience, Education), recruiter.ts (RecruiterProfile, MatchResult), subscription.ts (SubscriptionTier, Plan), api.ts (ApiResponse, PaginatedResponse, ApiError). Export all from index.ts."

**Phase F3: Zustand Stores**

> "Create Zustand stores for my React app. Create authStore.ts with: user, token, isAuthenticated, login(), logout(), updateUser(). Create uiStore.ts with: sidebarOpen, theme, notifications[], addNotification(), dismissNotification(). Create profileStore.ts with: profile, setProfile(), clearProfile(). Use TypeScript and persist auth state to localStorage."

**Phase F4: React Query Setup**

> "Set up TanStack React Query in my React TypeScript app. Create QueryClient configuration with: staleTime 5 minutes, retry 2 times, refetchOnWindowFocus false. Create queryKeys.ts constants for all entities (profiles, users, subscriptions, etc.). Wrap App with QueryClientProvider."

**Phase F5: API Hooks with React Query**

> "Create React Query hooks for my ProfileAI app in hooks/api/. Create useProfile.ts with: useMyProfile(), useUpdateProfile(), useEnhanceProfile(). Create useProfiles.ts with: useProfiles(filters), usePublicProfile(id). Create useAuth.ts with: useLogin(), useRegister(), useLogout(). Use proper TypeScript types, loading states, and error handling."

> "Create React Query mutation hooks for my ProfileAI app. Handle: profile creation, profile enhancement, image upload, resume upload. Include onSuccess callbacks to invalidate relevant queries, onError for toast notifications."

**Phase F6: Common Components**

> "Create reusable TypeScript React components in components/common/. Create: Button (variants: primary, secondary, outline), Input (with label, error state), Card (with header, body, footer slots), Avatar (with fallback initials), Modal (with portal), Loader (spinner and skeleton). Use MUI as base, add proper TypeScript props interfaces."

> "Create an ErrorBoundary component with TypeScript that catches React errors, shows a fallback UI, and includes a 'Try Again' button. Log errors to console in development."

**Phase F7: Layout Components**

> "Create layout components in components/layout/. Create: Navbar.tsx (responsive, with mobile menu), PageLayout.tsx (with sidebar for dashboard, without for public pages), Footer.tsx. Use Zustand uiStore for sidebar state. Add TypeScript props."

**Phase F8: Feature Components Migration**

> "Migrate my React components from JavaScript to TypeScript. For each component: add proper Props interface, add return type, convert useState/useEffect to typed versions, replace any with proper types. Start with auth components (LoginForm, RegisterForm), then profile components."

**Phase F9: Pages Migration**

> "Convert my React pages to TypeScript. Pages should be thin wrappers that: import feature components, use React Query hooks for data, use Zustand for global state, handle loading/error states. Organize by feature: auth/, candidate/, recruiter/, public/."

**Phase F10: Utils & Helpers**

> "Create TypeScript utility functions in utils/. Create: formatters.ts (formatDate, formatCurrency, formatRelativeTime), validators.ts (isValidEmail, isValidPhone, isRequired), storage.ts (getItem<T>, setItem, removeItem with types), imageUrl.ts (resolveImageUrl). All functions should be properly typed."

**Phase F11: Constants**

> "Create constants in frontend/src/constants/. Create: routes.ts (all route paths as const), queryKeys.ts (React Query keys factory), config.ts (API_URL, feature flags), subscriptionTiers.ts (tier names, limits, prices). Export all from index.ts."

**Phase F12: Router Setup**

> "Set up React Router v6 with TypeScript. Create a routes configuration array with: path, element, requiredRole (optional), layout type. Create PrivateRoute that checks Zustand authStore, redirects to login if unauthenticated, checks role if specified."

### Checklist: Frontend Migration

#### Phase F1: Setup (Day 1)
- [ ] Install TypeScript and type definitions
- [ ] Create tsconfig.json with path aliases
- [ ] Install Zustand and React Query
- [ ] Create folder structure (empty folders)
- [ ] Update package.json scripts

#### Phase F2: Foundation (Day 2-3)
- [ ] Create all TypeScript types in types/
- [ ] Create constants in constants/
- [ ] Create utility functions in utils/
- [ ] Create Zustand stores in stores/
- [ ] Set up React Query provider

#### Phase F3: API Layer (Day 4-5)
- [ ] Create api/axios.ts with typed interceptors
- [ ] Create api/endpoints.ts constants
- [ ] Create all hooks/api/ hooks with React Query
- [ ] Test all API hooks

#### Phase F4: Common Components (Day 6-7)
- [ ] Create components/common/ components
- [ ] Create components/layout/ components
- [ ] Create barrel exports (index.ts)
- [ ] Verify MUI theme integration

#### Phase F5: Feature Migration (Day 8-12)
- [ ] Migrate auth components → components/features/auth/
- [ ] Migrate profile components → components/features/profile/
- [ ] Migrate recruiter components → components/features/recruiter/
- [ ] Migrate subscription components → components/features/subscription/

#### Phase F6: Pages Migration (Day 13-15)
- [ ] Convert all pages to .tsx
- [ ] Organize pages by feature
- [ ] Update React Router
- [ ] Test all routes

#### Phase F7: Cleanup (Day 16-17)
- [ ] Remove old .js files
- [ ] Remove React Context (AuthContext.js)
- [ ] Update all imports
- [ ] Run TypeScript strict checks
- [ ] Fix all type errors

### File Mapping: Old → New

| Old File | New Location |
|----------|-------------|
| `contexts/AuthContext.js` | `stores/authStore.ts` |
| `services/api.js` | `api/axios.ts` + `hooks/api/*.ts` |
| `components/Navbar.js` | `components/layout/Navbar/Navbar.tsx` |
| `components/PrivateRoute.js` | `components/common/PrivateRoute/PrivateRoute.tsx` |
| `components/ResumeUploader.js` | `components/features/profile/ResumeUploader/ResumeUploader.tsx` |
| `components/SubscriptionGate.js` | `components/features/subscription/SubscriptionGate/SubscriptionGate.tsx` |
| `pages/Login.js` | `pages/auth/LoginPage.tsx` |
| `pages/Register.js` | `pages/auth/RegisterPage.tsx` |
| `pages/Dashboard.js` | `pages/candidate/DashboardPage.tsx` |
| `pages/ProfileForm.js` | `pages/candidate/ProfilePage.tsx` |
| `pages/BrowseProfiles.js` | `pages/recruiter/BrowseProfilesPage.tsx` |
| `pages/RecruiterDashboard.js` | `pages/recruiter/DashboardPage.tsx` |
| `pages/Home.js` | `pages/public/HomePage.tsx` |
| `pages/Pricing.js` | `pages/public/PricingPage.tsx` |

### New Dependencies

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x",
    "@tanstack/react-query-devtools": "^5.x",
    "zustand": "^4.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "@types/node": "^20.x",
    "vite": "^5.x",
    "@vitejs/plugin-react": "^4.x"
  }
}
```

### Quick Reference: Frontend Prompts

```
# Setup
"Convert CRA to Vite with TypeScript. Add path aliases @/components, @/hooks, etc."

# Types
"Create TypeScript types for User, Profile, Recruiter, Subscription in types/ folder."

# State
"Create Zustand authStore with user, token, login(), logout(). Persist to localStorage."

# API
"Create React Query hooks: useMyProfile(), useProfiles(), useLogin() with proper types."

# Components
"Create reusable Button, Input, Card, Modal, Avatar components with TypeScript in common/."

# Migration
"Convert Dashboard.js to Dashboard.tsx. Use useMyProfile() hook, add loading/error states."
```

---

**Document Owner:** Development Team  
**Review Schedule:** Weekly during development, monthly after launch  
**Last Review:** December 2025
