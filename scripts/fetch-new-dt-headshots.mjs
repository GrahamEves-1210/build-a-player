// One-time (Nov 2026): ESPN headshots for the DTs promoted when Jordan Davis and Davon Godchaux went to the
// Jaguars: Ty Robinson (Eagles) and Christen Miller (Saints). Same source, crop and files as fetch-dl-headshots.mjs.
// node scripts/fetch-new-dt-headshots.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'headshots')
const MAP = path.join(ROOT, 'src', 'data', 'headshots.json')
const PLAYERS = [['Ty Robinson', '4569586'], ['Christen Miller', '4685479']]

const headshots = JSON.parse(fs.readFileSync(MAP, 'utf8'))
for (const [name, id] of PLAYERS) {
  const url = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${id}.png&w=350&h=254&scale=crop`
  const res = await fetch(url, { headers: { 'User-Agent': 'build-a-player-data-check' } })
  const buf = Buffer.from(await res.arrayBuffer())
  if (res.status !== 200 || buf.length < 6000) { console.log(`no photo: ${name} (espn ${id})`); continue }
  await sharp(buf).webp({ quality: 75 }).toFile(path.join(OUT, `espn_${id}.webp`))
  await sharp(buf).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toFile(path.join(OUT, `espn_${id}.jpg`))
  headshots[name] = `espn_${id}`
  console.log(`ok: ${name} espn_${id} (${buf.length} bytes)`)
}
fs.writeFileSync(MAP, JSON.stringify(headshots, null, 2) + '\n')
