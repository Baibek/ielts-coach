import type { NextConfig } from "next";

// Every page in this app is personal (behind login), so we keep the classic
// dynamic rendering model instead of Cache Components.
const nextConfig: NextConfig = {
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
