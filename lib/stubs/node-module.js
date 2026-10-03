/**
 * Empty stand-in for Node's `module`, aliased in for browser bundles only.
 *
 * The qpdf-wasm Emscripten glue contains a Node branch:
 *
 *   if (ENVIRONMENT_IS_NODE) { const { createRequire } = await import("module") }
 *
 * That branch never runs in a browser, but Turbopack still has to resolve the
 * specifier while bundling and fails with "Can't resolve 'module'". Aliasing it
 * to this file under the `browser` condition satisfies the bundler without
 * touching server code, which still gets the real built-in.
 *
 * If anything ever does call createRequire here, it should fail loudly rather
 * than return something half-working.
 */
export function createRequire() {
  throw new Error("createRequire is not available in the browser");
}

export default {};
