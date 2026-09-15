import type { NextConfig } from "next";
import { cloudinaryName } from "./lib/image-sources";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: 4_200_000 } },
  images: {
    remotePatterns: [
      ...(process.env.IMAGE_HOST
        ? [
            {
              protocol: "https" as const,
              hostname: process.env.IMAGE_HOST,
              port: "",
              pathname: "/**",
            },
          ]
        : []),
      ...(cloudinaryName()
        ? [
            {
              protocol: "https" as const,
              hostname: "res.cloudinary.com",
              port: "",
              pathname: `/${cloudinaryName()}/image/upload/**`,
              search: "",
            },
          ]
        : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
