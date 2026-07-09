import React, { useEffect, useMemo, useState } from 'react';
import type { LinkedInProfileAnalysis, LinkedInSectionAnalysis } from '../../types';

interface LinkedInAnalyzerModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  analysis: LinkedInProfileAnalysis | null;
  error?: string | null;
  targetTitle?: string;
  /** ms timestamp when the current `analysis` was produced (or loaded from
   *  cache). Drives the "Analyzed X ago · cached" indicator. */
  cachedAt?: number | null;
  onRefresh: () => void;
  /** Toast callback — plumbed from SidePanel so this modal can surface status
   *  after copy / open-on-LinkedIn actions. */
  onNotification?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type LinkedInSectionKey = 'headline' | 'about' | 'skills' | 'featured' | 'experience';

const scoreClass = (n: number) => (n >= 70 ? 'good' : n >= 50 ? 'medium' : 'low');

const verdictMeta = (v?: string) => {
  if (v === 'shortlist')
    return { text: 'Shortlist', tone: 'good' as const, icon: 'check' as const };
  if (v === 'maybe') return { text: 'Maybe', tone: 'medium' as const, icon: 'warn' as const };
  if (v === 'pass') return { text: 'Pass', tone: 'low' as const, icon: 'x' as const };
  return { text: v || '—', tone: 'medium' as const, icon: 'warn' as const };
};

// Map the AI-returned section name to a LinkedIn-editor section key. Only
// sections we can plausibly open in-place get a key; the rest fall back to
// copy-only.
const sectionKeyFor = (name: string): LinkedInSectionKey | null => {
  const n = name.toLowerCase();
  if (n.includes('headline') || n.includes('intro')) return 'headline';
  if (n.includes('about') || n.includes('summary')) return 'about';
  if (n.includes('experience')) return 'experience';
  if (n.includes('skill')) return 'skills';
  if (n.includes('featured')) return 'featured';
  return null;
};

/** Human-readable "X ago" for a ms timestamp. */
const formatAgo = (ts: number): string => {
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'just now';
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
};

/** Plain-language band for a 0-100 score so the number is self-explanatory. */
const scoreBand = (n: number): string => {
  if (n >= 85) return 'Excellent';
  if (n >= 70) return 'Good';
  if (n >= 50) return 'Needs work';
  if (n >= 30) return 'Weak';
  return 'Poor';
};

/** Circular score gauge — SVG ring with "score/100" in the middle and a
 *  plain-language grade underneath, so users don't have to guess what the
 *  number means. */
const ScoreRing: React.FC<{ score: number; label: string; hint?: string }> = ({
  score,
  label,
  hint,
}) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const cls = scoreClass(clamped);
  return (
    <div className={`li-ring-wrap ${cls}`} title={hint}>
      <svg viewBox="0 0 76 76" className="li-ring">
        <circle cx="38" cy="38" r={radius} className="li-ring-track" />
        <circle
          cx="38"
          cy="38"
          r={radius}
          className="li-ring-arc"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
        <text x="38" y="38" textAnchor="middle" className="li-ring-num">
          {clamped}
        </text>
        <text x="38" y="51" textAnchor="middle" className="li-ring-denom">
          /100
        </text>
      </svg>
      <span className={`li-ring-band ${cls}`}>{scoreBand(clamped)}</span>
      <span className="li-ring-lbl">{label}</span>
      {hint && <span className="li-ring-hint">{hint}</span>}
    </div>
  );
};

const VerdictIcon: React.FC<{ icon: 'check' | 'warn' | 'x' }> = ({ icon }) => {
  if (icon === 'check')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (icon === 'x')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      <path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const LinkedInAnalyzerModal: React.FC<LinkedInAnalyzerModalProps> = ({
  open,
  onClose,
  loading,
  analysis,
  error,
  targetTitle,
  cachedAt,
  onRefresh,
  onNotification,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editedSuggestions, setEditedSuggestions] = useState<Record<number, string>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  // Inline confirm dialog for the paid Re-analyze action. Replaces the ugly
  // native window.confirm and the two-click button pattern.
  const [showReanalyzeConfirm, setShowReanalyzeConfirm] = useState(false);

  // Reset local editing state whenever a new analysis loads.
  useEffect(() => {
    setEditedSuggestions({});
    setEditingIndex(null);
    setCopiedKey(null);
    setShowReanalyzeConfirm(false);
  }, [analysis]);

  const verdict = useMemo(() => (analysis ? verdictMeta(analysis.verdict) : null), [analysis]);

  if (!open) return null;

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const copy = async (text: string, key: string, silent = false) => {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
      if (!silent) onNotification?.('Copied to clipboard', 'success');
      return true;
    } catch {
      onNotification?.('Could not copy — please select the text manually', 'error');
      return false;
    }
  };

  const openOnLinkedIn = async (
    sectionKey: LinkedInSectionKey,
    text: string,
    key: string,
  ) => {
    setOpeningKey(key);
    try {
      // Put the (possibly edited) suggestion on the clipboard FIRST — this is
      // the actual "insert" mechanism from the user's POV. Clicking LinkedIn's
      // edit button just gets them into the right field with focus.
      const copied = await copy(text, key, true);
      const resp = await chrome.runtime.sendMessage({
        type: 'OPEN_LINKEDIN_EDITOR',
        data: { section: sectionKey },
      });
      if (resp?.success && resp.clicked) {
        onNotification?.(
          copied
            ? "LinkedIn editor opened — press ⌘/Ctrl+V to paste the rewrite."
            : 'LinkedIn editor opened.',
          'success',
        );
      } else if (resp?.success && resp.scrolled) {
        onNotification?.(
          copied
            ? 'Scrolled to the section — click Edit, then paste (⌘/Ctrl+V).'
            : 'Scrolled to the right section on LinkedIn.',
          'info',
        );
      } else {
        onNotification?.(resp?.error || 'Could not open the LinkedIn editor', 'warning');
      }
    } catch (e) {
      onNotification?.((e as Error).message || 'Could not open the LinkedIn editor', 'error');
    } finally {
      setOpeningKey(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlay}>
      <div className="modal-container linkedin-analyzer-modal">
        <div className="modal-header li-modal-header">
          <div className="li-header-title">
            <div className="li-brand-badge" aria-hidden>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
              </svg>
            </div>
            <div>
              <h3>LinkedIn Profile Analyzer</h3>
              <p className="li-subhead">
                Recruiter's-eye view{targetTitle ? ` · target: ${targetTitle}` : ''}
              </p>
              {!loading && analysis && cachedAt && (
                <span className="li-cached-pill" title="Cached result — Re-analyze to spend a credit and refresh">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Analyzed {formatAgo(cachedAt)} · cached
                </span>
              )}
            </div>
          </div>
          <button className="btn-icon modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="li-loading">
              <div className="spinner" />
              <p className="li-loading-title">Reading the profile like a recruiter would…</p>
              <p className="li-loading-sub">
                Checking keywords, headline, About, experience, and search visibility.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <p>{error}</p>
              <button className="btn primary small" onClick={onRefresh} style={{ marginTop: 12 }}>
                Try again
              </button>
            </div>
          )}

          {!loading && !error && !analysis && (
            <div className="empty-state">
              <p>Open a LinkedIn profile (linkedin.com/in/…), then click Analyze.</p>
              <button className="btn primary small" onClick={onRefresh} style={{ marginTop: 12 }}>
                Run analysis
              </button>
            </div>
          )}

          {!loading && analysis && (
            <div className="linkedin-analysis-content">
              {/* Scores row */}
              <div className="li-rings-block">
                <p className="li-rings-caption">
                  How a recruiter would score this profile (0–100, higher is better)
                </p>
                <div className="li-rings-row">
                  <ScoreRing
                    score={analysis.overallScore}
                    label="Overall"
                    hint="Rollup of everything below"
                  />
                  <ScoreRing
                    score={analysis.recruiterFitScore}
                    label="Recruiter fit"
                    hint="Would a recruiter shortlist you?"
                  />
                  <ScoreRing
                    score={analysis.searchVisibilityScore}
                    label="Search visibility"
                    hint="Would you show up in LinkedIn Recruiter search?"
                  />
                </div>
              </div>

              {verdict && (
                <div className={`li-verdict li-verdict-${verdict.tone}`}>
                  <div className="li-verdict-icon">
                    <VerdictIcon icon={verdict.icon} />
                  </div>
                  <div className="li-verdict-body">
                    <span className="li-verdict-lbl">Recruiter verdict</span>
                    <span className="li-verdict-val">{verdict.text}</span>
                  </div>
                </div>
              )}

              {analysis.summary && <p className="li-summary">{analysis.summary}</p>}

              {/* Priority fixes */}
              {analysis.priorityFixes?.length > 0 && (
                <section className="li-section li-priority">
                  <div className="li-section-heading">
                    <h5 className="li-section-title accent">Do these first</h5>
                    <span className="li-section-count">{analysis.priorityFixes.length}</span>
                  </div>
                  <ol className="li-fix-list">
                    {analysis.priorityFixes.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Recruiter search */}
              {analysis.recruiterSearch && (
                <section className="li-section">
                  <div className="li-section-heading">
                    <h5 className="li-section-title">LinkedIn Recruiter search</h5>
                  </div>

                  {analysis.recruiterSearch.presentKeywords?.length > 0 && (
                    <KeywordGroup
                      label="Found"
                      chips={analysis.recruiterSearch.presentKeywords}
                      tone="good"
                      onChipClick={(kw) => copy(kw, `chip-p-${kw}`)}
                      copiedKey={copiedKey}
                      keyPrefix="chip-p"
                    />
                  )}
                  {analysis.recruiterSearch.missingKeywords?.length > 0 && (
                    <KeywordGroup
                      label="Missing"
                      chips={analysis.recruiterSearch.missingKeywords}
                      tone="warn"
                      onChipClick={(kw) => copy(kw, `chip-m-${kw}`)}
                      copiedKey={copiedKey}
                      keyPrefix="chip-m"
                    />
                  )}
                  {analysis.recruiterSearch.recommendedKeywords?.length > 0 && (
                    <KeywordGroup
                      label="Own these"
                      chips={analysis.recruiterSearch.recommendedKeywords}
                      tone="neutral"
                      onChipClick={(kw) => copy(kw, `chip-r-${kw}`)}
                      copiedKey={copiedKey}
                      keyPrefix="chip-r"
                      onCopyAll={() =>
                        copy(
                          analysis.recruiterSearch.recommendedKeywords.join(', '),
                          'kw-recommended',
                        )
                      }
                      copyAllLabel={
                        copiedKey === 'kw-recommended' ? 'Copied ✓' : 'Copy all'
                      }
                    />
                  )}
                  {analysis.recruiterSearch.searchabilityTips?.length > 0 && (
                    <ul className="li-tip-list">
                      {analysis.recruiterSearch.searchabilityTips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {/* Section-by-section */}
              {analysis.sections?.length > 0 && (
                <section className="li-section">
                  <div className="li-section-heading">
                    <h5 className="li-section-title">Section-by-section</h5>
                  </div>
                  <div className="li-section-cards">
                    {analysis.sections.map((s, i) => (
                      <SectionCard
                        key={i}
                        index={i}
                        section={s}
                        editedText={editedSuggestions[i] ?? s.suggestion ?? ''}
                        isEditing={editingIndex === i}
                        onToggleEdit={() =>
                          setEditingIndex((cur) => (cur === i ? null : i))
                        }
                        onChange={(v) =>
                          setEditedSuggestions((m) => ({ ...m, [i]: v }))
                        }
                        onCopy={(text) => copy(text, `sec-${i}`)}
                        onOpenOnLinkedIn={(sectionKey, text) =>
                          openOnLinkedIn(sectionKey, text, `sec-${i}`)
                        }
                        copied={copiedKey === `sec-${i}`}
                        opening={openingKey === `sec-${i}`}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn secondary small"
            onClick={() => {
              // First-run (no cached analysis yet) or error retry — no
              // confirm needed since there's nothing to displace.
              if (!analysis || !cachedAt) {
                onRefresh();
                return;
              }
              setShowReanalyzeConfirm(true);
            }}
            disabled={loading}
            title={
              analysis && cachedAt
                ? 'Re-analyze — uses one AI credit'
                : 'Run analysis'
            }
          >
            {loading
              ? 'Analyzing…'
              : analysis && cachedAt
                ? 'Re-analyze (uses 1 credit)'
                : 'Re-analyze'}
          </button>
          <button className="btn primary small" onClick={onClose}>
            Done
          </button>
        </div>

        {/* In-modal Re-analyze confirmation — replaces the native browser
            confirm() dialog. Overlays this modal's body only, so the user
            never leaves the analyzer context. */}
        {showReanalyzeConfirm && (
          <div
            className="li-confirm-scrim"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowReanalyzeConfirm(false);
            }}
          >
            <div className="li-confirm-card" role="dialog" aria-modal="true">
              <div className="li-confirm-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h4 className="li-confirm-title">Re-analyze this profile?</h4>
              <p className="li-confirm-body">
                This uses <strong>1 AI credit</strong> and replaces the cached result.
                The current analysis will be lost.
              </p>
              <div className="li-confirm-actions">
                <button
                  className="btn secondary small"
                  onClick={() => setShowReanalyzeConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn primary small"
                  onClick={() => {
                    setShowReanalyzeConfirm(false);
                    onRefresh();
                  }}
                >
                  Yes, re-analyze
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Sub-components -----------------------------------------------------

interface KeywordGroupProps {
  label: string;
  chips: string[];
  tone: 'good' | 'warn' | 'neutral';
  onChipClick: (kw: string) => void;
  copiedKey: string | null;
  keyPrefix: string;
  onCopyAll?: () => void;
  copyAllLabel?: string;
}

const KeywordGroup: React.FC<KeywordGroupProps> = ({
  label,
  chips,
  tone,
  onChipClick,
  copiedKey,
  keyPrefix,
  onCopyAll,
  copyAllLabel,
}) => {
  const chipClass =
    tone === 'good'
      ? 'li-chip li-chip-good'
      : tone === 'warn'
        ? 'li-chip li-chip-warn'
        : 'li-chip';
  return (
    <div className="li-kw-group">
      <div className="li-kw-group-header">
        <span className="li-kw-lbl">{label}</span>
        {onCopyAll && (
          <button className="li-copy-btn" onClick={onCopyAll}>
            {copyAllLabel}
          </button>
        )}
      </div>
      <div className="li-kw-chips">
        {chips.map((k, i) => {
          const key = `${keyPrefix}-${k}`;
          const active = copiedKey === key;
          return (
            <button
              key={i}
              type="button"
              className={`${chipClass} li-chip-interactive${active ? ' active' : ''}`}
              onClick={() => onChipClick(k)}
              title="Click to copy"
            >
              {k}
              {active && <span className="li-chip-check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface SectionCardProps {
  index: number;
  section: LinkedInSectionAnalysis;
  editedText: string;
  isEditing: boolean;
  onToggleEdit: () => void;
  onChange: (v: string) => void;
  onCopy: (text: string) => void;
  onOpenOnLinkedIn: (key: LinkedInSectionKey, text: string) => void;
  copied: boolean;
  opening: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({
  section,
  editedText,
  isEditing,
  onToggleEdit,
  onChange,
  onCopy,
  onOpenOnLinkedIn,
  copied,
  opening,
}) => {
  const sectionKey = sectionKeyFor(section.name);
  const rows = Math.min(12, Math.max(3, Math.ceil((editedText || '').length / 55)));
  return (
    <div className="li-section-card">
      <div className="li-section-card-header">
        <span className="li-section-card-name">{section.name}</span>
        <span className={`li-section-card-score ${scoreClass(section.score)}`}>
          {section.score}
        </span>
      </div>

      {section.findings?.length > 0 && (
        <ul className="li-findings">
          {section.findings.map((f, j) => (
            <li key={j}>{f}</li>
          ))}
        </ul>
      )}

      {section.suggestion && (
        <div className="li-suggestion">
          <div className="li-suggestion-header">
            <span className="li-suggestion-lbl">Suggested rewrite</span>
            <div className="li-suggestion-actions">
              <button
                className="li-action-btn"
                onClick={onToggleEdit}
                title={isEditing ? 'Done editing' : 'Edit before copying'}
              >
                {isEditing ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Done
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path
                        d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Edit
                  </>
                )}
              </button>
              <button
                className="li-action-btn"
                onClick={() => onCopy(editedText)}
                title="Copy to clipboard"
              >
                {copied ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" strokeLinejoin="round" />
                      <path
                        d="M5 15V5a2 2 0 012-2h10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              {sectionKey && (
                <button
                  className="li-action-btn primary"
                  onClick={() => onOpenOnLinkedIn(sectionKey, editedText)}
                  disabled={opening}
                  title="Copy the rewrite and open LinkedIn's editor for this section"
                >
                  {opening ? (
                    'Opening…'
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path
                          d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Insert on LinkedIn
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          {isEditing ? (
            <textarea
              className="li-suggestion-editor"
              value={editedText}
              onChange={(e) => onChange(e.target.value)}
              rows={rows}
              spellCheck
              autoFocus
            />
          ) : (
            <p className="li-suggestion-body">{editedText}</p>
          )}
        </div>
      )}
    </div>
  );
};
