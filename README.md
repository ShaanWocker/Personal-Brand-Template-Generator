<div align="center">

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║              ✦  B R A N D   K I T  ✦                    ║
║     Email · LinkedIn · Gmail — personalised for you      ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

# Brand Kit — Email Template & LinkedIn Post Builder

**A multi-user, personalised toolkit for professionals who care about every touchpoint.**

[![Deploy with Vercel](https://img.shields.io/badge/Deploy%20with-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/new)
[![License](https://img.shields.io/badge/License-MIT-C9952A?style=for-the-badge)](LICENSE)

</div>

---

## ✦ What Is This?

Most professionals spend hours perfecting their LinkedIn presence and website — then send emails that look like everyone else's.

This **Brand Kit** solves that. It lets you:

- 🎨 **Configure your own Brand Profile** — name, tagline, website, initials, accent colour, persisted in your browser
- 📧 **Design a personalised email template** — live preview, export as email-safe HTML or plain text
- ✉ **Create Gmail Drafts with one click** — OAuth 2.0 integration via Vercel serverless functions
- 💼 **Generate ready-to-post LinkedIn captions** — four structured post types that change the scaffold
- 📋 **Copy everything in one click** — email-safe HTML for your email platform, plain text for LinkedIn

Comes with a built-in **Shaan (demo)** preset and a fully editable **Custom** preset.

---

## ✦ Features

| Feature | Description |
|---|---|
| 👤 **Brand Profile** | Set your name, tagline, website, initials, and accent colour — persisted to localStorage |
| ✦ Shaan preset | Demo values pre-filled so the tool works immediately out of the box |
| 📧 **Live Email Preview** | See your branded template update in real time as you type |
| 🔗 **CTA Button Link URL** | Required when CTA Button is enabled — validated http/https URL, persisted to localStorage |
| 📤 **Email-safe HTML Export** | Table-based, inline-styled HTML that renders correctly in Gmail, Outlook, Apple Mail |
| ✉ **Gmail Draft** | OAuth 2.0 (PKCE) — create a draft in your own Gmail, never auto-sends |
| 💼 **LinkedIn Post Generator** | Four post-type templates: *Behind the scenes*, *Tip/Tutorial*, *Personal story*, *Resource share* |
| 📋 **One-Click Copy** | Email-safe HTML, plain text, LinkedIn post |
| 🔒 **Privacy-first** | Tokens stored in httpOnly cookies; brand data stays in your browser |
| 📱 **Responsive** | Works on desktop and mobile |

---

## ✦ Project Structure

```
brand-kit/
├── index.html              # Static frontend — brand profile, email builder, LinkedIn builder
├── watch.html              # Branded watch page — embeds Vimeo video for a given slug
├── watch-map.json          # Slug → Vimeo ID mapping (add your own entries here)
├── privacy-policy.html     # Privacy Policy page (also served at /privacy-policy)
├── terms-of-service.html   # Terms of Service page (also served at /terms-of-service)
├── vercel.json             # Vercel configuration (routes, rewrites, headers)
└── api/
    ├── _utils.js           # Shared: cookie helpers, PKCE, token refresh
    ├── auth/
    │   ├── google.js       # GET  /api/auth/google     — start OAuth flow
    │   ├── callback.js     # GET  /api/auth/callback   — exchange code for tokens
    │   ├── status.js       # GET  /api/auth/status     — check connection state
    │   └── disconnect.js   # POST /api/auth/disconnect — clear auth cookies
    └── gmail/
        └── draft.js        # POST /api/gmail/draft     — create Gmail draft with CID image embedding
```

---

## ✦ Getting Started (static-only, no Gmail)

```bash
# Clone
git clone https://github.com/ShaanWocker/Personal-Brand-Template-Generator.git
cd Personal-Brand-Template-Generator

# Open directly — no install needed
open index.html
```

The **Brand Profile**, **Email Template**, and **LinkedIn Post** features work fully offline.  
Gmail integration requires deployment to Vercel (see below).

---

## ✦ Deploying to Vercel with Gmail Integration

### 1 — Deploy to Vercel

**Via GitHub (recommended)**
1. Push this repo to GitHub
2. Import at [vercel.com/new](https://vercel.com/new)
3. Every `git push` auto-deploys

**CLI**
```bash
npx vercel
```

---

### 2 — Google Cloud Console setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use an existing one)
3. **Enable the Gmail API**: APIs & Services → Library → search "Gmail API" → Enable
4. **OAuth Consent Screen**: APIs & Services → OAuth consent screen
   - User type: **External**
   - App name, support email, developer contact: fill in yours
   - Scopes: add `https://www.googleapis.com/auth/gmail.compose`, `email`, `profile`
   - Test users: add your Gmail address(es) while in development
5. **OAuth Client**: APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorised redirect URIs: add your deployed URL + `/api/auth/callback`
     ```
     https://brand-kit.shaanwocker.online/api/auth/callback
     ```
   - Copy the **Client ID** and **Client Secret**

---

### 3 — Set Vercel environment variables

In the Vercel Dashboard → Project → Settings → Environment Variables, add:

| Variable | Value | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` | `12345-abc.apps.googleusercontent.com` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-…` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://brand-kit.shaanwocker.online/api/auth/callback` | Must match the URI in Google Console. Replace with your own domain. |
| `APP_URL` | `https://brand-kit.shaanwocker.online` | No trailing slash. Replace with your own domain. |
| `NODE_ENV` | `production` | Enables Secure flag on cookies |

> ⚠️ **Never commit secrets to source control.** These values live only in Vercel's environment.

---

### 4 — Redeploy

After setting env vars, trigger a redeploy (push a commit or use the Vercel dashboard "Redeploy" button).

---

## ✦ Using the Email Template

Once you've customised your template, you have three export options:

| Option | How to use |
|---|---|
| **Copy Email HTML** | Email-safe, table-based HTML — paste into Beehiiv, Mailchimp, ConvertKit, etc. |
| **Copy Plain Text** | Clean text version for platforms that prefer it |
| **Create Gmail Draft** | Requires Gmail connected — creates a draft in your Gmail Drafts folder |

> 💡 The `[First Name]` token is automatically replaced by major email platforms with each subscriber's name.

### Platform-specific paste instructions

| Platform | Steps |
|---|---|
| **Beehiiv** | New post → HTML view → Paste |
| **Mailchimp** | Create campaign → Code your own → Paste HTML |
| **ConvertKit** | New broadcast → HTML editor → Paste |
| **Gmail draft** | Use the built-in "Create Gmail Draft" button |

---

## ✦ Gmail Integration — Privacy & Security

### Two-step connection model

Brand Kit uses **incremental authorization** — scopes are requested only when needed:

| Step | Endpoint | Scopes | What it enables |
|---|---|---|---|
| **Step 1 — Sign in** | `/api/auth/google?step=basic` | `openid email profile` | Identifies your Google account |
| **Step 2 — Enable Drafts** | `/api/auth/google?step=gmail_draft` | `openid email profile` + `gmail.compose` | Creates Gmail drafts |

You can use the email template builder (HTML export, plain text) without ever completing Step 2.

- **Permission requested**: `gmail.compose` only — this allows creating drafts. The app **cannot** read your emails, access your contacts, or send email automatically.
- **No auto-send**: Every draft lands in your Gmail Drafts folder. You review and send it yourself.
- **Token storage**: OAuth tokens are stored in server-side `httpOnly` cookies. They are never exposed to JavaScript or `localStorage`.
- **Identity binding**: A stable Google account identifier (`sub`) is stored to prevent silent account switching (Cross-Account Protection).
- **Revocation**: Click **Disconnect** (or **Sign out**) at any time. The app revokes the token at Google before clearing cookies. You can also revoke access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

---

## ✦ Inline Image & Video Embedding in Gmail Drafts

When creating a Gmail draft, the serverless function can fetch media server-side and embed it as a MIME CID attachment so the image renders without Gmail performing an external fetch.

### Inline Images
- Supply an **Inline Image URL** in the Email Template builder (max **8 MB**).
- The image is fetched server-side, embedded as a `multipart/related` CID attachment, and the `img src` is rewritten to `cid:…` in the draft.
- If the fetch fails (network error, size limit exceeded, etc.) the draft falls back to using the external URL.

### Video (Poster Thumbnail + Watch Page)
- Video cannot play inline in email clients — instead, supply a **Video Slug** and a **Video Poster Image URL**.
- The **Video Slug** is mapped to a Vimeo video ID via `watch-map.json` (see below). The generated watch URL (`https://brand-kit.shaanwocker.online/watch/<slug>`) is embedded as the link on the poster thumbnail.
- The poster image (max **8 MB**) is fetched server-side and embedded as a CID attachment; the thumbnail links to the watch page.
- The video file itself is **never fetched or embedded** in the email.

### URL Security
- Only `http://` and `https://` URLs are accepted for `imageUrl` and `videoPosterUrl`.
- `data:`, `file:`, `ftp:`, and any other schemes are rejected with a `400` error.
- The `videoUrl` is generated server-side from the slug and is always a `https://brand-kit.shaanwocker.online/watch/<slug>` URL — it is not accepted as a direct user-provided URL.

---

## ✦ Watch Page & `watch-map.json`

Brand Kit includes a branded `/watch/<slug>` page that embeds a Vimeo video.

### How it works

1. A visitor opens `https://brand-kit.shaanwocker.online/watch/my-launch-video`.
2. `watch.html` (served via a Vercel rewrite) reads the `my-launch-video` slug from the URL.
3. It fetches `/watch-map.json` and looks up the slug.
4. If found, it renders a branded page with the Vimeo embed, title, and optional description.
5. If not found, it shows a branded "Video not found" page with a link back to `/`.

### Adding your own slugs

Edit `watch-map.json` at the repo root:

```json
{
  "my-launch-video": {
    "vimeoId": "123456789",
    "title": "My Launch Video",
    "description": "An optional description shown below the video."
  }
}
```

| Key | Required | Description |
|---|---|---|
| `vimeoId` | ✅ | Numeric Vimeo video ID (find it in your Vimeo video URL) |
| `title` | ✅ | Displayed as the page `<h1>` and browser tab title |
| `description` | optional | Shown below the video |

### Using a slug in the Email Builder

In the **Email Template** panel:
1. Enter your slug in the **Video Slug** field (e.g. `my-launch-video`).
2. Add a **Video Poster Image URL** — a thumbnail image that becomes the clickable preview in the email.
3. The app generates the full watch URL (`https://brand-kit.shaanwocker.online/watch/<slug>`) internally and links the poster image to it.

> 💡 Email clients cannot play video inline — the poster image acts as a clickable thumbnail that takes readers to the watch page.

### URL structure

| Path | File | Notes |
|---|---|---|
| `/watch/<slug>` | `watch.html` | Served via Vercel rewrite; slug looked up in `watch-map.json` |
| `/watch-map.json` | `watch-map.json` | Static JSON; fetched client-side by `watch.html` |

---

## ✦ Email HTML Rendering Caveats

The exported email HTML uses:
- **Table-based layout** — works in Outlook, Gmail, Apple Mail, Yahoo
- **System fonts** — `Georgia`, `Arial`, `Helvetica` (no external font links)
- **Inline styles** — no `<style>` blocks, maximum compatibility
- **Quoted-printable encoding** for the Gmail draft MIME message

Known limitations:
- Gradient accent stripe may not render in Outlook (shows solid colour fallback)
- Border-radius on buttons may be ignored by older Outlook versions
- Always test in [Litmus](https://litmus.com) or [Email on Acid](https://www.emailonacid.com) before a production send

---

## ✦ Customisation

Brand tokens are CSS custom properties that update live as you change your Brand Profile. The accent colour propagates to all preview elements automatically.

To change the default theme palette, edit `:root` in `index.html`:

```css
:root {
  --black:  #080808;   /* Background */
  --gold:   #c9952a;   /* Primary accent (overridden by brand profile) */
  --gold2:  #e8b84b;   /* Secondary accent */
  --white:  #f0ece4;   /* Body text */
}
```

---

## ✦ Legal Pages

The app includes a **Privacy Policy** and **Terms of Service** available at clean URLs on the deployed domain:

| Page | Clean URL | File |
|---|---|---|
| Privacy Policy | `/privacy-policy` | `privacy-policy.html` |
| Terms of Service | `/terms-of-service` | `terms-of-service.html` |

Routing is handled by Vercel rewrites in `vercel.json` — no extra configuration is needed after deployment.

To customise the legal pages, edit `privacy-policy.html` and `terms-of-service.html` directly. Update the contact email address (`connect@shaanwocker.online`) and effective date to match your deployment.

---

## ✦ Author

<div align="center">

**Shaan Wocker**
*Developer · Educator · Creator*

[🌐 shaanwocker.online](https://shaanwocker.online) &nbsp;·&nbsp; [💼 LinkedIn](https://linkedin.com/in/shaanwocker)

</div>

---

<div align="center">

*Built with intention. Designed for impact.*

```
✦
```

</div>
