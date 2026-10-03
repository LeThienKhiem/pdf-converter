import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Browser bundles only — see lib/stubs/node-module.js. qpdf-wasm's
      // Emscripten glue imports Node's `module` inside a branch that never
      // runs in a browser, but the bundler still has to resolve it.
      module: { browser: "./lib/stubs/node-module.js" },
    },
  },
  async redirects() {
    return [
      {
        source: "/blogs/:path*",
        destination: "/blog/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
