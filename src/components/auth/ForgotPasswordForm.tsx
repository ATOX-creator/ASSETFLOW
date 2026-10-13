"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, MailCheck } from "lucide-react";
import { useApp } from "@/lib/i18n";
import { requestPasswordReset } from "@/lib/auth/forms";
import { validateEmailOnly } from "./validation";
import AuthShell from "./AuthShell";

/**
 * Password-recovery request screen.
 *
 * Supabase's recovery e-mail is triggered here. The success copy is
 * intentionally generic so the form never reveals whether an address belongs
 * to an account.
 */
export default function ForgotPasswordForm() {
  const { t } = useApp();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    const found = validateEmailOnly(email);
    setEmailError(found.email ? t(found.email) : null);
    setFormError(null);
    if (found.email) {
      return;
    }

    setBusy(true);
    try {
      const result = await requestPasswordReset(email);
      if (!result.ok) {
        setFormError(result.messageKey ?? "auth.genericError");
        setBusy(false);
        return;
      }
      setSent(true);
      setBusy(false);
    } catch {
      setFormError("auth.networkError");
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title={t("auth.resetSentTitle")}>
        <div className="panel p-5 text-center sm:p-6" role="status">
          <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-accent/40 bg-accent-soft text-accent">
            <MailCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold">{t("auth.resetSentTitle")}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {t("auth.resetSentBody")}
          </p>
          <Link href="/login" className="btn-ghost mt-5 w-full">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("auth.backToSignIn")}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.forgotTitle")} hint={t("auth.forgotHint")}>
      <form onSubmit={submit} noValidate className="panel p-5 sm:p-6">
        {formError ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {t(formError)}
          </p>
        ) : null}

        <div>
          <label htmlFor="forgot-email" className="mb-1.5 block text-xs font-medium text-muted">
            {t("auth.emailLabel")}
          </label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            className="field"
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "forgot-email-error" : undefined}
          />
          {emailError ? (
            <p id="forgot-email-error" role="alert" className="mt-1.5 text-xs text-danger">
              {emailError}
            </p>
          ) : null}
        </div>

        <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <MailCheck className="h-4 w-4" aria-hidden="true" />
          )}
          {busy ? t("auth.sendingLink") : t("auth.sendResetLink")}
        </button>

        <p className="mt-5 text-center text-xs text-muted">
          <Link
            href="/login"
            className="font-semibold text-accent transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("auth.backToSignIn")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
