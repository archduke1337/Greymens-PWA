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
      "connect-src 'self' https://cloud.appwrite.io https://fra.cloud.appwrite.io https://api.emailjs.com",
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
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // NOTE: `api.bodyParser.sizeLimit` only applies to the Pages Router
  // (/pages/api). These uploads are App Router route handlers; the real
  // request-body ceiling on Vercel is ~4.5 MB, which is why every upload
  // path prefers browser → Storage direct upload with a tiny JSON fileId
  // adoption (FormData proxy remains only as a ≤4.5 MB fallback).
  // Kept for any future Pages handlers; harmless otherwise.
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
  // NOTE: no case-variant redirects (e.g. /Blog -> /blog). Next.js matches
  // redirect sources case-insensitively, so "/Blog/:path*" also matches the
  // correct lowercase "/blog" with an empty :path* — producing destination
  // "/blog/" and a fatal /blog <-> /blog/ ping-pong with the platform's
  // trailing-slash normalization (ERR_TOO_MANY_REDIRECTS in production).
  // A wrong-case URL simply falls through to the 404 page.
};

module.exports = nextConfig;
