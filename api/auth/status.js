'use strict';
const { parseCookies, refreshAccessToken } = require('../_utils');

/**
 * GET /api/auth/status
 *
 * Returns the current connection state for both sign-in and Gmail access.
 *
 * Response:
 *   {
 *     signedIn:     boolean,  // user has completed Step 1 (Google identity)
 *     gmailEnabled: boolean,  // user has completed Step 2 (Gmail compose access)
 *     connected:    boolean,  // alias for gmailEnabled (backward compatibility)
 *     email:        string,
 *     name:         string,
 *   }
 */
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const cookies = parseCookies(req.headers.cookie);

  const email = decodeURIComponent(cookies.gm_user_email || '');
  const name  = decodeURIComponent(cookies.gm_user_name  || '');

  // Step 1 (signed in) — stable identity sub is present
  const signedIn = !!cookies.gm_user_sub;

  // Step 2 (Gmail enabled) — access token is present or can be silently refreshed
  let gmailEnabled = false;

  if (cookies.gm_access_token) {
    gmailEnabled = true;
  } else if (cookies.gm_refresh_token) {
    const newToken = await refreshAccessToken(cookies.gm_refresh_token, res);
    if (newToken) {
      gmailEnabled = true;
    }
  }

  return res.json({
    signedIn,
    gmailEnabled,
    connected: gmailEnabled, // backward compatibility
    email,
    name,
  });
};
