'use strict';
const { parseCookies, buildCookie, cookieDefaults } = require('../_utils');

/**
 * POST /api/auth/disconnect
 *
 * Revokes the OAuth token at Google's revocation endpoint, then clears all
 * Gmail auth cookies, effectively disconnecting the user.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies(req.headers.cookie);

  // Revoke at Google before clearing cookies (prefer refresh token; fall back to access token)
  const tokenToRevoke = cookies.gm_refresh_token || cookies.gm_access_token;
  if (tokenToRevoke) {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: tokenToRevoke }),
      });
    } catch (err) {
      // Non-fatal: proceed with cookie clearing even if revocation fails
      console.error('Token revocation error (non-fatal):', err.message);
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const base = cookieDefaults(isProduction);

  res.setHeader('Set-Cookie', [
    buildCookie('gm_access_token',  '', { ...base, maxAge: 0 }),
    buildCookie('gm_refresh_token', '', { ...base, maxAge: 0 }),
    buildCookie('gm_user_email',    '', { ...base, maxAge: 0 }),
    buildCookie('gm_user_name',     '', { ...base, maxAge: 0 }),
    buildCookie('gm_user_sub',      '', { ...base, maxAge: 0 }),
  ]);

  res.setHeader('Content-Type', 'application/json');
  return res.json({ disconnected: true });
};
