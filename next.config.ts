import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  // Filesystem-based mail helpers can cause NFT to overtrace build output.
  // Next removes its lock on exit; none of these artifacts belong in functions.
  outputFileTracingExcludes: {
    "/*": [
      "./.next/lock",
      "./.next/cache/**/*",
      "./.next/dev/**/*",
      "./.next/diagnostics/**/*",
      "./.next/types/**/*",
      "./.next/trace",
      "./.next/trace-build",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
