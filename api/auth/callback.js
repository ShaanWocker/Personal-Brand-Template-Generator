'use strict';
const { parseCookies, buildCookie, cookieDefaults, verifyGoogleIdToken } = require('../_utils');

/**
 * GET /api/auth/callback
 *
 * Handles the OAuth 2.0 redirect from Google.
 * Validates state (CSRF), exchanges the authorization code for tokens (PKCE),
 * verifies the OIDC id_token (signature, claims, nonce), enforces Cross-Account
 * Protection (gm_user_sub binding), then stores appropriate cookies and
 * redirects the user back to the app.
 *
 * Step routing:
 *   - "basic"       — stores identity cookies; redirects to /?signed_in=1
 *   - "gmail_draft" — additionally stores Gmail token cookies; redirects to /?connected=1
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
  const storedNonce  = cookies.oauth_nonce;

  // Validate CSRF state (compare full statePayload)
  if (!state || !storedState || state !== storedState) {
    return res.redirect(302, `${appUrl}/?error=state_mismatch`);
  }

  // Decode state to retrieve step
  let step = 'basic';
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    step = decoded.step === 'gmail_draft' ? 'gmail_draft' : 'basic';
  } catch (_) {
    // Fallback: treat as basic step
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

  // Verify OIDC id_token (signature, claims, nonce)
  let idPayload;
  if (tokens.id_token) {
    try {
      idPayload = await verifyGoogleIdToken(tokens.id_token, {
        nonce:    storedNonce || undefined,
        clientId: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (err) {
      console.error('id_token verification failed:', err.message);
      return res.redirect(302, `${appUrl}/?error=id_token_invalid`);
    }
  }

  // Extract stable Google identity (sub)
  const newSub   = idPayload ? idPayload.sub   : null;
  const newEmail = idPayload ? (idPayload.email || '') : '';
  const newName  = idPayload ? (idPayload.name  || '') : '';

  // Cross-Account Protection: if an existing sub is bound, reject mismatches
  const existingSub = cookies.gm_user_sub;
  if (existingSub && newSub && existingSub !== newSub) {
    console.warn(`CAP: account mismatch — existing sub ${existingSub} vs new sub ${newSub}`);
    const isProduction = process.env.NODE_ENV === 'production';
    const base = cookieDefaults(isProduction);
    res.setHeader('Set-Cookie', [
      buildCookie('gm_user_sub',    '', { ...base, maxAge: 0 }),
      buildCookie('gm_user_email',  '', { ...base, maxAge: 0 }),
      buildCookie('gm_user_name',   '', { ...base, maxAge: 0 }),
      buildCookie('gm_access_token',  '', { ...base, maxAge: 0 }),
      buildCookie('gm_refresh_token', '', { ...base, maxAge: 0 }),
      buildCookie('pkce_verifier', '', { ...base, maxAge: 0 }),
      buildCookie('oauth_state',   '', { ...base, maxAge: 0 }),
      buildCookie('oauth_nonce',   '', { ...base, maxAge: 0 }),
    ]);
    return res.redirect(302, `${appUrl}/?error=account_mismatch`);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const base = cookieDefaults(isProduction);
  const longLived = 60 * 60 * 24 * 30; // 30 days

  const newCookies = [
    // Clear temporary PKCE / nonce cookies
    buildCookie('pkce_verifier', '', { ...base, maxAge: 0 }),
    buildCookie('oauth_state',   '', { ...base, maxAge: 0 }),
    buildCookie('oauth_nonce',   '', { ...base, maxAge: 0 }),
  ];

  // Always set / refresh identity cookies from id_token claims
  if (newSub) {
    newCookies.push(buildCookie('gm_user_sub',   newSub,                          { ...base, maxAge: longLived }));
    newCookies.push(buildCookie('gm_user_email',  encodeURIComponent(newEmail),   { ...base, maxAge: longLived }));
    newCookies.push(buildCookie('gm_user_name',   encodeURIComponent(newName),    { ...base, maxAge: longLived }));
  }

  if (step === 'gmail_draft') {
    // Store Gmail access and refresh tokens
    newCookies.push(buildCookie('gm_access_token', tokens.access_token, { ...base, maxAge: 3600 }));
    if (tokens.refresh_token) {
      newCookies.push(buildCookie('gm_refresh_token', tokens.refresh_token, { ...base, maxAge: longLived }));
    }
  }

  res.setHeader('Set-Cookie', newCookies);

  if (step === 'gmail_draft') {
    return res.redirect(302, `${appUrl}/?connected=1`);
  }
  return res.redirect(302, `${appUrl}/?signed_in=1`);
};
