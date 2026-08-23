import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  PDF_MODEL,
  PDF_MODEL_PREMIUM,
  extractText,
  getAnthropic,
  parseJsonArrayLoose,
} from "@/lib/anthropic";
import {
  checkAndConsume,
  getPaidStatus,
  recordExtraction,
  refundExtraction,
} from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";
import { getSupabase } from "@/lib/supabase";

const BASE_SYSTEM_PROMPT = `You are a Visual-to-Excel copier. Analyze the document as a visual grid and reproduce its exact layout.

**Vision-to-Grid Mapping**
- Treat the document as a grid. Every visual line (row) in the PDF must become exactly one row in the output.
- Do not merge cells, skip rows, or rearrange data. Preserve the exact visual order.

**Row Preservation**
- Every visual line in the PDF must correspond to one row in the output array.
- Empty visual rows become a row with nulls or empty strings as needed.

**Column Preservation**
- If multiple elements (labels, checkboxes, values) appear on the same horizontal line, put each in a separate adjacent cell.
- For multi-column sections (e.g. "Child 1", "Child 2", "Child 3"), keep values under their respective visual columns. Use null for empty cells.

**Output Format (CRITICAL)**
- Output ONLY a 2D JSON array: Array<Array<string | null>>.
- Your entire response MUST start with the character \`[\` and end with the character \`]\`.
- Example: [ ["Part I", "All Filers", null], ["1", "Tax Year", "2024"], ["2", "Name", "John Doe"] ]
- Each inner array is one row; each element is one cell (string or null).
- No markdown backticks, no 'json' prefix, no preamble like "Here is the data".
- No commentary, summary, or trailing explanation after the array.
- Do not merge or summarize. Act only as a Visual-to-Excel copier.`;

// Paid feature: bank-statement extractions get an extra AI-assigned category
// column — costs nothing extra since it rides the same extraction call.
const CATEGORIZE_APPENDIX = `

**Transaction Categorization (this document only)**
- This document is a bank statement. Append one extra column named "Category" to the header row of the transaction table, and to every transaction row.
- Assign each transaction one of: Income, Transfer, Rent/Mortgage, Utilities, Payroll, Insurance, Software/Subscriptions, Office/Supplies, Travel, Meals, Fuel, Bank Fees, Taxes, Loan Payment, Shopping, Healthcare, Other.
- Base the category on the transaction description. Non-transaction rows (headers, balances, summaries) get null in the Category cell.
- All other rules above still apply — do not change any other column.`;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const FREE_MAX_BYTES = 5 * 1024 * 1024; // 5MB — also the practical serverless body limit
const PAID_MAX_BYTES = 25 * 1024 * 1024; // 25MB — delivered via storage upload path
const STORAGE_BUCKET = "uploads";

function toCell(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  return String(value);
}

function normalizeTo2DArray(parsed: unknown): (string | null)[][] {
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  return parsed.map((row) => {
    if (!Array.isArray(row)) return [toCell(row)];
    return row.map(toCell);
  });
}

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function buildContent(
  mimeType: string,
  base64: string
): Anthropic.ContentBlockParam[] {
  if (mimeType === "application/pdf") {
    return [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      },
    ];
  }
  return [
    {
      type: "image",
      source: { type: "base64", media_type: mimeType as ImageMediaType, data: base64 },
    },
  ];
}

export async function POST(request: Request) {
  console.log("[Extract API] POST /api/extract called");
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[Extract] ANTHROPIC_API_KEY is not set");
      return NextResponse.json(
        { error: "Server is missing ANTHROPIC_API_KEY configuration." },
        { status: 500 }
      );
    }

    let base64: string;
    let mimeType: string;
    let tool = "pdf-to-excel";
    let byteSize = 0;

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        base64?: string;
        mimeType?: string;
        storagePath?: string;
        tool?: string;
      };
      if (typeof body.tool === "string") tool = body.tool.slice(0, 40);

      if (body.storagePath && typeof body.storagePath === "string") {
        // Large-file path: the file was uploaded to Supabase Storage via a
        // signed URL from /api/upload-url (paid users only). Verify ownership
        // by path prefix, download, and delete immediately after reading.
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !body.storagePath.startsWith(`${user.id}/`)) {
          return NextResponse.json(
            { error: "Invalid storage path." },
            { status: 403 }
          );
        }
        const admin = getSupabase();
        const { data: blob, error: dlError } = await admin.storage
          .from(STORAGE_BUCKET)
          .download(body.storagePath);
        if (dlError || !blob) {
          return NextResponse.json(
            { error: "Uploaded file not found. Please upload again." },
            { status: 404 }
          );
        }
        const buffer = Buffer.from(await blob.arrayBuffer());
        await admin.storage.from(STORAGE_BUCKET).remove([body.storagePath]);
        byteSize = buffer.length;
        base64 = buffer.toString("base64");
        mimeType = blob.type && ALLOWED_TYPES.includes(blob.type) ? blob.type : "application/pdf";
      } else {
        if (!body.base64 || typeof body.base64 !== "string") {
          return NextResponse.json(
            { error: "Missing or invalid 'base64' in JSON body." },
            { status: 400 }
          );
        }
        base64 = body.base64;
        mimeType = (body.mimeType as string) || "application/pdf";
        byteSize = Math.floor((base64.length * 3) / 4);
      }
    } else {
      const formData = await request.formData();
      const file = formData.get("file") ?? formData.get("pdf");
      const toolField = formData.get("tool");
      if (typeof toolField === "string") tool = toolField.slice(0, 40);
      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: "Missing file. Send a PDF or image in FormData under 'file' or 'pdf'." },
          { status: 400 }
        );
      }
      mimeType = file.type || "application/pdf";
      if (!ALLOWED_TYPES.includes(mimeType)) {
        return NextResponse.json(
          { error: "Invalid file type. Only PDF and images (JPEG, PNG, WebP, GIF) are supported." },
          { status: 400 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length === 0) {
        return NextResponse.json(
          { error: "Uploaded file is empty." },
          { status: 400 }
        );
      }
      byteSize = buffer.length;
      base64 = buffer.toString("base64");
    }

    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF and images (JPEG, PNG, WebP, GIF) are supported." },
        { status: 400 }
      );
    }

    // Size gate BEFORE consuming quota: free cap 5MB, paid cap 25MB.
    if (byteSize > FREE_MAX_BYTES) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const paid = user ? await getPaidStatus(user.id) : { isPaid: false };
      if (!paid.isPaid) {
        return NextResponse.json(
          {
            error:
              "Files over 5MB need a paid plan. Get a $2 Week Pass for files up to 25MB.",
            reason: "file_too_large",
          },
          { status: 413 }
        );
      }
      if (byteSize > PAID_MAX_BYTES) {
        return NextResponse.json(
          { error: "File too large. Maximum size is 25MB." },
          { status: 413 }
        );
      }
    }

    // Server-side paywall: the ONLY authoritative quota/credit check.
    // Consumes one unit up front; refunded below if the AI call fails.
    const entitlement = await checkAndConsume();
    if (!entitlement.allowed) {
      return NextResponse.json(
        { error: entitlement.message, reason: entitlement.reason },
        { status: entitlement.status }
      );
    }

    const isPaidExtract =
      entitlement.source === "plan" || entitlement.source === "credits";
    const model = isPaidExtract ? PDF_MODEL_PREMIUM : PDF_MODEL;
    const categorize = isPaidExtract && tool.includes("bank");
    const systemPrompt = categorize
      ? BASE_SYSTEM_PROMPT + CATEGORIZE_APPENDIX
      : BASE_SYSTEM_PROMPT;

    const client = getAnthropic();
    console.log("[Extract API] Using model:", model, "tool:", tool, "paid:", isPaidExtract);

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model,
        max_tokens: 16000,
        system: systemPrompt,
        messages: [
          { role: "user", content: buildContent(mimeType, base64) },
        ],
      });
    } catch (err) {
      await refundExtraction(entitlement);
      await recordExtraction(entitlement, tool, "failed");
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError) {
        console.warn("[Extract API] Anthropic transient error after retries:", err.status, err.message);
        return NextResponse.json(
          { error: "Our AI is currently processing a high volume of documents. Please try again in a few seconds." },
          { status: 503 }
        );
      }
      throw err;
    }

    const responseText = extractText(response);
    if (!responseText.trim()) {
      console.error("[Extract] Empty response. Stop reason:", response.stop_reason);
      await refundExtraction(entitlement);
      await recordExtraction(entitlement, tool, "failed");
      return NextResponse.json(
        { error: "Extraction failed. No content returned." },
        { status: 500 }
      );
    }

    const parsed = parseJsonArrayLoose(responseText);
    if (parsed == null) {
      console.error(
        "[Extract] JSON parse failed. Stop reason:",
        response.stop_reason,
        "Raw (first 500 chars):",
        responseText.slice(0, 500)
      );
      await refundExtraction(entitlement);
      await recordExtraction(entitlement, tool, "failed");
      return NextResponse.json(
        { error: "Extraction failed. Invalid JSON from model." },
        { status: 500 }
      );
    }

    const data = normalizeTo2DArray(parsed);
    await recordExtraction(entitlement, tool, "success");
    console.log("[Extract API] Success, rows:", data.length, "cols:", data[0]?.length ?? 0);
    return NextResponse.json({
      data,
      plan: entitlement.plan,
      source: entitlement.source,
      remaining: entitlement.remaining,
      categorized: categorize,
    });
  } catch (err) {
    console.error("[Extract] Unexpected error:", err);
    return NextResponse.json(
      { error: "Extraction failed. An error occurred while processing the document." },
      { status: 500 }
    );
  }
}
