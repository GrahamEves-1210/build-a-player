// One-time: ESPN headshots for the post-2000 players on the football GOAT lists
// (data/nfl-goat.js) who didn't have one yet. ESPN's own player photos only (no
// Wikipedia), the same source and crop as the other espn_ headshots.
// node scripts/fetch-goat-nfl-headshots.mjs        then npm run build (→ webp)

import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NFL_GOAT } from '../src/data/nfl-goat.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'headshots')
const MAP = path.join(ROOT, 'src', 'data', 'headshots.json')
const headshots = JSON.parse(fs.readFileSync(MAP, 'utf8'))

const get = (url, asBuffer = false) => new Promise((resolve, reject) => {
  const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return get(res.headers.location, asBuffer).then(resolve, reject)
    const chunks = []
    res.on('data', c => chunks.push(c))
    res.on('end', () => resolve({ status: res.statusCode, body: asBuffer ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8') }))
  })
  req.on('error', reject)
  req.setTimeout(15000, () => req.destroy(new Error('timeout')))
})

// the players who need one: played in 2000 or later, and no photo on disk
const hasFile = id => id && ['webp', 'jpg', 'png'].some(ext => fs.existsSync(path.join(OUT, id.includes('.') ? id : `${id}.${ext}`)))
const want = Object.values(NFL_GOAT).flat().filter(g => {
  const last = g.years.split('–')[1]
  return (last ? +last : 2026) >= 2000 && !hasFile(headshots[g.name])
})

const report = []
for (const g of want) {
  const q = encodeURIComponent(g.name)
  const { status, body } = await get(`https://site.api.espn.com/apis/search/v2?query=${q}&limit=10`)
  if (status !== 200) { report.push(`✗ ${g.name}: search HTTP ${status}`); continue }
  const players = (JSON.parse(body).results ?? []).find(r => r.type === 'player')?.contents ?? []
  // an NFL player with this exact name (the search also returns other sports)
  const hit = players.find(p => p.description === 'NFL' && p.displayName.toLowerCase() === g.name.toLowerCase())
    ?? players.find(p => p.description === 'NFL')
  const id = hit?.uid?.match(/~a:(\d+)/)?.[1]
  if (!id) { report.push(`✗ ${g.name}: no NFL player found`); continue }
  const url = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${id}.png&w=350&h=254&scale=crop`
  const img = await get(url, true)
  // ESPN answers a missing photo with an error or a tiny placeholder: keep real photos only
  if (img.status !== 200 || img.body.length < 6000) { report.push(`✗ ${g.name} (espn ${id}): no photo (HTTP ${img.status}, ${img.body.length} bytes)`); continue }
  fs.writeFileSync(path.join(OUT, `espn_${id}.jpg`), img.body)
  headshots[g.name] = `espn_${id}`
  report.push(`✓ ${g.name} → espn_${id} (${hit.displayName}, ${hit.subtitle ?? ''}, ${Math.round(img.body.length / 1024)} KB)`)
}
fs.writeFileSync(MAP, JSON.stringify(headshots, null, 2) + '\n')
console.log(report.join('\n'))
console.log(`${report.filter(r => r.startsWith('✓')).length} of ${want.length} found. Run npm run build to convert to webp.`)
