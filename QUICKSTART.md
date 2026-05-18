# ProfileAI Quick Start Guide

## Getting Started in 5 Minutes

### Step 1: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 2: Configure Environment

**Backend** - Create `backend/.env`:
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=profileai
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key_change_this
JWT_EXPIRE=7d
OPENAI_API_KEY=sk-your-openai-key-here
CORS_ORIGIN=http://localhost:3000
```

**Frontend** - Already configured in `frontend/.env`

### Step 3: Setup Database

```bash
# Create PostgreSQL database
createdb profileai

# Initialize tables
cd backend
npm run init-db
```

### Step 4: Run the Application

**Terminal 1:**
```bash
cd backend
npm run dev
```

**Terminal 2:**
```bash
cd frontend
npm start
```

### Step 5: Use the App

1. Open http://localhost:3000
2. Click "Get Started Free"
3. Register with your email
4. Create your profile
5. Click "Enhance with AI" to generate AI insights

## Common Issues

### Database Connection Error
- Ensure PostgreSQL is running: `brew services start postgresql` (macOS)
- Check database credentials in `.env`

### OpenAI API Error
- Verify your API key is valid
- Ensure you have API credits available

### Port Already in Use
- Backend: Change `PORT` in `backend/.env`
- Frontend: React will offer to use a different port

## Need Help?

Check the full README.md for detailed documentation.
