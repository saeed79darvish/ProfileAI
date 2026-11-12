import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CONFIG } from '../../config';

/**
 * The first-run tour, drawn inside the real side panel on top of its own controls.
 *
 * Nothing here is a copy of the panel: each step finds the real element on screen
 * (the profile card, the Analyze row, Answer Questions, Quick Fill Basics ...) and
 * spotlights it, so the tour is on whatever job page the person is on and stays in
 * step with the panel as it changes. A step whose control is not on screen (no job
 * detected yet, say) shows its card without a spotlight rather than being skipped.
 */

export type TourMode = 'signedIn' | 'signedOut';

interface Step {
  title: string;
  body: string;
  /** The control this step is about, found by the step in the live panel. */
  find?: (root: HTMLElement) => HTMLElement | null;
  /** Label for the last step's button. */
  cta?: string;
}

const byText = (selector: string, text: string) => (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>(selector)].find((el) => el.textContent?.toLowerCase().includes(text.toLowerCase())) || null;

const SIGNED_IN: Step[] = [
  {
    title: 'Your profile',
    body: 'Everything ProfilleAI fills, scores and writes comes from your profile. View Full opens it on ProfilleAI, where you can edit it.',
    find: (r) => r.querySelector('.profile-compact'),
  },
  {
    title: 'Analyze the job, before you apply',
    body: 'On the job description page, ProfilleAI detects the job and shows it here. Click Analyze to see your match score, what your resume already evidences, what is only partly there, and the gaps ranked by impact. It also shows how high tailoring could take your score.',
    find: (r) => r.querySelector('.jm-job-row') || r.querySelector('.jm-section'),
  },
  {
    title: 'Answer Questions, on the application',
    body: 'On the application form, click Answer Questions. ProfilleAI reads the questions and drafts answers from your profile and what you have told it, never guessed. Nothing is submitted for you.',
    find: (r) => r.querySelector('.smart-answers-headline'),
  },
  {
    title: 'Quick Fill Basics',
    body: 'One click fills your name, email, phone, location and links on the form. It only touches reliable text fields.',
    find: byText('button.action-btn', 'Quick Fill'),
  },
  {
    title: 'Autofill settings',
    body: 'Choose how empty fields get filled: from your saved answers, and from AI-generated answers for what is left. Turn either off here.',
    find: byText('.panel-section', 'Autofill Settings'),
  },
  {
    title: 'Tailor your resume for this job',
    body: 'Tailor Profile works in four steps. Fit: answer I have this or I do not for each gap. Plan: pick the changes for your title, summary, skills and experience. Review: compare before and after, and keep or skip each. Apply: download a PDF or Word file. It uses one credit, and is unlimited on Pro.',
    find: byText('button.action-btn', 'Tailor'),
  },
  {
    title: 'Cover letter',
    body: 'Pick Short, Medium or Long and ProfilleAI writes a cover letter for this job from your profile. You can edit it, then Copy, Download or Regenerate.',
    find: byText('button.action-btn', 'Cover Letter'),
  },
  {
    title: 'Add experience by voice',
    body: 'Say what you did at work and ProfilleAI adds it to your resume, so the next tailored resume has more to work with.',
    find: byText('button.action-btn', 'Add Experience'),
  },
  {
    title: 'Saved answers',
    body: 'Answers you give on applications are remembered and filled in the next time the same kind of question comes up. Manage them here.',
    find: byText('.panel-section', 'Saved Answers'),
  },
  {
    title: 'You are ready',
    body: 'Open any job posting, Analyze it, then apply with Quick Fill, Answer Questions and a tailored resume. Find a job to start.',
    cta: 'Find jobs',
  },
];

const SIGNED_OUT: Step[] = [
  {
    title: 'Sign in here',
    body: 'Use Google, LinkedIn or your email. Your profile and saved answers come with you, and this tour continues with each section once you are in.',
    find: (r) => byText('button', 'I already have an account')(r) || byText('button', 'Sign in')(r) || byText('button', 'Continue with Google')(r) || r.querySelector('.reconnect-card'),
  },
  {
    title: 'New here? Create your profile first',
    body: 'ProfilleAI fills your applications, scores your fit and tailors your resume from your profile. Creating it takes about two minutes, and it syncs straight to this panel.',
    find: (r) => byText('button', 'Build my free profile')(r) || byText('button', 'Create one free')(r) || byText('a', 'Create one free')(r),
  },
];

interface Props {
  mode: TourMode;
  onClose: (finished: boolean) => void;
}

export const PanelTour: React.FC<Props> = ({ mode, onClose }) => {
  const steps = mode === 'signedIn' ? SIGNED_IN : SIGNED_OUT;
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardTop, setCardTop] = useState<number | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  const measure = useCallback(() => {
    const root = document.querySelector<HTMLElement>('.app');
    const el = root && step.find ? step.find(root) : null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    setRect(el.getBoundingClientRect());
  }, [step]);

  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    // The panel can still be loading its job or profile when the tour opens.
    const t = window.setTimeout(measure, 400);
    window.addEventListener('resize', measure);
    return () => { window.clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [measure]);

  // Put the card below the spotlight, or above it when there is no room below.
  useLayoutEffect(() => {
    const h = card.current?.offsetHeight || 190;
    if (!rect) { setCardTop(null); return; }
    const below = rect.bottom + 12;
    setCardTop(below + h + 8 <= window.innerHeight ? below : Math.max(8, rect.top - h - 12));
  }, [rect, i]);

  const finish = (done: boolean) => onClose(done);
  const next = () => {
    if (last) {
      if (step.cta) chrome.tabs.create({ url: `${CONFIG.WEB_BASE}/jobs` });
      finish(true);
    } else setI(i + 1);
  };

  return (
    <div className="ptour" role="dialog" aria-label="ProfilleAI tour">
      {rect ? (
        <div className="ptour-spot" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />
      ) : (
        <div className="ptour-shade" />
      )}
      <div className={`ptour-card ${rect ? '' : 'centered'}`} ref={card} style={rect && cardTop !== null ? { top: cardTop } : undefined}>
        <div className="ptour-count">{i + 1} of {steps.length}</div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="ptour-row">
          {i > 0 ? <button className="ptour-ghost" onClick={() => setI(i - 1)}>Back</button> : <button className="ptour-ghost" onClick={() => finish(false)}>Skip tour</button>}
          <div className="ptour-dots">{steps.map((_, k) => <span key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}</div>
          <button className="ptour-primary" onClick={next}>{last ? (step.cta || 'Done') : 'Next'}</button>
        </div>
        {i > 0 && !last && <button className="ptour-skip" onClick={() => finish(false)}>Skip tour</button>}
      </div>
    </div>
  );
};
