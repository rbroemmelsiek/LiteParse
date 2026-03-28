import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@llamaindex/liteparse"],
  typescript: {
    ignoreBuildErrors: true, 
  }
};

export default nextConfig;
