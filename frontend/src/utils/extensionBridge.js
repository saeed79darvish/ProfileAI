// Extension Bridge - Communicate auth state with Chrome Extension

const EXTENSION_ID = 'profileai'; // This will be the extension's actual ID when published

/**
 * Check if the page was opened from the Chrome extension
 */
export function isFromExtension() {
  const params = new URLSearchParams(window.location.search);
  return params.get('from') === 'extension';
}

/**
 * Get the return URL (the job application page to redirect back to)
 */
export function getReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('returnUrl') || null;
}

/**
 * Sync authentication state with the Chrome extension
 * This uses multiple methods to ensure the extension receives the auth data
 */
export async function syncAuthToExtension(token, user) {
  if (!token || !user) return false;

  const authData = {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profilePicture: user.profilePicture
    }
  };

  // Method 1: PostMessage (for content scripts listening on this page)
  window.postMessage({
    type: 'PROFILEAI_AUTH_SUCCESS',
    ...authData
  }, window.location.origin);

  // Method 2: Custom event (for any listening scripts)
  const event = new CustomEvent('profileai-auth', { detail: authData });
  window.dispatchEvent(event);

  // Method 3: Store in localStorage with a special key the extension can read
  // The extension's content script will pick this up
  try {
    localStorage.setItem('profileai_extension_auth', JSON.stringify({
      ...authData,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Could not store extension auth data:', e);
  }

  // Method 4: Try to communicate directly with extension (if extension ID is known)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      // This only works if the extension has allowed this origin
      chrome.runtime.sendMessage(EXTENSION_ID, {
        type: 'AUTH_FROM_WEBSITE',
        ...authData
      });
    } catch (e) {
      // Extension communication not available, that's ok
      console.log('Direct extension communication not available');
    }
  }

  return true;
}

/**
 * Handle the extension auth flow after successful login/register
 * @param {string} token - JWT token
 * @param {object} user - User object
 * @param {function} navigate - React Router navigate function
 * @param {string} defaultRedirect - Default redirect path if not from extension
 * @param {boolean} showSuccessPage - Whether to show success page (false for already-authenticated users)
 */
export async function handleExtensionAuthSuccess(token, user, navigate, defaultRedirect = '/profile', showSuccessPage = true) {
  const fromExtension = isFromExtension();
  const returnUrl = getReturnUrl();

  if (fromExtension) {
    // Sync auth state to extension
    await syncAuthToExtension(token, user);

    // If user was already authenticated, redirect immediately without showing success page
    if (!showSuccessPage && returnUrl) {
      window.location.href = returnUrl;
      return true;
    }

    // Show success message and close/redirect
    if (returnUrl) {
      // Redirect back to the job application page
      // Add a small delay to ensure extension has time to receive the auth
      setTimeout(() => {
        window.location.href = returnUrl;
      }, 500);
    } else {
      // Show a success page that auto-closes or redirects
      navigate('/extension-auth-success');
    }
    return true;
  }

  // Not from extension, do normal redirect
  navigate(defaultRedirect);
  return false;
}

/**
 * Check if user is already authenticated and notify extension
 * Call this on page load when coming from extension
 */
export async function checkAndSyncExistingAuth() {
  if (!isFromExtension()) return false;

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      await syncAuthToExtension(token, user);
      return { token, user };
    } catch (e) {
      console.error('Failed to parse user data:', e);
    }
  }

  return null;
}
