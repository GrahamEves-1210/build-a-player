// Fetch RB headshots from Sleeper API and save locally.
// Run once: node scripts/fetch-headshots-rbs.mjs
// Output: public/headshots/{id}.jpg + updates src/data/headshots.json

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const ROOT       = path.join(__dirname, '..')
const OUT_DIR    = path.join(ROOT, 'public', 'headshots')
const MAP_FILE   = path.join(ROOT, 'src', 'data', 'headshots.json')

const RB_NAMES = [
  // ARI
  'Jeremiyah Love', 'Tyler Allgeier', 'James Conner', 'Trey Benson',
  // ATL
  'Bijan Robinson', 'Brian Robinson', 'Tyler Goodson',
  // BAL
  'Derrick Henry', 'Justice Hill', 'Rasheen Ali',
  // BUF
  'James Cook', 'Ty Johnson', 'Ray Davis',
  // CAR
  'Chuba Hubbard', 'Jonathon Brooks', 'AJ Dillon', 'Trevor Etienne',
  // CHI
  "D'Andre Swift", 'Kyle Monangai', 'Roschon Johnson',
  // CIN
  'Chase Brown', 'Samaje Perine', 'Tahj Brooks',
  // CLE
  'Quinshon Judkins', 'Dylan Sampson', 'Raheim Sanders',
  // DAL
  'Javonte Williams', 'Malik Davis', 'Jaydon Blue',
  // DEN
  'J.K. Dobbins', 'RJ Harvey', 'Jonah Coleman',
  // DET
  'Jahmyr Gibbs', 'Isiah Pacheco', 'Jacob Saylors',
  // GB
  'Josh Jacobs', 'MarShawn Lloyd', 'Chris Brooks',
  // HOU
  'David Montgomery', 'Woody Marks', 'Evan Hull',
  // IND
  'Jonathan Taylor', 'DJ Giddens', 'Seth McGowan',
  // JAX
  'Bhayshul Tuten', 'Chris Rodriguez Jr.', 'LeQuint Allen',
  // KC
  'Kenneth Walker III', 'Emari Demercado', 'Emmett Johnson',
  // LAC
  'Omarion Hampton', 'Keaton Mitchell', 'Kimani Vidal',
  // LAR
  'Kyren Williams', 'Blake Corum', 'Jarquez Hunter',
  // LV
  'Ashton Jeanty', 'Mike Washington', 'Dylan Laube',
  // MIA
  "De'Von Achane", 'Jaylen Wright', 'Ollie Gordon',
  // MIN
  'Aaron Jones', 'Jordan Mason', 'Demond Claiborne',
  // NE
  'TreVeyon Henderson', 'Rhamondre Stevenson', 'Jam Miller',
  // NO
  'Travis Etienne Jr.', 'Alvin Kamara', 'Kendre Miller',
  // NYG
  'Cam Skattebo', 'Tyrone Tracy', 'Devin Singletary',
  // NYJ
  'Breece Hall', 'Braelon Allen', 'Michael Carter',
  // PHI
  'Saquon Barkley', 'Tank Bigsby', 'Will Shipley',
  // PIT
  'Jaylen Warren', 'Rico Dowdle', 'Kaleb Johnson',
  // SF
  'Christian McCaffrey', 'Jordan James', 'Isaac Guerendo',
  // SEA
  'Jadarian Price', 'Zach Charbonnet', 'George Holani',
  // TB
  'Bucky Irving', 'Kenny Gainwell', 'Sean Tucker',
  // TEN
  'Tony Pollard', 'Tyjae Spears', 'Nicholas Singleton',
  // WAS
  'Jacory Croskey-Merritt', 'Rachaad White', 'Kaytron Allen', 'Jerome Ford',
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

  // Load existing mapping so we preserve QB headshots
  const existingMapping = fs.existsSync(MAP_FILE)
    ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))
    : {}

  console.log('Fetching Sleeper player list (~4 MB, may take a moment)...')
  const players = await fetchJSON('https://api.sleeper.app/v1/players/nfl')
  console.log(`Loaded ${Object.keys(players).length} total players`)

  const byName = new Map()
  for (const [id, p] of Object.entries(players)) {
    if (p.position === 'RB' && p.full_name) {
      byName.set(normalize(p.full_name), { id, ...p })
    }
  }
  console.log(`${byName.size} RBs indexed`)

  const mapping = { ...existingMapping }
  const unmatched = []

  for (const name of RB_NAMES) {
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

  console.log(`\nDone: ${Object.keys(mapping).length - Object.keys(existingMapping).length} new RBs added`)
  console.log(`Total mapping entries: ${Object.keys(mapping).length}`)
  if (unmatched.length) {
    console.log('Unmatched (add Sleeper IDs manually):')
    unmatched.forEach(n => console.log(`  - ${n}`))
  }
  console.log(`Images → public/headshots/   Mapping → src/data/headshots.json`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
