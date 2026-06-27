import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import styled from 'styled-components';
import { featureFlags } from '../../config/featureFlags';

/**
 * AgentProfileShell · sub-tab nav for /applypilot/agent/*.
 *
 *   /applypilot/agent          → SetupPage (job criteria + canned answers)
 *   /applypilot/agent/coach    → CoachPage (chat-based training)
 */

const BRAND = '#7C5CFF';
const BRAND_50 = '#F2EEFF';
const INK_900 = '#0E0B1F';
const INK_500 = '#6B6787';
const LINE = '#E9E7EF';

const TabBar = styled.div`
  background: #fff;
  border-bottom: 1px solid ${LINE};
`;

const TabBarInner = styled.div`
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  gap: 4px;

  @media (max-width: 640px) {
    padding: 0 12px;
  }
`;

const Tab = styled(NavLink)`
  position: relative;
  padding: 14px 16px;
  font-size: 13.5px;
  font-weight: 600;
  color: ${INK_500};
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: color .12s, border-color .12s;
  display: inline-flex;
  align-items: center;
  gap: 8px;

  &:hover { color: ${INK_900}; }

  &.active {
    color: ${BRAND};
    border-bottom-color: ${BRAND};
  }
`;

const TabIcon = styled.span`
  display: inline-flex;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  background: ${BRAND_50};
  color: ${BRAND};
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
`;

const AgentProfileShell = () => {
  // Coach training is gated behind VITE_ENABLE_APPLYPILOT_COACH. With
  // the flag off there's only one tab left (Job criteria), so hide the
  // whole tab bar to avoid a lonely / confusing single-tab strip.
  const showCoach = featureFlags.applyPilotCoach;
  if (!showCoach) {
    return <Outlet />;
  }
  return (
    <>
      <TabBar>
        <TabBarInner>
          <Tab to="/applypilot/agent" end>
            <TabIcon>◎</TabIcon>
            Job criteria
          </Tab>
          <Tab to="/applypilot/agent/coach">
            <TabIcon>✦</TabIcon>
            Coach training
          </Tab>
        </TabBarInner>
      </TabBar>
      <Outlet />
    </>
  );
};

export default AgentProfileShell;
