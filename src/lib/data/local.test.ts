import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createEmptyDatabase, loadDatabase } from "./local";
import type { DatabaseSchema } from "./types";

const tempDirectories: string[] = [];

function temporaryDatabase(): { directory: string; file: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "assetflow-empty-store-"));
  tempDirectories.push(directory);
  return { directory, file: path.join(directory, "db.json") };
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("local database initialization", () => {
  it("creates a valid empty schema when storage is missing", () => {
    const store = temporaryDatabase();
    const database = loadDatabase(store.file);

    expect(database).toEqual(createEmptyDatabase());
    expect(fs.existsSync(store.file)).toBe(true);
    expect(JSON.parse(fs.readFileSync(store.file, "utf8"))).toEqual(createEmptyDatabase());
  });

  it("does not create demo users, assets, logs or preferences", () => {
    const store = temporaryDatabase();
    const database = loadDatabase(store.file);

    expect(database.users).toEqual([]);
    expect(database.assets).toEqual([]);
    expect(database.logs).toEqual([]);
    expect(database.preferences).toEqual([]);
    expect(database.scanEvents).toEqual([]);
  });

  it("preserves corrupt storage and reports an initialization failure", () => {
    const store = temporaryDatabase();
    fs.writeFileSync(store.file, "{not valid json", "utf8");

    expect(() => loadDatabase(store.file)).toThrow("DATABASE_CORRUPT_PRESERVED");
    expect(fs.readFileSync(store.file, "utf8")).toBe("{not valid json");
  });

  it("preserves an existing valid store without rewriting it", () => {
    const store = temporaryDatabase();
    const existing: DatabaseSchema = {
      version: 1,
      users: [{
        id: "sb-real-user",
        name: "Real User",
        email: "real@example.com",
        department: null,
        role: "member",
        createdAt: "2026-11-04T08:00:00.000Z",
      }],
      assets: [{
        id: "ast-real-asset",
        tag: "REAL-0001",
        name: "Real Asset",
        category: "laptop",
        status: "available",
        location: null,
        createdAt: "2026-11-04T08:00:00.000Z",
        updatedAt: "2026-11-04T08:00:00.000Z",
        lastScannedAt: null,
      }],
      logs: [],
      preferences: [{
        userId: "sb-real-user",
        language: "en",
        theme: "system",
        updatedAt: "2026-11-04T08:00:00.000Z",
      }],
      scanEvents: [],
    };
    const original = `${JSON.stringify(existing, null, 2)}\n`;
    fs.writeFileSync(store.file, original, "utf8");

    expect(loadDatabase(store.file)).toEqual(existing);
    expect(fs.readFileSync(store.file, "utf8")).toBe(original);
  });

  it("rejects a structurally invalid store without overwriting it", () => {
    const store = temporaryDatabase();
    const invalid = JSON.stringify({ version: 1, users: [], assets: "not-an-array" });
    fs.writeFileSync(store.file, invalid, "utf8");

    expect(() => loadDatabase(store.file)).toThrow("DATABASE_CORRUPT_PRESERVED");
    expect(fs.readFileSync(store.file, "utf8")).toBe(invalid);
  });
});
