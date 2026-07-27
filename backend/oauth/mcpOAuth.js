/**
 * OAuth 2.1 authorization server for the ProfilleAI Claude Custom Connector.
 *
 * Claude.ai's custom-connector UI only authenticates via OAuth (there's no
 * "paste a token" field), so the MCP endpoint needs a real OAuth flow. This
 * module implements the minimum spec Claude drives:
 *
 *   GET  /.well-known/oauth-protected-resource[/mcp]  (RFC 9728)
 *   GET  /.well-known/oauth-authorization-server      (RFC 8414)
 *   POST /oauth/register                              (RFC 7591 dynamic client reg)
 *   GET  /oauth/authorize   -> bounces to the frontend consent page
 *   POST /api/oauth/mcp/consent  (browser, user-JWT) -> mints an auth code
 *   POST /oauth/token       (authorization_code + refresh_token, PKCE S256)
 *
 * It is deliberately STATELESS: no new DB tables. Auth codes and refresh
 * tokens are short/long-lived signed JWTs carrying their own binding
 * (user id, client id, redirect uri, PKCE challenge). The access token we
 * issue is a normal ProfilleAI JWT ({ id: userId }) so the existing
 * `resolveAuthUser` in backend/mcp/auth.js validates it with no changes.
 */

const crypto = require('crypto');
const { randomUUID } = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

const API_BASE = (process.env.MCP_ISSUER || 'https://api.profilleai.com').replace(/\/$/, '');
const FRONTEND_BASE = (process.env.FRONTEND_URL || 'https://www.profilleai.com').replace(/\/$/, '');
const MCP_RESOURCE = `${API_BASE}/mcp`;

const ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60; // 30d
const CODE_TTL = '5m';
const REFRESH_TTL = '365d';

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Verify a PKCE S256 challenge against the presented verifier. */
function verifyPkceS256(verifier, challenge) {
  if (!verifier || !challenge) return false;
  const hashed = b64url(crypto.createHash('sha256').update(verifier).digest());
  // constant-time-ish compare
  return hashed.length === challenge.length &&
    crypto.timingSafeEqual(Buffer.from(hashed), Buffer.from(challenge));
}

/** Only allow redirects back to Claude's own hosts. */
function isAllowedRedirect(uri) {
  try {
    const u = new URL(uri);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    return (
      h === 'claude.ai' || h.endsWith('.claude.ai') ||
      h === 'claude.com' || h.endsWith('.claude.com') ||
      h === 'anthropic.com' || h.endsWith('.anthropic.com')
    );
  } catch {
    return false;
  }
}

function allowCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function mountMcpOAuth(app) {
  // ---- Discovery metadata (public, permissive CORS) ----
  const protectedResource = (req, res) => {
    allowCors(res);
    res.json({
      resource: MCP_RESOURCE,
      authorization_servers: [API_BASE],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp'],
    });
  };
  app.get('/.well-known/oauth-protected-resource', protectedResource);
  app.get('/.well-known/oauth-protected-resource/mcp', protectedResource);

  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    allowCors(res);
    res.json({
      issuer: API_BASE,
      authorization_endpoint: `${API_BASE}/oauth/authorize`,
      token_endpoint: `${API_BASE}/oauth/token`,
      registration_endpoint: `${API_BASE}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp'],
    });
  });

  // ---- Dynamic client registration (RFC 7591) ----
  // We don't persist clients: security comes from PKCE + redirect-uri binding
  // enforced in the code JWT. We still hand back a client_id so Claude has one.
  app.options('/oauth/register', (req, res) => { allowCors(res); res.sendStatus(204); });
  app.post('/oauth/register', express.json(), (req, res) => {
    allowCors(res);
    const body = req.body || {};
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
    if (redirectUris.length === 0 || !redirectUris.every(isAllowedRedirect)) {
      return res.status(400).json({
        error: 'invalid_redirect_uri',
        error_description: 'redirect_uris must be Claude https callback URLs.',
      });
    }
    const clientId = `mcp_${randomUUID()}`;
    return res.status(201).json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_name: body.client_name || 'Claude',
    });
  });

  // ---- Authorization endpoint: bounce to the frontend consent page ----
  // No server-side session exists (the app keeps its JWT in localStorage),
  // so the actual sign-in + consent happens in the SPA, which then calls
  // /api/oauth/mcp/consent to mint the code.
  app.get('/oauth/authorize', (req, res) => {
    const { response_type, client_id, redirect_uri, code_challenge, code_challenge_method, state, scope } = req.query;

    if (response_type !== 'code') {
      return res.status(400).send('unsupported_response_type');
    }
    if (!redirect_uri || !isAllowedRedirect(String(redirect_uri))) {
      return res.status(400).send('invalid_redirect_uri');
    }
    if (!code_challenge || code_challenge_method !== 'S256') {
      // PKCE S256 is required.
      const u = new URL(String(redirect_uri));
      u.searchParams.set('error', 'invalid_request');
      u.searchParams.set('error_description', 'PKCE S256 required');
      if (state) u.searchParams.set('state', String(state));
      return res.redirect(u.toString());
    }

    const params = new URLSearchParams({
      client_id: String(client_id || ''),
      redirect_uri: String(redirect_uri),
      code_challenge: String(code_challenge),
      code_challenge_method: 'S256',
      state: String(state || ''),
      scope: String(scope || 'mcp'),
    });
    return res.redirect(`${FRONTEND_BASE}/connect/claude?${params.toString()}`);
  });

  // ---- Consent: browser (user JWT) exchanges approval for an auth code ----
  app.options('/api/oauth/mcp/consent', (req, res) => { allowCors(res); res.sendStatus(204); });
  app.post('/api/oauth/mcp/consent', express.json(), (req, res) => {
    allowCors(res);
    try {
      const header = req.header('Authorization') || '';
      const token = header.replace(/^Bearer\s+/i, '').trim();
      if (!token) return res.status(401).json({ error: 'login_required' });

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'login_required' });
      }
      const userId = decoded.id;
      if (!userId) return res.status(401).json({ error: 'login_required' });

      const { client_id, redirect_uri, code_challenge, state, scope } = req.body || {};
      if (!redirect_uri || !isAllowedRedirect(String(redirect_uri))) {
        return res.status(400).json({ error: 'invalid_redirect_uri' });
      }
      if (!code_challenge) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'missing code_challenge' });
      }

      const code = jwt.sign(
        {
          typ: 'mcp_code',
          uid: userId,
          cid: client_id || null,
          ruri: redirect_uri,
          cc: code_challenge,
          scope: scope || 'mcp',
        },
        process.env.JWT_SECRET,
        { expiresIn: CODE_TTL },
      );

      const u = new URL(String(redirect_uri));
      u.searchParams.set('code', code);
      if (state) u.searchParams.set('state', String(state));
      return res.json({ redirect: u.toString() });
    } catch (err) {
      console.error('[mcp-oauth] consent error:', err);
      return res.status(500).json({ error: 'server_error' });
    }
  });

  // ---- Token endpoint (authorization_code + refresh_token) ----
  app.options('/oauth/token', (req, res) => { allowCors(res); res.sendStatus(204); });
  app.post(
    '/oauth/token',
    express.urlencoded({ extended: true }),
    express.json(),
    (req, res) => {
      allowCors(res);
      const body = req.body || {};
      const grantType = body.grant_type;

      try {
        if (grantType === 'authorization_code') {
          const { code, code_verifier, redirect_uri } = body;
          if (!code || !code_verifier) {
            return res.status(400).json({ error: 'invalid_request' });
          }
          let payload;
          try {
            payload = jwt.verify(code, process.env.JWT_SECRET);
          } catch {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'code expired or invalid' });
          }
          if (payload.typ !== 'mcp_code') {
            return res.status(400).json({ error: 'invalid_grant' });
          }
          if (redirect_uri && redirect_uri !== payload.ruri) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
          }
          if (!verifyPkceS256(code_verifier, payload.cc)) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
          }
          return res.json(issueTokens(payload.uid, payload.scope || 'mcp'));
        }

        if (grantType === 'refresh_token') {
          const { refresh_token } = body;
          if (!refresh_token) return res.status(400).json({ error: 'invalid_request' });
          let payload;
          try {
            payload = jwt.verify(refresh_token, process.env.JWT_SECRET);
          } catch {
            return res.status(400).json({ error: 'invalid_grant' });
          }
          if (payload.typ !== 'mcp_refresh') {
            return res.status(400).json({ error: 'invalid_grant' });
          }
          return res.json(issueTokens(payload.uid, payload.scope || 'mcp'));
        }

        return res.status(400).json({ error: 'unsupported_grant_type' });
      } catch (err) {
        console.error('[mcp-oauth] token error:', err);
        return res.status(500).json({ error: 'server_error' });
      }
    },
  );

  console.log('🔐 MCP OAuth endpoints mounted (/.well-known/*, /oauth/*)');
}

/**
 * Mint the access + refresh pair. The access token is a plain ProfilleAI JWT
 * ({ id }) so the MCP auth layer validates it unchanged; the refresh token is
 * a distinct typed JWT.
 */
function issueTokens(userId, scope) {
  const access_token = jwt.sign(
    { id: userId, scope, mcp: true },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL_SECONDS },
  );
  const refresh_token = jwt.sign(
    { typ: 'mcp_refresh', uid: userId, scope },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TTL },
  );
  return {
    access_token,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token,
    scope,
  };
}

module.exports = mountMcpOAuth;
module.exports.API_BASE = API_BASE;
