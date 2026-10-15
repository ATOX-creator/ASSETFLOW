import { signUpWithEmail } from "@/lib/auth/forms";
import { validateSignUp, type FieldErrors } from "./validation";

/**
 * Pure, testable core of the sign-up submission.
 *
 * The component stays a thin shell: validation, the duplicate-submission
 * guard, and the mapping from a Supabase Auth result to UI state all live
 * here so they can be unit-tested without a DOM. Every outcome carries an
 * i18n key — raw provider messages never reach the interface.
 */

export type SignUpField = "name" | "email" | "password" | "confirmPassword";

export interface SignUpValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/** The form is either idle, submitting, or busy with the Google redirect. */
export type SignUpBusy = "password" | "google" | null;

export type SignUpOutcome =
  /** An earlier submission is still running — do nothing. */
  | { kind: "ignored" }
  /** Client-side validation failed; show the field errors. */
  | { kind: "invalid"; errors: FieldErrors<SignUpField> }
  /** Supabase/network failure; show a single form-level message. */
  | { kind: "failed"; messageKey: string }
  /** Account created; the address must be confirmed before sign-in. */
  | { kind: "needs-confirmation"; email: string }
  /** Confirmation is disabled on the project: a session already exists. */
  | { kind: "signed-in" };

export interface SignUpDeps {
  /** True while another submission is in flight (state or in-flight flag). */
  busy?: boolean;
  /** Injectable for tests; defaults to the Supabase browser client call. */
  signUp?: typeof signUpWithEmail;
}

export async function runSignUp(
  values: SignUpValues,
  deps: SignUpDeps = {},
): Promise<SignUpOutcome> {
  if (deps.busy) {
    return { kind: "ignored" };
  }

  const errors = validateSignUp(values);
  if (Object.keys(errors).length > 0) {
    return { kind: "invalid", errors };
  }

  const signUp = deps.signUp ?? signUpWithEmail;
  try {
    const result = await signUp({
      name: values.name,
      email: values.email,
      password: values.password,
    });
    if (!result.ok) {
      return { kind: "failed", messageKey: result.messageKey ?? "auth.genericError" };
    }
    if (result.needsConfirmation) {
      return { kind: "needs-confirmation", email: values.email.trim() };
    }
    return { kind: "signed-in" };
  } catch {
    return { kind: "failed", messageKey: "auth.networkError" };
  }
}

export interface SubmitButtonModel {
  /** A sign-up request is running: the button is disabled. */
  disabled: boolean;
  /** Renders the in-button spinner instead of the trailing arrow. */
  showSpinner: boolean;
  labelKey: string;
}

/** Drives the "Create account" button so its width stays stable while busy. */
export function submitButtonModel(busy: SignUpBusy): SubmitButtonModel {
  const pending = busy === "password";
  return {
    disabled: busy !== null,
    showSpinner: pending,
    labelKey: pending ? "auth.creatingAccount" : "auth.createAccount",
  };
}
