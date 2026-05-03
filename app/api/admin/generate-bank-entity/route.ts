import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, PDF_MODEL } from "@/lib/anthropic";
import { sendTelegramMessage } from "@/lib/telegram";
import { BANK_ENTITIES } from "@/lib/bankEntities";

/**
 * Helper route to draft a new BankEntity using Haiku, then ship the JSON
 * to Telegram for human review. Deliberately does NOT write to the codebase
 * — bank-specific facts are too easy for an LLM to hallucinate, so we keep
 * the human in the loop.
 *
 * Workflow:
 *   1. Hit this endpoint with the bank name.
 *   2. Read the Telegram message.
 *   3. Eyeball the JSON, fix anything wrong, paste it into
 *      lib/bankEntities.ts → BANK_ENTITIES array.
 *   4. Redeploy. The new bank page auto-generates.
 *
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.invoicetodata.com/api/admin/generate-bank-entity?bank=Truist&country=US"
 *
 * Cost: ~$0.001/call (Haiku tool_use, ~500 input + ~400 output tokens).
 */

const ENTITY_TOOL: Anthropic.Tool = {
  name: "draft_bank_entity",
  description:
    "Draft a structured BankEntity record describing how a particular bank's statements behave for an OCR/extraction tool. Be conservative: when uncertain, omit specifics rather than guess.",
  input_schema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description:
          "URL-safe slug, kebab-case, ASCII only, no 'bank' suffix unless part of the name (e.g. 'truist', 'bank-of-america', 'us-bank').",
      },
      name: {
        type: "string",
        description: "Display name as the bank markets itself (e.g. 'Bank of America', 'U.S. Bank').",
      },
      country: {
        type: "string",
        description: "ISO 3166-1 alpha-2 country code, uppercase (US, GB, CA, AU, etc).",
      },
      currency: {
        type: "string",
        description: "ISO 4217 currency code, uppercase (USD, GBP, EUR, etc).",
      },
      domain: {
        type: "string",
        description:
          "Primary public website domain, no protocol (e.g. 'truist.com'). Use the bank's most well-known domain.",
      },
      statementFormats: {
        type: "array",
        items: { type: "string", enum: ["PDF", "CSV", "QFX", "OFX", "QBO"] },
        description:
          "Statement download formats this bank typically offers. PDF is universal — only include the others if you're confident the bank publishes them.",
      },
      passwordProtected: {
        type: "boolean",
        description:
          "Whether the bank commonly password-protects statement PDFs by default (more common for UK/EU banks than US).",
      },
      note: {
        type: "string",
        description:
          "ONE sentence specific to this bank's statement workflow that adds factual value (e.g. multi-account bundling, specific section layout). Do NOT invent specifics — keep it general if unsure.",
      },
      accountTypes: {
        type: "array",
        items: { type: "string" },
        description:
          "Common account types whose statements this tool handles for the bank (e.g. 'Checking', 'Savings', 'Credit Card', 'Business'). 2-5 entries.",
      },
      confidence: {
        type: "number",
        description:
          "Self-assessed confidence (0-100) that the facts above are accurate for THIS bank. <70 means the human reviewer should double-check before adding.",
      },
    },
    required: [
      "slug",
      "name",
      "country",
      "currency",
      "domain",
      "statementFormats",
      "passwordProtected",
      "note",
      "accountTypes",
      "confidence",
    ],
  },
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const bankName = url.searchParams.get("bank")?.trim();
  const countryHint = url.searchParams.get("country")?.trim().toUpperCase();

  if (!bankName) {
    return NextResponse.json(
      { error: "Missing 'bank' query param. Example: ?bank=Truist&country=US" },
      { status: 400 }
    );
  }

  // Skip if we already have this bank — protects against accidentally
  // generating duplicates with slightly different naming.
  const existingMatch = BANK_ENTITIES.find(
    (b) =>
      b.name.toLowerCase() === bankName.toLowerCase() ||
      b.slug === bankName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  );
  if (existingMatch) {
    return NextResponse.json({
      skipped: true,
      reason: "already-exists",
      existing: existingMatch,
    });
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

    const client = getAnthropic();
    const message = await client.messages.create({
      model: PDF_MODEL, // Haiku — cheap, sufficient for structured drafting
      max_tokens: 800,
      tools: [ENTITY_TOOL],
      tool_choice: { type: "tool", name: "draft_bank_entity" },
      messages: [
        {
          role: "user",
          content: `Draft a BankEntity record for "${bankName}"${countryHint ? ` (country: ${countryHint})` : ""}.

This will become a programmatic SEO landing page at /tools/bank/{slug} targeting "convert ${bankName} statement to excel" search queries.

Be CONSERVATIVE — when uncertain about a specific fact, prefer general/safe values. The 'note' field in particular: do NOT invent specifics about the bank's exact statement layout. Only state things that are plausibly true of any standard statement from this institution.

Return via the draft_bank_entity tool.`,
        },
      ],
    });

    const toolBlock = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolBlock) throw new Error("Haiku did not return a tool_use block");

    const draft = toolBlock.input as Record<string, unknown>;

    // Format the draft as a TypeScript snippet ready to paste into BANK_ENTITIES.
    const tsSnippet = formatAsTsSnippet(draft);

    await sendTelegramMessage(
      `🏦 <b>Bank entity draft — ${bankName}</b>\n\n` +
        `Confidence: <b>${draft.confidence ?? "?"}/100</b>\n` +
        (typeof draft.confidence === "number" && draft.confidence < 70
          ? `⚠️ Low confidence — verify facts before adding.\n`
          : "") +
        `\nPaste into <code>lib/bankEntities.ts</code> → BANK_ENTITIES array:\n\n` +
        `<pre>${escapeHtml(tsSnippet)}</pre>`
    );

    return NextResponse.json({
      success: true,
      bank: bankName,
      draft,
      snippet: tsSnippet,
    });
  } catch (err) {
    console.error("[Generate Bank Entity] Error:", err);
    const messageText = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: messageText }, { status: 500 });
  }
}

/** Format a BankEntity-shaped object as a TS source snippet. */
function formatAsTsSnippet(draft: Record<string, unknown>): string {
  const fmt = (v: unknown): string => {
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "boolean" || typeof v === "number") return String(v);
    if (Array.isArray(v)) return `[${v.map(fmt).join(", ")}]`;
    return "null";
  };

  return `  {
    slug: ${fmt(draft.slug)},
    name: ${fmt(draft.name)},
    country: ${fmt(draft.country)},
    currency: ${fmt(draft.currency)},
    domain: ${fmt(draft.domain)},
    statementFormats: ${fmt(draft.statementFormats)},
    passwordProtected: ${fmt(draft.passwordProtected)},
    note: ${fmt(draft.note)},
    accountTypes: ${fmt(draft.accountTypes)},
  },`;
}

/** Telegram <pre> blocks render markup as code, but we still escape angle brackets. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
