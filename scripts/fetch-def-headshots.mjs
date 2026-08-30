// One-time: download 6 defensive player headshots from ESPN CDN
// node scripts/fetch-def-headshots.mjs

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'headshots')
fs.mkdirSync(OUT, { recursive: true })

const PLAYERS = [
  ['4372012', 'Pat Surtain II'],
  ['4686772', 'Christian Gonzalez'],
  ['4575517', 'Kyle Hamilton'],
  ['3138826', 'Fred Warner'],
  ['3915189', 'Roquan Smith'],
  ['4569465', 'Jack Campbell'],
]

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve, reject)
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)) }
      const out = fs.createWriteStream(dest)
      res.pipe(out)
      out.on('finish', () => out.close(resolve))
      out.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(new Error('timeout')) })
  })
}

for (const [espnId, name] of PLAYERS) {
  const dest = path.join(OUT, `espn_${espnId}.jpg`)
  if (fs.existsSync(dest)) { console.log(`(cached) ${name}`); continue }
  const url = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espnId}.png&w=350&h=254&scale=crop`
  try {
    await download(url, dest)
    console.log(`✓ ${name} → espn_${espnId}.jpg`)
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`)
  }
}
console.log('Done. Run npm run build to convert to webp.')
