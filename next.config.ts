import type { NextConfig } from "next";

// Sent on every response (security audit 2026-11-07). frame-ancestors stops other sites from
// framing admin buttons (clickjacking); a full script CSP waits for the inline backdrop script and
// the demo parser's WASM to get nonces.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    // Steam avatars are rendered as-is to stay clear of Vercel Hobby image quotas. Turning the
    // optimizer off globally also removes the /_next/image endpoint and its attack surface.
    unoptimized: true,
    remotePatterns: [new URL("https://avatars.steamstatic.com/**")],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
