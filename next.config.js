/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'images.unsplash.com',
      'cloud.appwrite.io',
      'fra.cloud.appwrite.io'
    ],
    unoptimized: process.env.NODE_ENV === 'production' ? false : true
  },
  typescript: {
    tsconfigPath: './tsconfig.json'
  },
  swcMinify: true,
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  }
};

module.exports = nextConfig;
