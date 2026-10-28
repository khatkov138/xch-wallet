import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['chia-wallet-lib', 'clvm-lib', 'chia-bls'],
  /* config options here */
  experimental: {
    agentFeedback: true,
    
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
