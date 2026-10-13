"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useApp } from "@/lib/i18n";
import { authQueryErrorKey, hasActiveSession, signInWithEmail, startGoogleSignIn } from "@/lib/auth/forms";
import { safeNextPath } from "@/lib/auth/redirect";
import { validateLogin, type FieldErrors } from "./validation";
import AuthShell from "./AuthShell";
import PasswordField from "./PasswordField";
import GoogleButton from "./GoogleButton";

function currentParam(name: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Sign-in screen: email + password through Supabase Auth, plus the Google
 * OAuth option. Destinations coming from `?next=` are re-validated here even
 * though the middleware already sanitised them.
 */
export default function LoginForm() {
  const { t, refreshUser } = useApp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"password" | "google" | null>(null);

  useEffect(() => {
    const errorCode = currentParam("error");
    if (errorCode) {
      setFormError(authQueryErrorKey(errorCode) ?? "auth.genericError");
      window.history.replaceState({}, "", window.location.pathname);
    }
    // Covers the rare case where a session becomes available only in the
    // browser (e.g. a redirect that carried auth tokens in the URL): leave
    // the sign-in screen instead of showing a form that cannot be used.
    void (async () => {
      if (await hasActiveSession()) {
        router.replace(safeNextPath(currentParam("next")));
        router.refresh();
      }
    })();
  }, [router]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    const found = validateLogin({ email, password });
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      return;
    }

    setBusy("password");
    try {
      const result = await signInWithEmail({ email, password });
      if (!result.ok) {
        setFormError(result.messageKey ?? "auth.genericError");
        setBusy(null);
        return;
      }
      await refreshUser();
      router.replace(safeNextPath(currentParam("next")));
      router.refresh();
    } catch {
      setFormError("auth.networkError");
      setBusy(null);
    }
  };

  const google = async () => {
    if (busy) {
      return;
    }
    setBusy("google");
    setFormError(null);
    try {
      const result = await startGoogleSignIn(currentParam("next"));
      if (!result.ok) {
        setFormError(result.messageKey ?? "auth.oauthFailed");
        setBusy(null);
      }
      // On success the browser leaves for Google's consent screen.
    } catch {
      setFormError("auth.oauthFailed");
      setBusy(null);
    }
  };

  const disabled = busy !== null;

  return (
    <AuthShell title={t("auth.signInTitle")} hint={t("auth.signInHint")}>
      <form onSubmit={submit} noValidate className="panel p-5 sm:p-6">
        {formError ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {t(formError)}
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-muted">
              {t("auth.emailLabel")}
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              className="field"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={disabled}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "login-email-error" : undefined}
            />
            {errors.email ? (
              <p id="login-email-error" role="alert" className="mt-1.5 text-xs text-danger">
                {t(errors.email)}
              </p>
            ) : null}
          </div>

          <PasswordField
            label={t("auth.passwordLabel")}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            showLabel={t("auth.showPassword")}
            hideLabel={t("auth.hidePassword")}
            error={errors.password ? t(errors.password) : null}
            disabled={disabled}
          />
        </div>

        <div className="mt-3 flex justify-end">
          <Link
            href="/forgot-password"
            className="rounded-md text-xs font-medium text-accent transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("auth.forgotPassword")}
          </Link>
        </div>

        <button type="submit" disabled={disabled} className="btn-primary mt-5 w-full">
          {busy === "password" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
          {busy === "password" ? t("auth.signingIn") : t("auth.signIn")}
        </button>

        <div className="my-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-line/50" />
          <span className="eyebrow">{t("auth.orContinueWith")}</span>
          <span className="h-px flex-1 bg-line/50" />
        </div>

        <GoogleButton
          label={t("auth.google")}
          busyLabel={t("auth.redirecting")}
          onClick={() => void google()}
          busy={busy === "google"}
          disabled={busy === "password"}
        />

        <p className="mt-5 text-center text-xs text-muted">
          {t("auth.noAccount")}{" "}
          <Link
            href="/signup"
            className="font-semibold text-accent transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("auth.createAccount")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
