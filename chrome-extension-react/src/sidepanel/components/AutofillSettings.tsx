import React, { useState, useEffect } from 'react';

export interface AutofillMode {
  useSavedAnswers: boolean;
  useAI: boolean;
}

const DEFAULT_MODE: AutofillMode = { useSavedAnswers: true, useAI: true };
const STORAGE_KEY = 'profileai_autofill_mode';

export const getAutofillMode = async (): Promise<AutofillMode> => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
};

export const AutofillSettings: React.FC = () => {
  const [mode, setMode] = useState<AutofillMode>(DEFAULT_MODE);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getAutofillMode().then(setMode);
  }, []);

  const updateMode = (update: Partial<AutofillMode>) => {
    const newMode = { ...mode, ...update };
    setMode(newMode);
    chrome.storage.local.set({ [STORAGE_KEY]: newMode });
  };

  return (
    <div className="panel-section autofill-settings">
      <button
        className="settings-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="settings-toggle-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Autofill Settings</span>
        </div>
        <svg
          className={`chevron ${expanded ? 'expanded' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="16"
          height="16"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="settings-body">
          <p className="settings-hint">
            Control how empty fields are filled during autofill.
          </p>

          <label className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Use Saved Answers</span>
              <span className="setting-desc">
                Fill custom questions from your saved answers
              </span>
            </div>
            <div className={`toggle ${mode.useSavedAnswers ? 'active' : ''}`} onClick={() => updateMode({ useSavedAnswers: !mode.useSavedAnswers })}>
              <div className="toggle-thumb" />
            </div>
          </label>

          <label className="setting-row">
            <div className="setting-info">
              <span className="setting-label">AI-Generated Answers</span>
              <span className="setting-desc">
                Use GPT-4 to answer remaining custom questions
              </span>
            </div>
            <div className={`toggle ${mode.useAI ? 'active' : ''}`} onClick={() => updateMode({ useAI: !mode.useAI })}>
              <div className="toggle-thumb" />
            </div>
          </label>

          {!mode.useSavedAnswers && !mode.useAI && (
            <p className="settings-warning">
              Only profile data (name, email, etc.) will be filled.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
