"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  showLabel: string;
  hideLabel: string;
  error?: string | null;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}

/**
 * Password input with an accessible show/hide toggle.
 * The toggle is a real button with `aria-pressed`, and validation messages are
 * announced through `role="alert"` and linked via `aria-describedby`.
 */
export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  showLabel,
  hideLabel,
  error,
  disabled,
  placeholder,
  required = true,
}: PasswordFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          className="field field-with-trailing"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={visible ? hideLabel : showLabel}
          disabled={disabled}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
