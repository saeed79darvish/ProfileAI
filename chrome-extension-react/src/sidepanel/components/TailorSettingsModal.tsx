import React, { useState, useCallback } from 'react';

export interface TailorSettings {
  summaryLines: number;
  experienceLines: number;
  maxSkills: number;
  includeProjects: boolean;
  tone: 'professional' | 'concise' | 'detailed';
  focusAreas: string[];
}

interface TailorSettingsModalProps {
  jobTitle: string;
  company: string;
  onContinue: (settings: TailorSettings) => void;
  onCancel: () => void;
}

const DEFAULT_SETTINGS: TailorSettings = {
  summaryLines: 3,
  experienceLines: 4,
  maxSkills: 12,
  includeProjects: true,
  tone: 'professional',
  focusAreas: [],
};

const FOCUS_AREA_OPTIONS = [
  'Technical Skills',
  'Leadership',
  'Problem Solving',
  'Communication',
  'Project Management',
  'Domain Expertise',
  'Metrics & Impact',
  'Team Collaboration',
];

const TONE_OPTIONS: { value: TailorSettings['tone']; label: string; desc: string }[] = [
  { value: 'concise', label: 'Concise', desc: 'Short, ATS-friendly bullet points' },
  { value: 'professional', label: 'Professional', desc: 'Balanced detail and clarity' },
  { value: 'detailed', label: 'Detailed', desc: 'Rich descriptions with context' },
];

export const TailorSettingsModal: React.FC<TailorSettingsModalProps> = ({
  jobTitle,
  company,
  onContinue,
  onCancel,
}) => {
  const [settings, setSettings] = useState<TailorSettings>(DEFAULT_SETTINGS);

  const updateSetting = useCallback(<K extends keyof TailorSettings>(key: K, value: TailorSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleFocusArea = useCallback((area: string) => {
    setSettings((prev) => {
      const areas = prev.focusAreas.includes(area)
        ? prev.focusAreas.filter((a) => a !== area)
        : [...prev.focusAreas, area];
      return { ...prev, focusAreas: areas };
    });
  }, []);

  return (
    <div className="tsm-overlay" onClick={onCancel}>
      <div className="tsm-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tsm-header">
          <div className="tsm-header-left">
            <div className="tsm-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <h3 className="tsm-title">Tailor Settings</h3>
              {jobTitle && (
                <p className="tsm-job-label">{jobTitle}{company ? `, ${company}` : ''}</p>
              )}
            </div>
          </div>
          <button className="tsm-close-btn" onClick={onCancel}>✕</button>
        </div>

        <p className="tsm-subtitle">
          Customize how your resume will be tailored for this position.
        </p>

        <div className="tsm-body">
          {/* Tone */}
          <div className="tsm-section">
            <label className="tsm-section-label">Resume Tone</label>
            <div className="tsm-tone-options">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`tsm-tone-btn ${settings.tone === opt.value ? 'active' : ''}`}
                  onClick={() => updateSetting('tone', opt.value)}
                >
                  <span className="tsm-tone-name">{opt.label}</span>
                  <span className="tsm-tone-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section Lengths */}
          <div className="tsm-section">
            <label className="tsm-section-label">Section Lengths</label>
            <div className="tsm-sliders">
              <div className="tsm-slider-row">
                <div className="tsm-slider-info">
                  <span className="tsm-slider-name">Summary</span>
                  <span className="tsm-slider-value">{settings.summaryLines} lines</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={6}
                  value={settings.summaryLines}
                  onChange={(e) => updateSetting('summaryLines', Number(e.target.value))}
                  className="tsm-range"
                />
              </div>
              <div className="tsm-slider-row">
                <div className="tsm-slider-info">
                  <span className="tsm-slider-name">Experience (per role)</span>
                  <span className="tsm-slider-value">{settings.experienceLines} lines</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={8}
                  value={settings.experienceLines}
                  onChange={(e) => updateSetting('experienceLines', Number(e.target.value))}
                  className="tsm-range"
                />
              </div>
              <div className="tsm-slider-row">
                <div className="tsm-slider-info">
                  <span className="tsm-slider-name">Max Skills</span>
                  <span className="tsm-slider-value">{settings.maxSkills} skills</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={25}
                  value={settings.maxSkills}
                  onChange={(e) => updateSetting('maxSkills', Number(e.target.value))}
                  className="tsm-range"
                />
              </div>
            </div>
          </div>

          {/* Include Sections */}
          <div className="tsm-section">
            <label className="tsm-section-label">Include Sections</label>
            <div className="tsm-toggles">
              <label className="tsm-toggle-row">
                <span>Projects</span>
                <input
                  type="checkbox"
                  checked={settings.includeProjects}
                  onChange={(e) => updateSetting('includeProjects', e.target.checked)}
                  className="tsm-checkbox"
                />
              </label>
            </div>
          </div>

          {/* Focus Areas */}
          <div className="tsm-section">
            <label className="tsm-section-label">Emphasize (optional)</label>
            <div className="tsm-chips">
              {FOCUS_AREA_OPTIONS.map((area) => (
                <button
                  key={area}
                  className={`tsm-chip ${settings.focusAreas.includes(area) ? 'active' : ''}`}
                  onClick={() => toggleFocusArea(area)}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="tsm-footer">
          <button className="tsm-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="tsm-btn-continue" onClick={() => onContinue(settings)}>
            Continue to Tailor
          </button>
        </div>
      </div>
    </div>
  );
};
