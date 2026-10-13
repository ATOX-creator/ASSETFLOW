"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import en from "./en";
import fr from "./fr";
import type { Dictionary } from "./en";
import {
  isLanguage,
  isPreferenceTheme,
  type AssetCategory,
  type AssetStatus,
  type Language,
  type PreferenceTheme,
} from "@/lib/constants";

const DICTIONARIES: Record<Language, Dictionary> = { en, fr };

type Leaf = string;
type PathsOf<T> = T extends Leaf
  ? never
  : {
      [K in keyof T & string]: T[K] extends Leaf
        ? K
        : `${K}.${PathsOf<T[K]>}`;
    }[keyof T & string];

export type TranslationKey = PathsOf<Dictionary>;
export type TranslationVars = Record<string, string | number>;

const LANGUAGE_KEY = "af.language";
const THEME_KEY = "af.theme";

function readStoredLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }
  try {
    const raw = window.localStorage.getItem(LANGUAGE_KEY);
    return isLanguage(raw) ? raw : "en";
  } catch {
    return "en";
  }
}

function readStoredTheme(): PreferenceTheme {
  if (typeof window === "undefined") {
    return "system";
  }
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return isPreferenceTheme(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

function storeValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage may be unavailable (private mode) — preferences still live server-side
  }
}

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

function resolveDictionary(locale: Language): Dictionary {
  return DICTIONARIES[locale] ?? en;
}

function lookup(dictionary: Dictionary, path: string): string | undefined {
  const parts = path.split(".");
  let node: unknown = dictionary;
  for (const part of parts) {
    if (typeof node !== "object" || node === null) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

interface AppContextValue {
  ready: boolean;
  user: AppUser | null;
  language: Language;
  theme: PreferenceTheme;
  resolvedTheme: "light" | "dark";
  department: string | null;
  t: (path: TranslationKey | (string & {}), vars?: TranslationVars) => string;
  tStatus: (status: AssetStatus | string | null | undefined) => string;
  tCategory: (category: AssetCategory | string | null | undefined) => string;
  tDepartment: (department: string | null | undefined) => string;
  formatDate: (value: string | number | Date, style?: "date" | "time" | "datetime") => string;
  setLanguage: (language: Language) => Promise<void>;
  setTheme: (theme: PreferenceTheme) => Promise<void>;
  setDepartment: (department: string) => Promise<void>;
  setUser: (user: AppUser | null) => void;
  /** Re-reads the authenticated user and preferences from the server. */
  refreshUser: () => Promise<void>;
  saveError: string | null;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  department: string | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [theme, setThemeState] = useState<PreferenceTheme>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [user, setUserState] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setLanguageState(readStoredLanguage());
    setThemeState(readStoredTheme());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (): void => setSystemDark(query.matches);
    apply();
    query.addEventListener?.("change", apply);
    return () => query.removeEventListener?.("change", apply);
  }, []);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.lang = language;
  }, [language]);

  const loadRemotePreferences = useCallback(async () => {
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (response.status === 401) {
        if (mountedRef.current) {
          setUserState(null);
        }
        return;
      }
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        user: AppUser | null;
        preferences: { language?: string; theme?: string } | null;
      };
      if (!mountedRef.current) {
        return;
      }
      if (payload.user) {
        setUserState(payload.user);
      }
      const prefs = payload.preferences;
      if (prefs && isLanguage(prefs.language)) {
        setLanguageState(prefs.language);
        storeValue(LANGUAGE_KEY, prefs.language);
      }
      if (prefs && isPreferenceTheme(prefs.theme)) {
        setThemeState(prefs.theme);
        storeValue(THEME_KEY, prefs.theme);
      }
    } catch {
      // offline / server unreachable — keep the locally cached preferences
    } finally {
      if (mountedRef.current) {
        setReady(true);
      }
    }
  }, []);

  useEffect(() => {
    void loadRemotePreferences();
  }, [loadRemotePreferences]);

  const persistPreferences = useCallback(
    async (patch: { language?: Language; theme?: PreferenceTheme; department?: string }) => {
      setSaveError(null);
      try {
        const response = await fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!response.ok) {
          throw new Error(`preferences ${response.status}`);
        }
        const payload = (await response.json()) as {
          user: AppUser | null;
          preferences: { language?: string; theme?: string };
        };
        if (payload.preferences && isLanguage(payload.preferences.language)) {
          storeValue(LANGUAGE_KEY, payload.preferences.language);
        }
        if (payload.preferences && isPreferenceTheme(payload.preferences.theme)) {
          storeValue(THEME_KEY, payload.preferences.theme);
        }
        if (payload.user && mountedRef.current) {
          setUserState(payload.user);
        }
      } catch {
        if (mountedRef.current) {
          setSaveError("settings.prefSaveError");
        }
      }
    },
    [],
  );

  const setLanguage = useCallback(
    async (next: Language) => {
      setLanguageState(next);
      storeValue(LANGUAGE_KEY, next);
      await persistPreferences({ language: next });
    },
    [persistPreferences],
  );

  const setTheme = useCallback(
    async (next: PreferenceTheme) => {
      setThemeState(next);
      storeValue(THEME_KEY, next);
      await persistPreferences({ theme: next });
    },
    [persistPreferences],
  );

  const setDepartment = useCallback(
    async (next: string) => {
      await persistPreferences({ department: next });
    },
    [persistPreferences],
  );

  const dictionary = resolveDictionary(language);

  const t = useCallback(
    (path: TranslationKey | (string & {}), vars?: TranslationVars) => {
      const found = lookup(dictionary, path);
      if (found !== undefined) {
        return interpolate(found, vars);
      }
      const fallback = lookup(en, path);
      if (fallback !== undefined) {
        return interpolate(fallback, vars);
      }
      const segment = path.split(".").pop() ?? path;
      return segment
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^\w/, (character) => character.toUpperCase());
    },
    [dictionary],
  );

  const tStatus = useCallback(
    (status: AssetStatus | string | null | undefined) => {
      if (!status) {
        return t("status.unknown");
      }
      return t(`status.${status}`);
    },
    [t],
  );

  const tCategory = useCallback(
    (category: AssetCategory | string | null | undefined) => {
      if (!category) {
        return t("category.unknown");
      }
      return t(`category.${category}`);
    },
    [t],
  );

  const tDepartment = useCallback(
    (department: string | null | undefined) => {
      if (!department) {
        return t("settings.notSet");
      }
      const translated = t(`department.${department}`);
      return translated === `department.${department}` ? department : translated;
    },
    [t],
  );

  const formatDate = useCallback(
    (
      value: string | number | Date,
      style: "date" | "time" | "datetime" = "datetime",
    ) => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) {
        return "—";
      }
      try {
        if (style === "time") {
          return new Intl.DateTimeFormat(language, {
            hour: "2-digit",
            minute: "2-digit",
          }).format(date);
        }
        if (style === "date") {
          return new Intl.DateTimeFormat(language, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(date);
        }
        return new Intl.DateTimeFormat(language, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
      } catch {
        return "—";
      }
    },
    [language],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      user,
      language,
      theme,
      resolvedTheme,
      department: user?.department ?? null,
      t,
      tStatus,
      tCategory,
      tDepartment,
      formatDate,
      setLanguage,
      setTheme,
      setDepartment,
      setUser: setUserState,
      refreshUser: loadRemotePreferences,
      saveError,
    }),
    [
      ready,
      user,
      language,
      theme,
      resolvedTheme,
      t,
      tStatus,
      tCategory,
      tDepartment,
      formatDate,
      setLanguage,
      setTheme,
      setDepartment,
      loadRemotePreferences,
      saveError,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside <AppProvider>");
  }
  return context;
}
