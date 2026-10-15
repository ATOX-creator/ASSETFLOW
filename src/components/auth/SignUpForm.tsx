"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleCheck, LoaderCircle, Mail } from "lucide-react";
import { useApp } from "@/lib/i18n";
import { resendConfirmationEmail, signUpWithEmail, startGoogleSignIn } from "@/lib/auth/forms";
import { safeNextPath } from "@/lib/auth/redirect";
import { type FieldErrors } from "./validation";
import {
  runSignUp,
  submitButtonModel,
  type SignUpBusy,
  type SignUpField,
} from "./signupFlow";
import AuthShell from "./AuthShell";
import PasswordField from "./PasswordField";
import GoogleButton from "./GoogleButton";

/**
 * "Resend confirmation e-mail" action, shared by the success dialog and the
 * pending-confirmation panel. The response copy is enumeration-safe: an
 * unknown address answers exactly like a delivered one.
 */
function ResendConfirmationButton({ email }: { email: string }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; messageKey: string } | null>(
    null,
  );

  const resend = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const result = await resendConfirmationEmail(email);
      setStatus(
        result.ok
          ? { tone: "ok", messageKey: result.messageKey ?? "auth.resendSent" }
          : { tone: "error", messageKey: result.messageKey ?? "auth.genericError" },
      );
    } catch {
      setStatus({ tone: "error", messageKey: "auth.networkError" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 text-center">
      <button
        type="button"
        onClick={() => void resend()}
        disabled={busy}
        className="btn-ghost w-full"
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Mail className="h-4 w-4" aria-hidden="true" />
        )}
        {busy ? t("auth.resendingConfirmation") : t("auth.resendConfirmation")}
      </button>
      {status ? (
        <p
          role={status.tone === "error" ? "alert" : "status"}
          className={`mt-2 text-xs leading-relaxed ${
            status.tone === "error" ? "text-danger" : "text-muted"
          }`}
        >
          {t(status.messageKey)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Sign-up screen: name, email, password, and confirmation.
 *
 * Account creation goes through Supabase Auth; the profile that appears in
 * the application is created server-side on first sign-in and always as a
 * regular member — no role is ever sent from this form.
 *
 * When the project requires e-mail confirmation, a "Check your email" dialog
 * announces the pending verification (showing the address that was submitted)
 * and hands over to a confirmation panel with a resend action. No session is
 * created before Supabase has verified the account.
 */
export default function SignUpForm() {
  const { t, refreshUser } = useApp();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<SignUpField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<SignUpBusy>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  /** Synchronous guard: two submits in the same tick must not both fire. */
  const submittingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const dialogVisible = dialogOpen && confirmationEmail !== null;
  const showPendingPanel = confirmationEmail !== null && !dialogVisible;

  const dismissDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  useEffect(() => {
    if (dialogVisible) {
      dialogRef.current?.focus();
    }
  }, [dialogVisible]);

  useEffect(() => {
    if (!dialogVisible) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        dismissDialog();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialogVisible, dismissDialog]);

  useEffect(() => {
    if (showPendingPanel) {
      panelRef.current?.focus();
    }
  }, [showPendingPanel]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || submittingRef.current) {
      return;
    }
    setFormError(null);
    setBusy("password");
    submittingRef.current = true;
    let keepBusy = false;
    try {
      const outcome = await runSignUp(
        { name, email, password, confirmPassword },
        { busy: busy !== null, signUp: signUpWithEmail },
      );
      switch (outcome.kind) {
        case "ignored":
          return;
        case "invalid":
          setErrors(outcome.errors);
          return;
        case "failed":
          setErrors({});
          setFormError(outcome.messageKey);
          return;
        case "needs-confirmation":
          setErrors({});
          setConfirmationEmail(outcome.email);
          setDialogOpen(true);
          return;
        default:
          break;
      }
      // Confirmation is disabled on the project: the session already exists.
      setErrors({});
      keepBusy = true;
      await refreshUser();
      router.replace(safeNextPath(null));
      router.refresh();
    } catch {
      setFormError("auth.networkError");
    } finally {
      submittingRef.current = false;
      if (!keepBusy) {
        setBusy(null);
      }
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

  const button = submitButtonModel(busy);
  const disabled = busy !== null;

  if (showPendingPanel && confirmationEmail) {
    return (
      <AuthShell title={t("auth.checkEmailTitle")} hint={t("auth.signUpTitle")}>
        <div
          ref={panelRef}
          tabIndex={-1}
          className="panel p-5 text-center focus:outline-none sm:p-6"
          role="status"
        >
          <span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-success/40 bg-success/10 text-success">
            <CircleCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold">{t("auth.checkEmailTitle")}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {t("auth.checkEmailBody", { email: confirmationEmail })}
          </p>
          <ResendConfirmationButton email={confirmationEmail} />
          <Link href="/login" className="btn-ghost mt-4 w-full">
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

        <button type="submit" disabled={button.disabled} className="btn-primary mt-5 w-full">
          {button.showSpinner ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
          {t(button.labelKey)}
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

      {dialogVisible && confirmationEmail ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              dismissDialog();
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signup-confirm-title"
            aria-describedby="signup-confirm-body"
            tabIndex={-1}
            className="w-full max-w-md rounded-t-2xl border border-line/50 bg-panel p-5 text-ink shadow-2xl focus:outline-none sm:rounded-3xl sm:p-6"
          >
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-success/40 bg-success/10 text-success">
              <CircleCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2
              id="signup-confirm-title"
              className="mt-4 text-center text-base font-semibold text-ink"
            >
              {t("auth.checkEmailTitle")}
            </h2>
            <p
              id="signup-confirm-body"
              className="mt-2 text-center text-sm leading-relaxed text-muted"
            >
              {t("auth.confirmEmailDialogBody", { email: confirmationEmail })}
            </p>
            <ResendConfirmationButton email={confirmationEmail} />
            <button type="button" onClick={dismissDialog} className="btn-primary mt-5 w-full">
              {t("auth.gotIt")}
            </button>
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}
