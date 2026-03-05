'use strict';
const { createHash, randomBytes } = require('crypto');

/**
 * Parse a raw Cookie header string into a key→value object.
 * Values are URI-decoded; malformed values fall back to the raw string.
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const raw = pair.slice(idx + 1).trim();
    try { cookies[key] = decodeURIComponent(raw); } catch (err) {
      console.warn(`Cookie "${key}" could not be URI-decoded:`, err.message);
      cookies[key] = raw;
    }
  });
  return cookies;
}

/**
 * Build a Set-Cookie header string.
 */
function buildCookie(name, value, opts = {}) {
  const parts = [`${name}=${value}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.path)     parts.push(`Path=${opts.path}`);
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure)   parts.push('Secure');
  return parts.join('; ');
}

/**
 * Shared cookie defaults for auth tokens.
 */
function cookieDefaults(isProduction) {
  return {
    path: '/',
    sameSite: 'Lax',
    httpOnly: true,
    secure: !!isProduction,
  };
}

/**
 * Try to refresh an expired access token using the stored refresh token.
 * On success, sets a new access_token cookie and returns the new token string.
 * Returns null on failure.
 */
async function refreshAccessToken(refreshToken, res) {
  if (!refreshToken) return null;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.access_token) return null;

    const isProduction = process.env.NODE_ENV === 'production';
    const defaults = cookieDefaults(isProduction);
    const existing = res.getHeader('Set-Cookie') || [];
    const cookieArr = Array.isArray(existing) ? existing : [existing];
    cookieArr.push(buildCookie('gm_access_token', data.access_token, { ...defaults, maxAge: 3600 }));
    res.setHeader('Set-Cookie', cookieArr);

    return data.access_token;
  } catch (_) {
    return null;
  }
}

/**
 * Generate a PKCE code_verifier (random, base64url-encoded) and its
 * corresponding SHA-256 code_challenge.
 */
function generatePKCE() {
  const verifier  = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

module.exports = { parseCookies, buildCookie, cookieDefaults, refreshAccessToken, generatePKCE };
