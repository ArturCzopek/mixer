import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Steam avatars; rendered `unoptimized` to stay clear of Vercel Hobby image quotas.
    remotePatterns: [new URL("https://avatars.steamstatic.com/**")],
  },
};

export default nextConfig;
