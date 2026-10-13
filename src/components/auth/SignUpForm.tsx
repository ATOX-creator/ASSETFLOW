"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleCheck, LoaderCircle } from "lucide-react";
import { useApp } from "@/lib/i18n";
import { signUpWithEmail, startGoogleSignIn } from "@/lib/auth/forms";
import { safeNextPath } from "@/lib/auth/redirect";
import { validateSignUp, type FieldErrors } from "./validation";
import AuthShell from "./AuthShell";
import PasswordField from "./PasswordField";
import GoogleButton from "./GoogleButton";

/**
 * Sign-up screen: name, email, password, and confirmation.
 *
 * Account creation goes through Supabase Auth; the profile that appears in
 * the application is created server-side on first sign-in and always as a
 * regular member — no role is ever sent from this form.
 */
export default function SignUpForm() {
  const { t, refreshUser } = useApp();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<
    "name" | "email" | "password" | "confirmPassword"
  >>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"password" | "google" | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    const found = validateSignUp({ name, email, password, confirmPassword });
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      return;
    }

    setBusy("password");
    try {
      const result = await signUpWithEmail({ name, email, password });
      if (!result.ok) {
        setFormError(result.messageKey ?? "auth.genericError");
        setBusy(null);
        return;
      }
      if (result.needsConfirmation) {
        setConfirmationEmail(email.trim());
        setBusy(null);
        return;
      }
      // Confirmation is disabled on the project: the session already exists.
      await refreshUser();
      router.replace(safeNextPath(null));
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
      const result = await startGoogleSignIn(null);
      if (!result.ok) {
        setFormError(result.messageKey ?? "auth.oauthFailed");
        setBusy(null);
      }
    } catch {
      setFormError("auth.oauthFailed");
      setBusy(null);
    }
  };

  const disabled = busy !== null;

  if (confirmationEmail) {
    return (
      <AuthShell title={t("auth.checkEmailTitle")} hint={t("auth.signUpTitle")}>
        <div className="panel p-5 text-center sm:p-6" role="status">
          <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-success/40 bg-success/10 text-success">
            <CircleCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold">{t("auth.checkEmailTitle")}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {t("auth.checkEmailBody", { email: confirmationEmail })}
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
    <AuthShell title={t("auth.signUpTitle")} hint={t("auth.signUpHint")}>
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
            <label htmlFor="signup-name" className="mb-1.5 block text-xs font-medium text-muted">
              {t("auth.nameLabel")}
            </label>
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              autoFocus
              className="field"
              placeholder={t("auth.namePlaceholder")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={disabled}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "signup-name-error" : undefined}
            />
            {errors.name ? (
              <p id="signup-name-error" role="alert" className="mt-1.5 text-xs text-danger">
                {t(errors.name)}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="signup-email" className="mb-1.5 block text-xs font-medium text-muted">
              {t("auth.emailLabel")}
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="field"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={disabled}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "signup-email-error" : undefined}
            />
            {errors.email ? (
              <p id="signup-email-error" role="alert" className="mt-1.5 text-xs text-danger">
                {t(errors.email)}
              </p>
            ) : null}
          </div>

          <PasswordField
            label={t("auth.passwordLabel")}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            showLabel={t("auth.showPassword")}
            hideLabel={t("auth.hidePassword")}
            error={errors.password ? t(errors.password) : null}
            disabled={disabled}
          />

          <PasswordField
            label={t("auth.confirmPasswordLabel")}
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            showLabel={t("auth.showPassword")}
            hideLabel={t("auth.hidePassword")}
            error={errors.confirmPassword ? t(errors.confirmPassword) : null}
            disabled={disabled}
          />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          {t("auth.passwordHint")}
        </p>

        <button type="submit" disabled={disabled} className="btn-primary mt-5 w-full">
          {busy === "password" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
          {busy === "password" ? t("auth.creatingAccount") : t("auth.createAccount")}
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
          {t("auth.haveAccount")}{" "}
          <Link
            href="/login"
            className="font-semibold text-accent transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("auth.signIn")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
