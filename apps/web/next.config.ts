import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@maplab/ui', '@maplab/ecu-parser-wasm'],
  experimental: {},
  webpack: (config, { isServer }) => {
    // WASM-Dateien als Asset laden statt durch regulären Webpack-Loader
    config.experiments = { ...config.experiments, asyncWebAssembly: true }

    // Web Worker: next.js erkennt `new Worker(new URL(..., import.meta.url))` automatisch
    // Kein zusätzlicher Loader nötig – webpack 5 bundlet Workers nativ

    if (isServer) {
      // Node.js kennt WebAssembly.instantiateStreaming nicht in jedem Kontext –
      // WASM-Imports auf dem Server als externals markieren
      config.externals = [...(config.externals as string[]), '@maplab/ecu-parser-wasm']
    }

    return config
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
