import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTH_DESTINATION,
  isAuthPublicPath,
  isSignedInHiddenPath,
  isStaticAssetPath,
  safeNextPath,
} from "./redirect";

describe("safeNextPath", () => {
  it("accepts same-origin paths, including query strings", () => {
    expect(safeNextPath("/assets")).toBe("/assets");
    expect(safeNextPath("/log?status=deployed")).toBe("/log?status=deployed");
    expect(safeNextPath("/dashboard#anchor")).toBe("/dashboard#anchor");
  });

  it("falls back to the dashboard for missing values", () => {
    expect(safeNextPath(null)).toBe(DEFAULT_AUTH_DESTINATION);
    expect(safeNextPath(undefined)).toBe(DEFAULT_AUTH_DESTINATION);
    expect(safeNextPath("")).toBe(DEFAULT_AUTH_DESTINATION);
    expect(safeNextPath("   ")).toBe(DEFAULT_AUTH_DESTINATION);
  });

  it("blocks protocol-relative and backslash open redirects", () => {
    expect(safeNextPath("//evil.com")).toBe(DEFAULT_AUTH_DESTINATION);
    expect(safeNextPath("/\\evil.com")).toBe(DEFAULT_AUTH_DESTINATION);
    expect(safeNextPath("/\\/evil.com")).toBe(DEFAULT_AUTH_DESTINATION);
    expect(safeNextPath("////evil.com")).toBe(DEFAULT_AUTH_DESTINATION);
  });

  it("blocks percent-encoded open redirects", () => {
    expect(safeNextPath("/%2f%2fevil.com")).toBe(DEFAULT_AUTH_DESTINATION);
    expect(safeNextPath("/%5c%5cevil.com")).toBe(DEFAULT_AUTH_DESTINATION);
    expect(safeNextPath("/%252f%252fevil.com")).toBe(DEFAULT_AUTH_DESTINATION);
  });

  it("blocks absolute URLs and javascript schemes", () => {
    expect(safeNextPath("https://evil.com")).toBe(DEFAULT_AUTH_DESTINATION);
    expect(safeNextPath("http://evil.com/path")).toBe(DEFAULT_AUTH_DESTINATION);
    expect(safeNextPath("javascript:alert(1)")).toBe(DEFAULT_AUTH_DESTINATION);
    expect(safeNextPath("//evil.com\\@dashboard")).toBe(DEFAULT_AUTH_DESTINATION);
  });

  it("blocks header-injection control characters", () => {
    expect(safeNextPath("/dashboard\r\nSet-Cookie: x=1")).toBe(
      DEFAULT_AUTH_DESTINATION,
    );
    expect(safeNextPath("/dash\u0000board")).toBe(DEFAULT_AUTH_DESTINATION);
  });

  it("uses a custom fallback when provided", () => {
    expect(safeNextPath("//evil.com", "/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/reset-password", "/reset-password")).toBe("/reset-password");
  });

  it("rejects absurdly long values", () => {
    expect(safeNextPath(`/${"a".repeat(3000)}`)).toBe(DEFAULT_AUTH_DESTINATION);
  });
});

describe("path classifiers", () => {
  it("recognises the public auth screens and callbacks", () => {
    expect(isAuthPublicPath("/login")).toBe(true);
    expect(isAuthPublicPath("/signup")).toBe(true);
    expect(isAuthPublicPath("/forgot-password")).toBe(true);
    expect(isAuthPublicPath("/reset-password")).toBe(true);
    expect(isAuthPublicPath("/auth/callback")).toBe(true);
    expect(isAuthPublicPath("/auth/confirm")).toBe(true);
    expect(isAuthPublicPath("/dashboard")).toBe(false);
    expect(isAuthPublicPath("/api/assets")).toBe(false);
  });

  it("recognises screens hidden from signed-in visitors", () => {
    expect(isSignedInHiddenPath("/login")).toBe(true);
    expect(isSignedInHiddenPath("/signup")).toBe(true);
    expect(isSignedInHiddenPath("/forgot-password")).toBe(false);
    expect(isSignedInHiddenPath("/reset-password")).toBe(false);
  });

  it("recognises static assets", () => {
    expect(isStaticAssetPath("/_next/static/chunk.js")).toBe(true);
    expect(isStaticAssetPath("/favicon.ico")).toBe(true);
    expect(isStaticAssetPath("/main-logo.png")).toBe(true);
    expect(isStaticAssetPath("/splash.mp4")).toBe(true);
    expect(isStaticAssetPath("/dashboard")).toBe(false);
  });
  it("recognises the web manifest as a static asset", () => {
    expect(isStaticAssetPath("/manifest.webmanifest")).toBe(true);
  });

  it("recognises the icon manifest as a static asset (existing behavior)", () => {
    expect(isStaticAssetPath("/icons/manifest.json")).toBe(false);
  });
});
