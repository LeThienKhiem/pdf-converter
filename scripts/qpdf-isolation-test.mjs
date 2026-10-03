/** Does qpdf-wasm decrypt our RC4-128 fixture, or hang on success? */
import fs from "fs";
import path from "path";

const dir = process.argv[2];
const file = path.join(dir, "statement-3p-locked.pdf");
const bytes = new Uint8Array(fs.readFileSync(file));

const qpdf = await import("@arshad-shah/qpdf-wasm");
qpdf.configure({
  wasmUrl: new URL("../node_modules/@arshad-shah/qpdf-wasm/dist/qpdf.wasm", import.meta.url),
});

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const r = await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT 60s")), 60000)),
    ]);
    console.log(`${label}: OK in ${Date.now() - t0}ms, outBytes=${r?.bytes?.length ?? "?"}`);
    return r;
  } catch (e) {
    console.log(`${label}: ${e?.code ?? e?.name ?? "ERR"} after ${Date.now() - t0}ms — ${e.message}`);
    return null;
  }
}

await timed("wrong password", () => qpdf.decrypt(bytes, "nope"));
await timed("correct password", () => qpdf.decrypt(bytes, "test1234"));
await timed("empty password", () => qpdf.decrypt(bytes, ""));
