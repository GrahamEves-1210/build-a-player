import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { isClean } from './scripts/clean-flag.mjs'
import { cleanHtml } from './scripts/clean-html.mjs'

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
  dl:    lastChanged([d + 'dls.js', d + 'dl-legends.js']),
  lb:    lastChanged([d + 'lbs.js', d + 'lb-legends.js']),
  ol:    lastChanged([d + 'ols.js', d + 'ol-legends.js']),
  k:     lastChanged([d + 'ks.js', d + 'k-legends.js']),
  guard: lastChanged([d + 'nba-guards.js', d + 'nba-guard-legends.js']),
  big:   lastChanged([d + 'nba-bigs.js', d + 'nba-big-legends.js']),
}
RATINGS_DATES.all = Object.values(RATINGS_DATES).sort().slice(-1)[0]
// soccer's strikers (the wiki's table shows them once soccer is on); not in `all` while it's off
RATINGS_DATES.st = lastChanged([d + 'soccer-strikers.js', d + 'soccer-legends.js'])

export default defineConfig(({ mode }) => {
// the clean build (scripts/clean-flag.mjs): off for main and app, on for app-clean / VITE_CLEAN=1 (shell or .env file)
const CLEAN = isClean(loadEnv(mode, process.cwd(), ''))
// each folder (the main checkout, every worktree: their node_modules are links to the same one) and each mode/flag
// gets its own pre-bundle cache. One shared cache had the dev servers re-optimizing over each other forever
const cacheTag = createHash('md5').update(`${process.cwd()}|${mode}|${CLEAN}`).digest('hex').slice(0, 8)
return {
  cacheDir: `node_modules/.vite-${cacheTag}`,
  // (the dependency scan starts from the site's own page only: the native app folders hold a copy of a whole build,
  // ios/ and android/, and scanning those had the dev server hang for minutes on its first page)
  optimizeDeps: { entries: ['index.html'] },
  define: {
    __CLEAN__: JSON.stringify(CLEAN),
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
    // The iOS/Android build (npm run build:app) ships without Ramp's web ad
    // script — web ad units don't serve inside an app. In-app ads come from
    // Playwire's app SDK instead.
    mode === 'app' && {
      name: 'strip-web-ads',
      transformIndexHtml: html => html.replace(/\s*<script[^>]*ramp\.js[^>]*><\/script>/, ''),
    },
    // the clean build: the page's own words (title, descriptions, structured data) without the leagues' marks
    CLEAN && {
      name: 'clean-html',
      transformIndexHtml: { order: 'post', handler: html => cleanHtml(html) },
    },
  ].filter(Boolean),
}
})
