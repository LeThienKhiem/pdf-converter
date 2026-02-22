import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

**Output Format**
- Return ONLY a 2D JSON array: Array<Array<string | null>>.
- Example: [ ["Part I", "All Filers", null], ["1", "Tax Year", "2024"], ["2", "Name", "John Doe"] ]
- Each inner array is one row; each element is one cell (string or null).
- No markdown backticks, no 'json' prefix.
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

export async function POST(request: Request) {
  console.log("[Extract API] POST /api/extract called");
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[Extract] GEMINI_API_KEY is not set");
      return NextResponse.json(
        { error: "Server is missing GEMINI_API_KEY configuration." },
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = "gemini-flash-lite-latest";
    console.log("[Extract API] Using model:", modelName);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
    ]);

    const response = result.response;
    if (!response) {
      console.error("[Extract] No response from model");
      return NextResponse.json(
        { error: "Extraction failed. No response from model." },
        { status: 500 }
      );
    }

    let responseText: string;
    try {
      responseText = response.text();
    } catch (blockErr) {
      const message = blockErr instanceof Error ? blockErr.message : "Response blocked or empty";
      console.error("[Extract] response.text() failed:", message);
      return NextResponse.json(
        { error: "Extraction failed. Response was blocked or empty." },
        { status: 500 }
      );
    }

    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    if (!cleanJson) {
      console.error("[Extract] Empty content after cleaning. Raw length:", responseText?.length ?? 0);
      return NextResponse.json(
        { error: "Extraction failed. No content returned." },
        { status: 500 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error("[Extract] JSON parse error:", parseErr);
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
