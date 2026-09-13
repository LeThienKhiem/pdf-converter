/**
 * Copy pdf.js font and character-map data into public/ before a build.
 *
 * pdf.js does not bundle these. When a PDF uses one of the 14 standard fonts
 * without embedding it — which plenty of bank statements do — pdf.js fetches
 * the font data at render time from `standardFontDataUrl`. Without it the page
 * renders with the text missing, and the only sign is a console warning:
 * "Ensure that the `standardFontDataUrl` API parameter is provided."
 *
 * That is the worst shape of failure for this feature. The unlock succeeds, a
 * PDF comes out, extraction runs, and the user gets an empty sheet back with
 * nothing anywhere saying why. It was caught here only because a test
 * statement happened to use unembedded Helvetica.
 *
 * cmaps are the same story for CJK encodings — a Chinese, Japanese or Korean
 * statement renders blank without them.
 *
 * Copied at build time rather than committed so the data can never drift from
 * the installed pdfjs-dist version: 185 vendored files that silently belong to
 * an older release would reintroduce exactly this bug.
 *
 * Fails the build if the source is missing. A silent skip here means a
 * feature that looks fine in review and returns blank sheets in production.
 */

import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const SOURCES = [
  { from: "node_modules/pdfjs-dist/standard_fonts", to: "public/pdfjs/standard_fonts" },
  { from: "node_modules/pdfjs-dist/cmaps", to: "public/pdfjs/cmaps" },
];

for (const { from, to } of SOURCES) {
  const src = path.resolve(from);
  const dest = path.resolve(to);

  if (!existsSync(src)) {
    console.error(
      `\n[pdfjs-assets] ${from} is missing.\n` +
        `pdf.js renders pages with no text when this data is absent, and says so only\n` +
        `in a console warning. Refusing to build rather than ship that.\n` +
        `Run npm install, or drop lib/pdfPassword.ts if pdfjs-dist is no longer needed.\n`
    );
    process.exit(1);
  }

  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true });

  const count = (await readdir(dest)).length;
  console.log(`[pdfjs-assets] ${to} — ${count} files`);
}
