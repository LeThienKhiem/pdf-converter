"use client";

/**
 * Unlock password-protected bank statements without the password ever leaving
 * the browser.
 *
 * Banks routinely deliver statements as encrypted PDFs keyed to a date of
 * birth, part of an account number, or a customer ID. Until now those simply
 * failed: the extract API got an encrypted file, the model could not read it,
 * and the user saw "An error occurred while processing the document."
 *
 * Why the work happens client-side
 * --------------------------------
 * The password is the key to the user's own bank records. Sending it to our
 * server to decrypt there would mean it lands in a request body, and from
 * there potentially in a log or an error report. Doing it in the browser means
 * we never hold it at all — a promise we can make honestly rather than one
 * that depends on our logging hygiene.
 *
 * Why the output is a rebuilt PDF rather than loose images
 * -------------------------------------------------------
 * Two libraries, neither of which does the whole job:
 *   pdf.js   decrypts and renders, but is read-only — it cannot write a PDF
 *   pdf-lib  writes PDFs, but explicitly does not support encrypted documents
 *            (its own README: "You should not use pdf-lib with encrypted
 *            documents"; `ignoreEncryption` skips the check without decrypting)
 *
 * So pdf.js renders each decrypted page to a JPEG and pdf-lib assembles those
 * into a fresh, unencrypted PDF. The rest of the pipeline — page counting,
 * size gates, the free-tier 10-page slice, the extract call — then runs
 * unchanged, because what it receives is an ordinary PDF.
 *
 * The cost, stated plainly
 * ------------------------
 * The rebuilt PDF carries images, not text. Claude reads it the way it reads
 * any scanned statement, which works well and is the path every scanned upload
 * already takes — but a text PDF converted this way is read less precisely
 * than the same file would have been unprotected. There is no way around it
 * with these two libraries: the one that can decrypt cannot write, and the one
 * that can write cannot decrypt. Server-side decryption with a native tool
 * would keep the text layer, at the cost of holding the user's password.
 */

/** Lazily loaded; pdfjs-dist is large and most uploads never need it. */
async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  // Bundled worker. Resolved through the bundler rather than a CDN so the
  // worker version can never drift from the library version.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  return pdfjs;
}

/**
 * Render at roughly 150 dpi (pdf.js scale 1 is 72 dpi).
 *
 * Chosen against the size cap rather than for maximum fidelity: statements are
 * black text on white, where 150 dpi is comfortably legible, and every extra
 * pixel counts toward the 5 MB free tier that this file has to fit inside.
 */
const RENDER_SCALE = 2.1;
const JPEG_QUALITY = 0.82;

/**
 * Ceiling on pages rendered in the browser. Rendering is synchronous work on
 * the main thread's canvas; a 600-page statement would lock the tab for
 * minutes. Well past anything a real statement needs — a year across three
 * accounts is roughly 100 pages — and the caller reports the overflow rather
 * than silently truncating.
 */
export const MAX_UNLOCK_PAGES = 120;

export type UnlockResult =
  | { ok: true; file: File; pagesRendered: number; pagesTotal: number }
  | { ok: false; reason: "wrong_password" | "too_many_pages" | "failed"; pagesTotal?: number };

/**
 * True when the file is a PDF that cannot be opened without a password.
 *
 * Uses pdf-lib, already a dependency and far smaller than pdfjs — loading
 * `ignoreEncryption: false` throws on an encrypted document, which is exactly
 * the signal we want and costs nothing for the common unprotected case.
 */
export async function isEncryptedPdf(file: File): Promise<boolean> {
  if (file.type !== "application/pdf") return false;
  try {
    const { PDFDocument } = await import("pdf-lib");
    await PDFDocument.load(await file.arrayBuffer());
    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Matched on the message, not the error class. pdf-lib documents an
    // EncryptedPDFError, but what arrives here reports constructor.name
    // "Error" — verified against a real encrypted PDF — so a class check looks
    // authoritative and never fires. Its message is stable and specific:
    // "Input document to `PDFDocument.load` is encrypted".
    //
    // The failure mode if pdf-lib ever reworded it is a password-protected
    // file going undetected and coming back as the old mystery error, not a
    // wrong prompt on a healthy file, so a narrow match is the safe side.
    return /is encrypted|encrypted/i.test(message);
  }
}

/**
 * Decrypt with the supplied password and return an unencrypted PDF.
 *
 * Returns a discriminated result rather than throwing, because "wrong
 * password" is an ordinary outcome the UI re-prompts on, not an exception.
 */
export async function unlockPdf(file: File, password: string): Promise<UnlockResult> {
  let pdfjs: Awaited<ReturnType<typeof loadPdfJs>>;
  try {
    pdfjs = await loadPdfJs();
  } catch {
    return { ok: false, reason: "failed" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // destroy() lives on the loading task in pdf.js v6, not on the document
  // proxy, so the task has to stay in scope for cleanup.
  const task = pdfjs.getDocument({ data: bytes, password });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (err) {
    // pdf.js raises PasswordException for both a wrong password and a missing
    // one. Either way the user needs to try again, so they collapse here.
    const name = err instanceof Error ? err.name : "";
    const message = err instanceof Error ? err.message : String(err);
    if (name === "PasswordException" || /password/i.test(message)) {
      return { ok: false, reason: "wrong_password" };
    }
    return { ok: false, reason: "failed" };
  }

  const pagesTotal = doc.numPages;
  if (pagesTotal > MAX_UNLOCK_PAGES) {
    await task.destroy();
    return { ok: false, reason: "too_many_pages", pagesTotal };
  }

  try {
    const { PDFDocument } = await import("pdf-lib");
    const out = await PDFDocument.create();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, reason: "failed" };

    for (let n = 1; n <= pagesTotal; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      // Statements are black on white; without this the JPEG gets a black
      // background wherever the page is transparent.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      page.cleanup();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
      );
      if (!blob) return { ok: false, reason: "failed" };

      const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const sheet = out.addPage([jpg.width, jpg.height]);
      sheet.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height });
    }

    const rebuilt = await out.save();
    // Cast through ArrayBuffer: pdf-lib returns a Uint8Array whose buffer may
    // be a SharedArrayBuffer type-wise, which BlobPart does not accept.
    const blobPart = rebuilt.buffer.slice(
      rebuilt.byteOffset,
      rebuilt.byteOffset + rebuilt.byteLength
    ) as ArrayBuffer;

    const unlocked = new File(
      [blobPart],
      file.name.replace(/\.pdf$/i, "") + " (unlocked).pdf",
      { type: "application/pdf" }
    );
    return { ok: true, file: unlocked, pagesRendered: pagesTotal, pagesTotal };
  } catch {
    return { ok: false, reason: "failed" };
  } finally {
    await task.destroy();
  }
}
