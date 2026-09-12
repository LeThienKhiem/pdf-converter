import { PDFDocument } from "pdf-lib";

/**
 * Free-tier page gating: count a PDF's pages and, when it exceeds the free
 * limit, slice off the first N pages to send to the model. The user gets a
 * real result for the first 10 pages (best-effort marketing) plus an upsell
 * to unlock the rest — instead of an error or a silent partial.
 *
 * Returns null when the buffer can't be parsed (encrypted/corrupt PDFs) —
 * callers fall back to sending the original file untouched.
 */
export async function analyzePdfPages(
  buffer: Buffer,
  maxPages: number
): Promise<{ pageCount: number; slicedBase64: string | null } | null> {
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pageCount = doc.getPageCount();
    if (pageCount <= maxPages) {
      return { pageCount, slicedBase64: null };
    }
    const sliced = await PDFDocument.create();
    const indices = Array.from({ length: maxPages }, (_, i) => i);
    const pages = await sliced.copyPages(doc, indices);
    for (const p of pages) sliced.addPage(p);
    const bytes = await sliced.save();
    return { pageCount, slicedBase64: Buffer.from(bytes).toString("base64") };
  } catch (err) {
    console.warn("[pdfPages] Could not parse PDF for page gating:", err instanceof Error ? err.message : err);
    return null;
  }
}
