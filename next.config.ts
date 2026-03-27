import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    minimumCacheTTL: 60 * 60 * 24,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "dimg04.c-ctrip.com"
      },
      {
        protocol: "https",
        hostname: "www.sxhm.com"
      }
    ]
  }
};

export default nextConfig;
