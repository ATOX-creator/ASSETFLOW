import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards the Supabase Auth "Reset password" template that is pasted into the
 * dashboard from `emails/`. The template is plain HTML — no build step runs in
 * production — so these assertions protect the contract directly on the file.
 */

const templatePath = (name: string): string =>
  fileURLToPath(new URL(`../../../emails/${name}`, import.meta.url));

const html = readFileSync(templatePath("recover-password.html"), "utf8");
const subject = readFileSync(templatePath("recover-password.subject.txt"), "utf8").trim();

/** Variables Supabase Auth substitutes in the "Reset password" template. */
const SUPPORTED_VARIABLES = new Set([".ConfirmationURL", ".SiteURL", ".Email"]);

describe("recover-password template", () => {
  it("uses the Supabase recovery URL for the button and the fallback link", () => {
    const occurrences = html.match(/\{\{ \.ConfirmationURL \}\}/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('href="{{ .ConfirmationURL }}"');
  });

  it("only uses supported Supabase variables", () => {
    const used = [...html.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((match) => match[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const variable of used) {
      expect(SUPPORTED_VARIABLES.has(variable)).toBe(true);
    }
  });

  it("has a clear heading, accessible branding, and readable copy", () => {
    expect(html).toContain("<h1");
    expect(html).toContain("Reset your password");
    expect(html).toContain('<html lang="en"');
    expect(html).toMatch(/alt="Assetflow logo"/);
    expect(html).toContain("Reset my password");
    expect(html).toContain("Assetflow");
  });

  it("offers a readable fallback link and the ignore-unknown-recipient notice", () => {
    expect(html).toMatch(/Copy and paste this link/i);
    expect(html).toMatch(/safely ignore this email/i);
    expect(html).toMatch(/didn&rsquo;t request a password reset/i);
  });

  it("keeps the logo on the application origin and free of local paths", () => {
    expect(html).toContain('src="{{ .SiteURL }}/email/logo.png"');
    expect(html).not.toMatch(/file:\/\//);
    expect(html).not.toMatch(/[A-Za-z]:\\/); // C:\ style filesystem paths
    expect(html).not.toMatch(/localhost/i);
    expect(html).not.toMatch(/src="https?:\/\//); // no third-party image host
  });

  it("ships the rasterised logo the email points at", () => {
    expect(existsSync(templatePath("../public/email/logo.png"))).toBe(true);
  });

  it("stays email-safe: inline styles, no scripts, no trackers", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/\sonclick=/i);
    expect(html).not.toMatch(/<style/i);
    expect(html).not.toMatch(/pixel\.gif|open.?pixel|width="1"\s+height="1"/i);
    expect(html).toContain('style="');
  });

  it("declares a single-line subject", () => {
    expect(subject.split("\n")).toHaveLength(1);
    expect(subject).toBe("Reset your password — Assetflow");
    expect(subject.length).toBeLessThanOrEqual(78);
  });
});
