/**
 * Builds a self-contained local preview of the Supabase "Confirm signup"
 * template so the rendered HTML can be opened in a browser before it is
 * pasted into the Supabase dashboard.
 *
 *   node emails/build-preview.mjs
 *
 * The Supabase variables are replaced with clearly fake sample values; the
 * generated `emails/preview.html` is a preview artifact only and is never
 * used to send email.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const templatePath = join(here, "confirm-signup.html");
const previewPath = join(here, "preview.html");

const SAMPLE = {
  confirmationUrl: "https://app.example.com/auth/callback?next=%2Fdashboard&code=sample-code-not-real",
  email: "jane.doe@example.com",
};

let html = readFileSync(templatePath, "utf8");

// The preview is opened from `emails/`, so the logo resolves through `public/`.
html = html.replace("{{ .SiteURL }}/email/logo.png", "../public/email/logo.png");
html = html.split("{{ .ConfirmationURL }}").join(SAMPLE.confirmationUrl);
html = html.split("{{ .SiteURL }}").join("https://app.example.com");
html = html.split("{{ .Email }}").join(SAMPLE.email);

const leftover = html.match(/\{\{\s*\.[^}]*\}\}/g);
if (leftover) {
  console.error(`Unreplaced template variable(s): ${[...new Set(leftover)].join(", ")}`);
  process.exit(1);
}

writeFileSync(previewPath, html, "utf8");
console.log(`wrote ${previewPath}`);
