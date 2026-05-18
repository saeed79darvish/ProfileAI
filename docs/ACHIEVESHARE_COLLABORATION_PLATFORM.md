# AchieveShare Collaboration Platform

> Transform achievements into teaching opportunities. Connect learners with experts. Build reputation through helping others.

## Table of Contents

1. [Overview](#overview)
2. [User Types & Goals](#user-types--goals)
3. [Session Types](#session-types)
4. [Complete User Flows](#complete-user-flows)
5. [Gamification System](#gamification-system)
6. [AI Matching Algorithm](#ai-matching-algorithm)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Frontend Components](#frontend-components)
10. [Real-time Features](#real-time-features)

---

## Overview

AchieveShare transforms the traditional social feed into a **collaboration marketplace** where professionals:
- Share achievements as **Teaching Sessions**
- Showcase team accomplishments as **Team Showcases**
- Seek guidance through **Mentorship Requests**
- Build reputation through **Teaching Credits** and **Badges**

### Core Value Proposition

| For Achievers | For Learners |
|--------------|--------------|
| Turn success into teaching | Find relevant experts |
| Build reputation & influence | Get personalized matches |
| Earn teaching credits | Track learning progress |
| Unlock badges & levels | Connect with mentors |

---

## User Types & Goals

### User Personas

| User Type | Primary Goal | Creates | Consumes |
|-----------|-------------|---------|----------|
| **Achiever** | Share success, build reputation | Teaching Sessions | Mentorship from senior experts |
| **Learner** | Gain skills, advance career | Mentorship Requests | Teaching Sessions, Showcases |
| **Team Lead** | Showcase team work | Team Showcases | Other team case studies |
| **Mentor** | Help others, earn credits | Guidance responses | Mentorship requests |
| **Explorer** | Discover opportunities | - | All session types |

### User Journey Map

```
New User
    ↓
┌─────────────────────────────────────────────────────────┐
│              ONBOARDING                                 │
│  1. Create profile                                      │
│  2. Add skills & expertise                              │
│  3. Set career goals                                    │
│  4. Choose interests for matching                       │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│              DISCOVERY                                  │
│  • Browse sessions matched to profile                   │
│  • Filter by type, category, time                       │
│  • See AI-powered match scores                          │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│              PARTICIPATION                              │
│  • Join sessions as attendee                            │
│  • Request mentorship                                   │
│  • Host own sessions                                    │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│              GROWTH                                     │
│  • Earn credits & badges                                │
│  • Level up through participation                       │
│  • Build reputation                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Session Types

### 1. Teaching Session

**Purpose:** Share knowledge from personal achievements

**Badge Color:** Purple with "NEW 🔥" indicator

**Use Cases:**
- Career milestone (promotion, new role)
- Skill mastery (learned new technology)
- Business achievement (hit revenue target)
- Personal growth (overcame challenge)

**Session Card Display:**
```
┌─────────────────────────────────────────────────────────┐
│  TEACHING SESSION   NEW 🔥                    2 hours ago│
├─────────────────────────────────────────────────────────┤
│  How I Got Promoted from Junior to Senior               │
│  Marketing Manager in 2 Years                           │
│                                                         │
│  👤 Sarah Chen                                          │
│     Just promoted to Senior • TechCorp                  │
│                                                         │
│  ⏱️ 30 min    👥 8/20 spots    📅 Today 6 PM            │
│                                                         │
│  [Marketing] [Career] [Leadership]                      │
│                                                         │
│  ✨ Perfect for your career goals - 92% match           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Reserve Your Spot                      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2. Team Showcase

**Purpose:** Present group achievements and case studies

**Badge Color:** Green/Teal

**Use Cases:**
- Completed project with measurable results
- Product launch
- Process improvement
- Team collaboration success

**Session Card Display:**
```
┌─────────────────────────────────────────────────────────┐
│  TEAM SHOWCASE                                4 hours ago│
├─────────────────────────────────────────────────────────┤
│  How We Increased E-commerce Conversions by 45%         │
│  Through UX Redesign                                    │
│                                                         │
│  👥👥👥 Mark's Team                                     │
│        Lead UX Designer • 6-month project               │
│                                                         │
│  ⏱️ 45 min    👁️ 24 watching    📅 Tue 3 PM            │
│                                                         │
│  [UX Design] [E-commerce] [Case Study]                  │
│                                                         │
│  🎯 Relevant to your UX work - Similar to your          │
│     recent projects                                     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Join Showcase                       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3. Mentorship Request

**Purpose:** Seek guidance from experienced professionals

**Badge Color:** Blue

**Use Cases:**
- Starting new job/role
- Career transition
- Technical challenges
- Industry insights needed

**Session Card Display:**
```
┌─────────────────────────────────────────────────────────┐
│  MENTORSHIP   ⭐ 89% Match                    6 hours ago│
├─────────────────────────────────────────────────────────┤
│  Starting My First Frontend Developer Role -            │
│  Seeking Advice                                         │
│                                                         │
│  👤 Lisa Martinez                                       │
│     New Frontend Dev • StartupXYZ                       │
│                                                         │
│  Looking for advice on:                                 │
│  • First 90 days best practices                         │
│  • How to make an impact quickly                        │
│  • Common mistakes to avoid                             │
│  • Building relationships with the team                 │
│                                                         │
│  ⏱️ 20 min    👥 2/3 mentors    📅 Thu 4 PM             │
│                                                         │
│  [Frontend] [Career Advice] [New Job]                   │
│                                                         │
│  💡 Share your experience - Help someone starting       │
│     their journey                                       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │             Offer Guidance                       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Complete User Flows

### Flow 1: Creating a Teaching Session

```
Step 1: User clicks "+ Share Achievement" button
        ↓
Step 2: Select session type → "Teaching Session"
        ↓
Step 3: Fill form:
        ┌────────────────────────────────────────┐
        │ Title: [                              ]│
        │ Description: [                        ]│
        │ Category: [dropdown]                   │
        │ Duration: ○ 30 min ○ 45 min ○ 60 min  │
        │ Max Participants: [20]                 │
        │ Scheduled Time: [date/time picker]     │
        └────────────────────────────────────────┘
        ↓
Step 4: AI analyzes and suggests improvements
        "Add specific metrics to attract more attendees"
        ↓
Step 5: Preview → Publish
        ↓
Step 6: Session appears in feed
        ↓
Step 7: Platform sends notifications to matched users
```

### Flow 2: Joining a Teaching Session

```
Step 1: User sees session card with match score
        ↓
Step 2: Clicks "Reserve Your Spot"
        ↓
Step 3: Confirmation modal:
        ┌────────────────────────────────────────┐
        │ ✓ Spot Reserved!                       │
        │                                        │
        │ Session: How I Got Promoted...         │
        │ When: Today at 6 PM                    │
        │ Duration: 30 minutes                   │
        │                                        │
        │ [Add to Calendar] [View Details]       │
        └────────────────────────────────────────┘
        ↓
Step 4: Added to "Upcoming Sessions" sidebar
        ↓
Step 5: Gets reminder 1 hour before
        ↓
Step 6: Joins live session
        ↓
Step 7: After session: Rate and review
```

### Flow 3: Requesting Mentorship

```
Step 1: User clicks "Find Mentorship" in Quick Actions
        ↓
Step 2: Select mentorship type:
        ○ Career Advice
        ○ Technical Help
        ○ Industry Insights
        ○ New Job Guidance
        ↓
Step 3: Fill request form:
        ┌────────────────────────────────────────┐
        │ Title: [                              ]│
        │ What you need help with:               │
        │ ☑ First 90 days best practices        │
        │ ☑ How to make an impact quickly       │
        │ ☑ Common mistakes to avoid            │
        │ ☐ Technical skills guidance           │
        │                                        │
        │ Format: ○ 1-on-1 ○ Small group        │
        │ Duration: [20 min]                     │
        │ Availability: [date/time picker]       │
        └────────────────────────────────────────┘
        ↓
Step 4: AI suggests matching mentors
        ↓
Step 5: Publish request to feed
        ↓
Step 6: Wait for mentors to respond
```

### Flow 4: Responding as a Mentor

```
Step 1: Experienced user sees mentorship request
        ↓
Step 2: Reviews match score and mentee needs
        ↓
Step 3: Clicks "Offer Guidance"
        ↓
Step 4: Select available time slot:
        ┌────────────────────────────────────────┐
        │ Available times for this mentorship:   │
        │                                        │
        │ ○ Thu 4 PM (mentee's preference)      │
        │ ○ Fri 10 AM                           │
        │ ○ Suggest different time...           │
        │                                        │
        │ [Confirm]                              │
        └────────────────────────────────────────┘
        ↓
Step 5: Mentee receives notification
        ↓
Step 6: Session scheduled when minimum mentors confirm
```

### Flow 5: Live Session Experience

```
Host/Attendee joins session
        ↓
┌─────────────────────────────────────────────────────────────┐
│                     SESSION ROOM                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐ ┌────────────────────────┐│
│  │                             │ │  Participants (8)      ││
│  │      VIDEO / SCREEN         │ │  ──────────────────    ││
│  │         SHARE               │ │  👤 Sarah (Host)       ││
│  │                             │ │  👤 John               ││
│  │                             │ │  👤 Maria              ││
│  │                             │ │  👤 ...                ││
│  └─────────────────────────────┘ └────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  AI Facilitator: "Great session! Consider wrapping up  ││
│  │  with key takeaways and action items."                 ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │  Chat                                              │     │
│  │  ──────                                            │     │
│  │  John: Great insights! How did you handle...      │     │
│  │  Maria: +1, I'm curious about that too            │     │
│  │  [Type a message...]                              │     │
│  └───────────────────────────────────────────────────┘     │
│                                                             │
│  [🎤 Mute] [📷 Camera] [🖥️ Share] [⏱️ 15:32] [End Session]  │
└─────────────────────────────────────────────────────────────┘
```

### Flow 6: Post-Session

```
Session Ends
        ↓
┌─────────────────────────────────────────────────────────────┐
│                   FOR HOST                                  │
├─────────────────────────────────────────────────────────────┤
│  Session Complete! 🎉                                       │
│                                                             │
│  📊 Stats:                                                  │
│  • Attendees: 8/20                                          │
│  • Duration: 32 minutes                                     │
│  • Avg Rating: 4.8/5                                        │
│                                                             │
│  🏆 Rewards Earned:                                         │
│  • +15 Teaching Credits                                     │
│  • Progress toward "Educator" badge (7/10)                  │
│                                                             │
│  📝 AI Summary available                                    │
│                                                             │
│  [View Feedback] [Schedule Another] [Share on Feed]         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   FOR ATTENDEE                              │
├─────────────────────────────────────────────────────────────┤
│  How was this session?                                      │
│                                                             │
│  Rate the host: ⭐⭐⭐⭐⭐                                    │
│                                                             │
│  What did you learn?                                        │
│  [                                                    ]     │
│                                                             │
│  Would you recommend this session? ○ Yes ○ No              │
│                                                             │
│  [Submit] [Skip]                                            │
│                                                             │
│  📹 Recording will be available in 24 hours                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Gamification System

### Stats Tracking (Left Sidebar)

```
┌────────────────────────────────────┐
│  Your Stats                        │
├────────────────────────────────────┤
│  Teaching Credits      124         │
│  Sessions Attended      18         │
│  People Helped          47         │
└────────────────────────────────────┘
```

| Stat | How to Earn |
|------|-------------|
| **Teaching Credits** | Host sessions (+15), Mentorship (+5), Good ratings (+3) |
| **Sessions Attended** | Complete any session as attendee (+1) |
| **People Helped** | Mentor someone (+1), Answer questions (+0.5) |

### Level Progression

```
Level Tiers:
───────────────────────────────────────
Newcomer        0-10 sessions
Contributor    11-25 sessions
Expert         26-50 sessions
Master        51-100 sessions
Legend          100+ sessions
───────────────────────────────────────

Progress Display:
┌────────────────────────────────────┐
│  🏆 Level Up!                      │
│  Host 2 more sessions to reach     │
│  Expert level                      │
│                                    │
│  ████████████░░░░  3/5 sessions    │
└────────────────────────────────────┘
```

### Badges

| Badge | Criteria | Icon |
|-------|----------|------|
| **First Steps** | Host your first session | 🎯 |
| **Helpful Hand** | Help 10 people | 🤝 |
| **Educator** | Host 10 teaching sessions | 📚 |
| **Team Player** | Participate in 5 team showcases | 👥 |
| **Mentor Master** | Complete 25 mentorship sessions | 🎓 |
| **Consistency** | Host sessions 4 weeks in a row | 📅 |
| **Rising Star** | Get 50 total attendees | ⭐ |
| **Thought Leader** | Reach 100 teaching credits | 💡 |

---

## AI Matching Algorithm

### Match Score Calculation

```javascript
matchScore = (
  skillMatch * 0.40 +        // Skills alignment
  goalMatch * 0.25 +         // Career goals alignment
  experienceMatch * 0.15 +   // Experience level fit
  timezoneMatch * 0.10 +     // Availability compatibility
  historyMatch * 0.10        // Past collaboration success
) * 100
```

### Match Display Examples

| Score | Display | Color |
|-------|---------|-------|
| 90-100% | "Perfect for your career goals" | Green |
| 75-89% | "Highly relevant to your work" | Blue |
| 60-74% | "Good match based on your profile" | Yellow |
| < 60% | No special indicator | Gray |

### Match Reasons

- "Perfect for your career goals - 92% match based on your profile"
- "Relevant to your UX work - Similar to your recent projects"
- "Share your experience - Help someone starting their journey"

---

## Database Schema

### New Tables Required

```sql
-- Session Types: teaching, showcase, mentorship
CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY,
    host_id UUID REFERENCES users(id),
    session_type VARCHAR(20) NOT NULL, -- teaching, showcase, mentorship
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, live, completed, cancelled
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    tags JSONB,
    duration_minutes INTEGER,
    max_participants INTEGER,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    meeting_link VARCHAR(500),
    recording_url VARCHAR(500),
    ai_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- For team showcases with multiple hosts
CREATE TABLE session_hosts (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES collaboration_sessions(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(20) DEFAULT 'co-host', -- host, co-host
    created_at TIMESTAMP DEFAULT NOW()
);

-- Track participants
CREATE TABLE session_participants (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES collaboration_sessions(id),
    user_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'registered', -- registered, attended, cancelled
    joined_at TIMESTAMP,
    left_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ratings and feedback
CREATE TABLE session_reviews (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES collaboration_sessions(id),
    reviewer_id UUID REFERENCES users(id),
    reviewee_id UUID REFERENCES users(id), -- host being reviewed
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User reputation and stats
CREATE TABLE user_reputation (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) UNIQUE,
    teaching_credits INTEGER DEFAULT 0,
    sessions_attended INTEGER DEFAULT 0,
    people_helped INTEGER DEFAULT 0,
    total_sessions_hosted INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    current_level VARCHAR(20) DEFAULT 'newcomer',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Badges earned
CREATE TABLE user_badges (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    badge_type VARCHAR(50) NOT NULL,
    earned_at TIMESTAMP DEFAULT NOW()
);

-- Mentorship-specific: what help is needed
CREATE TABLE mentorship_topics (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES collaboration_sessions(id),
    topic TEXT NOT NULL,
    is_addressed BOOLEAN DEFAULT FALSE
);
```

### Model Associations

```javascript
// In backend/models/index.js

// Session associations
User.hasMany(CollaborationSession, { as: 'hostedSessions', foreignKey: 'hostId' });
CollaborationSession.belongsTo(User, { as: 'host', foreignKey: 'hostId' });

CollaborationSession.hasMany(SessionHost, { as: 'coHosts', foreignKey: 'sessionId' });
CollaborationSession.hasMany(SessionParticipant, { as: 'participants', foreignKey: 'sessionId' });
CollaborationSession.hasMany(SessionReview, { as: 'reviews', foreignKey: 'sessionId' });

User.hasOne(UserReputation, { as: 'reputation', foreignKey: 'userId' });
User.hasMany(UserBadge, { as: 'badges', foreignKey: 'userId' });
```

---

## API Endpoints

### Sessions API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List all sessions (with filters) |
| POST | `/api/sessions` | Create new session |
| GET | `/api/sessions/:id` | Get session details |
| PUT | `/api/sessions/:id` | Update session |
| DELETE | `/api/sessions/:id` | Cancel session |
| POST | `/api/sessions/:id/join` | Join as participant |
| POST | `/api/sessions/:id/leave` | Leave session |
| POST | `/api/sessions/:id/start` | Start live session (host only) |
| POST | `/api/sessions/:id/end` | End session (host only) |
| GET | `/api/sessions/:id/participants` | List participants |

### Reviews API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions/:id/reviews` | Submit review |
| GET | `/api/sessions/:id/reviews` | Get session reviews |
| GET | `/api/users/:id/reviews` | Get user's received reviews |

### Reputation API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reputation/me` | Get current user stats |
| GET | `/api/reputation/:userId` | Get user reputation |
| GET | `/api/reputation/leaderboard` | Get top users |
| GET | `/api/badges` | List all available badges |
| GET | `/api/badges/me` | Get user's earned badges |

### Matching API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions/recommended` | Get AI-recommended sessions |
| GET | `/api/sessions/:id/match-score` | Get match score for session |
| GET | `/api/mentors/search` | Find matching mentors |

---

## Frontend Components

### Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Navbar: [Feed] [Sessions] [Mentorship] [My Profile]  [+ Share Achievement]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌────────────────────────────┐  ┌──────────────────┐│
│  │          │  │                            │  │                  ││
│  │  LEFT    │  │         CENTER             │  │      RIGHT       ││
│  │ SIDEBAR  │  │          FEED              │  │     SIDEBAR      ││
│  │          │  │                            │  │                  ││
│  │ • Quick  │  │  [Share Achievement CTA]   │  │ • Trending       ││
│  │   Actions│  │                            │  │   Topics         ││
│  │          │  │  ┌──────────────────────┐  │  │                  ││
│  │ • Your   │  │  │  Teaching Session    │  │  │ • Upcoming       ││
│  │   Stats  │  │  │  Card                │  │  │   Sessions       ││
│  │          │  │  └──────────────────────┘  │  │                  ││
│  │          │  │                            │  │ • Level Up       ││
│  │          │  │  ┌──────────────────────┐  │  │   Progress       ││
│  │          │  │  │  Team Showcase       │  │  │                  ││
│  │          │  │  │  Card                │  │  │                  ││
│  │          │  │  └──────────────────────┘  │  │                  ││
│  │          │  │                            │  │                  ││
│  │          │  │  ┌──────────────────────┐  │  │                  ││
│  │          │  │  │  Mentorship          │  │  │                  ││
│  │          │  │  │  Card                │  │  │                  ││
│  │          │  │  └──────────────────────┘  │  │                  ││
│  │          │  │                            │  │                  ││
│  └──────────┘  └────────────────────────────┘  └──────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Tree

```
FeedPage/
├── LeftSidebar/
│   ├── QuickActions/
│   │   ├── HostTeachingSessionBtn
│   │   ├── FindMentorshipBtn
│   │   └── JoinChallengeBtn
│   └── YourStats/
│       ├── TeachingCredits
│       ├── SessionsAttended
│       └── PeopleHelped
├── CenterFeed/
│   ├── ShareAchievementCTA
│   ├── FilterBar
│   └── SessionList/
│       ├── TeachingSessionCard
│       ├── TeamShowcaseCard
│       └── MentorshipCard
├── RightSidebar/
│   ├── TrendingTopics
│   ├── UpcomingSessions
│   └── LevelUpProgress
└── Modals/
    ├── CreateSessionModal
    ├── JoinSessionModal
    └── SessionRoomModal
```

---

## Real-time Features

### Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `session:started` | Server → Client | Session went live |
| `session:ended` | Server → Client | Session completed |
| `participant:joined` | Server → Client | New participant joined |
| `participant:left` | Server → Client | Participant left |
| `chat:message` | Bidirectional | Chat message in session |
| `notification:new` | Server → Client | New notification |

### Notification Types

| Type | Message Example |
|------|-----------------|
| `session_reminder` | "Your session 'React Tips' starts in 1 hour" |
| `session_booked` | "Sarah reserved a spot in your session" |
| `mentor_accepted` | "John offered to be your mentor!" |
| `session_completed` | "Rate your session with Mark's Team" |
| `level_up` | "🎉 You've reached Expert level!" |
| `badge_earned` | "🏆 You earned the 'Educator' badge!" |
| `match_found` | "New session matches your interests" |

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema and models
- [ ] Basic CRUD API for sessions
- [ ] Session cards UI components
- [ ] Basic feed display

### Phase 2: Core Features (Week 3-4)
- [ ] Session creation flow
- [ ] Join/leave functionality
- [ ] Reputation system
- [ ] Basic matching algorithm

### Phase 3: Live Sessions (Week 5-6)
- [ ] Session room UI
- [ ] Real-time chat
- [ ] Video integration (optional)
- [ ] AI facilitator

### Phase 4: Gamification (Week 7-8)
- [ ] Badges system
- [ ] Level progression
- [ ] Leaderboard
- [ ] Notifications

### Phase 5: Polish (Week 9-10)
- [ ] AI-powered recommendations
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Testing & bug fixes

---

## File Structure

```
backend/
├── models/
│   ├── CollaborationSession.js
│   ├── SessionHost.js
│   ├── SessionParticipant.js
│   ├── SessionReview.js
│   ├── UserReputation.js
│   ├── UserBadge.js
│   └── MentorshipTopic.js
├── routes/
│   ├── sessions.js
│   ├── reputation.js
│   └── matching.js
├── services/
│   ├── sessionService.js
│   ├── reputationService.js
│   ├── matchingService.js
│   └── sessionAIService.js
└── socket/
    └── sessionSocket.js

frontend/src/
├── pages/
│   └── FeedPage.jsx (redesigned)
├── components/
│   ├── sessions/
│   │   ├── TeachingSessionCard.jsx
│   │   ├── TeamShowcaseCard.jsx
│   │   ├── MentorshipCard.jsx
│   │   ├── CreateSessionModal.jsx
│   │   ├── SessionRoom.jsx
│   │   └── SessionFilters.jsx
│   ├── sidebar/
│   │   ├── QuickActions.jsx
│   │   ├── YourStats.jsx
│   │   ├── TrendingTopics.jsx
│   │   ├── UpcomingSessions.jsx
│   │   └── LevelUpProgress.jsx
│   └── gamification/
│       ├── BadgeDisplay.jsx
│       ├── LevelIndicator.jsx
│       └── ReputationCard.jsx
└── services/
    └── sessionAPI.js
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Sessions created per week | 50+ |
| Average session attendance | 60%+ |
| Average session rating | 4.0+ / 5 |
| User retention (30 day) | 40%+ |
| Mentorship request fulfillment | 80%+ |
| Average match score of joined sessions | 75%+ |

---

*Last Updated: January 2026*
