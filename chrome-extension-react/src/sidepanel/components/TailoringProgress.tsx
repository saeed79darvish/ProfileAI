import React, { useState, useEffect, useRef } from 'react';

interface TailoringProgressProps {
  jobTitle?: string;
  company?: string;
  /**
   * When the run actually started, in epoch ms — normally the background
   * task's own startedAt. Progress is derived from this rather than counted up
   * from mount, so reopening the panel mid-run picks the steps up where they
   * are instead of replaying them from the beginning. Falls back to mount time
   * when the caller has no better answer.
   */
  startedAt?: number | null;
  onCancel?: () => void;
}

const STEPS = [
  { label: 'Analyzing job description…', icon: '🔍' },
  { label: 'Matching your skills & experience…', icon: '🎯' },
  { label: 'Rewriting for keyword optimization…', icon: '✦' },
  { label: 'Finalizing tailored profile…', icon: '✨' },
];

const STEP_MS = 3500;

export const TailoringProgress: React.FC<TailoringProgressProps> = ({
  jobTitle,
  company,
  startedAt,
  onCancel,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mountedAt = useRef(Date.now());
  // One ticking clock; the step and the elapsed counter are both read off it.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const anchor = startedAt || mountedAt.current;
  const elapsedMs = Math.max(0, now - anchor);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const stepIdx = Math.min(STEPS.length - 1, Math.floor(elapsedMs / STEP_MS));

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
