import React, { useState, useEffect, useRef } from 'react';

interface TailoringProgressProps {
  jobTitle?: string;
  company?: string;
  onCancel?: () => void;
}

const STEPS = [
  { label: 'Analyzing job description…', icon: '🔍' },
  { label: 'Matching your skills & experience…', icon: '🎯' },
  { label: 'Rewriting for keyword optimization…', icon: '✦' },
  { label: 'Finalizing tailored profile…', icon: '✨' },
];

export const TailoringProgress: React.FC<TailoringProgressProps> = ({ jobTitle, company, onCancel }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // When the progress section appears, gently scroll it into view so the user
  // can actually watch the steps run instead of staring at the action buttons.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // A short timeout lets the layout settle (the section animates in).
    const t = setTimeout(() => {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        el.scrollIntoView();
      }
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const progress = ((stepIdx + 1) / STEPS.length) * 100;
  const currentStep = STEPS[stepIdx];

  return (
    <div ref={rootRef} className="panel-section tailoring-progress">
      <div className="tp-header">
        <div className="tp-spinner">
          <svg viewBox="0 0 44 44">
            <circle className="tp-track" cx="22" cy="22" r="18" fill="none" strokeWidth="3" />
            <circle
              className="tp-arc"
              cx="22" cy="22" r="18"
              fill="none" strokeWidth="3" strokeLinecap="round"
              style={{ strokeDasharray: `${progress * 1.13} 113` }}
            />
          </svg>
          <span className="tp-icon">{currentStep.icon}</span>
        </div>
        <div className="tp-info">
          <div className="tp-title">Tailoring in Progress</div>
          {(jobTitle || company) && (
            <div className="tp-job">
              {jobTitle}{company ? ` at ${company}` : ''}
            </div>
          )}
        </div>
      </div>

      <div className="tp-bar-wrap">
        <div className="tp-bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="tp-steps">
        {STEPS.map((s, i) => (
          <div key={i} className={`tp-step ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`}>
            <span className="tp-step-dot">
              {i < stepIdx ? '✓' : i === stepIdx ? s.icon : ''}
            </span>
            <span className="tp-step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {onCancel && elapsedSec > 12 && (
        <button
          type="button"
          onClick={onCancel}
          style={{
            marginTop: 12,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.18)',
            color: 'rgba(255,255,255,0.78)',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          {elapsedSec > 60 ? 'Stuck? Cancel and retry' : 'Cancel'}
        </button>
      )}
    </div>
  );
};
