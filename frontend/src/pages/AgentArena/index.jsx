import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AgentArenaShell from './AgentArenaShell';
import AgentProfileShell from './AgentProfileShell';
import DashboardPage from './DashboardPage';
import LandingPage from './LandingPage';
import SetupPage from './SetupPage';
import CoachPage from './CoachPage';
import ReviewPage from './ReviewPage';
import ReviewEntry from './ReviewEntry';
import SentPage from './SentPage';
import SentDetailPage from './SentDetailPage';

/**
 * ApplyPilot · router shell.
 *
 * Post-redesign IA. Two primary tabs + a gear-icon "agent profile"
 * surface that groups the "teach the agent" pages. ATS credentials
 * are handled entirely server-side, so the old Credentials page is
 * not part of the user-facing surface.
 *
 *   /applypilot/dashboard          → DashboardPage (status + ready + blockers)
 *   /applypilot/inbox/:appId       → ReviewPage (single-application detail)
 *   /applypilot/sent               → SentPage
 *   /applypilot/sent/:appId        → SentDetailPage
 *   /applypilot/agent              → AgentProfileShell → SetupPage (job criteria)
 *
 * Deprecated deep-links are redirected:
 *   /applypilot/inbox              → /applypilot/dashboard
 *   /applypilot/setup              → /applypilot/agent
 *   /applypilot/training           → /applypilot/agent
 *   /applypilot/credentials        → /applypilot/agent
 *   /applypilot/agent/credentials  → /applypilot/agent
 *   /applypilot/review             → /applypilot/dashboard
 *   /applypilot/review/:id         → /applypilot/inbox/:id
 *   /applypilot/needs-attention    → /applypilot/dashboard
 */
const AgentArena = () => (
  <Routes>
    <Route element={<AgentArenaShell />}>
      <Route index element={<Navigate to="/applypilot/welcome" replace />} />

      <Route path="welcome" element={<LandingPage />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="review" element={<ReviewEntry />} />
      <Route path="inbox/:appId" element={<ReviewPage />} />

      <Route path="sent" element={<SentPage />} />
      <Route path="sent/:appId" element={<SentDetailPage />} />

      <Route path="agent" element={<AgentProfileShell />}>
        <Route index element={<SetupPage />} />
        <Route path="coach" element={<CoachPage />} />
        <Route path="training" element={<Navigate to="/applypilot/agent/coach" replace />} />
        <Route path="credentials" element={<Navigate to="/applypilot/agent" replace />} />
      </Route>

      {/* Back-compat redirects. */}
      <Route path="inbox" element={<Navigate to="/applypilot/review" replace />} />
      <Route path="setup" element={<Navigate to="/applypilot/agent" replace />} />
      <Route path="training" element={<Navigate to="/applypilot/agent/coach" replace />} />
      <Route path="coach" element={<Navigate to="/applypilot/agent/coach" replace />} />
      <Route path="credentials" element={<Navigate to="/applypilot/agent" replace />} />
      <Route path="review" element={<Navigate to="/applypilot/dashboard" replace />} />
      <Route path="review/:appId" element={<LegacyReviewRedirect />} />
      <Route path="needs-attention" element={<Navigate to="/applypilot/dashboard" replace />} />

      {/* Unknown sub-paths → Dashboard */}
      <Route path="*" element={<Navigate to="/applypilot/dashboard" replace />} />
    </Route>
  </Routes>
);

// Preserve the appId when bouncing /review/:appId → /inbox/:appId.
function LegacyReviewRedirect() {
  const pathname = window.location.pathname;
  const m = pathname.match(/\/review\/([^/]+)/);
  const appId = m ? m[1] : '';
  return <Navigate to={appId ? `/applypilot/inbox/${appId}` : '/applypilot/dashboard'} replace />;
}

export default AgentArena;
