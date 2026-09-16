/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // The QR scanner needs the camera; nothing here needs geolocation.
    value: "camera=(self), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    // Pragmatic CSP: Next.js App Router needs inline scripts/styles at runtime.
    // Tighten to nonces only if inline usage is ever eliminated; until then this
    // still blocks foreign scripts, frames, and exfiltration endpoints.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://cloud.appwrite.io https://fra.cloud.appwrite.io",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cloud.appwrite.io" },
      { protocol: "https", hostname: "fra.cloud.appwrite.io" },
      { protocol: "https", hostname: "ui-avatars.com" },
    ],
  },
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Case-only rename app/Blog -> app/blog (Linux/SEO): keep old bookmarks working.
      { source: "/Blog/:path*", destination: "/blog/:path*", permanent: true },
      { source: "/Blog", destination: "/blog", permanent: true },
    ];
  },
};

module.exports = nextConfig;
