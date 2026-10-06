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
    // The iOS/Android build (npm run build:app):
    //  - ships without Ramp's web ad script — web ad units don't serve inside
    //    an app. In-app ads come from Playwire's app SDK instead.
    //  - drops viewport-fit=cover, so the page sits below the status bar /
    //    notch and above the home bar, exactly where it sits in Safari
    //    (the strips around it show the app's dark background).
    mode === 'app' && {
      name: 'app-html',
      transformIndexHtml: html => html
        .replace(/\s*<script[^>]*ramp\.js[^>]*><\/script>/, '')
        .replace(', viewport-fit=cover', ''),
    },
  ].filter(Boolean),
}))
