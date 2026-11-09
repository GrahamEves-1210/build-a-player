// One-time: ESPN headshots for the all-time OL (data/ol-legends.js) who didn't have one.
// ESPN's own player photos only (no Wikipedia), the same source and crop as the other espn_ headshots.
// Every id below was matched by hand against position, college and team, and every photo looked at:
// a name search alone picks the wrong man (two Joe Thomases, two Larry Allens, two Brandon Scherff ids).
// Legends ESPN has no photo for are left out and show initials. Bruce Matthews and Mike Munchak only
// have staff (coaching polo) pictures on ESPN, not player headshots, so they stay on initials too.
// node scripts/fetch-ol-headshots.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'headshots')
const MAP = path.join(ROOT, 'src', 'data', 'headshots.json')

// [name in ol-legends.js, ESPN id]
const PLAYERS = [
  ['Marshal Yanda', '10530'], ['Jordan Gross', '4466'], ['Ryan Kalil', '10503'], ['Trai Turner', '16789'],
  ['Olin Kreutz', '1620'], ['Andrew Whitworth', '9641'], ['Joe Thomas', '10448'], ['Joel Bitonio', '16740'],
  ['Zack Martin', '16709'], ['Tyron Smith', '13978'], ['Ryan Clady', '11246'], ['David Bakhtiari', '15963'],
  ['Duane Brown', '11260'], ['Chris Myers', '8614'], ['Eric Winston', '9652'], ['Jeff Saturday', '2055'],
  ['Brad Meester', '2191'], ['Vince Manuwai', '4530'], ['Brian Waters', '2450'], ['Kris Dielman', '4897'],
  ['Nick Hardwick', '5591'], ['Steve Hutchinson', '2565'], ['Logan Mankins', '8446'], ['Matt Light', '2596'],
  ['Jahri Evans', '9694'], ['Terron Armstead', '15821'], ['Ryan Ramczyk', '3917676'], ['Chris Snee', '5559'],
  ['Nick Mangold', '9615'], ['Jason Kelce', '14124'], ['Jason Peters', '6012'], ['Alan Faneca', '1459'],
  ['David DeCastro', '14935'], ['Joe Staley', '10472'], ['Max Unger', '12624'], ['Russell Okung', '13242'],
  ['Davin Joseph', '9609'], ['Michael Roos', '8455'], ['Taylor Lewan', '16708'], ['Brandon Scherff', '2511708'],
  // the 5th legend per franchise (Nov 2026); ids checked against ESPN's bio (college, draft) and the photo.
  // No ESPN photo: Lincoln Kennedy, Robbie Tobeck, Chris Hinton, Jim Lachey, Guy McIntyre and the pre-1990 men.
  ['Alex Mack', '12616'], ['Andrew Norwell', '17388'], ['Travis Frederick', '15793'], ['Louis Vasquez', '12744'],
  ['Frank Ragnow', '3128689'], ['Wade Smith', '4536'], ['Brandon Linder', '16770'], ['Matt Birk', '1562'],
  ['Carl Nicks', '11398'], ["D'Brickashaw Ferguson", '9590'], ['Maurkice Pouncey', '13250'], ['Ali Marpet', '3165702'],
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
