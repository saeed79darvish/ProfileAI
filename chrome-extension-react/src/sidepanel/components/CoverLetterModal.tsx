import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

type Tone = 'professional' | 'conversational' | 'enthusiastic';
type Length = 'short' | 'medium' | 'long';

const LENGTH_OPTIONS: { value: Length; label: string; desc: string }[] = [
  { value: 'short', label: 'Short', desc: '~150 words' },
  { value: 'medium', label: 'Medium', desc: '~250 words' },
  { value: 'long', label: 'Long', desc: '~400 words' },
];

interface CoverLetterModalProps {
  open: boolean;
  onClose: () => void;
  jobTitle?: string;
  company?: string;
  jobUrl?: string;
  onGenerate: (tone: Tone, length: Length) => Promise<string | null>;
  onNotification: (message: string, type: 'success' | 'warning' | 'info' | 'error') => void;
  /** A generation started before this modal mounted is still running in the
   *  service worker — show the spinner even though we didn't start it. */
  backgroundGenerating?: boolean;
  /** A letter that finished in the background. The `ts` makes a re-run with
   *  identical text still count as a new result. */
  backgroundLetter?: { text: string; ts: number } | null;
}

export const CoverLetterModal: React.FC<CoverLetterModalProps> = ({
  open,
  onClose,
  jobTitle,
  company,
  jobUrl,
  onGenerate,
  onNotification,
  backgroundGenerating = false,
  backgroundLetter = null,
}) => {
  const [coverLetter, setCoverLetter] = useState('');
  const [ownGenerating, setOwnGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const generating = ownGenerating || backgroundGenerating;
  const [tone] = useState<Tone>('conversational');
  const [length, setLength] = useState<Length>('short');
  const [copied, setCopied] = useState(false);

  // Restore any cached letter for this job when the modal opens. The
  // cache survives panel close/reopen and tab switches. We resolve the
  // job URL from the active tab when one isn't passed in.
  const [resolvedJobUrl, setResolvedJobUrl] = useState<string>('');
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      let url = jobUrl || '';
      if (!url) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          url = tab?.url || '';
        } catch {
          url = '';
        }
      }
      if (cancelled) return;
      setResolvedJobUrl(url);
      if (!url) return;
      try {
        const { coverLetterCache = {} } = await chrome.storage.local.get('coverLetterCache');
        const cached = coverLetterCache[url];
        if (!cancelled && cached?.coverLetter) {
          setCoverLetter(cached.coverLetter);
          setGenerated(true);
        }
      } catch {
        // ignore — cache is best-effort
      }
    })();
    return () => { cancelled = true; };
  }, [open, jobUrl]);

  // A letter that landed in the background (panel was closed, or reopened
  // mid-run) wins over whatever the cache effect above restored.
  useEffect(() => {
    if (!backgroundLetter?.text) return;
    setCoverLetter(backgroundLetter.text);
    setGenerated(true);
    setOwnGenerating(false);
  }, [backgroundLetter?.ts, backgroundLetter?.text]);

  if (!open) return null;

  const persistLetter = async (letter: string) => {
    if (!resolvedJobUrl) return;
    try {
      const { coverLetterCache = {} } = await chrome.storage.local.get('coverLetterCache');
      coverLetterCache[resolvedJobUrl] = {
        coverLetter: letter,
        jobTitle,
        company,
        savedAt: Date.now(),
      };
      await chrome.storage.local.set({ coverLetterCache });
    } catch {
      // ignore
    }
  };

  const handleGenerate = async () => {
    setOwnGenerating(true);
    setCoverLetter('');
    try {
      const result = await onGenerate(tone, length);
      if (result) {
        setCoverLetter(result);
        setGenerated(true);
        await persistLetter(result);
      }
    } catch {
      onNotification('Failed to generate cover letter', 'error');
    } finally {
      setOwnGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coverLetter);
    } catch {
      // Fallback for environments where clipboard API is unavailable
      const textarea = document.createElement('textarea');
      textarea.value = coverLetter;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const safeName = (jobTitle || 'Job')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .replace(/\s+/g, '_');
    const safeCompany = (company || '')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .replace(/\s+/g, '_');
    const filename = safeCompany
      ? `Cover_Letter_${safeName}_${safeCompany}.txt`
      : `Cover_Letter_${safeName}.txt`;

    // Use data URL + chrome.downloads API (blob URLs don't work in extension sidepanel)
    const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(coverLetter);
    if (typeof chrome !== 'undefined' && chrome.downloads) {
      chrome.downloads.download({
        url: dataUrl,
        filename,
        saveAs: true,
      }, () => {
        onNotification('Cover letter downloaded!', 'success');
      });
    } else {
      // Fallback for non-extension context
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onNotification('Cover letter downloaded!', 'success');
    }
  };

  const handleClose = () => {
    setCoverLetter('');
    setGenerated(false);
    onClose();
  };

  return createPortal(
    <div className="cl-modal-overlay" onClick={handleClose}>
      <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cl-modal-header">
          <h3 className="cl-modal-title">✉️ Cover Letter</h3>
          <button className="cl-modal-close" onClick={handleClose} disabled={generating}>
            ✕
          </button>
        </div>

        {/* Job info */}
        {(jobTitle || company) && (
          <div className="cl-job-info">
            {jobTitle && <span className="cl-job-title">{jobTitle}</span>}
            {company && <span className="cl-job-company">{jobTitle ? ` at ${company}` : company}</span>}
          </div>
        )}

        {/* Options & Generate (before generation) */}
        {!generated && !generating && (
          <div className="cl-generate-section">
            {/* Length selector */}
            <div className="cl-option-group">
              <label className="cl-option-label">Length</label>
              <div className="cl-option-chips">
                {LENGTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`cl-chip ${length === opt.value ? 'active' : ''}`}
                    onClick={() => setLength(opt.value)}
                  >
                    <span className="cl-chip-label">{opt.label}</span>
                    <span className="cl-chip-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <button className="cl-generate-btn" onClick={handleGenerate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Generate Cover Letter
            </button>
          </div>
        )}

        {/* Loading state */}
        {generating && (
          <div className="cl-loading">
            <svg className="icon-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" />
            </svg>
            <span>Generating your cover letter...</span>
            <span className="cl-loading-hint">This keeps running if you close the panel.</span>
          </div>
        )}

        {/* Cover letter content */}
        {generated && coverLetter && (
          <>
            <div className="cl-content-wrapper">
              <textarea
                className="cl-textarea"
                value={coverLetter}
                onChange={(e) => {
                  const v = e.target.value;
                  setCoverLetter(v);
                  // persist edits so a panel close + reopen restores the user's
                  // manual tweaks, not just the original generation.
                  void persistLetter(v);
                }}
                rows={14}
              />
            </div>

            {/* Action buttons */}
            <div className="cl-actions">
              <button className="cl-btn copy" onClick={handleCopy}>
                {copied ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button className="cl-btn download" onClick={handleDownload}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </button>
              <button className="cl-btn regenerate" onClick={handleGenerate} disabled={generating}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Regenerate
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
