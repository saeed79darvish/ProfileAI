# ProfileAI - AI Coding Agent Instructions

## Architecture Overview

Full-stack app: Express.js API (port 5001) + React/Vite frontend (port 3000, proxies `/api`).

**Data Flow:** Frontend `api.js` → Express routes → Sequelize models → PostgreSQL → AI via `aiService.js` (GPT-4)

**Two user roles with strict separation:**
- `candidate`: Creates profiles, browses jobs, AI profile enhancement
- `recruiter`: Posts jobs, browses candidates, smart matching features

## Developer Workflows

```bash
# Start backend (MUST run from backend directory)
cd backend && node server.js

# Start frontend (separate terminal)
cd frontend && npm run dev

# Database commands (from backend/)
npm run init-db            # Initialize/sync schema
npm run add-mock-profiles  # Seed small test dataset
npm run add-50-candidates  # Seed 50 candidate profiles
```

**Environment:** Backend `.env` requires: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `OPENAI_API_KEY`

## Critical Code Patterns

### API Service Layer (frontend/src/services/api.js)
All HTTP calls use configured axios instance with auth interceptor:
```javascript
import { profileAPI, resolveImageUrl } from '../services/api';
const { data } = await profileAPI.getMyProfile();
const imageUrl = resolveImageUrl(data.profilePicture); // Handles Cloudinary/local URLs
```

### Route Protection (frontend/src/components/PrivateRoute.jsx)
```jsx
<PrivateRoute allowedRoles={['recruiter']}>
  <RecruiterDashboard />
</PrivateRoute>
// Backend: req.user.role available after authMiddleware
```

### Model Associations (backend/models/index.js)
**Always check this file when adding relationships.** Key associations:
- User hasOne Profile/RecruiterProfile
- User hasMany Post, TailoredProfile, Subscription
- Comment has self-referential `parentCommentId` for nested replies
- Foreign keys follow convention: `userId`, `postId`, `commentId`

### Backend Route Pattern (backend/routes/*.js)
```javascript
// @route   POST /api/profiles/enhance
// @desc    AI-enhance user profile
// @access  Private
router.post('/enhance', authMiddleware, async (req, res) => { ... });
```
Uses `express-validator` for input validation, `errorHandler.js` for Sequelize errors.

### File Uploads
- **Images:** Multer → Cloudinary (URLs stored in DB)
- **Resume:** Multer memory storage → `resumeParserService.js` (pdf-parse/mammoth)
- Legacy files may exist at `/backend/uploads/{profiles,posts,recruiters}/`

## Key Files Reference

| Purpose | File |
|---------|------|
| Model relationships | [backend/models/index.js](backend/models/index.js) |
| Auth context & token flow | [frontend/src/contexts/AuthContext.jsx](frontend/src/contexts/AuthContext.jsx) |
| AI service (GPT-4 prompts) | [backend/services/aiService.js](backend/services/aiService.js) |
| Frontend API config | [frontend/src/services/api.js](frontend/src/services/api.js) |
| Vite proxy config | [frontend/vite.config.ts](frontend/vite.config.ts) |
| Payment (Stripe/PayPal) | [backend/services/paymentService.js](backend/services/paymentService.js) |

## Subscription & Feature Gating

Users have `subscriptionTier`: `free`, `pro`, `enterprise`. Check access:
- Backend: `req.user.subscriptionTier` after auth middleware
- Frontend: `user.subscriptionTier` from `useAuth()` context

## Path Aliases (frontend)
Vite configured with `@/` aliases: `@/components`, `@/pages`, `@/services`, `@/contexts`
