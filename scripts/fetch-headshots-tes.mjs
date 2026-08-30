// Fetch TE headshots from Sleeper API and save locally.
// Run once: node scripts/fetch-headshots-tes.mjs
// Output: public/headshots/{id}.jpg + updates src/data/headshots.json
// Then run: node scripts/compress-images.mjs  (converts .jpg → .webp)

import https from 'node:https'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const ROOT       = path.join(__dirname, '..')
const OUT_DIR    = path.join(ROOT, 'public', 'headshots')
const MAP_FILE   = path.join(ROOT, 'src', 'data', 'headshots.json')

const TE_NAMES = [
  // ARI
  'Trey McBride', 'Elijah Higgins', 'Tip Reiman',
  // ATL
  'Kyle Pitts', 'Charlie Woerner', 'Austin Hooper',
  // BAL
  'Mark Andrews', 'Durham Smythe', 'Matt Hibner',
  // BUF
  'Dalton Kincaid', 'Dawson Knox', 'Jackson Hawes',
  // CAR
  'Tommy Tremble', "Ja'Tavion Sanders", 'Mitchell Evans',
  // CHI
  'Colston Loveland', 'Cole Kmet', 'Sam Roush',
  // CIN
  'Drew Sample', 'Mike Gesicki', 'Tanner Hudson',
  // CLE
  'Harold Fannin Jr.', 'Blake Whiteheart', 'Joe Royer',
  // DAL
  'Jake Ferguson', 'Brevyn Spann-Ford', 'Luke Schoonmaker',
  // DEN
  'Adam Trautman', 'Evan Engram', 'Justin Joly',
  // DET
  'Sam LaPorta', 'Brock Wright', 'Tyler Conklin',
  // GB
  'Tucker Kraft', 'Josh Whyle', 'Luke Musgrave',
  // HOU
  'Dalton Schultz', 'Foster Moreau', 'Marlin Klein',
  // IND
  'Tyler Warren', 'Mo Alie-Cox', 'Drew Ogletree',
  // JAX
  'Brenton Strange', 'Nate Boerkircher', 'Tanner Koziol',
  // KC
  'Travis Kelce', 'Noah Gray', 'Jared Wiley',
  // LAC
  'Oronde Gadsden II', 'Charlie Kolar', 'David Njoku',
  // LAR
  'Colby Parkinson', 'Tyler Higbee', 'Terrance Ferguson',
  // LV
  'Brock Bowers', 'Michael Mayer', 'Ian Thomas',
  // MIA
  'Greg Dulcich', 'Will Kacmarek', 'Seydou Traore',
  // MIN
  'T.J. Hockenson', 'Josh Oliver', 'Ben Yurosek',
  // NE
  'Hunter Henry', 'Eli Raridon', 'C.J. Dippre',
  // NO
  'Juwan Johnson', 'Noah Fant', 'Oscar Delp',
  // NYG
  'Isaiah Likely', 'Theo Johnson', 'Chris Manhertz',
  // NYJ
  'Mason Taylor', 'Kenyon Sadiq', 'Jeremy Ruckert',
  // PHI
  'Dallas Goedert', 'Johnny Mundt', 'Eli Stowers',
  // PIT
  'Pat Freiermuth', 'Darnell Washington', 'Robert Tonyan',
  // SEA
  'AJ Barner', 'Eric Saubert', 'Elijah Arroyo',
  // SF
  'George Kittle', 'Jake Tonges', 'Luke Farrell',
  // TB
  'Cade Otton', 'Payne Durham', 'Ko Kieft',
  // TEN
  'Gunnar Helm', 'Daniel Bellinger', 'Kylen Granson',
  // WAS
  'Chig Okonkwo', 'John Bates', 'Ben Sinnott',
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

async function findESPNId(name) {
  const encoded = encodeURIComponent(name)
  const url = `https://site.api.espn.com/apis/common/v3/search?query=${encoded}&limit=5&type=player&sport=football&league=nfl`
  try {
    const data = await fetchJSON(url)
    const items = data?.items ?? []
    for (const item of items) {
      if (item.type === 'player' && item.id) return item.id
    }
    return null
  } catch { return null }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // Load existing mapping so we preserve all existing headshots
  const existingMapping = fs.existsSync(MAP_FILE)
    ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))
    : {}

  console.log('Fetching Sleeper player list (~4 MB, may take a moment)...')
  const players = await fetchJSON('https://api.sleeper.app/v1/players/nfl')
  console.log(`Loaded ${Object.keys(players).length} total players`)

  const byName = new Map()
  for (const [id, p] of Object.entries(players)) {
    if (p.position === 'TE' && p.full_name) {
      byName.set(normalize(p.full_name), { id, ...p })
    }
  }
  console.log(`${byName.size} TEs indexed from Sleeper`)

  const mapping = { ...existingMapping }
  const unmatched = []

  for (const name of TE_NAMES) {
    if (mapping[name]) {
      const dest = path.join(OUT_DIR, `${mapping[name]}.jpg`)
      if (fs.existsSync(dest)) {
        process.stdout.write(`  (cached) ${name}\n`)
        continue
      }
    }

    const key = normalize(name)
    let match = byName.get(key)

    // Fallback: try first + last name only (handles "Jr.", "II" stripped differently)
    if (!match) {
      const parts = key.split(/\s+/)
      if (parts.length > 2) {
        const shortKey = parts[0] + ' ' + parts[parts.length - 1]
        match = byName.get(shortKey)
      }
    }

    if (!match) {
      // Sleeper didn't have them — try ESPN search
      process.stdout.write(`  ? ${name} — not in Sleeper, trying ESPN...\n`)
      const espnId = await findESPNId(name)
      if (espnId) {
        const dest = path.join(OUT_DIR, `${espnId}.jpg`)
        mapping[name] = espnId
        if (!fs.existsSync(dest)) {
          try {
            const imgUrl = `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`
            await downloadImg(imgUrl, dest)
            process.stdout.write(`  ✓ ${name} → ${espnId}.jpg (ESPN)\n`)
          } catch (e) {
            process.stdout.write(`  ✗ ${name} ESPN download failed: ${e.message}\n`)
          }
        } else {
          process.stdout.write(`  (cached ESPN) ${name}\n`)
        }
      } else {
        unmatched.push(name)
        process.stdout.write(`  ✗ ${name} — not found anywhere\n`)
      }
      continue
    }

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
      // Sleeper image failed — try ESPN fallback
      const espnId = await findESPNId(name)
      if (espnId) {
        try {
          const imgUrl = `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`
          const espnDest = path.join(OUT_DIR, `${match.id}.jpg`)
          await downloadImg(imgUrl, espnDest)
          process.stdout.write(`  ✓ ${name} → ${match.id}.jpg (ESPN fallback)\n`)
        } catch (e2) {
          process.stdout.write(`  ✗ ${name} (both Sleeper + ESPN failed: ${e2.message})\n`)
        }
      } else {
        process.stdout.write(`  ✗ ${name} (Sleeper: ${e.message})\n`)
      }
    }
  }

  fs.writeFileSync(MAP_FILE, JSON.stringify(mapping, null, 2))

  const newCount = Object.keys(mapping).length - Object.keys(existingMapping).length
  console.log(`\nDone: ${newCount} new TEs added`)
  console.log(`Total mapping entries: ${Object.keys(mapping).length}`)
  if (unmatched.length) {
    console.log('Unmatched (add Sleeper IDs manually):')
    unmatched.forEach(n => console.log(`  - ${n}`))
  }
  console.log('\nNext step: node scripts/compress-images.mjs  (converts .jpg → .webp)')
  console.log('Then push to GitHub + purge jsDelivr cache for CDN update.')
}

main().catch(err => { console.error(err.message); process.exit(1) })
