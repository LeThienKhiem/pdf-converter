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

/**
 * Split a PDF into up to `maxParts` contiguous slices of about `partPages`
 * pages each, so they can be extracted in parallel. Model time grows with
 * the rows it has to write, so two 5-page calls side by side finish in
 * roughly half the time of one 10-page call.
 *
 * Returns the original base64 as a single part when the PDF is short or
 * can't be parsed (encrypted/corrupt).
 */
export async function splitPdfBase64(base64: string, partPages: number, maxParts: number): Promise<string[]> {
  try {
    const doc = await PDFDocument.load(Buffer.from(base64, "base64"), { ignoreEncryption: true });
    const pageCount = doc.getPageCount();
    const parts = Math.min(maxParts, Math.ceil(pageCount / partPages));
    if (parts <= 1) return [base64];
    const size = Math.ceil(pageCount / parts);
    const out: string[] = [];
    for (let start = 0; start < pageCount; start += size) {
      const part = await PDFDocument.create();
      const indices = Array.from({ length: Math.min(size, pageCount - start) }, (_, i) => start + i);
      for (const p of await part.copyPages(doc, indices)) part.addPage(p);
      out.push(Buffer.from(await part.save()).toString("base64"));
    }
    return out;
  } catch (err) {
    console.warn("[pdfPages] Could not split PDF:", err instanceof Error ? err.message : err);
    return [base64];
  }
}
