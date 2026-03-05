'use strict';
const { parseCookies, buildCookie, cookieDefaults } = require('../_utils');

/**
 * GET /api/auth/callback
 *
 * Handles the OAuth 2.0 redirect from Google.
 * Validates state, exchanges the authorization code for tokens (using the
 * PKCE code_verifier), stores tokens in httpOnly cookies, then redirects
 * the user back to the app.
 */
module.exports = async function handler(req, res) {
  const appUrl = process.env.APP_URL || '';
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(302, `${appUrl}/?error=${encodeURIComponent(error)}`);
  }

  const cookies      = parseCookies(req.headers.cookie);
  const storedState  = cookies.oauth_state;
  const codeVerifier = cookies.pkce_verifier;

  // Validate CSRF state
  if (!state || !storedState || state !== storedState) {
    return res.redirect(302, `${appUrl}/?error=state_mismatch`);
  }

  if (!code) {
    return res.redirect(302, `${appUrl}/?error=missing_code`);
  }

  // Exchange code for tokens
  let tokens;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
        grant_type:    'authorization_code',
        code_verifier: codeVerifier || '',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return res.redirect(302, `${appUrl}/?error=token_exchange_failed`);
    }

    tokens = await tokenRes.json();
  } catch (err) {
    console.error('Token exchange error:', err);
    return res.redirect(302, `${appUrl}/?error=token_exchange_error`);
  }

  // Fetch user profile
  let userEmail = '';
  let userName  = '';
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (userRes.ok) {
      const user = await userRes.json();
      userEmail = user.email  || '';
      userName  = user.name   || '';
    }
  } catch (err) {
    console.error('Userinfo fetch failed (non-fatal):', err.message);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const base = cookieDefaults(isProduction);
  const longLived = 60 * 60 * 24 * 30; // 30 days

  const newCookies = [
    buildCookie('gm_access_token', tokens.access_token, { ...base, maxAge: 3600 }),
    buildCookie('gm_user_email',   encodeURIComponent(userEmail), { ...base, maxAge: longLived }),
    buildCookie('gm_user_name',    encodeURIComponent(userName),  { ...base, maxAge: longLived }),
    // Clear PKCE cookies
    buildCookie('pkce_verifier', '', { ...base, maxAge: 0 }),
    buildCookie('oauth_state',   '', { ...base, maxAge: 0 }),
  ];

  if (tokens.refresh_token) {
    newCookies.push(
      buildCookie('gm_refresh_token', tokens.refresh_token, { ...base, maxAge: longLived }),
    );
  }

  res.setHeader('Set-Cookie', newCookies);
  res.redirect(302, `${appUrl}/?connected=1`);
};
