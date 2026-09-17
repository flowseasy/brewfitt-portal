import type { NextConfig } from "next";

// Phase 1 is a static export (no server runtime) so it can be hosted on
// Catalyst Web Client Hosting in Phase 2. Detail pages use ?id= query routes
// because records created at runtime cannot be pre-rendered (CLAUDE.md, decision 1).
const nextConfig: NextConfig = {
  // Lets a production build run alongside `next dev` without sharing its cache.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
