/**
 * Live test for the pre-write research layer.
 *
 * Uses Klippa as the probe because we know the answer independently: SER Group
 * acquired it in March 2025, the group rebranded to Doxis in January 2026, and
 * the DocHorizon name was retired on 30 March 2026. A blog post generated on
 * 2026-04-14 mentioned none of that, which is what motivated this layer.
 *
 * So this is a real pass/fail, not a smoke test: if research works, the output
 * names the acquisition or the rebrand. If it comes back describing Klippa as
 * an independent Dutch company, the layer isn't doing its job.
 *
 * Usage: npx tsx scripts/test-research-layer.ts
 */

import * as fs from "fs";
import * as path from "path";
import { researchCurrentFacts, templateNeedsResearch } from "../lib/seoContent";

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

/** Terms that prove the search surfaced the current state of the world. */
const MUST_SURFACE = ["doxis", "ser group", "acquir", "rebrand"];

async function run() {
  console.log("=".repeat(74));
  console.log("1. TEMPLATE GATING");
  console.log("=".repeat(74));
  for (const t of [
    "comparison",
    "alternative",
    "pricing-comparison",
    "llm-buying-decision",
    "how-to",
    "glossary",
    "industry",
  ]) {
    console.log(`  ${templateNeedsResearch(t) ? "RESEARCH" : "skip    "}  ${t}`);
  }

  console.log("\n" + "=".repeat(74));
  console.log("2. LIVE RESEARCH CALL (Klippa — known-answer probe)");
  console.log("=".repeat(74));

  const started = Date.now();
  const result = await researchCurrentFacts({
    subject: "Klippa invoice OCR — current product status and pricing",
    angle:
      "A comparison article evaluating Klippa against alternatives for a small accounting team.",
    maxSearches: 5,
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\nelapsed: ${elapsed}s`);
  console.log(`sources: ${result.sources.length}`);
  for (const s of result.sources.slice(0, 10)) console.log(`  - ${s}`);
  if (result.note) console.log(`note: ${result.note}`);

  if (!result.block) {
    console.log("\nFAIL — no research block returned. The writer would fall back");
    console.log("to model knowledge, which is the problem this layer exists to fix.");
    process.exit(1);
  }

  console.log("\n--- research block as the writer will see it ---\n");
  console.log(result.block);

  console.log("\n" + "=".repeat(74));
  console.log("3. ASSERTIONS");
  console.log("=".repeat(74));
  const lower = result.block.toLowerCase();
  const found = MUST_SURFACE.filter((term) => lower.includes(term));
  const missing = MUST_SURFACE.filter((term) => !lower.includes(term));

  for (const term of found) console.log(`  PASS  surfaced "${term}"`);
  for (const term of missing) console.log(`  --    did not mention "${term}"`);

  const hasSources = result.sources.length > 0;
  console.log(`  ${hasSources ? "PASS" : "FAIL"}  cited at least one live source`);

  // The acquisition/rebrand is the single fact the stale post missed, so
  // surfacing any form of it is the real bar here.
  const caughtTheStaleFact = found.length > 0;
  console.log(
    `  ${caughtTheStaleFact ? "PASS" : "FAIL"}  caught the fact the stale post missed`
  );

  if (!caughtTheStaleFact || !hasSources) {
    console.log("\nFAIL — research ran but did not surface current state.");
    process.exit(1);
  }
  console.log("\nAll assertions passed.");
}

run();
