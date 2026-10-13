"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CircleCheck,
  Languages,
  LoaderCircle,
  Monitor,
  Moon,
  Save,
  Sun,
  UserRound,
} from "lucide-react";
import { useApp } from "@/lib/i18n";
import {
  DEPARTMENTS,
  LANGUAGES,
  PREFERENCES_THEMES,
  type Language,
  type PreferenceTheme,
} from "@/lib/constants";

const THEME_ICONS: Record<PreferenceTheme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export default function SettingsPage() {
  const {
    t,
    tDepartment,
    user,
    language,
    theme,
    setLanguage,
    setTheme,
    setDepartment,
    saveError,
  } = useApp();

  const [departmentChoice, setDepartmentChoice] = useState<string>("it");
  const [customDepartment, setCustomDepartment] = useState("");
  const [departmentSaving, setDepartmentSaving] = useState(false);
  const [departmentSaved, setDepartmentSaved] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);

  const currentDepartment = user?.department ?? "";
  const isPredefined = useMemo(
    () => (DEPARTMENTS as ReadonlyArray<string>).includes(currentDepartment),
    [currentDepartment],
  );

  useEffect(() => {
    if (!currentDepartment) {
      setDepartmentChoice("it");
      setCustomDepartment("");
      return;
    }
    if (isPredefined) {
      setDepartmentChoice(currentDepartment);
      setCustomDepartment("");
    } else {
      setDepartmentChoice("other");
      setCustomDepartment(currentDepartment);
    }
  }, [currentDepartment, isPredefined]);

  const saveDepartment = async () => {
    if (departmentSaving) {
      return;
    }
    const value =
      departmentChoice === "other" ? customDepartment.trim() : departmentChoice;
    if (!value) {
      setDepartmentError(t("errors.emptyField"));
      return;
    }
    if (value.length > 60) {
      setDepartmentError(t("errors.validation"));
      return;
    }
    setDepartmentSaving(true);
    setDepartmentError(null);
    setDepartmentSaved(false);
    await setDepartment(value);
    setDepartmentSaving(false);
    setDepartmentSaved(true);
  };

  const showCustomField = departmentChoice === "other";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <p className="eyebrow">{t("settings.title")}</p>
        <p className="mt-1 text-sm text-muted">{t("settings.subtitle")}</p>
      </div>

      <section className="panel overflow-hidden">
        <header className="flex items-center gap-3 border-b border-line/40 bg-header px-5 py-4">
          <Languages className="h-4 w-4 text-accent" aria-hidden="true" />
          <div>
            <p className="eyebrow">{t("settings.language")}</p>
            <h2 className="text-sm font-semibold text-ink">{t("settings.languageHint")}</h2>
          </div>
        </header>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {LANGUAGES.map((option) => {
            const active = language === option;
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  active
                    ? "border-accent/60 bg-accent-soft"
                    : "border-line/50 bg-inset hover:border-accent/40"
                }`}
              >
                <input
                  type="radio"
                  name="language"
                  value={option}
                  checked={active}
                  onChange={() => void setLanguage(option as Language)}
                  className="sr-only"
                />
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-[11px] font-semibold ${
                    active
                      ? "border-accent/50 text-accent"
                      : "border-line/50 text-muted"
                  }`}
                >
                  {option.toUpperCase()}
                </span>
                <span className="text-sm font-medium text-ink">
                  {t(`settings.languageName.${option}`)}
                </span>
                {active && (
                  <CircleCheck className="ml-auto h-4 w-4 text-accent" aria-hidden="true" />
                )}
              </label>
            );
          })}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <header className="flex items-center gap-3 border-b border-line/40 bg-header px-5 py-4">
          <Monitor className="h-4 w-4 text-accent" aria-hidden="true" />
          <div>
            <p className="eyebrow">{t("settings.appearance")}</p>
            <h2 className="text-sm font-semibold text-ink">{t("settings.appearanceHint")}</h2>
          </div>
        </header>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {PREFERENCES_THEMES.map((option) => {
            const active = theme === option;
            const Icon = THEME_ICONS[option];
            return (
              <label
                key={option}
                className={`flex cursor-pointer flex-col gap-2 rounded-xl border px-4 py-4 transition-colors ${
                  active
                    ? "border-accent/60 bg-accent-soft"
                    : "border-line/50 bg-inset hover:border-accent/40"
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={option}
                  checked={active}
                  onChange={() => void setTheme(option as PreferenceTheme)}
                  className="sr-only"
                />
                <Icon
                  className={`h-4 w-4 ${active ? "text-accent" : "text-muted"}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-ink">
                  {t(`settings.theme.${option}`)}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <header className="flex items-center gap-3 border-b border-line/40 bg-header px-5 py-4">
          <Building2 className="h-4 w-4 text-accent" aria-hidden="true" />
          <div>
            <p className="eyebrow">{t("settings.departmentTitle")}</p>
            <h2 className="text-sm font-semibold text-ink">{t("settings.departmentHint")}</h2>
          </div>
        </header>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="department" className="eyebrow">
              {t("common.department")}
            </label>
            <select
              id="department"
              value={departmentChoice}
              onChange={(event) => {
                setDepartmentChoice(event.target.value);
                setDepartmentSaved(false);
                setDepartmentError(null);
              }}
              className="field cursor-pointer"
            >
              {DEPARTMENTS.map((option) => (
                <option key={option} value={option}>
                  {t(`department.${option}`)}
                </option>
              ))}
            </select>
          </div>

          {showCustomField && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="department-custom" className="eyebrow">
                {t("settings.departmentPlaceholder")}
              </label>
              <input
                id="department-custom"
                type="text"
                value={customDepartment}
                maxLength={60}
                onChange={(event) => {
                  setCustomDepartment(event.target.value);
                  setDepartmentSaved(false);
                  setDepartmentError(null);
                }}
                placeholder={t("settings.departmentPlaceholder")}
                className="field"
              />
            </div>
          )}

          {departmentError && (
            <p role="alert" className="text-xs text-danger">
              {departmentError}
            </p>
          )}
          {saveError && !departmentError && (
            <p role="alert" className="text-xs text-danger">
              {t(saveError)}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveDepartment()}
              disabled={departmentSaving}
              className="btn-primary"
            >
              {departmentSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {departmentSaving ? t("common.saving") : t("common.save")}
            </button>
            {departmentSaved && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t("settings.prefSaved")}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <header className="flex items-center gap-3 border-b border-line/40 bg-header px-5 py-4">
          <UserRound className="h-4 w-4 text-accent" aria-hidden="true" />
          <div>
            <p className="eyebrow">{t("settings.userInfo")}</p>
            <h2 className="text-sm font-semibold text-ink">{t("settings.userInfoHint")}</h2>
          </div>
        </header>
        <dl className="grid gap-px bg-line/30 sm:grid-cols-2">
          <div className="bg-panel p-5">
            <dt className="eyebrow">{t("common.name")}</dt>
            <dd className="mt-1.5 text-sm font-medium text-ink">
              {user?.name || t("common.unknown")}
            </dd>
          </div>
          <div className="bg-panel p-5">
            <dt className="eyebrow">{t("common.email")}</dt>
            <dd className="mt-1.5 break-all text-sm font-medium text-ink">
              {user?.email || t("common.unknown")}
            </dd>
          </div>
          <div className="bg-panel p-5">
            <dt className="eyebrow">{t("settings.userId")}</dt>
            <dd className="mt-1.5 font-mono text-sm break-all text-accent">
              {user?.id || t("common.unknown")}
            </dd>
          </div>
          <div className="bg-panel p-5">
            <dt className="eyebrow">{t("common.department")}</dt>
            <dd className="mt-1.5 text-sm font-medium text-ink">
              {user?.department ? tDepartment(user.department) : t("settings.notSet")}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
