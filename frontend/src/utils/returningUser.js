// Remembers that someone with an account has used this browser, so a
// signed-out return through "Get started" goes to sign in instead of
// spending a fresh coach conversation on a profile that already exists.
//
// Deliberately survives logout (logout clears user-scoped data, and this is
// about the device, not the account). "Not me" on the gate clears it, for a
// shared computer. Never trusted for anything but steering: clearing site
// data skips it, and the server-side resume check is the backstop.

const RETURNING_USER_KEY = 'profileai_returning_user';

// The owner's own accounts never mark the browser, so the guest coach can be tested
// on the owner's device. Mirrored in backend/routes/profiles.js.
const EXEMPT_EMAILS = ['s79darvish@gmail.com', 'saeed79darvish@gmail.com', 'saeeddarvish7959@gmail.com'];

export function isReturningCheckExempt(user) {
  const email = String(user?.email || '').toLowerCase();
  const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim().toLowerCase();
  return EXEMPT_EMAILS.includes(email) || name === 'saeed darvish';
}

export function hasReturningUser() {
  try {
    return localStorage.getItem(RETURNING_USER_KEY) === '1';
  } catch {
    return false;
  }
}

export function markReturningUser() {
  try {
    localStorage.setItem(RETURNING_USER_KEY, '1');
  } catch {
    // Storage unavailable: the resume check still catches them.
  }
}

export function clearReturningUser() {
  try {
    localStorage.removeItem(RETURNING_USER_KEY);
  } catch {
    // ignore
  }
}
