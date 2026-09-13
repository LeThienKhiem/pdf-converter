/**
 * Ask Google what it actually did with our pages.
 *
 * Not an indexing request — no API offers one. Google's Indexing API is
 * restricted to "pages with either JobPosting or BroadcastEvent embedded in a
 * VideoObject", and its docs warn that abuse "may result in access being
 * revoked", so it is not an option for a converter or a blog post regardless of
 * how convenient it would be. Requesting a recrawl still means URL Inspection
 * in Search Console, by hand.
 *
 * What the URL Inspection API does give, read-only, is the answer to the
 * question actually open right now: did the canonical fix land? Five pages
 * stopped declaring the homepage as their canonical on 2026-09-12, but that is
 * what our server says. This reports what Google's index holds — the canonical
 * it selected, whether the URL is indexed, and when it was last crawled — which
 * is the only version that affects rankings.
 *
 * Setup, once (about five minutes):
 *
 *   1. Google Cloud console -> create a project (or reuse one)
 *   2. Enable "Google Search Console API" for it
 *   3. Create a service account, then create a JSON key for it
 *   4. Search Console -> Settings -> Users and permissions -> Add user:
 *      the service account's email, permission "Full" or "Restricted"
 *   5. Put the key's path in .env.local:
 *        GSC_SERVICE_ACCOUNT_KEY_FILE=/absolute/path/to/key.json
 *      or paste the JSON itself as GSC_SERVICE_ACCOUNT_KEY
 *
 * Step 4 is the one people miss. A service account with the API enabled but no
 * Search Console permission authenticates fine and then returns 403 on every
 * property.
 *
 * Usage:
 *   npx tsx scripts/gsc-inspect.ts                 # the six URLs that changed
 *   npx tsx scripts/gsc-inspect.ts <url> [url...]
 */

import * as fs from "fs";
import * as path from "path";
import { google } from "googleapis";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

const SITE = "https://www.invoicetodata.com";

/** Search Console property. A URL-prefix property must match exactly, www included. */
const SITE_URL = process.env.GSC_SITE_URL ?? `${SITE}/`;

const DEFAULT_URLS = [
  `${SITE}/tools`,
  `${SITE}/tools/bank-statement-to-excel`,
  `${SITE}/tools/pdf-to-excel`,
  `${SITE}/tools/pdf-to-gsheet`,
  `${SITE}/blog`,
  `${SITE}/blog/ai-bank-statement-converter-limits-compared`,
];

function credentials(): { key: Record<string, unknown> } | null {
  const inline = process.env.GSC_SERVICE_ACCOUNT_KEY;
  if (inline) {
    try {
      return { key: JSON.parse(inline) };
    } catch {
      console.error("GSC_SERVICE_ACCOUNT_KEY is set but is not valid JSON.");
      return null;
    }
  }
  const file = process.env.GSC_SERVICE_ACCOUNT_KEY_FILE;
  if (file && fs.existsSync(file)) {
    return { key: JSON.parse(fs.readFileSync(file, "utf-8")) };
  }
  return null;
}

function setupHelp() {
  console.error(
    `\nNo Search Console credentials found.\n\n` +
      `  1. Google Cloud console -> new project -> enable "Google Search Console API"\n` +
      `  2. Create a service account, then a JSON key for it\n` +
      `  3. Search Console -> Settings -> Users and permissions -> Add user:\n` +
      `     the service account email, permission Full or Restricted\n` +
      `  4. Add to .env.local:\n` +
      `       GSC_SERVICE_ACCOUNT_KEY_FILE=/absolute/path/to/key.json\n\n` +
      `Step 3 is the one that gets skipped. Without it the account authenticates\n` +
      `and then returns 403 on every property.\n`
  );
}

type Inspection = {
  indexStatusResult?: {
    verdict?: string;
    coverageState?: string;
    googleCanonical?: string;
    userCanonical?: string;
    lastCrawlTime?: string;
    pageFetchState?: string;
    robotsTxtState?: string;
  };
};

async function run() {
  const args = process.argv.slice(2).filter((a) => a.startsWith("http"));
  const urls = args.length > 0 ? args : DEFAULT_URLS;

  const creds = credentials();
  if (!creds) {
    setupHelp();
    process.exitCode = 1;
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds.key,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });

  console.log(`property: ${SITE_URL}\n`);

  for (const url of urls) {
    process.stdout.write(`${url.replace(SITE, "") || "/"}\n`);
    try {
      const res = await searchconsole.urlInspection.index.inspect({
        requestBody: { inspectionUrl: url, siteUrl: SITE_URL },
      });
      const r = (res.data.inspectionResult as Inspection | undefined)?.indexStatusResult;
      if (!r) {
        console.log(`   no index status returned\n`);
        continue;
      }

      const declared = r.userCanonical ?? "(none)";
      const selected = r.googleCanonical ?? "(none)";
      // The whole reason for running this. A page whose declared and selected
      // canonical disagree is one Google is folding into another URL.
      const agree = declared === selected;

      console.log(`   verdict        ${r.verdict ?? "?"}`);
      console.log(`   coverage       ${r.coverageState ?? "?"}`);
      console.log(`   last crawled   ${r.lastCrawlTime ?? "never"}`);
      console.log(`   we declare     ${declared.replace(SITE, "") || declared}`);
      console.log(
        `   Google picked  ${selected.replace(SITE, "") || selected}` +
          `${agree ? "   MATCH" : "   MISMATCH — Google is indexing the other URL"}`
      );
      console.log();
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e.code === 403) {
        console.log(
          `   403 — the service account has no access to ${SITE_URL}.` +
            `\n   Add its email under Search Console -> Settings -> Users and permissions.\n`
        );
      } else if (e.code === 429) {
        console.log(`   429 — inspection quota exhausted for today.\n`);
      } else {
        console.log(`   ${e.code ?? ""} ${e.message ?? String(err)}\n`);
      }
    }
  }

  console.log(
    `Read-only. No API can request indexing for these page types — the Indexing\n` +
      `API covers only JobPosting and BroadcastEvent. Use Search Console's URL\n` +
      `Inspection tool by hand for that.`
  );
}

run();
