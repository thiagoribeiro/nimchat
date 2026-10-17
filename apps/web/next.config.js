/** @type {import('next').NextConfig} */
const nextConfig = {
  // @nimchat/sdk is a workspace package whose entry point is raw TypeScript (no
  // build step of its own) — Next needs to be told to run it through its own
  // transform instead of treating it like a pre-built node_modules dependency.
  transpilePackages: ["@nimchat/sdk", "@nimchat/brian", "@nimchat/i18n", "@radix-ui/react-collection"],
  // Emits a minimal, self-contained server (.next/standalone) with only the deps actually
  // reachable at runtime traced in — keeps the Docker image small instead of shipping the
  // whole monorepo's node_modules.
  output: "standalone",
  async headers() {
    return [
      {
        // Tell Cloudflare (and any other transforming proxy) not to re-minify this — it's
        // already minified, and re-minifying already-minified output is what corrupted
        // emoji-mart's bundle in production (confirmed: content fetched directly from
        // the origin vs. through a Cloudflare tunnel differed by ~3.5KB on this exact chunk).
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable, no-transform" }],
      },
    ];
  },
};

module.exports = nextConfig;
