# Resend / Supabase Auth email report — Reset-password template

**Date:** 2026-10-14 · **Mode:** additive-only implementation after a read-only audit · **Branch:** `preview` @ `d3caf1a6f0b1e05f73c90e26b9e863bb3ed16440`
**Authorization:** new Supabase Auth "Reset password" template + subject + contract tests + this report. No existing file was modified, staged, committed, or pushed.

---

## 1. Architecture (from the read-only audit — unchanged by this task)

**Flow: Supabase Auth (hosted, owns the trigger) → Resend as SMTP transport only → inbox.**

- The only existing email triggers live in `src/lib/auth/forms.ts` (`signUpWithEmail`, `resendConfirmationEmail`, `requestPasswordReset`). Recovery is initiated by `requestPasswordReset` (`forms.ts:179`) via `resetPasswordForEmail(..., { redirectTo: authCallbackUrl("/reset-password") })`; Supabase Auth then mints and sends the recovery link. **This task added no trigger, no wiring, no SDK, no Resend API path** (none exists in `package.json` — verified).
- The existing `/auth/callback` route verifies `type=recovery` links and lands on `/reset-password` (`src/app/auth/callback/route.test.ts`). The new template uses Supabase's own `{{ .ConfirmationURL }}` for that pre-existing flow — **no application route or redirect was invented**.
- Template variables (verified against the official Supabase Email Templates documentation, 2026-10-14, `supabase.com/docs/guides/auth/auth-email-templates`): the **Reset password** template's canonical/default variables are `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, `{{ .Email }}` (Supabase's own default recovery content and default subject "Reset your password" confirmed). The template uses exactly these three — the same set the repository already documents in `emails/README.md` for confirm-signup.
- Interpolation safety: every variable appears only (a) inside a double-quoted `href` attribute or (b) as plain text content — never unquoted, never inside `<script>`/event handlers. Matches the existing template's convention; token safety within the URL is Supabase's responsibility (it signs/encodes the verify URL).
- Logo: same hosting convention — `src="{{ .SiteURL }}/email/logo.png"`, raster PNG at `public/email/logo.png` (no third-party image host; enforced by contract test).

## 2. Files created (only these — no existing file touched)

| Path | Purpose |
|---|---|
| `emails/recover-password.html` | HTML body for **Supabase Dashboard → Authentication → Email Templates → Reset password** (English only) |
| `emails/recover-password.subject.txt` | Subject: `Reset your password — Assetflow` (31 chars, single line) |
| `src/lib/email/recoverPasswordTemplate.test.ts` | Contract test mirroring `confirmSignupTemplate.test.ts` (8 assertions) |
| `resend_report.md` | This report |

Baseline safeguard verified before writing: none of the four target paths existed; branch/HEAD/working tree matched the audit (`preview` @ `d3caf1a`, 16 modified + same untracked set, 0 staged). After implementation, `git status --porcelain` is **identical to baseline** — no pre-existing path modified.

## 3. Validation evidence

| Check | Status | Evidence |
|---|---|---|
| New contract tests | **PASS** | `npx vitest run src/lib/email/` → 16/16 (8 new recovery + 8 existing confirm-signup, proving the existing template contract is untouched) |
| Full test suite | **PASS** | `npm run test` → 31 files, **253/253** (baseline was 30/245; +1 file/+8 tests are exactly the new contract test) |
| Lint | **PASS** | `npm run lint` (eslint) → clean, exit 0 |
| Typecheck | **PASS** | `npx tsc --noEmit` → clean (no `typecheck` script exists in `package.json`; used the installed TypeScript, no install performed) |
| Build | **PASS** | `npm run build` (next 15.5.27, turbopack) → completed; `/reset-password` route present |
| Secret scan (new files) | **PASS** | Pattern scan (sk_/re_/sbp_ keys, JWT-like strings, PEM blocks, `api_key=`/`secret=`/`Bearer`, env assignments) on the 3 code files → **no matches**; values were never read or displayed |
| Existing confirmation template, subject, assets, auth code, routes, i18n, Cloudflare config, `README.md`, `package.json`, lockfile | **PASS (untouched)** | `git status --porcelain` unchanged from pre-task baseline |
| Live Resend API / email send | **N/A** | Not called; no email sent (per mandate) |
| SMTP settings, verified sending domain, From address, delivery | **BLOCKED** | Dashboard-only configuration; cannot be verified without a permitted remote check — no claim is made |
| Secret presence (e.g. `RESEND_API_KEY`) | **N/A** | Secret files were not read (`.env.local`, `.dev.vars` untouched) |
| Hosted template actually applied | **N/A** | Requires manual dashboard paste (§5); nothing is synced automatically (no `supabase/` directory) |

**One validation defect found and fixed during this task (self-introduced, not pre-existing):** the first run of the new contract test failed because the test regex `/didn.?t …/` could not match the HTML entity `&rsquo;` in `Didn&rsquo;t request a password reset`. The regex was corrected to match the entity literally; the template file itself was always correct. Re-run: 8/8 green. No unrelated failure was touched.

## 4. Design decisions

- **Naming:** `recover-password.html` / `recover-password.subject.txt` mirror the `confirm-signup.*` snake-case convention and the dashboard's "Reset password" template name; the test file mirrors `confirmSignupTemplate.test.ts`.
- **Copy:** English only (authorized), matching the existing template's structure: logo → brand line → H1 → body with `{{ .Email }}` → CTA → fallback link → single-use notice → unknown-recipient ignore notice → footer. Structure, palette, and MSO conditional comments are identical to `confirm-signup.html` for brand consistency.
- **No `emails/README.md` update and no `build-preview.mjs` change:** both are pre-existing untracked files; modifying them was outside the authorized additive scope (see §6 risks).

## 5. Outstanding manual actions (owner; not performed, not claimable)

1. Paste `emails/recover-password.html` into **Supabase Dashboard → Authentication → Email Templates → Reset password** and the subject line from `emails/recover-password.subject.txt`; save. Local files never sync automatically.
2. Confirm SMTP transport (host `smtp.resend.com`, port 465/587, username `resend`, Resend API key as password), a **Verified** sending domain, and the **Site URL / Redirect URLs** (`<origin>/auth/callback`, `<origin>/auth/confirm`) — checklist already documented in `emails/README.md` §"Resend SMTP configuration". **None of this was verified or changed by this task.**
3. End-to-end check: `/forgot-password` with a real address → email renders with logo/button/fallback → link lands on `/reset-password` → new password works; re-used link shows the expired-link error. Only this proves delivery and flow; the PASSes above are code-level only.
4. Optional preview: extend `emails/build-preview.mjs` (needs separate authorization) — a recovery preview can currently be produced manually by substituting `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, `{{ .Email }}`.

## 6. Git isolation & unresolved risks

**Nothing staged, committed, or pushed** (awaiting explicit approval per mandate). Proposed staging list (exact paths only — never `git add .`; note the containing directories hold other pre-existing untracked files that must NOT be staged):

```
emails/recover-password.html
emails/recover-password.subject.txt
src/lib/email/recoverPasswordTemplate.test.ts
resend_report.md
```

Proposed commit message: `feat(email): add Supabase Auth reset-password template with contract tests`

Unresolved risks (require your decision; none silently addressed):

1. **Logo dependency on a fresh checkout:** the contract test asserts `public/email/logo.png` exists, but that asset (and the whole pre-existing email workstream) is untracked. With only the four files above committed, the test **passes locally but fails on a clean clone** until `public/email/logo.png` — and ideally the existing `emails/confirm-signup.*` set — are committed in a separately authorized step. Alternative: authorize adding `public/email/logo.png` to this commit.
2. **Partial `emails/` directory in history:** committing only `recover-password.*` records the directory without its README/confirm-signup siblings (cosmetic inconsistency until the rest lands).
3. **`emails/README.md` file table** does not yet list the recovery template (updating it needs authorization; instructions in §5 remain valid as-is).
4. Pre-existing uncommitted work in the tree (Supabase-auth changes, Cloudflare/OpenNext config, `finding.md`) is **deliberately excluded** and remains untouched. Never push to `production`, `test`, `main`, or `master`.

---

*Methodology: baseline re-verification (`git status`, `Test-Path` on all targets); variable set confirmed against official Supabase docs (fetched read-only); vitest/eslint/tsc/next-build runs; pattern-based secret scan of new files with no value exposure. No file outside the four listed was created or modified; no secret read; no API called; no delivery performed.*
