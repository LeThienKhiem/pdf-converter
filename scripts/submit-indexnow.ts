/**
 * Submit URLs to IndexNow so Bing, Yandex, Seznam and Naver recrawl them.
 *
 * This is the automatable half of "request indexing". Google has no equivalent:
 * its sitemap ping endpoint was retired in 2023, and the Indexing API covers
 * only JobPosting and BroadcastEvent pages. Google recrawls have to be
 * requested by hand through Search Console's URL Inspection tool — this script
 * prints the list to paste there.
 *
 * Worth running whenever a page's canonical, redirect, or title changes, since
 * those are invisible until the page is fetched again. Routine publishing does
 * not need it; the sitemap covers that.
 *
 * The host must match the URLs. app/api/cron/index-urls/route.ts sends
 * host "invoicetodata.com" while every canonical URL on the site is www —
 * IndexNow rejects a submission whose URLs do not belong to the declared host,
 * so that call has been failing whenever it ran.
 *
 * Usage:
 *   npx tsx scripts/submit-indexnow.ts                  # the default set
 *   npx tsx scripts/submit-indexnow.ts <url> [url...]   # specific URLs
 *   npx tsx scripts/submit-indexnow.ts --dry-run
 */

const HOST = "www.invoicetodata.com";
const SITE = `https://${HOST}`;
const KEY = "invoicetodata-indexnow-key";
const KEY_LOCATION = `${SITE}/${KEY}.txt`;

/**
 * The pages whose canonical tag changed on 2026-09-12, plus the post published
 * on 2026-09-13. Until each is refetched, the index still holds the old
 * canonical pointing at the homepage.
 */
const DEFAULT_URLS = [
  `${SITE}/tools`,
  `${SITE}/tools/bank-statement-to-excel`,
  `${SITE}/tools/pdf-to-excel`,
  `${SITE}/tools/pdf-to-gsheet`,
  `${SITE}/blog`,
  `${SITE}/blog/ai-bank-statement-converter-limits-compared`,
];

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const urls = args.filter((a) => a.startsWith("http"));
const urlList = urls.length > 0 ? urls : DEFAULT_URLS;

async function run() {
  const wrongHost = urlList.filter((u) => !u.startsWith(SITE));
  if (wrongHost.length > 0) {
    console.error(`These URLs are not on ${HOST}; IndexNow would reject the batch:`);
    for (const u of wrongHost) console.error(`  ${u}`);
    process.exitCode = 1;
    return;
  }

  console.log(`host: ${HOST}`);
  console.log(`key:  ${KEY_LOCATION}\n`);
  for (const u of urlList) console.log(`  ${u}`);

  // The key file must be reachable — IndexNow fetches it to prove ownership,
  // and a 404 there fails the whole batch with a status that does not say so.
  try {
    const probe = await fetch(KEY_LOCATION, { signal: AbortSignal.timeout(15000) });
    const body = (await probe.text()).trim();
    if (!probe.ok || body !== KEY) {
      console.error(
        `\nKey file check failed: HTTP ${probe.status}, body "${body.slice(0, 40)}".` +
          `\nIt must return exactly "${KEY}". Submission would be rejected.`
      );
      process.exitCode = 1;
      return;
    }
    console.log(`\nkey file verified (HTTP 200, contents match)`);
  } catch (err) {
    console.error(`\nCould not reach the key file: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
    return;
  }

  if (DRY_RUN) {
    console.log("\nDry-run — nothing submitted.");
    printGoogleInstructions();
    return;
  }

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  // 200 accepted, 202 accepted pending key validation. Everything else is a
  // rejection with a meaning worth printing rather than collapsing to false.
  if (res.status === 200 || res.status === 202) {
    console.log(`\nSubmitted ${urlList.length} URL(s) — HTTP ${res.status}${res.status === 202 ? " (accepted, key validation pending)" : ""}`);
  } else {
    const why: Record<number, string> = {
      400: "bad request — malformed payload",
      403: "key not valid for this host",
      422: "URLs do not belong to the declared host, or the key does not match",
      429: "too many requests",
    };
    console.error(`\nRejected: HTTP ${res.status} — ${why[res.status] ?? "unexpected"}`);
    if (text) console.error(text.slice(0, 200));
    process.exitCode = 1;
    return;
  }

  printGoogleInstructions();
}

function printGoogleInstructions() {
  console.log(
    `\n${"=".repeat(70)}\n` +
      `GOOGLE — manual, no API exists for this\n` +
      `${"=".repeat(70)}\n` +
      `Search Console -> URL Inspection -> paste URL -> Request Indexing.\n` +
      `One at a time; there is a daily quota, so do the highest-value first:\n`
  );
  for (const u of urlList) console.log(`  ${u}`);
  console.log(
    `\nThe first three matter most — they carry the changed canonical and the\n` +
      `largest impression pools. Until Google refetches them, the index still\n` +
      `holds a canonical pointing at the homepage.`
  );
}

run();
