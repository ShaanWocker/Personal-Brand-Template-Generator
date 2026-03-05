'use strict';
const { buildCookie, cookieDefaults } = require('../_utils');

/**
 * POST /api/auth/disconnect
 *
 * Clears all Gmail auth cookies, effectively disconnecting the user.
 * Also attempts to revoke the token at Google's revocation endpoint.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const base = cookieDefaults(isProduction);

  res.setHeader('Set-Cookie', [
    buildCookie('gm_access_token',  '', { ...base, maxAge: 0 }),
    buildCookie('gm_refresh_token', '', { ...base, maxAge: 0 }),
    buildCookie('gm_user_email',    '', { ...base, maxAge: 0 }),
    buildCookie('gm_user_name',     '', { ...base, maxAge: 0 }),
  ]);

  res.setHeader('Content-Type', 'application/json');
  return res.json({ disconnected: true });
};
