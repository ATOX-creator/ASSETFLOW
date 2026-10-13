import type {
  AssetCategory,
  AssetStatus,
  Language,
  PreferenceTheme,
} from "@/lib/constants";
import type { CaptureMethod, IdentifierType } from "@/lib/scan/identifiers";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  department: string | null;
  role: "admin" | "member";
  createdAt: string;
}

export interface AssetRecord {
  id: string;
  tag: string;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  location: string | null;
  createdAt: string;
  updatedAt: string;
  lastScannedAt: string | null;
}

export interface AssetLogRecord {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  category: AssetCategory;
  previousStatus: AssetStatus | null;
  status: AssetStatus;
  scannedById: string;
  scannedByName: string;
  scannedByEmail: string;
  scannedAt: string;
  format: string | null;
}

export interface ScanEventRecord {
  id: string;
  identifier: string;
  identifierRaw: string;
  identifierType: IdentifierType;
  captureMethod: CaptureMethod;
  outcome: "matched" | "unmatched";
  assetId: string | null;
  assetTag: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  scannedAt: string;
}

export interface PreferencesRecord {
  userId: string;
  language: Language;
  theme: PreferenceTheme;
  updatedAt: string;
}

export interface DatabaseSchema {
  version: number;
  users: UserRecord[];
  assets: AssetRecord[];
  logs: AssetLogRecord[];
  preferences: PreferencesRecord[];
  scanEvents: ScanEventRecord[];
}

export interface LogFilter {
  search?: string;
  assetId?: string;
  category?: string;
  status?: string;
  userId?: string;
  from?: string;
  to?: string;
}

export interface AssetFilter {
  search?: string;
  category?: string;
  status?: string;
}

export interface CreateLogInput {
  asset: AssetRecord;
  previousStatus: AssetStatus | null;
  status: AssetStatus;
  scannedBy: UserRecord;
  scannedAt?: string;
  format?: string | null;
}

export interface Repository {
  listUsers(): Promise<UserRecord[]>;
  getUser(id: string): Promise<UserRecord | null>;
  /**
   * Creates the application profile for a verified Supabase Auth identity.
   * Idempotent: an existing profile is returned untouched and can never be
   * re-created with a different role.
   */
  createUser(input: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
  }): Promise<UserRecord>;
  updateDepartment(id: string, department: string | null): Promise<UserRecord | null>;

  listAssets(filter?: AssetFilter): Promise<AssetRecord[]>;
  getAsset(id: string): Promise<AssetRecord | null>;
  getAssetByTag(tag: string): Promise<AssetRecord | null>;
  createAsset(input: {
    tag: string;
    name: string;
    category: AssetCategory;
    status: AssetStatus;
    location?: string | null;
  }): Promise<AssetRecord>;
  updateAsset(
    id: string,
    patch: Partial<Pick<AssetRecord, "status" | "name" | "category" | "location" | "lastScannedAt">>,
  ): Promise<AssetRecord | null>;

  listLogs(filter?: LogFilter): Promise<AssetLogRecord[]>;
  listRecentLogs(limit: number): Promise<AssetLogRecord[]>;
  createLog(input: CreateLogInput): Promise<AssetLogRecord>;

  createScanEvent(input: {
    identifier: string;
    identifierRaw: string;
    identifierType: IdentifierType;
    captureMethod: CaptureMethod;
    outcome: "matched" | "unmatched";
    asset: AssetRecord | null;
    scannedBy: UserRecord;
    scannedAt?: string;
  }): Promise<ScanEventRecord>;
  listScanEvents(filter?: {
    identifier?: string;
    userId?: string;
    limit?: number;
  }): Promise<ScanEventRecord[]>;

  getPreferences(userId: string): Promise<PreferencesRecord | null>;
  savePreferences(
    userId: string,
    patch: Partial<Pick<PreferencesRecord, "language" | "theme">>,
  ): Promise<PreferencesRecord>;
}
