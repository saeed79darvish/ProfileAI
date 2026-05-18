# ProfileAI - AI-Enhanced Professional Profile Platform

A modern, full-stack web application that helps professionals create stunning profiles enhanced with AI-powered insights. Built with React, Material-UI, Node.js, Express, PostgreSQL, and OpenAI.

## 🌟 Features

- **User Registration & Authentication** - Secure JWT-based authentication
- **Profile Management** - Create and edit comprehensive professional profiles
- **AI Enhancement** - Leverage OpenAI to:
  - Generate compelling professional summaries
  - Identify key strengths and competencies
  - Provide recruiter insights
  - Extract relevant keywords for SEO
- **Beautiful UI** - Modern, responsive design with Material-UI
- **Real-time Updates** - Instant profile updates and AI enhancements

## 🛠️ Tech Stack

### Frontend
- React 18
- Material-UI (MUI)
- React Router
- Axios
- Context API for state management

### Backend
- Node.js
- Express.js
- PostgreSQL
- Sequelize ORM
- JWT Authentication
- OpenAI API
- bcryptjs for password hashing

## 📋 Prerequisites

Before you begin, ensure you have installed:
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn
- OpenAI API key

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/saeed79darvish/ProfileAI.git
cd ProfileAI
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=profileai
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRE=7d

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 🚩 Feature Flags

All flags are env-var booleans (`true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`) and default to **off**. They're defined in [backend/config/featureFlags.js](backend/config/featureFlags.js) and [frontend/src/config/featureFlags.ts](frontend/src/config/featureFlags.ts).

#### Backend (`backend/.env`)

| Env var | Code key | Default | What it does |
|---|---|---|---|
| `ENABLE_RECRUITER_AGENT_ARENA` | `recruiterAgentArena` | `false` | Enables the recruiter Agent Arena feature (AI-driven candidate screening flow). |
| `APPLYPILOT_AUTOSUBMIT` | `applyPilotAutoSubmit` | `false` | Turns ApplyPilot from hybrid mode (prepare materials, user submits manually) into full auto-submit. Mounts the submit worker, scout enqueue, and approve/submit routes. |
| `ENABLE_FEED` | `feed` | `false` | Mounts the social-feed API (`/api/posts` and its nested comment/like/save routes). Off for launch. |
| `ENABLE_CLAUDE_CONNECTOR` | `claudeConnector` | `false` | Mounts the `/mcp` endpoint (Remote MCP server) so ProfileAI can be added as a Custom Connector in Claude.ai. |

#### Frontend (`frontend/.env`)

| Env var | Code key | Default | What it does |
|---|---|---|---|
| `VITE_ENABLE_RECRUITER_AGENT_ARENA` | `recruiterAgentArena` | `false` | Shows Agent Arena UI in the AI Screening config modal and Browse Profiles page. Pair with the backend flag. |
| `VITE_ENABLE_FEED` | `feed` | `false` | Mounts the `/feed` route, the Feed nav link, and the Community-Feed footer link. Pair with `ENABLE_FEED` on the backend. |
| `VITE_ENABLE_CLAUDE_CONNECTOR` | `claudeConnector` | `false` | Shows "Use ProfileAI in Claude" promo/onboarding UI. Backend exposure is gated separately by `ENABLE_CLAUDE_CONNECTOR`. |

**Usage:** flip a flag by setting the env var before starting the corresponding server. Backend and frontend flags are independent — turn both on for any user-facing feature that has API + UI.

### 3. Database Setup

Create a PostgreSQL database:

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE profileai;

# Exit
\q
```

Initialize the database:

```bash
npm run init-db
```

### 4. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# The .env file is already configured for local development
# If needed, update the API URL in .env
```

### 5. Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📝 Usage Guide

### Creating Your Profile

1. **Register**: Create an account at `/register`
2. **Login**: Sign in at `/login`
3. **Create Profile**: Fill in your professional information
   - Basic info (title, location, contact)
   - Skills (categorized by frontend, backend, etc.)
   - Experience history
   - Projects
   - Education
4. **Enhance with AI**: Click "Enhance with AI" to generate:
   - AI-generated professional summary
   - Key strengths identification
   - Recruiter insights
   - Relevant keywords

### Profile Sections

- **Basic Information**: Title, location, contact details, social links
- **Professional Summary**: Your career overview
- **Technical Skills**: Categorized by technology type
- **Experience**: Work history with descriptions
- **Projects**: Notable projects and achievements
- **Education**: Academic background
- **AI Enhancements**: AI-generated insights visible to recruiters

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Profiles
- `GET /api/profiles/me` - Get current user's profile
- `POST /api/profiles` - Create/update profile
- `POST /api/profiles/enhance` - Enhance profile with AI
- `GET /api/profiles/:id` - Get public profile by ID
- `GET /api/profiles` - Get all public profiles

## 🎨 AI Features

The platform uses OpenAI's GPT-4 to provide:

1. **Enhanced Summary**: Professionally crafted summary highlighting your unique value
2. **Key Strengths**: Identification of 5-7 core competencies
3. **Recruiter Insights**: Career trajectory analysis and role recommendations
4. **Keywords**: SEO-optimized keywords for better discoverability

## 📦 Project Structure

```
ProfileAI/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Profile.js
│   │   └── index.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── profiles.js
│   ├── services/
│   │   └── aiService.js
│   ├── scripts/
│   │   └── initDatabase.js
│   ├── server.js
│   └── package.json
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.js
    │   │   └── PrivateRoute.js
    │   ├── contexts/
    │   │   └── AuthContext.js
    │   ├── pages/
    │   │   ├── Home.js
    │   │   ├── Login.js
    │   │   ├── Register.js
    │   │   ├── Dashboard.js
    │   │   └── ProfileForm.js
    │   ├── services/
    │   │   └── api.js
    │   ├── App.js
    │   └── index.js
    └── package.json
```

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Protected API routes
- CORS configuration
- SQL injection prevention via Sequelize ORM
- Input validation

## 🌐 Environment Variables

### Backend (.env)
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - Secret for JWT signing
- `JWT_EXPIRE` - Token expiration time
- `OPENAI_API_KEY` - OpenAI API key
- `CORS_ORIGIN` - Allowed CORS origin

### Frontend (.env)
- `REACT_APP_API_URL` - Backend API URL

## 🧪 Testing

```bash
# Backend tests (if implemented)
cd backend
npm test

# Frontend tests (if implemented)
cd frontend
npm test
```

## 🚢 Deployment

### Backend Deployment
1. Set `NODE_ENV=production`
2. Update database credentials
3. Set a strong `JWT_SECRET`
4. Configure CORS for your frontend domain
5. Use `npm start` instead of `npm run dev`

### Frontend Deployment
1. Update `REACT_APP_API_URL` to your backend URL
2. Build the app: `npm run build`
3. Deploy the `build` folder to your hosting service

## 📄 License

This project is licensed under the MIT License.

## 👤 Author

**Saeed Darvish**
- Email: saeed79darvish@gmail.com
- LinkedIn: [linkedin.com/in/saeed-darvish](https://linkedin.com/in/saeed-darvish)
- Location: San Francisco, CA

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- Material-UI for the component library
- The React and Node.js communities

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub or contact saeed79darvish@gmail.com.

---

**Built with ❤️ by Saeed Darvish**