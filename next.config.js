/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'cloud.appwrite.io' },
      { protocol: 'https', hostname: 'fra.cloud.appwrite.io' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
  typescript: {
    tsconfigPath: './tsconfig.json'
  },
};

module.exports = nextConfig;
