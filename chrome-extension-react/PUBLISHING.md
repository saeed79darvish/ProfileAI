# Publishing the ProfileAI Chrome Extension

This guide walks through publishing the React/TS extension in `chrome-extension-react/`
to the Chrome Web Store.

## 0. Prerequisites

- A Google account to use as the developer account.
- One-time **$5 USD** Chrome Web Store developer registration fee.
- The packaged build: `profileai-extension-v1.0.0.zip` (regenerate with the steps below).

## 1. Build & package

The extension is already configured for production (`src/config.ts` → `ENV = 'production'`,
pointing at `https://www.profilleai.com` and `https://api.profilleai.com/api`).

```bash
cd chrome-extension-react
npm install            # first time only
npm run build          # outputs to dist/
cd dist && zip -r -q ../profileai-extension-v1.0.0.zip . -x "*.DS_Store" && cd ..
```

This produces `chrome-extension-react/profileai-extension-v1.0.0.zip` — the file you upload.

> Bump `version` in both `package.json` and `public/manifest.json` for every new
> store submission (the store rejects re-uploads of an existing version number).

## 2. Create the developer account

1. Go to the Chrome Web Store Developer Dashboard:
   https://chrome.google.com/webstore/devconsole
2. Sign in and pay the one-time $5 registration fee.
3. Accept the developer agreement.

## 3. Create the listing & upload

1. Click **Add new item**.
2. Upload `profileai-extension-v1.0.0.zip`.
3. Fill in the **Store listing** tab:
   - **Name:** ProfileAI – Job Application Assistant
   - **Summary (132 chars):** AI-powered job application assistant. Autofill forms,
     tailor your resume, and answer screening questions on any job site.
   - **Description:** see `STORE_LISTING.md` snippet below.
   - **Category:** Productivity
   - **Language:** English
4. **Graphic assets** (required):
   - Store icon: 128×128 PNG (use `public/icons/icon128.png`).
   - At least 1 screenshot (1280×800 or 640×400). Capture the side panel on a
     LinkedIn/Greenhouse job page.
   - Optional: small promo tile 440×280.

## 4. Privacy & permissions justification

The store review requires justification for each permission. Use:

| Permission | Justification |
|---|---|
| `storage` | Cache the signed-in user's profile and saved answers locally. |
| `activeTab` / `tabs` | Detect the current job page to read the job title/description. |
| `scripting` | Inject the autofill/answer helpers into the active job application form. |
| `sidePanel` | Render the main ProfileAI working panel beside the job page. |
| `downloads` | Let the user download a tailored resume/cover-letter PDF. |
| `host_permissions: <all_urls>` | Job applications live on thousands of ATS/company domains; the assistant must run on any of them. |

- **Single purpose:** "Help job seekers complete online job applications faster
  using their ProfileAI profile."
- **Data usage:** Declare that the extension transmits the user's profile data to
  `api.profilleai.com` to generate AI answers/resumes, and does **not** sell data.
- Provide the privacy policy URL: https://www.profilleai.com/privacy

## 5. Submit for review

1. Set **Visibility** to Public (or Unlisted for a soft launch).
2. Click **Submit for review**. Review typically takes a few business days.
3. Once approved, copy the public listing URL — it looks like
   `https://chromewebstore.google.com/detail/<slug>/<EXTENSION_ID>`.

## 6. Wire the live URL into the web app

After approval, set the store URL so the in-app "Add to Chrome" buttons point to the
real listing (otherwise they fall back to a "coming soon" state):

- Add to the frontend build/deploy environment:
  ```
  VITE_CHROME_EXTENSION_URL=https://chromewebstore.google.com/detail/<slug>/<EXTENSION_ID>
  ```
- Or edit the default in `frontend/src/config/extension.js`.

Then redeploy the frontend (`wrangler deploy`).

## Notes

- The extension authenticates by reading the ProfileAI session from `localStorage`
  on `profilleai.com` tabs (see `externally_connectable` + content-script auth sync).
  Users must be signed in to the web app at least once for the extension to pick up
  their session.
- If you later move the API to a different host, update `src/config.ts`,
  `src/content/index.ts`, and `public/manifest.json` (externally_connectable), then
  rebuild and submit a new version.
