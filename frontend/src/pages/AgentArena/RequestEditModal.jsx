import React, { useEffect, useRef, useState } from 'react';
import {
  ModalOverlay,
  ModalCard,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalTextarea,
  ModalSelect,
  ModalLabel,
  Btn,
} from './styled';

/**
 * RequestEditModal · replacement for the old window.prompt() call on
 * the Review page.
 *
 * Gives the user a proper form: pick which section the agent should
 * rework (summary, experience, cover, answers) and leave free-text
 * instructions. On submit we call `onSubmit({section, instruction})`
 * which the parent hands off to `applyPilotAPI.requestEdit(...)`.
 *
 * UX niceties:
 *   · Textarea is auto-focused when the modal opens
 *   · Escape closes, Cmd/Ctrl+Enter submits
 *   · Clicking the backdrop closes (not during submit)
 *   · Submit is disabled until there's a non-empty instruction
 */
const SECTIONS = [
  { value: 'summary', label: 'Resume summary' },
  { value: 'experience', label: 'Resume experience bullets' },
  { value: 'cover', label: 'Cover letter' },
  { value: 'answers', label: 'Screener answers' },
];

const RequestEditModal = ({
  open,
  defaultSection = 'summary',
  companyName,
  onClose,
  onSubmit,
}) => {
  const [section, setSection] = useState(defaultSection);
  const [instruction, setInstruction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);

  // Reset local state when the modal opens so previous text doesn't leak.
  useEffect(() => {
    if (open) {
      setSection(defaultSection);
      setInstruction('');
      setSubmitting(false);
    }
  }, [open, defaultSection]);

  // Auto-focus textarea on open.
  useEffect(() => {
    if (open && textareaRef.current) {
      const t = setTimeout(() => textareaRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Global key handling while modal is open.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!submitting) onClose?.();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (instruction.trim() && !submitting) doSubmit();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, instruction, submitting, onClose]);

  const doSubmit = async () => {
    const text = instruction.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await onSubmit?.({ section, instruction: text });
      onClose?.();
    } catch (err) {
      console.warn('[RequestEditModal] submit failed:', err?.message);
      window.alert(
        `Couldn't send the edit request. ${err?.message || 'Please try again.'}`,
      );
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const canSubmit = instruction.trim().length > 0 && !submitting;

  return (
    <ModalOverlay
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-edit-title"
    >
      <ModalCard>
        <ModalHeader>
          <h3 id="request-edit-title">Request an edit</h3>
          <p>
            Tell the agent what to change about
            {companyName ? ` the ${companyName} application` : ' this application'}.
            It will redraft the selected section using your guidance and
            the training memory.
          </p>
        </ModalHeader>
        <ModalBody>
          <div>
            <ModalLabel htmlFor="request-edit-section">Section</ModalLabel>
            <ModalSelect
              id="request-edit-section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              disabled={submitting}
            >
              {SECTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </ModalSelect>
          </div>
          <div>
            <ModalLabel htmlFor="request-edit-instruction">What should change?</ModalLabel>
            <ModalTextarea
              id="request-edit-instruction"
              ref={textareaRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Lead with the measurable checkout impact, drop the mentorship bullet, keep it to three short sentences."
              disabled={submitting}
            />
            <div style={{ fontSize: 11.5, color: '#6B6787', marginTop: 4 }}>
              Tip: ⌘/Ctrl + Enter to send · Esc to close
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn $size="sm" $variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Btn>
          <Btn
            $size="sm"
            $variant="primary"
            onClick={doSubmit}
            disabled={!canSubmit}
          >
            {submitting ? 'Sending…' : 'Send to agent'}
          </Btn>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
};

export default RequestEditModal;
