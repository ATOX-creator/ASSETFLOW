import { describe, expect, it } from "vitest";
import { upsertUserRecord } from "./users";
import type { DatabaseSchema } from "./types";

function emptyDb(): DatabaseSchema {
  return {
    version: 1,
    users: [],
    assets: [],
    logs: [],
    preferences: [],
    scanEvents: [],
  };
}

describe("upsertUserRecord", () => {
  it("creates a regular member profile", () => {
    const db = emptyDb();
    const user = upsertUserRecord(db, {
      id: "sb-user-1",
      name: "Jane Doe",
      email: "Jane@Company.com",
    });

    expect(user).toMatchObject({
      id: "sb-user-1",
      name: "Jane Doe",
      email: "jane@company.com",
      department: null,
      role: "member",
    });
    expect(db.users).toHaveLength(1);
  });

  it("is idempotent and cannot escalate an existing profile", () => {
    const db = emptyDb();
    upsertUserRecord(db, { id: "sb-user-1", name: "Jane", email: "jane@company.com" });
    const again = upsertUserRecord(db, {
      id: "sb-user-1",
      name: "Changed",
      email: "changed@company.com",
    });

    expect(db.users).toHaveLength(1);
    expect(again.name).toBe("Jane");
    expect(again.email).toBe("jane@company.com");
    expect(again.role).toBe("member");
  });

  it("never carries a role from the caller", () => {
    const db = emptyDb();
    const user = upsertUserRecord(db, {
      id: "sb-user-2",
      name: "Mallory",
      email: "mallory@company.com",
      // A hostile caller cannot inject privileges: the field is not part of
      // the input type and is ignored at runtime.
      ...({ role: "admin" } as Record<string, unknown>),
    } as Parameters<typeof upsertUserRecord>[1]);

    expect(user.role).toBe("member");
  });

  it("rejects an empty identity", () => {
    expect(() =>
      upsertUserRecord(emptyDb(), { id: "  ", name: "x", email: "x@y.co" }),
    ).toThrow("PROFILE_ID_REQUIRED");
  });
});
