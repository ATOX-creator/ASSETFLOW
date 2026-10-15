# Cloudflare Deploy Config — Commit & Push Report

**Status: PUSHED (Commit 1 only)** — `git push origin preview` succeeded: `d3caf1a..6fc6d93  preview -> preview`. README Commit 2 withheld per user decision after the unsupported-claim gate. Working branch now in sync with `origin/preview`.

## Commits

| # | Hash | Message | Contents | Pushed |
|---|------|---------|----------|--------|
| 1 | `4d7472c` (pre-existing) | `feat(email): add Supabase Auth reset-password template with contract tests` | 5 email-template files (already local before this task) | YES |
| 2 | `6fc6d93` (created here) | `build(cloudflare): add OpenNext deploy scripts and config` | 6 deployment files (below) | YES |
| 3 | *not created* | `docs(readme): replace README with concise project description` | held — README claim flagged; user chose to push Commit 1 only | NO (README remains modified/uncommitted in working tree) |

## Checks

| Check | Result | Evidence |
|-------|--------|----------|
| `npm run lint` | PASS | eslint exited 0, no output |
| `npm run test` | PASS | 31 files, 253/253 tests passed |
| `npm run build` | PASS | 28/28 static pages, production build completed |
| `npm ls @opennextjs/cloudflare wrangler` | PASS | resolves: `@opennextjs/cloudflare@1.20.10`, `wrangler@4.150.0` (deduped) |
| Lockfile Linux optional binaries | PASS | `@esbuild/linux-x64`, `@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64`, `@cloudflare/workerd-linux-64` all present in `package-lock.json` |
| `compatibility_date` vs installed workerd | FIXED | bundled workerd `1.20261006.1` supports max date `2026-10-06`; original `2026-10-13` was too late → **changed to `2026-10-06`** in `wrangler.jsonc` (new file, authorized) |
| `wrangler.jsonc` secret scan | PASS | no secrets, account IDs, or env values; only bindings and `main: .open-next/worker.js`; `nodejs_compat` set |
| Staged-diff secret scan (Commit 1) | PASS | no keys/tokens/`eyJ`/private keys; only npm registry URLs |
| `package.json` hunk scope | PASS | diff = exactly 3 scripts (`preview`, `deploy`, `cf-typegen`) + 2 deps (`@opennextjs/cloudflare`, `wrangler`) |
| `next.config.ts` hunk scope | PASS | diff = only `initOpenNextCloudflareForDev()` addition |
| `.gitignore` hunk scope | PASS | diff = only Cloudflare block (`/.wrangler`, `/.open-next`, `.dev.vars*`, `cloudflare-env.d.ts`) |
| README grounding — dashboard analytics | PASS | `src/app/(app)/dashboard/` + `AssetAnalytics` |
| README grounding — asset ledger | PASS | `src/app/(app)/assets/` |
| README grounding — appendable event record | PASS | `src/app/(app)/log/` (+ import) |
| README grounding — camera QR/barcode scanning | PASS | `src/app/(app)/scanner/`, `html5-qrcode` dep |
| README grounding — "who is using them" | **FAIL (unsupported)** | `AssetRecord` (`src/lib/data/types.ts:18-28`) has no assignee/custodian/user field — only `location` and `status`. User linkage exists only on log/scan records (`scannedBy*`, `userId`), i.e. "who scanned", not "who is using" |
| README secrets/internal hosts | PASS | no secrets, token URLs, or internal hostnames |
| `public/_headers` required by deploy config? | N/A — not staged | not referenced by `wrangler.jsonc`/`open-next.config.ts`; left untracked per "if unsure, leave out" |

## Commit 1 files (`6fc6d93`)

- `package.json` — 3 scripts + 2 deps only
- `package-lock.json` — adds OpenNext/wrangler dependency tree (+3836/-112 lines); removes 5 stale packages (`@nolyfill/is-core-module`, `@rtsao/scc`, `@rushstack/eslint-patch`, `std-env`, `stop-iteration-iterator`)
- `wrangler.jsonc` — new; `compatibility_date` corrected to `2026-10-06`
- `open-next.config.ts` — new; `defineCloudflareConfig()` default
- `next.config.ts` — `initOpenNextCloudflareForDev()` only
- `.gitignore` — Cloudflare block only

## Deliberately excluded (left uncommitted/unstaged, preserved as found)

`README.md` (held for Commit 2), `eslint.config.mjs`, `src/components/AppShell.tsx`, `src/components/auth/*` (incl. untracked `signupFlow.*`), `src/lib/auth/*`, `src/lib/i18n/*`, `src/lib/supabase/env.*` (+ test), `src/lib/email/confirmSignupTemplate.test.ts`, `src/app/api/me/route.test.ts`, `emails/*`, `finding.md`, `open-next-build.log`, `public/_headers`, `public/app_logo.*`, `public/main-logo.svg`, `.env.local` (never opened).

## Manual follow-ups (cannot be done from here)

1. Cloudflare Workers Builds: confirm the watched production branch is `preview` (production/test are stale at `95ca13c`); confirm build command and that `NEXT_PUBLIC_SUPABASE_URL` + Supabase publishable/anon key are set.
2. Watch the next build log: install step (lockfile) and deploy step (`npm run deploy` should now resolve).
3. Smoke test after deploy: `/login`, `/dashboard` redirect, `/api/assets` returns `401`.
4. Known limitation: `.data/db.json` local-file data layer will not persist on Workers — a green deploy does not mean those features work end-to-end.
5. The previous uncommitted README (email docs etc.) was overwritten in the working tree and is not recoverable via git; the committed README at `d3caf1a` still is.

## Risks

- First successful deploy publishes the Worker for real (no dry-run authorized here).
- Env vars in Cloudflare must be configured or runtime auth will fail despite a green build.
- README Commit 2 withheld: "who is using them" is unsupported by the data model; user chose to push the deploy fix only. Fix README wording separately before committing it.
