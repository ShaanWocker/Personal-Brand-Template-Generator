'use strict';
const { verifyRiscToken } = require('../_utils');

/**
 * POST /api/security/google-event
 *
 * Google Cross-Account Protection (RISC) security event receiver.
 *
 * Google delivers Security Event Tokens (SETs) to this endpoint when a
 * security-relevant event occurs on a user's Google account — for example,
 * when their sessions are revoked or their account is disabled. The incoming
 * JWT is validated using the public keys advertised in Google's RISC discovery
 * document. Recognized event types trigger revocation of the affected user's
 * stored OAuth tokens.
 *
 * To activate this protection:
 *  1. Deploy this endpoint and note its public URL.
 *  2. Open Google Cloud Console → APIs & Services → Credentials → your OAuth
 *     client → Security > Cross-Account Protection.
 *  3. Set the receiver URL to: <your domain>/api/security/google-event
 *
 * References:
 *  - RISC overview: https://developers.google.com/identity/protocols/risc
 *  - Discovery doc:  https://accounts.google.com/.well-known/risc-configuration
 *  - SET spec:       https://www.rfc-editor.org/rfc/rfc8417
 */

/** RISC event type URIs that require token revocation. */
const REVOCATION_EVENTS = new Set([
  'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
  'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
  'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked',
]);

/**
 * Revoke a Google OAuth token at Google's revocation endpoint.
 * Non-fatal: errors are logged but do not affect the HTTP response.
 */
async function revokeGoogleToken(token) {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  } catch (err) {
    console.error('RISC: token revocation request failed (non-fatal):', err.message);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Google delivers SETs as a raw JWT string in the request body
  // (Content-Type: application/secevent+jwt).
  let rawToken;
  if (typeof req.body === 'string') {
    rawToken = req.body.trim();
  } else if (Buffer.isBuffer(req.body)) {
    rawToken = req.body.toString('utf8').trim();
  } else {
    return res.status(400).json({ error: 'Expected raw JWT body (application/secevent+jwt)' });
  }

  if (!rawToken) {
    return res.status(400).json({ error: 'Missing security event token' });
  }

  // Validate the SET JWT using Google's RISC JWKS
  let payload;
  try {
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!audience) throw new Error('GOOGLE_CLIENT_ID is not configured');
    payload = await verifyRiscToken(rawToken, audience);
  } catch (err) {
    console.error('RISC: token validation failed:', err.message);
    return res.status(400).json({ error: 'Invalid security event token' });
  }

  // The SET "events" claim maps event-type URIs to event-specific data.
  const events = payload.events || {};
  const triggeredTypes = Object.keys(events).filter(type => REVOCATION_EVENTS.has(type));

  if (triggeredTypes.length > 0) {
    // Extract the affected Google account identifier.
    // SETs use `sub` (top-level) or a subject claim object.
    const subjectId =
      payload.sub ||
      (payload.subject && payload.subject.sub) ||
      null;

    console.log(
      `RISC: received event(s) [${triggeredTypes.join(', ')}]` +
      (subjectId ? ` for Google sub: ${subjectId}` : ''),
    );

    // In a production system with a server-side token store, look up the stored
    // refresh token for this Google `sub` and revoke it:
    //
    //   const refreshToken = await db.tokens.findByGoogleSub(subjectId);
    //   if (refreshToken) await revokeGoogleToken(refreshToken);
    //
    // This deployment stores tokens exclusively in client-side cookies, so
    // there is no server-side token to revoke.  The event is acknowledged and
    // logged; the user will be required to re-authenticate on their next visit
    // once Google invalidates the token on its side.
  }

  // Google expects HTTP 202 Accepted (or 200) for successful event delivery.
  return res.status(202).end();
};
