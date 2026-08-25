/**
 * Verify syndication credentials without publishing anything.
 *
 * Read-only on purpose. A publish test would create a real public post under
 * your account, on a post nobody chose — so this hits identity endpoints
 * instead and confirms the keys and the publication ID resolve. The cron does
 * the actual publishing, on its own schedule, one post at a time.
 *
 * Checks:
 *   dev.to     GET /api/users/me            — key valid, whose account
 *   Hashnode   { me { username } }          — token valid, whose account
 *   Hashnode   { publication(id) { … } }    — the publication ID actually exists
 *
 * That last one matters: a wrong HASHNODE_PUBLICATION_ID authenticates fine
 * and then fails every publish, which would look like a daily mystery error.
 *
 * Usage: npx tsx scripts/verify-syndication-keys.ts
 */

import * as fs from "fs";
import * as path from "path";

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

type Check = { name: string; ok: boolean; detail: string; unreachable?: boolean };
const checks: Check[] = [];

async function checkDevTo(): Promise<void> {
  const key = process.env.DEVTO_API_KEY;
  if (!key) {
    checks.push({ name: "dev.to key", ok: false, detail: "DEVTO_API_KEY not set" });
    return;
  }
  try {
    const res = await fetch("https://dev.to/api/users/me", {
      headers: { "api-key": key },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text();
      checks.push({
        name: "dev.to key",
        ok: false,
        detail: `HTTP ${res.status} — ${body.slice(0, 120)}`,
      });
      return;
    }
    const me = (await res.json()) as { username?: string; name?: string };
    checks.push({
      name: "dev.to key",
      ok: true,
      detail: `authenticated as @${me.username ?? "?"}${me.name ? ` (${me.name})` : ""}`,
    });
  } catch (err) {
    checks.push({
      name: "dev.to key",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

class NonJsonResponse extends Error {}

async function hashnodeQuery(token: string, query: string): Promise<{ data?: unknown; errors?: { message: string }[] }> {
  const res = await fetch("https://gql.hashnode.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15000),
  });

  // Distinguish "your token is wrong" from "you never reached the API". The
  // endpoint answers some POSTs with the Hashnode web app's HTML, which is not
  // a credential problem and shouldn't be reported as one.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new NonJsonResponse(
      `endpoint returned ${res.status} ${contentType || "no content-type"} instead of JSON — ` +
        `this machine did not reach the GraphQL API, so the token is untested. ` +
        `Likely an edge or IP-reputation block; check the cron's own report from Vercel.`
    );
  }
  return (await res.json()) as { data?: unknown; errors?: { message: string }[] };
}

async function checkHashnode(): Promise<void> {
  const token = process.env.HASHNODE_API_KEY;
  const pubId = process.env.HASHNODE_PUBLICATION_ID;

  if (!token) {
    checks.push({ name: "Hashnode token", ok: false, detail: "HASHNODE_API_KEY not set" });
  } else {
    try {
      const r = await hashnodeQuery(token, "{ me { username name } }");
      if (r.errors?.length) {
        checks.push({ name: "Hashnode token", ok: false, detail: r.errors[0].message.slice(0, 140) });
      } else {
        const me = (r.data as { me?: { username?: string; name?: string } } | undefined)?.me;
        checks.push({
          name: "Hashnode token",
          ok: !!me?.username,
          detail: me?.username
            ? `authenticated as @${me.username}${me.name ? ` (${me.name})` : ""}`
            : "token accepted but returned no user",
        });
      }
    } catch (err) {
      checks.push({
        name: "Hashnode token",
        ok: false,
        unreachable: err instanceof NonJsonResponse,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!pubId) {
    checks.push({ name: "Hashnode publication", ok: false, detail: "HASHNODE_PUBLICATION_ID not set" });
    return;
  }
  if (!token) return;

  try {
    const r = await hashnodeQuery(
      token,
      `{ publication(id: "${pubId.replace(/"/g, "")}") { title url } }`
    );
    if (r.errors?.length) {
      checks.push({
        name: "Hashnode publication",
        ok: false,
        detail: r.errors[0].message.slice(0, 140),
      });
      return;
    }
    const pub = (r.data as { publication?: { title?: string; url?: string } } | undefined)?.publication;
    checks.push({
      name: "Hashnode publication",
      ok: !!pub,
      detail: pub
        ? `resolves to "${pub.title ?? "untitled"}" — ${pub.url ?? "no url"}`
        : "publication ID did not resolve — publishes would fail every day",
    });
  } catch (err) {
    checks.push({
      name: "Hashnode publication",
      ok: false,
      unreachable: err instanceof NonJsonResponse,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

async function run() {
  console.log("Verifying syndication credentials (read-only — nothing is published)\n");

  await checkDevTo();
  await checkHashnode();

  const pad = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) {
    const mark = c.ok ? "OK  " : c.unreachable ? "??  " : "FAIL";
    console.log(`  ${mark}  ${c.name.padEnd(pad)}  ${c.detail}`);
  }

  console.log("\nMedium: not checked — the Integration Token programme was retired,");
  console.log("so it is out of the rotation entirely rather than failing daily.");

  const unreachable = checks.filter((c) => c.unreachable);
  const failed = checks.filter((c) => !c.ok && !c.unreachable);

  if (unreachable.length > 0) {
    console.log(
      `\n${unreachable.length} check(s) INCONCLUSIVE — the request never reached the API from` +
        `\nthis machine, so the credential is neither confirmed nor disproved. This is not` +
        `\nthe same as a bad key. The cron runs from Vercel on a different IP; its daily` +
        `\nTelegram report is the authoritative test. Re-run this from another network if` +
        `\nyou want a local answer.`
    );
  }
  if (failed.length > 0) {
    console.log(
      `\n${failed.length} check(s) genuinely FAILED — those will report as skipped or failed` +
        `\nin the daily report until fixed.`
    );
  }
  if (failed.length === 0 && unreachable.length === 0) {
    console.log("\nAll platforms ready. The cron will publish one post per day,");
    console.log("highest-impression first, once migration 0005 is applied.");
    return;
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

run();
