import React from 'react';
import styled from 'styled-components';
import { Dialog, useMediaQuery } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { hideWhileTyping } from '@/styles/keyboard';

/*
 * The full-screen step flows (Enhance with AI, Tailor for a Job): a fixed
 * header with title, close and a step bar; a scrolling body; a fixed footer
 * for the step's action. Full screen on phones, a tall dialog on desktop.
 * Inputs are 16px so iPhone Safari doesn't zoom in on focus.
 */

export const Shell = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f3f4f8;
  color: #13152a;
`;

export const Header = styled.div`
  flex-shrink: 0;
  padding: 16px 16px 12px;
  background: #fff;
  border-bottom: 1px solid #e8e9f0;

  .top { display: flex; align-items: flex-start; gap: 12px; }
  .titles { flex: 1; min-width: 0; }
  h3 { margin: 0; font-size: 20px; font-weight: 700; line-height: 1.25; }
  .subtitle { margin-top: 2px; font-size: 14px; color: #6b7280; }

  .close {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 14px;
    background: #f1f2f6;
    color: #13152a;
    cursor: pointer;
    svg { font-size: 22px; }
  }

  @media (min-width: 769px) { padding: 20px 24px 14px; }
`;

export const Steps = styled.ol`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;

  li {
    font-size: 13.5px;
    font-weight: 600;
    color: #9ca3af;

    &::before {
      content: '';
      display: block;
      height: 5px;
      margin-bottom: 8px;
      border-radius: 999px;
      background: #e5e7ef;
    }
  }

  li[data-done='true'] { color: #13152a; }
  li[data-done='true']::before { background: #5b5fd6; }
`;

export const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 18px 16px 24px;

  @media (min-width: 769px) { padding: 20px 24px 28px; }
`;

export const Footer = styled.div`
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  padding: 14px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  border-top: 1px solid #e8e9f0;

  @media (min-width: 769px) { padding: 14px 24px 18px; }

  ${hideWhileTyping}
`;

export const PrimaryBtn = styled.button`
  flex: 1;
  height: 54px;
  border: none;
  border-radius: 14px;
  background: #5b5fd6;
  color: #fff;
  font: inherit;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export const SecondaryBtn = styled.button`
  flex: 0 0 34%;
  height: 54px;
  border: 1.5px solid #e2e4ec;
  border-radius: 14px;
  background: #fff;
  color: #13152a;
  font: inherit;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
`;

export const Label = styled.div`
  margin: 0 2px 10px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #5a5e7a;
`;

export const TextInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  height: 52px;
  padding: 0 16px;
  border: 1.5px solid #e2e4ec;
  border-radius: 14px;
  background: #fff;
  font: inherit;
  font-size: 16px;
  color: #13152a;
  outline: none;

  &:focus { border-color: #5b5fd6; }
  &::placeholder { color: #9ca3af; }
`;

export const Centered = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 56px 12px;
  text-align: center;
  color: #5a5e7a;
  font-size: 15px;
  line-height: 1.5;

  strong { color: #13152a; font-size: 17px; }
`;

export const Hint = styled.p`
  margin: 0 2px 14px;
  font-size: 15px;
  line-height: 1.45;
  color: #6b7280;
`;

export const ChangeCard = styled.div`
  margin-bottom: 14px;
  padding: 16px;
  border-radius: 18px;
  background: #fff;
  border: 1.5px solid ${p => (p.$kept ? '#d9dafa' : '#e8e9f0')};
  opacity: ${p => (p.$kept ? 1 : 0.6)};

  .head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
  .label {
    flex: 1;
    min-width: 0;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #5a5e7a;
  }

  .before {
    margin: 0 0 10px;
    font-size: 14.5px;
    line-height: 1.5;
    color: #9ca3af;
    text-decoration: line-through;
    white-space: pre-line;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .after {
    margin: 0;
    padding-left: 14px;
    border-left: 4px solid #5b5fd6;
    font-size: 16px;
    line-height: 1.5;
    white-space: pre-line;
  }
`;

export const KeepBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1.5px solid #5b5fd6;
  background: ${p => (p.$kept ? '#5b5fd6' : '#fff')};
  color: ${p => (p.$kept ? '#fff' : '#5b5fd6')};
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  svg { font-size: 17px; }
`;

export const ErrorText = styled.p`
  margin: 0 0 12px;
  font-size: 14px;
  color: #b42318;
`;

/**
 * @param {Object} props
 * @param {string[]} [props.steps] - step names for the bar
 * @param {number} [props.stepIndex] - the current step; earlier ones show done
 * @param {React.ReactNode} [props.headerExtra] - in place of the step bar
 * @param {boolean} [props.busy] - blocks closing while work is in flight
 * @param {React.ReactNode} [props.footer]
 */
export function FlowDialog({ open, onClose, title, subtitle, steps, stepIndex, headerExtra, busy = false, footer, bodyRef, children }) {
  const isMobile = useMediaQuery('(max-width:768px)');
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      PaperProps={{ style: { borderRadius: isMobile ? 0 : 16, overflow: 'hidden', height: isMobile ? '100dvh' : '88vh', maxHeight: isMobile ? '100dvh' : '88vh', margin: isMobile ? 0 : undefined } }}
    >
      <Shell>
        <Header>
          <div className="top">
            <div className="titles">
              <h3>{title}</h3>
              <div className="subtitle">{subtitle}</div>
            </div>
            <button type="button" className="close" onClick={onClose} aria-label="Close" disabled={busy}>
              <CloseIcon />
            </button>
          </div>
          {steps ? (
            <Steps aria-label="Progress">
              {steps.map((name, i) => (
                <li key={name} data-done={i <= stepIndex} aria-current={i === stepIndex ? 'step' : undefined}>{name}</li>
              ))}
            </Steps>
          ) : headerExtra}
        </Header>
        <Body ref={bodyRef}>{children}</Body>
        {footer && <Footer>{footer}</Footer>}
      </Shell>
    </Dialog>
  );
}
