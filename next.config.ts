import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Enables the `"use cache"` directive on its own. Deliberately NOT
  // `cacheComponents: true` — that would also switch the whole app to Cache
  // Components/PPR semantics, which is a much larger change than caching a
  // couple of read-only page queries.
  experimental: { useCache: true },
  // The Supabase (Tokyo, nano) DB can be slow under the build's burst of
  // parallel queries; give static generation room so pages don't hit the 60s
  // default and fail. Per-page, so it's safe well under Vercel's build limit.
  staticPageGenerationTimeout: 300,
  async redirects() {
    // v2 route renames — old URLs must never 404. Explicit 301 (GET-safe
    // permanent) rather than Next's default 308.
    return [
      { source: "/stores", destination: "/tools", statusCode: 301 },
      { source: "/stores/:slug", destination: "/tools/:slug", statusCode: 301 },
      { source: "/coupons", destination: "/deals", statusCode: 301 },
      {
        source: "/how-we-verify",
        destination: "/how-we-review",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
