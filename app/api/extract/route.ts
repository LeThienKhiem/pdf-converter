import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PDF_MODEL, extractText, getAnthropic, parseJsonArrayLoose } from "@/lib/anthropic";

const SYSTEM_PROMPT = `You are a Visual-to-Excel copier. Analyze the document as a visual grid and reproduce its exact layout.

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

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB – no temp storage; buffer used only for base64 then discarded

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

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { base64?: string; mimeType?: string };
      if (!body.base64 || typeof body.base64 !== "string") {
        return NextResponse.json(
          { error: "Missing or invalid 'base64' in JSON body." },
          { status: 400 }
        );
      }
      base64 = body.base64;
      mimeType = (body.mimeType as string) || "application/pdf";
      const estimatedSize = Math.floor((base64.length * 3) / 4);
      if (estimatedSize > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: "File too large. Please upload a PDF under 5MB for faster processing." },
          { status: 413 }
        );
      }
    } else {
      const formData = await request.formData();
      const file = formData.get("file") ?? formData.get("pdf");
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
      if (buffer.length > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: "File too large. Please upload a PDF under 5MB for faster processing." },
          { status: 413 }
        );
      }
      base64 = buffer.toString("base64");
    }

    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF and images (JPEG, PNG, WebP, GIF) are supported." },
        { status: 400 }
      );
    }

    const client = getAnthropic();
    console.log("[Extract API] Using model:", PDF_MODEL);

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: PDF_MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildContent(mimeType, base64) },
        ],
      });
    } catch (err) {
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
      return NextResponse.json(
        { error: "Extraction failed. Invalid JSON from model." },
        { status: 500 }
      );
    }

    const data = normalizeTo2DArray(parsed);
    console.log("[Extract API] Success, rows:", data.length, "cols:", data[0]?.length ?? 0);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[Extract] Unexpected error:", err);
    return NextResponse.json(
      { error: "Extraction failed. An error occurred while processing the document." },
      { status: 500 }
    );
  }
}
