// Baseball assets, ESPN only (the owner's rule: no Wikipedia, no other sources; initials beat a bad photo).
//   Club logos  -> public/logos/mlb/{short}.png   (ESPN MLB team logo, the 500px default, saved as ESPN serves it)
//   Headshots   -> public/headshots/mlb/{espnId}.webp  (ESPN MLB player headshot, webp q75 like the other headshots;
//                  ESPN's MLB ids are their own id space, so they live in their own folder and can't collide with
//                  public/headshots/*.webp, nba/ or soccer/)
//   Map         -> src/data/mlb-headshots.json  { "<ESPN player id>": "mlb/<id>.webp" }
//
// Players: every row in mlb-batters.js, mlb-pitchers.js, mlb-legend-batters.js and mlb-legend-pitchers.js with an espn id.
// Safe to re-run: existing files are never overwritten or re-encoded (delete one by hand to refetch it).
// Every headshot was looked at before it went in the map; SKIP lists the ones left on initials (not a clean studio
// headshot, a much older or odd photo, or the wrong person).
// node scripts/fetch-mlb-assets.mjs            (add --dry to only report what it would fetch)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { MLB_TEAMS } from '../src/data/mlb-teams.js'
import { MLB_BATTERS } from '../src/data/mlb-batters.js'
import { MLB_PITCHERS } from '../src/data/mlb-pitchers.js'
import { MLB_LEGEND_BATTERS } from '../src/data/mlb-legend-batters.js'
import { MLB_LEGEND_PITCHERS } from '../src/data/mlb-legend-pitchers.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUB = path.join(ROOT, 'public')
const LOGOS = path.join(PUB, 'logos', 'mlb')
const HEADS = path.join(PUB, 'headshots', 'mlb')
const MAP = path.join(ROOT, 'src', 'data', 'mlb-headshots.json')
const DRY = process.argv.includes('--dry')
const UA = { 'User-Agent': 'build-a-player-data-check/1.0' }

// ESPN headshots looked at and left out (initials instead): photos from after their playing days
const SKIP = new Set([
  '83',    // Andre Dawson: a recent front-office photo in a Marlins uniform
  '352',   // Paul Molitor: Twins manager photo
  '1881',  // Matt Williams: Diamondbacks coach photo
  '1988',  // Edgar Martínez: Mariners hitting coach photo
  '2586',  // Pat Hentgen: Blue Jays bullpen coach photo
  '25946', // Tony Oliva: a photo from his seventies
])

for (const d of [LOGOS, HEADS]) fs.mkdirSync(d, { recursive: true })

async function grab(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
      if (res.status === 404) return null
      if (res.status === 200) return Buffer.from(await res.arrayBuffer())
    } catch { }
    await new Promise(r => setTimeout(r, 1500))
  }
  return null
}

let logos = 0, heads = 0, noPhoto = 0
for (const t of MLB_TEAMS) {
  const f = path.join(LOGOS, `${t.short}.png`)
  if (fs.existsSync(f)) continue
  if (DRY) { console.log('would fetch logo', t.short); continue }
  const buf = await grab(`https://a.espncdn.com/i/teamlogos/mlb/500/${t.short.toLowerCase()}.png`)
  if (!buf || buf.length < 1000) { console.log(`no logo: ${t.short}`); continue }
  fs.writeFileSync(f, buf); logos++
}

const map = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP, 'utf8')) : {}
const all = [...MLB_BATTERS, ...MLB_PITCHERS, ...MLB_LEGEND_BATTERS, ...MLB_LEGEND_PITCHERS]
const ids = [...new Set(all.map(p => p.espn).filter(Boolean).map(String))]
for (const id of ids) {
  if (SKIP.has(id)) { delete map[id]; continue }
  const f = path.join(HEADS, `${id}.webp`)
  if (!fs.existsSync(f)) {
    if (DRY) { console.log('would try headshot', id); continue }
    const buf = await grab(`https://a.espncdn.com/i/headshots/mlb/players/full/${id}.png`)
    if (!buf || buf.length < 6000) { noPhoto++; delete map[id]; continue }
    await sharp(buf).webp({ quality: 75 }).toFile(f); heads++
  }
  map[id] = `mlb/${id}.webp`
}
if (!DRY) {
  const keep = new Set(ids) // players who left the pools drop out of the map (their files stay)
  const sorted = Object.fromEntries(Object.entries(map).filter(([k]) => keep.has(k)).sort((a, b) => +a[0] - +b[0]))
  fs.writeFileSync(MAP, JSON.stringify(sorted, null, 2) + '\n')
}
console.log(`logos +${logos}, headshots +${heads}, ${ids.filter(i => map[i]).length} mapped, ${noPhoto} with no ESPN photo (initials)`)
