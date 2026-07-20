import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, CircularProgress, Box } from '@mui/material';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import ImpersonationBanner from './components/ImpersonationBanner';
import CookieConsentBanner from './components/CookieConsent';
import ErrorBoundary from './components/ErrorBoundary';
import { setApiNavigate } from './services/api';
import { featureFlags } from './config/featureFlags';
import { lazyWithReload } from './utils/lazyWithReload';

// Critical path pages, loaded eagerly
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';

// Everything else, lazy loaded
const ForgotPassword = lazyWithReload(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyWithReload(() => import('./pages/ResetPassword'));
const Dashboard = lazyWithReload(() => import('./pages/Dashboard'));
const ProfileForm = lazyWithReload(() => import('./pages/ProfileForm'));
const ProfileCreation = lazyWithReload(() => import('./pages/ProfileCreation'));
const BrowseProfiles = lazyWithReload(() => import('./pages/BrowseProfiles'));
const PublicProfile = lazyWithReload(() => import('./pages/PublicProfile'));
const RecruiterTools = lazyWithReload(() => import('./pages/RecruiterTools'));
const RecruiterDashboard = lazyWithReload(() => import('./pages/RecruiterDashboard'));
const RecruiterProfileForm = lazyWithReload(() => import('./pages/RecruiterProfileForm'));
const RecruiterJobs = lazyWithReload(() => import('./pages/RecruiterJobs'));
const HarvestJobs = lazyWithReload(() => import('./pages/HarvestJobs'));
const ImportHistoryPage = lazyWithReload(() => import('./pages/ImportHistoryPage'));
const RecruiterCalendar = lazyWithReload(() => import('./pages/RecruiterCalendar'));
const CandidateJobs = lazyWithReload(() => import('./pages/CandidateJobs'));
const JobDetail = lazyWithReload(() => import('./pages/JobDetail'));
const JobApplication = lazyWithReload(() => import('./pages/JobApplication'));
const MobileApply = lazyWithReload(() => import('./pages/MobileApply'));
const Pricing = lazyWithReload(() => import('./pages/Pricing'));
const SubscriptionSuccess = lazyWithReload(() => import('./pages/SubscriptionSuccess'));
const FeedPage = lazyWithReload(() => import('./pages/FeedPage'));
const MessagesPage = lazyWithReload(() => import('./pages/MessagesPage'));
const FollowersPage = lazyWithReload(() => import('./pages/FollowersPage'));
const RecruiterPublicProfile = lazyWithReload(() => import('./pages/RecruiterPublicProfile'));
const CompanyPage = lazyWithReload(() => import('./pages/CompanyPage'));
const AgentArena = lazyWithReload(() => import('./pages/AgentArena'));
const CandidateInterviews = lazyWithReload(() => import('./pages/CandidateInterviews'));
const RecruiterInterviews = lazyWithReload(() => import('./pages/RecruiterInterviews'));
const ScheduleInterview = lazyWithReload(() => import('./pages/ScheduleInterview'));
const ApplicationFormBuilder = lazyWithReload(() => import('./pages/ApplicationFormBuilder'));
const JobApplications = lazyWithReload(() => import('./pages/JobApplications'));
const NotificationsPage = lazyWithReload(() => import('./pages/NotificationsPage'));
const PollDetailPage = lazyWithReload(() => import('./pages/PollDetailPage'));
const PollsPage = lazyWithReload(() => import('./pages/PollsPage'));
const InvitationAcceptPage = lazyWithReload(() => import('./pages/InvitationAcceptPage'));
const GuestScreeningPage = lazyWithReload(() => import('./pages/GuestScreeningPage'));
const TrackApplicationPage = lazyWithReload(() => import('./pages/TrackApplicationPage'));
const ExtensionAuthSuccess = lazyWithReload(() => import('./pages/ExtensionAuthSuccess'));
const ResumeDownloadPage = lazyWithReload(() => import('./pages/ResumeDownloadPage'));
const LinkedInOAuthCallback = lazyWithReload(() => import('./pages/LinkedInOAuthCallback'));
const HelpCenter = lazyWithReload(() => import('./pages/HelpCenter'));
const PrivacyPolicy = lazyWithReload(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazyWithReload(() => import('./pages/TermsOfService'));
const AdminDashboard = lazyWithReload(() => import('./pages/AdminDashboard'));
const AdminUsers = lazyWithReload(() => import('./pages/AdminUsers'));
const AdminPromos = lazyWithReload(() => import('./pages/AdminPromos'));
const AdminSupport = lazyWithReload(() => import('./pages/AdminSupport'));
const CandidateOnboarding = lazyWithReload(() => import('./pages/CandidateOnboarding'));
const RecruiterOnboarding = lazyWithReload(() => import('./pages/RecruiterOnboarding'));
const JobPreferencesWizard = lazyWithReload(() => import('./pages/JobPreferencesWizard'));
const ApplyPilotLanding = lazyWithReload(() => import('./pages/AgentArena/LandingPage'));
const MyJobs = lazyWithReload(() => import('./pages/MyJobs'));
const CheckEmail = lazyWithReload(() => import('./pages/CheckEmail'));
const VerifyEmail = lazyWithReload(() => import('./pages/VerifyEmail'));
const BlogIndex = lazyWithReload(() => import('./pages/Blog'));
const BlogPost = lazyWithReload(() => import('./pages/Blog/BlogPost'));
const ExtensionPage = lazyWithReload(() => import('./pages/Extension'));

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

// `/applypilot` is shared between the public marketing landing page
// and the candidate auto-apply dashboard. ANY authenticated user that
// can access ApplyPilot (per /auth/me canUseApplyPilot — driven by
// ENABLE_APPLYPILOT, APPLYPILOT_ALLOWED_USERS, and admin role) is
// redirected into the shell at /applypilot/welcome so they get the
// in-app sub-nav. Authenticated users WITHOUT access bounce to home
// so they don't land on a route that 404s every API call. Signed-out
// visitors see the LandingPage standalone — the marketing hero is
// the entire page for them.
function ApplyPilotGateway() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return LazyFallback;
  if (isAuthenticated) {
    if (user?.canUseApplyPilot) {
      return <Navigate to="/applypilot/welcome" replace />;
    }
    // Authenticated user without access — feature is gated behind the
    // global ENABLE_APPLYPILOT flag and they're not on the allowlist.
    // Send them somewhere useful instead of a dead landing page.
    return <Navigate to="/jobs" replace />;
  }
  return <ApplyPilotLanding />;
}

// Wraps the /applypilot/* AgentArena route group. Blocks direct deep
// links (e.g. /applypilot/dashboard) for users who don't have feature
// access \u2014 PrivateRoute upstream already enforces auth + allowedRoles,
// this layer adds the per-user / global-flag gate that mirrors the
// backend's userCanAccessApplyPilot check. Anyone without access goes
// to /jobs so the URL never lingers on a screen where every API call
// 404s.
function ApplyPilotAccessGate({ children }) {
  const { user, loading } = useAuth();
  if (loading) return LazyFallback;
  if (!user?.canUseApplyPilot) {
    return <Navigate to="/jobs" replace />;
  }
  return children;
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

// The `/` route is the marketing landing page for signed-out visitors,
// but signed-in users should never see it — they've already converted
// and want their app. Send them to their role-appropriate root.
function HomeOrAppRoot() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return LazyFallback;
  if (!isAuthenticated) return <Home />;
  if (user?.role === 'recruiter') return <Navigate to="/recruiter/dashboard" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/profile" replace />;
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
              <Route path="/" element={<HomeOrAppRoot />} />
              <Route path="/applypilot" element={<ApplyPilotGateway />} />
              <Route path="/extension" element={<ExtensionPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/signup" element={<Register />} />
              <Route path="/check-email" element={<CheckEmail />} />
              <Route path="/verify-email/:token" element={<VerifyEmail />} />
              <Route path="/onboarding" element={
                <PrivateRoute allowedRoles={['candidate', 'admin']}>
                  <CandidateOnboarding />
                </PrivateRoute>
              } />
              <Route path="/recruiter/onboarding" element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <RecruiterOnboarding />
                </PrivateRoute>
              } />
              <Route path="/extension-auth-success" element={<ExtensionAuthSuccess />} />
              <Route path="/auth/linkedin/callback" element={<LinkedInOAuthCallback />} />
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/resume/download" element={<ResumeDownloadPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/invite/:token" element={<InvitationAcceptPage />} />
              <Route path="/screen/:token" element={<GuestScreeningPage />} />
              <Route path="/track" element={<TrackApplicationPage />} />
              <Route path="/browse" element={
                <PrivateRoute allowedRoles={['recruiter']}>
                  <BrowseProfiles />
                </PrivateRoute>
              } />
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
              <PrivateRoute allowedRoles={['candidate', 'admin']}>
                <JobApplication />
              </PrivateRoute>
            } />
            <Route path="/mobile-apply" element={
              <PrivateRoute allowedRoles={['candidate', 'admin']}>
                <MobileApply />
              </PrivateRoute>
            } />
            {/*
              /jobs is intentionally PUBLIC.
              Anonymous visitors can browse and filter the job board (incl.
              deep links like /jobs?startup=true&locationType=onsite). Auth
              is only required for per-user features (Save, Apply, Match %,
              "Applied" tab) — those are gated inside CandidateJobs via
              `isAuthenticated` checks that bounce the user to /login on
              click. Previously this route was wrapped in PrivateRoute,
              which redirected anonymous + recruiter visitors away from
              public filtered URLs.
            */}
            <Route path="/jobs" element={<CandidateJobs />} />
            <Route path="/my-jobs" element={
              <PrivateRoute allowedRoles={['candidate', 'admin']}>
                <MyJobs />
              </PrivateRoute>
            } />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/blog" element={<BlogIndex />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/subscription/success" element={<SubscriptionSuccess />} />
            
            {/* ApplyPilot, candidate-side auto-apply. Primary route is
                /applypilot; /agent-arena/* kept as a redirect for existing
                links (deep-links, notifications, old bookmarks).
                Feature-gated via ApplyPilotAccessGate below \u2014 users without
                canUseApplyPilot bounce to /jobs instead of seeing a route
                that 404s every API call. */}
            <Route path="/applypilot/*" element={
              <PrivateRoute allowedRoles={['candidate', 'admin']}>
                <ApplyPilotAccessGate>
                  <AgentArena />
                </ApplyPilotAccessGate>
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
            
            {/* Recruiter-only routes */}
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
            <Route
              path="/admin/support"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminSupport />
                </PrivateRoute>
              }
            />
            
            {/* Candidate-only routes */}
            <Route
              path="/profile"
              element={
                <PrivateRoute allowedRoles={['candidate', 'admin']}>
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
                <PrivateRoute allowedRoles={['candidate', 'admin']}>
                  <ProfileCreation />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile/preferences"
              element={
                <PrivateRoute allowedRoles={['candidate', 'admin']}>
                  <JobPreferencesWizard />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile/create-form"
              element={
                <PrivateRoute allowedRoles={['candidate', 'admin']}>
                  <ProfileForm />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <PrivateRoute allowedRoles={['candidate', 'admin']}>
                  <ProfileForm />
                </PrivateRoute>
              }
            />
            <Route
              path="/interviews"
              element={<Navigate to="/profile" replace />}
            />
            {/* Catch-all: any unmatched path redirects to home rather than
                rendering a blank page. This covers disabled feature routes
                (e.g. /feed when VITE_ENABLE_FEED=false) and any typos. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
        </>
      );
    }

function App() {
  return (
    <HelmetProvider>
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
    </HelmetProvider>
  );
}

export default App;
