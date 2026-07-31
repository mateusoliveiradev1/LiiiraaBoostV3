import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig = {
  output: "standalone",
  typedRoutes: true,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
} satisfies NextConfig;

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
