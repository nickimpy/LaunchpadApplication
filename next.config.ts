import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The parent form (Step 2) posts a canvas signature as a base64 PNG.
      // A real signature compresses to tens of KB, so the 1mb default is
      // already plenty — this just makes the ceiling an explicit decision
      // instead of an unstated default a parent could hit mid-signature.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
