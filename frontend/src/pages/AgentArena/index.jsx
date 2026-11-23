import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import Shell from './v2/Shell';
import Home from './v2/Home';
import Welcome from './v2/Welcome';
import Setup from './v2/Setup';
import Dashboard from './v2/Dashboard';
import Review from './v2/Review';
import Sent from './v2/Sent';
import Settings from './v2/Settings';

/**
 * ApplyPilot · router (v2 redesign).
 *
 *   /applypilot/home              → Dashboard if set up, else Welcome
 *   /applypilot/welcome           → Welcome (not set up yet)
 *   /applypilot/setup             → 4-step setup
 *   /applypilot/dashboard         → what to do now
 *   /applypilot/review[/:appId]   → check and approve applications
 *   /applypilot/sent[/:appId]     → what was approved, with proof
 *   /applypilot/settings          → change setup choices, learned answers
 *
 * The navbar's ApplyPilot button goes to /applypilot, which App.jsx
 * sends to /applypilot/home for users with access. Old deep links
 * (inbox, agent, training, coach, credentials, needs-attention) redirect.
 */
function InboxRedirect() {
  const { appId } = useParams();
  return <Navigate to={appId ? `/applypilot/review/${appId}` : '/applypilot/review'} replace />;
}

const AgentArena = () => (
  <Routes>
    <Route index element={<Home />} />
    <Route path="home" element={<Home />} />
    <Route path="welcome" element={<Welcome />} />
    <Route path="setup" element={<Setup />} />

    <Route element={<Shell />}>
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="review" element={<Review />} />
      <Route path="review/:appId" element={<Review />} />
      <Route path="sent" element={<Sent />} />
      <Route path="sent/:appId" element={<Sent />} />
      <Route path="settings" element={<Settings />} />
    </Route>

    {/* Back-compat redirects from the previous ApplyPilot screens. */}
    <Route path="inbox" element={<InboxRedirect />} />
    <Route path="inbox/:appId" element={<InboxRedirect />} />
    <Route path="agent/*" element={<Navigate to="/applypilot/settings" replace />} />
    <Route path="training" element={<Navigate to="/applypilot/settings" replace />} />
    <Route path="coach" element={<Navigate to="/applypilot/settings" replace />} />
    <Route path="credentials" element={<Navigate to="/applypilot/settings" replace />} />
    <Route path="needs-attention" element={<Navigate to="/applypilot/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/applypilot/home" replace />} />
  </Routes>
);

export default AgentArena;
