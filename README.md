# Assetflow

IT asset management workspace built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase Auth, featuring optical scanning (camera QR/barcode + OCR), live inventory analytics, and an append-only asset log.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Create `.env.local` in the project root (it is gitignored — never commit it) and fill in **by name**:

**Public (browser-safe, inlined into the client bundle):**

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key used by the browser and server clients |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional fallback name for the publishable key |

**Server-only (never expose to the browser):**

| Variable | Purpose |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Reserved for future server-side admin work. The application code never reads it, and it must never be referenced from client components. |
| `SUPABASE_SECRET_API_KEY` / `SUPABASE_SECRET_ANON_KEY` | Optional dashboard/management credentials; unused by the app. |
| `SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_PASSWORD` | Optional local tooling credentials; unused by the app. |

Obsolete variables that are **no longer used** by authentication (safe to delete from local files):
`AUTH_SECRET` — the old HMAC session-signing fallback was removed together with the mock login system.

### 3. Run the app

```bash
npm run dev    # development server on http://localhost:3000
npm run lint   # ESLint
npm run test   # Vitest unit tests
npm run build  # production build (also type-checks)
```

## Authentication (Supabase Auth)

Assetflow uses the official [`@supabase/ssr`](https://supabase.com/docs/reference/javascript/ssr) pattern with separate clients:

- **Browser client** — `src/lib/supabase/client.ts` (`createBrowserClient`, PKCE flow, httpOnly-less browser cookies managed by the library).
- **Server client** — `src/lib/supabase/server.ts` (Server Components and Route Handlers; `auth.getUser()` verifies the JWT against Supabase on every call).
- **Middleware client** — `src/lib/supabase/middleware.ts` (Edge middleware reads/refreshes the session cookies on every navigation).

Identity and sessions come **only** from Supabase Auth. The previous mock system (passwordless "pick an account" login, public `/api/auth/users` directory, HMAC cookie signed with a hardcoded fallback secret) has been deleted.

### Screens

| Route | Component | Purpose |
| --- | --- | --- |
| `/login` | `src/components/auth/LoginForm.tsx` | Email + password sign-in, Google sign-in |
| `/signup` | `src/components/auth/SignUpForm.tsx` | Name/email/password/confirmation sign-up, Google sign-up |
| `/forgot-password` | `src/components/auth/ForgotPasswordForm.tsx` | Sends the Supabase recovery e-mail (generic, enumeration-safe response) |
| `/reset-password` | `src/components/auth/ResetPasswordForm.tsx` | Sets a new password after the recovery link |
| `/auth/callback` | `src/app/auth/callback/route.ts` | OAuth + PKCE/e-mail code exchange, provider error handling |
| `/auth/confirm` | `src/app/auth/confirm/route.ts` | E-mail confirmation links (`token_hash` + `type`) |

All `next=` destinations are sanitised (`src/lib/auth/redirect.ts`) — only same-origin, single-slash paths are accepted, which blocks open redirects.

### Route and API protection

1. **`src/middleware.ts`** — refreshes the Supabase session on every matched request, redirects anonymous visitors on private pages to `/login?next=…`, and answers anonymous API requests with JSON `401` (never an HTML redirect). It also actively clears any leftover legacy `af_session` cookie.
2. **`src/app/(app)/layout.tsx`** — server-side re-check for every private screen.
3. **Every route handler** calls `requireUser()` (`src/lib/auth/session.ts`), which resolves the profile from the *verified* Supabase identity. Authorization failures return JSON `403` (`ForbiddenError`), authentication failures JSON `401`.

Public paths: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/auth/confirm`, `/api/auth/logout`, and static assets.

### Profiles and roles

- The Supabase user id is the application profile key (`src/lib/auth/profile.ts`).
- Profile creation is **idempotent** and always creates a `member` (`src/lib/data/users.ts`). Roles cannot be supplied by the client; `PUT /api/preferences` returns `403` for any `role` or foreign `userId`/`id` payload.
- The application is single-organization: all authenticated users share one inventory (there is no per-tenant isolation today).

## Supabase configuration (manual, in the dashboard)

These steps are intentionally **not** automated — perform them once per environment:

1. **URL and keys** — Project Settings → API → copy the Project URL and anon/publishable key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. **Authentication → URL Configuration**
   - **Site URL**: your app origin, e.g. `http://localhost:3000` (local) or `https://your-domain` (staging/production).
   - **Redirect URLs**: add `<origin>/auth/callback` and `<origin>/auth/confirm` for every environment you use. The app builds these dynamically from the browser origin; nothing is hardcoded.
3. **Authentication → Providers → Google**
   - Enable the Google provider (already enabled in this project).
   - Supply the Google OAuth client ID/client secret from the Google Cloud console.
   - In Google Cloud, authorise the Supabase redirect URI shown in the provider settings (`https://<project-ref>.supabase.co/auth/v1/callback`).
4. **Authentication → Emails**
   - Confirm sign-ups: keep enabled for production. The sign-up screen then shows a "check your email" state, and the user must verify before signing in.
   - **Email templates**: point the confirmation/recovery links at the application. Either
     - use the built-in `{{ .ConfirmationURL }}` with the Site URL/Redirect URLs configured above (PKCE `?code=` is handled by `/auth/callback`), or
     - use `/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=/dashboard` (also handled).
   - Password recovery is initiated with `redirectTo = <origin>/auth/callback?next=/reset-password`, so the recovery link always lands on a usable reset screen.

> Google OAuth has **not** been end-to-end verified from this environment (no browser session was driven here). Before relying on it in a deployed environment, verify the Site URL, the redirect allowlist, and one complete sign-in round trip in the target environment.

## Safe local testing

- Use `http://localhost:3000` — add `http://localhost:3000/auth/callback` to the Supabase Redirect URL allowlist first.
- Sign up with your own address; if e-mail confirmation is enabled, use the magic link Supabase sends (check the project's Auth logs / SMTP provider), or temporarily use a test inbox — do **not** disable confirmation in a shared/production project.
- Verify guards with a private window: `/dashboard` must redirect to `/login`, and `/api/assets` must return `401 {"error":"unauthorized"}`.
- An old `af_session` cookie (from the previous mock login) is ignored and cleared automatically.

## Data layer (known limitation)

Application data (assets, logs, preferences, profiles) is stored in a local JSON file (`.data/db.json`, gitignored) through `src/lib/data/local.ts`. This is fine for single-user/local preview use but is **not** suitable for multi-instance or serverless hosting: writes are process-local and would diverge between instances. Supabase is used for **authentication only** today — migrating the data layer to Supabase tables (with RLS) is a separate, explicitly approved piece of work. No production database migrations or RLS changes are made by this codebase.

## Tests

```bash
npm run test
```

Unit tests mock Supabase (`@supabase/ssr` / injected clients) and are clearly **not** integration tests:

- `src/middleware.test.ts` — private-page redirects, API `401`, legacy mock-cookie rejection, open-redirect blocking.
- `src/lib/auth/session.test.ts`, `profile.test.ts`, `data/users.test.ts` — verified-identity resolution, idempotent profile creation, no self-elevation.
- `src/lib/auth/forms.test.ts`, `components/auth/validation.test.ts` — login success/failure, sign-up confirmation behaviour, generic recovery response, Google OAuth initiation, form validation.
- `src/app/auth/callback/route.test.ts` — code exchange, provider error handling, `token_hash` confirmation, redirect sanitisation.
- `src/app/api/preferences/route.test.ts` — `401`/`403` (impersonation and role-escalation attempts).
- `src/lib/api/server.test.ts` — error envelope (`401`/`403`/`409`, generic `500` without internals).
- `src/lib/auth/legacy.test.ts` — regression guards that fail if mock-auth endpoints, the HMAC signer, or hardcoded secrets reappear.

## Repository notes

- Branch: `preview` (remote `origin`, `git@github.com:ativix/Assetflow.git`).
- Never commit `.env.local`, `.data/`, `.next/`, or `node_modules/` — all are gitignored.
