import React, { useEffect, useState } from 'react';
import { CONFIG } from '../config';
import type { AuthState, FullProfile } from '../types';

export const Popup: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    user: null,
  });
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const authData = await chrome.runtime.sendMessage({ type: 'GET_AUTH' });
      if (authData?.token && authData?.user) {
        setAuthState({
          isAuthenticated: true,
          token: authData.token,
          user: authData.user,
        });
        
        const profileResponse = await chrome.runtime.sendMessage({ type: 'GET_PROFILE' });
        const profileData = profileResponse?.profile || profileResponse?.data;
        if (profileData) {
          setProfile({
            ...profileData,
            firstName: authData.user.firstName,
            lastName: authData.user.lastName,
            email: authData.user.email,
          });
        }
      }
    } catch (error) {
      console.error('[ProfileAI] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId });
    }
  };

  const openDashboard = () => {
    chrome.tabs.create({ url: CONFIG.WEB_BASE });
  };

  const openOnboarding = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });
  };

  const handleLogout = async () => {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    setAuthState({ isAuthenticated: false, token: null, user: null });
    setProfile(null);
  };

  const handleAutofill = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUTOFILL' });
        window.close();
      } catch {
        // Content script not ready, inject and retry
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => { window.dispatchEvent(new CustomEvent('profileai-autofill')); },
        });
        window.close();
      }
    }
  };

  const getInitials = (firstName?: string, lastName?: string): string => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  if (loading) {
    return (
      <div className="popup loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="popup">
      <div className="popup-header">
        <div className="logo">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>ProfilleAI</span>
        </div>
      </div>

      <div className="popup-content">
        {authState.isAuthenticated ? (
          <>
            <div className="user-section">
              <div className="user-avatar">
                <span>{getInitials(profile?.firstName, profile?.lastName)}</span>
              </div>
              <div className="user-info">
                <span className="user-name">
                  {profile?.firstName} {profile?.lastName}
                </span>
                <span className="user-email">{profile?.email}</span>
              </div>
            </div>

            <div className="actions">
              <button className="btn autofill" onClick={handleAutofill}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4V20H20V13" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 15L20 4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15 4H20V9" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Autofill Form
              </button>
              <button className="btn primary" onClick={openSidePanel}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="3" x2="9" y2="21"></line>
                </svg>
                Open Side Panel
              </button>
              <button className="btn secondary" onClick={openDashboard}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                Dashboard
              </button>
            </div>

            <button className="logout-btn" onClick={handleLogout}>
              Sign Out
            </button>
          </>
        ) : (
          <>
            <div className="welcome">
              <h2>Welcome to ProfilleAI</h2>
              <p>Sign in to autofill job applications and track your progress.</p>
            </div>
            <button className="btn primary full" onClick={openOnboarding}>
              Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
};
