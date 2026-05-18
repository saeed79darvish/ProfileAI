import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, CircularProgress, Box } from '@mui/material';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import ImpersonationBanner from './components/ImpersonationBanner';
import CookieConsentBanner from './components/CookieConsent';
import ErrorBoundary from './components/ErrorBoundary';
import { setApiNavigate } from './services/api';
import { featureFlags } from './config/featureFlags';

// Critical path pages, loaded eagerly
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';

// Everything else, lazy loaded
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ProfileForm = React.lazy(() => import('./pages/ProfileForm'));
const ProfileCreation = React.lazy(() => import('./pages/ProfileCreation'));
const BrowseProfiles = React.lazy(() => import('./pages/BrowseProfiles'));
const PublicProfile = React.lazy(() => import('./pages/PublicProfile'));
const RecruiterTools = React.lazy(() => import('./pages/RecruiterTools'));
const RecruiterDashboard = React.lazy(() => import('./pages/RecruiterDashboard'));
const RecruiterProfileForm = React.lazy(() => import('./pages/RecruiterProfileForm'));
const RecruiterJobs = React.lazy(() => import('./pages/RecruiterJobs'));
const HarvestJobs = React.lazy(() => import('./pages/HarvestJobs'));
const ImportHistoryPage = React.lazy(() => import('./pages/ImportHistoryPage'));
const RecruiterCalendar = React.lazy(() => import('./pages/RecruiterCalendar'));
const CandidateJobs = React.lazy(() => import('./pages/CandidateJobs'));
const JobDetail = React.lazy(() => import('./pages/JobDetail'));
const JobApplication = React.lazy(() => import('./pages/JobApplication'));
const Pricing = React.lazy(() => import('./pages/Pricing'));
const SubscriptionSuccess = React.lazy(() => import('./pages/SubscriptionSuccess'));
const FeedPage = React.lazy(() => import('./pages/FeedPage'));
const MessagesPage = React.lazy(() => import('./pages/MessagesPage'));
const FollowersPage = React.lazy(() => import('./pages/FollowersPage'));
const RecruiterPublicProfile = React.lazy(() => import('./pages/RecruiterPublicProfile'));
const CompanyPage = React.lazy(() => import('./pages/CompanyPage'));
const AgentArena = React.lazy(() => import('./pages/AgentArena'));
const CandidateInterviews = React.lazy(() => import('./pages/CandidateInterviews'));
const RecruiterInterviews = React.lazy(() => import('./pages/RecruiterInterviews'));
const ScheduleInterview = React.lazy(() => import('./pages/ScheduleInterview'));
const ApplicationFormBuilder = React.lazy(() => import('./pages/ApplicationFormBuilder'));
const JobApplications = React.lazy(() => import('./pages/JobApplications'));
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage'));
const PollDetailPage = React.lazy(() => import('./pages/PollDetailPage'));
const PollsPage = React.lazy(() => import('./pages/PollsPage'));
const InvitationAcceptPage = React.lazy(() => import('./pages/InvitationAcceptPage'));
const GuestScreeningPage = React.lazy(() => import('./pages/GuestScreeningPage'));
const TrackApplicationPage = React.lazy(() => import('./pages/TrackApplicationPage'));
const ExtensionAuthSuccess = React.lazy(() => import('./pages/ExtensionAuthSuccess'));
const ResumeDownloadPage = React.lazy(() => import('./pages/ResumeDownloadPage'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = React.lazy(() => import('./pages/AdminUsers'));
const AdminPromos = React.lazy(() => import('./pages/AdminPromos'));
const CandidateOnboarding = React.lazy(() => import('./pages/CandidateOnboarding'));
const RecruiterOnboarding = React.lazy(() => import('./pages/RecruiterOnboarding'));
const JobPreferencesWizard = React.lazy(() => import('./pages/JobPreferencesWizard'));
const ApplyPilotPage = React.lazy(() => import('./pages/ApplyPilotPage'));
const MyJobs = React.lazy(() => import('./pages/MyJobs'));

const LazyFallback = (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#764ba2',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

// Google OAuth Client ID from environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Routes where the Navbar should be hidden (full-screen auth layouts)
const AUTH_ROUTES = ['/onboarding', '/recruiter/onboarding', '/profile/create', '/profile/preferences', '/track'];

// `/applypilot` is shared between the Chrome-extension marketing
// page and the candidate auto-apply dashboard. Signed-in candidates
// land on the in-app welcome/landing page (which adapts its primary
// CTA to "Go to Dashboard" for users who are already set up).
function ApplyPilotGateway() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return LazyFallback;
  if (isAuthenticated && user?.role === 'candidate') {
    return <Navigate to="/applypilot/welcome" replace />;
  }
  return <ApplyPilotPage />;
}

// Legacy /agent-arena/* → /applypilot/* redirect. Preserves sub-paths
// so notifications linking to /agent-arena/review/:id still land on
// the right row. Bare `/agent-arena` goes straight to
// /applypilot/dashboard rather than the Chrome-ext marketing page
// which owns bare `/applypilot`.
function ArenaLegacyRedirect() {
  const location = useLocation();
  const rewritten = location.pathname.replace(/^\/agent-arena/, '/applypilot');
  const target = rewritten === '/applypilot' ? '/applypilot/dashboard' : rewritten;
  return <Navigate to={target + (location.search || '')} replace />;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isOverlayMode =
    location.pathname === '/resume/download' &&
    new URLSearchParams(location.search).get('overlay') === '1';
  const hideNavbar =
    AUTH_ROUTES.includes(location.pathname) ||
    location.pathname.startsWith('/screen/') ||
    isOverlayMode;

  // Register navigate so the api.js 401 interceptor can do SPA navigation
  React.useEffect(() => {
    setApiNavigate(navigate);
    return () => setApiNavigate(null);
  }, [navigate]);

  return (
    <>
      <ImpersonationBanner />
      {!hideNavbar && <Navbar />}
      {!isOverlayMode && <CookieConsentBanner />}
      <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
      <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/applypilot" element={<ApplyPilotGateway />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/signup" element={<Register />} />
              <Route path="/onboarding" element={
                <PrivateRoute allowedRoles={['candidate']}>
                  <CandidateOnboarding />
                </PrivateRoute>
              } />
              {featureFlags.recruiterSurface && (
                <Route path="/recruiter/onboarding" element={
                  <PrivateRoute allowedRoles={['recruiter']}>
                    <RecruiterOnboarding />
                  </PrivateRoute>
                } />
              )}
              <Route path="/extension-auth-success" element={<ExtensionAuthSuccess />} />
              <Route path="/resume/download" element={<ResumeDownloadPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/invite/:token" element={<InvitationAcceptPage />} />
              <Route path="/screen/:token" element={<GuestScreeningPage />} />
              <Route path="/track" element={<TrackApplicationPage />} />
              {featureFlags.recruiterSurface && (
                <Route path="/browse" element={
                  <PrivateRoute allowedRoles={['recruiter']}>
                    <BrowseProfiles />
                  </PrivateRoute>
                } />
              )}
              {/* Social feed — gated by VITE_ENABLE_FEED (off by default). */}
              {featureFlags.feed && <Route path="/feed" element={<FeedPage />} />}
              <Route path="/polls" element={<PollsPage />} />
              <Route path="/poll/:id" element={<PollDetailPage />} />
              

              

              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
            <Route path="/profile/:id" element={<PublicProfile />} />
            <Route path="/recruiter/:id" element={<RecruiterPublicProfile />} />
            <Route path="/company/:slug" element={<CompanyPage />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/jobs/:id/apply" element={
              <PrivateRoute allowedRoles={['candidate']}>
                <JobApplication />
              </PrivateRoute>
            } />
            <Route path="/jobs" element={
              <PrivateRoute allowedRoles={['candidate']}>
                <CandidateJobs />
              </PrivateRoute>
            } />
            <Route path="/my-jobs" element={
              <PrivateRoute allowedRoles={['candidate']}>
                <MyJobs />
              </PrivateRoute>
            } />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/subscription/success" element={<SubscriptionSuccess />} />
            
            {/* ApplyPilot, candidate-side auto-apply. Primary route is
                /applypilot; /agent-arena/* kept as a redirect for existing
                links (deep-links, notifications, old bookmarks). */}
            <Route path="/applypilot/*" element={
              <PrivateRoute allowedRoles={['candidate']}>
                <AgentArena />
              </PrivateRoute>
            } />
            <Route path="/agent-arena/negotiate/:jobId" element={<Navigate to="/applypilot" replace />} />
            <Route path="/agent-arena/*" element={<ArenaLegacyRedirect />} />
            
            {/* Disabled for launch:
            <Route
              path="/messages"
              element={
                <PrivateRoute>
                  <MessagesPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/messages/:conversationId"
              element={
                <PrivateRoute>
                  <MessagesPage />
                </PrivateRoute>
              }
            />
            */}
            
            {/* Notifications route */}
            <Route
              path="/notifications"
              element={
                <PrivateRoute>
                  <NotificationsPage />
                </PrivateRoute>
              }
            />
            
            {/* Disabled for launch:
            <Route
              path="/network"
              element={
                <PrivateRoute>
                  <FollowersPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/network/:userId"
              element={
                <PrivateRoute>
                  <FollowersPage />
                </PrivateRoute>
              }
            />
            */}
            
            {/* Recruiter-only routes — gated by VITE_ENABLE_RECRUITER_SURFACE.
                Candidate-only launch keeps this OFF so the routes are not
                registered at all (any visit falls through to 404). */}
            {featureFlags.recruiterSurface && (
              <>
            <Route
              path="/recruiter/dashboard"
              element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <RecruiterDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/recruiter/profile"
              element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <RecruiterProfileForm />
                </PrivateRoute>
              }
            />
            <Route
              path="/recruiter/jobs"
              element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <RecruiterJobs />
                </PrivateRoute>
              }
            />
            <Route
              path="/recruiter/imports"
              element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <ImportHistoryPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/recruiter/greenhouse"
              element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <HarvestJobs />
                </PrivateRoute>
              }
            />
            <Route
              path="/recruiter/jobs/:id/application-form"
              element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <ApplicationFormBuilder />
                </PrivateRoute>
              }
            />
            <Route
              path="/recruiter/jobs/:id/applications"
              element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <JobApplications />
                </PrivateRoute>
              }
            />
            <Route
              path="/recruiter/calendar"
              element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <RecruiterCalendar />
                </PrivateRoute>
              }
            />
            <Route
              path="/recruiter/interviews"
              element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <RecruiterInterviews />
                </PrivateRoute>
              }
            />
            <Route
              path="/recruiter/schedule-interview"
              element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <ScheduleInterview />
                </PrivateRoute>
              }
            />
            <Route
              path="/recruiter-tools/:profileId"
              element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <RecruiterTools />
                </PrivateRoute>
              }
            />
              </>
            )}
            
            {/* Admin-only routes */}
            <Route
              path="/admin"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminUsers />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/promos"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminPromos />
                </PrivateRoute>
              }
            />
            
            {/* Candidate-only routes */}
            <Route
              path="/profile"
              element={
                <PrivateRoute allowedRoles={['candidate']}>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={<Navigate to="/profile" replace />}
            />
            <Route
              path="/profile/create"
              element={
                <PrivateRoute allowedRoles={['candidate']}>
                  <ProfileCreation />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile/preferences"
              element={
                <PrivateRoute allowedRoles={['candidate']}>
                  <JobPreferencesWizard />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile/create-form"
              element={
                <PrivateRoute allowedRoles={['candidate']}>
                  <ProfileForm />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <PrivateRoute allowedRoles={['candidate']}>
                  <ProfileForm />
                </PrivateRoute>
              }
            />
            <Route
              path="/interviews"
              element={<Navigate to="/profile" replace />}
            />
          </Routes>
        </Suspense>
        </ErrorBoundary>
        </>
      );
    }

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <ToastProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppContent />
          </Router>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
