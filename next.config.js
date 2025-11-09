/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'images.unsplash.com',
      'cloud.appwrite.io',
      'fra.cloud.appwrite.io'
    ],
    unoptimized: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  swcMinify: true,
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  }
};

module.exports = nextConfig;
