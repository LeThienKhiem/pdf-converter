/**
 * Publish the Gemini-vs-Claude comparison blog post to Supabase.
 *
 * Usage:
 *   npx tsx scripts/publish-gemini-vs-claude.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ----- Load .env.local -----
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[t.slice(0, eq).trim()] = val;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase config. Add to .env.local:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co");
  console.error("   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key");
  process.exit(1);
}

// ----- Read the markdown source -----
const mdPath = path.join(
  process.cwd(),
  "seo-content",
  "comparison-2026-04-27-gemini-vs-claude-pdf-ocr.md"
);
if (!fs.existsSync(mdPath)) {
  console.error(`❌ Markdown file not found: ${mdPath}`);
  process.exit(1);
}
const mdRaw = fs.readFileSync(mdPath, "utf-8");

// ----- Extract content (from `## Introduction` to end) -----
const introIdx = mdRaw.indexOf("## Introduction");
if (introIdx === -1) {
  console.error("❌ Could not find '## Introduction' anchor in markdown.");
  process.exit(1);
}
const content = mdRaw.slice(introIdx).trim();

// ----- Hardcoded metadata (matches the markdown frontmatter) -----
const blogPost = {
  title: "Gemini vs Claude for PDF OCR: Why We Switched Our Invoice Extraction Engine in 2026",
  slug: "gemini-vs-claude-for-pdf-ocr",
  meta_description:
    "We migrated InvoiceToData's invoice OCR pipeline from Google Gemini to Anthropic Claude. Here's the honest, technical breakdown of why — and what changed in production.",
  keywords:
    "gemini vs claude, claude vs gemini for ocr, gemini vs claude pdf, anthropic claude vs google gemini, best LLM for invoice extraction, claude haiku vs gemini flash, claude sonnet 4.6 vs gemini, switch from gemini to claude",
  content,
};

// ----- Publish (insert or update on slug conflict) -----
const supabase = createClient(supabaseUrl, supabaseKey);

async function publish() {
  console.log("📝 Publishing blog post...");
  console.log(`   Title: ${blogPost.title}`);
  console.log(`   Slug:  ${blogPost.slug}`);
  console.log(`   Bytes: ${blogPost.content.length}`);

  const { data: existing } = await supabase
    .from("blogs")
    .select("id")
    .eq("slug", blogPost.slug)
    .maybeSingle();

  if (existing) {
    console.log("⚠️  Post with this slug already exists. Updating...");
    const { error } = await supabase
      .from("blogs")
      .update({
        title: blogPost.title,
        meta_description: blogPost.meta_description,
        keywords: blogPost.keywords,
        content: blogPost.content,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", blogPost.slug);

    if (error) {
      console.error("❌ Update failed:", error.message);
      process.exit(1);
    }
    console.log("✅ Blog post updated.");
  } else {
    const { data, error } = await supabase
      .from("blogs")
      .insert(blogPost)
      .select()
      .single();

    if (error) {
      console.error("❌ Insert failed:", error.message);
      process.exit(1);
    }
    console.log(`✅ Blog post inserted (id: ${data.id}).`);
  }

  console.log(`   URL:   https://invoicetodata.com/blog/${blogPost.slug}`);

  // Ping Google sitemap (non-critical)
  try {
    await fetch(
      "https://www.google.com/ping?sitemap=https://www.invoicetodata.com/sitemap.xml",
      { signal: AbortSignal.timeout(10000) }
    );
    console.log("   Sitemap ping sent.");
  } catch {
    /* non-critical */
  }
}

publish().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
