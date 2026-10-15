import { afterEach, describe, expect, it } from "vitest";
import { SupabaseConfigError, getSupabasePublicConfig } from "./env";

const NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

const original: Record<string, string | undefined> = {};

function clearPublicConfig(): void {
  for (const name of NAMES) {
    original[name] = process.env[name];
    delete process.env[name];
  }
}

afterEach(() => {
  for (const name of NAMES) {
    if (original[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original[name];
    }
  }
});

describe("getSupabasePublicConfig", () => {
  it("returns the public url and key when both are set", () => {
    clearPublicConfig();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";

    expect(getSupabasePublicConfig()).toEqual({
      url: "https://example.supabase.co",
      key: "public-anon-key",
    });
  });

  it("accepts the publishable key as a fallback name", () => {
    clearPublicConfig();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";

    expect(getSupabasePublicConfig().key).toBe("publishable-key");
  });

  it("prefers the anon key when both key names are set", () => {
    clearPublicConfig();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";

    expect(getSupabasePublicConfig().key).toBe("public-anon-key");
  });

  it("trims surrounding whitespace from configured values", () => {
    clearPublicConfig();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "  https://example.supabase.co  ";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "  public-anon-key  ";

    expect(getSupabasePublicConfig()).toEqual({
      url: "https://example.supabase.co",
      key: "public-anon-key",
    });
  });

  it("treats whitespace-only values as missing", () => {
    clearPublicConfig();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "   ";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";

    expect(() => getSupabasePublicConfig()).toThrow(SupabaseConfigError);
    try {
      getSupabasePublicConfig();
    } catch (error) {
      expect((error as Error).message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    }
  });

  it("throws SupabaseConfigError naming the missing variables", () => {
    clearPublicConfig();

    expect(() => getSupabasePublicConfig()).toThrow(SupabaseConfigError);
    try {
      getSupabasePublicConfig();
    } catch (error) {
      expect((error as Error).message).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect((error as Error).message).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
  });

  it("never includes configured values in the error message", () => {
    clearPublicConfig();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    expect(() => getSupabasePublicConfig()).toThrow(SupabaseConfigError);
    try {
      getSupabasePublicConfig();
    } catch (error) {
      expect((error as Error).message).not.toContain("example.supabase.co");
      expect((error as Error).message).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
  });
});
