import React, { useState } from 'react';
import { MicCapture, openMicPermissionPage } from './MicCapture';
import { experienceFromSpeech, appendExperience, type ExperienceProposal } from '../memoryApi';
import type { MicProblem } from '../../answerMemory';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'start' | 'transcript' | 'working' | 'review' | 'saving' | 'done';

const PRIVACY_LINE = 'This stays private. We never share it, and we only use it to answer the custom questions on your applications.';

/** Say what you did, review up to three bullets, add them to a role. */
export const AddExperienceModal: React.FC<Props> = ({ open, onClose }) => {
  const [step, setStep] = useState<Step>('start');
  const [transcript, setTranscript] = useState('');
  const [micProblem, setMicProblem] = useState<{ problem: MicProblem; message: string } | null>(null);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<ExperienceProposal | null>(null);
  const [bullets, setBullets] = useState<string[]>([]);
  const [roleIndex, setRoleIndex] = useState<number | ''>('');
  const [followText, setFollowText] = useState('');
  const [addedTo, setAddedTo] = useState('');

  if (!open) return null;

  const reset = () => {
    setStep('start'); setTranscript(''); setMicProblem(null); setError('');
    setProposal(null); setBullets([]); setRoleIndex(''); setFollowText(''); setAddedTo('');
  };
  const close = () => { reset(); onClose(); };

  const extract = async (text: string) => {
    setError('');
    setStep('working');
    const res = await experienceFromSpeech(text);
    if (!res.ok) {
      setError(res.error);
      setStep('transcript');
      return;
    }
    setProposal(res.data);
    setBullets(res.data.bullets);
    setRoleIndex(res.data.roleIndex ?? '');
    setFollowText('');
    setStep('review');
  };

  const refineWithDetail = () => {
    const merged = `${transcript.trim()} ${followText.trim()}`.trim();
    setTranscript(merged);
    void extract(merged);
  };

  const confirm = async () => {
    if (roleIndex === '' || bullets.filter((b) => b.trim()).length === 0) return;
    setStep('saving');
    setError('');
    const clean = bullets.map((b) => b.trim()).filter(Boolean);
    const res = await appendExperience(roleIndex, clean);
    if (!res.ok) {
      setError(res.error || 'Could not add that to your experience.');
      setStep('review');
      return;
    }
    const role = proposal?.roleCandidates.find((r) => r.index === roleIndex);
    setAddedTo(role?.company || role?.title || 'your experience');
    setStep('done');
  };

  const role = proposal?.roleCandidates.find((r) => r.index === roleIndex);
  const roleName = role ? (role.company || role.title) : '';
  const usable = bullets.filter((b) => b.trim()).length;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-container smart-answers-modal">
        <div className="modal-header">
          <div>
            <h3>Add to my experience</h3>
            <p className="smart-answers-subtitle">Say what you did. We turn it into resume bullets.</p>
          </div>
          <button className="btn-icon modal-close" onClick={close} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {step === 'start' && (
            <div className="ax-stack">
              <p className="ax-lead">Tell us about something you did at work, in your own words. A minute is plenty.</p>
              <MicCapture
                label="Speak"
                onText={(t) => { setTranscript(t); setStep('transcript'); }}
                onProblem={(problem, message) => { setMicProblem({ problem, message }); }}
              />
              {micProblem && (
                <div className="ax-callout">
                  <p>{micProblem.message} You can type it instead.</p>
                  {micProblem.problem === 'denied' && (
                    <button className="aq-link" onClick={openMicPermissionPage}>Allow the microphone</button>
                  )}
                </div>
              )}
              <button className="aq-btn" onClick={() => setStep('transcript')}>Type instead</button>
              <p className="aq-privacy">{PRIVACY_LINE}</p>
            </div>
          )}

          {step === 'transcript' && (
            <div className="ax-stack">
              <label className="ax-label" htmlFor="ax-transcript">What you did</label>
              <textarea
                id="ax-transcript"
                className="aq-edit"
                rows={6}
                value={transcript}
                placeholder="For example: I moved our alerts to Grafana and cut noisy pages for the on call team."
                onChange={(e) => setTranscript(e.target.value)}
                autoFocus
              />
              {error && <p className="aq-error">{error}</p>}
              <div className="aq-actions">
                <button className="aq-btn primary" disabled={!transcript.trim()} onClick={() => extract(transcript)}>Write the bullets</button>
                <MicCapture label="Speak again" onText={(t) => setTranscript((prev) => `${prev.trim()} ${t}`.trim())} onProblem={(p, m) => setMicProblem({ problem: p, message: m })} />
              </div>
              {micProblem && <p className="aq-note">{micProblem.message} Typing works the same.</p>}
            </div>
          )}

          {step === 'working' && (
            <div className="smart-answers-status"><div className="spinner" /><p>Writing your bullets</p></div>
          )}

          {(step === 'review' || step === 'saving') && proposal && (
            <div className="ax-stack">
              <span className="ax-label">Proposed bullets</span>
              {bullets.map((b, i) => (
                <div className="ax-bullet" key={i}>
                  <textarea
                    className="aq-edit"
                    rows={2}
                    value={b}
                    aria-label={`Bullet ${i + 1}`}
                    onChange={(e) => setBullets((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <button className="aq-link" onClick={() => setBullets((prev) => prev.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
              {bullets.length === 0 && <p className="aq-note">All bullets removed. Go back to write new ones.</p>}

              <label className="ax-label" htmlFor="ax-role">Which role is this for</label>
              <select
                id="ax-role"
                className="aq-input"
                value={roleIndex}
                onChange={(e) => setRoleIndex(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Choose a role</option>
                {proposal.roleCandidates.map((r) => (
                  <option key={r.index} value={r.index}>{r.title}{r.company ? ` at ${r.company}` : ''}</option>
                ))}
              </select>

              {proposal.followUp && (
                <div className="ax-callout">
                  <p className="ax-follow">{proposal.followUp}</p>
                  <textarea
                    className="aq-edit"
                    rows={2}
                    value={followText}
                    placeholder="Type your answer, or speak it"
                    onChange={(e) => setFollowText(e.target.value)}
                  />
                  <div className="aq-actions">
                    <MicCapture label="Speak" onText={(t) => setFollowText((p) => `${p.trim()} ${t}`.trim())} onProblem={(p, m) => setMicProblem({ problem: p, message: m })} />
                    <button className="aq-btn" disabled={!followText.trim() || step === 'saving'} onClick={refineWithDetail}>Update the bullets</button>
                  </div>
                  {micProblem && <p className="aq-note">{micProblem.message} Typing works the same.</p>}
                </div>
              )}
              {error && <p className="aq-error">{error}</p>}
              <p className="aq-privacy">{PRIVACY_LINE}</p>
            </div>
          )}

          {step === 'done' && (
            <div className="ax-done">
              <div className="ax-check" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="22" height="22" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="ax-done-title">Added to {addedTo}.</p>
              <p className="ax-lead">Your next tailored resume will use it.</p>
            </div>
          )}
        </div>

        <div className="modal-footer aq-footer">
          {(step === 'review' || step === 'saving') && (
            <button
              className="btn primary aq-fill-all"
              disabled={step === 'saving' || roleIndex === '' || usable === 0}
              onClick={confirm}
            >
              {step === 'saving' ? 'Adding' : roleName ? `Add to ${roleName}` : 'Add to my experience'}
            </button>
          )}
          {step === 'done' && (
            <>
              <button className="btn primary aq-fill-all" onClick={reset}>Add another</button>
              <button className="aq-btn" onClick={close}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
