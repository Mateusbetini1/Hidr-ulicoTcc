import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return ['/login', '/sistema/:path*', '/api/auth/:path*', '/api/painel/:path*'].map((source) => ({
      source,
      headers: [
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'Cloudflare-CDN-Cache-Control', value: 'no-store' },
      ],
    }));
  },
};

export default nextConfig;
