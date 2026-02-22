import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "googleapis";

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

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const NEW_SPREADSHEET_TITLE = "Extracted Data - InvoiceToData";

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

function toSheetsValues(rows: (string | null)[][]): string[][] {
  return rows.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") ?? formData.get("pdf");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file. Please upload a PDF." },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported for this tool." },
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
        { error: "File too large. Please upload a PDF under 5MB." },
        { status: 413 }
      );
    }

    const base64 = buffer.toString("base64");

    // --- (a) AI Extraction (Gemini) → string[][] ---
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing GEMINI_API_KEY configuration." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-lite-latest",
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64,
        },
      },
    ]);

    const response = result.response;
    if (!response) {
      return NextResponse.json(
        { error: "Extraction failed. No response from AI." },
        { status: 500 }
      );
    }

    let responseText: string;
    try {
      responseText = response.text();
    } catch {
      return NextResponse.json(
        { error: "Extraction failed. Response was blocked or empty." },
        { status: 500 }
      );
    }

    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    if (!cleanJson) {
      return NextResponse.json(
        { error: "Extraction failed. No content returned from AI." },
        { status: 500 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      return NextResponse.json(
        { error: "Extraction failed. Invalid AI output." },
        { status: 500 }
      );
    }

    const data = normalizeTo2DArray(parsed);
    const values = toSheetsValues(data);
    if (values.length === 0) {
      return NextResponse.json(
        { error: "No data was extracted from the PDF." },
        { status: 400 }
      );
    }

    // --- OAuth2 + Sheets + Drive ---
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json(
        { error: "Server is missing Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)." },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GOOGLE_REDIRECT_URI ?? "https://developers.google.com/oauthplayground"
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // --- (b) Create a brand new spreadsheet ---
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: NEW_SPREADSHEET_TITLE },
      },
    });

    const spreadsheetId = createRes.data.spreadsheetId;
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Failed to create spreadsheet." },
        { status: 500 }
      );
    }

    // --- (c) Append extracted data to Sheet1!A1 ---
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    // --- (d) Format header row: bold + light blue ---
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const firstSheetId = spreadsheet.data.sheets?.[0]?.properties?.sheetId ?? 0;
    const endColumnIndex = Math.max(26, values[0]?.length ?? 26);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: firstSheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 227 / 255, green: 242 / 255, blue: 253 / 255 },
                  textFormat: { bold: true },
                },
              },
              fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat",
            },
          },
        ],
      },
    });

    // --- (e) Set permission: anyone with the link can view (so they can Make a Copy) ---
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // --- (f) Copy URL (opens Google's "Make a copy" flow in a new tab) ---
    const copyUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/copy`;

    return NextResponse.json({ success: true, copyUrl, message: "Your sheet is ready. Make a copy to save it to your Drive." });
  } catch (err) {
    console.error("[GSheet API] Error:", err);
    const message = err instanceof Error ? err.message : "An error occurred while creating your Google Sheet.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
