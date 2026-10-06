import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/data/wrs.js'))                  return 'data-wrs'
          if (id.includes('/data/nba-players.js'))          return 'data-nba'
          if (id.includes('/data/qbs.js'))                  return 'data-qbs'
          if (id.includes('/data/depth-chart-players.js'))  return 'data-dcp'
          if (id.includes('/data/headshots.json'))          return 'data-headshots'
          if (id.includes('react-dom') || id.includes('react/'))  return 'vendor-react'
          if (id.includes('@supabase'))                     return 'vendor-supabase'
          if (id.includes('html2canvas'))                   return 'vendor-html2canvas'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  plugins: [
    react(),
    // The iOS/Android build (npm run build:app) ships without Ramp's web ad
    // script — web ad units don't serve inside an app. In-app ads come from
    // Playwire's app SDK instead.
    mode === 'app' && {
      name: 'strip-web-ads',
      transformIndexHtml: html => html.replace(/\s*<script[^>]*ramp\.js[^>]*><\/script>/, ''),
    },
  ].filter(Boolean),
}))
