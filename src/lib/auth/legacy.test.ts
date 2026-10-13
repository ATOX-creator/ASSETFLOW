import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guards for the mock-authentication removal.
 *
 * These tests fail if any of the following creeps back into the source tree:
 *  - the passwordless "sign in as any user id" endpoint,
 *  - the public user directory that fed the demo account picker,
 *  - the HMAC session signer with its hardcoded fallback secret.
 */

const SRC = path.resolve(process.cwd(), "src");

function sourceFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

const FORBIDDEN_SNIPPETS = [
  "assetflow-local-dev-secret", // hardcoded session-signing fallback
  "AUTH_SECRET", // obsolete mock-session signing secret
  "signSession", // legacy HMAC session signer
  "verifySessionToken", // legacy HMAC session verifier
  "no password required", // demo-login notice
];

describe("mock authentication removal", () => {
  it("removed the passwordless login endpoint", () => {
    expect(fs.existsSync(path.join(SRC, "app/api/auth/login"))).toBe(false);
  });

  it("removed the public user-directory endpoint", () => {
    expect(fs.existsSync(path.join(SRC, "app/api/auth/users"))).toBe(false);
  });

  it("removed the custom HMAC session signer", () => {
    expect(fs.existsSync(path.join(SRC, "lib/auth/token.ts"))).toBe(false);
  });

  it("keeps the mock-session cookie only as a value that gets cleared", () => {
    const middleware = fs.readFileSync(path.join(SRC, "middleware.ts"), "utf8");
    expect(middleware).toContain("LEGACY_SESSION_COOKIE");
    // It must never be *verified* to grant access.
    expect(middleware).not.toMatch(/verifySessionToken|signSession/);
  });

  it("contains no mock-auth code or hardcoded signing secrets", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const content = fs.readFileSync(file, "utf8");
      for (const snippet of FORBIDDEN_SNIPPETS) {
        if (content.includes(snippet)) {
          offenders.push(`${path.relative(process.cwd(), file)}: ${snippet}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never exposes the service-role key to browser code", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const content = fs.readFileSync(file, "utf8");
      if (content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not authenticate against seeded demo user ids", () => {
    const session = fs.readFileSync(path.join(SRC, "lib/auth/session.ts"), "utf8");
    expect(session).not.toContain("usr_john_smith");
    expect(session).not.toContain("SEED_USERS");
  });
});
