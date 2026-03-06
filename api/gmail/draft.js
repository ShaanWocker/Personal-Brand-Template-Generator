'use strict';
const { parseCookies, refreshAccessToken } = require('../_utils');

/** Maximum size for fetched inline images (8 MB). */
const IMAGE_SIZE_LIMIT = 8 * 1024 * 1024;

/**
 * Returns true only if the URL scheme is http or https.
 * Rejects data:, file:, ftp:, and any other scheme.
 */
function isSafeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * Fetch a URL and return { buffer, contentType }.
 * Throws if the response is not OK or the body exceeds maxBytes.
 */
async function fetchWithSizeLimit(url, maxBytes) {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Network error fetching resource: ${err.message}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch resource: HTTP ${response.status}`);
  }

  const contentType = (response.headers.get('content-type') || 'application/octet-stream')
    .split(';')[0].trim();

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.length;
    if (totalBytes > maxBytes) {
      reader.cancel().catch(() => {});
      throw new Error(
        `Resource exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB size limit.`
      );
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
  return { buffer, contentType };
}

/**
 * Replace every occurrence of rawUrl (and its HTML-attribute-encoded form) in
 * the HTML string with the given replacement string.
 */
function replaceUrlInHtml(html, rawUrl, replacement) {
  // Also handle URLs where & was HTML-encoded as &amp; (produced by escHtml() on the client)
  const encodedUrl = rawUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  let result = html.split(rawUrl).join(replacement);
  if (encodedUrl !== rawUrl) {
    result = result.split(encodedUrl).join(replacement);
  }
  return result;
}

/** Monotonically incrementing counter used to guarantee unique CIDs within a request. */
let _cidCounter = 0;

/** Generate a random MIME boundary string. */
function generateBoundary() {
  return 'BrandKit_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Build a multipart/related MIME message containing an HTML body part
 * followed by inline image parts (base64-encoded, identified by Content-ID).
 */
function buildMultipartMessage({ to, subject, html, parts }) {
  const boundary = generateBoundary();
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

  const headers = [
    to ? `To: ${to}` : '',
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${boundary}"`,
  ].filter(Boolean);

  let message = headers.join('\r\n') + '\r\n\r\n';

  // HTML body part
  message += `--${boundary}\r\n`;
  message += 'Content-Type: text/html; charset=UTF-8\r\n';
  message += 'Content-Transfer-Encoding: quoted-printable\r\n';
  message += '\r\n';
  message += quotedPrintableEncode(html) + '\r\n';

  // Inline image parts
  for (const part of parts) {
    const b64 = part.buffer.toString('base64');
    // RFC 2045: fold base64 at 76 characters; handle empty buffer defensively
    const b64Folded = b64.length > 0 ? (b64.match(/.{1,76}/g) || [b64]).join('\r\n') : '';

    message += `--${boundary}\r\n`;
    message += `Content-Type: ${part.contentType}\r\n`;
    message += 'Content-Transfer-Encoding: base64\r\n';
    message += `Content-ID: <${part.cid}>\r\n`;
    message += 'Content-Disposition: inline\r\n';
    message += '\r\n';
    message += b64Folded + '\r\n';
  }

  message += `--${boundary}--\r\n`;
  return message;
}

/**
 * POST /api/gmail/draft
 *
 * Creates a Gmail draft in the authenticated user's mailbox using the
 * Gmail REST API.
 *
 * Expects a JSON body:
 *   { subject, html, to?, imageUrl?, videoUrl?, videoPosterUrl? }
 *
 * When imageUrl is provided the image is fetched server-side (max 8 MB),
 * embedded as a CID attachment, and the HTML img src is rewritten to cid:…
 * so Gmail renders it without an external fetch.
 *
 * When videoPosterUrl (and videoUrl) are provided the poster image is
 * likewise embedded as CID.  The video itself is never fetched or embedded;
 * only the poster image (linked to videoUrl) appears in the email.
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

  const {
    subject      = '(no subject)',
    html         = '',
    to           = '',
    imageUrl     = '',
    videoUrl     = '',
    videoPosterUrl = '',
  } = body;

  // Validate supplied URLs — only http/https are permitted
  if (imageUrl && !isSafeUrl(imageUrl)) {
    return res.status(400).json({ error: 'Invalid imageUrl: only http and https URLs are allowed.' });
  }
  if (videoUrl && !isSafeUrl(videoUrl)) {
    return res.status(400).json({ error: 'Invalid videoUrl: only http and https URLs are allowed.' });
  }
  if (videoPosterUrl && !isSafeUrl(videoPosterUrl)) {
    return res.status(400).json({
      error: 'Invalid videoPosterUrl: only http and https URLs are allowed.',
    });
  }

  // Fetch inline images and build CID attachment list
  const inlineParts = [];
  let processedHtml = html;

  if (imageUrl) {
    try {
      const { buffer, contentType } = await fetchWithSizeLimit(imageUrl, IMAGE_SIZE_LIMIT);
      const cid = `inline-image-${Date.now()}-${++_cidCounter}`;
      inlineParts.push({ cid, buffer, contentType });
      processedHtml = replaceUrlInHtml(processedHtml, imageUrl, `cid:${cid}`);
    } catch (err) {
      // Graceful fallback: log the warning and leave the external URL intact
      console.warn('Could not embed inline image (falling back to external URL):', err.message);
    }
  }

  if (videoPosterUrl) {
    try {
      const { buffer, contentType } = await fetchWithSizeLimit(videoPosterUrl, IMAGE_SIZE_LIMIT);
      const cid = `video-poster-${Date.now()}-${++_cidCounter}`;
      inlineParts.push({ cid, buffer, contentType });
      processedHtml = replaceUrlInHtml(processedHtml, videoPosterUrl, `cid:${cid}`);
    } catch (err) {
      console.warn(
        'Could not embed video poster image (falling back to external URL):', err.message
      );
    }
  }

  // Build RFC 2822 / MIME message
  const rawMessage = inlineParts.length > 0
    ? buildMultipartMessage({ to, subject, html: processedHtml, parts: inlineParts })
    : buildRawMessage({ to, subject, html: processedHtml });

  const encoded = Buffer.from(rawMessage).toString('base64url');

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
