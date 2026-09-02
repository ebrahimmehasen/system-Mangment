import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the fonts + brand images used by the server-side PDF export
  // so they exist in the serverless function on Vercel.
  outputFileTracingIncludes: {
    "/api/export/reports": [
      "./src/lib/export/fonts/**",
      "./src/lib/export/assets/**",
    ],
  },
};

export default nextConfig;
