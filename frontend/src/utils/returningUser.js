// Remembers that someone with an account has used this browser, so a
// signed-out return through "Get started" goes to sign in instead of
// spending a fresh coach conversation on a profile that already exists.
//
// Deliberately survives logout (logout clears user-scoped data, and this is
// about the device, not the account). "Not me" on the gate clears it, for a
// shared computer. Never trusted for anything but steering: clearing site
// data skips it, and the server-side resume check is the backstop.

const RETURNING_USER_KEY = 'profileai_returning_user';

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
