// Download all 32 NFL team logos + NFL shield from ESPN CDN.
// Run once: node scripts/fetch-logos.js
// Output: public/logos/{short}.png

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_DIR   = path.join(ROOT, 'public', 'logos')

// Our short code → ESPN CDN slug (lowercase, with exceptions)
const TEAMS = [
  'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE',
  'DAL','DEN','DET','GB', 'HOU','IND','JAX','KC',
  'LV', 'LAC','LAR','MIA','MIN','NE', 'NO', 'NYG',
  'NYJ','PHI','PIT','SF', 'SEA','TB', 'TEN','WAS',
]

// ESPN uses different slugs for a handful of teams
const ESPN_SLUG = {
  WAS: 'wsh',
  GB:  'gb',
}

function espnSlug(short) {
  return (ESPN_SLUG[short] ?? short).toLowerCase()
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'build-a-player/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve, reject)
      }
      resolve(res)
    })
    req.on('error', reject)
    req.setTimeout(20000, () => { req.destroy(new Error('timeout')) })
  })
}

function download(url, dest) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await get(url)
      if (res.statusCode === 404) { res.resume(); return reject(new Error('404')) }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)) }
      const out = fs.createWriteStream(dest)
      res.pipe(out)
      out.on('finish', () => out.close(resolve))
      out.on('error', err => { try { fs.unlinkSync(dest) } catch {} reject(err) })
    } catch (e) { reject(e) }
  })
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const all = [
    { key: 'nfl', url: 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png' },
    ...TEAMS.map(short => ({
      key: short,
      url: `https://a.espncdn.com/i/teamlogos/nfl/500/${espnSlug(short)}.png`,
    })),
  ]

  for (const { key, url } of all) {
    const dest = path.join(OUT_DIR, `${key}.png`)
    if (fs.existsSync(dest)) {
      console.log(`  (cached) ${key}`)
      continue
    }
    try {
      await download(url, dest)
      console.log(`  ✓ ${key}`)
    } catch (e) {
      console.log(`  ✗ ${key} — ${e.message} (${url})`)
    }
  }

  console.log('\nDone → public/logos/')
}

main().catch(err => { console.error(err.message); process.exit(1) })
