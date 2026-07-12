import React, { useEffect, useState } from 'react';

/**
 * Structured "why are you analyzing this profile?" picker.
 *
 * Runs BEFORE the LinkedIn analyzer so we grade the profile against a
 * specific target instead of blindly inferring. Four intent tiles nudge
 * the user toward specificity (target role, next level, career change, or
 * pure inference) and each carries a contextual placeholder so the input
 * suggests what "good" looks like.
 *
 * Returns whatever the user typed as `targetTitle`. When intent is 'infer',
 * `targetTitle` is empty and the backend prompt lets Claude infer the
 * target from the profile itself.
 */

type Intent = 'role' | 'promotion' | 'switch' | 'infer';

interface AnalyzerGoalPickerProps {
  open: boolean;
  onClose: () => void;
  /** Runs the analysis with the resolved target. Empty string means "let AI infer". */
  onAnalyze: (targetTitle: string) => void;
  /** Prefill from the signed-in user's saved title/headline. Optional. */
  defaultTitle?: string;
  /** Where the click came from — controls whether we default to the user's
   *  saved title (own-profile) or blank (someone else's profile). */
  contextHint?: 'own-profile' | 'other-profile';
}

interface IntentTile {
  key: Intent;
  emoji: string;
  title: string;
  sub: string;
  placeholder: string;
  cta: string;
  /** When true the target input hides and we run inference on submit. */
  skipInput?: boolean;
  examples?: string[];
}

const INTENTS: IntentTile[] = [
  {
    key: 'role',
    emoji: '🎯',
    title: 'Land my next role',
    sub: 'Grade against a specific job title.',
    placeholder: 'e.g. Senior Frontend Engineer',
    cta: 'Analyze for this role',
    examples: ['Senior Frontend Engineer', 'Product Manager', 'Data Scientist', 'DevOps Engineer'],
  },
  {
    key: 'promotion',
    emoji: '📈',
    title: 'Get promoted',
    sub: 'Grade against the next level up.',
    placeholder: 'e.g. Staff Engineer, Engineering Manager',
    cta: 'Analyze for promotion',
    examples: ['Staff Engineer', 'Engineering Manager', 'Senior Product Manager', 'Director of Engineering'],
  },
  {
    key: 'switch',
    emoji: '🔀',
    title: 'Change careers',
    sub: 'Grade against a new field or role.',
    placeholder: 'e.g. Product Manager, Solutions Architect',
    cta: 'Analyze for career change',
    examples: ['Product Manager', 'Solutions Architect', 'Technical Program Manager', 'AI/ML Engineer'],
  },
  {
    key: 'infer',
    emoji: '✨',
    title: 'Just grade what\'s there',
    sub: 'Let AI infer the target from the profile.',
    placeholder: '',
    cta: 'Analyze without a target',
    skipInput: true,
  },
];

export const AnalyzerGoalPicker: React.FC<AnalyzerGoalPickerProps> = ({
  open,
  onClose,
  onAnalyze,
  defaultTitle,
  contextHint,
}) => {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [target, setTarget] = useState('');

  // Reset when the modal reopens.
  useEffect(() => {
    if (open) {
      setIntent(null);
      // Prefill from the user's ProfileAI title only when they're analysing
      // their OWN LinkedIn profile — for someone else's profile a saved title
      // is a distractor, not a helpful default.
      setTarget(contextHint === 'own-profile' && defaultTitle ? defaultTitle : '');
    }
  }, [open, defaultTitle, contextHint]);

  if (!open) return null;

  const active = intent ? INTENTS.find((i) => i.key === intent) : null;
  const canSubmit = intent === 'infer' || (intent && target.trim().length >= 3);
  const submitLabel = active?.cta || 'Analyze';

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = () => {
    if (!intent) return;
    onAnalyze(intent === 'infer' ? '' : target.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlay}>
      <div className="modal-container analyzer-goal-picker" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h3>What should we grade this profile for?</h3>
            <p className="agp-subhead">The more specific your goal, the sharper the fixes we'll give you.</p>
          </div>
          <button className="btn-icon modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="agp-tile-grid" role="radiogroup" aria-label="Analysis goal">
            {INTENTS.map((tile) => (
              <button
                key={tile.key}
                type="button"
                role="radio"
                aria-checked={intent === tile.key}
                className={`agp-tile${intent === tile.key ? ' selected' : ''}`}
                onClick={() => setIntent(tile.key)}
              >
                <span className="agp-tile-emoji" aria-hidden="true">{tile.emoji}</span>
                <span className="agp-tile-title">{tile.title}</span>
                <span className="agp-tile-sub">{tile.sub}</span>
              </button>
            ))}
          </div>

          {active && !active.skipInput && (
            <div className="agp-input-block">
              <label className="agp-input-label" htmlFor="agp-target">
                What role should we grade against?
              </label>
              <input
                id="agp-target"
                type="text"
                className="agp-input"
                placeholder={active.placeholder}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={80}
                autoFocus
              />
              {active.examples && active.examples.length > 0 && (
                <div className="agp-examples">
                  <span className="agp-examples-label">Popular:</span>
                  {active.examples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      className="agp-example-chip"
                      onClick={() => setTarget(ex)}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {active?.skipInput && (
            <div className="agp-infer-note">
              We'll read the profile's headline, About, and experience, then grade it against whatever role the profile itself is aiming for. Great for quick checks or grading someone else's profile.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn secondary small" onClick={onClose}>Cancel</button>
          <button
            className="btn primary small"
            onClick={handleSubmit}
            disabled={!canSubmit}
            title={!canSubmit ? 'Pick a goal first' : ''}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
