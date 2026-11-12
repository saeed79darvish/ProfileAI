import React, { useState, useEffect } from 'react';
import { CONFIG } from '../config';
import { BrandLogo } from '../components/BrandLogo';
import type { FullProfile } from '../types';
import './onboarding.css';

/* ──────────────────────────────────────────────
   Inline Auth Form
   ────────────────────────────────────────────── */
interface InlineAuthProps { onAuthSuccess: () => void }
const InlineAuthForm: React.FC<InlineAuthProps> = ({ onAuthSuccess }) => {
  const [tab, setTab] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSubmitting(true);
    try {
      if (tab === 'signin') {
        if (!email || !password) { setError('Please fill in all fields'); setSubmitting(false); return; }
        const r = await chrome.runtime.sendMessage({ type: 'LOGIN_WITH_CREDENTIALS', data: { email, password } });
        r?.success ? onAuthSuccess() : setError(r?.error || 'Invalid credentials');
      } else {
        if (!email || !password || !firstName || !lastName) { setError('Please fill in all fields'); setSubmitting(false); return; }
        const r = await chrome.runtime.sendMessage({ type: 'REGISTER', data: { email, password, firstName, lastName, role: 'candidate' } });
        r?.success ? onAuthSuccess() : setError(r?.error || 'Registration failed');
      }
    } catch { setError('Connection failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="inline-auth">
      <div className="auth-tabs">
        <button type="button" className={`auth-tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => { setTab('signin'); setError(null); }}>Sign In</button>
        <button type="button" className={`auth-tab ${tab === 'create' ? 'active' : ''}`} onClick={() => { setTab('create'); setError(null); }}>Create Account</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {tab === 'create' && (
          <div className="auth-name-row">
            <div className="auth-field"><label>First Name</label><input type="text" placeholder="John" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
            <div className="auth-field"><label>Last Name</label><input type="text" placeholder="Doe" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
          </div>
        )}
        <div className="auth-field"><label>Email</label><input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="auth-field">
          <label>Password</label>
          <div className="auth-pw-wrap">
            <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}>{showPw ? '🙈' : '👁️'}</button>
          </div>
        </div>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
          {submitting ? 'Please wait…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
      {tab === 'create' && <p className="auth-hint">8+ chars, uppercase, lowercase, number &amp; special character</p>}
    </div>
  );
};

const hasMinimalProfile = (p: FullProfile | null) => !!(p && (p.title?.trim() || p.summary?.trim()));
const PROFILE_URL = `${CONFIG.WEB_BASE}/profile/create?from=extension`;
const JOBS_URL = `${CONFIG.WEB_BASE}/jobs`;

/**
 * First run: welcome, then the account. The tour itself runs inside the real side
 * panel (sidepanel/components/PanelTour.tsx) the first time it is opened on a job
 * page. This page only gets the person ready for it: signed in with a profile, or
 * told plainly that they need one, and then sent to a job.
 */
export const Onboarding: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [form, setForm] = useState(false);

  const loadAuth = async () => {
    try {
      const d = await chrome.runtime.sendMessage({ type: 'GET_AUTH' });
      if (d?.token && d?.user) {
        setSignedIn(true);
        const pr = await chrome.runtime.sendMessage({ type: 'GET_PROFILE' });
        const pd = pr?.profile || pr?.data;
        setProfile(pd ? { ...pd, firstName: d.user.firstName, lastName: d.user.lastName, email: d.user.email } : null);
      } else {
        setSignedIn(false);
      }
    } catch (e) { console.error('[ProfilleAI]', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAuth(); }, []);
  // The profile is built in another tab: pick the result up when the person comes back.
  useEffect(() => {
    const back = () => { if (document.visibilityState === 'visible') loadAuth(); };
    window.addEventListener('focus', back);
    document.addEventListener('visibilitychange', back);
    return () => { window.removeEventListener('focus', back); document.removeEventListener('visibilitychange', back); };
  }, []);

  const ready = signedIn && hasMinimalProfile(profile);
  const findJob = async () => {
    await chrome.storage.local.set({ onboardingComplete: true }).catch(() => {});
    window.location.href = JOBS_URL;
  };

  if (loading) return <div className="onb-loading"><div className="spinner" />Loading…</div>;

  return (
    <div className="welcome-page">
      <div className="welcome-card">
        <div className="brand-row"><BrandLogo iconSize={28} fontSize={20} /></div>

        {ready ? (
          <>
            <h1>Welcome{profile?.firstName ? `, ${profile.firstName}` : ''}. You are all set.</h1>
            <p className="lead">Your profile is ready. Next, open any job and click Apply. ProfilleAI shows you around right in its panel: how to analyze the job, fill the application, and tailor your resume.</p>
            <div className="ready-note">Profile ready</div>
            <div className="choices"><button className="btn btn-primary btn-lg" onClick={findJob}>Find a job</button></div>
          </>
        ) : form ? (
          <>
            <h1>Sign in</h1>
            <p className="lead">Your profile syncs to the extension as soon as you are in.</p>
            <InlineAuthForm onAuthSuccess={loadAuth} />
            <button className="btn btn-ghost skip-link" onClick={() => setForm(false)}>Back</button>
          </>
        ) : (
          <>
            <h1>Welcome to ProfilleAI. Let's set up your profile first.</h1>
            <p className="lead">ProfilleAI fills your applications, scores your fit and tailors your resume from your profile, so start there. It takes about two minutes, and everything you add syncs to this extension.</p>
            <div className="choices">
              <button className="btn btn-primary btn-lg" onClick={() => window.open(PROFILE_URL, '_blank')}>Create my free profile</button>
              <button className="btn btn-outline btn-lg" onClick={() => setForm(true)}>I already have an account</button>
            </div>
            <button className="btn btn-ghost skip-link" onClick={findJob}>Skip for now, find a job</button>
          </>
        )}

        <div className="pin-tip">
          <span aria-hidden="true">📌</span>
          <span><strong>Pin ProfilleAI.</strong> Click the puzzle icon in your toolbar, then the pin next to ProfilleAI, so it is one click away.</span>
        </div>
      </div>
    </div>
  );
};
