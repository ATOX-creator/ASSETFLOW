"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, LoaderCircle } from "lucide-react";
import { useApp } from "@/lib/i18n";
import { hasActiveSession, updatePassword } from "@/lib/auth/forms";
import { validatePasswordReset, type FieldErrors } from "./validation";
import AuthShell from "./AuthShell";
import PasswordField from "./PasswordField";

type View = "checking" | "ready" | "no-session";

/**
 * Password reset completion screen.
 *
 * Reached from the recovery e-mail via `/auth/callback?next=/reset-password`,
 * which exchanges the one-time code for a Supabase session. Without a session
 * the form is unusable, so the screen offers a way to request a fresh link
 * instead of presenting a dead end.
 */
export default function ResetPasswordForm() {
  const { t, refreshUser } = useApp();
  const router = useRouter();

  const [view, setView] = useState<View>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"password" | "confirmPassword">>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const hasSession = await hasActiveSession();
      if (active) {
        setView(hasSession ? "ready" : "no-session");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || view !== "ready") {
      return;
    }
    const found = validatePasswordReset({ password, confirmPassword });
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      return;
    }

    setBusy(true);
    try {
      const result = await updatePassword(password);
      if (!result.ok) {
        setFormError(result.messageKey ?? "auth.genericError");
        setBusy(false);
        return;
      }
      setDone(true);
      await refreshUser();
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setFormError("auth.networkError");
      setBusy(false);
    }
  };

  if (view === "checking") {
    return (
      <AuthShell title={t("auth.resetTitle")}>
        <div className="panel flex items-center justify-center gap-2 p-6 text-muted">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span className="text-xs">{t("common.loading")}</span>
        </div>
      </AuthShell>
    );
  }

  if (view === "no-session") {
    return (
      <AuthShell title={t("auth.linkInvalidTitle")}>
        <div className="panel p-5 text-center sm:p-6" role="alert">
          <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-danger/40 bg-danger/10 text-danger">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold">{t("auth.linkInvalidTitle")}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {t("auth.linkInvalidBody")}
          </p>
          <Link href="/forgot-password" className="btn-primary mt-5 w-full">
            {t("auth.needNewLink")}
          </Link>
          <Link
            href="/login"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t("auth.backToSignIn")}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.resetTitle")} hint={t("auth.resetHint")}>
      <form onSubmit={submit} noValidate className="panel p-5 sm:p-6">
        {formError ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {t(formError)}
          </p>
        ) : null}

        {done ? (
          <p
            role="status"
            className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-xs text-success"
          >
            {t("auth.passwordUpdated")}
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          <PasswordField
            label={t("auth.newPasswordLabel")}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            showLabel={t("auth.showPassword")}
            hideLabel={t("auth.hidePassword")}
            error={errors.password ? t(errors.password) : null}
            disabled={busy}
          />
          <PasswordField
            label={t("auth.confirmPasswordLabel")}
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            showLabel={t("auth.showPassword")}
            hideLabel={t("auth.hidePassword")}
            error={errors.confirmPassword ? t(errors.confirmPassword) : null}
            disabled={busy}
          />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          {t("auth.passwordHint")}
        </p>

        <button type="submit" disabled={busy || done} className="btn-primary mt-5 w-full">
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound className="h-4 w-4" aria-hidden="true" />
          )}
          {busy ? t("auth.savingPassword") : t("auth.updatePassword")}
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
