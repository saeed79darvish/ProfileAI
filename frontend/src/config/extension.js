// Central config for the ProfileAI Chrome Extension marketing/install surfaces.
//
// After the extension is approved on the Chrome Web Store, set the real
// listing URL via the build env var `VITE_CHROME_EXTENSION_URL` (preferred)
// or by editing the fallback below. While it's empty/unset, the in-app
// "Add to Chrome" buttons render in a "coming soon" state instead of
// linking to a dead URL.

const STORE_URL = (import.meta.env.VITE_CHROME_EXTENSION_URL || '').trim();

export const extensionConfig = {
  // Chrome Web Store listing URL. Empty until the extension is published.
  storeUrl: STORE_URL,
  // Whether the extension is live on the store yet.
  isPublished: STORE_URL.length > 0,
  // Supported job sites the extension works on.
  supportedSites: [
    'LinkedIn',
    'Indeed',
    'Greenhouse',
    'Lever',
    'Workday',
    'Ashby',
    'and any company career page',
  ],
};

export default extensionConfig;
