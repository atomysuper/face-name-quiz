import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['*.replit.dev', '*.replit.app', '*.janeway.replit.dev'],
};

export default nextConfig;
