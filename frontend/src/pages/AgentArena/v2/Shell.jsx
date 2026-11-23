/* ApplyPilot v2 · sub-menu (Dashboard, Review, Sent, Settings) for
   people who have set up. Welcome and Setup render without it. */
import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { T } from './ui';
import { useReviewQueue, useApplyPilotConfig } from '../../../hooks/useApplyPilot';
import { splitQueue } from './model';

const Bar = styled.div`
  background: #fff;
  border-bottom: 1px solid ${T.line};
  font-family: Inter, -apple-system, 'Segoe UI', Roboto, sans-serif;
`;
const Inner = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 28px;
  @media (max-width: 720px) { padding: 0 16px; gap: 0 12px; }
`;
const Brand = styled.span`
  display: inline-flex; align-items: center; gap: 8px;
  font-weight: 800; font-size: 15px; color: ${T.ink};
`;
const Dot = styled.span`
  width: 8px; height: 8px; border-radius: 50%;
  background: ${(p) => (p.$on ? '#16a34a' : '#9a98ad')};
`;
const Tab = styled(NavLink)`
  padding: 16px 10px 13px;
  font-size: 15px;
  color: ${T.ink2};
  text-decoration: none;
  border-bottom: 3px solid transparent;
  display: inline-flex; align-items: center; gap: 6px;
  &.active { color: ${T.brandInk}; font-weight: 700; border-bottom-color: ${T.brand}; }
`;
const Count = styled.span`
  font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 50px;
  background: ${(p) => (p.$warn ? T.warnBg : T.tint2)};
  color: ${(p) => (p.$warn ? T.warn : T.brandInk)};
`;

export default function Shell() {
  const location = useLocation();
  const { queue } = useReviewQueue();
  const { data: cfg } = useApplyPilotConfig();
  const by = useMemo(() => splitQueue(queue), [queue]);
  const reviewN = by.ready.length + by.question.length;
  const sentNeeds = by.code.length + by.blocked.length;
  const running = cfg?.status === 'running';
  const onReview = location.pathname.startsWith('/applypilot/review');

  return (
    <>
      <Bar>
        <Inner>
          <Brand><Dot $on={running} aria-hidden="true" />ApplyPilot</Brand>
          <nav aria-label="ApplyPilot" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <Tab to="/applypilot/dashboard">Dashboard</Tab>
            <Tab to="/applypilot/review" className={onReview ? 'active' : undefined}>
              Review {reviewN > 0 && <Count>{reviewN}</Count>}
            </Tab>
            <Tab to="/applypilot/sent">
              Sent {sentNeeds > 0 && <Count $warn aria-label={`${sentNeeds} need you`}>{sentNeeds}</Count>}
            </Tab>
            <Tab to="/applypilot/settings">Settings</Tab>
          </nav>
        </Inner>
      </Bar>
      <Outlet />
    </>
  );
}
