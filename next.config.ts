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
  experimental: {
    serverActions: {
      // Next's Server Action request body defaults to 1MB — well under our
      // own 10MB file-upload limits (project files, employee CVs, target-
      // client report attachments all go through Server Actions, not API
      // routes), so anything past ~1MB was hitting Next's own guard before
      // our action code ever ran, surfacing as the generic error boundary
      // instead of our "حجم الملف يتجاوز الحد المسموح" message. 15mb leaves
      // headroom above the 10MB limit for multipart overhead.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
