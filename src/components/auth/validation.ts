/**
 * Pure client-side validation for the authentication forms.
 * Every function returns i18n keys so components can render translated errors.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 80;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length <= 254 && EMAIL_PATTERN.test(trimmed);
}

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export function validateLogin(input: {
  email: string;
  password: string;
}): FieldErrors<"email" | "password"> {
  const errors: FieldErrors<"email" | "password"> = {};
  if (!input.email.trim()) {
    errors.email = "auth.validation.emailRequired";
  } else if (!isValidEmail(input.email)) {
    errors.email = "auth.validation.emailInvalid";
  }
  if (!input.password) {
    errors.password = "auth.validation.passwordRequired";
  }
  return errors;
}

export function validateSignUp(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): FieldErrors<"name" | "email" | "password" | "confirmPassword"> {
  const errors: FieldErrors<"name" | "email" | "password" | "confirmPassword"> = {};
  const name = input.name.trim();
  if (!name) {
    errors.name = "auth.validation.nameRequired";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = "auth.validation.nameTooLong";
  }
  if (!input.email.trim()) {
    errors.email = "auth.validation.emailRequired";
  } else if (!isValidEmail(input.email)) {
    errors.email = "auth.validation.emailInvalid";
  }
  if (!input.password) {
    errors.password = "auth.validation.passwordRequired";
  } else if (input.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = "auth.validation.passwordShort";
  }
  if (!input.confirmPassword) {
    errors.confirmPassword = "auth.validation.passwordRequired";
  } else if (input.confirmPassword !== input.password) {
    errors.confirmPassword = "auth.validation.passwordMismatch";
  }
  return errors;
}

export function validateEmailOnly(
  email: string,
): FieldErrors<"email"> {
  if (!email.trim()) {
    return { email: "auth.validation.emailRequired" };
  }
  if (!isValidEmail(email)) {
    return { email: "auth.validation.emailInvalid" };
  }
  return {};
}

export function validatePasswordReset(input: {
  password: string;
  confirmPassword: string;
}): FieldErrors<"password" | "confirmPassword"> {
  const errors: FieldErrors<"password" | "confirmPassword"> = {};
  if (!input.password) {
    errors.password = "auth.validation.passwordRequired";
  } else if (input.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = "auth.validation.passwordShort";
  }
  if (!input.confirmPassword) {
    errors.confirmPassword = "auth.validation.passwordRequired";
  } else if (input.confirmPassword !== input.password) {
    errors.confirmPassword = "auth.validation.passwordMismatch";
  }
  return errors;
}
