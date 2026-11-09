// Soccer assets, ESPN only (the owner's rule: no Wikipedia, no other sources; initials beat a bad photo).
//   Club logos    -> public/logos/soccer/{short}.png   (ESPN soccer team logo, saved as ESPN serves it)
//   Nation flags  -> public/logos/nations/{short}.png  (ESPN country logo, saved as ESPN serves it)
//   Headshots     -> public/headshots/soccer/{espnId}.webp  (ESPN soccer player headshot, webp q75 like the
//                    other headshots; soccer ids are a different id space from the NFL/NBA ones, so they
//                    live in their own folder and can't collide with public/headshots/*.webp)
//   Map           -> src/data/soccer-headshots.json  { "<ESPN player id>": "soccer/<id>.webp" }
//
// Safe to re-run: existing files are never overwritten or re-encoded (delete one by hand to refetch it).
// Every headshot was looked at before it went in the map; SKIP lists the ones left on initials.
// node scripts/fetch-soccer-assets.mjs            (add --dry to only report what it would fetch)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { SOCCER_CLUBS } from '../src/data/soccer-clubs.js'
import { WC_NATIONS } from '../src/data/soccer-nations.js'
import { SOCCER_STRIKERS, WC_STRIKERS } from '../src/data/soccer-strikers.js' // all players, not only strikers

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUB = path.join(ROOT, 'public')
const LOGOS = path.join(PUB, 'logos', 'soccer')
const FLAGS = path.join(PUB, 'logos', 'nations')
const HEADS = path.join(PUB, 'headshots', 'soccer')
const MAP = path.join(ROOT, 'src', 'data', 'soccer-headshots.json')
const DRY = process.argv.includes('--dry')
const UA = { 'User-Agent': 'build-a-player-data-check/1.0' }

// ESPN's country-logo slug when it isn't the lowercase FIFA code
const FLAG_SLUG = { KOR: 'kors', COD: 'rdc' }

// ESPN headshots looked at and left out (wrong person, not a studio headshot, or an odd crop)
const SKIP = new Set([
])

for (const d of [LOGOS, FLAGS, HEADS]) fs.mkdirSync(d, { recursive: true })

async function grab(url) {
  const res = await fetch(url, { headers: UA })
  if (res.status !== 200) return null
  return Buffer.from(await res.arrayBuffer())
}

let logos = 0, flags = 0, heads = 0, noPhoto = 0
for (const c of SOCCER_CLUBS) {
  const f = path.join(LOGOS, `${c.short}.png`)
  if (fs.existsSync(f)) continue
  if (DRY) { console.log('would fetch logo', c.short); continue }
  const buf = await grab(`https://a.espncdn.com/i/teamlogos/soccer/500/${c.espn}.png`)
  if (!buf || buf.length < 1000) { console.log(`no logo: ${c.short} (espn ${c.espn})`); continue }
  fs.writeFileSync(f, buf); logos++
}
for (const n of WC_NATIONS) {
  const f = path.join(FLAGS, `${n.short}.png`)
  if (fs.existsSync(f)) continue
  if (DRY) { console.log('would fetch flag', n.short); continue }
  const slug = FLAG_SLUG[n.short] || n.short.toLowerCase()
  const buf = await grab(`https://a.espncdn.com/i/teamlogos/countries/500/${slug}.png`)
  if (!buf || buf.length < 1000) { console.log(`no flag: ${n.short}`); continue }
  fs.writeFileSync(f, buf); flags++
}

const map = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP, 'utf8')) : {}
const ids = [...new Set([...SOCCER_STRIKERS, ...WC_STRIKERS].map(p => p.espn).filter(Boolean).map(String))]
for (const id of ids) {
  if (SKIP.has(id)) { delete map[id]; continue }
  const f = path.join(HEADS, `${id}.webp`)
  if (!fs.existsSync(f)) {
    if (DRY) { console.log('would try headshot', id); continue }
    const buf = await grab(`https://a.espncdn.com/i/headshots/soccer/players/full/${id}.png`)
    if (!buf || buf.length < 6000) { noPhoto++; delete map[id]; continue }
    await sharp(buf).webp({ quality: 75 }).toFile(f); heads++
  }
  map[id] = `soccer/${id}.webp`
}
if (!DRY) {
  const keep = new Set(ids) // players who left the pool drop out of the map (their files stay)
  const sorted = Object.fromEntries(Object.entries(map).filter(([k]) => keep.has(k)).sort((a, b) => +a[0] - +b[0]))
  fs.writeFileSync(MAP, JSON.stringify(sorted, null, 2) + '\n')
}
console.log(`logos +${logos}, flags +${flags}, headshots +${heads}, ${ids.filter(i => map[i]).length} mapped, ${noPhoto} with no ESPN photo (initials)`)
