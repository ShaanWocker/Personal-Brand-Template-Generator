'use strict';
const { parseCookies, refreshAccessToken } = require('../_utils');

/**
 * POST /api/gmail/draft
 *
 * Creates a Gmail draft in the authenticated user's mailbox using the
 * Gmail REST API.  Expects a JSON body: { subject, html, to? }
 *
 * The draft is created with:
 *   - MIME-Version: 1.0
 *   - Content-Type: text/html; charset=UTF-8
 *
 * The raw RFC 2822 message is base64url-encoded for the Gmail API.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Content-Type', 'application/json');

  const cookies = parseCookies(req.headers.cookie);
  let accessToken = cookies.gm_access_token;

  // Try silent refresh if no access token
  if (!accessToken && cookies.gm_refresh_token) {
    accessToken = await refreshAccessToken(cookies.gm_refresh_token, res);
  }

  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated — please connect Gmail first.' });
  }

  // Parse body
  let body;
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
  } catch (_) {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  const { subject = '(no subject)', html = '', to = '' } = body;

  // Build RFC 2822 message
  const rawMessage = buildRawMessage({ to, subject, html });
  const encoded    = Buffer.from(rawMessage).toString('base64url');

  // Call Gmail API
  let apiRes;
  try {
    apiRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: { raw: encoded } }),
    });
  } catch (err) {
    console.error('Gmail API network error:', err);
    return res.status(502).json({ error: 'Could not reach Gmail API. Please try again.' });
  }

  if (!apiRes.ok) {
    const errData = await apiRes.json().catch(() => ({}));
    const status  = errData?.error?.status || '';
    if (status === 'UNAUTHENTICATED' || apiRes.status === 401) {
      return res.status(401).json({ error: 'Not authenticated — please reconnect Gmail.' });
    }
    console.error('Gmail API error:', JSON.stringify(errData));
    return res.status(500).json({ error: 'Gmail API returned an error. Please try again.' });
  }

  const draft = await apiRes.json();
  return res.json({
    success: true,
    draftId: draft.id,
    message: 'Draft created successfully! Open Gmail Drafts to review and send.',
  });
};

/**
 * Build a minimal RFC 2822 email message with an HTML body.
 * The Subject is encoded with RFC 2047 Base64 to handle non-ASCII characters.
 */
function buildRawMessage({ to, subject, html }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

  const headers = [
    to ? `To: ${to}` : '',
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
  ].filter(Boolean);

  return headers.join('\r\n') + '\r\n\r\n' + quotedPrintableEncode(html);
}

/**
 * Minimal quoted-printable encoder for HTML content.
 * Encodes lines longer than 76 characters and non-ASCII bytes.
 */
function quotedPrintableEncode(str) {
  const buf = Buffer.from(str, 'utf8');
  let result = '';
  let line   = '';

  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    let encoded;

    if (byte === 0x0d && i + 1 < buf.length && buf[i + 1] === 0x0a) {
      // CRLF — emit line break
      result += line + '\r\n';
      line = '';
      i++;
      continue;
    } else if (byte === 0x0a) {
      // LF — normalise to CRLF
      result += line + '\r\n';
      line = '';
      continue;
    } else if (byte === 0x3d) {
      // '=' must be encoded
      encoded = '=3D';
    } else if (byte >= 0x21 && byte <= 0x7e) {
      // Safe printable ASCII
      encoded = String.fromCharCode(byte);
    } else if (byte === 0x09 || byte === 0x20) {
      // Tab / space — safe in the middle of a line
      encoded = String.fromCharCode(byte);
    } else {
      encoded = '=' + byte.toString(16).toUpperCase().padStart(2, '0');
    }

    if (line.length + encoded.length > 75) {
      result += line + '=\r\n';
      line = '';
    }
    line += encoded;
  }

  if (line) result += line;
  return result;
}
