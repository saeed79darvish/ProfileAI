import React, { useEffect, useRef, useState } from 'react';

/**
 * Confirmation step shown BEFORE the LinkedIn analyzer runs.
 *
 * It used to be four intent tiles — next role / promotion / career change /
 * just infer — and picking one was mandatory before Analyze would enable. But
 * three of those tiles submitted the exact same thing: a job title typed into
 * the same input. The intent itself was never sent anywhere; it only swapped
 * the placeholder text. So the tiles were asking the user to classify their own
 * ambition to unlock a text field, and the fourth tile existed to opt out of a
 * choice we didn't need them to make.
 *
 * Now the default path is one click — Analyze grades what's on the profile —
 * and the target role is an optional detail behind a disclosure, for the users
 * who want the sharper grade. Same two outcomes as before, no taxonomy.
 *
 * Returns whatever the user typed as `targetTitle`. Empty means "let AI infer
 * the target from the profile itself".
 */

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

/** Spread across levels and tracks on purpose: the chips double as a hint that
 *  "target role" means any role, not just the next rung of your current one. */
const EXAMPLE_ROLES = [
  'Senior Frontend Engineer',
  'Staff Engineer',
  'Engineering Manager',
  'Product Manager',
];

/** A role has to be at least this long to count as one. Two characters covers
 *  the real short titles (PM, QA) while still rejecting a stray keystroke. */
const MIN_TARGET_LENGTH = 2;

export const AnalyzerGoalPicker: React.FC<AnalyzerGoalPickerProps> = ({
  open,
  onClose,
  onAnalyze,
  defaultTitle,
  contextHint,
}) => {
  const [showTarget, setShowTarget] = useState(false);
  const [target, setTarget] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset when the modal reopens.
  useEffect(() => {
    if (open) {
      setShowTarget(false);
      // Prefill from the user's ProfileAI title only when they're analysing
      // their OWN LinkedIn profile — for someone else's profile a saved title
      // is a distractor, not a helpful default. The field stays collapsed
      // either way: a prefill is there for whoever opens the detail, not a
      // reason to put a form in front of everyone else.
      setTarget(contextHint === 'own-profile' && defaultTitle ? defaultTitle : '');
    }
  }, [open, defaultTitle, contextHint]);

  useEffect(() => {
    if (showTarget) inputRef.current?.focus();
  }, [showTarget]);

  if (!open) return null;

  const trimmed = target.trim();
  const hasTarget = trimmed.length >= MIN_TARGET_LENGTH;
  // One typed character is neither a role nor a decision to grade generically,
  // so it holds the button rather than being silently dropped on submit.
  const targetTooShort = showTarget && trimmed.length > 0 && !hasTarget;

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = () => {
    if (targetTooShort) return;
    onAnalyze(showTarget && hasTarget ? trimmed : '');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlay}>
      <div className="modal-container analyzer-goal-picker" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h3>Grade this profile</h3>
            <p className="agp-subhead">
              We'll read the headline, About and experience, then grade them the way a recruiter
              skims them.
            </p>
          </div>
          <button className="btn-icon modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {!showTarget ? (
            <button type="button" className="agp-detail-toggle" onClick={() => setShowTarget(true)}>
              <span className="agp-detail-plus" aria-hidden>+</span>
              <span className="agp-detail-copy">
                <span className="agp-detail-title">Add a target role</span>
                <span className="agp-detail-sub">
                  Name the job you're aiming at and the fixes get specific to it. Optional.
                </span>
              </span>
            </button>
          ) : (
            <div className="agp-input-block">
              <div className="agp-input-head">
                <label className="agp-input-label" htmlFor="agp-target">
                  Target role
                </label>
                <button
                  type="button"
                  className="agp-input-skip"
                  onClick={() => {
                    setShowTarget(false);
                    setTarget('');
                  }}
                >
                  Remove
                </button>
              </div>
              <input
                id="agp-target"
                ref={inputRef}
                type="text"
                className="agp-input"
                placeholder="e.g. Senior Frontend Engineer"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={80}
              />
              <div className="agp-examples">
                <span className="agp-examples-label">Popular:</span>
                {EXAMPLE_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className="agp-example-chip"
                    onClick={() => setTarget(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn secondary small" onClick={onClose}>Cancel</button>
          <button
            className="btn primary small"
            onClick={handleSubmit}
            disabled={targetTooShort}
            title={targetTooShort ? 'Finish the role, or remove it to grade generically' : ''}
          >
            {showTarget && hasTarget ? 'Analyze for this role' : 'Analyze'}
          </button>
        </div>
      </div>
    </div>
  );
};
