import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Container, Grid, Button, Chip,
} from '@mui/material';
import {
  Extension as ExtensionIcon,
  ArrowForward as ArrowIcon,
  Star as StarIcon,
  Check as CheckIcon,
  AutoAwesome as SparkleIcon,
  Bolt as BoltIcon,
  TrendingUp as TrendingIcon,
  Speed as SpeedIcon,
  FormatQuote as QuoteIcon,
  Description as DocIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, GRADIENTS } from '../../designTokens';
import {
  float,
  floatReverse,
  shimmer
} from './styled';
import {
  tokens,
  features,
  testimonials,
  platforms,
  fields,
  missingKeywords,
  strongMatches,
  gaps,
} from './constants';

// ── Reveal on scroll ──
function RevealSection({ children, sx, delay = 0, ...props }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

// ── Gradient text ──
function GradientText({ children, sx }) {
  return (
    <Box
      component="span"
      sx={{
        background: tokens.gradientText,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

// ── Browser mockup wrapper (dark, mimicking the extension) ──
// ── Browser page mockup (light, simulates a job site) ──
function PageMockup({ children, url, sx }) {
  return (
    <Box
      sx={{
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(18,14,32,0.95)',
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        color: '#fff',
        ...sx,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.2,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          bgcolor: 'rgba(255,255,255,0.02)',
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.7 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff5f57' }} />
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#febc2e' }} />
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#28c840' }} />
        </Box>
        {url && (
          <Box sx={{ flex: 1, mx: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '8px', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{url}</Typography>
          </Box>
        )}
      </Box>
      <Box sx={{ p: 3 }}>{children}</Box>
    </Box>
  );
}

// ── Extension panel mockup (dark, simulates the sidebar) ──
function ExtensionMockup({ children, sx }) {
  return (
    <Box
      sx={{
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(18,14,32,0.95)',
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        color: '#fff',
        ...sx,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          bgcolor: 'rgba(255,255,255,0.02)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Box sx={{ width: 20, height: 20, borderRadius: '6px', background: tokens.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ExtensionIcon sx={{ color: '#fff', fontSize: 11 }} />
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>ProfileAI</Typography>
        </Box>
      </Box>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Box>
  );
}

// ═══════════════════════════════════════════
// FEATURE VISUALS
// ═══════════════════════════════════════════

function FeatureVisual({ type }) {
  if (type === 'autofill') return <AutofillVisual />;
  if (type === 'tailor') return <TailorVisual />;
  if (type === 'cover-letter') return <CoverLetterVisual />;
  if (type === 'job-analysis') return <JobAnalysisVisual />;
  if (type === 'tailor-settings') return <TailorSettingsVisual />;
  if (type === 'resume-download') return <ResumeDownloadVisual />;
  return null;
}

// ── 1. Auto-fill visual: light job form + dark extension popup ──

function AutofillVisual() {

  return (
    <Box sx={{ position: 'relative' }}>
      <PageMockup url="careers.vercel.com/jobs/staff-engineer">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, pb: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: 'rgba(102,126,234,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>V</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Software Engineer, Fullstack</Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>San Francisco, California</Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', mb: 2 }}>Apply for this Job</Typography>
        {fields.map((f, i) => (
          <Box key={f.label} sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', mb: 0.3 }}>
              {f.label} <span style={{ color: '#ef4444' }}>*</span>
            </Typography>
            <Box sx={{ height: 32, borderRadius: '6px', bgcolor: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)', display: 'flex', alignItems: 'center', px: 1.5, position: 'relative', overflow: 'hidden' }}>
              <Typography sx={{ fontSize: 12, color: '#a78bfa', fontWeight: 500 }}>{f.value}</Typography>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(102,126,234,0.1) 50%, transparent 100%)', animation: `${shimmer} 2.5s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }} />
            </Box>
          </Box>
        ))}
      </PageMockup>

      {/* Dark extension popup overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: -16,
          bgcolor: 'rgba(18,14,32,0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(102,126,234,0.25)',
          borderRadius: '12px',
          p: 2,
          width: 170,
          boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
          animation: `${float} 5s ease-in-out infinite`,
          color: '#fff',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Box sx={{ width: 22, height: 22, borderRadius: '6px', background: tokens.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ExtensionIcon sx={{ color: '#fff', fontSize: 12 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 11.5, color: '#fff' }}>ApplyPilot</Typography>
        </Box>
        <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', mb: 1, fontWeight: 600, letterSpacing: '0.05em' }}>QUICK ACTIONS</Typography>
        <Box sx={{ display: 'flex', gap: 0.8 }}>
          {[
            { label: 'Autofill', active: true },
            { label: 'Tailor', active: false },
            { label: 'Cover Letter', active: false },
          ].map((a) => (
            <Box key={a.label} sx={{ flex: 1, py: 0.8, borderRadius: '8px', background: a.active ? tokens.gradient : 'rgba(255,255,255,0.05)', border: a.active ? 'none' : '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 8.5, color: a.active ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{a.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// ── 2. Job Analysis visual (dark extension panel) ──
function JobAnalysisVisual() {

  return (
    <Box sx={{ position: 'relative' }}>
      <ExtensionMockup>
        {/* Current job */}
        <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>CURRENT JOB</Typography>
            <Box sx={{ px: 1.5, py: 0.4, borderRadius: '6px', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography sx={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Re-analyze</Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>Frontend Software Engineer, Codex App</Typography>
        </Box>

        {/* Match score circle */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80 }}>
            <Box sx={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.06)' }} />
            <Box sx={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '4px solid #ef4444', borderColor: '#ef4444 transparent transparent transparent', transform: 'rotate(-10deg)' }} />
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 20, fontWeight: 800 }}>9%</Typography>
              <Typography sx={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.1em' }}>MATCH</Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>1 of 11 keywords matched</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', mt: 0.3 }}>⚡ Needs work</Typography>
        </Box>

        {/* In your profile */}
        <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.8 }}>
            <CheckIcon sx={{ fontSize: 14, color: '#10b981' }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700 }}>In Your Profile</Typography>
          </Box>
          <Chip label="ai" size="small" sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 10, height: 24, fontWeight: 600 }} />
        </Box>

        {/* Missing keywords */}
        <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Typography sx={{ fontSize: 14 }}>⚠️</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 700 }}>Missing Keywords</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {missingKeywords.map((kw) => (
              <Chip key={kw} label={kw} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: 9.5, height: 22, fontWeight: 500 }} />
            ))}
          </Box>
        </Box>
      </ExtensionMockup>
    </Box>
  );
}

// ── 3. Tailor Resume visual (dark extension panel with match score) ──
function TailorVisual() {

  return (
    <ExtensionMockup>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <SparkleIcon sx={{ fontSize: 16, color: '#a78bfa' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Tailored Resume</Typography>
      </Box>

      {/* Match score circle */}
      <Box sx={{ textAlign: 'center', mb: 2.5 }}>
        <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 90, height: 90 }}>
          <Box sx={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.06)' }} />
          <Box sx={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '4px solid #10b981', borderColor: '#10b981 #10b981 #10b981 transparent', transform: 'rotate(-30deg)' }} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 22, fontWeight: 800 }}>82%</Typography>
            <Typography sx={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.1em' }}>MATCH</Typography>
          </Box>
        </Box>
      </Box>

      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', mb: 2.5 }}>
        🔥 Tailored for <span style={{ color: '#a78bfa', fontWeight: 600 }}>Frontend Engineer, Codex App</span>
      </Typography>

      {/* Strong matches */}
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
          <CheckIcon sx={{ fontSize: 14, color: '#10b981' }} />
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Strong Matches</Typography>
        </Box>
        {strongMatches.map((m) => (
          <Typography key={m} sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', ml: 2.8, mb: 0.3 }}>• {m}</Typography>
        ))}
      </Box>

      {/* Learning plan */}
      <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1 }}>📖 Learning Plan ({gaps.length} gaps)</Typography>
        {gaps.map((g) => (
          <Box key={g.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.6, py: 0.4, px: 1, borderRadius: '6px', bgcolor: 'rgba(255,255,255,0.02)' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: g.color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', flex: 1 }}>{g.label}</Typography>
          </Box>
        ))}
      </Box>

      <Button fullWidth size="small" sx={{ mt: 2, background: tokens.gradient, color: '#fff', borderRadius: '10px', textTransform: 'none', fontWeight: 700, fontSize: 12, py: 1 }}>
        Download Tailored Resume
      </Button>
    </ExtensionMockup>
  );
}

// ── 4. Tailor Settings visual (light modal over dark bg) ──
function TailorSettingsVisual() {
  return (
    <ExtensionMockup>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(102,126,234,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BoltIcon sx={{ fontSize: 18, color: '#a78bfa' }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Tailor Settings</Typography>
          <Typography sx={{ fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>Frontend Software Engineer, Codex App</Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', mb: 2 }}>Customize how your resume will be tailored for this position.</Typography>

      {/* Resume Tone */}
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff', mb: 1 }}>Resume Tone</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
        {[
          { label: 'Concise', sub: 'Short, ATS-friendly' },
          { label: 'Professional', sub: 'Balanced detail', active: true },
          { label: 'Detailed', sub: 'Rich descriptions' },
        ].map((t) => (
          <Box key={t.label} sx={{ flex: 1, p: 1.2, borderRadius: '10px', bgcolor: t.active ? 'rgba(102,126,234,0.12)' : 'rgba(255,255,255,0.02)', border: `1px solid ${t.active ? 'rgba(102,126,234,0.35)' : 'rgba(255,255,255,0.06)'}`, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: t.active ? '#a78bfa' : 'rgba(255,255,255,0.6)' }}>{t.label}</Typography>
            <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', mt: 0.3 }}>{t.sub}</Typography>
          </Box>
        ))}
      </Box>

      {/* Section Lengths */}
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff', mb: 1.5 }}>Section Lengths</Typography>
      {[
        { label: 'Summary', value: '3 lines', pct: 30 },
        { label: 'Experience (per role)', value: '4 lines', pct: 45 },
        { label: 'Max Skills', value: '12 skills', pct: 55 },
      ].map((s) => (
        <Box key={s.label} sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{s.label}</Typography>
            <Typography sx={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>{s.value}</Typography>
          </Box>
          <Box sx={{ height: 6, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 3, position: 'relative' }}>
            <Box sx={{ height: '100%', width: `${s.pct}%`, background: tokens.gradient, borderRadius: 3 }} />
            <Box sx={{ position: 'absolute', top: -3, left: `${s.pct}%`, transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', bgcolor: tokens.primary, border: '2px solid rgba(18,14,32,0.95)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
          </Box>
        </Box>
      ))}

      {/* Buttons */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5 }}>
        <Button variant="outlined" sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: 12 }}>Cancel</Button>
        <Button variant="contained" sx={{ flex: 1, background: tokens.gradient, color: '#fff', borderRadius: '10px', textTransform: 'none', fontWeight: 700, fontSize: 12, '&:hover': { opacity: 0.9 } }}>Continue to Tailor</Button>
      </Box>
    </ExtensionMockup>
  );
}

// ── 5. Cover letter visual (dark extension panel) ──
function CoverLetterVisual() {
  return (
    <ExtensionMockup>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <Typography sx={{ fontSize: 16 }}>✉️</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Cover Letter</Typography>
      </Box>

      {/* Job title input */}
      <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', mb: 2.5 }}>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Frontend Software Engineer, Codex App</Typography>
      </Box>

      {/* Tone */}
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', mb: 1 }}>TONE</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
        {[
          { label: 'Professional', sub: 'Polished & formal', active: false },
          { label: 'Conversational', sub: 'Friendly & natural', active: true },
          { label: 'Enthusiastic', sub: 'Energetic & passionate', active: false },
        ].map((t) => (
          <Box key={t.label} sx={{ flex: 1, p: 1.2, borderRadius: '10px', bgcolor: t.active ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${t.active ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: t.active ? '#10b981' : 'rgba(255,255,255,0.6)' }}>{t.label}</Typography>
            <Typography sx={{ fontSize: 8.5, color: 'rgba(255,255,255,0.3)', mt: 0.3 }}>{t.sub}</Typography>
          </Box>
        ))}
      </Box>

      {/* Length */}
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', mb: 1 }}>LENGTH</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        {[
          { label: 'Short', sub: '~150 words', active: true },
          { label: 'Medium', sub: '~250 words', active: false },
          { label: 'Long', sub: '~400 words', active: false },
        ].map((l) => (
          <Box key={l.label} sx={{ flex: 1, p: 1.2, borderRadius: '10px', bgcolor: l.active ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${l.active ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: l.active ? '#10b981' : 'rgba(255,255,255,0.6)' }}>{l.label}</Typography>
            <Typography sx={{ fontSize: 8.5, color: 'rgba(255,255,255,0.3)', mt: 0.3 }}>{l.sub}</Typography>
          </Box>
        ))}
      </Box>

      <Button fullWidth size="small" sx={{ background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', color: '#fff', borderRadius: '10px', textTransform: 'none', fontWeight: 700, fontSize: 12, py: 1.2 }}>
        ✨ Generate Cover Letter
      </Button>
    </ExtensionMockup>
  );
}

// ── 6. Resume Download visual (light modal) ──
function ResumeDownloadVisual() {
  return (
    <ExtensionMockup>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 16 }}>📄</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Resume</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: '8px', bgcolor: 'rgba(102,126,234,0.15)', border: '1px solid rgba(102,126,234,0.3)' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>Preview</Typography>
          </Box>
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: '8px' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>Edit</Typography>
          </Box>
        </Box>
      </Box>

      {/* File name */}
      <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', mb: 0.5, letterSpacing: '0.05em' }}>FILE NAME</Typography>
      <Box sx={{ p: 1.2, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', mb: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>Sarah_Chen_Frontend_Engineer_Codex_App_Resume</Typography>
      </Box>
      <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', mb: 2 }}>.pdf</Typography>

      {/* Format */}
      <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', mb: 0.8, letterSpacing: '0.05em' }}>FORMAT</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
        <Box sx={{ flex: 1, py: 1, borderRadius: '8px', bgcolor: 'rgba(102,126,234,0.12)', border: '1px solid rgba(102,126,234,0.3)', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>📄 PDF</Typography>
        </Box>
        <Box sx={{ flex: 1, py: 1, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>📝 Word</Typography>
        </Box>
      </Box>

      {/* Preview */}
      <Box sx={{ borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', p: 2.5, mb: 2.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 0.5, color: '#fff' }}>Sarah Chen</Typography>
        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', mb: 1.5 }}>sarah.chen@email.com • San Francisco, CA</Typography>
        <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', mb: 0.5, letterSpacing: '0.03em' }}>SKILLS</Typography>
        <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          React • TypeScript • System Design • Performance • Component Architecture • State Management • UI Development • Testing
        </Typography>
      </Box>

      {/* Buttons */}
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button variant="outlined" sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: 12, py: 1 }}>Cancel</Button>
        <Button variant="contained" sx={{ flex: 1, background: 'linear-gradient(135deg, #10b981 0%, #667eea 50%, #a78bfa 100%)', color: '#fff', borderRadius: '10px', textTransform: 'none', fontWeight: 700, fontSize: 12, py: 1 }}>⬇ Download PDF</Button>
      </Box>
    </ExtensionMockup>
  );
}

// ═══════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════
export default function ApplyPilotPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleCTA = () => {
    // TODO: Replace with actual Chrome Web Store extension URL once published
    // e.g., 'https://chromewebstore.google.com/detail/applypilot-by-profileai/[extension-id]'
    window.open('https://chromewebstore.google.com', '_blank');
  };

  return (
    <Box sx={{ bgcolor: tokens.pageBg, minHeight: '100vh', color: tokens.textPrimary, overflowX: 'hidden' }}>
      {/* ═══ HERO ═══ */}
      <Box
        sx={{
          position: 'relative',
          pt: { xs: 10, md: 14 },
          pb: { xs: 8, md: 12 },
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -200,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 900,
            height: 900,
            background: 'radial-gradient(circle, rgba(102,126,234,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', maxWidth: 750, mx: 'auto' }}>
            {/* Badge */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                border: '1px solid rgba(102,126,234,0.2)',
                borderRadius: '100px',
                px: 2.5,
                py: 0.8,
                mb: 4,
                bgcolor: 'rgba(102,126,234,0.06)',
              }}
            >
              <ExtensionIcon sx={{ fontSize: 16, color: tokens.primary }} />
              <Typography sx={{ fontSize: 13, color: tokens.primary, fontWeight: 600 }}>
                Chrome Extension
              </Typography>
            </Box>

            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', md: '3.8rem' },
                fontWeight: 900,
                lineHeight: 1.1,
                mb: 3,
                letterSpacing: '-0.03em',
              }}
            >
              Supercharge your job search with{' '}
              <GradientText>ApplyPilot</GradientText>
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: '1.05rem', md: '1.2rem' },
                color: tokens.textSecondary,
                lineHeight: 1.7,
                mb: 5,
                maxWidth: 600,
                mx: 'auto',
              }}
            >
              Auto-fill applications, tailor resumes with AI, generate cover letters, and analyze job
              matches, all from one extension powered by your ProfileAI profile.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 4 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleCTA}
                endIcon={<ArrowIcon />}
                sx={{
                  background: tokens.gradient,
                  px: 5,
                  py: 1.8,
                  borderRadius: '14px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: '0 8px 32px rgba(102,126,234,0.3)',
                  '&:hover': {
                    boxShadow: '0 12px 40px rgba(102,126,234,0.45)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Get ApplyPilot, It&apos;s Free
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() =>
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                }
                sx={{
                  borderColor: tokens.border,
                  color: tokens.textPrimary,
                  borderRadius: '14px',
                  py: 1.8,
                  px: 4,
                  fontSize: '1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: tokens.textMuted,
                    bgcolor: 'rgba(102,126,234,0.04)',
                  },
                }}
              >
                See how it works
              </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              {[...Array(5)].map((_, i) => (
                <StarIcon key={i} sx={{ fontSize: 18, color: '#f59e0b' }} />
              ))}
              <Typography sx={{ fontSize: 14, color: tokens.textSecondary, ml: 1 }}>
                Trusted by <strong style={{ color: tokens.textPrimary }}>5,000+</strong> job seekers
              </Typography>
            </Box>
          </Box>

          {/* Platforms */}
          <Box sx={{ mt: 8, textAlign: 'center' }}>
            <Typography
              sx={{
                fontSize: 13,
                color: tokens.textMuted,
                mb: 2,
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Works on
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
              {platforms.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  size="small"
                  sx={{
                    bgcolor: tokens.surfaceAlt,
                    border: `1px solid ${tokens.border}`,
                    color: tokens.textSecondary,
                    fontSize: 12,
                    fontWeight: 500,
                    height: 30,
                  }}
                />
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ═══ FEATURES ═══ */}
      <Box id="features">
        {features.map((feature, index) => {
          const isReversed = index % 2 === 1;
          return (
            <Box
              key={feature.id}
              sx={{
                py: { xs: 8, md: 12 },
                bgcolor: index % 2 === 0 ? 'transparent' : tokens.surfaceAlt,
              }}
            >
              <Container maxWidth="lg">
                <RevealSection>
                  <Grid
                    container
                    spacing={8}
                    alignItems="center"
                    direction={isReversed ? 'row-reverse' : 'row'}
                  >
                    <Grid item xs={12} md={5}>
                      <Typography
                        variant="h2"
                        sx={{
                          fontSize: { xs: '1.8rem', md: '2.6rem' },
                          fontWeight: 800,
                          lineHeight: 1.15,
                          mb: 3,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {feature.title}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: { xs: '1rem', md: '1.1rem' },
                          color: tokens.textSecondary,
                          lineHeight: 1.8,
                          mb: 4,
                        }}
                      >
                        {feature.description}
                      </Typography>
                      <Button
                        variant="contained"
                        endIcon={<ArrowIcon />}
                        onClick={() => navigate(feature.ctaLink)}
                        sx={{
                          background: tokens.gradient,
                          px: 4,
                          py: 1.5,
                          borderRadius: '12px',
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          textTransform: 'none',
                          boxShadow: '0 6px 24px rgba(102,126,234,0.25)',
                          '&:hover': {
                            boxShadow: '0 10px 32px rgba(102,126,234,0.4)',
                            transform: 'translateY(-2px)',
                          },
                          transition: 'all 0.3s ease',
                        }}
                      >
                        {feature.cta}
                      </Button>
                    </Grid>
                    <Grid item xs={12} md={7}>
                      <FeatureVisual type={feature.visual} />
                    </Grid>
                  </Grid>
                </RevealSection>
              </Container>
            </Box>
          );
        })}
      </Box>

      {/* ═══ STATS ═══ */}
      <RevealSection
        sx={{
          py: { xs: 8, md: 10 },
          background: tokens.cardBg,
          borderTop: `1px solid ${tokens.border}`,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              fontWeight: 800,
              mb: 2,
              letterSpacing: '-0.02em',
            }}
          >
            Join thousands of candidates getting{' '}
            <GradientText>3x more callbacks</GradientText>
          </Typography>
          <Typography sx={{ fontSize: '1.1rem', color: tokens.textSecondary, mb: 6 }}>
            ApplyPilot users apply faster, tailor smarter, and land more interviews.
          </Typography>
          <Grid container spacing={4}>
            {[
              { value: '45,000+', label: 'Applications sent', icon: <BoltIcon /> },
              { value: '94%', label: 'Average match score', icon: <TrendingIcon /> },
              { value: '3x', label: 'More callbacks', icon: <SpeedIcon /> },
              { value: '10 min', label: 'Avg. time saved per app', icon: <SparkleIcon /> },
            ].map((stat) => (
              <Grid item xs={6} md={3} key={stat.label}>
                <Box
                  sx={{
                    p: 3,
                    borderRadius: '16px',
                    bgcolor: tokens.surfaceAlt,
                    border: `1px solid ${tokens.border}`,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      bgcolor: 'rgba(102,126,234,0.04)',
                      border: '1px solid rgba(102,126,234,0.2)',
                    },
                  }}
                >
                  <Box sx={{ color: tokens.primary, mb: 1 }}>{stat.icon}</Box>
                  <Typography
                    sx={{
                      fontSize: '2rem',
                      fontWeight: 800,
                      mb: 0.5,
                      background: tokens.gradientText,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: tokens.textSecondary, fontWeight: 500 }}>
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </RevealSection>

      {/* ═══ TESTIMONIALS ═══ */}
      <RevealSection sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              fontWeight: 800,
              mb: 6,
              letterSpacing: '-0.02em',
            }}
          >
            Loved by job seekers everywhere
          </Typography>
          <Box sx={{ position: 'relative', minHeight: 200 }}>
            {testimonials.map((t, i) => (
              <Box
                key={i}
                sx={{
                  position: i === activeTestimonial ? 'relative' : 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  opacity: i === activeTestimonial ? 1 : 0,
                  transform: i === activeTestimonial ? 'scale(1)' : 'scale(0.95)',
                  transition: 'all 0.5s ease',
                  pointerEvents: i === activeTestimonial ? 'auto' : 'none',
                }}
              >
                <Box
                  sx={{
                    maxWidth: 560,
                    mx: 'auto',
                    p: 4,
                    borderRadius: '20px',
                    bgcolor: tokens.surfaceAlt,
                    border: `1px solid ${tokens.border}`,
                  }}
                >
                  <QuoteIcon sx={{ fontSize: 36, color: 'rgba(167,139,250,0.3)', mb: 2 }} />
                  <Typography
                    sx={{
                      fontSize: '1.15rem',
                      color: tokens.textSecondary,
                      lineHeight: 1.8,
                      mb: 3,
                      fontStyle: 'italic',
                    }}
                  >
                    &ldquo;{t.text}&rdquo;
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: tokens.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {t.name.charAt(0)}
                    </Box>
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{t.name}</Typography>
                      <Typography sx={{ fontSize: 12, color: tokens.textMuted }}>
                        {t.role}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 3 }}>
            {testimonials.map((_, i) => (
              <Box
                key={i}
                onClick={() => setActiveTestimonial(i)}
                sx={{
                  width: i === activeTestimonial ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: i === activeTestimonial ? tokens.primary : '#e5e7eb',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </Box>
        </Container>
      </RevealSection>

      {/* ═══ HOW IT WORKS ═══ */}
      <RevealSection
        sx={{
          py: { xs: 8, md: 12 },
          borderTop: `1px solid ${tokens.border}`,
        }}
      >
        <Container maxWidth="lg">
          <Typography
            sx={{
              fontSize: { xs: '1.8rem', md: '2.4rem' },
              fontWeight: 800,
              textAlign: 'center',
              mb: 8,
              letterSpacing: '-0.02em',
            }}
          >
            Up and running in <GradientText>3 simple steps</GradientText>
          </Typography>
          <Grid container spacing={4}>
            {[
              {
                step: '01',
                title: 'Create your ProfileAI profile',
                desc: 'Upload your resume or fill in your details. Your profile becomes the single source of truth for every application.',
                icon: <DocIcon sx={{ fontSize: 28 }} />,
                color: '#667eea',
              },
              {
                step: '02',
                title: 'Install ApplyPilot extension',
                desc: 'Add the free Chrome extension. It syncs with your profile and activates automatically on any job board.',
                icon: <ExtensionIcon sx={{ fontSize: 28 }} />,
                color: '#a78bfa',
              },
              {
                step: '03',
                title: 'Apply & track effortlessly',
                desc: 'Click "Auto-Tailor" or "1-Click Apply" on any job listing. Every application is tracked in your dashboard.',
                icon: <BoltIcon sx={{ fontSize: 28 }} />,
                color: '#34d399',
              },
            ].map((step) => (
              <Grid item xs={12} md={4} key={step.step}>
                <Box
                  sx={{
                    p: 4,
                    borderRadius: '20px',
                    bgcolor: tokens.surfaceAlt,
                    border: `1px solid ${tokens.border}`,
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      bgcolor: 'rgba(102,126,234,0.04)',
                      border: `1px solid ${step.color}30`,
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 48,
                      fontWeight: 900,
                      color: `${step.color}15`,
                      position: 'absolute',
                      top: 16,
                      right: 20,
                      fontStyle: 'italic',
                    }}
                  >
                    {step.step}
                  </Typography>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '14px',
                      bgcolor: `${step.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: step.color,
                      mb: 3,
                    }}
                  >
                    {step.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 1.5 }}>
                    {step.title}
                  </Typography>
                  <Typography
                    sx={{ fontSize: 14, color: tokens.textSecondary, lineHeight: 1.7 }}
                  >
                    {step.desc}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </RevealSection>

      {/* ═══ FINAL CTA ═══ */}
      <Box
        sx={{
          py: { xs: 10, md: 14 },
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            bottom: -100,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 700,
            height: 700,
            background: 'radial-gradient(circle, rgba(102,126,234,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Container maxWidth="sm">
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '18px',
              background: tokens.gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 4,
            }}
          >
            <ExtensionIcon sx={{ color: '#fff', fontSize: 30 }} />
          </Box>
          <Typography
            sx={{
              fontSize: { xs: '2rem', md: '2.8rem' },
              fontWeight: 900,
              mb: 2,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
            }}
          >
            Ready to land your dream job?
          </Typography>
          <Typography
            sx={{ fontSize: '1.1rem', color: tokens.textSecondary, mb: 5, lineHeight: 1.7 }}
          >
            Join thousands of candidates who apply smarter with ApplyPilot. Free to get started, no
            credit card required.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleCTA}
            endIcon={<ArrowIcon />}
            sx={{
              background: tokens.gradient,
              px: 6,
              py: 2,
              borderRadius: '14px',
              fontSize: '1.05rem',
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: '0 8px 32px rgba(102,126,234,0.3)',
              '&:hover': {
                boxShadow: '0 12px 40px rgba(102,126,234,0.45)',
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            Get ApplyPilot, It&apos;s Free
          </Button>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              mt: 4,
              flexWrap: 'wrap',
            }}
          >
            {[
              { icon: <CheckIcon sx={{ fontSize: 16 }} />, text: 'Free forever tier' },
              { icon: <BoltIcon sx={{ fontSize: 16 }} />, text: 'Works on 50+ job boards' },
              { icon: <SparkleIcon sx={{ fontSize: 16 }} />, text: 'AI-powered' },
            ].map((item, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  color: tokens.textMuted,
                }}
              >
                {item.icon}
                <Typography sx={{ fontSize: 13, color: 'inherit' }}>{item.text}</Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
