import React, { useState, useEffect, useCallback } from 'react';
import { CONFIG } from '../config';
import type { AuthState, FullProfile } from '../types';
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

/* ──────────────────────────────────────────────
   Step definitions
   ────────────────────────────────────────────── */
type StepMode = 'intro' | 'tooltip' | 'auth' | 'success';
type PanelState = 'default' | 'autofill-ready' | 'autofilled' | 'keywords' | 'tailored' | 'cover-letter' | 'profile-focus' | 'hidden';
type TooltipPos = 'center' | 'near-panel' | 'near-form' | 'near-match' | 'bottom-right' | 'near-submit';

interface Step {
  id: string;
  mode: StepMode;
  panelState: PanelState;
  pos: TooltipPos;
  greeting?: string;
  headline: string;
  body: string;
  btnText: string;
  interactive?: 'autofill' | 'submit';
  scrollTo?: 'top' | 'form' | 'bottom';
}

const STEPS: Step[] = [
  {
    id: 'pin', mode: 'intro', panelState: 'default', pos: 'center',
    greeting: 'Welcome to ProfilleAI!',
    headline: 'Pin the extension for quick access.',
    body: "Click the puzzle icon in your toolbar, then pin ProfilleAI so it's always one click away.",
    btnText: 'Got it!',
  },
  {
    id: 'how-it-works', mode: 'intro', panelState: 'default', pos: 'center',
    greeting: 'How does it work?',
    headline: 'ProfilleAI automatically fills your job applications.',
    body: '__JSX_HOWIT__',
    btnText: 'Start Tutorial',
  },
  {
    id: 'click-autofill', mode: 'tooltip', panelState: 'autofill-ready', pos: 'near-panel',
    headline: '__JSX_AUTOFILL__',
    body: 'Your profile data is pulled from ProfilleAI. The extension detects form fields on Greenhouse, Lever, Workday, LinkedIn and more, then fills them instantly. This feature is free for all users!',
    btnText: '',
    interactive: 'autofill',
    scrollTo: 'top',
  },
  {
    id: 'autofill-done', mode: 'tooltip', panelState: 'autofilled', pos: 'near-form',
    headline: 'Every field filled, plus AI-generated answers to custom questions.',
    body: 'ProfilleAI saves your answers so identical questions in future applications are filled automatically. No retyping.',
    btnText: 'Next',
    scrollTo: 'form',
  },
  {
    id: 'keyword-match', mode: 'tooltip', panelState: 'keywords', pos: 'near-panel',
    headline: '__JSX_KEYWORDS__',
    body: 'Click "Analyze job to see match" and ProfilleAI scans the job description, showing which keywords are in your profile and which are missing. Free for everyone!',
    btnText: 'Next',
    scrollTo: 'top',
  },
  {
    id: 'resume-tailor', mode: 'tooltip', panelState: 'tailored', pos: 'near-panel',
    headline: '__JSX_TAILOR__',
    body: '__JSX_TAILOR_BODY__',
    btnText: 'Next',
    scrollTo: 'top',
  },
  {
    id: 'cover-letter', mode: 'tooltip', panelState: 'cover-letter', pos: 'near-panel',
    headline: '__JSX_COVER__',
    body: '__JSX_COVER_BODY__',
    btnText: 'Next',
    scrollTo: 'top',
  },
  {
    id: 'platforms', mode: 'tooltip', panelState: 'hidden', pos: 'bottom-right',
    headline: '__JSX_PLATFORMS__',
    body: 'For unsupported platforms, open the side panel to copy your profile info directly into any form.',
    btnText: 'Next',
    scrollTo: 'top',
  },
  {
    id: 'profile', mode: 'tooltip', panelState: 'profile-focus', pos: 'near-panel',
    headline: 'Your profile. Click any field to copy it instantly.',
    body: 'Email, phone, location and skills each have a one-click copy button for quick paste into any application.',
    btnText: 'Next',
    scrollTo: 'top',
  },
  {
    id: 'submit', mode: 'tooltip', panelState: 'hidden', pos: 'near-submit',
    headline: '__JSX_SUBMIT__',
    body: 'ProfilleAI tracks all your submitted applications so you never lose track.',
    btnText: '',
    interactive: 'submit',
    scrollTo: 'bottom',
  },
  {
    id: 'done', mode: 'success', panelState: 'hidden', pos: 'center',
    headline: 'Application Submitted!',
    body: "That's how easy it is. ProfilleAI handles the heavy lifting so you can focus on landing interviews.",
    btnText: 'Get Started',
  },
  {
    id: 'get-started', mode: 'auth', panelState: 'hidden', pos: 'center',
    headline: 'Ready to apply smarter?',
    body: 'Sign in or create a free account to unlock ProfilleAI.',
    btnText: '',
  },
];

const TOTAL = STEPS.length;
const hasMinimalProfile = (p: FullProfile | null) => !!(p && p.title?.trim() && p.summary?.trim());

/* ── Form field data for animation ── */
const FORM_FIELDS = [
  { label: 'First Name *', value: 'Alex' },
  { label: 'Last Name *', value: 'Rivera' },
  { label: 'Email *', value: 'alex.rivera@email.com' },
  { label: 'Phone', value: '+1 (555) 012-3456' },
  { label: 'LinkedIn Profile', value: 'linkedin.com/in/alexrivera' },
];
const AI_QUESTION = 'Why are you a good fit for this role?';
const AI_ANSWER = 'I bring 5+ years of frontend engineering experience with a deep focus on React, TypeScript, and scalable UI architecture. At my previous role, I led the migration to a component-driven design system that reduced development time by 40%...';

/* ── Keyword data ── */
const PRESENT_KW = ['react', 'aws', 'api', 'ci/cd', 'ml', 'ai', 'ui', 'frontend', 'backend', 'web', 'cloud', 'infrastructure'];
const MISSING_KW = ['rest', 'git', 'less', 'vite', 'security', 'communication'];

/* ── Tailored results data ── */
const STRONG_MATCHES = ['8+ years development experience', 'React and TypeScript expertise', 'Scalable system design', 'Cross-functional collaboration'];
const GAPS = [
  { name: 'Python programming', severity: 'critical' as const },
  { name: 'Distributed systems design', severity: 'critical' as const },
  { name: 'Service-oriented architecture', severity: 'critical' as const },
  { name: 'ML/NLP model experience', severity: 'important' as const },
  { name: 'Rate limiting systems', severity: 'important' as const },
];
const CHANGES = [
  { tag: 'summary', text: "Added 'distributed systems design' and 'backend platform engineering patterns'" },
  { tag: 'skills', text: 'Added Python, Distributed systems, Backend platform engineering' },
  { tag: 'experience', text: "Added 'service-oriented architecture patterns' exposure" },
  { tag: 'projects', text: "Added 'platform components design patterns' to projects" },
];

/* ── Cover letter data ── */
const CL_TEXT = `Dear Hiring Manager,

I'm excited about the Senior Frontend Engineer role at your company. Your mission to build high-quality user experiences really resonates with me. As a Senior Frontend Engineer with 5+ years of experience, I've spent my career building the exact type of scalable UI systems your team maintains.

I led the migration to a component-driven design system that reduced development time by 40% and improved cross-team collaboration. I've also architected scalable platforms handling complex state management with sub-second response times.`;

/* ──────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────── */
export const Onboarding: React.FC = () => {
  const [step, setStep] = useState(0);
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, token: null, user: null });
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  // Interactive states
  const [filledCount, setFilledCount] = useState(0);
  const [aiProgress, setAiProgress] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  // Auth flow phases
  const [authPhase, setAuthPhase] = useState<'ask' | 'no-profile' | 'form'>('ask');

  useEffect(() => { loadAuth(); }, []);

  const loadAuth = async () => {
    try {
      const d = await chrome.runtime.sendMessage({ type: 'GET_AUTH' });
      if (d?.token && d?.user) {
        setAuth({ isAuthenticated: true, token: d.token, user: d.user });
        const pr = await chrome.runtime.sendMessage({ type: 'GET_PROFILE' });
        const pd = pr?.profile || pr?.data;
        if (pd) setProfile({ ...pd, firstName: d.user.firstName, lastName: d.user.lastName, email: d.user.email });
      }
    } catch (e) { console.error('[ProfilleAI]', e); }
    finally { setLoading(false); }
  };

  const next = () => { if (step < TOTAL - 1) setStep(step + 1); };
  const prev = () => { if (step > 0) setStep(step - 1); };

  const finish = async () => {
    await chrome.storage.local.set({ onboardingComplete: true });
    if (auth.isAuthenticated && !hasMinimalProfile(profile))
      window.open(`${CONFIG.WEB_BASE}/profile/edit?from=extension&setup=true`, '_blank');
    window.close();
  };

  const skip = async () => {
    await chrome.storage.local.set({ onboardingComplete: true });
    window.close();
  };

  const onAuth = async () => { setChecking(true); await loadAuth(); setChecking(false); };

  /* ── Interactive: Autofill animation ── */
  const handleAutofill = useCallback(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setFilledCount(i);
      if (i >= FORM_FIELDS.length) {
        clearInterval(interval);
        setTimeout(() => {
          setAiProgress(1);
          setTimeout(() => {
            setAiProgress(2);
            setTimeout(() => setStep(3), 600);
          }, 2000);
        }, 400);
      }
    }, 350);
  }, []);

  /* ── Interactive: Submit animation ── */
  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    setTimeout(() => setStep(s => s + 1), 800);
  }, []);

  // Scroll control
  const pageRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cur = STEPS[step];
    if (!cur || !pageRef.current) return;
    const el = pageRef.current;
    if (cur.scrollTo === 'top') el.scrollTop = 0;
    else if (cur.scrollTo === 'form') el.scrollTop = 300;
    else if (cur.scrollTo === 'bottom') el.scrollTop = el.scrollHeight;
  }, [step]);

  /* ── Render helpers ── */
  const cur = STEPS[step];
  const isIntro = cur.mode === 'intro';
  const isTooltip = cur.mode === 'tooltip';
  const isAuth = cur.mode === 'auth';
  const isSuccess = cur.mode === 'success';
  const ps = cur.panelState;

  const tooltipSteps = STEPS.filter(s => s.mode === 'tooltip');
  const tooltipIdx = isTooltip ? tooltipSteps.findIndex(s => s.id === cur.id) : -1;

  const formFilled = filledCount >= FORM_FIELDS.length;

  const renderHeadline = (text: string) => {
    switch (text) {
      case '__JSX_AUTOFILL__': return <>Click <span className="accent">Autofill Form</span> to see the extension in action.</>;
      case '__JSX_KEYWORDS__': return <>See your <span className="accent">keyword match</span> score for every job.</>;
      case '__JSX_TAILOR__': return <><span className="pro-badge">PRO</span> <span className="accent">Tailor</span> your resume for every job, with full control.</>;
      case '__JSX_COVER__': return <><span className="pro-badge">PRO</span> Generate a <span className="accent">tailored cover letter</span> in one click.</>;
      case '__JSX_PLATFORMS__': return <>Works with <span className="accent">LinkedIn</span>, <span className="accent">Greenhouse</span>, <span className="accent">Lever</span>, <span className="accent">Workday</span>, and more.</>;
      case '__JSX_SUBMIT__': return <>Click <span className="accent">Submit</span> to finish this job application.</>;
      default: return text;
    }
  };

  const renderBody = (text: string) => {
    if (text === '__JSX_HOWIT__') return (
      <>We'll show you how it works by filling out this <strong>fictional</strong> job application as if you were <span className="accent">Alex Rivera</span>.</>
    );
    if (text === '__JSX_TAILOR_BODY__') return (
      <>Choose your resume tone, section lengths, and emphasis areas. AI rewrites your resume, shows a match score, strong matches, skill gaps, and every change made. Download as PDF or Word.<br/><br/><span className="pro-note">✦ This is a <strong>Pro</strong> feature. Upgrade anytime to unlock unlimited resume tailoring.</span></>
    );
    if (text === '__JSX_COVER_BODY__') return (
      <>Pick your tone (Professional, Conversational, Enthusiastic) and length (Short, Medium, Long). Copy, download, or regenerate instantly.<br/><br/><span className="pro-note">✦ This is a <strong>Pro</strong> feature. Upgrade to generate unlimited cover letters for every application.</span></>
    );
    return text;
  };

  /* ── Illustrations ── */
  const PinIllust = () => (
    <div className="illust">
      <div className="pin-mock">
        <div className="pin-bar"><span className="pin-d r"/><span className="pin-d y"/><span className="pin-d g"/><span className="pin-url">extensions</span></div>
        <div className="pin-body">
          <div className="pin-title">Extensions</div>
          <div className="pin-row highlight"><div className="pin-icon">P</div><span>ProfilleAI</span><span className="pin-pin">📌</span></div>
          <div className="pin-row dim"><div className="pin-icon dim">A</div><span>AdBlock Plus</span></div>
          <div className="pin-manage">Manage Extensions</div>
        </div>
      </div>
    </div>
  );

  const FormIllust = () => (
    <div className="illust">
      <div className="form-mock">
        <div className="form-title">Tell us about yourself</div>
        {['Full Name', 'Email', 'Phone'].map((f, i) => (
          <div key={f} className="form-field"><label>{f}</label>
            <div className={`form-input ${i < 2 ? 'filled' : 'filling'}`}>
              {i === 0 ? 'Alex Rivera' : i === 1 ? 'alex@email.com' : '+1 (555) 0...'}
            </div>
          </div>
        ))}
        <div className="form-field"><label>Location</label><div className="form-input empty" /></div>
        <div className="form-cta">Continue</div>
      </div>
    </div>
  );

  /* ── Copy icon reusable ── */
  const CopyIcon = () => (
    <span className="copy-icon" title="Copy">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    </span>
  );

  if (loading) return <div className="onb-loading"><div className="spinner"/>Loading…</div>;

  /* ──────────────────────────────────────────────
     RENDER
     ────────────────────────────────────────────── */
  // Show the skip button on every step except the final success modal
  // (the success step already has its own "Get Started" CTA).
  const showSkip = !isSuccess;

  return (
    <div className="onb-page">
      {/* ═══════ SKIP TUTORIAL ═══════ */}
      {showSkip && (
        <button
          type="button"
          className="onb-skip-btn"
          onClick={skip}
          aria-label="Skip tutorial"
        >
          Skip tutorial ✕
        </button>
      )}

      {/* ═══════ BACKGROUND ═══════ */}
      <div className="fake-bg" ref={pageRef}>
        {/* Browser bar */}
        <div className="bg-bar">
          <div className="bg-dots"><span/><span/><span/></div>
          <div className="bg-url">greenhouse.io/jobs/senior-frontend-engineer/apply</div>
          <div className="bg-ext-area">
            <div className="bg-ext"/><div className="bg-ext"/>
            <div className="bg-ext active"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5Z" stroke="#fff" strokeWidth="2"/><path d="M2 12l10 5 10-5" stroke="#fff" strokeWidth="2"/></svg></div>
          </div>
        </div>

        <div className="bg-layout">
          {/* ─── Main page content ─── */}
          <div className="bg-main">
            <div className="bg-job-desc">
              <h2 className="bg-job-title">Not a Real Job Application</h2>
              <p className="bg-job-loc">📍 San Francisco, CA</p>
              <p className="bg-demo-note">This is a demo job application to show you how ProfilleAI works!</p>
              <div className="bg-desc-block">
                <h3>What We're Looking For:</h3>
                <ul>
                  <li>Experience with React, TypeScript, and modern frontend frameworks</li>
                  <li>Experience with design systems, component libraries, and CI/CD</li>
                  <li>Strong communication and collaboration skills</li>
                </ul>
              </div>
            </div>

            {/* ─── Application Form ─── */}
            <div className="bg-form-area">
              <h3 className="form-heading">Apply for this job</h3>
              <p className="form-required">* indicates a required field</p>

              {FORM_FIELDS.map((f, i) => (
                <div key={f.label} className={`form-row ${i < filledCount ? 'filled' : ''} ${i === filledCount && filledCount > 0 && !formFilled ? 'filling-now' : ''}`}>
                  <div className="form-label">{f.label}</div>
                  <div className="form-val">{i < filledCount ? f.value : ''}</div>
                  {i < filledCount && <span className="ai-badge">✓ AI</span>}
                </div>
              ))}

              <div className={`form-row tall ${aiProgress >= 2 ? 'filled' : ''} ${aiProgress === 1 ? 'filling-now' : ''}`}>
                <div className="form-label">{AI_QUESTION}</div>
                <div className="form-val ai-val">
                  {aiProgress >= 1 && (
                    <>
                      <span className={`ai-cursor ${aiProgress === 1 ? 'typing' : ''}`}>✦</span>
                      {aiProgress >= 2 && <span className="ai-text">{AI_ANSWER}</span>}
                    </>
                  )}
                </div>
                {aiProgress >= 2 && <span className="ai-badge glow">✦ AI</span>}
              </div>

              <div className="form-submit-area">
                <button
                  className={`form-submit-btn ${submitted ? 'submitted' : ''} ${cur.interactive === 'submit' ? 'pulse' : ''}`}
                  onClick={cur.interactive === 'submit' ? handleSubmit : undefined}
                >
                  {submitted ? '✓ Submitted!' : 'Submit application'}
                </button>
              </div>
            </div>
          </div>

          {/* ═══════ SIDE PANEL (single scroll, matches real extension) ═══════ */}
          {ps !== 'hidden' && (
            <div className="bg-panel">
              <div className="panel-header">
                {/* Mock of the real panel header — keep in sync with
                    components/BrandLogo.tsx or the tour stops matching the
                    thing it's touring. */}
                <svg className="panel-logo" viewBox="0 0 40 40" fill="none">
                  <defs>
                    <linearGradient id="obPanelMark" x1="14" y1="14" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#5A4BB4" />
                      <stop offset="1" stopColor="#241C61" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="26" height="26" rx="6" fill="rgba(255,255,255,0.38)" />
                  <rect x="14" y="14" width="26" height="26" rx="6" fill="url(#obPanelMark)" />
                </svg>
                <span className="panel-name">profille<span style={{ color: '#c4b5fd' }}>ai</span></span>
                <span className="panel-refresh">↻</span>
              </div>

              <div className="panel-scroll">
                {/* ── Profile Section ── */}
                <div className={`p-section p-profile ${ps === 'profile-focus' ? 'highlight' : ''}`}>
                  <div className="p-profile-top">
                    <div className="p-avatar">AR</div>
                    <div className="p-profile-info">
                      <div className="p-name">Alex Rivera</div>
                      <div className="p-title-text">Senior Frontend Engineer</div>
                    </div>
                    <button className="p-view-full">View Full</button>
                  </div>
                  <div className="p-field"><span className="p-field-label">EMAIL</span><span className="p-field-val">alex.rivera@email.com</span><CopyIcon/></div>
                  <div className="p-field"><span className="p-field-label">PHONE</span><span className="p-field-val">+1 (555) 012-3456</span><CopyIcon/></div>
                  <div className="p-field"><span className="p-field-label">LOCATION</span><span className="p-field-val">San Francisco, CA</span><CopyIcon/></div>
                  <div className="p-divider"/>
                  <div className="p-skills-section">
                    <span className="p-skills-label">Skills</span>
                    <div className="p-skills-tags">
                      {['React', 'TypeScript', 'Node.js', 'AWS', 'CI/CD'].map(s => <span key={s} className="p-skill-tag">{s}</span>)}
                    </div>
                  </div>
                </div>

                {/* ── Current Job Section ── */}
                <div className="p-section p-job">
                  <div className="p-job-header">
                    <h4 className="p-section-title">CURRENT JOB</h4>
                    <button className="p-analyze-btn">
                      {ps === 'keywords' || ps === 'tailored' ? 'Re-analyze' : 'Analyze job to see match'}
                    </button>
                  </div>
                  <div className="p-job-title-box">Senior Frontend Engineer</div>

                  {/* Keyword Analysis (visible in keywords & tailored states) */}
                  {(ps === 'keywords' || ps === 'tailored') && (
                    <div className="p-match-analysis">
                      <div className="p-match-ring-wrap">
                        <div className="p-match-ring">
                          <svg viewBox="0 0 80 80">
                            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
                            <circle cx="40" cy="40" r="34" fill="none" stroke="#f59e0b" strokeWidth="5"
                              strokeDasharray={`${0.67 * 213.6} ${213.6}`} strokeLinecap="round"
                              transform="rotate(-90 40 40)" className="match-arc"/>
                          </svg>
                          <div className="p-match-text"><span className="p-match-pct">67%</span><span className="p-match-lbl">MATCH</span></div>
                        </div>
                      </div>
                      <div className="p-match-detail">12 of 18 keywords matched</div>
                      <div className="p-match-emoji">👍 Good</div>

                      <div className="p-kw-block">
                        <div className="p-kw-header green">✓ In Your Profile</div>
                        <div className="p-kw-tags">{PRESENT_KW.map(k => <span key={k} className="p-kw green">{k}</span>)}</div>
                      </div>
                      <div className="p-kw-block">
                        <div className="p-kw-header orange">⚠ Missing Keywords</div>
                        <div className="p-kw-tags">{MISSING_KW.map(k => <span key={k} className="p-kw orange">{k}</span>)}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Quick Actions ── */}
                <div className="p-section p-actions">
                  <h4 className="p-section-title">QUICK ACTIONS</h4>
                  <div className="p-actions-grid">
                    <button className={`p-action autofill ${ps === 'autofill-ready' ? 'pulse-btn' : ''}`}
                      onClick={ps === 'autofill-ready' && cur.interactive === 'autofill' ? handleAutofill : undefined}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4V20H20V13" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 15L20 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 4H20V9" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span>Autofill Form</span>
                    </button>
                    <button className="p-action tailor" disabled>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span>Tailor Profile</span>
                    </button>
                    <button className="p-action cover" disabled>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span>Cover Letter</span>
                    </button>
                  </div>
                </div>

                {/* ── Autofilled success ── */}
                {ps === 'autofilled' && (
                  <div className="p-section p-autofilled">
                    <div className="p-af-icon">✓</div>
                    <div className="p-af-title">Application autofilled!</div>
                    <div className="p-af-sub">All fields filled from your profile. Review and submit when ready.</div>
                  </div>
                )}

                {/* ── Tailored Results ── */}
                {ps === 'tailored' && (
                  <div className="p-section p-tailored">
                    <div className="p-tailored-header"><span>✨ Tailored Resume</span><span className="p-close">✕</span></div>
                    <div className="p-tailored-ring-wrap">
                      <div className="p-tailored-ring">
                        <svg viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
                          <circle cx="40" cy="40" r="34" fill="none" stroke="#22c55e" strokeWidth="5"
                            strokeDasharray={`${0.78 * 213.6} ${213.6}`} strokeLinecap="round"
                            transform="rotate(-90 40 40)"/>
                        </svg>
                        <div className="p-match-text"><span className="p-match-pct green">78%</span><span className="p-match-lbl">MATCH</span></div>
                      </div>
                    </div>
                    <div className="p-tailored-for">👍 Tailored for <span className="accent">Senior Frontend Engineer</span></div>

                    <div className="p-tr-block">
                      <div className="p-tr-title green">✓ Strong Matches</div>
                      <ul className="p-tr-list">{STRONG_MATCHES.map(m => <li key={m}>{m}</li>)}</ul>
                    </div>

                    <div className="p-tr-block">
                      <div className="p-tr-title">📖 Learning Plan ({GAPS.length} gaps)</div>
                      <div className="p-gaps">
                        {GAPS.map(g => (
                          <div key={g.name} className="p-gap-row">
                            <span className={`p-gap-dot ${g.severity}`}/>
                            <span className="p-gap-name">{g.name}</span>
                            <span className="p-gap-bulb">💡</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-tr-block">
                      <div className="p-tr-title">✏️ Changes Made ({CHANGES.length})</div>
                      <div className="p-changes">
                        {CHANGES.map((c, i) => (
                          <div key={i} className="p-change-row">
                            <span className="p-change-tag">{c.tag}</span>
                            <span className="p-change-text">{c.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button className="p-download-btn">📥 Download Tailored Resume</button>
                    <button className="p-copy-btn">📋 Copy Summary</button>
                  </div>
                )}

                {/* ── Autofill Settings (collapsed) ── */}
                <div className="p-section p-settings">
                  <div className="p-settings-row">
                    <span>⚙️ Autofill Settings</span>
                    <span className="p-chevron">▾</span>
                  </div>
                </div>
              </div>

              {/* ── Cover Letter Modal Overlay ── */}
              {ps === 'cover-letter' && (
                <div className="p-cl-overlay">
                  <div className="p-cl-modal">
                    <div className="p-cl-header"><span>✉️ Cover Letter</span><span className="p-close">✕</span></div>
                    <div className="p-cl-job">Senior Frontend Engineer</div>
                    <div className="p-cl-text">{CL_TEXT}</div>
                    <div className="p-cl-actions">
                      <button className="p-cl-btn copy">📋 Copy</button>
                      <button className="p-cl-btn download">📥 Download</button>
                      <button className="p-cl-btn regen">↻ Regenerate</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Footer ── */}
              <div className="panel-footer">
                <span>ProfilleAI v1.0.0</span>
                <span>AI Settings</span>
                <span>Help</span>
                <span>Sign Out</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ OVERLAY ═══════ */}
      {(isIntro || isAuth || isSuccess) && <div className="onb-overlay"/>}

      {/* ═══════ INTRO MODALS ═══════ */}
      {isIntro && (
        <div className="onb-modal">
          <div className="modal-grid">
            <div className="modal-left">
              {cur.greeting && <div className="modal-greeting">{cur.greeting}</div>}
              <h2 className="modal-headline">{renderHeadline(cur.headline)}</h2>
              <p className="modal-body">{renderBody(cur.body)}</p>
            </div>
            <div className="modal-right">
              {step === 0 ? <PinIllust /> : <FormIllust />}
            </div>
            <div className="modal-nav">
              {step > 0 ? <button className="btn btn-ghost" onClick={prev}>Back</button> : <div/>}
              <div className="dots">{STEPS.map((_, i) => <span key={i} className={`dot ${i === step ? 'active' : i < step ? 'done' : ''}`}/>)}</div>
              <button className="btn btn-primary" onClick={next}>{cur.btnText}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TOOLTIP CARDS ═══════ */}
      {isTooltip && (
        <div className={`tooltip-card pos-${cur.pos}`} key={cur.id}>
          <div className="tooltip-counter">({tooltipIdx + 1}/{tooltipSteps.length})</div>
          <h3 className="tooltip-headline">{renderHeadline(cur.headline)}</h3>
          <p className="tooltip-body">{cur.body}</p>
          <div className="tooltip-actions">
            <button className="btn btn-ghost" onClick={prev}>Back</button>
            {cur.btnText && <button className="btn btn-primary" onClick={next}>{cur.btnText}</button>}
          </div>
        </div>
      )}

      {/* ═══════ SUCCESS MODAL ═══════ */}
      {isSuccess && (
        <div className="onb-modal success-modal">
          <div className="success-inner">
            <div className="success-check">✓</div>
            <h2 className="modal-headline">{cur.headline}</h2>
            <p className="modal-body">{cur.body}</p>
            <button className="btn btn-primary btn-lg" onClick={next}>{cur.btnText}</button>
          </div>
        </div>
      )}

      {/* ═══════ AUTH MODAL ═══════ */}
      {isAuth && (
        <div className="onb-modal">
          <div className="auth-inner">
            {!auth.isAuthenticated && authPhase === 'ask' ? (
              <>
                <div className="modal-emoji">👋</div>
                <h2 className="modal-headline">Do you already have a ProfilleAI account?</h2>
                <p className="modal-body">If you've already created your profile on <span className="accent">profilleai.com</span>, just sign in below and your profile data will sync to the extension automatically.</p>
                <div className="auth-choice-btns">
                  <button className="btn btn-primary btn-lg" onClick={() => setAuthPhase('form')}>Yes, let me sign in</button>
                  <button className="btn btn-outline btn-lg" onClick={() => setAuthPhase('no-profile')}>No, I'm new here</button>
                </div>
              </>
            ) : !auth.isAuthenticated && authPhase === 'no-profile' ? (
              <>
                <div className="modal-emoji">🚀</div>
                <h2 className="modal-headline">Create your profile first. It powers everything</h2>
                <p className="modal-body">ProfilleAI uses your profile to <span className="accent">auto-fill applications</span>, <span className="accent">tailor your resume</span>, and <span className="accent">generate cover letters</span>. The more complete your profile, the better results you'll get.</p>
                <div className="no-profile-benefits">
                  <div className="benefit-item"><span className="benefit-icon">✦</span><span>Add your experience, skills &amp; education once</span></div>
                  <div className="benefit-item"><span className="benefit-icon">🔄</span><span>Data syncs instantly to this extension</span></div>
                  <div className="benefit-item"><span className="benefit-icon">⚡</span><span>Apply to jobs in seconds, not minutes</span></div>
                </div>
                <button className="btn btn-primary btn-lg" onClick={() => window.open(`${CONFIG.WEB_BASE}/onboarding?from=extension`, '_blank')}>Create Profile on ProfilleAI</button>
                <div className="auth-or"><span>or</span></div>
                <button className="btn btn-ghost" onClick={() => setAuthPhase('form')}>Sign up directly here instead</button>
              </>
            ) : !auth.isAuthenticated ? (
              <>
                <h2 className="modal-headline">{cur.headline}</h2>
                <p className="modal-body">{cur.body}</p>
                <p className="auth-sync-note">Already signed in on <span className="accent">profilleai.com</span>? Your profile will sync here automatically once you sign in.</p>
                <InlineAuthForm onAuthSuccess={onAuth} />
                <button className="btn btn-ghost auth-back-link" onClick={() => setAuthPhase('ask')}>Back</button>
              </>
            ) : checking ? (
              <div className="modal-checking"><div className="spinner"/>Checking your profile…</div>
            ) : !hasMinimalProfile(profile) ? (
              <>
                <div className="modal-emoji">🚀</div>
                <h2 className="modal-headline">One Last Step</h2>
                <p className="modal-body">Welcome, {auth.user?.firstName}! Set up your profile so ProfilleAI can auto-fill applications for you.</p>
                <button className="btn btn-primary btn-lg" onClick={() => window.open(`${CONFIG.WEB_BASE}/profile/edit?from=extension&setup=true`, '_blank')}>Complete Your Profile</button>
                <button className="btn btn-ghost" onClick={finish}>I'll do this later</button>
              </>
            ) : (
              <>
                <div className="modal-emoji">🎉</div>
                <h2 className="modal-headline">You're All Set!</h2>
                <p className="modal-body">Head to any job posting and click the ProfilleAI icon to start applying smarter.</p>
                <button className="btn btn-primary btn-lg" onClick={finish}>Start Applying</button>
              </>
            )}
            <div className="modal-nav">
              <button className="btn btn-ghost" onClick={prev}>Back</button>
              <div className="dots">{STEPS.map((_, i) => <span key={i} className={`dot ${i === step ? 'active' : i < step ? 'done' : ''}`}/>)}</div>
              {!auth.isAuthenticated && <button className="btn btn-ghost" onClick={skip}>Skip</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
