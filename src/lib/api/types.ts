import type {
  AssetCategory,
  AssetStatus,
  Language,
  PreferenceTheme,
} from "@/lib/constants";
import type { AssetLogRecord, AssetRecord } from "@/lib/data";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  department: string | null;
}

export interface PublicPreferences {
  language: Language;
  theme: PreferenceTheme;
}

export interface MeResponse {
  user: PublicUser | null;
  preferences: PublicPreferences | null;
}

export interface PreferencesResponse {
  user: PublicUser;
  preferences: PublicPreferences;
}

export interface AssetsResponse {
  items: AssetRecord[];
}

export interface AssetResponse {
  asset: AssetRecord;
}

export interface LogsResponse {
  items: AssetLogRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StatusCount {
  status: AssetStatus;
  count: number;
}

export interface CategoryCount {
  category: AssetCategory;
  count: number;
}

export interface CategoryStatusCount {
  status: AssetStatus;
  count: number;
}

export interface CategoryAnalyticsRow {
  category: AssetCategory;
  total: number;
  byStatus: CategoryStatusCount[];
}

export interface DashboardResponse {
  total: number;
  byStatus: StatusCount[];
  byCategory: CategoryCount[];
  byCategoryStatus: CategoryAnalyticsRow[];
  recent: AssetLogRecord[];
  generatedAt: string;
}

export interface ScanResponse {
  asset: AssetRecord;
  log: AssetLogRecord;
}

export interface LogOptionsResponse {
  assets: { id: string; tag: string; name: string }[];
  users: { id: string; name: string }[];
  categories: string[];
  statuses: string[];
}
