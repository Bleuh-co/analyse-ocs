import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Le SDK Gandalf est publié en sources TypeScript (exports → src/*.ts) :
  // indispensable pour que Turbopack (défaut Next 16) le transpile.
  transpilePackages: ["@bleuh-co/gandalf-sdk-next"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
