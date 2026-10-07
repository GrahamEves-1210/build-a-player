import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// When each ratings pool last changed, read from git at build time, so the
// Wiki's "ratings as of" dates follow the data files without anyone editing a
// date. Where git history isn't available (shallow deploy clones) the latest
// commit date or the build date is used instead.
const today = new Date().toISOString().slice(0, 10)
function lastChanged(files) {
  try {
    const out = execSync(`git log -1 --format=%cs -- ${files.join(' ')}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return out || today
  } catch {
    return today
  }
}
const d = 'src/data/'
const RATINGS_DATES = {
  qb:    lastChanged([d + 'qbs.js', d + 'qb-legends.js']),
  rb:    lastChanged([d + 'rbs.js', d + 'rb-legends.js']),
  wr:    lastChanged([d + 'wrs.js', d + 'wr-legends.js']),
  te:    lastChanged([d + 'tes.js', d + 'te-legends.js']),
  db:    lastChanged([d + 'dbs.js', d + 'db-legends.js']),
  guard: lastChanged([d + 'nba-guards.js', d + 'nba-guard-legends.js']),
  big:   lastChanged([d + 'nba-bigs.js', d + 'nba-big-legends.js']),
}
RATINGS_DATES.all = Object.values(RATINGS_DATES).sort().slice(-1)[0]

export default defineConfig({
  define: {
    __RATINGS_DATES__: JSON.stringify(RATINGS_DATES),
    __BUILD_DATE__: JSON.stringify(today),
  },
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
  ],
})
