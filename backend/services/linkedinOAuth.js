/**
 * LinkedIn OAuth (OIDC) helper.
 *
 * Exchanges an authorization code for an access token and returns the
 * OIDC userinfo payload (name, email, picture, sub) — the same limited
 * scope LinkedIn grants without Partner Program access.
 *
 * Used by:
 *   - routes/auth.js         (sign-in / register with LinkedIn)
 *   - routes/profiles.js     (prefill profile basics from LinkedIn)
 */

async function fetchLinkedInProfile(code, redirectUri) {
  const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || ''
    })
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || tokenData.error) {
    const err = new Error(tokenData.error_description || tokenData.error || 'LinkedIn token exchange failed');
    err.status = 401;
    throw err;
  }

  const userinfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const profile = await userinfoResponse.json();
  if (!userinfoResponse.ok) {
    const err = new Error(profile.message || 'Failed to load LinkedIn profile');
    err.status = 401;
    throw err;
  }

  return {
    linkedinId: String(profile.sub),
    email: profile.email,
    firstName: profile.given_name || profile.name?.split(' ')[0] || 'User',
    lastName: profile.family_name || profile.name?.split(' ').slice(1).join(' ') || '',
    picture: profile.picture || null
  };
}

module.exports = { fetchLinkedInProfile };
