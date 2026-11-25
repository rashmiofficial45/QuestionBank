import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
};
export default config;
