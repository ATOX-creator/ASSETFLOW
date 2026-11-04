import fs from "node:fs";
import path from "node:path";
import { upsertUserRecord } from "./users";
import type {
  AssetFilter,
  AssetLogRecord,
  AssetRecord,
  CreateLogInput,
  DatabaseSchema,
  LogFilter,
  PreferencesRecord,
  Repository,
  ScanEventRecord,
  UserRecord,
} from "./types";
import type { CaptureMethod, IdentifierType } from "@/lib/scan/identifiers";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

declare global {
  var __assetflowDatabase: DatabaseSchema | undefined;
}

export function createEmptyDatabase(): DatabaseSchema {
  return {
    version: 1,
    users: [],
    assets: [],
    logs: [],
    preferences: [],
    scanEvents: [],
  };
}

function isDatabaseSchema(value: unknown): value is DatabaseSchema {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const database = value as Partial<DatabaseSchema>;
  return (
    typeof database.version === "number" &&
    Array.isArray(database.users) &&
    Array.isArray(database.assets) &&
    Array.isArray(database.logs) &&
    Array.isArray(database.preferences) &&
    (database.scanEvents === undefined || Array.isArray(database.scanEvents))
  );
}

export function persist(database: DatabaseSchema, databaseFile = DB_FILE): void {
  globalThis.__assetflowDatabase = database;
  try {
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
    fs.writeFileSync(databaseFile, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  } catch {
    // A read-only filesystem only degrades persistence for this process.
  }
}

export function loadDatabase(databaseFile = DB_FILE): DatabaseSchema {
  if (databaseFile === DB_FILE) {
    const cached = globalThis.__assetflowDatabase;
    if (cached) {
      return cached;
    }
  }

  let raw: string;
  try {
    raw = fs.readFileSync(databaseFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error("DATABASE_READ_FAILED");
    }
    const empty = createEmptyDatabase();
    persist(empty, databaseFile);
    return empty;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("DATABASE_CORRUPT_PRESERVED");
  }

  if (!isDatabaseSchema(parsed)) {
    throw new Error("DATABASE_CORRUPT_PRESERVED");
  }

  const database: DatabaseSchema = {
    ...parsed,
    scanEvents: Array.isArray(parsed.scanEvents) ? parsed.scanEvents : [],
  };
  if (databaseFile === DB_FILE) {
    globalThis.__assetflowDatabase = database;
  }
  return database;
}

function newId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

function normalise(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function startOfDay(value: string): number {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? Number.NEGATIVE_INFINITY : date.getTime();
}

function endOfDay(value: string): number {
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

class LocalRepository implements Repository {
  private database(): DatabaseSchema {
    return loadDatabase();
  }

  async listUsers(): Promise<UserRecord[]> {
    return [...this.database().users];
  }

  async getUser(id: string): Promise<UserRecord | null> {
    return this.database().users.find((user) => user.id === id) ?? null;
  }

  async createUser(input: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
  }): Promise<UserRecord> {
    const db = this.database();
    const user = upsertUserRecord(db, input);
    persist(db);
    return user;
  }

  async updateDepartment(id: string, department: string | null): Promise<UserRecord | null> {
    const db = this.database();
    const user = db.users.find((entry) => entry.id === id);
    if (!user) {
      return null;
    }
    user.department = department;
    persist(db);
    return { ...user };
  }

  async listAssets(filter?: AssetFilter): Promise<AssetRecord[]> {
    const search = normalise(filter?.search);
    const category = normalise(filter?.category);
    const status = normalise(filter?.status);
    return this.database()
      .assets.filter((asset) => {
        if (category && normalise(asset.category) !== category) {
          return false;
        }
        if (status && normalise(asset.status) !== status) {
          return false;
        }
        if (search) {
          const haystack = `${asset.tag} ${asset.name} ${asset.category} ${asset.status}`.toLowerCase();
          if (!haystack.includes(search)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }

  async getAsset(id: string): Promise<AssetRecord | null> {
    return this.database().assets.find((asset) => asset.id === id) ?? null;
  }

  async getAssetByTag(tag: string): Promise<AssetRecord | null> {
    const needle = normalise(tag);
    if (!needle) {
      return null;
    }
    return this.database().assets.find((asset) => normalise(asset.tag) === needle) ?? null;
  }

  async createAsset(input: {
    tag: string;
    name: string;
    category: AssetRecord["category"];
    status: AssetRecord["status"];
    location?: string | null;
  }): Promise<AssetRecord> {
    const db = this.database();
    const now = new Date().toISOString();
    const asset: AssetRecord = {
      id: newId("ast"),
      tag: input.tag,
      name: input.name,
      category: input.category,
      status: input.status,
      location: input.location ?? null,
      createdAt: now,
      updatedAt: now,
      lastScannedAt: null,
    };
    db.assets.push(asset);
    persist(db);
    return { ...asset };
  }

  async updateAsset(
    id: string,
    patch: Partial<
      Pick<AssetRecord, "status" | "name" | "category" | "location" | "lastScannedAt">
    >,
  ): Promise<AssetRecord | null> {
    const db = this.database();
    const asset = db.assets.find((entry) => entry.id === id);
    if (!asset) {
      return null;
    }
    Object.assign(asset, patch, { updatedAt: new Date().toISOString() });
    persist(db);
    return { ...asset };
  }

  async listLogs(filter?: LogFilter): Promise<AssetLogRecord[]> {
    const search = normalise(filter?.search);
    const category = normalise(filter?.category);
    const status = normalise(filter?.status);
    const assetId = filter?.assetId ?? "";
    const userId = filter?.userId ?? "";
    const from = filter?.from ? startOfDay(filter.from) : Number.NEGATIVE_INFINITY;
    const to = filter?.to ? endOfDay(filter.to) : Number.POSITIVE_INFINITY;

    return this.database()
      .logs.filter((log) => {
        if (assetId && log.assetId !== assetId) {
          return false;
        }
        if (category && normalise(log.category) !== category) {
          return false;
        }
        if (status && normalise(log.status) !== status) {
          return false;
        }
        if (userId && log.scannedById !== userId) {
          return false;
        }
        const at = new Date(log.scannedAt).getTime();
        if (Number.isNaN(at) || at < from || at > to) {
          return false;
        }
        if (search) {
          const haystack =
            `${log.assetTag} ${log.assetName} ${log.scannedByName} ${log.scannedByEmail} ${log.status} ${log.category}`.toLowerCase();
          if (!haystack.includes(search)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
  }

  async listRecentLogs(limit: number): Promise<AssetLogRecord[]> {
    const logs = [...this.database().logs].sort((a, b) =>
      b.scannedAt.localeCompare(a.scannedAt),
    );
    return logs.slice(0, Math.max(0, limit));
  }

  async createLog(input: CreateLogInput): Promise<AssetLogRecord> {
    const db = this.database();
    const log: AssetLogRecord = {
      id: newId("log"),
      assetId: input.asset.id,
      assetTag: input.asset.tag,
      assetName: input.asset.name,
      category: input.asset.category,
      previousStatus: input.previousStatus,
      status: input.status,
      scannedById: input.scannedBy.id,
      scannedByName: input.scannedBy.name,
      scannedByEmail: input.scannedBy.email,
      scannedAt: input.scannedAt ?? new Date().toISOString(),
      format: input.format ?? null,
    };
    db.logs.push(log);
    persist(db);
    return { ...log };
  }

  async createScanEvent(input: {
    identifier: string;
    identifierRaw: string;
    identifierType: IdentifierType;
    captureMethod: CaptureMethod;
    outcome: "matched" | "unmatched";
    asset: AssetRecord | null;
    scannedBy: UserRecord;
    scannedAt?: string;
  }): Promise<ScanEventRecord> {
    const db = this.database();
    const event: ScanEventRecord = {
      id: newId("sev"),
      identifier: input.identifier,
      identifierRaw: input.identifierRaw,
      identifierType: input.identifierType,
      captureMethod: input.captureMethod,
      outcome: input.outcome,
      assetId: input.asset?.id ?? null,
      assetTag: input.asset?.tag ?? null,
      userId: input.scannedBy.id,
      userName: input.scannedBy.name,
      userEmail: input.scannedBy.email,
      scannedAt: input.scannedAt ?? new Date().toISOString(),
    };
    db.scanEvents.push(event);
    persist(db);
    return { ...event };
  }

  async listScanEvents(filter?: {
    identifier?: string;
    userId?: string;
    limit?: number;
  }): Promise<ScanEventRecord[]> {
    const identifier = normalise(filter?.identifier);
    const userId = filter?.userId ?? "";
    const events = this.database()
      .scanEvents.filter((event) => {
        if (userId && event.userId !== userId) {
          return false;
        }
        if (identifier && normalise(event.identifier) !== identifier) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
    const limit = filter?.limit ?? events.length;
    return events.slice(0, Math.max(0, limit));
  }

  async getPreferences(userId: string): Promise<PreferencesRecord | null> {
    return (
      this.database().preferences.find((entry) => entry.userId === userId) ?? null
    );
  }

  async savePreferences(
    userId: string,
    patch: Partial<Pick<PreferencesRecord, "language" | "theme">>,
  ): Promise<PreferencesRecord> {
    const db = this.database();
    const existing = db.preferences.find((entry) => entry.userId === userId);
    const now = new Date().toISOString();
    if (existing) {
      if (patch.language !== undefined) {
        existing.language = patch.language;
      }
      if (patch.theme !== undefined) {
        existing.theme = patch.theme;
      }
      existing.updatedAt = now;
      persist(db);
      return { ...existing };
    }
    const created: PreferencesRecord = {
      userId,
      language: patch.language ?? "en",
      theme: patch.theme ?? "system",
      updatedAt: now,
    };
    db.preferences.push(created);
    persist(db);
    return { ...created };
  }
}

export const localRepository: Repository = new LocalRepository();
