import { describe, expect, it } from "vitest";
import {
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isValidEmail,
  validateEmailOnly,
  validateLogin,
  validatePasswordReset,
  validateSignUp,
} from "./validation";

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("jane.doe@company.com")).toBe(true);
    expect(isValidEmail("  jane@sub.example.co.uk ")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@tld")).toBe(false);
    expect(isValidEmail("two @at.com")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@company.com`)).toBe(false);
  });
});

describe("validateLogin", () => {
  it("returns no errors for valid input", () => {
    expect(validateLogin({ email: "a@b.co", password: "secret-pass" })).toEqual({});
  });

  it("flags empty and malformed emails", () => {
    expect(validateLogin({ email: "", password: "x" })).toEqual({
      email: "auth.validation.emailRequired",
    });
    expect(validateLogin({ email: "nope", password: "x" })).toEqual({
      email: "auth.validation.emailInvalid",
    });
  });

  it("flags a missing password", () => {
    expect(validateLogin({ email: "a@b.co", password: "" })).toEqual({
      password: "auth.validation.passwordRequired",
    });
  });
});

describe("validateSignUp", () => {
  const valid = {
    name: "Jane Doe",
    email: "jane@company.com",
    password: "correct horse",
    confirmPassword: "correct horse",
  };

  it("returns no errors for valid input", () => {
    expect(validateSignUp(valid)).toEqual({});
  });

  it("requires every field", () => {
    const errors = validateSignUp({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
    expect(errors).toEqual({
      name: "auth.validation.nameRequired",
      email: "auth.validation.emailRequired",
      password: "auth.validation.passwordRequired",
      confirmPassword: "auth.validation.passwordRequired",
    });
  });

  it("enforces the password length and confirmation match", () => {
    const errors = validateSignUp({
      ...valid,
      password: "short",
      confirmPassword: "different",
    });
    expect(errors.password).toBe("auth.validation.passwordShort");
    expect(errors.confirmPassword).toBe("auth.validation.passwordMismatch");
    expect(PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(8);
  });

  it("enforces the name length", () => {
    const errors = validateSignUp({ ...valid, name: "x".repeat(NAME_MAX_LENGTH + 1) });
    expect(errors.name).toBe("auth.validation.nameTooLong");
  });
});

describe("validateEmailOnly / validatePasswordReset", () => {
  it("validates the recovery email", () => {
    expect(validateEmailOnly("")).toEqual({ email: "auth.validation.emailRequired" });
    expect(validateEmailOnly("bad")).toEqual({ email: "auth.validation.emailInvalid" });
    expect(validateEmailOnly("ok@company.com")).toEqual({});
  });

  it("validates the new password pair", () => {
    expect(validatePasswordReset({ password: "short", confirmPassword: "short" })).toEqual({
      password: "auth.validation.passwordShort",
    });
    expect(
      validatePasswordReset({ password: "long enough password", confirmPassword: "other" }),
    ).toEqual({ confirmPassword: "auth.validation.passwordMismatch" });
    expect(
      validatePasswordReset({
        password: "long enough password",
        confirmPassword: "long enough password",
      }),
    ).toEqual({});
  });
});
