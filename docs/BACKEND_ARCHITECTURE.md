# ProfileAI — Backend Architecture

## Overview

All 3 UI surfaces (Web App, Chrome Extension, Profile Page) connect to the **same Express.js backend** on port 5001. There are **no duplicate services** — every AI feature funnels through one centralized pipeline.

---

## High-Level Flow

```
┌─────────────┐   ┌──────────────────┐   ┌───────────────┐
│   Web App   │   │ Chrome Extension │   │ Profile Page  │
│  (React)    │   │    (React)       │   │   (React)     │
│  :3000      │   │                  │   │   :3000       │
└──────┬──────┘   └────────┬─────────┘   └──────┬────────┘
       │                   │                     │
       └───────────────────┼─────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Express.js │
                    │   :5001     │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼──────┐
        │ Middleware │ │Routes │ │  Services  │
        └───────────┘ └───────┘ └────────────┘
```

---

## Middleware Chain

Every request passes through:

| Order | Middleware | Purpose |
|-------|-----------|---------|
| 1 | `helmet()` | Security headers |
| 2 | `cors()` | Whitelist: localhost:3000, chrome-extension:// |
| 3 | `express.json()` | Parse JSON (10MB limit) |
| 4 | `morgan()` | HTTP request logging |
| 5 | `authMiddleware` | JWT token verification → sets `req.user` |
| 6 | `aiRateLimiter` | Subscription-tier rate limiting (per AI feature) |
| 7 | `adminMiddleware` | Admin-only routes |

---

## API Routes

### Core AI Routes (used by all 3 surfaces)

| Route | Endpoint | Purpose |
|-------|----------|---------|
| `/api/profiles` | `POST /analyze-gaps` | Skill gap analysis (AI) |
| `/api/profiles` | `POST /tailor-for-job` | Profile tailoring for a job (AI) |
| `/api/profiles` | `POST /generate-cover-letter` | Cover letter generation (AI) |
| `/api/profiles` | `POST /keyword-optimization` | Keyword/match analysis (AI) |
| `/api/profiles` | `POST /enhance-resume` | Resume enhancement (AI) |
| `/api/profiles` | `POST /enhance` | Full profile enhancement (AI) |
| `/api/profiles` | `POST /enhance-text` | Single section enhancement (AI) |
| `/api/profiles` | `POST /enhancement-suggestions` | AI suggestions |
| `/api/profiles` | `POST /generate-answers` | AI answer generation |

### Resume Routes

| Route | Endpoint | Purpose |
|-------|----------|---------|
| `/api/resume` | `GET /templates` | List available templates |
| `/api/resume` | `POST /generate` | Generate PDF or Word file |
| `/api/resume` | `POST /preview` | Preview as base64 PDF |

### Tailored Profiles

| Route | Endpoint | Purpose |
|-------|----------|---------|
| `/api/tailored-profiles` | `POST /` | Save tailored profile |
| `/api/tailored-profiles` | `GET /` | List user's tailored profiles |
| `/api/tailored-profiles` | `POST /:id/interview-prep` | Generate interview prep |

### Other Routes

| Route | Purpose |
|-------|---------|
| `/api/auth` | Login, register, JWT tokens |
| `/api/smart-match` | Vector-based candidate search (recruiter) |
| `/api/jobs` | Job CRUD, screening, questions |
| `/api/agent-arena` | AI-to-AI agent negotiations |
| `/api/external-jobs` | Greenhouse/Lever/JSearch job sync |
| `/api/posts` | Feed posts + AI post enhancement |
| `/api/messages` | Direct messaging |
| `/api/notifications` | In-app notifications |
| `/api/follows` | Follow system |
| `/api/interviews` | Interview scheduling |
| `/api/phone-screening` | VAPI phone screening |
| `/api/candidates` | Bulk candidate management |
| `/api/invitations` | Candidate invitations |
| `/api/credit-packs` | Payment (Stripe/PayPal) |
| `/api/promo` | Promo codes |
| `/api/admin` | Admin panel |

---

## Service Layer

### AI Services (Single Pipeline)

```
All AI Features
      │
      ▼
┌─────────────────────────┐
│      aiService.js       │  ← Main AI service (all features)
│  enhance, tailor, gaps, │
│  cover letter, screen   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│     ai/core.js          │  ← Single AI gateway
│  callAI() + retry       │
│  withRetry()            │
│  safeParseJSON()        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   ai/prompts/           │  ← Domain-specific prompts
│  profile.js             │
│  job.js                 │
│  post.js                │
│  agent.js               │
│  screening.js           │
└───────────┬─────────────┘
            │
            ▼
   ┌─────────────────┐
   │  Claude Sonnet 4 │  ← Anthropic API
   │  (Anthropic)     │
   └─────────────────┘
```

**Key point:** `callAI()` is the **single function** that talks to Claude. Every AI feature in the entire app goes through it.

### Embedding Services (Vector Search)

| Service | Model | Use Case |
|---------|-------|----------|
| `embeddingService.js` | Voyage AI (voyage-3-lite, 512d) | Profile/candidate embeddings |
| `jobEmbeddingService.js` | OpenAI (text-embedding-3-small, 512d) | Job posting embeddings |
| `aiSkillsMatchingService.js` | Voyage AI (voyage-3-lite) | Semantic skill matching |

All stored in **PostgreSQL + pgvector**.

### Resume Services

| Service | Purpose | Tech |
|---------|---------|------|
| `resumeParserService.js` | Parse uploaded PDF/DOCX | pdf-parse, mammoth + Claude AI |
| `resumeGeneratorService.js` | Generate PDF/Word resumes | pdfkit, docx (local, no AI) |

### Recruitment & Matching

| Service | Purpose | Uses |
|---------|---------|------|
| `recruitmentService.js` | Full recruitment pipeline | aiService, aiSkillsMatching, candidateDataAggregator |
| `agentArenaService.js` | AI-to-AI salary negotiations | aiService, candidateDataAggregator |
| `candidateDataAggregator.js` | Aggregate all candidate data | Direct DB queries |
| `sessionMatchingService.js` | Collaboration session matching | aiService |

### Communication

| Service | Purpose | External API |
|---------|---------|-------------|
| `emailService.js` | Transactional email | Resend (primary) / Gmail (fallback) |
| `vapiService.js` | AI phone screening calls | VAPI |
| `callSchedulerService.js` | Phone call scheduling (cron) | VAPI |
| `notificationService.js` | In-app notifications | Database only |

### Payments & Data

| Service | Purpose | External API |
|---------|---------|-------------|
| `paymentService.js` | Subscriptions & credits | Stripe, PayPal |
| `externalJobService.js` | Job board aggregation | Greenhouse, Lever, Ashby, Amazon, JSearch, RemoteOK, WWR |
| `candidateImportService.js` | Bulk CSV import | Local parsing |
| `invitationService.js` | Email invitations with tokens | emailService |

---

## External API Dependencies

| API | Used By | Purpose |
|-----|---------|---------|
| **Anthropic (Claude Sonnet 4)** | ai/core.js | All AI generation |
| **Voyage AI** | embeddingService, aiSkillsMatching | Vector embeddings |
| **OpenAI** | jobEmbeddingService | Job embeddings |
| **Stripe** | paymentService | Payments |
| **PayPal** | paymentService | Payments |
| **Resend** | emailService | Email delivery |
| **VAPI** | vapiService | Phone screening |
| **Greenhouse/Lever/Ashby** | externalJobService | Job aggregation |

---

## Database

**PostgreSQL** with **pgvector** extension for vector similarity search.

**Key Models:** User, Profile, RecruiterProfile, Job, ExternalJob, JobApplication, TailoredProfile, Post, Comment, Message, Conversation, Notification, Subscription, CreditPack, Challenge, Interview, AgentNegotiation, PhoneScreeningCall, and more.

**Associations:** Defined in `models/index.js` — User hasOne Profile/RecruiterProfile, User hasMany Posts/TailoredProfiles/Subscriptions, etc.

---

## Feature → Service → API Mapping

| Feature | Route | Service | External API |
|---------|-------|---------|-------------|
| Profile Enhancement | `/profiles/enhance` | aiService → ai/core | Claude |
| Profile Tailoring | `/profiles/tailor-for-job` | aiService → ai/core | Claude |
| Gap Analysis | `/profiles/analyze-gaps` | aiService → ai/core | Claude |
| Cover Letter | `/profiles/generate-cover-letter` | aiService → ai/core | Claude |
| Keyword Analysis | `/profiles/keyword-optimization` | aiService → ai/core | Claude |
| Resume Parse | `/profiles/upload-resume` | resumeParserService → ai/core | Claude |
| Resume Generate | `/resume/generate` | resumeGeneratorService | None (local) |
| Smart Match | `/smart-match` | embeddingService | Voyage AI |
| Agent Negotiation | `/agent-arena/*` | agentArenaService → ai/core | Claude |
| Job Screening | `/jobs/:id/screen` | recruitmentService → ai/core | Claude |
| Phone Screening | `/phone-screening/*` | vapiService | VAPI |
| Post Enhancement | `/posts/enhance` | aiService → ai/core | Claude |
