export const ASSET_STATUSES = [
  "deployed",
  "available",
  "retrieved",
  "in_repair",
  "repaired",
  "defective",
  "damaged",
  "damaged_beyond_repair",
  "glitching",
  "lost",
  "retired",
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export type Tone = "green" | "blue" | "orange" | "red" | "crimson" | "gray";

export const STATUS_TONE: Record<AssetStatus, Tone> = {
  deployed: "green",
  available: "green",
  retrieved: "blue",
  in_repair: "orange",
  repaired: "blue",
  defective: "red",
  damaged: "red",
  damaged_beyond_repair: "crimson",
  glitching: "orange",
  lost: "gray",
  retired: "gray",
};

export const ASSET_CATEGORIES = [
  "aio",
  "laptop",
  "desktop",
  "monitor",
  "mouse",
  "keyboard",
  "headset",
  "ram",
  "ssd",
  "hdd",
  "printer",
  "docking",
  "charger",
  "other",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const DEPARTMENTS = [
  "it",
  "hr",
  "facilities",
  "development",
  "accounting",
  "finance",
  "operations",
  "management",
  "sales",
  "marketing",
  "support",
  "other",
] as const;

export type Department = (typeof DEPARTMENTS)[number] | (string & {});

export const LANGUAGES = ["en", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];

export const PREFERENCES_THEMES = ["light", "dark", "system"] as const;
export type PreferenceTheme = (typeof PREFERENCES_THEMES)[number];

export function isAssetStatus(value: unknown): value is AssetStatus {
  return (
    typeof value === "string" &&
    (ASSET_STATUSES as ReadonlyArray<string>).includes(value)
  );
}

export function isAssetCategory(value: unknown): value is AssetCategory {
  return (
    typeof value === "string" &&
    (ASSET_CATEGORIES as ReadonlyArray<string>).includes(value)
  );
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as ReadonlyArray<string>).includes(value);
}

export function isPreferenceTheme(value: unknown): value is PreferenceTheme {
  return (
    typeof value === "string" &&
    (PREFERENCES_THEMES as ReadonlyArray<string>).includes(value)
  );
}
