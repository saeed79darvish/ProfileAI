import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import styled, { createGlobalStyle } from 'styled-components';
import BrandWordmark from './BrandWordmark';
import {
  ExitToApp as LogoutIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Dashboard as DashboardIcon,
  Work as WorkIcon,
  Group as GroupIcon,
  Settings as SettingsIcon,
  Business as CompanyIcon,
  Star as UpgradeIcon,
  SmartToy as AgentIcon,
  EventAvailable as InterviewIcon,
  CalendarMonth as CalendarIcon,
  Rocket as RocketIcon,
  Paid as PricingIcon,
  Extension as ExtensionIcon,
  AdminPanelSettings as AdminIcon,
  LocalOffer as PromoIcon,
} from '@mui/icons-material';
import { Badge } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { messageAPI, notificationAPI } from '../services/api';
import { featureFlags } from '../config/featureFlags';
import { BP, media } from '../styles/breakpoints';
import { shouldBlockNavigation, notifyOnboardingBlocked } from '../utils/onboardingGate';

/* ------------------------------------------------------------------ */
/* Styled primitives                                                   */
/* ------------------------------------------------------------------ */

const Nav = styled.nav`
  background: ${p => (p.$transparent ? 'transparent' : '#1a1a2e')};
  box-shadow: ${p => (p.$transparent ? 'none' : '0 2px 12px rgba(0, 0, 0, 0.15)')};
  position: ${p => (p.$transparent ? 'absolute' : 'sticky')};
  top: 0;
  z-index: 1000;
  width: 100%;
  max-width: 100vw;
  border-bottom: ${p => (p.$transparent ? 'none' : '1px solid rgba(255,255,255,0.06)')};
  transition: background 0.3s ease, box-shadow 0.3s ease, border-bottom 0.3s ease;

  ${p => p.$scrolled && p.$isHome && `
    position: fixed;
    background: rgba(26, 26, 46, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(102, 126, 234, 0.1);
  `}
`;

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  width: 100%;
  box-sizing: border-box;

  ${media.ultrawide} { max-width: 1600px; }
  ${media.tabletDown} { padding: 0 16px; }
  ${media.mobile} { padding: 0 12px; }
`;

const NavContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 70px;
  width: 100%;
  min-width: 0;
  gap: 16px;

  ${media.tabletDown} { height: 64px; gap: 12px; }
  ${media.mobile} { height: 56px; gap: 8px; }
`;

const Logo = styled.button`
  background: none;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
`;

const LogoText = styled.span`
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
  color: #ffffff;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  ${media.tabletDown} { font-size: 24px; }
  ${media.mobile} { font-size: 22px; }
`;

const LogoAccent = styled.span`
  color: #c4b5fd;
`;

/* The single nav row that holds primary items + actions + user menu.
   On tablet (640–1023px) we keep it visible but collapse to icon-only.
   The hamburger only replaces it below 640px (mobile). */
const NavRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  justify-content: flex-end;

  ${media.tablet} { gap: 2px; }
  ${media.mobile} { display: none; }
`;

const NavItem = styled.button`
  background: ${p => (p.$active ? 'rgba(167, 139, 250, 0.2)' : 'transparent')};
  border: none;
  outline: none;
  color: ${p => (p.$active ? '#c4b5fd' : '#cbd5e1')};
  font-size: 14px;
  font-weight: ${p => (p.$active ? 600 : 500)};
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s, color 0.2s;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  position: relative;
  min-height: 36px;

  &:hover { background: rgba(167, 139, 250, 0.15); color: #c4b5fd; }
  &:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }

  /* Tablet: keep labels visible but tighten spacing to fit. */
  ${media.tablet} {
    padding: 8px 10px;
    font-size: 13px;
  }
`;

const IconBtn = styled.button`
  background: none;
  border: none;
  color: #94a3b8;
  padding: 8px;
  min-width: 40px;
  min-height: 40px;
  cursor: pointer;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;

  &:hover { background: rgba(167, 139, 250, 0.1); color: #a78bfa; }
  &:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
  svg { font-size: 22px; }
`;

const Divider = styled.div.attrs({ 'aria-hidden': 'true' })`
  width: 1px;
  height: 24px;
  background: #334155;
  margin: 0 6px;
  flex-shrink: 0;
`;

const Hamburger = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px;
  color: #a78bfa;
  border-radius: 8px;
  min-width: 44px;
  min-height: 44px;
  display: none;
  align-items: center;
  justify-content: center;

  svg { font-size: 28px; }
  &:hover { background: rgba(167, 139, 250, 0.1); }
  &:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }

  ${media.mobile} { display: inline-flex; }
`;

/* Mobile-only quick-action row shown between the logo and hamburger.
   Priorities on mobile (per real-estate order of importance):
     1. Upgrade pill  — clearest revenue path for free users
     2. Profile avatar — one-tap access to the user's own profile
   The notifications bell lives inside the drawer to keep the header calm. */
const MobileQuickActions = styled.div`
  display: none;
  align-items: center;
  gap: 8px;
  margin-left: auto;

  ${media.mobile} { display: inline-flex; }
`;

const MobileUpgradePill = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  line-height: 1;
  transition: transform 0.15s ease, filter 0.15s ease;

  &:hover { filter: brightness(1.08); transform: translateY(-1px); }
  &:active { transform: translateY(0); filter: brightness(0.95); }
  &:focus-visible { outline: 2px solid #c4b5fd; outline-offset: 2px; }

  svg { font-size: 14px; }
`;

const MobileAvatarButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  padding: 0;
  border: 1px solid rgba(167, 139, 250, 0.35);
  background: rgba(30, 41, 59, 0.6);
  color: #cbd5e1;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
  transition: border-color 0.15s ease, transform 0.15s ease;

  &:hover { border-color: #a78bfa; }
  &:active { transform: scale(0.96); }
  &:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  svg { font-size: 20px; }
`;

/* User pill */
const UserPill = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  color: inherit;

  &:hover { background: rgba(167, 139, 250, 0.1); }
  &:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
`;

const Avatar = styled.span`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
  img { width: 100%; height: 100%; object-fit: cover; }
  svg { font-size: 20px; }
`;

const UserMeta = styled.span`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
  ${media.tabletDown} { display: none; }
`;

const UserName = styled.span`
  color: #f1f5f9;
  font-size: 14px;
  font-weight: 500;
`;

const UserRole = styled.span`
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
`;

const PlanBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-left: 6px;
  background: ${p => (p.$tier === 'pro'
    ? 'linear-gradient(135deg, rgba(167,139,250,0.3) 0%, rgba(124,58,237,0.3) 100%)'
    : p.$tier === 'enterprise'
    ? 'linear-gradient(135deg, rgba(124,94,207,0.3) 0%, rgba(147,51,234,0.3) 100%)'
    : 'rgba(100, 116, 139, 0.2)')};
  color: ${p => (p.$tier === 'pro' ? '#a78bfa' : p.$tier === 'enterprise' ? '#7c5ecf' : '#94a3b8')};
`;

/* Dropdowns */
const DropdownWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
  background: #1e293b;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
  border: 1px solid #334155;
  padding: 8px;
  z-index: 1100;
  opacity: ${p => (p.$open ? 1 : 0)};
  visibility: ${p => (p.$open ? 'visible' : 'hidden')};
  transform: ${p => (p.$open ? 'translateY(0)' : 'translateY(-6px)')};
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
`;

const DropdownItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: ${p => (p.$danger ? '#ef4444' : '#e2e8f0')};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
  text-align: left;

  svg { font-size: 18px; color: ${p => (p.$danger ? '#ef4444' : '#94a3b8')}; }

  &:hover {
    background: ${p => (p.$danger ? 'rgba(239,68,68,0.1)' : 'rgba(167,139,250,0.1)')};
    color: ${p => (p.$danger ? '#ef4444' : '#a78bfa')};
    svg { color: ${p => (p.$danger ? '#ef4444' : '#a78bfa')}; }
  }
  &:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
`;

const DropdownDivider = styled.div.attrs({ role: 'separator', 'aria-hidden': 'true' })`
  height: 1px;
  background: #334155;
  margin: 6px 0;
`;

/* Notification panel (anchored under bell) */
const NotifPanel = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  max-height: 400px;
  background: #1e1e2e;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  overflow: hidden;
  z-index: 1100;
  border: 1px solid #333;
`;

/* ------------------------------------------------------------------ */
/* Mobile drawer (rendered via portal)                                 */
/* ------------------------------------------------------------------ */

const ScrollLock = createGlobalStyle`
  body.nav-drawer-open { overflow: hidden; }
`;

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 17, 26, 0.72);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 1200;
  animation: navScrimIn 0.18s ease-out;
  @keyframes navScrimIn { from { opacity: 0; } to { opacity: 1; } }
`;

const Panel = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(360px, 88vw);
  background: #1a1a2e; /* solid, opaque */
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.45);
  z-index: 1201;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
  animation: navPanelIn 0.22s ease-out;
  @keyframes navPanelIn {
    from { transform: translateX(20px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
`;

const PanelTitle = styled.h2`
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  margin: 0;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  color: #fff;
  padding: 8px;
  cursor: pointer;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  &:hover { background: rgba(255,255,255,0.1); }
  &:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
`;

const DrawerItem = styled.button`
  background: ${p => (p.$active ? 'rgba(167,139,250,0.18)' : 'transparent')};
  border: none;
  color: ${p => (p.$danger ? '#ef4444' : '#fff')};
  font-size: 16px;
  font-weight: 500;
  padding: 14px 16px;
  cursor: pointer;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  width: 100%;
  margin-bottom: 4px;
  min-height: 48px;

  svg { font-size: 22px; color: ${p => (p.$danger ? '#ef4444' : '#cbd5e1')}; }

  &:hover { background: ${p => (p.$danger ? 'rgba(239,68,68,0.12)' : 'rgba(167,139,250,0.12)')}; }
  &:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
`;

const DrawerSeparator = styled.div.attrs({ 'aria-hidden': 'true' })`
  height: 1px;
  background: rgba(255,255,255,0.08);
  margin: 10px 4px;
`;

/* ------------------------------------------------------------------ */
/* NAV_ITEMS — single source of truth                                  */
/* ------------------------------------------------------------------ */

const RECRUITER_ITEMS = [
  { label: 'Dashboard',   path: '/recruiter/dashboard',  Icon: DashboardIcon },
  { label: 'Jobs',        path: '/recruiter/jobs',       Icon: WorkIcon },
  { label: 'AI Results',  path: '/recruiter/interviews', Icon: InterviewIcon },
  { label: 'Calendar',    path: '/recruiter/calendar',   Icon: CalendarIcon },
  { label: 'Candidates',  path: '/browse',               Icon: GroupIcon },
  { label: 'Agent Arena', path: '/agent-arena',          Icon: AgentIcon },
];

const ADMIN_ITEMS = [
  { label: 'Admin',  path: '/admin',        Icon: AdminIcon },
  { label: 'Users',  path: '/admin/users',  Icon: GroupIcon },
  { label: 'Promos', path: '/admin/promos', Icon: PromoIcon },
];

const CANDIDATE_ITEMS = [
  { label: 'My Jobs',    path: '/jobs',       Icon: WorkIcon },
  { label: 'ApplyPilot', path: '/applypilot', Icon: RocketIcon },
  { label: 'Extension',  path: '/extension',  Icon: ExtensionIcon },
  { label: 'Profile',    path: '/profile',    Icon: PersonIcon },
];

const PUBLIC_ITEMS = [
  { label: 'Pricing',    path: '/pricing',    Icon: PricingIcon },
  // ApplyPilot link intentionally omitted from the public navbar while
  // the feature is gated to admins + tester allowlist. The /applypilot
  // marketing landing is still reachable via direct URL — just not
  // advertised to logged-out visitors. Add this entry back when
  // ENABLE_APPLYPILOT goes live for general candidates.
  // { label: 'ApplyPilot', path: '/applypilot', Icon: RocketIcon },
  { label: 'Extension',  path: '/extension',  Icon: ExtensionIcon },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout, user } = useAuth();
  const authDebugEnabled =
    window.location.search.includes('authDebug=1') ||
    localStorage.getItem('profileai_auth_debug') === '1';
  const authDebug = (...args) => {
    if (authDebugEnabled) console.log('[AUTH_FLOW][Navbar]', ...args);
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationPreview, setNotificationPreview] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const drawerPanelRef = useRef(null);
  const hamburgerRef = useRef(null);

  // Recruiter nav surface is hidden entirely during candidate-only launch.
  // Admins still see the admin items below (handled separately).
  const isRecruiter = featureFlags.recruiterSurface && isAuthenticated && (user?.role === 'recruiter' || user?.role === 'admin');
  const isAdmin = isAuthenticated && user?.role === 'admin';
  const isHome = location.pathname === '/';
  const isTransparent = isHome && !scrolled && !isAuthenticated;
  const candidateProfilePath = user?.role === 'candidate' && user?.hasProfile !== true
    ? '/onboarding'
    : '/profile';

  useEffect(() => {
    authDebug('profile path resolved', {
      role: user?.role,
      hasProfile: user?.hasProfile,
      candidateProfilePath,
      currentPath: location.pathname
    });
  }, [user?.role, user?.hasProfile, candidateProfilePath, location.pathname]);

  const navItems = useMemo(() => {
    if (!isAuthenticated) return PUBLIC_ITEMS;
    if (isRecruiter) return isAdmin ? [...ADMIN_ITEMS, ...RECRUITER_ITEMS] : RECRUITER_ITEMS;
    // ApplyPilot is behind ENABLE_APPLYPILOT / per-user allowlist (see
    // backend/config/featureFlags.js). The backend /auth/me response
    // returns canUseApplyPilot=true for admins, allowlisted emails,
    // and everyone when the global flag is on. Hide the navbar link
    // when the user can't access it so it doesn't lead to a dead 404.
    const candidateItems = CANDIDATE_ITEMS
      .filter((item) => item.path !== '/applypilot' || user?.canUseApplyPilot)
      .map((item) =>
        item.path === '/profile' ? { ...item, path: candidateProfilePath } : item
      );
    // Admins without the recruiter surface flag still need access to admin pages.
    return isAdmin ? [...ADMIN_ITEMS, ...candidateItems] : candidateItems;
  }, [isAuthenticated, isRecruiter, isAdmin, candidateProfilePath, user?.canUseApplyPilot]);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const go = (path) => {
    authDebug('navigate', {
      to: path,
      from: location.pathname,
      role: user?.role,
      hasProfile: user?.hasProfile
    });
    // Candidate without a finished profile is locked into the onboarding
    // flow — surface a banner and bounce them back to /profile/create
    // instead of letting them open random pages.
    if (shouldBlockNavigation(user, path)) {
      notifyOnboardingBlocked(path);
      setDrawerOpen(false);
      setUserMenuOpen(false);
      setNotifOpen(false);
      if (location.pathname !== '/profile/create') {
        navigate('/profile/create');
      }
      return;
    }
    navigate(path);
    setDrawerOpen(false);
    setUserMenuOpen(false);
    setNotifOpen(false);
  };

  const handleLogout = () => {
    logout();
    setDrawerOpen(false);
    setUserMenuOpen(false);
    navigate('/login');
  };

  /* --- Scroll detection on home --- */
  useEffect(() => {
    if (!isHome) { setScrolled(false); return; }
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  /* --- Close popovers when clicking outside --- */
  useEffect(() => {
    const onDown = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  /* --- Close popovers on route change --- */
  useEffect(() => {
    setUserMenuOpen(false);
    setNotifOpen(false);
    setDrawerOpen(false);
  }, [location.pathname]);

  /* --- Unread message + notification polling (visibility-aware) --- */
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const tick = async () => {
      try {
        const res = await notificationAPI.getUnreadCount();
        setUnreadNotifications(res.data.unreadCount || 0);
      } catch { /* silent */ }
      try { await messageAPI.getUnreadCount(); } catch { /* silent */ }
    };
    tick();
    let id = null;
    const start = () => { if (!id) id = setInterval(tick, 30000); };
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) start();
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [isAuthenticated]);

  const openNotifications = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      try {
        const res = await notificationAPI.getPreview(5);
        setNotificationPreview(res.data.notifications || []);
      } catch { /* silent */ }
    }
  };

  /* --- Drawer: focus trap, Esc to close, body scroll lock, restore focus --- */
  useEffect(() => {
    if (!drawerOpen) return undefined;
    document.body.classList.add('nav-drawer-open');
    const previouslyFocused = document.activeElement;

    const focusFirst = () => {
      const root = drawerPanelRef.current;
      if (!root) return;
      const first = root.querySelector(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (first) first.focus();
    };
    const t = setTimeout(focusFirst, 0);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const root = drawerPanelRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('nav-drawer-open');
      if (hamburgerRef.current && typeof hamburgerRef.current.focus === 'function') {
        hamburgerRef.current.focus();
      } else if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [drawerOpen]);

  /* ---------------- Renders ---------------- */

  const renderUserMeta = () => {
    const role = isAdmin ? 'Admin' : isRecruiter ? 'Recruiter' : (user?.headline || 'Candidate');
    const tier = user?.subscriptionTier || 'free';
    const tierLabel = tier === 'pro' ? '⭐ Pro' : tier === 'enterprise' ? '👑 Enterprise' : 'Free';
    return (
      <UserMeta>
        <UserName>{user?.firstName} {user?.lastName}</UserName>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <UserRole>{role}</UserRole>
          <PlanBadge $tier={tier}>{tierLabel}</PlanBadge>
        </span>
      </UserMeta>
    );
  };

  const renderUserMenu = () => (
    <DropdownWrap ref={userMenuRef}>
      <UserPill
        type="button"
        onClick={() => setUserMenuOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={userMenuOpen}
        aria-label="Account menu"
      >
        <Avatar>
          {user?.profilePicture ? (
            <img src={user.profilePicture} alt="" />
          ) : (
            <PersonIcon />
          )}
        </Avatar>
        {renderUserMeta()}
        <ArrowDownIcon
          aria-hidden="true"
          style={{
            color: '#64748b',
            fontSize: 18,
            transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
          }}
        />
      </UserPill>
      <DropdownMenu role="menu" $open={userMenuOpen} aria-label="Account">
        {isRecruiter ? (
          <>
            <DropdownItem role="menuitem" onClick={() => go('/recruiter/profile')}>
              <CompanyIcon /> My Company
            </DropdownItem>
            <DropdownItem role="menuitem" onClick={() => go('/recruiter/dashboard')}>
              <DashboardIcon /> Dashboard
            </DropdownItem>
            <DropdownItem role="menuitem" onClick={() => go('/recruiter/imports')}>
              <GroupIcon /> Import History
            </DropdownItem>
            <DropdownItem role="menuitem" onClick={() => go('/pricing')}>
              <UpgradeIcon /> Plans
            </DropdownItem>
          </>
        ) : (
          <>
            <DropdownItem role="menuitem" onClick={() => go(candidateProfilePath)}>
              <PersonIcon /> My Profile
            </DropdownItem>
            <DropdownItem role="menuitem" onClick={() => go('/pricing')}>
              <UpgradeIcon /> Upgrade
            </DropdownItem>
          </>
        )}
        <DropdownDivider />
        <DropdownItem role="menuitem" $danger onClick={handleLogout}>
          <LogoutIcon /> Sign Out
        </DropdownItem>
      </DropdownMenu>
    </DropdownWrap>
  );

  const renderNotifications = () => (
    <DropdownWrap ref={notifRef}>
      <IconBtn
        type="button"
        onClick={openNotifications}
        aria-label={
          unreadNotifications > 0
            ? `Notifications, ${unreadNotifications} unread`
            : 'Notifications'
        }
        aria-haspopup="menu"
        aria-expanded={notifOpen}
      >
        <Badge
          badgeContent={unreadNotifications}
          color="error"
          max={99}
          invisible={unreadNotifications === 0}
        >
          <NotificationsIcon />
        </Badge>
      </IconBtn>
      {notifOpen && (
        <NotifPanel role="menu" aria-label="Notifications">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 600 }}>Notifications</span>
            {unreadNotifications > 0 && (
              <span style={{ color: '#a78bfa', fontSize: 12 }}>{unreadNotifications} new</span>
            )}
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {notificationPreview.length > 0 ? (
              notificationPreview.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => go('/notifications')}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 16px',
                    borderBottom: '1px solid #2a2a3a',
                    cursor: 'pointer',
                    background: n.isRead ? 'transparent' : 'rgba(167,139,250,0.1)',
                    border: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: n.isRead ? 400 : 600 }}>{n.title}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                    {n.message?.substring(0, 60)}{n.message && n.message.length > 60 ? '…' : ''}
                  </div>
                </button>
              ))
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                No new notifications
              </div>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => go('/notifications')}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 16px',
              borderTop: '1px solid #333',
              background: 'transparent',
              border: 'none',
              textAlign: 'center',
              color: '#a78bfa',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            View all notifications
          </button>
        </NotifPanel>
      )}
    </DropdownWrap>
  );

  const renderNavItems = () =>
    navItems.map((item) => {
      const active = isActive(item.path);
      const Icon = item.Icon;
      return (
        <NavItem
          key={item.path}
          type="button"
          $active={active}
          onClick={() => go(item.path)}
          aria-label={item.label}
          aria-current={active ? 'page' : undefined}
          title={item.label}
        >
          <Icon aria-hidden="true" fontSize="small" />
          <span className="label">{item.label}</span>
        </NavItem>
      );
    });

  const renderAuthCTAs = () => (
    <>
      <NavItem type="button" onClick={() => go('/login')} aria-label="Sign In">
        {/* No .label wrapper: keep visible in tablet icon-only mode too. */}
        Sign In
      </NavItem>
      <NavItem
        type="button"
        onClick={() => go('/register')}
        aria-label="Get Started"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 700,
        }}
      >
        Get Started
      </NavItem>
    </>
  );

  const renderDrawer = () => {
    if (!drawerOpen) return null;
    return createPortal(
      <>
        <ScrollLock />
        <Scrim onClick={() => setDrawerOpen(false)} aria-hidden="true" />
        <Panel
          ref={drawerPanelRef}
          id="primary-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Primary navigation"
        >
          <PanelHeader>
            <PanelTitle>Menu</PanelTitle>
            <CloseBtn type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
              <CloseIcon />
            </CloseBtn>
          </PanelHeader>

          {isAuthenticated && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px',
              borderRadius: 10,
              background: 'rgba(167,139,250,0.08)',
              marginBottom: 12,
            }}>
              <Avatar>
                {user?.profilePicture ? <img src={user.profilePicture} alt="" /> : <PersonIcon />}
              </Avatar>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
                  {user?.firstName} {user?.lastName}
                </span>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>
                  {isAdmin ? 'Admin' : isRecruiter ? 'Recruiter' : (user?.headline || 'Candidate')}
                </span>
              </div>
            </div>
          )}

          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.Icon;
            return (
              <DrawerItem
                key={item.path}
                type="button"
                $active={active}
                aria-current={active ? 'page' : undefined}
                onClick={() => go(item.path)}
              >
                <Icon aria-hidden="true" /> {item.label}
              </DrawerItem>
            );
          })}

          {isAuthenticated && (
            <>
              <DrawerSeparator />
              <DrawerItem
                type="button"
                $active={isActive('/notifications')}
                aria-current={isActive('/notifications') ? 'page' : undefined}
                onClick={() => go('/notifications')}
              >
                <NotificationsIcon aria-hidden="true" />
                Notifications
                {unreadNotifications > 0 && (
                  <span style={{ marginLeft: 'auto', color: '#a78bfa', fontSize: 12 }}>
                    {unreadNotifications}
                  </span>
                )}
              </DrawerItem>
              <DrawerItem type="button" onClick={() => go(isRecruiter ? '/recruiter/profile' : candidateProfilePath)}>
                <PersonIcon aria-hidden="true" />
                {isRecruiter ? 'My Company' : 'My Profile'}
              </DrawerItem>
              <DrawerItem
                type="button"
                $active={isActive('/pricing')}
                aria-current={isActive('/pricing') ? 'page' : undefined}
                onClick={() => go('/pricing')}
                style={
                  user?.subscriptionTier !== 'pro' && user?.subscriptionTier !== 'enterprise'
                    ? {
                        background: 'linear-gradient(135deg, rgba(167,139,250,0.15) 0%, rgba(124,58,237,0.15) 100%)',
                        color: '#c4b5fd',
                        fontWeight: 700,
                      }
                    : undefined
                }
              >
                <UpgradeIcon aria-hidden="true" />
                {user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'enterprise'
                  ? 'Plans & Billing'
                  : 'Upgrade to Pro'}
              </DrawerItem>
              <DrawerSeparator />
              <DrawerItem type="button" $danger onClick={handleLogout}>
                <LogoutIcon aria-hidden="true" /> Sign Out
              </DrawerItem>
            </>
          )}

          {!isAuthenticated && (
            <>
              <DrawerSeparator />
              <DrawerItem type="button" onClick={() => go('/login')}>
                <PersonIcon aria-hidden="true" /> Sign In
              </DrawerItem>
              <DrawerItem
                type="button"
                onClick={() => go('/register')}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  fontWeight: 700,
                  justifyContent: 'center',
                }}
              >
                Get Started
              </DrawerItem>
            </>
          )}
        </Panel>
      </>,
      document.body
    );
  };

  return (
    <Nav $transparent={isTransparent} $scrolled={scrolled} $isHome={isHome}>
      <Container>
        <NavContent>
          <Logo
            type="button"
            onClick={() => {
              // Always route through go() so the onboarding gate can
              // intercept candidates without a finished profile and show
              // the "please finish your profile" banner instead of letting
              // the logo silently bounce them to the home/hub.
              go('/');
            }}
            aria-label="profilleai home"
          >
            <LogoText><BrandWordmark /></LogoText>
          </Logo>

          <NavRow role="menubar" aria-label="Primary">
            {renderNavItems()}

            {isAuthenticated && (
              <>
                <Divider />
                {renderNotifications()}
                <Divider />
                {renderUserMenu()}
              </>
            )}

            {!isAuthenticated && renderAuthCTAs()}
          </NavRow>

          {/* Mobile-only quick actions (auth users only). Keeps the two most
              important surfaces one tap away without opening the drawer. */}
          {isAuthenticated && (
            <MobileQuickActions>
              {user?.subscriptionTier !== 'pro' && user?.subscriptionTier !== 'enterprise' && (
                <MobileUpgradePill
                  type="button"
                  onClick={() => go('/pricing')}
                  aria-label="Upgrade your plan"
                >
                  <UpgradeIcon /> Upgrade
                </MobileUpgradePill>
              )}
              <MobileAvatarButton
                type="button"
                onClick={() => go(isRecruiter ? '/recruiter/profile' : candidateProfilePath)}
                aria-label={isRecruiter ? 'My Company' : 'My Profile'}
              >
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt="" />
                ) : (
                  <PersonIcon />
                )}
              </MobileAvatarButton>
            </MobileQuickActions>
          )}

          <Hamburger
            type="button"
            ref={hamburgerRef}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            aria-controls="primary-mobile-menu"
          >
            <MenuIcon />
          </Hamburger>
        </NavContent>
      </Container>

      {renderDrawer()}
    </Nav>
  );
};

export default Navbar;
