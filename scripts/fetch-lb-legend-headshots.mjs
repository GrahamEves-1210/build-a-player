// One-time: ESPN headshots for the all-time linebackers (data/lb-legends.js) whose careers reached the ESPN photo era.
// ESPN's own player photos only (no Wikipedia), the same source and crop as the other espn_ headshots.
// Every id below was matched by hand against position, college, debut year and team, and every photo looked at.
// None of these names is anyone else's in headshots.json, so no row needs its own headshot field.
// Left out, so they show initials: no ESPN photo (Ronald McKinnon, Brian Simmons, Dat Nguyen, Al Wilson, Cato June,
// Donnie Edwards, Zach Thomas, Tedy Bruschi, Mo Lewis, Jeremiah Trotter, Chad Brown, Shelton Quarles, and the older legends),
// or ESPN's photo is his coaching headshot in a staff polo, not a player photo (DeMeco Ryans, Bryan Cox).
// Hardy Nickerson's ESPN photo is his son; Jeremiah Trotter Jr.'s is the son too.
// node scripts/fetch-lb-legend-headshots.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'headshots')
const MAP = path.join(ROOT, 'src', 'data', 'headshots.json')

// [name in lb-legends.js, ESPN id]
const PLAYERS = [
  ['Karlos Dansby', '5558'], ['Keith Brooking', '1448'], ['Deion Jones', '2976545'], ['C.J. Mosley', '16720'],
  ['Bart Scott', '4256'], ['Takeo Spikes', '1449'], ['Luke Kuechly', '14938'], ['Thomas Davis', '8429'],
  ['Jon Beason', '10469'], ['Brian Urlacher', '2140'], ['Lance Briggs', '4526'], ['Vontaze Burfict', '15246'],
  ["D'Qwell Jackson", '9620'], ['Andra Davis', '3669'], ['Sean Lee', '13284'], ['DeAndre Levy', '12682'],
  ['A.J. Hawk', '9591'], ['Nick Barnett', '4487'], ['Brian Cushing', '12453'], ['Benardrick McKinney', '2577429'],
  ['Zach Cunningham', '3051750'], ['Darius Leonard', '3056362'], ['Gary Brackett', '4811'], ['Mike Peterson', '1788'],
  ['Daryl Smith', '5564'], ['Paul Posluszny', '10478'], ['Telvin Smith', '16891'], ['Derrick Johnson', '8430'],
  ['Stephen Cooper', '4877'], ['James Laurinaitis', '12454'], ['Chad Greenway', '9603'], ['E.J. Henderson', '4498'],
  ['Jerod Mayo', '11244'], ["Dont'a Hightower", '14933'], ['Jonathan Vilma', '5537'], ['David Harris', '10491'],
  ['James Farrior', '1219'], ['Lawrence Timmons', '10459'], ['Patrick Willis', '10455'], ['NaVorro Bowman', '13262'],
  ['Bobby Wagner', '14979'], ['Lofa Tatupu', '8459'], ['K.J. Wright', '14140'], ['Derrick Brooks', '757'],
  ['Lavonte David', '14985'], ['Keith Bulluck', '2161'], ['London Fletcher', '1680'],
]

const headshots = JSON.parse(fs.readFileSync(MAP, 'utf8'))
let added = 0
for (const [name, id] of PLAYERS) {
  const file = path.join(OUT, `espn_${id}.webp`)
  if (!fs.existsSync(file)) {
    const url = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${id}.png&w=350&h=254&scale=crop`
    const res = await fetch(url, { headers: { 'User-Agent': 'build-a-player-data-check' } })
    const buf = Buffer.from(await res.arrayBuffer())
    if (res.status !== 200 || buf.length < 6000) { console.log(`no photo: ${name} (espn ${id})`); continue }
    await sharp(buf).webp({ quality: 75 }).toFile(file)
  }
  if (name && !headshots[name]) { headshots[name] = `espn_${id}`; added++ }
}
fs.writeFileSync(MAP, JSON.stringify(headshots, null, 2) + '\n')
console.log(`${added} added to headshots.json`)
