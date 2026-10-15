import { describe, expect, it, vi } from "vitest";
import { runSignUp, submitButtonModel, type SignUpValues } from "./signupFlow";

const valid: SignUpValues = {
  name: "Jane Doe",
  email: "  jane@company.com  ",
  password: "secret-pass",
  confirmPassword: "secret-pass",
};

function mockSignUp(response: {
  ok: boolean;
  messageKey?: string;
  needsConfirmation?: boolean;
}) {
  return vi.fn().mockResolvedValue(response);
}

describe("runSignUp", () => {
  it("reports the submitted address when confirmation is required", async () => {
    const signUp = mockSignUp({ ok: true, needsConfirmation: true });

    const outcome = await runSignUp(valid, { signUp });

    expect(outcome).toEqual({
      kind: "needs-confirmation",
      email: "jane@company.com",
    });
    expect(signUp).toHaveBeenCalledWith({
      name: "Jane Doe",
      email: "  jane@company.com  ",
      password: "secret-pass",
    });
  });

  it("ignores duplicate submissions while a request is in flight", async () => {
    const signUp = mockSignUp({ ok: true, needsConfirmation: true });

    const outcome = await runSignUp(valid, { busy: true, signUp });

    expect(outcome).toEqual({ kind: "ignored" });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("validates before calling Supabase", async () => {
    const signUp = mockSignUp({ ok: true });

    const outcome = await runSignUp(
      { ...valid, email: "not-an-email", password: "short" },
      { signUp },
    );

    expect(outcome.kind).toBe("invalid");
    expect(outcome).toMatchObject({
      errors: {
        email: "auth.validation.emailInvalid",
        password: "auth.validation.passwordShort",
        confirmPassword: "auth.validation.passwordMismatch",
      },
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("surfaces provider failures without a confirmation state", async () => {
    const signUp = mockSignUp({ ok: false, messageKey: "auth.rateLimited" });

    const outcome = await runSignUp(valid, { signUp });

    expect(outcome).toEqual({ kind: "failed", messageKey: "auth.rateLimited" });
    expect(outcome.kind).not.toBe("needs-confirmation");
  });

  it("falls back to a generic key and never claims success on a thrown error", async () => {
    const signUp = vi.fn().mockRejectedValue(new Error("boom"));

    const outcome = await runSignUp(valid, { signUp });

    expect(outcome).toEqual({ kind: "failed", messageKey: "auth.networkError" });
  });

  it("uses the generic error key when the provider omits one", async () => {
    const signUp = mockSignUp({ ok: false });

    const outcome = await runSignUp(valid, { signUp });

    expect(outcome).toEqual({ kind: "failed", messageKey: "auth.genericError" });
  });

  it("signs in directly when confirmation is disabled on the project", async () => {
    const signUp = mockSignUp({ ok: true });

    const outcome = await runSignUp(valid, { signUp });

    expect(outcome).toEqual({ kind: "signed-in" });
  });
});

describe("submitButtonModel", () => {
  it("renders the spinner inside the button while the request is pending", () => {
    expect(submitButtonModel("password")).toEqual({
      disabled: true,
      showSpinner: true,
      labelKey: "auth.creatingAccount",
    });
  });

  it("is interactive when idle", () => {
    expect(submitButtonModel(null)).toEqual({
      disabled: false,
      showSpinner: false,
      labelKey: "auth.createAccount",
    });
  });

  it("keeps the Google redirect from re-enabling the submit button", () => {
    expect(submitButtonModel("google")).toEqual({
      disabled: true,
      showSpinner: false,
      labelKey: "auth.createAccount",
    });
  });
});
