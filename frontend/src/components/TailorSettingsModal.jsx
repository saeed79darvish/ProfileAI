import React, { useState, useCallback, useMemo } from 'react';
import styled, { css } from 'styled-components';
import { Dialog, useMediaQuery } from '@mui/material';

// === Config ===
// Defaults tuned for ApplyPilot: a detailed-tone resume with a rich summary,
// standard bullet density, balanced skill coverage, and the polished sections
// most candidates want shown (education, certs, awards). Projects is opt-in
// because not every applicant has a portfolio worth surfacing.
const DEFAULT_SETTINGS = {
  summaryLines: 7,        // "Detailed · 6–8 lines"
  experienceLines: 5,     // "Standard · 4–5 bullets"
  maxSkills: 15,          // "Balanced · 15 skills"
  includeSections: ['education', 'certifications', 'awards'],
  tone: 'detailed',
  focusAreas: [],
  customInstructions: '', // freeform note the AI should consider when tailoring
};

const CUSTOM_MAX = 500;

const TONE_OPTIONS = [
  { value: 'concise', icon: '⚡', label: 'Concise', desc: 'Short, ATS-friendly bullets' },
  { value: 'professional', icon: '✦', label: 'Professional', desc: 'Balanced detail and clarity' },
  { value: 'detailed', icon: '📝', label: 'Detailed', desc: 'Rich descriptions with context' },
];

const TONE_EXAMPLES = {
  concise: '"Designed REST APIs serving 1M+ users, cut response times 40%"',
  professional: '"Built and maintained scalable REST APIs serving 1M+ monthly active users, improving response times by 40%."',
  detailed: '"Architected and maintained a suite of scalable REST APIs handling 1M+ MAU across 12 microservices, driving a 40% improvement in p95 response times through caching and query optimization"',
};

const SECTION_OPTIONS = [
  { key: 'projects', icon: '🔧', label: 'Projects' },
  { key: 'education', icon: '🎓', label: 'Education' },
  { key: 'certifications', icon: '📜', label: 'Certifications' },
  { key: 'awards', icon: '🏆', label: 'Awards' },
];

const FOCUS_AREAS = [
  'Leadership & mentorship',
  'System design & architecture',
  'Performance optimization',
  'Cross-functional collaboration',
  'Cloud & infrastructure',
  'Testing & quality',
];

const MAX_FOCUS = 3;

/* ── Segment presets for Section Lengths ── */
const SUMMARY_PRESETS = [
  { label: 'Brief', sub: '2–3 lines', value: 3 },
  { label: 'Standard', sub: '4–5 lines', value: 5 },
  { label: 'Detailed', sub: '6–8 lines', value: 7 },
];
const BULLETS_PRESETS = [
  { label: 'Tight', sub: '2–3 bullets', value: 3 },
  { label: 'Standard', sub: '4–5 bullets', value: 5 },
  { label: 'Detailed', sub: '6–8 bullets', value: 7 },
];
const SKILLS_PRESETS = [
  { label: 'Minimal', sub: '8 skills', value: 8 },
  { label: 'Balanced', sub: '15 skills', value: 15 },
  { label: 'Full', sub: '25 skills', value: 25 },
];

// === Styled Components ===
const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 88vh;
  overflow: hidden;
  @media (max-width: 600px) {
    max-height: 100vh;
    height: 100%;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 14px;
  flex-shrink: 0;
  @media (max-width: 600px) { padding: 16px 18px 12px; }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

const IconBox = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #6941C6, #7C5CFC);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: white;
  flex-shrink: 0;
`;

const HeaderText = styled.div`
  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #1a1a2e;
  }

  .company-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 3px;
    font-size: 13px;
    color: #6b7280;
  }

  .company-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 10px;
    border-radius: 6px;
    background: #1a1a2e;
    font-weight: 600;
    color: white;
    font-size: 12px;
  }

  .company-logo {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    background: #6941C6;
    color: white;
    font-size: 9px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  color: #6b7280;
  font-size: 20px;
  transition: all 0.2s;
  line-height: 1;
  &:hover { background: #f3f4f6; color: #1a1a2e; }
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid #f3f4f6;
  margin: 0;
`;

const Body = styled.div`
  padding: 0 24px 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  @media (max-width: 600px) { padding: 0 18px 16px; }
`;

const Section = styled.div`
  margin-bottom: 24px;
  &:last-child { margin-bottom: 0; }
`;

const SectionLabel = styled.h4`
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #374151;
`;

const SectionLabelRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  h4 {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #374151;
  }
  .hint {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 400;
  }
`;

/* ── Tone Grid ── */
const ToneGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
`;

const ToneCard = styled.button`
  padding: 16px 12px;
  border-radius: 14px;
  border: 2px solid ${p => p.$active ? '#6941C6' : '#e5e7eb'};
  background: ${p => p.$active ? '#F4F0FF' : 'white'};
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  @media (max-width: 600px) {
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    padding: 14px 16px;
  }
  &:hover { border-color: ${p => p.$active ? '#6941C6' : '#c4c8d0'}; }
  .icon {
    display: block;
    font-size: 20px;
    margin-bottom: 6px;
    color: ${p => p.$active ? '#6941C6' : '#9ca3af'};
    @media (max-width: 600px) { margin-bottom: 0; }
  }
  .name {
    display: block;
    font-size: 14px;
    font-weight: 700;
    color: ${p => p.$active ? '#6941C6' : '#374151'};
    margin-bottom: 3px;
  }
  .desc {
    display: block;
    font-size: 11px;
    color: ${p => p.$active ? '#8B6DD8' : '#9ca3af'};
    line-height: 1.3;
  }
`;

const ExampleBox = styled.div`
  margin-top: 12px;
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px dashed #E5DDF8;
  background: #FDFBFF;
  .label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #6941C6;
    margin-bottom: 8px;
  }
  .text {
    font-size: 14px;
    color: #374151;
    line-height: 1.5;
    font-style: italic;
  }
`;

/* ── Segment Controls (replaces sliders) ── */
const SegmentCard = styled.div`
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #F9FAFB;
  margin-bottom: 12px;
  &:last-child { margin-bottom: 0; }
`;

const SegmentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  .seg-label {
    font-size: 15px;
    font-weight: 700;
    color: #1a1a2e;
  }
  .seg-value {
    font-size: 12px;
    font-weight: 700;
    color: #6941C6;
    background: #F4F0FF;
    padding: 3px 10px;
    border-radius: 8px;
    font-style: italic;
  }
`;

const SegmentRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
`;

const SegmentOption = styled.button`
  padding: 10px 6px;
  border-radius: 10px;
  border: 2px solid ${p => p.$active ? '#6941C6' : 'transparent'};
  background: ${p => p.$active ? 'white' : '#F3F4F6'};
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;
  &:hover { background: ${p => p.$active ? 'white' : '#EAECF0'}; }

  .opt-label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: ${p => p.$active ? '#1a1a2e' : '#6b7280'};
  }
  .opt-sub {
    display: block;
    font-size: 11px;
    color: ${p => p.$active ? '#6941C6' : '#9ca3af'};
    margin-top: 2px;
    font-weight: ${p => p.$active ? 600 : 400};
  }
`;

/* ── Chips (Include sections / Focus areas) ── */
const SectionChipGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const SectionChip = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  ${p => p.$active ? css`
    border: 2px solid #6941C6;
    background: #F4F0FF;
    color: #6941C6;
  ` : css`
    border: 2px solid #e5e7eb;
    background: white;
    color: #6b7280;
    &:hover { border-color: #c4c8d0; }
  `}
  .icon { font-size: 16px; }
  .check {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: ${p => p.$active ? '#6941C6' : 'transparent'};
    border: ${p => p.$active ? 'none' : '1.5px solid #d1d5db'};
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    font-weight: 700;
  }
`;

const FocusChipGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const FocusChip = styled.button`
  padding: 10px 18px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: ${p => p.$disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;
  opacity: ${p => p.$disabled ? 0.5 : 1};
  ${p => p.$active ? css`
    border: 1.5px solid #6941C6;
    background: #F4F0FF;
    color: #6941C6;
    font-weight: 600;
  ` : css`
    border: 1.5px solid #e5e7eb;
    background: white;
    color: #6b7280;
    &:hover { border-color: ${p.$disabled ? '#e5e7eb' : '#c4c8d0'}; }
  `}
`;

/* ── Footer ── */
const Footer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 14px 24px 20px;
  border-top: 1px solid #f3f4f6;
  flex-shrink: 0;
  gap: 12px;
  @media (max-width: 600px) {
    padding: 12px 18px;
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
`;

const FooterMeta = styled.div`
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
`;

const FooterBadge = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #6941C6;
`;

const FooterSep = styled.span`
  font-size: 13px;
  color: #d1d5db;
`;

const ContinueBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: 14px;
  border: none;
  background: #6941C6;
  color: white;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  width: 100%;
  &:hover {
    background: #5B34B5;
    box-shadow: 0 4px 14px rgba(105, 65, 198, 0.35);
  }
`;

/* ── Custom instructions ── */
const CustomTextarea = styled.textarea`
  width: 100%;
  min-height: 84px;
  resize: vertical;
  padding: 12px 14px;
  border-radius: 12px;
  border: 2px solid #e5e7eb;
  background: white;
  font-size: 14px;
  font-family: inherit;
  color: #1a1a2e;
  line-height: 1.5;
  transition: border-color 0.2s;
  &::placeholder { color: #9ca3af; }
  &:focus {
    outline: none;
    border-color: #6941C6;
  }
`;

const CharCount = styled.div`
  margin-top: 6px;
  text-align: right;
  font-size: 11px;
  color: #9ca3af;
`;
// === Segment Control helper ===
function SegmentControl({ label, presets, value, onChange }) {
  const active = presets.find(p => p.value === value) || presets[1];
  return (
    <SegmentCard>
      <SegmentHeader>
        <span className="seg-label">{label}</span>
        <span className="seg-value">{active.label} · {active.sub}</span>
      </SegmentHeader>
      <SegmentRow>
        {presets.map(p => (
          <SegmentOption key={p.value} $active={value === p.value} onClick={() => onChange(p.value)}>
            <span className="opt-label">{p.label}</span>
            <span className="opt-sub">{p.sub}</span>
          </SegmentOption>
        ))}
      </SegmentRow>
    </SegmentCard>
  );
}

// === Component ===
export default function TailorSettingsModal({ open, onClose, jobTitle, company, onContinue }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const isMobile = useMediaQuery('(max-width:768px)');

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleSection = useCallback((key) => {
    setSettings(prev => ({
      ...prev,
      includeSections: prev.includeSections.includes(key)
        ? prev.includeSections.filter(s => s !== key)
        : [...prev.includeSections, key]
    }));
  }, []);

  const toggleFocus = useCallback((area) => {
    setSettings(prev => {
      if (prev.focusAreas.includes(area)) {
        return { ...prev, focusAreas: prev.focusAreas.filter(a => a !== area) };
      }
      if (prev.focusAreas.length >= MAX_FOCUS) return prev;
      return { ...prev, focusAreas: [...prev.focusAreas, area] };
    });
  }, []);

  const handleContinue = () => {
    onContinue({
      ...settings,
      includeProjects: settings.includeSections.includes('projects'),
    });
  };

  const toneLabel = TONE_OPTIONS.find(t => t.value === settings.tone)?.label || 'Professional';
  const summaryPreset = SUMMARY_PRESETS.find(p => p.value === settings.summaryLines) || SUMMARY_PRESETS[1];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        style: {
          borderRadius: isMobile ? 0 : 20,
          overflow: 'hidden',
          maxHeight: isMobile ? '100vh' : '90vh',
        }
      }}
    >
      <ModalContainer>
        <Header>
          <HeaderLeft>
            <IconBox>✦</IconBox>
            <HeaderText>
              <h3>Tailor settings</h3>
              {company && (
                <div className="company-row">
                  For{' '}
                  <span className="company-badge">
                    <span className="company-logo">{company.charAt(0).toUpperCase()}</span>
                    {company}
                  </span>
                </div>
              )}
            </HeaderText>
          </HeaderLeft>
          <CloseBtn onClick={onClose}>✕</CloseBtn>
        </Header>

        <Divider />

        <Body>
          {/* Resume Tone */}
          <Section style={{ marginTop: 20 }}>
            <SectionLabel>Resume Tone</SectionLabel>
            <ToneGrid>
              {TONE_OPTIONS.map(opt => (
                <ToneCard
                  key={opt.value}
                  $active={settings.tone === opt.value}
                  onClick={() => updateSetting('tone', opt.value)}
                >
                  <span className="icon">{opt.icon}</span>
                  <span className="name">{opt.label}</span>
                  <span className="desc">{opt.desc}</span>
                </ToneCard>
              ))}
            </ToneGrid>
            <ExampleBox>
              <div className="label">ⓘ Example Output</div>
              <div className="text">{TONE_EXAMPLES[settings.tone]}</div>
            </ExampleBox>
          </Section>

          {/* Section Lengths, segmented controls */}
          <Section>
            <SectionLabel>Section Lengths</SectionLabel>
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
          </Section>

          {/* Include Sections */}
          <Section>
            <SectionLabel>Include Sections</SectionLabel>
            <SectionChipGrid>
              {SECTION_OPTIONS.map(opt => {
                const active = settings.includeSections.includes(opt.key);
                return (
                  <SectionChip key={opt.key} $active={active} onClick={() => toggleSection(opt.key)}>
                    <span className="icon">{opt.icon}</span>
                    {opt.label}
                    <span className="check">{active ? '✓' : ''}</span>
                  </SectionChip>
                );
              })}
            </SectionChipGrid>
          </Section>

          {/* Emphasize */}
          <Section>
            <SectionLabelRow>
              <h4>Emphasize</h4>
              <span className="hint">Pick up to {MAX_FOCUS}</span>
            </SectionLabelRow>
            <FocusChipGrid>
              {FOCUS_AREAS.map(area => {
                const active = settings.focusAreas.includes(area);
                const disabled = !active && settings.focusAreas.length >= MAX_FOCUS;
                return (
                  <FocusChip
                    key={area}
                    $active={active}
                    $disabled={disabled}
                    onClick={() => !disabled && toggleFocus(area)}
                  >
                    {area}
                  </FocusChip>
                );
              })}
            </FocusChipGrid>
          </Section>

          {/* Custom instructions — freeform note for the AI */}
          <Section>
            <SectionLabelRow>
              <h4>Anything else for the AI?</h4>
              <span className="hint">Optional</span>
            </SectionLabelRow>
            <CustomTextarea
              value={settings.customInstructions}
              maxLength={CUSTOM_MAX}
              onChange={(e) => updateSetting('customInstructions', e.target.value)}
              placeholder="e.g. Emphasize my fintech background, keep it under one page, and highlight leadership on the payments team."
            />
            <CharCount>{settings.customInstructions.length}/{CUSTOM_MAX}</CharCount>
          </Section>
        </Body>

        <Footer>
          <FooterMeta>
            <FooterBadge>{toneLabel}</FooterBadge>
            <FooterSep>·</FooterSep>
            <FooterBadge>{summaryPreset.sub.replace('lines', 'line summary')}</FooterBadge>
            <FooterSep>·</FooterSep>
            <FooterBadge>{settings.maxSkills} skills</FooterBadge>
          </FooterMeta>
          <ContinueBtn onClick={handleContinue}>
            Continue to tailor
          </ContinueBtn>
        </Footer>
      </ModalContainer>
    </Dialog>
  );
}
