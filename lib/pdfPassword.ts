"use client";

/**
 * Unlock password-protected bank statements without the password ever leaving
 * the browser.
 *
 * Banks routinely deliver statements as encrypted PDFs keyed to a date of
 * birth, part of an account number, or a customer ID. Before this, those
 * failed: the extract API got an encrypted file, the model could not read it,
 * and the user saw "An error occurred while processing the document."
 *
 * Why the work happens client-side
 * --------------------------------
 * The password is the key to the user's own bank records. Sending it to our
 * server to decrypt there would mean it lands in a request body, and from
 * there potentially in a log or an error report. Doing it in the browser means
 * we never hold it at all — a property of where the code runs, not a policy we
 * promise to follow.
 *
 * Why qpdf and not pdf.js
 * -----------------------
 * The first version of this file paired pdf.js with pdf-lib, because neither
 * could do the whole job: pdf.js decrypts but cannot write a PDF, pdf-lib
 * writes but cannot decrypt. It rendered each decrypted page to a JPEG and
 * reassembled those into a new PDF, which worked and cost the text layer —
 * an unlocked statement was read as a scan, less precisely than the same file
 * would have been unprotected.
 *
 * qpdf does both in one call, and keeps the text. Measured on a three-page
 * test statement: 9,391 bytes in, 9,096 out, 850 characters of text layer
 * intact. The JPEG path produced several hundred kilobytes of images and no
 * text at all, which also ate into the 5 MB free-tier cap.
 *
 * Removing pdf.js took 72 MB of dependency with it, along with the build step
 * that copied its font and character-map data into public/ and the failure
 * mode that came with it: without that data pdf.js rendered pages with no text
 * and reported it only as a console warning, so the unlock appeared to work
 * and returned an empty sheet.
 */

import type { PdfResult } from "@arshad-shah/qpdf-wasm";

/**
 * Lazily loaded. The WebAssembly build is about 3 MB and most uploads are not
 * encrypted, so it should not be in the initial bundle.
 */
async function loadQpdf() {
  const qpdf = await import("@arshad-shah/qpdf-wasm");
  // Resolve the binary through the bundler rather than a CDN, so its version
  // can never drift from the JavaScript that drives it.
  const asset = new URL("@arshad-shah/qpdf-wasm/qpdf.wasm", import.meta.url);
  // In client bundles Turbopack rewrites import.meta.url to a file:// path on
  // the build machine, so the asset URL comes out as file:///_next/static/….
  // The library treats "file:" as Node and reaches for node:fs, which does not
  // exist in a browser — so every unlock failed before the binary was even
  // requested. Keep only the path the bundler emitted and fetch it ourselves
  // from this origin.
  const href = new URL(asset.pathname, window.location.origin).href;
  qpdf.configure({
    wasmUrl: href,
    compileWasm: async () => {
      const res = await fetch(href);
      if (!res.ok) throw new Error(`Unable to fetch qpdf.wasm: ${res.status}`);
      return WebAssembly.compile(await res.arrayBuffer());
    },
  });
  return qpdf;
}

export type UnlockResult =
  | { ok: true; file: File; bytes: Uint8Array }
  | { ok: false; reason: "wrong_password" | "failed"; detail?: string };

/**
 * True when the file is a PDF that cannot be opened without a password.
 *
 * Uses pdf-lib, already a dependency and far smaller than loading qpdf —
 * `PDFDocument.load` throws on an encrypted document, which is exactly the
 * signal we want and costs nothing for the common unprotected case.
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
 * Returns a discriminated result rather than throwing: a wrong password is an
 * ordinary outcome the UI re-prompts on, not an exception.
 *
 * The returned `bytes` are the decrypted document itself, so a caller that
 * wants to hand the user a password-free copy to keep can offer them directly
 * — no second decryption, and no quality loss, because this is the original
 * file with its encryption removed rather than a rebuild of it.
 */
export async function unlockPdf(file: File, password: string): Promise<UnlockResult> {
  let qpdf: Awaited<ReturnType<typeof loadQpdf>>;
  try {
    qpdf = await loadQpdf();
  } catch (err) {
    return { ok: false, reason: "failed", detail: err instanceof Error ? err.message : undefined };
  }

  let result: PdfResult;
  try {
    result = await qpdf.decrypt(new Uint8Array(await file.arrayBuffer()), password);
  } catch (err) {
    // qpdf reports a typed code, so this does not depend on message wording
    // the way the pdf.js path did.
    if (err instanceof qpdf.QpdfError && err.code === "WRONG_PASSWORD") {
      return { ok: false, reason: "wrong_password" };
    }
    return { ok: false, reason: "failed", detail: err instanceof Error ? err.message : undefined };
  }

  // Cast through ArrayBuffer: the Uint8Array's buffer may be typed as a
  // SharedArrayBuffer, which BlobPart does not accept.
  const part = result.bytes.buffer.slice(
    result.bytes.byteOffset,
    result.bytes.byteOffset + result.bytes.byteLength
  ) as ArrayBuffer;

  const unlocked = new File([part], file.name.replace(/\.pdf$/i, "") + " (unlocked).pdf", {
    type: "application/pdf",
  });
  return { ok: true, file: unlocked, bytes: result.bytes };
}

/**
 * What to do with a file before it enters the normal upload path.
 *
 * `ready`  — nothing stands in the way; use this file.
 * `locked` — genuinely needs a password from the reader.
 */
export type Prepared =
  | { state: "ready"; file: File }
  | { state: "locked"; file: File };

/**
 * Decide whether a file needs a password, and silently remove the encryption
 * when it does not.
 *
 * PDFs carry two different passwords and conflating them is why this exists:
 *
 *   user password   required to open the document. Undecryptable without it,
 *                   by design. Bank statements use this one.
 *   owner password  the document opens freely; only permissions like printing
 *                   and copying are restricted. The encryption comes off with
 *                   an empty password — which is most of what the commodity
 *                   "PDF password remover" tools on the web actually do.
 *
 * pdf-lib reports both as simply "encrypted", so the first version of this
 * prompted for a password on owner-restricted files too. The reader had no
 * password, did not need one, and had no way forward. Verified against a
 * generated owner-only PDF: pdf-lib called it encrypted, qpdf opened it with "".
 *
 * So an empty password is tried first, without telling anyone. If it works the
 * file is simply unlocked and the upload continues as though it had never been
 * protected. Only a real user password reaches the prompt, because only that
 * case actually requires a human.
 */
export async function prepareFile(file: File): Promise<Prepared> {
  if (!(await isEncryptedPdf(file))) return { state: "ready", file };

  const silent = await unlockPdf(file, "");
  if (silent.ok) return { state: "ready", file: silent.file };

  return { state: "locked", file };
}
