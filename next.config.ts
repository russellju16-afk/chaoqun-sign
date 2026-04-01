import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Standalone output for Docker deployment
  output: "standalone",

  // Security headers on all routes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Image optimization
  images: {
    // Aliyun OSS domain for signature images
    remotePatterns: [
      {
        protocol: "https",
        hostname: "chaoqun-sign.oss-cn-xian.aliyuncs.com",
        port: "",
        pathname: "/**",
      },
    ],
    // Disable built-in optimizer when using OSS signed URLs directly
    unoptimized: false,
  },

  // Logging verbosity
  logging: {
    fetches: {
      fullUrl: isDev,
    },
  },

  // Experimental — keep turbopack for dev
  experimental: {
    optimizePackageImports: ["ioredis", "@prisma/client"],
  },
};

export default nextConfig;
