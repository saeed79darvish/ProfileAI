import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ArenaSubNav,
  ArenaSubNavInner,
  ArenaNavBrand,
  ArenaNavLink,
  ArenaNavCount,
} from './styled';
import { useReviewQueue } from '../../hooks/useApplyPilot';

/**
 * ApplyPilot · sub-nav + router outlet.
 *
 * Agent Profile (Setup, Training, Credentials) is reached via the
 * Dashboard's Quick Actions and AgentSummaryCard, so it doesn't need
 * its own top-level tab.
 */
const TABS = [
  { to: '/applypilot/dashboard', label: 'Dashboard' },
  { to: '/applypilot/review',    label: 'Review', badgeKey: 'ready', tone: 'brand' },
  { to: '/applypilot/sent',      label: 'Sent',   badgeKey: 'sent',  tone: 'good' },
];

const AgentArenaShell = () => {
  const location = useLocation();
  const { queue } = useReviewQueue();

  const counts = useMemo(() => {
    const list = Array.isArray(queue) ? queue : [];
    // `a.status` is the UI-mapped 4-state vocabulary; raw DB status is
    // exposed as `dbStatus`. Sent items live as `dbStatus === 'submitted'`
    // (UI status `approved`), so we have to look at dbStatus here or the
    // tab badge would always read 0 even when /sent has rows.
    return {
      ready: list.filter((a) => a.status === 'pending').length,
      sent: list.filter((a) => a.dbStatus === 'submitted').length,
    };
  }, [queue]);

  return (
    <>
      <ArenaSubNav>
        <ArenaSubNavInner>
          <ArenaNavBrand>ApplyPilot</ArenaNavBrand>
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              style={{ textDecoration: 'none' }}
            >
              {({ isActive }) => {
                const active = isActive
                  || (tab.to === '/applypilot/review' && location.pathname.startsWith('/applypilot/inbox/'));
                const count = tab.badgeKey ? counts[tab.badgeKey] : 0;
                return (
                  <ArenaNavLink as="span" $active={active}>
                    {tab.label}
                    {tab.badgeKey && count > 0 && (
                      <ArenaNavCount $tone={tab.tone || 'neutral'}>{count}</ArenaNavCount>
                    )}
                  </ArenaNavLink>
                );
              }}
            </NavLink>
          ))}
        </ArenaSubNavInner>
      </ArenaSubNav>
      <Outlet />
    </>
  );
};

export default AgentArenaShell;
