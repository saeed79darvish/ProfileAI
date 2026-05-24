import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI, resolveImageUrl } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [originalToken, setOriginalToken] = useState(localStorage.getItem('originalToken'));
  const authDebugEnabled =
    window.location.search.includes('authDebug=1') ||
    localStorage.getItem('profileai_auth_debug') === '1';
  const authDebug = (...args) => {
    if (authDebugEnabled) console.log('[AUTH_FLOW][AuthContext]', ...args);
  };

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    authDebug('hydrate start', { hasStoredUser: !!storedUser, hasToken: !!token });
    if (storedUser && token) {
      let parsedUser;
      try {
        parsedUser = JSON.parse(storedUser);
      } catch {
        // Corrupt localStorage entry, clear and treat as logged out
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setToken(null);
        setLoading(false);
        return;
      }
      
      // Validate token with the server before considering user authenticated
      authAPI.getMe().then(res => {
        const freshUser = res.data;
        authDebug('getMe success', {
          role: freshUser?.role,
          emailVerified: freshUser?.emailVerified,
          hasProfile: freshUser?.hasProfile,
          hasRecruiterProfile: freshUser?.hasRecruiterProfile
        });
        if (freshUser.profilePicture) {
          freshUser.profilePicture = resolveImageUrl(freshUser.profilePicture);
        }
        localStorage.setItem('user', JSON.stringify(freshUser));
        setUser(freshUser);
        
        // Broadcast fresh auth to Chrome extension
        window.postMessage({
          type: 'PROFILEAI_AUTH_SUCCESS',
          token,
          user: {
            id: freshUser.id,
            email: freshUser.email,
            firstName: freshUser.firstName,
            lastName: freshUser.lastName,
            role: freshUser.role,
            profilePicture: freshUser.profilePicture
          }
        }, window.location.origin);
      }).catch(() => {
        authDebug('getMe failed, clearing auth');
        // Token is expired/revoked, clear auth state
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }).finally(() => {
        setLoading(false);
      });
    } else {
      authDebug('hydrate skipped (missing token or user)');
      setLoading(false);
    }
  }, [token]);

  // Listen for late-arriving auth from the Chrome extension content script
  // (e.g. when the page is loaded inside an iframe overlay on a third-party
  // site, the iframe's localStorage is partitioned/empty until the content
  // script injects the token + posts PROFILEAI_AUTH_SUCCESS).
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type !== 'PROFILEAI_AUTH_SUCCESS') return;
      const { token: newToken, user: newUser } = event.data;
      if (!newToken || !newUser) return;
      // Ignore if we already have this token
      if (newToken === token && user) return;
      try { localStorage.setItem('token', newToken); } catch { /* ignore */ }
      try { localStorage.setItem('user', JSON.stringify(newUser)); } catch { /* ignore */ }
      setToken(newToken);
      setUser(newUser);
      setLoading(false);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [token, user]);

  // Keep in-memory auth state in sync when the API interceptor force-logs out.
  useEffect(() => {
    const handleSessionExpired = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('originalToken');
      setOriginalToken(null);
      setToken(null);
      setUser(null);
      setLoading(false);
    };

    window.addEventListener('profileai:session-expired', handleSessionExpired);
    return () => window.removeEventListener('profileai:session-expired', handleSessionExpired);
  }, []);

  const login = async (credentials) => {
    const response = await authAPI.login(credentials);
    const { token, user } = response.data;
    
    // Resolve profile picture URL
    if (user.profilePicture) {
      user.profilePicture = resolveImageUrl(user.profilePicture);
    }
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Clear any impersonation state on fresh login
    localStorage.removeItem('originalToken');
    setOriginalToken(null);
    setToken(token);
    setUser(user);
    
    // Broadcast auth to Chrome extension (content script listens for this)
    window.postMessage({
      type: 'PROFILEAI_AUTH_SUCCESS',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profilePicture: user.profilePicture
      }
    }, window.location.origin);
    
    return response.data;
  };

  const register = async (userData) => {
    const response = await authAPI.register(userData);
    const { token, user } = response.data;
    
    // Resolve profile picture URL
    if (user.profilePicture) {
      user.profilePicture = resolveImageUrl(user.profilePicture);
    }
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
    
    // Broadcast auth to Chrome extension
    window.postMessage({
      type: 'PROFILEAI_AUTH_SUCCESS',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profilePicture: user.profilePicture
      }
    }, window.location.origin);
    
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('originalToken');

    // Clear user-scoped draft and preference data so a subsequent user on
    // the same machine cannot see the previous account's in-progress work.
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key.startsWith('profileai_draft_') ||
          key === 'profileai_job_preferences' ||
          key === 'profileai_recent_searches' ||
          key === 'profileai_seen_onboarding'
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => {
        try { localStorage.removeItem(k); } catch { /* ignore */ }
      });
    } catch {
      // ignore localStorage iteration errors (e.g., private mode)
    }

    setOriginalToken(null);
    setToken(null);
    setUser(null);

    // Broadcast logout to Chrome extension
    window.postMessage({ type: 'PROFILEAI_AUTH_LOGOUT' }, window.location.origin);
  };

  // Impersonate a candidate (recruiter only)
  const impersonate = async (candidateId) => {
    const response = await authAPI.impersonate(candidateId);
    const { token: newToken, user: impersonatedUser, originalToken: origToken } = response.data;
    
    // Resolve profile picture URL
    if (impersonatedUser.profilePicture) {
      impersonatedUser.profilePicture = resolveImageUrl(impersonatedUser.profilePicture);
    }
    
    // Save original token for switching back
    localStorage.setItem('originalToken', origToken);
    setOriginalToken(origToken);
    
    // Set new session
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(impersonatedUser));
    setToken(newToken);
    setUser(impersonatedUser);
    
    return response.data;
  };

  // Exit impersonation and return to original recruiter session
  const exitImpersonation = async () => {
    const origToken = localStorage.getItem('originalToken');
    if (!origToken) {
      throw new Error('No original session to return to');
    }
    
    // Restore original token
    localStorage.setItem('token', origToken);
    localStorage.removeItem('originalToken');
    setOriginalToken(null);
    setToken(origToken);
    
    // Fetch original user data
    const response = await authAPI.getMe();
    const originalUser = response.data;
    
    if (originalUser.profilePicture) {
      originalUser.profilePicture = resolveImageUrl(originalUser.profilePicture);
    }
    
    localStorage.setItem('user', JSON.stringify(originalUser));
    setUser(originalUser);
    
    return originalUser;
  };

  // Update user data (e.g., after profile picture change)
  const updateUser = (updatedUserData) => {
    const newUser = { ...user, ...updatedUserData };
    localStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);
  };

  // Refresh user data from server
  const refreshUser = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      const updatedUser = response.data;
      
      // Resolve profile picture URL
      if (updatedUser.profilePicture) {
        updatedUser.profilePicture = resolveImageUrl(updatedUser.profilePicture);
      }
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      return null;
    }
  }, []);

  const value = {
    user,
    token,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
    impersonate,
    exitImpersonation,
    setUser,
    setToken,
    isAuthenticated: !!token,
    isImpersonating: !!originalToken || user?.isImpersonation,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
