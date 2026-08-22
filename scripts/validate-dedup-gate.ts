/**
 * Validate mechanicalDupeCheck() against the real corpus — a replay test.
 *
 * For each post (oldest -> newest), we ask: if this title had been proposed
 * at the time, checked against only the posts that already existed, would the
 * mechanical gate have blocked it?
 *
 * That tells us both things we need to know:
 *   - Does it catch the duplicates we know are real?
 *   - Does it wrongly block titles that are legitimately distinct?
 *
 * Usage: npx tsx scripts/validate-dedup-gate.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { mechanicalDupeCheck, normalizeTitle } from "../lib/seoContent";

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

// Pairs we already know are genuine duplicates, from the GSC + corpus audit.
// The gate MUST block the newer member of each.
const KNOWN_DUPES = [
  "Invoice OCR Pricing Comparison 2026: Finding the Best Value for Your Business",
  "How to Switch to Invoice Automation in 2026: A Step-by-Step Migration Guide for Businesses",
];

// Titles that share heavy boilerplate but are legitimately distinct articles.
// The gate MUST NOT block these.
const KNOWN_LEGIT = [
  "Best Alternatives to Rossum: Top 7 AI Invoice OCR Solutions for 2025",
  "Best Alternatives to Nanonets for Invoice Data Extraction in 2026",
];

async function run() {
  const { data, error } = await supabase
    .from("blogs")
    .select("title, slug, summary, created_at")
    .order("created_at", { ascending: true }) // oldest first — replay order
    .limit(10000);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }
  const rows = (data ?? []) as {
    title: string;
    slug: string;
    summary: string | null;
    created_at: string;
  }[];

  console.log(`Replaying ${rows.length} posts in publish order.\n`);

  const blocked: { title: string; date: string; reason: string; closest: string }[] = [];
  const allowedHighOverlap: { title: string; score: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const corpusAtTime = rows.slice(0, i).map((r) => ({
      title: r.title,
      summary: r.summary,
    }));
    if (corpusAtTime.length === 0) continue;

    const verdict = mechanicalDupeCheck(rows[i].title, corpusAtTime);
    if (verdict.isDupe) {
      blocked.push({
        title: rows[i].title,
        date: rows[i].created_at.slice(0, 10),
        reason: verdict.reason,
        closest: verdict.closestTitle,
      });
    } else if (verdict.score >= 0.45) {
      allowedHighOverlap.push({
        title: rows[i].title,
        score: verdict.score,
        reason: verdict.reason,
      });
    }
  }

  console.log("=".repeat(74));
  console.log(`WOULD HAVE BEEN BLOCKED: ${blocked.length} of ${rows.length}`);
  console.log("=".repeat(74));
  for (const b of blocked) {
    console.log(`\n  ${b.date}  ${b.title}`);
    console.log(`     vs: ${b.closest}`);
    console.log(`     -> ${b.reason}`);
  }

  console.log("\n" + "=".repeat(74));
  console.log(`ALLOWED DESPITE HIGH OVERLAP (rescued by a new distinctive term): ${allowedHighOverlap.length}`);
  console.log("=".repeat(74));
  for (const a of allowedHighOverlap) {
    console.log(`\n  ${a.title}`);
    console.log(`     -> ${a.reason}`);
  }

  // ── Assertions against the known-answer sets ─────────────────────────
  console.log("\n" + "=".repeat(74));
  console.log("ASSERTIONS");
  console.log("=".repeat(74));

  const blockedNorms = new Set(blocked.map((b) => normalizeTitle(b.title)));
  let failures = 0;

  for (const title of KNOWN_DUPES) {
    const present = rows.some((r) => normalizeTitle(r.title) === normalizeTitle(title));
    if (!present) {
      console.log(`  SKIP (not in corpus): ${title.slice(0, 60)}`);
      continue;
    }
    const ok = blockedNorms.has(normalizeTitle(title));
    console.log(`  ${ok ? "PASS" : "FAIL"}  should BLOCK: ${title.slice(0, 60)}`);
    if (!ok) failures++;
  }

  for (const title of KNOWN_LEGIT) {
    const present = rows.some((r) => normalizeTitle(r.title) === normalizeTitle(title));
    if (!present) {
      console.log(`  SKIP (not in corpus): ${title.slice(0, 60)}`);
      continue;
    }
    const ok = !blockedNorms.has(normalizeTitle(title));
    console.log(`  ${ok ? "PASS" : "FAIL"}  should ALLOW: ${title.slice(0, 60)}`);
    if (!ok) failures++;
  }

  console.log(
    `\nBlock rate: ${((blocked.length / rows.length) * 100).toFixed(1)}% of historical posts.`
  );
  console.log(
    "A rate in the low single digits is what we want: high enough to stop real\n" +
      "duplicates, low enough that it isn't the reason cadence is starving."
  );
  console.log(`\n${failures === 0 ? "All assertions passed." : `${failures} assertion(s) FAILED.`}`);
  if (failures > 0) process.exit(1);
}

run();
