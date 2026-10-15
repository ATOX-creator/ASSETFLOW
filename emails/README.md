# Assetflow transactional email templates

Local, version-controlled source for the Supabase Auth **Confirm signup** email.
Supabase Auth creates the account and the confirmation token; Resend is only the
delivery transport (Supabase → Resend SMTP → inbox). Nothing in this directory
sends mail by itself, and nothing here is wired to a hosted project
automatically — this repository has **no `supabase/` directory**, so the files
below must be pasted into the dashboard once per environment.

| File | Purpose |
| --- | --- |
| `confirm-signup.html` | Final HTML for **Supabase Dashboard → Authentication → Email Templates → Confirm signup**. |
| `confirm-signup.subject.txt` | Subject line for the same template. |
| `preview.html` | Generated local preview (sample values). Never used to send. |
| `build-preview.mjs` | Regenerates `preview.html` from `confirm-signup.html`. |

## Preview locally

```bash
node emails/build-preview.mjs   # writes emails/preview.html
```

Open `emails/preview.html` in a browser. The preview substitutes fake values for
`{{ .ConfirmationURL }}`, `{{ .SiteURL }}` and `{{ .Email }}`, and points the logo
at `../public/email/logo.png` so it renders from disk. A leftover-variable check
fails the script if any Supabase variable is unreplaced.

## Apply the template in Supabase

1. Open **Supabase Dashboard → your project → Authentication → Email Templates →
   Confirm signup**.
2. Set the **Subject** to the single line in `confirm-signup.subject.txt`.
3. Replace the body with the full contents of `confirm-signup.html`.
4. Save, then send yourself a real signup to verify (see the checklist below).

Supported template variables used here (only these):

| Variable | Where it is used |
| --- | --- |
| `{{ .ConfirmationURL }}` | Confirm button `href` **and** the plain-text fallback link. Supabase generates and signs this URL — never assemble it by hand. |
| `{{ .SiteURL }}` | Absolute origin for the logo image (`{{ .SiteURL }}/email/logo.png`). |
| `{{ .Email }}` | The address being confirmed. |

Editing `confirm-signup.html` does **not** update a hosted Supabase project;
re-paste after every change. A Resend-hosted template (`resend templates …`) is a
different system and is *not* what Supabase Auth renders over SMTP — keep the two
separate unless an explicitly approved integration is chosen.

## Logo

- Source of truth: `public/app_logo.svg` (1024×1024; it embeds a base64 PNG and
  contains no external references). Email clients do not reliably render SVG, so
  the email uses a PNG derivative.
- Email asset: `public/email/logo.png` — 256×256 PNG, generated from the SVG with
  the `sharp` library already present in `node_modules`:

  ```bash
  node -e "require('sharp')('public/app_logo.svg').resize(256,256,{fit:'cover'}).png({compressionLevel:9}).toFile('public/email/logo.png').then(i=>console.log(i.width,i.height,i.size))"
  ```

- `public/app_logo.svg` and `public/app_logo.png` are unchanged by that command;
  the SVG remains the artwork of record. Re-run the command whenever the SVG
  changes.
- Public URL used in the email: `{{ .SiteURL }}/email/logo.png`, i.e.
  `<site-url>/email/logo.png` (Next.js serves everything in `public/`).
  It only resolves for recipients when **Site URL** in
  **Authentication → URL Configuration** is the real deployed origin (for example
  `https://app.example.com`). With `http://localhost:3000` the image cannot load
  outside your machine — expected until the app is deployed. Nothing is published
  to any third-party image host.

## Resend SMTP configuration (owner, manual — never commit credentials)

Follow the current official guide: <https://resend.com/docs/send-with-supabase-smtp>.

1. **Verify a sending domain** in Resend (Domains → Add Domain → add the DNS
   records, wait for **Verified**). Use a subdomain such as `mail.example.com`;
   you cannot send from Gmail/Outlook addresses.
2. **Create an API key** (API Keys → create, restricted to sending) — this is the
   SMTP password. Store it in a password manager; it is never typed into this
   repository, a screenshot, or a shell history.
3. **Supabase Dashboard → Authentication → Email → SMTP Settings** and enter:
   - Host: `smtp.resend.com`
   - Port: `465` (SMTPS/implicit TLS) — or `587` with STARTTLS
   - Username: `resend`
   - Password: your Resend API key
   - Sender email: an address on your verified domain (e.g. `assetflow@mail.example.com`)
   - Sender name: `Assetflow`
4. **Enable email confirmation** (Authentication → Email → *Confirm signups* on).
5. **URL Configuration**: set **Site URL** to the app origin
   (`http://localhost:3000` locally, the real HTTPS origin once deployed) and add
   these **Redirect URLs** for every environment you use:
   - `<origin>/auth/callback`
   - `<origin>/auth/confirm`
6. Confirm the **From** address matches the verified domain in step 1.
7. **Disable click tracking / link branding** for authentication mail if your
   Resend plan exposes it — rewritten confirmation URLs break verification.

No hosted Supabase or Resend setting is changed by this codebase. If you want the
agent to perform any remote configuration step, grant explicit approval first.

## Optional: Resend CLI template-rendering test

The Resend CLI (`resend-cli v2.23.0`) is installed but **not authenticated** in
this environment, and no test recipient has been approved, so no email was sent.
After `resend login` (run by you, interactively — the key is never passed as an
argument here) and once you name an approved recipient, a single labelled
rendering test can be sent with:

```bash
# Sample-substituted render of the template (NOT the Supabase confirmation flow)
node emails/build-preview.mjs
resend emails send \
  --from "assetflow@mail.example.com" \
  --to "you@example.com" \
  --subject "TEST — Assetflow confirm-signup template preview" \
  --html-file emails/preview.html
```

A direct Resend send only proves the HTML renders and delivers. It does **not**
prove Supabase signup confirmation works — that is verified separately with the
real signup checklist below.

## Real end-to-end verification checklist

1. SMTP + template + redirect URLs configured as above.
2. `npm run dev`, open `http://localhost:3000/signup` in a private window.
3. Submit a real address you control → the "Check your email" dialog appears with
   that address.
4. Open the email: logo, heading, **Confirm my email** button, and the fallback
   link all render; the button points at your app origin, not `supabase.co`.
5. Click the button → lands on `/auth/callback` or `/auth/confirm` → redirected
   signed in to `/dashboard`.
6. Re-open the same link → clear "link expired / already used" error on
   `/login?error=…`, with a route back to sign in.
7. `curl -i http://localhost:3000/api/me` while signed out → `401
   {"error":"unauthorized",...}` (expected), and `200` with your user payload once
   signed in.
8. `/dashboard` in a private window redirects to `/login`.
9. Check **Authentication → Users** in Supabase and the Resend **Logs** for the
   delivered message.
