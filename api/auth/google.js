'use strict';
const { generatePKCE, generateNonce, buildCookie, cookieDefaults, parseCookies } = require('../_utils');
const { randomBytes } = require('crypto');

const ALLOWED_STEPS = ['basic', 'gmail_draft'];

const SCOPE_MAP = {
  basic:       'openid email profile',
  gmail_draft: 'openid email profile https://www.googleapis.com/auth/gmail.compose',
};

/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth 2.0 Authorization Code flow with PKCE.
 *
 * Accepts an optional `step` query parameter:
 *   - "basic"       — Step 1: Sign in with Google (openid email profile only)
 *   - "gmail_draft" — Step 2: Enable Gmail draft creation (adds gmail.compose scope)
 *
 * Always sets include_granted_scopes=true for incremental authorization.
 * Generates a nonce stored in a short-lived httpOnly cookie for OIDC validation.
 * Encodes the step in the state parameter (base64url JSON) for callback routing.
 */
module.exports = function handler(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) {
    return res.status(503).json({
      error: 'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI.',
    });
  }

  const rawStep = req.query.step;
  const step = ALLOWED_STEPS.includes(rawStep) ? rawStep : 'basic';

  const { verifier, challenge } = generatePKCE();
  const csrfToken = randomBytes(16).toString('hex');
  const nonce     = generateNonce();

  // Encode both CSRF token and step into the state parameter
  const statePayload = Buffer.from(JSON.stringify({ csrf: csrfToken, step })).toString('base64url');

  const isProduction = process.env.NODE_ENV === 'production';
  const base = cookieDefaults(isProduction);

  // Only force prompt=consent for gmail_draft step when no refresh token exists yet
  const cookies = parseCookies(req.headers.cookie);
  const needsConsent = step === 'gmail_draft' && !cookies.gm_refresh_token;

  const params = new URLSearchParams({
    client_id:              process.env.GOOGLE_CLIENT_ID,
    redirect_uri:           process.env.GOOGLE_REDIRECT_URI,
    response_type:          'code',
    scope:                  SCOPE_MAP[step],
    access_type:            'offline',
    include_granted_scopes: 'true',
    state:                  statePayload,
    nonce,
    code_challenge:         challenge,
    code_challenge_method:  'S256',
  });

  if (needsConsent) {
    params.set('prompt', 'consent');
  }

  res.setHeader('Set-Cookie', [
    buildCookie('pkce_verifier', verifier,      { ...base, maxAge: 600 }),
    buildCookie('oauth_state',   statePayload,  { ...base, maxAge: 600 }),
    buildCookie('oauth_nonce',   nonce,         { ...base, maxAge: 600 }),
  ]);

  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};
