/** @type {import('next').NextConfig} */
const nextConfig = {
  // ssh2 ships optional native add-ons; keep it out of the webpack bundle (it is loaded at runtime on the server).
  experimental: { serverComponentsExternalPackages: ['ssh2'] },
  images: {
    domains: ['images.unsplash.com', 'avatars.githubusercontent.com'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
