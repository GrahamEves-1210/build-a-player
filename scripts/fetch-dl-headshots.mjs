// One-time: ESPN headshots for the all-time DL (data/dl-legends.js) and the added current DL (data/dls.js) who didn't have one.
// ESPN's own player photos only (no Wikipedia), the same source and crop as the other espn_ headshots.
// Every id below was matched by hand against position, college and team, and every photo looked at:
// a name search alone picks the wrong man (three Kyle Williams, two Mario Williams, four Reggie Whites).
// Legends ESPN has no photo for are left out and show initials.
// node scripts/fetch-dl-headshots.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'headshots')
const MAP = path.join(ROOT, 'src', 'data', 'headshots.json')

// [name in dl-legends.js, ESPN id]
const PLAYERS = [
  ['Chandler Jones', '14927'], ['Darnell Dockett', '5589'], ['John Abraham', '2144'], ['Terrell Suggs', '4468'],
  ['Haloti Ngata', '9598'], ['Kelly Gregg', '1926'], ['Aaron Schobel', '2594'], ['Marcell Dareus', '13992'],
  ['Julius Peppers', '3530'], ['Kris Jenkins', '2592'], ['Kawann Short', '15862'], ['Charles Johnson', '10527'],
  ['Geno Atkins', '13311'], ['Carlos Dunlap', '13274'], ['Justin Smith', '2552'], ['DeMarcus Ware', '8426'],
  ['Von Miller', '13976'], ['Trevor Pryce', '1198'], ['Elvis Dumervil', '9712'], ['Ndamukong Suh', '13234'],
  ['JJ Watt', '13979'], ['Mario Williams', '9587'], ['Whitney Mercilus', '14936'], ['Jadeveon Clowney', '16734'],
  ['Dwight Freeney', '3539'], ['Robert Mathis', '4596'], ['John Henderson', '3537'], ['Marcus Stroud', '2561'],
  ['Joey Bosa', '3051389'], ['Jason Taylor', '1245'], ['Cameron Wake', '12417'], ['Jared Allen', '5651'],
  ['Richard Seymour', '2554'], ['Vince Wilfork', '5546'], ['Trey Flowers', '2574519'], ['Cameron Jordan', '13971'],
  ['Will Smith', '5543'], ['Justin Tuck', '8488'], ['Jason Pierre-Paul', '13256'], ['Muhammad Wilkerson', '13985'],
  ['Fletcher Cox', '14941'], ['Brandon Graham', '13239'], ['Aaron Smith', '1862'], ['Michael Bennett', '12762'],
  ['Cliff Avril', '11326'], ['Gerald McCoy', '13240'], ['Jurrell Casey', '14047'],
  // the Bills DT: "Kyle Williams" in headshots.json is the receiver, so this one is read from the row's own headshot field
  [null, '9720'],
  // the current players added to data/dls.js so every team has two EDGE and two DT
  ['Zaven Collins', '4244606'], ['James Pearce Jr', '5081394'], ['Mike Green', '4683188'], ['Bradley Chubb', '3116733'], ['Patrick Jones II', '4036063'],
  ['Donovan Ezeiruaku', '4683848'], ['Jonathon Cooper', '4040608'], ['Lukas Van Ness', '4686906'], ['Byron Young', '4875196'], ['Andrew Van Ginkel', '3133487'],
  ['Elijah Ponder', '4688432'], ['Carl Granderson', '3918310'], ['DJ Reader', '2977670'], ['Shelby Harris', '16837'], ['Kingsley Enagbare', '4362840'],
  ['Jonathan Greenard', '3916409'], ['Alex Highsmith', '4037333'], ['Uchenna Nwosu', '3120358'], ['Mykel Williams', '4685623'], ['Yaya Diaby', '4686334'],
  ['Dorance Armstrong', '3928979'],
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
