// While the on-screen keyboard is open on a phone, sticky and fixed bottom
// bars sit right on top of it and leave almost no room for the field being
// typed in. installKeyboardWatcher marks <html data-keyboard="open"> while a
// text field has focus on a touch screen, and bars opt in to hiding with
// `hideWhileTyping` (styled-components) or KEYBOARD_OPEN_SX (MUI sx).
//
// A bar that holds the focused field itself (a chat composer, a Save As
// input) stays visible: hiding it would hide what the user is typing into.

import { css } from 'styled-components';

const KEYBOARD_OPEN = 'html[data-keyboard="open"]';

export const hideWhileTyping = css`
  ${KEYBOARD_OPEN} &:not(:focus-within) {
    display: none;
  }
`;

/** The same rule for an MUI `sx` object: spread it in. */
export const KEYBOARD_OPEN_SX = {
  [`${KEYBOARD_OPEN} &:not(:focus-within)`]: { display: 'none' },
};

// Input types that bring up the keyboard; date pickers, checkboxes and the
// like do not.
const TEXT_TYPES = new Set(['', 'text', 'email', 'tel', 'search', 'url', 'number', 'password']);

export function isTextEntry(el) {
  if (!el || el.readOnly || el.disabled) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && TEXT_TYPES.has((el.getAttribute('type') || '').toLowerCase());
}

/** Call once at startup. Does nothing on devices without a touch screen. */
export function installKeyboardWatcher() {
  if (typeof window === 'undefined' || !window.matchMedia?.('(pointer: coarse)').matches) return;
  const root = document.documentElement;
  const sync = () => {
    if (isTextEntry(document.activeElement)) root.dataset.keyboard = 'open';
    else delete root.dataset.keyboard;
  };
  document.addEventListener('focusin', sync);
  // On focusout the next field has not taken focus yet; moving between
  // fields must not flash the bars back in.
  document.addEventListener('focusout', () => setTimeout(sync, 0));
}
