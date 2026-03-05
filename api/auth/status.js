'use strict';
const { parseCookies, refreshAccessToken } = require('../_utils');

/**
 * GET /api/auth/status
 *
 * Returns the current Gmail connection state.
 * If the access token has expired but a refresh token is available, it
 * attempts a silent refresh before responding.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const cookies = parseCookies(req.headers.cookie);

  // If we have a valid access token, we're good
  if (cookies.gm_access_token) {
    return res.json({
      connected: true,
      email: decodeURIComponent(cookies.gm_user_email || ''),
      name:  decodeURIComponent(cookies.gm_user_name  || ''),
    });
  }

  // Try silent refresh
  if (cookies.gm_refresh_token) {
    const newToken = await refreshAccessToken(cookies.gm_refresh_token, res);
    if (newToken) {
      return res.json({
        connected: true,
        email: decodeURIComponent(cookies.gm_user_email || ''),
        name:  decodeURIComponent(cookies.gm_user_name  || ''),
      });
    }
  }

  return res.json({ connected: false });
};
