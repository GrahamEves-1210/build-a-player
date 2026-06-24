import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'qb-silhouette.png', 'logos/**', 'headshots/**'],
      manifest: {
        name: 'Build-A-Player',
        short_name: 'Build-A-Player',
        description: 'Spin the wheel, build your Frankenstein QB, simulate the season.',
        start_url: '/',
        display: 'standalone',
        background_color: '#090a0d',
        theme_color: '#090a0d',
        orientation: 'portrait',
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,json}'],
        runtimeCaching: [
          {
            urlPattern: /\/logos\/.+\.png$/,
            handler: 'CacheFirst',
            options: { cacheName: 'logos', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /\/headshots\/.+\.jpg$/,
            handler: 'CacheFirst',
            options: { cacheName: 'headshots', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
})
