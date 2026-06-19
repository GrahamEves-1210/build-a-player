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
  // ARI
  'Jacoby Brissett','Gardner Minshew','Carson Beck',
  // ATL
  'Michael Penix Jr.','Tua Tagovailoa','Trevor Siemian',
  // BAL
  'Lamar Jackson','Tyler Huntley','Skylar Thompson',
  // BUF
  'Josh Allen','Kyle Allen','Shane Buechele',
  // CAR
  'Bryce Young','Kenny Pickett','Will Grier',
  // CHI
  'Caleb Williams','Tyson Bagent','Case Keenum',
  // CIN
  'Joe Burrow','Joe Flacco','Josh Johnson',
  // CLE
  'Shedeur Sanders','Deshaun Watson','Dillon Gabriel',
  // DAL
  'Dak Prescott','Joe Milton III','Sam Howell',
  // DEN
  'Bo Nix','Jarrett Stidham','Sam Ehlinger',
  // DET
  'Jared Goff','Teddy Bridgewater','Luke Altmyer',
  // GB
  'Jordan Love','Tyrod Taylor','Kyle McCord',
  // HOU
  'C.J. Stroud','Davis Mills','Graham Mertz',
  // IND
  'Daniel Jones','Anthony Richardson','Riley Leonard',
  // JAX
  'Trevor Lawrence','Nick Mullens','Carter Bradley',
  // KC
  'Patrick Mahomes','Justin Fields','Garrett Nussmeier',
  // LV
  'Kirk Cousins','Fernando Mendoza',"Aidan O'Connell",
  // LAC
  'Justin Herbert','Trey Lance','D.J. Uiagalelei',
  // LAR
  'Matthew Stafford','Ty Simpson','Stetson Bennett',
  // MIA
  'Malik Willis','Quinn Ewers','Cam Miller',
  // MIN
  'Kyler Murray','J.J. McCarthy','Carson Wentz',
  // NE
  'Drake Maye','Tommy DeVito','Behren Morton',
  // NO
  'Tyler Shough','Spencer Rattler','Zach Wilson',
  // NYG
  'Jaxson Dart','Jameis Winston','Brandon Allen',
  // NYJ
  'Geno Smith','Cade Klubnik','Brady Cook',
  // PHI
  'Jalen Hurts','Tanner McKee','Andy Dalton',
  // PIT
  'Aaron Rodgers','Mason Rudolph','Will Howard',
  // SF
  'Brock Purdy','Mac Jones','Adrian Martinez',
  // SEA
  'Sam Darnold','Drew Lock','Jalen Milroe',
  // TB
  'Baker Mayfield','Jake Browning','Connor Bazelak',
  // TEN
  'Cam Ward','Mitchell Trubisky','Will Levis',
  // WAS
  'Jayden Daniels','Marcus Mariota','Athan Kaliakmanis',
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
