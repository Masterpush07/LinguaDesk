import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false, // do not advertise the framework in every response
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The original single-shop pages are retired: Lotus Handloom is now a normal shop on the platform.
  async redirects() {
    return [
      { source: "/chat", destination: "/chat/lotus-handloom", permanent: false },
      { source: "/owner", destination: "/login", permanent: false },
      { source: "/owner/:path*", destination: "/login", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" }, // nobody should be able to frame the owner login
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" }, // the microphone is needed for voice messages on this site only
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // A script-src policy needs per-request nonces, which this app's prerendered pages do not have yet; these directives are safe without one.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, // browsers must always see a new service worker
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
