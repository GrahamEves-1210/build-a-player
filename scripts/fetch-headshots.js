// Fetch QB headshots from Sleeper API and save locally.
// Run once: node scripts/fetch-headshots.js
// Output: public/headshots/{id}.jpg + src/data/headshots.json

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const ROOT       = path.join(__dirname, '..')
const OUT_DIR    = path.join(ROOT, 'public', 'headshots')
const MAP_FILE   = path.join(ROOT, 'src', 'data', 'headshots.json')

const QB_NAMES = [
  'Kyler Murray','Clayton Tune','Desmond Ridder',
  'Michael Penix Jr.','Taylor Heinicke','Logan Woodside',
  'Lamar Jackson','Tyler Huntley','Josh Johnson',
  'Josh Allen','Mitchell Trubisky','Kyle Allen',
  'Bryce Young','Andy Dalton','Jake Luton',
  'Caleb Williams','Tyson Bagent','Brett Rypien',
  'Joe Burrow','Jake Browning','Reid Sinnett',
  'Deshaun Watson','Joe Flacco','Dorian Thompson-Robinson',
  'Dak Prescott','Cooper Rush','Trey Lance',
  'Bo Nix','Zach Wilson','Jarrett Stidham',
  'Jared Goff','Hendon Hooker','Nate Sudfeld',
  'Jordan Love','Sean Clifford','Tim Boyle',
  'C.J. Stroud','Case Keenum','Davis Mills',
  'Anthony Richardson','Sam Ehlinger','Brett Hundley',
  'Trevor Lawrence','Mac Jones','C.J. Beathard',
  'Patrick Mahomes','Blaine Gabbert','Carson Wentz',
  "Aidan O'Connell",'Gardner Minshew','Shane Buechele',
  'Justin Herbert','Easton Stick','Will Grier',
  'Matthew Stafford','Stetson Bennett','Dresser Winn',
  'Tua Tagovailoa','Skylar Thompson','Mike White',
  'J.J. McCarthy','Sam Darnold','Nick Mullens',
  'Drake Maye','Jacoby Brissett','Bailey Zappe',
  'Derek Carr','Jake Haener','Spencer Rattler',
  'Tommy DeVito','Drew Lock','Jameis Winston',
  'Aaron Rodgers','Tyrod Taylor','Jordan Travis',
  'Jalen Hurts','Kenny Pickett','Tanner McKee',
  'Justin Fields','Russell Wilson','Chris Streveler',
  'Brock Purdy','Joshua Dobbs','Brandon Allen',
  'Geno Smith','Sam Howell','Jaren Hall',
  'Baker Mayfield','Kyle Trask','John Wolford',
  'Cam Ward','Will Levis','Mason Rudolph',
  'Jayden Daniels','Marcus Mariota','Jeff Driskel',
]

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[.''`]/g, '')
    .replace(/\s+jr\s*$/i, '')
    .replace(/\s+sr\s*$/i, '')
    .replace(/\s+ii\s*$/i, '')
    .replace(/\s+iii\s*$/i, '')
    .trim()
}

function get(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'build-a-player/1.0' }, ...opts }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, opts).then(resolve, reject)
      }
      resolve(res)
    })
    req.on('error', reject)
    req.setTimeout(20000, () => { req.destroy(new Error('timeout')) })
  })
}

function fetchJSON(url) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await get(url)
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch (e) { reject(e) }
      })
      res.on('error', reject)
    } catch (e) { reject(e) }
  })
}

function downloadImg(url, dest) {
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

  console.log('Fetching Sleeper player list (~4 MB, may take a moment)...')
  const players = await fetchJSON('https://api.sleeper.app/v1/players/nfl')
  console.log(`Loaded ${Object.keys(players).length} total players`)

  const byName = new Map()
  for (const [id, p] of Object.entries(players)) {
    if (p.position === 'QB' && p.full_name) {
      byName.set(normalize(p.full_name), { id, ...p })
    }
  }
  console.log(`${byName.size} QBs indexed`)

  const mapping = {}
  const unmatched = []

  for (const name of QB_NAMES) {
    const key = normalize(name)
    let match = byName.get(key)

    if (!match) {
      const parts = key.split(/\s+/)
      if (parts.length > 2) {
        const shortKey = parts[0] + ' ' + parts[parts.length - 1]
        match = byName.get(shortKey)
      }
    }

    if (!match) { unmatched.push(name); continue }

    mapping[name] = match.id
    const dest = path.join(OUT_DIR, `${match.id}.jpg`)

    if (fs.existsSync(dest)) {
      process.stdout.write(`  (cached) ${name}\n`)
      continue
    }

    try {
      await downloadImg(`https://sleepercdn.com/content/nfl/players/${match.id}.jpg`, dest)
      process.stdout.write(`  ✓ ${name} → ${match.id}.jpg\n`)
    } catch (e) {
      process.stdout.write(`  ✗ ${name} (download: ${e.message})\n`)
    }
  }

  fs.writeFileSync(MAP_FILE, JSON.stringify(mapping, null, 2))

  console.log(`\nDone: ${Object.keys(mapping).length}/${QB_NAMES.length} matched`)
  if (unmatched.length) {
    console.log('Unmatched (add Sleeper IDs manually):')
    unmatched.forEach(n => console.log(`  - ${n}`))
  }
  console.log(`Images → public/headshots/   Mapping → src/data/headshots.json`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
