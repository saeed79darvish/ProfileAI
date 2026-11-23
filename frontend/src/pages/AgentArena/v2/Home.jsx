/* ApplyPilot v2 · where the navbar button lands.
   Set up (at least one job title saved): Dashboard. Otherwise: Welcome. */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApplyPilotConfig } from '../../../hooks/useApplyPilot';
import { Page, Loading } from './ui';

export function isSetUp(cfg) {
  const titles = cfg?.config?.criteria?.roleTitles;
  return Array.isArray(titles) && titles.some((t) => String(t || '').trim());
}

export default function Home() {
  const { data, loading } = useApplyPilotConfig();
  if (loading) return <Page><Loading /></Page>;
  return <Navigate to={isSetUp(data) ? '/applypilot/dashboard' : '/applypilot/welcome'} replace />;
}
