import React, { useState, useCallback } from 'react';

/**
 * TailorSettingsModal — mirrors the web app's `frontend/src/components/TailorSettingsModal.jsx`
 * design so users see the same experience in the extension side panel as on
 * the Jobs page. The `TailorSettings` shape is kept backwards compatible:
 * `includeProjects` is still emitted (derived from `includeSections`) so the
 * existing `handleTailorSettingsContinue` → `doTailor` pipeline in SidePanel
 * doesn't need to change.
 */

export interface TailorSettings {
  summaryLines: number;
  experienceLines: number;
  maxSkills: number;
  /** Kept for back-compat with the tailoring pipeline. Derived from includeSections on submit. */
  includeProjects: boolean;
  /** Which optional sections to include in the tailored resume. */
  includeSections: string[];
  tone: 'professional' | 'concise' | 'detailed';
  focusAreas: string[];
  /** Freeform note the AI should consider when tailoring. */
  customInstructions: string;
}

const CUSTOM_MAX = 500;

interface TailorSettingsModalProps {
  jobTitle: string;
  company: string;
  onContinue: (settings: TailorSettings) => void;
  onCancel: () => void;
}

const MAX_FOCUS = 3;

const DEFAULT_SETTINGS: TailorSettings = {
  // Matches web defaults: Detailed tone, 6–8 line summary, 4–5 bullets, 15 skills.
  summaryLines: 7,
  experienceLines: 5,
  maxSkills: 15,
  includeProjects: false,
  includeSections: ['education', 'certifications', 'awards'],
  tone: 'detailed',
  focusAreas: [],
  customInstructions: '',
};

interface ToneOption { value: TailorSettings['tone']; icon: string; label: string; desc: string; }
const TONE_OPTIONS: ToneOption[] = [
  { value: 'concise',      icon: '⚡', label: 'Concise',      desc: 'Short, ATS-friendly bullets' },
  { value: 'professional', icon: '✦', label: 'Professional', desc: 'Balanced detail and clarity' },
  { value: 'detailed',     icon: '📝', label: 'Detailed',     desc: 'Rich descriptions with context' },
];

const TONE_EXAMPLES: Record<TailorSettings['tone'], string> = {
  concise: '"Designed REST APIs serving 1M+ users, cut response times 40%"',
  professional: '"Built and maintained scalable REST APIs serving 1M+ monthly active users, improving response times by 40%."',
  detailed: '"Architected and maintained a suite of scalable REST APIs handling 1M+ MAU across 12 microservices, driving a 40% improvement in p95 response times through caching and query optimization"',
};

interface SectionOption { key: string; icon: string; label: string; }
const SECTION_OPTIONS: SectionOption[] = [
  { key: 'projects',       icon: '🔧', label: 'Projects' },
  { key: 'education',      icon: '🎓', label: 'Education' },
  { key: 'certifications', icon: '📜', label: 'Certifications' },
  { key: 'awards',         icon: '🏆', label: 'Awards' },
];

const FOCUS_AREAS = [
  'Leadership & mentorship',
  'System design & architecture',
  'Performance optimization',
  'Cross-functional collaboration',
  'Cloud & infrastructure',
  'Testing & quality',
];

interface Preset { label: string; sub: string; value: number; }
const SUMMARY_PRESETS: Preset[] = [
  { label: 'Brief',    sub: '2–3 lines',  value: 3 },
  { label: 'Standard', sub: '4–5 lines',  value: 5 },
  { label: 'Detailed', sub: '6–8 lines',  value: 7 },
];
const BULLETS_PRESETS: Preset[] = [
  { label: 'Tight',    sub: '2–3 bullets', value: 3 },
  { label: 'Standard', sub: '4–5 bullets', value: 5 },
  { label: 'Detailed', sub: '6–8 bullets', value: 7 },
];
const SKILLS_PRESETS: Preset[] = [
  { label: 'Minimal',  sub: '8 skills',  value: 8 },
  { label: 'Balanced', sub: '15 skills', value: 15 },
  { label: 'Full',     sub: '25 skills', value: 25 },
];

interface SegmentControlProps {
  label: string;
  presets: Preset[];
  value: number;
  onChange: (n: number) => void;
}
const SegmentControl: React.FC<SegmentControlProps> = ({ label, presets, value, onChange }) => {
  const active = presets.find((p) => p.value === value) || presets[1];
  return (
    <div className="tsm-segment-card">
      <div className="tsm-segment-header">
        <span className="tsm-segment-label">{label}</span>
        <span className="tsm-segment-value">{active.label} · {active.sub}</span>
      </div>
      <div className="tsm-segment-row">
        {presets.map((p) => (
          <button
            type="button"
            key={p.value}
            className={`tsm-segment-opt ${value === p.value ? 'active' : ''}`}
            onClick={() => onChange(p.value)}
          >
            <span className="tsm-segment-opt-label">{p.label}</span>
            <span className="tsm-segment-opt-sub">{p.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

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

  const toggleSection = useCallback((key: string) => {
    setSettings((prev) => ({
      ...prev,
      includeSections: prev.includeSections.includes(key)
        ? prev.includeSections.filter((s) => s !== key)
        : [...prev.includeSections, key],
    }));
  }, []);

  const toggleFocusArea = useCallback((area: string) => {
    setSettings((prev) => {
      if (prev.focusAreas.includes(area)) {
        return { ...prev, focusAreas: prev.focusAreas.filter((a) => a !== area) };
      }
      if (prev.focusAreas.length >= MAX_FOCUS) return prev;
      return { ...prev, focusAreas: [...prev.focusAreas, area] };
    });
  }, []);

  const handleContinue = () => {
    // Derive the legacy includeProjects flag so downstream tailoring code
    // (SidePanel.handleTailorSettingsContinue → doTailor) keeps working.
    onContinue({
      ...settings,
      includeProjects: settings.includeSections.includes('projects'),
    });
  };

  const toneLabel = TONE_OPTIONS.find((t) => t.value === settings.tone)?.label || 'Professional';
  const summaryPreset = SUMMARY_PRESETS.find((p) => p.value === settings.summaryLines) || SUMMARY_PRESETS[1];
  const summaryFooter = summaryPreset.sub.replace('lines', 'line summary');
  const companyInitial = (company || '').trim().charAt(0).toUpperCase();

  return (
    <div className="tsm-overlay" onClick={onCancel}>
      <div className="tsm-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tsm-header">
          <div className="tsm-header-left">
            <div className="tsm-header-icon" aria-hidden>✦</div>
            <div className="tsm-header-text">
              <h3 className="tsm-title">Tailor settings</h3>
              {(company || jobTitle) && (
                <div className="tsm-company-row">
                  For{' '}
                  <span className="tsm-company-badge" title={jobTitle ? `${jobTitle}${company ? ` · ${company}` : ''}` : company}>
                    {companyInitial && <span className="tsm-company-logo">{companyInitial}</span>}
                    <span className="tsm-company-name">{company || jobTitle}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
          <button className="tsm-close-btn" onClick={onCancel} aria-label="Close">✕</button>
        </div>

        <hr className="tsm-divider" />

        <div className="tsm-body">
          {/* Resume Tone */}
          <div className="tsm-section">
            <div className="tsm-section-label">Resume Tone</div>
            <div className="tsm-tone-grid">
              {TONE_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  className={`tsm-tone-card ${settings.tone === opt.value ? 'active' : ''}`}
                  onClick={() => updateSetting('tone', opt.value)}
                >
                  <span className="tsm-tone-icon">{opt.icon}</span>
                  <span className="tsm-tone-name">{opt.label}</span>
                  <span className="tsm-tone-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
            <div className="tsm-example-box">
              <div className="tsm-example-label">ⓘ Example Output</div>
              <div className="tsm-example-text">{TONE_EXAMPLES[settings.tone]}</div>
            </div>
          </div>

          {/* Section Lengths */}
          <div className="tsm-section">
            <div className="tsm-section-label">Section Lengths</div>
            <SegmentControl
              label="Summary"
              presets={SUMMARY_PRESETS}
              value={settings.summaryLines}
              onChange={(v) => updateSetting('summaryLines', v)}
            />
            <SegmentControl
              label="Bullets per role"
              presets={BULLETS_PRESETS}
              value={settings.experienceLines}
              onChange={(v) => updateSetting('experienceLines', v)}
            />
            <SegmentControl
              label="Skills shown"
              presets={SKILLS_PRESETS}
              value={settings.maxSkills}
              onChange={(v) => updateSetting('maxSkills', v)}
            />
          </div>

          {/* Include Sections */}
          <div className="tsm-section">
            <div className="tsm-section-label">Include Sections</div>
            <div className="tsm-section-chips">
              {SECTION_OPTIONS.map((opt) => {
                const active = settings.includeSections.includes(opt.key);
                return (
                  <button
                    type="button"
                    key={opt.key}
                    className={`tsm-section-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleSection(opt.key)}
                    aria-pressed={active}
                  >
                    <span className="tsm-section-chip-icon">{opt.icon}</span>
                    <span className="tsm-section-chip-label">{opt.label}</span>
                    <span className={`tsm-section-chip-check ${active ? 'checked' : ''}`}>
                      {active ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Emphasize */}
          <div className="tsm-section">
            <div className="tsm-section-label-row">
              <div className="tsm-section-label">Emphasize</div>
              <span className="tsm-section-hint">Pick up to {MAX_FOCUS}</span>
            </div>
            <div className="tsm-focus-grid">
              {FOCUS_AREAS.map((area) => {
                const active = settings.focusAreas.includes(area);
                const disabled = !active && settings.focusAreas.length >= MAX_FOCUS;
                return (
                  <button
                    type="button"
                    key={area}
                    className={`tsm-focus-chip ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                    disabled={disabled}
                    onClick={() => !disabled && toggleFocusArea(area)}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom instructions — freeform note for the AI */}
          <div className="tsm-section">
            <div className="tsm-section-label-row">
              <div className="tsm-section-label">Anything else for the AI?</div>
              <span className="tsm-section-hint">Optional</span>
            </div>
            <textarea
              className="tsm-custom-textarea"
              value={settings.customInstructions}
              maxLength={CUSTOM_MAX}
              onChange={(e) => updateSetting('customInstructions', e.target.value)}
              placeholder="e.g. Emphasize my fintech background, keep it to one page, highlight leadership on the payments team."
            />
            <div className="tsm-custom-count">{settings.customInstructions.length}/{CUSTOM_MAX}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="tsm-footer">
          <div className="tsm-footer-meta">
            <span className="tsm-footer-badge">{toneLabel}</span>
            <span className="tsm-footer-sep">·</span>
            <span className="tsm-footer-badge">{summaryFooter}</span>
            <span className="tsm-footer-sep">·</span>
            <span className="tsm-footer-badge">{settings.maxSkills} skills</span>
          </div>
          <button className="tsm-btn-continue" onClick={handleContinue}>
            Continue to tailor
          </button>
        </div>
      </div>
    </div>
  );
};
