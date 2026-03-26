const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const projectDir = "/sessions/tender-magical-dirac/mnt/pdf-converter";

// Load env with quote handling
const envPath = path.join(projectDir, ".env.local");
const lines = fs.readFileSync(envPath, "utf-8").split("\n");
for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  let val = t.slice(i + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[t.slice(0, i).trim()] = val;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!url || !key) {
  console.log("ERROR: Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

// Read content from the markdown file
const mdFile = path.join(projectDir, "seo-content/comparison-2026-03-26-invoice-ocr-software.md");
const mdRaw = fs.readFileSync(mdFile, "utf-8");

// Extract article content (skip frontmatter/checklist, start from Introduction)
const introIdx = mdRaw.indexOf("## Introduction");
let content = introIdx !== -1 ? mdRaw.substring(introIdx) : mdRaw;

// Remove the schema markup section at the end
const schemaIdx = content.indexOf("---\n\n**Schema Markup");
if (schemaIdx !== -1) content = content.substring(0, schemaIdx).trim();

const blogPost = {
  title: "Best Invoice OCR Software in 2026: InvoiceToData vs Top 7 Competitors Compared",
  slug: "best-invoice-ocr-software-2026-comparison",
  meta_description: "Compare the top 8 invoice OCR tools in 2026. See how InvoiceToData stacks up against Klippa, Nanonets, Rossum, Docsumo & others for accuracy, pricing & ease of use.",
  keywords: "best invoice OCR software, invoice data extraction comparison, invoice OCR 2026, invoice parser, invoice scanning software",
  content: content,
};

async function publish() {
  console.log("Connecting to Supabase...");

  const { data: existing } = await supabase
    .from("blogs")
    .select("id")
    .eq("slug", blogPost.slug)
    .single();

  if (existing) {
    console.log("Post exists, updating...");
    const { data, error } = await supabase
      .from("blogs")
      .update({
        title: blogPost.title,
        meta_description: blogPost.meta_description,
        keywords: blogPost.keywords,
        content: blogPost.content,
      })
      .eq("slug", blogPost.slug)
      .select()
      .single();

    if (error) { console.log("ERROR:", error.message); process.exit(1); }
    console.log("UPDATED: https://invoicetodata.com/blog/" + blogPost.slug);
    return;
  }

  console.log("Publishing new post...");
  const { data, error } = await supabase
    .from("blogs")
    .insert(blogPost)
    .select()
    .single();

  if (error) { console.log("ERROR:", error.message); process.exit(1); }
  console.log("PUBLISHED: https://invoicetodata.com/blog/" + blogPost.slug);
  console.log("ID:", data.id);
}

publish().catch((e) => { console.log("ERROR:", e.message); process.exit(1); });
