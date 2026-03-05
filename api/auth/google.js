'use strict';
const { generatePKCE, buildCookie, cookieDefaults } = require('../_utils');
const { randomBytes } = require('crypto');

/**
 * GET /api/auth/google
 *
 * Initiates the Google OAuth 2.0 Authorization Code flow with PKCE.
 * Stores the code verifier and a CSRF state value in short-lived httpOnly
 * cookies, then redirects the user to Google's consent screen.
 */
module.exports = function handler(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) {
    return res.status(503).json({
      error: 'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI.',
    });
  }

  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id:             process.env.GOOGLE_CLIENT_ID,
    redirect_uri:          process.env.GOOGLE_REDIRECT_URI,
    response_type:         'code',
    scope:                 'https://www.googleapis.com/auth/gmail.compose email profile',
    access_type:           'offline',
    prompt:                'consent',
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const base = cookieDefaults(isProduction);

  res.setHeader('Set-Cookie', [
    buildCookie('pkce_verifier', verifier, { ...base, maxAge: 600 }),
    buildCookie('oauth_state',   state,    { ...base, maxAge: 600 }),
  ]);

  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};
