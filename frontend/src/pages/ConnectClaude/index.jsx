import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * OAuth consent screen for the Claude Custom Connector.
 *
 * Claude's /oauth/authorize on the backend bounces the browser here with the
 * PKCE + redirect params. Because the app keeps its JWT in localStorage (no
 * server session), consent has to happen in the SPA: we confirm the user is
 * signed in, show what they're granting, and on approval call the backend to
 * mint an auth code, then redirect back to Claude.
 */
export default function ConnectClaude() {
  const [params] = useSearchParams();
  const { isAuthenticated, user, loading } = useAuth();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const oauth = useMemo(() => ({
    client_id: params.get('client_id') || '',
    redirect_uri: params.get('redirect_uri') || '',
    code_challenge: params.get('code_challenge') || '',
    state: params.get('state') || '',
    scope: params.get('scope') || 'mcp',
  }), [params]);

  const validRequest = !!oauth.redirect_uri && !!oauth.code_challenge;

  const denyUrl = () => {
    try {
      const u = new URL(oauth.redirect_uri);
      u.searchParams.set('error', 'access_denied');
      if (oauth.state) u.searchParams.set('state', oauth.state);
      return u.toString();
    } catch {
      return null;
    }
  };

  const approve = async () => {
    setWorking(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/oauth/mcp/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(oauth),
      });
      const data = await res.json();
      if (!res.ok || !data.redirect) {
        throw new Error(data.error_description || data.error || 'Could not authorize the connection.');
      }
      window.location.href = data.redirect;
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
      setWorking(false);
    }
  };

  const deny = () => {
    const url = denyUrl();
    if (url) window.location.href = url;
  };

  const S = styles;

  if (loading) {
    return <div style={S.page}><div style={S.card}><p style={S.muted}>Loading…</p></div></div>;
  }

  if (!validRequest) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.logo}>✦</div>
          <h1 style={S.h1}>Invalid connection request</h1>
          <p style={S.muted}>
            This page opens automatically when you connect ProfilleAI inside Claude.
            Start the connection from Claude&apos;s Connectors settings.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.logo}>✦</div>
          <h1 style={S.h1}>Sign in to connect Claude</h1>
          <p style={S.muted}>
            Sign in to your ProfilleAI account to let Claude access your tailored resumes and interview prep.
          </p>
          <a style={S.primary} href={`/login?redirect=${next}`}>Sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>✦</div>
        <h1 style={S.h1}>Connect ProfilleAI to Claude</h1>
        <p style={S.muted}>
          Signed in as <strong>{user?.email || user?.firstName || 'your account'}</strong>.
          Claude will be able to:
        </p>
        <ul style={S.list}>
          <li style={S.li}><span style={S.check}>✓</span>List your tailored resumes</li>
          <li style={S.li}><span style={S.check}>✓</span>Read the interview questions and skill gaps for a resume</li>
        </ul>
        <p style={S.fine}>
          Claude will not be able to change your account or resumes. You can disconnect anytime from Claude&apos;s Connectors settings.
        </p>
        {error && <div style={S.error}>{error}</div>}
        <div style={S.actions}>
          <button style={S.secondary} onClick={deny} disabled={working}>Cancel</button>
          <button style={{ ...S.primary, ...(working ? S.disabled : {}) }} onClick={approve} disabled={working}>
            {working ? 'Connecting…' : 'Allow'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%)',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    background: '#fff',
    borderRadius: 20,
    padding: '32px 28px',
    boxShadow: '0 12px 40px rgba(79,70,229,0.15)',
    textAlign: 'center',
  },
  logo: {
    width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px',
    background: 'linear-gradient(135deg, #6941C6, #7C5CFC)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
  },
  h1: { fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '0 0 10px' },
  muted: { fontSize: 15, color: '#4b5563', lineHeight: 1.5, margin: '0 0 14px' },
  list: { textAlign: 'left', margin: '0 auto 16px', maxWidth: 340, padding: 0, listStyle: 'none' },
  li: {
    fontSize: 14, color: '#374151', padding: '7px 0', display: 'flex', alignItems: 'flex-start', gap: 8,
  },
  check: { color: '#6941C6', fontWeight: 700, flexShrink: 0 },
  fine: { fontSize: 12.5, color: '#9ca3af', lineHeight: 1.5, margin: '0 0 18px' },
  actions: { display: 'flex', gap: 12, justifyContent: 'center' },
  primary: {
    display: 'inline-block', padding: '12px 28px', borderRadius: 12, border: 'none',
    background: '#6941C6', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    textDecoration: 'none',
  },
  secondary: {
    padding: '12px 24px', borderRadius: 12, border: '1.5px solid #e5e7eb',
    background: '#fff', color: '#374151', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  disabled: { opacity: 0.6, cursor: 'not-allowed' },
  error: {
    background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
    borderRadius: 10, padding: '10px 14px', fontSize: 13.5, margin: '0 0 14px',
  },
};
