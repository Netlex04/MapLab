import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@maplab/ui'],
  experimental: {
    // Für WASM-Support in Phase 2
    // webpackBuildWorker: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'files.maplab.app',
      },
    ],
  },
}

export default nextConfig
