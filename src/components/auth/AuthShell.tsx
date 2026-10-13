"use client";

import Image from "next/image";
import { Languages } from "lucide-react";
import { useApp } from "@/lib/i18n";
import { LANGUAGES, type Language } from "@/lib/constants";

interface AuthShellProps {
  title: string;
  hint?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Shared visual frame for the authentication screens: branded header with the
 * language switcher, centred card column, and an optional footer area.
 *
 * It only wraps the screens — the sign-in, sign-up, and recovery forms stay
 * separate, self-contained components.
 */
export default function AuthShell({ title, hint, children, footer }: AuthShellProps) {
  const { t, setLanguage, language } = useApp();

  return (
    <div className="flex min-h-screen flex-col bg-app text-ink">
      <header className="border-b border-line/40 bg-panel">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-accent/40 bg-accent-soft">
              <Image
                src="/main-logo.png"
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </span>
            <div>
              <p className="eyebrow">{t("app.product")}</p>
              <p className="text-sm font-semibold">{t("app.name")}</p>
            </div>
          </div>
          <label className="relative flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted" aria-hidden="true" />
            <span className="sr-only">{t("settings.language")}</span>
            <select
              value={language}
              onChange={(event) => void setLanguage(event.target.value as Language)}
              className="field w-auto cursor-pointer pr-8 font-mono text-xs"
            >
              {LANGUAGES.map((option) => (
                <option key={option} value={option}>
                  {t(`settings.languageName.${option}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {hint ? (
              <p className="mt-1 text-sm text-muted">{hint}</p>
            ) : null}
          </div>
          {children}
          {footer}
        </div>
      </main>
    </div>
  );
}
